// ORB ARENA — app: UI, game flow, betting, sandbox, tournament, lab, forge, files.
import {
  ELEMENTS, ARCHETYPES, WEAPON_TYPES, MATERIALS, ARENA_SHAPES, FLOORS, BACKDROPS, HAZARDS, MODES, SANDBOX_TOOLS,
  STATUS_ICONS, EASY_CODE_HELP, EASY_CODE_EXAMPLES, EXAMPLE_FILE, buildCatalog, resolveStats,
} from './data.js';
import { parseEasyCode, buildRuleLine, EVENTS, ACTIONS } from './code.js';
import { Simulation } from './sim.js';
import { loadState, saveState, toShareCode, fromShareCode, saveFile, vibrate, copyText, isAndroid } from './storage.js';
import { Audio } from './audio.js';

let R = null;
let teamColor = () => null;
const audio = new Audio();
const CATALOG = buildCatalog();
const appEl = document.getElementById('app');
const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');

// ---------- state ----------
const DEFAULT_ROSTER = ['lightning-king', 'fire-giant', 'ice-ninja', 'void-duplicate', 'nature-healer', 'shadow-assassin', 'metal-tank', 'cosmic-summoner'];
const DEFAULTS = {
  roster: DEFAULT_ROSTER.map((id, i) => ({ id, team: 1 + (i % 2) })),
  mode: 'ffa',
  arena: { shape: 'circle', size: 20, floor: 'marble', backdrop: 'studio', gravity: 1, bounceMul: 1, frictionMul: 1, accelMul: 1, momentum: false, timeLimit: 180,
    hazards: Object.fromEntries(Object.keys(HAZARDS).map((k) => [k, false])) },
  custom: { balls: [], weapons: [] },
  settings: { quality: navigator.deviceMemory && navigator.deviceMemory <= 3 ? 'low' : 'high', numbers: true, hpBars: true, faces: true, trails: true, shake: true, sound: true, volume: 0.6, vibrate: true, recHud: true, compactStats: true, brightness: 0.7 },
  play: { bet: false, sandbox: true, cam: 'orbit', speed: 1, statsOpen: true },
  coins: 1000,
  spawnPick: 'random',
  labUnlimited: false,
};
function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(base)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], over[k]) : over[k];
  return out;
}
const S = merge(DEFAULTS, loadState());
if (!Array.isArray(S.roster)) S.roster = DEFAULTS.roster;
if (!S.custom || !Array.isArray(S.custom.balls)) S.custom = { balls: [], weapons: [] };
const persist = () => saveState(S);

let sim = null;
let phase = 'setup'; // setup | countdown | fight | ending | over
let paused = false;
let tool = 'camera';
let openTab = null;
let catalogOpen = false;
let catFilter = { q: '', el: 'all', arch: 'all' };
let recording = false;
let recStart = 0;
let tournament = null;
let bet = null;
let endT = 0;
let grabbing = false;
let focusId = null;
let lastHud = 0;
let lastFeed = 0;
const els = {};
let labDraft = newLabDraft();
let forgeDraft = newForgeDraft();
let builder = { event: 'lowhp', every: 5, cond: 'none', condValue: 50, action: 'shield', actionValue: 30, sayText: 'Hi!' };

// ---------- helpers ----------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat(3)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c && c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtTime = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nowSec = () => performance.now() / 1000;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = clamp(Math.round(r + amt * 255), 0, 255); g = clamp(Math.round(g + amt * 255), 0, 255); b = clamp(Math.round(b + amt * 255), 0, 255);
  return `rgb(${r},${g},${b})`;
}
function orbBg(def) {
  const c = def.color || (ELEMENTS[def.element] || ELEMENTS.fire).color;
  const mk = def.material && def.material !== 'auto' ? def.material : (ELEMENTS[def.element] || ELEMENTS.fire).mat;
  if (mk === 'chrome') return `radial-gradient(circle at 32% 28%, #fff 0%, ${shade(c, 0.3)} 14%, ${shade(c, -0.25)} 48%, ${shade(c, 0.15)} 70%, #050505 100%)`;
  if (mk === 'holo') return `radial-gradient(circle at 32% 28%, #fff 0%, transparent 18%), conic-gradient(from 30deg, ${c}, #ff7ad9, #7afcff, #fff27a, ${c})`;
  if (mk === 'lava') return `radial-gradient(circle at 40% 35%, #ffd27a 0%, ${c} 30%, #3a0a00 85%)`;
  if (mk === 'glass' || mk === 'crystal') return `radial-gradient(circle at 32% 28%, #fff 0%, ${shade(c, 0.35)} 20%, ${c}99 60%, ${shade(c, -0.3)} 100%)`;
  if (mk === 'gold') return `radial-gradient(circle at 32% 28%, #fff8d0 0%, #ffd34d 22%, ${shade('#c48a1a', 0)} 65%, #3a2200 100%)`;
  return `radial-gradient(circle at 32% 28%, #ffffff 0%, ${shade(c, 0.25)} 16%, ${c} 45%, ${shade(c, -0.45)} 100%)`;
}
function orb(def, size = 52, icon = true) {
  return h('div', { class: 'orb', style: { width: size + 'px', height: size + 'px', background: orbBg(def) } },
    icon ? h('span', { class: 'oi', style: { fontSize: Math.round(size * 0.3) + 'px' } }, (ARCHETYPES[def.archetype] || {}).icon || '') : null);
}

function allDefs() { return [...S.custom.balls, ...CATALOG]; }
function defById(id) { return S.custom.balls.find((b) => b.id === id) || CATALOG.find((b) => b.id === id) || null; }
function weaponMap() { return Object.fromEntries(S.custom.weapons.map((w) => [w.id, w])); }
function weaponName(key) { const w = S.custom.weapons.find((x) => x.id === key); return w ? w.name : (WEAPON_TYPES[key] || WEAPON_TYPES.none).name; }

function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast glass' }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function modal(title, body, actions = [], opts = {}) {
  closeModal();
  const close = () => { bg.remove(); if (opts.onClose) opts.onClose(); };
  const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg && !opts.locked) close(); } },
    h('div', { class: 'modal glass' },
      title ? h('h2', null, title) : null,
      body,
      actions.length ? h('div', { class: 'actions' }, actions.map((a) => h('button', { class: 'btn ' + (a.cls || ''), onclick: () => { if (a.keep !== true) close(); if (a.fn) a.fn(); } }, a.label))) : null));
  bg.id = 'modal';
  bg.closeModal = close;
  document.body.appendChild(bg);
  return close;
}
function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }

// ---------- simulation setup ----------
function fxHooks() {
  const base = R.fxHooks();
  const baseShake = base.shake;
  let lastVib = 0;
  return Object.assign(base, {
    sound: (n, v) => audio.play(n, v),
    shake: (a) => {
      if (S.settings.shake) baseShake(a);
      if (S.settings.vibrate && a > 0.45 && phase === 'fight' && performance.now() - lastVib > 120) { lastVib = performance.now(); vibrate(Math.round(15 + a * 25)); }
    },
  });
}

function makeSim(entries, mode) {
  const roster = entries.map((e) => ({ def: defById(e.id), team: e.team })).filter((e) => e.def);
  return new Simulation({ mode, arena: { ...S.arena }, roster, customWeapons: weaponMap(), wavePool: CATALOG, fx: fxHooks() });
}

let previewTimer = 0;
function rebuildPreview(now = false) {
  clearTimeout(previewTimer);
  const go = () => {
    if (phase !== 'setup' || !R) return;
    const mode = S.mode === 'tournament' ? 'ffa' : S.mode;
    const entries = S.mode === 'duel' ? S.roster.slice(0, 2) : S.roster;
    sim = makeSim(entries, mode);
    R.buildArena(sim, S.arena);
    R.setCameraMode('orbit');
    R.sync(sim, 0);
    updateTop();
  };
  if (now) go(); else previewTimer = setTimeout(go, 160);
}

// ---------- fight flow ----------
function startFight() {
  audio.init();
  audio.setVolume(S.settings.volume);
  audio.enabled = S.settings.sound;
  const need = S.mode === 'survival' ? 1 : 2;
  if (S.roster.length < need) { toast(`Add at least ${need} fighters first`); openTab = 'fighters'; renderApp(); return; }
  if (S.mode === 'tournament') {
    if (S.roster.length < 2) { toast('Tournament needs 2+ fighters'); return; }
    tournament = makeBracket(S.roster);
    showBracket(true);
    return;
  }
  if (S.play.bet && S.mode !== 'survival') { openBet(() => beginBattle(S.mode === 'duel' ? S.roster.slice(0, 2) : S.roster, S.mode)); return; }
  beginBattle(S.mode === 'duel' ? S.roster.slice(0, 2) : S.roster, S.mode);
}

function beginBattle(entries, mode) {
  closeModal();
  openTab = null;
  catalogOpen = false;
  sim = makeSim(entries, mode);
  R.buildArena(sim, S.arena);
  R.setCameraMode(S.play.cam);
  tool = 'camera';
  paused = false;
  focusId = null;
  phase = 'countdown';
  renderApp();
  const steps = ['3', '2', '1', 'FIGHT!'];
  steps.forEach((s, i) => setTimeout(() => {
    if (phase !== 'countdown') return;
    const el = h('div', { class: 'countdown' }, s);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
    audio.play(i === 3 ? 'start' : 'click', 1);
    if (i === 3) {
      phase = 'fight';
      renderApp();
    }
  }, i * 650));
}

function endFightEarly() {
  if (!sim) return;
  modal('End this fight?', h('p', { class: 'hint' }, 'The current battle will stop.'), [
    { label: 'Keep fighting' },
    { label: 'End fight', cls: 'danger', fn: () => { tournament = null; bet = null; backToSetup(); } },
  ]);
}

function backToSetup() {
  closeModal();
  if (recording) toggleRecord();
  phase = 'setup';
  paused = false;
  tool = 'camera';
  rebuildPreview(true);
  renderApp();
}

function onSimOver() {
  phase = 'ending';
  endT = 1.6;
  renderApp();
}

