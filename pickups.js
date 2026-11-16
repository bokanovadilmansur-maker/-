// Бонусы: аптечки и патроны, выпадают из врагов.
(function () {
  const K = (G.pickups = { list: [] });
  const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const COLORS = { health: 0x00ff9c, ammo: 0xffd60a };
  let scene = null;

  K.init = function (s) { scene = s; };

  K.spawn = function (pos, type) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLORS[type] }));
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff })));
    mesh.position.set(pos.x, 0.7, pos.z);
    scene.add(mesh);
    K.list.push({ mesh, type, life: 22, t: Math.random() * 6 });
  };

  K.maybeDrop = function (pos, enemyType) {
    const chance = enemyType === 'tank' ? 1 : 0.24;
    if (Math.random() > chance) return;
    const lowHp = G.player.hp < 50;
    K.spawn(pos, Math.random() < (lowHp ? 0.65 : 0.4) ? 'health' : 'ammo');
  };

  K.update = function (dt) {
    const P = G.player;
    for (let i = K.list.length - 1; i >= 0; i--) {
      const k = K.list[i];
      k.life -= dt;
      k.t += dt;
      k.mesh.rotation.y += dt * 2;
      k.mesh.position.y = 0.7 + Math.sin(k.t * 3) * 0.12;
      k.mesh.visible = k.life > 4 || Math.floor(k.life * 6) % 2 === 0; // мигает перед исчезновением

      let taken = false;
      const near = Math.hypot(P.pos.x - k.mesh.position.x, P.pos.z - k.mesh.position.z) < 1.3 && P.pos.y < 1.5;
      if (near) {
        if (k.type === 'health' && P.hp < P.maxHp) { P.heal(25); taken = true; }
        else if (k.type === 'ammo') { G.weapon.addAmmo(); taken = true; }
      }
      if (taken) {
        G.audio.play('pickup');
        G.fx.burst(k.mesh.position, COLORS[k.type], 10, 3.5);
      }
      if (taken || k.life <= 0) {
        scene.remove(k.mesh);
        k.mesh.material.dispose();
        K.list.splice(i, 1);
      }
    }
  };

  K.clear = function () {
    for (const k of K.list) { scene.remove(k.mesh); k.mesh.material.dispose(); }
    K.list.length = 0;
  };
})();
