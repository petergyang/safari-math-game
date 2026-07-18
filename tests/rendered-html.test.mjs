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

test("ships game-specific metadata and the immersive background", async () => {
  const [layout, css] = await Promise.all([readFile(layoutUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(layout, /2× to 12× tables/);
  assert.match(layout, /summary_large_image/);
  assert.match(css, /background-golden-morning\.webp/);
});