function finishResults() {
  phase = 'over';
  renderApp();
  if (tournament) { recordTournamentResult(); return; }
  showResults();
}

// ---------- betting ----------
function contenders(entries, mode) {
  if (mode === 'teams') {
    const teams = [...new Set(entries.map((e) => e.team || 1))].sort();
    return teams.map((t) => ({ key: t, label: `Team ${t}`, color: teamColor(t) || '#fff', team: t }));
  }
  if (mode === 'boss') return [{ key: 1, label: 'Boss ' + (defById(entries[0].id) || {}).name, team: 1, def: defById(entries[0].id) }, { key: 2, label: 'Everyone else', team: 2 }];
  return entries.map((e, i) => ({ key: 100 + i, label: (defById(e.id) || {}).name, team: 100 + i, def: defById(e.id) }));
}

function openBet(onGo) {
  const entries = S.mode === 'duel' ? S.roster.slice(0, 2) : S.roster;
  const list = contenders(entries, S.mode);
  const odds = Math.max(1.5, +(list.length * 0.9).toFixed(1));
  let pick = null;
  let stake = Math.min(100, S.coins);
  const stakeLabel = h('b', null, stake);
  const items = h('div', { class: 'chips' });
  const draw = () => {
    items.innerHTML = '';
    for (const c of list) {
      items.append(h('button', { class: 'btn sm' + (pick === c.key ? ' on' : ''), onclick: () => { pick = c.key; draw(); } },
        c.def ? orb(c.def, 18, false) : h('span', { class: 'dot', style: { background: c.color } }), c.label));
    }
  };
  draw();
  const body = h('div', null,
    h('p', { class: 'hint' }, `Pick the winner. Payout ×${odds}. You have 🪙 ${S.coins}.`),
    items,
    h('div', { class: 'field' }, h('label', null, 'Stake', stakeLabel),
      h('input', { type: 'range', min: 0, max: Math.max(0, S.coins), step: 10, value: stake, oninput: (e) => { stake = +e.target.value; stakeLabel.textContent = stake; } })));
  modal('🎲 Predict & Bet', body, [
    { label: 'Skip', fn: () => { bet = null; onGo(); } },
    { label: 'Place bet', cls: 'primary', keep: true, fn: () => {
      if (pick === null) { toast('Pick a fighter first'); return; }
      if (stake > 0) { S.coins -= stake; persist(); }
      bet = { pick, stake, odds, label: list.find((c) => c.key === pick).label };
      closeModal();
      onGo();
    } },
  ]);
}

// ---------- tournament ----------
function makeBracket(roster) {
  const players = roster.map((e) => ({ ...e })).sort(() => Math.random() - 0.5);
  let size = 1;
  while (size < players.length) size *= 2;
  while (players.length < size) players.push(null);
  const round = [];
  for (let i = 0; i < size; i += 2) round.push({ a: players[i], b: players[i + 1], w: null });
  return { rounds: [round], champion: null };
}

function advanceByes(t) {
  for (;;) {
    const round = t.rounds[t.rounds.length - 1];
    for (const m of round) if (!m.w && (!m.a || !m.b)) m.w = m.a || m.b || null;
    if (round.every((m) => m.w !== null || (!m.a && !m.b))) {
      const winners = round.map((m) => m.w).filter(Boolean);
      if (winners.length <= 1) { t.champion = winners[0] || null; return null; }
      const next = [];
      for (let i = 0; i < winners.length; i += 2) next.push({ a: winners[i], b: winners[i + 1] || null, w: null });
      t.rounds.push(next);
      continue;
    }
    return round.find((m) => !m.w);
  }
}

function showBracket(first = false) {
  const t = tournament;
  const cur = advanceByes(t);
  const cols = h('div', { class: 'bracket' }, t.rounds.map((round, ri) => h('div', { class: 'bcol' },
    h('div', { class: 'section' }, ri === t.rounds.length - 1 && round.length === 1 ? 'Final' : `Round ${ri + 1}`),
    round.map((m) => h('div', { class: 'bm' + (m === cur ? ' cur' : '') },
      [m.a, m.b].map((p) => {
        const d = p && defById(p.id);
        return h('div', { class: m.w ? (m.w === p ? 'w' : 'l') : '' }, d ? orb(d, 16, false) : null, d ? d.name : '— bye —');
      }))))));
  if (t.champion) {
    const d = defById(t.champion.id);
    modal('🏆 Tournament Champion', h('div', null, h('div', { class: 'winner' }, h('div', { class: 'wt' }, 'CHAMPION'), d ? orb(d, 86) : null, h('div', { class: 'wn' }, d ? d.name : '?')), cols), [
      { label: 'New tournament', fn: () => { tournament = makeBracket(S.roster); showBracket(true); } },
      { label: 'Back to setup', cls: 'primary', fn: () => { tournament = null; backToSetup(); } },
    ], { locked: true });
    audio.play('win', 1);
    return;
  }
  const a = defById(cur.a.id);
  const b = defById(cur.b.id);
  let auto = first ? 0 : 4;
  const label = h('span', null, auto ? `Next match in ${auto}…` : '');
  const body = h('div', null, h('p', { class: 'hint' }, 'Next: ', h('b', null, a.name), ' vs ', h('b', null, b.name)), label, cols);
  const go = () => { clearInterval(iv); beginBattle([{ ...cur.a, team: 1 }, { ...cur.b, team: 2 }], 'duel'); tournament.cur = cur; };
  const iv = auto ? setInterval(() => { auto--; label.textContent = `Next match in ${auto}…`; if (auto <= 0) { closeModal(); go(); } }, 1000) : 0;
  modal('🏆 Tournament', body, [
    { label: 'Stop', fn: () => { clearInterval(iv); tournament = null; backToSetup(); } },
    { label: 'Fight ▶', cls: 'primary', fn: go },
  ], { locked: true, onClose: () => clearInterval(iv) });
}

function recordTournamentResult() {
  const m = tournament.cur;
  if (!m) return;
  let w = sim.winnerTeam === 100 ? m.a : sim.winnerTeam === 101 ? m.b : null;
  if (!w) w = Math.random() < 0.5 ? m.a : m.b;
  m.w = w;
  showBracket(false);
}

// ---------- results ----------
function showResults() {
  const balls = sim.balls.filter((b) => !b.isMinion);
  const wb = sim.winnerBall;
  const mvp = sim.mvp();
  let title = 'Battle Over';
  let winnerBlock;
  if (S.mode === 'survival') {
    title = '🧟 Survival Over';
    winnerBlock = h('div', { class: 'winner' }, h('div', { class: 'wt' }, 'YOU SURVIVED'), h('div', { class: 'wn' }, `${Math.max(0, sim.wave - 1)} waves`));
  } else if (wb) {
    const teamLbl = S.mode === 'teams' ? `TEAM ${sim.winnerTeam} WINS` : S.mode === 'boss' ? (sim.winnerTeam === 1 ? 'THE BOSS WINS' : 'THE HEROES WIN') : 'WINNER';
    winnerBlock = h('div', { class: 'winner' }, h('div', { class: 'wt' }, teamLbl), orb(wb.def, 86), h('div', { class: 'wn' }, wb.name));
  } else winnerBlock = h('div', { class: 'winner' }, h('div', { class: 'wn' }, 'Draw!'));
  let betLine = null;
  if (bet) {
    const won = bet.pick === sim.winnerTeam;
    const pay = won ? Math.round(bet.stake * bet.odds) : 0;
    if (pay) { S.coins += pay; persist(); }
    betLine = h('p', { class: won ? 'ok' : 'err', style: { textAlign: 'center', fontWeight: 800 } }, won ? `🎉 Your bet on ${bet.label} won 🪙 ${pay}!` : `Your bet on ${bet.label} lost 🪙 ${bet.stake}.`);
    bet = null;
  }
  const rows = balls.slice().sort((p, q) => q.stats.dealt - p.stats.dealt).slice(0, 30);
  const table = h('table', { class: 'res' },
    h('tr', null, ['Fighter', 'DMG', 'TAKEN', 'HEAL', 'PEAK DPS', 'K'].map((x) => h('th', null, x))),
    rows.map((b) => h('tr', null,
      h('td', null, h('span', { class: 'sname' }, orb(b.def, 14, false), h('span', { class: 'n' }, (b === mvp ? '⭐ ' : '') + b.name))),
      h('td', null, Math.round(b.stats.dealt)), h('td', null, Math.round(b.stats.taken)), h('td', null, Math.round(b.stats.healed)),
      h('td', null, Math.round(b.stats.peakDps)), h('td', null, b.stats.kills))));
  const chart = h('canvas', { class: 'chart' });
  const body = h('div', null, winnerBlock, betLine,
    mvp ? h('p', { class: 'hint', style: { textAlign: 'center' } }, `⭐ MVP: ${mvp.name} · ${Math.round(mvp.stats.dealt)} damage · ${fmtTime(sim.time)} fight`) : null,
    h('div', { class: 'section' }, 'Health over time', h('span', { class: 'grow' })), chart,
    h('div', { class: 'section' }, 'Stats', h('span', { class: 'grow' })), table);
  modal(title, body, [
    { label: '⚙️ Setup', fn: backToSetup },
    { label: '🔁 Rematch', cls: 'primary', fn: () => { phase = 'setup'; startFight(); } },
  ], { locked: true });
  requestAnimationFrame(() => drawChart(chart, rows.slice(0, 10)));
}

