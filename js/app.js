import * as S from './store.js';

/* ============ Helpers ============ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const dueLabel = (iso) => {
  const diff = S.dayDiff(iso);
  if (diff === null) return '';
  if (diff < 0) return 'Atrasada';
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff <= 7) return `Em ${diff} dias`;
  return fmtDate(iso);
};

const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const checkSvg = '<svg viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>';
const trashSvg = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>';

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ============ Render: listas ============ */
function taskItem(t, opts = {}) {
  const diff = S.dayDiff(t.due);
  const meta = [];
  if (t.due) {
    const cls = diff < 0 ? 'overdue' : diff === 0 ? 'today' : '';
    meta.push(`<span class="tag ${cls}">${esc(dueLabel(t.due))}</span>`);
  }
  meta.push(`<span class="tag p-${t.priority}">${esc(t.priority)}</span>`);
  if (opts.showSubject !== false && t.subjectId) {
    meta.push(`<span class="tag"><i class="dot" style="background:${S.subjectColor(t.subjectId)}"></i>${esc(S.subjectName(t.subjectId))}</span>`);
  }
  if (t.note) meta.push(`<span>${esc(t.note)}</span>`);

  return `<li class="item ${t.done ? 'is-done' : ''}" data-task="${t.id}">
    <button class="check ${t.done ? 'is-on' : ''}" data-toggle="${t.id}" aria-label="Concluir">${checkSvg}</button>
    <div class="item-main">
      <div class="item-title">${esc(t.title)}</div>
      <div class="item-meta">${meta.join('')}</div>
    </div>
    <button class="del" data-del-task="${t.id}" aria-label="Excluir">${trashSvg}</button>
  </li>`;
}

function renderToday() {
  const today = S.todayISO();
  const now = new Date();
  $('#greeting').textContent = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  $('#today-date').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const list = S.todayTasks();
  const doneToday = S.state.tasks.filter((t) => t.done && t.doneAt
    && new Date(t.doneAt).toDateString() === now.toDateString()).length;
  const total = list.length + doneToday;
  const pct = total ? Math.round((doneToday / total) * 100) : 0;

  $('#ring').style.setProperty('--p', pct);
  $('#ring-label').textContent = pct + '%';

  const overdue = S.pendingTasks().filter((t) => t.due && S.dayDiff(t.due) < 0).length;
  const upcoming = S.pendingTasks().filter((t) => t.due && S.dayDiff(t.due) >= 0 && S.dayDiff(t.due) <= 7).length;
  $('#stats').innerHTML = `
    <div class="stat"><b>${list.length}</b><span>Para hoje</span></div>
    <div class="stat"><b>${overdue}</b><span>Atrasadas</span></div>
    <div class="stat"><b>${upcoming}</b><span>Na semana</span></div>
    <div class="stat"><b>${S.state.settings.sessions || 0}</b><span>Sessões</span></div>`;

  const tl = $('#today-list');
  tl.innerHTML = list.length
    ? list.map((t) => taskItem(t)).join('')
    : '<li class="empty">Nada pendente para hoje. 🎉</li>';

  const soon = S.pendingTasks()
    .filter((t) => t.due)
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .slice(0, 6);
  $('#deadlines').innerHTML = soon.length
    ? soon.map((t) => taskItem(t, { showSubject: true })).join('')
    : '<li class="empty">Nenhum prazo marcado.</li>';

  // Gráfico 7 dias
  const chart = $('#week-chart');
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const count = S.state.tasks.filter((t) => t.done && t.doneAt && new Date(t.doneAt).toDateString() === d.toDateString()).length;
    days.push({ label: WEEK[d.getDay()], count, key });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  chart.innerHTML = days.map((d) => `
    <div class="chart-col">
      <div class="chart-bar" style="height:${Math.round((d.count / max) * 88)}%" title="${d.count} tarefa(s)"></div>
      <span>${d.label}</span>
    </div>`).join('');
}

