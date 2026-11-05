/**
 * Ayuntamiento de la Isla — casa chibi para la isla (edificio principal).
 *   - Edificio ancho de piedra crema con techo turquesa, columnas blancas en la entrada y reloj dorado.
 *   - Torre central con cúpula y bandera.
 * Base común con la Casa Dino: formas redondas chibi y colores planos a juego con los mini dinos.
 * Escala: 1 unidad = 1 metro. El frente mira hacia +z.
 */
registrarMalla({
  id: 'ayuntamiento_isla',
  categoria: 'casas',
  nombre: 'Ayuntamiento de la Isla',
  icono: '🏛️',
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
    const S = {"w": 2.8, "d": 1.9, "h": 3.0, "techo": {"rx": 3.25, "ry": 1.5, "rz": 2.35, "e": 3.0}, "patron": "piedra"};   // medidas: w, d (semiancho/semifondo de paredes), h (alto), techo {rx, ry, rz, e}, patron de pared
    const P = {"piedra": 9209726, "piedraOsc": 6446422, "madera": 9067060, "cremaMadera": 15255696, "marco": 9209726, "metal": 15909952, "vidrio": 12576498, "marcoVentana": 9067060, "hoja": 5943370, "valla": 16052196, "seta": 15221818, "lunar": 16777215, "fuego": 15680580, "fuego2": 16498468, "pared": 15919314, "paredSombra": 13812902, "puerta": 2787978, "techo": 2067082, "techoAlto": 5951688, "alero": 16777215, "alero2": 2792090, "columna": 16448244, "bandera": 15680580};
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
    // Columnas blancas a los lados de la puerta y frontis
    [-1.25, -0.8, 0.8, 1.25].forEach((x) => {
      poner(bola(x, 1.45, ZF + 0.3, 0.13, 1.25, 0.13, 2.2, 'Columna', 14, 16), () => C.columna);
      poner(bola(x, 0.25, ZF + 0.3, 0.2, 0.08, 0.2, 4, 'BaseColumna', 12, 6), () => C.columna);
      poner(bola(x, 2.72, ZF + 0.3, 0.2, 0.08, 0.2, 4, 'Capitel', 12, 6), () => C.columna);
    });
    poner(bola(0, 2.86, ZF + 0.25, 1.55, 0.12, 0.3, 4, 'Frontis', 32, 8), () => C.columna);
    // Reloj dorado sobre la puerta
    poner(bola(0, 2.35, ZF + 0.03, 0.3, 0.3, 0.05, 2, 'Esfera', 24, 12), fijo(0xfffaf0));
    poner(anillo(0, 2.35, ZF + 0.06, 0.32, 0.05, 'MarcoReloj'), () => C.metal);
    poner(tubo([V(0, 2.35, ZF + 0.09), V(0, 2.55, ZF + 0.09)], 0.02, 0.015, 'Aguja', 4, 6), fijo(0x2a2a2a));
    poner(tubo([V(0, 2.35, ZF + 0.09), V(0.14, 2.35, ZF + 0.09)], 0.02, 0.015, 'Aguja', 4, 6), fijo(0x2a2a2a));
    // Torre central con cúpula y bandera
    { const y0 = yTecho(0) - 0.4;
      poner(bola(0, y0 + 0.55, -0.2, 0.55, 0.75, 0.55, 3.2, 'Torre', 24, 16), (i, p) => C.pared.clone().lerp(C.paredSombra, 0.3 * Math.abs(Math.sin(p.y * 10))));
      poner(bola(0, y0 + 1.25, -0.2, 0.68, 0.55, 0.68, 2.2, 'Cupula', 24, 16, y0 + 1.25), (i, p) => C.techo.clone().lerp(C.techoAlto, suave(y0 + 1.3, y0 + 1.8, p.y)));
      poner(tubo([V(0, y0 + 1.75, -0.2), V(0, y0 + 2.55, -0.2)], 0.03, 0.025, 'Mastil', 8, 6), () => C.metal);
      poner(bola(0.28, y0 + 2.38, -0.2, 0.28, 0.16, 0.02, 3, 'Bandera', 16, 10), () => C.bandera);
      poner(bola(0, y0 + 1.1, 0.33, 0.18, 0.22, 0.04, 2.4, 'VentanaTorre', 14, 10), () => C.vidrio); }

    poner(bola(-2.0, 0.26, 2.3, 0.36, 0.28, 0.32, 2, 'Arbusto', 18, 12), (i, p) => C.hoja.clone().lerp(new THREE.Color(0x2e7a34), 0.4 * (1 - suave(0.05, 0.5, p.y))));
    [[0.15, 0.48, 0.12], [-0.17, 0.45, 0.05], [0.02, 0.52, -0.12], [-0.05, 0.4, 0.24], [0.24, 0.36, -0.08]].forEach(([dx, y, dz], k) => {
      poner(bola(-2.0 + dx, y, 2.3 + dz, 0.075, 0.05, 0.075, 2, 'Flor', 10, 6), fijo([0xef4444, 0xffffff, 0x5ad0c8][(k + 0) % 3]));
      poner(bola(-2.0 + dx, y + 0.03, 2.3 + dz, 0.03, 0.025, 0.03, 2, 'CentroFlor', 6, 4), fijo(0xffb020)); });

    poner(bola(2.0, 0.26, 2.3, 0.36, 0.28, 0.32, 2, 'Arbusto', 18, 12), (i, p) => C.hoja.clone().lerp(new THREE.Color(0x2e7a34), 0.4 * (1 - suave(0.05, 0.5, p.y))));
    [[0.15, 0.48, 0.12], [-0.17, 0.45, 0.05], [0.02, 0.52, -0.12], [-0.05, 0.4, 0.24], [0.24, 0.36, -0.08]].forEach(([dx, y, dz], k) => {
      poner(bola(2.0 + dx, y, 2.3 + dz, 0.075, 0.05, 0.075, 2, 'Flor', 10, 6), fijo([0xef4444, 0xffffff, 0x5ad0c8][(k + 1) % 3]));
      poner(bola(2.0 + dx, y + 0.03, 2.3 + dz, 0.03, 0.025, 0.03, 2, 'CentroFlor', 6, 4), fijo(0xffb020)); });

    poner(tubo([V(-1.25, 0, 3.1), V(-1.25, 1.25, 3.1)], 0.05, 0.035, 'PosteFarola', 8, 8), fijo(0x3a3a42));
    poner(bola(-1.25, 1.36, 3.1, 0.13, 0.15, 0.13, 3.5, 'Farola', 12, 10), fijo(0x3a3a42));
    poner(bola(-1.25, 1.36, 3.1, 0.1, 0.12, 0.1, 2.4, 'LuzFarola', 12, 8), fijo(0xffd060));
    poner(cono(V(-1.25, 1.5, 3.1), V(0, 1, 0), 0.14, 0.17, 'TapaFarola'), fijo(0x3a3a42));

    poner(tubo([V(1.25, 0, 3.1), V(1.25, 1.25, 3.1)], 0.05, 0.035, 'PosteFarola', 8, 8), fijo(0x3a3a42));
    poner(bola(1.25, 1.36, 3.1, 0.13, 0.15, 0.13, 3.5, 'Farola', 12, 10), fijo(0x3a3a42));
    poner(bola(1.25, 1.36, 3.1, 0.1, 0.12, 0.1, 2.4, 'LuzFarola', 12, 8), fijo(0xffd060));
    poner(cono(V(1.25, 1.5, 3.1), V(0, 1, 0), 0.14, 0.17, 'TapaFarola'), fijo(0x3a3a42));

    for (let k = 0; k < 4; k++) poner(bola((k % 2 ? 0.16 : -0.14), 0.035, ZF + 1.4 + k * 0.48, 0.3 - k * 0.015, 0.045, 0.2, 2.6, 'PiedraCamino', 16, 6), () => C.piedra.clone().lerp(new THREE.Color(0xffffff), 0.12 * (k % 2)));

    pintar.forEach(([m, fn]) => M.pintar(m, fn, g));
    return g;
  },
});
