const THEME_KEY = "yoman.theme";
const DEFAULT_CATEGORIES = ["Payments", "Personal", "Work", "Health", "Shopping"];
const DOTS = ["#1f8f84", "#0e7490", "#3d8f6e", "#147a9a", "#5a8f7a", "#0f5c6b"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SCOPES = [
  { id: "open", label: "All tasks" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "overdue", label: "Overdue" },
  { id: "undated", label: "No date" },
  { id: "done", label: "Completed" }
];
const SUGGESTIONS = {
  parking: { title: "Pay a parking ticket", category: "Payments", priority: "high", offset: 3 },
  doctor: { title: "Book a doctor appointment", category: "Health", priority: "medium", offset: 7 },
  groceries: { title: "Grocery run", category: "Shopping", priority: "low", offset: null }
};
const PRIORITY_LABEL = { high: "High", medium: "Normal", low: "Low" };
const PAYMENT_CATEGORIES = new Set(["Payments", "תשלומים"]);
const CATEGORY_LABELS = {
  "תשלומים": "Payments",
  "אישי": "Personal",
  "עבודה": "Work",
  "בריאות": "Health",
  "קניות": "Shopping"
};
const CATEGORY_ALIASES = {
  Payments: "תשלומים",
  Personal: "אישי",
  Work: "עבודה",
  Health: "בריאות",
  Shopping: "קניות"
};

function categoryLabel(name) {
  return CATEGORY_LABELS[name] || name;
}

const fullDateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });
const weekdayDateFormat = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" });
const heroDateFormat = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const monthShortFormat = new Intl.DateTimeFormat("en", { month: "short" });
const monthLongFormat = new Intl.DateTimeFormat("en", { month: "long" });

const ui = {
  scope: "open",
  date: "",
  category: "",
  weekStart: startOfWeekISO(new Date())
};

const $ = (id) => document.getElementById(id);
const themeMeta = document.querySelector('meta[name="theme-color"]');
const live = $("live");
const toast = $("toast");
const titleInput = $("title");
const dueInput = $("due");
const priorityInput = $("priority");
const categoryInput = $("category");
const newCategoryInput = $("new-category");
const newCategoryWrap = $("new-cat-wrap");
const notesInput = $("notes");
const notesWrap = $("notes-wrap");
const toggleNotes = $("toggle-notes");
const composerError = $("composer-error");
const composerShortcuts = $("composer-shortcuts");
const suggestions = $("suggestions");
const list = $("list");
const listTitle = $("list-title");
const listCount = $("list-count");
const nav = $("nav");
const cats = $("cats");
const todayCard = $("today-card");
const weekDays = $("week-days");
const weekLabel = $("week-label");
const clearDone = $("clear-done");
const themeToggle = $("theme-toggle");
const editor = $("editor");
const editorForm = $("editor-form");
const editorTitle = $("editor-title-input");
const editorDue = $("editor-due");
const editorPriority = $("editor-priority");
const editorCategory = $("editor-category");
const editorNewWrap = $("editor-new-wrap");
const editorNew = $("editor-new-category");
const editorNotes = $("editor-notes");
const editorError = $("editor-error");
const editorShortcuts = $("editor-shortcuts");

let state = freshState();
let categoryIds = new Map();
let loadError = "";
let saving = false;
let undoTimer = 0;

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function todayISO() {
  return toISO(new Date());
}

function addDays(iso, days) {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function startOfWeekISO(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return toISO(copy);
}

function isISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  return toISO(parseISO(value)) === value;
}

