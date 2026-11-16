// Интерфейс: показатели, баннеры, экраны меню.
(function () {
  const H = (G.hud = {});
  const $ = (id) => document.getElementById(id);
  const el = {};
  const last = {};
  let bannerTimer = 0;

  H.init = function () {
    ['hud', 'menu', 'pause', 'over', 'wave', 'enemies', 'score', 'combo', 'best', 'hp', 'hpbar', 'ammo', 'reserve',
      'weaponName', 'slots', 'reload', 'reloadbar', 'banner', 'bannerTitle', 'bannerSub', 'vignette', 'hitmarker',
      'lockhint', 'hint', 'scope', 'crosshair', 'minimap', 'menuBest', 'overScore', 'overWave', 'overKills', 'overAcc', 'overBest', 'newRecord'].forEach((id) => (el[id] = $(id)));
  };

  function set(key, value, fn) {
    if (last[key] === value) return;
    last[key] = value;
    fn(value);
  }

  H.show = function (screen) {
    ['menu', 'pause', 'over'].forEach((s) => el[s].classList.toggle('hidden', s !== screen));
    el.hud.classList.toggle('hidden', screen === 'menu' || screen === 'over');
    el.menuBest.textContent = G.game.best;
  };

  H.banner = function (title, sub, ms) {
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub || '';
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.banner.classList.remove('show'), ms || 2000);
  };

  H.hitmarker = function (head) {
    const h = el.hitmarker;
    h.classList.remove('show');
    h.classList.toggle('head', !!head);
    void h.offsetWidth; // перезапуск анимации
    h.classList.add('show');
  };

  H.update = function () {
    const P = G.player, W = G.weapon, g = G.game;
    const hp = Math.ceil(P.hp);
    set('hp', hp, (v) => {
      el.hp.textContent = v;
      el.hpbar.style.width = (v / P.maxHp) * 100 + '%';
      el.hpbar.classList.toggle('low', v <= 30);
    });
    const veh = P.vehicle;
    set('ammo', veh ? Math.max(0, Math.ceil(veh.hp)) : W.cur.ammo, (v) => (el.ammo.textContent = v));
    set('reserve', veh ? veh.cfg.hp : W.cur.reserve, (v) => (el.reserve.textContent = v === Infinity ? '∞' : v));
    set('weapon', veh ? veh.type : W.index, (v) => {
      el.weaponName.textContent = veh ? veh.cfg.name + ' · БРОНЯ' : W.cur.name;
      el.slots.classList.toggle('hidden', !!veh);
      el.slots.querySelectorAll('span').forEach((s, i) => s.classList.toggle('active', i === v));
    });

    // Подсказки и прицел
    let hint = '';
    if (veh) hint = veh.type === 'tank' ? 'WASD — езда · ЛКМ — пушка · F — выйти' : 'WASD — езда · Space — тормоз · F — выйти';
    else { const near = G.vehicles.nearest(); if (near) hint = 'F — сесть: ' + near.cfg.name; }
    set('hint', hint, (v) => { el.hint.textContent = v; el.hint.classList.toggle('hidden', !v); });
    set('scope', W.scoped, (v) => { el.scope.classList.toggle('hidden', !v); el.crosshair.classList.toggle('hidden', v); });
    drawMap();
    set('wave', G.waves.wave, (v) => (el.wave.textContent = v));
    set('enemies', G.waves.remaining(), (v) => (el.enemies.textContent = v));
    set('score', g.score, (v) => (el.score.textContent = v));
    set('best', Math.max(g.best, g.score), (v) => (el.best.textContent = v));
    set('combo', g.combo, (v) => (el.combo.textContent = v > 1 ? 'КОМБО x' + v : ''));
    set('reloading', W.reloading, (v) => el.reload.classList.toggle('hidden', !v));
    if (W.reloading) el.reloadbar.style.width = W.reloadProgress() * 100 + '%';
    set('lock', G.state === 'playing' && !G.locked, (v) => el.lockhint.classList.toggle('hidden', !v));

    const low = P.hp <= 30 ? 0.25 + Math.sin(performance.now() / 180) * 0.1 : 0;
    el.vignette.style.opacity = Math.max(P.flash * 0.9, low).toFixed(2);
  };

  // Мини-карта: север сверху, игрок — стрелка
  function drawMap() {
    const c = el.minimap, ctx = c.getContext('2d');
    const half = G.level.half, k = c.width / (half * 2);
    const mx = (x) => (x + half) * k;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(5, 8, 20, 0.75)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#263a78';
    for (const b of G.level.boxes) {
      const w = b.max.x - b.min.x, d = b.max.z - b.min.z;
      if (w > 100 || d > 100) continue;
      ctx.fillRect(mx(b.min.x), mx(b.min.z), w * k, d * k);
    }
    for (const p of G.pickups.list) {
      ctx.fillStyle = p.type === 'health' ? '#00ff9c' : '#ffd60a';
      ctx.fillRect(mx(p.mesh.position.x) - 1.5, mx(p.mesh.position.z) - 1.5, 3, 3);
    }
    for (const v of G.vehicles.list) {
      if (v.dead || v === G.player.vehicle) continue;
      ctx.fillStyle = v.type === 'tank' ? '#00ff9c' : '#ffffff';
      ctx.fillRect(mx(v.pos.x) - 3, mx(v.pos.z) - 3, 6, 6);
    }
    ctx.fillStyle = '#ff2d55';
    for (const e of G.enemies.list) {
      ctx.beginPath();
      ctx.arc(mx(e.pos.x), mx(e.pos.z), e.type === 'tank' ? 3.5 : 2.3, 0, 6.3);
      ctx.fill();
    }
    const P = G.player;
    ctx.save();
    ctx.translate(mx(P.pos.x), mx(P.pos.z));
    ctx.rotate(-P.yaw);
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  H.gameOver = function (isRecord) {
    const g = G.game;
    el.overScore.textContent = g.score;
    el.overWave.textContent = G.waves.wave;
    el.overKills.textContent = g.kills;
    el.overAcc.textContent = (g.shots ? Math.round((g.hits / g.shots) * 100) : 0) + '%';
    el.overBest.textContent = g.best;
    el.newRecord.classList.toggle('hidden', !isRecord);
    H.show('over');
  };
})();
