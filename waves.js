// Волны: состав, появление врагов, рост сложности.
(function () {
  const W = (G.waves = { wave: 0, queue: [], phase: 'break', timer: 0, spawnT: 0 });
  const MAX_ALIVE = 14;

  W.start = function () {
    W.wave = 0;
    W.queue = [];
    next(2.5);
  };

  function next(delay) {
    W.wave++;
    W.phase = 'break';
    W.timer = delay;
    W.queue = compose(W.wave);
    G.hud.banner('ВОЛНА ' + W.wave, 'Врагов: ' + W.queue.length, 2400);
    G.audio.play('wave');
  }

  function compose(n) {
    const total = Math.min(4 + n * 2, 44);
    const list = [];
    for (let i = 0; i < total; i++) {
      const r = Math.random();
      if (n >= 4 && r < Math.min(0.16, 0.05 + n * 0.012)) list.push('tank');
      else if (n >= 2 && r < 0.38) list.push('shooter');
      else list.push('runner');
    }
    if (n % 5 === 0) for (let i = 0; i < n / 5; i++) list.push('tank');
    return list;
  }

  W.remaining = function () {
    return W.queue.length + G.enemies.list.length;
  };

  function pickSpawn() {
    const P = G.player.pos;
    const far = G.level.spawns.filter((s) => { const d = Math.hypot(s.x - P.x, s.z - P.z); return d > 14 && d < 50; });
    const pool = far.length ? far : G.level.spawns;
    return pool[(Math.random() * pool.length) | 0];
  }

  W.update = function (dt) {
    if (W.phase === 'cleared') {
      W.timer -= dt;
      if (W.timer <= 0) next(2.2);
      return;
    }
    if (W.phase === 'break') {
      W.timer -= dt;
      if (W.timer <= 0) { W.phase = 'fight'; W.spawnT = 0; }
      return;
    }

    W.spawnT -= dt;
    if (W.queue.length && W.spawnT <= 0 && G.enemies.list.length < MAX_ALIVE) {
      const s = pickSpawn();
      const pos = new THREE.Vector3(s.x + (Math.random() - 0.5) * 2, 0, s.z + (Math.random() - 0.5) * 2);
      G.enemies.spawn(W.queue.pop(), pos, W.wave);
      G.fx.burst(new THREE.Vector3(pos.x, 1, pos.z), 0xff2d78, 10, 4);
      W.spawnT = Math.max(0.25, 0.7 - W.wave * 0.03);
    }

    if (!W.queue.length && !G.enemies.list.length) {
      const bonus = 100 * W.wave;
      G.game.score += bonus;
      G.player.heal(15);
      G.audio.play('clear');
      G.hud.banner('ВОЛНА ПРОЙДЕНА', '+' + bonus + ' очков  ·  +15 HP', 2000);
      W.phase = 'cleared';
      W.timer = 2.3;
    }
  };
})();
