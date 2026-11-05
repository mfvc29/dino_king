/**
 * Casa Alta de la Forja — casa chibi para la Ciudad de la Forja (Fuego + Rayo).
 *   - Casa alta de ladrillo rojo oscuro con techo de pizarra y alero rojo y ámbar.
 *   - Dos chimeneas con fuego, letrero de yunque colgado y pararrayos dorado.
 * Base común con la Casa Dino: formas redondas chibi y colores planos a juego con los mini dinos.
 * Escala: 1 unidad = 1 metro. El frente mira hacia +z.
 */
registrarMalla({
  id: 'casa_ciudad_forja',
  categoria: 'casas',
  nombre: 'Casa Alta de la Forja',
  icono: '⚒️',
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
    const S = {"w": 1.6, "d": 1.45, "h": 3.3, "techo": {"rx": 2.05, "ry": 1.25, "rz": 1.9, "e": 3.4}, "patron": "ladrillo", "techoPatron": "tejas"};   // medidas: w, d (semiancho/semifondo de paredes), h (alto), techo {rx, ry, rz, e}, patron de pared
    const P = {"piedra": 3421242, "piedraOsc": 2236968, "madera": 9067060, "cremaMadera": 15255696, "marco": 2763312, "metal": 15381256, "vidrio": 16762992, "marcoVentana": 2763312, "hoja": 5943370, "valla": 16052196, "seta": 15221818, "lunar": 16777215, "fuego": 15680580, "fuego2": 16498468, "pared": 11028538, "paredSombra": 6957602, "puerta": 5913124, "techo": 3816008, "techoAlto": 5921386, "alero": 15680580, "alero2": 16096779};
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
    poner(bola(-0.8, yTecho(-0.5, -0.8) + 0.45, -0.5, 0.28, 0.75, 0.28, 3.4, 'Chimenea', 20, 16), (i, p) => C.piedra.clone().lerp(C.piedraOsc, 0.35 * Math.abs(Math.sin(p.y * 9))));
    poner(bola(-0.8, yTecho(-0.5, -0.8) + 1.2, -0.5, 0.36, 0.09, 0.36, 3.5, 'BocaChimenea', 20, 8), () => C.piedraOsc);
    [[0, 0.42], [0.1, 0.3], [-0.1, 0.32]].forEach(([dx, h], k) => poner(cono(V(-0.8 + dx, yTecho(-0.5, -0.8) + 1.25, -0.5 + (k % 2 ? 0.07 : -0.07)), V(0, 1, 0), h, 0.11, 'Llama'),
      (i, p) => C.fuego.clone().lerp(C.fuego2, suave(yTecho(-0.5, -0.8) + 1.3 + h * 0.6, yTecho(-0.5, -0.8) + 1.3, p.y))));

    poner(bola(0.9, yTecho(0.4, 0.9) + 0.45, 0.4, 0.28, 0.75, 0.28, 3.4, 'Chimenea', 20, 16), (i, p) => C.piedra.clone().lerp(C.piedraOsc, 0.35 * Math.abs(Math.sin(p.y * 9))));
    poner(bola(0.9, yTecho(0.4, 0.9) + 1.2, 0.4, 0.36, 0.09, 0.36, 3.5, 'BocaChimenea', 20, 8), () => C.piedraOsc);
    [[0, 0.42], [0.1, 0.3], [-0.1, 0.32]].forEach(([dx, h], k) => poner(cono(V(0.9 + dx, yTecho(0.4, 0.9) + 1.25, 0.4 + (k % 2 ? 0.07 : -0.07)), V(0, 1, 0), h, 0.11, 'Llama'),
      (i, p) => C.fuego.clone().lerp(C.fuego2, suave(yTecho(0.4, 0.9) + 1.3 + h * 0.6, yTecho(0.4, 0.9) + 1.3, p.y))));

    // Letrero colgado con un yunque dorado y pararrayos
    poner(tubo([V(0.95, 2.6, ZF), V(0.95, 2.6, ZF + 0.55)], 0.03, 0.03, 'Soporte', 6, 6), () => C.piedra);
    poner(bola(0.95, 2.3, ZF + 0.5, 0.32, 0.22, 0.03, 4, 'Letrero', 16, 10), () => C.madera);
    poner(bola(0.95, 2.32, ZF + 0.54, 0.16, 0.05, 0.02, 4, 'YunqueLetrero', 10, 6), () => C.metal);
    poner(bola(0.95, 2.22, ZF + 0.54, 0.06, 0.06, 0.02, 4, 'PieYunqueLetrero', 6, 6), () => C.metal);
    { const y0 = yTecho(0) - 0.1;
      poner(tubo([V(0, y0, 0), V(0, y0 + 1.3, 0)], 0.05, 0.02, 'Pararrayos', 10, 8), () => C.metal);
      poner(tubo([V(0.05, y0 + 1.05, 0), V(0.24, y0 + 0.85, 0), V(0.1, y0 + 0.8, 0), V(0.28, y0 + 0.58, 0)], 0.03, 0.01, 'Rayo', 16, 8), () => C.metal); }

    poner(bola(-2.0, 0.32, 1.1, 0.25, 0.32, 0.25, 2.3, 'Barril', 16, 12), (i, p) => (Math.abs(Math.abs(p.y - 0.32) - 0.17) < 0.035 ? new THREE.Color(0x4a4a50) : C.madera.clone().lerp(C.cremaMadera, 0.25 * Math.abs(Math.sin(Math.atan2(p.z - 1.1, p.x - -2.0) * 6)))));
    poner(bola(-2.0, 0.64, 1.1, 0.2, 0.02, 0.2, 2, 'TapaBarril', 14, 4), () => C.cremaMadera);

    poner(bola(-2.15, 0.32, 0.45, 0.25, 0.32, 0.25, 2.3, 'Barril', 16, 12), (i, p) => (Math.abs(Math.abs(p.y - 0.32) - 0.17) < 0.035 ? new THREE.Color(0x4a4a50) : C.madera.clone().lerp(C.cremaMadera, 0.25 * Math.abs(Math.sin(Math.atan2(p.z - 0.45, p.x - -2.15) * 6)))));
    poner(bola(-2.15, 0.64, 0.45, 0.2, 0.02, 0.2, 2, 'TapaBarril', 14, 4), () => C.cremaMadera);

    poner(tubo([V(1.3, 0, 2.7), V(1.3, 1.25, 2.7)], 0.05, 0.035, 'PosteFarola', 8, 8), fijo(0x3a3a42));
    poner(bola(1.3, 1.36, 2.7, 0.13, 0.15, 0.13, 3.5, 'Farola', 12, 10), fijo(0x3a3a42));
    poner(bola(1.3, 1.36, 2.7, 0.1, 0.12, 0.1, 2.4, 'LuzFarola', 12, 8), fijo(0xffa040));
    poner(cono(V(1.3, 1.5, 2.7), V(0, 1, 0), 0.14, 0.17, 'TapaFarola'), fijo(0x3a3a42));

    poner(bola(2.1, 0.1, 0.2, 0.2, 0.12, 0.17, 2.2, 'Roca', 12, 8), (i, p) => new THREE.Color(0x4a4a52).lerp(new THREE.Color(0xffffff), 0.25 * suave(0.05, 0.2, p.y)));

    poner(bola(2.3, 0.1, 0.55, 0.13, 0.078, 0.1105, 2.2, 'Roca', 12, 8), (i, p) => new THREE.Color(0x4a4a52).lerp(new THREE.Color(0xffffff), 0.25 * suave(0.05, 0.2, p.y)));

    for (let k = 0; k < 3; k++) poner(bola((k % 2 ? 0.16 : -0.14), 0.035, ZF + 1.35 + k * 0.48, 0.3 - k * 0.015, 0.045, 0.2, 2.6, 'PiedraCamino', 16, 6), () => C.piedra.clone().lerp(new THREE.Color(0xffffff), 0.12 * (k % 2)));

    pintar.forEach(([m, fn]) => M.pintar(m, fn, g));
    return g;
  },
});
