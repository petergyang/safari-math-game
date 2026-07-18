import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const cssUrl = new URL("../app/globals.css", import.meta.url);
const layoutUrl = new URL("../app/layout.tsx", import.meta.url);

test("keeps every generated multiplication factor between 2 and 12", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /const MIN_FACTOR = 2;/);
  assert.match(page, /const MAX_FACTOR = 12;/);
  assert.match(page, /randomFactor\(\)/);
  assert.match(page, /Array\.from\(\{ length: 11 \}, \(_, index\) => index \+ 2\)/);
  assert.doesNotMatch(page, /Math\.floor\(Math\.random\(\) \* 12\) \+ 1/);
});

test("prevents consecutive duplicate multiplication facts", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /const questionKey = \(a: number, b: number\) => \[a, b\]\.sort/);
  assert.match(page, /questionKey\(a, b\) === avoid/);
  assert.match(page, /questionKey\(retryCandidate\.a, retryCandidate\.b\) !== previousKey/);
  assert.match(page, /makeQuestion\(activeTable, previousKey\)/);
  assert.match(page, /if \(questionKey\(a, b\) === avoid\) \{/);
  assert.match(page, /questionKey\(a, nextB\) !== avoid/);
});

test("always includes the correct answer with nearby distractors", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /function makeQuestionForFactors\(a: number, b: number\)/);
  assert.match(page, /const choices = new Set<number>\(\[answer\]\)/);
  assert.match(page, /setQuestion\(makeQuestionForFactors\(retry\.a, retry\.b\)\)/);
  assert.doesNotMatch(page, /shuffle\(\[answer,[\s\S]*?\.slice\(0, 4\)/);
});

test("uses deterministic first render data before randomizing in the browser", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /const INITIAL_QUESTION: Question/);
  assert.match(page, /useState<Question>\(INITIAL_QUESTION\)/);
  assert.match(page, /requestAnimationFrame\(\(\) => \{/);
});

test("uses the complete rotating safari guide crew", async () => {
  const page = await readFile(pageUrl, "utf8");
  for (const guide of ["lion", "elephant", "giraffe", "zebra", "meerkat"]) {
    assert.match(page, new RegExp(`/assets/safari/guide-${guide}\\.webp`));
  }
  assert.match(page, /guides\[round % guides\.length\]/);
  assert.doesNotMatch(page, /animal-card|animal-grid|unlock-meter/);
});