function diffDays(fromISO, toISODate) {
  return Math.round((parseISO(toISODate) - parseISO(fromISO)) / 86400000);
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function cssEscape(value) {
  return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
}

function normalizeTask(task) {
  const priority = ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium";
  return {
    id: String(task.id || uid()),
    title: String(task.title || "").replace(/\s+/g, " ").trim().slice(0, 200),
    notes: String(task.notes || "").trim().slice(0, 2000),
    due: isISODate(task.due) ? task.due : "",
    priority,
    category: String(task.category || "Personal").trim().slice(0, 40) || "Personal",
    done: Boolean(task.done),
    createdAt: Number(task.createdAt) || Date.now(),
    completedAt: task.completedAt ? Number(task.completedAt) : null
  };
}

function ensureCategories(categories) {
  const incoming = (Array.isArray(categories) ? categories : [])
    .map((category) => String(category || "").trim().slice(0, 40))
    .filter(Boolean);
  const merged = [];
  incoming.forEach((name) => {
    if (!merged.includes(name)) merged.push(name);
  });
  DEFAULT_CATEGORIES.forEach((name) => {
    const alias = CATEGORY_ALIASES[name];
    if (!merged.includes(name) && !merged.includes(alias)) merged.push(name);
  });
  return merged.length ? merged : [...DEFAULT_CATEGORIES];
}

function freshState() {
  return {
    tasks: [],
    categories: [...DEFAULT_CATEGORIES],
    lastCategory: "Personal",
    lastPriority: "medium"
  };
}

function rememberCategory(name) {
  if (!state.categories.includes(name)) state.categories.push(name);
  state.lastCategory = name;
}

async function ensureCategoryId(name) {
  if (categoryIds.has(name)) return categoryIds.get(name);
  const created = await window.JournalApi.createCategory(name);
  categoryIds.set(created.name, created.id);
  rememberCategory(created.name);
  return created.id;
}

async function reloadJournal() {
  const data = await window.JournalApi.load();
  categoryIds = new Map(data.categories.map((category) => [category.name, category.id]));
  const names = data.categories.map((category) => category.name);
  state = {
    tasks: data.tasks.map(normalizeTask).filter((task) => task.title),
    categories: ensureCategories(names),
    lastCategory: names.includes(state.lastCategory) ? state.lastCategory : "Personal",
    lastPriority: state.lastPriority || "medium"
  };
  loadError = "";
}

function resetJournal() {
  state = freshState();
  categoryIds = new Map();
  loadError = "";
  $("logo-sub").textContent = "My tasks";
  if (editor.open) editor.close();
  hideToast();
}

async function enterJournal(user) {
  $("logo-sub").textContent = user && user.name ? user.name : "My tasks";
  $("open-login").textContent = "Sign out";
  try {
    await reloadJournal();
  } catch (error) {
    state = freshState();
    categoryIds = new Map();
    loadError = error.message || "Couldn't load your journal. Check your connection and try again.";
    if (error.code === "AUTH_REQUIRED") {
      window.LoginScreen.show();
      $("login-error").textContent = loadError;
      return;
    }
  }
  window.showScreen("journal");
  priorityInput.value = state.lastPriority;
  fillSelect(categoryInput, state.lastCategory);
  fillSelect(editorCategory, state.lastCategory);
  render();
  titleInput.focus();
}

async function boot() {
  window.showScreen("boot");
  try {
    const user = await window.AuthApi.restore();
    if (!user) {
      window.LoginScreen.show();
      return;
    }
    await enterJournal(user);
  } catch (error) {
    window.LoginScreen.show();
    $("login-error").textContent = error.message || "Couldn't check your session.";
  }
}

window.PersonalTask = { enter: enterJournal };

function dotColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % DOTS.length;
  return DOTS[hash];
}

function formatFull(iso) {
  return fullDateFormat.format(parseISO(iso));
}

function relativeFuture(diff) {
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === 2) return "in 2 days";
  return `in ${diff} days`;
}

function relativePast(diff) {
  const days = Math.abs(diff);
  if (days === 1) return "yesterday";
  if (days === 2) return "2 days ago";
  return `${days} days ago`;
}

function dueTone(diff) {
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "later";
}

function stampCaption(diff) {
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return "Overdue";
  if (diff === 2) return "2 days";
  return `In ${diff}`;
}

function dueSentence(task) {
  if (!task.due) return "";
  const diff = diffDays(todayISO(), task.due);
  const full = formatFull(task.due);
  const when = diff < 0 ? relativePast(diff) : relativeFuture(diff);
  if (PAYMENT_CATEGORIES.has(task.category)) {
    if (diff < 0) return `Payment was due ${full}, ${when}`;
    if (diff === 0) return `Payment is due today, ${full}`;
    return `Pay by ${full}, ${when}`;
  }
  if (diff < 0) return `Due ${full}, ${when}`;
  if (diff === 0) return `Due today, ${full}`;
  return `Due ${full}, ${when}`;
}

function countPhrase(count, doneView) {
  if (doneView) {
    if (count === 0) return "No completed tasks";
    if (count === 1) return "1 completed task";
    return `${count} completed tasks`;
  }
  if (count === 0) return "No open tasks";
  if (count === 1) return "1 task";
  return `${count} tasks`;
}

function matchesCategory(task) {
  return !ui.category || task.category === ui.category;
}

function matchesScope(task, scope, date) {
  const today = todayISO();
  if (scope === "done") return task.done;
  if (task.done) return false;
  if (scope === "open") return true;
  if (scope === "today") return task.due === today;
  if (scope === "overdue") return Boolean(task.due) && task.due < today;
  if (scope === "undated") return !task.due;
  if (scope === "week") {
    const end = addDays(today, 6);
    return Boolean(task.due) && task.due >= today && task.due <= end;
  }
  if (scope === "date") return task.due === date;
  return true;
}

function visibleTasks() {
  return state.tasks.filter((task) => matchesCategory(task) && matchesScope(task, ui.scope, ui.date));
}

function sortOpen(tasks) {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
    if (!a.due && b.due) return 1;
    if (a.due && !b.due) return -1;
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    return b.createdAt - a.createdAt;
  });
}

