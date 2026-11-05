/**
 * Farola Eléctrica Moderna — decoración chibi a juego con las casas y los mini dinos.
 *   - Farola moderna de acero con doble brazo curvo y lámparas redondas de luz cálida, aro rojo en la base y guía celeste.
 * Escala: 1 unidad = 1 metro. Pies sobre y = 0, el frente mira hacia +z.
 */
registrarMalla({
  id: 'farola_electrica',
  categoria: 'decoraciones',
  nombre: 'Farola Eléctrica Moderna',
  icono: '💡',
  origen: 'procedural/estilo_chibi',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    function bola(x, y, z, rx, ry, rz, e, nombre, segA = 24, segB = 16, corteY = null, topeY = null) {
      const sW = M.seg(segA, 8), sH = M.seg(segB, 6);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const pos = geo.attributes.position, ex = 2 / e;
      const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), ex);
      for (let i = 0; i < pos.count; i++) {
        let yy = y + f(pos.getY(i)) * ry;
        if (corteY !== null && yy < corteY) yy = corteY;
        if (topeY !== null && yy > topeY) yy = topeY;
        pos.setXYZ(i, x + f(pos.getX(i)) * rx, yy, z + f(pos.getZ(i)) * rz);
      }
      geo.computeVertexNormals();
      return M.pieza(geo, nombre, sW, sH);
    }
    // Gota de llama: base redonda y punta curvada hacia arriba
    function gota(x, y, z, r, h, nombre) {
      const sW = M.seg(18, 8), sH = M.seg(14, 6);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const yn = pos.getY(i), k = yn > 0 ? 1 - 0.8 * yn : 1;
        pos.setXYZ(i, x + pos.getX(i) * r * k + (yn > 0 ? 0.25 * r * yn * yn : 0), y + r * 0.9 + (yn > 0 ? yn * h : yn * r * 0.9), z + pos.getZ(i) * r * k);
      }
      geo.computeVertexNormals();
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
    function anillo(x, y, z, R, r, nombre, rotY = 0, rotX = Math.PI / 2) {
      const geo = new THREE.TorusGeometry(R, r, M.seg(10, 6), M.seg(36, 12));
      const m = M.pieza(geo, nombre, M.seg(36, 12), M.seg(10, 6));
      m.position.set(x, y, z); m.rotation.y = rotY; m.rotation.x = rotX;
      return m;
    }
    const pintar = [], animados = [], giros = [];
    const poner = (m, fn) => { g.add(m); pintar.push([m, fn]); return m; };
    const ponerEn = (grp, m, fn) => { grp.add(m); pintar.push([m, fn]); return m; };
    const fijo = (hex) => { const c = new THREE.Color(hex); return () => c; };
    const P = { madera: 0xb07a48, maderaOsc: 0x7a5232, crema: 0xf2dcae, piedra: 0x9a948a, piedraOsc: 0x5e5a56, basalto: 0x3a3640,
      hierro: 0x34343c, oro: 0xf2c440, acero: 0x4a4a5a, aceroClaro: 0x8a8aa0, cobre: 0xd4844a, cian: 0x67e8f9, rojo: 0xef4444, hoja: 0x5ab04a, hojaOsc: 0x2e7a34, tierra: 0x7a5234, lava: 0xff7a1a,
      fuego: 0xef4444, fuego2: 0xf97316, fuego3: 0xfde047, luz: 0xffe27a, luz2: 0xfff6c8 };
    const C = {}; Object.keys(P).forEach((k) => { C[k] = new THREE.Color(P[k]); });
    // Grupo animado (escala) colocado dentro de otro que fija posición y tamaño
    function animado(nombre, x, y, z, s = 1) {
      const o = new THREE.Group(); o.position.set(x, y, z); o.scale.setScalar(s);
      const a = new THREE.Group(); a.name = nombre; o.add(a); g.add(o); animados.push(nombre); return a;
    }
    // Grupo que gira sobre su eje vertical (anillos, chispas)
    function girando(nombre, x, y, z) {
      const a = new THREE.Group(); a.name = nombre; a.position.set(x, y, z); g.add(a); giros.push(nombre); return a;
    }
    function fuego(nombre, x, y, z, s = 1) {
      const a = animado(nombre, x, y, z, s);
      ponerEn(a, gota(0, 0, 0, 0.3, 0.45, 'FuegoExterior'), (i, p) => C.fuego.clone().lerp(C.fuego2, suave(y + 0.1 * s, y + 0.7 * s, p.y)));
      ponerEn(a, gota(0.02, 0.03, 0.1, 0.2, 0.32, 'FuegoMedio'), (i, p) => C.fuego2.clone().lerp(C.fuego3, suave(y + 0.1 * s, y + 0.55 * s, p.y)));
      ponerEn(a, gota(0.03, 0.05, 0.19, 0.11, 0.18, 'FuegoInterior'), () => C.fuego3);
      return a;
    }
    const lava = (base) => (i, p) => (Math.abs(Math.sin(p.x * 11 + p.z * 7) * Math.sin(p.y * 15 + p.x * 3)) > 0.93 ? C.lava : base.clone().lerp(C.piedra, 0.15 * suave(0, 0.5, p.y)));
    function flor(x, y, z, col, s = 1, tallo = true) {
      if (tallo) poner(tubo([V(x, Math.max(0, y - 0.45 * s), z), V(x + 0.02, y - 0.02, z)], 0.02 * s, 0.018 * s, 'Tallo', 6, 6), () => C.hojaOsc);
      for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5;
        poner(bola(x + Math.cos(a) * 0.075 * s, y, z + Math.sin(a) * 0.075 * s, 0.065 * s, 0.03 * s, 0.065 * s, 2, 'Petalo', 10, 6), fijo(col)); }
      poner(bola(x, y + 0.02 * s, z, 0.05 * s, 0.04 * s, 0.05 * s, 2, 'CentroFlor', 10, 6), fijo(0xffb020));
    }
    function pasto(x, z, s = 1) {
      [[0, 0.1, 0], [0.09, 0.07, 0.05], [-0.08, 0.08, -0.03]].forEach(([dx, h, dz]) =>
        poner(bola(x + dx * s, h * s * 0.6, z + dz * s, 0.09 * s, h * s, 0.09 * s, 2, 'Pasto', 10, 8), (i, p) => C.hoja.clone().lerp(C.hojaOsc, 0.5 * suave(0.12 * s, 0, p.y))));
    }
    // Tramo de valla de tablas redondeadas entre a y b (el frente mira a la normal izquierda de a→b)
    function tramo(a, b, n) {
      const d = b.clone().sub(a), L = d.length(), ang = -Math.atan2(d.z, d.x), nrm = V(-d.z, 0, d.x).normalize();
      const en = (t, y) => a.clone().addScaledVector(d, t).setY(y);
      for (let k = 0; k < n; k++) {
        const p = en((k + 0.5) / n, 0), h = k % 2 ? 1.0 : 0.92;
        const m = bola(0, h / 2, 0, Math.min(0.12, (L / n) * 0.36), h / 2, 0.045, 3, 'Tabla', 12, 12); m.position.copy(p); m.rotation.y = ang;
        poner(m, (i, q) => C.madera.clone().lerp(C.maderaOsc, 0.4 * suave(0.35, 0, q.y)).lerp(C.crema, 0.35 * suave(h - 0.16, h, q.y)));
        [0.32, 0.72].forEach((y) => poner(bola(p.x + nrm.x * 0.05, y, p.z + nrm.z * 0.05, 0.025, 0.025, 0.025, 2, 'Clavo', 6, 4), () => C.hierro));
      }
      [0.32, 0.72].forEach((y) => poner(tubo([en(0, y).addScaledVector(nrm, -0.06), en(1, y).addScaledVector(nrm, -0.06)], 0.045, 0.045, 'Travesano', 12, 8), () => C.maderaOsc));
    }
    function poste(x, z, h = 1.15, r = 0.12) {
      poner(bola(x, h / 2, z, r, h / 2, r, 3, 'Poste', 14, 12), (i, p) => C.maderaOsc.clone().lerp(C.madera, 0.5 * suave(0, h, p.y)));
      poner(bola(x, h + 0.03, z, r + 0.03, 0.09, r + 0.03, 2, 'Remate', 14, 8), () => C.crema);
    }

    poner(bola(0, 0.1, 0, 0.28, 0.1, 0.28, 3, 'Base', 16, 6), () => C.acero);
    poner(anillo(0, 0.22, 0, 0.2, 0.04, 'AroRojo'), () => C.rojo);
    poner(tubo([V(0, 0.2, 0), V(0, 2.8, 0)], 0.085, 0.06, 'Poste', 16, 10), (i, p) => (Math.abs(p.y - 1.4) < 0.05 ? C.cian : C.acero));
    [-1, 1].forEach((s) => {
      poner(tubo([V(0, 2.6, 0), V(s * 0.3, 3.0, 0), V(s * 0.65, 3.05, 0), V(s * 0.82, 2.92, 0)], 0.045, 0.04, 'Brazo', 16, 8), () => C.acero);
      poner(bola(s * 0.82, 2.9, 0, 0.2, 0.08, 0.2, 2.2, 'Pantalla', 16, 6), () => C.aceroClaro);
      const l = animado(s < 0 ? 'LuzIzq' : 'LuzDer', s * 0.82, 2.76, 0);
      ponerEn(l, bola(0, 0, 0, 0.15, 0.14, 0.15, 2, 'Lampara', 14, 10), (i, p) => C.luz2.clone().lerp(C.luz, suave(2.8, 2.66, p.y)));
    });
    poner(bola(0, 3.0, 0, 0.1, 0.1, 0.1, 2, 'Remate', 10, 8), () => C.oro);

    pintar.forEach(([m, fn]) => M.pintar(m, fn, g));
    if (animados.length || giros.length) {
      const giro = (n, dur, k) => { const t = [0, 1, 2, 3].map((f) => (f / 3) * dur), sg = k % 2 ? -1 : 1;
        return new THREE.QuaternionKeyframeTrack(n + '.quaternion', t, [0, 1, 2, 3].flatMap((f) => { const a = sg * f * Math.PI * 2 / 3 / 2; return [0, Math.sin(a), 0, Math.cos(a)]; })); };
      const clip = (nombre, dur, amp) => new THREE.AnimationClip(nombre, dur, giros.map((n, k) => giro(n, dur * 2, k)).concat(animados.map((n, k) => {
        const o = (k % 3) * 0.3 * amp;
        const v = [[1, 1, 1], [1 - amp * 0.3, 1 + amp + o, 1 - amp * 0.3], [1 + amp * 0.4, 1 - amp * 0.5, 1 + amp * 0.4], [1 - amp * 0.2, 1 + amp * 0.7 - o, 1 - amp * 0.2], [1, 1, 1]];
        return new THREE.VectorKeyframeTrack(n + '.scale', [0, 0.25, 0.5, 0.75, 1].map((f) => f * dur), v.flat());
      })));
      g.animations = [clip('Reposo', 1.6, 0.05), clip('Luz Electrica', 0.8, 0.13)];
    }
    return g;
  },
});