function renderTasks() {
  const q = ($('#task-search').value || '').toLowerCase().trim();
  const fs = $('#task-filter-subject').value;
  const st = $('#task-filter-status').value;

  let list = [...S.state.tasks];
  if (q) list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q));
  if (fs) list = list.filter((t) => t.subjectId === fs);
  if (st === 'pending') list = list.filter((t) => !t.done);
  if (st === 'done') list = list.filter((t) => t.done);
  list.sort(S.byPriority);

  $('#tasks-list').innerHTML = list.length
    ? list.map((t) => taskItem(t)).join('')
    : '<li class="empty">Nenhuma tarefa encontrada.</li>';
}

function renderSubjects() {
  const grid = $('#subjects-grid');
  if (!S.state.subjects.length) {
    grid.innerHTML = '<p class="empty">Crie sua primeira disciplina para organizar as tarefas.</p>';
    return;
  }
  grid.innerHTML = S.state.subjects.map((s) => {
    const pend = S.state.tasks.filter((t) => t.subjectId === s.id && !t.done).length;
    const media = S.average(s.id);
    return `<div class="subject" style="--c:${s.color}">
      <h4>${esc(s.name)}</h4>
      <div class="muted">${pend} pendente(s)${media !== null ? ` · média ${media.toFixed(1)}` : ''}</div>
      <div class="subject-actions">
        <button class="btn btn-ghost" data-edit-subject="${s.id}">Editar</button>
        <button class="btn btn-ghost" data-del-subject="${s.id}">Excluir</button>
      </div>
    </div>`;
  }).join('');
}

function renderGrades() {
  const grid = $('#grades-grid');
  if (!S.state.subjects.length) {
    grid.innerHTML = '<p class="empty">Cadastre disciplinas para lançar notas.</p>';
  } else {
    grid.innerHTML = S.state.subjects.map((s) => {
      const media = S.average(s.id);
      const n = S.state.grades.filter((g) => g.subjectId === s.id).length;
      return `<div class="subject" style="--c:${s.color}">
        <h4>${esc(s.name)}</h4>
        <div class="muted">${n} avaliação(ões)</div>
        <div style="font-size:1.6rem;font-weight:800;letter-spacing:-.03em;margin-top:6px">${media !== null ? media.toFixed(1) : '—'}</div>
      </div>`;
    }).join('');
  }

  const list = [...S.state.grades].sort((a, b) => (a.date < b.date ? 1 : -1));
  $('#grades-list').innerHTML = list.length ? list.map((g) => {
    const v = Number(g.value);
    const cls = v >= 7 ? 'good' : v < 5 ? 'low' : '';
    return `<li class="grade-row">
      <span class="tag"><i class="dot" style="background:${S.subjectColor(g.subjectId)}"></i>${esc(S.subjectName(g.subjectId))}</span>
      <div class="item-main">
        <div class="item-title">${esc(g.title)}</div>
        <div class="item-meta"><span>${fmtDate(g.date)}</span><span>peso ${g.weight}</span></div>
      </div>
      <span class="grade-value ${cls}">${v.toFixed(1)}</span>
      <button class="del" data-del-grade="${g.id}" aria-label="Excluir">${trashSvg}</button>
    </li>`;
  }).join('') : '<li class="empty">Nenhuma nota lançada.</li>';
}

/* ============ Render: Timer ============ */
let tickHandle = null;

function renderTimer() {
  const total = S.timerTotal();
  const left = S.state.timer.remaining ?? total;
  const m = Math.floor(left / 60);
  const s = left % 60;
  $('#timer-time').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  $('#timer-face').style.setProperty('--p', Math.round((1 - left / total) * 100));

  const labels = { focus: 'Hora de focar', short: 'Pausa curta', long: 'Pausa longa' };
  $('#timer-label').textContent = labels[S.state.timer.mode];
  $('#timer-toggle').textContent = S.state.timer.running ? 'Pausar' : (left === total ? 'Iniciar' : 'Continuar');
  $('#timer-count').textContent = `${S.state.settings.sessions || 0} sessões concluídas hoje`;
  $$('#timer-modes .chip').forEach((c) => c.classList.toggle('is-active', c.dataset.mode === S.state.timer.mode));
}

