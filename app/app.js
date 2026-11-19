// Leonida Platinum — trophy tracker.
//
// Plain vanilla JavaScript, no build step, no network beyond the two local
// data files. Progress lives in localStorage on the user's own machine.

const EARNED_KEY = 'leonida-platinum-earned-v1';
const SPOILER_KEY = 'leonida-platinum-spoiler-v1';

const state = {
  trophies: [],
  guide: {},
  roadmap: [],
  earned: new Set(),
  grade: 'all',
  show: 'all',
  missableOnly: false,
  query: '',
  spoiler: true,
  stepIds: null,
};

const $ = (id) => document.getElementById(id);

function loadEarned() {
  try {
    const raw = localStorage.getItem(EARNED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return new Set(parsed.filter((n) => Number.isInteger(n)));
  } catch (_) {
    // Corrupt stored data: start clean rather than crash.
  }
  return new Set();
}

function saveEarned() {
  localStorage.setItem(EARNED_KEY, JSON.stringify([...state.earned].sort((a, b) => a - b)));
}

function loadSpoiler() {
  const raw = localStorage.getItem(SPOILER_KEY);
  return raw === null ? true : raw === 'true';
}

function gradeCounts() {
  const totals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const earned = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of state.trophies) {
    totals[t.grade] += 1;
    if (state.earned.has(t.id)) earned[t.grade] += 1;
  }
  return { totals, earned };
}

function visibleTrophies() {
  const q = state.query.trim().toLowerCase();
  return state.trophies.filter((t) => {
    const g = state.guide[String(t.id)] || {};
    if (state.stepIds && !state.stepIds.includes(t.id)) return false;
    if (state.grade !== 'all' && t.grade !== state.grade) return false;
    if (state.show === 'earned' && !state.earned.has(t.id)) return false;
    if (state.show === 'unearned' && state.earned.has(t.id)) return false;
    if (state.missableOnly && !g.missable) return false;
    if (q && !(t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))) return false;
    return true;
  });
}

function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function renderProgress() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  const pct = total ? Math.round((earned / total) * 100) : 0;
  $('earned-count').textContent = `${earned} / ${total} earned`;
  $('earned-pct').textContent = `${pct}%`;
  $('progress-fill').style.width = `${pct}%`;
  const { totals, earned: byGrade } = gradeCounts();
  $('grade-counts').textContent =
    `Platinum ${byGrade.platinum}/${totals.platinum} · ` +
    `Gold ${byGrade.gold}/${totals.gold} · ` +
    `Silver ${byGrade.silver}/${totals.silver} · ` +
    `Bronze ${byGrade.bronze}/${totals.bronze}`;
}

function trophyRow(t) {
  const g = state.guide[String(t.id)] || {};
  const earned = state.earned.has(t.id);
  const hidden = state.spoiler && g.story && !earned;

  const li = document.createElement('li');
  li.className = 'trophy' + (earned ? ' earned' : '');
  li.dataset.id = String(t.id);

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'trophy-check';
  check.checked = earned;
  check.setAttribute('aria-label', `Mark ${hidden ? 'story trophy' : t.name} as earned`);
  check.addEventListener('change', () => {
    if (check.checked) state.earned.add(t.id);
    else state.earned.delete(t.id);
    saveEarned();
    renderAll();
  });
  li.appendChild(check);

  const head = document.createElement('div');
  head.className = 'trophy-head';
  const name = document.createElement('h3');
  name.className = 'trophy-name';
  name.textContent = hidden ? 'Hidden story trophy' : t.name;
  head.appendChild(name);
  const badge = document.createElement('span');
  badge.className = `badge ${t.grade}`;
  badge.textContent = gradeLabel(t.grade);
  head.appendChild(badge);
  if (g.missable) {
    const chip = document.createElement('span');
    chip.className = 'chip missable';
    chip.textContent = 'Missable';
    head.appendChild(chip);
  }
  if (g.story) {
    const chip = document.createElement('span');
    chip.className = 'chip story';
    chip.textContent = 'Story';
    head.appendChild(chip);
  }
  li.appendChild(head);

  if (hidden) {
    const p = document.createElement('p');
    p.className = 'hidden-story';
    p.textContent = 'Story details hidden until earned — check the box to reveal this trophy.';
    li.appendChild(p);
    return li;
  }

  const desc = document.createElement('p');
  desc.className = 'trophy-desc';
  desc.textContent = t.description;
  li.appendChild(desc);

  if (g.text) {
    const guide = document.createElement('p');
    guide.className = 'trophy-guide';
    guide.textContent = g.text;
    li.appendChild(guide);
  }
  if (g.missable && g.missable_note) {
    const note = document.createElement('p');
    note.className = 'missable-note';
    note.textContent = `Watch out: ${g.missable_note} (Missable flags are inferred, not playtested.)`;
    li.appendChild(note);
  }
  if (g.source) {
    const src = document.createElement('p');
    src.className = 'trophy-source';
    src.textContent = `Source: ${g.source}`;
    li.appendChild(src);
  }
  return li;
}

