// ORB ARENA — game data. Everything here is plain data so it can be customised.

export const ELEMENTS = {
  lightning: { name: 'Lightning', icon: '⚡', color: '#ffd400', mat: 'metallic', hp: 0.9, atk: 1.05, def: 1, spd: 1.15, mass: 1, power: 'Chain Lightning', powerDesc: 'Lightning jumps between up to 4 enemies and stuns them.', hitDesc: 'Hits can stun briefly.' },
  fire: { name: 'Fire', icon: '🔥', color: '#ff4a1a', mat: 'lava', hp: 1, atk: 1.15, def: 0.9, spd: 1, mass: 1, power: 'Fireball', powerDesc: 'Launches a fireball that explodes and burns.', hitDesc: 'Hits set enemies on fire.' },
  ice: { name: 'Ice', icon: '❄️', color: '#9ee8ff', mat: 'glass', hp: 1, atk: 1, def: 1.1, spd: 0.9, mass: 1, power: 'Shard Volley', powerDesc: 'Fires 5 ice shards that slow and can freeze.', hitDesc: 'Hits slow, sometimes freeze.' },
  water: { name: 'Water', icon: '🌊', color: '#1e7bff', mat: 'glossy', hp: 1.1, atk: 1, def: 1, spd: 1, mass: 1, power: 'Tidal Wave', powerDesc: 'A wave blasts every nearby enemy away.', hitDesc: 'Hits knock back harder.' },
  earth: { name: 'Earth', icon: '🪨', color: '#8a5a2b', mat: 'matte', hp: 1.1, atk: 1, def: 1.3, spd: 0.85, mass: 1.3, power: 'Quake', powerDesc: 'Stuns and damages enemies around it, then hardens.', hitDesc: 'Hits launch enemies up.' },
  wind: { name: 'Wind', icon: '🌪️', color: '#c9f7e6', mat: 'pearl', hp: 0.85, atk: 1, def: 1, spd: 1.3, mass: 0.8, power: 'Gale Rush', powerDesc: 'Gains a burst of speed and blows enemies away.', hitDesc: 'Hits knock back extra far.' },
  poison: { name: 'Poison', icon: '☠️', color: '#7dff3a', mat: 'glossy', hp: 1, atk: 0.95, def: 1, spd: 1, mass: 1, power: 'Toxic Cloud', powerDesc: 'Drops a poison cloud on the target.', hitDesc: 'Hits stack poison.' },
  light: { name: 'Light', icon: '✨', color: '#fff4c2', mat: 'pearl', hp: 1.05, atk: 1, def: 1, spd: 1, mass: 1, power: 'Holy Beam', powerDesc: 'A beam of light strikes the target and heals itself.', hitDesc: 'Hits heal a little.' },
  shadow: { name: 'Shadow', icon: '🌑', color: '#3a1d5c', mat: 'metallic', hp: 0.9, atk: 1.1, def: 1, spd: 1.05, mass: 1, crit: 0.08, power: 'Shadow Step', powerDesc: 'Teleports behind the target and strikes.', hitDesc: 'Hits steal life.' },
  void: { name: 'Void', icon: '🕳️', color: '#1a0026', mat: 'holo', hp: 1, atk: 1.1, def: 1, spd: 1, mass: 1.2, power: 'Black Hole', powerDesc: 'Opens a black hole that pulls and crushes.', hitDesc: 'Hits drain extra damage.' },
  metal: { name: 'Metal', icon: '⚙️', color: '#c0c6cf', mat: 'chrome', hp: 1, atk: 1, def: 1.5, spd: 0.85, mass: 1.6, power: 'Steel Skin', powerDesc: 'Becomes nearly unbreakable for a few seconds.', hitDesc: 'Hits deal heavy bonus damage.' },
  nature: { name: 'Nature', icon: '🌿', color: '#2fbf4a', mat: 'glossy', hp: 1.15, atk: 1, def: 1, spd: 1, mass: 1, regen: 0.006, power: 'Entangle', powerDesc: 'Roots the target and regrows health.', hitDesc: 'Hits can root. Slowly regenerates.' },
  cosmic: { name: 'Cosmic', icon: '🌌', color: '#5b3cff', mat: 'holo', hp: 0.95, atk: 1.1, def: 1, spd: 1, mass: 1, power: 'Meteor', powerDesc: 'Calls a meteor down on the target.', hitDesc: 'Hits deal star damage.' },
};

