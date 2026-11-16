// Ракеты, снаряды и взрывы с уроном по площади.
(function () {
  const B = (G.boom = { rockets: [], blasts: [] });
  const V3 = THREE.Vector3;
  const rocketGeo = new THREE.BoxGeometry(0.16, 0.16, 0.6);
  const blastGeo = new THREE.SphereGeometry(1, 16, 12);
  const tmp = new V3();
  let scene = null;
  let light = null;

  B.init = function (s) {
    scene = s;
    light = new THREE.PointLight(0xff9a3c, 0, 40, 2);
    scene.add(light);
  };

  B.fire = function (from, dir, o) {
    const mesh = new THREE.Mesh(rocketGeo, new THREE.MeshBasicMaterial({ color: o.color || 0xff7a1a }));
    mesh.position.copy(from);
    mesh.lookAt(tmp.copy(from).add(dir));
    scene.add(mesh);
    B.rockets.push({ mesh, vel: dir.clone().multiplyScalar(o.speed || 40), life: 4, dmg: o.dmg, radius: o.radius });
  };

  B.explode = function (pos, radius, dmg) {
    const P = G.player;
    G.audio.play('explosion');
    G.fx.burst(pos, 0xff7a1a, 30, 11, 1.8);
    G.fx.burst(pos, 0xffe08a, 16, 7, 1.2);
    const dp = pos.distanceTo(P.pos);
    G.fx.addShake(Math.max(0, 1.1 - dp / 28));

    const mesh = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color: 0xffb04d, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.position.copy(pos);
    scene.add(mesh);
    B.blasts.push({ mesh, t: 0, radius });
    light.position.copy(pos);
    light.position.y += 1;
    light.intensity = 7;

    for (const e of G.enemies.list.slice()) {
      if (!e.alive) continue;
      tmp.set(e.pos.x, 1.0 * e.cfg.scale, e.pos.z);
      const d = tmp.distanceTo(pos) - e.r;
      if (d < radius) e.damage(dmg * (1 - 0.7 * Math.max(0, d) / radius), false, tmp.clone());
    }
    if (!P.vehicle) {
      const d = P.center(tmp).distanceTo(pos);
      if (d < radius) P.damage(dmg * 0.22 * (1 - d / radius));
    }
  };

  function hitsEnemy(p) {
    for (const e of G.enemies.list) {
      if (!e.alive) continue;
      if (p.y < 2.2 * e.cfg.scale && Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < e.r + 0.35) return true;
    }
    return false;
  }

  B.update = function (dt) {
    for (let i = B.rockets.length - 1; i >= 0; i--) {
      const r = B.rockets[i];
      r.life -= dt;
      // Два шага за кадр, чтобы быстрый снаряд не пролетал сквозь тонкие стены
      let hit = r.life <= 0;
      for (let s = 0; s < 2 && !hit; s++) {
        r.mesh.position.addScaledVector(r.vel, dt / 2);
        hit = G.level.pointBlocked(r.mesh.position) || r.mesh.position.y < 0.12 || hitsEnemy(r.mesh.position);
      }
      if (Math.random() < 0.7) G.fx.burst(r.mesh.position, 0xffa040, 1, 1.2, 0.8);
      if (hit) {
        r.mesh.position.addScaledVector(r.vel, -dt / 2);
        r.mesh.position.y = Math.max(0.3, r.mesh.position.y);
        B.explode(r.mesh.position, r.radius, r.dmg);
        scene.remove(r.mesh);
        r.mesh.material.dispose();
        B.rockets.splice(i, 1);
      }
    }

    for (let i = B.blasts.length - 1; i >= 0; i--) {
      const b = B.blasts[i];
      b.t += dt / 0.35;
      if (b.t >= 1) {
        scene.remove(b.mesh);
        b.mesh.material.dispose();
        B.blasts.splice(i, 1);
        continue;
      }
      b.mesh.scale.setScalar(b.radius * (0.25 + 0.75 * Math.sqrt(b.t)));
      b.mesh.material.opacity = 0.85 * (1 - b.t);
    }
    light.intensity = Math.max(0, light.intensity - dt * 22);
  };

  B.clear = function () {
    for (const r of B.rockets) { scene.remove(r.mesh); r.mesh.material.dispose(); }
    for (const b of B.blasts) { scene.remove(b.mesh); b.mesh.material.dispose(); }
    B.rockets.length = 0;
    B.blasts.length = 0;
    if (light) light.intensity = 0;
  };
})();