function renderList() {
  const list = $('list');
  list.replaceChildren();
  const shown = visibleTrophies();
  for (const t of shown) list.appendChild(trophyRow(t));
  $('showing').textContent = `Showing ${shown.length} of ${state.trophies.length} trophies`;
  $('empty-note').hidden = shown.length > 0;
}

function renderRoadmap() {
  const stepsEl = $('roadmap-steps');
  stepsEl.replaceChildren();
  state.roadmap.forEach((step, index) => {
    const earnedInStep = step.ids.filter((id) => state.earned.has(id)).length;
    const li = document.createElement('li');
    li.className = 'step' + (state.stepIds && state.stepIds.join(',') === step.ids.join(',') ? ' active' : '');
    li.tabIndex = 0;
    const title = document.createElement('h3');
    title.textContent = step.title;
    li.appendChild(title);
    const note = document.createElement('p');
    note.textContent = step.note;
    li.appendChild(note);
    const names = document.createElement('p');
    names.className = 'step-trophies';
    const byId = new Map(state.trophies.map((t) => [t.id, t]));
    names.textContent = step.ids.map((id) => (byId.get(id) || {}).name || `#${id}`).join(' · ');
    li.appendChild(names);
    const count = document.createElement('p');
    count.className = 'step-count';
    count.textContent = `${earnedInStep}/${step.ids.length} earned in this stage`;
    li.appendChild(count);
    const apply = () => {
      state.stepIds = state.stepIds && state.stepIds.join(',') === step.ids.join(',') ? null : step.ids.slice();
      renderAll();
      $('list').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    li.addEventListener('click', apply);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        apply();
      }
    });
    stepsEl.appendChild(li);
  });

  const box = $('missables-box');
  box.replaceChildren();
  const missables = state.trophies.filter((t) => (state.guide[String(t.id)] || {}).missable);
  for (const t of missables) {
    const g = state.guide[String(t.id)] || {};
    const li = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = t.name;
    li.appendChild(name);
    const note = document.createElement('span');
    note.textContent = g.missable_note || 'Can be missed — check before playing past it.';
    li.appendChild(note);
    box.appendChild(li);
  }
}

function renderAll() {
  renderProgress();
  renderList();
  renderRoadmap();
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportProgress() {
  download('leonida-platinum-progress.json', JSON.stringify({
    app: 'Leonida Platinum',
    exportedAt: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
  }, null, 2));
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const ids = Array.isArray(parsed) ? parsed : parsed.earned;
      if (!Array.isArray(ids)) throw new Error('no earned list');
      const known = new Set(state.trophies.map((t) => t.id));
      const next = new Set(ids.filter((n) => Number.isInteger(n) && known.has(n)));
      state.earned = next;
      saveEarned();
      renderAll();
    } catch (_) {
      alert('That file is not a Leonida Platinum progress export.');
    }
  };
  reader.readAsText(file);
}

function wireControls() {
  $('search').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderList();
  });
  document.querySelectorAll('.grade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.grade-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.grade = btn.dataset.grade;
      renderList();
    });
  });
  $('state-filter').addEventListener('change', (e) => {
    state.show = e.target.value;
    renderList();
  });
  $('missable-only').addEventListener('change', (e) => {
    state.missableOnly = e.target.checked;
    renderList();
  });
  const spoiler = $('spoiler-toggle');
  spoiler.checked = state.spoiler;
  spoiler.addEventListener('change', (e) => {
    state.spoiler = e.target.checked;
    localStorage.setItem(SPOILER_KEY, String(state.spoiler));
    renderList();
  });
  $('export-btn').addEventListener('click', exportProgress);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importProgress(file);
    e.target.value = '';
  });
  $('reset-btn').addEventListener('click', () => {
    if (window.confirm('Clear all earned trophies? This cannot be undone.')) {
      state.earned = new Set();
      saveEarned();
      renderAll();
    }
  });
  $('roadmap-btn').addEventListener('click', () => {
    $('roadmap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function applyQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const grade = params.get('grade');
  if (grade && ['all', 'platinum', 'gold', 'silver', 'bronze'].includes(grade)) {
    state.grade = grade;
    document.querySelectorAll('.grade-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.grade === grade);
    });
  }
  const scroll = Number.parseInt(params.get('scroll') || '', 10);
  if (Number.isFinite(scroll) && scroll > 0) {
    requestAnimationFrame(() => window.scrollTo(0, scroll));
  }
}

async function init() {
  state.earned = loadEarned();
  state.spoiler = loadSpoiler();
  const [trophyDoc, guideDoc] = await Promise.all([
    fetch('data/trophies.json').then((r) => r.json()),
    fetch('data/guide.json').then((r) => r.json()),
  ]);
  state.trophies = trophyDoc.trophies.slice().sort((a, b) => a.id - b.id);
  state.guide = guideDoc.trophies || {};
  state.roadmap = guideDoc.roadmap || [];
  wireControls();
  applyQueryParams();
  renderAll();
  // The list renders after the data loads, which moves everything below it
  // down the page — so a #hash in the URL lands in the wrong place on the
  // first paint. Re-apply the anchor once the page has its final shape.
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) target.scrollIntoView({ block: 'start' });
  }
  // Signal screenshot scenes that the page has painted.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

init();