test("includes real WebGL effects with an accessible reduced-motion fallback", async () => {
  const [page, css] = await Promise.all([readFile(pageUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(page, /getContext\("webgl"/);
  assert.match(page, /gl\.drawArrays\(gl\.POINTS/);
  assert.match(page, /uniform float u_night;/);
  assert.match(page, /vec3 fire = mix/);
  assert.match(page, /const particleCount = night \? 112 : 54;/);
  assert.match(css, /perspective: 1300px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.safari-webgl \{ display: none;/);
});

test("anchors each rotating guide above the question card", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /\.animal-guide \{[\s\S]*top: auto;[\s\S]*left: 50%;[\s\S]*bottom: calc\(100% - 18px\);/);
  assert.match(css, /transform: translateX\(-50%\) translateZ\(55px\)/);
  assert.match(css, /\.equation \{[\s\S]*padding-left: 0;/);
  assert.match(css, /\.animal-guide\.guide-leo,[\s\S]*\.animal-guide\.guide-ziggy \{ bottom: calc\(100% - 26px\); \}/);
  assert.match(css, /\.animal-guide\.guide-gigi \{ bottom: calc\(100% - 36px\); \}/);
  assert.match(css, /\.animal-guide\.guide-mika \{ bottom: calc\(100% - 28px\); \}/);
});

test("makes the complete visible answer card the stable tap target", async () => {
  const [page, css] = await Promise.all([readFile(pageUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.doesNotMatch(page, /handleTilt|style=\{\{ "--tilt/);
  assert.match(page, /<section className=\{`question-world \$\{phase === "boss" \? "boss-world" : ""\}`\}>/);
  assert.match(css, /\.answer-grid button \{[\s\S]*display: grid;[\s\S]*touch-action: manipulation;/);
  assert.match(css, /\.answer-grid button > \* \{ pointer-events: none; \}/);
  assert.doesNotMatch(css, /button strong[^\n]*translateZ/);
  assert.doesNotMatch(css, /\.answer-grid button:hover[^\{]*\{[^\}]*transform:/);
  assert.doesNotMatch(css, /\.answer-grid button:active[^\{]*\{[^\}]*transform:/);
  assert.match(css, /transition: box-shadow \.16s ease, background \.16s ease, border-color \.16s ease;/);
});

test("centers a compact completion card independently", async () => {
  const [page, css] = await Promise.all([readFile(pageUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(page, /game-stage \$\{isSummary \? "is-finished" : ""\}/);
  assert.match(css, /\.game-stage\.is-finished \{[\s\S]*justify-content: center;/);
  assert.match(css, /\.finish-card \{[\s\S]*min-height: 360px;[\s\S]*margin: 170px auto 0;[\s\S]*padding: 44px 34px 30px;/);
  assert.match(css, /\.finish-guides \{[\s\S]*top: auto;[\s\S]*bottom: calc\(100% - 16px\);/);
  assert.match(css, /\.finish-guides img \{[\s\S]*bottom: 0;[\s\S]*animation: guideSway/);
  assert.match(css, /\.finish-guides img:nth-child\(3\),[\s\S]*\.finish-guides img:nth-child\(5\) \{ bottom: -10px; \}/);
});

test("unlocks a timed twelve-question night boss level after level one", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /type GamePhase = "day" \| "night-transition" \| "boss" \| "boss-won" \| "boss-lost";/);
  assert.match(page, /const BOSS_TIME_LIMIT = 60;/);
  assert.match(page, /setPhase\(isBossRound \? "boss-won" : "night-transition"\)/);
  assert.match(page, /if \(phase !== "night-transition"\) return;[\s\S]*}, 1700\);/);
  assert.match(page, /setPhase\("boss"\)/);
  assert.match(page, /secondsRemaining -= 1;[\s\S]*setBossSecondsLeft\(secondsRemaining\)/);
  assert.match(page, /You ran out of time to beat the pride!/);
  assert.match(page, /Defeat the pride before time runs out!/);
  assert.match(page, /TRY BOSS AGAIN/);
});

test("ships the extracted night scene and foreground boss art", async () => {
  const [page, css, asset] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(cssUrl, "utf8"),
    readFile(new URL("../public/assets/safari/boss-pride-trio.webp", import.meta.url)),
  ]);
  assert.ok(asset.length > 10_000);
  assert.match(css, /background-moonlit-boss\.webp/);
  assert.match(page, /<img className="boss-pride" src="\/assets\/safari\/boss-pride-trio\.webp"/);
  assert.doesNotMatch(page, /boss-scene-overlay|boss-battle-concept\.webp/);
  assert.doesNotMatch(css, /boss-scene-overlay|boss-battle-concept\.webp/);
  assert.match(css, /\.boss-pride \{[\s\S]*position: absolute;[\s\S]*bottom: calc\(100% - 35px\);/);
  assert.match(css, /\.boss-health \{[\s\S]*grid-template-columns: repeat\(12, 1fr\)/);
  assert.match(css, /\.boss-card \{[\s\S]*rgba\(9, 30, 61, \.94\)/);
});

test("keeps day and boss gameplay geometry identical", async () => {
  const [page, css] = await Promise.all([readFile(pageUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(page, /\(phase === "day" \|\| phase === "boss"\) && <label className="trail-picker">/);
  assert.match(css, /\.question-world \{[\s\S]*width: min\(1080px, 100%\);/);
  assert.match(css, /\.boss-world \{ width: min\(1080px, 100%\); \}/);
  const bossCard = css.match(/\.boss-card \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.doesNotMatch(bossCard, /min-height|padding/);
  assert.doesNotMatch(css, /\.game-stage\.is-boss/);
  assert.doesNotMatch(css, /\.boss-card \.equation \{[^}]*min-height/);
  assert.doesNotMatch(css, /\.boss-card \.answer-grid button \{[^}]*min-height/);
});

test("makes the night battle visibly fiery", async () => {
  const [page, css] = await Promise.all([readFile(pageUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(page, /boss-fire-stage/);
  assert.match(page, /boss-flame boss-flame-left/);
  assert.match(page, /boss-flame boss-flame-right/);
  assert.match(css, /@keyframes flameDance/);
  assert.match(css, /drop-shadow\(0 0 55px rgba\(255, 38, 0, \.42\)\)/);
});

test("keeps selected boss answers readable", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /\.boss-card \.answer-grid button\.wrong \{[\s\S]*color: #651f14;[\s\S]*background: linear-gradient\(145deg, #fff5ed, #ffcfc0\);/);
  assert.match(css, /\.boss-card \.answer-grid button\.wrong:disabled \{ opacity: 1; \}/);
  assert.match(css, /\.boss-card \.answer-grid button\.correct strong \{ color: #164d31;/);
});

test("matches the compact translucent card concept", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /\.question-card \{[\s\S]*min-height: 490px;/);
  assert.match(css, /rgba\(255, 255, 255, \.88\)/);
  assert.match(css, /backdrop-filter: blur\(9px\) saturate\(\.9\)/);
  assert.match(css, /\.answer-grid \{[\s\S]*gap: 18px;[\s\S]*margin: 0;/);
  assert.match(css, /\.answer-grid \{[\s\S]*transform: none;/);
});

test("keeps wrong answers marked while allowing another try", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /setWrongChoices\(\(choices\) => \[\.\.\.choices, choice\]\)/);
  assert.match(page, /Not quite — try another answer!/);
  assert.match(page, /disabled=\{selected !== null \|\| isWrong\}/);
  assert.doesNotMatch(page, /You’ve got the next one!/);
});

test("includes opt-in CC0 safari music", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /\/audio\/jungle-marimba-loop\.ogg/);
  assert.match(page, /Pause safari music/);
  assert.match(page, /music\.volume = 0\.24/);
});

test("ships game-specific metadata and the immersive background", async () => {
  const [layout, css] = await Promise.all([readFile(layoutUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(layout, /2× to 12× tables/);
  assert.match(layout, /summary_large_image/);
  assert.match(css, /background-golden-morning\.webp/);
});