function groupTasks(tasks) {
  if (ui.scope === "done") {
    return [{
      id: "done",
      title: "",
      tasks: [...tasks].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    }];
  }
  if (["today", "overdue", "undated", "date"].includes(ui.scope)) {
    return [{ id: ui.scope, title: "", tasks: sortOpen(tasks) }];
  }
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const soonEnd = addDays(today, 7);
  const buckets = [
    { id: "overdue", title: "Overdue", warn: true, tasks: [] },
    { id: "today", title: "Today", tasks: [] },
    { id: "tomorrow", title: "Tomorrow", tasks: [] },
    { id: "soon", title: "Coming up", tasks: [] },
    { id: "later", title: "Later", tasks: [] },
    { id: "undated", title: "No date", tasks: [] }
  ];
  tasks.forEach((task) => {
    if (!task.due) buckets[5].tasks.push(task);
    else if (task.due < today) buckets[0].tasks.push(task);
    else if (task.due === today) buckets[1].tasks.push(task);
    else if (task.due === tomorrow) buckets[2].tasks.push(task);
    else if (task.due <= soonEnd) buckets[3].tasks.push(task);
    else buckets[4].tasks.push(task);
  });
  const relevant = ui.scope === "week"
    ? buckets.filter((bucket) => ["today", "tomorrow", "soon"].includes(bucket.id))
    : buckets;
  return relevant
    .filter((bucket) => bucket.tasks.length)
    .map((bucket) => ({ ...bucket, tasks: sortOpen(bucket.tasks) }));
}

function scopeTitle() {
  const today = todayISO();
  const names = {
    open: "All tasks",
    today: "Today",
    week: "Next 7 days",
    overdue: "Overdue",
    undated: "No date",
    done: "Completed",
    date: ui.date === today ? "Today" : (isISODate(ui.date) ? formatFull(ui.date) : "Date")
  };
  const title = names[ui.scope] || "All tasks";
  return ui.category ? `${title} · ${ui.category}` : title;
}

function currentTheme() {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "dark" || explicit === "light") return explicit;
  return "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (error) {}
  if (themeMeta) themeMeta.content = theme === "dark" ? "#07141c" : "#eef3f4";
}

function fillSelect(select, selected) {
  const current = selected || select.value;
  const options = state.categories
    .map((category) => `<option value="${esc(category)}">${esc(categoryLabel(category))}</option>`)
    .join("");
  select.innerHTML = `${options}<option value="__new__">New category…</option>`;
  const values = [...select.options].map((option) => option.value);
  select.value = values.includes(current) ? current : state.categories[0];
}

function syncShortcuts(container, input) {
  container.querySelectorAll("[data-offset]").forEach((button) => {
    if (button.dataset.offset === "clear") {
      button.setAttribute("aria-pressed", String(input.value === ""));
      return;
    }
    const target = addDays(todayISO(), Number(button.dataset.offset));
    button.setAttribute("aria-pressed", String(input.value === target));
  });
}

function readCategory(select, input, errorEl) {
  if (select.value !== "__new__") return select.value;
  const name = input.value.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) {
    errorEl.textContent = "A new category needs a name.";
    input.focus();
    return null;
  }
  return name;
}

function announce(message) {
  live.textContent = "";
  window.setTimeout(() => { live.textContent = message; }, 30);
}

function showToast(message, actionLabel, onAction, options = {}) {
  window.clearTimeout(undoTimer);
  toast.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(text);
  if (actionLabel && onAction) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = actionLabel;
    button.addEventListener("click", () => {
      hideToast();
      onAction();
    });
    toast.append(button);
    if (options.focusAction) button.focus();
  }
  toast.classList.add("show");
  undoTimer = window.setTimeout(hideToast, 6000);
}

function hideToast() {
  window.clearTimeout(undoTimer);
  toast.classList.remove("show");
  toast.replaceChildren();
}

toast.addEventListener("mouseenter", () => window.clearTimeout(undoTimer));
toast.addEventListener("mouseleave", () => {
  if (toast.classList.contains("show")) undoTimer = window.setTimeout(hideToast, 2500);
});
toast.addEventListener("focusin", () => window.clearTimeout(undoTimer));
toast.addEventListener("focusout", () => {
  if (toast.classList.contains("show")) undoTimer = window.setTimeout(hideToast, 2500);
});

