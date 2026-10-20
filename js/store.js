// Store: estado + persistência em localStorage. Sem dependências.

const KEY = 'estudantil:v1';

export const COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#64748b',
];

const DEFAULTS = () => ({
  subjects: [],
  tasks: [],
  grades: [],
  settings: {
    theme: 'auto',
    focus: 25,
    short: 5,
    long: 15,
    lastCompleted: '', // data ISO da última sessão de foco concluída
    sessions: 0,        // sessões de foco concluídas hoje
  },
  timer: { mode: 'focus', remaining: 25 * 60, running: false, endsAt: 0 },
});

export const state = load();

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Falha ao salvar', e);
  }
  listeners.forEach((fn) => fn());
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed(DEFAULTS());
    const parsed = JSON.parse(raw);
    const base = DEFAULTS();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      timer: { ...base.timer, ...(parsed.timer || {}) },
      subjects: parsed.subjects || [],
      tasks: parsed.tasks || [],
      grades: parsed.grades || [],
    };
  } catch (e) {
    return seed(DEFAULTS());
  }
}

function seed(base) {
  base.subjects = [
    { id: uid(), name: 'Matemática', color: COLORS[0] },
    { id: uid(), name: 'Física', color: COLORS[1] },
    { id: uid(), name: 'História', color: COLORS[3] },
  ];
  const today = todayISO();
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  base.tasks = [
    { id: uid(), subjectId: base.subjects[0].id, title: 'Resolver lista de exercícios 4', due: today, priority: 'alta', note: '', done: false, createdAt: Date.now() },
    { id: uid(), subjectId: base.subjects[1].id, title: 'Ler capítulo 7 de termodinâmica', due: today, priority: 'media', note: '', done: false, createdAt: Date.now() },
    { id: uid(), subjectId: base.subjects[2].id, title: 'Mapa mental — Revolução Industrial', due: tomorrow, priority: 'baixa', note: '', done: false, createdAt: Date.now() },
  ];
  return base;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/* ===== Datas ===== */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayDiff(iso) {
  if (!iso) return null;
  const a = new Date(iso + 'T00:00:00');
  const b = new Date(todayISO() + 'T00:00:00');
  return Math.round((a - b) / 864e5);
}

/* ===== Selectors ===== */
export const subjectById = (id) => state.subjects.find((s) => s.id === id) || null;
export const subjectName = (id) => subjectById(id)?.name || 'Sem disciplina';
export const subjectColor = (id) => subjectById(id)?.color || '#94a3b8';

export const pendingTasks = () => state.tasks.filter((t) => !t.done);
export const todayTasks = () => state.tasks
  .filter((t) => !t.done && (t.due === todayISO() || (t.due && dayDiff(t.due) < 0)))
  .sort(byPriority);

export function byPriority(a, b) {
  const rank = { alta: 0, media: 1, baixa: 2 };
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.due !== b.due) {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  }
  return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
}

export function average(subjectId) {
  const list = state.grades.filter((g) => g.subjectId === subjectId);
  if (!list.length) return null;
  const w = list.reduce((s, g) => s + (Number(g.weight) || 1), 0);
  const sum = list.reduce((s, g) => s + (Number(g.value) || 0) * (Number(g.weight) || 1), 0);
  return w ? sum / w : null;
}

/* ===== Mutations ===== */
export function upsertSubject(data) {
  if (data.id) {
    const s = subjectById(data.id);
    if (s) Object.assign(s, { name: data.name, color: data.color });
  } else {
    state.subjects.push({ id: uid(), name: data.name, color: data.color || COLORS[0] });
  }
  save();
}

export function removeSubject(id) {
  state.subjects = state.subjects.filter((s) => s.id !== id);
  state.tasks.forEach((t) => { if (t.subjectId === id) t.subjectId = ''; });
  state.grades = state.grades.filter((g) => g.subjectId !== id);
  save();
}

export function upsertTask(data) {
  if (data.id) {
    const t = state.tasks.find((x) => x.id === data.id);
    if (t) Object.assign(t, data);
  } else {
    state.tasks.push({
      id: uid(),
      subjectId: data.subjectId || '',
      title: data.title,
      due: data.due || '',
      priority: data.priority || 'media',
      note: data.note || '',
      done: false,
      createdAt: Date.now(),
    });
  }
  save();
}

export function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  save();
}

export function removeTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  save();
}

export function upsertGrade(data) {
  if (data.id) {
    const g = state.grades.find((x) => x.id === data.id);
    if (g) Object.assign(g, data);
  } else {
    state.grades.push({
      id: uid(),
      subjectId: data.subjectId,
      title: data.title,
      value: Number(data.value),
      weight: Number(data.weight) || 1,
      date: data.date || todayISO(),
    });
  }
  save();
}

export function removeGrade(id) {
  state.grades = state.grades.filter((g) => g.id !== id);
  save();
}

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

/* ===== Timer ===== */
export function timerTotal() {
  const s = state.settings;
  const m = state.timer.mode;
  return (m === 'focus' ? s.focus : m === 'long' ? s.long : s.short) * 60;
}

export function setTimerMode(mode) {
  state.timer.mode = mode;
  state.timer.running = false;
  state.timer.endsAt = 0;
  state.timer.remaining = timerTotal();
  save();
}

export function timerStart() {
  if (state.timer.running) return;
  const total = timerTotal();
  if (!state.timer.remaining || state.timer.remaining > total) state.timer.remaining = total;
  state.timer.running = true;
  state.timer.endsAt = Date.now() + state.timer.remaining * 1000;
  save();
}

export function timerPause() {
  if (!state.timer.running) return;
  state.timer.remaining = Math.max(0, Math.round((state.timer.endsAt - Date.now()) / 1000));
  state.timer.running = false;
  state.timer.endsAt = 0;
  save();
}

export function timerReset() {
  state.timer.running = false;
  state.timer.endsAt = 0;
  state.timer.remaining = timerTotal();
  save();
}

/** Avança o ciclo. Retorna 'focus-done' quando um ciclo de foco terminou. */
export function timerComplete(skipped = false) {
  const wasFocus = state.timer.mode === 'focus';
  if (wasFocus && !skipped) {
    const today = todayISO();
    if (state.settings.lastCompleted !== today) {
      state.settings.lastCompleted = today;
      state.settings.sessions = 0;
    }
    state.settings.sessions = (state.settings.sessions || 0) + 1;
  }
  const n = state.settings.sessions || 0;
  state.timer.mode = wasFocus ? (n > 0 && n % 4 === 0 ? 'long' : 'short') : 'focus';
  state.timer.running = false;
  state.timer.endsAt = 0;
  state.timer.remaining = timerTotal();
  save();
  return wasFocus ? 'focus-done' : 'break-done';
}

export function timerTick() {
  if (!state.timer.running) return null;
  const left = Math.round((state.timer.endsAt - Date.now()) / 1000);
  if (left <= 0) {
    state.timer.remaining = 0;
    return timerComplete();
  }
  state.timer.remaining = left;
  return null;
}

/* ===== Backup ===== */
export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Arquivo inválido');
  localStorage.setItem(KEY, JSON.stringify(data));
  location.reload();
}
