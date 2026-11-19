// ORB ARENA — simulation engine (physics, AI, powers, hazards, rules). No rendering in here.
import { ELEMENTS, ARCHETYPES, WEAPON_TYPES, FLOORS, ARENA_SHAPES, resolveStats } from './data.js';
import { parseEasyCode } from './code.js';

const TAU = Math.PI * 2;
const NOOP = () => {};
const MAX_BALLS = 140;
const ELEMENT_KEYS = Object.keys(ELEMENTS);

const ELEMENT_CD = { lightning: 4.5, fire: 3.5, ice: 4, water: 5, earth: 6, wind: 5, poison: 5, light: 5, shadow: 5, void: 9, metal: 8, nature: 6, cosmic: 6 };
const ELEMENT_RANGE = { lightning: 12, fire: 16, ice: 14, water: 7, earth: 6, wind: 30, poison: 14, light: 16, shadow: 18, void: 16, metal: 6, nature: 12, cosmic: 22 };

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rand(a = 0, b = 1) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

export function resolveWeapon(def, customWeapons) {
  const key = def.weapon || 'none';
  const custom = customWeapons && customWeapons[key];
  if (custom) {
    const base = WEAPON_TYPES[custom.type] || WEAPON_TYPES.none;
    return { type: custom.type, name: custom.name, count: custom.count ?? base.count, size: custom.size ?? base.size, dmg: custom.dmg ?? base.dmg, speed: custom.speed ?? base.speed, color: custom.color || '#dfe8ff' };
  }
  const base = WEAPON_TYPES[key] || WEAPON_TYPES.none;
  return { type: WEAPON_TYPES[key] ? key : 'none', name: base.name, count: base.count, size: base.size, dmg: base.dmg, speed: base.speed, color: '#dfe8ff' };
}

// Position of orbiting weapon part i (used by sim and renderer).
export function weaponOrbit(b, i) {
  const w = b.weapon;
  const n = Math.max(1, w.count);
  const dist = w.type === 'hammer' ? b.radius + 2.4 + w.size : w.type === 'drones' ? b.radius + 1.6 : b.radius + 0.7 + w.size * 0.6;
  const a = w.angle + (i * TAU) / n;
  return { x: b.x + Math.cos(a) * dist, z: b.z + Math.sin(a) * dist, y: w.type === 'drones' ? b.y + b.radius * 0.8 + 0.4 : b.y };
}

export class Simulation {
  constructor(opts) {
    this.fx = Object.assign({}, opts.fx || {});
    for (const k of ['hit', 'text', 'lightning', 'explosion', 'ring', 'beam', 'spark', 'spawn', 'death', 'heal', 'shake', 'sound', 'say', 'teleport', 'revive']) {
      if (typeof this.fx[k] !== 'function') this.fx[k] = NOOP;
    }
    this.mode = opts.mode || 'ffa';
    const a = opts.arena || {};
    this.arena = {
      shape: ARENA_SHAPES[a.shape] ? a.shape : 'circle',
      size: clamp(+a.size || 20, 10, 40),
      floor: FLOORS[a.floor] ? a.floor : 'stone',
      gravity: a.gravity ?? 1,
      timeLimit: +a.timeLimit || 0,
      hazards: Object.assign({}, a.hazards || {}),
      bounceMul: a.bounceMul ?? 1,
      frictionMul: a.frictionMul ?? 1,
      accelMul: a.accelMul ?? 1,
      momentum: !!a.momentum, // true = no speed loss at all (perpetual motion)
    };
    const sh = ARENA_SHAPES[this.arena.shape];
    this.sides = sh.sides;
    this.innerFrac = sh.inner || 0;
    const fl = FLOORS[this.arena.floor];
    this.friction = fl.friction * this.arena.frictionMul;
    this.bounce = clamp(fl.bounce * this.arena.bounceMul, 0.1, 1.4);
    this.scale = 1; // shrinking ring
    this.shrink = this.mode === 'royale' || !!a.shrink;
    this.customWeapons = opts.customWeapons || {};
    this.wavePool = opts.wavePool || [];
    this.balls = [];
    this.projectiles = [];
    this.zones = [];
    this.time = 0;
    this.over = false;
    this.winnerTeam = null;
    this.winnerBall = null;
    this.wave = 0;
    this.nextId = 1;
    this.pairHit = new Map();
    this.hazardT = { meteor: 2.5, storm: 2, spin: 0 };
    this.spinAngle = 0;
    this.history = []; // team hp samples for graphs
    this.sampleT = 0;
    this.killFeed = [];
    this._depth = 0;
    this.slowmoT = 0;
    this.grabbed = null;
    this.setupBumpers();
    this.spawnRoster(opts.roster || []);
    if (this.mode === 'survival') this.spawnWave();
    for (const b of this.balls) this.fireEvent(b, 'start');
  }

  // ---------- arena geometry ----------
  get R() { return this.arena.size * this.scale; }

  setupBumpers() {
    this.bumpers = [];
    this.portals = [];
    const R = this.arena.size;
    if (this.arena.hazards.bumpers) {
      for (let i = 0; i < 4; i++) {
        const ang = Math.PI / 4 + (i * TAU) / 4;
        const d = this.innerFrac ? R * 0.62 : R * 0.5;
        this.bumpers.push({ x: Math.cos(ang) * d, z: Math.sin(ang) * d, r: 1.2 });
      }
    }
    if (this.arena.hazards.portals) {
      const d = R * 0.62;
      this.portals.push({ x: -d, z: 0, pair: 1, color: '#2ad4ff' }, { x: d, z: 0, pair: 0, color: '#2ad4ff' });
      this.portals.push({ x: 0, z: -d, pair: 3, color: '#ff8a1f' }, { x: 0, z: d, pair: 2, color: '#ff8a1f' });
    }
  }

