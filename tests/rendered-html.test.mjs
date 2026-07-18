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
  assert.match(page, /VERTEX_SHADER/);
  assert.match(css, /perspective: 1300px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.safari-webgl \{ display: none;/);
});

test("anchors each rotating guide above the question card", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /\.animal-guide \{[\s\S]*top: auto;[\s\S]*left: 50%;[\s\S]*bottom: calc\(100% - 12px\);/);
  assert.match(css, /transform: translateX\(-50%\) translateZ\(55px\)/);
  assert.match(css, /\.equation \{[\s\S]*padding-left: 0;/);
});

test("matches the compact translucent card concept", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /\.question-card \{[\s\S]*min-height: 490px;/);
  assert.match(css, /rgba\(255, 255, 255, \.88\)/);
  assert.match(css, /backdrop-filter: blur\(9px\) saturate\(\.9\)/);
  assert.match(css, /\.answer-grid \{[\s\S]*gap: 18px;[\s\S]*margin: 0;/);
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
