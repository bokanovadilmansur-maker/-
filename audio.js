// Звук: всё синтезируется через Web Audio API, внешние файлы не нужны.
(function () {
  const A = (G.audio = { ctx: null, master: null, music: null, volume: 0.6 });
  let noiseBuf = null;
  let step = 0;

  A.init = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.volume;
      A.master.connect(A.ctx.destination);
      A.music = A.ctx.createGain();
      A.music.gain.value = 0.5;
      A.music.connect(A.master);

      const len = A.ctx.sampleRate;
      noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      setInterval(musicStep, 220);
    } catch (e) {
      A.ctx = null;
    }
  };

  A.setVolume = function (v) {
    A.volume = v;
    if (A.master) A.master.gain.value = v;
  };

  function tone(type, f0, f1, dur, vol, dest) {
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest || A.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, type, dest) {
    const t = A.ctx.currentTime;
    const src = A.ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = A.ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || A.master);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  const SOUNDS = {
    pistol() { noise(0.12, 0.5, 2600); tone('square', 520, 90, 0.1, 0.25); },
    rifle() { noise(0.08, 0.4, 3400); tone('sawtooth', 380, 70, 0.07, 0.2); },
    shotgun() { noise(0.32, 0.8, 1500); tone('square', 190, 40, 0.24, 0.4); },
    empty() { tone('square', 900, 700, 0.04, 0.12); },
    reload() { tone('square', 300, 420, 0.06, 0.12); noise(0.05, 0.15, 5000, 'highpass'); },
    reloadDone() { tone('square', 520, 760, 0.07, 0.14); },
    switch() { noise(0.05, 0.12, 4000, 'highpass'); },
    hit() { tone('triangle', 1250, 900, 0.05, 0.22); },
    headshot() { tone('triangle', 1900, 1300, 0.09, 0.3); },
    kill() { tone('sawtooth', 300, 50, 0.3, 0.3); noise(0.25, 0.3, 900); },
    hurt() { tone('sawtooth', 160, 60, 0.22, 0.45); noise(0.12, 0.3, 700); },
    enemyShot() { tone('sine', 820, 260, 0.2, 0.16); },
    pickup() { tone('sine', 660, 990, 0.1, 0.25); setTimeout(() => A.ctx && tone('sine', 990, 1480, 0.14, 0.25), 80); },
    wave() { tone('sawtooth', 220, 440, 0.4, 0.25); setTimeout(() => A.ctx && tone('sawtooth', 330, 660, 0.5, 0.25), 200); },
    clear() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.ctx && tone('triangle', f, f, 0.2, 0.22), i * 90)); },
    over() { tone('sawtooth', 300, 40, 1.2, 0.4); },
    sniper() { noise(0.35, 0.7, 2200); tone('square', 700, 60, 0.3, 0.35); },
    rocket() { noise(0.5, 0.45, 900, 'bandpass'); tone('sawtooth', 140, 420, 0.35, 0.2); },
    cannon() { noise(0.45, 0.9, 700); tone('square', 110, 30, 0.4, 0.5); },
    explosion() { noise(0.9, 0.9, 500); tone('sine', 90, 25, 0.7, 0.6); },
    enter() { tone('square', 200, 300, 0.08, 0.15); noise(0.08, 0.2, 1500); },
    jump() { tone('sine', 240, 380, 0.09, 0.08); },
  };

  // Гул двигателя: speed = null выключает звук
  let eng = null;
  A.engine = function (speed) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    if (speed == null) {
      if (eng) eng.g.gain.setTargetAtTime(0, t, 0.08);
      return;
    }
    if (!eng) {
      const o = A.ctx.createOscillator();
      o.type = 'sawtooth';
      const f = A.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 380;
      const g = A.ctx.createGain();
      g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(A.master);
      o.start();
      eng = { o, g };
    }
    eng.o.frequency.setTargetAtTime(42 + Math.abs(speed) * 5, t, 0.1);
    eng.g.gain.setTargetAtTime(0.07, t, 0.1);
  };

  A.play = function (name) {
    if (!A.ctx || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (e) { /* звук не критичен */ }
  };

  // Простой фоновый бас-секвенсор, играет только во время боя.
  const BASS = [55, 55, 65.4, 55, 73.4, 55, 65.4, 49];
  function musicStep() {
    if (!A.ctx || G.state !== 'playing') return;
    const i = step++ % 16;
    if (i % 2 === 0) tone('sawtooth', BASS[(i / 2) | 0], 0, 0.2, 0.16, A.music);
    if (i % 4 === 2) noise(0.04, 0.07, 7000, 'highpass', A.music);
    if (i % 8 === 0) tone('sine', 110, 40, 0.16, 0.3, A.music);
  }
})();
