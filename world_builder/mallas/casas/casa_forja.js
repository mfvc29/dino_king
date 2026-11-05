/**
 * Casa de la Forja — casa chibi para la Ciudad de la Forja (Fuego + Rayo).
 *   - Muros de basalto oscuro con zócalo negro, techo de tejas rojo fuego y alero naranja y rojo.
 *   - Cuernos de ceratópsido en la cumbrera, pararrayos de aguja dorada (#eab308) con rayo en zigzag.
 *   - Chimenea grande con brasas y llamas (#ef4444), farolillos de fuego junto a la puerta, rayo dorado en la puerta y un yunque.
 * Base común con la Casa Dino: formas redondas chibi y colores planos a juego con los mini dinos.
 * Escala: 1 unidad = 1 metro. El frente mira hacia +z.
 */
registrarMalla({
  id: 'casa_forja',
  categoria: 'casas',
  nombre: 'Casa de la Forja',
  icono: '🔥',
  origen: 'procedural/estilo_chibi',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    function bola(x, y, z, rx, ry, rz, e, nombre, segA = 32, segB = 20, corteY = null) {
      const sW = M.seg(segA, 10), sH = M.seg(segB, 8);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const pos = geo.attributes.position;
      const ex = 2 / e;
      for (let i = 0; i < pos.count; i++) {
        const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), ex);
        let yy = y + f(pos.getY(i)) * ry;
        if (corteY !== null && yy < corteY) yy = corteY;
        pos.setXYZ(i, x + f(pos.getX(i)) * rx, yy, z + f(pos.getZ(i)) * rz);
      }
      return M.pieza(geo, nombre, sW, sH);
    }
    const tubo = (puntos, r0, r1, nombre, segL = 16, segR = 12) => M.tubo(puntos, r0, r1, { segLargo: segL, segRadio: segR, nombre });
    function cono(base, dir, largo, radio, nombre) {
      const geo = new THREE.ConeGeometry(radio, largo, M.seg(16, 8), 4);
      const m = M.pieza(geo, nombre, M.seg(16, 8), 4);
      m.position.copy(base).addScaledVector(dir.clone().normalize(), largo / 2);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
      return m;
    }
    function anillo(x, y, z, R, r, nombre, rotY = 0, rotX = 0) {
      const geo = new THREE.TorusGeometry(R, r, M.seg(12, 6), M.seg(36, 12));
      const m = M.pieza(geo, nombre, M.seg(36, 12), M.seg(12, 6));
      m.position.set(x, y, z); m.rotation.y = rotY; m.rotation.x = rotX;
      return m;
    }
    const pintar = [];
    const poner = (m, fn) => { g.add(m); pintar.push([m, fn]); return m; };
    const fijo = (hex) => { const c = new THREE.Color(hex); return () => c; };
    const S = {"w": 1.85, "d": 1.55, "h": 2.55, "techo": {"rx": 2.35, "ry": 1.75, "rz": 2.0, "e": 3.0}, "patron": "liso"};   // medidas: w, d (semiancho/semifondo de paredes), h (alto), techo {rx, ry, rz, e}, patron de pared
    const P = {"pared": 5921380, "paredSombra": 4473932, "piedra": 3421242, "piedraOsc": 2236968, "madera": 5913124, "puerta": 8014378, "marco": 2763312, "metal": 15381256, "techo": 12070940, "techoAlto": 15690298, "alero": 15680580, "alero2": 16096779, "vidrio": 16762992, "marcoVentana": 2763312, "hoja": 4885050, "cuerno": 15655620, "fuego": 15680580, "fuego2": 16498468, "hierro": 3816002};
    const C = {}; Object.keys(P).forEach((k) => { C[k] = new THREE.Color(P[k]); });

    // ---------------- Zócalo y paredes ----------------
    poner(bola(0, 0.12, 0, S.w + 0.3, 0.16, S.d + 0.3, 5, 'Zocalo', 40, 10), (i, p) => C.piedra.clone().lerp(C.piedraOsc, suave(0.2, 0.0, p.y)));
    const H0 = 0.25, H1 = S.h;
    const patron = (p) => {
      if (S.patron === 'rayas') return Math.floor(p.y / 0.32) % 2 ? 1 : 0;
      if (S.patron === 'troncos') { const t = (p.y / 0.26) % 1; return t < 0.12 ? 1 : 0; }
      if (S.patron === 'ladrillo') { const fy = Math.floor(p.y / 0.18), t = (p.y / 0.18) % 1; const u = ((Math.atan2(p.z, p.x) * 6 + (fy % 2) * 0.5) % 1 + 1) % 1; return t < 0.12 || u < 0.06 ? 1 : 0; }
      if (S.patron === 'piedra') { const fy = Math.floor(p.y / 0.3), t = (p.y / 0.3) % 1; const u = ((Math.atan2(p.z, p.x) * 4 + (fy % 2) * 0.5) % 1 + 1) % 1; return t < 0.08 || u < 0.05 ? 1 : 0; }
      return 0;
    };
    poner(bola(0, (H0 + H1) / 2, 0, S.w, (H1 - H0) / 2, S.d, S.ew || 4.2, 'Paredes', 56, 32),
      (i, p) => C.pared.clone().lerp(C.paredSombra, Math.max(suave(1.0, 0.3, p.y), patron(p) * 0.85)).lerp(C.piedra, suave(0.62, 0.42, p.y)));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      poner(tubo([V(sx * S.w * 0.876, 0.3, sz * S.d * 0.84), V(sx * S.w * 0.9, H1 * 0.55, sz * S.d * 0.865), V(sx * S.w * 0.876, H1 - 0.05, sz * S.d * 0.84)], 0.13, 0.12, 'Viga', 12, 12), () => C.madera);
    });
    poner(bola(0, H1 - 0.05, 0, S.w + 0.07, 0.08, S.d + 0.07, 6, 'VigaAlero', 40, 8), () => C.madera);

    // ---------------- Techo ----------------
    const YT = H1 - 0.05, ET = S.techo.e, TRX = S.techo.rx, TRY = S.techo.ry, TRZ = S.techo.rz;
    poner(bola(0, YT, 0, TRX, TRY, TRZ, ET, 'Techo', 64, 32, YT), (i, p) => {
      const c = C.techo.clone().lerp(C.techoAlto, suave(YT + 0.4, YT + TRY * 0.9, p.y));
      if (S.techoPatron === 'lunares') { const a = Math.atan2(p.z, p.x), h = (p.y - YT) / TRY; const u = (a * 3.2 + 10) % 1, v = (h * 4.5) % 1; if (Math.hypot(u - 0.5, v - 0.5) < 0.22 && h > 0.15) c.copy(C.lunar); }
      if (S.techoPatron === 'tejas' && ((p.y - YT) / 0.22) % 1 < 0.14) c.multiplyScalar(0.78);
      if (S.techoPatron === 'paja' && (Math.atan2(p.z, p.x) * 40 + 100) % 1 < 0.25) c.multiplyScalar(0.86);
      return c;
    });
    for (let k = 0; k < Math.round(28 * (TRX + TRZ) / 4.35); k++) {
      const nF = Math.round(28 * (TRX + TRZ) / 4.35), a = (k / nF) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      const d = Math.pow(Math.pow(Math.abs(cx), ET) + Math.pow(Math.abs(cz), ET), -1 / ET);
      poner(bola(cx * d * (TRX - 0.05), YT + 0.02, cz * d * (TRZ - 0.04), 0.24, 0.17, 0.24, 2, 'Feston', 14, 10), () => (k % 2 && C.alero2 ? C.alero2 : C.alero));
    }
    const yTecho = (z, x = 0) => YT + TRY * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) / TRZ, ET) - Math.pow(Math.abs(x) / TRX, ET)), 1 / ET);

    // ---------------- Puerta, escalones y ventanas ----------------
    const ZF = S.d + 0.01;
    poner(bola(0, 1.05, ZF, 0.62, 1.0, 0.1, 3.2, 'MarcoPuerta', 32, 20), () => C.marco);
    poner(bola(0, 1.0, ZF + 0.06, 0.48, 0.88, 0.07, 3.4, 'Puerta', 32, 20), (i, p) => (Math.abs(p.x) % 0.24 < 0.025 ? C.madera : C.puerta));
    poner(bola(0.3, 1.0, ZF + 0.14, 0.055, 0.055, 0.05, 2, 'Pomo', 12, 10), () => C.metal);
    poner(bola(0, 0.22, ZF + 0.42, 0.75, 0.12, 0.34, 4, 'Escalon', 24, 8), () => C.piedra);
    poner(bola(0, 0.1, ZF + 0.8, 0.9, 0.1, 0.36, 4, 'Escalon', 24, 8), () => C.piedraOsc);
    const YV = Math.min(1.45, H1 * 0.57);
    const ventanas = [[-S.w * 0.584, YV, ZF - 0.06, 0], [S.w * 0.584, YV, ZF - 0.06, 0], [S.w + 0.01, YV, 0, Math.PI / 2], [-S.w - 0.01, YV, 0, -Math.PI / 2]];
    ventanas.forEach(([x, y, z, rot], k) => {
      const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rot; g.add(grp);
      const add = (m, fn) => { grp.add(m); pintar.push([m, fn]); };
      add(bola(0, 0, 0.02, 0.36, 0.36, 0.05, 2, 'Vidrio', 24, 12), () => C.vidrio);
      add(anillo(0, 0, 0.06, 0.38, 0.07, 'MarcoVentana'), () => C.marcoVentana);
      add(bola(0, 0, 0.08, 0.035, 0.36, 0.03, 4, 'Cruceta', 8, 10), () => C.marcoVentana);
      add(bola(0, 0, 0.08, 0.36, 0.035, 0.03, 4, 'Cruceta', 10, 8), () => C.marcoVentana);
      
    });

    // ---------------- Detalles de la aldea ----------------
    // Cuernos de ceratópsido en los extremos de la cumbrera
    [-1, 1].forEach((s) => {
      const z = s * 1.35, yT = yTecho(z);
      [-1, 1].forEach((t) => poner(cono(V(t * 0.18, yT - 0.08, z), V(t * 0.45, 1, s * 0.35), 0.55, 0.11, 'Cuerno'), () => C.cuerno));
    });
    // Pararrayos de aguja dorada con rayo en zigzag
    {
      const y0 = yTecho(0) - 0.1;
      poner(tubo([V(0, y0, 0), V(0, y0 + 1.6, 0)], 0.06, 0.02, 'Pararrayos', 12, 10), () => C.metal);
      poner(bola(0, y0 + 0.55, 0, 0.12, 0.12, 0.12, 2, 'BolaPararrayos', 14, 10), () => C.metal);
      poner(tubo([V(0.05, y0 + 1.25, 0), V(0.28, y0 + 1.0, 0), V(0.12, y0 + 0.95, 0), V(0.34, y0 + 0.68, 0)], 0.035, 0.012, 'Rayo', 16, 8), () => C.metal);
    }
    // Chimenea grande con brasas y llamas
    poner(bola(-1.1, 3.7, -0.75, 0.38, 0.95, 0.38, 4, 'Chimenea', 20, 16), (i, p) => C.piedra.clone().lerp(C.pared, 0.3 * Math.abs(Math.sin(p.y * 8))));
    poner(bola(-1.1, 4.62, -0.75, 0.46, 0.1, 0.46, 4, 'BocaChimenea', 20, 8), () => C.piedraOsc);
    poner(bola(-1.1, 4.68, -0.75, 0.3, 0.05, 0.3, 2, 'Brasas', 16, 8), () => C.fuego);
    [[0, 0.5], [0.12, 0.34], [-0.12, 0.38], [0.05, 0.28]].forEach(([dx, h], k) => {
      poner(cono(V(-1.1 + dx, 4.66, -0.75 + (k % 2 ? 0.08 : -0.08)), V(0, 1, 0), h, 0.12 - k * 0.015, 'Llama'), (i, p) => C.fuego.clone().lerp(C.fuego2, suave(4.7 + h * 0.6, 4.7, p.y)));
    });
    // Farolillos de fuego junto a la puerta
    [-1, 1].forEach((s) => {
      const x = s * 0.82, y = 1.55, z = ZF + 0.12;
      poner(bola(x, y, z, 0.12, 0.17, 0.12, 4, 'Farol', 12, 10), () => C.hierro);
      poner(bola(x, y, z + 0.02, 0.08, 0.12, 0.08, 2.5, 'LuzFarol', 10, 8), () => C.fuego2);
      poner(cono(V(x, y + 0.17, z), V(0, 1, 0), 0.1, 0.07, 'TapaFarol'), () => C.hierro);
    });
    // Rayo dorado en la puerta
    poner(tubo([V(0.06, 1.55, ZF + 0.14), V(-0.12, 1.15, ZF + 0.14), V(0.1, 1.12, ZF + 0.14), V(-0.08, 0.7, ZF + 0.14)], 0.05, 0.02, 'RayoPuerta', 16, 8), () => C.metal);
    // Yunque delante de la casa
    {
      const x = 1.6, z = ZF + 0.9;
      poner(bola(x, 0.2, z, 0.18, 0.2, 0.14, 4, 'PieYunque', 12, 8), () => C.hierro);
      poner(bola(x, 0.45, z, 0.32, 0.08, 0.14, 4, 'Yunque', 16, 8), () => C.hierro);
      poner(cono(V(x + 0.3, 0.46, z), V(1, 0, 0), 0.22, 0.07, 'PicoYunque'), () => C.hierro);
    }

    pintar.forEach(([m, fn]) => M.pintar(m, fn, g));
    return g;
  },
});