function drawChart(c, balls) {
  const w = c.clientWidth;
  const hh = c.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  c.width = w * dpr; c.height = hh * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (hh * i) / 4); g.lineTo(w, (hh * i) / 4); g.stroke(); }
  const maxLen = Math.max(2, ...balls.map((b) => b.hpHist.length));
  for (const b of balls) {
    g.strokeStyle = b.def.color || '#fff';
    g.lineWidth = 2;
    g.beginPath();
    b.hpHist.forEach((v, i) => { const x = (i / (maxLen - 1)) * w; const y = 6 + (1 - v) * (hh - 12); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
}

// ---------- recording ----------
async function toggleRecord() {
  if (!R) return;
  if (!recording) {
    try {
      audio.init();
      R.startRecording(S.settings.sound ? audio.stream : null, { hud: S.settings.recHud });
      recording = true;
      recStart = performance.now();
      toast('⏺ Recording started');
    } catch (e) { toast(e.message || 'Recording not supported'); }
  } else {
    recording = false;
    const blob = await R.stopRecording();
    if (!blob || !blob.size) { toast('Nothing recorded'); renderApp(); return; }
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const name = `orb-arena-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${ext}`;
    if (isAndroid()) {
      try { const where = await saveFile(name, blob); toast(`🎬 Video saved to ${where}`, 3500); } catch (e) { toast('Could not save video'); }
    } else {
      const url = URL.createObjectURL(blob);
      modal('🎬 Your recording', h('div', null,
        h('video', { src: url, controls: true, playsinline: true, style: { width: '100%', borderRadius: '14px', background: '#000' } }),
        h('p', { class: 'hint' }, `${(blob.size / 1048576).toFixed(1)} MB · ${ext.toUpperCase()}. In the Android app videos save straight to your Downloads folder.`)),
      [{ label: 'Close' }, { label: '💾 Save', cls: 'primary', keep: true, fn: async () => { await saveFile(name, blob); toast('Saved (if your browser allows downloads)'); } }]);
    }
  }
  renderApp();
}

// ---------- UI: top bar / stats / dock ----------
function topbar() {
  const recBtn = h('button', { class: 'btn icon' + (recording ? ' rec-on' : ''), title: 'Record video', onclick: toggleRecord }, recording ? '⏹' : '⏺');
  els.topc = h('div', { class: 'top-center' });
  return h('div', { class: 'topbar glass' },
    h('div', { class: 'logo' }, 'ORB ARENA'),
    els.topc,
    h('div', { class: 'coins', title: 'Coins for betting' }, '🪙 ' + S.coins),
    recBtn);
}

function updateTop() {
  if (!els.topc) return;
  if (phase === 'setup') {
    els.topc.textContent = `${S.roster.length} fighters · ${MODES[S.mode].icon} ${MODES[S.mode].name}`;
  } else if (sim) {
    const alive = sim.balls.filter((b) => b.alive && !b.isMinion).length;
    let t = `${paused ? '⏸ ' : ''}⏱ ${fmtTime(sim.time)} · ${alive} alive`;
    if (S.arena.timeLimit && S.mode !== 'survival') t += ` · ${fmtTime(Math.max(0, S.arena.timeLimit - sim.time))} left`;
    if (S.mode === 'survival') t += ` · Wave ${sim.wave}`;
    if (recording) t = `🔴 ${fmtTime((performance.now() - recStart) / 1000)} · ` + t;
    els.topc.textContent = t;
  }
}

function statsPanel() {
  const body = h('div', { class: 'stats-body' });
  body.addEventListener('click', (e) => {
    const row = e.target.closest('.srow');
    if (!row) return;
    const id = +row.dataset.id;
    const b = sim && sim.balls.find((x) => x.id === id);
    if (!b) return;
    focusId = id;
    S.play.cam = 'follow';
    R.camFocus = b;
    R.setCameraMode('follow');
    renderDock();
    updateStats(true);
  });
  els.statsBody = body;
  const panel = h('div', { class: 'stats glass' + (S.play.statsOpen ? '' : ' collapsed') + (S.settings.compactStats ? ' compact' : '') },
    h('div', { class: 'stats-head', onclick: () => { S.play.statsOpen = !S.play.statsOpen; persist(); panel.classList.toggle('collapsed', !S.play.statsOpen); } },
      h('span', null, '📊 LIVE STATS'), h('span', { class: 'grow' }), h('span', null, S.play.statsOpen ? '▾' : '▸')),
    h('div', { class: 'stats-cols' }, h('span', null, 'FIGHTER / HP'), h('span', { style: { textAlign: 'right' } }, 'DPS'), h('span', { style: { textAlign: 'right' } }, 'DMG'), h('span', { style: { textAlign: 'right' } }, 'K')),
    body);
  return panel;
}

function updateStats(force = false) {
  if (!els.statsBody || !sim || !S.play.statsOpen) return;
  const balls = sim.balls.filter((b) => !b.isMinion);
  balls.sort((p, q) => (q.alive - p.alive) || (q.hp / q.maxHp - p.hp / p.maxHp));
  let html = '';
  for (const b of balls) {
    const frac = Math.max(0, b.hp / b.maxHp);
    const icons = Object.keys(b.st).map((k) => STATUS_ICONS[k] || '').join('');
    const tc = teamColor(b.team);
    const showTeam = tc && S.mode !== 'ffa' && S.mode !== 'royale' && S.mode !== 'duel';
    if (b._shadowHp === undefined || frac > b._shadowHp) b._shadowHp = frac;
    else b._shadowHp += (frac - b._shadowHp) * 0.25;
    html += `<div class="srow${b.alive ? '' : ' dead'}${b.id === focusId ? ' focus' : ''}" data-id="${b.id}" style="border-left-color:${showTeam ? tc : 'transparent'}">
      <div><div class="sname"><span class="dot" style="background:${b.color}"></span><span class="n">${esc(b.name)}</span><span class="stat-icons">${icons}</span></div>
      <div class="hpbar"><b style="width:${(b._shadowHp * 100).toFixed(1)}%"></b><i style="width:${(frac * 100).toFixed(1)}%;background:hsl(${(frac * 120) | 0},85%,50%)"></i></div>
      <div class="ssub"><span>${Math.ceil(Math.max(0, b.hp))}/${b.maxHp}</span></div></div>
      <div class="snum">${b.stats.dps.toFixed(0)}</div><div class="snum">${b.stats.dealt >= 1000 ? (b.stats.dealt / 1000).toFixed(1) + 'k' : Math.round(b.stats.dealt)}</div><div class="snum">${b.stats.kills}</div></div>`;
  }
  els.statsBody.innerHTML = html;
  void force;
}

function updateFeed() {
  if (!els.kf || !sim) return;
  const recent = sim.killFeed.filter((k) => sim.time - k.t < 6).slice(-5);
  els.kf.innerHTML = recent.map((k) => `<div class="kf"><span style="color:${k.color}">${esc(k.killer)}</span> 💥 ${esc(k.victim)}</div>`).join('');
}

const PHYSICS_PRESETS = {
  normal: { name: '🌍 Normal', values: { gravity: 1, bounceMul: 1, frictionMul: 1, accelMul: 1, momentum: false } },
  zerog: { name: '🚀 Zero-G Perpetual', values: { gravity: 0, bounceMul: 1.4, frictionMul: 0, accelMul: 2, momentum: true } },
  pinball: { name: '🎰 Pinball', values: { gravity: 1, bounceMul: 1.4, frictionMul: 0.1, accelMul: 1.5, momentum: true }, hazards: { bumpers: true } },
  moon: { name: '🌙 Moon', values: { gravity: 0.3, bounceMul: 1.15, frictionMul: 0.6, accelMul: 1, momentum: false } },
  hyper: { name: '⚡ Hyper', values: { gravity: 1, bounceMul: 1.1, frictionMul: 1, accelMul: 3, momentum: false } },
  heavy: { name: '🪨 Heavy', values: { gravity: 2, bounceMul: 0.6, frictionMul: 1.6, accelMul: 0.8, momentum: false } },
};
function physicsPresetOn(p) { return Object.entries(p.values).every(([k, v]) => (S.arena[k] ?? (k === 'momentum' ? false : 1)) === v); }

const CAMS = { orbit: '🎥 Orbit', auto: '🔄 Spin', follow: '🎯 Follow', cinematic: '🎬 Cinema', top: '🗺️ Top' };
const SPEEDS = [0.25, 0.5, 1, 2, 4];

function renderDock() {
  const wrap = els.dockWrap;
  if (!wrap) return;
  wrap.innerHTML = '';
  if (phase === 'setup') {
    const tabs = [['fighters', '🔵', 'Fighters'], ['arena', '🏟️', 'Arena'], ['mode', '🎮', 'Mode'], ['lab', '🧪', 'Ball Lab'], ['forge', '⚒️', 'Forge'], ['code', '🧩', 'Code'], ['files', '📁', 'Files'], ['settings', '⚙️', 'Settings']];
    wrap.append(h('div', { class: 'tabs glass' }, tabs.map(([k, ic, lbl]) => h('div', { class: 'tab' + (openTab === k ? ' active' : ''), onclick: () => { openTab = openTab === k ? null : k; catalogOpen = false; audio.init(); renderApp(); } }, h('span', { class: 'ti' }, ic), lbl))));
    wrap.append(h('div', { class: 'dock glass' },
      h('button', { class: 'btn', onclick: () => { S.roster = randomRoster(8); persist(); rebuildPreview(); renderApp(); } }, '🎲'),
      h('button', { class: 'btn primary fight-btn', onclick: startFight }, '⚔️ FIGHT'),
      h('button', { class: 'btn', onclick: () => { R.setCameraMode(R.camMode === 'auto' ? 'orbit' : 'auto'); } }, '🔄')));
    return;
  }
  if (S.play.sandbox && (phase === 'fight' || phase === 'countdown')) {
    const tb = h('div', { class: 'toolbar glass' }, Object.entries(SANDBOX_TOOLS).map(([k, t]) => h('div', { class: 'tool' + (tool === k ? ' on' : ''), onclick: () => setTool(k) }, t.icon, h('small', null, t.name.split(' ')[0]))));
    if (tool === 'spawn') {
      const sel = h('select', { style: { width: '150px', flex: 'none', alignSelf: 'center' }, onchange: (e) => { S.spawnPick = e.target.value; persist(); } },
        h('option', { value: 'random', selected: S.spawnPick === 'random' }, '🎲 Random'),
        allDefs().map((d) => h('option', { value: d.id, selected: S.spawnPick === d.id }, d.name)));
      tb.append(sel);
    }
    wrap.append(tb);
  }
  wrap.append(h('div', { class: 'dock glass' },
    h('button', { class: 'btn icon', onclick: () => { paused = !paused; renderDock(); updateTop(); } }, paused ? '▶️' : '⏸'),
    h('button', { class: 'btn sm', onclick: () => { const i = SPEEDS.indexOf(S.play.speed); S.play.speed = SPEEDS[(i + 1) % SPEEDS.length]; persist(); renderDock(); } }, `⏩ ${S.play.speed}x`),
    h('button', { class: 'btn sm', onclick: () => { const ks = Object.keys(CAMS); S.play.cam = ks[(ks.indexOf(S.play.cam) + 1) % ks.length]; persist(); if (S.play.cam !== 'follow') focusId = null; R.camFocus = null; R.setCameraMode(S.play.cam); if (tool !== 'camera') R.controls.enabled = false; renderDock(); } }, CAMS[S.play.cam]),
    h('div', { class: 'sep' }),
    h('button', { class: 'btn sm danger', onclick: endFightEarly }, '⏹ End')));
}

function setTool(k) {
  tool = k;
  if (R) {
    if (k === 'camera') R.setCameraMode(S.play.cam);
    else R.controls.enabled = false;
  }
  renderDock();
}

function randomRoster(n) {
  const pool = allDefs();
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: pool[(Math.random() * pool.length) | 0].id, team: 1 + (i % 2) });
  return out;
}