  // distance from point to the outer wall (positive = inside)
  wallDistance(x, z) {
    const R = this.R;
    if (!this.sides) return R - Math.hypot(x, z);
    const n = this.sides;
    const apo = R * Math.cos(Math.PI / n);
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const ang = ((2 * i + 2) * Math.PI) / n;
      const d = apo - (x * Math.cos(ang) + z * Math.sin(ang));
      if (d < best) best = d;
    }
    return best;
  }

  randomPoint(margin = 2) {
    for (let k = 0; k < 40; k++) {
      const x = rand(-this.R, this.R);
      const z = rand(-this.R, this.R);
      if (this.wallDistance(x, z) > margin && (!this.innerFrac || Math.hypot(x, z) > this.R * this.innerFrac + margin)) return { x, z };
    }
    return { x: 0, z: this.innerFrac ? this.R * 0.6 : 0 };
  }

  // ---------- spawning ----------
  spawnRoster(roster) {
    const n = roster.length;
    const ring = this.R * (this.innerFrac ? 0.65 : 0.62);
    roster.forEach((entry, i) => {
      let team;
      if (this.mode === 'teams') team = entry.team || 1 + (i % 2);
      else if (this.mode === 'boss') team = i === 0 ? 1 : 2;
      else if (this.mode === 'survival') team = 1;
      else team = 100 + i;
      let ang = (i / Math.max(1, n)) * TAU + rand(-0.1, 0.1);
      let r = ring;
      if (this.mode === 'teams') {
        const teams = [...new Set(roster.map((e, j) => e.team || 1 + (j % 2)))].sort();
        const ti = teams.indexOf(team);
        const members = roster.filter((e, j) => (e.team || 1 + (j % 2)) === team);
        const mi = members.indexOf(entry);
        ang = (ti / teams.length) * TAU + (mi - (members.length - 1) / 2) * 0.22;
        r = ring * (0.85 + (mi % 2) * 0.12);
      }
      if (this.mode === 'boss' && i === 0) r = 0.01;
      if (this.mode === 'survival') { ang = (i / Math.max(1, n)) * TAU; r = ring * 0.35; }
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const p = this.innerFrac && r < this.R * this.innerFrac + 2 ? { x: Math.cos(ang) * ring, z: Math.sin(ang) * ring } : { x, z };
      this.addBall(entry.def, team, p.x, p.z, { boss: this.mode === 'boss' && i === 0 });
    });
  }

  spawnWave() {
    this.wave++;
    const count = Math.min(2 + this.wave, 14);
    const pool = this.wavePool.length ? this.wavePool : [];
    for (let i = 0; i < count && pool.length; i++) {
      const ang = rand(0, TAU);
      const r = this.R * 0.8;
      const b = this.addBall(pick(pool), 2, Math.cos(ang) * r, Math.sin(ang) * r, { hpMul: 0.6 + this.wave * 0.12 });
      if (b) this.fireEvent(b, 'start');
    }
    this.fx.text(0, 4, 0, `WAVE ${this.wave}`, '#ffffff', 2);
    this.fx.sound('wave', 1);
  }

  addBall(def, team, x, z, o = {}) {
    if (this.balls.filter((b) => b.alive).length >= MAX_BALLS) return null;
    const s = resolveStats(def);
    let radius = s.radius * (o.scale || 1);
    let hp = s.hp * (o.hpMul || 1);
    let atk = s.atk;
    let mass = s.mass * (o.scale ? o.scale * o.scale : 1);
    if (o.boss) { radius *= 2.1; hp *= 7; atk *= 1.6; mass *= 6; }
    if (o.minion) { radius = 0.55; hp = 80; atk = s.atk * 0.65; mass = 0.5; }
    const parsed = parseEasyCode(def.rules || '');
    const b = {
      id: this.nextId++,
      def,
      name: o.minion ? `${ARCHETYPES.summoner.name} Minion` : o.boss ? `BOSS ${def.name}` : def.name,
      team,
      element: def.element,
      archetype: o.minion ? 'minion' : def.archetype,
      color: def.color || ELEMENTS[def.element].color,
      material: def.material || 'auto',
      face: def.face !== false,
      radius, baseRadius: radius,
      mass,
      maxHp: Math.max(1, Math.round(hp)), hp: Math.max(1, Math.round(hp)),
      atk, def_: s.def, spd: s.spd * (o.minion ? 1.2 : 1) * (o.boss ? 0.85 : 1), crit: s.crit, regen: s.regen,
      x, y: radius, z, vx: 0, vy: 0, vz: 0,
      alive: true,
      st: {},
      cdElem: rand(1, 3), cdArch: rand(1.5, 4),
      target: null, retarget: 0, mode: 'approach', modeT: rand(0.3, 1.2),
      weapon: Object.assign(resolveWeapon(def, this.customWeapons), { angle: rand(0, TAU), cd: rand(0.5, 1.5) }),
      weaponHit: new Map(),
      rules: parsed.rules, ruleT: parsed.rules.map((r) => r.every || 0), ruleLast: parsed.rules.map(() => -9), lowhpFired: false,
      stats: { dealt: 0, taken: 0, healed: 0, kills: 0, recent: [], dps: 0, peakDps: 0 },
      hpHist: [],
      isBoss: !!o.boss, isMinion: !!o.minion, owner: o.owner || null,
      gen: o.gen || 0, splits: 0, revived: false, guards: false, portalCd: 0,
      spawnT: this.time, bubble: null,
    };
    if (o.minion) b.weapon = Object.assign(resolveWeapon({ weapon: 'none' }), { angle: 0, cd: 1 });
    this.balls.push(b);
    this.fx.spawn(b);
    return b;
  }

  // ---------- helpers ----------
  isEnemy(a, b) { return a.team !== b.team; }
  enemiesOf(b) { return this.balls.filter((o) => o.alive && o !== b && this.isEnemy(b, o)); }
  alliesOf(b) { return this.balls.filter((o) => o.alive && o !== b && !this.isEnemy(b, o) && !o.isMinion); }
  nearestEnemy(b, maxD = Infinity) {
    let best = null;
    let bd = maxD;
    for (const o of this.balls) {
      if (!o.alive || o === b || !this.isEnemy(b, o) || o.st.phase) continue;
      const d = Math.hypot(o.x - b.x, o.z - b.z) - o.radius;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  inRadius(x, z, r, filter) {
    return this.balls.filter((o) => o.alive && Math.hypot(o.x - x, o.z - z) < r + o.radius && (!filter || filter(o)));
  }
  addStatus(b, name, t, v = 0) {
    if (!b.alive) return;
    if ((name === 'stun' || name === 'freeze' || name === 'root') && b.isBoss) t *= 0.35;
    const cur = b.st[name];
    if (name === 'poison') {
      const stacks = Math.min(5, (cur ? cur.stacks : 0) + 1);
      b.st.poison = { t: Math.max(t, cur ? cur.t : 0), v, stacks };
      return;
    }
    if (name === 'shield') { b.st.shield = { t, v: Math.max(v, cur ? cur.v : 0) }; return; }
    b.st[name] = { t: Math.max(t, cur ? cur.t : 0), v: Math.max(v, cur ? cur.v : 0) };
  }
  knock(b, dx, dz, force, up = 0) {
    const d = Math.hypot(dx, dz) || 1;
    const f = force / Math.sqrt(b.mass);
    b.vx += (dx / d) * f;
    b.vz += (dz / d) * f;
    if (up && this.arena.gravity > 0) b.vy += up / Math.sqrt(b.mass);
  }
  heal(b, amount, src = b) {
    if (!b.alive || amount <= 0) return;
    const real = Math.min(amount, b.maxHp - b.hp);
    if (real <= 0) return;
    b.hp += real;
    if (src && src.stats) src.stats.healed += real;
    if (real > 2) this.fx.heal(b.x, b.y + b.radius, b.z, Math.round(real));
  }

  // ---------- damage ----------
  dealDamage(src, tgt, base, o = {}) {
    if (!tgt.alive || base <= 0) return 0;
    if (tgt.st.phase && o.kind !== 'dot') return 0;
    if (src && src !== tgt && !this.isEnemy(src, tgt)) return 0;
    const kind = o.kind || 'contact';
    if (tgt.archetype === 'ninja' && kind !== 'dot' && kind !== 'zone' && Math.random() < 0.25) {
      this.fx.text(tgt.x, tgt.y + tgt.radius + 0.5, tgt.z, 'MISS', '#9fd8ff', 0.8);
      return 0;
    }
    let dmg = base;
    let crit = false;
    if (src && src.alive !== undefined) {
      if (src.st.rage) dmg *= 1 + src.st.rage.v;
      if (src.archetype === 'berserker') dmg *= 1 + 1.0 * (1 - src.hp / src.maxHp);
      if (this.mode !== 'ffa' && this.mode !== 'royale') {
        for (const k of this.balls) {
          if (k.alive && k !== src && k.archetype === 'king' && !this.isEnemy(k, src) && Math.hypot(k.x - src.x, k.z - src.z) < 10) { dmg *= 1.25; break; }
        }
      }
      if (!o.noCrit && kind !== 'dot' && Math.random() < src.crit) {
        crit = true;
        dmg *= src.archetype === 'assassin' ? 2.5 : 2;
      }
    }
    const def = tgt.def_ + (tgt.st.armor ? tgt.st.armor.v : 0);
    dmg *= 100 / (100 + Math.max(0, def));
    if (tgt.weapon.type === 'shield' && kind !== 'dot') dmg *= 1 - clamp(tgt.weapon.dmg, 0, 70) / 100;
    if (tgt.st.shield && tgt.st.shield.v > 0) {
      const absorbed = Math.min(tgt.st.shield.v, dmg);
      tgt.st.shield.v -= absorbed;
      dmg -= absorbed;
      if (tgt.st.shield.v <= 0) delete tgt.st.shield;
    }
    if (dmg <= 0) return 0;
    tgt.hp -= dmg;
    tgt.stats.taken += dmg;
    if (src && src.stats) {
      src.stats.dealt += dmg;
      src.stats.recent.push([this.time, dmg]);
    }
    const color = crit ? '#ffdd33' : kind === 'dot' ? (o.color || '#b8ff8a') : '#ffffff';
    if (kind !== 'dot' || dmg > 6) this.fx.hit(tgt.x, tgt.y + tgt.radius, tgt.z, dmg, color, crit, kind);
    // reflect & lifesteal
    if (src && src.alive && src !== tgt) {
      if (tgt.archetype === 'mirror' && kind !== 'reflect' && kind !== 'dot') {
        this.dealDamage(tgt, src, dmg * 0.45, { kind: 'reflect', noCrit: true });
      }
      if (src.archetype === 'vampire' && kind !== 'reflect' && kind !== 'dot') this.heal(src, dmg * 0.45);
    }
    if (kind !== 'dot') {
      if (src && src !== tgt && src.alive) this.fireEvent(src, 'hit', { other: tgt });
      if (tgt.alive) this.fireEvent(tgt, 'hurt', { other: src });
    }
    if (tgt.hp > 0) this.afterHurt(tgt);
    else this.killBall(tgt, src);
    return dmg;
  }

  afterHurt(b) {
    const frac = b.hp / b.maxHp;
    if (!b.lowhpFired && frac < 0.3) { b.lowhpFired = true; this.fireEvent(b, 'lowhp'); }
    if (b.archetype === 'duplicate' && b.gen < 2 && b.splits < 2 && frac < (b.splits === 0 ? 0.66 : 0.33)) {
      b.splits++;
      this.cloneBall(b, true);
    }
    if (b.archetype === 'king' && !b.guards && frac < 0.5) {
      b.guards = true;
      for (let i = 0; i < 2; i++) {
        const m = this.addBall(b.def, b.team, b.x + rand(-2, 2), b.z + rand(-2, 2), { minion: true, owner: b });
        if (m) { m.name = 'Royal Guard'; m.maxHp = m.hp = 90; m.radius = m.baseRadius = 0.65; }
      }
      this.fx.say(b, 'Guards!');
    }
  }

  cloneBall(b, split) {
    const c = this.addBall(b.def, b.team, b.x + rand(-1, 1), b.z + rand(-1, 1), { gen: b.gen + 1 });
    if (!c) return null;
    if (split) {
      const hp = Math.max(1, b.hp * 0.5);
      b.hp = hp; b.maxHp = Math.max(1, b.maxHp * 0.7);
      c.hp = hp; c.maxHp = b.maxHp;
      b.radius *= 0.82; b.mass *= 0.6; c.radius = b.radius; c.mass = b.mass;
      c.splits = b.splits;
      c.name = b.name.replace(/ #\d+$/, '') + ` #${this.balls.filter((o) => o.def === b.def).length}`;
    } else {
      c.hp = c.maxHp = Math.max(1, Math.round(b.maxHp * 0.5));
      c.radius = c.baseRadius = b.radius * 0.8;
      c.name = b.name + ' Clone';
    }
    c.atk = b.atk; c.spd = b.spd;
    this.knock(c, c.x - b.x, c.z - b.z, 10);
    this.knock(b, b.x - c.x, b.z - c.z, 6);
    this.fx.ring(b.x, b.z, b.radius * 2, b.color);
    this.fx.sound('split', 0.7);
    return c;
  }

  killBall(b, killer) {
    if (!b.alive) return;
    if (b.archetype === 'phoenix' && !b.revived) {
      b.revived = true;
      b.hp = b.maxHp * 0.5;
      b.st = {};
      this.addStatus(b, 'haste', 3, 0.5);
      this.fx.revive(b);
      this.fx.explosion(b.x, b.z, 5, '#ff7a1a');
      this.fx.say(b, 'REBORN!');
      for (const e of this.inRadius(b.x, b.z, 5, (o) => this.isEnemy(b, o))) {
        this.dealDamage(b, e, b.atk * 1.5, { kind: 'zone', noCrit: true });
        this.addStatus(e, 'burn', 3, b.atk * 0.3);
      }
      return;
    }
    b.alive = false;
    b.hp = 0;
    if (this.grabbed === b) this.grabbed = null;
    this.fireEvent(b, 'death');
    this.fx.death(b);
    this.fx.sound('death', b.isBoss ? 1.5 : 1);
    if (killer && killer !== b && killer.stats) {
      killer.stats.kills++;
      this.killFeed.push({ t: this.time, killer: killer.name, victim: b.name, color: killer.color });
      if (killer.alive) this.fireEvent(killer, 'kill', { other: b });
    } else {
      this.killFeed.push({ t: this.time, killer: '☠', victim: b.name, color: '#888' });
    }
    if (this.killFeed.length > 30) this.killFeed.shift();
    if (b.archetype === 'bomber') this.explodeAt(b.x, b.z, 6, b.atk * 4, b, '#ff9a2a');
  }

  explodeAt(x, z, r, dmg, src, color = '#ffaa33', hitAllies = false) {
    this.fx.explosion(x, z, r, color);
    this.fx.shake(Math.min(1.2, r / 6));
    this.fx.sound('boom', Math.min(1.5, r / 5));
    for (const o of this.inRadius(x, z, r)) {
      if (src && o === src) continue;
      if (src && !hitAllies && !this.isEnemy(src, o)) continue;
      const d = Math.hypot(o.x - x, o.z - z);
      const fall = 1 - clamp(d / (r + o.radius), 0, 0.7);
      if (src) this.dealDamage(src, o, dmg * fall, { kind: 'zone', noCrit: true });
      else this.dealDamage(null, o, dmg * fall, { kind: 'zone' });
      if (o.alive) this.knock(o, o.x - x, o.z - z, 14 * fall + 4, 6 * fall);
    }
  }

  // ---------- easy code ----------
  fireEvent(b, event, ctx = {}) {
    if (!b.rules.length || this._depth > 2) return;
    for (let i = 0; i < b.rules.length; i++) {
      const r = b.rules[i];
      if (r.event !== event) continue;
      this.tryRule(b, i, ctx);
    }
  }

  tryRule(b, i, ctx) {
    const r = b.rules[i];
    const gap = r.event === 'hit' || r.event === 'hurt' || r.event === 'near' ? 1.2 : 0.3;
    if (this.time - b.ruleLast[i] < gap && r.event !== 'death' && r.event !== 'start') return;
    for (const c of r.conds) {
      if (c.kind === 'chance') { if (Math.random() * 100 >= c.value) return; continue; }
      let v;
      if (c.kind === 'hp') v = (100 * b.hp) / b.maxHp;
      else if (c.kind === 'enemies') v = this.enemiesOf(b).filter((o) => !o.isMinion).length;
      else v = this.alliesOf(b).length;
      if (c.op === '<' ? !(v < c.value) : !(v > c.value)) return;
    }
    b.ruleLast[i] = this.time;
    this._depth++;
    try {
      for (const a of r.actions) this.doAction(b, a, ctx);
    } finally {
      this._depth--;
    }
  }

  doAction(b, a, ctx) {
    if (!b.alive && a.verb !== 'explode' && a.verb !== 'say') return;
    const t = this.nearestEnemy(b);
    switch (a.verb) {
      case 'heal': this.heal(b, (b.maxHp * a.value) / 100); break;
      case 'damage': if (t) { this.dealDamage(b, t, a.value, { kind: 'zone', noCrit: true }); this.fx.beam(b, t, b.color); } break;
      case 'explode': this.explodeAt(b.x, b.z, 5, a.value, b, b.color); break;
      case 'dash': if (t) { this.knock(b, t.x - b.x, t.z - b.z, 22); b.mode = 'charge'; b.modeT = 0.6; } break;
      case 'speed': this.addStatus(b, 'haste', 3, a.value / 100); break;
      case 'shield': this.addStatus(b, 'shield', 4, (b.maxHp * a.value) / 100); break;
      case 'grow': b.radius = Math.min(b.baseRadius * 2.5, b.radius * 1.15); b.mass *= 1.3; this.fx.ring(b.x, b.z, b.radius * 1.5, b.color); break;
      case 'shrink': b.radius = Math.max(b.baseRadius * 0.4, b.radius * 0.87); b.mass *= 0.77; b.spd *= 1.05; break;
      case 'clone': if (b.gen < 3) this.cloneBall(b, false); break;
      case 'summon': this.summon(b); break;
      case 'power': this.castElement(b, true); break;
      case 'pull': for (const e of this.inRadius(b.x, b.z, 12, (o) => this.isEnemy(b, o))) this.knock(e, b.x - e.x, b.z - e.z, 14); this.fx.ring(b.x, b.z, 12, '#b28dff'); break;
      case 'push': for (const e of this.inRadius(b.x, b.z, 8, (o) => this.isEnemy(b, o))) this.knock(e, e.x - b.x, e.z - b.z, 18, 3); this.fx.ring(b.x, b.z, 8, '#9fe8ff'); break;
      case 'teleport': { const p = this.randomPoint(3); this.fx.teleport(b.x, b.z, p.x, p.z, b.color); b.x = p.x; b.z = p.z; b.vx = b.vz = 0; break; }
      case 'ghost': this.addStatus(b, 'phase', 1.5); break;
      case 'freeze': for (const e of this.inRadius(b.x, b.z, 6, (o) => this.isEnemy(b, o))) this.addStatus(e, 'freeze', 1.2); this.fx.ring(b.x, b.z, 6, '#bff4ff'); break;
      case 'rage': this.addStatus(b, 'rage', 4, 0.6); break;
      case 'say': this.fx.say(b, a.text); break;
      default: break;
    }
    void ctx;
  }

  summon(b) {
    const mine = this.balls.filter((o) => o.alive && o.owner === b && o.isMinion).length;
    if (mine >= 3) return;
    const m = this.addBall(b.def, b.team, b.x + rand(-1.5, 1.5), b.z + rand(-1.5, 1.5), { minion: true, owner: b });
    if (m) { this.fx.ring(m.x, m.z, 2, b.color); this.fx.sound('summon', 0.6); }
  }

  // ---------- element powers ----------
  castElement(b, forced = false) {
    const el = b.element;
    let t = b.target && b.target.alive && !b.target.st.phase ? b.target : this.nearestEnemy(b);
    if (!t) return false;
    const dist = Math.hypot(t.x - b.x, t.z - b.z) - t.radius - b.radius;
    if (!forced && dist > ELEMENT_RANGE[el]) return false;
    const A = b.atk;
    switch (el) {
      case 'lightning': {
        const hitList = [];
        const pts = [{ x: b.x, y: b.y, z: b.z }];
        let cur = b;
        for (let k = 0; k < 4; k++) {
          let nxt = null;
          let nd = 12;
          for (const o of this.balls) {
            if (!o.alive || !this.isEnemy(b, o) || hitList.includes(o) || o.st.phase) continue;
            const d = Math.hypot(o.x - cur.x, o.z - cur.z);
            if (d < nd) { nd = d; nxt = o; }
          }
          if (!nxt) break;
          hitList.push(nxt);
          pts.push({ x: nxt.x, y: nxt.y, z: nxt.z });
          cur = nxt;
        }
        this.fx.lightning(pts, '#fff3a0');
        this.fx.sound('zap', 1);
        hitList.forEach((o, k) => { this.dealDamage(b, o, A * (1 - k * 0.15) * 0.9, { kind: 'power' }); this.addStatus(o, 'stun', 0.45); });
        break;
      }
      case 'fire':
        this.shoot(b, t, { speed: 22, dmg: A * 1.1, r: 0.45, element: 'fire', aoe: 2.6, color: '#ff6a1a' });
        this.fx.sound('whoosh', 0.7);
        break;
      case 'ice': {
        const base = Math.atan2(t.z - b.z, t.x - b.x);
        for (let k = -2; k <= 2; k++) this.shoot(b, null, { angle: base + k * 0.16, speed: 26, dmg: A * 0.5, r: 0.3, element: 'ice', color: '#bff4ff' });
        this.fx.sound('shard', 0.7);
        break;
      }
      case 'water':
        this.fx.ring(b.x, b.z, 8, '#3a9bff');
        this.fx.sound('wave', 0.8);
        for (const e of this.inRadius(b.x, b.z, 8, (o) => this.isEnemy(b, o))) {
          this.dealDamage(b, e, A * 0.7, { kind: 'power' });
          this.knock(e, e.x - b.x, e.z - b.z, 20, 2);
        }
        break;
      case 'earth':
        this.fx.ring(b.x, b.z, 6.5, '#a8743a');
        this.fx.shake(0.6);
        this.fx.sound('quake', 1);
        for (const e of this.inRadius(b.x, b.z, 6.5, (o) => this.isEnemy(b, o))) {
          this.dealDamage(b, e, A * 0.8, { kind: 'power' });
          this.addStatus(e, 'stun', 0.8);
          this.knock(e, e.x - b.x, e.z - b.z, 6, 8);
        }
        this.addStatus(b, 'armor', 3, 40);
        break;
      case 'wind':
        this.addStatus(b, 'haste', 2.2, 0.7);
        this.knock(b, t.x - b.x, t.z - b.z, 16);
        this.fx.ring(b.x, b.z, 6, '#dffff4');
        this.fx.sound('whoosh', 0.9);
        for (const e of this.inRadius(b.x, b.z, 6, (o) => this.isEnemy(b, o))) this.knock(e, e.x - b.x, e.z - b.z, 16, 4);
        break;
      case 'poison':
        this.zones.push({ type: 'poison', x: t.x, z: t.z, r: 3.6, t: 0, dur: 4.5, owner: b, team: b.team, dps: A * 0.45, color: '#7dff3a' });
        this.fx.sound('hiss', 0.6);
        break;
      case 'light':
        this.fx.beam(b, t, '#fff6c8', 0.35);
        this.fx.sound('holy', 0.8);
        this.dealDamage(b, t, A * 1.3, { kind: 'power' });
        this.heal(b, b.maxHp * 0.08);
        break;
      case 'shadow': {
        const ang = Math.atan2(t.vz, t.vx) + Math.PI;
        const nx = t.x + Math.cos(ang) * (t.radius + b.radius + 0.3);
        const nz = t.z + Math.sin(ang) * (t.radius + b.radius + 0.3);
        if (this.wallDistance(nx, nz) > b.radius) {
          this.fx.teleport(b.x, b.z, nx, nz, '#8a5cff');
          b.x = nx; b.z = nz;
        }
        this.dealDamage(b, t, A * 1.1, { kind: 'power' });
        this.knock(t, t.x - b.x, t.z - b.z, 10);
        this.fx.sound('blink', 0.8);
        break;
      }
      case 'void':
        this.zones.push({ type: 'void', x: t.x, z: t.z, r: 7, t: 0, dur: 2.8, owner: b, team: b.team, dps: A * 0.55, color: '#a050ff' });
        this.fx.sound('void', 1);
        break;
      case 'metal':
        this.addStatus(b, 'armor', 3.5, 120);
        this.fx.ring(b.x, b.z, b.radius * 2, '#e0e6f0');
        this.fx.sound('clang', 0.8);
        break;
      case 'nature':
        this.addStatus(t, 'root', 1.6);
        this.addStatus(b, 'regen', 3, b.maxHp * 0.03);
        this.fx.beam(b, t, '#4cff6a', 0.3);
        this.fx.sound('grow', 0.6);
        break;
      case 'cosmic':
        this.zones.push({ type: 'meteor', x: t.x + t.vx * 0.3, z: t.z + t.vz * 0.3, r: 4, t: 0, dur: 0.9, owner: b, team: b.team, dmg: A * 2, color: '#8f7bff' });
        this.fx.sound('meteor', 0.8);
        break;
      default: break;
    }
    return true;
  }

  // element bonus effects on contact / projectile hits
  elementOnHit(src, tgt, dmg, element = src.element) {
    if (!tgt.alive) return;
    switch (element) {
      case 'lightning': if (Math.random() < 0.25) { this.addStatus(tgt, 'stun', 0.3); this.fx.spark(tgt.x, tgt.y, tgt.z, '#fff27a', 10); } break;
      case 'fire': this.addStatus(tgt, 'burn', 3, src.atk * 0.3); break;
      case 'ice': this.addStatus(tgt, 'slow', 2, 0.4); if (Math.random() < 0.15) this.addStatus(tgt, 'freeze', 1); break;
      case 'water': this.knock(tgt, tgt.x - src.x, tgt.z - src.z, 6); break;
      case 'earth': if (this.arena.gravity > 0) tgt.vy += 5 / Math.sqrt(tgt.mass); break;
      case 'wind': this.knock(tgt, tgt.x - src.x, tgt.z - src.z, 8); break;
      case 'poison': this.addStatus(tgt, 'poison', 4, src.atk * 0.12); break;
      case 'light': this.heal(src, dmg * 0.15); break;
      case 'shadow': this.heal(src, dmg * 0.2); break;
      case 'void': this.dealDamage(src, tgt, dmg * 0.15, { kind: 'dot', color: '#c080ff' }); break;
      case 'metal': this.dealDamage(src, tgt, dmg * 0.15, { kind: 'dot', color: '#dde3ea' }); break;
      case 'nature': if (Math.random() < 0.15) this.addStatus(tgt, 'root', 0.8); break;
      case 'cosmic': if (Math.random() < 0.2) this.dealDamage(src, tgt, src.atk * 0.6, { kind: 'dot', color: '#a99bff' }); break;
      default: break;
    }
  }

  shoot(b, t, o) {
    let ang = o.angle;
    if (ang === undefined) {
      const lead = t ? Math.hypot(t.x - b.x, t.z - b.z) / o.speed : 0;
      const tx = t.x + t.vx * lead * 0.6;
      const tz = t.z + t.vz * lead * 0.6;
      ang = Math.atan2(tz - b.z, tx - b.x);
    }
    const sx = o.from ? o.from.x : b.x + Math.cos(ang) * (b.radius + 0.4);
    const sz = o.from ? o.from.z : b.z + Math.sin(ang) * (b.radius + 0.4);
    this.projectiles.push({
      id: this.nextId++, x: sx, y: o.from ? o.from.y : b.y, z: sz,
      vx: Math.cos(ang) * o.speed, vz: Math.sin(ang) * o.speed,
      r: o.r || 0.3, dmg: o.dmg, owner: b, team: b.team, element: o.element || null, aoe: o.aoe || 0,
      color: o.color || b.color, life: o.life || 2.5, alive: true,
    });
  }

  // ---------- archetype abilities ----------
  archetypeTick(b, dt) {
    b.cdArch -= dt;
    const ready = b.cdArch <= 0;
    const t = b.target && b.target.alive ? b.target : null;
    switch (b.archetype) {
      case 'giant':
        if (ready && t && Math.hypot(t.x - b.x, t.z - b.z) < b.radius + 6) {
          b.cdArch = 7;
          this.fx.ring(b.x, b.z, b.radius + 5, '#c9a36b');
          this.fx.shake(0.8);
          this.fx.sound('quake', 1.2);
          for (const e of this.inRadius(b.x, b.z, b.radius + 5, (o) => this.isEnemy(b, o))) {
            this.dealDamage(b, e, b.atk * 0.9, { kind: 'power' });
            this.knock(e, e.x - b.x, e.z - b.z, 14, 7);
          }
        }
        break;
      case 'ninja':
        if (ready && t) { b.cdArch = 3; this.knock(b, t.x - b.x, t.z - b.z, 20); b.mode = 'charge'; b.modeT = 0.5; this.fx.ring(b.x, b.z, 1.5, '#ffffff'); }
        break;
      case 'bomber':
        if (ready && t) {
          b.cdArch = 5;
          this.zones.push({ type: 'bomb', x: b.x, z: b.z, r: 4, t: 0, dur: 1.6, owner: b, team: b.team, dmg: b.atk * 2.8, color: '#ff9a2a' });
        }
        break;
      case 'healer':
        if (ready) {
          b.cdArch = 4;
          this.heal(b, b.maxHp * 0.06);
          const allies = this.alliesOf(b).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp);
          if (allies[0] && allies[0].hp < allies[0].maxHp) { this.heal(allies[0], allies[0].maxHp * 0.12, b); this.fx.beam(b, allies[0], '#6dff9a', 0.3); }
        }
        break;
      case 'summoner':
        if (ready) { b.cdArch = 5; this.summon(b); }
        break;
      case 'magnet':
        for (const e of this.inRadius(b.x, b.z, 11, (o) => this.isEnemy(b, o))) {
          const d = Math.hypot(e.x - b.x, e.z - b.z) || 1;
          e.vx += ((b.x - e.x) / d) * 6 * dt; e.vz += ((b.z - e.z) / d) * 6 * dt;
        }
        if (ready && t) {
          b.cdArch = 5;
          this.fx.ring(b.x, b.z, 11, '#ff4d6d');
          for (const e of this.inRadius(b.x, b.z, 11, (o) => this.isEnemy(b, o))) this.knock(e, b.x - e.x, b.z - e.z, 16);
        }
        break;
      case 'ghost':
        if (ready && t) { b.cdArch = 4.5; this.addStatus(b, 'phase', 1.6); this.fx.sound('blink', 0.5); }
        if (b.st.phase && b.st.phase.t < 0.1 && t) { this.knock(b, t.x - b.x, t.z - b.z, 18); b.mode = 'charge'; b.modeT = 0.5; }
        break;
      case 'sniper':
        if (ready && t) { b.cdArch = 1.8; this.shoot(b, t, { speed: 34, dmg: b.atk * 0.8, r: 0.22, element: b.element, color: b.color }); this.fx.sound('shot', 0.4); }
        break;
      case 'time':
        for (const e of this.inRadius(b.x, b.z, 8, (o) => this.isEnemy(b, o))) this.addStatus(e, 'slow', 0.25, 0.5);
        if (ready && t && Math.hypot(t.x - b.x, t.z - b.z) < 8) {
          b.cdArch = 6;
          this.fx.ring(b.x, b.z, 8, '#ffe8a0');
          this.fx.say(b, 'Time Stop!');
          for (const e of this.inRadius(b.x, b.z, 8, (o) => this.isEnemy(b, o))) this.addStatus(e, 'stun', 1.5);
        }
        break;
      case 'gravity':
        if (ready && t) {
          b.cdArch = 7;
          b.pullT = 1;
          this.fx.ring(b.x, b.z, 14, '#7a5cff');
        }
        if (b.pullT > 0) {
          b.pullT -= dt;
          for (const e of this.inRadius(b.x, b.z, 14, (o) => this.isEnemy(b, o))) {
            const d = Math.hypot(e.x - b.x, e.z - b.z) || 1;
            e.vx += ((b.x - e.x) / d) * 30 * dt; e.vz += ((b.z - e.z) / d) * 30 * dt;
          }
          if (b.pullT <= 0) {
            this.fx.shake(0.7);
            this.fx.ring(b.x, b.z, 5, '#b9a6ff');
            for (const e of this.inRadius(b.x, b.z, 5, (o) => this.isEnemy(b, o))) { this.dealDamage(b, e, b.atk * 1.4, { kind: 'power' }); this.knock(e, e.x - b.x, e.z - b.z, 10, 6); }
          }
        }
        break;
      case 'shapeshifter':
        if (ready) {
          b.cdArch = 6;
          b.element = pick(ELEMENT_KEYS.filter((k) => k !== b.element));
          b.color = ELEMENTS[b.element].color;
          b.cdElem = Math.min(b.cdElem, 0.5);
          this.fx.ring(b.x, b.z, b.radius * 2, b.color);
        }
        break;
      case 'tank':
        if (ready && b.hp < b.maxHp * 0.85) { b.cdArch = 9; this.addStatus(b, 'shield', 4, b.maxHp * 0.2); }
        break;
      case 'assassin':
        if (ready && t) {
          b.cdArch = 5;
          const ang = Math.atan2(t.z - b.z, t.x - b.x);
          const nx = t.x - Math.cos(ang) * (t.radius + b.radius + 0.2);
          const nz = t.z - Math.sin(ang) * (t.radius + b.radius + 0.2);
          this.fx.teleport(b.x, b.z, nx, nz, '#ff3355');
          b.x = nx; b.z = nz;
          this.dealDamage(b, t, b.atk * 1.4, { kind: 'power' });
        }
        break;
      default: break;
    }
  }

  // ---------- weapons ----------
  weaponTick(b, dt) {
    const w = b.weapon;
    if (w.type === 'none' || w.type === 'spikes' || w.type === 'shield') return;
    const scale = b.atk / 10;
    if (w.type === 'blades' || w.type === 'hammer') {
      w.angle += w.speed * dt;
      for (const [k, v] of b.weaponHit) { if (v - dt <= 0) b.weaponHit.delete(k); else b.weaponHit.set(k, v - dt); }
      for (let i = 0; i < w.count; i++) {
        const p = weaponOrbit(b, i);
        for (const e of this.balls) {
          if (!e.alive || !this.isEnemy(b, e) || e.st.phase) continue;
          if (Math.abs(e.y - p.y) > e.radius + w.size) continue;
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (d < e.radius + w.size && !b.weaponHit.has(e.id)) {
            b.weaponHit.set(e.id, w.type === 'hammer' ? 0.6 : 0.35);
            this.dealDamage(b, e, w.dmg * scale, { kind: 'weapon' });
            this.knock(e, e.x - b.x, e.z - b.z, w.type === 'hammer' ? 12 : 3, w.type === 'hammer' ? 3 : 0);
            this.fx.spark(p.x, p.y, p.z, w.color, w.type === 'hammer' ? 18 : 6);
            this.fx.sound(w.type === 'hammer' ? 'clang' : 'slice', 0.4);
          }
        }
      }
    } else if (w.type === 'laser') {
      w.cd -= dt;
      if (w.cd <= 0) {
        const t = this.nearestEnemy(b, 15);
        if (t) {
          w.cd = Math.max(0.4, w.speed);
          this.fx.beam(b, t, w.color === '#dfe8ff' ? '#ff2a2a' : w.color, 0.18);
          this.dealDamage(b, t, w.dmg * scale, { kind: 'weapon' });
          this.fx.sound('laser', 0.4);
        }
      }
    } else if (w.type === 'drones') {
      w.angle += 1.5 * dt;
      w.cd -= dt;
      if (w.cd <= 0) {
        const t = this.nearestEnemy(b, 18);
        if (t) {
          w.cd = Math.max(0.3, w.speed);
          for (let i = 0; i < w.count; i++) {
            const p = weaponOrbit(b, i);
            const ang = Math.atan2(t.z - p.z, t.x - p.x);
            this.shoot(b, null, { angle: ang, from: p, speed: 30, dmg: w.dmg * scale, r: 0.15, color: w.color === '#dfe8ff' ? '#7fe3ff' : w.color, life: 1.2 });
          }
        }
      }
    }
  }

  // ---------- AI ----------
  ai(b, dt) {
    b.retarget -= dt;
    if (b.retarget <= 0 || !b.target || !b.target.alive || b.target.st.phase) {
      b.retarget = rand(0.6, 1.4);
      const enemies = this.enemiesOf(b).filter((o) => !o.st.phase);
      if (!enemies.length) b.target = null;
      else if (b.archetype === 'assassin') b.target = enemies.reduce((p, q) => (q.hp < p.hp ? q : p));
      else {
        let best = null;
        let bs = Infinity;
        for (const o of enemies) {
          const s = Math.hypot(o.x - b.x, o.z - b.z) * rand(0.7, 1.3) + (o.isMinion ? 6 : 0);
          if (s < bs) { bs = s; best = o; }
        }
        b.target = best;
      }
    }
    const t = b.target;
    let ax = 0;
    let az = 0;
    const mult = this.speedMul(b);
    const accel = b.spd * 2.8 * mult * clamp(this.friction, 0.25, 1.2) * this.arena.accelMul;
    if (!t) {
      ax = -b.x; az = -b.z;
    } else {
      const dx = t.x - b.x;
      const dz = t.z - b.z;
      const d = Math.hypot(dx, dz) || 1;
      const nx = dx / d;
      const nz = dz / d;
      b.modeT -= dt;
      if (b.archetype === 'sniper') {
        if (d < 8) { ax = -nx; az = -nz; } else if (d > 14) { ax = nx; az = nz; } else { ax = -nz; az = nx; }
      } else if (b.mode === 'approach') {
        ax = nx; az = nz;
        if (d < 7 + t.radius + b.radius && b.modeT <= 0) { b.mode = 'charge'; b.modeT = 0.7; }
      } else if (b.mode === 'charge') {
        ax = nx * 2.2; az = nz * 2.2;
        if (b.modeT <= 0) { b.mode = 'recoil'; b.modeT = rand(0.3, 0.6); b.side = Math.random() < 0.5 ? -1 : 1; }
      } else {
        ax = -nx * 0.6 + -nz * b.side; az = -nz * 0.6 + nx * b.side;
        if (b.modeT <= 0) { b.mode = 'approach'; b.modeT = rand(0.4, 1.4); }
      }
      // avoid walls a bit
      const wd = this.wallDistance(b.x, b.z);
      if (wd < b.radius + 1.5) { ax -= b.x * 0.05; az -= b.z * 0.05; }
    }
    const al = Math.hypot(ax, az) || 1;
    const k = Math.min(2.2, al);
    b.vx += (ax / al) * accel * k * dt;
    b.vz += (az / al) * accel * k * dt;
  }

  speedMul(b) {
    let m = 1;
    if (b.st.slow) m *= 1 - clamp(b.st.slow.v, 0, 0.8);
    if (b.st.haste) m *= 1 + b.st.haste.v;
    return m;
  }

  // ---------- statuses ----------
  statusTick(b, dt) {
    const st = b.st;
    for (const key of Object.keys(st)) {
      const s = st[key];
      if (!s || b.st !== st) continue;
      s.t -= dt;
      if (key === 'burn') this.dealDamage(null, b, s.v * dt, { kind: 'dot', color: '#ff9a4a' });
      else if (key === 'poison') this.dealDamage(null, b, s.v * s.stacks * dt, { kind: 'dot', color: '#9dff5a' });
      else if (key === 'regen') this.heal(b, s.v * dt);
      if (!b.alive) return;
      if (s.t <= 0) delete st[key];
    }
    if (b.regen) this.heal(b, b.maxHp * b.regen * dt);
  }

  // ---------- main step ----------
  step(dtIn) {
    if (this.over) return;
    const steps = Math.max(1, Math.ceil(dtIn / (1 / 60)));
    const dt = dtIn / steps;
    for (let i = 0; i < steps && !this.over; i++) this.substep(dt);
  }

  substep(dt) {
    this.time += dt;
    const H = this.arena.hazards;
    // shrinking ring
    if (this.shrink) {
      const dur = this.arena.timeLimit ? this.arena.timeLimit * 0.7 : 100;
      this.scale = Math.max(0.35, 1 - (0.65 * Math.max(0, this.time - 5)) / dur);
    }
    // global hazards
    if (H.meteors) {
      this.hazardT.meteor -= dt;
      if (this.hazardT.meteor <= 0) {
        this.hazardT.meteor = rand(2, 4);
        const p = this.randomPoint(1);
        this.zones.push({ type: 'meteor', x: p.x, z: p.z, r: 3.5, t: 0, dur: 1.1, owner: null, team: -1, dmg: 45, color: '#ff7a3a' });
      }
    }
    if (H.storm) {
      this.hazardT.storm -= dt;
      if (this.hazardT.storm <= 0) {
        this.hazardT.storm = rand(1.5, 3);
        const alive = this.balls.filter((b) => b.alive);
        const p = alive.length && Math.random() < 0.6 ? pick(alive) : this.randomPoint(1);
        this.zones.push({ type: 'strike', x: p.x, z: p.z, r: 2.4, t: 0, dur: 0.5, owner: null, team: -1, dmg: 32, color: '#cfe8ff' });
      }
    }
    if (H.spinner) this.spinAngle += 1.3 * dt;

    for (const b of this.balls) {
      if (!b.alive) continue;
      this.statusTick(b, dt);
      if (!b.alive) continue;
      if (b === this.grabbed) continue;
      const stunned = b.st.stun || b.st.freeze;
      const grounded = b.y <= b.radius + 0.05;
      if (!stunned) {
        if (grounded && !b.st.root) {
          const pre = Math.hypot(b.vx, b.vz);
          this.ai(b, dt);
          if (this.arena.momentum) {
            // steering can turn the ball, but only adds speed up to its cruise speed
            const lim = Math.max(pre, b.spd * this.speedMul(b) * Math.sqrt(this.arena.accelMul) * 1.6);
            const post = Math.hypot(b.vx, b.vz);
            if (post > lim) { b.vx *= lim / post; b.vz *= lim / post; }
          }
        }
        else if (!grounded) { /* airborne: no steering */ }
        b.cdElem -= dt;
        if (b.cdElem <= 0) {
          if (this.castElement(b)) b.cdElem = ELEMENT_CD[b.element] * rand(0.85, 1.15);
          else b.cdElem = 0.5;
        }
        this.archetypeTick(b, dt);
        this.weaponTick(b, dt);
      }
      // easy code timers + near
      for (let i = 0; i < b.rules.length; i++) {
        const r = b.rules[i];
        if (r.event === 'every') {
          b.ruleT[i] -= dt;
          if (b.ruleT[i] <= 0) { b.ruleT[i] = r.every; this.tryRule(b, i, {}); }
        } else if (r.event === 'near' && this.time - b.ruleLast[i] > 1) {
          const e = this.nearestEnemy(b, 4);
          if (e) this.tryRule(b, i, { other: e });
        }
      }
      if (!b.alive) continue;
      // lava edge
      if (H.lava && this.wallDistance(b.x, b.z) < 2.4 + b.radius) this.addStatus(b, 'burn', 1, 14);
      // integrate
      const drag = stunned ? 3 : b.st.root ? 8 : this.friction * 0.55;
      if (b.y <= b.radius + 0.05 && (!this.arena.momentum || stunned || b.st.root)) {
        const f = 1 / (1 + drag * dt);
        b.vx *= f; b.vz *= f;
      }
      const maxSp = b.spd * this.speedMul(b) * (b.mode === 'charge' ? 1.9 : 1.15) * Math.sqrt(this.arena.accelMul);
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > maxSp && !this.arena.momentum) {
        const k = 1 - Math.min(1, ((sp - maxSp) / sp) * 2.5 * dt);
        b.vx *= k; b.vz *= k;
      }
      if (sp > 80) { b.vx *= 80 / sp; b.vz *= 80 / sp; }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      const g = 28 * this.arena.gravity;
      b.vy -= g * dt;
      b.y += b.vy * dt;
      if (b.y < b.radius) { b.y = b.radius; b.vy = b.vy < -4 ? -b.vy * (this.arena.momentum ? this.bounce : 0.35) : 0; }
      if (this.arena.gravity === 0) { if (!this.arena.momentum) b.vy *= 0.98; if (b.y > 6) { b.y = 6; b.vy = -Math.abs(b.vy); } }
      if (b.y > 30) { b.y = 30; b.vy = 0; }
      b.portalCd -= dt;
    }
    this.collideBalls();
    for (const b of this.balls) if (b.alive) this.contain(b);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.sample(dt);
    this.checkEnd();
  }

  collideBalls() {
    const arr = this.balls;
    const n = arr.length;
    for (let i = 0; i < n; i++) {
      const a = arr[i];
      if (!a.alive || a.st.phase) continue;
      for (let j = i + 1; j < n; j++) {
        const b = arr[j];
        if (!b.alive || b.st.phase) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const rr = a.radius + b.radius;
        if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
        if (Math.abs(a.y - b.y) > rr * 0.85) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.0001;
        const nx = dx / d;
        const nz = dz / d;
        const pen = rr - d;
        const ima = a === this.grabbed ? 0 : 1 / a.mass;
        const imb = b === this.grabbed ? 0 : 1 / b.mass;
        const sum = ima + imb || 1;
        a.x -= nx * pen * (ima / sum); a.z -= nz * pen * (ima / sum);
        b.x += nx * pen * (imb / sum); b.z += nz * pen * (imb / sum);
        const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (vn <= 0) continue;
        const e = this.bounce;
        const jImp = ((1 + e) * vn) / sum;
        a.vx -= jImp * ima * nx; a.vz -= jImp * ima * nz;
        b.vx += jImp * imb * nx; b.vz += jImp * imb * nz;
        if (!this.isEnemy(a, b) || vn < 1.5) continue;
        const key = a.id < b.id ? a.id * 100000 + b.id : b.id * 100000 + a.id;
        const last = this.pairHit.get(key) || -9;
        if (this.time - last < 0.25) continue;
        this.pairHit.set(key, this.time);
        const impact = Math.min(vn, 40);
        const mA = Math.pow((2 * a.mass) / (a.mass + b.mass), 0.2);
        const mB = Math.pow((2 * b.mass) / (a.mass + b.mass), 0.2);
        const spikeA = a.weapon.type === 'spikes' ? 1 + a.weapon.dmg / 100 : 1;
        const spikeB = b.weapon.type === 'spikes' ? 1 + b.weapon.dmg / 100 : 1;
        const dmgToB = a.atk * (0.4 + impact * 0.065) * mA * spikeA * (a.mode === 'charge' ? 1.25 : 1);
        const dmgToA = b.atk * (0.4 + impact * 0.065) * mB * spikeB * (b.mode === 'charge' ? 1.25 : 1);
        const cx = a.x + nx * a.radius;
        const cz = a.z + nz * a.radius;
        this.fx.spark(cx, (a.y + b.y) / 2, cz, '#ffffff', Math.min(24, 4 + impact | 0));
        if (impact > 12) this.fx.shake(Math.min(0.6, impact / 50));
        this.fx.sound('hit', Math.min(1, impact / 20));
        const realB = this.dealDamage(a, b, dmgToB, { kind: 'contact' });
        if (realB > 0 && a.alive) this.elementOnHit(a, b, realB);
        const realA = this.dealDamage(b, a, dmgToA, { kind: 'contact' });
        if (realA > 0 && b.alive) this.elementOnHit(b, a, realA);
      }
    }
    if (this.pairHit.size > 4000) this.pairHit.clear();
  }

  contain(b) {
    const e = this.bounce;
    let impact = 0;
    const R = this.R;
    if (!this.sides) {
      const d = Math.hypot(b.x, b.z) || 0.0001;
      if (d > R - b.radius) {
        const nx = b.x / d;
        const nz = b.z / d;
        b.x = nx * (R - b.radius); b.z = nz * (R - b.radius);
        const vn = b.vx * nx + b.vz * nz;
        if (vn > 0) { b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz; impact = Math.max(impact, vn); }
      }
    } else {
      const n = this.sides;
      const apo = R * Math.cos(Math.PI / n);
      for (let i = 0; i < n; i++) {
        const ang = ((2 * i + 2) * Math.PI) / n;
        const nx = Math.cos(ang);
        const nz = Math.sin(ang);
        const dd = b.x * nx + b.z * nz;
        if (dd > apo - b.radius) {
          const pen = dd - (apo - b.radius);
          b.x -= nx * pen; b.z -= nz * pen;
          const vn = b.vx * nx + b.vz * nz;
          if (vn > 0) { b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz; impact = Math.max(impact, vn); }
        }
      }
    }
    if (this.innerFrac) {
      const ri = R * this.innerFrac;
      const d = Math.hypot(b.x, b.z) || 0.0001;
      if (d < ri + b.radius) {
        const nx = b.x / d;
        const nz = b.z / d;
        b.x = nx * (ri + b.radius); b.z = nz * (ri + b.radius);
        const vn = -(b.vx * nx + b.vz * nz);
        if (vn > 0) { b.vx += (1 + e) * vn * nx; b.vz += (1 + e) * vn * nz; impact = Math.max(impact, vn); }
      }
    }
    if (impact > 6 && this.arena.hazards.spikes) {
      this.dealDamage(null, b, impact * 1.4, { kind: 'zone' });
      this.fx.spark(b.x, b.y, b.z, '#ff5a5a', 10);
    }
    // bumpers
    for (const p of this.bumpers) {
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const d = Math.hypot(dx, dz) || 0.0001;
      if (d < p.r + b.radius) {
        const nx = dx / d;
        const nz = dz / d;
        b.x = p.x + nx * (p.r + b.radius); b.z = p.z + nz * (p.r + b.radius);
        const vn = -(b.vx * nx + b.vz * nz);
        b.vx += nx * (Math.max(0, vn) * 1.6 + 10); b.vz += nz * (Math.max(0, vn) * 1.6 + 10);
        p.flash = 0.3;
        this.fx.sound('boing', 0.6);
      }
    }
    // portals
    if (b.portalCd <= 0) {
      for (const p of this.portals) {
        if (Math.hypot(b.x - p.x, b.z - p.z) < 1.1) {
          const q = this.portals[p.pair];
          const sp = Math.hypot(b.vx, b.vz) || 1;
          this.fx.teleport(b.x, b.z, q.x, q.z, p.color);
          b.x = q.x + (b.vx / sp) * 1.8; b.z = q.z + (b.vz / sp) * 1.8;
          b.portalCd = 1.2;
          break;
        }
      }
    }
    // spinner
    if (this.arena.hazards.spinner) {
      const L = this.arena.size * 0.45 * this.scale;
      const cx = Math.cos(this.spinAngle);
      const cz = Math.sin(this.spinAngle);
      const tproj = clamp(b.x * cx + b.z * cz, -L, L);
      const px = cx * tproj;
      const pz = cz * tproj;
      const dx = b.x - px;
      const dz = b.z - pz;
      const d = Math.hypot(dx, dz) || 0.0001;
      if (d < b.radius + 0.45 && b.y < b.radius + 1.2) {
        const nx = dx / d;
        const nz = dz / d;
        b.x = px + nx * (b.radius + 0.45); b.z = pz + nz * (b.radius + 0.45);
        const tv = 1.3 * tproj; // tangential speed of bar at that point
        b.vx += nx * 8 + -cz * tv; b.vz += nz * 8 + cx * tv;
        if (!b.spinHitT || this.time - b.spinHitT > 0.5) { b.spinHitT = this.time; this.dealDamage(null, b, 8, { kind: 'zone' }); }
      }
    }
    if (!Number.isFinite(b.x) || !Number.isFinite(b.z)) { b.x = 0; b.z = 0; b.vx = 0; b.vz = 0; }
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.life <= 0 || this.wallDistance(p.x, p.z) < 0 || (this.innerFrac && Math.hypot(p.x, p.z) < this.R * this.innerFrac)) {
        p.alive = false;
        if (p.aoe) this.projectileBoom(p);
        continue;
      }
      for (const o of this.balls) {
        if (!o.alive || o.team === p.team || o.st.phase) continue;
        if (Math.hypot(o.x - p.x, o.z - p.z) < o.radius + p.r) {
          p.alive = false;
          const src = p.owner;
          const real = this.dealDamage(src, o, p.dmg, { kind: 'proj' });
          if (real > 0 && p.element && src) this.elementOnHit(src, o, real, p.element);
          this.knock(o, p.vx, p.vz, 4);
          this.fx.spark(p.x, p.y, p.z, p.color, 8);
          if (p.aoe) this.projectileBoom(p);
          break;
        }
      }
    }
    if (this.projectiles.length > 60) this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  projectileBoom(p) {
    this.fx.explosion(p.x, p.z, p.aoe, p.color);
    for (const o of this.inRadius(p.x, p.z, p.aoe)) {
      if (o.team === p.team) continue;
      this.dealDamage(p.owner, o, p.dmg * 0.5, { kind: 'zone', noCrit: true });
      if (p.element === 'fire') this.addStatus(o, 'burn', 3, (p.owner ? p.owner.atk : 10) * 0.3);
    }
  }

  updateZones(dt) {
    for (const z of this.zones) {
      z.t += dt;
      const enemyOf = (o) => z.team === -1 || o.team !== z.team;
      if (z.type === 'poison') {
        for (const o of this.inRadius(z.x, z.z, z.r, enemyOf)) this.dealDamage(z.owner && z.owner.alive ? z.owner : null, o, z.dps * dt, { kind: 'dot', color: '#9dff5a' });
      } else if (z.type === 'void' || z.type === 'well') {
        for (const o of this.inRadius(z.x, z.z, z.r, enemyOf)) {
          if (o === this.grabbed) continue;
          const d = Math.hypot(o.x - z.x, o.z - z.z) || 1;
          const pull = (z.type === 'well' ? 40 : 26) * (1 - d / (z.r + 2));
          o.vx += ((z.x - o.x) / d) * pull * dt; o.vz += ((z.z - o.z) / d) * pull * dt;
          if (z.dps) this.dealDamage(z.owner && z.owner.alive ? z.owner : null, o, z.dps * dt, { kind: 'dot', color: '#c080ff' });
        }
      } else if (!z.done && z.t >= z.dur && (z.type === 'meteor' || z.type === 'bomb' || z.type === 'strike')) {
        z.done = true;
        const src = z.owner && z.owner.alive ? z.owner : null;
        if (z.type === 'strike') {
          this.fx.lightning([{ x: z.x + rand(-2, 2), y: 18, z: z.z + rand(-2, 2) }, { x: z.x, y: 0.3, z: z.z }], '#e6f2ff');
          this.fx.sound('thunder', 1);
          for (const o of this.inRadius(z.x, z.z, z.r)) { this.dealDamage(null, o, z.dmg, { kind: 'zone' }); this.addStatus(o, 'stun', 0.5); }
          this.fx.ring(z.x, z.z, z.r, z.color);
        } else {
          this.explodeAt(z.x, z.z, z.r, z.dmg, src, z.color);
          if (!src && z.owner === null) { /* neutral meteor already handled by explodeAt(null) */ }
        }
      }
    }
    this.zones = this.zones.filter((z) => z.t < z.dur + (z.done ? 0.05 : 0));
  }

  sample(dt) {
    this.sampleT -= dt;
    // dps
    for (const b of this.balls) {
      const r = b.stats.recent;
      while (r.length && r[0][0] < this.time - 3) r.shift();
      let s = 0;
      for (const x of r) s += x[1];
      b.stats.dps = s / 3;
      if (b.stats.dps > b.stats.peakDps) b.stats.peakDps = b.stats.dps;
    }
    if (this.sampleT > 0) return;
    this.sampleT = 0.5;
    const teams = {};
    for (const b of this.balls) {
      if (b.isMinion) continue;
      b.hpHist.push(Math.max(0, b.hp / b.maxHp));
      if (b.hpHist.length > 800) b.hpHist.shift();
      if (!teams[b.team]) teams[b.team] = 0;
      teams[b.team] += Math.max(0, b.hp);
    }
    this.history.push({ t: this.time, teams });
    if (this.history.length > 800) this.history.shift();
  }

  aliveTeams() {
    const set = new Set();
    for (const b of this.balls) if (b.alive && !b.isMinion) set.add(b.team);
    return set;
  }

  checkEnd() {
    const teams = this.aliveTeams();
    if (this.mode === 'survival') {
      if (!teams.has(1)) { this.finish(2); return; }
      if (!teams.has(2) && this.time > 1) { if (!this.wavePool.length) this.finish(1); else this.spawnWave(); }
      return;
    }
    if (teams.size <= 1) {
      // clean up orphan minions
      for (const b of this.balls) if (b.alive && b.isMinion && !teams.has(b.team)) { b.alive = false; this.fx.death(b); }
      this.finish(teams.size ? [...teams][0] : null);
      return;
    }
    if (this.arena.timeLimit && this.time >= this.arena.timeLimit) {
      const score = {};
      for (const b of this.balls) if (b.alive && !b.isMinion) score[b.team] = (score[b.team] || 0) + b.hp / b.maxHp;
      let best = null;
      let bs = -1;
      for (const [k, v] of Object.entries(score)) if (v > bs) { bs = v; best = +k; }
      this.finish(best);
    }
  }

  finish(team) {
    this.over = true;
    this.winnerTeam = team;
    const alive = this.balls.filter((b) => b.alive && !b.isMinion && b.team === team);
    this.winnerBall = alive.sort((p, q) => q.hp - p.hp)[0] || null;
    this.fx.sound('win', 1);
  }

  mvp() {
    return this.balls.filter((b) => !b.isMinion).sort((p, q) => q.stats.dealt - p.stats.dealt)[0] || null;
  }

  // ---------- sandbox ----------
  ballAt(x, z, extra = 1.2) {
    let best = null;
    let bd = Infinity;
    for (const b of this.balls) {
      if (!b.alive) continue;
      const d = Math.hypot(b.x - x, b.z - z) - b.radius;
      if (d < extra && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  grab(x, z) {
    const b = this.ballAt(x, z, 1.5);
    if (b) { this.grabbed = b; b.grabHist = [[this.time, x, z]]; b.vx = b.vz = 0; }
    return b;
  }

  moveGrab(x, z, now) {
    const b = this.grabbed;
    if (!b || !b.alive) return;
    const w = this.wallDistance(x, z);
    if (w < b.radius) {
      const d = Math.hypot(x, z) || 1;
      const k = Math.max(0, (d - (b.radius - w))) / d;
      x *= k; z *= k;
    }
    b.x = x; b.z = z; b.y = b.radius + 0.8; b.vy = 0;
    b.grabHist.push([now, x, z]);
    if (b.grabHist.length > 6) b.grabHist.shift();
  }

  release() {
    const b = this.grabbed;
    this.grabbed = null;
    if (!b || !b.alive) return;
    const h = b.grabHist;
    if (h && h.length >= 2) {
      const a = h[0];
      const c = h[h.length - 1];
      const dtt = Math.max(0.016, c[0] - a[0]);
      b.vx = clamp((c[1] - a[1]) / dtt, -70, 70);
      b.vz = clamp((c[2] - a[2]) / dtt, -70, 70);
      b.mode = 'charge';
      b.modeT = 0.4;
    }
  }

  applyTool(tool, x, z, spawnDef) {
    switch (tool) {
      case 'spawn': {
        if (!spawnDef) return;
        const team = this.mode === 'ffa' || this.mode === 'royale' ? 100 + this.nextId : this.mode === 'survival' ? 1 : 1 + (this.nextId % 2);
        const w = this.wallDistance(x, z);
        if (w < 1) return;
        const b = this.addBall(spawnDef, team, x, z);
        if (b) { this.fx.ring(x, z, 2.5, b.color); this.fireEvent(b, 'start'); }
        break;
      }
      case 'explode': this.explodeAt(x, z, 6, 70, null, '#ffb347'); break;
      case 'well': this.zones.push({ type: 'well', x, z, r: 9, t: 0, dur: 4, owner: null, team: -1, dps: 0, color: '#9a7bff' }); this.fx.sound('void', 0.8); break;
      case 'smite':
        this.fx.lightning([{ x: x + rand(-1, 1), y: 20, z: z + rand(-1, 1) }, { x, y: 0.3, z }], '#ffffff');
        this.fx.sound('thunder', 1.2);
        this.fx.shake(0.7);
        for (const o of this.inRadius(x, z, 2.8)) { this.dealDamage(null, o, 90, { kind: 'zone' }); this.addStatus(o, 'stun', 0.8); }
        break;
      case 'freeze':
        this.fx.ring(x, z, 5, '#c8f6ff');
        for (const o of this.inRadius(x, z, 5)) this.addStatus(o, 'freeze', 2.5);
        this.fx.sound('shard', 1);
        break;
      case 'heal':
        for (const o of this.inRadius(x, z, 3)) this.heal(o, o.maxHp * 0.5, null);
        this.fx.ring(x, z, 3, '#7dffb0');
        break;
      case 'remove': {
        const b = this.ballAt(x, z, 1);
        if (b) { b.alive = false; this.fx.death(b); }
        break;
      }
      default: break;
    }
  }
}
