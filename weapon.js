// Оружие: пять стволов, стрельба лучом (raycast) и ракетами, прицеливание, перезарядка, модель в руках.
(function () {
  const W = (G.weapon = { list: [], index: 0, cur: null, cooldown: 0, reloading: false, reloadT: 0, zoom: 0, scoped: false, scene: null, cam: null });
  const V3 = THREE.Vector3;

  const DEFS = [
    { id: 'pistol', name: 'ПИСТОЛЕТ', dmg: 34, rate: 0.22, auto: false, mag: 12, reserve: Infinity, maxReserve: Infinity, pickup: 0, spread: 0.004, pellets: 1, reload: 1.0, kick: 0.035, tracer: 0xfff2a8 },
    { id: 'rifle', name: 'АВТОМАТ', dmg: 19, rate: 0.085, auto: true, mag: 30, reserve: 120, maxReserve: 210, pickup: 60, spread: 0.018, pellets: 1, reload: 1.6, kick: 0.016, tracer: 0x7ff2ff },
    { id: 'shotgun', name: 'ДРОБОВИК', dmg: 13, rate: 0.75, auto: false, mag: 6, reserve: 24, maxReserve: 42, pickup: 12, spread: 0.065, pellets: 9, reload: 1.9, kick: 0.085, tracer: 0xffb36b },
    { id: 'sniper', name: 'СНАЙПЕРКА', dmg: 170, rate: 1.0, auto: false, mag: 5, reserve: 15, maxReserve: 30, pickup: 5, spread: 0.03, pellets: 1, reload: 2.2, kick: 0.1, tracer: 0xff5cf0, zoomFov: 20 },
    { id: 'rocket', name: 'РАКЕТНИЦА', dmg: 240, rate: 0.6, auto: false, mag: 1, reserve: 5, maxReserve: 10, pickup: 2, spread: 0, pellets: 1, reload: 1.8, kick: 0.11, tracer: 0xff7a1a, rocket: true },
  ];

  const BASE = new V3(0.24, -0.21, -0.78);
  const raycaster = new THREE.Raycaster();
  const dir = new V3(), right = new V3(), up = new V3(), shot = new V3(), muzzle = new V3(), end = new V3();
  let recoil = 0, dip = 0, flashT = 0, swayT = 0;
  let flashLight = null;

  function part(group, mat, w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }

  function buildModel(def) {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a3050, roughness: 0.4, metalness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x12152a, roughness: 0.7, metalness: 0.4 });
    const glow = new THREE.MeshBasicMaterial({ color: def.tracer });
    let mz = -0.2;
    if (def.id === 'pistol') {
      part(g, metal, 0.07, 0.1, 0.3, 0, 0, 0);
      part(g, dark, 0.06, 0.17, 0.09, 0, -0.12, 0.09);
      part(g, glow, 0.074, 0.015, 0.2, 0, 0.03, -0.02);
      mz = -0.17;
    } else if (def.id === 'rifle') {
      part(g, metal, 0.08, 0.11, 0.62, 0, 0, -0.05);
      part(g, dark, 0.05, 0.2, 0.09, 0, -0.14, -0.04);
      part(g, dark, 0.06, 0.15, 0.08, 0, -0.11, 0.2);
      part(g, dark, 0.07, 0.09, 0.2, 0, -0.02, 0.36);
      part(g, metal, 0.04, 0.04, 0.2, 0, 0.01, -0.44);
      part(g, glow, 0.084, 0.015, 0.4, 0, 0.035, -0.05);
      mz = -0.56;
    } else if (def.id === 'shotgun') {
      part(g, metal, 0.09, 0.09, 0.72, 0, 0.02, -0.1);
      part(g, dark, 0.11, 0.08, 0.24, 0, -0.06, -0.22);
      part(g, dark, 0.08, 0.13, 0.26, 0, -0.03, 0.34);
      part(g, glow, 0.094, 0.015, 0.3, 0, 0.068, 0.0);
      mz = -0.48;
    } else if (def.id === 'sniper') {
      part(g, metal, 0.07, 0.1, 0.55, 0, 0, 0);
      part(g, metal, 0.035, 0.035, 0.6, 0, 0.01, -0.56);
      part(g, dark, 0.055, 0.055, 0.26, 0, 0.09, -0.02);
      part(g, glow, 0.058, 0.058, 0.02, 0, 0.09, -0.155);
      part(g, dark, 0.06, 0.16, 0.08, 0, -0.12, 0.12);
      part(g, dark, 0.07, 0.11, 0.26, 0, -0.02, 0.4);
      mz = -0.88;
    } else {
      part(g, metal, 0.17, 0.17, 0.95, 0, 0.03, -0.1);
      part(g, dark, 0.19, 0.19, 0.12, 0, 0.03, -0.55);
      part(g, dark, 0.19, 0.19, 0.1, 0, 0.03, 0.35);
      part(g, dark, 0.06, 0.16, 0.08, 0, -0.12, 0.0);
      part(g, glow, 0.176, 0.02, 0.5, 0, 0.12, -0.1);
      mz = -0.64;
    }
    const m = new THREE.Object3D();
    m.position.set(0, 0.01, mz);
    g.add(m);

    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.11),
      new THREE.MeshBasicMaterial({ color: 0xffc04d, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    flash.position.set(0, 0.01, mz - 0.03);
    flash.visible = false;
    g.add(flash);

    g.position.copy(BASE);
    g.scale.setScalar(0.8);
    g.visible = false;
    return { group: g, muzzle: m, flash };
  }

  W.init = function (mainScene) {
    W.scene = new THREE.Scene();
    W.cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 10);
    W.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const l = new THREE.DirectionalLight(0x9fdcff, 0.9);
    l.position.set(-1, 2, 1);
    W.scene.add(l);

    W.list = DEFS.map((def) => {
      const model = buildModel(def);
      W.scene.add(model.group);
      return Object.assign({}, def, model, { ammo: def.mag });
    });

    flashLight = new THREE.PointLight(0xffd27a, 0, 14, 2);
    mainScene.add(flashLight);
    W.reset();
  };

  W.reset = function () {
    W.list.forEach((w, i) => {
      w.ammo = w.mag;
      w.reserve = DEFS[i].reserve;
      w.group.visible = false;
    });
    W.index = 0;
    W.cur = W.list[0];
    W.cur.group.visible = true;
    W.cooldown = 0;
    W.reloading = false;
    W.zoom = 0;
    W.scoped = false;
    recoil = dip = flashT = 0;
  };

  W.select = function (i) {
    if (i === W.index || !W.list[i] || G.player.vehicle) return;
    W.cur.group.visible = false;
    W.index = i;
    W.cur = W.list[i];
    W.cur.group.visible = true;
    W.reloading = false;
    W.cooldown = Math.max(W.cooldown, 0.25);
    W.zoom = 0;
    dip = 1;
    G.audio.play('switch');
  };

  W.cycle = function (d) {
    W.select((W.index + d + W.list.length) % W.list.length);
  };

  W.startReload = function () {
    const w = W.cur;
    if (W.reloading || w.ammo >= w.mag || w.reserve <= 0 || G.player.vehicle) return;
    W.reloading = true;
    W.reloadT = w.reload;
    G.audio.play('reload');
  };

  W.addAmmo = function () {
    for (const w of W.list) {
      if (w.maxReserve === Infinity) continue;
      w.reserve = Math.min(w.maxReserve, w.reserve + w.pickup);
    }
  };

  W.reloadProgress = function () {
    return W.reloading ? 1 - W.reloadT / W.cur.reload : 0;
  };

  function setFov(fov) {
    const cam = G.camera;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  function fire() {
    const w = W.cur;
    const P = G.player;
    w.ammo--;
    W.cooldown = w.rate;
    G.audio.play(w.id);

    const cam = G.camera;
    P.applyCamera(cam);
    cam.updateMatrixWorld();
    G.scene.updateMatrixWorld();
    W.scene.updateMatrixWorld();

    cam.getWorldDirection(dir);
    right.setFromMatrixColumn(cam.matrixWorld, 0);
    up.setFromMatrixColumn(cam.matrixWorld, 1);
    w.muzzle.getWorldPosition(muzzle).applyMatrix4(cam.matrixWorld);

    const targets = G.level.meshes.concat(G.enemies.hitMeshes);
    raycaster.far = 200;

    if (w.rocket) {
      // Ракета летит из ствола в точку, на которую смотрит прицел
      raycaster.set(cam.position, dir);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length && hits[0].distance > 3) shot.copy(hits[0].point).sub(muzzle).normalize();
      else shot.copy(dir);
      G.boom.fire(muzzle, shot, { speed: 42, dmg: w.dmg, radius: 6, color: w.tracer });
    } else {
      G.game.shots++;
      let spread = w.spread * (P.sprinting || !P.onGround ? 1.8 : 1);
      spread *= w.zoomFov ? 1 - W.zoom : 1 - 0.5 * W.zoom;
      let hitEnemy = false, head = false;

      for (let i = 0; i < w.pellets; i++) {
        shot.copy(dir)
          .addScaledVector(right, (Math.random() - 0.5) * 2 * spread)
          .addScaledVector(up, (Math.random() - 0.5) * 2 * spread)
          .normalize();
        raycaster.set(cam.position, shot);
        const hits = raycaster.intersectObjects(targets, false);
        if (hits.length) {
          const h = hits[0];
          end.copy(h.point);
          const enemy = h.object.userData.enemy;
          if (enemy && enemy.alive) {
            const isHead = !!h.object.userData.head;
            enemy.damage(w.dmg * (isHead ? 2 : 1), isHead, h.point);
            hitEnemy = true;
            head = head || isHead;
          } else {
            G.fx.burst(h.point, w.tracer, 4, 3, 0.6);
          }
        } else {
          end.copy(cam.position).addScaledVector(shot, 120);
        }
        G.fx.tracer(muzzle, end, w.tracer);
      }

      if (hitEnemy) {
        G.game.hits++;
        G.hud.hitmarker(head);
        G.audio.play(head ? 'headshot' : 'hit');
      }
    }

    recoil = 1;
    flashT = 0.05;
    w.flash.rotation.z = Math.random() * Math.PI;
    P.kick = Math.min(0.22, P.kick + w.kick);
    G.fx.addShake(w.kick * 2.2);
    flashLight.position.copy(muzzle);
    flashLight.intensity = 2.2;
  }

  W.update = function (dt) {
    const w = W.cur;
    const input = G.input;
    const P = G.player;

    // За рулём оружие убрано
    if (P.vehicle) {
      W.zoom = 0;
      W.scoped = false;
      W.reloading = false;
      input.fireFresh = false;
      flashLight.intensity = 0;
      setFov(G.settings.fov);
      return;
    }

    W.cooldown -= dt;

    if (W.reloading) {
      W.reloadT -= dt;
      if (W.reloadT <= 0) {
        const take = Math.min(w.mag - w.ammo, w.reserve);
        w.ammo += take;
        w.reserve -= take;
        W.reloading = false;
        G.audio.play('reloadDone');
      }
    }

    if (input.fire && (w.auto || input.fireFresh) && !W.reloading && W.cooldown <= 0) {
      if (w.ammo > 0) fire();
      else if (w.reserve > 0) W.startReload();
      else if (input.fireFresh) G.audio.play('empty');
    }
    input.fireFresh = false;
    if (w.ammo === 0 && !W.reloading && w.reserve > 0 && W.cooldown <= 0) W.startReload();

    // Прицеливание (ПКМ): приближение, у снайперки — оптика
    const wantZoom = input.aim && !W.reloading && !P.sprinting ? 1 : 0;
    W.zoom += (wantZoom - W.zoom) * Math.min(1, dt * 14);
    const base = G.settings.fov;
    setFov(base + ((w.zoomFov || base * 0.72) - base) * W.zoom);
    W.scoped = !!w.zoomFov && W.zoom > 0.75;
    w.group.visible = !W.scoped;

    // Анимация модели в руках
    recoil = Math.max(0, recoil - dt * 9);
    dip = Math.max(0, dip - dt * 5);
    flashT -= dt;
    w.flash.visible = flashT > 0;
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 40);

    swayT += dt;
    const bob = P.moving && P.onGround ? 1 - 0.7 * W.zoom : 0;
    const rl = W.reloading ? Math.sin(Math.min(1, W.reloadProgress()) * Math.PI) : 0;
    // На узком экране сдвигаем оружие ближе к центру, чтобы оно не уходило за край
    const bx = BASE.x * Math.min(1, W.cam.aspect / 1.4) * (1 - 0.9 * W.zoom);
    w.group.position.set(
      bx + Math.cos(P.bobT * 0.5) * 0.012 * bob,
      BASE.y + 0.07 * W.zoom + Math.abs(Math.sin(P.bobT * 0.5)) * 0.014 * bob + Math.sin(swayT * 1.6) * 0.003 - dip * 0.25 - rl * 0.16,
      BASE.z + recoil * 0.07
    );
    w.group.rotation.set(recoil * 0.14 - dip * 0.8 - rl * 0.7, 0, rl * 0.35);
  };
})();