export const ARCHETYPES = {
  king: { name: 'King', icon: '👑', hp: 1.15, atk: 1.1, def: 1.2, spd: 0.9, mass: 1.3, size: 1.2, crit: 0.08, weapon: 'none', desc: 'Royal aura boosts allies’ damage. Summons 2 guards at half HP.' },
  giant: { name: 'Giant', icon: '🗿', hp: 1.5, atk: 1.0, def: 1.05, spd: 0.7, mass: 2.2, size: 1.8, crit: 0.05, weapon: 'spikes', desc: 'Huge and heavy. Stomps the ground every few seconds.' },
  duplicate: { name: 'Duplicate', icon: '👥', hp: 1.3, atk: 1.15, def: 1, spd: 1.05, mass: 1, size: 1.05, crit: 0.08, weapon: 'none', desc: 'Splits into copies when badly hurt.' },
  ninja: { name: 'Ninja', icon: '🥷', hp: 0.8, atk: 1.1, def: 0.9, spd: 1.4, mass: 0.8, size: 0.85, crit: 0.2, weapon: 'blades', desc: 'Dodges 25% of attacks and dashes at foes.' },
  vampire: { name: 'Vampire', icon: '🧛', hp: 1.0, atk: 1.1, def: 1, spd: 1.05, mass: 1, size: 1, crit: 0.1, weapon: 'none', desc: 'Steals 45% of damage dealt as health.' },
  bomber: { name: 'Bomber', icon: '💣', hp: 1.25, atk: 1.2, def: 0.9, spd: 1, mass: 1, size: 1, crit: 0.08, weapon: 'none', desc: 'Drops bombs. Explodes massively on death.' },
  healer: { name: 'Healer', icon: '💚', hp: 1.1, atk: 0.7, def: 1.1, spd: 1, mass: 1, size: 1, crit: 0.05, weapon: 'shield', desc: 'Heals itself and the weakest ally.' },
  summoner: { name: 'Summoner', icon: '🔮', hp: 1.15, atk: 0.95, def: 1, spd: 0.95, mass: 1, size: 1, crit: 0.05, weapon: 'none', desc: 'Summons up to 3 minion orbs.' },
  magnet: { name: 'Magnet', icon: '🧲', hp: 1.2, atk: 1.15, def: 1.1, spd: 0.95, mass: 1.6, size: 1.1, crit: 0.06, weapon: 'none', desc: 'Constantly pulls enemies in, then yanks hard.' },
  ghost: { name: 'Ghost', icon: '👻', hp: 1.1, atk: 1.3, def: 0.9, spd: 1.15, mass: 0.8, size: 1, crit: 0.1, weapon: 'none', desc: 'Phases out (untouchable), then bursts back.' },
  mirror: { name: 'Mirror', icon: '🪞', hp: 1.1, atk: 1.05, def: 1.3, spd: 1, mass: 1.1, size: 1, crit: 0.06, weapon: 'none', desc: 'Reflects 45% of damage back to attackers.' },
  berserker: { name: 'Berserker', icon: '😡', hp: 0.9, atk: 0.95, def: 0.8, spd: 1.1, mass: 1.1, size: 1.05, crit: 0.12, weapon: 'hammer', desc: 'Hits harder the lower its health.' },
  sniper: { name: 'Sniper', icon: '🎯', hp: 0.75, atk: 1, def: 0.9, spd: 0.95, mass: 0.9, size: 0.95, crit: 0.15, weapon: 'drones', desc: 'Keeps distance and shoots precise shots.' },
  time: { name: 'Time', icon: '⏳', hp: 1.3, atk: 1.15, def: 1, spd: 1, mass: 1, size: 1, crit: 0.06, weapon: 'none', desc: 'Slows nearby enemies. Can stop time around it.' },
  gravity: { name: 'Gravity', icon: '🌀', hp: 1.2, atk: 1.15, def: 1.1, spd: 0.9, mass: 2, size: 1.15, crit: 0.06, weapon: 'none', desc: 'Pulls everyone in, then slams the ground.' },
  shapeshifter: { name: 'Shapeshifter', icon: '🎭', hp: 1.2, atk: 1.2, def: 1, spd: 1.05, mass: 1, size: 1, crit: 0.08, weapon: 'none', desc: 'Changes element every few seconds.' },
  tank: { name: 'Tank', icon: '🛡️', hp: 1.15, atk: 0.85, def: 1.1, spd: 0.8, mass: 1.7, size: 1.35, crit: 0.04, weapon: 'shield', desc: 'Massive defence and a recharging barrier.' },
  assassin: { name: 'Assassin', icon: '🗡️', hp: 0.75, atk: 1.2, def: 0.85, spd: 1.3, mass: 0.85, size: 0.9, crit: 0.28, weapon: 'blades', desc: 'Hunts the weakest. Blinks in for brutal crits.' },
  phoenix: { name: 'Phoenix', icon: '🐦‍🔥', hp: 0.9, atk: 1.1, def: 1, spd: 1.1, mass: 1, size: 1, crit: 0.08, weapon: 'none', desc: 'Revives once from the ashes at 50% HP.' },
};