function startTicker() {
  clearInterval(tickHandle);
  tickHandle = setInterval(() => {
    const res = S.timerTick();
    if (res) {
      renderTimer();
      toast(res === 'focus-done' ? 'Sessão concluída! Time de uma pausa. 🎉' : 'Pausa acabou. Bora focar!');
      beep();
    } else if ($('#view-timer').classList.contains('is-active')) {
      renderTimer();
    }
  }, 500);
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close(), 700);
  } catch (e) { /* silencioso */ }
}

/* ============ Render geral ============ */
function renderAll() {
  renderToday();
  renderTasks();
  renderSubjects();
  renderGrades();
  renderTimer();
  syncSubjectSelects();
}

function syncSubjectSelects() {
  const opts = S.state.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  const taskSel = $('#form-task select[name="subjectId"]');
  const curTask = taskSel.value;
  taskSel.innerHTML = `<option value="">Sem disciplina</option>${opts}`;
  taskSel.value = curTask;

  const gradeSel = $('#form-grade select[name="subjectId"]');
  const curGrade = gradeSel.value;
  gradeSel.innerHTML = `<option value="">Selecione...</option>${opts}`;
  gradeSel.value = curGrade;

  const filter = $('#task-filter-subject');
  const cur = filter.value;
  filter.innerHTML = `<option value="">Todas as disciplinas</option>${opts}`;
  filter.value = cur;
}

/* ============ Tema ============ */
function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0b1020' : '#6366f1');
}

/* ============ Diálogos ============ */
function openTaskDialog(task = null) {
  const f = $('#form-task');
  f.reset();
  $('#dlg-task-title').textContent = task ? 'Editar tarefa' : 'Nova tarefa';
  f.elements.id.value = task?.id || '';
  f.elements.title.value = task?.title || '';
  f.elements.subjectId.value = task?.subjectId || '';
  f.elements.due.value = task?.due || '';
  f.elements.priority.value = task?.priority || 'media';
  f.elements.note.value = task?.note || '';
  $('#dlg-task').showModal();
  setTimeout(() => f.elements.title.focus(), 30);
}

function openSubjectDialog(subject = null) {
  const f = $('#form-subject');
  f.reset();
  $('#dlg-subject-title').textContent = subject ? 'Editar disciplina' : 'Nova disciplina';
  f.elements.id.value = subject?.id || '';
  f.elements.name.value = subject?.name || '';
  const color = subject?.color || S.COLORS[0];
  f.elements.color.value = color;
  renderSwatches(color);
  $('#dlg-subject').showModal();
  setTimeout(() => f.elements.name.focus(), 30);
}

