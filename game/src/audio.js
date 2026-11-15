// Every sound is synthesised with WebAudio: no audio files, no network.
// The bank is created lazily on the first user gesture (browsers block audio
// before one), and every effect is a short oscillator/noise envelope.
export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.humOsc = null;
    this.humGain = null;
  }

  /** Call from a user gesture; safe to call repeatedly. */
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.context.destination);
    this.startAmbience();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** A low looping hum while the beam is focused; pitch follows focus. */
  setHum(on, focused) {
    if (!this.context) return;
    if (on && !this.humOsc) {
      this.humOsc = this.context.createOscillator();
      this.humOsc.type = 'sine';
      this.humOsc.frequency.value = focused ? 98 : 65;
      this.humGain = this.context.createGain();
      this.humGain.gain.value = 0.0;
      this.humOsc.connect(this.humGain);
      this.humGain.connect(this.master);
      this.humOsc.start();
      this.humGain.gain.linearRampToValueAtTime(0.05, this.context.currentTime + 0.15);
    } else if (!on && this.humOsc) {
      const osc = this.humOsc;
      const gain = this.humGain;
      gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.12);
      window.setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 200);
      this.humOsc = null;
      this.humGain = null;
    } else if (on && this.humOsc) {
      this.humOsc.frequency.linearRampToValueAtTime(focused ? 98 : 65, this.context.currentTime + 0.1);
    }
  }

  /** Gentle filtered-noise waves, looped forever once unlocked. */
  startAmbience() {
    const ctx = this.context;
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 3.2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    lfo.start();
  }

  tone({ type = 'sine', from = 440, to = null, seconds = 0.2, gain = 0.2, when = 0 }) {
    if (!this.context) return;
    const ctx = this.context;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(envelope);
    envelope.connect(this.master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  /** A warm two-note horn when a ship docks safely. */
  dock() {
    this.tone({ type: 'triangle', from: 392, seconds: 0.35, gain: 0.22 });
    this.tone({ type: 'triangle', from: 523, seconds: 0.4, gain: 0.18, when: 0.09 });
  }

  /** A bright shimmer when a wraith is banished by the beam. */
  banish() {
    this.tone({ type: 'sine', from: 880, to: 1760, seconds: 0.3, gain: 0.14 });
    this.tone({ type: 'sine', from: 1320, to: 2093, seconds: 0.25, gain: 0.08, when: 0.05 });
  }

  /** A low dissonant sting when a ship is wrecked. */
  wreck() {
    this.tone({ type: 'sawtooth', from: 220, to: 55, seconds: 0.6, gain: 0.2 });
    this.tone({ type: 'sawtooth', from: 233, to: 58, seconds: 0.6, gain: 0.14 });
  }

  /** A soft bell when a night is cleared. */
  nightClear() {
    this.tone({ type: 'sine', from: 659, seconds: 0.5, gain: 0.16 });
    this.tone({ type: 'sine', from: 988, seconds: 0.7, gain: 0.14, when: 0.12 });
    this.tone({ type: 'sine', from: 1319, seconds: 0.8, gain: 0.1, when: 0.24 });
  }

  /** A short click for buttons and the start of a game. */
  click() {
    this.tone({ type: 'square', from: 660, to: 880, seconds: 0.07, gain: 0.1 });
  }
}
