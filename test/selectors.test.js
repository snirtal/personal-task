import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

function requiredIds(filename) {
  const source = readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
  return [...source.matchAll(/getElementById\("([^"]+)"\)|\$\("([^"]+)"\)/g)].map((match) => match[1] || match[2]);
}

test("signup screen elements exist for every text update", () => {
  const signupIds = requiredIds("signup.js");
  assert.deepEqual(signupIds.filter((id) => !ids.has(id)), []);
  assert.equal(html.includes('id="logo-sub"'), true);
  assert.equal(requiredIds("app.js").includes("logo-sub"), true);
});

test("login, signup, and journal selectors match the page", () => {
  const missing = ["signup.js", "login.js", "auth-api.js", "app.js"].flatMap((filename) =>
    requiredIds(filename)
      .filter((id) => !ids.has(id))
      .map((id) => `${filename}#${id}`)
  );
  assert.deepEqual(missing, []);
});
