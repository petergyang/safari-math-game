"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Question = { a: number; b: number; answer: number; choices: number[] };
type Animal = { emoji: string; name: string; color: string };

const ROUND_LENGTH = 12;
const animals: Animal[] = [
  { emoji: "🦁", name: "Leo", color: "#ffb22e" }, { emoji: "🦊", name: "Pip", color: "#ff7b54" },
  { emoji: "🐼", name: "Mochi", color: "#77c66e" }, { emoji: "🦒", name: "Gigi", color: "#ffd166" },
  { emoji: "🐘", name: "Bubbles", color: "#84c5f4" }, { emoji: "🐨", name: "Koko", color: "#b9a7e8" },
  { emoji: "🦦", name: "Ollie", color: "#d9a46f" }, { emoji: "🐯", name: "Tango", color: "#ff9f43" },
];
const encouragements = ["Roar-some!", "Wildly correct!", "Safari fire!", "Math magic!", "Brilliant beast mode!"];

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function makeQuestion(table: number | null, avoid?: string): Question {
  let a = table ?? Math.floor(Math.random() * 12) + 1;
  let b = Math.floor(Math.random() * 12) + 1;
  let tries = 0;
  while (`${a}x${b}` === avoid && tries < 8) {
    a = table ?? Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 12) + 1;
    tries += 1;
  }
  const answer = a * b;
  const nearby = new Set<number>([answer]);
  const offsets = shuffle([-12, -10, -8, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 8, 10, 12]);
  for (const offset of offsets) {
    if (nearby.size >= 4) break;
    const option = answer + offset;
    if (option > 0 && option <= 144) nearby.add(option);
  }
  return { a, b, answer, choices: shuffle([...nearby]) };
}

function loadNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export default function Home() {
  const [table, setTable] = useState<number | null>(null);
  const [question, setQuestion] = useState<Question>(() => makeQuestion(null));
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [unlocked, setUnlocked] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("Pick the answer to help Leo explore!");
  const [celebrate, setCelebrate] = useState(false);
  const [finished, setFinished] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [missed, setMissed] = useState<{ a: number; b: number }[]>([]);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBestStreak(loadNumber("serena-best-streak", 0));
    setTotalStars(loadNumber("serena-stars", 0));
    setUnlocked(Math.min(animals.length, loadNumber("serena-animals", 1)));
  }, []);

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  const playTone = useCallback((correct: boolean) => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = correct ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(correct ? 540 : 220, context.currentTime);
      if (correct) oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.18);
      gain.gain.setValueAtTime(0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.3);
    } catch { /* Sound is a bonus. */ }
  }, [soundOn]);

  const newQuestion = useCallback((activeTable: number | null, previous?: Question) => {
    const retry = missed.length > 0 && Math.random() < 0.4 ? missed[0] : null;
    if (retry) {
      const base = makeQuestion(retry.a, `${previous?.a}x${previous?.b}`);
      const answer = retry.a * retry.b;
      const choices = shuffle([answer, ...base.choices.filter((value) => value !== answer)]).slice(0, 4);
      setQuestion({ a: retry.a, b: retry.b, answer, choices });
      setMissed((items) => items.slice(1));
    } else setQuestion(makeQuestion(activeTable, `${previous?.a}x${previous?.b}`));
  }, [missed]);

  const saveProgress = (newBest: number, newStars: number, newUnlocked: number) => {
    window.localStorage.setItem("serena-best-streak", String(newBest));
    window.localStorage.setItem("serena-stars", String(newStars));
    window.localStorage.setItem("serena-animals", String(newUnlocked));
  };

  const answerQuestion = useCallback((choice: number) => {
    if (selected !== null || finished) return;
    setSelected(choice);
    const correct = choice === question.answer;
    playTone(correct);
    if (correct) {
      const nextStreak = streak + 1;
      const nextBest = Math.max(bestStreak, nextStreak);
      const nextStars = totalStars + 1;
      const nextUnlocked = Math.min(animals.length, Math.max(unlocked, Math.floor(nextStars / 4) + 1));
      setScore((value) => value + 1); setStreak(nextStreak); setBestStreak(nextBest); setTotalStars(nextStars); setUnlocked(nextUnlocked);
      setCelebrate(true); setFeedback(encouragements[Math.floor(Math.random() * encouragements.length)]);
      saveProgress(nextBest, nextStars, nextUnlocked);
    } else {
      setStreak(0); setFeedback(`${question.a} × ${question.b} = ${question.answer}. You’ve got the next one!`);
      setMissed((items) => [...items, { a: question.a, b: question.b }]);
    }
    const nextRound = round + 1;
    advanceTimer.current = setTimeout(() => {
      setCelebrate(false); setSelected(null);
      if (nextRound >= ROUND_LENGTH) { setFinished(true); setRound(nextRound); }
      else { setRound(nextRound); newQuestion(table, question); setFeedback("Choose the answer!"); }
    }, correct ? 900 : 1500);
  }, [bestStreak, finished, newQuestion, playTone, question, round, selected, streak, table, totalStars, unlocked]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index <= 3 && question.choices[index] !== undefined) answerQuestion(question.choices[index]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answerQuestion, question.choices]);

  const changeTable = (nextTable: number | null) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setTable(nextTable); setRound(0); setScore(0); setStreak(0); setSelected(null); setFinished(false); setCelebrate(false);
    setFeedback(nextTable ? `Welcome to the ${nextTable}s trail!` : "Safari Mix activated — anything can happen!");
    setQuestion(makeQuestion(nextTable));
  };

  const progress = Math.min(100, (round / ROUND_LENGTH) * 100);
  const guide = animals[Math.min(unlocked - 1, animals.length - 1)];
  const confetti = useMemo(() => Array.from({ length: 18 }, (_, index) => index), []);

  return (
    <main className="game-shell">
      <div className="sun" aria-hidden="true" /><div className="cloud cloud-one" aria-hidden="true" /><div className="cloud cloud-two" aria-hidden="true" />
      <div className="hill hill-back" aria-hidden="true" /><div className="hill hill-front" aria-hidden="true" />
      <header className="topbar">
        <div className="brand" aria-label="Serena's Safari Math"><span className="brand-paw">🐾</span><div><strong>SERENA’S</strong><span>SAFARI MATH</span></div></div>
        <div className="top-stats">
          <div className="stat-pill"><span>⭐</span><div><b>{totalStars}</b><small>STARS</small></div></div>
          <div className="stat-pill"><span>🔥</span><div><b>{bestStreak}</b><small>BEST</small></div></div>
          <button className="sound-button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "Turn sound off" : "Turn sound on"}>{soundOn ? "🔊" : "🔇"}</button>
        </div>
      </header>

      <section className="mission-bar" aria-label="Choose a multiplication table">
        <div className="mission-copy"><span>🧭</span><div><small>CHOOSE YOUR TRAIL</small><strong>{table ? `${table}s Training` : "Safari Mix"}</strong></div></div>
        <div className="table-tabs"><button className={table === null ? "active" : ""} onClick={() => changeTable(null)}>MIX</button>
          {Array.from({ length: 11 }, (_, index) => index + 2).map((value) => <button className={table === value ? "active" : ""} onClick={() => changeTable(value)} key={value}>{value}s</button>)}
        </div>
      </section>

      <div className="play-layout">
        <section className="game-card" aria-live="polite">
          {celebrate && <div className="confetti" aria-hidden="true">{confetti.map((piece) => <i key={piece} style={{ "--i": piece } as React.CSSProperties} />)}</div>}
          {!finished ? <>
            <div className="round-row"><span>Question {round + 1} of {ROUND_LENGTH}</span><span className="streak-badge">🔥 {streak} streak</span></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="question-stage"><div className="guide-bubble" style={{ background: guide.color }} aria-hidden="true">{guide.emoji}</div><div className="speech-tail" />
              <div className="question-copy"><span>WHAT IS</span><h1>{question.a} <em>×</em> {question.b}<b>?</b></h1></div>
            </div>
            <div className="answers" role="group" aria-label="Answer choices">
              {question.choices.map((choice, index) => {
                const isCorrect = selected !== null && choice === question.answer;
                const isWrong = selected === choice && choice !== question.answer;
                return <button key={`${question.a}-${question.b}-${choice}`} onClick={() => answerQuestion(choice)} disabled={selected !== null} className={`${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`} aria-label={`Answer ${choice}`}>
                  <kbd>{index + 1}</kbd><span>{choice}</span>{isCorrect && <i>✓</i>}{isWrong && <i>×</i>}
                </button>;
              })}
            </div>
            <p className={`feedback ${selected === question.answer ? "yay" : ""}`}>{feedback}</p>
          </> : <div className="finish-panel">
            <div className="finish-animals">🦁 🦒 🐘</div><span className="finish-kicker">EXPEDITION COMPLETE!</span>
            <h1>{score >= 10 ? "Legendary explorer!" : score >= 7 ? "Wild work!" : "Great adventure!"}</h1>
            <p>You solved <strong>{score} of {ROUND_LENGTH}</strong> and collected <strong>{score} new stars</strong>.</p>
            <div className="finish-score"><span>⭐</span><strong>{score}</strong><small>RIGHT</small></div>
            <button className="again-button" onClick={() => changeTable(table)}>PLAY AGAIN <span>→</span></button>
            <button className="switch-button" onClick={() => changeTable(null)}>Try Safari Mix</button>
          </div>}
        </section>

        <aside className="animal-card">
          <div className="animal-heading"><div><small>YOUR SAFARI CREW</small><strong>{unlocked} of {animals.length} friends</strong></div><span>🏕️</span></div>
          <div className="animal-grid">{animals.map((animal, index) => {
            const isUnlocked = index < unlocked;
            return <div className={`animal-tile ${isUnlocked ? "unlocked" : "locked"}`} key={animal.name} style={{ "--animal": animal.color } as React.CSSProperties}>
              <span>{isUnlocked ? animal.emoji : "?"}</span><small>{isUnlocked ? animal.name : `${Math.max(0, index * 4 - totalStars)} ⭐`}</small>
            </div>;
          })}</div>
          <div className="unlock-meter"><div><span>NEXT FRIEND</span><strong>{unlocked === animals.length ? "Crew complete!" : `${4 - (totalStars % 4)} stars away`}</strong></div>
            <div className="mini-track"><span style={{ width: unlocked === animals.length ? "100%" : `${(totalStars % 4) * 25}%` }} /></div></div>
          <div className="tip-box"><span>💡</span><p><strong>Explorer tip</strong>Use the number keys 1–4 for lightning-fast answers.</p></div>
        </aside>
      </div>
      <footer><span>Made with big roars for Serena</span><span>•</span><span>Every mistake makes your brain stronger 💪</span></footer>
    </main>
  );
}
