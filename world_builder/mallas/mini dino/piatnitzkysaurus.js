/**
 * Mini Piatnitzkysaurus (Normal) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte de:
 *   assets/dinos/arte/normal/piatnitzkysaurus_der.webp
 *
 * Características del Piatnitzkysaurus:
 *   - Megalosauroide esbelto gris carbón con manchas rosa frambuesa y garganta roja; vientre crema.
 *   - Cejas óseas, fila de escamas por el lomo, cola larga y brazos cortos con garras.
 *
 * Construcción:
 *   - Cuerpo continuo cerrado (cola → torso → cuello → cráneo → hocico) con piel deformable (M.pielConHuesos).
 *   - Mandíbula articulada que encaja bajo el maxilar, dientes, lengua y ojos anime con brillos y párpados.
 *   - Patas cerradas en cúpula dentro del cuerpo, con dedos y garras.
 *   - Pintura: la ilustración, limpia de líneas de tinta, se proyecta por partes del cuerpo
 *     (cada tramo del eje, de las patas y de la mandíbula lee su propia zona del dibujo).
 *   - Esqueleto y animaciones: Reposo, Caminar y Rugir.
 */
registrarMalla({
  id: "mini_piatnitzkysaurus",
  categoria: "mini dino",
  nombre: "Mini Piatnitzkysaurus (Normal)",
  icono: "🦖",
  origen: "assets/dinos/arte/normal/piatnitzkysaurus_der.webp",

  construir(M) {
    const P = this.params;
    const TEX = this.textura;
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const L = (s) => (s > 0 ? "I" : "D");
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const grad = Math.PI / 180;
    const lerp = (a, b, t) => a + (b - a) * t;
    const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t
      + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    // ---------------- UTILIDADES GEOMÉTRICAS ----------------
    function rejilla(pos, cols, rows, nombre) {
      const idx = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = r * (cols + 1) + c;
          const b = a + cols + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      return M.pieza(geo, nombre, cols, rows);
    }

    // Superelipsoide (curva 0 = esfera, 1 = más cuadrado)
    function bloque(x, y, z, rx, ry, rz, curva = 0.5, nombre = "Bloque", segA = 14, segB = 10) {
      const sW = M.seg(segA, 8);
      const sH = M.seg(segB, 6);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const d = Math.pow(Math.abs(px), 2.5) + Math.pow(Math.abs(py), 2.5) + Math.pow(Math.abs(pz), 2.5);
        const f = d > 0 ? 1 / Math.pow(d, 1 / 2.5) : 1;
        px = (px * (1 - curva) + px * f * curva) * rx;
        py = (py * (1 - curva) + py * f * curva) * ry;
        pz = (pz * (1 - curva) + pz * f * curva) * rz;
        pos.setXYZ(i, px, py, pz);
      }
      geo.translate(x, y, z);
      return M.pieza(geo, nombre, sW, sH);
    }

    // Cono curvo cerrado en punta (garras, dientes, púas)
    function punta(camino, radio, nombre, segL = 12, segR = 10, potencia = 1) {
      const c = M.curva(camino);
      const tSeg = M.seg(segL, 6);
      const rSeg = M.seg(segR, 6);
      const geo = new THREE.TubeGeometry(c, tSeg, 1, rSeg, false);
      const pos = geo.attributes.position;
      const Q = new THREE.Vector3();
      for (let i = 0; i <= tSeg; i++) {
        const t = i / tSeg;
        c.getPointAt(t, Q);
        const r = radio * Math.max(0.001, Math.pow(1 - t, potencia));
        for (let j = 0; j <= rSeg; j++) {
          const k = i * (rSeg + 1) + j;
          pos.setXYZ(k, Q.x + (pos.getX(k) - Q.x) * r, Q.y + (pos.getY(k) - Q.y) * r, Q.z + (pos.getZ(k) - Q.z) * r);
        }
      }
      return M.coserNormales(M.pieza(geo, nombre, rSeg, tSeg));
    }

    function almendra(rx, ry, rz, nombre = "Almendra", segA = 18, segB = 14) {
      const sW = M.seg(segA, 10);
      const sH = M.seg(segB, 8);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const k = 1 - Math.abs(px) * 0.3;
        pos.setXYZ(i, px * rx * 1.05, py * ry * k, pz * rz * k);
      }
      return M.pieza(geo, nombre, sW, sH);
    }

    // Tubo cerrado: radio por tabla [t, r], cúpula en el inicio y en el final
    function tuboCerrado(camino, radios, nombre, opts = {}) {
      const curva = M.curva(camino);
      const tSeg = M.seg(opts.segL || 20, 8);
      const rSeg = M.seg(opts.segR || 24, 10);
      const geo = new THREE.TubeGeometry(curva, tSeg, 1, rSeg, false);
      const pos = geo.attributes.position;
      const Q = new THREE.Vector3();
      const aV = new Float32Array(pos.count);
      const tV = new Float32Array(pos.count);
      const c0 = opts.cupula0 === undefined ? 0.2 : opts.cupula0;
      const c1 = opts.cupula1 === undefined ? 0.12 : opts.cupula1;
      for (let i = 0; i <= tSeg; i++) {
        const t = i / tSeg;
        curva.getPointAt(t, Q);
        let r = M.interp(radios, t);
        if (c0 > 0 && t < c0) r *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - t / c0, 2)));
        if (c1 > 0 && t > 1 - c1) r *= Math.sqrt(Math.max(0, 1 - Math.pow((t - (1 - c1)) / c1, 2)));
        for (let j = 0; j <= rSeg; j++) {
          const k = i * (rSeg + 1) + j;
          const dx = pos.getX(k) - Q.x, dy = pos.getY(k) - Q.y, dz = pos.getZ(k) - Q.z;
          pos.setXYZ(k, Q.x + dx * r, Q.y + dy * r, Q.z + dz * r);
          aV[k] = dz;           // delante (+z) / detrás (-z), normalizado (radio unidad)
          tV[k] = t;
        }
      }
      const malla = M.coserNormales(M.pieza(geo, nombre, rSeg, tSeg));
      malla.userData.aV = aV;
      malla.userData.tV = tV;
      malla.userData.filas = tSeg;
      malla.userData.cols = rSeg;
      return malla;
    }

    // ---------------- TEXTURA: ILUSTRACIÓN LIMPIA, LEÍDA POR TRAMOS ----------------
    if (!TEX._px) {
      const bin = atob(TEX.datos);
      TEX._px = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) TEX._px[i] = bin.charCodeAt(i);
    }
    const PX = TEX._px;
    const at = (x, y, c) => PX[(Math.max(0, Math.min(TEX.h - 1, y)) * TEX.w + Math.max(0, Math.min(TEX.w - 1, x))) * 3 + c];
    const BRILLO = P.brillo || 1;
    // (x, y) en píxeles de la ilustración original
    function muestraPx(x, y, color) {
      const fx = x / TEX.k - 0.5;
      const fy = y / TEX.k - 0.5;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const v = [0, 1, 2].map((c) => (at(x0, y0, c) * (1 - tx) + at(x0 + 1, y0, c) * tx) * (1 - ty)
        + (at(x0, y0 + 1, c) * (1 - tx) + at(x0 + 1, y0 + 1, c) * tx) * ty);
      return color.setRGB((v[0] / 255) * BRILLO, (v[1] / 255) * BRILLO, (v[2] / 255) * BRILLO);
    }
    // Polilínea de la ilustración [[x, y, medioAnchoPositivo, medioAnchoNegativo], ...]:
    // t ∈ [0, 1] recorre la polilínea; a ∈ [-1, 1] se desplaza por su normal (+ = arriba / delante)
    function prepararPoli(poli) {
      const n = poli.length;
      const dir = poli.map((_, i) => {
        const A = poli[Math.max(0, i - 1)], B = poli[Math.min(n - 1, i + 1)];
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const l = Math.hypot(dx, dy) || 1;
        return [dx / l, dy / l];
      });
      return { poli, dir, n };
    }
    function enPoli(pp, t, a, color) {
      const { poli, dir, n } = pp;
      const f = Math.max(0, Math.min(n - 1, t * (n - 1)));
      const i = Math.min(n - 2, Math.floor(f));
      const e = f - i;
      const A = poli[i], B = poli[i + 1];
      const x = lerp(A[0], B[0], e), y = lerp(A[1], B[1], e);
      const h = a >= 0 ? lerp(A[2], B[2], e) : lerp(A[3], B[3], e);
      let dx = lerp(dir[i][0], dir[i + 1][0], e), dy = lerp(dir[i][1], dir[i + 1][1], e);
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      const aa = Math.max(-1, Math.min(1, a)) * h;
      return muestraPx(x + dy * aa, y - dx * aa, color);
    }
    const pinturas = [];
    const pintarLuego = (malla, fn) => { if (malla) pinturas.push([malla, fn]); return malla; };
    const fijo = (hex) => { const c = new THREE.Color(hex); return () => c; };
    const puntoImg = (ix, iy, mult = 1) => {
      const c = new THREE.Color();
      muestraPx(ix, iy, c);
      c.multiplyScalar(mult);
      return () => c;
    };
    const cTmp = new THREE.Color();
    const C_BOCA = new THREE.Color(P.colorBoca || 0xc96f6a);
    const C_MARFIL = new THREE.Color(P.colorGarra || 0xf1e8d2);
    // Estilo "liso": zonas de color planas (lomo / panza en zigzag / pico / patas) en lugar de la ilustración proyectada
    const LISO = P.estilo === "liso";
    const PAL = {};
    if (P.paleta) Object.keys(P.paleta).forEach((k) => { PAL[k] = new THREE.Color(P.paleta[k]); });
    const ZZ = P.zigzag || { base: -0.08, amp: 0.36, periodo: 0.17 };
    const tri = (x) => 1 - 2 * Math.abs(x - Math.floor(x) - 0.5);
    const PATRON = P.patron || null;
    const C_PATRON = new THREE.Color();
    if (PATRON && LISO) {
      if (PATRON.color === "oscuro") C_PATRON.copy(PAL.lomo).multiplyScalar(0.62);
      else if (PATRON.color === "claro") C_PATRON.copy(PAL.lomo).lerp(new THREE.Color(0xffffff), 0.55);
      else C_PATRON.setHex(PATRON.color);
    }
    const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
    function franja(z, a) {
      const e = PATRON.escala || 1;
      const t = z * 9 / e + 0.35 * Math.sin(a * 3.1 + z * 7) + 0.15 * Math.sin(z * 23);
      const b = t - Math.floor(t);
      return suave(0.55, 0.62, b) * (1 - suave(0.82, 0.9, b));
    }
    function mancha(z, a) {
      const e = PATRON.escala || 1;
      const cz = 0.075 * e, ca = 0.3 * e;
      const iz = Math.floor(z / cz), ia = Math.floor(a / ca);
      let d = 9;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const ii = iz + di, jj = ia + dj;
        if (hash(ii, jj) < 0.3) continue;
        const pz = (ii + 0.2 + 0.6 * hash(jj, ii)) * cz, pa = (jj + 0.2 + 0.6 * hash(ii + 7, jj + 3)) * ca;
        const r = 0.28 + 0.14 * hash(ii + 3, jj + 5);
        d = Math.min(d, Math.hypot((z - pz) / cz, (a - pa) / ca) / r);
      }
      return 1 - suave(0.85, 1.0, d);
    }
    function colorLiso(f, a, z, c) {
      // f: fila del eje (0 cola … NE-1 hocico), a: -1 panza … 1 lomo
      const F = P.filasLiso || { cabeza: 10, cara: [10.6, 12.3], pico: [12.9, 13.7] };
      let umbral = ZZ.base + ZZ.amp * tri(z / ZZ.periodo + 0.25);
      if (f < 4) umbral -= (4 - f) * 0.09;
      if (f >= F.cabeza) umbral = lerp(umbral, 1.25, suave(F.cara[0], F.cara[1], f));
      const wLomo = suave(umbral - 0.035, umbral + 0.035, a);
      c.copy(PAL.panza).lerp(PAL.lomo, wLomo);
      // Patrón de la especie sobre el lomo: franjas irregulares o manchas
      if (PATRON) {
        const m = PATRON.tipo === "manchas" ? mancha(z, a) : franja(z, a);
        const fade = suave(umbral, umbral + 0.22, a) * (f >= F.cabeza ? 1 - suave(F.cara[0], F.cara[1], f) : 1) * (1 - suave(NE - 3.5, NE - 1.5, f));
        c.lerp(C_PATRON, m * fade * (PATRON.fuerza || 0.85));
      }
      if (PAL.pico) c.lerp(PAL.pico, suave(F.pico[0], F.pico[1], f));
      return c;
    }

    // ---------------- 1. CUERPO CONTINUO CERRADO ----------------
    // EJE: [z, y, semiancho, altoArriba, altoAbajo, forma] desde la punta de la cola hasta el hocico
    const EJE = P.EJE;
    const NE = EJE.length;
    const ejeCurva = new THREE.CatmullRomCurve3(EJE.map(([z, y]) => V(0, y, z)), false, "centripetal");
    ejeCurva.arcLengthDivisions = 1600;
    const LARGO = ejeCurva.getLength();

    function seccion(u) {
      const f = ejeCurva.getUtoTmapping(u) * (NE - 1);
      const i = Math.min(NE - 2, Math.floor(f));
      const t = f - i;
      const a = EJE[Math.max(0, i - 1)], b = EJE[i], c = EJE[i + 1], d = EJE[Math.min(NE - 1, i + 2)];
      const r = [2, 3, 4, 5].map((j) => Math.max(0, cr(a[j], b[j], c[j], d[j], t)));
      r.push(f);
      return r;
    }
    const X = V(1, 0, 0);
    function marcoEje(u) {
      const Q = ejeCurva.getPointAt(u);
      const T = ejeCurva.getTangentAt(u);
      const ang = Math.atan2(T.y, T.z) * (P.inclinacion || 0.35);
      return { Q, U: V(0, Math.cos(ang), -Math.sin(ang)) };
    }
    const TABLA_EJE = [];
    for (let k = 0; k <= 1200; k++) TABLA_EJE.push(ejeCurva.getPointAt(k / 1200));
    function uCercano(p, desde = 0, hasta = 1) {
      let mejor = desde, dMin = Infinity;
      const k0 = Math.max(0, Math.floor(desde * 1200)), k1 = Math.min(1200, Math.ceil(hasta * 1200));
      for (let k = k0; k <= k1; k++) {
        const d = TABLA_EJE[k].distanceToSquared(p);
        if (d < dMin) { dMin = d; mejor = k / 1200; }
      }
      return mejor;
    }

    const DET = P.detalle || 1;   // multiplicador de resolución (vértices)
    const COLS = M.seg(Math.round(80 * DET), 20);
    const FILAS = M.seg(Math.round(380 * DET), 60);
    const aCuerpo = new Float32Array((COLS + 1) * (FILAS + 1));
    const xCuerpo = new Float32Array((COLS + 1) * (FILAS + 1));
    const fFila = new Float32Array(FILAS + 1);
    const filaInfo = [];
    const bultos = P.bultos || [];   // [z, y, sigmaZ, amplitud, lado(0 = todo, 1 = flancos, 2 = lomo)]
    const cuerpo = (() => {
      const pos = [];
      for (let r = 0; r <= FILAS; r++) {
        const u = r / FILAS;
        const { Q, U } = marcoEje(u);
        const [w, hA, hB, p, f] = seccion(u);
        fFila[r] = f;
        const ex = 2 / p;
        filaInfo.push({ z: Q.z, y: Q.y, w, hA, hB, U, u });
        for (let c = 0; c <= COLS; c++) {
          const fi = Math.PI + (c / COLS) * Math.PI * 2;
          const s = Math.sin(fi);
          const co = Math.cos(fi);
          let extra = 0;
          bultos.forEach(([bz, by, sg, amp, tipo]) => {
            const k = amp * Math.exp(-Math.pow((Q.z - bz) / sg, 2)) * (by ? Math.exp(-Math.pow((Q.y - by) / (sg * 1.5), 2)) : 1);
            if (tipo === 1) extra += k * Math.pow(Math.abs(s), 1.6);
            else if (tipo === 2) extra += k * Math.pow(Math.max(0, co), 2);
            else extra += k;
          });
          const lx = (w + extra) * Math.sign(s) * Math.pow(Math.abs(s), ex);
          const ly = ((co >= 0 ? hA : hB) + extra * 0.4) * Math.sign(co) * Math.pow(Math.abs(co), ex);
          aCuerpo[r * (COLS + 1) + c] = Math.sign(co) * Math.pow(Math.abs(co), ex);
          xCuerpo[r * (COLS + 1) + c] = Math.pow(Math.abs(s), ex);
          const pto = Q.clone().addScaledVector(X, lx).addScaledVector(U, ly);
          pos.push(pto.x, pto.y, pto.z);
        }
      }
      return M.coserNormales(rejilla(pos, COLS, FILAS, "Cuerpo" + P.nombreCorto));
    })();
    g.add(cuerpo);
    g.updateMatrixWorld(true);

    // Lectura del cuerpo: lomo, panza y flanco a una z dada dentro de un tramo del eje
    function filaEnZ(z, uMin = 0, uMax = 1) {
      let mejor = 0, dMin = Infinity;
      for (let r = 0; r <= FILAS; r++) {
        const fi = filaInfo[r];
        if (fi.u < uMin || fi.u > uMax) continue;
        const d = Math.abs(fi.z - z);
        if (d < dMin) { dMin = d; mejor = r; }
      }
      return mejor;
    }
    const vCuerpo = (r, c) => {
      const k = (r * (COLS + 1) + c) * 3;
      const a = cuerpo.geometry.attributes.position.array;
      return V(a[k], a[k + 1], a[k + 2]);
    };
    const lomo = (z, uMin, uMax) => vCuerpo(filaEnZ(z, uMin, uMax), COLS / 2);
    const panza = (z, uMin, uMax) => vCuerpo(filaEnZ(z, uMin, uMax), 0);
    const rayo = new THREE.Raycaster();
    const matRayo = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    function superficie(desde, hacia) {
      cuerpo.updateMatrixWorld(true);
      const mat = cuerpo.material;
      cuerpo.material = matRayo;
      rayo.set(desde, hacia.clone().normalize());
      const h = rayo.intersectObject(cuerpo, false)[0];
      cuerpo.material = mat;
      if (!h) return null;
      const n = h.face.normal.clone();
      if (n.dot(hacia) > 0) n.negate();
      return { p: h.point.clone(), n };
    }

    // ---------------- 2. ESQUELETO ----------------
    const hueso = {};
    const crearHueso = (nombre, padre, x, y, z) => {
      const b = new THREE.Bone();
      b.name = "Hueso" + nombre;
      b.userData.reposo = V(x, y, z);
      const p = padre ? hueso[padre] : null;
      b.position.set(x, y, z).sub(p ? p.userData.reposo : V(0, 0, 0));
      (p || g).add(b);
      hueso[nombre] = b;
    };
    crearHueso("Raiz", null, 0, 0, 0);
    const HC = P.HUESOS;   // nombre → [y, z]
    [["Cadera", "Raiz"], ["Cola1", "Cadera"], ["Cola2", "Cola1"], ["Cola3", "Cola2"], ["Pecho", "Cadera"],
      ["Cuello1", "Pecho"], ["Cuello2", "Cuello1"], ["Cabeza", "Cuello2"], ["Mandibula", "Cabeza"]]
      .forEach(([n, padre]) => crearHueso(n, padre, 0, HC[n][0], HC[n][1]));
    P.PATAS.forEach((pt) => LADOS.forEach((s) => {
      const cam = pt.camino;
      pt.huesos.forEach((n, k) => {
        const q = cam[k + 1];
        crearHueso(n + L(s), k === 0 ? pt.padre : pt.huesos[k - 1] + L(s), s * q[0], q[1], q[2]);
      });
    }));
    // La piel se actualiza después de los huesos (mismo fotograma): el cuerpo va detrás de ellos en el grupo
    g.remove(cuerpo);
    g.add(cuerpo);
    g.updateMatrixWorld(true);
    const colgar = (nombre, obj) => {
      const h = typeof nombre === "string" ? hueso[nombre] : nombre;
      if (h && obj) h.attach(obj);
      return obj;
    };

    const uH = (n, d1, d2) => uCercano(hueso[n].userData.reposo, d1, d2);
    const TRAMOS = [
      [0, "Cola3"],
      [uH("Cola3", 0, 0.4), "Cola2"],
      [uH("Cola2", 0.05, 0.45), "Cola1"],
      [uH("Cola1", 0.1, 0.55), "Cadera"],
      [uH("Pecho", 0.3, 0.75), "Pecho"],
      [uH("Cuello1", 0.4, 0.85), "Cuello1"],
      [uH("Cuello2", 0.5, 0.92), "Cuello2"],
      [uH("Cabeza", 0.6, 0.98), "Cabeza"]
    ];
    const MEZCLA = (P.mezcla || 0.16) / LARGO;
    function pesosTramos(u, tramos, mezcla) {
      let k = 0;
      while (k + 1 < tramos.length && u >= tramos[k + 1][0]) k++;
      const res = [[hueso[tramos[k][1]], 1]];
      if (k + 1 < tramos.length) {
        const w = suave(-mezcla, mezcla, u - tramos[k + 1][0]);
        if (w > 0) { res[0][1] = 1 - w; res.push([hueso[tramos[k + 1][1]], w]); }
      }
      if (k > 0) {
        const w = 1 - suave(-mezcla, mezcla, u - tramos[k][0]);
        if (w > 0) { res[0][1] *= 1 - w; res.push([hueso[tramos[k - 1][1]], w]); }
      }
      return res;
    }
    const huesoEnU = (u) => pesosTramos(u, TRAMOS, MEZCLA).sort((a, b) => b[1] - a[1])[0][0];
    const U_CABEZA = TRAMOS[7][0];
    const U_CUELLO = TRAMOS[5][0];
    const U_PECHO = TRAMOS[4][0];

    // Pieza extra que se deforma con el cuerpo: cada vértice toma los pesos del punto del eje más cercano
    const pesosPorEje = (uMin = 0, uMax = 1) => (i, x, y, z) => pesosTramos(uCercano(V(0, y, z), uMin, uMax), TRAMOS, MEZCLA);

    // ---------------- 3. PATAS CERRADAS, PIES Y MANOS ----------------
    const polis = {};
    P.PATAS.forEach((pt) => {
      const pp = prepararPoli(pt.img);
      LADOS.forEach((s) => {
        const cam = pt.camino.map(([x, y, z]) => [s * x, y, z]);
        const malla = tuboCerrado(cam, pt.radios, pt.nombre, { segL: Math.round(24 * DET), segR: Math.round(28 * DET), cupula0: 0.2, cupula1: pt.cupulaFinal !== undefined ? pt.cupulaFinal : (pt.pie === "saurópodo" ? 0.03 : 0.1) });
        g.add(malla);
        const tr = [[0, pt.huesos[0] + L(s)], [pt.cortes[0], pt.huesos[1] + L(s)], [pt.cortes[1], pt.huesos[2] + L(s)]];
        const filas = malla.userData.filas, cols = malla.userData.cols;
        M.pielConHuesos(malla, g, (i) => pesosTramos(Math.floor(i / (cols + 1)) / filas, tr, 0.12));
        const { aV, tV } = malla.userData;
        pintarLuego(malla, (i) => (LISO ? cTmp.copy(PAL.patas || PAL.panza) : enPoli(pp, tV[i], aV[i] * (pt.giroImg || 1), cTmp).multiplyScalar(P.luzPatas || 1)));

        const fin = pt.camino[pt.camino.length - 1];
        const hFin = pt.huesos[2] + L(s);
        const xf = s * fin[0];
        const cFinPata = new THREE.Color();
        if (LISO) cFinPata.copy(PAL.patas || PAL.panza); else enPoli(pp, 0.95, 0, cFinPata).multiplyScalar(0.95);
        const cPie = !LISO && pt.colorPie ? puntoImg(pt.colorPie[0], pt.colorPie[1]) : () => cFinPata;
        const cDedo = !LISO && pt.colorDedo ? puntoImg(pt.colorDedo[0], pt.colorDedo[1]) : cPie;
        if (pt.pie === "saurópodo") {
          // Pie columnar de elefante con uñas romas delante
          const rp = pt.radios[pt.radios.length - 1][1];
          pintarLuego(colgar(hFin, bloque(xf, rp * 0.5, fin[2] + 0.004, rp * 1.02, rp * 0.5, rp * 1.02, 0.7, "Pie" + pt.nombre)), cPie);
          (pt.unas || [-0.5, 0, 0.5]).forEach((k) => {
            const ang = k * 0.9;
            pintarLuego(colgar(hFin, bloque(xf + Math.sin(ang) * rp * 0.98, rp * 0.2, fin[2] + Math.cos(ang) * rp * 0.98,
              rp * 0.3, rp * 0.2, rp * 0.2, 0.6, "Una")), fijo(P.colorUna || 0xd8ccb0));
          });
        } else if (pt.pie === "terópodo") {
          // Pie de tres dedos con garra y espolón trasero
          const rp = pt.radios[pt.radios.length - 1][1];
          pintarLuego(colgar(hFin, bloque(xf, 0.035, fin[2] + 0.015, rp * 0.95, 0.034, rp * 1.05, 0.7, "PlantaPie")), cPie);
          [-1, 0, 1].forEach((k) => {
            const lg = k === 0 ? 1 : 0.82;
            const dx = s * k * rp * 0.62;
            const ang = k * s * 0.32;
            const z0 = fin[2] + 0.03;
            const largo = (pt.largoDedo || 0.075) * lg;
            const p0 = [xf + dx, 0.034, z0];
            const p1 = [xf + dx + Math.sin(ang) * largo * 0.55, 0.03, z0 + Math.cos(ang) * largo * 0.55];
            const p2 = [xf + dx + Math.sin(ang) * largo, 0.022, z0 + Math.cos(ang) * largo];
            pintarLuego(colgar(hFin, M.tubo([p0, p1, p2], 0.024 * lg, 0.019 * lg, { segLargo: 10, segRadio: 12, nombre: "DedoPie" })), cDedo);
            pintarLuego(colgar(hFin, bloque(p2[0], p2[1], p2[2], 0.02 * lg, 0.019 * lg, 0.02 * lg, 0.2, "PuntaDedo", 10, 8)), cDedo);
            const g0 = [p2[0], 0.03, p2[2] + 0.004];
            pintarLuego(colgar(hFin, punta([g0, [g0[0] + Math.sin(ang) * 0.02, 0.022, g0[2] + Math.cos(ang) * 0.022],
              [g0[0] + Math.sin(ang) * 0.032, 0.004, g0[2] + Math.cos(ang) * 0.034]], 0.014 * lg, "GarraPie", 10, 8)), () => C_MARFIL);
          });
          const xe = xf - s * 0.02;
          pintarLuego(colgar(hFin, punta([[xe, 0.07, fin[2] - 0.02], [xe - s * 0.008, 0.05, fin[2] - 0.055], [xe - s * 0.01, 0.026, fin[2] - 0.075]],
            0.012, "Espolon", 8, 8)), () => C_MARFIL);
        } else if (pt.pie === "mano") {
          // Mano de terópodo: palma, tres dedos y garra del pulgar
          const rp = pt.radios[pt.radios.length - 1][1];
          const ant = pt.camino[pt.camino.length - 2];
          const dir = V(s * (fin[0] - ant[0]), fin[1] - ant[1], fin[2] - ant[2]).normalize();
          const base = V(xf, fin[1], fin[2]).addScaledVector(dir, rp * 0.4);
          pintarLuego(colgar(hFin, bloque(base.x, base.y, base.z, rp * 1.05, rp * 0.9, rp * 1.1, 0.5, "Mano")), cPie);
          const lado = V(s, 0, 0);
          (pt.dedos || [[-1, 0.75, 1.5], [0, 1, 1], [1, 0.85, 1]]).forEach(([k, lg, grosor]) => {
            const p0 = base.clone().addScaledVector(lado, -k * rp * 0.55).addScaledVector(dir, rp * 0.5);
            const p1 = p0.clone().addScaledVector(dir, 0.035 * lg).add(V(0, -0.006, 0.012));
            const p2 = p1.clone().addScaledVector(dir, 0.022 * lg).add(V(0, -0.012, 0.012));
            pintarLuego(colgar(hFin, M.tubo([p0, p1, p2], 0.015 * grosor, 0.012 * grosor, { segLargo: 10, segRadio: 10, nombre: "DedoMano" })), cDedo);
            pintarLuego(colgar(hFin, bloque(p2.x, p2.y, p2.z, 0.012 * grosor, 0.012 * grosor, 0.012 * grosor, 0.2, "PuntaDedo", 10, 8)), cDedo);
            const gl = (k === -1 && pt.garraPulgar ? pt.garraPulgar : 0.035) * lg * (pt.garraLarga || 1);
            const c1 = p2.clone().add(V(0, 0.004, 0.006));
            const c2 = c1.clone().addScaledVector(dir, gl * 0.5).add(V(0, gl * 0.1, gl * 0.35));
            const c3 = c2.clone().add(V(0, -gl * 0.75, gl * 0.35));
            pintarLuego(colgar(hFin, punta([c1, c2, c3], 0.011 * grosor * (k === -1 && pt.garraPulgar ? 1.3 : 1) * Math.sqrt(pt.garraLarga || 1), "GarraMano", 14, 8)), () => C_MARFIL);
          });
        }
      });
    });

    // ---------------- 4. CABEZA: MANDÍBULA, DIENTES, LENGUA, FOSAS Y OJOS ----------------
    const ladoCabeza = (z, y, s) => {
      const h = superficie(V(s * 1.5, y, z), V(-s, 0, 0));
      return h ? h.p : V(0, y, z);
    };
    // Borde inferior del cráneo / maxilar: rayo hacia abajo desde el eje de la cabeza
    const bajoCabeza = (z) => {
      const fi = filaInfo[filaEnZ(z, U_CUELLO, 1)];
      const h = superficie(V(0, fi.y, z), V(0, -1, 0));
      return h ? h.p.y : fi.y - fi.hB;
    };

    // Mandíbula: [z, semiancho, alto, forma]; su borde superior se ajusta bajo el maxilar
    const MAND = P.MANDIBULA;
    const colsM = M.seg(Math.round(48 * DET), 16);
    const filasM = M.seg(Math.round(48 * DET), 16);
    const posM = [];
    const aM = new Float32Array((colsM + 1) * (filasM + 1));
    const tM = new Float32Array((colsM + 1) * (filasM + 1));
    const xM = new Float32Array((colsM + 1) * (filasM + 1));
    const filasMand = [];
    for (let r = 0; r <= filasM; r++) {
      const t = r / filasM;
      const f = t * (MAND.length - 1);
      const i = Math.min(MAND.length - 2, Math.floor(f));
      const e = f - i;
      const a = MAND[Math.max(0, i - 1)], b = MAND[i], c = MAND[i + 1], d = MAND[Math.min(MAND.length - 1, i + 2)];
      const [z, w, h, p] = [0, 1, 2, 3].map((j) => cr(a[j], b[j], c[j], d[j], e));
      const ww = Math.max(0, w), hh = Math.max(0, h);
      const techo = bajoCabeza(z) - (P.holguraBoca || 0.002);
      const yc = techo - hh * 0.35;
      filasMand.push({ z, w: ww, techo });
      const ex = 2 / Math.max(1.8, p);
      for (let col = 0; col <= colsM; col++) {
        const fi = Math.PI + (col / colsM) * Math.PI * 2;
        const sx = Math.sin(fi), cy = Math.cos(fi);
        const hAct = cy > 0 ? hh * 0.35 : hh;
        const k = r * (colsM + 1) + col;
        aM[k] = Math.sign(cy) * Math.pow(Math.abs(cy), ex);
        tM[k] = t;
        xM[k] = Math.abs(Math.sign(sx) * Math.pow(Math.abs(sx), ex));
        posM.push(ww * Math.sign(sx) * Math.pow(Math.abs(sx), ex), yc + hAct * Math.sign(cy) * Math.pow(Math.abs(cy), ex), z);
      }
    }
    const mandibula = colgar("Mandibula", M.coserNormales(rejilla(posM, colsM, filasM, "Mandibula")));
    const ppMand = prepararPoli(P.IMG_MAND);
    const ppEjeM = prepararPoli(P.IMG_EJE);
    pintarLuego(mandibula, (i) => {
      if (LISO) cTmp.copy(PAL.panza).lerp(PAL.pico || PAL.panza, suave(0.35, 0.75, tM[i]));
      else if (P.mandDesdeCabeza) {
        const [f0, f1] = P.mandDesdeCabeza;
        enPoli(ppEjeM, (f0 + (f1 - f0) * tM[i]) / (NE - 1), -0.35 + 0.45 * aM[i], cTmp);
      } else enPoli(ppMand, tM[i], aM[i], cTmp);
      cTmp.multiplyScalar(P.luzMand || 1);
      if (aM[i] > 0.45 && xM[i] < 0.8) cTmp.lerp(C_BOCA, suave(0.45, 0.8, aM[i]) * (1 - suave(0.6, 0.8, xM[i])));
      return cTmp;
    });
    const mandEnZ = (z) => {
      let m = filasMand[0];
      filasMand.forEach((f) => { if (Math.abs(f.z - z) < Math.abs(m.z - z)) m = f; });
      return m;
    };

    // Lengua
    const mz0 = MAND[0][0], mz1 = MAND[MAND.length - 1][0];
    const zl = lerp(mz0, mz1, 0.42);
    const ml = mandEnZ(zl);
    pintarLuego(colgar("Mandibula", bloque(0, ml.techo - 0.004, zl, ml.w * 0.55, 0.012, (mz1 - mz0) * 0.3, 0.6, "Lengua")), fijo(P.colorLengua || 0xd9787a));

    // Dientes: superiores cuelgan del maxilar, inferiores asoman del borde de la mandíbula
    const DT = P.DIENTES || { sup: [], inf: [], largo: 0.016, radio: 0.006 };
    LADOS.forEach((s) => {
      DT.sup.forEach((z, k) => {
        const m = mandEnZ(z);
        const x = s * Math.max(0.012, m.w * (DT.ancho || 0.82));
        const lg = DT.largo * (DT.escalaSup ? DT.escalaSup[k] || 1 : 1);
        const y0 = bajoCabeza(z) + 0.006;
        pintarLuego(colgar("Cabeza", punta([[x, y0, z], [x, y0 - lg * 0.6, z + 0.002], [x, y0 - lg - 0.006, z + 0.004]], DT.radio, "DienteSuperior", 8, 6)), () => C_MARFIL);
      });
      DT.inf.forEach((z, k) => {
        const m = mandEnZ(z);
        const x = s * Math.max(0.012, m.w * (DT.ancho || 0.82) * 0.94);
        const lg = DT.largo * 0.85 * (DT.escalaInf ? DT.escalaInf[k] || 1 : 1);
        const y0 = m.techo - 0.006;
        pintarLuego(colgar("Mandibula", punta([[x, y0, z], [x, y0 + lg * 0.6, z + 0.002], [x, y0 + lg + 0.004, z + 0.004]], DT.radio * 0.9, "DienteInferior", 8, 6)), () => C_MARFIL);
      });
    });

    // Fosas nasales
    (P.FOSAS || []).forEach(([x, y, z, r]) => LADOS.forEach((s) => {
      const q = ladoCabeza(z, y, s);
      const xx = Math.abs(q.x) > 0.001 ? q.x - s * 0.003 : s * x;
      pintarLuego(colgar("Cabeza", bloque(xx, y, z, (r || 0.009) * 0.8, (r || 0.009) * 0.6, r || 0.009, 0.4, "FosaNasal", 10, 8)), fijo(P.colorFosa || 0x3b2420));
    }));

    // Ojos anime: córnea, iris del tipo agua, pupila, dos brillos y párpados
    const OJ = P.OJO;
    const C_IRIS = new THREE.Color(P.iris || 0x18b4d8);
    const C_IRIS2 = new THREE.Color(P.iris2 || 0x0b5f8a);
    LADOS.forEach((s) => {
      const h = superficie(V(s * 1.5, OJ.y, OJ.z), V(-s, 0, 0));
      const pSup = h ? h.p : V(s * OJ.x, OJ.y, OJ.z);
      const nSup = h ? h.n : V(s, 0, 0);
      const dir = nSup.clone().setY(nSup.y * 0.4).lerp(V(0, 0, 1), OJ.frente || 0.35).normalize();
      const ojo = new THREE.Group();
      ojo.position.copy(pSup).addScaledVector(dir, -(OJ.hundir || 0.004));
      const xEje = V(0, 1, 0).cross(dir).normalize();
      const yEje = dir.clone().cross(xEje).normalize();
      ojo.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xEje, yEje, dir));
      const e = OJ.tam || 1;
      const blanco = almendra(0.05 * e, 0.054 * e, 0.016 * e, "OjoBlanco");
      ojo.add(blanco);
      const iris = bloque(0, -0.002 * e, 0.007 * e, 0.037 * e, 0.042 * e, 0.01 * e, 1, "Iris", 16, 12);
      ojo.add(iris);
      ojo.add(bloque(0, -0.004 * e, 0.013 * e, 0.019 * e, 0.024 * e, 0.007 * e, 1, "Pupila", 14, 10));
      ojo.add(bloque(-s * 0.012 * e, 0.016 * e, 0.018 * e, 0.012 * e, 0.013 * e, 0.005 * e, 1, "BrilloOjo", 10, 8));
      ojo.add(bloque(s * 0.012 * e, -0.016 * e, 0.017 * e, 0.006 * e, 0.006 * e, 0.004 * e, 1, "BrilloOjoChico", 8, 6));
      ojo.add(M.tubo([[-0.052 * e, 0.006 * e, 0.004 * e], [-0.02 * e, 0.05 * e, 0.012 * e], [0.02 * e, 0.052 * e, 0.012 * e], [0.054 * e, 0.012 * e, 0.004 * e]],
        0.0075 * e, 0.0055 * e, { segLargo: 16, segRadio: 8, nombre: "ParpadoSuperior" }));
      ojo.add(M.tubo([[-0.046 * e, -0.012 * e, 0.004 * e], [0, -0.05 * e, 0.01 * e], [0.046 * e, -0.012 * e, 0.004 * e]],
        0.005 * e, 0.004 * e, { segLargo: 12, segRadio: 8, nombre: "ParpadoInferior" }));
      // ---- Expresión de carácter (P.caracter.ojos): párpados y cejas que dan personalidad ----
      const CARo = P.caracter || {};
      const expr = CARo.ojos === 'picaro' ? (s > 0 ? 'somnoliento' : 'decidido') : (CARo.ojos || 'neutro');
      const IN = s * (CARo.signoInterior || 1); // inclina hacia el hocico
      const tapa = (y, ry, rotZ, nombre = "ParpadoExpresion") => {
        const m = bloque(0, 0, 0.013 * e, 0.066 * e, ry * e, 0.012 * e, 1, nombre, 18, 12);
        m.rotation.z = rotZ; m.position.y = y * e; ojo.add(m);
      };
      const ceja = (y, rotZ, curva = 0, grosor = 1) => {
        const c = M.tubo([[-0.062 * e, 0, 0.014 * e], [0, curva * e, 0.018 * e], [0.062 * e, 0, 0.014 * e]],
          0.012 * e * grosor, 0.008 * e * grosor, { segLargo: 12, segRadio: 8, nombre: "CejaExpresion" });
        c.rotation.z = rotZ; c.position.y = y * e; ojo.add(c);
      };
      if (expr === 'molesto') { tapa(0.05, 0.03, IN * 0.45); ceja(0.074, IN * 0.5, 0, 1.2); }
      else if (expr === 'decidido') { tapa(0.057, 0.026, IN * 0.18); ceja(0.082, IN * 0.25); }
      else if (expr === 'somnoliento') { tapa(0.032, 0.036, 0); }
      else if (expr === 'feliz') { tapa(-0.05, 0.03, 0, "MejillaFeliz"); ceja(0.088, 0, 0.014, 0.8); }
      else if (expr === 'triste') { tapa(0.054, 0.026, -IN * 0.35); ceja(0.084, -IN * 0.42, 0, 0.9); }
      else if (expr === 'sorprendido') { ojo.scale.setScalar(1.15); ceja(0.1, 0, 0.02, 0.8); ojo.children.forEach((o) => { if (o.name === 'Pupila') o.scale.setScalar(0.6); }); }
      if (CARo.mirar) ojo.children.forEach((o) => { if (/^(Iris|Pupila|Brillo)/.test(o.name)) { o.position.x += s * CARo.mirar[0] * 0.012 * e; o.position.y += CARo.mirar[1] * 0.01 * e; } });
      g.add(ojo);
      colgar("Cabeza", ojo);
      const cParpado = LISO ? (() => { const c = PAL.lomo.clone().multiplyScalar(0.8); return () => c; })() : puntoImg(OJ.img[0], OJ.img[1], P.oscuroParpado || 0.6);
      ojo.children.forEach((o) => {
        if (o.name === "OjoBlanco") pintarLuego(o, fijo(0xfdfbf6));
        else if (o.name === "Iris") {
          const bb = new THREE.Box3().setFromObject(o);
          pintarLuego(o, (i, p) => cTmp.copy(C_IRIS2).lerp(C_IRIS, suave(bb.min.y, bb.max.y, p.y) * 0.9 + 0.1));
        } else if (o.name === "Pupila") pintarLuego(o, fijo(0x0d1424));
        else if (/^Brillo/.test(o.name)) pintarLuego(o, fijo(0xffffff));
        else if (o.name === "CejaExpresion") pintarLuego(o, fijo(P.colorCeja || (LISO ? PAL.lomo.clone().multiplyScalar(0.42).getHex() : 0x2a1c18)));
        else pintarLuego(o, cParpado);
      });
    });

    // ---------------- 5. PIEZAS PROPIAS DE LA ESPECIE ----------------
    const ppEje = prepararPoli(P.IMG_EJE);
    // Color del cuerpo a la altura de una fila (a = 1 lomo, -1 panza)
    const colorCuerpo = (r, a, c) => (LISO ? c.copy(a > 0 ? PAL.lomo : PAL.panza) : enPoli(ppEje, fFila[r] / (NE - 1), a * (P.margenImg || 0.9), c));

    // Vela / cresta dorsal fina y cerrada sobre el lomo; se deforma con el cuerpo
    function velaDorsal(o) {
      const filasV = M.seg(Math.round((o.filas || 90) * DET), 16);
      const colsV = M.seg(Math.round((o.cols || 24) * DET), 10);
      const pos = [];
      const tV = new Float32Array((filasV + 1) * (colsV + 1));
      const vV = new Float32Array((filasV + 1) * (colsV + 1));
      const rV = new Int32Array((filasV + 1) * (colsV + 1));
      const hundir = o.hundir || 0.035;
      for (let r = 0; r <= filasV; r++) {
        const t = r / filasV;
        const z = lerp(o.z0, o.z1, t);
        const fila = filaEnZ(z, o.uMin || 0, o.uMax || 1);
        const top = vCuerpo(fila, COLS / 2);
        const alto = Math.max(0, o.alto(t));
        const H = alto + hundir;
        const yb = top.y - hundir;
        const dz = o.inclina ? o.inclina(t) : 0;
        for (let c = 0; c <= colsV; c++) {
          const th = (c / colsV) * Math.PI * 2;
          const v = (1 - Math.cos(th)) / 2;
          const T = (o.grosor || 0.014) * (1 - 0.65 * v) * Math.min(1, alto / 0.02 + 0.3);
          const k = r * (colsV + 1) + c;
          tV[k] = t; vV[k] = v; rV[k] = fila;
          pos.push(T * Math.sin(th), yb + H * v, z + dz * v);
        }
      }
      const m = M.coserNormales(rejilla(pos, colsV, filasV, o.nombre || "Vela"));
      g.add(m);
      M.pielConHuesos(m, g, pesosPorEje(o.uMin || 0, o.uMax || 1));
      const pp = o.img ? prepararPoli(o.img) : null;
      pintarLuego(m, (i, p) => {
        if (pp) enPoli(pp, tV[i], vV[i] * 2 - 1, cTmp);
        else colorCuerpo(rV[i], 0.97, cTmp);
        if (o.tinte) o.tinte(tV[i], vV[i], cTmp);
        return cTmp;
      });
      return m;
    }

    // Membrana de ala entre el borde de ataque (brazo → punta) y el borde de fuga (punta → cadera).
    // Se deforma con los huesos del brazo (y la cadera en la raíz del borde de fuga).
    function alaMembrana(o) {
      const colsA = M.seg(o.cols || 40, 10);
      const filasA = M.seg(o.filas || 16, 6);
      const huesosA = o.huesos;
      const cortes = o.cortes || [0.32, 0.62];
      LADOS.forEach((s) => {
        const ataque = M.curva(o.ataque.map(([x, y, z]) => V(s * x, y, z)));
        const fuga = M.curva(o.fuga.map(([x, y, z]) => V(s * x, y, z)));
        const pos = [];
        const uA = [], vA = [];
        for (let r = 0; r <= filasA; r++) {
          const v = r / filasA;
          for (let c = 0; c <= colsA; c++) {
            const u = c / colsA;
            const a = ataque.getPointAt(u), f = fuga.getPointAt(u);
            const p = a.clone().lerp(f, v);
            p.y -= (o.comba || 0.03) * Math.sin(Math.PI * v) * Math.sin(Math.PI * Math.min(1, u * 1.2));
            pos.push(p.x, p.y, p.z);
            uA.push(u); vA.push(v);
          }
        }
        const m = M.coserNormales(rejilla(pos, colsA, filasA, o.nombre || "MembranaAla"));
        g.add(m);
        const tr = [[0, huesosA[0] + L(s)], [cortes[0], huesosA[1] + L(s)], [cortes[1], huesosA[2] + L(s)]];
        M.pielConHuesos(m, g, (i) => {
          const u = uA[i], v = vA[i];
          const lista = pesosTramos(u, tr, 0.08);
          const wC = v * Math.pow(1 - u, 2.2);
          lista.forEach((e) => { e[1] *= 1 - wC; });
          lista.push([hueso.Cadera, wC]);
          return lista;
        });
        const enLinea = (poli, t) => {
          const f = Math.max(0, Math.min(poli.length - 1, t * (poli.length - 1)));
          const k = Math.min(poli.length - 2, Math.floor(f)), e = f - k;
          return [lerp(poli[k][0], poli[k + 1][0], e), lerp(poli[k][1], poli[k + 1][1], e)];
        };
        pintarLuego(m, (i) => {
          const a = enLinea(o.imgAtaque, uA[i]), f = enLinea(o.imgFuga, uA[i]);
          const v = 0.1 + 0.8 * vA[i];
          muestraPx(lerp(a[0], f[0], v), lerp(a[1], f[1], v), cTmp);
          return o.luz ? cTmp.multiplyScalar(o.luz) : cTmp;
        });
      });
    }

    // Fila de púas / escudos cónicos sobre el lomo, cada una colgada del hueso de su tramo
    function pinchosDorsales(o) {
      const lista = [];
      for (let k = 0; k < o.n; k++) {
        const t = o.n === 1 ? 0.5 : k / (o.n - 1);
        const z = lerp(o.z0, o.z1, t);
        const fila = filaEnZ(z, o.uMin || 0, o.uMax || 1);
        const x = o.x || 0;
        const base = x ? (superficie(V(x, 2, z), V(0, -1, 0)) || { p: vCuerpo(fila, COLS / 2) }).p : vCuerpo(fila, COLS / 2);
        const alto = o.alto(t);
        const rad = o.radio(t);
        const inc = o.inclina || -0.25;
        const pz = base.clone().add(V(0, -rad * 0.6, 0));
        const c = punta([pz, pz.clone().add(V(0, alto * 0.6, inc * alto * 0.3)), pz.clone().add(V(0, alto + rad * 0.6, inc * alto))],
          rad, o.nombre || "Pincho", 8, 10, o.potencia || 1);
        colgar(huesoEnU(filaInfo[fila].u), c);
        pintarLuego(c, o.color || (() => colorCuerpo(fila, 1, cTmp)));
        lista.push(c);
      }
      return lista;
    }

    // Cejas óseas (cuernitos lacrimales) sobre los ojos
    LADOS.forEach((s) => {
      const h = superficie(V(s * 1.5, P.OJO.y + 0.06, P.OJO.z - 0.005), V(-s, 0, 0));
      if (!h) return;
      const base = h.p.clone().addScaledVector(h.n, -0.008);
      const c = colgar("Cabeza", punta([base, base.clone().add(V(s * 0.006, 0.022 * 0.6, -0.004)), base.clone().add(V(s * 0.01, 0.022, -0.012))],
        0.02 * 1.0, "CejaOsea", 10, 10, 0.7));
      pintarLuego(c, fijo(0xa83a50));
    });

    // Fila de escamas/púas a lo largo del lomo
    pinchosDorsales({ n: 22, z0: -0.66, z1: 0.36, uMin: 0, uMax: U_CABEZA, nombre: "EscamaDorsal",
      alto: (t) => 0.016 * (0.6 + 0.4 * Math.sin(Math.PI * t)), radio: (t) => 0.012 * (0.6 + 0.4 * Math.sin(Math.PI * t)),
      inclina: -0.35, potencia: 0.8, color: () => cTmp.setHex(0x4a4448), });

    // ---------------- 6. PIEL DEL CUERPO Y PINTURA ----------------
    M.pielConHuesos(cuerpo, g, (i) => pesosTramos(Math.floor(i / (COLS + 1)) / FILAS, TRAMOS, MEZCLA));
    const fPaladar = P.paladarDesde === undefined ? NE : P.paladarDesde;
    pintarLuego(cuerpo, (i) => {
      const r = Math.floor(i / (COLS + 1));
      const a = aCuerpo[i];
      if (LISO) return colorLiso(fFila[r], a, filaInfo[r].z, cTmp);
      enPoli(ppEje, fFila[r] / (NE - 1), a * (P.margenImg || 0.9), cTmp);
      if (fFila[r] > fPaladar && a < -0.6) {
        cTmp.lerp(C_BOCA, suave(-0.6, -0.9, a) * suave(fPaladar, fPaladar + 0.6, fFila[r]) * (1 - suave(0.35, 0.55, xCuerpo[i])));
      }
      return cTmp;
    });
    pinturas.forEach(([m, fn]) => M.pintar(m, fn, g));
    const cBase = new THREE.Color(P.colorBase);
    g.traverse((o) => { if (o.isMesh && !o.geometry.attributes.color) M.pintar(o, () => cBase, g); });

    // ---------------- 7. ANIMACIONES ----------------
    // Pose de carácter (P.caracter.pose): ángulos fijos sumados a todas las animaciones.
    // Claves sin lado ("Brazo") se aplican en espejo a ambos lados; con lado ("BrazoI"/"BrazoD") solo a ese.
    const CAR = P.caracter || {};
    const POSE = {};
    Object.entries(CAR.pose || {}).forEach(([k, v]) => {
      if (hueso[k]) POSE[k] = v;
      else LADOS.forEach((s) => { if (hueso[k + L(s)]) POSE[k + L(s)] = [v[0], s * v[1], s * v[2]]; });
    });
    function giro(nombre, dur, fn, n = 36) {
      const tiempos = [], valores = [];
      const q = new THREE.Quaternion();
      const eu = new THREE.Euler(0, 0, 0, "YXZ");
      const off = POSE[nombre] || [0, 0, 0];
      for (let i = 0; i <= n; i++) {
        const [x, y, z] = fn(i / n);
        eu.set((x + off[0]) * grad, (y + off[1]) * grad, (z + off[2]) * grad);
        q.setFromEuler(eu);
        tiempos.push(i * (dur / n));
        valores.push(q.x, q.y, q.z, q.w);
      }
      return new THREE.QuaternionKeyframeTrack("Hueso" + nombre + ".quaternion", tiempos, valores);
    }
    function sube(nombre, dur, fn, n = 36) {
      const tiempos = [], valores = [];
      const [x0, y0, z0] = hueso[nombre].position.toArray();
      for (let i = 0; i <= n; i++) {
        tiempos.push(i * (dur / n));
        valores.push(x0, y0 + fn(i / n), z0);
      }
      return new THREE.VectorKeyframeTrack("Hueso" + nombre + ".position", tiempos, valores);
    }
    const sen = (t, c = 1, f = 0) => Math.sin((t * c + f) * Math.PI * 2);
    const cos = (t, c = 1, f = 0) => Math.cos((t * c + f) * Math.PI * 2);
    const bipedo = P.tipo === "bípedo";
    const PATAS_T = P.PATAS.filter((p) => p.trasera);
    const PATAS_D = P.PATAS.filter((p) => !p.trasera);

    // Reposo: respiración, cola que se mece y cabeza curiosa
    const dR = 3.2;
    const reposo = new THREE.AnimationClip("Reposo", dR, [
      sube("Cadera", dR, (t) => 0.006 * sen(t, 2)),
      giro("Pecho", dR, (t) => [1.5 * sen(t, 2), 0, 0]),
      giro("Cuello1", dR, (t) => [-1.5 * sen(t, 2), 2 * sen(t), 0]),
      giro("Cuello2", dR, (t) => [1.5 * sen(t, 2, 0.1), 3 * sen(t, 1, 0.1), 0]),
      giro("Cabeza", dR, (t) => [-2 * sen(t, 2, 0.15), 5 * sen(t, 1, 0.2), 3 * sen(t, 1, 0.3)]),
      giro("Mandibula", dR, (t) => [2 + 2 * sen(t, 2), 0, 0]),
      giro("Cola1", dR, (t) => [0.8 * sen(t, 2), 4 * sen(t), 0]),
      giro("Cola2", dR, (t) => [1.2 * sen(t, 2), 6 * sen(t, 1, 0.08), 0]),
      giro("Cola3", dR, (t) => [1.6 * sen(t, 2), 9 * sen(t, 1, 0.16), 0]),
      ...LADOS.flatMap((s) => PATAS_D.flatMap((pt) => P.alas
        ? [giro(pt.huesos[0] + L(s), dR, (t) => [0, 0, s * 8 * sen(t, 2)]), giro(pt.huesos[1] + L(s), dR, (t) => [0, 0, s * 4 * sen(t, 2, 0.1)])]
        : [bipedo
          ? giro(pt.huesos[0] + L(s), dR, (t) => [-4 * sen(t, 2), 0, s * 2 * sen(t, 2)])
          : giro(pt.huesos[0] + L(s), dR, (t) => [0.8 * sen(t, 2), 0, 0])]))
    ]);

    // Caminar: paso alterno (bípedo) o por diagonales (cuadrúpedo)
    const dC = bipedo ? 1.1 : 1.4;
    const PASO = bipedo ? 26 : 20;
    const pataPaso = (pt, s, fase) => {
      const [a, b, c] = pt.huesos.map((n) => n + L(s));
      const muslo = (t) => -PASO * sen(t, 1, fase);
      const rodilla = (t) => (pt.trasera ? 1 : (bipedo ? 0 : -0.6)) * PASO * 1.1 * Math.max(0, cos(t, 1, fase));
      return [
        giro(a, dC, (t) => [muslo(t), 0, 0]),
        giro(b, dC, (t) => [rodilla(t), 0, 0]),
        giro(c, dC, (t) => [-(muslo(t) + rodilla(t)) * 0.85, 0, 0])
      ];
    };
    const caminar = new THREE.AnimationClip("Caminar", dC, [
      sube("Cadera", dC, (t) => 0.014 * Math.abs(cos(t)) - 0.006),
      giro("Cadera", dC, (t) => [1.2 * sen(t, 2), 3 * sen(t), (bipedo ? 3 : 1.5) * sen(t)]),
      giro("Pecho", dC, (t) => [-1.2 * sen(t, 2), -3 * sen(t), -(bipedo ? 2 : 1) * sen(t)]),
      giro("Cuello1", dC, (t) => [1.5 * sen(t, 2), 1.5 * sen(t), 0]),
      giro("Cuello2", dC, (t) => [-1.5 * sen(t, 2), 2 * sen(t), 0]),
      giro("Cabeza", dC, (t) => [2 * sen(t, 2, 0.1), 2 * sen(t, 1, 0.1), 0]),
      giro("Cola1", dC, (t) => [1 * sen(t, 2), -5 * sen(t), 0]),
      giro("Cola2", dC, (t) => [1.5 * sen(t, 2), -8 * sen(t, 1, 0.08), 0]),
      giro("Cola3", dC, (t) => [2 * sen(t, 2), -12 * sen(t, 1, 0.16), 0]),
      ...LADOS.flatMap((s) => [
        ...PATAS_T.flatMap((pt) => pataPaso(pt, s, s > 0 ? 0 : 0.5)),
        ...PATAS_D.flatMap((pt) => (P.alas
          ? [giro(pt.huesos[0] + L(s), dC, (t) => [0, 0, s * 26 * sen(t, 2)]), giro(pt.huesos[1] + L(s), dC, (t) => [0, 0, s * 10 * sen(t, 2, 0.08)]),
            giro(pt.huesos[2] + L(s), dC, (t) => [0, 0, s * 8 * sen(t, 2, 0.15)])]
          : bipedo
            ? [giro(pt.huesos[0] + L(s), dC, (t) => [-12 * sen(t, 1, s > 0 ? 0.5 : 0), 0, 0])]
            : pataPaso(pt, s, s > 0 ? 0.5 : 0)))
      ])
    ]);

    // Rugir: se yergue, abre las fauces y agita la cola
    const dG = 2.0;
    const alzar = [[0, 0], [0.22, 1], [0.78, 1], [1, 0]];
    const boca = [[0, 0], [0.2, 0], [0.34, 1], [0.7, 1], [0.86, 0], [1, 0]];
    const temblor = (t) => (t > 0.34 && t < 0.7 ? Math.sin(t * 90) : 0);
    const A = (t) => M.interp(alzar, t);
    const R = P.rugir || { pecho: -8, cuello1: -8, cuello2: -6, cabeza: -10, boca: 30 };
    const rugir = new THREE.AnimationClip("Rugir", dG, [
      sube("Cadera", dG, (t) => 0.02 * A(t)),
      giro("Cadera", dG, (t) => [-4 * A(t), 0, 0]),
      giro("Pecho", dG, (t) => [R.pecho * A(t), 0, 0]),
      giro("Cuello1", dG, (t) => [R.cuello1 * A(t), 0, 0]),
      giro("Cuello2", dG, (t) => [R.cuello2 * A(t), 0, 0]),
      giro("Cabeza", dG, (t) => [R.cabeza * A(t) + 1.2 * temblor(t), 2 * temblor(t), 0]),
      giro("Mandibula", dG, (t) => [R.boca * M.interp(boca, t), 0, 0]),
      giro("Cola1", dG, (t) => [-3 * A(t), 8 * sen(t, 2), 0]),
      giro("Cola2", dG, (t) => [-4 * A(t), 12 * sen(t, 2, 0.08), 0]),
      giro("Cola3", dG, (t) => [-5 * A(t), 16 * sen(t, 2, 0.16), 0]),
      ...LADOS.flatMap((s) => PATAS_D.flatMap((pt) => P.alas
        ? [giro(pt.huesos[0] + L(s), dG, (t) => [0, 0, s * (30 * A(t) + 3 * temblor(t))]), giro(pt.huesos[1] + L(s), dG, (t) => [0, 0, -s * 10 * A(t)])]
        : [bipedo
          ? giro(pt.huesos[0] + L(s), dG, (t) => [-25 * A(t), 0, s * 10 * A(t)])
          : giro(pt.huesos[0] + L(s), dG, (t) => [4 * A(t), 0, 0])]))
    ]);

    // Saludo: en reposo una mano se agita (solo bípedos sin alas)
    if (CAR.saludo && bipedo && !P.alas && PATAS_D[0]) {
      const sS = 1, b0 = PATAS_D[0].huesos[0] + L(sS), b1 = PATAS_D[0].huesos[1] + L(sS);
      reposo.tracks = reposo.tracks.filter((t) => t.name !== "Hueso" + b0 + ".quaternion" && t.name !== "Hueso" + b1 + ".quaternion");
      delete POSE[b0]; delete POSE[b1];
      reposo.tracks.push(giro(b0, dR, (t) => [-45, 0, sS * 18 + 10 * sen(t, 4)]), giro(b1, dR, (t) => [-45 + 15 * sen(t, 4, 0.1), 0, 0]));
    }
    // Los huesos con pose que una animación no mueve reciben una pista fija con su pose
    [reposo, caminar, rugir].forEach((clip) => {
      const ya = new Set(clip.tracks.map((t) => t.name));
      Object.keys(POSE).forEach((n) => { if (hueso[n] && !ya.has("Hueso" + n + ".quaternion")) clip.tracks.push(giro(n, clip.duration, () => [0, 0, 0], 2)); });
    });
    g.animations = [reposo, caminar, rugir];
    hueso.Raiz.userData.esqueleto = Object.keys(hueso).map((n) => "Hueso" + n);
    return g;
  },

  params: {
    "tipo": "bípedo",
    "brillo": 1.08,
    "luzMand": 1.15,
    "luzPatas": 1.15,
    "mandDesdeCabeza": [10.5, 15.5],
    "inclinacion": 0.35,
    "colorBase": 5919832,
    "iris": 16769126,
    "iris2": 10119680,
    "EJE": [[-0.8, 0.56, 0.0, 0.0, 0.0, 2.0],
      [-0.76, 0.56, 0.028199999999999996, 0.0304, 0.028499999999999998, 2.0],
      [-0.64, 0.555, 0.05639999999999999, 0.06175, 0.056999999999999995, 2.1],
      [-0.5, 0.555, 0.094, 0.1045, 0.095, 2.2],
      [-0.35, 0.56, 0.141, 0.1615, 0.1425, 2.3],
      [-0.18, 0.565, 0.19269999999999998, 0.22324999999999998, 0.19, 2.4],
      [0.0, 0.575, 0.20679999999999998, 0.2375, 0.209, 2.5],
      [0.15, 0.6, 0.188, 0.2185, 0.19949999999999998, 2.4],
      [0.25, 0.68, 0.1504, 0.1615, 0.152, 2.3],
      [0.31, 0.77, 0.15, 0.155, 0.145, 2.3],
      [0.37, 0.85, 0.16, 0.16, 0.15, 2.4],
      [0.46, 0.91, 0.175, 0.17, 0.15, 2.6],
      [0.55, 0.905, 0.16, 0.155, 0.12, 2.6],
      [0.64, 0.88, 0.125, 0.125, 0.085, 2.5],
      [0.71, 0.865, 0.095, 0.1, 0.065, 2.4],
      [0.755, 0.855, 0.06, 0.065, 0.042, 2.2],
      [0.775, 0.85, 0.0, 0.0, 0.0, 2.0]],
    "IMG_EJE": [[3, 15, 3, 3],
      [51.5, 20.0, 6.5, 6.5],
      [100, 25, 10, 10],
      [135.0, 42.5, 13.0, 13.0],
      [170, 60, 16, 16],
      [225, 112, 42, 46],
      [280, 107, 45, 52],
      [330, 102, 42, 50],
      [370, 72, 32, 34],
      [382.5, 54.5, 28.5, 28.5],
      [395, 37, 25, 23],
      [440, 32, 22, 16],
      [460.0, 39.0, 20.0, 13.5],
      [480, 46, 18, 11],
      [492.5, 49.0, 14.0, 8.5],
      [501.2, 51.1, 11.2, 6.8],
      [505, 52, 10, 6]],
    "bultos": [[-0.16, 0, 0.13, 0.034, 1],
      [0.15, 0, 0.11, 0.014, 1],
      [0.46, 0.93, 0.08, 0.012, 1]],
    "HUESOS": {
    "Cadera": [0.565, -0.18],
    "Cola1": [0.56, -0.35],
    "Cola2": [0.555, -0.5],
    "Cola3": [0.555, -0.64],
    "Pecho": [0.6, 0.15],
    "Cuello1": [0.7, 0.26],
    "Cuello2": [0.8, 0.33],
    "Cabeza": [0.89, 0.42],
    "Mandibula": [0.83, 0.4]},
    "PATAS": [{
    "nombre": "PiernaTrasera",
    "trasera": true,
    "padre": "Cadera",
    "huesos": ["Muslo",
    "Pierna",
    "Pie"],
    "cortes": [0.42, 0.78],
    "camino": [[0.13, 0.6, -0.14],
      [0.18, 0.5, -0.14],
      [0.19, 0.31, -0.07],
      [0.185, 0.115, -0.12],
      [0.185, 0.05, -0.11]],
    "radios": [[0, 0.135],
      [0.3, 0.125],
      [0.55, 0.092],
      [0.8, 0.075],
      [1, 0.07]],
    "img": [[200, 155, 25, 25],
      [175, 195, 18, 18],
      [155, 235, 12, 12],
      [146, 265, 10, 10],
      [150, 288, 10, 10]],
    "pie": "terópodo",
    "largoDedo": 0.08}, {
    "nombre": "Brazo",
    "trasera": false,
    "padre": "Pecho",
    "huesos": ["Brazo",
    "Antebrazo",
    "Mano"],
    "cortes": [0.4, 0.75],
    "camino": [[0.1, 0.6, 0.16],
      [0.145, 0.55, 0.19],
      [0.16, 0.49, 0.24],
      [0.155, 0.45, 0.28],
      [0.152, 0.44, 0.29]],
    "radios": [[0, 0.056],
      [0.35, 0.046],
      [0.7, 0.036],
      [1, 0.033]],
    "img": [[320, 150, 8, 8],
      [335, 170, 7, 7],
      [345, 185, 6, 6],
      [355, 195, 6, 6],
      [358, 198, 6, 6]],
    "pie": "mano",
    "colorPie": [358, 198],
    "dedos": [[-0.55, 0.85, 0.95],
      [0.55, 1, 0.95]]}],
    "MANDIBULA": [[0.42, 0.105, 0.036, 2.3],
      [0.49, 0.112, 0.04, 2.4],
      [0.57, 0.105, 0.038, 2.4],
      [0.645, 0.088, 0.034, 2.3],
      [0.7, 0.07, 0.028, 2.2],
      [0.745, 0.043, 0.02, 2.1],
      [0.765, 0.0, 0.0, 2.0]],
    "IMG_MAND": [[445.0, 90.0, 10.0, 10.0],
      [451.7, 95.0, 9.3, 9.3],
      [458.3, 100.0, 8.7, 8.7],
      [465.0, 105.0, 8.0, 8.0],
      [471.7, 108.3, 7.0, 7.0],
      [478.3, 111.7, 6.0, 6.0],
      [485.0, 115.0, 5.0, 5.0]],
    "DIENTES": {
    "sup": [0.52, 0.56, 0.6, 0.645, 0.685, 0.72, 0.75],
    "inf": [0.54, 0.585, 0.63, 0.67, 0.705, 0.735],
    "largo": 0.022,
    "radio": 0.0072,
    "ancho": 0.86,
    "escalaSup": [0.9, 1, 1.1, 1.1, 1.05, 1, 0.9]},
    "paladarDesde": 11,
    "OJO": {
    "y": 0.975,
    "z": 0.5,
    "tam": 1.0,
    "frente": 0.32,
    "img": [430, 42]},
    "FOSAS": [[0.03, 0.915, 0.745, 0.009]],
    "oscuroParpado": 0.7,
    "rugir": {
    "pecho": -6,
    "cuello1": -8,
    "cuello2": -6,
    "cabeza": -14,
    "boca": 34},
    "nombreCorto": "Piatnitzkysaurus",
    "caracter": {
    "ojos": "feliz",
    "saludo": true,
    "pose": {
    "Cabeza": [0, 0, 10],
    "Mandibula": [9, 0, 0],
    "Cola1": [-8, 10, 0],
    "Cola2": [0, 8, 0]},
    "arquetipo": "alegre"}},

  textura: {
    w: 260, h: 152, k: 2,
    datos: "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"
  }
});
