// Эффекты: частицы, трассеры пуль, тряска камеры. Всё на пулах объектов.
(function () {
  const FX = (G.fx = { trauma: 0, shake: new THREE.Vector3() });
  const MAX_PARTICLES = 220;
  const MAX_TRACERS = 24;
  const particles = [];
  const tracers = [];
  let pIndex = 0;
  let tIndex = 0;
  let scene = null;

  FX.init = function (s) {
    scene = s;
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      mesh.visible = false;
      scene.add(mesh);
      particles.push({ mesh, vel: new THREE.Vector3(), life: 0, max: 1 });
    }
    for (let i = 0; i < MAX_TRACERS; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfff2a8, transparent: true }));
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      tracers.push({ line, life: 0 });
    }
  };

  FX.burst = function (pos, color, count, speed, size) {
    for (let i = 0; i < count; i++) {
      const p = particles[pIndex++ % MAX_PARTICLES];
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(size || 1);
      p.mesh.visible = true;
      p.vel.set(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      p.max = p.life = 0.35 + Math.random() * 0.45;
    }
  };

  FX.tracer = function (from, to, color) {
    const t = tracers[tIndex++ % MAX_TRACERS];
    const a = t.line.geometry.attributes.position;
    a.setXYZ(0, from.x, from.y, from.z);
    a.setXYZ(1, to.x, to.y, to.z);
    a.needsUpdate = true;
    t.line.material.color.setHex(color || 0xfff2a8);
    t.line.material.opacity = 0.9;
    t.line.visible = true;
    t.life = 0.07;
  };

  FX.addShake = function (amount) {
    FX.trauma = Math.min(1, FX.trauma + amount);
  };

  FX.update = function (dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.vel.y *= -0.4; p.vel.x *= 0.7; p.vel.z *= 0.7; }
      p.mesh.material.opacity = p.life / p.max;
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
    }
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.line.visible = false;
      else t.line.material.opacity = t.life / 0.07;
    }
    FX.trauma = Math.max(0, FX.trauma - dt * 2.2);
    const s = FX.trauma * FX.trauma * 0.16;
    FX.shake.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  };

  FX.clear = function () {
    for (const p of particles) { p.life = 0; p.mesh.visible = false; }
    for (const t of tracers) { t.life = 0; t.line.visible = false; }
    FX.trauma = 0;
  };
})();
