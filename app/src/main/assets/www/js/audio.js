// ORB ARENA — synthesized sound effects (no audio files needed).
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.6;
    this.last = {};
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.recDest = this.ctx.createMediaStreamDestination ? this.ctx.createMediaStreamDestination() : null;
      if (this.recDest) comp.connect(this.recDest);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
    }
  }

  get stream() { return this.recDest ? this.recDest.stream : null; }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  tone(type, f1, f2, dur, vol, t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, vol, t, freq = 1000, q = 1, type = 'bandpass', sweep = 0) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  play(name, vol = 1) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const minGap = { hit: 0.03, slice: 0.05, spark: 0.05, shot: 0.04, laser: 0.05 }[name] ?? 0.06;
    if (this.last[name] && now - this.last[name] < minGap) return;
    this.last[name] = now;
    const v = Math.min(1.5, vol);
    const t = now + 0.001;
    switch (name) {
      case 'hit': this.noise(0.08, 0.5 * v, t, 900 + Math.random() * 600, 1.2); this.tone('sine', 180, 60, 0.12, 0.4 * v, t); break;
      case 'boom': this.noise(0.9, 0.9 * v, t, 900, 0.7, 'lowpass', 60); this.tone('sine', 90, 30, 0.6, 0.8 * v, t); break;
      case 'zap': this.noise(0.25, 0.4 * v, t, 4000, 3, 'bandpass', 1500); this.tone('sawtooth', 1200, 200, 0.2, 0.15 * v, t); break;
      case 'thunder': this.noise(1.4, 0.9 * v, t, 2000, 0.5, 'lowpass', 80); break;
      case 'whoosh': this.noise(0.35, 0.35 * v, t, 400, 1, 'bandpass', 2400); break;
      case 'shard': for (let i = 0; i < 3; i++) this.tone('triangle', 2400 + i * 500, 1800, 0.12, 0.12 * v, t + i * 0.03); break;
      case 'wave': this.noise(0.7, 0.45 * v, t, 300, 0.8, 'lowpass', 1500); break;
      case 'quake': this.tone('sine', 60, 25, 0.8, 0.9 * v, t); this.noise(0.6, 0.5 * v, t, 200, 0.7, 'lowpass', 50); break;
      case 'hiss': this.noise(0.6, 0.25 * v, t, 6000, 0.8, 'highpass'); break;
      case 'holy': [523, 659, 784].forEach((f, i) => this.tone('sine', f, f, 0.5, 0.12 * v, t + i * 0.04)); break;
      case 'blink': this.tone('sine', 300, 1600, 0.15, 0.2 * v, t); break;
      case 'void': this.tone('sawtooth', 220, 40, 1.2, 0.2 * v, t); this.tone('sine', 55, 30, 1.2, 0.5 * v, t); break;
      case 'clang': this.tone('square', 880, 860, 0.3, 0.12 * v, t); this.tone('sine', 1320, 1300, 0.4, 0.12 * v, t); break;
      case 'grow': this.tone('triangle', 200, 500, 0.3, 0.15 * v, t); break;
      case 'meteor': this.noise(0.9, 0.3 * v, t, 3000, 1, 'bandpass', 300); break;
      case 'shot': this.tone('square', 900, 300, 0.07, 0.1 * v, t); break;
      case 'laser': this.tone('sawtooth', 1800, 400, 0.15, 0.12 * v, t); break;
      case 'slice': this.noise(0.06, 0.3 * v, t, 5000, 2, 'highpass'); break;
      case 'boing': this.tone('sine', 300, 700, 0.18, 0.3 * v, t); break;
      case 'split': this.tone('triangle', 400, 900, 0.15, 0.2 * v, t); this.tone('triangle', 600, 1200, 0.15, 0.15 * v, t + 0.05); break;
      case 'summon': this.tone('sine', 400, 800, 0.3, 0.15 * v, t); break;
      case 'death': this.noise(0.5, 0.6 * v, t, 1200, 0.8, 'lowpass', 100); this.tone('triangle', 400, 60, 0.5, 0.3 * v, t); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.18, t + i * 0.12)); break;
      case 'wave_start': case 'start': [392, 523, 659].forEach((f, i) => this.tone('square', f, f, 0.15, 0.08, t + i * 0.08)); break;
      case 'click': this.tone('sine', 900, 700, 0.04, 0.08, t); break;
      default: break;
    }
  }
}
