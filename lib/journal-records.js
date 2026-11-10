const PRIORITIES = new Set(["low", "medium", "high"]);

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function taskWrite(task, categoryId) {
  const priority = PRIORITIES.has(task.priority) ? task.priority : "medium";
  const completed = Boolean(task.done);
  const row = {
    category_id: categoryId,
    title: String(task.title || "").trim(),
    note: String(task.notes || "").trim(),
    due_date: task.due || null,
    priority,
    completed,
    completed_at: completed ? new Date(task.completedAt || Date.now()).toISOString() : null
  };
  if (isUuid(task.id)) row.id = task.id;
  return row;
}

export function rowToTask(row, categoryName) {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    notes: String(row.note || ""),
    due: row.due_date || "",
    priority: PRIORITIES.has(row.priority) ? row.priority : "medium",
    category: categoryName || "Personal",
    done: Boolean(row.completed),
    createdAt: Date.parse(row.created_at) || Date.now(),
    completedAt: row.completed_at ? Date.parse(row.completed_at) : null
  };
}

export function forbiddenWriteKeys(row) {
  return Object.keys(row).filter((key) => /user_id|password|token|secret|database_url/i.test(key));
}