// ---------- sheet ----------
function renderApp() {
  appEl.innerHTML = '';
  els.statsBody = null;
  appEl.append(topbar());
  if (phase !== 'setup') {
    appEl.append(statsPanel());
    els.kf = h('div', { class: 'killfeed' });
    appEl.append(els.kf);
  } else els.kf = null;
  els.dockWrap = h('div', { class: 'dock-wrap' });
  appEl.append(els.dockWrap);
  renderDock();
  if (phase === 'setup' && openTab) appEl.append(renderSheet());
  updateTop();
  updateStats(true);
  document.body.classList.toggle('lowfx', S.settings.quality === 'low');
}

let sheetScroll = {};
function renderSheet() {
  const titles = { fighters: '🔵 Fighters', arena: '🏟️ Arena', mode: '🎮 Mode & Play', lab: '🧪 Ball Lab', forge: '⚒️ Weapon Forge', code: '🧩 Easy Code', files: '📁 Import / Export', settings: '⚙️ Settings' };
  const body = h('div', { class: 'sheet-body' });
  const builders = { fighters: tabFighters, arena: tabArena, mode: tabMode, lab: tabLab, forge: tabForge, code: tabCode, files: tabFiles, settings: tabSettings };
  body.append(builders[openTab]());
  const sheet = h('div', { class: 'sheet glass', id: 'sheet' },
    h('div', { class: 'sheet-head' }, h('h2', null, catalogOpen && openTab === 'fighters' ? '📚 Add Fighters' : titles[openTab]),
      catalogOpen && openTab === 'fighters' ? h('button', { class: 'btn sm', onclick: () => { catalogOpen = false; refreshSheet(); } }, '← Roster') : null,
      h('button', { class: 'btn icon', style: { width: '34px', height: '34px', fontSize: '14px' }, onclick: () => { openTab = null; renderApp(); } }, '✕')),
    body);
  const key = openTab + (catalogOpen ? '-cat' : '');
  requestAnimationFrame(() => { body.scrollTop = sheetScroll[key] || 0; });
  body.addEventListener('scroll', () => { sheetScroll[key] = body.scrollTop; });
  return sheet;
}
function refreshSheet() {
  const old = document.getElementById('sheet');
  if (!old || !openTab) { renderApp(); return; }
  old.replaceWith(renderSheet());
  renderDock();
  updateTop();
}

const section = (t, ...extra) => h('div', { class: 'section' }, t, h('span', { class: 'grow' }), ...extra);
function chip(label, on, fn) { return h('button', { class: 'btn sm' + (on ? ' on' : ''), onclick: fn }, label); }
function toggle(label, on, fn) { return h('div', { class: 'toggle' + (on ? ' on' : ''), onclick: fn }, label, h('span', { class: 'sw' })); }
function slider(label, value, min, max, step, fmt, onInput, onChange) {
  const out = h('b', null, fmt(value));
  return h('div', { class: 'field' }, h('label', null, label, out),
    h('input', { type: 'range', min, max, step, value, oninput: (e) => { const v = +e.target.value; out.textContent = fmt(v); onInput(v); }, onchange: (e) => { if (onChange) onChange(+e.target.value); } }));
}

// ---------- tab: fighters ----------
function tabFighters() {
  if (catalogOpen) return catalogView();
  const box = h('div');
  const teamsMode = S.mode === 'teams';
  box.append(h('div', { class: 'row' },
    h('button', { class: 'btn primary', onclick: () => { catalogOpen = true; refreshSheet(); } }, '➕ Add fighters'),
    h('button', { class: 'btn sm', onclick: () => { S.roster = randomRoster(6); persist(); rebuildPreview(); refreshSheet(); } }, '🎲 6'),
    h('button', { class: 'btn sm', onclick: () => { S.roster = randomRoster(12); persist(); rebuildPreview(); refreshSheet(); } }, '🎲 12'),
    h('button', { class: 'btn sm', onclick: () => { S.roster = randomRoster(24); persist(); rebuildPreview(); refreshSheet(); } }, '🎲 24'),
    h('button', { class: 'btn sm', onclick: () => { S.roster = []; persist(); rebuildPreview(); refreshSheet(); } }, '🗑️ Clear')));
  box.append(section(`Roster (${S.roster.length}/60)`));
  if (teamsMode) box.append(h('p', { class: 'hint' }, 'Teams mode: tap a team badge to switch team (1–4).'));
  if (S.mode === 'boss' && S.roster[0]) box.append(h('p', { class: 'hint' }, `👹 Boss: ${(defById(S.roster[0].id) || {}).name}. Use ⬆ to make another fighter the boss.`));
  if (S.mode === 'duel') box.append(h('p', { class: 'hint' }, '⚔️ 1v1 uses the first two fighters.'));
  const grid = h('div', { class: 'roster' });
  S.roster.forEach((e, i) => {
    const d = defById(e.id);
    if (!d) return;
    const tc = teamColor(e.team) || '#888';
    grid.append(h('div', { class: 'rchip' },
      orb(d, 26, false),
      h('span', { class: 'n' }, d.name),
      teamsMode ? h('span', { class: 'team-badge', style: { background: tc + '33', color: tc, border: `1px solid ${tc}` }, onclick: () => { e.team = (e.team % 4) + 1; persist(); rebuildPreview(); refreshSheet(); } }, 'T' + e.team) : null,
      i > 0 ? h('span', { class: 'x', title: 'Move to top', onclick: () => { S.roster.splice(i, 1); S.roster.unshift(e); persist(); rebuildPreview(); refreshSheet(); } }, '⬆') : null,
      h('span', { class: 'x', title: 'Duplicate', onclick: () => { if (S.roster.length < 60) { S.roster.splice(i + 1, 0, { ...e }); persist(); rebuildPreview(); refreshSheet(); } } }, '⧉'),
      h('span', { class: 'x', title: 'Remove', onclick: () => { S.roster.splice(i, 1); persist(); rebuildPreview(); refreshSheet(); } }, '✕')));
  });
  if (!S.roster.length) grid.append(h('p', { class: 'hint' }, 'No fighters yet. Tap “Add fighters”.'));
  box.append(grid);
  return box;
}

function catalogView() {
  const box = h('div');
  const list = h('div', { class: 'catalog' });
  const draw = () => {
    list.innerHTML = '';
    const q = catFilter.q.toLowerCase();
    const defs = allDefs().filter((d) => (catFilter.el === 'all' || d.element === catFilter.el) && (catFilter.arch === 'all' || d.archetype === catFilter.arch) && (!q || d.name.toLowerCase().includes(q)));
    const counts = {};
    for (const e of S.roster) counts[e.id] = (counts[e.id] || 0) + 1;
    for (const d of defs.slice(0, 300)) {
      const s = resolveStats(d);
      list.append(h('div', { class: 'card', onclick: () => addToRoster(d, list, draw) },
        counts[d.id] ? h('span', { class: 'count' }, '×' + counts[d.id]) : null,
        h('span', { class: 'info', onclick: (ev) => { ev.stopPropagation(); ballInfo(d); } }, 'ⓘ'),
        orb(d, 52),
        h('div', { class: 'cn' }, (d.builtin ? '' : '★ ') + d.name),
        h('div', { class: 'cs' }, `❤${s.hp} ⚔${s.atk} 💨${s.spd}`)));
    }
    if (!defs.length) list.append(h('p', { class: 'hint' }, 'Nothing matches.'));
  };
  box.append(h('input', { type: 'text', placeholder: `Search ${allDefs().length} fighters…`, value: catFilter.q, oninput: (e) => { catFilter.q = e.target.value; draw(); } }));
  box.append(h('div', { class: 'chips', style: { marginTop: '8px' } },
    chip('All', catFilter.el === 'all', () => { catFilter.el = 'all'; refreshSheet(); }),
    Object.entries(ELEMENTS).map(([k, e]) => chip(e.icon, catFilter.el === k, () => { catFilter.el = k; refreshSheet(); }))));
  box.append(h('div', { class: 'row', style: { marginTop: '8px' } },
    h('select', { onchange: (e) => { catFilter.arch = e.target.value; draw(); } },
      h('option', { value: 'all' }, 'All archetypes'),
      Object.entries(ARCHETYPES).map(([k, a]) => h('option', { value: k, selected: catFilter.arch === k }, `${a.icon} ${a.name}`)))));
  box.append(h('p', { class: 'hint' }, 'Tap to add · ⓘ for powers & details · ★ = your custom balls'));
  box.append(list);
  draw();
  return box;
}

