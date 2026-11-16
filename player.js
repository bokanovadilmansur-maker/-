// Игрок: движение от первого лица, прыжок, бег, здоровье, камера.
(function () {
  const P = (G.player = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    hp: 100,
    maxHp: 100,
    r: 0.4,
    eye: 1.7,
    onGround: true,
    moving: false,
    sprinting: false,
    flash: 0,   // красная рамка при уроне
    kick: 0,    // отдача камеры
    bobT: 0,
    vehicle: null, // транспорт, в котором сидит игрок
  });
  const camF = new THREE.Vector3(), camT = new THREE.Vector3(), camP = new THREE.Vector3();

  const WALK = 6.2;
  const SPRINT = 9.6;
  const GRAVITY = 24;
  const JUMP = 8.2;

  P.reset = function () {
    P.pos.set(0, 0, 0);
    P.vel.set(0, 0, 0);
    P.yaw = 0;
    P.pitch = 0;
    P.hp = P.maxHp;
    P.onGround = true;
    P.flash = 0;
    P.kick = 0;
    P.vehicle = null;
  };

  P.look = function (mx, my) {
    const s = G.settings.sens * 0.0022 * (G.camera.fov / G.settings.fov);
    P.yaw -= mx * s;
    P.pitch -= my * s;
    P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch));
  };

  P.heal = function (n) {
    P.hp = Math.min(P.maxHp, P.hp + n);
  };

  P.damage = function (n) {
    if (G.state !== 'playing' || P.hp <= 0) return;
    if (P.vehicle) { // броня принимает урон на себя
      P.vehicle.damage(n);
      P.flash = Math.max(P.flash, 0.35);
      G.fx.addShake(0.15);
      return;
    }
    P.hp = Math.max(0, P.hp - n);
    P.flash = 1;
    G.fx.addShake(0.35 + n * 0.012);
    G.audio.play('hurt');
    if (P.hp <= 0) G.gameOver();
  };

  P.center = function (out) {
    return out.set(P.pos.x, P.pos.y + 1.0, P.pos.z);
  };

  P.update = function (dt) {
    if (P.vehicle) {
      P.moving = P.sprinting = false;
      P.onGround = true;
      P.vel.set(0, 0, 0);
      P.flash = Math.max(0, P.flash - dt * 1.6);
      P.kick = 0;
      return;
    }
    const k = G.input.keys;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);

    // Направление в мировых координатах (при yaw = 0 смотрим вдоль -Z)
    let wx = -sin * f + cos * s;
    let wz = -cos * f - sin * s;
    const len = Math.hypot(wx, wz);
    P.moving = len > 0;
    P.sprinting = P.moving && (k.ShiftLeft || k.ShiftRight) && f > 0;
    const speed = P.sprinting ? SPRINT : WALK;
    if (len > 0) { wx = (wx / len) * speed; wz = (wz / len) * speed; }

    const accel = Math.min(1, dt * (P.onGround ? 14 : 3.5));
    P.vel.x += (wx - P.vel.x) * accel;
    P.vel.z += (wz - P.vel.z) * accel;

    if (k.Space && P.onGround) {
      P.vel.y = JUMP;
      P.onGround = false;
      G.audio.play('jump');
    }

    const feet = P.pos.y;
    P.pos.x += P.vel.x * dt;
    P.pos.z += P.vel.z * dt;
    G.level.resolve(P.pos, P.r, feet);

    P.vel.y -= GRAVITY * dt;
    P.pos.y += P.vel.y * dt;
    const ground = G.level.groundAt(P.pos, P.r, feet);
    if (P.pos.y <= ground) {
      P.pos.y = ground;
      P.vel.y = 0;
      P.onGround = true;
    } else {
      P.onGround = false;
    }

    if (P.moving && P.onGround) P.bobT += dt * (P.sprinting ? 13 : 9);
    P.flash = Math.max(0, P.flash - dt * 1.6);
    P.kick = Math.max(0, P.kick - dt * (0.6 + P.kick * 9));
  };

  P.applyCamera = function (cam) {
    if (P.vehicle) {
      // Вид от третьего лица: камера за транспортом, не проходит сквозь стены
      const v = P.vehicle;
      const pitch = Math.max(-0.75, Math.min(0.3, P.pitch));
      P.pitch = pitch;
      camF.set(-Math.sin(P.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(P.yaw) * Math.cos(pitch));
      camT.set(v.pos.x, v.cfg.camH, v.pos.z);
      let dist = v.cfg.camDist;
      for (let t = 1; t <= v.cfg.camDist; t += 0.5) {
        camP.copy(camT).addScaledVector(camF, -t);
        if (camP.y > 0.3 && G.level.pointBlocked(camP)) { dist = Math.max(1, t - 0.6); break; }
      }
      cam.position.copy(camT).addScaledVector(camF, -dist);
      if (cam.position.y < 0.5) cam.position.y = 0.5;
      cam.position.add(G.fx.shake);
      cam.rotation.set(pitch, P.yaw, 0, 'YXZ');
      return;
    }
    const bob = P.moving && P.onGround ? Math.sin(P.bobT) * 0.045 : 0;
    cam.position.set(P.pos.x, P.pos.y + P.eye + bob, P.pos.z).add(G.fx.shake);
    cam.rotation.set(P.pitch + P.kick, P.yaw, 0, 'YXZ');
  };
})();
