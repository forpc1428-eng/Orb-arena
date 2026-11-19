// ORB ARENA — 3D renderer: realistic materials, arenas, backdrops, effects, cameras, recording.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ELEMENTS, FLOORS, BACKDROPS } from './data.js';
import { weaponOrbit } from './sim.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const TEAM_COLORS = { 1: '#3d8bff', 2: '#ff4d5e', 3: '#3ddc84', 4: '#ffc93d' };
const QUALITY = {
  low: { pr: 1, shadows: false, shadowSize: 512, bloom: false, particles: 1500, glass: false },
  high: { pr: 1.5, shadows: true, shadowSize: 1024, bloom: true, particles: 4000, glass: false },
  ultra: { pr: 2, shadows: true, shadowSize: 2048, bloom: true, particles: 8000, glass: true },
};

function rand(a = 0, b = 1) { return a + Math.random() * (b - a); }
export function teamColor(team) { return TEAM_COLORS[team] || null; }

// ---------- procedural textures ----------
function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function noise(g, s, n, alpha, light = true) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    const r = Math.random() * 2 + 0.5;
    g.fillRect(Math.random() * s, Math.random() * s, r, r);
  }
}

const texCache = {};
function floorTexture(kind) {
  if (texCache[kind]) return texCache[kind];
  const f = FLOORS[kind] || FLOORS.stone;
  const t = canvasTex(512, (g, s) => {
    g.fillStyle = f.color;
    g.fillRect(0, 0, s, s);
    if (kind === 'stone' || kind === 'marble') {
      const tiles = 4;
      const w = s / tiles;
      for (let y = 0; y < tiles; y++) {
        for (let x = 0; x < tiles; x++) {
          const v = rand(-14, 14);
          g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 120})`;
          g.fillRect(x * w + 2, y * w + 2, w - 4, w - 4);
        }
      }
      g.strokeStyle = kind === 'marble' ? 'rgba(120,110,100,0.35)' : 'rgba(0,0,0,0.45)';
      g.lineWidth = 3;
      for (let i = 0; i <= tiles; i++) {
        g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w, s); g.stroke();
        g.beginPath(); g.moveTo(0, i * w); g.lineTo(s, i * w); g.stroke();
      }
      if (kind === 'marble') {
        g.strokeStyle = 'rgba(150,140,130,0.25)';
        g.lineWidth = 1.5;
        for (let i = 0; i < 14; i++) {
          g.beginPath();
          let x = Math.random() * s;
          let y = Math.random() * s;
          g.moveTo(x, y);
          for (let k = 0; k < 8; k++) { x += rand(-40, 40); y += rand(-40, 40); g.lineTo(x, y); }
          g.stroke();
        }
      }
      noise(g, s, 5000, 0.12);
      noise(g, s, 5000, 0.12, false);
    } else if (kind === 'ice') {
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 40; i++) {
        g.lineWidth = rand(0.5, 2);
        g.beginPath();
        let x = Math.random() * s;
        let y = Math.random() * s;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += rand(-60, 60); y += rand(-60, 60); g.lineTo(x, y); }
        g.stroke();
      }
      noise(g, s, 3000, 0.2);
    } else if (kind === 'metal') {
      const w = s / 2;
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 4;
      g.strokeRect(2, 2, w - 4, w - 4); g.strokeRect(w + 2, 2, w - 4, w - 4);
      g.strokeRect(2, w + 2, w - 4, w - 4); g.strokeRect(w + 2, w + 2, w - 4, w - 4);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(14 + i * w / 2 * 1.0 + (i % 2) * (w / 2 - 28), 14 + k * w / 2 + (k % 2) * (w / 2 - 28), 5, 0, TAU); g.fill(); }
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(0, Math.random() * s, s, 1); }
    } else if (kind === 'grass') {
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `hsl(${rand(90, 120)},${rand(35, 60)}%,${rand(18, 38)}%)`;
        g.fillRect(Math.random() * s, Math.random() * s, 2, rand(3, 7));
      }
    } else if (kind === 'sand') {
      noise(g, s, 12000, 0.25);
      noise(g, s, 12000, 0.2, false);
      g.strokeStyle = 'rgba(120,90,40,0.15)';
      for (let i = 0; i < 20; i++) { g.lineWidth = 3; g.beginPath(); const y = Math.random() * s; g.moveTo(0, y); g.bezierCurveTo(s / 3, y + 20, s / 1.5, y - 20, s, y); g.stroke(); }
    } else if (kind === 'neon') {
      g.strokeStyle = '#ff2bd6';
      g.lineWidth = 3;
      g.shadowColor = '#ff2bd6';
      g.shadowBlur = 12;
      const w = s / 4;
      for (let i = 0; i <= 4; i++) {
        g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w, s); g.stroke();
        g.beginPath(); g.moveTo(0, i * w); g.lineTo(s, i * w); g.stroke();
      }
    } else if (kind === 'glass') {
      const grd = g.createLinearGradient(0, 0, s, s);
      grd.addColorStop(0, '#1a2233'); grd.addColorStop(1, '#0c1018');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(140,200,255,0.12)';
      g.lineWidth = 2;
      const w = s / 4;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w, s); g.stroke(); g.beginPath(); g.moveTo(0, i * w); g.lineTo(s, i * w); g.stroke(); }
    }
  });
  texCache[kind] = t;
  return t;
}

let ballPatternTex = null;
function ballPattern() {
  if (ballPatternTex) return ballPatternTex;
  ballPatternTex = canvasTex(512, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    // equator band + pole caps make rolling visible
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, s * 0.46, s, s * 0.08);
    g.fillStyle = 'rgba(255,255,255,1)';
    g.fillRect(0, s * 0.485, s, s * 0.03);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc((i + 0.5) * (s / 6), s * 0.25, s * 0.03, 0, TAU);
      g.arc((i + 0.5) * (s / 6) + s / 12, s * 0.75, s * 0.03, 0, TAU);
      g.fill();
    }
  });
  ballPatternTex.wrapT = THREE.ClampToEdgeWrapping;
  return ballPatternTex;
}

let lavaTexCache = null;
function lavaTexture() {
  if (lavaTexCache) return lavaTexCache;
  lavaTexCache = canvasTex(512, (g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#fff';
    for (let i = 0; i < 70; i++) {
      g.lineWidth = rand(1, 5);
      g.beginPath();
      let x = Math.random() * s;
      let y = Math.random() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += rand(-50, 50); y += rand(-50, 50); g.lineTo(x, y); }
      g.stroke();
    }
  });
  lavaTexCache.colorSpace = THREE.NoColorSpace;
  return lavaTexCache;
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = canvasTex(128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  return glowTex;
}

// ---------- particles ----------
class Particles {
  constructor(capacity, additive) {
    this.cap = capacity;
    this.n = 0;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha; uniform float uScale;
        void main(){ vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(vColor, a); }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geo = geo;
    this.limit = capacity;
  }

  emit(x, y, z, o = {}) {
    if (this.limit <= 0) return;
    const i = this.next;
    this.next = (this.next + 1) % this.limit;
    const c = o.color || TMP_COLOR.set('#ffffff');
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    const sp = o.speed ?? 4;
    const dir = o.dir;
    let vx;
    let vy;
    let vz;
    if (dir) { vx = dir.x * sp + rand(-1, 1) * (o.spread ?? 1); vy = dir.y * sp + rand(-1, 1) * (o.spread ?? 1); vz = dir.z * sp + rand(-1, 1) * (o.spread ?? 1); } else {
      const th = rand(0, TAU);
      const ph = Math.acos(rand(-1, 1));
      const s = sp * rand(0.3, 1);
      vx = Math.sin(ph) * Math.cos(th) * s; vy = Math.abs(Math.cos(ph)) * s * (o.upBias ?? 1); vz = Math.sin(ph) * Math.sin(th) * s;
    }
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.size[i] = (o.size ?? 0.25) * rand(0.6, 1.3);
    this.max[i] = this.life[i] = (o.life ?? 0.6) * rand(0.6, 1.2);
    this.grav[i] = o.gravity ?? 6;
    this.drag[i] = o.drag ?? 1.5;
    this.alpha[i] = 1;
  }

  update(dt) {
    const p = this.pos;
    const v = this.vel;
    for (let i = 0; i < this.limit; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = 1 / (1 + this.drag[i] * dt);
      v[i * 3] *= k; v[i * 3 + 1] = v[i * 3 + 1] * k - this.grav[i] * dt; v[i * 3 + 2] *= k;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (p[i * 3 + 1] < 0.02 && this.grav[i] > 0) { p[i * 3 + 1] = 0.02; v[i * 3 + 1] *= -0.3; }
      const f = this.life[i] / this.max[i];
      this.alpha[i] = f > 0.8 ? (1 - f) * 5 : f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }

  clear() { this.life.fill(0); this.alpha.fill(0); }
}
const TMP_COLOR = new THREE.Color();

// ---------- renderer ----------
export class Renderer {
  constructor(canvas, overlay, settings) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.settings = settings;
    this.q = QUALITY[settings.quality] || QUALITY.high;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = settings.brightness ?? 0.7;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
    this.camera.position.set(0, 26, 30);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.48;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0, 0);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    pmrem.dispose();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.4, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.fxRoot = new THREE.Group();
    this.scene.add(this.fxRoot);
    this.partsAdd = new Particles(8000, true);
    this.partsNorm = new Particles(3000, false);
    this.scene.add(this.partsAdd.points, this.partsNorm.points);
    this.segGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 72);
    this.sphereGeo = new THREE.SphereGeometry(1, 48, 32);
    this.lowSphere = new THREE.SphereGeometry(1, 16, 12);
    this.segs = [];
    this.rings = [];
    this.flashes = [];
    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 18, 2);
      l.userData.t = 0;
      this.scene.add(l);
      this.lights.push(l);
    }
    this.views = new Map();
    this.projViews = new Map();
    this.zoneViews = new Map();
    this.numbers = [];
    this.bubbles = [];
    this.shakeAmt = 0;
    this.camMode = 'orbit';
    this.camFocus = null;
    this.cinT = 0;
    this.cinTarget = new THREE.Vector3();
    this.cinPos = new THREE.Vector3(0, 26, 30);
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.arenaGroup = null;
    this.time = 0;
    this.applyQuality();
    this.resize();
  }

  applyQuality() {
    this.q = QUALITY[this.settings.quality] || QUALITY.high;
    this.renderer.toneMappingExposure = this.settings.brightness ?? 0.7;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pr));
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.bloom.enabled = this.q.bloom;
    this.partsAdd.limit = Math.min(this.partsAdd.cap, this.q.particles);
    this.partsNorm.limit = Math.min(this.partsNorm.cap, Math.round(this.q.particles / 3));
    this.partsAdd.clear(); this.partsNorm.clear();
    this.partsAdd.next = this.partsNorm.next = 0;
    if (this.keyLight) {
      this.keyLight.castShadow = this.q.shadows;
      this.keyLight.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
      if (this.keyLight.shadow.map) { this.keyLight.shadow.map.dispose(); this.keyLight.shadow.map = null; }
    }
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.partsAdd.mat.uniforms.uScale.value = h * pr * 0.9;
    this.partsNorm.mat.uniforms.uScale.value = h * pr * 0.9;
    this.viewW = w;
    this.viewH = h;
  }

  // ---------- arena ----------
  clearArena() {
    if (this.arenaGroup) {
      this.scene.remove(this.arenaGroup);
      this.arenaGroup.traverse((o) => {
        if (o.geometry && o.geometry !== this.segGeo && o.geometry !== this.sphereGeo && o.geometry !== this.ringGeo) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) if (!m.userData.shared) m.dispose();
        }
      });
    }
    for (const v of this.views.values()) this.removeView(v, true);
    this.views.clear();
    for (const [, m] of this.projViews) this.fxRoot.remove(m);
    this.projViews.clear();
    for (const [, m] of this.zoneViews) this.fxRoot.remove(m);
    this.zoneViews.clear();
    for (const n of this.numbers) n.el.remove();
    this.numbers = [];
    for (const b of this.bubbles) b.el.remove();
    this.bubbles = [];
    this.partsAdd.clear(); this.partsNorm.clear();
  }

  buildArena(sim, cfg) {
    this.clearArena();
    this.sim = sim;
    const G = new THREE.Group();
    this.arenaGroup = G;
    this.scene.add(G);
    const R = sim.arena.size;
    const sides = sim.sides;
    const bd = BACKDROPS[cfg.backdrop] || BACKDROPS.studio;
    this.backdrop = cfg.backdrop || 'studio';
    // sky dome
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(bd.sky[0]) }, bottom: { value: new THREE.Color(bd.sky[1]) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 1.4)), 1.0); }',
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
    G.add(sky);
    this.scene.fog = new THREE.Fog(bd.fog, R * 2.2, R * 9);
    // lights
    const hemi = new THREE.HemisphereLight(bd.sky[0], '#101010', 0.3);
    G.add(hemi);
    this.hemi = hemi;
    const key = new THREE.DirectionalLight('#fff4e6', 1.7);
    key.position.set(R * 0.6, R * 1.6, R * 0.8);
    key.castShadow = this.q.shadows;
    key.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
    const sc = key.shadow.camera;
    sc.left = -R - 6; sc.right = R + 6; sc.top = R + 6; sc.bottom = -R - 6; sc.near = 1; sc.far = R * 5;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    G.add(key);
    G.add(key.target);
    this.keyLight = key;
    const rim = new THREE.DirectionalLight(bd.sky[0], 0.5);
    rim.position.set(-R, R * 0.5, -R);
    G.add(rim);
    this.scene.environmentIntensity = this.backdrop === 'space' || this.backdrop === 'neon' ? 0.4 : 0.6;
    // floor
    const floorKind = sim.arena.floor;
    const ftex = floorTexture(floorKind);
    const wallT = 0.6;
    let shape;
    if (!sides) {
      shape = new THREE.Shape();
      shape.absarc(0, 0, R + wallT, 0, TAU, false);
    } else {
      shape = new THREE.Shape();
      const vr = (R + wallT) / Math.cos(Math.PI / sides);
      for (let i = 0; i < sides; i++) {
        const t = ((2 * i + 1) * Math.PI) / sides;
        const x = Math.cos(t) * vr;
        const y = -Math.sin(t) * vr;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
    }
    if (sim.innerFrac) {
      const hole = new THREE.Path();
      hole.absarc(0, 0, R * sim.innerFrac - 0.01, 0, TAU, true);
      shape.holes.push(hole);
    }
    const fgeo = new THREE.ShapeGeometry(shape, 64);
    const uv = fgeo.attributes.uv;
    const pos = fgeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 10, pos.getY(i) / 10);
    const fmatOpts = { map: ftex, roughness: 0.6, metalness: 0.05 };
    if (floorKind === 'marble') { fmatOpts.roughness = 0.18; }
    if (floorKind === 'ice') { fmatOpts.roughness = 0.08; fmatOpts.metalness = 0.1; }
    if (floorKind === 'metal') { fmatOpts.roughness = 0.35; fmatOpts.metalness = 0.85; }
    if (floorKind === 'glass') { fmatOpts.roughness = 0.04; fmatOpts.metalness = 0.6; }
    if (floorKind === 'grass' || floorKind === 'sand') fmatOpts.roughness = 0.95;
    if (floorKind === 'neon') { fmatOpts.emissive = new THREE.Color('#ff2bd6'); fmatOpts.emissiveMap = ftex; fmatOpts.emissiveIntensity = 0.9; fmatOpts.roughness = 0.25; }
    const floor = new THREE.Mesh(fgeo, new THREE.MeshPhysicalMaterial({ ...fmatOpts, clearcoat: floorKind === 'marble' || floorKind === 'glass' || floorKind === 'ice' ? 1 : 0, clearcoatRoughness: 0.08 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    G.add(floor);
    // base slab under the floor for depth
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 3, curveSegments: 64 });
    const slab = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({ color: '#1c1f26', roughness: 0.5, metalness: 0.6 }));
    slab.rotation.x = Math.PI / 2;
    slab.position.y = -0.34; // bevel (0.3) must stay below the floor surface
    G.add(slab);
    // walls (scaled when ring shrinks)
    const walls = new THREE.Group();
    this.walls = walls;
    G.add(walls);
    const accent = new THREE.Color(this.backdrop === 'volcano' ? '#ff6a2a' : this.backdrop === 'neon' ? '#ff2bd6' : this.backdrop === 'ocean' ? '#2ad4ff' : this.backdrop === 'temple' ? '#ffcf7a' : '#7fb8ff');
    const wallMat = this.q.glass
      ? new THREE.MeshPhysicalMaterial({ color: '#d8ecff', transmission: 0.92, roughness: 0.04, thickness: 0.6, ior: 1.45, metalness: 0, transparent: true, opacity: 1 })
      : new THREE.MeshPhysicalMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, clearcoat: 1, depthWrite: false });
    const glowMat = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
    const wallH = 1.3;
    if (!sides) {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R + wallT / 2, R + wallT / 2, wallH, 96, 1, true), wallMat);
      cyl.position.y = wallH / 2;
      walls.add(cyl);
      const rimT = new THREE.Mesh(new THREE.TorusGeometry(R + wallT / 2, 0.07, 8, 128), glowMat);
      rimT.rotation.x = Math.PI / 2; rimT.position.y = wallH;
      walls.add(rimT);
    } else {
      const apo = R * Math.cos(Math.PI / sides);
      const len = 2 * (R + wallT) * Math.sin(Math.PI / sides) + 0.05;
      for (let i = 0; i < sides; i++) {
        const ang = ((2 * i + 2) * Math.PI) / sides;
        const w = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, wallT), wallMat);
        w.position.set(Math.cos(ang) * (apo + wallT / 2), wallH / 2, Math.sin(ang) * (apo + wallT / 2));
        w.rotation.y = -ang - Math.PI / 2;
        walls.add(w);
        const g = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.12), glowMat);
        g.position.set(Math.cos(ang) * (apo + wallT / 2), wallH, Math.sin(ang) * (apo + wallT / 2));
        g.rotation.y = w.rotation.y;
        walls.add(g);
      }
    }
    if (sim.innerFrac) {
      const ri = R * sim.innerFrac;
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, wallH * 1.4, 64, 1, false), new THREE.MeshPhysicalMaterial({ color: '#1a1d24', metalness: 0.9, roughness: 0.2, clearcoat: 1 }));
      inner.position.y = wallH * 0.7;
      inner.castShadow = true;
      walls.add(inner);
      const tr = new THREE.Mesh(new THREE.TorusGeometry(ri, 0.08, 8, 96), glowMat);
      tr.rotation.x = Math.PI / 2; tr.position.y = wallH * 1.4;
      walls.add(tr);
    }
    // hazards
    const H = sim.arena.hazards;
    if (H.spikes) {
      const coneGeo = new THREE.ConeGeometry(0.22, 0.8, 8);
      const spikeMat = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 1, roughness: 0.25 });
      const count = Math.round(R * 3);
      for (let i = 0; i < count; i++) {
        const t = (i / count) * TAU;
        let px;
        let pz;
        let nx;
        let nz;
        if (!sides) { nx = Math.cos(t); nz = Math.sin(t); px = nx * R; pz = nz * R; } else {
          // project onto polygon boundary
          const dirx = Math.cos(t);
          const dirz = Math.sin(t);
          let best = Infinity;
          const apo = R * Math.cos(Math.PI / sides);
          for (let k = 0; k < sides; k++) {
            const a = ((2 * k + 2) * Math.PI) / sides;
            const dd = dirx * Math.cos(a) + dirz * Math.sin(a);
            if (dd > 0.0001) { const s = apo / dd; if (s < best) { best = s; nx = Math.cos(a); nz = Math.sin(a); } }
          }
          px = dirx * best; pz = dirz * best;
        }
        for (const hgt of [0.35, 0.9]) {
          const c = new THREE.Mesh(coneGeo, spikeMat);
          c.position.set(px - nx * 0.3, hgt, pz - nz * 0.3);
          c.quaternion.setFromUnitVectors(UP, new THREE.Vector3(-nx, 0, -nz));
          walls.add(c);
        }
      }
    }
    if (H.lava) {
      let lavaShape;
      const inset = 2.4;
      if (!sides) {
        lavaShape = new THREE.Shape(); lavaShape.absarc(0, 0, R, 0, TAU, false);
        const h = new THREE.Path(); h.absarc(0, 0, R - inset, 0, TAU, true); lavaShape.holes.push(h);
      } else {
        const mk = (rr, rev) => {
          const pth = rev ? new THREE.Path() : new THREE.Shape();
          const vr = rr / Math.cos(Math.PI / sides);
          const idx = [...Array(sides).keys()];
          if (rev) idx.reverse();
          idx.forEach((i, k) => {
            const t = ((2 * i + 1) * Math.PI) / sides;
            const x = Math.cos(t) * vr;
            const y = -Math.sin(t) * vr;
            if (k === 0) pth.moveTo(x, y); else pth.lineTo(x, y);
          });
          pth.closePath();
          return pth;
        };
        const apo = R * Math.cos(Math.PI / sides);
        lavaShape = mk(apo, false);
        lavaShape.holes.push(mk(apo - inset, true));
      }
      const lmat = new THREE.MeshStandardMaterial({ color: '#2a0600', emissive: '#ff4a0a', emissiveIntensity: 1.6, emissiveMap: lavaTexture(), roughness: 0.7 });
      const lg = new THREE.ShapeGeometry(lavaShape, 64);
      const luv = lg.attributes.uv;
      const lp = lg.attributes.position;
      for (let i = 0; i < luv.count; i++) luv.setXY(i, lp.getX(i) / 8, lp.getY(i) / 8);
      const lava = new THREE.Mesh(lg, lmat);
      lava.rotation.x = -Math.PI / 2; lava.position.y = 0.02;
      walls.add(lava);
      this.lavaMat = lmat;
    } else this.lavaMat = null;
    this.bumperMeshes = sim.bumpers.map((p) => {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 1.4, 40), new THREE.MeshPhysicalMaterial({ color: '#2a3550', metalness: 0.9, roughness: 0.2, clearcoat: 1 }));
      body.position.y = 0.7; body.castShadow = true;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.9, p.r * 0.9, 0.12, 40), new THREE.MeshBasicMaterial({ color: '#36c6ff', toneMapped: false }));
      top.position.y = 1.46;
      const band = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.02, 0.06, 8, 48), new THREE.MeshBasicMaterial({ color: '#36c6ff', toneMapped: false }));
      band.rotation.x = Math.PI / 2; band.position.y = 0.7;
      grp.add(body, top, band);
      grp.position.set(p.x, 0, p.z);
      G.add(grp);
      return { grp, top, band, p };
    });
    this.portalMeshes = sim.portals.map((p) => {
      const grp = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 12, 64), new THREE.MeshBasicMaterial({ color: p.color, toneMapped: false }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.05;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.35, map: glowTexture(), toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04;
      grp.add(ring, disc);
      grp.position.set(p.x, 0, p.z);
      G.add(grp);
      return { grp, p, color: new THREE.Color(p.color) };
    });
    if (H.spinner) {
      const L = R * 0.45;
      const bar = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.BoxGeometry(L * 2, 0.6, 0.6), new THREE.MeshPhysicalMaterial({ color: '#9aa3ad', metalness: 1, roughness: 0.22, clearcoat: 1 }));
      beam.position.y = 0.6; beam.castShadow = true;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 2, 0.08, 0.62), new THREE.MeshBasicMaterial({ color: '#ff3355', toneMapped: false }));
      stripe.position.y = 0.92;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 1.3, 32), new THREE.MeshPhysicalMaterial({ color: '#30343b', metalness: 1, roughness: 0.3 }));
      hub.position.y = 0.65;
      bar.add(beam, stripe, hub);
      walls.add(bar);
      this.spinner = bar;
    } else this.spinner = null;
    this.buildBackdrop(G, R);
    // camera framing
    const dist = R * 1.75 + 6;
    this.camera.position.set(0, dist * 0.78, dist * 0.82);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.cinPos.copy(this.camera.position);
    this.cinTarget.set(0, 0, 0);
    this.R = R;
  }

  buildBackdrop(G, R) {
    const b = this.backdrop;
    this.ambient = null;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(420, 64), new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2.5;
    ground.receiveShadow = false;
    if (b === 'space') {
      ground.visible = false;
      const n = 2500;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(rand(250, 420));
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      G.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, fog: false })));
      const planet = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 32), new THREE.MeshStandardMaterial({ color: '#6a4cff', roughness: 0.8, emissive: '#2a1080', emissiveIntensity: 0.6, fog: false }));
      planet.position.set(-160, 60, -260);
      G.add(planet);
      const pring = new THREE.Mesh(new THREE.RingGeometry(55, 80, 96), new THREE.MeshBasicMaterial({ color: '#c8b8ff', side: THREE.DoubleSide, transparent: true, opacity: 0.35, fog: false }));
      pring.position.copy(planet.position); pring.rotation.x = 1.2; pring.rotation.y = 0.3;
      G.add(pring);
      this.scene.fog.near = R * 6; this.scene.fog.far = R * 30;
    } else if (b === 'volcano') {
      const rockMat = new THREE.MeshStandardMaterial({ color: '#2a1a14', roughness: 0.95, flatShading: true });
      for (let i = 0; i < 40; i++) {
        const a = rand(0, TAU);
        const d = rand(R + 10, R * 4);
        const s = rand(2, 9);
        const rock = new THREE.Mesh(new THREE.ConeGeometry(s, s * rand(1.2, 3), 6), rockMat);
        rock.position.set(Math.cos(a) * d, -2.5 + s * 0.6, Math.sin(a) * d);
        G.add(rock);
      }
      const lavaSea = new THREE.Mesh(new THREE.RingGeometry(R + 4, 420, 64), new THREE.MeshStandardMaterial({ color: '#1a0300', emissive: '#ff3a00', emissiveIntensity: 0.9, emissiveMap: lavaTexture() }));
      lavaSea.rotation.x = -Math.PI / 2; lavaSea.position.y = -2.4;
      G.add(lavaSea);
      ground.visible = false;
      this.ambient = { color: new THREE.Color('#ff7a2a'), rate: 30, kind: 'ember' };
    } else if (b === 'neon') {
      const grid = new THREE.GridHelper(600, 120, '#ff2bd6', '#2ad4ff');
      grid.position.y = -2.4;
      grid.material.transparent = true; grid.material.opacity = 0.55;
      grid.material.toneMapped = false;
      G.add(grid);
      const edgeMat = new THREE.LineBasicMaterial({ color: '#2ad4ff', toneMapped: false });
      const boxMat = new THREE.MeshStandardMaterial({ color: '#0a0818', roughness: 0.4, metalness: 0.8 });
      for (let i = 0; i < 46; i++) {
        const a = rand(0, TAU);
        const d = rand(R + 20, R * 5);
        const w = rand(4, 12);
        const h = rand(10, 70);
        const geo = new THREE.BoxGeometry(w, h, w);
        const m = new THREE.Mesh(geo, boxMat);
        m.position.set(Math.cos(a) * d, h / 2 - 2.4, Math.sin(a) * d);
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), i % 3 ? edgeMat : new THREE.LineBasicMaterial({ color: '#ff2bd6', toneMapped: false }));
        e.position.copy(m.position);
        G.add(m, e);
      }
      ground.material.color.set('#05040c');
      this.ambient = { color: new THREE.Color('#ff6bf0'), rate: 8, kind: 'dust' };
    } else if (b === 'temple') {
      const marble = new THREE.MeshStandardMaterial({ color: '#efe6d8', roughness: 0.35 });
      const count = 14;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        const d = R + 7;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 14, 20), marble);
        col.position.set(Math.cos(a) * d, 4.5, Math.sin(a) * d);
        col.castShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 2.8), marble);
        cap.position.set(col.position.x, 11.8, col.position.z);
        G.add(col, cap);
      }
      const sun = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: '#ffd28a', fog: false, toneMapped: false }));
      sun.position.set(0, 30, -380);
      G.add(sun);
      ground.material.color.set('#3a2a2a');
      this.ambient = { color: new THREE.Color('#ffe2a8'), rate: 6, kind: 'dust' };
    } else if (b === 'ocean') {
      ground.material.color.set('#0a2a3a');
      const coralMat = new THREE.MeshStandardMaterial({ color: '#ff6b8a', roughness: 0.7 });
      for (let i = 0; i < 30; i++) {
        const a = rand(0, TAU);
        const d = rand(R + 6, R * 3);
        const c = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(1, 4), 0), i % 2 ? coralMat : new THREE.MeshStandardMaterial({ color: '#2fd6b0', roughness: 0.6 }));
        c.position.set(Math.cos(a) * d, -2, Math.sin(a) * d);
        G.add(c);
      }
      this.ambient = { color: new THREE.Color('#bfeaff'), rate: 18, kind: 'bubble' };
    } else if (b === 'storm') {
      ground.material.color.set('#15181e');
      this.ambient = { color: new THREE.Color('#9fb4cc'), rate: 50, kind: 'rain' };
      this.stormT = 2;
    } else {
      ground.material.color.set('#0d0f15');
      this.ambient = { color: new THREE.Color('#9fb8ff'), rate: 4, kind: 'dust' };
    }
    G.add(ground);
  }

  // ---------- materials ----------
  ballMaterial(b) {
    const mk = b.material && b.material !== 'auto' ? b.material : (ELEMENTS[b.element] || ELEMENTS.fire).mat;
    const color = new THREE.Color(b.color);
    const base = { color, map: ballPattern(), envMapIntensity: 1 };
    let m;
    switch (mk) {
      case 'chrome': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }); break;
      case 'gold': m = new THREE.MeshPhysicalMaterial({ ...base, color: color.clone().lerp(new THREE.Color('#ffc845'), 0.55), metalness: 1, roughness: 0.16, clearcoat: 0.6 }); break;
      case 'metallic': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.85, roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.1 }); break;
      case 'glass':
        m = this.q.glass
          ? new THREE.MeshPhysicalMaterial({ ...base, map: null, metalness: 0, roughness: 0.03, transmission: 1, thickness: 1.6, ior: 1.5, attenuationColor: color, attenuationDistance: 1.2, color: color.clone().lerp(new THREE.Color('#ffffff'), 0.6) })
          : new THREE.MeshPhysicalMaterial({ ...base, map: null, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.62, clearcoat: 1 });
        break;
      case 'crystal':
        m = this.q.glass
          ? new THREE.MeshPhysicalMaterial({ ...base, map: null, metalness: 0, roughness: 0, transmission: 0.95, thickness: 2, ior: 2.1, iridescence: 1, iridescenceIOR: 1.6, attenuationColor: color, attenuationDistance: 1.5, color: color.clone().lerp(new THREE.Color('#ffffff'), 0.4) })
          : new THREE.MeshPhysicalMaterial({ ...base, map: null, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.7, iridescence: 1, clearcoat: 1 });
        break;
      case 'lava': m = new THREE.MeshPhysicalMaterial({ ...base, map: null, color: color.clone().multiplyScalar(0.18), emissive: color, emissiveMap: lavaTexture(), emissiveIntensity: 2.2, roughness: 0.55, metalness: 0.1, clearcoat: 0.3 }); break;
      case 'holo': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.75, roughness: 0.12, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [200, 900], clearcoat: 1, emissive: color, emissiveIntensity: 0.25 }); break;
      case 'pearl': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.1, roughness: 0.28, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4, iridescence: 0.45, clearcoat: 1, clearcoatRoughness: 0.1 }); break;
      case 'matte': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0, roughness: 0.85 }); break;
      case 'neon': m = new THREE.MeshPhysicalMaterial({ ...base, emissive: color, emissiveIntensity: 1.8, roughness: 0.3, clearcoat: 1 }); break;
      default: m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.05, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04 }); break;
    }
    const glowEl = { lightning: 0.35, fire: 0.25, poison: 0.25, light: 0.3, void: 0.2, cosmic: 0.25 };
    if (mk !== 'lava' && mk !== 'neon' && glowEl[b.element]) {
      m.emissive = color.clone();
      m.emissiveIntensity = glowEl[b.element];
    }
    if (b.archetype === 'ghost') { m.transparent = true; m.opacity = 0.6; }
    m.userData.mk = mk;
    m.userData.baseOpacity = m.opacity;
    return m;
  }

  // ---------- ball views ----------
  makeView(b) {
    const root = new THREE.Group();
    const body = new THREE.Mesh(this.sphereGeo, this.ballMaterial(b));
    body.castShadow = true;
    body.receiveShadow = true;
    body.quaternion.setFromEuler(new THREE.Euler(rand(0, TAU), rand(0, TAU), 0));
    root.add(body);
    const v = { b, root, body, color: b.color, element: b.element, extras: {}, dying: 0, lastX: b.x, lastZ: b.z };
    // spikes rotate with the body
    if (b.weapon.type === 'spikes') {
      const cone = new THREE.ConeGeometry(0.16, 0.5, 8);
      const smat = new THREE.MeshStandardMaterial({ color: '#d7dde5', metalness: 1, roughness: 0.2 });
      const n = Math.max(4, b.weapon.count);
      for (let i = 0; i < n; i++) {
        const dir = new THREE.Vector3().randomDirection();
        if (i < 12) {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
          const th = Math.PI * (1 + Math.sqrt(5)) * i;
          dir.set(Math.cos(th) * Math.sin(phi), Math.cos(phi), Math.sin(th) * Math.sin(phi));
        }
        const c = new THREE.Mesh(cone, smat);
        c.position.copy(dir).multiplyScalar(1.05);
        c.quaternion.setFromUnitVectors(UP, dir);
        c.scale.setScalar(Math.max(0.6, b.weapon.size * 2));
        body.add(c);
      }
    }
    // face (doesn't roll)
    if (b.face && this.settings.faces) {
      const face = new THREE.Group();
      const white = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, clearcoat: 1 });
      const black = new THREE.MeshBasicMaterial({ color: '#0a0a0a' });
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(this.lowSphere, white);
        eye.scale.set(0.2, 0.24, 0.12);
        eye.position.set(sx * 0.3, 0.28, 0.93);
        const pupil = new THREE.Mesh(this.lowSphere, black);
        pupil.scale.set(0.09, 0.11, 0.05);
        pupil.position.set(sx * 0.3, 0.27, 1.04);
        face.add(eye, pupil);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.05), black);
        brow.position.set(sx * 0.3, 0.55, 0.85);
        brow.rotation.z = sx * -0.35;
        face.add(brow);
      }
      root.add(face);
      v.face = face;
    }
    // crown for kings / bosses
    if (b.archetype === 'king' || b.isBoss) {
      const crown = new THREE.Group();
      const gold = new THREE.MeshPhysicalMaterial({ color: '#ffc93d', metalness: 1, roughness: 0.15, clearcoat: 1 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.2, 24, 1, true), gold);
      band.material.side = THREE.DoubleSide;
      crown.add(band);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 6), gold);
        sp.position.set(Math.cos(a) * 0.42, 0.22, Math.sin(a) * 0.42);
        crown.add(sp);
        const gem = new THREE.Mesh(this.lowSphere, new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff2a55' : '#2ad4ff', toneMapped: false }));
        gem.scale.setScalar(0.05);
        gem.position.set(Math.cos(a) * 0.45, 0.02, Math.sin(a) * 0.45);
        crown.add(gem);
      }
      crown.position.y = 1.02;
      root.add(crown);
      v.crown = crown;
    }
    // team ring
    const tc = teamColor(b.team);
    if (tc && this.sim && this.sim.mode !== 'ffa' && this.sim.mode !== 'royale') {
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: tc, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      this.fxRoot.add(ring);
      v.teamRing = ring;
    }
    // shield bubble & freeze shell (hidden by default)
    const shield = new THREE.Mesh(this.sphereGeo, new THREE.MeshPhysicalMaterial({ color: '#7fd4ff', transparent: true, opacity: 0.22, roughness: 0, metalness: 0, clearcoat: 1, emissive: '#3aa8ff', emissiveIntensity: 0.4, depthWrite: false }));
    shield.scale.setScalar(1.35);
    shield.visible = false;
    root.add(shield);
    v.shield = shield;
    const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 1), new THREE.MeshPhysicalMaterial({ color: '#dff7ff', transparent: true, opacity: 0.55, roughness: 0.05, flatShading: true, clearcoat: 1, depthWrite: false }));
    ice.visible = false;
    root.add(ice);
    v.ice = ice;
    // weapon parts
    this.makeWeapon(v);
    // hp bar
    if (this.settings.hpBars) {
      const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#000000', opacity: 0.55, transparent: true, depthTest: false, toneMapped: false }));
      const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#3ddc84', depthTest: false, toneMapped: false }));
      bg.renderOrder = 20; fill.renderOrder = 21;
      this.fxRoot.add(bg, fill);
      v.hpBg = bg; v.hpFill = fill;
    }
    this.scene.add(root);
    return v;
  }

  makeWeapon(v) {
    const w = v.b.weapon;
    v.wparts = [];
    if (w.type === 'none' || w.type === 'spikes' || w.type === 'laser') return;
    const col = new THREE.Color(w.color);
    const n = Math.max(1, w.count);
    if (w.type === 'shield') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.05, 8, 64, Math.PI * 1.1), new THREE.MeshBasicMaterial({ color: w.color === '#dfe8ff' ? '#59c8ff' : w.color, toneMapped: false, transparent: true, opacity: 0.85 }));
      ring.rotation.x = Math.PI / 2;
      v.root.add(ring);
      v.wparts.push(ring);
      v.shieldRing = ring;
      return;
    }
    for (let i = 0; i < n; i++) {
      let m;
      if (w.type === 'blades') {
        const g = new THREE.Group();
        const blade = new THREE.Mesh(new THREE.ConeGeometry(w.size * 0.55, w.size * 2.2, 4), new THREE.MeshPhysicalMaterial({ color: col, metalness: 1, roughness: 0.12, clearcoat: 1, emissive: col, emissiveIntensity: w.color === '#dfe8ff' ? 0 : 0.6 }));
        blade.rotation.z = Math.PI / 2;
        blade.scale.set(1, 1, 0.25);
        g.add(blade);
        m = g;
      } else if (w.type === 'hammer') {
        const g = new THREE.Group();
        const head = new THREE.Mesh(new THREE.BoxGeometry(w.size * 1.4, w.size * 1.4, w.size * 2.2), new THREE.MeshPhysicalMaterial({ color: w.color === '#dfe8ff' ? '#8d949e' : col, metalness: 1, roughness: 0.3, clearcoat: 0.5 }));
        head.castShadow = true;
        g.add(head);
        m = g;
        const chainGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
        const chain = new THREE.Line(chainGeo, new THREE.LineBasicMaterial({ color: '#c0c6cf' }));
        this.fxRoot.add(chain);
        v.chain = chain;
      } else {
        const g = new THREE.Group();
        const saucer = new THREE.Mesh(new THREE.CylinderGeometry(w.size, w.size * 0.6, w.size * 0.4, 20), new THREE.MeshPhysicalMaterial({ color: '#cfd6e0', metalness: 1, roughness: 0.2 }));
        const dome = new THREE.Mesh(this.lowSphere, new THREE.MeshBasicMaterial({ color: w.color === '#dfe8ff' ? '#7fe3ff' : col, toneMapped: false }));
        dome.scale.setScalar(w.size * 0.45);
        dome.position.y = w.size * 0.25;
        g.add(saucer, dome);
        m = g;
      }
      this.fxRoot.add(m);
      v.wparts.push(m);
    }
  }

  removeView(v, instant) {
    this.scene.remove(v.root);
    v.body.material.dispose();
    for (const k of ['hpBg', 'hpFill', 'teamRing', 'chain']) if (v[k]) { this.fxRoot.remove(v[k]); if (v[k].material) v[k].material.dispose(); }
    for (const p of v.wparts || []) if (p.parent === this.fxRoot) this.fxRoot.remove(p);
    void instant;
  }

  // ---------- per-frame sync ----------
  sync(sim, dt) {
    this.sim = sim;
    this.time += dt;
    const seen = new Set();
    for (const b of sim.balls) {
      let v = this.views.get(b.id);
      if (!b.alive) {
        if (v && !v.dying) v.dying = 0.0001;
        continue;
      }
      if (!v) { v = this.makeView(b); this.views.set(b.id, v); }
      seen.add(b.id);
      this.updateView(v, dt);
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      if (v.dying > 0) {
        v.dying += dt;
        const s = Math.max(0.001, v.b.radius * (1 - v.dying / 0.25));
        v.root.scale.setScalar(s);
        if (v.dying > 0.25) { this.removeView(v); this.views.delete(id); }
      } else { this.removeView(v); this.views.delete(id); }
    }
    // spinner, bumpers, portals, walls scale, lava
    if (this.spinner) this.spinner.rotation.y = -sim.spinAngle;
    if (this.walls) this.walls.scale.set(sim.scale, 1, sim.scale);
    if (this.spinner) this.spinner.scale.set(1, 1, 1);
    for (const bm of this.bumperMeshes || []) {
      const f = bm.p.flash || 0;
      if (f > 0) bm.p.flash = Math.max(0, f - dt);
      const c = 1 + f * 6;
      bm.top.material.color.setRGB(0.21 * c, 0.78 * c, 1 * c);
      bm.band.material.color.copy(bm.top.material.color);
    }
    for (const pm of this.portalMeshes || []) {
      pm.grp.rotation.y += dt * 2;
      if (Math.random() < 0.6) this.partsAdd.emit(pm.p.x + rand(-1, 1), 0.2, pm.p.z + rand(-1, 1), { color: pm.color, speed: 1.5, size: 0.25, life: 0.8, gravity: -2 });
    }
    if (this.lavaMat) this.lavaMat.emissiveIntensity = 1.4 + Math.sin(this.time * 3) * 0.3;
    this.syncProjectiles(sim, dt);
    this.syncZones(sim, dt);
  }

  updateView(v, dt) {
    const b = v.b;
    const r = b.radius;
    v.root.position.set(b.x, b.y, b.z);
    v.root.scale.setScalar(r);
    // rolling
    const dx = b.x - v.lastX;
    const dz = b.z - v.lastZ;
    const d = Math.hypot(dx, dz);
    if (d > 0.0001 && d < 5) {
      const axis = new THREE.Vector3(dz / d, 0, -dx / d);
      const q = new THREE.Quaternion().setFromAxisAngle(axis, d / r);
      v.body.quaternion.premultiply(q);
    }
    v.lastX = b.x; v.lastZ = b.z;
    // face looks where it moves
    if (v.face) {
      const sp = Math.hypot(b.vx, b.vz);
      let targetYaw = v.face.rotation.y;
      if (b.target && b.target.alive) targetYaw = Math.atan2(b.target.x - b.x, b.target.z - b.z);
      else if (sp > 0.5) targetYaw = Math.atan2(b.vx, b.vz);
      let diff = targetYaw - v.face.rotation.y;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      v.face.rotation.y += diff * Math.min(1, dt * 8);
    }
    if (v.crown) v.crown.rotation.y += dt * 0.6;
    // colour change (shapeshifter)
    if (v.color !== b.color) {
      v.color = b.color;
      const old = v.body.material;
      v.body.material = this.ballMaterial(b);
      old.dispose();
    }
    const m = v.body.material;
    // statuses
    const st = b.st;
    const phase = !!st.phase;
    const wantOpacity = phase ? 0.25 : m.userData.baseOpacity;
    if (m.opacity !== wantOpacity) { m.transparent = phase || m.userData.baseOpacity < 1; m.opacity = wantOpacity; m.needsUpdate = true; }
    v.shield.visible = !!(st.shield && st.shield.v > 0) || !!st.armor;
    if (v.shield.visible) {
      v.shield.material.color.set(st.armor && !st.shield ? '#e8eef8' : '#7fd4ff');
      v.shield.scale.setScalar(1.3 + Math.sin(this.time * 6) * 0.03);
    }
    v.ice.visible = !!st.freeze;
    if (v.shieldRing) v.shieldRing.rotation.z += dt * 2.5;
    const wp = new THREE.Vector3(b.x, b.y, b.z);
    if (st.burn && Math.random() < 0.7) this.partsAdd.emit(wp.x + rand(-r, r) * 0.6, wp.y + r * 0.6, wp.z + rand(-r, r) * 0.6, { color: TMP_COLOR.setHSL(rand(0.02, 0.1), 1, 0.55), speed: 2, size: 0.45 * r, life: 0.5, gravity: -6, dir: UP, spread: 0.6 });
    if (st.poison && Math.random() < 0.35) this.partsAdd.emit(wp.x + rand(-r, r) * 0.6, wp.y + r * 0.5, wp.z + rand(-r, r) * 0.6, { color: TMP_COLOR.set('#7dff3a'), speed: 1.2, size: 0.25, life: 0.8, gravity: -2, dir: UP });
    if ((st.stun || st.freeze) && Math.random() < 0.4) {
      const a = this.time * 8 + Math.random();
      this.partsAdd.emit(wp.x + Math.cos(a) * r * 0.8, wp.y + r * 1.25, wp.z + Math.sin(a) * r * 0.8, { color: TMP_COLOR.set(st.freeze ? '#cfefff' : '#ffe14d'), speed: 0.3, size: 0.25, life: 0.3, gravity: 0 });
    }
    if (st.rage && Math.random() < 0.5) this.partsAdd.emit(wp.x, wp.y + r, wp.z, { color: TMP_COLOR.set('#ff2a2a'), speed: 2.5, size: 0.35, life: 0.4, gravity: -3 });
    if (st.root && Math.random() < 0.3) this.partsNorm.emit(wp.x + rand(-r, r), 0.1, wp.z + rand(-r, r), { color: TMP_COLOR.set('#2f9f3a'), speed: 1, size: 0.3, life: 0.6, gravity: -1, dir: UP });
    // trail
    const speed = Math.hypot(b.vx, b.vz);
    if (this.settings.trails && speed > 8 && Math.random() < 0.8) {
      this.partsAdd.emit(wp.x, wp.y - r * 0.2, wp.z, { color: TMP_COLOR.set(b.color), speed: 0.4, size: 0.5 * r, life: 0.35, gravity: 0 });
    }
    // weapon parts
    const w = b.weapon;
    if (v.wparts && v.wparts.length && w.type !== 'shield') {
      for (let i = 0; i < v.wparts.length; i++) {
        const p = weaponOrbit(b, i);
        const part = v.wparts[i];
        part.position.set(p.x, p.y, p.z);
        if (w.type === 'blades') { part.rotation.y = -(w.angle + (i * TAU) / v.wparts.length); part.rotation.x += dt * 10; }
        if (w.type === 'hammer') { part.rotation.y = -(w.angle + (i * TAU) / v.wparts.length); }
        if (w.type === 'drones') part.position.y += Math.sin(this.time * 4 + i) * 0.15;
      }
      if (v.chain) {
        const p = weaponOrbit(b, 0);
        const arr = v.chain.geometry.attributes.position.array;
        arr[0] = b.x; arr[1] = b.y; arr[2] = b.z; arr[3] = p.x; arr[4] = p.y; arr[5] = p.z;
        v.chain.geometry.attributes.position.needsUpdate = true;
        v.chain.geometry.computeBoundingSphere();
      }
    }
    if (v.teamRing) {
      v.teamRing.position.set(b.x, 0.04, b.z);
      v.teamRing.scale.setScalar(r * 1.25);
    }
    if (v.hpBg) {
      const frac = Math.max(0.001, b.hp / b.maxHp);
      const wdt = Math.max(1.4, Math.min(4, r * 2));
      const y = b.y + r + 0.55 + (v.crown ? r * 0.35 : 0);
      v.hpBg.position.set(b.x, y, b.z);
      v.hpBg.scale.set(wdt + 0.08, 0.24, 1);
      v.hpFill.position.set(b.x, y, b.z);
      v.hpFill.scale.set(wdt * frac, 0.16, 1);
      v.hpFill.center.set(0.5 / frac, 0.5); // keeps the bar's left edge fixed
      v.hpFill.material.color.setHSL(frac * 0.33, 0.85, 0.5);
    }
  }

  syncProjectiles(sim, dt) {
    const live = new Set();
    for (const p of sim.projectiles) {
      if (!p.alive) continue;
      live.add(p.id);
      let m = this.projViews.get(p.id);
      if (!m) {
        m = new THREE.Mesh(this.lowSphere, new THREE.MeshBasicMaterial({ color: p.color, toneMapped: false }));
        m.material.color.multiplyScalar(2);
        this.fxRoot.add(m);
        this.projViews.set(p.id, m);
      }
      m.position.set(p.x, p.y, p.z);
      m.scale.setScalar(p.r);
      this.partsAdd.emit(p.x, p.y, p.z, { color: TMP_COLOR.set(p.color), speed: 0.3, size: p.r * 2.4, life: 0.25, gravity: 0 });
    }
    for (const [id, m] of this.projViews) {
      if (!live.has(id)) { this.fxRoot.remove(m); m.material.dispose(); this.projViews.delete(id); }
    }
    void dt;
  }

  syncZones(sim, dt) {
    const live = new Set(sim.zones);
    for (const z of sim.zones) {
      let v = this.zoneViews.get(z);
      if (!v) {
        v = new THREE.Group();
        const col = new THREE.Color(z.color);
        if (z.type === 'poison') {
          const disc = new THREE.Mesh(new THREE.CircleGeometry(z.r, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, map: glowTexture(), depthWrite: false, toneMapped: false }));
          disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05;
          v.add(disc);
        } else if (z.type === 'void' || z.type === 'well') {
          const core = new THREE.Mesh(this.sphereGeo, new THREE.MeshPhysicalMaterial({ color: '#000000', roughness: 0, metalness: 1, clearcoat: 1 }));
          core.scale.setScalar(1.1); core.position.y = 1.4;
          const halo = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.12, 8, 64), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
          halo.position.y = 1.4; halo.rotation.x = Math.PI / 2.3;
          const disc = new THREE.Mesh(new THREE.CircleGeometry(z.r, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, map: glowTexture(), depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
          disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05;
          v.add(core, halo, disc);
          v.userData.halo = halo;
        } else {
          const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: z.type === 'bomb' ? '#ff3a2a' : col, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }));
          ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
          ring.scale.setScalar(z.r);
          v.add(ring);
          v.userData.ring = ring;
          if (z.type === 'meteor') {
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: '#3a2a20', emissive: z.color, emissiveIntensity: 1.5, roughness: 0.8, flatShading: true }));
            v.add(rock);
            v.userData.rock = rock;
          }
          if (z.type === 'bomb') {
            const bomb = new THREE.Mesh(this.lowSphere, new THREE.MeshPhysicalMaterial({ color: '#111111', metalness: 0.6, roughness: 0.3, emissive: '#ff2a00', emissiveIntensity: 0 }));
            bomb.scale.setScalar(0.5); bomb.position.y = 0.5;
            v.add(bomb);
            v.userData.bomb = bomb;
          }
        }
        v.position.set(z.x, 0, z.z);
        this.fxRoot.add(v);
        this.zoneViews.set(z, v);
      }
      const f = Math.min(1, z.t / z.dur);
      if (z.type === 'poison' && Math.random() < 0.8) this.partsAdd.emit(z.x + rand(-z.r, z.r) * 0.7, 0.2, z.z + rand(-z.r, z.r) * 0.7, { color: TMP_COLOR.set('#7dff3a'), speed: 1.2, size: 0.6, life: 1, gravity: -1.5, dir: UP });
      if (z.type === 'void' || z.type === 'well') {
        v.userData.halo.rotation.z += dt * 4;
        for (let k = 0; k < 2; k++) {
          const a = rand(0, TAU);
          const rr = z.r * rand(0.6, 1);
          const px = z.x + Math.cos(a) * rr;
          const pz = z.z + Math.sin(a) * rr;
          this.partsAdd.emit(px, rand(0.2, 2.5), pz, { color: TMP_COLOR.set(z.color), speed: rr * 1.6, dir: new THREE.Vector3(-Math.cos(a), 0.2, -Math.sin(a)), spread: 0.2, size: 0.3, life: 0.6, gravity: 0, drag: 0 });
        }
      }
      if (v.userData.ring) {
        v.userData.ring.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(this.time * (6 + f * 14)));
        v.userData.ring.scale.setScalar(z.r * (0.6 + 0.4 * f));
      }
      if (v.userData.rock) {
        v.userData.rock.position.set(-6 * (1 - f), 22 * (1 - f) + 0.5, -6 * (1 - f));
        v.userData.rock.rotation.x += dt * 5;
        this.partsAdd.emit(z.x + v.userData.rock.position.x, v.userData.rock.position.y, z.z + v.userData.rock.position.z, { color: TMP_COLOR.set('#ff8a3a'), speed: 1, size: 0.9, life: 0.4, gravity: 0 });
      }
      if (v.userData.bomb) v.userData.bomb.material.emissiveIntensity = Math.sin(this.time * (8 + f * 30)) > 0 ? 2.5 : 0;
    }
    for (const [z, v] of this.zoneViews) {
      if (!live.has(z)) {
        this.fxRoot.remove(v);
        v.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry && o.geometry !== this.sphereGeo && o.geometry !== this.ringGeo && o.geometry !== this.lowSphere) o.geometry.dispose(); });
        this.zoneViews.delete(z);
      }
    }
  }

  // ---------- effects ----------
  segment(a, b, width, color, life) {
    let s = this.segs.find((x) => !x.visible);
    if (!s) {
      if (this.segs.length > 400) return;
      s = new THREE.Mesh(this.segGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.fxRoot.add(s);
      this.segs.push(s);
    }
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.001) return;
    s.position.copy(a).addScaledVector(dir, 0.5);
    s.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
    s.scale.set(width, len, width);
    s.material.color.set(color).multiplyScalar(2.2);
    s.material.opacity = 1;
    s.userData.t = life;
    s.userData.life = life;
    s.userData.w = width;
    s.visible = true;
  }

  ring(x, z, r, color, y = 0.08, life = 0.55) {
    let m = this.rings.find((q) => !q.visible);
    if (!m) {
      if (this.rings.length > 80) return;
      m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      this.fxRoot.add(m);
      this.rings.push(m);
    }
    m.position.set(x, y, z);
    m.material.color.set(color).multiplyScalar(1.6);
    m.userData = { t: life, life, r };
    m.scale.setScalar(0.1);
    m.visible = true;
  }

  flash(x, y, z, r, color) {
    let m = this.flashes.find((q) => !q.visible);
    if (!m) {
      if (this.flashes.length > 40) return;
      m = new THREE.Mesh(this.lowSphere, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.fxRoot.add(m);
      this.flashes.push(m);
    }
    m.position.set(x, y, z);
    m.material.color.set(color).multiplyScalar(2);
    m.userData = { t: 0.35, life: 0.35, r };
    m.visible = true;
    const l = this.lights.reduce((p, q) => (q.intensity < p.intensity ? q : p));
    l.position.set(x, y + 1.5, z);
    l.color.set(color);
    l.intensity = 40 * r;
    l.distance = r * 6 + 6;
  }

  bolt(a, b, color) {
    const segs = Math.max(4, Math.round(a.distanceTo(b) / 1.2));
    let prev = a.clone();
    const dir = new THREE.Vector3().subVectors(b, a);
    for (let i = 1; i <= segs; i++) {
      const p = a.clone().addScaledVector(dir, i / segs);
      if (i < segs) p.add(new THREE.Vector3(rand(-0.6, 0.6), rand(-0.4, 0.6), rand(-0.6, 0.6)));
      this.segment(prev, p, 0.07, color, 0.16);
      this.segment(prev, p, 0.22, color, 0.1);
      prev = p;
    }
  }

  fxHooks() {
    const col = (c) => TMP_COLOR.set(c);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    return {
      hit: (x, y, z, dmg, color, crit) => {
        if (this.settings.numbers) this.addNumber(x, y + 0.3, z, Math.round(dmg).toString(), color, crit ? 1.6 : dmg > 30 ? 1.25 : 1);
        if (crit) for (let i = 0; i < 14; i++) this.partsAdd.emit(x, y, z, { color: col('#ffe14d'), speed: 9, size: 0.3, life: 0.4 });
      },
      text: (x, y, z, txt, color, size = 1) => this.addNumber(x, y, z, txt, color, size, true),
      lightning: (pts, color) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = V(pts[i].x, pts[i].y + 0.4, pts[i].z);
          const b = V(pts[i + 1].x, pts[i + 1].y + 0.4, pts[i + 1].z);
          this.bolt(a, b, color);
          for (let k = 0; k < 12; k++) this.partsAdd.emit(b.x, b.y, b.z, { color: col(color), speed: 8, size: 0.25, life: 0.3 });
        }
        const last = pts[pts.length - 1];
        this.flash(last.x, last.y + 0.5, last.z, 1.2, color);
      },
      explosion: (x, z, r, color) => {
        this.flash(x, 1, z, r * 0.8, color);
        this.ring(x, z, r, color);
        this.ring(x, z, r * 0.6, '#ffffff', 0.12, 0.35);
        const n = Math.min(80, Math.round(r * 14));
        for (let i = 0; i < n; i++) this.partsAdd.emit(x, 0.6, z, { color: col(color).offsetHSL(rand(-0.05, 0.05), 0, rand(-0.1, 0.2)), speed: r * 3.5, size: rand(0.3, 0.8), life: 0.7 });
        for (let i = 0; i < n / 2; i++) this.partsNorm.emit(x + rand(-1, 1), 0.5, z + rand(-1, 1), { color: col('#2a2522'), speed: r * 1.5, size: rand(0.8, 1.6), life: 1.3, gravity: -1.2, drag: 2 });
      },
      ring: (x, z, r, color) => this.ring(x, z, r, color),
      beam: (a, b, color, life = 0.22) => {
        const p = V(a.x, a.y + 0.2, a.z);
        const q = V(b.x, b.y + 0.2, b.z);
        this.segment(p, q, 0.08, color, life);
        this.segment(p, q, 0.28, color, life * 0.7);
        for (let i = 0; i < 8; i++) this.partsAdd.emit(q.x, q.y, q.z, { color: col(color), speed: 5, size: 0.3, life: 0.35 });
      },
      spark: (x, y, z, color, n) => {
        for (let i = 0; i < n; i++) this.partsAdd.emit(x, y, z, { color: col(color), speed: 7, size: 0.18, life: 0.35, gravity: 12 });
      },
      spawn: (b) => {
        this.ring(b.x, b.z, b.radius * 2.2, b.color);
        for (let i = 0; i < 20; i++) this.partsAdd.emit(b.x, 0.3, b.z, { color: col(b.color), speed: 4, size: 0.3, life: 0.6, gravity: -2 });
      },
      death: (b) => {
        this.flash(b.x, b.y, b.z, b.radius * 1.6, b.color);
        this.ring(b.x, b.z, b.radius * 4, b.color);
        const n = Math.min(90, 30 + b.radius * 25);
        for (let i = 0; i < n; i++) this.partsAdd.emit(b.x, b.y, b.z, { color: col(b.color).offsetHSL(0, 0, rand(-0.1, 0.3)), speed: 10 + b.radius * 3, size: rand(0.2, 0.6) * Math.max(1, b.radius), life: 0.9, gravity: 14 });
        for (let i = 0; i < n / 3; i++) this.partsNorm.emit(b.x, b.y, b.z, { color: col('#1e1e22'), speed: 3, size: 1.2, life: 1.2, gravity: -1 });
        this.shakeAmt = Math.max(this.shakeAmt, 0.4 + b.radius * 0.2);
      },
      heal: (x, y, z, amt) => {
        if (this.settings.numbers && amt >= 3) this.addNumber(x, y + 0.4, z, '+' + amt, '#5dff9a', 0.9);
        for (let i = 0; i < 6; i++) this.partsAdd.emit(x + rand(-0.6, 0.6), y - 0.5, z + rand(-0.6, 0.6), { color: col('#6dffa8'), speed: 1.5, size: 0.25, life: 0.7, gravity: -3, dir: UP });
      },
      shake: (a) => { if (this.settings.shake) this.shakeAmt = Math.max(this.shakeAmt, a); },
      say: (b, text) => this.addBubble(b, text),
      teleport: (x1, z1, x2, z2, color) => {
        for (const [x, z] of [[x1, z1], [x2, z2]]) {
          this.ring(x, z, 2, color);
          for (let i = 0; i < 18; i++) this.partsAdd.emit(x, 0.8, z, { color: col(color), speed: 5, size: 0.3, life: 0.45, gravity: -3 });
        }
      },
      revive: (b) => {
        this.flash(b.x, b.y, b.z, 3, '#ff7a1a');
        for (let i = 0; i < 70; i++) this.partsAdd.emit(b.x, b.y, b.z, { color: col('#ff8a2a').offsetHSL(rand(-0.04, 0.04), 0, rand(-0.1, 0.2)), speed: 9, size: 0.6, life: 1, gravity: -8, upBias: 2 });
      },
    };
  }

  addNumber(x, y, z, text, color, size = 1, big = false) {
    if (this.numbers.length > 70) { const old = this.numbers.shift(); old.el.remove(); }
    const el = document.createElement('div');
    el.className = big ? 'fnum big' : 'fnum';
    el.textContent = text;
    el.style.color = color;
    el.style.fontSize = (big ? 30 : 15) * size + 'px';
    this.overlay.appendChild(el);
    this.numbers.push({ el, x: x + rand(-0.4, 0.4), y, z: z + rand(-0.4, 0.4), t: 0, life: big ? 1.6 : 0.9 });
  }

  addBubble(b, text) {
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    this.overlay.appendChild(el);
    this.bubbles.push({ el, b, t: 0, life: 1.8 });
  }

  updateOverlay(dt) {
    const v = new THREE.Vector3();
    const w = this.viewW;
    const h = this.viewH;
    this.numbers = this.numbers.filter((n) => {
      n.t += dt;
      if (n.t > n.life) { n.el.remove(); return false; }
      v.set(n.x, n.y + n.t * 1.6, n.z).project(this.camera);
      if (v.z > 1) { n.el.style.display = 'none'; return true; }
      n.el.style.display = '';
      const f = n.t / n.life;
      n.el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h}px) scale(${f < 0.15 ? 0.6 + f * 4 : 1})`;
      n.el.style.opacity = f > 0.6 ? (1 - f) / 0.4 : 1;
      return true;
    });
    this.bubbles = this.bubbles.filter((s) => {
      s.t += dt;
      if (s.t > s.life || !s.b.alive) { s.el.remove(); return false; }
      v.set(s.b.x, s.b.y + s.b.radius * 2 + 0.8, s.b.z).project(this.camera);
      s.el.style.transform = `translate(-50%,-100%) translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h}px)`;
      s.el.style.opacity = s.t > s.life - 0.3 ? (s.life - s.t) / 0.3 : 1;
      return true;
    });
  }

  updateFx(dt) {
    for (const s of this.segs) {
      if (!s.visible) continue;
      s.userData.t -= dt;
      if (s.userData.t <= 0) { s.visible = false; continue; }
      const f = s.userData.t / s.userData.life;
      s.material.opacity = f;
      s.scale.x = s.scale.z = s.userData.w * (0.5 + f * 0.5);
    }
    for (const m of this.rings) {
      if (!m.visible) continue;
      m.userData.t -= dt;
      if (m.userData.t <= 0) { m.visible = false; continue; }
      const f = 1 - m.userData.t / m.userData.life;
      m.scale.setScalar(Math.max(0.05, m.userData.r * (0.15 + 0.85 * Math.sqrt(f))));
      m.material.opacity = 1 - f;
    }
    for (const m of this.flashes) {
      if (!m.visible) continue;
      m.userData.t -= dt;
      if (m.userData.t <= 0) { m.visible = false; continue; }
      const f = 1 - m.userData.t / m.userData.life;
      m.scale.setScalar(m.userData.r * (0.4 + f * 1.2));
      m.material.opacity = (1 - f) * 0.9;
    }
    for (const l of this.lights) if (l.intensity > 0) l.intensity = Math.max(0, l.intensity - dt * 160);
    // ambient particles
    const a = this.ambient;
    if (a && this.R) {
      const n = a.rate * dt;
      for (let i = 0; i < n || Math.random() < n - i; i++) {
        const R = this.R * 1.6;
        const x = rand(-R, R);
        const z = rand(-R, R);
        if (a.kind === 'ember') this.partsAdd.emit(x, rand(0, 2), z, { color: a.color, speed: 2, size: 0.18, life: 3, gravity: -1.2, dir: UP, spread: 0.5 });
        else if (a.kind === 'bubble') this.partsAdd.emit(x, 0, z, { color: a.color, speed: 1.5, size: 0.25, life: 4, gravity: -0.6, dir: UP, spread: 0.3 });
        else if (a.kind === 'rain') this.partsNorm.emit(x, 18, z, { color: a.color, speed: 30, size: 0.08, life: 0.7, gravity: 10, dir: new THREE.Vector3(0.1, -1, 0), spread: 0.1, drag: 0 });
        else this.partsAdd.emit(x, rand(0.5, 8), z, { color: a.color, speed: 0.3, size: 0.12, life: 4, gravity: 0, drag: 0 });
        if (i > 200) break;
      }
    }
    if (this.backdrop === 'storm' && this.hemi) {
      this.stormT -= dt;
      if (this.stormT <= 0) {
        this.stormT = rand(3, 8);
        this.hemi.intensity = 4;
        const ang = rand(0, TAU);
        const d = this.R * rand(2.5, 4);
        const top = new THREE.Vector3(Math.cos(ang) * d, 60, Math.sin(ang) * d);
        this.bolt(top, new THREE.Vector3(top.x + rand(-8, 8), -2, top.z + rand(-8, 8)), '#dfe9ff');
      }
      this.hemi.intensity = Math.max(0.3, this.hemi.intensity - dt * 10);
    }
    this.partsAdd.update(dt);
    this.partsNorm.update(dt);
  }

  // ---------- camera ----------
  setCameraMode(mode) {
    this.camMode = mode;
    this.controls.enabled = mode === 'orbit' || mode === 'auto';
    this.controls.autoRotate = mode === 'auto';
    this.controls.autoRotateSpeed = 0.8;
    if (mode === 'top') {
      this.cinPos.set(0, this.R * 2.6 + 6, 0.01);
      this.cinTarget.set(0, 0, 0);
    }
  }

  updateCamera(dt, sim) {
    if (this.camMode === 'orbit' || this.camMode === 'auto') {
      this.controls.update();
      return;
    }
    const alive = sim.balls.filter((b) => b.alive);
    if (this.camMode === 'follow') {
      let f = this.camFocus && this.camFocus.alive ? this.camFocus : null;
      if (!f) f = alive.slice().sort((p, q) => q.stats.dps - p.stats.dps)[0] || null;
      this.camFocus = f;
      if (f) {
        this.cinTarget.lerp(new THREE.Vector3(f.x, f.y, f.z), Math.min(1, dt * 4));
        const back = new THREE.Vector3(f.vx, 0, f.vz);
        if (back.lengthSq() < 0.5) back.set(0, 0, 1);
        back.normalize().multiplyScalar(-(8 + f.radius * 4));
        this.cinPos.lerp(new THREE.Vector3(f.x + back.x, f.y + 5 + f.radius * 2, f.z + back.z), Math.min(1, dt * 1.6));
      }
    } else if (this.camMode === 'cinematic') {
      this.cinT -= dt;
      if (this.cinT <= 0 && alive.length) {
        this.cinT = rand(3, 5);
        const focus = alive.slice().sort((p, q) => q.stats.dps - p.stats.dps)[Math.random() < 0.6 ? 0 : (Math.random() * alive.length) | 0];
        this.cinFocus = focus;
        const ang = rand(0, TAU);
        const d = rand(9, 16);
        this.cinOffset = new THREE.Vector3(Math.cos(ang) * d, rand(3, 9), Math.sin(ang) * d);
      }
      const f = this.cinFocus && this.cinFocus.alive ? this.cinFocus : alive[0];
      if (f && this.cinOffset) {
        this.cinTarget.lerp(new THREE.Vector3(f.x, f.y, f.z), Math.min(1, dt * 3));
        this.cinOffset.applyAxisAngle(UP, dt * 0.25);
        this.cinPos.lerp(new THREE.Vector3(f.x, 0, f.z).add(this.cinOffset), Math.min(1, dt * 1.2));
      }
    }
    this.camera.position.copy(this.cinPos);
    this.camera.lookAt(this.cinTarget);
  }

  // slow-motion kill-cam style zoom to a point
  focusOn(x, z) {
    if (this.camMode === 'orbit' || this.camMode === 'auto') {
      this.controls.target.lerp(new THREE.Vector3(x, 0, z), 0.5);
    }
  }

  frame(dt, sim) {
    this.updateCamera(dt, sim);
    this.updateFx(dt);
    this.updateOverlay(dt);
    let sx = 0;
    let sy = 0;
    if (this.shakeAmt > 0.01) {
      sx = rand(-1, 1) * this.shakeAmt * 0.5;
      sy = rand(-1, 1) * this.shakeAmt * 0.5;
      this.camera.position.x += sx; this.camera.position.y += sy;
      this.shakeAmt *= Math.pow(0.02, dt);
    }
    if (this.q.bloom) this.composer.render(dt);
    else {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.recorder) this.drawRecFrame(); // copy right after rendering, before the buffer is cleared
    this.camera.position.x -= sx; this.camera.position.y -= sy;
  }

  // ---------- input ----------
  floorPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.floorPlane, p)) return null;
    return { x: p.x, z: p.z };
  }

  // ---------- recording ----------
  // Records ONLY the 3D arena (no buttons/menus), optionally with a small HP panel drawn into the video.
  startRecording(audioStream, opts = {}) {
    if (!window.MediaRecorder) throw new Error('Recording is not supported on this device.');
    const src = this.canvas;
    const scale = Math.min(1, 1280 / Math.max(src.width, src.height));
    const rc = document.createElement('canvas');
    rc.width = Math.max(2, Math.round((src.width * scale) / 2) * 2);
    rc.height = Math.max(2, Math.round((src.height * scale) / 2) * 2);
    if (!rc.captureStream) throw new Error('Recording is not supported on this device.');
    this.recCanvas = rc;
    this.recCtx = rc.getContext('2d');
    this.recHud = opts.hud !== false;
    const stream = rc.captureStream(30);
    if (audioStream) for (const t of audioStream.getAudioTracks()) stream.addTrack(t);
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    this.recChunks = [];
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
    this.recorder.ondataavailable = (e) => { if (e.data && e.data.size) this.recChunks.push(e.data); };
    this.recorder.start(500);
    this.recMime = mimeType || 'video/webm';
  }

  drawRecFrame() {
    const g = this.recCtx;
    const rc = this.recCanvas;
    if (!g) return;
    const W = rc.width;
    const H = rc.height;
    g.drawImage(this.canvas, 0, 0, W, H);
    const sim = this.sim;
    if (!this.recHud || !sim) return;
    const u = Math.max(W, H) / 1000; // unit scale
    const balls = sim.balls.filter((b) => !b.isMinion).sort((p, q) => (q.alive - p.alive) || (q.hp / q.maxHp - p.hp / p.maxHp)).slice(0, 14);
    const rowH = 15 * u;
    const pw = 150 * u;
    const pad = 8 * u;
    const ph = pad * 2 + 16 * u + balls.length * rowH;
    const x0 = W - pw - 10 * u;
    const y0 = 10 * u;
    g.save();
    g.globalAlpha = 0.85;
    g.fillStyle = 'rgba(10,12,20,0.55)';
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = Math.max(1, u);
    const rr = 10 * u;
    g.beginPath();
    g.moveTo(x0 + rr, y0); g.arcTo(x0 + pw, y0, x0 + pw, y0 + ph, rr); g.arcTo(x0 + pw, y0 + ph, x0, y0 + ph, rr);
    g.arcTo(x0, y0 + ph, x0, y0, rr); g.arcTo(x0, y0, x0 + pw, y0, rr); g.closePath();
    g.fill(); g.stroke();
    g.globalAlpha = 1;
    g.font = `800 ${9 * u}px system-ui, sans-serif`;
    g.fillStyle = 'rgba(230,236,255,0.75)';
    const t = sim.time;
    g.fillText(`ORB ARENA  ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`, x0 + pad, y0 + pad + 8 * u);
    balls.forEach((b, i) => {
      const y = y0 + pad + 16 * u + i * rowH;
      const frac = Math.max(0, b.hp / b.maxHp);
      g.globalAlpha = b.alive ? 1 : 0.35;
      g.fillStyle = b.color;
      g.beginPath(); g.arc(x0 + pad + 4 * u, y + 5 * u, 4 * u, 0, TAU); g.fill();
      g.fillStyle = '#ffffff';
      g.font = `700 ${8.5 * u}px system-ui, sans-serif`;
      let name = b.name;
      while (name.length > 3 && g.measureText(name).width > pw - pad * 2 - 14 * u) name = name.slice(0, -2) + '…';
      g.fillText(name, x0 + pad + 12 * u, y + 7 * u);
      const bx = x0 + pad + 12 * u;
      const bw = pw - pad * 2 - 12 * u;
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(bx, y + 9.5 * u, bw, 3 * u);
      g.fillStyle = `hsl(${(frac * 120) | 0},85%,50%)`;
      g.fillRect(bx, y + 9.5 * u, bw * frac, 3 * u);
    });
    g.restore();
  }

  stopRecording() {
    return new Promise((resolve) => {
      if (!this.recorder) { resolve(null); return; }
      this.recorder.onstop = () => {
        const blob = new Blob(this.recChunks, { type: this.recMime.split(';')[0] });
        this.recorder = null;
        this.recCtx = null;
        this.recCanvas = null;
        resolve(blob);
      };
      this.recorder.stop();
    });
  }
}