function greetingText(date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

function todaySummary(done, total) {
  if (total === 0) return "Nothing due today";
  if (total === 1 && done === 0) return "One task today, still open";
  if (total === 1 && done === 1) return "One task today, and it's done";
  if (done === total) return "All of today's tasks are done";
  return `${done} of ${total} done today`;
}

function renderTodayCard() {
  const today = todayISO();
  const todays = state.tasks.filter((task) => task.due === today);
  const done = todays.filter((task) => task.done).length;
  const total = todays.length;
  const circ = 2 * Math.PI * 15.5;
  const filled = total ? (circ * done) / total : 0;
  const overdue = state.tasks.filter((task) => !task.done && task.due && task.due < today).length;
  const overdueLabel = overdue === 1 ? "1 overdue task" : `${overdue} overdue tasks`;
  const valueCircle = filled
    ? `<circle class="ring-value" cx="18" cy="18" r="15.5" stroke-dasharray="${filled.toFixed(2)} ${circ.toFixed(2)}"></circle>`
    : "";
  todayCard.innerHTML = `
    <section class="today-card" aria-label="Today summary">
      <svg class="ring" viewBox="0 0 36 36" aria-hidden="true">
        <circle class="ring-track" cx="18" cy="18" r="15.5"></circle>
        ${valueCircle}
      </svg>
      <div class="today-copy">
        <p class="today-kicker">Today</p>
        <p class="today-summary">${esc(todaySummary(done, total))}</p>
        ${overdue ? `<button type="button" class="overdue-jump" data-scope="overdue">${esc(overdueLabel)}</button>` : ""}
      </div>
    </section>
  `;
}

function renderNav() {
  nav.innerHTML = SCOPES.map((scope) => {
    const count = state.tasks.filter((task) => matchesCategory(task) && matchesScope(task, scope.id)).length;
    const current = ui.scope === scope.id ? ' aria-current="page"' : "";
    const warn = scope.id === "overdue" && count > 0 ? " warn" : "";
    return `<button type="button" class="nav-btn${warn}" data-scope="${scope.id}"${current}><span>${scope.label}</span><span class="nav-count">${count}</span></button>`;
  }).join("");
}

function renderCategories() {
  const allPressed = ui.category === "" ? ' aria-pressed="true"' : ' aria-pressed="false"';
  const buttons = state.categories.map((category) => {
    const count = state.tasks.filter((task) => !task.done && task.category === category).length;
    const pressed = ui.category === category;
    return `<button type="button" class="cat-btn" data-cat="${esc(category)}" aria-pressed="${pressed}"><span class="cat-name"><span class="dot" style="background:${dotColor(category)}"></span>${esc(categoryLabel(category))}</span><span class="nav-count">${count}</span></button>`;
  }).join("");
  cats.innerHTML = `<button type="button" class="cat-btn" data-cat=""${allPressed}><span class="cat-name">All categories</span></button>${buttons}`;
}

function weekRangeLabel(startISO) {
  const start = parseISO(startISO);
  const end = parseISO(addDays(startISO, 6));
  const year = end.getFullYear();
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${monthLongFormat.format(start)} ${start.getDate()}–${end.getDate()}, ${year}`;
  }
  const startLabel = `${monthLongFormat.format(start)} ${start.getDate()}`;
  const endLabel = `${monthLongFormat.format(end)} ${end.getDate()}`;
  return `${startLabel} – ${endLabel}, ${year}`;
}

function renderWeek() {
  const today = todayISO();
  weekLabel.textContent = weekRangeLabel(ui.weekStart);
  const days = [];
  for (let index = 0; index < 7; index += 1) {
    const iso = addDays(ui.weekStart, index);
    const date = parseISO(iso);
    const openTasks = state.tasks.filter((task) => task.due === iso && !task.done && matchesCategory(task));
    const overdue = openTasks.some((task) => iso < today);
    const selected = (ui.scope === "date" && ui.date === iso) || (ui.scope === "today" && iso === today);
    const classes = ["day"];
    if (iso === today) classes.push("is-today");
    if (selected) classes.push("is-selected");
    if (overdue) classes.push("has-overdue");
    const count = openTasks.length;
    const countText = count === 1 ? "1 open task" : `${count} open tasks`;
    const status = count === 0 ? "no open tasks" : countText;
    const statusLabel = overdue ? `${status}, overdue` : status;
    const label = `${weekdayDateFormat.format(date)}, ${statusLabel}`;
    days.push(`
      <button type="button" class="${classes.join(" ")}" data-day="${iso}" aria-pressed="${selected}" aria-label="${esc(label)}">
        <span class="day-name">${WEEKDAYS[date.getDay()]}</span>
        <span class="day-num">${date.getDate()}</span>
        <span class="day-count">${count ? count : ""}</span>
      </button>
    `);
  }
  weekDays.innerHTML = days.join("");
}

function taskMarkup(task) {
  const today = todayISO();
  const diff = task.due ? diffDays(today, task.due) : null;
  const tone = diff === null ? "" : dueTone(diff);
  const sentence = dueSentence(task);
  const checkLabel = `${task.done ? "Mark as not done" : "Mark as done"}: ${task.title}${task.due ? `, ${sentence}` : ""}`;
  const stamp = task.due ? `
    <button type="button" class="stamp ${tone}" data-action="edit-date" aria-label="Edit due date, ${esc(sentence)}">
      <span class="stamp-month">${esc(monthShortFormat.format(parseISO(task.due)))}</span>
      <span class="stamp-day">${parseISO(task.due).getDate()}</span>
      <span class="stamp-rel">${esc(stampCaption(diff))}</span>
    </button>` : "";
  const notes = task.notes ? `<p class="task-notes">${esc(task.notes)}</p>` : "";
  const dueLine = sentence ? `<p class="due-line ${tone}">${esc(sentence)}</p>` : "";
  const addDate = task.due ? "" : `<button type="button" class="add-date" data-action="edit-date">Add date</button>`;
  return `
    <li class="task pri-${task.priority}${task.done ? " is-done" : ""}" data-id="${esc(task.id)}">
      <label class="check">
        <input class="task-check" type="checkbox" data-id="${esc(task.id)}" ${task.done ? "checked" : ""} aria-label="${esc(checkLabel)}">
      </label>
      <div class="task-body">
        <p class="task-title">${esc(task.title)}</p>
        ${dueLine}
        ${notes}
        <div class="meta">
          <span class="cat"><span class="dot" style="background:${dotColor(task.category)}"></span>${esc(categoryLabel(task.category))}</span>
          <span class="pri ${task.priority}">${PRIORITY_LABEL[task.priority]}</span>
          ${addDate}
        </div>
      </div>
      ${stamp}
      <div class="task-actions">
        <button type="button" class="btn btn-ghost" data-action="edit">Edit</button>
        <button type="button" class="btn btn-danger" data-action="delete">Delete</button>
      </div>
    </li>
  `;
}

function emptyMarkup() {
  if (loadError) {
    return `
      <div class="empty">
        <h3>Couldn't load your journal</h3>
        <p>${esc(loadError)}</p>
        <button type="button" class="btn btn-primary" data-action="retry-load">Try again</button>
      </div>
    `;
  }
  const today = parseISO(todayISO());
  const messages = {
    today: ["Today is clear", "Nothing is due today. You can add something new."],
    overdue: ["You're on time", "Nothing is past its due date."],
    done: ["Nothing completed yet", "Finished tasks will show up here."],
    undated: ["No undated tasks", "Tasks without a due date will show up here."],
    week: ["A quiet week", "No open tasks in the next 7 days."],
    date: ["Nothing on this day", "Add a task and choose this date."],
    category: ["Nothing in this category", "Add a new task to this category."],
    open: ["Your journal is ready", "Add your first task. If it has a deadline, attach a due date."]
  };
  let key = ui.scope;
  if (ui.category && ui.scope === "open") key = "category";
  const [heading, copy] = messages[key] || messages.open;
  return `
    <div class="empty">
      <div class="empty-mark" aria-hidden="true"><span>${esc(monthShortFormat.format(today))}</span><strong>${today.getDate()}</strong></div>
      <h3>${heading}</h3>
      <p>${copy}</p>
      <button type="button" class="btn btn-primary" data-action="focus-composer">Add task</button>
    </div>
  `;
}

function renderList() {
  const tasks = visibleTasks();
  const groups = groupTasks(tasks);
  const today = todayISO();
  const overdue = state.tasks.filter((task) => matchesCategory(task) && matchesScope(task, "overdue")).length;
  const showBanner = overdue > 0 && (
    ["today", "week", "undated"].includes(ui.scope) ||
    (ui.scope === "date" && ui.date >= today)
  );
  const banner = showBanner
    ? `<div class="banner"><p>${overdue === 1 ? "One task is past its due date." : `${overdue} tasks are past their due date.`}</p><button type="button" class="btn" data-action="show-overdue">Show overdue</button></div>`
    : "";
  const body = tasks.length
    ? groups.map((group) => {
      const head = group.title
        ? `<div class="group-head${group.warn ? " warn" : ""}"><h3>${group.title}</h3><span class="count-pill">${group.tasks.length}</span></div>`
        : "";
      return `<section>${head}<ul class="task-list">${group.tasks.map(taskMarkup).join("")}</ul></section>`;
    }).join("")
    : emptyMarkup();
  list.innerHTML = banner + body;
  listTitle.textContent = scopeTitle();
  listCount.textContent = countPhrase(tasks.length, ui.scope === "done");
}

function render() {
  const now = new Date();
  const today = todayISO();
  $("greeting").textContent = greetingText(now);
  const openToday = state.tasks.filter((task) => !task.done && task.due === today).length;
  const overdue = state.tasks.filter((task) => !task.done && task.due && task.due < today).length;
  let lede = heroDateFormat.format(now);
  if (openToday === 0) lede += ". Nothing due today";
  else if (openToday === 1) lede += ". One open task today";
  else lede += `. ${openToday} open tasks today`;
  if (overdue === 1) lede += ", plus one overdue task.";
  else if (overdue > 1) lede += `, plus ${overdue} overdue tasks.`;
  else lede += ".";
  $("lede").textContent = lede;
  $("logo-day").textContent = String(now.getDate());
  $("logo-month").textContent = monthShortFormat.format(now);

  const openCount = state.tasks.filter((task) => !task.done).length;
  if (openCount === 0) document.title = "Personal Task";
  else if (openCount === 1) document.title = "Personal Task · 1 open task";
  else document.title = `Personal Task · ${openCount} open tasks`;

  const theme = currentTheme();
  themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  if (themeMeta) themeMeta.content = theme === "dark" ? "#07141c" : "#eef3f4";

  clearDone.disabled = !state.tasks.some((task) => task.done);
  clearDone.textContent = "Clear completed";
  suggestions.hidden = state.tasks.length > 0;
  renderTodayCard();
  renderNav();
  renderCategories();
  renderWeek();
  renderList();
  syncShortcuts(composerShortcuts, dueInput);
}

function setScope(scope) {
  ui.scope = scope;
  if (scope !== "date") ui.date = "";
  if (scope === "today") ui.weekStart = startOfWeekISO(new Date());
  render();
  announce(`${scopeTitle()}. ${listCount.textContent}`);
}

async function addTask() {
  composerError.textContent = "";
  const title = titleInput.value.replace(/\s+/g, " ").trim();
  if (!title) {
    composerError.textContent = "Add a title before creating a task.";
    titleInput.focus();
    return;
  }
  const category = readCategory(categoryInput, newCategoryInput, composerError);
  if (!category || saving) return;
  const due = isISODate(dueInput.value) ? dueInput.value : "";
  const task = normalizeTask({
    title,
    notes: notesInput.value,
    due,
    priority: priorityInput.value,
    category,
    done: false,
    createdAt: Date.now(),
    completedAt: null
  });
  saving = true;
  try {
    const categoryId = await ensureCategoryId(category);
    const saved = normalizeTask(await window.JournalApi.insertTask(task, categoryId));
    state.tasks.unshift(saved);
    state.lastPriority = saved.priority;
    rememberCategory(saved.category);
    titleInput.value = "";
    notesInput.value = "";
    dueInput.value = "";
    newCategoryInput.value = "";
    newCategoryWrap.hidden = true;
    fillSelect(categoryInput, saved.category);
    fillSelect(editorCategory, saved.category);
    render();
    window.setTimeout(() => syncShortcuts(composerShortcuts, dueInput), 0);
    titleInput.focus();
    const confirmation = saved.due ? `Task added, due ${formatFull(saved.due)}` : "Task added";
    showToast(confirmation, "Undo", async () => {
      try {
        await window.JournalApi.deleteTask(saved.id);
        state.tasks = state.tasks.filter((item) => item.id !== saved.id);
        render();
        titleInput.focus();
      } catch (error) {
        showToast(error.message || "Couldn't undo that task.");
      }
    });
  } catch (error) {
    composerError.textContent = error.message || "Couldn't save that task.";
  } finally {
    saving = false;
  }
}

async function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || saving) {
    render();
    return;
  }
  const next = {
    ...task,
    done: !task.done,
    completedAt: task.done ? null : Date.now()
  };
  saving = true;
  try {
    const categoryId = await ensureCategoryId(task.category);
    const saved = normalizeTask(await window.JournalApi.updateTask(next, categoryId));
    Object.assign(task, saved);
    const stays = matchesCategory(task) && matchesScope(task, ui.scope, ui.date);
    showToast(
      task.done ? "Marked complete" : "Moved back to your list",
      "Undo",
      () => { toggleTask(task.id); },
      { focusAction: !stays }
    );
    render();
    if (stays) document.querySelector(`.task-check[data-id="${cssEscape(task.id)}"]`)?.focus();
  } catch (error) {
    showToast(error.message || "Couldn't save that change.");
    render();
  } finally {
    saving = false;
  }
}

async function deleteTask(id, options = {}) {
  const index = state.tasks.findIndex((task) => task.id === id);
  if (index === -1 || saving) return;
  const removed = state.tasks[index];
  saving = true;
  try {
    await window.JournalApi.deleteTask(id);
    state.tasks.splice(index, 1);
    if (options.closeEditor && editor.open) editor.close();
    showToast("Task deleted", "Undo", async () => {
      try {
        const categoryId = await ensureCategoryId(removed.category);
        const saved = normalizeTask(await window.JournalApi.insertTask(removed, categoryId));
        state.tasks.splice(index, 0, saved);
        render();
      } catch (error) {
        showToast(error.message || "Couldn't restore that task.");
      }
    }, { focusAction: true });
    render();
  } catch (error) {
    showToast(error.message || "Couldn't delete that task.");
  } finally {
    saving = false;
  }
}

function openEditor(id, focusDate) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  editor.dataset.id = id;
  editorTitle.value = task.title;
  editorNotes.value = task.notes;
  editorDue.value = task.due || "";
  editorPriority.value = task.priority;
  fillSelect(editorCategory, task.category);
  editorNew.value = "";
  editorNewWrap.hidden = true;
  editorError.textContent = "";
  syncShortcuts(editorShortcuts, editorDue);
  editor.showModal();
  (focusDate ? editorDue : editorTitle).focus();
}

async function saveEditor(event) {
  event.preventDefault();
  editorError.textContent = "";
  const task = state.tasks.find((item) => item.id === editor.dataset.id);
  if (!task) {
    editor.close();
    return;
  }
  const title = editorTitle.value.replace(/\s+/g, " ").trim();
  if (!title) {
    editorError.textContent = "Add a title before saving this task.";
    editorTitle.focus();
    return;
  }
  const category = readCategory(editorCategory, editorNew, editorError);
  if (!category || saving) return;
  const next = {
    ...task,
    title,
    notes: editorNotes.value.trim().slice(0, 2000),
    due: isISODate(editorDue.value) ? editorDue.value : "",
    priority: editorPriority.value,
    category
  };
  saving = true;
  try {
    const categoryId = await ensureCategoryId(category);
    const saved = normalizeTask(await window.JournalApi.updateTask(next, categoryId));
    Object.assign(task, saved);
    state.lastPriority = task.priority;
    rememberCategory(task.category);
    fillSelect(categoryInput, state.lastCategory);
    editor.close();
    render();
    const focusTarget = document.querySelector(`.task[data-id="${cssEscape(task.id)}"] [data-action="edit"]`);
    (focusTarget || listTitle).focus();
    showToast("Changes saved");
  } catch (error) {
    editorError.textContent = error.message || "Couldn't save that task.";
  } finally {
    saving = false;
  }
}

async function clearCompleted() {
  const removed = state.tasks.filter((task) => task.done);
  if (!removed.length || saving) return;
  saving = true;
  try {
    for (const task of removed) await window.JournalApi.deleteTask(task.id);
    state.tasks = state.tasks.filter((task) => !task.done);
    render();
    const label = removed.length === 1 ? "1 completed task removed" : `${removed.length} completed tasks removed`;
    showToast(label, "Undo", async () => {
      try {
        for (const task of removed) {
          const categoryId = await ensureCategoryId(task.category);
          const saved = normalizeTask(await window.JournalApi.insertTask(task, categoryId));
          state.tasks.push(saved);
        }
        render();
      } catch (error) {
        showToast(error.message || "Couldn't restore those tasks.");
      }
    }, { focusAction: true });
  } catch (error) {
    showToast(error.message || "Couldn't clear completed tasks.");
    try { await reloadJournal(); } catch (reloadError) { loadError = reloadError.message; }
    render();
  } finally {
    saving = false;
  }
}

function exportTasks() {
  const blob = new Blob([JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
    categories: state.categories
  }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `personal-task-${todayISO()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  showToast("Journal exported");
}

async function importTasks(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (error) {
    showToast("Couldn't read that file");
    return;
  }
  if (!data || !Array.isArray(data.tasks)) {
    showToast("That file isn't a task journal");
    return;
  }
  const incoming = data.tasks.map(normalizeTask).filter((task) => task.title).slice(0, 5000);
  const categoryNames = ensureCategories([
    ...(Array.isArray(data.categories) ? data.categories : []),
    ...incoming.map((task) => task.category)
  ]);
  let saved = 0;
  try {
    for (const name of categoryNames) await ensureCategoryId(name);
    for (const task of incoming) {
      const categoryId = await ensureCategoryId(task.category);
      const known = state.tasks.some((item) => item.id === task.id);
      const stored = normalizeTask(known
        ? await window.JournalApi.updateTask(task, categoryId)
        : await window.JournalApi.insertTask(task, categoryId));
      const index = state.tasks.findIndex((item) => item.id === task.id);
      if (index === -1) state.tasks.push(stored);
      else state.tasks[index] = stored;
      saved += 1;
    }
  } catch (error) {
    showToast(error.message || "Couldn't import every task.");
    fillSelect(categoryInput, state.lastCategory);
    fillSelect(editorCategory, state.lastCategory);
    render();
    return;
  }
  fillSelect(categoryInput, state.lastCategory);
  fillSelect(editorCategory, state.lastCategory);
  render();
  showToast(saved === 1 ? "1 task imported" : `${saved} tasks imported`);
}

function bindDateShortcuts(container, input) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-offset]");
    if (!button) return;
    input.value = button.dataset.offset === "clear" ? "" : addDays(todayISO(), Number(button.dataset.offset));
    syncShortcuts(container, input);
  });
  input.addEventListener("input", () => syncShortcuts(container, input));
  input.addEventListener("change", () => syncShortcuts(container, input));
}