function addToRoster(d, list, draw) {
  if (S.roster.length >= 60) { toast('Max 60 fighters'); return; }
  S.roster.push({ id: d.id, team: 1 + (S.roster.length % 2) });
  persist();
  audio.init();
  audio.play('click');
  toast(`+ ${d.name}`, 900);
  rebuildPreview();
  draw();
  updateTop();
}

function ballInfo(d) {
  const s = resolveStats(d);
  const e = ELEMENTS[d.element];
  const a = ARCHETYPES[d.archetype];
  const parsed = parseEasyCode(d.rules || '');
  const body = h('div', null,
    h('div', { class: 'row' }, orb(d, 70), h('div', { class: 'grow' }, h('div', { style: { fontSize: '20px', fontWeight: 900 } }, d.name), h('div', { class: 'hint' }, `${e.icon} ${e.name} · ${a.icon} ${a.name} · ${MATERIALS[d.material || 'auto']}`))),
    h('div', { class: 'grid2', style: { marginTop: '10px' } },
      ...[['❤ HP', s.hp], ['⚔ Attack', s.atk], ['🛡 Defence', s.def], ['💨 Speed', s.spd], ['⚖ Mass', s.mass], ['🎯 Crit', Math.round(s.crit * 100) + '%']].map(([k, v]) => h('div', { class: 'list-item', style: { margin: 0 } }, h('span', { class: 'grow s' }, k), h('b', null, v)))),
    section('Powers'),
    h('p', { class: 'hint' }, h('b', null, `${e.icon} ${e.power}: `), e.powerDesc, ' ', e.hitDesc),
    h('p', { class: 'hint' }, h('b', null, `${a.icon} ${a.name}: `), a.desc),
    h('p', { class: 'hint' }, h('b', null, '🗡 Weapon: '), weaponName(d.weapon)),
    d.rules ? h('div', null, section('Easy code'), h('pre', { class: 'code' }, d.rules), parsed.errors.length ? h('div', { class: 'err' }, parsed.errors.map((x) => `Line ${x.line}: ${x.msg}`).join(' · ')) : null) : null);
  modal(null, body, [
    { label: '📋 Share code', fn: () => shareBall(d) },
    { label: '🧪 Edit copy', fn: () => { labDraft = { ...JSON.parse(JSON.stringify(d)), id: d.builtin ? null : d.id, name: d.builtin ? d.name + ' II' : d.name, builtin: false }; if (!labDraft.stats) labDraft.stats = { hp: 1, atk: 1, def: 1, spd: 1, mass: 1 }; openTab = 'lab'; catalogOpen = false; renderApp(); } },
    { label: '➕ Add', cls: 'primary', fn: () => { if (S.roster.length < 60) { S.roster.push({ id: d.id, team: 1 + (S.roster.length % 2) }); persist(); rebuildPreview(); toast(`+ ${d.name}`); if (catalogOpen) refreshSheet(); } } },
  ]);
}

function shareBall(d) {
  const ball = { ...d };
  delete ball.builtin;
  const payload = { type: 'ball', ball };
  const w = S.custom.weapons.find((x) => x.id === d.weapon);
  if (w) payload.weapon = w;
  const code = toShareCode(payload);
  showCode(`Share “${d.name}”`, code, 'Anyone can paste this code in Files → Import to get this ball.');
}

function showCode(title, code, hint) {
  modal(title, h('div', null, h('p', { class: 'hint' }, hint), h('textarea', { rows: 6, value: code, readonly: true, onclick: (e) => e.target.select() })), [
    { label: 'Close' },
    { label: '📋 Copy', cls: 'primary', keep: true, fn: async () => { toast((await copyText(code)) ? 'Copied!' : 'Select the text and copy it'); } },
  ]);
}

