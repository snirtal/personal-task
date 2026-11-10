import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../db/001_journal.sql", import.meta.url), "utf8");
const executable = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

test("journal migration matches the verified uuid schema", () => {
  assert.match(executable, /BEGIN;/);
  assert.match(executable, /COMMIT;/);
  assert.equal(executable.includes("auth.user_id()"), false);
  assert.equal((executable.match(/auth\.uid\(\)/g) || []).length >= 12, true);
  for (const table of ["categories", "tasks"]) {
    assert.match(executable, new RegExp(
      `CREATE TABLE public\\.${table}[\\s\\S]*?user_id uuid NOT NULL DEFAULT auth\\.uid\\(\\) REFERENCES neon_auth\\.\"user\" \\(id\\) ON DELETE CASCADE`
    ));
    assert.match(executable, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(executable, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
    for (const action of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      assert.match(executable, new RegExp(`FOR ${action} TO authenticated[\\s\\S]*?auth\\.uid\\(\\)`));
    }
  }
  assert.match(executable, /NEW\.user_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(executable, /user_id = auth\.uid\(\)/);
});

test("journal migration does not edit existing data or auth tables", () => {
  assert.equal(/\bDROP\s+(TABLE|SCHEMA|DATABASE)\b/i.test(executable), false);
  assert.equal(/\bTRUNCATE\b/i.test(executable), false);
  assert.equal(/\bDELETE\s+FROM\b/i.test(executable), false);
  assert.equal(/\bUPDATE\s+neon_auth\b/i.test(executable), false);
  assert.equal(/\bALTER\s+TABLE\s+neon_auth\b/i.test(executable), false);
  assert.equal(/\bINSERT\s+INTO\b/i.test(executable), false);
  assert.equal(/GRANT\s+INSERT\s+\([^)]*\buser_id\b/i.test(executable), false);
  assert.equal(/GRANT\s+UPDATE\s+\([^)]*\buser_id\b/i.test(executable), false);
  assert.match(executable, /GRANT INSERT \(name\) ON public\.categories/);
  assert.match(executable, /GRANT UPDATE \(name\) ON public\.categories/);
  assert.equal(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.enforce_task_owner/i.test(executable), false);
  assert.match(executable, /REVOKE ALL ON FUNCTION public\.enforce_task_owner\(\) FROM PUBLIC, anonymous, authenticated/);
  assert.match(executable, /REVOKE ALL ON TABLE public\.categories FROM PUBLIC, anonymous, authenticated/);
  assert.match(executable, /REVOKE ALL ON TABLE public\.tasks FROM PUBLIC, anonymous, authenticated/);
  assert.equal(/\banon\b/.test(executable), false);
  const namedRoles = [...executable.matchAll(/\b(?:GRANT|REVOKE)[\s\S]*?\b(?:TO|FROM)\s+([^;]+);/g)]
    .flatMap((match) => match[1].split(","))
    .map((role) => role.trim())
    .filter((role) => role && role !== "PUBLIC");
  for (const role of namedRoles) {
    assert.equal(["anonymous", "authenticated"].includes(role), true, role);
  }
});

const categoryOwnerSql = readFileSync(new URL("../db/003_task_category_owner.sql", import.meta.url), "utf8");
const categoryOwnerExecutable = categoryOwnerSql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

test("task category migration removes runtime auth lookups from the trigger", () => {
  assert.match(categoryOwnerExecutable, /BEGIN;/);
  assert.match(categoryOwnerExecutable, /COMMIT;/);
  const triggerBody = categoryOwnerExecutable.match(/AS \$\$([\s\S]*?)\$\$/);
  assert.equal(triggerBody?.[1].includes("auth.uid()"), false);
  assert.match(triggerBody?.[1], /IF NEW\.completed AND NEW\.completed_at IS NULL/);
  assert.match(triggerBody?.[1], /NEW\.completed_at = now\(\)/);
  assert.match(triggerBody?.[1], /IF NOT NEW\.completed THEN/);
  assert.match(triggerBody?.[1], /NEW\.completed_at = NULL/);
  assert.match(categoryOwnerExecutable, /REVOKE ALL ON FUNCTION public\.enforce_task_owner\(\) FROM PUBLIC, anonymous, authenticated/);
  for (const table of ["categories", "tasks"]) {
    assert.match(categoryOwnerExecutable, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(categoryOwnerExecutable, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  for (const policy of ["tasks_insert", "tasks_update"]) {
    assert.match(categoryOwnerExecutable, new RegExp(
      `ALTER POLICY ${policy} ON public\\.tasks[\\s\\S]*?user_id = auth\\.uid\\(\\)[\\s\\S]*?owned_category\\.user_id = auth\\.uid\\(\\)`
    ));
  }
  assert.match(categoryOwnerExecutable, /ALTER POLICY tasks_update ON public\.tasks\s+USING \(user_id = auth\.uid\(\)\)/);
  assert.equal(/\bDROP\s+(TABLE|SCHEMA|DATABASE|POLICY)\b/i.test(categoryOwnerExecutable), false);
  assert.equal(/\bTRUNCATE\b/i.test(categoryOwnerExecutable), false);
  assert.equal(/\bDELETE\s+FROM\b/i.test(categoryOwnerExecutable), false);
  assert.equal(/\bINSERT\s+INTO\b/i.test(categoryOwnerExecutable), false);
  assert.equal(/\bGRANT\b/i.test(categoryOwnerExecutable), false);
  assert.equal(/\banon\b/.test(categoryOwnerExecutable), false);
  assert.equal(categoryOwnerExecutable.includes("auth.user_id()"), false);
});