function bindNewCategory(select, wrap, input) {
  select.addEventListener("change", () => {
    const show = select.value === "__new__";
    wrap.hidden = !show;
    if (show) input.focus();
  });
}

const drawer = $("drawer");
const menuToggle = $("menu-toggle");
const drawerQuery = window.matchMedia("(max-width: 900px)");

function setDrawer(open) {
  const overlay = drawerQuery.matches;
  const show = overlay && open;
  document.body.classList.toggle("drawer-open", show);
  menuToggle.setAttribute("aria-expanded", show ? "true" : "false");
  drawer.inert = overlay && !show;
  if (overlay && !show) drawer.setAttribute("aria-hidden", "true");
  else drawer.removeAttribute("aria-hidden");
  if (show) $("drawer-close").focus();
}

menuToggle.addEventListener("click", () => {
  setDrawer(!document.body.classList.contains("drawer-open"));
});
$("drawer-close").addEventListener("click", () => {
  setDrawer(false);
  menuToggle.focus();
});
$("drawer-backdrop").addEventListener("click", () => setDrawer(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("drawer-open")) {
    setDrawer(false);
    menuToggle.focus();
  }
});
drawerQuery.addEventListener("change", () => setDrawer(false));
setDrawer(false);

document.querySelector(".sidebar").addEventListener("click", (event) => {
  const scopeButton = event.target.closest("[data-scope]");
  if (scopeButton) {
    setDrawer(false);
    setScope(scopeButton.dataset.scope);
    return;
  }
  const categoryButton = event.target.closest("[data-cat]");
  if (!categoryButton) return;
  ui.category = categoryButton.dataset.cat || "";
  setDrawer(false);
  render();
  announce(`${scopeTitle()}. ${listCount.textContent}`);
});

