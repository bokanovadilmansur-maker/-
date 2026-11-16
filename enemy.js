// Враги: три типа, простой ИИ с обходом препятствий, снаряды стрелков.
(function () {
  const E = (G.enemies = { list: [], shots: [], hitMeshes: [] });
  const V3 = THREE.Vector3;

  const TYPES = {
    runner: { hp: 60, speed: 3.5, r: 0.5, color: 0xff2d55, dmg: 10, range: 1.7, rate: 0.8, score: 100, scale: 1 },
    shooter: { hp: 45, speed: 2.7, r: 0.5, color: 0xb14dff, dmg: 9, range: 0, rate: 2.2, score: 150, scale: 1 },
    tank: { hp: 260, speed: 2.0, r: 0.85, color: 0xff9500, dmg: 25, range: 2.4, rate: 1.2, score: 400, scale: 1.7 },
  };

  const GEO = {
    leg: new THREE.BoxGeometry(0.22, 0.7, 0.25),
    torso: new THREE.BoxGeometry(0.8, 0.75, 0.45),
    head: new THREE.BoxGeometry(0.46, 0.46, 0.46),
    arm: new THREE.BoxGeometry(0.18, 0.7, 0.2),
    visor: new THREE.BoxGeometry(0.36, 0.1, 0.03),
    shot: new THREE.SphereGeometry(0.16, 10, 8),
  };
  const shotMat = new THREE.MeshBasicMaterial({ color: 0xd9a1ff });
  const losRay = new THREE.Raycaster();
  const tmp = new V3(), tmp2 = new V3(), target = new V3();
  let scene = null;

  E.init = function (s) { scene = s; };

  function Enemy(type, pos, wave) {
    const cfg = TYPES[type];
    this.type = type;
    this.cfg = cfg;
    this.alive = true;
    this.maxHp = this.hp = cfg.hp * (1 + (wave - 1) * 0.07);
    this.speed = cfg.speed * (1 + Math.min(wave - 1, 12) * 0.035) * (0.92 + Math.random() * 0.16);
    this.r = cfg.r;
    this.pos = pos.clone();
    this.pos.y = 0;
    this.cd = 0.6 + Math.random();
    this.avoidT = 0;
    this.avoidSide = 1;
    this.sinceAvoid = 99;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 1 + Math.random() * 2;
    this.spawnT = 0;
    this.flashT = 0;
    this.walkT = Math.random() * 6;

    this.mat = new THREE.MeshStandardMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.22, roughness: 0.5, metalness: 0.3 });
    const g = (this.group = new THREE.Group());
    const add = (geo, x, y, z, head) => {
      const m = new THREE.Mesh(geo, this.mat);
      m.position.set(x, y, z);
      m.userData.enemy = this;
      if (head) m.userData.head = true;
      g.add(m);
      return m;
    };
    this.legL = add(GEO.leg, -0.2, 0.35, 0);
    this.legR = add(GEO.leg, 0.2, 0.35, 0);
    this.parts = [this.legL, this.legR, add(GEO.torso, 0, 1.1, 0), add(GEO.arm, -0.5, 1.1, 0), add(GEO.arm, 0.5, 1.1, 0), add(GEO.head, 0, 1.75, 0, true)];
    const visor = new THREE.Mesh(GEO.visor, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    visor.position.set(0, 1.78, 0.235);
    g.add(visor);

    g.position.copy(this.pos);
    g.scale.setScalar(0.01);
    scene.add(g);
  }

  Enemy.prototype.damage = function (n, head, point) {
    if (!this.alive) return;
    this.hp -= n;
    this.flashT = 0.09;
    this.mat.emissive.setHex(0xffffff);
    this.mat.emissiveIntensity = 1.6;
    G.fx.burst(point, this.cfg.color, head ? 9 : 5, 4.5);
    if (this.hp <= 0) this.die(head);
  };

  Enemy.prototype.die = function (head) {
    this.alive = false;
    tmp.copy(this.pos);
    tmp.y = 1.1 * this.cfg.scale;
    G.fx.burst(tmp, this.cfg.color, 26, 7, 1.6 * this.cfg.scale);
    G.fx.burst(tmp, 0xffffff, 8, 5);
    G.audio.play('kill');
    scene.remove(this.group);
    this.mat.dispose();
    G.game.addKill(this, head);
    G.pickups.maybeDrop(this.pos, this.type);
  };

  Enemy.prototype.move = function (dx, dz, dt) {
    // dx, dz — нормализованное желаемое направление
    if (this.avoidT > 0) {
      this.avoidT -= dt;
      const a = 1.25 * this.avoidSide, c = Math.cos(a), s = Math.sin(a);
      const nx = dx * c - dz * s;
      dz = dx * s + dz * c;
      dx = nx;
    }
    const step = this.speed * dt;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += dx * step;
    this.pos.z += dz * step;
    G.level.resolve(this.pos, this.r, 0);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    // Упёрлись в стену: идём вдоль неё, не меняя сторону, пока не обойдём
    this.sinceAvoid += dt;
    if (moved < step * 0.35 && this.avoidT <= 0) {
      if (this.sinceAvoid > 2.5) this.avoidSide = Math.random() < 0.5 ? 1 : -1;
      this.avoidT = 0.9;
      this.sinceAvoid = 0;
    }
    this.walkT += dt * this.speed * 3;
    const sw = Math.sin(this.walkT) * 0.55;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
  };

  Enemy.prototype.update = function (dt) {
    const P = G.player;
    const cfg = this.cfg;

    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 2.5);
      this.group.scale.setScalar(cfg.scale * this.spawnT);
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.mat.emissive.setHex(cfg.color); this.mat.emissiveIntensity = 0.22; }
    }

    let dx = P.pos.x - this.pos.x;
    let dz = P.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    dx /= dist;
    dz /= dist;
    this.cd -= dt;

    if (this.type === 'shooter') {
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = 1 + Math.random() * 2.5; }
      if (dist > 17) this.move(dx, dz, dt);
      else if (dist < 8) this.move(-dx, -dz, dt);
      else this.move(-dz * this.strafe, dx * this.strafe, dt);
      if (this.cd <= 0 && dist < 40 && this.spawnT >= 1) {
        this.cd = cfg.rate * (0.8 + Math.random() * 0.5);
        this.shoot();
      }
    } else {
      const vr = P.vehicle ? P.vehicle.r : 0;
      if (dist > cfg.range * 0.75 + vr) this.move(dx, dz, dt);
      if (dist < cfg.range + vr && this.cd <= 0 && P.pos.y < 2.2) {
        this.cd = cfg.rate;
        P.damage(cfg.dmg);
      }
    }

    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = Math.atan2(dx, dz);
  };

  Enemy.prototype.shoot = function () {
    const P = G.player;
    tmp.set(this.pos.x, 1.5, this.pos.z);
    target.set(P.pos.x, P.pos.y + 1.3, P.pos.z);
    tmp2.copy(target).sub(tmp);
    const d = tmp2.length();
    tmp2.divideScalar(d);
    // Стреляем только при прямой видимости
    losRay.set(tmp, tmp2);
    losRay.far = d;
    if (losRay.intersectObjects(G.level.meshes, false).length) { this.cd = 0.4; return; }

    const mesh = new THREE.Mesh(GEO.shot, shotMat);
    mesh.position.copy(tmp);
    scene.add(mesh);
    E.shots.push({ mesh, vel: tmp2.clone().multiplyScalar(17), life: 4, dmg: this.cfg.dmg });
    G.audio.play('enemyShot');
  };

  E.spawn = function (type, pos, wave) {
    const e = new Enemy(type, pos, wave);
    E.list.push(e);
    rebuildHitList();
    return e;
  };

  function rebuildHitList() {
    E.hitMeshes.length = 0;
    for (const e of E.list) if (e.alive) for (const m of e.parts) E.hitMeshes.push(m);
  }

  E.update = function (dt) {
    const P = G.player;
    let removed = false;
    for (const e of E.list) if (e.alive) e.update(dt);

    // Враги не слипаются друг с другом
    for (let i = 0; i < E.list.length; i++) {
      const a = E.list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < E.list.length; j++) {
        const b = E.list[j];
        if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = a.r + b.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (min - d) / 2;
          a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
        }
      }
    }

    for (let i = E.list.length - 1; i >= 0; i--) {
      if (!E.list[i].alive) { E.list.splice(i, 1); removed = true; }
    }
    if (removed) rebuildHitList();

    // Снаряды стрелков
    P.center(target);
    for (let i = E.shots.length - 1; i >= 0; i--) {
      const s = E.shots[i];
      s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      let dead = s.life <= 0 || G.level.pointBlocked(s.mesh.position);
      const p = s.mesh.position;
      if (!dead && Math.hypot(p.x - target.x, p.z - target.z) < (P.vehicle ? P.vehicle.r : 0.55) && Math.abs(p.y - target.y) < (P.vehicle ? 1.6 : 1.0)) {
        P.damage(s.dmg);
        dead = true;
      }
      if (dead) {
        G.fx.burst(p, 0xd9a1ff, 5, 3, 0.7);
        scene.remove(s.mesh);
        E.shots.splice(i, 1);
      }
    }
  };

  E.clear = function () {
    for (const e of E.list) { scene.remove(e.group); e.mat.dispose(); }
    for (const s of E.shots) scene.remove(s.mesh);
    E.list.length = 0;
    E.shots.length = 0;
    E.hitMeshes.length = 0;
  };
})();
