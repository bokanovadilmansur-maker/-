// Точка входа: сцена, ввод, состояния игры и главный цикл.
(function () {
  if (!window.THREE) {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    return;
  }

  const canvas = document.getElementById('game');
  const SETTINGS_KEY = 'neonArena.settings';
  const BEST_KEY = 'neonArena.best';

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим */ }
  }

  G.state = 'menu'; // menu | playing | paused | over
  G.locked = false;
  G.settings = Object.assign({ sens: 1, volume: 0.6, fov: 75 }, load(SETTINGS_KEY, {}));
  G.input = { keys: {}, fire: false, fireFresh: false, aim: false };

  G.game = {
    score: 0, kills: 0, shots: 0, hits: 0, combo: 1, comboT: 0,
    best: Number(load(BEST_KEY, 0)) || 0,
    reset() { this.score = this.kills = this.shots = this.hits = 0; this.combo = 1; this.comboT = 0; },
    addKill(enemy, head) {
      this.kills++;
      this.combo = this.comboT > 0 ? Math.min(5, this.combo + 1) : 1;
      this.comboT = 3;
      this.score += (enemy.cfg.score + (head ? 50 : 0)) * this.combo;
    },
  };

  // ---------- Сцена ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.autoClear = false;

  const scene = (G.scene = new THREE.Scene());
  const camera = (G.camera = new THREE.PerspectiveCamera(G.settings.fov, innerWidth / innerHeight, 0.05, 300));
  scene.add(camera);

  G.level.build(scene);
  G.fx.init(scene);
  G.enemies.init(scene);
  G.pickups.init(scene);
  G.boom.init(scene);
  G.weapon.init(scene);
  G.vehicles.init(scene);
  G.hud.init();
  G.audio.volume = G.settings.volume;

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = G.weapon.cam.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    G.weapon.cam.updateProjectionMatrix();
  });

  // ---------- Состояния ----------
  function lock() {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* без захвата тоже можно играть */ }
  }
  function unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  let pausedAt = 0;

  G.start = function () {
    G.audio.init();
    G.enemies.clear();
    G.pickups.clear();
    G.fx.clear();
    G.boom.clear();
    G.player.reset();
    G.vehicles.reset();
    G.weapon.reset();
    G.game.reset();
    G.input.fire = G.input.fireFresh = G.input.aim = false;
    G.input.keys = {};
    G.state = 'playing';
    G.hud.show(null);
    G.waves.start();
    lock();
  };

  G.pause = function () {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    pausedAt = performance.now();
    G.input.fire = G.input.aim = false;
    G.input.keys = {};
    G.hud.show('pause');
    unlock();
  };

  G.resume = function () {
    if (G.state !== 'paused') return;
    G.state = 'playing';
    G.hud.show(null);
    lock();
  };

  G.toMenu = function () {
    G.state = 'menu';
    G.enemies.clear();
    G.pickups.clear();
    G.fx.clear();
    G.boom.clear();
    G.vehicles.reset();
    G.hud.show('menu');
    unlock();
  };

  G.gameOver = function () {
    if (G.state === 'over') return;
    G.state = 'over';
    const g = G.game;
    const isRecord = g.score > g.best;
    if (isRecord) { g.best = g.score; save(BEST_KEY, g.best); }
    G.audio.play('over');
    G.hud.gameOver(isRecord);
    unlock();
  };

  // ---------- Ввод ----------
  document.addEventListener('pointerlockchange', () => {
    G.locked = document.pointerLockElement === canvas;
    if (!G.locked && G.state === 'playing') G.pause();
  });

  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (G.state === 'playing') G.pause();
      else if (G.state === 'paused' && performance.now() - pausedAt > 300) G.resume();
      return;
    }
    if (G.state !== 'playing') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    G.input.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyR') G.weapon.startReload();
    else if (e.code === 'Digit1') G.weapon.select(0);
    else if (e.code === 'Digit2') G.weapon.select(1);
    else if (e.code === 'Digit3') G.weapon.select(2);
    else if (e.code === 'Digit4') G.weapon.select(3);
    else if (e.code === 'Digit5') G.weapon.select(4);
    else if (e.code === 'KeyF') G.vehicles.toggle();
    else if (e.code === 'KeyQ') G.weapon.cycle(-1);
    else if (e.code === 'KeyE') G.weapon.cycle(1);
  });
  addEventListener('keyup', (e) => { G.input.keys[e.code] = false; });
  addEventListener('blur', () => { if (G.state === 'playing') G.pause(); });

  canvas.addEventListener('mousedown', (e) => {
    if (G.state !== 'playing') return;
    if (!G.locked) lock();
    if (e.button === 2) { G.input.aim = true; return; }
    if (e.button !== 0) return;
    G.input.fire = true;
    G.input.fireFresh = true;
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) G.input.fire = false;
    if (e.button === 2) G.input.aim = false;
  });
  addEventListener('mousemove', (e) => {
    if (G.state === 'playing' && G.locked) G.player.look(e.movementX || 0, e.movementY || 0);
  });
  addEventListener('wheel', (e) => {
    if (G.state === 'playing') G.weapon.cycle(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });
  addEventListener('contextmenu', (e) => e.preventDefault());

  const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
  on('btnStart', G.start);
  on('btnAgain', G.start);
  on('btnRestart', G.start);
  on('btnResume', G.resume);
  on('btnQuit', G.toMenu);
  on('btnMenu', G.toMenu);

  // ---------- Настройки ----------
  function applySettings() {
    const s = G.settings;
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    G.audio.setVolume(s.volume);
    document.querySelectorAll('[data-set]').forEach((inp) => { inp.value = s[inp.dataset.set]; });
    document.querySelectorAll('[data-val]').forEach((b) => {
      const k = b.dataset.val;
      b.textContent = k === 'volume' ? Math.round(s[k] * 100) + '%' : k === 'fov' ? s[k] + '°' : Number(s[k]).toFixed(1);
    });
  }
  document.querySelectorAll('[data-set]').forEach((inp) => {
    inp.addEventListener('input', () => {
      G.settings[inp.dataset.set] = parseFloat(inp.value);
      save(SETTINGS_KEY, G.settings);
      applySettings();
    });
  });
  applySettings();
  G.hud.show('menu');

  // ---------- Главный цикл ----------
  let menuT = 0;

  G.tick = function (dt) {
    if (G.state === 'playing') {
      const g = G.game;
      if (g.comboT > 0) { g.comboT -= dt; if (g.comboT <= 0) g.combo = 1; }
      G.player.update(dt);
      G.vehicles.update(dt);
      G.player.applyCamera(camera);
      G.weapon.update(dt);
      G.boom.update(dt);
      G.enemies.update(dt);
      G.pickups.update(dt);
      G.waves.update(dt);
      G.fx.update(dt);
      if (G.state === 'playing') G.player.applyCamera(camera);
      G.hud.update();
    } else if (G.state === 'menu' || G.state === 'over') {
      // Камера медленно облетает арену на фоне меню
      menuT += dt * 0.12;
      camera.position.set(Math.cos(menuT) * 21, 11, Math.sin(menuT) * 21);
      camera.lookAt(0, 1, 0);
      G.fx.update(dt);
    }
    const veh = G.state === 'playing' ? G.player.vehicle : null;
    G.audio.engine(veh ? veh.speed : null);
  };

  function render() {
    renderer.clear();
    renderer.render(scene, camera);
    if ((G.state === 'playing' || G.state === 'paused') && !G.player.vehicle) {
      renderer.clearDepth();
      renderer.render(G.weapon.scene, G.weapon.cam);
    }
  }

  let lastT = performance.now();
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    G.tick(dt);
    render();
  }
  requestAnimationFrame(frame);
})();
