// Уровень: арена, стены, укрытия и простая физика столкновений (круг против AABB).
(function () {
  const L = (G.level = { boxes: [], meshes: [], spawns: [], half: 60 });
  const V3 = THREE.Vector3;

  L.build = function (scene) {
    scene.background = new THREE.Color(0x05060f);
    scene.fog = new THREE.Fog(0x05060f, 25, 125);

    // Свет
    scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x140022, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.45);
    sun.position.set(12, 24, 6);
    scene.add(sun);

    // Пол с неоновой сеткой
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(124, 124),
      new THREE.MeshStandardMaterial({ color: 0x0a0c1a, roughness: 0.8, metalness: 0.3 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    L.meshes.push(floor);

    const grid = new THREE.GridHelper(120, 60, 0x00e5ff, 0x1a2b52);
    grid.position.y = 0.01;
    scene.add(grid);

    function box(x, z, w, d, h, color, edge) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.4 }));
      mesh.position.set(x, h / 2, z);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edge })));
      scene.add(mesh);
      L.meshes.push(mesh);
      L.boxes.push(new THREE.Box3(new V3(x - w / 2, 0, z - d / 2), new V3(x + w / 2, h, z + d / 2)));
      return mesh;
    }

    // Внешние стены
    const H = L.half;
    box(0, -H - 0.5, 122, 1, 6, 0x10142c, 0xff2d78);
    box(0, H + 0.5, 122, 1, 6, 0x10142c, 0xff2d78);
    box(-H - 0.5, 0, 1, 122, 6, 0x10142c, 0x00e5ff);
    box(H + 0.5, 0, 1, 122, 6, 0x10142c, 0x00e5ff);

    // Колонны с подсветкой
    const pillarColors = [0x00e5ff, 0xff2d78, 0xb14dff, 0x00ff9c];
    [[13, 13], [-13, 13], [13, -13], [-13, -13]].forEach(([x, z], i) => {
      box(x, z, 2.4, 2.4, 6, 0x141a38, pillarColors[i]);
      const light = new THREE.PointLight(pillarColors[i], 1.3, 30, 2);
      light.position.set(x * 0.82, 4.5, z * 0.82);
      scene.add(light);
    });

    // Низкие стенки-укрытия вокруг центра
    box(0, 7, 7, 0.8, 1.3, 0x18204a, 0x00e5ff);
    box(0, -7, 7, 0.8, 1.3, 0x18204a, 0x00e5ff);
    box(7, 0, 0.8, 7, 1.3, 0x18204a, 0xff2d78);
    box(-7, 0, 0.8, 7, 1.3, 0x18204a, 0xff2d78);

    // Ящики (на них можно запрыгнуть)
    [[21, 6], [-21, -6], [6, -21], [-6, 21], [22, -8], [-22, 8]].forEach(([x, z]) => {
      box(x, z, 2, 2, 1.2, 0x1c2550, 0xffd60a);
    });

    // Город: здания вокруг центральной площади
    const neon = [0x00e5ff, 0xff2d78, 0xb14dff, 0x00ff9c, 0xffd60a, 0xff7a1a];
    let bi = 0;
    const building = (x, z, size) => {
      const h = 9 + ((bi * 7) % 5) * 3.5;
      box(x, z, size, size, h, 0x0e1230, neon[bi % neon.length]);
      bi++;
    };
    const ring = [-46, -23, 0, 23, 46];
    for (const x of ring) for (const z of ring) {
      if (Math.max(Math.abs(x), Math.abs(z)) === 46) building(x, z, 12);
    }
    [[28, 28], [-28, 28], [28, -28], [-28, -28]].forEach(([x, z]) => building(x, z, 10));

    // Точки появления врагов
    const ringGeo = new THREE.RingGeometry(1.0, 1.35, 32);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const p = new V3(Math.cos(a) * 26, 0, Math.sin(a) * 26);
      L.spawns.push(p);
      const pad = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff2d78, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(p.x, 0.03, p.z);
      scene.add(pad);
    }
    [[36, 0], [-36, 0], [0, 36], [0, -36], [36, 36], [-36, 36], [36, -36], [-36, -36],
      [56, 11.5], [-56, -11.5], [11.5, -56], [-11.5, 56]].forEach(([x, z]) => L.spawns.push(new V3(x, 0, z)));

    // Звёзды
    const stars = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const v = new V3(Math.random() - 0.5, Math.random() * 0.6 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(140);
      stars.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 0.9, fog: false })));
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Выталкивает круг радиуса r из всех коробок, которые выше уровня ног.
  L.resolve = function (p, r, feetY) {
    for (let it = 0; it < 2; it++) {
      for (const b of L.boxes) {
        if (feetY >= b.max.y - 0.05) continue;
        const cx = clamp(p.x, b.min.x, b.max.x);
        const cz = clamp(p.z, b.min.z, b.max.z);
        const dx = p.x - cx;
        const dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          const l = p.x - b.min.x, rt = b.max.x - p.x, n = p.z - b.min.z, f = b.max.z - p.z;
          const m = Math.min(l, rt, n, f);
          if (m === l) p.x = b.min.x - r;
          else if (m === rt) p.x = b.max.x + r;
          else if (m === n) p.z = b.min.z - r;
          else p.z = b.max.z + r;
        }
      }
    }
    const lim = L.half - r;
    p.x = clamp(p.x, -lim, lim);
    p.z = clamp(p.z, -lim, lim);
  };

  // Высота поверхности под игроком (пол или верх ящика).
  L.groundAt = function (p, r, feetY) {
    let g = 0;
    const rr = r * 0.8;
    for (const b of L.boxes) {
      if (b.max.y > feetY + 0.05) continue;
      const dx = p.x - clamp(p.x, b.min.x, b.max.x);
      const dz = p.z - clamp(p.z, b.min.z, b.max.z);
      if (dx * dx + dz * dz < rr * rr && b.max.y > g) g = b.max.y;
    }
    return g;
  };

  L.pointBlocked = function (p) {
    if (p.y < 0 || Math.abs(p.x) > L.half || Math.abs(p.z) > L.half) return true;
    for (const b of L.boxes) if (b.containsPoint(p)) return true;
    return false;
  };
})();
