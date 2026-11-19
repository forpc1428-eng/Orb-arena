// EASY CODE parser — turns simple text rules into data the simulation runs.

export const EVENTS = ['start', 'hit', 'hurt', 'kill', 'lowhp', 'near', 'death'];
export const ACTIONS = ['heal', 'damage', 'explode', 'dash', 'speed', 'shield', 'grow', 'shrink', 'clone',
  'summon', 'power', 'pull', 'push', 'teleport', 'ghost', 'freeze', 'rage', 'say'];
const NEEDS_NUMBER = { heal: 20, damage: 30, explode: 40, speed: 50, shield: 30 };

function parseCondition(txt) {
  const t = txt.trim().toLowerCase();
  let m = t.match(/^(hp|enemies|allies)\s*([<>])\s*(\d+(?:\.\d+)?)$/);
  if (m) return { kind: m[1], op: m[2], value: parseFloat(m[3]) };
  m = t.match(/^chance\s*(\d+(?:\.\d+)?)%?$/);
  if (m) return { kind: 'chance', value: parseFloat(m[1]) };
  return null;
}

function parseAction(txt) {
  const raw = txt.trim();
  const [verbRaw, ...rest] = raw.split(/\s+/);
  const verb = (verbRaw || '').toLowerCase();
  if (!ACTIONS.includes(verb)) return { error: `Unknown action "${verbRaw || ''}"` };
  if (verb === 'say') return { verb, text: rest.join(' ').slice(0, 40) || '!' };
  let value = NEEDS_NUMBER[verb] ?? 0;
  if (rest.length) {
    const n = parseFloat(rest[0]);
    if (Number.isNaN(n)) return { error: `"${verb}" needs a number, got "${rest[0]}"` };
    value = Math.max(0, Math.min(n, 1000));
  }
  return { verb, value };
}

// Returns { rules: [...], errors: [{line, msg}] }
export function parseEasyCode(src) {
  const rules = [];
  const errors = [];
  const lines = String(src || '').split(/\r?\n/);
  lines.forEach((line, i) => {
    const text = line.replace(/#.*$/, '').trim();
    if (!text) return;
    const lineNo = i + 1;
    let event = null;
    let every = 0;
    let body = '';
    let m;
    if ((m = text.match(/^when\s+(\w+)\s+(.*)$/i))) {
      event = m[1].toLowerCase();
      body = m[2];
      if (!EVENTS.includes(event)) { errors.push({ line: lineNo, msg: `Unknown event "${m[1]}"` }); return; }
    } else if ((m = text.match(/^every\s+(\d+(?:\.\d+)?)\s*s?\s+(.*)$/i))) {
      event = 'every';
      every = Math.max(0.5, parseFloat(m[1]));
      body = m[2];
    } else if ((m = text.match(/^on\s+start\s+(.*)$/i))) {
      event = 'start';
      body = m[1];
    } else {
      errors.push({ line: lineNo, msg: 'Start with WHEN or EVERY' });
      return;
    }
    const doIdx = body.search(/\bdo\b/i);
    if (doIdx < 0) { errors.push({ line: lineNo, msg: 'Missing DO' }); return; }
    const condPart = body.slice(0, doIdx).trim();
    const actPart = body.slice(doIdx + 2).trim();
    const conds = [];
    if (condPart) {
      const pieces = condPart.split(/\bif\b/i).map((s) => s.trim()).filter(Boolean);
      for (const p of pieces) {
        for (const q of p.split(/\band\b/i).map((s) => s.trim()).filter(Boolean)) {
          const c = parseCondition(q);
          if (!c) { errors.push({ line: lineNo, msg: `Unknown condition "${q}"` }); return; }
          conds.push(c);
        }
      }
    }
    if (!actPart) { errors.push({ line: lineNo, msg: 'Nothing after DO' }); return; }
    const actions = [];
    for (const a of actPart.split(/\band\b/i)) {
      const r = parseAction(a);
      if (r.error) { errors.push({ line: lineNo, msg: r.error }); return; }
      actions.push(r);
    }
    rules.push({ event, every, conds, actions, line: lineNo });
  });
  return { rules, errors };
}

// Builds a rule line from the visual builder.
export function buildRuleLine({ event, every, cond, condValue, action, actionValue, sayText }) {
  let s = event === 'every' ? `EVERY ${every || 5}` : `WHEN ${event}`;
  if (cond && cond !== 'none') {
    s += cond === 'chance' ? ` IF chance ${condValue || 30}` : ` IF ${cond}${condValue ?? 50}`;
  }
  s += ' DO ' + action;
  if (action === 'say') s += ' ' + (sayText || 'Hi!');
  else if (actionValue !== undefined && actionValue !== '' && NEEDS_NUMBER[action] !== undefined) s += ' ' + actionValue;
  return s;
}
