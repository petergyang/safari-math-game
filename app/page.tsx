"use client";
/* eslint-disable @next/next/no-img-element -- These local transparent WebP sprites need fluid intrinsic sizing. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Question = { a: number; b: number; answer: number; choices: number[] };
type Guide = { name: string; image: string; cheer: string };
type GamePhase = "day" | "night-transition" | "boss" | "boss-won" | "boss-lost";

const ROUND_LENGTH = 12;
const BOSS_TIME_LIMIT = 60;
const MIN_FACTOR = 2;
const MAX_FACTOR = 12;
const INITIAL_QUESTION: Question = { a: 2, b: 2, answer: 4, choices: [4, 6, 8, 10] };

const guides: Guide[] = [
  { name: "Leo", image: "/assets/safari/guide-lion.webp", cheer: "Roar-some!" },
  { name: "Bubbles", image: "/assets/safari/guide-elephant.webp", cheer: "Trunk-tastic!" },
  { name: "Gigi", image: "/assets/safari/guide-giraffe.webp", cheer: "Standing tall!" },
  { name: "Ziggy", image: "/assets/safari/guide-zebra.webp", cheer: "Stripe-tacular!" },
  { name: "Mika", image: "/assets/safari/guide-meerkat.webp", cheer: "Sharp spotting!" },
];

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapWith]] = [copy[swapWith], copy[index]];
  }
  return copy;
};

const randomFactor = () => Math.floor(Math.random() * (MAX_FACTOR - MIN_FACTOR + 1)) + MIN_FACTOR;
const questionKey = (a: number, b: number) => [a, b].sort((left, right) => left - right).join("x");

function makeQuestionForFactors(a: number, b: number): Question {
  const answer = a * b;
  const candidates = shuffle([
    answer - a,
    answer + a,
    answer - b,
    answer + b,
    answer - 2,
    answer + 2,
    answer - 5,
    answer + 5,
    answer - 1,
    answer + 1,
    answer - 3,
    answer + 3,
  ]).filter((value) => value >= MIN_FACTOR * MIN_FACTOR && value <= MAX_FACTOR * MAX_FACTOR && value !== answer);
  const choices = new Set<number>([answer]);
  for (const candidate of candidates) {
    choices.add(candidate);
    if (choices.size === 4) break;
  }
  for (let distance = 1; choices.size < 4 && distance <= 20; distance += 1) {
    for (const candidate of [answer - distance, answer + distance]) {
      if (candidate >= MIN_FACTOR * MIN_FACTOR && candidate <= MAX_FACTOR * MAX_FACTOR) choices.add(candidate);
      if (choices.size === 4) break;
    }
  }
  return { a, b, answer, choices: shuffle([...choices]) };
}

function makeQuestion(table: number | null, avoid?: string): Question {
  let a = table ?? randomFactor();
  let b = randomFactor();
  let tries = 0;
  while (questionKey(a, b) === avoid && tries < 12) {
    a = table ?? randomFactor();
    b = randomFactor();
    tries += 1;
  }
  if (questionKey(a, b) === avoid) {
    for (let offset = 1; offset <= MAX_FACTOR - MIN_FACTOR + 1; offset += 1) {
      const nextB = MIN_FACTOR + ((b - MIN_FACTOR + offset) % (MAX_FACTOR - MIN_FACTOR + 1));
      if (questionKey(a, nextB) !== avoid) {
        b = nextB;
        break;
      }
    }
  }

  return makeQuestionForFactors(a, b);
}

function loadNumber(key: string) {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function SafariWebGL({ celebrate, night }: { celebrate: boolean; night: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) return;

    const vertexSource = `
      attribute vec2 a_position;
      attribute float a_size;
      attribute float a_phase;
      uniform float u_time;
      uniform vec2 u_pointer;
      uniform float u_burst;
      uniform float u_night;
      varying float v_alpha;
      varying float v_heat;
      varying float v_life;
      void main() {
        float drift = sin(u_time * 0.00045 + a_phase) * 0.035;
        vec2 dayPos = a_position + vec2(drift + u_pointer.x * 0.018, cos(u_time * 0.00032 + a_phase) * 0.025 + u_pointer.y * 0.012);
        float life = mod((a_position.y + 1.0) + u_time * (0.00022 + fract(a_phase) * 0.00007), 0.92);
        float climb = -1.03 + life;
        float sway = sin(u_time * 0.0017 + a_phase * 2.0) * (0.025 + life * 0.075);
        vec2 firePos = vec2(a_position.x + sway + u_pointer.x * 0.01, climb);
        vec2 pos = mix(dayPos, firePos, u_night);
        pos *= 1.0 + u_burst * 0.12;
        gl_Position = vec4(pos, 0.0, 1.0);
        float fireScale = 1.75 - life * 1.05;
        gl_PointSize = mix(a_size * (1.0 + u_burst * 1.8), a_size * fireScale, u_night);
        v_alpha = mix(0.34 + 0.42 * sin(u_time * 0.001 + a_phase), 0.55 + 0.35 * sin(u_time * 0.0015 + a_phase), u_night);
        v_heat = u_night;
        v_life = life;
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform float u_burst;
      varying float v_alpha;
      varying float v_heat;
      varying float v_life;
      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float distanceFromCenter = length(point);
        float flameDistance = length(vec2(point.x * 1.18, point.y * 0.72));
        float glow = mix(smoothstep(0.5, 0.0, distanceFromCenter), smoothstep(0.52, 0.0, flameDistance), v_heat);
        vec3 gold = mix(vec3(1.0, 0.72, 0.16), vec3(1.0, 0.96, 0.56), glow);
        vec3 ember = vec3(1.0, 0.12, 0.015);
        vec3 hot = vec3(1.0, 0.94, 0.34);
        vec3 fire = mix(ember, hot, clamp(glow * 1.25 + (1.0 - v_life) * 0.24, 0.0, 1.0));
        float fireAlpha = glow * v_alpha * (1.0 - v_life * 0.34);
        gl_FragColor = vec4(mix(gold, fire, v_heat), mix(glow * (v_alpha + u_burst * 0.45), fireAlpha, v_heat));
      }
    `;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const particleCount = night ? 112 : 54;
    const data = new Float32Array(particleCount * 4);
    for (let index = 0; index < particleCount; index += 1) {
      const fireSide = index % 2 === 0 ? -0.77 : 0.77;
      data[index * 4] = night ? fireSide + (Math.random() - 0.5) * 0.38 : Math.random() * 2 - 1;
      data[index * 4 + 1] = night ? -1 + Math.random() * 0.92 : Math.random() * 1.5 - 0.75;
      data[index * 4 + 2] = night ? 18 + Math.random() * 34 : 4 + Math.random() * 9;
      data[index * 4 + 3] = Math.random() * Math.PI * 2;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    const position = gl.getAttribLocation(program, "a_position");
    const size = gl.getAttribLocation(program, "a_size");
    const phase = gl.getAttribLocation(program, "a_phase");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(size);
    gl.vertexAttribPointer(size, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(phase);
    gl.vertexAttribPointer(phase, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    const timeUniform = gl.getUniformLocation(program, "u_time");
    const pointerUniform = gl.getUniformLocation(program, "u_pointer");
    const burstUniform = gl.getUniformLocation(program, "u_burst");
    const nightUniform = gl.getUniformLocation(program, "u_night");
    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX / window.innerWidth - 0.5;
      pointer.y = 0.5 - event.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    let frame = 0;
    let start = performance.now();
    const render = (time: number) => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.floor(canvas.clientWidth * scale);
      const height = Math.floor(canvas.clientHeight * scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.uniform1f(timeUniform, time);
      gl.uniform2f(pointerUniform, pointer.x, pointer.y);
      const elapsed = time - start;
      const burst = celebrate ? Math.max(0, 1 - elapsed / 1100) : 0;
      gl.uniform1f(burstUniform, burst);
      gl.uniform1f(nightUniform, night ? 1 : 0);
      gl.drawArrays(gl.POINTS, 0, particleCount);
      frame = requestAnimationFrame(render);
    };
    start = performance.now();
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [celebrate, night]);

  return <canvas ref={canvasRef} className="safari-webgl" aria-hidden="true" />;
}

export default function Home() {
  const [table, setTable] = useState<number | null>(null);
  const [question, setQuestion] = useState<Question>(INITIAL_QUESTION);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrongChoices, setWrongChoices] = useState<number[]>([]);
  const [feedback, setFeedback] = useState("Choose your answer!");
  const [celebrate, setCelebrate] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("day");
  const [bossSecondsLeft, setBossSecondsLeft] = useState(BOSS_TIME_LIMIT);
  const [bossCleared, setBossCleared] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [missed, setMissed] = useState<{ a: number; b: number }[]>([]);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const phaseRef = useRef<GamePhase>("day");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTotalStars(loadNumber("serena-stars"));
      setQuestion(makeQuestion(null));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (phase !== "night-transition") return;
    const transition = window.setTimeout(() => {
      setQuestion(makeQuestion(table));
      setRound(0);
      setSelected(null);
      setWrongChoices([]);
      setBossSecondsLeft(BOSS_TIME_LIMIT);
      setBossCleared(false);
      setCelebrate(false);
      setMissed([]);
      setFeedback("Defeat the pride before time runs out!");
      setPhase("boss");
    }, 1700);
    return () => window.clearTimeout(transition);
  }, [phase, table]);

  useEffect(() => {
    if (phase !== "boss" || bossCleared) return;
    let secondsRemaining = BOSS_TIME_LIMIT;
    const timer = window.setInterval(() => {
      secondsRemaining -= 1;
      setBossSecondsLeft(secondsRemaining);
      if (secondsRemaining > 0) return;
      window.clearInterval(timer);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      setSelected(null);
      setCelebrate(false);
      setFeedback("You ran out of time to beat the pride!");
      setPhase("boss-lost");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [bossCleared, phase]);

  const guide = guides[round % guides.length];

  const playTone = useCallback((correct: boolean) => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = correct ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(correct ? 520 : 210, context.currentTime);
      if (correct) oscillator.frequency.exponentialRampToValueAtTime(920, context.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.32);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.34);
    } catch { /* Sound is optional. */ }
  }, [soundOn]);

  const nextQuestion = useCallback((activeTable: number | null, previous: Question) => {
    const previousKey = questionKey(previous.a, previous.b);
    const retryCandidate = missed.length > 0 && Math.random() < 0.45 ? missed[0] : null;
    const retry = retryCandidate && questionKey(retryCandidate.a, retryCandidate.b) !== previousKey ? retryCandidate : null;
    if (retry) {
      setQuestion(makeQuestionForFactors(retry.a, retry.b));
      setMissed((items) => items.slice(1));
      return;
    }
    setQuestion(makeQuestion(activeTable, previousKey));
  }, [missed]);

  const answerQuestion = useCallback((choice: number) => {
    const activePhase = phase;
    const isBossRound = activePhase === "boss";
    if ((activePhase !== "day" && !isBossRound) || selected !== null || wrongChoices.includes(choice) || (isBossRound && bossSecondsLeft <= 0)) return;
    const correct = choice === question.answer;
    playTone(correct);
    if (!correct) {
      setWrongChoices((choices) => [...choices, choice]);
      setStreak(0);
      setFeedback("Not quite — try another answer!");
      if (wrongChoices.length === 0 && activePhase === "day") {
        setMissed((items) => [...items, { a: question.a, b: question.b }]);
      }
      return;
    }

    setSelected(choice);
    const nextStars = totalStars + (isBossRound ? 2 : 1);
    if (wrongChoices.length === 0 && activePhase === "day") setScore((value) => value + 1);
    setStreak((value) => value + 1);
    setTotalStars(nextStars);
    setCelebrate(true);
    setFeedback(`${isBossRound ? "Direct hit!" : guide.cheer} ${question.a} × ${question.b} = ${question.answer}`);
    window.localStorage.setItem("serena-stars", String(nextStars));

    const nextRound = round + 1;
    if (isBossRound && nextRound >= ROUND_LENGTH) setBossCleared(true);
    advanceTimer.current = setTimeout(() => {
      if (phaseRef.current !== activePhase) return;
      setCelebrate(false);
      setSelected(null);
      setWrongChoices([]);
      if (nextRound >= ROUND_LENGTH) {
        setRound(nextRound);
        setPhase(isBossRound ? "boss-won" : "night-transition");
      } else {
        setRound(nextRound);
        if (isBossRound) setQuestion(makeQuestion(table, questionKey(question.a, question.b)));
        else nextQuestion(table, question);
        setFeedback(isBossRound ? "Defeat the pride before time runs out!" : "Choose your answer!");
      }
    }, isBossRound ? 650 : 1000);
  }, [bossSecondsLeft, guide.cheer, nextQuestion, phase, playTone, question, round, selected, table, totalStars, wrongChoices]);

  const toggleMusic = useCallback(async () => {
    const music = musicRef.current;
    if (!music) return;
    if (musicOn) {
      music.pause();
      setMusicOn(false);
      return;
    }
    music.volume = 0.24;
    try {
      await music.play();
      setMusicOn(true);
    } catch {
      setFeedback("Tap the music button again to start the safari soundtrack.");
    }
  }, [musicOn]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < question.choices.length) answerQuestion(question.choices[index]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answerQuestion, question.choices]);

  const startRound = (nextTable: number | null) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setTable(nextTable);
    setQuestion(makeQuestion(nextTable));
    setRound(0);
    setScore(0);
    setStreak(0);
    setSelected(null);
    setWrongChoices([]);
    setPhase("day");
    setBossSecondsLeft(BOSS_TIME_LIMIT);
    setBossCleared(false);
    setCelebrate(false);
    setMissed([]);
    setFeedback(nextTable ? `${nextTable}s trail ready!` : "Safari Mix ready!");
  };

  const startBossBattle = (nextTable: number | null = table) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setTable(nextTable);
    setQuestion(makeQuestion(nextTable));
    setRound(0);
    setSelected(null);
    setWrongChoices([]);
    setBossSecondsLeft(BOSS_TIME_LIMIT);
    setBossCleared(false);
    setCelebrate(false);
    setMissed([]);
    setFeedback("Defeat the pride before time runs out!");
    setPhase("boss");
  };

  const progressDots = useMemo(() => Array.from({ length: ROUND_LENGTH }, (_, index) => index), []);
  const isBossMode = phase === "night-transition" || phase === "boss" || phase === "boss-won" || phase === "boss-lost";
  const isSummary = phase === "boss-won" || phase === "boss-lost";
  const formattedBossTime = `00:${String(bossSecondsLeft).padStart(2, "0")}`;

  return (
    <main className={`safari-game ${celebrate ? "is-celebrating" : ""} ${isBossMode ? "is-night" : ""}`}>
      <div className="safari-background" aria-hidden="true" />
      <div className="safari-vignette" aria-hidden="true" />
      {isBossMode && <div className="boss-fire-stage" aria-hidden="true">
        <div className="boss-flame boss-flame-left"><i /><i /><i /></div>
        <div className="boss-flame boss-flame-right"><i /><i /><i /></div>
      </div>}
      <SafariWebGL celebrate={celebrate} night={isBossMode} />

      <header className="game-header">
        <div className="brand" aria-label="Serena's Safari Math">
          <span className="brand-paw" aria-hidden="true">🐾</span>
          <strong>SERENA’S <em>SAFARI MATH</em></strong>
        </div>
        <div className="game-stats">
          <div className="hud-pill"><span aria-hidden="true">⭐</span><strong>{totalStars}</strong><small>STARS</small></div>
          <div className="hud-pill streak"><span aria-hidden="true">🔥</span><strong>{streak}</strong><small>STREAK</small></div>
          <button className={`sound-button music-button ${musicOn ? "active" : ""}`} type="button" onClick={toggleMusic} aria-label={musicOn ? "Pause safari music" : "Play safari music"}>{musicOn ? "🎵" : "🎶"}</button>
          <button className="sound-button" type="button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "Turn sound off" : "Turn sound on"}>{soundOn ? "🔊" : "🔇"}</button>
        </div>
      </header>

      <section className={`game-stage ${isSummary ? "is-finished" : ""} ${phase === "boss" ? "is-boss" : ""}`} aria-live="polite">
        {(phase === "day" || phase === "boss") && <label className="trail-picker">
          <span className="sr-only">Choose a multiplication table</span>
          <select value={table ?? "mix"} onChange={(event) => {
            const nextTable = event.target.value === "mix" ? null : Number(event.target.value);
            if (phase === "boss") startBossBattle(nextTable);
            else startRound(nextTable);
          }}>
            <option value="mix">MIX</option>
            {Array.from({ length: 11 }, (_, index) => index + 2).map((value) => <option value={value} key={value}>{value}s</option>)}
          </select>
          <span aria-hidden="true">⌄</span>
        </label>}

        {(phase === "day" || phase === "boss") && (
          <section className={`question-world ${phase === "boss" ? "boss-world" : ""}`}>
            {phase === "day" && <img className={`animal-guide guide-${guide.name.toLowerCase()}`} src={guide.image} alt={`${guide.name}, your safari guide`} />}
            {phase === "boss" && <img className="boss-pride" src="/assets/safari/boss-pride.webp" alt="The rival lion and his three hyena teammates" />}
            <div className={`question-card ${phase === "boss" ? "boss-card" : ""}`}>
              {phase === "boss" && <div className="boss-hud">
                <div className="boss-label"><span aria-hidden="true">🔥</span> BOSS BATTLE <span aria-hidden="true">🔥</span></div>
                <div className="boss-health" aria-label={`${round} of ${ROUND_LENGTH} boss energy segments cleared`}>
                  {progressDots.map((index) => <span key={index} className={index < round ? "cleared" : ""} />)}
                </div>
                <div className={`boss-timer ${bossSecondsLeft <= 15 ? "urgent" : ""}`} aria-label={`${bossSecondsLeft} seconds remaining`}>{formattedBossTime}</div>
              </div>}
              <div className="question-count">QUESTION {round + 1} OF {ROUND_LENGTH}</div>
              <div className="equation" aria-label={`${question.a} times ${question.b}`}>
                <span>{question.a}</span><b>×</b><span>{question.b}</span><i>=</i><em>?</em>
              </div>
              <div className="answer-grid" role="group" aria-label="Answer choices">
                {question.choices.map((choice, index) => {
                  const isCorrect = selected === choice && choice === question.answer;
                  const isWrong = wrongChoices.includes(choice);
                  return (
                    <button
                      type="button"
                      key={`${question.a}-${question.b}-${choice}`}
                      onClick={() => answerQuestion(choice)}
                      disabled={selected !== null || isWrong}
                      className={`${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                      aria-label={`Answer ${choice}`}
                    >
                      <kbd>{index + 1}</kbd><strong>{choice}</strong>
                      {isCorrect && <span className="answer-mark">✓</span>}
                      {isWrong && <span className="answer-mark">×</span>}
                    </button>
                  );
                })}
              </div>
              <p className={`feedback ${selected === question.answer ? "positive" : ""}`}>{feedback}</p>
              {phase === "day" && <div className="round-progress" aria-label={`${round} of ${ROUND_LENGTH} questions complete`}>
                {progressDots.map((index) => <span key={index} className={index < round ? "done" : index === round ? "current" : ""} />)}
              </div>}
            </div>
          </section>
        )}

        {phase === "night-transition" && <section className="night-transition-card" aria-label="Level one complete. Night boss battle beginning.">
          <span>LEVEL ONE COMPLETE</span>
          <strong>{score} / {ROUND_LENGTH} FIRST TRY</strong>
          <h1>Night is falling…</h1>
          <p>Boss battle begins now.</p>
          <div className="transition-flame" aria-hidden="true">🔥</div>
        </section>}

        {phase === "boss-won" && <section className="finish-card boss-result-card victory">
          <div className="finish-guides" aria-hidden="true">
            {guides.map((animal) => <img src={animal.image} alt="" key={animal.name} />)}
          </div>
          <span>NIGHT SAFARI SAVED</span>
          <h1>Boss defeated!</h1>
          <p>You cleared all <strong>{ROUND_LENGTH} questions</strong> with <strong>{bossSecondsLeft} seconds</strong> left.</p>
          <button type="button" onClick={() => startRound(table)}>NEW EXPEDITION</button>
          <button type="button" className="mix-again" onClick={() => startBossBattle()}>REMATCH THE PRIDE</button>
        </section>}

        {phase === "boss-lost" && <section className="finish-card boss-result-card defeat">
          <span>TIME’S UP</span>
          <h1>You ran out of time to beat the pride!</h1>
          <p>You cleared <strong>{round} of {ROUND_LENGTH}</strong> questions. The boss battle restarts without replaying level one.</p>
          <button type="button" onClick={() => startBossBattle()}>TRY BOSS AGAIN</button>
          <button type="button" className="mix-again" onClick={() => startRound(table)}>RETURN TO DAY</button>
        </section>}
      </section>
      <audio ref={musicRef} src="/audio/jungle-marimba-loop.ogg" loop preload="metadata" />
    </main>
  );
}