export const BASE_STATS = { hp: 380, atk: 10, def: 25, spd: 9, mass: 1, size: 1, crit: 0.08 };

export const WEAPON_TYPES = {
  none: { name: 'None', icon: '⭕', count: 0, size: 0, dmg: 0, speed: 0, desc: 'No weapon.' },
  blades: { name: 'Orbit Blades', icon: '🌀', count: 3, size: 0.5, dmg: 6, speed: 4, desc: 'Blades circle the ball and slice anything they touch.' },
  spikes: { name: 'Spikes', icon: '🦔', count: 14, size: 0.45, dmg: 25, speed: 0, desc: '+25% contact damage (dmg = bonus %).' },
  hammer: { name: 'Chain Hammer', icon: '🔨', count: 1, size: 0.9, dmg: 18, speed: 2.5, desc: 'A heavy hammer swings on a chain.' },
  laser: { name: 'Laser', icon: '🔴', count: 1, size: 0.15, dmg: 14, speed: 2.5, desc: 'Fires a laser at the nearest enemy (speed = seconds between shots).' },
  drones: { name: 'Drones', icon: '🛸', count: 2, size: 0.35, dmg: 5, speed: 1.2, desc: 'Drones orbit and shoot (speed = seconds between shots).' },
  shield: { name: 'Energy Shield', icon: '🔰', count: 1, size: 1, dmg: 20, speed: 1.5, desc: 'Reduces damage taken (dmg = % blocked).' },
};

export const MATERIALS = {
  auto: 'Auto (element)', chrome: 'Chrome', gold: 'Gold', glossy: 'Glossy', metallic: 'Metallic',
  glass: 'Glass', crystal: 'Crystal', lava: 'Lava', holo: 'Holographic', pearl: 'Pearl', matte: 'Matte', neon: 'Neon',
};

export const ARENA_SHAPES = {
  circle: { name: 'Circle', icon: '⭕', sides: 0 },
  square: { name: 'Square', icon: '⬜', sides: 4 },
  triangle: { name: 'Triangle', icon: '🔺', sides: 3 },
  hexagon: { name: 'Hexagon', icon: '⬡', sides: 6 },
  octagon: { name: 'Octagon', icon: '🛑', sides: 8 },
  donut: { name: 'Donut', icon: '🍩', sides: 0, inner: 0.3 },
};

export const FLOORS = {
  stone: { name: 'Stone', friction: 1.0, bounce: 0.8, color: '#6d6a66' },
  marble: { name: 'Marble', friction: 0.8, bounce: 0.85, color: '#8f8a84' },
  ice: { name: 'Ice', friction: 0.12, bounce: 0.9, color: '#bfe9ff' },
  metal: { name: 'Metal Plates', friction: 0.7, bounce: 0.9, color: '#8b929b' },
  glass: { name: 'Dark Glass', friction: 0.55, bounce: 0.95, color: '#141a24' },
  grass: { name: 'Grass', friction: 1.5, bounce: 0.7, color: '#3f7d34' },
  sand: { name: 'Sand', friction: 2.2, bounce: 0.5, color: '#d9b97a' },
  neon: { name: 'Neon Grid', friction: 0.6, bounce: 0.9, color: '#0b0820' },
};

export const BACKDROPS = {
  studio: { name: 'Studio', sky: ['#1b2030', '#05060a'], fog: '#0a0c14' },
  space: { name: 'Deep Space', sky: ['#0b0630', '#000000'], fog: '#02010a' },
  volcano: { name: 'Volcano', sky: ['#5a1405', '#120302'], fog: '#2a0802' },
  neon: { name: 'Neon City', sky: ['#2a0a4a', '#03020c'], fog: '#0a0420' },
  storm: { name: 'Storm', sky: ['#3a4250', '#0c0f14'], fog: '#1a1e26' },
  temple: { name: 'Sunset Temple', sky: ['#ff9a5a', '#3a1a40'], fog: '#5a3040' },
  ocean: { name: 'Deep Ocean', sky: ['#0a4a7a', '#010a18'], fog: '#03223a' },
};