weekDays.addEventListener("click", (event) => {
  const button = event.target.closest("[data-day]");
  if (!button) return;
  const iso = button.dataset.day;
  if (ui.scope === "date" && ui.date === iso) {
    ui.scope = "open";
    ui.date = "";
  } else if (iso === todayISO()) {
    ui.scope = "today";
    ui.date = "";
  } else {
    ui.scope = "date";
    ui.date = iso;
  }
  render();
  announce(`${scopeTitle()}. ${listCount.textContent}`);
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "focus-composer") {
    titleInput.focus();
    return;
  }
  if (action === "retry-load") {
    enterJournal({ name: $("logo-sub").textContent });
    return;
  }
  if (action === "show-overdue") {
    setScope("overdue");
    return;
  }
  const id = button.closest("[data-id]")?.dataset.id;
  if (!id) return;
  if (action === "edit") openEditor(id, false);
  if (action === "edit-date") openEditor(id, true);
  if (action === "delete") deleteTask(id);
});

list.addEventListener("change", (event) => {
  if (event.target.matches(".task-check")) toggleTask(event.target.dataset.id);
});

$("composer").addEventListener("submit", (event) => {
  event.preventDefault();
  addTask();
});

titleInput.addEventListener("invalid", () => {
  titleInput.setCustomValidity("Add a title before creating a task");
});
titleInput.addEventListener("input", () => {
  titleInput.setCustomValidity("");
  composerError.textContent = "";
});