// ---------- tab: arena ----------
function tabArena() {
  const A = S.arena;
  const set = (fn, rebuild = true) => { fn(); persist(); if (rebuild) rebuildPreview(); refreshSheet(); };
  return h('div', null,
    section('Ring shape'),
    h('div', { class: 'chips' }, Object.entries(ARENA_SHAPES).map(([k, s]) => chip(`${s.icon} ${s.name}`, A.shape === k, () => set(() => { A.shape = k; })))),
    slider('Ring size', A.size, 12, 36, 1, (v) => v + 'm', (v) => { A.size = v; persist(); }, () => rebuildPreview()),
    section('Floor'),
    h('div', { class: 'chips' }, Object.entries(FLOORS).map(([k, f]) => chip(f.name, A.floor === k, () => set(() => { A.floor = k; })))),
    section('Background'),
    h('div', { class: 'chips' }, Object.entries(BACKDROPS).map(([k, b]) => chip(b.name, A.backdrop === k, () => set(() => { A.backdrop = k; })))),
    section('Hazards'),
    h('div', { class: 'toggles' }, Object.entries(HAZARDS).map(([k, z]) => toggle(`${z.icon} ${z.name}`, !!A.hazards[k], () => set(() => { A.hazards[k] = !A.hazards[k]; })))),
    section('Physics'),
    h('div', { class: 'chips' }, Object.entries(PHYSICS_PRESETS).map(([k, p]) => chip(p.name, physicsPresetOn(p), () => set(() => { Object.assign(A, p.values); if (p.hazards) Object.assign(A.hazards, p.hazards); })))),
    h('p', { class: 'hint' }, 'Zero-G Perpetual = no gravity, no friction, 100% bounce: balls never lose speed.'),
    toggle('♾️ Keep momentum (no speed loss)', !!A.momentum, () => set(() => { A.momentum = !A.momentum; })),
    slider('Acceleration', A.accelMul ?? 1, 0.3, 3, 0.1, (v) => v.toFixed(1) + 'x', (v) => { A.accelMul = v; persist(); }, () => rebuildPreview()),
    slider('Gravity', A.gravity, 0, 2, 0.1, (v) => (v === 0 ? 'Zero-G' : v.toFixed(1) + 'x'), (v) => { A.gravity = v; persist(); }, () => rebuildPreview()),
    slider('Bounciness', A.bounceMul, 0.4, 1.6, 0.05, (v) => v.toFixed(2) + 'x', (v) => { A.bounceMul = v; persist(); }, () => rebuildPreview()),
    slider('Friction', A.frictionMul, 0, 2, 0.05, (v) => v.toFixed(2) + 'x', (v) => { A.frictionMul = v; persist(); }, () => rebuildPreview()),
    section('Time limit'),
    h('div', { class: 'chips' }, [0, 60, 120, 180, 300, 600].map((t) => chip(t ? fmtTime(t) : 'None', A.timeLimit === t, () => set(() => { A.timeLimit = t; }, false)))),
    h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn sm', onclick: () => set(() => { S.arena = JSON.parse(JSON.stringify(DEFAULTS.arena)); }) }, '↺ Reset arena')));
}

// ---------- tab: mode ----------
function tabMode() {
  return h('div', null,
    section('Game mode'),
    h('div', { class: 'modes' }, Object.entries(MODES).map(([k, m]) => h('div', { class: 'modecard' + (S.mode === k ? ' on' : ''), onclick: () => { S.mode = k; persist(); rebuildPreview(); refreshSheet(); } }, h('b', null, `${m.icon} ${m.name}`), h('span', null, m.desc)))),
    section('Play style (mix any)'),
    h('div', { class: 'toggles' },
      toggle('👀 Watch (always on)', true, () => {}),
      toggle('🎲 Predict & Bet', S.play.bet, () => { S.play.bet = !S.play.bet; persist(); refreshSheet(); }),
      toggle('🧰 Sandbox god tools', S.play.sandbox, () => { S.play.sandbox = !S.play.sandbox; persist(); refreshSheet(); })),
    h('p', { class: 'hint' }, 'Sandbox tools appear during the fight: grab & fling balls, spawn fighters, explosions, gravity wells, smite, freeze, heal and delete.'),
    section('Camera'),
    h('div', { class: 'chips' }, Object.entries(CAMS).map(([k, lbl]) => chip(lbl, S.play.cam === k, () => { S.play.cam = k; persist(); refreshSheet(); }))),
    section('Game speed'),
    h('div', { class: 'chips' }, SPEEDS.map((s) => chip(s + 'x', S.play.speed === s, () => { S.play.speed = s; persist(); refreshSheet(); }))),
    section('Coins'),
    h('div', { class: 'row' }, h('span', { class: 'hint grow' }, `You have 🪙 ${S.coins}. Win bets to earn more.`), h('button', { class: 'btn sm', onclick: () => { S.coins = Math.max(S.coins, 1000); persist(); renderApp(); } }, 'Refill to 1000')));
}

// ---------- tab: lab ----------
function newLabDraft() {
  return { id: null, name: 'My Ball', element: 'lightning', archetype: 'king', color: ELEMENTS.lightning.color, material: 'auto', size: 1, stats: { hp: 1, atk: 1, def: 1, spd: 1, mass: 1 }, weapon: 'none', face: true, rules: '' };
}
function budgetUsed(d) {
  const st = d.stats;
  return ['hp', 'atk', 'def', 'spd', 'mass'].reduce((s, k) => s + (st[k] - 1), 0) + (d.size - 1) * 0.5;
}

function tabLab() {
  const d = labDraft;
  const box = h('div');
  const preview = h('div', { class: 'row' });
  const statsLine = h('div', { class: 'hint' });
  const budgetBar = h('i');
  const budgetTxt = h('span', { class: 'hint' });
  const errBox = h('div');
  const refreshPreview = () => {
    preview.innerHTML = '';
    preview.append(orb(d, 64), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 900, fontSize: '17px' } }, d.name || 'Unnamed'), statsLine));
    const s = resolveStats(d);
    statsLine.textContent = `❤${s.hp} ⚔${s.atk} 🛡${s.def} 💨${s.spd} ⚖${s.mass} · ${ELEMENTS[d.element].power}`;
    const used = budgetUsed(d);
    const pct = clamp(((used + 1) / 2) * 100, 0, 100);
    budgetBar.style.width = pct + '%';
    budgetBar.style.backgroundPosition = `${pct}% 0`;
    budgetTxt.textContent = S.labUnlimited ? `Power used: ${used.toFixed(2)} (unlimited mode)` : `Power used: ${used.toFixed(2)} / 1.00 ${used > 1.0001 ? '— over budget!' : ''}`;
    const p = parseEasyCode(d.rules);
    errBox.innerHTML = '';
    if (d.rules.trim()) errBox.append(p.errors.length ? h('div', { class: 'err' }, p.errors.map((x) => `Line ${x.line}: ${x.msg}`).join(' · ')) : h('div', { class: 'ok' }, `✓ ${p.rules.length} rule${p.rules.length === 1 ? '' : 's'} ready`));
  };
  const statSlider = (k, label) => slider(label, d.stats[k], 0.5, 2, 0.05, (v) => v.toFixed(2) + 'x', (v) => { d.stats[k] = v; refreshPreview(); });
  const rulesArea = h('textarea', { rows: 5, placeholder: 'WHEN lowhp DO shield 40 AND rage', value: d.rules, oninput: (e) => { d.rules = e.target.value; refreshPreview(); } });
  // rule builder
  const b = builder;
  const bRow = h('div', { class: 'grid2' },
    h('select', { onchange: (e) => { b.event = e.target.value; refreshSheet(); } }, [...EVENTS, 'every'].map((ev) => h('option', { value: ev, selected: b.event === ev }, ev === 'every' ? 'EVERY N seconds' : 'WHEN ' + ev))),
    b.event === 'every' ? h('input', { type: 'number', min: 0.5, step: 0.5, value: b.every, oninput: (e) => { b.every = +e.target.value; } }) : h('span'),
    h('select', { onchange: (e) => { b.cond = e.target.value; refreshSheet(); } }, ['none', 'hp<', 'hp>', 'enemies>', 'enemies<', 'allies>', 'allies<', 'chance'].map((c) => h('option', { value: c, selected: b.cond === c }, c === 'none' ? 'no condition' : 'IF ' + c))),
    b.cond !== 'none' ? h('input', { type: 'number', value: b.condValue, oninput: (e) => { b.condValue = +e.target.value; } }) : h('span'),
    h('select', { onchange: (e) => { b.action = e.target.value; refreshSheet(); } }, ACTIONS.map((a) => h('option', { value: a, selected: b.action === a }, 'DO ' + a))),
    b.action === 'say' ? h('input', { type: 'text', value: b.sayText, oninput: (e) => { b.sayText = e.target.value; } })
      : ['heal', 'damage', 'explode', 'speed', 'shield'].includes(b.action) ? h('input', { type: 'number', value: b.actionValue, oninput: (e) => { b.actionValue = +e.target.value; } }) : h('span'));
  const weapons = [...Object.keys(WEAPON_TYPES).map((k) => [k, `${WEAPON_TYPES[k].icon} ${WEAPON_TYPES[k].name}`]), ...S.custom.weapons.map((w) => [w.id, `★ ${w.name}`])];
  box.append(
    preview,
    h('div', { class: 'field' }, h('label', null, 'Name'), h('input', { type: 'text', maxlength: 28, value: d.name, oninput: (e) => { d.name = e.target.value; refreshPreview(); } })),
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, h('label', null, 'Element (power)'), h('select', { onchange: (e) => { d.element = e.target.value; d.color = ELEMENTS[d.element].color; refreshSheet(); } }, Object.entries(ELEMENTS).map(([k, e]) => h('option', { value: k, selected: d.element === k }, `${e.icon} ${e.name}`)))),
      h('div', { class: 'field' }, h('label', null, 'Archetype (ability)'), h('select', { onchange: (e) => { d.archetype = e.target.value; refreshSheet(); } }, Object.entries(ARCHETYPES).map(([k, a]) => h('option', { value: k, selected: d.archetype === k }, `${a.icon} ${a.name}`))))),
    h('p', { class: 'hint' }, `${ELEMENTS[d.element].icon} ${ELEMENTS[d.element].powerDesc} ${ARCHETYPES[d.archetype].icon} ${ARCHETYPES[d.archetype].desc}`),
    section('Look'),
    h('div', { class: 'row' }, h('input', { type: 'color', value: d.color, oninput: (e) => { d.color = e.target.value; refreshPreview(); } }),
      h('div', { class: 'chips grow' }, Object.entries(MATERIALS).map(([k, m]) => chip(m, d.material === k, () => { d.material = k; refreshSheet(); })))),
    slider('Size', d.size, 0.6, 1.6, 0.05, (v) => v.toFixed(2) + 'x', (v) => { d.size = v; refreshPreview(); }),
    toggle('👀 Cute face', d.face !== false, () => { d.face = d.face === false; refreshSheet(); }),
    section('Stats'),
    h('div', { class: 'budget' }, budgetBar), budgetTxt,
    statSlider('hp', '❤ Health'), statSlider('atk', '⚔ Attack'), statSlider('def', '🛡 Defence'), statSlider('spd', '💨 Speed'), statSlider('mass', '⚖ Mass'),
    toggle('♾️ Unlimited power (ignore budget)', S.labUnlimited, () => { S.labUnlimited = !S.labUnlimited; persist(); refreshSheet(); }),
    section('Weapon'),
    h('select', { onchange: (e) => { d.weapon = e.target.value; } }, weapons.map(([k, lbl]) => h('option', { value: k, selected: d.weapon === k }, lbl))),
    h('p', { class: 'hint' }, 'Make your own weapons in ⚒️ Forge.'),
    section('Easy code brain', h('button', { class: 'btn sm', onclick: () => { openTab = 'code'; renderApp(); } }, '📖 Help')),
    rulesArea, errBox,
    h('p', { class: 'hint', style: { marginTop: '8px' } }, 'Or build a rule:'),
    bRow,
    h('button', { class: 'btn sm', style: { marginTop: '6px' }, onclick: () => { const line = buildRuleLine(b); d.rules = (d.rules.trim() ? d.rules.trim() + '\n' : '') + line; refreshSheet(); } }, '➕ Add rule'),
    section('Save'),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => saveLab(false) }, '💾 Save'),
      h('button', { class: 'btn', onclick: () => saveLab(true) }, '💾 Save + add to fight'),
      h('button', { class: 'btn sm', onclick: () => { labDraft = newLabDraft(); refreshSheet(); } }, '✨ New'),
      h('button', { class: 'btn sm', onclick: () => shareBall({ ...d, id: d.id || uid('c-') }) }, '📋 Code')),
    section(`My balls (${S.custom.balls.length})`),
    S.custom.balls.length ? S.custom.balls.map((c) => h('div', { class: 'list-item' }, orb(c, 34, false),
      h('div', { class: 'grow' }, h('div', { class: 't' }, c.name), h('div', { class: 's' }, `${ELEMENTS[c.element].icon} ${ELEMENTS[c.element].name} ${ARCHETYPES[c.archetype].icon} ${ARCHETYPES[c.archetype].name}${c.rules ? ' · 🧩 code' : ''}`)),
      h('button', { class: 'btn sm', onclick: () => { labDraft = JSON.parse(JSON.stringify(c)); refreshSheet(); } }, '✏️'),
      h('button', { class: 'btn sm', onclick: () => { if (S.roster.length < 60) { S.roster.push({ id: c.id, team: 1 }); persist(); rebuildPreview(); toast(`+ ${c.name}`); } } }, '➕'),
      h('button', { class: 'btn sm', onclick: () => shareBall(c) }, '📋'),
      h('button', { class: 'btn sm', onclick: () => confirmDelete(c.name, () => { S.custom.balls = S.custom.balls.filter((x) => x.id !== c.id); S.roster = S.roster.filter((r) => r.id !== c.id); persist(); rebuildPreview(); refreshSheet(); }) }, '🗑️')))
      : h('p', { class: 'hint' }, 'No custom balls yet. Design one above, or import the example file in 📁 Files.'));
  refreshPreview();
  return box;
}

function confirmDelete(name, fn) {
  modal(`Delete “${name}”?`, h('p', { class: 'hint' }, 'This cannot be undone.'), [{ label: 'Cancel' }, { label: 'Delete', cls: 'danger', fn }]);
}

function saveLab(add) {
  const d = labDraft;
  const p = parseEasyCode(d.rules);
  if (p.errors.length) { toast(`Fix easy code first: line ${p.errors[0].line}`); return; }
  if (!S.labUnlimited && budgetUsed(d) > 1.0001) { toast('Over the power budget — lower some stats or turn on Unlimited'); return; }
  const ball = sanitizeBall({ ...d, id: d.id || uid('c-') });
  const i = S.custom.balls.findIndex((x) => x.id === ball.id);
  if (i >= 0) S.custom.balls[i] = ball; else S.custom.balls.unshift(ball);
  labDraft = JSON.parse(JSON.stringify(ball));
  if (add && S.roster.length < 60) S.roster.push({ id: ball.id, team: 1 });
  persist();
  rebuildPreview();
  toast(`💾 Saved ${ball.name}${add ? ' and added' : ''}`);
  refreshSheet();
}