function renderSwatches(selected) {
  $('#subject-swatches').innerHTML = S.COLORS.map((c) => `
    <button type="button" class="swatch ${c === selected ? 'is-on' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
}

function openGradeDialog(grade = null) {
  const f = $('#form-grade');
  f.reset();
  $('#dlg-grade-title').textContent = grade ? 'Editar nota' : 'Nova nota';
  f.elements.id.value = grade?.id || '';
  f.elements.subjectId.value = grade?.subjectId || (S.state.subjects[0]?.id || '');
  f.elements.title.value = grade?.title || '';
  f.elements.value.value = grade?.value ?? '';
  f.elements.weight.value = grade?.weight ?? 1;
  f.elements.date.value = grade?.date || S.todayISO();
  $('#dlg-grade').showModal();
  setTimeout(() => f.elements.title.focus(), 30);
}

function openSettings() {
  $('#set-focus').value = S.state.settings.focus;
  $('#set-break').value = S.state.settings.short;
  $('#set-long').value = S.state.settings.long;
  $('#set-theme').value = S.state.settings.theme;
  $('#dlg-settings').showModal();
}

/* ============ Navegação ============ */
const VIEW_META = {
  hoje: ['Hoje', 'Sua agenda do dia'],
  tarefas: ['Tarefas', 'Tudo o que você precisa entregar'],
  disciplinas: ['Disciplinas', 'Organize seus estudos por matéria'],
  notas: ['Notas', 'Acompanhe seu desempenho'],
  timer: ['Timer', 'Sessões de estudo focadas'],
};

function go(view) {
  $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-' + view));
  $$('[data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
  const [title, sub] = VIEW_META[view] || ['', ''];
  $('#view-title').textContent = title;
  $('#view-sub').textContent = sub;
  history.replaceState(null, '', '#' + view);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============ Eventos ============ */
function bind() {
  // Navegação (sidebar + tabbar)
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-view]');
    if (navBtn) { go(navBtn.dataset.view); return; }

    const action = e.target.closest('[data-action]');
    if (action) {
      const a = action.dataset.action;
      if (a === 'new-task') openTaskDialog();
      if (a === 'new-subject') openSubjectDialog();
      if (a === 'new-grade') openGradeDialog();
      return;
    }

    const toggle = e.target.closest('[data-toggle]');
    if (toggle) { S.toggleTask(toggle.dataset.toggle); return; }

    const delTask = e.target.closest('[data-del-task]');
    if (delTask) {
      if (confirm('Excluir esta tarefa?')) S.removeTask(delTask.dataset.delTask);
      return;
    }

    const delSubject = e.target.closest('[data-del-subject]');
    if (delSubject) {
      if (confirm('Excluir a disciplina e as tarefas relacionadas?')) S.removeSubject(delSubject.dataset.delSubject);
      return;
    }

    const editSubject = e.target.closest('[data-edit-subject]');
    if (editSubject) {
      openSubjectDialog(S.subjectById(editSubject.dataset.editSubject));
      return;
    }

    const delGrade = e.target.closest('[data-del-grade]');
    if (delGrade) {
      if (confirm('Excluir esta nota?')) S.removeGrade(delGrade.dataset.delGrade);
      return;
    }

    const swatch = e.target.closest('.swatch');
    if (swatch) {
      $$('.swatch').forEach((s) => s.classList.toggle('is-on', s === swatch));
      $('#subject-color').value = swatch.dataset.color;
    }
  });

  // Editar tarefa ao clicar no título
  document.addEventListener('dblclick', (e) => {
    const title = e.target.closest('.item-title');
    if (!title) return;
    const item = title.closest('[data-task]');
    const t = S.state.tasks.find((x) => x.id === item?.dataset.task);
    if (t) openTaskDialog(t);
  });

  // Formulários
  $('#form-task').addEventListener('submit', (e) => {
    const f = e.target;
    if (f.returnValue === 'cancel') return;
    const data = {
      id: f.elements.id.value,
      title: f.elements.title.value.trim(),
      subjectId: f.elements.subjectId.value,
      due: f.elements.due.value,
      priority: f.elements.priority.value,
      note: f.elements.note.value.trim(),
    };
    if (!data.title) return;
    S.upsertTask(data);
    toast(data.id ? 'Tarefa atualizada' : 'Tarefa adicionada');
  });

  $('#form-subject').addEventListener('submit', (e) => {
    const f = e.target;
    if (f.returnValue === 'cancel') return;
    const name = f.elements.name.value.trim();
    if (!name) return;
    S.upsertSubject({ id: f.elements.id.value, name, color: f.elements.color.value || S.COLORS[0] });
    toast(f.elements.id.value ? 'Disciplina atualizada' : 'Disciplina criada');
  });

  $('#form-grade').addEventListener('submit', (e) => {
    const f = e.target;
    if (f.returnValue === 'cancel') return;
    const data = {
      id: f.elements.id.value,
      subjectId: f.elements.subjectId.value,
      title: f.elements.title.value.trim(),
      value: f.elements.value.value,
      weight: f.elements.weight.value,
      date: f.elements.date.value,
    };
    if (!data.title || !data.subjectId) return;
    S.upsertGrade(data);
    toast(data.id ? 'Nota atualizada' : 'Nota lançada');
  });

  // Filtros
  ['#task-search', '#task-filter-subject', '#task-filter-status'].forEach((sel) => {
    $(sel).addEventListener('input', renderTasks);
  });

  // Timer
  $$('#timer-modes .chip').forEach((chip) => {
    chip.addEventListener('click', () => { S.setTimerMode(chip.dataset.mode); renderTimer(); });
  });
  $('#timer-toggle').addEventListener('click', () => {
    if (S.state.timer.running) S.timerPause(); else S.timerStart();
    renderTimer();
    if (S.state.timer.running) startTicker();
  });
  $('#timer-reset').addEventListener('click', () => { S.timerReset(); renderTimer(); });
  $('#timer-skip').addEventListener('click', () => {
    const res = S.timerComplete(true);
    renderTimer();
    toast(res === 'focus-done' ? 'Sessão pulada' : 'Pausa pulada');
  });

  // Tema
  $('#btn-theme').addEventListener('click', () => {
    const order = ['light', 'dark', 'auto'];
    const cur = S.state.settings.theme || 'auto';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    S.setSetting('theme', next);
    applyTheme(next);
    toast('Tema: ' + (next === 'auto' ? 'automático' : next));
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((S.state.settings.theme || 'auto') === 'auto') applyTheme('auto');
  });

  // Ajustes
  $('#btn-settings').addEventListener('click', openSettings);
  $('#set-theme').addEventListener('change', (e) => {
    S.setSetting('theme', e.target.value);
    applyTheme(e.target.value);
  });
  $('#set-focus').addEventListener('change', (e) => {
    S.setSetting('focus', Math.max(1, Number(e.target.value) || 25));
    S.timerReset(); renderTimer();
  });
  $('#set-break').addEventListener('change', (e) => {
    S.setSetting('short', Math.max(1, Number(e.target.value) || 5));
    S.timerReset(); renderTimer();
  });
  $('#set-long').addEventListener('change', (e) => {
    S.setSetting('long', Math.max(2, Number(e.target.value) || 15));
    S.timerReset(); renderTimer();
  });

  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `estuda-backup-${S.todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exportado');
  });

  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      S.importJSON(await file.text());
    } catch (err) {
      toast('Arquivo inválido');
    }
  });

  $('#btn-reset').addEventListener('click', () => {
    if (confirm('Apagar TODOS os dados do app? Isso não pode ser desfeito.')) {
      localStorage.removeItem('estudantil:v1');
      location.reload();
    }
  });

  // Atalhos de teclado
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'n') { e.preventDefault(); openTaskDialog(); }
    if (e.key === 't') go('timer');
    if (e.key === '1') go('hoje');
    if (e.key === '2') go('tarefas');
  });
}

/* ============ Init ============ */
function init() {
  applyTheme(S.state.settings.theme || 'auto');

  // Recupera o timer após recarregar a página
  if (S.state.timer.running && S.state.timer.endsAt) {
    const left = Math.round((S.state.timer.endsAt - Date.now()) / 1000);
    if (left <= 0) S.timerComplete();
    else S.state.timer.remaining = left;
  }

  renderAll();
  bind();
  S.subscribe(renderAll);
  startTicker();

  // Deep link
  const params = new URLSearchParams(location.search);
  const hash = location.hash.replace('#', '');
  const view = params.get('view') || hash || 'hoje';
  go(VIEW_META[view] ? view : 'hoje');
  if (params.get('action') === 'new-task') openTaskDialog();

  // Sessão do dia (reseta contador em dia novo)
  if (S.state.settings.lastCompleted !== S.todayISO()) {
    S.state.settings.sessions = 0;
    S.state.settings.lastCompleted = S.todayISO();
  }

  // Service worker
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