toggleNotes.addEventListener("click", () => {
  const willOpen = notesWrap.hidden;
  notesWrap.hidden = !willOpen;
  toggleNotes.setAttribute("aria-expanded", String(willOpen));
  toggleNotes.textContent = willOpen ? "Hide note" : "Add a note";
  if (willOpen) notesInput.focus();
});

notesInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    $("composer").requestSubmit();
  }
});

suggestions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-suggestion]");
  if (!button) return;
  const suggestion = SUGGESTIONS[button.dataset.suggestion];
  titleInput.value = suggestion.title;
  priorityInput.value = suggestion.priority;
  fillSelect(categoryInput, suggestion.category);
  dueInput.value = suggestion.offset === null ? "" : addDays(todayISO(), suggestion.offset);
  syncShortcuts(composerShortcuts, dueInput);
  titleInput.focus();
});

$("week-prev").addEventListener("click", () => {
  ui.weekStart = addDays(ui.weekStart, -7);
  renderWeek();
});
$("week-next").addEventListener("click", () => {
  ui.weekStart = addDays(ui.weekStart, 7);
  renderWeek();
});
$("week-today").addEventListener("click", () => {
  ui.weekStart = startOfWeekISO(new Date());
  setScope("today");
});

themeToggle.addEventListener("click", () => {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
  render();
});

