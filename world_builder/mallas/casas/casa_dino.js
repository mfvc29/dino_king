/**
 * Casa Dino — casita chibi redondeada a juego con los mini dinos (estilo liso de colores planos y alegres).
 *
 *   - Paredes crema abombadas sobre zócalo de piedra, vigas de madera redondeadas en las esquinas.
 *   - Techo redondeado tipo "pan" color terracota con alero festoneado.
 *   - Placas de estegosaurio turquesa a lo largo de la cumbrera (guiño a los dinos del juego).
 *   - Puerta en arco de madera con marco de piedra y pomo dorado, ventanas redondas con cruceta y jardineras con flores.
 *   - Chimenea de piedra con boca oscura, escalones y huellas de dino como camino de entrada.
 * Escala: 1 unidad = 1 metro (unos 5 m de alto). El frente mira hacia +z.
 */
registrarMalla({
  id: 'casa_dino',
  categoria: 'casas',
  nombre: 'Casa Dino',
  icono: '🏡',
  origen: 'procedural/estilo_chibi',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

    // Superelipsoide: e = 2 esfera, e mayor = más cuadrado. corteY recorta por debajo (aplana la base).
    function bola(x, y, z, rx, ry, rz, e, nombre, segA = 32, segB = 20, corteY = null) {
      const sW = M.seg(segA, 10), sH = M.seg(segB, 8);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const pos = geo.attributes.position;
      const ex = 2 / e;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), ex);
        let yy = y + f(py) * ry;
        if (corteY !== null && yy < corteY) yy = corteY;
        pos.setXYZ(i, x + f(px) * rx, yy, z + f(pz) * rz);
      }
      return M.pieza(geo, nombre, sW, sH);
    }
    function tubo(puntos, r0, r1, nombre, segL = 16, segR = 12) {
      return M.tubo(puntos, r0, r1, { segLargo: segL, segRadio: segR, nombre });
    }
    function anillo(x, y, z, R, r, nombre, rotY = 0) {
      const geo = new THREE.TorusGeometry(R, r, M.seg(12, 6), M.seg(36, 12));
      const m = M.pieza(geo, nombre, M.seg(36, 12), M.seg(12, 6));
      m.position.set(x, y, z); m.rotation.y = rotY;
      return m;
    }
    const pintar = [];
    const poner = (m, fn) => { g.add(m); pintar.push([m, fn]); return m; };
    const fijo = (hex) => { const c = new THREE.Color(hex); return () => c; };

    // Paleta (a juego con los mini dinos: colores planos, cálidos y saturados)
    const C = {
      crema: new THREE.Color(0xf4e8cc), cremaSombra: new THREE.Color(0xe2cfa8),
      piedra: new THREE.Color(0x8c877e), piedraOsc: new THREE.Color(0x625d56),
      techo: new THREE.Color(0xe0683c), techoAlto: new THREE.Color(0xf08a52), alero: new THREE.Color(0xb84a2a),
      madera: new THREE.Color(0x8a5a34), maderaClara: new THREE.Color(0xb07a48),
      placa: new THREE.Color(0x3aa89a), placaBorde: new THREE.Color(0x8ee0cc),
      vidrio: new THREE.Color(0xbfe6f2), oro: new THREE.Color(0xf2c440),
      hierba: new THREE.Color(0x6abf4a),
    };

    // ---------------- Zócalo y paredes ----------------
    poner(bola(0, 0.12, 0, 2.15, 0.16, 1.85, 5, 'Zocalo', 40, 10), (i, p) => C.piedra.clone().lerp(C.piedraOsc, suave(0.2, 0.0, p.y)));
    const H0 = 0.25, H1 = 2.55;
    poner(bola(0, (H0 + H1) / 2, 0, 1.85, (H1 - H0) / 2, 1.55, 4.2, 'Paredes', 48, 24),
      (i, p) => C.crema.clone().lerp(C.cremaSombra, suave(1.0, 0.3, p.y)).lerp(C.piedra, suave(0.62, 0.42, p.y)));
    // Vigas de madera redondeadas en las esquinas
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      poner(tubo([V(sx * 1.62, 0.3, sz * 1.3), V(sx * 1.66, 1.4, sz * 1.34), V(sx * 1.62, 2.5, sz * 1.3)], 0.13, 0.12, 'Viga', 12, 12), fijo(0x8a5a34));
    });
    // Viga horizontal bajo el alero
    poner(bola(0, 2.5, 0, 1.92, 0.08, 1.62, 6, 'VigaAlero', 40, 8), () => C.madera);

    // ---------------- Techo redondeado tipo pan ----------------
    const YT = 2.5;
    poner(bola(0, YT, 0, 2.35, 1.75, 2.0, 2.6, 'Techo', 56, 28, YT),
      (i, p) => C.techo.clone().lerp(C.techoAlto, suave(YT + 0.4, YT + 1.6, p.y)));
    // Alero festoneado: bultos redondos alrededor del borde
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const cx = Math.cos(a), cz = Math.sin(a);
      const d = Math.pow(Math.pow(Math.abs(cx), 2.6 / 2 * 2) + Math.pow(Math.abs(cz), 2.6), -1 / 2.6);
      poner(bola(cx * d * 2.3, YT + 0.02, cz * d * 1.96, 0.24, 0.17, 0.24, 2, 'Feston', 14, 10), () => C.alero);
    }
    // Placas de estegosaurio en la cumbrera (eje z), alternadas
    for (let k = 0; k < 5; k++) {
      const z = -1.2 + k * 0.6;
      const h = 0.55 + 0.25 * Math.sin(Math.PI * (k + 0.5) / 5);
      const pl = bola(0, 0, 0, 0.09, h * 0.55, 0.32, 2.4, 'PlacaTecho', 18, 16);
      const yTop = YT + 1.75 * Math.pow(1 - Math.pow(Math.abs(z) / 2.0, 2.6), 1 / 2.6);
      pl.position.set((k % 2 ? 0.08 : -0.08), yTop + h * 0.35, z);
      pl.rotation.z = (k % 2 ? -0.12 : 0.12);
      poner(pl, (i, p) => C.placa.clone().lerp(C.placaBorde, suave(yTop + h * 0.35, yTop + h * 0.85, p.y)));
    }

    // ---------------- Puerta en arco ----------------
    const ZF = 1.56;
    const marco = bola(0, 1.05, ZF, 0.62, 1.0, 0.1, 3.2, 'MarcoPuerta', 32, 20);
    poner(marco, () => C.piedra);
    poner(bola(0, 1.0, ZF + 0.06, 0.48, 0.88, 0.07, 3.4, 'Puerta', 32, 20),
      (i, p) => (Math.abs(p.x) % 0.24 < 0.025 ? C.madera : C.maderaClara));
    poner(bola(0.3, 1.0, ZF + 0.14, 0.055, 0.055, 0.05, 2, 'Pomo', 12, 10), () => C.oro);
    // Escalones redondeados
    poner(bola(0, 0.22, ZF + 0.42, 0.75, 0.12, 0.34, 4, 'Escalon', 24, 8), () => C.piedra);
    poner(bola(0, 0.1, ZF + 0.8, 0.9, 0.1, 0.36, 4, 'Escalon', 24, 8), () => C.piedraOsc);

    // ---------------- Ventanas redondas con jardinera ----------------
    const ventanas = [[-1.08, 1.45, ZF - 0.06, 0], [1.08, 1.45, ZF - 0.06, 0], [1.86, 1.45, 0, Math.PI / 2], [-1.86, 1.45, 0, -Math.PI / 2]];
    ventanas.forEach(([x, y, z, rot], k) => {
      const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rot;
      g.add(grp);
      const vid = bola(0, 0, 0.02, 0.36, 0.36, 0.05, 2, 'Vidrio', 24, 12); grp.add(vid); pintar.push([vid, () => C.vidrio]);
      const ar = anillo(0, 0, 0.06, 0.38, 0.07, 'MarcoVentana'); grp.add(ar); pintar.push([ar, () => C.madera]);
      const cx = bola(0, 0, 0.08, 0.035, 0.36, 0.03, 4, 'Cruceta', 8, 10); grp.add(cx); pintar.push([cx, () => C.madera]);
      const cy = bola(0, 0, 0.08, 0.36, 0.035, 0.03, 4, 'Cruceta', 10, 8); grp.add(cy); pintar.push([cy, () => C.madera]);
      const jar = bola(0, -0.5, 0.16, 0.48, 0.1, 0.13, 5, 'Jardinera', 20, 8); grp.add(jar); pintar.push([jar, () => C.maderaClara]);
      const flores = [0xf06aa0, 0xf2c440, 0xffffff, 0xe85a4a, 0xa070e0];
      for (let f = 0; f < 6; f++) {
        const fx = -0.36 + f * 0.144;
        const tallo = bola(fx, -0.37, 0.16, 0.06, 0.06, 0.06, 2, 'Hojas', 10, 8); grp.add(tallo); pintar.push([tallo, () => C.hierba]);
        const fl = bola(fx, -0.3, 0.18, 0.05, 0.05, 0.05, 2, 'Flor', 10, 8); grp.add(fl); pintar.push([fl, fijo(flores[(f + k) % flores.length])]);
      }
    });

    // ---------------- Chimenea de piedra ----------------
    poner(bola(-1.1, 3.6, -0.75, 0.3, 0.85, 0.3, 3.2, 'Chimenea', 20, 16),
      (i, p) => C.piedra.clone().lerp(C.piedraOsc, 0.35 * Math.abs(Math.sin(p.y * 9))));
    poner(bola(-1.1, 4.45, -0.75, 0.38, 0.1, 0.38, 3.5, 'BocaChimenea', 20, 8), () => C.piedraOsc);
    poner(bola(-1.1, 4.52, -0.75, 0.22, 0.04, 0.22, 2, 'Hollin', 14, 6), fijo(0x2a2622));

    // ---------------- Camino de huellas de dino ----------------
    for (let k = 0; k < 4; k++) {
      const s = k % 2 ? 1 : -1;
      const x = s * 0.32, z = ZF + 1.35 + k * 0.62;
      poner(bola(x, 0.02, z, 0.2, 0.03, 0.25, 3, 'Huella', 16, 6), () => C.piedra);
      [-1, 0, 1].forEach((d) => poner(bola(x + d * 0.13, 0.025, z - 0.3 + Math.abs(d) * 0.06, 0.06, 0.025, 0.09, 2.5, 'Dedo', 10, 6), () => C.piedra));
    }

    pintar.forEach(([m, fn]) => M.pintar(m, fn, g));
    return g;
  },
});