export const HAZARDS = {
  spikes: { name: 'Spike Walls', icon: '🦔', desc: 'Walls hurt on impact' },
  bumpers: { name: 'Bumpers', icon: '🔵', desc: 'Super-bouncy pillars' },
  portals: { name: 'Portals', icon: '🌀', desc: 'Two linked portal pairs' },
  meteors: { name: 'Meteor Shower', icon: '☄️', desc: 'Random meteors fall' },
  storm: { name: 'Lightning Storm', icon: '🌩️', desc: 'Random lightning strikes' },
  lava: { name: 'Lava Edge', icon: '🌋', desc: 'Burning zone along the walls' },
  spinner: { name: 'Spinner Bar', icon: '➖', desc: 'Rotating bar in the middle' },
};

export const MODES = {
  ffa: { name: 'Free For All', icon: '💥', desc: 'Everyone against everyone. Last ball wins.' },
  teams: { name: 'Teams', icon: '🤝', desc: 'Tap a fighter chip to change its team (up to 4).' },
  duel: { name: '1 v 1', icon: '⚔️', desc: 'The first two fighters duel.' },
  boss: { name: 'Boss Fight', icon: '👹', desc: 'The first fighter becomes a giant boss vs everyone else.' },
  royale: { name: 'Battle Royale', icon: '🔥', desc: 'Free for all while the ring shrinks.' },
  survival: { name: 'Survival', icon: '🧟', desc: 'Your fighters vs endless waves.' },
  tournament: { name: 'Tournament', icon: '🏆', desc: 'Knockout bracket of 1v1 duels.' },
};

export const SANDBOX_TOOLS = {
  camera: { name: 'Camera', icon: '🎥' },
  fling: { name: 'Grab & Fling', icon: '✋' },
  spawn: { name: 'Spawn', icon: '➕' },
  explode: { name: 'Explosion', icon: '💥' },
  well: { name: 'Gravity Well', icon: '🌀' },
  smite: { name: 'Smite', icon: '⚡' },
  freeze: { name: 'Freeze', icon: '🧊' },
  heal: { name: 'Heal', icon: '💖' },
  remove: { name: 'Delete', icon: '🗑️' },
};

export const STATUS_ICONS = {
  burn: '🔥', poison: '☠️', slow: '🐌', stun: '💫', freeze: '🧊', root: '🌿', shield: '🛡️',
  phase: '👻', haste: '💨', armor: '⚙️', rage: '😡',
};

// Default ball rules (easy code) used by some catalog balls for extra flavour.
const SIGNATURE_RULES = {
  king: '',
  phoenix: '',
};

// Build the full catalog: every element × archetype = 247 unique fighters.
export function buildCatalog() {
  const list = [];
  for (const [ek, e] of Object.entries(ELEMENTS)) {
    for (const [ak, a] of Object.entries(ARCHETYPES)) {
      list.push({
        id: `${ek}-${ak}`,
        name: `${e.name} ${a.name}`,
        element: ek,
        archetype: ak,
        color: e.color,
        material: 'auto',
        size: 1,
        stats: { hp: 1, atk: 1, def: 1, spd: 1, mass: 1 },
        weapon: a.weapon,
        rules: SIGNATURE_RULES[ak] || '',
        builtin: true,
      });
    }
  }
  return list;
}

// Resolve final numbers for a ball definition (builtin or custom).
export function resolveStats(def) {
  const e = ELEMENTS[def.element] || ELEMENTS.fire;
  const a = ARCHETYPES[def.archetype] || ARCHETYPES.king;
  const s = def.stats || {};
  const size = (def.size || 1) * a.size;
  return {
    hp: Math.round(BASE_STATS.hp * a.hp * e.hp * (s.hp || 1)),
    atk: +(BASE_STATS.atk * a.atk * e.atk * (s.atk || 1)).toFixed(1),
    def: Math.round(BASE_STATS.def * a.def * e.def * (s.def || 1)),
    spd: +(BASE_STATS.spd * a.spd * e.spd * (s.spd || 1)).toFixed(1),
    mass: +(BASE_STATS.mass * a.mass * e.mass * (s.mass || 1) * (def.size || 1) ** 2).toFixed(2),
    radius: +(0.9 * size).toFixed(2),
    crit: Math.min(0.8, a.crit + (e.crit || 0)),
    regen: e.regen || 0,
  };
}