clearDone.addEventListener("click", clearCompleted);
$("export-btn").addEventListener("click", exportTasks);
$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (file) await importTasks(file);
});

editorForm.addEventListener("submit", saveEditor);
$("editor-close").addEventListener("click", () => editor.close());
$("editor-cancel").addEventListener("click", () => editor.close());
$("editor-delete").addEventListener("click", () => deleteTask(editor.dataset.id, { closeEditor: true }));
editor.addEventListener("click", (event) => {
  if (event.target === editor) editor.close();
});
editorTitle.addEventListener("input", () => { editorError.textContent = ""; });

bindDateShortcuts(composerShortcuts, dueInput);
bindDateShortcuts(editorShortcuts, editorDue);
bindNewCategory(categoryInput, newCategoryWrap, newCategoryInput);
bindNewCategory(editorCategory, editorNewWrap, editorNew);

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!localStorage.getItem(THEME_KEY)) render();
});

priorityInput.value = state.lastPriority;
fillSelect(categoryInput, state.lastCategory);
fillSelect(editorCategory, state.lastCategory);

$("open-login").addEventListener("click", async () => {
  setDrawer(false);
  const button = $("open-login");
  button.disabled = true;
  try {
    await window.AuthApi.signOut();
    resetJournal();
    window.LoginScreen.show();
  } catch (error) {
    showToast(error.message || "Couldn't sign out. Try again.");
  } finally {
    button.disabled = false;
  }
});

boot();