// ---------- tab: forge ----------
function newForgeDraft() { return { id: null, name: 'My Blades', type: 'blades', count: 4, size: 0.5, dmg: 7, speed: 5, color: '#00e5ff' }; }
function tabForge() {
  const w = forgeDraft;
  const T = WEAPON_TYPES[w.type];
  const lim = { count: w.type === 'spikes' ? [4, 30] : [1, 8], size: [0.15, 1.6], dmg: w.type === 'spikes' || w.type === 'shield' ? [5, 70] : [1, 60], speed: [0.3, 10] };
  const dmgLabel = w.type === 'spikes' ? 'Contact bonus %' : w.type === 'shield' ? 'Damage blocked %' : 'Damage';
  const speedLabel = w.type === 'laser' || w.type === 'drones' ? 'Seconds between shots' : 'Spin speed';
  return h('div', null,
    h('div', { class: 'field' }, h('label', null, 'Weapon name'), h('input', { type: 'text', maxlength: 24, value: w.name, oninput: (e) => { w.name = e.target.value; } })),
    section('Type'),
    h('div', { class: 'chips' }, Object.entries(WEAPON_TYPES).filter(([k]) => k !== 'none').map(([k, t]) => chip(`${t.icon} ${t.name}`, w.type === k, () => {
      const base = WEAPON_TYPES[k];
      forgeDraft = { ...w, type: k, count: base.count, size: base.size, dmg: base.dmg, speed: base.speed };
      refreshSheet();
    }))),
    h('p', { class: 'hint' }, T.desc),
    w.type !== 'shield' && w.type !== 'laser' ? slider('Count', w.count, lim.count[0], lim.count[1], 1, (v) => v, (v) => { w.count = v; }) : null,
    w.type !== 'shield' ? slider('Size', w.size, lim.size[0], lim.size[1], 0.05, (v) => v.toFixed(2), (v) => { w.size = v; }) : null,
    slider(dmgLabel, w.dmg, lim.dmg[0], lim.dmg[1], 1, (v) => v, (v) => { w.dmg = v; }),
    w.type !== 'spikes' && w.type !== 'shield' ? slider(speedLabel, w.speed, lim.speed[0], lim.speed[1], 0.1, (v) => v.toFixed(1), (v) => { w.speed = v; }) : null,
    h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Colour'), h('input', { type: 'color', value: w.color, oninput: (e) => { w.color = e.target.value; } })),
    h('div', { class: 'row', style: { marginTop: '10px' } },
      h('button', { class: 'btn primary', onclick: saveForge }, '⚒️ Save weapon'),
      h('button', { class: 'btn sm', onclick: () => { forgeDraft = newForgeDraft(); refreshSheet(); } }, '✨ New')),
    section(`My weapons (${S.custom.weapons.length})`),
    S.custom.weapons.length ? S.custom.weapons.map((c) => h('div', { class: 'list-item' },
      h('span', { class: 'dot', style: { background: c.color, width: '22px', height: '22px' } }),
      h('div', { class: 'grow' }, h('div', { class: 't' }, c.name), h('div', { class: 's' }, `${WEAPON_TYPES[c.type].icon} ${WEAPON_TYPES[c.type].name} · dmg ${c.dmg}`)),
      h('button', { class: 'btn sm', onclick: () => { forgeDraft = { ...c }; refreshSheet(); } }, '✏️'),
      h('button', { class: 'btn sm', onclick: () => { labDraft.weapon = c.id; openTab = 'lab'; renderApp(); toast(`${c.name} equipped in Ball Lab`); } }, '🧪 Use'),
      h('button', { class: 'btn sm', onclick: () => confirmDelete(c.name, () => { S.custom.weapons = S.custom.weapons.filter((x) => x.id !== c.id); for (const bb of S.custom.balls) if (bb.weapon === c.id) bb.weapon = 'none'; persist(); refreshSheet(); }) }, '🗑️')))
      : h('p', { class: 'hint' }, 'No custom weapons yet.'));
}
function saveForge() {
  const w = sanitizeWeapon({ ...forgeDraft, id: forgeDraft.id || uid('w-') });
  const i = S.custom.weapons.findIndex((x) => x.id === w.id);
  if (i >= 0) S.custom.weapons[i] = w; else S.custom.weapons.unshift(w);
  forgeDraft = { ...w };
  persist();
  rebuildPreview();
  toast(`⚒️ Saved ${w.name}`);
  refreshSheet();
}

// ---------- tab: code ----------
function tabCode() {
  return h('div', null,
    h('p', { class: 'hint' }, 'Give any ball its own brain with simple rules. Write them in 🧪 Ball Lab → Easy code brain.'),
    h('pre', { class: 'code' }, EASY_CODE_HELP),
    section('Examples (tap to use)'),
    EASY_CODE_EXAMPLES.map((ex) => h('div', { class: 'list-item' },
      h('div', { class: 'grow' }, h('div', { class: 't' }, ex.name), h('pre', { class: 'code', style: { margin: '4px 0 0' } }, ex.code)),
      h('button', { class: 'btn sm', onclick: () => { labDraft.rules = (labDraft.rules.trim() ? labDraft.rules.trim() + '\n' : '') + ex.code; openTab = 'lab'; renderApp(); toast('Added to Ball Lab'); } }, '🧪 Use'))));
}

// ---------- tab: files ----------
function exportAll() {
  return { format: 'orb-arena', version: 1, exported: new Date().toISOString(), weapons: S.custom.weapons, balls: S.custom.balls, setup: { mode: S.mode, arena: S.arena, roster: S.roster } };
}
function tabFiles() {
  const pasteBox = h('textarea', { rows: 4, placeholder: 'Paste an ORB1: code or JSON here…' });
  const fileIn = h('input', { type: 'file', accept: '.json,.orb,.txt,application/json,text/plain', class: 'hidden', onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { const text = await f.text(); doImport(text); } catch (err) { toast('Could not read file'); }
    e.target.value = '';
  } });
  const exampleTxt = JSON.stringify(EXAMPLE_FILE, null, 2);
  return h('div', null,
    section('Export'),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: async () => { const where = await saveFile('orb-arena-export.json', new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' })); toast(`Saved to ${where}`); } }, '💾 Save file (.json)'),
      h('button', { class: 'btn', onclick: () => showCode('Everything as one code', toShareCode(exportAll()), 'Your balls, weapons and battle setup in one code. Paste it in Import on any device.') }, '📋 Copy as code')),
    h('p', { class: 'hint' }, `Includes ${S.custom.balls.length} balls, ${S.custom.weapons.length} weapons, and your arena/roster setup.`),
    section('Import'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => fileIn.click() }, '📂 Open file'), fileIn),
    pasteBox,
    h('button', { class: 'btn primary', style: { marginTop: '6px' }, onclick: () => doImport(pasteBox.value) }, '⬇️ Import pasted code'),
    section('Example file — shows every option'),
    h('p', { class: 'hint' }, 'One file can hold custom balls, custom weapons and a full battle setup. Copy it, change any value, then import it.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => doImport(exampleTxt) }, '⚡ Load example'),
      h('button', { class: 'btn sm', onclick: async () => toast((await copyText(exampleTxt)) ? 'Example copied' : 'Select and copy below') }, '📋 Copy'),
      h('button', { class: 'btn sm', onclick: async () => { const where = await saveFile('orb-arena-example.json', new Blob([exampleTxt], { type: 'application/json' })); toast(`Saved to ${where}`); } }, '💾 Save')),
    h('pre', { class: 'code' }, exampleTxt),
    section('Field guide'),
    h('pre', { class: 'code' }, [
      'element:   ' + Object.keys(ELEMENTS).join(', '),
      'archetype: ' + Object.keys(ARCHETYPES).join(', '),
      'material:  ' + Object.keys(MATERIALS).join(', '),
      'weapon:    ' + Object.keys(WEAPON_TYPES).join(', ') + '  (or your weapon id)',
      'weapon type (forge): blades, spikes, hammer, laser, drones, shield',
      'stats:     hp atk def spd mass  (multipliers, 0.3 – 3)',
      'size:      0.5 – 2',
      'mode:      ' + Object.keys(MODES).join(', '),
      'shape:     ' + Object.keys(ARENA_SHAPES).join(', '),
      'floor:     ' + Object.keys(FLOORS).join(', '),
      'backdrop:  ' + Object.keys(BACKDROPS).join(', '),
      'hazards:   ' + Object.keys(HAZARDS).join(', '),
      'physics:   gravity 0–2, bounceMul 0.4–1.6, frictionMul 0–2, accelMul 0.3–3, momentum true/false',
      'roster id: a custom ball id, or element-archetype (e.g. fire-giant)',
    ].join('\n')));
}

function sanitizeBall(b) {
  const el = ELEMENTS[b.element] ? b.element : 'fire';
  const st = b.stats || {};
  const num = (v, a, z, d) => (Number.isFinite(+v) ? clamp(+v, a, z) : d);
  return {
    id: typeof b.id === 'string' && /^c-[\w-]{1,60}$/.test(b.id) ? b.id : uid('c-'),
    name: String(b.name || 'Custom Ball').slice(0, 28),
    element: el,
    archetype: ARCHETYPES[b.archetype] ? b.archetype : 'king',
    color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : ELEMENTS[el].color,
    material: MATERIALS[b.material] ? b.material : 'auto',
    size: num(b.size, 0.5, 2, 1),
    stats: { hp: num(st.hp, 0.3, 3, 1), atk: num(st.atk, 0.3, 3, 1), def: num(st.def, 0.3, 3, 1), spd: num(st.spd, 0.3, 3, 1), mass: num(st.mass, 0.3, 3, 1) },
    weapon: typeof b.weapon === 'string' && (WEAPON_TYPES[b.weapon] || /^w-[\w-]{1,60}$/.test(b.weapon)) ? b.weapon : 'none',
    face: b.face !== false,
    rules: String(b.rules || '').slice(0, 3000),
    builtin: false,
  };
}
function sanitizeWeapon(w) {
  const type = WEAPON_TYPES[w.type] && w.type !== 'none' ? w.type : 'blades';
  const num = (v, a, z, d) => (Number.isFinite(+v) ? clamp(+v, a, z) : d);
  const base = WEAPON_TYPES[type];
  return {
    id: typeof w.id === 'string' && /^w-[\w-]{1,60}$/.test(w.id) ? w.id : uid('w-'),
    name: String(w.name || 'Custom Weapon').slice(0, 24), type,
    count: Math.round(num(w.count, 1, 30, base.count)), size: num(w.size, 0.1, 2, base.size), dmg: num(w.dmg, 0, 100, base.dmg), speed: num(w.speed, 0, 12, base.speed),
    color: /^#[0-9a-f]{6}$/i.test(w.color || '') ? w.color : '#dfe8ff',
  };
}
function upsert(list, item) { const i = list.findIndex((x) => x.id === item.id); if (i >= 0) list[i] = item; else list.unshift(item); }

