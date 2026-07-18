"use client";
/* eslint-disable @next/next/no-img-element -- These local transparent WebP sprites need fluid intrinsic sizing. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Question = { a: number; b: number; answer: number; choices: number[] };
type Guide = { name: string; image: string; cheer: string };

const ROUND_LENGTH = 12;
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

function makeQuestion(table: number | null, avoid?: string): Question {
  let a = table ?? randomFactor();
  let b = randomFactor();
  let tries = 0;
  while (`${a}x${b}` === avoid && tries < 12) {
    a = table ?? randomFactor();
    b = randomFactor();
    tries += 1;
  }

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
  ]).filter((value) => value >= MIN_FACTOR * MIN_FACTOR && value <= MAX_FACTOR * MAX_FACTOR && value !== answer);
  const choices = new Set<number>([answer]);
  for (const candidate of candidates) {
    choices.add(candidate);
    if (choices.size === 4) break;
  }
  while (choices.size < 4) choices.add(Math.max(4, Math.min(144, answer + choices.size * 3)));
  return { a, b, answer, choices: shuffle([...choices]) };
}

function loadNumber(key: string) {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function SafariWebGL({ celebrate }: { celebrate: boolean }) {
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
      varying float v_alpha;
      void main() {
        float drift = sin(u_time * 0.00045 + a_phase) * 0.035;
        vec2 pos = a_position + vec2(drift + u_pointer.x * 0.018, cos(u_time * 0.00032 + a_phase) * 0.025 + u_pointer.y * 0.012);
        pos *= 1.0 + u_burst * 0.12;
        gl_Position = vec4(pos, 0.0, 1.0);
        gl_PointSize = a_size * (1.0 + u_burst * 1.8);
        v_alpha = 0.34 + 0.42 * sin(u_time * 0.001 + a_phase);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform float u_burst;
      varying float v_alpha;
      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float distanceFromCenter = length(point);
        float glow = smoothstep(0.5, 0.0, distanceFromCenter);
        vec3 gold = mix(vec3(1.0, 0.72, 0.16), vec3(1.0, 0.96, 0.56), glow);
        gl_FragColor = vec4(gold, glow * (v_alpha + u_burst * 0.45));
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

    const particleCount = 54;
    const data = new Float32Array(particleCount * 4);
    for (let index = 0; index < particleCount; index += 1) {
      data[index * 4] = Math.random() * 2 - 1;
      data[index * 4 + 1] = Math.random() * 1.5 - 0.75;
      data[index * 4 + 2] = 4 + Math.random() * 9;
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
  }, [celebrate]);

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
  const [finished, setFinished] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [missed, setMissed] = useState<{ a: number; b: number }[]>([]);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTotalStars(loadNumber("serena-stars"));
      setQuestion(makeQuestion(null));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

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
    const retry = missed.length > 0 && Math.random() < 0.45 ? missed[0] : null;
    if (retry) {
      const retried = makeQuestion(retry.a, `${previous.a}x${previous.b}`);
      const answer = retry.a * retry.b;
      setQuestion({ ...retried, a: retry.a, b: retry.b, answer, choices: shuffle([answer, ...retried.choices.filter((choice) => choice !== answer)]).slice(0, 4) });
      setMissed((items) => items.slice(1));
      return;
    }
    setQuestion(makeQuestion(activeTable, `${previous.a}x${previous.b}`));
  }, [missed]);

  const answerQuestion = useCallback((choice: number) => {
    if (selected !== null || finished || wrongChoices.includes(choice)) return;
    const correct = choice === question.answer;
    playTone(correct);
    if (!correct) {
      setWrongChoices((choices) => [...choices, choice]);
      setStreak(0);
      setFeedback("Not quite — try another answer!");
      if (wrongChoices.length === 0) {
        setMissed((items) => [...items, { a: question.a, b: question.b }]);
      }
      return;
    }

    setSelected(choice);
    const nextStars = totalStars + 1;
    if (wrongChoices.length === 0) setScore((value) => value + 1);
    setStreak((value) => value + 1);
    setTotalStars(nextStars);
    setCelebrate(true);
    setFeedback(`${guide.cheer} ${question.a} × ${question.b} = ${question.answer}`);
    window.localStorage.setItem("serena-stars", String(nextStars));

    const nextRound = round + 1;
    advanceTimer.current = setTimeout(() => {
      setCelebrate(false);
      setSelected(null);
      setWrongChoices([]);
      if (nextRound >= ROUND_LENGTH) {
        setRound(nextRound);
        setFinished(true);
      } else {
        setRound(nextRound);
        nextQuestion(table, question);
        setFeedback("Choose your answer!");
      }
    }, 1000);
  }, [finished, guide.cheer, nextQuestion, playTone, question, round, selected, table, totalStars, wrongChoices]);

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
    setFinished(false);
    setCelebrate(false);
    setMissed([]);
    setFeedback(nextTable ? `${nextTable}s trail ready!` : "Safari Mix ready!");
  };

  const handleTilt = (event: React.PointerEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((event.clientY - rect.top) / rect.height - 0.5) * -3,
      y: ((event.clientX - rect.left) / rect.width - 0.5) * 4,
    });
  };

  const progressDots = useMemo(() => Array.from({ length: ROUND_LENGTH }, (_, index) => index), []);

  return (
    <main className={`safari-game ${celebrate ? "is-celebrating" : ""}`}>
      <div className="safari-background" aria-hidden="true" />
      <div className="safari-vignette" aria-hidden="true" />
      <SafariWebGL celebrate={celebrate} />

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

      <section className="game-stage" aria-live="polite">
        <label className="trail-picker">
          <span className="sr-only">Choose a multiplication table</span>
          <select value={table ?? "mix"} onChange={(event) => startRound(event.target.value === "mix" ? null : Number(event.target.value))}>
            <option value="mix">MIX</option>
            {Array.from({ length: 11 }, (_, index) => index + 2).map((value) => <option value={value} key={value}>{value}s</option>)}
          </select>
          <span aria-hidden="true">⌄</span>
        </label>

        {!finished ? (
          <section
            className="question-world"
            onPointerMove={handleTilt}
            onPointerLeave={() => setTilt({ x: 0, y: 0 })}
            style={{ "--tilt-x": `${tilt.x}deg`, "--tilt-y": `${tilt.y}deg` } as React.CSSProperties}
          >
            <img className={`animal-guide guide-${guide.name.toLowerCase()}`} src={guide.image} alt={`${guide.name}, your safari guide`} />
            <div className="question-card">
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
              <div className="round-progress" aria-label={`${round} of ${ROUND_LENGTH} questions complete`}>
                {progressDots.map((index) => <span key={index} className={index < round ? "done" : index === round ? "current" : ""} />)}
              </div>
            </div>
          </section>
        ) : (
          <section className="finish-card">
            <div className="finish-guides" aria-hidden="true">
              {guides.map((animal) => <img src={animal.image} alt="" key={animal.name} />)}
            </div>
            <span>EXPEDITION COMPLETE</span>
            <h1>{score >= 10 ? "Safari superstar!" : score >= 7 ? "Wild work!" : "Great exploring!"}</h1>
            <p>You solved every question, with <strong>{score} of {ROUND_LENGTH}</strong> right on the first try.</p>
            <button type="button" onClick={() => startRound(table)}>PLAY AGAIN</button>
            {table !== null && <button type="button" className="mix-again" onClick={() => startRound(null)}>TRY SAFARI MIX</button>}
          </section>
        )}
      </section>
      <audio ref={musicRef} src="/audio/jungle-marimba-loop.ogg" loop preload="metadata" />
    </main>
  );
}
