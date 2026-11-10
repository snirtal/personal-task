import assert from "node:assert/strict";
import test from "node:test";
import { friendlyAuthError, interpretSignIn, interpretSignUp } from "../lib/auth-result.js";
import { forbiddenWriteKeys, rowToTask, taskWrite } from "../lib/journal-records.js";
import { publicConfig, publicNeonUrl } from "../lib/public-config.js";
import handler from "../api/config.js";

test("public config accepts only credential-free https URLs", () => {
  assert.equal(publicNeonUrl("postgresql://user:secret@host/db"), "");
  assert.equal(publicNeonUrl("https://user:secret@example.com/auth"), "");
  assert.equal(publicNeonUrl("http://example.com/auth"), "");
  assert.equal(publicNeonUrl("https://example.com/db/auth?token=secret"), "");
  assert.deepEqual(
    publicConfig({
      DATABASE_URL: "postgresql://user:secret@host/db",
      VITE_NEON_AUTH_URL: "https://auth.example.com/db/auth/",
      NEON_DATA_API_URL: "https://data.example.com/db/rest/v1/"
    }),
    {
      authUrl: "https://auth.example.com/db/auth",
      dataApiUrl: "https://data.example.com/db/rest/v1"
    }
  );
  assert.equal(publicConfig({ DATABASE_URL: "postgresql://user:secret@host/db" }), null);
});

test("config endpoint never returns database credentials", async () => {
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    VITE_NEON_AUTH_URL: process.env.VITE_NEON_AUTH_URL,
    NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
    NEON_DATA_API_URL: process.env.NEON_DATA_API_URL
  };
  process.env.DATABASE_URL = "postgresql://user:secret-password@host/db";
  process.env.VITE_NEON_AUTH_URL = "https://auth.example.com/db/auth";
  process.env.NEON_DATA_API_URL = "https://data.example.com/db/rest/v1";
  const response = mockResponse();
  try {
    handler({ method: "GET" }, response);
    assert.equal(response.statusCode, 200);
    const body = JSON.stringify(response.body);
    assert.equal(body.includes("secret-password"), false);
    assert.equal(body.includes("postgresql"), false);
    assert.equal(body.includes("DATABASE_URL"), false);
    assert.deepEqual(response.body, {
      authUrl: "https://auth.example.com/db/auth",
      dataApiUrl: "https://data.example.com/db/rest/v1"
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("task writes cannot assign an owner or carry a secret", () => {
  const row = taskWrite({
    id: "11111111-1111-4111-8111-111111111111",
    title: "Pay a parking ticket",
    notes: "Reference 42",
    due: "2026-12-24",
    priority: "high",
    done: false,
    user_id: "someone-else",
    password: "hidden"
  }, "22222222-2222-4222-8222-222222222222");
  assert.deepEqual(forbiddenWriteKeys(row), []);
  assert.equal(Object.hasOwn(row, "user_id"), false);
  assert.equal(Object.hasOwn(row, "password"), false);
  assert.equal(row.note, "Reference 42");
  assert.equal(row.due_date, "2026-12-24");
  assert.equal(row.completed, false);
  assert.equal(row.completed_at, null);
  assert.equal(row.category_id, "22222222-2222-4222-8222-222222222222");
});

test("database rows become the existing task shape", () => {
  const task = rowToTask({
    id: "11111111-1111-4111-8111-111111111111",
    title: "Grocery run",
    note: "Milk",
    due_date: "2026-11-12",
    priority: "low",
    completed: true,
    created_at: "2026-11-10T10:00:00.000Z",
    completed_at: "2026-11-11T10:00:00.000Z"
  }, "Shopping");
  assert.equal(task.notes, "Milk");
  assert.equal(task.due, "2026-11-12");
  assert.equal(task.done, true);
  assert.equal(task.category, "Shopping");
  assert.equal(task.completedAt, Date.parse("2026-11-11T10:00:00.000Z"));
});

test("sign-up without a session asks for email confirmation", () => {
  const outcome = interpretSignUp({ data: { user: { id: "user-1" } } }, { data: { session: null, user: null } });
  assert.equal(outcome.verificationRequired, true);
  assert.equal(outcome.user, undefined);
});

test("sign-in reports an unverified email without opening a session", () => {
  const outcome = interpretSignIn({ error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" } }, null);
  assert.equal(outcome.error.message, "Check your email and confirm your address, then sign in.");
});

test("a valid session restores the user", () => {
  const outcome = interpretSignIn(
    { data: { user: { id: "user-1", email: "ada@example.com", name: "Ada" } } },
    { data: { user: { id: "user-1", email: "ada@example.com", name: "Ada" }, session: { id: "session-1" } } }
  );
  assert.deepEqual(outcome.user, { id: "user-1", email: "ada@example.com", name: "Ada" });
});

test("auth errors stay generic", () => {
  assert.equal(friendlyAuthError({ code: "INVALID_EMAIL_OR_PASSWORD", message: "nope" }), "That email or password is incorrect.");
  assert.equal(friendlyAuthError({ name: "TypeError", message: "Failed to fetch" }), "Couldn't reach the account service. Check your connection and try again.");
});

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}
