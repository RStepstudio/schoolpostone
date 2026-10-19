import test from "node:test";
import assert from "node:assert/strict";
import { checkContent, checkWithAI } from "../functions/utils/content-filter.js";

test("allows ordinary school posts", () => {
  assert.deepEqual(checkContent("Our team built a telescope for science night."), { allowed: true });
});

test("rejects bullying language, including zero-width character evasion", () => {
  assert.equal(checkContent("You are worthless.").allowed, false);
  assert.equal(checkContent("You are a l\u200Boser.").allowed, false);
});

test("rejects email, phone, government ID, and street-address details", () => {
  assert.equal(checkContent("Email me at student@example.com").allowed, false);
  assert.equal(checkContent("Call me at (555) 867-5309").allowed, false);
  assert.equal(checkContent("ID: 123-45-6789").allowed, false);
  assert.equal(checkContent("I live at 123 Main Street").allowed, false);
});

test("skips AI when no binding is configured", async () => {
  assert.deepEqual(await checkWithAI("ordinary school post"), { allowed: true });
});

test("uses AI classification and fails open when the binding errors", async () => {
  const blocked = await checkWithAI("a post", { run: async () => ({ response: "unsafe" }) });
  assert.equal(blocked.allowed, false);

  const originalError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await checkWithAI("a post", { run: async () => { throw new Error("unavailable"); } }), { allowed: true });
  } finally {
    console.error = originalError;
  }
});