export const EASY_CODE_HELP = `# EASY CODE — give any ball its own brain.
# One rule per line.  Lines starting with # are notes.
#
#   WHEN <event> [IF <condition>] DO <action> [AND <action>...]
#   EVERY <seconds> [IF <condition>] DO <action>
#
# EVENTS:  start  hit  hurt  kill  lowhp  near  death
# CONDITIONS:  hp<50  hp>50  enemies>3  enemies<2  allies>1  chance 30
# ACTIONS:
#   heal 20        heal 20% of max HP
#   damage 30      hit the nearest enemy for 30
#   explode 40     explosion around me (40 damage)
#   dash           charge at the target
#   speed 50       +50% speed for 3s
#   shield 30      barrier worth 30% max HP for 4s
#   grow / shrink  change size
#   clone          create a copy of myself
#   summon         summon a minion orb
#   power          cast my element power now
#   pull / push    pull or push nearby enemies
#   teleport       jump to a random spot
#   ghost          become untouchable for 1.5s
#   freeze         freeze nearby enemies
#   rage           +60% damage for 4s
#   say Hello!     show a speech bubble
`;

export const EASY_CODE_EXAMPLES = [
  { name: 'Last Stand', code: 'WHEN lowhp DO shield 40 AND rage AND say Not today!' },
  { name: 'Revenge Bomb', code: 'WHEN death DO explode 80' },
  { name: 'Blood Hunter', code: 'WHEN kill DO heal 30 AND grow' },
  { name: 'Panic Teleport', code: 'WHEN hurt IF hp<25 IF chance 40 DO teleport AND heal 10' },
  { name: 'Pulse Bomb', code: 'EVERY 6 DO explode 25 AND push' },
  { name: 'Clone Army', code: 'EVERY 10 IF allies<4 DO clone' },
  { name: 'Ninja Vanish', code: 'WHEN hurt IF chance 20 DO ghost AND dash' },
  { name: 'Battle Cry', code: 'WHEN start DO speed 80 AND say CHARGE!' },
  { name: 'Black Hole Heart', code: 'WHEN near IF chance 15 DO pull AND power' },
  { name: 'Frost Armor', code: 'WHEN hurt IF chance 25 DO freeze' },
];

// A complete example file showing every option. Import it from the Files tab.
export const EXAMPLE_FILE = {
  format: 'orb-arena',
  version: 1,
  _help: 'This one file can hold custom balls, custom weapons and a full battle setup. Edit any value and import it in Files.',
  weapons: [
    { id: 'w-plasma-saws', name: 'Plasma Saws', type: 'blades', count: 5, size: 0.55, dmg: 8, speed: 6, color: '#00e5ff' },
    { id: 'w-doom-hammer', name: 'Doom Hammer', type: 'hammer', count: 1, size: 1.3, dmg: 30, speed: 1.8, color: '#ff3355' },
  ],
  balls: [
    {
      id: 'c-thunder-emperor',
      name: 'Thunder Emperor',
      element: 'lightning',
      archetype: 'king',
      color: '#ffe14d',
      material: 'gold',
      size: 1.2,
      stats: { hp: 1.3, atk: 1.2, def: 1, spd: 1, mass: 1.2 },
      weapon: 'w-plasma-saws',
      face: true,
      rules: 'WHEN start DO say Kneel!\nWHEN lowhp DO shield 50 AND power\nEVERY 8 DO power',
    },
    {
      id: 'c-glass-reaper',
      name: 'Glass Reaper',
      element: 'shadow',
      archetype: 'assassin',
      color: '#b388ff',
      material: 'crystal',
      size: 0.9,
      stats: { hp: 0.9, atk: 1.4, def: 0.8, spd: 1.2, mass: 0.9 },
      weapon: 'blades',
      face: true,
      rules: 'WHEN kill DO heal 25 AND rage',
    },
    {
      id: 'c-mount-doom',
      name: 'Mount Doom',
      element: 'fire',
      archetype: 'giant',
      color: '#ff5a1f',
      material: 'lava',
      size: 1.1,
      stats: { hp: 1.2, atk: 1.1, def: 1.1, spd: 0.9, mass: 1.3 },
      weapon: 'w-doom-hammer',
      face: false,
      rules: 'WHEN death DO explode 120',
    },
  ],
  setup: {
    mode: 'ffa',
    arena: { shape: 'octagon', size: 22, floor: 'marble', backdrop: 'temple', gravity: 1, bounceMul: 1, frictionMul: 1, accelMul: 1, momentum: false, timeLimit: 180,
      hazards: { spikes: false, bumpers: true, portals: false, meteors: false, storm: false, lava: false, spinner: false } },
    roster: [
      { id: 'c-thunder-emperor', team: 1 },
      { id: 'c-glass-reaper', team: 2 },
      { id: 'c-mount-doom', team: 3 },
      { id: 'void-duplicate', team: 4 },
      { id: 'ice-ninja', team: 1 },
      { id: 'nature-healer', team: 2 },
    ],
  },
};
