// Транспорт: машины и танк. F — сесть/выйти, WASD — езда, у танка ЛКМ — выстрел из пушки.
(function () {
  const V = (G.vehicles = { list: [] });
  const V3 = THREE.Vector3;

  const CFG = {
    car: { name: 'МАШИНА', hp: 220, r: 1.5, max: 23, rev: 9, accel: 15, turn: 2.3, crush: 16, camDist: 8, camH: 2.2 },
    tank: { name: 'ТАНК', hp: 700, r: 2.3, max: 9.5, rev: 5, accel: 9, turn: 1.25, crush: 45, camDist: 11, camH: 3.4, reload: 1.5 },
  };
  const HOMES = [
    { type: 'tank', x: -16, z: 0, yaw: -Math.PI / 2, color: 0x00ff9c },
    { type: 'car', x: 16, z: 0, yaw: Math.PI / 2, color: 0xff2d78 },
    { type: 'car', x: 11.5, z: 46, yaw: 0, color: 0xffd60a },
    { type: 'car', x: -36, z: -11.5, yaw: Math.PI, color: 0x00e5ff },
  ];

  const raycaster = new THREE.Raycaster();
  const dir = new V3(), tip = new V3(), aim = new V3(), tmp = new V3();
  let scene = null;

  function box(parent, mat, w, h, d, x, y, z, edge) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (edge != null) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edge })));
    parent.add(m);
    return m;
  }

  // Модели смотрят вдоль -Z (как игрок при yaw = 0)
  function build(v, color) {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x1a2046, roughness: 0.45, metalness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b0d18, roughness: 0.8 });
    const glow = new THREE.MeshBasicMaterial({ color });
    if (v.type === 'tank') {
      box(g, body, 3.2, 0.9, 4.8, 0, 0.85, 0, color);
      box(g, dark, 0.8, 0.9, 5.2, -1.7, 0.45, 0, color);
      box(g, dark, 0.8, 0.9, 5.2, 1.7, 0.45, 0, color);
      const turret = new THREE.Group();
      turret.position.set(0, 1.3, 0.2);
      g.add(turret);
      box(turret, body, 2.1, 0.75, 2.4, 0, 0.38, 0, color);
      box(turret, dark, 0.3, 0.3, 3.2, 0, 0.4, -2.7, color);
      box(turret, glow, 0.36, 0.36, 0.25, 0, 0.4, -4.3);
      v.turret = turret;
      v.tip = new THREE.Object3D();
      v.tip.position.set(0, 0.4, -4.6);
      turret.add(v.tip);
    } else {
      box(g, body, 1.95, 0.6, 4.3, 0, 0.6, 0, color);
      box(g, dark, 1.7, 0.55, 2.0, 0, 1.15, 0.3, color);
      [[-1, -1.4], [1, -1.4], [-1, 1.4], [1, 1.4]].forEach(([x, z]) => box(g, dark, 0.3, 0.7, 0.7, x, 0.35, z));
      box(g, glow, 0.4, 0.15, 0.05, -0.6, 0.65, -2.17);
      box(g, glow, 0.4, 0.15, 0.05, 0.6, 0.65, -2.17);
      box(g, new THREE.MeshBasicMaterial({ color: 0xff2030 }), 1.6, 0.12, 0.05, 0, 0.7, 2.17);
    }
    scene.add(g);
    v.group = g;
  }

  V.init = function (s) {
    scene = s;
    V.list = HOMES.map((home) => {
      const cfg = CFG[home.type];
      const v = { type: home.type, cfg, home, r: cfg.r, pos: new V3(), yaw: 0, turretYaw: 0, speed: 0, hp: cfg.hp, cd: 0, dead: false, respawnT: 0, hitT: 0 };
      build(v, home.color);
      v.damage = function (n) {
        if (v.dead) return;
        v.hp -= n;
        if (v.hp <= 0) destroy(v);
      };
      return v;
    });
    V.reset();
  };

  function park(v) {
    v.pos.set(v.home.x, 0, v.home.z);
    v.yaw = v.turretYaw = v.home.yaw;
    v.speed = 0;
    v.hp = v.cfg.hp;
    v.cd = 0;
    v.dead = false;
    v.group.visible = true;
    if (v.turret) v.turret.rotation.y = 0;
    sync(v);
  }

  function sync(v) {
    v.group.position.copy(v.pos);
    v.group.rotation.y = v.yaw;
  }

  V.reset = function () {
    G.player.vehicle = null;
    V.list.forEach(park);
  };

  V.nearest = function () {
    const P = G.player;
    let best = null, bd = 1e9;
    for (const v of V.list) {
      if (v.dead) continue;
      const d = Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z) - v.r;
      if (d < 2.4 && d < bd) { bd = d; best = v; }
    }
    return best;
  };

  function exit(v) {
    const P = G.player;
    P.vehicle = null;
    P.pos.set(v.pos.x + Math.cos(v.yaw) * (v.r + 0.9), 0, v.pos.z - Math.sin(v.yaw) * (v.r + 0.9));
    G.level.resolve(P.pos, P.r, 0);
    P.vel.set(0, 0, 0);
    P.pitch = 0;
  }

  V.toggle = function () {
    const P = G.player;
    if (P.vehicle) {
      exit(P.vehicle);
      G.audio.play('enter');
      return;
    }
    const v = V.nearest();
    if (!v || P.pos.y > 1.6) return;
    P.vehicle = v;
    P.yaw = v.yaw;
    P.pitch = -0.12;
    v.turretYaw = v.yaw;
    G.input.aim = false;
    G.audio.play('enter');
  };

  function destroy(v) {
    const P = G.player;
    v.dead = true;
    v.respawnT = 25;
    v.speed = 0;
    v.group.visible = false;
    const wasDriver = P.vehicle === v;
    if (wasDriver) exit(v);
    G.boom.explode(tmp.set(v.pos.x, 1, v.pos.z), 6.5, 160);
    if (wasDriver) G.hud.banner(v.cfg.name + ' УНИЧТОЖЕН' + (v.type === 'car' ? 'А' : ''), 'Вернётся через 25 секунд', 1800);
  }

  function wrap(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function fireCannon(v) {
    const cam = G.camera;
    const P = G.player;
    P.applyCamera(cam);
    cam.updateMatrixWorld();
    G.scene.updateMatrixWorld();
    cam.getWorldDirection(dir);
    v.tip.getWorldPosition(tip);

    // Точка, на которую смотрит прицел (всё, что ближе танка, пропускаем)
    raycaster.set(cam.position, dir);
    raycaster.far = 250;
    const skip = cam.position.distanceTo(v.pos) + 4;
    const hit = raycaster.intersectObjects(G.level.meshes.concat(G.enemies.hitMeshes), false).find((h) => h.distance > skip);
    if (hit) aim.copy(hit.point);
    else aim.copy(cam.position).addScaledVector(dir, 150);

    dir.copy(aim).sub(tip).normalize();
    // Если башня ещё не довернулась, стреляем туда, куда она смотрит
    const shotYaw = Math.atan2(-dir.x, -dir.z);
    if (Math.abs(wrap(shotYaw - v.turretYaw)) > 0.35) dir.set(-Math.sin(v.turretYaw), 0.02, -Math.cos(v.turretYaw)).normalize();

    G.boom.fire(tip, dir, { speed: 60, dmg: 280, radius: 7, color: 0x9dffd0 });
    G.fx.burst(tip, 0xffe08a, 10, 5);
    G.fx.addShake(0.45);
    G.audio.play('cannon');
    v.speed -= 1.2;
    v.cd = v.cfg.reload;
  }

  function drive(v, dt) {
    const c = v.cfg;
    const k = G.input.keys;
    const P = G.player;
    const thr = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const st = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);

    if (thr > 0) v.speed = Math.min(c.max, v.speed + c.accel * dt * (v.speed < 0 ? 2.5 : 1));
    else if (thr < 0) v.speed = Math.max(-c.rev, v.speed - c.accel * dt * (v.speed > 0 ? 2.5 : 1));
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 7 * dt);
    if (k.Space) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 30 * dt); // ручной тормоз

    if (v.type === 'tank') v.yaw += st * c.turn * dt;
    else v.yaw += st * c.turn * dt * Math.max(-1, Math.min(1, v.speed / 7));

    if (v.type === 'tank') {
      const d = wrap(P.yaw - v.turretYaw);
      v.turretYaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, d));
      v.turret.rotation.y = v.turretYaw - v.yaw;
      v.cd -= dt;
      if (G.input.fire && v.cd <= 0) fireCannon(v);
    }
  }

  V.update = function (dt) {
    const P = G.player;
    for (const v of V.list) {
      if (v.dead) {
        v.respawnT -= dt;
        if (v.respawnT <= 0 && Math.hypot(P.pos.x - v.home.x, P.pos.z - v.home.z) > 6) park(v);
        continue;
      }
      const driven = P.vehicle === v;
      if (driven) drive(v, dt);
      else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 12 * dt);

      // Движение и столкновения со стенами
      if (v.speed !== 0) {
        const ox = v.pos.x, oz = v.pos.z;
        const step = v.speed * dt;
        v.pos.x += -Math.sin(v.yaw) * step;
        v.pos.z += -Math.cos(v.yaw) * step;
        G.level.resolve(v.pos, v.r, 0);
        const moved = Math.hypot(v.pos.x - ox, v.pos.z - oz);
        if (Math.abs(step) > 1e-4 && moved < Math.abs(step) * 0.6) {
          if (Math.abs(v.speed) > 8 && driven) G.fx.addShake(0.35);
          v.speed *= 0.4;
        }
      }

      // Враги: давим на скорости, иначе выталкиваем из корпуса
      v.hitT -= dt;
      for (const e of G.enemies.list) {
        if (!e.alive) continue;
        const dx = e.pos.x - v.pos.x, dz = e.pos.z - v.pos.z;
        const d = Math.hypot(dx, dz);
        const min = v.r * 0.85 + e.r;
        if (d >= min) continue;
        if (driven && Math.abs(v.speed) > 3) {
          e.damage(Math.abs(v.speed) * v.cfg.crush, false, tmp.set(e.pos.x, 1, e.pos.z));
          if (v.type === 'car' && v.hitT <= 0) { v.speed *= 0.85; v.damage(6); v.hitT = 0.2; G.fx.addShake(0.25); }
        } else if (d > 1e-3) {
          e.pos.x += (dx / d) * (min - d);
          e.pos.z += (dz / d) * (min - d);
        }
      }
      if (v.dead) continue;

      if (v.hp < v.cfg.hp * 0.35 && Math.random() < 0.25) G.fx.burst(tmp.set(v.pos.x, 1.6, v.pos.z), 0x555a70, 1, 1.5, 1.6);
      sync(v);
      if (driven) P.pos.set(v.pos.x, 0, v.pos.z);
    }
  };
})();