function doImport(text) {
  let obj;
  try { obj = fromShareCode(text); } catch (e) { toast('❌ ' + (e.message || 'Invalid code')); return; }
  let nb = 0;
  let nw = 0;
  let setup = false;
  const addW = (w) => { upsert(S.custom.weapons, sanitizeWeapon(w)); nw++; };
  const addB = (b) => { upsert(S.custom.balls, sanitizeBall(b)); nb++; };
  try {
    if (obj.type === 'ball' && obj.ball) { if (obj.weapon) addW(obj.weapon); addB(obj.ball); }
    else if (obj.format === 'orb-arena' || obj.balls || obj.weapons || obj.setup) {
      (obj.weapons || []).forEach(addW);
      (obj.balls || []).forEach(addB);
      if (obj.setup) {
        const st = obj.setup;
        if (MODES[st.mode]) S.mode = st.mode;
        if (st.arena) {
          const a = merge(DEFAULTS.arena, st.arena);
          if (!ARENA_SHAPES[a.shape]) a.shape = 'circle';
          if (!FLOORS[a.floor]) a.floor = 'stone';
          if (!BACKDROPS[a.backdrop]) a.backdrop = 'studio';
          a.size = clamp(+a.size || 20, 12, 36);
          a.gravity = clamp(+a.gravity || 0, 0, 2);
          a.bounceMul = clamp(+a.bounceMul || 1, 0.4, 1.6);
          a.frictionMul = clamp(+a.frictionMul || 0, 0, 2);
          a.accelMul = clamp(+a.accelMul || 1, 0.3, 3);
          a.momentum = !!a.momentum;
          a.timeLimit = clamp(+a.timeLimit || 0, 0, 3600);
          S.arena = a;
        }
        if (Array.isArray(st.roster)) S.roster = st.roster.filter((r) => r && defById(r.id)).slice(0, 60).map((r) => ({ id: r.id, team: clamp(+r.team || 1, 1, 4) }));
        setup = true;
      }
    } else if (obj.element || obj.archetype) addB(obj);
    else throw new Error('Nothing to import found');
  } catch (e) { toast('❌ ' + e.message); return; }
  persist();
  rebuildPreview();
  toast(`✅ Imported ${nb} ball${nb === 1 ? '' : 's'}, ${nw} weapon${nw === 1 ? '' : 's'}${setup ? ' + battle setup' : ''}`, 3000);
  refreshSheet();
}

// ---------- tab: settings ----------
function tabSettings() {
  const st = S.settings;
  const set = (fn, rebuild) => { fn(); persist(); if (rebuild && R) { R.settings = S.settings; R.applyQuality(); rebuildPreview(); } refreshSheet(); document.body.classList.toggle('lowfx', st.quality === 'low'); };
  return h('div', null,
    section('Graphics quality'),
    h('div', { class: 'chips' }, [['low', '🔋 Low (fast)'], ['high', '✨ High'], ['ultra', '💎 Ultra (real glass)']].map(([k, l]) => chip(l, st.quality === k, () => set(() => { st.quality = k; }, true)))),
    h('p', { class: 'hint' }, 'Ultra adds real see-through glass, crisper shadows and more particles. Use Low if your phone gets hot or laggy.'),
    slider('☀️ Brightness', st.brightness ?? 0.7, 0.3, 1.4, 0.05, (v) => Math.round(v * 100) + '%', (v) => { st.brightness = v; if (R) R.renderer.toneMappingExposure = v; persist(); }),
    section('Display'),
    h('div', { class: 'toggles' },
      toggle('🔢 Damage numbers', st.numbers, () => set(() => { st.numbers = !st.numbers; })),
      toggle('❤️ HP bars on balls', st.hpBars, () => set(() => { st.hpBars = !st.hpBars; }, true)),
      toggle('👀 Faces', st.faces, () => set(() => { st.faces = !st.faces; }, true)),
      toggle('☄️ Speed trails', st.trails, () => set(() => { st.trails = !st.trails; })),
      toggle('📳 Screen shake', st.shake, () => set(() => { st.shake = !st.shake; })),
      toggle('📊 Compact live stats', st.compactStats, () => set(() => { st.compactStats = !st.compactStats; }))),
    section('Recording'),
    toggle('❤️ Small HP panel in videos', st.recHud, () => set(() => { st.recHud = !st.recHud; })),
    h('p', { class: 'hint' }, 'Videos record only the arena: no buttons or menus. Optionally with a small health panel at the side.'),
    section('Sound & feel'),
    h('div', { class: 'toggles' },
      toggle('🔊 Sound', st.sound, () => set(() => { st.sound = !st.sound; audio.enabled = st.sound; })),
      toggle('📳 Vibration', st.vibrate, () => set(() => { st.vibrate = !st.vibrate; }))),
    slider('Volume', st.volume, 0, 1, 0.05, (v) => Math.round(v * 100) + '%', (v) => { st.volume = v; audio.setVolume(v); persist(); }),
    section('Data'),
    h('div', { class: 'row' }, h('button', { class: 'btn sm danger', onclick: () => modal('Reset everything?', h('p', { class: 'hint' }, 'Deletes your custom balls, weapons, coins and settings. Export first if you want to keep them.'), [{ label: 'Cancel' }, { label: 'Reset', cls: 'danger', fn: () => { saveState({}); location.reload(); } }]) }, '♻️ Reset all data')),
    h('p', { class: 'hint', style: { marginTop: '14px' } }, `ORB ARENA · ${CATALOG.length} built-in fighters · ${Object.keys(ELEMENTS).length} elements × ${Object.keys(ARCHETYPES).length} archetypes`));
}

// ---------- input ----------
function bindInput() {
  canvas.addEventListener('pointerdown', (e) => {
    if (!R || !sim || phase !== 'fight' || !S.play.sandbox || tool === 'camera') return;
    const p = R.floorPoint(e.clientX, e.clientY);
    if (!p) return;
    if (tool === 'fling') {
      const g = sim.grab(p.x, p.z);
      if (g) { g.grabHist = [[nowSec(), p.x, p.z]]; grabbing = true; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    } else {
      let def = null;
      if (tool === 'spawn') {
        const pool = allDefs();
        def = S.spawnPick === 'random' ? pool[(Math.random() * pool.length) | 0] : defById(S.spawnPick) || pool[0];
      }
      sim.applyTool(tool, p.x, p.z, def);
      audio.play('click');
      if (S.settings.vibrate) vibrate(15);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!grabbing || !sim) return;
    const p = R.floorPoint(e.clientX, e.clientY);
    if (p) sim.moveGrab(p.x, p.z, nowSec());
  });
  const up = () => { if (grabbing && sim) { sim.release(); grabbing = false; } };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  window.addEventListener('resize', () => R && R.resize());
  // glass highlight follows device tilt / mouse
  const setTilt = (x, y) => { document.documentElement.style.setProperty('--tx', x.toFixed(1) + 'px'); document.documentElement.style.setProperty('--ty', y.toFixed(1) + 'px'); };
  window.addEventListener('deviceorientation', (e) => { if (e.gamma == null) return; setTilt(clamp(e.gamma, -30, 30) / 3, clamp((e.beta || 0) - 40, -30, 30) / 3); });
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') setTilt((e.clientX / window.innerWidth - 0.5) * 16, (e.clientY / window.innerHeight - 0.5) * 16); });
  // Android back button
  window.onAndroidBack = () => {
    if (document.getElementById('modal')) { const m = document.getElementById('modal'); if (m.closeModal) m.closeModal(); else m.remove(); return true; }
    if (catalogOpen) { catalogOpen = false; refreshSheet(); return true; }
    if (openTab) { openTab = null; renderApp(); return true; }
    if (phase === 'fight' || phase === 'countdown') { endFightEarly(); return true; }
    return false;
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'fight') { paused = true; renderDock(); } });
}

// ---------- main loop ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!R || !sim) return;
  let gdt = 0;
  try {
    if (phase === 'fight' && !paused) {
      gdt = real * S.play.speed;
      sim.step(gdt);
      if (sim.over) onSimOver();
    } else if (phase === 'ending') {
      gdt = real * 0.3;
      endT -= real;
      if (endT <= 0) finishResults();
    }
    R.sync(sim, gdt);
    if (phase === 'ending' && sim.winnerBall) R.focusOn(sim.winnerBall.x, sim.winnerBall.z);
    R.frame(phase === 'setup' ? real : gdt, sim);
  } catch (err) {
    console.error(err);
    if (!loop.errShown) { loop.errShown = true; toast('⚠️ ' + err.message, 5000); }
  }
  if (now - lastHud > 200) {
    lastHud = now;
    updateTop();
    if (phase !== 'setup') updateStats();
  }
  if (now - lastFeed > 300) { lastFeed = now; updateFeed(); }
}

// ---------- boot ----------
async function boot() {
  const msg = document.getElementById('boot-msg');
  try {
    const mod = await import('./render.js');
    R = new mod.Renderer(canvas, overlay, S.settings);
    teamColor = mod.teamColor;
  } catch (e) {
    console.error(e);
    msg.textContent = 'Could not start 3D: ' + (e.message || e) + '. Your device may not support WebGL.';
    return;
  }
  bindInput();
  rebuildPreview(true);
  renderApp();
  requestAnimationFrame(loop);
  const bootEl = document.getElementById('boot');
  bootEl.style.opacity = '0';
  setTimeout(() => { bootEl.style.display = 'none'; }, 500);
  if (!S.seenIntro) {
    S.seenIntro = true;
    persist();
    modal('Welcome to ORB ARENA', h('div', null,
      h('p', { class: 'hint' }, `${CATALOG.length} fighters, 13 elements, 19 archetypes, custom balls, weapons and code.`),
      h('p', { class: 'hint' }, '🔵 Fighters: pick who fights · 🏟️ Arena: ring, floor, hazards · 🎮 Mode: FFA, teams, boss, royale, survival, tournament · 🧪 Lab + ⚒️ Forge: build your own · 📁 Files: import/export'),
      h('p', { class: 'hint' }, 'Hit ⚔️ FIGHT to start. Drag to rotate the camera, pinch to zoom. Tap a fighter in Live Stats to follow it.')),
    [{ label: "Let's go!", cls: 'primary' }]);
  }
}
boot();
