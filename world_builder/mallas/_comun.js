/**
 * Biblioteca de mallas — utilidades compartidas (window.MallasComun).
 *
 * Todas las mallas siguen el estilo del estudio: arcilla (clay) + wireframe de quads
 * limpio, construidas por código igual que el "Pino Cónico en Capas" de app.js.
 * Escala: 1 unidad = 1 metro.
 *
 * Depende de app.js: createClayMesh() y state.subdivisionMultiplier.
 */
(function () {
  const M = {};

  // Aleatorio con semilla: la misma malla sale idéntica cada vez que se construye
  M.azar = function (semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Número de segmentos según el deslizador "Densidad de Polígonos"
  M.seg = function (n, min = 3) {
    const mult = (typeof state !== 'undefined' && state.subdivisionMultiplier) || 1;
    return Math.max(min, Math.round(n * mult));
  };

  M.v3 = (p) => (p && p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]));
  M.curva = (puntos) => new THREE.CatmullRomCurve3(puntos.map(M.v3));

  // Punto de una curva cuya altura (y) es la más cercana a la pedida
  M.puntoEnAltura = function (curva, y) {
    let mejor = null;
    let dMin = Infinity;
    for (let i = 0; i <= 80; i++) {
      const p = curva.getPointAt(i / 80);
      const d = Math.abs(p.y - y);
      if (d < dMin) { dMin = d; mejor = p; }
    }
    return mejor;
  };

  // Pieza de arcilla con wireframe de quads (cols × rows = rejilla de vértices)
  M.pieza = function (geo, nombre, cols, rows) {
    const malla = createClayMesh(geo, nombre, cols, rows);
    malla.userData.rejilla = { cols, rows };
    return malla;
  };

  /**
   * Tubo cónico a lo largo de una curva: troncos, ramas y raíces.
   * r0 = radio al inicio, r1 = radio al final.
   * opts.ensanche → ensancha la base (pie del tronco); opts.ruido(t, ang) → multiplica el radio (corteza nudosa).
   */
  M.tubo = function (puntos, r0, r1, opts = {}) {
    const curva = M.curva(puntos);
    const tSeg = M.seg(opts.segLargo || 10, 3);
    const rSeg = M.seg(opts.segRadio || 8, 5);
    const geo = new THREE.TubeGeometry(curva, tSeg, 1, rSeg, false);
    const pos = geo.attributes.position;
    const P = new THREE.Vector3();
    const potencia = opts.curvaRadio || 1;

    for (let i = 0; i <= tSeg; i++) {
      const t = i / tSeg;
      curva.getPointAt(t, P);
      let r = r0 + (r1 - r0) * Math.pow(t, potencia);
      if (opts.ensanche && t < 0.22) r *= 1 + Math.pow(1 - t / 0.22, 2) * opts.ensanche;
      for (let j = 0; j <= rSeg; j++) {
        const k = i * (rSeg + 1) + j;
        const f = opts.ruido ? opts.ruido(t, (j / rSeg) * Math.PI * 2) : 1;
        pos.setXYZ(k,
          P.x + (pos.getX(k) - P.x) * r * f,
          P.y + (pos.getY(k) - P.y) * r * f,
          P.z + (pos.getZ(k) - P.z) * r * f);
      }
    }
    return M.pieza(geo, opts.nombre || 'Rama', rSeg, tSeg);
  };

  /**
   * Copa / mata de follaje: esfera con lóbulos suaves (nube de hojas).
   * opts: rx, ry, rz (radios), lobulos, amp (relieve), base (aplasta la mitad inferior),
   *       estrechar (afina la parte superior, forma de huevo), semilla.
   */
  M.copa = function (x, y, z, opts = {}) {
    const rnd = M.azar(opts.semilla || 1);
    const sW = M.seg(opts.segW || 16, 8);
    const sH = M.seg(opts.segH || 10, 6);
    const geo = new THREE.SphereGeometry(1, sW, sH);
    const pos = geo.attributes.position;
    const lob = opts.lobulos || 5;
    const amp = opts.amp !== undefined ? opts.amp : 0.14;
    const f1 = rnd() * Math.PI * 2;
    const f2 = rnd() * Math.PI * 2;

    for (let i = 0; i < pos.count; i++) {
      let vx = pos.getX(i);
      let vy = pos.getY(i);
      let vz = pos.getZ(i);
      const ang = Math.atan2(vz, vx);
      const lat = Math.asin(Math.max(-1, Math.min(1, vy)));
      const bulto = 1
        + amp * Math.sin(ang * lob + f1) * Math.cos(lat * 2)
        + amp * 0.6 * Math.sin(ang * (lob + 2) + lat * 3 + f2);
      const afinar = 1 - (opts.estrechar || 0) * Math.max(0, vy);
      vx *= bulto * afinar;
      vz *= bulto * afinar;
      if (vy < 0) vy *= (opts.base !== undefined ? opts.base : 0.55);
      pos.setXYZ(i,
        x + vx * (opts.rx || 1),
        y + vy * (opts.ry || 0.7),
        z + vz * (opts.rz || opts.rx || 1));
    }
    return M.pieza(geo, opts.nombre || 'Follaje', sW, sH);
  };

  /**
   * Roca tallada: esfera recortada por planos → caras planas y aristas como en las ilustraciones.
   * opts: ancho, alto, fondo (metros), cortes (nº de planos), dureza (0.55 muy angulosa … 0.9 casi redonda),
   *       inclinacion (rad, eje Z), giro (rad, eje Y), semilla.
   * Queda apoyada en el suelo (y = 0) en la posición (x, z).
   */
  M.roca = function (x, z, opts = {}) {
    const rnd = M.azar(opts.semilla || 7);
    const sW = M.seg(opts.segW || 18, 8);
    const sH = M.seg(opts.segH || 12, 6);
    const geo = new THREE.SphereGeometry(1, sW, sH);
    const pos = geo.attributes.position;

    const planos = [];
    const n = opts.cortes !== undefined ? opts.cortes : 9;
    const dureza = opts.dureza !== undefined ? opts.dureza : 0.68;
    for (let k = 0; k < n; k++) {
      const th = rnd() * Math.PI * 2;
      const el = rnd() * 1.35 - 0.3; // más cortes laterales y superiores que inferiores
      const nrm = new THREE.Vector3(Math.cos(th) * Math.cos(el), Math.sin(el), Math.sin(th) * Math.cos(el));
      planos.push([nrm, dureza + rnd() * 0.18]);
    }

    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      for (const [nrm, d] of planos) {
        const s = v.dot(nrm);
        if (s > d) v.addScaledVector(nrm, d - s);
      }
      if (v.y < -0.6) v.y = -0.6; // base plana para asentarse
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    geo.scale(
      (opts.ancho || 1) / (bb.max.x - bb.min.x),
      (opts.alto || 1) / (bb.max.y - bb.min.y),
      (opts.fondo || opts.ancho || 1) / (bb.max.z - bb.min.z));
    if (opts.inclinacion) geo.rotateZ(opts.inclinacion);
    if (opts.giro) geo.rotateY(opts.giro);
    geo.computeBoundingBox();
    geo.translate(x, -geo.boundingBox.min.y - 0.03, z);

    // Sombreado facetado: así se ven las caras planas talladas (con sombreado suave parecería un huevo)
    const malla = M.pieza(geo, opts.nombre || 'Roca', sW, sH);
    malla.material = M.materialFacetado();
    applyRenderStyleToMesh(malla);
    return malla;
  };

  // Misma arcilla del estudio pero con caras planas (rocas)
  M.materialFacetado = function () {
    if (!M._facetado) {
      M._facetado = clayMaterial.clone();
      M._facetado.flatShading = true;
    }
    return M._facetado;
  };

  // Piedrecitas sueltas: lista de [x, z, tamaño]
  M.guijarros = function (grupo, lista, semilla = 90) {
    lista.forEach(([x, z, t], i) => {
      grupo.add(M.roca(x, z, {
        ancho: t * 1.25, alto: t * 0.75, fondo: t, cortes: 5, dureza: 0.62,
        giro: i * 1.7, segW: 8, segH: 6, semilla: semilla + i, nombre: `Guijarro_${i + 1}`
      }));
    });
  };

  /**
   * Cilindro tumbado a lo largo del eje X (centrado en el origen): troncos caídos.
   * opts.perfil(ang, u) → multiplica el radio (estrías de corteza); u = 0 en x = -largo/2, 1 en x = +largo/2.
   * opts.astillado → largo (m) de las astillas en el extremo +X (tronco partido).
   */
  M.cilindroTumbado = function (radio, largo, opts = {}) {
    const rSeg = M.seg(opts.segRadio || 18, 8);
    const lSeg = M.seg(opts.segLargo || 10, 3);
    const geo = new THREE.CylinderGeometry(1, 1, largo, rSeg, lSeg, true);
    geo.rotateZ(-Math.PI / 2);
    const pos = geo.attributes.position;
    const perfil = opts.perfil || (() => 1);
    const rnd = M.azar(opts.semilla || 9);
    const astillas = [];
    for (let j = 0; j < rSeg; j++) astillas.push((j % 2 ? 0.3 : 1) * (0.25 + rnd() * 0.75));
    astillas.push(astillas[0]);

    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const ang = Math.atan2(pos.getZ(k), pos.getY(k));
      const u = (x + largo / 2) / largo;
      let r = radio * perfil(ang, u);
      let nx = x;
      if (opts.astillado) {
        const peso = u > 1 - 1e-4 ? 1 : (u > 1 - 1 / lSeg - 1e-4 ? 0.3 : 0);
        if (peso) {
          const s = astillas[k % (rSeg + 1)];
          nx += s * opts.astillado * peso;
          r *= 1 - 0.5 * s * peso;
        }
      }
      pos.setXYZ(k, nx, Math.cos(ang) * r, Math.sin(ang) * r);
    }
    return M.pieza(geo, opts.nombre || 'Tronco', rSeg, lSeg);
  };

  /**
   * Tapa de anillos concéntricos (corte de tronco) en el plano YZ, en x = xPos.
   * rIn → radio del hueco central, rOut → radio exterior. opts.perfil y opts.u igual que en cilindroTumbado.
   */
  M.anillos = function (rIn, rOut, xPos, opts = {}) {
    const tSeg = M.seg(opts.segRadio || 18, 8);
    const pSeg = opts.anillos || 4;
    const geo = new THREE.RingGeometry(rIn / rOut, 1, tSeg, pSeg);
    geo.rotateY(Math.PI / 2);
    const pos = geo.attributes.position;
    const perfil = opts.perfil || (() => 1);
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      const z = pos.getZ(k);
      const rho = Math.sqrt(y * y + z * z);
      const ang = Math.atan2(z, y);
      const r = rho * rOut * perfil(ang, opts.u || 0);
      pos.setXYZ(k, xPos, Math.cos(ang) * r, Math.sin(ang) * r);
    }
    return M.pieza(geo, opts.nombre || 'AnillosTronco', tSeg, pSeg);
  };

  /**
   * Quita caras de una pieza (huecos, aberturas) y rehace su wireframe de quads sin cruzar el hueco.
   * quitar(centroDeLaCara: Vector3) → true para eliminar esa cara. Sirve para cilindros, tubos, anillos y planos.
   */
  M.recortar = function (malla, quitar) {
    const { cols, rows } = malla.userData.rejilla;
    const geo = malla.geometry;
    const pos = geo.attributes.position;
    const stride = cols + 1;
    const vivas = new Uint8Array(cols * rows);
    const idx = [];
    const centro = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * stride + c;
        const b = a + stride;
        const d = a + 1;
        const e = b + 1;
        centro.set(0, 0, 0);
        [a, b, d, e].forEach((k) => centro.add(tmp.fromBufferAttribute(pos, k)));
        centro.multiplyScalar(0.25);
        if (quitar(centro)) continue;
        vivas[r * cols + c] = 1;
        idx.push(a, b, d, b, e, d);
      }
    }
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const viva = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && vivas[r * cols + c] === 1;
    const lineas = [];
    const linea = (k1, k2) => lineas.push(
      pos.getX(k1), pos.getY(k1), pos.getZ(k1), pos.getX(k2), pos.getY(k2), pos.getZ(k2));
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const k = r * stride + c;
        if (c < cols && (viva(c, r - 1) || viva(c, r))) linea(k, k + 1);
        if (r < rows && (viva(c - 1, r) || viva(c, r))) linea(k, k + stride);
      }
    }
    const alambre = malla.getObjectByName('wireOverlay');
    alambre.geometry.dispose();
    alambre.geometry = new THREE.BufferGeometry();
    alambre.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lineas, 3));
    return malla;
  };

  /**
   * Hoja de hierba: tira afilada y doblada hacia afuera, con pliegue central en V.
   * (bx, bz) base, azimut = dirección hacia la que se curva, inclinacion 0 (recta) … 1 (muy arqueada).
   */
  M.hoja = function (bx, bz, azimut, alto, ancho, inclinacion, nombre) {
    const filas = M.seg(6, 4);
    const geo = new THREE.PlaneGeometry(ancho, 1, 1, filas);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) + 0.5; // 0 = base, 1 = punta
      const w = pos.getX(i) * Math.pow(1 - t, 0.6);
      const yy = alto * t * (1 - 0.35 * inclinacion * t * t);
      const zz = alto * inclinacion * t * t * 0.7 - Math.abs(w) * 0.6;
      pos.setXYZ(i, w, yy, zz);
    }
    geo.rotateY(azimut);
    geo.translate(bx, 0, bz);
    return M.pieza(geo, nombre || 'Hoja', 1, filas);
  };

  // Valor suavizado de una tabla [[t, valor], ...] (perfiles de grosor de brazos, piernas…)
  M.interp = function (tabla, t) {
    if (t <= tabla[0][0]) return tabla[0][1];
    for (let i = 1; i < tabla.length; i++) {
      if (t <= tabla[i][0]) {
        const [t0, v0] = tabla[i - 1];
        const [t1, v1] = tabla[i];
        const k = (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * (k * k * (3 - 2 * k));
      }
    }
    return tabla[tabla.length - 1][1];
  };

  /**
   * Loft: une secciones elípticas horizontales con curvas suaves → torsos, ropa, botas, cuellos.
   * secciones (de abajo hacia arriba): [[y, rx, rz, cx = 0, cz = 0], ...]. Radio ~0 en un extremo = extremo cerrado.
   * El frente es +Z; la costura queda atrás.
   */
  M.loft = function (secciones, opts = {}) {
    const cols = M.seg(opts.segRadio || 20, 8);
    const sub = M.seg(opts.subdiv || 3, 1);
    const S = secciones.map((s) => [s[0], s[1], s[2], s[3] || 0, s[4] || 0]);
    const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t
      + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

    const filas = [];
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[Math.max(0, i - 1)];
      const b = S[i];
      const c = S[i + 1];
      const d = S[Math.min(S.length - 1, i + 2)];
      for (let k = 0; k < sub; k++) {
        const t = k / sub;
        filas.push([0, 1, 2, 3, 4].map((j) => cr(a[j], b[j], c[j], d[j], t)));
      }
    }
    filas.push(S[S.length - 1]);
    filas.reverse(); // de arriba hacia abajo, como CylinderGeometry (mismo sentido de caras)

    const pos = [];
    filas.forEach(([y, rx, rz, cx, cz]) => {
      for (let c = 0; c <= cols; c++) {
        const th = Math.PI + (c / cols) * Math.PI * 2;
        pos.push(cx + Math.max(0, rx) * Math.sin(th), y, cz + Math.max(0, rz) * Math.cos(th));
      }
    });
    const rows = filas.length - 1;
    const idx = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + cols + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    return M.pieza(geo, opts.nombre || 'Loft', cols, rows);
  };

  // Aro (toro) horizontal: cinturones, correas, gargantillas. rx/rz permiten aros ovalados.
  M.aro = function (cx, y, cz, rx, rz, grosor, nombre) {
    const tub = M.seg(24, 12);
    const rad = M.seg(6, 4);
    const geo = new THREE.TorusGeometry(1, grosor / Math.max(rx, rz), rad, tub);
    geo.rotateX(Math.PI / 2);
    geo.scale(rx, Math.max(rx, rz), rz);
    geo.translate(cx, y, cz);
    return M.pieza(geo, nombre || 'Aro', tub, rad);
  };

  // Hongo pequeño (pie + sombrero)
  M.hongo = function (x, y, z, tam = 0.12, inclinacion = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.z = inclinacion;
    g.add(M.tubo([[0, 0, 0], [0.01, tam * 0.55, 0], [0, tam * 1.05, 0]], tam * 0.17, tam * 0.13,
      { segLargo: 3, segRadio: 6, nombre: 'PieHongo' }));
    const sW = M.seg(12, 8);
    const sH = M.seg(4, 3);
    const sombrero = new THREE.SphereGeometry(tam * 0.55, sW, sH, 0, Math.PI * 2, 0, Math.PI / 2);
    sombrero.scale(1, 0.55, 1);
    sombrero.translate(0, tam * 1.0, 0);
    g.add(M.pieza(sombrero, 'SombreroHongo', sW, sH));
    return g;
  };

  /**
   * Piel deformable por huesos (calculada en CPU): la malla se dobla de forma suave siguiendo a sus huesos
   * (cuellos y colas largos) y el wireframe de quads la acompaña porque comparte sus posiciones. Funciona con
   * el material de arcilla normal y con la exportación .OBJ (exporta la pose actual).
   *   malla: hija directa de `raiz` (sin desplazar ni girar), con sus vértices en el espacio de `raiz`.
   *   pesos(i, x, y, z) → [[hueso, peso], ...] para el vértice i (hasta 3 huesos; se normalizan).
   * Los huesos deben estar en su pose de reposo al llamarla. Solo recalcula cuando algún hueso se mueve.
   */
  M.pielConHuesos = function (malla, raiz, pesos) {
    const geo = malla.geometry;
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const n = pos.count;
    const K = 3;
    const p0 = Float32Array.from(pos.array);
    const n0 = Float32Array.from(nor.array);
    raiz.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
    const huesos = [];
    const indice = new Map();
    const hi = new Uint16Array(n * K);
    const hw = new Float32Array(n * K);
    for (let i = 0; i < n; i++) {
      const lista = pesos(i, p0[i * 3], p0[i * 3 + 1], p0[i * 3 + 2])
        .filter((e) => e && e[0] && e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, K);
      let total = 0;
      lista.forEach((e) => { total += e[1]; });
      lista.forEach(([h, w], k) => {
        if (!indice.has(h)) { indice.set(h, huesos.length); huesos.push(h); }
        hi[i * K + k] = indice.get(h);
        hw[i * K + k] = w / total;
      });
    }
    const reposoInv = huesos.map((h) => new THREE.Matrix4().multiplyMatrices(inv, h.matrixWorld).invert());
    const actual = huesos.map(() => new THREE.Matrix4());
    const firma = new Float64Array(huesos.length * 16).fill(NaN);

    function deformar() {
      inv.copy(raiz.matrixWorld).invert();
      let cambio = false;
      for (let j = 0; j < huesos.length; j++) {
        const e = actual[j].multiplyMatrices(inv, huesos[j].matrixWorld).multiply(reposoInv[j]).elements;
        for (let k = 0; k < 16; k++) if (firma[j * 16 + k] !== e[k]) { firma[j * 16 + k] = e[k]; cambio = true; }
      }
      if (!cambio) return;
      const P = pos.array;
      const N = nor.array;
      for (let i = 0; i < n; i++) {
        const x = p0[i * 3]; const y = p0[i * 3 + 1]; const z = p0[i * 3 + 2];
        const nx = n0[i * 3]; const ny = n0[i * 3 + 1]; const nz = n0[i * 3 + 2];
        let X = 0; let Y = 0; let Z = 0; let NX = 0; let NY = 0; let NZ = 0;
        for (let k = 0; k < K; k++) {
          const w = hw[i * K + k];
          if (!w) continue;
          const e = actual[hi[i * K + k]].elements;
          X += w * (e[0] * x + e[4] * y + e[8] * z + e[12]);
          Y += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
          Z += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
          NX += w * (e[0] * nx + e[4] * ny + e[8] * nz);
          NY += w * (e[1] * nx + e[5] * ny + e[9] * nz);
          NZ += w * (e[2] * nx + e[6] * ny + e[10] * nz);
        }
        const l = Math.hypot(NX, NY, NZ) || 1;
        P[i * 3] = X; P[i * 3 + 1] = Y; P[i * 3 + 2] = Z;
        N[i * 3] = NX / l; N[i * 3 + 1] = NY / l; N[i * 3 + 2] = NZ / l;
      }
      pos.needsUpdate = true;
      nor.needsUpdate = true;
      geo.boundingBox = null;
      geo.computeBoundingSphere();
    }

    // Wireframe de quads que comparte las posiciones de la malla (se deforma con ella)
    geo.computeBoundingSphere();
    const wire = malla.getObjectByName('wireOverlay');
    const rej = malla.userData.rejilla || {};
    const C = geo.userData.quadCols || rej.cols;
    const R = geo.userData.quadRows || rej.rows;
    if (wire && C && R && n >= (C + 1) * (R + 1)) {
      const idx = [];
      for (let r = 0; r <= R; r++) {
        for (let c = 0; c <= C; c++) {
          const i = r * (C + 1) + c;
          if (c < C) idx.push(i, i + 1);
          if (r < R) idx.push(i, i + C + 1);
        }
      }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', pos);
      g2.setIndex(idx);
      g2.boundingSphere = geo.boundingSphere;
      wire.geometry.dispose();
      wire.geometry = g2;
    }
    // Se deforma justo después de actualizar las matrices (antes de dibujar), solo si algún hueso cambió
    const base = malla.updateMatrixWorld;
    malla.updateMatrixWorld = function (force) {
      base.call(this, force);
      deformar();
    };
    malla.userData.pielConHuesos = huesos.map((h) => h.name);
    return malla;
  };

  /**
   * PINTURA por vértice (sin texturas de imagen: el color va en la propia malla).
   * M.pintar(malla, fn): fn(i, p) → THREE.Color, con p = posición del vértice en el espacio del modelo
   * (la malla y sus padres en la pose de reposo). Cambia su material por la misma arcilla con colores por
   * vértice (si era facetada, sigue facetada) y respeta el modo de render del editor.
   */
  M._matPintado = {};
  M.materialPintado = function (facetado) {
    const k = facetado ? 'f' : 's';
    if (!M._matPintado[k]) {
      const m = (facetado ? M.materialFacetado() : clayMaterial).clone();
      m.color.setHex(0xffffff);
      m.vertexColors = true;
      M._matPintado[k] = m;
    }
    return M._matPintado[k];
  };
  M.pintar = function (malla, fn, raiz) {
    const geo = malla.geometry;
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    if (raiz) raiz.updateMatrixWorld(true);
    const m = malla.matrixWorld.clone();
    if (raiz) m.premultiply(raiz.matrixWorld.clone().invert());
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m);
      fn(i, p).toArray(col, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    malla.material = M.materialPintado(!!(malla.material && malla.material.flatShading));
    if (typeof applyRenderStyleToMesh === 'function') applyRenderStyleToMesh(malla);
    return malla;
  };
  /**
   * Proyección lateral de la imagen de referencia (vista de lado, el animal mirando a +Z):
   * tex = { w, h, k, datos (RGB en base64), esc (m/px), x0, y0 } → el punto (z, y) cae en el píxel
   * (z/esc + x0, y0 − y/esc) de la imagen original, reducida ×k. Devuelve f(z, y, color) con interpolación.
   */
  M.proyeccion = function (tex, brillo = 0.82) {
    if (!tex._px) {
      const bin = atob(tex.datos);
      tex._px = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) tex._px[i] = bin.charCodeAt(i);
    }
    const px = tex._px;
    const at = (x, y, c) => px[(Math.max(0, Math.min(tex.h - 1, y)) * tex.w + Math.max(0, Math.min(tex.w - 1, x))) * 3 + c];
    return function (z, y, color) {
      const fx = (z / tex.esc + tex.x0) / tex.k - 0.5;
      const fy = (tex.y0 - y / tex.esc) / tex.k - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const v = [0, 1, 2].map((c) => (at(x0, y0, c) * (1 - tx) + at(x0 + 1, y0, c) * tx) * (1 - ty)
        + (at(x0, y0 + 1, c) * (1 - tx) + at(x0 + 1, y0 + 1, c) * tx) * ty);
      return color.setRGB((v[0] / 255) * brillo, (v[1] / 255) * brillo, (v[2] / 255) * brillo);
    };
  };
  // Ojo pintado en su espacio local (frente = +Z local): pupila, iris y blanco
  M.colorOjo = function (iris, blanco = 0xf2ead2, pupila = 0x101010) {
    const cI = new THREE.Color(iris);
    const cB = new THREE.Color(blanco);
    const cP = new THREE.Color(pupila);
    const c = new THREE.Color();
    return (malla) => {
      const geo = malla.geometry;
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const cx = (bb.min.x + bb.max.x) / 2;
      const cy = (bb.min.y + bb.max.y) / 2;
      const rx = (bb.max.x - bb.min.x) / 2;
      const ry = (bb.max.y - bb.min.y) / 2;
      const pos = geo.attributes.position;
      const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const r = Math.hypot((pos.getX(i) - cx) / rx, (pos.getY(i) - cy) / ry);
        const delante = pos.getZ(i) > (bb.min.z + bb.max.z) / 2;
        c.copy(!delante ? cB : r < 0.32 ? cP : r < 0.72 ? cI : cB);
        c.toArray(col, i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      malla.material = M.materialPintado(false);
      if (typeof applyRenderStyleToMesh === 'function') applyRenderStyleToMesh(malla);
      return malla;
    };
  };

  // Promedia las normales de la costura de una rejilla cerrada (columna 0 = última) para que no se vea la línea
  M.coserNormales = function (malla) {
    const geo = malla.geometry;
    const N = geo.attributes.normal;
    const rej = malla.userData.rejilla || {};
    const C = geo.userData.quadCols || rej.cols;
    const R = geo.userData.quadRows || rej.rows;
    if (!N || !C || !R) return malla;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let r = 0; r <= R; r++) {
      const i = r * (C + 1);
      a.fromBufferAttribute(N, i);
      b.fromBufferAttribute(N, i + C);
      a.add(b).normalize();
      N.setXYZ(i, a.x, a.y, a.z);
      N.setXYZ(i + C, a.x, a.y, a.z);
    }
    N.needsUpdate = true;
    return malla;
  };

  window.MallasComun = M;
})();
