import { forbiddenWriteKeys, rowToTask, taskWrite } from "./lib/journal-records.js";

const TASK_COLUMNS = "id,category_id,title,note,due_date,priority,completed,created_at,completed_at";

function fail(error, fallback) {
  if (error && (error.name === "AuthRequiredError" || error.code === "AUTH_REQUIRED")) {
    const authError = new Error("Your session has ended. Sign in again.");
    authError.code = "AUTH_REQUIRED";
    throw authError;
  }
  if (error && error.name === "TypeError") {
    throw new Error("Couldn't reach your journal. Check your connection and try again.");
  }
  const wrapped = new Error(fallback);
  wrapped.code = error && error.code || "";
  throw wrapped;
}

function check(result, fallback) {
  if (!result || result.error) fail(result && result.error, fallback);
  return result.data;
}

function isConflict(error) {
  return /23505|duplicate/i.test(`${error && error.code || ""} ${error && error.message || ""}`);
}

async function neonClient() {
  return window.AuthApi.client();
}

async function createCategory(name) {
  const neon = await neonClient();
  const inserted = await neon.from("categories").insert({ name }).select("id,name").maybeSingle();
  if (!inserted.error) return inserted.data;
  if (!isConflict(inserted.error)) fail(inserted.error, "Couldn't save that category.");
  const existing = await neon.from("categories").select("id,name").eq("name", name).maybeSingle();
  if (existing.error || !existing.data) fail(existing.error, "Couldn't save that category.");
  return existing.data;
}

function categoryName(categories, id) {
  const match = (categories || []).find((category) => category.id === id);
  return match ? match.name : "";
}

async function load() {
  const neon = await neonClient();
  const categoriesResult = await neon.from("categories").select("id,name,created_at").order("created_at", { ascending: true });
  const categories = check(categoriesResult, "Couldn't load your journal. Check your connection and try again.") || [];
  const tasksResult = await neon.from("tasks").select(TASK_COLUMNS).order("created_at", { ascending: false });
  const tasks = check(tasksResult, "Couldn't load your journal. Check your connection and try again.") || [];
  return {
    categories,
    tasks: tasks.map((row) => rowToTask(row, categoryName(categories, row.category_id)))
  };
}

async function insertTask(task, categoryId) {
  const row = taskWrite(task, categoryId);
  if (forbiddenWriteKeys(row).length) throw new Error("Couldn't save that task.");
  const neon = await neonClient();
  let result = await neon.from("tasks").insert(row).select(TASK_COLUMNS).maybeSingle();
  if (result.error && row.id && isConflict(result.error)) {
    const replacement = { ...row };
    delete replacement.id;
    result = await neon.from("tasks").insert(replacement).select(TASK_COLUMNS).maybeSingle();
  }
  const data = check(result, "Couldn't save that task.");
  if (!data) fail(null, "Couldn't save that task.");
  return rowToTask(data, task.category);
}

async function updateTask(task, categoryId) {
  const row = taskWrite(task, categoryId);
  delete row.id;
  if (forbiddenWriteKeys(row).length) throw new Error("Couldn't save that task.");
  const neon = await neonClient();
  const result = await neon.from("tasks").update(row).eq("id", task.id).select(TASK_COLUMNS).maybeSingle();
  const data = check(result, "Couldn't save that task.");
  if (!data) fail(null, "Couldn't save that task.");
  return rowToTask(data, task.category);
}

async function deleteTask(id) {
  const neon = await neonClient();
  check(await neon.from("tasks").delete().eq("id", id), "Couldn't delete that task.");
}

window.JournalApi = { load, createCategory, insertTask, updateTask, deleteTask };
