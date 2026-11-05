/**
 * Mini Maximus (Rayo) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte de:
 *   assets/dinos/arte/rayo/maximus_der.webp
 *
 * Maximus: jefe ceratópsido negro carbón con manchas amarillas; cuernos enormes sobre los ojos, cuerno nasal y gola amarilla.
 * Estilo liso chibi rechoncho (referencia del usuario): cabeza grande, gola, patas cortas y gruesas, ojos grandes.
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
  id: "mini_maximus",
  categoria: "mini dino",
  nombre: "Mini Maximus (Rayo)",
  icono: "🦏",
  origen: "assets/dinos/arte/rayo/maximus_der.webp",

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

    // Gola (volante) inclinada hacia atrás, con bultos y espinas en el borde
    {
      const q = lomo(0.42, U_CABEZA - 0.04, 1);
      const piv = new THREE.Group();
      piv.position.set(0, q.y - 0.04, 0.42);
      piv.rotation.x = -0.45;
      g.add(piv);
      const C_CENTRO = new THREE.Color(0xe8c040), C_BORDE = new THREE.Color(0x3a3a40), C_ESP = new THREE.Color(0xeee4cc);
      const placa = bloque(0, 0.38 * 0.62, 0, 0.38, 0.38 * 0.7, 0.028, 0.35, "Gola", 32, 24);
      piv.add(placa);
      const posG = placa.geometry.attributes.position;
      pintarLuego(placa, (i) => {
        const r = Math.hypot(posG.getX(i) / 0.38, (posG.getY(i) - 0.38 * 0.62) / (0.38 * 0.7));
        return cTmp.copy(C_CENTRO).lerp(C_BORDE, suave(0.78, 1.0, r));
      });
      for (let k = 0; k < 12; k++) {
        const a = -Math.PI * 0.62 + (Math.PI * 1.24) * k / (12 - 1);
        const b = bloque(Math.sin(a) * 0.38 * 0.98, 0.38 * 0.62 + Math.cos(a) * 0.38 * 0.7 * 0.98, 0, 0.034, 0.034, 0.034 * 0.8, 0.2, "BultoGola", 10, 8);
        piv.add(b); pintarLuego(b, () => C_BORDE);
      }
      [].forEach(([gr, largo]) => {
        const a = gr * Math.PI / 180;
        const base = V(Math.sin(a) * 0.38 * 0.9, 0.38 * 0.62 + Math.cos(a) * 0.38 * 0.7 * 0.9, 0);
        const dir = V(Math.sin(a), Math.cos(a), 0).normalize();
        const c = punta([base, base.clone().addScaledVector(dir, largo * 0.5), base.clone().addScaledVector(dir, largo)], 0.026, "EspinaGola", 12, 10, 0.9);
        piv.add(c); pintarLuego(c, () => C_ESP);
      });
      colgar("Cabeza", piv);
    }

    // Cuerno (z=0.52, x=±0.085)
    [-1, 1].forEach((s) => {
      const h = superficie(V(s * 0.085, 2, 0.52), V(0, -1, 0));
      if (!h) return;
      const b = h.p.clone().add(V(0, 0.0 - 0.01, 0));
      const d = V(s * 0.085 * 0.6, 1, 1.0).normalize();
      pintarLuego(colgar("Cabeza", bloque(b.x, b.y + 0.005, b.z, 0.04 * 1.25, 0.04 * 0.9, 0.04 * 1.25, 0.1, "BaseCuerno", 12, 10)), () => PAL.lomo);
      const c = colgar("Cabeza", punta([b, b.clone().addScaledVector(d, 0.3 * 0.5).add(V(0, 0, 0.3 * 0.08)), b.clone().addScaledVector(d, 0.3)], 0.04, "Cuerno", 14, 12, 0.85));
      pintarLuego(c, fijo(0xeee4cc));
    });

    // Cuerno (z=0.665, x=±0)
    [1].forEach((s) => {
      const h = superficie(V(s * 0, 2, 0.665), V(0, -1, 0));
      if (!h) return;
      const b = h.p.clone().add(V(0, 0.0 - 0.01, 0));
      const d = V(s * 0 * 0.6, 1, 0.6).normalize();
      pintarLuego(colgar("Cabeza", bloque(b.x, b.y + 0.005, b.z, 0.03 * 1.25, 0.03 * 0.9, 0.03 * 1.25, 0.1, "BaseCuerno", 12, 10)), () => PAL.lomo);
      const c = colgar("Cabeza", punta([b, b.clone().addScaledVector(d, 0.08 * 0.5).add(V(0, 0, 0.08 * 0.08)), b.clone().addScaledVector(d, 0.08)], 0.03, "Cuerno", 14, 12, 0.85));
      pintarLuego(c, fijo(0xeee4cc));
    });

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
    "tipo": "cuadrúpedo",
    "brillo": 1.0,
    "luzMand": 1.15,
    "luzPatas": 1.15,
    "mandDesdeCabeza": null,
    "inclinacion": 0.35,
    "colorBase": 9071184,
    "iris": 3811872,
    "iris2": 657414,
    "EJE": [[-0.56, 0.34, 0, 0, 0, 2.0],
      [-0.52, 0.35, 0.035, 0.04, 0.035, 2.0],
      [-0.44, 0.36, 0.07, 0.08, 0.07, 2.1],
      [-0.34, 0.38, 0.12, 0.13, 0.12, 2.2],
      [-0.22, 0.41, 0.19, 0.2, 0.19, 2.4],
      [-0.08, 0.44, 0.25, 0.26, 0.24, 2.6],
      [0.06, 0.44, 0.26, 0.27, 0.25, 2.7],
      [0.19, 0.42, 0.23, 0.23, 0.22, 2.6],
      [0.28, 0.44, 0.17, 0.17, 0.16, 2.4],
      [0.34, 0.47, 0.16, 0.16, 0.15, 2.4],
      [0.4, 0.51, 0.18, 0.18, 0.16, 2.6],
      [0.48, 0.54, 0.19, 0.19, 0.16, 2.8],
      [0.56, 0.52, 0.16, 0.16, 0.13, 2.7],
      [0.63, 0.48, 0.11, 0.12, 0.1, 2.5],
      [0.69, 0.44, 0.075, 0.09, 0.07, 2.3],
      [0.725, 0.41, 0.04, 0.055, 0.04, 2.1],
      [0.74, 0.395, 0, 0, 0, 2.0]],
    "IMG_EJE": [[3, 200, 3, 3],
      [31.5, 195.0, 7.5, 7.5],
      [60, 190, 12, 12],
      [90.0, 180.0, 17.0, 17.0],
      [120, 170, 22, 22],
      [190, 170, 60, 62],
      [260, 160, 70, 74],
      [330, 165, 60, 66],
      [370, 150, 40, 40],
      [385.0, 145.0, 37.5, 37.5],
      [400, 140, 35, 35],
      [430, 140, 30, 26],
      [445.0, 150.0, 25.0, 20.0],
      [460, 160, 20, 14],
      [470.0, 167.5, 15.0, 10.5],
      [477.0, 172.8, 11.5, 8.1],
      [480, 175, 10, 7]],
    "bultos": [[-0.08, 0, 0.14, 0.03, 1],
      [0.19, 0, 0.12, 0.025, 1]],
    "HUESOS": {
    "Cadera": [0.44, -0.08],
    "Cola1": [0.4, -0.22],
    "Cola2": [0.37, -0.34],
    "Cola3": [0.35, -0.44],
    "Pecho": [0.42, 0.19],
    "Cuello1": [0.44, 0.28],
    "Cuello2": [0.48, 0.35],
    "Cabeza": [0.53, 0.44],
    "Mandibula": [0.46, 0.5]},
    "PATAS": [{
    "nombre": "PataTrasera",
    "trasera": true,
    "padre": "Cadera",
    "huesos": ["Muslo",
    "Pierna",
    "Pie"],
    "cortes": [0.42, 0.78],
    "camino": [[0.14, 0.4, -0.1],
      [0.2, 0.33, -0.1],
      [0.21, 0.21, -0.08],
      [0.21, 0.09, -0.09],
      [0.21, 0.045, -0.09]],
    "radios": [[0, 0.15],
      [0.3, 0.142],
      [0.6, 0.132],
      [0.85, 0.128],
      [1, 0.127]],
    "img": [[190, 170, 60, 62],
      [330, 165, 60, 66],
      [400, 140, 35, 35],
      [190, 170, 60, 62],
      [260, 160, 70, 74]],
    "pie": "saurópodo",
    "unas": [-0.6, -0.2, 0.2, 0.6]}, {
    "nombre": "PataDelantera",
    "trasera": false,
    "padre": "Pecho",
    "huesos": ["Brazo",
    "Antebrazo",
    "Mano"],
    "cortes": [0.42, 0.78],
    "camino": [[0.15, 0.38, 0.2],
      [0.2, 0.31, 0.2],
      [0.21, 0.2, 0.21],
      [0.21, 0.09, 0.21],
      [0.21, 0.045, 0.21]],
    "radios": [[0, 0.135],
      [0.3, 0.128],
      [0.6, 0.118],
      [0.85, 0.115],
      [1, 0.114]],
    "img": [[190, 170, 60, 62],
      [330, 165, 60, 66],
      [400, 140, 35, 35],
      [190, 170, 60, 62],
      [260, 160, 70, 74]],
    "pie": "saurópodo",
    "unas": [-0.6, -0.2, 0.2, 0.6]}],
    "MANDIBULA": [[0.5, 0.11, 0.035, 2.4],
      [0.57, 0.105, 0.034, 2.4],
      [0.63, 0.085, 0.03, 2.3],
      [0.68, 0.06, 0.026, 2.2],
      [0.71, 0.04, 0.02, 2.1],
      [0.725, 0.02, 0.012, 2.0],
      [0.735, 0, 0, 2.0]],
    "IMG_MAND": [[440.0, 180.0, 8.0, 8.0],
      [446.7, 183.3, 7.7, 7.7],
      [453.3, 186.7, 7.3, 7.3],
      [460.0, 190.0, 7.0, 7.0],
      [465.0, 191.7, 6.3, 6.3],
      [470.0, 193.3, 5.7, 5.7],
      [475.0, 195.0, 5.0, 5.0]],
    "DIENTES": {
    "sup": [],
    "inf": [],
    "largo": 0.01,
    "radio": 0.004,
    "ancho": 0.85},
    "paladarDesde": 14,
    "OJO": {
    "y": 0.6000000000000001,
    "z": 0.53,
    "tam": 1.2,
    "frente": 0.3,
    "img": [430, 140]},
    "FOSAS": [[0.03, 0.51, 0.67, 0.008]],
    "oscuroParpado": 0.7,
    "rugir": {
    "pecho": -3,
    "cuello1": -4,
    "cuello2": -4,
    "cabeza": 10,
    "boca": 22},
    "estilo": "liso",
    "mezcla": 0.2,
    "colorUna": 9411244,
    "colorGarra": 15656140,
    "zigzag": {
    "base": -0.28,
    "amp": 0.14,
    "periodo": 0.2},
    "filasLiso": {
    "cabeza": 99,
    "cara": [99, 100],
    "pico": [13.7, 14.5]},
    "nombreCorto": "Maximus",
    "paleta": {
    "lomo": 4079172,
    "panza": 14208132,
    "pico": 14209216,
    "patas": 4868688,
    "aleta": 1973794},
    "patron": {
    "tipo": "manchas",
    "color": 15253568,
    "escala": 1.4},
    "caracter": {
    "ojos": "molesto",
    "pose": {
    "Pecho": [6, 0, 0],
    "Cuello1": [6, 0, 0],
    "Cabeza": [12, 0, 0],
    "Mandibula": [6, 0, 0],
    "Cola1": [-10, 0, 0]},
    "arquetipo": "embestida"}},

  textura: {
    w: 260, h: 167, k: 2,
    datos: "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ZVxahnt2npWKuLKWd3BYY15WcnFubGtnYFxWX1dPg25RvZhWxphL1aVM4qlIxo02q3sysoY9vZBBvZA5pngoqnwtu4s1yZM+wpBAr4A3o3YvoHEmm2wimWwolG0wjnA5fWc6aVpEVUpEUkxGQD05LispMi8tUk9MbWpoX1tZSkRAaF9VcmJNbFM2a0wmjGcponkqp30pn3UoonwqpYIvpoYzoH8znoBAppBjpJV0mot1lIZ3l4p6nZF9npR6pZ2AlpB2jo13kpF5jolzenNrVE1KRkA6Qz44Qj05PTk1RkI8Uk5HWFVMW1dPXlpSc25mcmtlV1BKTUVATUU/Rj86Qjw3Qz04RD06RD46SEI+Qj05Mi8sLisoLSooLCkmKiglJiMhIh8eHh0bHRsZPDQuQDgxRj03V09IamNcb2dhe3JropqUt7GqpJ6Yj4eBioF6bWRcXlVMWlJIV1BGVE9FUUxCTkpCTUlBTEdATEc+S0U+S0U/TEU/S0M+SEA8QDk2OjYyNTEtMS4qMC0pMCwoMCwoMC0pMS0pMS4pMS4pMS4pMS0oMS0pMC4oMC0oLywoLysnLSsmLSolLCkkKygjKicjKiYiKiUhKSUhKSUhKSUgKSQfKCQgKSQfKSUfKiUfKiUfKyUgKyYgLCYgLSchLiggLykiLykiMCoiMSskMSsjMSskMiwlMiwlMy0lMy0mNC0mNC0lNC4mNi8mNzEoOTMrPDYvQDs0RUE6SkU+TEhBTkpDT0tDUEtDT0pCTkhATklAUUtCVE5DVE5CVk9BV1FDWVREXFZIbGdahH5zkouBlY6Dk4yCi4V8gntxhHtwjIZ3gHlpfnNegXNch3VVjHpXi3hWiHRRjnlPnIhYpJFerJhgpI5cnYhXootbqZJdtZ5cwqRfx6RfxaJZx6JXxJ9YwJxZvZtYvZtXuplXuZhduZhhp4ZQpINMpYJKon9CsotGupFDuIw9uYk+vopBvok+xI4/2KJZ1atlybCBwa2OqpR8no+Ej4mHlpGRoZucmJOTi4aDfXdzY1xYYldVjHx7jXtyno1uppl0f3ZkbmtkamVhYVpVaV5SqJFw3bRm0J1BxJM/wpE9xJE+vo5DvY5DwpFCvYw8sYEzs4U0uo03wo86wYs5u4EzsnkvqXQoom4moW8umGwvjmswhGo2b19CVUk/UkxFSUZBOjc0PTo3R0NARD88NC8rUkxJiIJ8dmxYhm9NdFYwh2QvnHMvmXAlj2cgjWYikm8olHUqlXgtmXs0noJCoolXpo9rrph9tqGFsp58q5hurZxutqV5r5tzppVuppuEhn13U0tJRT86SkQ/VlJOTUlFTkpEV1RMcG1kZWFaU09IUEtEXFZQX1pUU0xGTkZATkU/SEE7RD46RUA8RkE9SEI/SkVBPjo2Ly0pLiwoLSonLCkmKCYkJCIfIR8cHh0cNi4oOzMsQjkyRj43V09JbmZgeG5qfnVwkIeCmZKMs6uku7KqlIuDa2NZYlpQYlpOYllNXVRJVU5DUUtCUEtBTUhAS0U9SkM8SUI8SEA7SEA7R0A8RkA8RT87QT05PTk1NzQvNTItMi8qMS4qMi4qMi8qMzArMzArMzAqMzAqMi8qMi8pMS4oMC0oMCwnLiwmLiolLSokLCkjLCgjLCciLCciKychKyciLCchLCciLSciLSgiLSgiLighLygiMCkiMSoiMSojMisjMywkNC0lNC4lNS4mNS4mNS4nNi8mNS8mNi8mNzAnOzQsPzkxQTw0QTs0Qjw1QTw1Qj02RUA5SEM8S0Y/TkpCUEtDUUtDU0xEVU5FWlJIXVZJXFNIWVFGXVdKY11QZmFScW1eg35zj4iAlo+GopuPoZqOf3dscGhea2FUbGNJd2pGi3RNnH5Mo4FDnn5EpIVJsZFNt5lPu59WtJpVuJxZwaRevaBYwaRcxKhex6pbyqlZzKZVyqJRxZ5Sv5tRvppUvJhXvJpVuZdWtJRYs5NZsJFVr49SrotMtpFNupVMuI5Duo5BwpJFxpJDxZA/y5RD0JlP0qRc1buKzbqarJN7oY19p56RuraqwLuwsKuekY2CkIyCmJODhXxumYp8uaSC5c2O69ifppd3dmpgb2VhbGJcfW1ct59668V41KNHxZJAvYw9wIs/wIlAuoY7vYs4vYo4uIM2tIE1s4Y2soY1uIMwvX0qvHwrsXomo24onWsukWctiWUuh2w8inxWcWdRUUhLXllaZGJfUlBNQT46ODQwOzYyZWBcg311iH5ql4FefF85flwtg10mg2AfjWonhmMog2ImgWEkhGUlkXEnl3Ypm3cynno+nXtGmHZHl3VEm3tDnoBDpYxUoIRRn4hmmY17enFpYltYbWZiZmBbZl9bXVhTV1NMVVFKc29pamdgU09JU09KYFxWdHFqdHBpWlRMUElCT0hBSUI9RkE+SEI/SEM/SkVBSERAODUxLiwoLisoLCknKiglJyUiIiAfISAdNC4nNjAqPTUvQjkzRz45U0tGa2JdeG9qdWxnfXVwoJeQp52UmI6Gj4d9kIl+hX5zb2dbZFtPXlNGV01BVEs/UUpATkhAS0Q9SUE8R0A6Rz87Rj87RkA8SEI+SkVBSkZDSkZCSUZAQ0A7PTk0ODUvNjMuNDErNDErNDErNDErNDErNDErMzAqMy4qMi8pMS0oMS0nMCwnLywmLyskLyokLiolLikkLykjLykkLyokMCokMCojMSsjMiwkMiwkMywlNC0lNS4mNi4mNy8lNzAnODAmODAnODEnODAnOzQrPjcuQz01SkQ9TkpDTkpDS0c/R0I7RD83Qj02Qj02RT83SEI6S0Y+T0lAU0xDWlJIYlhNZFpOY1lNYlpOZV1TZl5VdnBlg31xhYFygX1se3hqhoJ2jYl+n5qOmpCFdmlbcmRSfW1Uk31RoYVJqoVHuIxFt49BtZFFtZNHt5dEvqJHwqVNwKRPwKNTx61dxaxbxKpZxKtZxKxZya9cxqZRwp9MwJxPvJdOvZhWvZpau5pYuJhXuZhcvJpevJlYuZVPuZFIwJZJvJNCwJNFxZVIyZZDzJU+xY03xI04ypVBy5xGvZtZppBpmYRrppJ6xLSX3te75uLH2M6wy8So1dO41tOv0s2p1cee0bd748Vz48yJtqN8fmxbb2BdbmJgaVxSfWlNxKJj06RSyJJAwow9wYo+w4lBwIo5v44xv4wvvYU0tn81s4A0sIExtIInvH0ivoEir30io28nn2wsmm8zk240iW47h3hSfXNgdWtrf3p5ioiFaWhkTUpHSkdCR0M+X1tXbmhgfXBef2dOfGJAcFMma0ocdVMaimsni2srhmQphmQohWEhimUikWwplW8tm3QukWkohl0klGssqH82pH4zoYZGnYxhiHpihHlqgnp0cWtodnBrenRvZWBbXllTYFxVk4+HfXpzVlNNTkpFWVVQbGdigHt1lJGIgn51XllQU01FT0pCSUQ/SENASURASURASkZCQz87MjAtLiwpLSsoKykmKCYkJSMiIyEfNC4oNTArOTMuPjcxQjo1Rj45UUlDZFtWcGhjcWtlcGxkdWtjlIqCopqRtrClt7Kmo56Sg3tvZltPXlRGXFFCWVBBVU1AUEg/TUQ+SUI8SD87Rz87R0E8SEI+SURAS0ZDTElETkpFUExFTkpDTUlBSUU8Qj82OzgxOjYwODUuNTIsNTIsNTErNDAqNDAqNDApMy8pMy4oMi4oMi0nMi0nMS0mMSwmMiwmMiwmMi0mMy0mNC0mNC0mNS4mNi4lNi8mOC8mODAnOTEnOjIoOzIoPDMpPjUsQTgvRz84T0lCVE9KVlFNV1NNVFBKUExETEdASUM8R0A4RT83RD42Rj83SEI6TUY8U0tBXlRIZ1tQaV1SaV1SaWBUdGxihX13hn95gnx0g35ziYR3enVodXJleXZpenZqeHBkdWZWhG5Ul35Xr5BbwZhRv5JAvI49wJBBwZQ9xJtAwZxDu5k+v51Awp5Ewp5Fw59JxaVWx61fwqxawq1bxLBfxaxbv59Qu5tRu5pVu5lRvppYv5tfvpxgvp5dv59fv51ewp1ZwJhQwJJHv5A8xJY80J9G2KBI0pY7zZEzyI4vwosyxpM4yZ08qIk/b1wyX081iXZau6V/zLmN4dWp4M2c4c6Z5Nmi4tun5dys3sqOz6tb1KtR2L543cubtaR7fG5db2JeYldPbV1HoH9KypRCx446wYw7wo08xZFAxpdAxJY5wY8xxI0wvIc2uYE1u38yuoElu30htnsks4AvwYc5u34xp3QumnAyh2czgWg+emxXe3Jrg393enhxbGpkYF1YXFlTW1hSYl5ZaGBWf3BbiXJYhWlBdlopbU4fcE4Wimshjm4piWUqjGYqjWMhkGUljGcsi2csjmwuh2QsiWMqmnMuq4Q4pYU9no1XiYBmcWlddGtlhH17f3l2cW1oenZxdXFta2dic29po5+Zh4J9VFBLTUlFU09LamZheHVtkI2CnJqNfXpuXFhOV1NJUU1GS0ZCSUVASERASEVASUVBPDk2LywpLisoLCknKSclJyUiJSMhNTApNzErOTQuPDYxQDg0Qjo2RDw4SUE8WVNMamVda2decWpjgHlyh4B3rKaburWpv7itsamclIp7gHdmbWNRZFpIX1ZEWVBBU0s/T0hATUU/SkM+SUM+SUM+SkVBS0dBTEdDTUlDTUlCT0pDUEtCUU1CUExBTUo+TEk9SEQ5Qj82PTsyOjYvOjYuNzQtNTErNTEqNDApNC8oMy4oMy4oMy4nMy4nMy4nNC4nNC4mNS8nNi8nNy8nNzEnOjIpPDMqPTMqPTQrPzYrQTguQzgwRjwyS0E6UEdAVUxHV1BMV1JNV1JNVVFLU09IUUxFT0lBTEY9SUM6SEE4SEA3SUI4TUQ7UUg9WU9DYVZJaV1SeW1ijIF1jIR4i4R5i4N8j4iClY+Ho5ySlI6DfHdwcGtlaWJbeW1lgG9gj3dUsI9euJNTv5RGyJU9xZE0xZI3x5Q8x5U7xpY6v5Q4vps+wJ5FwJ1GwJxGwJtFvppFv5xGv6FKx61YybNiwaRTuphPupxeuqBkvqFkv55kv5piyqZmx6Rfwp9Yw55XzqZd0aZZ0KNTzaBNyJpIyJhF2qRP2p5Ez5IxzI8uxY40uIouvJc1qYs/b1wvVUUnbVg8sJlwvqV2y6932LRp1rNd1rps2sWB2MWF1Lpx0axU1K1N28Bw5NWc39Shppt6dGhZYFZHbmBGiGw5vY4/zJk9v5A1wpQ8x5hByp9Hw5xEuY46vo82vYs4uIA4vIE0vYcpwIsprnglu4U/3aJX0I8+r3YsmGorg2Eufl8yfWNCcGVWbWdcaWRZYl5VXllQYl1VbGdgZWBZYVpMdGZOi3BKlHE7d1olcFMkdVYghGYihmQihl4limEll20lonswjmwsfV0gi2wuj281kG41lnQ4mXo+jHRJfG1WcGZbaWJccGplfndzeXRwgn95lZOOkY6JdnJtd3NueXVwb2tnVVFNUEtITElFTUlFb21kfnxwlJODm5mJfHltYl5VXFhPUk5HSUVASERASEM/SERARUE9NDEuLSsoLConKiglJyYjJiQiNTErODItOzUwPjczQDk1QTk1QTo1Qjs2R0A6UEpDYlxVbWZeZmBYZ2BXjIZ8p6CWrqearaaXs6yZrqOPm5B7hHtobmZUYllIXVRFXFNGW1FHV01GUklDT0hDTUhDTUhDTEhCTUhCTUhBTUlATkk/T0o/T0s/T0w/T0w+Tks+TUo+Skc7SEQ6R0Q5REE3Qj01Qz42RT84QTs0PDYvPDYvPDYvPDYvPDYvPjgxRkA5Rj85RD43RD00RDszRjw0ST00SDszSDsySDwzST00Sz42TUE4UEQ9UUhBVEtEVU1IVlBKVlBKVlBKVFBIU01FUUtCUEg/TkY8T0Q7UUc9VEo/U0k+VEo+XFFFbGJVg3dsn5OItqmfn5aKiYN3i4R6j4h/npiQp6CXhX51dG9oamVgb2RbinZloYJiu5VPyJpHy5g+yZY2xZU1xZg9yJtCxpk8xJc8wZc9v5tBw6hQw61ew6xivaZau6FRvqFMuptEtZI8yKhRya9YvJpJvpxcyrGAzbqN0rqQza1/yaJm0KdZz6RX0KVX06hW1qpY2axb2Kxf1qxgzJ9VxZhU1KJa36dT258915o5zpQ6u4szsoozsoo5n3s+kG49k3dOtaB7u6R9xaRr1ahU1atO17Vi279t0LRjz65a17ZV2rxU2cFl2cqE0sqSubCEgndfZ11Hb2RDeGg4wKJX27Rdx59Gy6FHzqVJy6NJwppHvJRDwJRFwJRIv5NPwZlQxKFRx6NTxp5XxJhW06JgyZJMqnUwk2cphmEug18ygl00c1pBZVhJY1hJZ15Qc2lei4N5dG1lWlRNVlFGe25OqYZQnXc9dVUicFEic1gjcVgae1gajWEjjmIjnHQrp4U2lHQxf2AkimoukXI5k3Y+inBCeWNDYlNKVEpRWE5WZV9dcGtlbGdiVFFNbGplk5CMiIWAXllVX1pWZmJecm5qWFRRSkZFVFBPSEVCVVNMenltjIt7paOSpKGUgX10ZmJYXVlQT0tFSEQ/R0M/R0M/SURAPTk2LiwpLCknKigmKCYkJyUiNzMtOTMwPDYxPzk0QTo2Qjs3Qjs3QTs1QTo1RD02S0Q9V1FIZV9WaGFYZ2FXc2xjioN5mZKFpJyKq56Js6iRs6uWm5SAd25ea2JTZ11RaF1RZVlOYVRLW1BIWE9IV05HUkxFUEtDTkpCTUlATkk/Tko+Tko+Tks+Tko9TUk9TEg9S0g8S0c8S0c8TEg8TUg+UEpAU01EVE1FVU1GWFBKWVFMWVFNWFFMVk9LVlFMVU5JUUpFT0hBTkQ9TUI6TUA4TT83TD82TD81TD41TD81TkE4T0M7UUY/VEpCVUxGVk9IVlBJV1BJWFFIWFFHWVFEV05BWExBWk1CWk1CWUxCXlNIal9Tf3VolIl9louAlYp/mIyBhX1xjoZ8lo2Ej4d+hn54f3dvc2tjdG1oeXNplYl4ppBzrYtbvpdEzZ0605s0zpoxyKRDyqxWx6VQw6JHxKZLwaRMwqpRw7BZvatfu61lvK5iv69ixLJjxrNhxq9exqlVv59Iu5VIwqBmv6Z7r6CDt6OEyax70K1k06dO16ZQ2KZRzJk9zpw+1aZM0aVSz6RVxpRKxY5IzJFC0JE30pEu3qI/5a5S2KZOuos1uIY2vopHtohKupdgwa2IvKuKup1wwplXwZZLw5xNwZ5Kx6JNyaJK0a9O17tV1cBh08V1ysF7yL+Go5dxfnJUbmVEiHxIzbZn1rVmyqNR0qlO1KxIyqFGu5FAv5VExJpQxp5bz6xtyq1tqpZfjn5ToY1gvaFowZtcuYtInnMxlW8vj2sxiGAwglkwe1k1b1k9bVpAeWRKj31op52QhX50V1FJb2dYq5pztZpoqotYimg2d1cla1Aca08aiF8llmYmlmgqmHAxmnc2lnY4ims3imw8j3VIh3BHbFxAT0Y7RkJCTEVLVU5UaGNjb2lnWlZTR0VCQ0E9WlZTXFhUTklGU05LZGBednFuVFBOQz8+T0pJUExKSkdBamhdl5WHpaCVramgpKCWeHNqZmFXWlVMSkZASEM/SEM/SURBRUE9MS8sLCknKigmKCYjJyUjNzMuPDYxPzg0QTo1Qjs3Qzs3RDw3Qz03Qjs2QTs0QTszRD82TEc+W1VMY1xSYlxTcWphe3Rph39vl415oZiDsquWqqSQmpKBkId4iH5xf3RpeG1ibGBWZVlPY1dOYldNX1RMWVBHVU1EUk1CUUxBUEs/T0s+Tks+Tko+TUo9TEk9TEg9S0g8S0c8TEg8TUg+T0k/UktCVU5GWVFKW1JNXVVPXVVQXFRPWlJNVlBLU01HUUpDUEhATkU9TkM7TkI5T0I4T0E3TkE3TkE2T0E3UEM5UUU7U0c+VUpCV01EV09GWFBHW1RJYFlKYFlJYFhGX1RGX1NHYFNIZltOcWZakYZ9oJWMn5WJmpCDi4J4iH5uhnxmjYRukol7k4qCiYJ8enJxdWxkc2tibWRhamJahHlsjn1nemdHbFsxk3g5wJhD1LBXzbhhw6tUwp9IxZ1JxqdTxKxXxK9YuqhUq5hMq5hQt6ZbuqlfwK9ix7hlxrNguZ1QrYk/vpdSuptnkH9la2ZgaF9XkHtZwqFh0aVS2aZH2KBDzZI50ptA0p9D0J5Fz5xFxY87wok2yY05zYw1yoYmzYwm4KZD5q9W0ZtDxY08xo5It4NEuJFZwqh/wrCOsphznHdJnnM7sH46r3YqwIw4zKFDzalH1LRU1rxk0sJu0MNu1cR+yLV5qJVel4VPrZVRza1bz6pXxp5Iy6FGzZ8+xpY+w5pMy6Zf0qpm1bFw1bh/uqRzh3pfaGFXbmNSnopdwZ5cuoxFnXUwlncwknEuimIriF8wimQvh2UvgWE0gmU8inBMfnFgamNZZF1TbmZYkINqqZl7nottinNTnIJYjHE8hWErnnAzqn41p341oHk2nHc5m3pBkndMh3JThXVZal9OSUQ+PTs4Q0E/R0JCUk1OX1pbXFdVTElGQkA+QkA8QT86Qz87TEhET0pHXVlWZmJfTkpHQT07SERBTUpGUU5JYFxUkY2CqqWcq6adsayikYyCbGZcYFpRT0pDSEQ/SEM/SkRBSkVCODUyKyknKigmKCYjJyUjLionNDAsPjg0Qzw4RDw4RDw4RT04RD03Qz43Qj42QDszPTgwPjkwRD41Tkc/WVJKXVZNVk9FYltPfXVnj4d2npaFnpWFm5KCnpWFp52Qq6KXrqSajoJ4eG5ieG5jdWthamBWY1dNXVJIWlFFWVJEWlRFWFRFVFFDUk9BT0w/TUk+TUk+TEk9TEg9TUg+Tkk+UEpAUkxCVE1FV09IWlFKW1JMW1JMWlJMWVFKVk9IU01GUkpDUElAUEc+UUY8UUQ6UUQ5UUQ4UkQ4UkQ3UkQ3U0U5VEY6VEg8VUo/VUxCV05FWlJHXlZKYVpMaGFRbGRVa2FUcGVZg3ZqnJCCsaaYs6idp5uRo5eIopaIm4yBoI1usZ1qsp1tl4dwgXlzeXNqeXFnd29kcGZeZlxWYVdRZltUZ1tTW1JIS0c9WE4/inZOyLN20795xapSx59Ex5lFwJxLw6hVw65avapXuqpbvq5fu6ZZuqNXwKxfx7dmyLNjt5xSs41JyKFfv6J4eW5iU1NPR0NBYVJEsJNm2bBp2adM1Jw9zpQ72qJJ0ZxC0p1F0ptDyJE4xpA4zpU+0ZM70o4u1JIr15gzz5M8xIo6xpBDypVOwpFRwJplwqR3p5RziHFTjmxCnHZCr4FDs3s5rXcvwJM70KpJ17RT17ph0blmya1ay6VWzKxhy65izrJfzKxV0KdM0qlFyqJCxp1HvZZCw55PxqZjz7R31ryB0rd/uKR4joVrdXBnbWZlb2VcqJBs1K1zyppSnHUtj3Epj28mhGEah2EimHEulGsqiGEvgWQ6j3xWiX9seXFnY15VVE5HWFJKbGVcaWFabmJYnIxxoYpgl3U/oXo6p4I4poE4oHo7oHxApYZSoopof29cZ19UXFlUVVJQREJAQD48Qz8+S0dGTkpJSUZEREJATUtJUlBNQ0E9NzMwMS0pOjYzZGBdYV1bSURDR0NATEhFTUpFXltWaGNcgn50qaWcq6adr6mfpZ+Vd3FoYFlQUkxESURASUVASkVBTkhFQD05LCooKSglKCYkJyUiKickKyckLysoPTczRz87Rz86RT45RD44Qz43Qz42Qj41PzsyPDYtOzUsPTYuQjszSUI5TkY9TUU9WlFJcGhehHtxm5GGoZiMpZyOp52QsqmfvrOqsqmco5yOqaKVqaCUlYt/gHZqb2VZZFtOYFlKY15NZ2NRZ2NTYl1QWVVIVVFFUk5CUUxBUExBUEpAT0o/UktBU0xCVE1FWE5HWVFJWlFLW1FLWlFLWVBJVk9HVU5FVExDU0pBU0o/U0g9VUk9Vko9WEo9WUs8W009XE08Wko6V0g4U0c4U0g8VEtAV09EW1NIYFhMcGlbhoBwjol4jIZ2koh7npGFrqOVtqqdo5iIlop2npJ9tKSPrZZ9nHxMq4Y/xaNiloNke3FijIBnkIVne3FeaF5VXlRMW09KW09KXVFOWlBMUkpITkZFX1RHn5Nt0cWPybVywp9Qxp5Jwp5Mw6dUwqxXwbFbwbVfxLVfxa5dwqdWxbJiy7tvzblty7Jkzali06xtzK+JenBlUlNHRkI6UUM7oIxw5cOL3bBd2qhK2KFF2KJI16NK2KRL051D0ZtB2aVJ05w/xIgq05Av2pcw2Zs3xokywIY2wo5GxplaxaFqtZhrrZp3k4x3fHJflH1cpYJQq4JHpXk7nnEzsYU7zaNM3LVY1rle0rpq0rhyzKlezKpb07Vh1bVazKdLzaNJ0qtPy6lUwqFYvaVuuah5o5NupJZyqZt5m49zgHtpc3JldnNsd3BucmtloY5007OCzKZlpHs6kWwqiWYkhGIckG0kq4c8sodTsYxzpI5+l4x9kIl/h4F4WlVORkM9RkRAT0tKV1RVXFlUdW5cmo1xqpNpm3xHl3U3on07pH9EoIBNmoFahnVha19aZFtWYVtWVlNQQ0BAPTo6Qj49R0RCSEZEQkA9RkNBTktKS0lHRkNCNjIxKSUjMy8tVE9NTUlISERCV1NQWlZTWFVQZGJcc25of3tynpiRraefqqSaraediIJ4X1hOUktDSkVASkVBS0ZCTklGSUVCMC0rKSckKCYjJiQiKiYkKicjKiYkLionOjQxRT45SEE7RUA5RD83Qz82Qj41QT40QDwyPTguOzQrOjMqPTUtQzszSkE7TUM/SEA7UEpEbGRei4J6opmOoZiKppySrqSas62fq6eWqqSVtKyesKeao5qNmpCDgHhqdG1ed3NjdnJicW1ebGdZZV9SYVxPYFtOYFtNXVdKV1JGVU9EVE5DU0xCU0xDVk1FV05GWU9HXFFIXFFJXVNKX1VKXVNIWU9EVUtAU0o9VEs9WU9BYVVHZ1lJaFlHaVlFaFdBYlE8Xk47Wk07V00+WU9DZ15Ucmhedm1hhn9wkYt7kYx8joh5kYZ4l4p+rqGXrJ+SjYBqgnVYhHZUjnlVjm1CkmYtmm4ro4NGf29LjXxctZprnY1kcWdUaF5WYlpOW1JIXlROYldVWExPUkRMU0VDUkg6eHBVrad/rqF0tZtZxahTya5XyK1Xxa1YwrJbwLdexbZgx69YxKdTybRjzr1z0L1x1b5t17hw17Z7xKqDcGpZXF9MWFRKUEI/jHde5MOA4rhi3a9Z2KdU2KVR3a5U2qdL0aBC16dJ26pM06A/yJMv1Zcz15gz05U3yYw1zZQ8x5ZLxZ5prZNrmo1smpeAlJSElZKEl45/oIttrIxZroxOqINDpX06uo1C1qlX2bVf1rhj1Lho0LJhz6tX06tU0KBBz59C07Jj1bx8z7V3tqBvlop1fXZsbWliamhhbWxkcG9pc3JseXZwe3ZxeXNwdG1qh3tutZpytZBXmG0vk2gmiGAjhGAmk3Q0s5lhuaCHnoqGlIiKkouJk46IeHNsVlNLVVJLT1BJWFlTX2FcWVpTWFhJe3dinotxknRMpH5DqYM/q4VMoYNcfW5bXlZTXFVZYFhXWFJPQj8+ODU2OTY2QkA/S0hGRkRCPzw7PDk4NTMzMS8vMi8vMi4sMS4sMzAuQj89SERCT0xIXltWX1xXYV5Za2hjd3Nse3ZwjIeAqqSdqqWbqqWZlI+EZF1UUktDS0VASkZCS0ZDTkpGUEtIOTYzKSYkJyUjJiQiKCYiKSYjKiYkKiYkKyclNDAsQDs1RkI6RUE4Q0A2Qj40QT0zQD0yQDwxPjguOzQqOTAoOTEqPDQvQDk0RD05SUM+T0hEYFlTaGBacmlignpxjYZ7qqSXsaucp6GTpJyNnpaIoJiKo5qNnpaKo5+RqKSWm5eJlJCClZGFg35ya2VYamRWaWNVZV9RXllNWlVJV1FGUkxAUEg+T0c9UEY9VUk/XVBDZFZIaFlNaFtNZFdKXVBFVkw+VEs8Vk0/XFNFZFpKbGBOeGpWdWROcF1FdWJIf29Tg3VbdWpXcGdZfHJognhvgndsg3tthn9xgHltfnVoh3lqpJSFuaeYqJSAinRSe2M2eWMwhGc4kmQxk2IphWIue2I4g2xDqIpUr41Sc19AZlpQZl5WY2BPX1tLYVtTaGFfYlpeXFNZXFNQYVhJgnhcp5p1tKByup1fyKxbyrZYybNXx7JcxrRgxbZjx7RfxKlSwaNQybFi0Ltu0bps1bpp1bRs27t/zbaMdHBbX2NRZ2NaX1FLm4Vl78mA679s4Ldp3bVq3Ldq27Jb16dK0alK1LJW2K1Q2KZE3K5IxZc2s4ApxIs7yYw4ypI5uoo/wZtlrJFvkYhyj417g4FyjYh8k4uEn5OBq5ZzsZZmsJFZpYJDqH03wpRL27Jc2rRW17RV0rJTyqVIyZo9zp060axQwrJzrqV8qJt5joVzc25qamdmZWJiYWBebmxrjIiGh4GAfHZ1f3l2f3d1e3Ryd29sk4FowqJprYM6nnEnk2YhgV8rjXtWh4BtjYd9i4V9hH16iYOAh4J7bmhiYFtWXVtVW1tUZGdfX2BaUVJMSUpCY15PlH9kpYNcpYBFp4VCpYZPm4NhdGpdUU1MUE1RR0JENzM0My8wLissMzAxRkNCT01LTUpJREFBLyssJCEiICAgIB8eJiQiLy4rOjg1T05JV1RPXFlUW1lTYF1XbGlidHJrdHBqcW5pf3t2m5eRqqWcp6OXn5uQbmheUktDTEZAS0dDS0dDTkpGUk5KPzw5KCYjJyUjJiQiKCQiKCQiKCUjKSYjKyckKickLywnOjYwQ0A3REE4QT80QD0yPzwxPjsvPzowPjguOjMrNy4oNi4oODEsPjczR0E8S0ZBSEM+QDs3SUM/WFFLXlhRd3BnnJaLtKyhpp6SmpKFnpaJn5aJmpKGo5+Rq6eZqKWWsa6gubarp6OXiYN2hoFyhoFygXxuc21gY11TX1hNXVZLWlJHU0tBVElAWk5DZFVJa1xOcWJTdGZYcGNVaF1PYVZJZFtMc2xbeXJhf3dlkodzq5+JoJB0mIBdqJBnq5lzoJN0h3xnfXNkgHZpf3VrgHRpfXFkdGZYbF1KcmNOf29YlYBilXlYm3hOlW86iGQrgmIliGQukGMziF4vfF41iGk/m3hFtI5NwJ1ejnpcaV1VXlZRWVdJX15OX1xPWlRNXFZSY15dZmFbhHxnpZh5m4ppr5RjwZxcy6pby7VbyrdfyrhnyLdpybhpxrFhv6JPw6NPyK1ayq5g07Nl1LJfy6VZ2LFx4ceYl5F5ZGVdZWBfbGBTzbqU5cmMza1t3cCA5s2N4cuK27ts2KlQ1rBU1LZa1q1PzZw+06ZMsoc5qnowxo8/zZI7vIQyp3cwsoxRvaN3o5N2kop2i4d5kY2AkYp9l414saGBqZVyoIdilnZEmHM0tIpA0qVL2bBS2bZV0rJTxaFAzKE+2LJYyq1knI5sf3lwhH55f3t4dHJtdnVwkY+Kjo2Hcm5qgXx3eHJuhH56hX97ioOAiYJ/e3RwhHllvKR1ro1MlG8riGQphGlBfXJiXlxWZmNcf3tzmZOOn5mUl5KNiIN+dG9rdnNwdXRva2tlXV1YVFNPTk1Ha2JRnIJfp4RYnXpAk3U8jXZEhnVXZ15TSEVDPTs8LSosKSYnOjY4PDg6PTo6T0tKX1xaYV5eR0NEMS0uKicoIyMiISIhJCQiMTAuRUVCWFdSXFtUWllRWldQYF1WbWpjdHFqbWpjZ2RfdnJwjYmFop+WpqOYpKCVfXduVE1FTEY/SkdCTEhETUpFUk5JQT46KSckJiQhJSMhJiQhJiMiJyQiKSYiKiYjKyckKyckLCglNDErPTsyQUA0QD4yPjswPTouPTguPTguPTcuOzMtNzAqNi4qNzEtOjQvQDo1Qz45Qz45Qz45Qjs3Qjs3UElEcmtkmZCJqKCYq6WcqKGWpJuPpZ2QpJ6On5qMm5aInZeLop6RnJaIlpGEnpmKnpqHl5ODioZ6e3Zrdm9kfHRpenJmbWRaZ11TdmlfgHJkiHhokIBtl4Z2lYR2jn9xg3hqg3lrjoZ1kIx6kIp3qqGLu6+Xs59/tZdttpVoqZBjhHRPbmNRcWhZiH9tlYp5inlseWBLhGY8iWk1i2s7j24/kWozlWUspHAuqXQunXAvlGsrkWkyiGAxf1cuiWA6oHQ+t4pMzqVf5MF/z7uWgXVqW1JRTkpEXVtOWlZFT0o2cmtUkIVqmo1stqh/wbKGlX9bi2w/s45LzKJN0KxTy61Zy7RkzbttyrhpvKVXvZ5OyKZQxaNPv5pK2LBh06lZyZtMzZ9X68uWxLmcamlgW1VVfXNkvrGSiHpgb2BKmYlqy7mL3MuY28F/1qhX17BZ17lc1q5KzJs9xJZIsYVAuIo5z5s705o6u4Qyqnk0r4hOt5xusJp2pZqEp6OWpaKUmZeGlI54tKiLsJ+BlX9ofmJDi2o4lHA0roU7zaVQ2LJZ0axSyqVI2bJQ27ptrpZpiHtsgnp9hYCCgn57fnx2ioeCoJ6Ym5qTg4B5ioeAkIuGoJuXhoF7jYiElY+OeHNwb2hbiHZZjXNIeF4tYEwlZlY/TUQ/REBBS0hDdXFqramjsKumopuYj4mGioSBk4+Mg4B8amhkW1pWWVdUWVhRfnRgn4dknHxFlnAziGgziHNKfXBdVlBLPjs6MS8vKCUmLissREBCTEhJS0hHTktJWVdUU1BOOzg2ODQzODU0MjIwMzMyOzs6SkpJSkpIVFRPW1pUWVlQYV5WVVJLXltVbGlka2hjYV5aaGVjhIF+mJWOnpmQnpaOfXZuVE1FSkQ8SkZATEhDTElEUE1ISkdCLConJSMgJSMgJSIgJSMhJiMgJyQhKCUjKScjKSYjKygkKygkLywnODUsPjwvPjsvPDguPDctOzYtPDUtPDUvOzQvOTEtNzEtNjArNjAsODIuPjgzQTw4PDUyOTIwQzs5SUI+UElFYllWdW9piYN6q6aZurWjtayWsaeTpJuInpOCnpKAjYNxjINzk418ioZ0hIFxg350f3pvfnZsgXdugnlugXpvgHZvi393lYd5n417p5V/pZN/mYd5l4Z5j4R2hHlsgXdqfXtsiohypp5/sqF8r5BgrINLqX9Gn35HiXA6bV07bmNMiHtlloRriWpHjWIwoXIxq3goq3YqqnYwqHYvrHYwuXovvH0vsHk0qng3nXA1iV8tiVwwn2xDuYdSy55l1bB2y7F7oZJvdmxfV09QTkhIXFdNYVtGi4Vmw7mP17t/0K5oxKVZwJ5VsoxQnng+roU8wZI7yptBzqZMyqxVzLZhx7Bgt5pOwp5QzKNRyqFPz6ZO16pVz6BQw5I/ypZK99Sb39azdHRgWVVNd25leW9gXlhPYV5bY19Zi4BrvK+J0b2J2bJs2bVh07NU0ac+0KBAvIs9u409x5s8zZ430pw8x5M8vpBHxJxmqY1moIxvqZ2Ir6mdrKico6CTnJaFpJmClIZvdGJPcFpAf2M8hWc7n39HwJ1Y0ala0KhW0KpX4b1jyq5uhXNfeG9mg315kYyKpaGdnZuXk5CMjouHmJaRmJaRo6GbhoN/c25sb2poa2Zkb2ppYV9bUlBKTEU7TUExRTkjRz0nUUY5TUZCTklLVFBNh4N9pqGcraijpqCdf3l3kIqIlZGOfnt3YmBbVVRPUE5LT05Icm5ioZJ1lnc/jmgyh2k7fGtNVlBGQ0A+OTc1MjAwLy0tMzAxPjs8TktLWFVUTktKSUZETElHS0hGTElHSEdETUxJTExKT05NVlVVUlFPX15ZWllUWVlRamhgYV5XUk9JY2BbbGlkYF1ZXVlXenZzkI2IjoqCkYuCdW9mUUtCSUM7SUVASkdCS0hCT0tFS0hCLSsoJCIgJCIgIyEfJCEfJSIfJSMgJyQhJyUiKSYiKScjKygjKigjLCgkMi8oOTYsPDgtOzYsOjQsOjQtOjMuOjMuOzQvOjMvNzEsNC4pMy0oNC0oOTEtOzQxPjY0Pzg2OjUyNjIvOzUxQDo2U01Gj4l+ubOftquKtamFq599pZZ2tqF9qpZ1motxoJaBioN0gnxuiYFzfndrenFogHNth3pyjoV4h352hXpwkIFznYt4rZ6CsqWJoJF7nY57lol1mIl4kIFxjYVxq6J/saR0sJdkr4lLqoBApnxBo3xEpH9CmnxGhm1FhWc9lG07oW4tqnAqq3QqtXkjt3smtn0xtX82uII2wIUzwoU1tHw4q3g2mm4zkGk0mnRCoHpNl3VQhGtNempRcmhVa2NVZ19XWFJMUEpDZl5Nq56D08Se0LmD0apezZ9MyJtHxZdEvY1CrYA3rYE0tYs3vZhAz7BWz7FYy61WwaJStpFHvZJJwJJEy55O06dR0KJPxZdDu4sy1aZb5cmWmJR3ZmhXZWNYb2hhWlNMV1BLZ2FeXlZXYlhUj4RuuaqG2sKI2rtp1KxIz6E30qM9zp1CzJpCzKBGzKRL1KhX1Kha169n2LZ7vKR6oI92o5iGq6WaqaOZmZKIjod8iYN2eHBjZ19Rb2RUh3RYoo1quaWBtJpuro5Xp4ZIknI0mn5Dg2xNaFhVcWllkIyDsKymsKyolpGPgHx6dG9tiYaEiIWCf3x5W1dVTEhIVFBRU1BRVlNUVVNTQUE/Li0rIyEgIyAcMy0lVE1FZV9aaWRheXVwkYyIg3x6f3l3i4WCgn17hoGAamVjX1tYWVdSU1FNRkRBPTw5YF5UmIxylHZHi2Q3f2hHYFZCQ0E6Pz07PTs6PDo5Ozk4Q0BAR0RDUU5NWVZUSEVDS0hGVlNQWldVW1lWVFFPTkxJTUtJSUdGRURCT01KZGNfWFZRVlROa2ljbGtlWlZRWldSaGVhXltXW1dUa2dkf3x2e3hwgHxzbmlhUEpBSEA4SEM8SUY/SkY/TElCSEU+LCkmJCIfJCIfIiAeIiAeIyAfJCEfJSMgJiQhJyUhKCUhKSYiKScjKicjKicjLSokNDAoODMrOjMsOTMsOTEtOTItOTEtOjIuOTItODEsNi4pNCwnMysmNCwoODAtOzMxPDYzPDcyOzYuPjcxPzgxRkA3eHFjhn1ognhge29Ye21Ul4RkrJZzpo5vs5+FoZWAm5J9qJ2HnZJ/jH9xkIN0npF/qp+LopuLlYl0nItzo5FytKV/va+Nua2KuKuIsp97tZ6AqZR2q5NpsZBUr5NYuqF1uZtqrIlYn3xRoXxRr4pdsZFikWw8nGkoqGwirnIhr3QjsngluXsju34puoE0u4U7wY08xo86vIU2q3c1nm80jGg3fmI7dGJCbV9HXVFBVk1AU05DU1BHW1VOUk1FT0w+ZWBLqp173cmqyK6CyKZgzqJR0KFOzZ5MyJlGvZA9rYEzrYM0t5I/waFJ0bxo1r9r0K1WvpVGq385r4I6uYs8yp1M1adYzJ1PvY08v5M34LlwsZx0YF9NX2FWbGhfc2tlYVtUVU1JZV1aaV5eXFJSa2JWrqF/28iM1Ldk069H1a9C1bBF1K1H0qdJzKJHy6ZS1rNl2bdx3L6D3MWV0L+coJR/nJOGraWcqaKYnJOJmJCGh4F4eHJof3tvhoF2jId4raSOyLyhsaSCmoVceF80VkAfVUQvX1BFbmBZgHdxramisq+oiYSAf3p3eXNyZmFgW1hXUlBOSUdGSEVFR0RFPz0+Ojg6NzU4Ly4xJCMmIB8fIB0dHxsZKickYFtYdnJufnp1oZyXioSAaWJgXldVY11bamVjWVRSRD89Uk5LWlZTWFVQSkdDPTo4X1lOgXVdiXFNknJNhXVfTEtBQUM9Q0I/RUJBSEZERkNBRUNAR0VDU1BOUk9NSUZEUE1KWVZTV1RSVFFOUE1KSkdFREJAPDo4NzQyPz07WVZTXVtWWldSYV9ZYV5ZXVlUXVpVYV5ZYFxZVlJQYFxZeXVweHVveHNrcWxkUktCRT0zRT83SEM8R0Q9SkY+RkI8KyklIyEeIyEeIB0bIB8dIh8dIiAeJCEeJCIfJSMgJiQgJiQgKCQhKCUhKSYiKSYiKiciLiolNC8pODEsODEsODAtOC8sOC8sODAsOjEtOzEsOC8qNiwnMyomMiklMismNS4pOTQtPjkwQDowPzkwMy4nOTQvREE6SkZATEhDS0c+W1JGeWpYkXxioIpuq5yCt6mNuKmMsaKDpJBsr5l0uaaBvKqFtaaCqJRrpoxfnYFLqYxJtZphuqN0uqFrtJlhtJtvt592s5FaroA5uZlgt6SBn4xwnotzoI98l39loYVjsJFsn3FBpWkmsm0krnEjr3UhtHkluH0pu34su4Iyvoo5w5E5u4c1rHkuonMvjWMzbVEyVkQtSUI0XltSfHNnYllMXVdNWVNLU0tBXlVEgntgraWA0b+S1r2TxKRtyaFSz6NQz6FQzJ1MyZtIxZhAvJI+soo9tZFDvp1L0Lpo1sBuxZ1Mu4w5rH0wsIQ2u488xZlEy51SvIxHx5VJ2apcrpBccWZOXF1OYmNWbmtjcWplaGJbZl1acGhlc2lpaF5ddGtcvLCI38yJzrNZzak/1a1B06xBzaQ80aVC06ZG1KlPza1h1b2G3s2j0MOmoZeGh35zlo2FsaihsqqhraSbqqKZh4F4dnBnenZqhoJ2h4R4lZGCrKeNp59/jYBgYFA1Sz0oWUs/dWhegXhsiYF3n5mSlpKMeXRwZWBeUU1MODQ0JyMlHx0eHRwdJSMkJSQlHRwfHBsfHBofGxofGxkdHBscHhsbHRoXMC0qeHNvi4aCpZ+cp6Gdc2xqZmBeW1RTW1RUW1VUT0lJTUlIY19daGRiXllWUktJRj4/WFBLbWNWdWVPhHFXd3FjQkZARkdCS0pGSkhFTkxKRkRCPTs5Qj8+V1VTVVNQUU9LU1FNVVFNUU5JT01IS0hEQ0A7REE9SEVFQj9AQ0BAVVJQXlpYWFVRXVpUW1hTUktKXFVTWFJQVlFPT0tJVFFOdnNwfnt1eXRtcmxlUUlCQzoyRDw0RUE5RUE5R0M7Qz84KygkIyAeIyAeHRwaHhwaHx0bIR8cIiAdIiAeJCEeIyEfJCIfJSIfJyQgJyQgKCUhKSUhKSYhKycjMConNi4rNy8sNy4rNi4rNy4rOS4qOzArPTItPTItOi8qNCsmMiokMCoiMy0jOTMoPzkvQTsxOjYvMzAsNTUyOzs6P0E+Njc0Pzw4S0VAWVBFcmRUiHpqnY57mIlzlIJnqY5it5Zgso9WqYZPqopWqYhOpn49m3Quo4A5rI9XsJRhspNYuJ5ru6Z8vKR5r45SrII9uJljoYxrdmpcenJpi4R6dmxefW5Wp4tpq3pHpm0mqm4jq28lsXUiu38ovIMvvoQvvYYuv4oysH4sqHUprH40lXAvc1QvVEEvRzsuWlFDnJCA18GnpI9ygHJagHFdkX1mtqB+x7OIval4vKFsw6Jpx6FdyqFTzKFSy59Ry51Qy51Nyp9HwZlFsYxCrotBu5lKzbBb1Lpmt45Eu4o3tIYws4kvuo84xZdCx5dGtYU+3K1m1Kp1a1ZCU1FET1FAW1pPbWpjXVhSU05HaWFccmlkc2lncGVhc2pWsKV74M2E0LBP06U52Kk+1KQ6zJs1z6FC0qVI0qtXz7h818qh0cmsn5iKf3t1gnx3hn94lY6HnpePoJiRlI2FfXhvfHdueHNodXFlfntvhoN3lZF/jYh0bWhcQz86KSUhU0tFin92mI2Eo5uSmpWOjYiEX1pXNDAvIx4dHBYZGhYYGhcYHhwdKSYoKCYnHx4gHRweHBsfHBsgHRsfHR0eHh4dGxsYNzQykIyIvbi0sayofXh1aWNhZV9eYFlYXVdXVlBQSkZFSUVFX11cc3BuYl5dU0tMU0pLXVZVamRgbWNZZFlMWFRLSktHTExITkxISUdDSUZDRkNAQD48RUNATkxKUE5KVlNOVlJOUk1JSEVARkM/QT47RUE+UE1KW1hYUk9QSEVFTUlJTEVHRT9AUEpJXVdVV1BPW1RRUk1JS0VCSUZCSERCZ2Rie3h0d3JtcWllUEZBQzcwQzoyRD43RD43RkA4Qj01KSYjIiAeIiAeGxoXHBoYHBsZHhwZHx4cIR4bIR8cIh8cIyEdIyAeJCIdJCEeJSIeJiMfJyQgKCQgKSUhLCckMSsnNS0qNi0qNy4pOC4qOy8rPDEsPzMuQDQuPzUuPTIrNi4lMiwgMy0gNS8jOTQpOTYvNzgyOTw3PTw5Ozc0MjAuOTc1Qj8+R0RBVU1IVUtHYFZQZVtTYVZLhXVdmoRemHpFmHI4onw/oXk7qHg4rYdPrpdtpJFuq5hysZ95opN1q5l8rZNnoHs8oXg0p4ZNjXdYZVxVX1hUZ19aYFlRdm5ZmoJck2kxoW0oqGwkrnEnsXwtvI03wIs0xooxwIYxv4Q0p3EqpXMrnng0dl4vZFEzTkEzRT01aWFSvbGa5c6n3MCJ0LN3xqRryKNoy6hnwZ1euZNTtY1LupFLxZhQypxTypxSy51SzJ1SxZdLtoxAqYc7o4I5pYI6tZBDx6NN1bdguZJEtYc3tYczsoYuu442yptC0KJCxJlA4755p5NwW1FEZGBZWFZSV1VQbGpkamRfX1hUYlpUaF9YcGZhcGZfcGZUoJRu38d+zqNA1Z0x3KU61J0yzJQu0aJDy6RKxKdf1seR19Kqt7ObjIiAgX5/fXp3e3dxfXhxeXVudnNsd3JreXRrfnhvf3lweXNre3ZsfHhum5eOvLmyr66qbGppQ0BAWlVTm5GKy8K5zMS8o52XcWxnMC0qGBUUGBUUHBcZIyAhKycoMS4vRUJDVFFRUE1NQT8/NjM3KyotISIjHB8fHh8eHB0cMC4thYOBtbGukY6KdG9tZ2JgXVhXTkpIQD07ODY0Mi8uNjQzREJBUU9NR0RES0ZIYl1dYV5dbGhndnFtcWtmZmFcZmNgYV5aVVJOTEpFSEZCSEZCSEZDTElGVE9NU09NUk5LUUxIUEtHRUE+MSwvKCQoNDAzR0JET0tMQDw+MCwvLygtKyMpKB8nMygyPjU7SkJDWVNPVU9JSUM9R0E+SERBVVFOYF1ZZ2FdaWJeTUM9QzQvQTcxQjs0Qzw0RD01PzoyKCYiIh8dIh8dGRcWGRcWGhgXGxkXHRsZHhwaHx4bIB4aIB4aIR4cIR8bIyAdIx8cJCAcJSEdJiIfJyMfKCMgKSUhLigkMysnNy0pOS4qOzArPTEsPzItQDQuQTUuQjYvQTUtOzEnNS8iMi4gMi8jNDIpOTkxP0A6Qz87QDc2OjQxPTk3Q0A/R0NCTklITUZGSUNBSURDSUZCWVRJXldHa11Bfms+lHg8nXQ3q4BPq49xi39vgXprjoVvhnxmYldKbV5PgGxMjnBAl3Q2ooJKmYNnaV9XXlZUYFhXYVlViX5ol3pRiGAtnGUoqWcjsHAss4hJt5hWwZA+x4ouvoQutnsvrnkypHcze1ksY04vWEgySUA2SkM7aGNUp5uCw6BtzKJZ2a5gzZ9Uv5JCwZU/v5JEuoxIt4lCvI1EwpJLwZJJxZZMx5lNxZdMuYtCt41HtJNIpYQ7nXc2q4M8vZZF0KxXw51Ls4Y5s4M4soIyuYk2xphEyqBGzKZN17l5gXRZWVRHamNda2ZjZ2RhcW1peXNucGpla2Nde3NreXBobGNfcGRdqJl23MF+zJ1BzpMr2p8105kvypEr06JF0KpXxapr1seWxLyZlI5+fXh1cGxubmxpfHp0eHZvbWtkYmFaYV9YbmljfXdvhoB3ioN7fHVteXRrtbKr4eDa5uXhsa+sa2dmYFtZbmdkq6Ocp6CZZmFbRUE+NzQyJSMhHhsaKSUmR0RFVlNVW1hZWVVWb2prend1Y2BeXVpbTUxNMTMzISUkICEhIB8fIyMjS0lJbGppaGRiVlJQQDw6NzMyKykmJCQgJygkJiYlMjEwOzs8PDo7PTs8Tk1OYmJjX15damdmcm9tcGxrZGBfaWVjbGhkX1tXTUtHSUdDU1FOXVpXXVpXX1pZVlFQTEhGTUhEUUxIQz09JB0lHBcfHxkiJyApLCUsJR4lJR4mKyIsKSApJx0oLB4tLSAsMCYrQDg4TEVBTEZCTEZESUZDSERBUEtIVU9MXFVRST46QjMuQDUwQDozQTkzQzs0PzgxKCUhIh8cIh8cGxkXGxkXGhkWGRgWGhgWGxoXHBoYHRsZHhwZHh0ZHxwaIB0aIR4aIR4bIx8bIyAcJCAcJiEfJiIfKCMgKyUiLygkNiwoPDArPzEsPzIsQDMsQDQtQTQsQTUuQTUuPzUrOjInNjEnNzUrOjgvOzkxPTkyQTo1RD06SENASERDSUVET0tKTUlISERCSEVDR0dCRkg/QkQ8QkE9SkU6emQ6k28+lHZYfWxZZ19VZ2RdaWddXVhNTklBT0dCWE8/cGVBlHxFnXxCrpFxgnJjW1NPXFRTXFZQe3BbjnBLhlwull4npmUlrHI0qYhcqpNqv5hZxZNBt4Y2nHEvoHk8j205c1k9W0k4QzgvPzgySEI4ZWFSn491tYVMvYk7y5xMzaBUxppMxpxIxptOwJNPuo1ItYpGt4xJs4dBt41Du5BFu45DuYxDv5dOxaRavpxUqYFBqX9AuI9Exp5J2rRfzqFXtIE8tIE3tYM5u45ExJ5Rza1erpViaVtIVlBJZWBUcW1hd3FsfHd0d3FuZV9afXVvhn52dm5mbWViaF1dlIVr3cGI1qVVx4srzpEtyo4sxo0s0J1EzqVbz7N5vaqEhXpqbmlla2ZnX1laZWFgeHVxeHZxb21nXlxWW1hSa2dhfHdvhoB3iIF5dW9menRsx8S+8PDp6+rltrSva2diY2BaUEtHSUNATklFT0pGX1xYX1xaWVVVXlpbXFlad3N0end5fXl7cGpsc21uhoOBY2BeXlpbY2NjSUpKLTAwJignISIiHx4fISEhKicnLCgpKSUlJSIfIyAdIh8dJCQhLS0rKCgnKysrLy8xMzI2NjU5Ojo+RkZJVVRUXlxcYmBgYF5eUlBQRkRDVlNRW1hWUU9MUlBOWlhWZ2RiaWZlXltbUExMSkZFVE5MWlJRQTk8IhoiHxggHxcgHxcgIBghIRgjKiAtNCg3MiczLyMxLR4vKx0qLCAnLyYpOjIxRT48UUxJTklHRD89SERAS0lETUhDQjg0PzMuPzUwPzgxQDgyQjozPjcxJyQhIR4cIR4bHRsYHRsYHRsYHBoXGxgXGhcWGRcVGhgWGxkXHBoXHRoXHhsYHhsZHxwYIB0aIR0aIh4bIx8cJCAdJiEeJyIfKCMfLCYiMyonOzArQDIsQDMsQDMrPzIrQDIrPzQrQDQtPzUtPTQtPDcuPjoxPjkwPTYuPjYvQzw3TEdETUlHTkpITUhGS0dESEZCSUhET05JTk9JSElEQ0NETEVDemVNe2JFVks7UUtEVE9MWlZVXlpZVFFMS0dBSUdASEg7S0sxeGs9nnxDmnhSdWdWXlhSVlBMU01HaV5Lg2VFglUojVUfl14jn3A9pYhrrph7xauAxqdrtJRWhW0+gWpBdV4+d2VNVEc9Qzo3RD03QDwwW1hJp5d6t4tOtYQ4vZFExZtNxp5NxKBNwp5QwZpTv5ZSvJJNuI1FtYpAsopAtIpBsoY9r4I6upFGy6xez7Blv5dUsodIt45GwZdF0qlW0aJYvoxCtoI6r305sYVCvJhTxKhlhHBNUkhBXFdRa2ZZaGVUaGJad3Bvc2xqZF5ZeHBqfHRucWlkbWZjbGRhlYVt38OQ4bJszJA2xokqxIgqw4otxpM9x59Z1biAnotqXVJOYV1eamVmZV5fYFpYcGxogn56endyWVZRXVpUc29pe3Zvf3lxgXtzdW9nbWdgqKSe9PPs1NPOlpOMcGxjYV5WWVVPTEdDZmFdeXVxcW5ob2xocGxsd3N0dHBxcm5ueXV2dXFyfXd5d3JzeHVzb2xqW1hYX15eWltaPD49MDIyJScmICAhICAgHxweHxsdIBwdIB0cIB0bIB0bIyIgKiopKiorJiUoJiYpLSwxNjU7MTA2MTE0RENFUlBRSUhIRkREPjs8Pzw8S0hHU1BPU1BPVlNSVlNRXFpYXVtaTkxMSkhITUlJV1BQWlJSPTU4IRogIBgfIBgfIBggIBchIRglLCEwMic3LyQzLiAwLh8wKx0pKRwjLCElNSwsPTc0R0M/SkZCRkI+R0NAT01JSUQ/PTQvPDMtPTUwPjYxPzcxQTkzODItJCEeIR4cIB0bHBkWHBkWGxkXHBoXHRoXHBkXGRcVGBYUGBYUGRcVGhcVGhgWGxkWHBkXHRsXHhsZIBwYIB0aIh0bIx8bJCAcJiEeJiIeKCMgLSciNSwnPDAqQDIrPzIqPjEqPjEqPjIrPjIsPjMtPTQtPTUuPjYuPzcvQjgyRDs2Rj88TEZDUUxJUk1LVFBMT0xISEdCUE9LWlhVWVZUT01LVlFLZFtRZlxOVE9GUE5LUk9QVlRXWldbVFNUSEZDQT86Q0I5Q0E2XlM7knVOlHZZZ1tPWlRPVE1IV1BLaV1Ni3RUhV4xhE8ailgjk2pCnYNrvaSMwaqKvKmFp5ZzeWlJeWhJd2VMbl5PSD02R0A3RUAzNDMlWlRBoY5qpoVHp3wzsoY7wZlJyaFOwZtKvZpOxKNdwZtbwZZQvZNGtI0+sIg+r4ZArIQ/oHk0sYtGzq5nyKxos5NUsIpGsotEu5JHx5xPzp5Ru4g7sXwxrXo3rYJCso9Uu55tjHhdVk1GYFtVcG5iXFlNV1JMa2VhbWdjY11ZZ2Jcb2ljbWVgaWRfYl5ajn9o3cCM4rVw0ZZAx4owwogtvYMru4Y1vJFK0rV4sJ1yb2NRZ2BXZmRdaWBfYlpYa2ZhgHt4d3JuW1dSZ2JeenRwfXhzeXRufHhxg313fnlzop6Z1NHLsK2miYV9eXZtWVVOVVBLZWBaf3p2gXx4dHBscm1pbmhmd3Jxd3JxcmxrenV1fnl6eHNzbGlnaGZja2lmZ2djV1hUUVNPQUJANTU2KystIyMmIiIlIiEjJCIkIyIiHx4fIB8fIB8fISEhJyYmLS0vLSwxJSQqJiUsMTA2Li0zMC8zMTE0MTExLCwsNjQ1Pjs8R0RFSkdHUExNTEpKSEdGS0lISUhHQ0JCPDo6Pjs7Q0BBU05PWlNVPjY7JR0lJBwkJBskJBolIBYjIBYkKR8vLiM0Kh0wLB4wLyEzKRwsKBsjKh8iMSgoPDUzQTw5Qj46SENAVVFOXlpYS0ZCOjQuOzMtPDUwPjYxPjcyQTk0My0pIR4cIB0bIB0bGRgVGRgVGhgVGhgWGhkWHBoXHBoXGxgWGBYUFhQSFhQSFxUTGRYUGRcUGhcVHBgWHBoXHhoYHxwYIB0ZIh0bIx4cJCAdJiEdJyIeKCQfLSYiNSslPC8oPjAqPTEqPTAqPDEqPDErOzErOjAqOjArOzIsQjgyST86SkA8SEA9R0A9SkRBUkxJU1BMTEtHREVASUdFVlJRTkpJUU9NXFxZVVVRVFVSVVVUVFRVVlZYWFdcWFdaSkhJOjg2QT07R0JBTkVAZVFGfWheaVxVUktGUElEVlBJZFxOjHlZiWo9fFAdhFcmg187f2lUpo96p5J4oZF0i31hfG1PhXRXg3FaaFlLS0I6Skc6REIwNTMiWkozlnlRoHxDpHgxrX4zvpRKyJ1Tv5pQxqZf0rZyyaxuw6NevpxSu5dOt49HroQ/rIVCrpFUvKVwyriGyLqNxLeLv6lssJFOuJNLxZtLzZ5MvIo7sn8vsH43roNEqYZQtZhuoIxxWlJHXFdPcnBmZGJaX1pVbWdjbmhjb2lkcWtmbWdhY1xVYFpUXFhQjXxiz6510qRczpRBxIgyv4QvtnsosngpsX0zwJNPzqtzkn5iYFtPV1lPY15YaGFeZWBccWxnWVRQXFdTa2Vhcm5peXRwd3NsdnJrhoB6kYyHhYF7bWljbmpjg354gX12ZGBZWFROZWFaeHNudXBsamVhaWRhcm1ro52ch4GAeXRylZCPjYiIhoOBd3VyZGJeZGJeYmFeXV1aXV1ZT05NNDQ1Li4wIiImIiElIyMmJiYoJSUlIiIiJCQkJSUlIyMjJyUmMC0xMjA2KSgwJCMrKSgvLSwyMTA0MjI0Ly8wJiUmMC4vQT9BRkRGREJDS0dISEdIQEBAQkFBPz9APDw9Ojg5OTY3NTIzPzs9Qz1BNy42KiArKiAsLyIzNCY4Kx4vIhcmKBwsLSAzKRsuLR8yMCM1KBosKBwoKh8iLiQjOTEvQDs3PTk1Pzs3TklGVE9MQDs2OjQuOzQvPDUxPDUxPjcyPzczLCglIR4bIB0bHxwaGBYUGBYUGRYUGBYUGRcVGhcVGxgWHBkXGxkWGBYTFRMRFBIQFRMRFhQSFxUTGBUTGhYUGxgWHRkWHhoYHxsZIB0ZIh0aIx4cJCAdJiEeJyIeKCMfLSYiNCslOi4pPDAqPDAqOzAqOS8pOC8pOS8pOC4qOi8sQDYySD06SkA9Rz06Qzs4Qzw5RkE+SUdESklFSkdFS0ZFR0NCSEVDUFFOSkxJSUpJV1hXUlRVVFRWVlVZVlRXUlBRR0RERUFBSENERj9BPjQ3Rjs9S0JBQj04RkE7UEtDXFdMdGVMfmE4eFIgeVEfclMwXUw7ZVNDc2BMfGxRgHJTdGVHgnJXk4JsZlZKSkE6Skg9REIyRT0pbVIynXRHoHg/pXkzpnYtqXw9upJVzKlv1rqE1cGPv7CHsZ9vvaJkxaRdwJpRuZRQuZxkwLGDzcag0cypy8uuzMyxyMCZvax7wKVpxJ1QzZ5KxJNBtYM1rnw1q34+p4BJrZBoqZN4aV9SWFZNaGZeaWdeaGNebGdibWdib2lkd3FscWxnZF5YYlxUZl1Qpo1x0qhp0p5SzZFCun0tvH8wtHgrrnIqrnUvuYI906Njn4RfVE5ET1RKV1lOXFhSXVhTbmhkZmFdZmFcbGdjcGtmdnFtdHBpc29oeHRtf3pzamZgV1NMVlJMX1tVdXFrfXlzaWVebmpjeHRtb2plYl1YX1lVZ2JehoB+eXNyenRzkoyLeXVzfHh2iYaEdnNxZGJfX19cWFlVXFxYXV1bRERFMC8xISElISEmIiIoJiUqJiQnIiIjISEhJyYmKSYnKiYoMi4xMi41JyUtIiAoKScvJyYtJSQoKCcrLCwuLCwtMC8yLi0wJycpMTAxRkRGS0lMQD9BOzo8Ojk8Ojo8MjI0LCsuLSotLysvLycuMikzMyg2MiY2MSM2OSk9Oys/MSM2Kh0vKBwtJxkrLiEzMCM0Kh4uKyAsKyAiLSMhNS0qPDczOzczOTUxOzYxPDczOjUvOjQvOjQvOzUxPDYxPzg0NzIuJCAeIB0bIBwaHxwaFhQSFhQSFhUTFxUTGBUTGBYUGRcUGRcVGhgVGxkWGhgVFhQSFBIQFBEPFRIQFhMRFxQSGBUTGRYUGxcVHRkWHhoYHxsZIB0ZIh4aIx4aJSAcJiEdJyIeKCMfLCYhMysmOC4oOS8pOC4oNywoNiwoNywoNy0pOC4sOjAuQDY0Qjk2Qjk2Pzg1PTc1PTk3Qj48S0ZFUEtKU01MTklIRURBQEE9Pj08TUxMSklKT05RUU5TT01QUU9QTk1NT0xMT0tLSkZFPTw3NTQuOzg0ODMvPDgzSkZAUU9IXllLe2lGe1stdU8haUknU0U0TkEzU0ExaFg9b2BBZFQ2emlPlYNvY1BJQjYyRkA1Vk03cVw4lG0+o3M9oXU5o3gyo3UuqoBIyKdyw6Z5qZFuoJF1g3ptgXVsqJNyyKxyyK1zx7SIzMOgz8uszsmwwr6qp6WVm5yMtracz8qo0sSYs5dUwZM/y5xJtYQ6qHUvlmcloHU7pIdgsZp9i35qY15TXl1XZWNfZWJeZWFbYlxXZV9ZdW9qdG9rbmhjaWJbeGtg0reb4rl63qte5qtfv4E2tHkuuYI5sns8rnc6uIA/0Z1asJBeXldISU9FT1NIVFNMXltWamVhcW1ocm5pfXh0hYB9gX14dnJrfHlyfHhyenZwdnFscW1naWVeV1RNXFhRenZwcGtlbWhid3JsbGdhWFNOUEpGWFNPXllWYlxaZWBfZGBfWlhWWllWY2JfZWRhXV1aVVZST1BNUVFOWlpYUlFRLCwtISAiISEkIyInKiktKystJCUlIiEhKCgnLSopLSgqNS80NzI4KCYtIiElKSgsKCcrISElJiYpLCwvLCsvMzE2KiouHR0gIiEkMjEzPz5CNTU4MTA0MjE0Ly4xLCwuKyouMC0xLSkuLCUrNCw3PjFLPC5LOCZDOCQ/OCc9Oio+MSM3JhssIxcoLB8wLSAxKh4sLSArLiEkLiMhNCwqOTQyOTQyOTQwOTQwOTQwOTQwOTQwOTQwOjUxPDYzPDYyKyclIB0bIB0bHhsaHRoZFRMRFRMRFRMRFRQSFhQSFhQSFxUTFxYTGRcUGRgVGxkWGxkWGBUUExEQEhAPExEPFBIQFRMRFxMSGBUTGhYUGxcVHBkWHxoYIBsZIB0ZIh4aIx8bJCAcJSEdJiIeKCMfLCYiMCglNCsmNisnNSsmNSsnNiwqOC4sOS8sOS8uOjEvOzIxOzQyOjQyOTQyOTUzPTg2RkA+TkhHUk1LTUpHTElFSkZESkVGS0VISkVJSkdLS0lMUE9QUVJQVVZUVFRSTU9KS09JQ0VAQ0M+QkA9REI9SERAS0pISEpIaF1Df2E4d0sibEMcWEUsUUIwTzkqYE02XEsvXUwxa1tCeGZWZFFLZlNKcV5EmIFUp4dNmnE0m2wyn3E6onY7n3Y5oIVXkYNjcmVRXVBIWlBNamJhfXVzmIx6wraV0cmp1NC30dC9tbKljomBjIaAiIR/endwgn5wqKSNyL+bsJphtpFFzKVQvZFGpnUzj10ckmQpmHhNooprm4l2b2RaWVZTX15eYF5bYVtWYVtVYlxWcWxndnBsc2xpb2hmbmFhmYZ3q5Rsu5xi6bt42aFatn4ytoQ7t4JDs3s8tn03zZVLy6VqcWdSSkdCU1FLVlVPW1lUZWNebWplcG5pfXt2l5KOmpWQhIB5gn94fXl0gn55ko2HmJONjYqDdnJsaGRebmljbmljbWlidG9pbmpjXVhUU05LUk1KU05LUk1MTktIT01LUVFOS0xJSElGS0xJTExJSElHRkdFU1NTXl5eTExLJiYmHh4eISEhJSUnLi0vMDAwKyorKCUmLSooMC4nLSkpNC4yNjE1KScqJCMlJSUmKCgpJCMnJCQnLi0xMC8zLCwvJiYpHh4hICAjISEkKistMzM2MC8zLi0wMC8zLy8xMS8zMi4zMi4zNzM2QTpGRDdbTDllX0dzaU52TTdROig+Pi5DLiM1IRcnJBgpKBssJxopKh0nLiEkMSQiNSwrODMyOTQyOTQxOTQxOTQxOTQwODQwOTQwOzUyPTc0MCwpIh4dIB0cHxwaHRoZGxkXExIQExIQFBIQFBIQFBMRFRMRFhMRFhQSFxUTGBYTGBcUGhgVGxgWGhgVFhQSExAPEg8OEhAPFBIQFRIRFxQSGBUTGhYUGxgVHRkWHhoXHxsXIRwaIR0ZIx4bJB8cJSAcJiEdJyIeKiUhLycjMyolNSsoNiwqNy0rOC4tOS8uODAvNy8uNi8vNi8uNjEvNzIxOTMyOzQzPzc1RkA9UUxIWVNPXFVSUktJTkdHTkpKSkdISkhJTk1MSEtHT1BMTE1JTlBNVldUWFdVVlZTW1pXXVpYUExKREJDPj9EXFFFjXFSiWAze1IeZ00oV0InVT8rXEk0VUMtWko0XE03ZldFfm5gqpF0tZZgwaRisJFImnIwl2gxnmw3oXE+knFEeW9VU1FHRkM/Qj5AQj5CWFRWamZkf3xyv76r397JvryrlpOLe3d1bGhlaGRhamZiaWRhXlhVbWhekolyo41isJNYw6BZxp5VrYA/nWwvk2Qsjmc3jG5Jpo96fm1hVExHX1pZXVpXX1lVZmBbZmBbbmhjc21pcWtocGpoY1tcX1RSYlNLcl9NqIxl1q9zw5FFsnwyt4JCsnw+sXo4wIxIz6psj39dVU9FU05LWFZRXVxXZGJeaWZibGtlenhzko6Kl5KPh4N9gn14fXh0hoF9nJeRp6OdmJSNgH12gn94d3NtZmJbcm5okI2GdG9qY15aXVhUVVBMUk1KTEdFRUJATU1KU1VSS01KQUNAPT07Pz89RERDQEBATk5OWlpaPj4+Hx8fHx8fIiIiKCgoLSwsLi0tKykpKycoMS0uLyopLSknLysqLSkoJSMhJCMjJSUlJiUlJycnJCMlKCcrMDAzLi4yJiUpIyMmJiYpJCQnIiIlKyouLSwwKiktLi0wMTE0MzI1LiswNDE1PTk+SkRRUERkWEVsZ055fmKOeGF/TztVSjhQQzJKJxouIBMlIRQlIxYlJhokLyEkMyYlNy0sOTMyOTQyODQyODQxODQxODQwODQwOjQxOjQxMi4rJCEgIB0cIB0bHhsZGxgXGhgWEhAOEhAPEhEPExEPExEPExIQFBIRFRMRFRMRFxQSFxUTGBYUGRcUGxgVGxkWGRcUFBIQEQ8OEg8OExAPFRIQFhIRFxQSGBUTGhcUGxcVHRkWHhkXHxsZIBwZIBwZIh4bIx8cJSAcJSAdJiEeKyQhMSglNSwpNy4sOC4tOC8tNy4tNS4sNCwsMywsMiwrMy0rNS4uOTEvPDIwPjMyRTs4UUdEWlJOWFFNV1JNWFRPV1RPVlNQT09LR0lCUVFNVFRPVVZSWVlXXFpYXlxaYmBfYl9dXVhXUE5NRERGXVROlYBnnYFUjG0xd10xaVEvWEQoVkIyVEEzU0M1T0EyV0s8Z11Kl35VsI5PsZFRqYhDp4A5mWkpoGopoG81knRMX1pMR0dIQD9EQD9CSEZKVVJWbGlrbmxmnp6RtbOle3duamZkcm1ub2trd3NxlJCMfHd0X1lWYFpWZFxZb2JYjndYn4FQwZ1Zu5JSoHM7lGczjGIwg10xnXxhn4Z0cWBVZltVaWJeZF5aZmBcamNfbWhjb2llbGdja2hlZ2ZkVVNTVEtNVUtNWlBHjHdWw51luoRAsX8+sIFFrXxDuYtQ0rFzs59xXlhGT0xIWVdUYV9cZmNhZ2VibGlmeHVwhoF9h4J+gn15gX15f3p2gHt4kI2ImJWPko+Im5mSop6YgHx2amZfbWliiYZ/d3NtaGNfYl1ZWFRQVE9LTklFUlFMenp3fHx5YGFeTk9MQkJCRkZGUVFQVVVVWVpaWlpZPz4+IyMiJycnKSkpKSkpJycmKCcnKCQjLyooQDg5OTM0LikmLCcjKSYiJCIfISAeJSQjKyopMi4uLCgqJiEnJSQpJiUqJSUpIyMoJycrJycrISAkHh0gJSQoLCsvKiktLSwwNzU5MzA1MS4zNjI4QTlISz9YVENhWkBobU98hW6QdV18VTtbVz5dNiU9HhAkHA4gHRMhIxciMCMnOCspOzEwOjU0OjU0OjY1OTYzOTUyOTUxOTUxNjEvKyclIh8eIR4cIB0cHhsaHBkYGhcVGRYVEQ8OEQ8NEQ8OERAOEhAPEhAPEhEPExEPFBIQFRMRFhQSFxUSFxUTGBYUGRcVGxkWGxgWGRYUFRIQEg8OEg8OFBEPFRIQFhIRFxQRGBUTGRYTGxcVHBgWHRoXHxoXHxwZIRwaIR0aIx4bIx8cJCAdJiEeKyUiMiooNi0sNy4tNi0tMysrMSspMCopMCooLyooMCspMy0qOS8tPzEwQTMxQzYzRz05T0hDWlVPYFxUYl9VWlZPSUdBTExFWlhTZWFeWFZTV1VSW1hXX1xbZGFgY19dYFxcVlRRSklHU01LaVtQiXVUoIdPgWc5fWE8ZlI2U0EzUT80Tz82SDszTEQ6UEc5fWZCm3xIqYdVt5ZjwZ1mp35Em2wnqXs1sJFidGZQUUxIQkFGQ0JFSkhLWldbdHBybmxodHJqfHlxd3Nuc25vc25vaWRkjYqHnJiUhIB7bWdhXldTWVJSV01RalpNg2tEt5ZbwptcnnU+kmk4kGYyjGExh108kXBVmYNsmot+cmpkYltXXVdTZWBbaWJfa2Zha2Zia2llcHRvU1dRTEtDWFRMTUlEUUc9l4BhxZ5kuI5NsIdMq4BJtY5Sz69s2b2FfnNbTklCWVVQYF1aZmNiaGVkcm9se3hzfnl2gXx5hH99gn17d3Nwe3d0jImFgYB6f354mZeRp6Sei4eBbGhiZWFbaWVfbWljaGRfZmJeXFhTV1JOVVBMVFJNaGhlYWJfUlJQZmdkZGRjUE9PWFdXVlZWWVlZXl1cTEtKLi4tKysrKysrJiYmJSUlKycnMS0rSEJBSkJCODIwLyklLScjKiYhISAcHR0aIB8eKignMS0uMS0tLSkqJSQoIyIqJigvIyYsJCYsJycrIyMmHRwgIB8jMjE1MjA1MC8yNDM3Mi81KictJSEoKiQrLiUxPS5EUjpdX0NrdF5+moKge15+WTtdSjNOJxYsGw4fHBIfIRcgNCkrPjMxQDY1PTg4Pjk4Pjk4PTk3PDg2OTYzMS0rJiIhIR4dIB0dIB0cHx0bHRoZGhcWGRYVFxUUDw4MDw4NDw4NEA4NEA8NEQ8OEQ8OEhAPEhEPExEPFBIQFRMRFhQSFhUSGBYTGBYUGRgVGxkWHBkWGBYTExAPEQ8OEg8OFBEPFBEQFhMQFhMSGBQSGBUTGhYUGxgVHBkWHhkXHhsXIBwZIRwbIh0aIh4bIx8cJSEeKCMhLigmMSspMSoqMCgoLSgmLSgmLigmLykmLyooMSspNi0rPTEuQjUwQjgxQzs0SEM8VFBIX1tSWVVOTEdBSEM9UEpGYFlXWlNQYFpYZ2JhZWBfYFxbYF5dYmBgUE5OQ0FBSkZJUk5Rd2xdspt2mntThWY8fGVGWEU0Tz0xSjw2Rjo2TEY+Vk5AfWRAj2w/rYZdzq+J1L2bybKJqIBDrHgxt5BfemhUWlNNS0tNRERHPz5AS0pMY2FjaGZkamdke3h0hH98cW5sYFxZb2xooJ+bjYmFhoJ8dnBqWlNOUUlHT0ZFU0hCfmhJvZtjxaFlnXpBk246jmozkGQxjFw1hmA5pYxtr6CRd29pYVtXXVdSXlhUYlxYZmBcZV9baWdicHJtXF9YS0xFUE9GUk9MVk5JaV5EmolawptfqH5JpH1FqopJyqld58B+o4ZkX1I/XFZMWFdVXVtbZmRjcnBte3l1fHh2gHp5iIOCi4WFeXZ0fHl2kpCMe3l1cXBrfHp1hoJ9fnp2aWVibmllbWhkZmJdYV1XYV1XXFpUXVtVXlxXXlxYX19bWlpWWVlWaWhmZGNgTEpIU1FPUE9MTUtKVVNRTUtINzU0JiYmISEhIyAhJiMgLyspREA9YVxaUktKNi8tMSonMComMCwoKyckIB0aHhwZIyEdKickMS0sNDAvLysvJSIqIyMqISIqICAnISImIyImIiIlJSQoMzI2Ozo+NzY6MC8zKCctJSMqIh8lIRwiIRoiJRomNCQ5TjpUYU1mk36WsJaybE9uVTxYOyg+IRUlHBMeIRggNy0vRTs5RTw8QTo7QTw8Qj08Qj48PTk4LCgoIh4eIB0dIR0dHx0cIBwcHhsbHBkYGRYVFxQTFhQTDg0MDg0MDw0MDw4MDw4MDw4MEA8NEQ8NEQ8OEhAPExEPExIQFRMQFRMRFhQSFxUTGBYTGRcUGxgVGxkWGhgVFhQSEhAPEQ8NEg8OExAOFBIQFRIQFhMSFxQRFxUSGRUTGhcUGxgVHBgWHhoYHxsZIBwZIR0bIR4bIx4cJCAdJyIgKiUjLCclLCYkLCclLCclLCclLiglLikmLyonMSwpNzAsPjUwQjszRD41RkE4TklBUUxFUUtFUUlFUUpHVU5LX1ZUcGdlcGppZmBfYVxcWFVUU1BQT0xNREBDR0RITkpRZF1coJF7p5JvinFCh3BGY1A2XUw4TUE2Rz45Tkc+VE09emI7kGs+roZdxaeDwKuMyrmYxqNxu4k/wplhb15UUk9RVVdZSUpNOjo8QkFEUlBRX1xcamdldXFvdG9sZGBcW1lTenlrp6OQsayanZqNY11WRz87Rz46RT45QTs2V0o7p4xh0LB6uptnp4lXkXE+jmc1kWUzi2g3inVWbmJaYltXYFpWXlhUXFdSYFpVYltXYVtXc25rc3NuX19ZVFJNUE5JUk9PVE9QW1NBbF05s41broJPnHU6qYVDwJpSzqRfwZ9ojXhUX1hOUlFSVFFSZGFhcG5rdHJuc25tdG9uhH9+jomJgX1+e3d2hoOAfHt3cnBscG5qe3dzeHNwZ2NgcWxpdXBtZ2NfX1tVXVlTVVRMXVtVZWNeamhkcnFseXhzgH57b2xqWFZUTktJTElHUlBOUE5MT0xKS0lGOTY0JCMjHx0eIh0eIB0ZOzg1ZGBeX1tYRT89NS8tNC4rNS8sNjEvNjAuLiknJSIeIiAaJSIcKiYhLiopLiotKSQqJCAmIR0kHx0jHx0iJCImJiUpJSQoKSgsLSwwNTQ4Ly0yKikwJCMqIR8lIhwlIhskIBgiHxMfLB8tTj5QdGF2oIqfkHiRYEhiUj5VMSM0IRgjJh0lOjEzRj08RT4+Qjw9RD8+RUFAR0RCNzIyIBwdIBwdIB0dHxwcHxwcHhwbHRoZGhcWGBUVFhQTFRMSDQwKDQwKDQwLDQwLDgwLDw0LDw0MDw4MEA8NEQ8NERAOEhAPExEPFBIQFBMQFRMRFxQSGBUTGBYUGhcUGxgVHBkWGxgVFhQSExAOEQ8NEQ8NExAOFBEPFBIQFRIRFhMRFhQSGBUTGBYTGhYUGxgWHBgWHhoYHxsZIB0bIR0bIh4cIx8dJiIgKCMhKiUjKyYkKyYkKyckLSclLSkmLiooMCwqNC8sOTUvQTw0R0E4R0E4SEI6SkQ+UUpGVk9LU01IVUxJX1ZVZl1dXlZWbWdmaGRkX1pbZmFjVlNVVlJWUUxSUEtOfXVpn5V5kYBWkHZJb1s7YVQ7VUo2TEM4UUk5WE44d185jm0/mndMoYtoin1oj4Jrp5JryKdqwqNzcmdhZmdsaW1vVldaPj5BPj1AR0ZHT01OW1hYZF9eX1pXXVdQamNSeW9MqZVj18SS0cuqjod+SkI+RDs3PjgzNjQuPDcwhHNayrCIz7ePw66GpoxhkG0/jmo5im9AeGlIaF1OXVZRWlVRXVhTXFdSXlhVYFtYamVigHx6f316W1pWVFFOU1FOVFFRUUxTUElHUkY0hmtLwJ1qr41SsoxOvpdXzKNiyqtvnIdfXFZNTEtPUE5QZGFibGlnZWJfYl1baGNid3FyhX+BeHN1cG1uiYeFgoJ+eHdydXNvg397gXx5eXRxenZzfXh1ZmFdWVVPYV1XU1FNWlhTZWNeY2FdZWNffHp2lJKPc3BuWFZUU1FPT0xLUlBOUk9OUU5MTUpIMzEwIyIiKCYnKykpLiopRUA9WVRSSENAOTIvNzEuNjAuNjAuNjAtNi4tNS8tMispKSQgJSEaJCAZJSAcJyEhJiElJB8kIR4jIh4iJB4iJyMlKSUqJiQpIyIlHx4hKyouMzI3MjA3JyctIyIoJB8nIRskHhggGhIaGQ8YJx0nV0lXdmV1eml6cFtxaVVtT0FTNCk2MCYuOjE0Qjo6QTs8Qjw9RD8/R0JCR0JCLikqHhscIBwdHxwcHxwcHxwbHRsaGxkYGBYVFhQUFRMRFBIRDAsKDAsKDAsKDQsKDQsLDQwLDQwLDg0MDw0MDw4MEA4NEQ8OEQ8OExEOExEPFBIQFBMQFRMRFxQSFxUTGBUTGRcUGxgWHBkWGhgVFxQREg8OEA4NEA4NERANExAPExEPFBEPFRIQFRMRFxQSGBQTGBYUGhcVGxgWHBkXHhoZHxwaIB0bIh4cIyAeJSEfKCQhKiYjKiYkKyYkLCglLSknMCwoMi8rMzEtODUwPzs0RUA3R0E5SEE6S0Q+UElEVExIVkxJWE5MWlBOUUhHX1hXdnFwZWBgY19eZWFiYV1fW1hcW1haZWFeeXRnfnJdi3ZcgG5WaF5HXVU/U0w7UEczXE81c1s1i2xDl35ZhXtiTUpGTk1JWlpJgndZkIJqdHNxcnV4cnR2dHR2XFteRURHSUhKTktNVFBSWVRTX1VLdWNIk3pOspFW06hf3bdu3cuZx7+qi4R1bGRVTkk+NjMuODIwaV1SrJqCz7yez8GhuKeGm35ZkXBGjXRKkoVggnlgX1pQVFJNWVdSW1hUZmJfb2xpdnJye3h3amlmTUxKRkRCSkdFSkdHSERLQj1ESUVDamBRq5dxxKt6uJtluZVes4xWmntOjXlUX1ZISklJU1FSXltbYV5bXFlVW1ZUb2pqko2Og36AamZoamZofXt5fn15iIaBg4F9g4B8hH98hH98hIB9gn16dHFsZmJdaGRfZWJfYmBcZmRgXFpWX11adXNvg4F+dHFwXVpZaGZkb2xqU1FPVFFPUE1LTElJPDg5LiotMC4xODk5QkJAR0NAQz87ODIuNi8sNjAtNjAtNjAtNS8tNC4sMywrMywrMispLiciJiEaIxwXIRsYIRsaIhsdIRodIx0fJR8fJiAhJSEjIyEjISAiHh0fIB8hLSwxNjU6MzI3KykvJSIpIBojHBceGRMaFxAXFRAVJh4kRjpFW0xbbVpvemZ+cmF2TUBQNSkzOCwzPDM2Pzc6QDk7Qjw8RkBAQj09JSEjHhocHxscHhscHhsbHhsbHRoaGhcXFxUVFRMTExEREhAQCwoJCwoJCwoJCwsJDAsJDAsKDQwLDQwKDgwLDg0MDw4MDw4MEA8NEQ8OEhAOEhEOExEPFBEQFBIQFRMSFhQSFxUTGBUTGRYVGxgWHBkWGxgVFhQSEQ8OEA0MEA4MEA8NEg8OEhAPExAPFBERFBIRFhMRFxQTGBUTGBUUGhcVGxgXHRoYHhsZHx0aIR4cIx8dJSEgKCQhKiYjKyglLSomLywoMi8rNDEtNTIuNjMuOjYwQDs0SEI7TEQ/TEU/T0dCVk1JXFJNW1JMVU5JUElFXFZSV1JPV1NQZF9dc29vbGlqYV9gW1laU1BSV1FSamBeZlxbZF1Tb2hYcGpbXVQ/ZFU3c144lXpYiXtqYl5XREJCSUpKUFNPWVlQXl1YY2VoZmhrdHR3iIiLfn2AWlZbUE1RVVJVUU1QVlBJZ1Y8gWU6pYFHvo9RyJVVzqVi0LiCysKexsOgwrqWmY9zU0o7RDswaFxMj4ButqePwbSXqJl9n4VmmXhRkHVNjntWfG9VWFJHTkxIUlFOV1VSZWNgdXFwfnt7eXd3YF9fVlZVTExMRENBQUFAR0VJRkNHVVJPa2dalox0zb+buqd4ln1TiWpCiWdAimxJbltDT0pESUZET0xJVVJOXlxXXltYcm9uhYKCamdobGlscW9wcXBuc3Jue3l1h4WBiYWChoJ/gX16hYF+g398g397fXl2dHFtcm9samhkZWNfYF5aeHZzkI6Mf317gH58dXNxdXNxfXt5WFVUTUpIT0xKUU1MTEdKQDhAPztAPUE/O0Q+PT86NjItNC4nNS4pNjAtNjAtNjAtNC8sMy0rMiwqMiopMispMyopMSglKyMfJR0aIRkYHxcYHxcYIBoaIx0cJB4fIx8hIR8gHx4eHx0dHRwdISEkMzE2OTc8KicuJCAnHxkhGxQcGhIaGRAYFxAWFxAVHRQaMyYyVkVbaFZwa1lzUkJWNyo3NyozOC40OzM2PDU3Pjg4Qjw8Pzk5JCEiHRocHhocHhobHRobHRobGxkZGRYWFhQUFBISEhEQERAQCgkICgkICwoJCwkJCwoJCwoJDAoJDAsKDQsKDQwKDQwLDg0MDw4MDw4MEA4NEQ8OEg8OEhAOExEPFBEPFBIQFhMRFxQSFxUSGBUTGRcVGxgWHBkWGhgVFhMREA4NDw0MDw0MEA0MEQ8OEQ8OExAPExAQFBEQFBMRFhMSFxQTGBUUGRYVGhcWHBkYHRsZHhwaIR4cIh8dJSIfKCUjLSonMC0qMS8sNDEtNDIuNTMuNDIsNTIsPDgyR0A6TkdAUUpDUktCVU5FWVNKVlFIS0U+UUtEVE9KV1NOWVVRYl5cbmxrZGJjW1laVlNWVlFXWlRZV1FVYlxZiYN5mZSHf3lkZls+bF8/iHdcaF5UTUpHS0lHT09NUVFPTk5NS0tOU1RYXmBid3d5h4aJhoSHf3yAdXJ2amZqVlJSV088ZlYzdVo0k3A9qH1EtIZNvpRYwaJsw7aNzMei1cuiwbKIjHxWeWpIgnNTf3BciHlmlYZtnpB3moVplHlXiXFLgWhDfWdMWVRJRUVASklGUFFOVFNSWFdXYF9gY2NkXV1dW1tbUlJSS0tKU1NTVVVUTExLZmZhcnBnhX9wwLSYsZ94g21MgWJBkW1IlHNQfGhQUUxERkM+TEpFUU9JX1xXXFlXWlhWWldYXFlafHl7gH5/b2xsaWdkeHZyjIqFlZGOjoqHhYF+iISBjIiFjYmGjoqIhYKBb21raWdmY2JgY2JgcG9ufHp5cnBue3l3dHJwamhmZWNhWVdVT05MT01LUE1LSENFSEBHQz1APj87PEA7NTYuMS0lMi0mNjAqNzEtNjEtNjAtNS8sNC0rMisqMiopMiooNCooNispNispNSonMCYkJh0dHxgXHRcWHRkXHhsaHhsbHhsbHRwcHR0dHBwdHRwfJyUqMC00KCUsIh0lHxggHRQcGxIaGhEZGREYGhAXGg4WIBMfRjZPV0RlVUNhVUVcRjdGOSw2OCw0Ny4xNy8yOTEzOzU1OTMzIx4gHRkbHhobHRobHRkbHBkaGhgYFxUVFRMTExEREhAPEA8OCQkICQkICQgICQkICgkICwoICgoICwoJCwsKDAsKDQsKDQwKDgwLDw0MDw4MEA4MEA8NEQ8OERAOEhAOExEPExEPFBIRFhMRFhQSFxUSGBUTGRcUGxkWHBkWGhcVFRMREA4NDQwLDgwLDw0MEA4MEA8NEQ8OEhAPExAQFBEQFRMRFRMSFxUUGBYUGhcWHBkXHRsZHxwaIB4bIiAdJiMhLConMjEtNDItNDItNDEsMzArMjAqMy8qNjIsQjw1UUtCVlFEU01BUUtAUEpCVk9IYFlSWFJMTEdCUExHWFVRVVNRaGZlZ2VmZWBkZ2JnY11jWVNXXllZhoJ7nJmLgH5sZF5HY15FbWdTWlVMUE1LS0lHS0tJS0xKRUdHSUlLUlJVW1teaWhre3p9iIWJgn+Dc29zbmluWFBPV0w0ZVQtcVkwgWIyi2YylW45pXxCrYdOro5btZ1xvql4t55otZphq5Vfj35VbV5Kb2BQf3Fcl4p3kIFwkYBokX1ginFPln5deHJlTE1IPj86SUpITEtMRERGPD0/Ojo8RERFTExMS0tLVFRUYGBfWFhVU1VRfX16bmxqYFpWmIp1o41rim1Jh2RAi2pIkntgfnVmV1RNUE5JWFZRY2FcX15ZTkxIZWNhiIaFcG5uc3BxdXJyaWhlbmxnjoqFnJmUmJSRj4uIiISBh4OAioaDjYmHi4eGj4uMioeIeHV2XVxcW1tbZGNjYmFhZ2dmamlnYF5camdmXFpYTEpITktJTkxKTEpHQj8+Qjw7Qzs7Pzs4NzMuMCwkLyohNS4oOTItOTItOTEuNzEtNi8tNC4rMysqMyopMyooNSooNispOSwqOi0qOi4rOCwqLyUkJB0bHhkXHBgXGxoYGxoZGxoZGhoZGhsaHBoeHhsgIh4lIx8mIBwiHxohIBggHRUdGhIaGxAYGw8XGw0VIRIfPCtFTDpcUkBbY1NlU0NSPS85Oy01NCouMyotMywtNi4vNC0tIR0fHRkbHRkbHBkaHRkaHBkaGhcXFxQVFBMTEhEQEA8PDw4OCQcHCQgHCAgHCQgHCQgHCQgICgkICwkICgkICwoJDAsKDAsKDAwKDQwKDgwLDg0MDw0MDw4MEA4NEA8NEQ8NEhAOExEPExEQFRIQFRMRFhQSFxQSGBUTGRcUGxgVGxkWGhcUFRIQEA0NDQsLDQsLDw0MDw4NEA0NEA8NERAPEhAPExEQFBIRFRMSFhUTGBYVGhcWGxkXHRsZHx0aHx0bIyAeKiglMTArMzEsMjArMS8pMS0nMi4oMy8pNTAqPjgxTkk+VU9CUUo+TEU7UkpDXVZQWFFMTEZBS0hCVFJNRUNAXFpZb21tbGhqbGdtaWNpV1NXSkZKV1NRYV9VWlhOVVRGX2BPXl1QT01JTEtJSUhGSkpIR0hHQkRERUVHUFBSWFdbXVxgaGZqZ2RoVVFXU1BTXlhbWlBPYVE+bVYyeF0wfV8pgFsohF8ulnE4p35CpXs+pH1DsY5RtpJSsI1Lp4hPlXxNc2BEYFFBcGNTg3dpfnNpjoJyopR9kX9mi3dhc21gVlhRP0E8QUFCRkZIRERGQ0NFOzs+QEBAR0dHSEhIUVFPVVZTSktHUFBOW1tZR0NFRkBDdmpeoItslHVQhmRBg2pPhHVjamRbTUtGTUxIW1lWampmd3Zyamtjg4R8lJKPcm9uYF1dZWNhc3FtfHpzj4yGnZmUlZGOjImFf3t3fnp3g4B8gHx6fXl5g4CBjImLf319X15fVlZWUFBQXVxdcnJybm5uYmFgXlxbS0hHRkNCSkdFSkhGQ0E/R0RBZmBbX1hURz87Ny8oMSoiMiwkOjIsOjMtOzMuOjIuOjMvODIuMy0qMCkoMSkoNSspOCwqOSwqOi0qOy0rOy0rOy4sOi4sNSopLyYkJyAfIx8dHRwaHBsZGxoaGhoaGxkcGxgdHBkfIBwjHxshIBshJR4lKB8oIxojHhMbHBAZHQ8aJhYlMyI4PixGU0FXaFdoVURTPzI6PC81MScrLycpMCgpMSorMCkpIh0fHBkbHBgbHBkaHBgaGxgZGBYXFRMUExISERAQDw4ODw0NCAcGCAcGCAcGCAcGCAgHCAgHCQgHCQkICgkICgkICgkICwoJCwoKDAsKDQwKDQwKDgwLDg0LDw0MDw0MEA4NEQ8NEQ8NEhAOEhAPExEPExIQFRMRFhQRFxQTGBYTGhcUGxgVGxgVGRcUEhAPDQsKDAsKDQsLDgwLDwwMDw0MEA4NEBAOEhAPEhEQFBIRFRMSFxUUGBYUGhgWHBoYHhsZHhwaIB4bJCIfKigjLy0oMC4oMCwnMSwmMi4oNS8oNzErPTYuRj82Tkc8TEQ6SUA6TkQ/U0tGWFJMUk5ISUdBSUVCUU1MYV1eaGNlamZqaWRpXVlcRUJGQj1APDk5ODc1Pj48U1RNVlZRT05MTU1LS0tKRkVFRUZFQkNDQ0NDT09QVFRXV1ZaXVxgVlRaVVRYY2BgZWFdamBXd2FIdVc1e10zgmAug14sfVwri2kzn3pAqYVItpNXwqFjtI9SoHlCl3Y9kXVBfGZEWk1BTkI5Y1lOeHBihXpno5J8o498e2ZWZFtLWlhLSElDQkJBQkNERkZJTk5PR0dHQUFCRkZGS0tKTExJTU1KS0xISUlIRERDOzo6QT1Ba2NZoZN3nIdlf2pNbV9OY1lQTklEPz06SkhGU1NSWlhaamhphoaBkpKKa2lkX11aXFdWWVVTaWZhamZfcmxnh4F9jImDjouGgHx5g4B7jYmFfXl4bWptcG5yeHZ5dnZ4ZWVnXFtdT09RVlZYbW1ubWxtYF5fT0xMREFARkRCRkRCSEZESkhFZV9blIqGdWxnTEI8PjQtOS8oOzMtPTQuPTQuPDQuPTUvOTIuLCclIx8dIR0cIh4dKCIgMCYkOi0qPi8sPi8sPS8sPC4sOi0rOCwqNSopMScnLCQkJiEgIx4fIR4dIBwdHBkcGhYdGxcdHhsgIR0iIh4jLSUtQDY+OC03LCAsJRgnKBksLBswLRwxNCI4TDpRYk9mVkVXQjM9PC81MigrLCQnLSUnLiYnLygpJiAiHBcaHBgaHBcaGxgZGhcYFxUWFRMTEhEREQ8PDw0NDQ0MBwcGBwYGBwYGBwYGCAcGCAcGCQgGCQgHCQgHCgkICgkICwoICwoICwoJDAoKDQsKDQsKDQwLDQwLDgwLDg0LDw0MEA4NEA4NEQ8NERAOEhAOExEPFBIQFhMRFhMRFxUSGBYTGRcUGxgVGhgVFhMREQ8ODAsKDAoKDAsKDQwLDgwLDg0MEA4NERAOEQ8PEhIQFBIRFhQTFxUUGRYVGxkXHRoYHhwaHx0aIB4bJiMfKigjLislMCwmMi0nNTAoODIrOjMrPDQtQTgySD43ST44Rjs1SD04U0xGWVRPVU9KS0VCR0RCVVFSZV9iamVnY15haWZpUk9TPTk8Pzs/Ojc6Pjw/SkhLUlJUUFBQT09PT09OSUpKSEhIRUVFUVFRUlFTT09SU1JWUlJVX15idXRzfX12hYN2qp+KlnpXd1gzeV45gGQ8gmU8e14zhWU0lXU9qIxQwqZqr5BbkHA/hmU3elwodl0wcVxCWU5HS0I+TkY/aWBSgHNfi3ZewKOCwqaBh3tdX1dIUUpHSEVHR0dJS0tMTk5OS0tLSEhHSklJSkpJSUlHSEhFRkZES0tKTk5OSEhHRkVEX15QmZZ5ppl4gnRcX1ZITkg/PDk3PTo5SkdGVFFQVE5SVU1SZV5fa2ZkYV1aXVtYWFNSTUlFX1pUYl5WYl1XeXRugX13h4R/hIF9iYWAkY2Jgn5+aGVqaGVrb25ydHN2amltYWFkXV1fX2BiZWVnZmVmW1laTElKSUdGSEVERkNBQD07U09Me3ZxkIeCa2FcUUdAST43PjUvPTQvPTUvPjUvPzYxPjUwKyYjHhsZHRsZHBkYHBkXGxgXHhkZJiAeNCgnPi8tQTEvPjAuPC4sOSwrNSkoMScnLCQkKCIhJR8gIh4fIh0fIBseGxYbGRUaHBgdIBwgIx4iNS0zVkxTU0hSQjVGNCU8Lh05Lhs4KxkzLhs0PChCU0BYU0FVQDE7Oi0yMigrKyIlKyMlLCQmLicoJiAiGxYaGxcZGhcZGhYYGRcXFxQVFBESEhAREA4PDg0MDQwMBgYFBgYFBgYFBwYFBwYFBwYGBwcGCAcGCAcGCAgHCQgHCQgICgkICwoICwoICwoJDAsKDAsJDQwKDQwLDgwLDg0LDg0MDw4MDw4NEA4NEQ8NERAOEhAPExEPFBIQFRMRFRQSFhQSFxUSGhcUGhcVGhcUFhMSEA8NDAoKCwoJDAoKDQwLDQwMDg0MEA4NERAPEREOExEQFRMSFhUTGBYUGRgWHBoYHhwZHxwaHx0bIR8cJiQfLiokNC4nNzApODEqOzMsPTQtPjQuQjcxRTo0Rjk0RjgzSTw4U0lGV05LTEVCPjs3S0hGYVxdZF9hVlFUYV5hZWJlSkdKRUJFQD1BOzg7REFFS0tNS0pLT09PUlJSTExMTk5OYGBgZmZmVlVXTk1QTExPSkpNZ2dpioqHiYmAiol7q6KKpIxoinJQfGZNh3RakX5fgGdEg2I2jGo0l3xEpo9alH1Ng2g6f2Q4el80clo1ZFM+U0lESEA9QDk1RT01bF1Of2lRkndQwKNvx62ChnVhT0ZFR0RJUlJXYWJiWFhXT1BOTU5MTk5MTExLSkpIR0dFRkZES0tLTk5OS0tKRERBREQ5Y2JKnJBwoZJ3ZVpLT0hAPzw6Qj8+SkVDUktHeG9ngnZub2NdYFdTXFZTVlJQU09MTUlDYFxVYl5UaWRciIN8hoJ9fHlzgHx4hIB7i4iDhYGBbWpva2hwbmx0cG91a2twY2NoYmNnY2RnYGBiX19hWVlZTkxLSkdHTUpJS0ZFQj08XlpYgX15dnBrXVVPWlBJSkE7PDQwPjUwPzUwPzYxQTcyNS4qIR4cHhsZHRoZGxgXGhgWGxcXGhcWGhcWHRkZKCAgNiooPC4tPS8tOi4tNSopMScmLCUkKCIhJB8gIx4fIh0fIx0gHhkcGRUZGxYaGxcbGxcaIRsfQjo/ZVtiWk5bPy9GLx07Lho7LBg3KhYxLhs1QC1ESDZJOys1NSgtLyUoKiIlKiIlKyMlLSYnJR8hGhYYGhYYGhYYGhUYGBUWFhMVExESEQ8QDw0ODQwMDAsLBgUFBgUFBgUFBgUFBgYFBgYFBwYFBwYGCAcGCAcGCAcGCAgHCQgHCQgICgkICwkICwkIDAoJCwoJDAsJDQsKDQsLDgwKDgwLDw0LDw0MDw4MEA4MEQ8NEQ8OEhAPExEPFBIPFBMQFRMRGBQSFxUSGRYTGhcUGRcUFRMREA4NDAoJCwoJDAsKDQsLDg0LDg0NDw4NEBAPEhEPFBMQFRQTFxUUGRcVHBoXHRsZHhwaHx0aIB0bJCEeLikkNjApOjIrOzMsPTMtPzQvQDQvQTUxQzYyRzgzSDg0Rzo3SUA8SkZBR0Y/TElEVVFPXlpaVVFSUExOZmRlcm9xVFFSQD1BMC0wOzg8Pjw+PTs8SUlJU1NTSkpKU1NTamtqYGBgVFRWT05SSEdLRkVJW1pdYV9fT01KSEU/YFdKe25XiXtlc2NTdGRSqp6Dn4triGY8iWMuhmc0mH9Qooxdhmw+eWE2dl45cVo4Xk87TUU/Qzw4QTo3OjMvT0Y+alxJbVxAaVMxiGg/moJdb2NPUU1KY2NmeXl5XFxaVFVRVVVSTk5MTU1MTU1MS0tKSEhGTk5NVVVUSkpIOjk6OTo1U1FBlYhvpph/XVVJUEpDSEVESERCRD48ZVxVua6UybqdmodxcmJOXVNGUUpBV05CX1ZFbmhXcnBgdXJohoF3hYF7e3dyeHZvf312hYJ7fXl3Z2RoZ2Rsb212bm52aWlwamtyamtwZ2hrZGRnWVlcUlFTSUhHS0lHUU9NSkVGTEdHZF9dZWBcV1FLWFJLVExFQDgzPDMwPjUwPzUxQTgzOTEtJCAeHxwZHRoZGxgXGhcVGRYVGBYVGRYVGhYVGhcWGxcXHhkZIx0dKyMiMScmMigoMScnLCUkKCIhJh8gJB4gJR4gJh8iJBwgGhUXGRUXGxYYGRUXHxkcMCktTURIZFphTUJQOixCMyE9MBk6KxM0Lxg0PypBSzZKQC87NCcsMCUoKiIkKiIkKyMlLSYnJSAiGhYYGhYXGRUXGBUWGBQWFRMUExAREA8QDw0NDQsMCwsLBQUEBQUEBgUFBQUFBgUEBgUFBgUFBwYFBwYFBwYGCAcGCAcGCAgGCQgHCQgHCQkICgkICgkICwkJCwoJCwsJDAsJDAsKDQwKDQwLDg0LDg0LDw0LDw0MEA4MEA8NEQ8NEhAOExEPFBIQFRIQFhMRFhQSFxUSGRYTGRcUGRcUFRMQDw4MCwoJCwoJCwsKDQwLDg0MDg4MEQ8OERAOEhERFRQRFhUTGBcVGxgWHRsXHhwZIBwZIB0bIh8cKyYiOC8pPjMtPjMtPzQvQDQvQTQvQDQwRDYyRzg0RjczQzczRD04TUpEVFBLU09LVVFOVVJQUE1MYV9ednRzYF1dREJDNDEzNzQ3OTY5LywtQj8/VFFSQD8/TU1NQkRERUZGUVFSS0pNREJGPDg9PTk9NjM1LispKyYiNjEqTUY8ZV5RW1FFS0E1gntpu7CVr5dtiWkze10lhGcyi20+g2g7dF0yaVIsaFMuYFE1SkM6PTUzPzc0QTs4QT46Skc/WFBCYVREYEwuZ1UtbmVCYlxGamlhb29tWVlWWFlWX2BeU1JSS0tLUFBPT09PRkZGVlZWb29uV1hWODg6Pj49UVBLX1tVWldSSERCSEVCR0RDR0NCUEpFlYt6vrGOxLGHzbSJp4xggmxGbFc8cVs/eGM8loReu7ehtrWilYx1hHdofnVpdXJpfXx0hYR7dXFsVFFUUk5YZ2Vubmx1a2x1dXZ9cnN5aGhsYGBjVlZYTU1OR0dGR0NCTEdIUUxNVE9PUEtJR0I9SkU+UEpDRD04OjIvPDQwPTQwPzYyPjUxLCYjIB0aHxsZHBgXGhcWGRYUFxQUFxQTFxQUGBUUGRYVGhYWGxcXGhgXGxcXHhkaIRwdJR8fJyEhKCEiKCAiJyAhJyAiKSAjKSAjHxgbGRQVHBUXHhcZKCEkMywxMiwxQTtAUUpRST9MQTBIPihJOCBBOyFASzJLXUhaTDpINyovMiYpKSIkKSIkKiMkLCUnKiQlHBcZGBQXGBUWFxQWFxQVFRITEhAQEA4PDg0NDAsLCwsLBQQEBQQEBQUEBQUEBQUEBgUEBgUFBgUFBgUFBgYFBwYGBwYGCAcGCAcGCQgGCQgHCQgHCQkHCgkICwkICwkJCwoJDAoJDAoKDAsJDQsKDQwLDQwLDg0LDg0LDw0MEA4NEA8NEQ8OEhAOExEPExIQFRIQFRMRFhQSFhUSGBYTGRcUGRcUFRMQDw4MDAoJCwoJDQwLDQ0LDg4NDw8NEQ8OEhIPExMRFhQSFxUTGhkWHRkYHRsYHxsZIB0aIh4bJyMfNS0oQDQvQDQvQDQvQDQvPzMvPjMvQDQwQzUyQzUxQDYyRT85TkpFU09KUExHU09LUlBMT01JXlxZa2hnVVJSQT4/Qz5BPzo9LywuOTY2QDw9NTQ1PT49KCsqOjs7R0dIQD9DQD5CODQ4Mi4wMjAwMi8tMy8qPzk0UUpEXVZPWFBISEM7e3Ztw7yrw7aYoItfgWcygWgzk3tJpI5eqZVkk3xLb1orZ1cxTUI0PDQyODAuOjMzOzg2QD89REI9T0k/X1I/YlM5XVQzaGE+amZSZWZgb25rZmZkVFRST09NTExLSEhIRUVGPDw8UVFRcnJxYGFeSUlJS0tLU1NUS0tLPz9AQ0JCSEZFSEVES0hGXVhSmY95vrCKtqF2spdnqYpXlnZGgWA4h2c/moFVp5t2paKHqZ57nYRZiXNPinpefHRjcnFqb25mb21mVFFTSkdQYF5obGt0bm94eHmBdHV8YGBlWVhbUlFTR0dHRkRERUBASUNDW1ZVVE9MPzo1PTgxQTw1QDo0OzMvOjMuOjMuPDQwPjYyMisoIx4cIR0bHhsZGxcWGBUUFxQTFhMSFhMSFhMSFhMTFxQUGBYVGhYWGxgXHBgYHBgYHBgZHBkaHhkaIx0eKSEjKyIkKyEjKyIkLCIkKCAiHhcYHBQVHxcYJh0gLigrMCsvLysuPDc6T0dOU0ZTTTxQRTFIPyhDRjBJXUlbWEdTPTA1NCkqLCMmKCEjKSIkKyUnKiQlHBcZFxQVGBQWFxMVFhMVFBISEg8QEA4PDQwMDAsLDw0OBAQDBAQDBAQDBAQDBAQDBAQDBQUEBQUEBgUFBgUEBgUFBgYFBwYGCAYGBwcGCAcGCQcGCQgHCQgHCQkHCgkICgkICgoICwoICwoJDAsJDAsJDQsKDQsLDgwLDg0LDg0MDw4MDw4MEA4NEQ8NEhAOEhEPExEQFRIQFRMRFRQRFxQSGBYTGRcUGRcUFBIQDQsKCwoJCwsKDQwLDg0MEA4NEA8OEhAPFBMQFhQSFxYUGhgVHBoXHRoYHxsZIB0bIR0bJSEeMiomPTIuQDQvPjIuPjIvPTIvPDEuPTIvQDQwPzUwPDUwPzk0SkZAVFBLV1RQTEtEREM+TUpIYl5dX1pcU05PUEpMR0JENTEyLywtLCorKCgoKCgoKCgoLCwsNDQ1PTxAOjg8Ozc8MS0vMC0uODQ0QT06VE5KZV9aYlxXXlZSUUpHb2pnjYZ+kId3s6mOpZl0pZZsuat/vbKEwLaHv6t2inJCbFYzU0U0Pzk2PDY2MistODU0NzYzPT06QD48QTs2WE09cGRIfnNRcmpVbGljfHp3a2lnQkI/QkI+Q0NCOTk5NjY2OTk5R0dHUVFRUFBPTU1NUFBQWFhYQUFBODg3Pz4+T09PUlFQU1FPXllXeG5hr6B/q5ZpfWEydlgpiGg6lXRGqo1hxLGLxr+htKyLnoZZm3VAkW8+kXtVdmxTa2lba2phZGFdVFFUVlNaYV5oamlzbW13b3B5ZmVsWFdcVVNXT05QSUlJSUhJSUVEV1NPbGdhVU5GPDUsPTUqPTYtPDUuOzMuOzMuOjMuPDMvOTEtKSQgIh4bIR0aHRkXGhcVGBQTFhQSFBIRFBIRFBIRFRIRFhQTFxQUGBUUGhYWGxgXHBgZHBkZHRkaHRkaHRkaIxweLCMlLiQmLSMmLSMlLCMlKSAhIhgZHhUWIRcZJR0fKiQnLSkqMi0wRT9BU0tMUUdKXE9XWUlYRDRDUEBMV0hRPjM1NiwrLSUmJyEiKCIkKiUlJSAhGRUWFxMVFhMUFhMUFhITExESEQ8QEA0ODQsMDQwNEQ4PCQgHCAgHBwcFBQUEBQUEBAQDBAQDBAQDBQQEBQUEBgUEBgUFBgYFBgYFBwYGBwYGBwcGCAcGCQcGCQcHCQgHCgkHCggICgkICwoICwkJDAoJCwsJDAsJDAsKDQwKDgwKDgwLDg0MDw0MDw4MEQ4NEQ8NEhAOEhEPExEPFBIQFRMRFhQRFxUSGBYTGRYUFxUSEhAODQwLCwsKDAsLDg0LDw4NEQ8NERAPFREQFRMSFxYTGhcVHBkXHRoYHxsYIB0aIR0bIh4dLickPTEtPzIuPDEtPDAtOzAtOzEuPDEvPTQwOTQtNzMsOTUxRUE8U1BKT0pFSEM/SUNBV1BRVU9RWFJUXldaSEFEMi0uMCwtLCoqJyYmJyYmKCgoJSUlKiorLy8yMC8yNDI1MC4wMS4uQD08VE9NbGdkbGZjWFNPTkhFRD89VlJRe3Z2iYR/k42DlY99p6CHvLWZvbiZvrmXwK5/lXhPclQ2Xko3Pjg1Pjg6MywvNDEwNjUzOzs4Q0JBPDs7SUM+aF5Oe25bcGdcYl5aXFpYU1BOQEA9QUI/Pz8+OTk5MjIyNTU1QUFBRUVFR0dHR0dHT09PTk5OMTExLi4uNDQ0SUlJUFFPUVFQXlhXXlJHh3dXhG5HblModlgqkW9AtI9axKFtvZ5xsptxtJ1xt5pmn3xHiGMyk3pQd25PZGRRbm5jZWJfXVpeYV1mZGFtZmVvYmJsXV1mWFdfVVRaU1FWUU5RTEtMTEtNUE1NX1xWY11RVEs7RTwrRDgnQzgqPzcvPjYuPDQuPDMuPTQvMywnJSAcJB8bIRwZHRkWGRYUFxQSFRIRExEQExAQExAQFBERFBIRFhITFxQUGBUVGRYWGxcXHBkZHRkZHRkaHRkaHRkaJB0fLyQmMCUnLyQmLCMlLCMkKSEhJBscIBcZIBcZIhscJyEjLigpNjAwPzk3RkA+cWtpfHN0UEZKSj9DTkJHPTI0NSsrKSIjJiAhJyEiKSQlIBsdFhIUFhMUFhIUFhITFRITExAREQ8PDw0NDAsLDgwNEA4PDQwKDQwKDQsKDAsKCwoKCQgHBwYFBQUDBAQDBAQDBQQEBQUEBgQEBgUFBgYFBwYFBwYGBwcFBwcGCAcGCAcGCAcHCQgHCggHCQgHCgkICgkICwkJCwoJDAsJDAoKDAsKDQwKDQwKDQ0LDgwMDw0MEA4MEA8NEQ8NEhAOEhEPExEPFBIQFRMRFhQRFxUTGBYTGRYUGBUSEA8NDAsKDAsKDgwLDw4MEA8NEhAPFBIQFRMSFxQTGhcVHBkXHRoYHxoZIB0aIR0cIx8dKyUiNy0qPDEtOzAtOzAtOzAtOzEuPDIwOjMvNjEsNjAsOTMvRT06V05LW05NVUdHVUxMTkdHUkpLYlxeV1FTMiwuMCosLSkqKicoKScoJycnJSUlIyMjJSUmKysrMjIyNzY3MzMyOTk2VVJRaWVjXFdVQDs5Pjk4QDs8SkZJYV5iZGFmW1hbY19fhYF5mpeIrqqUuK6Tt6B3o4NYe1s7YEo2OTEvPzo8OzY6KikqMjIvNDMwQUA9Tk5MS0dFTkRCc2dlh4B+XFlWQ0A+QT89Pz48PDw8PT09QEBAQUFBQUFBPz8/Q0NDQ0NDRERETU1NQkJCKysrKioqLy8vQEFBSE1KTExKU0lAY1I3e2dBeGA6fmI2knI/pYJNt5FZs4xSpHtBnHM8lm42oX1Dmng+h2g2l4BViX1dZWFRa2dhb2tpZWJnY19pZGFtYWBqW1pkV1ZfV1ZfVVNZUU5UT0tQTkxQTktRUE5PV1NGU0w2VksyVkgvUkEoTj4pRTovQTguQDYuPzUuPTMtLigjJSAcJSAbIRwZHRkWGRYTFxMSFBIQExAPEg8PEg8PEhAQExEQFRIRFhMSFxQUGRUWGhcWGxgYHBkZHRkZHRkaHRkaHRkaJB4fLyUmLyYnLCQkKiMjKSIiKCIhJh8fIxscIRsbJB4dKiQkMSopNjAuQjw6V09OXlZVTEJDRDo8QDc5OzExMikpJSAgJR8gJiEhKCMjHxscFRIUFRITFRITFBESFBESEhAREA8ODgwMDQsMDgwNDw0OCwoJDAoJDAsKDAsKDAsKDAsKDAsKCwoJCQgHBwYFBAQEBAQDBAQDBQQEBQQEBQUEBgUEBwUFBwYFBwYFCAcGCAcGCAcGCAgGCQgHCQgHCgkHCgkICwkICgkJCwoICwoJDAoKDAsKDQsKDQwKDQwLDgwMDw0MDw4MEA8NEQ8NEhAOExAPExEQFBIQFRMQFhMSFxUSGRYUGBYUFRIREA4NDAsKDQwKDw0MEA8NEhAOFBIQFRMSFxUTGhgVHBgXHRoXHxsZIBwaIR0cIh4cJiEfNCspOzAtOy8tOzAtOzEuOzIwOzQxOzMxODEuOTAuPjMySz89WktLY1VUXlVUT0dHTEREUUpLYVtcQTo8LicpLykrKycpKSUnJiUmIyMjIiIiKSkpLS0tNzc3QD8/Ozw7Ozs5RkRDTElIS0ZFOjY0Pjk6QD0/QkBEUlFWVVNZTElQVFJVdHBujYqArquatq6YqpZyn4FXc1g4V0QyNi8sOjU3Q0BELCsrLS0rMzEvOjc2SkdGUU1LS0NDVk5ObmhnYV5cSEVCQT89QD8+QD8/QUFBQUFBQkJCPz8/PT09R0dHSkpKTExMSEhINDQ0KysrLCwsMjMzQ0VES01MV1JQgHBfiHFKel8zfF8zm3xFrYtQsIxRrYdLoXk7mW4wmm0xlmgwmGsylWsyjGo3lXtPl4dfgHZgdXBqcW1rXlpgYFxnYF5oYF5oXlxnXFpkWFZeVlNZU09WS0hOTUpQUUxUW1RQW083Vkkpblw3a1g1YUwrXUgpTD4uRTkvRDgvQzgvPTMsLCYgJiEcJSAbIRwYHRkWGRYTFxMRFBEPEhAOEQ8OEQ8OEQ8OEg8PExERFBISFhMTFxUUGRUWGhcXHBgZHRkZHRkZHRkaHRkaHRkaJB4fLSUlLSUlKiMiKSIhJyEgJyEgJyIgJiEfJiAfKSMiLyknNC4rODEvPDQxPjU0PzY1PTQyOjIxNi0tKSMjIx4eIx8eJSEgIx8fGBUWFRITFRITFBESFBESExEREg8QEA4ODQwMDQsNDwwODgwNCwoICgoICgkICgkICwkICwoICwoJDAsKDAsKDAsJCgkICAcGBgUEBAQDBAQDBQQEBQUEBQUEBgUEBgUFBgYFBwYFCAYGBwcGCAcGCQgGCAcHCQgHCQgHCggHCgkICgoICwoICwoJDAsJDAsJDQwKDQsKDgwLDgwLDg0LDw4MEA8NEQ8NERAOExEPExIQFBIQFRQRFhMRFxUTGRYUGBUTEhAPDgwLDQwKDw0MEA8NEhAOFBIQFhMSFxUTGhcVHBkWHRoYHhsZIBwaIR4cIh4cJiEfMCgmOS8sPDEvOzEvOzMwOzQxPDQyOzQyPDIwQTIyRDU1Sz09XlJRa2FgZlxdW1FSRTw9WVFSVU9RMywvLScoKyUmJSIjJCEiISAhIiIiNDQ0QEBAPT09R0dHUFBQVFRTUU9OTEpKSUdHPz08PTs8QD1APz5CT09UVlRbR0RLV1RXdG9ujId+trWmtbKklodwiXJSbFY6UUIwMi0pOzc6S0dMOzg6MzEyNTIzOTY2QDs8S0ZHUEpLT0hITUdGVlJQT01KSUdESEZFSEdHRUVFPz8/Ozs7PT09Q0NDSEhIR0dHRkZGPj4+MDAwNTU1PT09Pz4/SUpKWVZTjH91v6qPlXhKfl4xmnlFsI5PrIlKrIdJqoNCono1nHIqmm4skWUskGUtjWQuimYyk3VEoYxdnIxyjYV/bWlqVFFXYl9pZGFrZmJtZ2RuXl1kWFRaVFBWUEpRR0NKS0hPV09SaVhId188iG9AnYJMg2s9blQtZ04rUEAvSTwwRzovRTovQDQtLSYgJyEcJiAbIx4ZHhkWGxcTFxQSFREQEhAOEQ8NEA4NEQ4OEQ8OEg8QFBERFRISFhMUGBUVGRYWGhgXHBkZHBkZHBkZHRkaHRkZHRgaIx4eKiMjKiMiKCIhJyIfJyEfJyIfKCIgKCMgKSMiKyUkLygmMyspODAtOjEvOTAvNSwrLycnJyEhIx0dIh0dIx4dJCAfHRkaFRETFRESFRESFBESFBERExAREg8PDw0NDQwMDgwNDgwNDgwNCQgHCQgHCQgHCQkICgkICgkICgkICgkICwoICwoJDAsJDAsKCwoJCAgGBQUEBAQDBAQDBQQEBQUEBgUEBgUEBgYFBgYFBwYGBwcGBwYGCAcGCAcGCQgHCQgHCQgHCggICgkICwkICgkJCwoJCwoJDAsJDAsKDQsLDgwLDgwLDg0LDw4NEA4NEQ8NEhAPEhEPFBEQFBMQFhMRFhQSGBYTGBYUFRMREA4NDgwLDw0MEA4NEhAPFBIQFhMSFxUUGhcWHBgXHRkYHhsZIBwbIR4cIh4dIx8eLCYkOjAuPTQxPDQxOzQyOzQyOzQyOzQyPzMyRTY3SDo7T0JDY1dYdGpqdmxtXFJTTUZFUEpKPDY2KSQjKCMhJSEhJB8gIiEhKikqRkVFSEhIPT09SklKWFdYZmVlX11eT01NS0lKQT9AOzk8Pj1BPj5CRkVKSkhPQT5FWVZac29udnFopaKUtbKimIt1fWlMYlIzTkMsMSsnMS0wQz9DTUlMTUpLPDg5Qj1ARD5BR0FFTkdKTklKTkpKWFRSXFpXVVRSSUlHPz8/Ojo6PDs7Pz8/R0dHTExMS0tLRkZGQUFBOjo6NTU1Ojo6QUFBQ0NDS0lKWVFMl4V2tZt6oH9Mq4ZSu5VbtI9JropAr4dCroRCoHgzlm4lmW8nk2cniFwkhFYljWMxlnZEqZJnopB2i4V+cG5wXVpfZ2VtYmBnV1RbYFxjXVheWVVZVFBUSEJISUVKTkpPXU9GbFI2j3BCoYJLr5BSlHdCdFcta1ArUkIvSj0wSTwvSDovQjYtLicgKCIcJyEbJB4ZHxsXHBgUGBUSFhIQExAPEg8NEA4NEA4NEA8OEQ8OEhAQFBISFRISFxQUGRUWGRYXGxgYHBgZHBgZHBgZHBgZHBgZHBgZHxobJB8fKCIgJyIfJyIfKCIfKCMgKCMhKSMhKSMhKiMiKyQkLCUkLCQkKyMjJyAgIx0eIh0cIh0cIh0cIx4dHxwbFhMUFBESFBESFBESFBEREhAREhAQEQ4PDg0NDQwMDgsNDQsMDgsMCQgHCQgHCQgHCQgHCQgHCQgHCgkHCQgHCgkICwkICgkICwoIDAsJDAsJCwoJCAcGBQUEBAQDBAQDBQQEBQUEBgQEBgUEBgYFBwUFBwYFBwYFCAcGBwcGCAcGCQgGCAcHCQgHCQkICgkICgkICwkICwoJDAsJDAsJDAsKDQsLDgwLDgwMDw0MDw4NEA8NERAOEhAPExEPExIQFRMRFRQSFhUSGBYUFxUTExEPDw0MDw0MEQ8NEhAPFBIRFhMSGBUUGxcWHBgXHRkYHhsZIBwbIR0cIh4cIx8eKyYkNi8tPDUzPDUzOzUyOjQyOTMyOTMyPzU1Sz4+UEREVUpLYFZXa2Bha2FiZ19eXVZSSEI9ODMvKiQjJyEhJiMkKygpPTs7T0tNTUpLUU5PW1lZXVpaZ2VmW1paSUlJRUVEOTk5Nzc5RENGZGNnXFthQD9FRkVMVlVZZ2RkdG5mlo+BqqKIno9ohXNHWlAqSD8mKiQgIh0gMSouTUhMXVlbT0lNTkdMUktPTERKSEJHS0dJRENCTExJYGFdZWZjTk5OPDw8NTU1PDw8SkpKU1NTTk5OSEhIPz8/NDQ0MzMzOTk5PT09QkJCPz8/R0RDWlJKjn9sr5RwsY5XvJRYvJNTs4tGp4A4qHw3qXw7m3Izk2wtl2wtk2Yph1kkfk0ij2AznHlMpY1pjn5hb2xjbG1tZmRoXlxiTUtQPjs+TktNWlZZW1VZUEpPRD5DS0ZLWVBKcFs+fWA3kHI8nYBFtZdZmHlFclUsaU4qU0IuTD0vSTsvSDovQjYtLycgKSMcKCIcJiAaIhwYHRkVGxYTFxMRFBEQEhAPEQ8NEA4NEA4NEA8OEg8PExAQFBISFhMTGBUUGBUWGhcXHBgZHBgZHBgZHBgZHBgZHBgZGxgZHBgZHxsbJB8dJyMfKSQfKSQhKiQhKSQhKSMhKSIhKCIhKCEhJyAgJR8eJB4dIh0cIh0cIR0cIR0cIBwbGBUWFBESFBESExERExARExAREhAREg8PDw4ODgwMDQsMDQsMDQsMDQsMCAgHCAgHCAgHCAcHCAgHCAgHCQgHCQgHCQgHCQkHCQgHCgkICgkICwoICwsJDAsJCwoJCAcGBQUEBAQDBAQDBAQEBQQEBQQEBQUEBgUFBwUFBgYFBwYFBwYGBwcGCAcGCAcGCQcHCQgHCQkHCQkICgkICwkICwoJCwsJDAsJDAsKDQwKDgwLDgwMDw4MEA4NEA8NEhAPEhAPExEQFBIRFRMRFhQSGBUTGBYTFhMSEQ8ODw4MEQ8NExAPFRIRFhQSGRUUGhYWHBgXHRoZHhoZHxwbIB0cIR4dIh4dJiIhNS8tPTY0OzUzOTQxODIxODEwODIwQDc3TUNDWE1OWk9RXVJTY1lZbWVjdW1qaWJfUUpJMSosJh8jKSQmNTEyTElJUk9QXFlaYF1eY2BhamdoaWdnWlpaTU1NRUVFPT09PDw+V1ZadXV5aGltaWhvaGhwVlZcXltaeXNsoJeFqp92o5JZgnM+T0cjPzgjIh4cIRseNzA0TUdMU05TU0xSUkpQVU1TT0hOSEJHRkNFPj49PD07S01LV1lXTk9ORERERERESUhITU1NTk5OS0tLRUVFODg4Li4uLy8vPT09Q0NDSEhISkpLTElKa2NcnpB4rJRsuJVdvJZVupRQq4VEmnE1mW8wm3MymXAwmm8ynnU1lWstglcjhFYllGQwo3xKpIplg3ZfaGZfb3BwampsUU9SMzAyMzAxUExOVlJTU01QRT9CQTs/SUJAcWFFiHFHi3FCknU/n4RNs5dek3dHbFEpZEknUkAtSzwvSTswSDowQzYuMCkiKyQeKiMdJyIcJR8aIRwXHRgUGRYTFxMRExEQEhAOEA4NEA4NEA4OEQ8OEhAQFBERFRITFhMTFxQVGRYWGxcXHBgYGxgYGxgYGxgYGxgYGxgYGxcYGxcYHBgZHxwaJSAdKCQhKyYiKyUjKyUiKiQiKCIgJyEgJh8fJB4dIx4dIh0cIh0cIR0bHRkYFhMUFBESFBESExERExAREhAQEhAREg8QEA8PDw4ODQwMDQsMDQoMDAoLDAoLCAcGCAcGCAcGCAcGCAcGCAcGCAcHCAgHCAgHCQgHCQgHCQgHCQgHCgkICwkICwkJCwoJDAsJCwoICAcGBQUEBAMDBAMDBQQEBQQEBQUEBQUEBgUEBgUFBgYFBwYGBwYFCAYGBwcGCAcGCQcHCQgHCQgICQgICgkICgkJCwoJCwsKDAoKDAsKDQwKDQwLDg0LDw0MEA8NEQ8NEhAPExEPFBEQFBIRFRQSFhQTGBYUGBUUFBEREA8NEQ4NExAQFRIRFxQTGRYUGhcWHBkXHRoYHhoaHxsbIB0cIR4dIR4dJSIhMy4sOjQyOTMyNzIwNzEwNzEwNzIxPTY2TUREXVJTYlZXXVFRWlBOXlVSZF1bVk9QMCkuJB0iKSQkNjIyS0dHTkpLYF1eZWJjXlxdZWNkaGdoYmJiX15eY2NjW1tbSkpMWFdaVFVaVVZbd3d+bm52YWBmZGBgbWdfhX1snZNskoNTZlo0SkEkNS8gHxocIx0hRT5EVE1VVk9XU0tUUUlRT0dQSEBJQTpCQDxAPj0+PDw8REREQkJCOTk5QEBAR0ZHSEdISUlJSEhIRUVFREREOzs7MzMzQEBAR0dHRkZHSUlKS0pMSkhMdG1ptKeFr5ptsJFbsY9Pq4hKmHU7lG4zl28wk20sm3Awpnw3p4E6m3MwgFgfflUdjGEhqYJHsJNpgnZhcG1nbW5uZGVnQD1AKSYnRUFCamRmXVhaS0VGOjQzMissQDgueWk+hXM/hGw3knVDoYVVqIxbh2xCZEooXEQnTz4uSjwwSTswSDoxQzcvMSoiLCUeKyUeKSMdKCEcIx4aHxsXHBgWGhYTFxMRExEQEhAPEQ8OEA4OEQ8OEQ8PEhAQFBIRFRMTFhQUGBUVGRcXGhgYGxcYGxcYGxcYGxcYGxcYGxcYGxcYGhcXGhYXGxcXHRkaIR0cJiEfKSMhKiMiKiQiKSEgJyEfJh8eJB4dIhwbHhoZGRYVFRISFBESFBESExERExARExAQEhAQEg8PEQ8PEA4PDg0MDQsMDQoMDAoLDAoLCwoLCAcGCAcGCAcGCAcGCAcGCAcGCAcGCAcGCAcGCAcGCAgHCAgHCQgHCQgHCQgHCgkHCwkICwoICwoJDAsJCwoIBwYFBAMDBAMDBAMDBQQEBQQDBQUEBQUEBgUEBgUFBgYFBgYFBwYFBwcGBwcGCAcGCQgGCQgHCQgHCggICgkICwkICwoJDAoKDAsKDAwKDQwLDgwLDw0MDw4NEA8NERAOERAPExEQFBIQFBMRFRMSFxUTGBYUFhMSEQ8OEQ8PFBEQFRIRFxQTGRYVGhcWGxkYHRoZHhoZHxsbIB0cIB0cIR4dIyAeKycmNjEvNzIwNzEwNzEwOTMxOjQzPDY0SUJBWU5NXVJPVEpGSUA7RD05Pzk4LCYpJR8hJiMiMzAvR0RET0xMXVpbYV5fXFpbXFpbWFdYX19fZmZnbGxsYF9gTk1QT09TTlBUTVBUVFVbX19mZ2ZrZGBhXVdQZ19MhnlYfG5IWlExR0ApKCQfHhoeIxwhPTY8UkpTVU1XU0tUT0dQTUVPRD1GPzhBPTg+Ojc6OTg5PT09QkJCPz4/Pj4+REJESEZHSUhIR0ZGQ0JCQUBARUREPDw8R0dGTUxNTktOSklLTEtNVFNWh4R8w7mTsZtrnYFMlXc/k3Q9iGgxiGYokmopl2soqXc0toc/q4E3nnIsj2MiiV0cjmEepXs8oYRWdWlUaGZjVVZXOjo9Ly8yQ0BBUU5PV1NUUk1NRkE/OjMyLygmRjwydGVCgXE6hW40i2w8lXdLlnpPblYzW0MlVD8pSz0wSjwwSDsxSDw0RTs0NCwlLScgLSYfKiQeKSMeJyEdIx8aHxsYHBkWGRYTFhQTFREQExAPEhAPEQ8PEQ8PEhAPExARFBIRFhITFxQUGBUVGRYXGxcXGhcXGhcXGhcXGhcXGhcXGhcXGhYXGhYXGRYXGRYWGBUWGhYXGxcYHhoaIRwcIBsaHxkaHhkZHRgYGBUVFhISFRISFBESFBESExERExARExAQEhAQEg8QEQ8PEQ8PDw4ODgsMDAoLDAoLCwoLCwkKCwkKBwYGBwYGBwYGBwYGBwcGBwcGBwcGCAcGCAcGCAcGCAcGCAcGCAcHCAcGCQgHCQgHCQkHCgkICgoICgoIDAoJDAoJCQgHBgYFBAMDBAMDBAMDBQQDBQQDBQQEBgUEBgUFBgYFBgUFBwYFBwYFBwcGBwcGCAcGCAgHCAgHCQgHCQgICgkICwkICwoJDAsKDAsKDQwLDgwLDg0MDw4MDw4NERAOERAOEhEPFBIQFBIRFRMRFxUTGBUUFxQTFBEQEhAPExEQFRIRFhQTFxYVGhcWHBkXHBoZHRsaHxwbHxwbIB0cIB0cIB4dKCQjMSwrNzIwODMyOTQyOzY0PTg1PTc0QDo3R0A8S0M9RT02OjQuMy4pLykpKCQjKCUkOzg3TEhIUk9PXFlaW1lZV1ZXWVlYT09PT1FQWVtaXFxeWllbSUlNREVJSEpPTU9VVFVcYGBmZ2ZqY2BhXltPhH5goY9od2ZCU0suPDcoHxwdHhogIhwkKyYtRUBISUNMS0RNR0BJR0JKPjlAQTxBPjk+Mi8yLy4vLy4vMzIzOjc6PTo+QDxARUJDQj4/R0RCQT48PTo4QT48QT88RkVEU09RUk5TUE1RUk9SXlxfgYB5raaKo5Bhh245dFsud1wyf14shFwijl0doGwps3w9rno4lmYhmGkioHInnG4hl2glp31AmnxPb2FRY2BfSktMISMmLi8xPDw9NTMzNDExPDk3PTk1OjQwPjQxYVNLf2tUinVMjXhFjHVCkHVKhmxGYEotUjwiTTsoSz0xSjwyST00ST02TEA6PzUvLykhLichLCYgKiQfKSQeJyEeIx8bIBwYHRoXGhcVGBQTFRMRExEQEhAPFBERFRISFBISFBERFBISFRMTFxQUGBQVGRYWGhcXGhcXGhcXGhYXGhYXGRYXGRYXGRYXGRYWGRUWGBUWGBUVFxQVFxQVFhQUFhMUFhMUFhITFRITFRISFBISFBESFBESExERExARExAQEhAQEg8QEQ8PEA4PEA4ODgwNDAoMDAoLCwkKCwkKCwkKCgkKBwYFBwYFBwYFBwYFBwYFBwYFBwYGBwYGBwcGBwcGCAcGCAcGCAcGCAcGCAcGCAcHCQgHCQgHCggICgkICgoICwoJDAoJDAoJCggHBgYFBAMDBAMDBAMDBAQDBAQDBQQEBQUEBQUFBgUFBgUFBwYFBwYFBwYGCAcGCAcGCQgHCQgHCQgICQkICgkJCwkJCwoJCwsKDAsKDQsKDgwMDw0MEA0NEA8NEQ8PEhAPExEQFBIQFBMRFhMSGBUUFxUTFBIQEhAPExEQFRISFhQUGBUUGRcWGxkYHBoZHRoZHhsaHxwbHx0bIB0cHxwbIyAeLyspODQyPDY1PTc1Pzk2Pzk2PjgzPTcxPTgxPjgxOzUvNjAsMy4sMiwsMi0sQj08TklJTElJVlJTWFVWT05OTU1NSEhISkxLVVdWXV1ebWxvZ2drWVpfTE5TSEpQTlBXWVpfYmJlZmRjdHJkr6qOu66OdmlNT0cxLiskHRoeIx8mJSAoJSApNjI6PThAQTtDOzQ9PzpCOjU9PTg9PDg8MCwwKSgqJiYmJycoNTE1Pjk+QDxAQz9BREBBPjs5NzMxMi4sODQyQD08SkdHUU5QT0xPUE1QT0tQTkxQW1hWcmpZhnpceGdDYk8uaFAxdlMrgFYiilkekl8hjVojk2EljWAdkWUgq4A1o3Ytmm4uq4VOrZRlhXdecGhcQUFAICMkJSYnJSUlJyYmKCUnLCkqLSkoNjEtUEhEaV9Zc2BPdWJHiXdSl4ZeiHRSbls+UD0oSjciSzoqTD4zSz8zSz83TEA5T0M9S0A7Ni8oLighLighLCYhKiUgKiQfJyIfJB8cIBwaHRoYGxcWGBYUFhMSFRMSGBUUGBYUFxQTFRMSFBISFBISFRMTFxQUFxQUGRYWGRYWGRYWGRYWGRYWGRYWGRYWGRYWGRUWGBUWGBUVGBUVFxQVFxQUFxQUFhMUFhMTFhITFRITFRISFBESFBERFBERExARExAQEhAQEg8QEQ8PEA4PEA4ODg4NDQsMDAoLCwkKCwkKCgkKCggJCggJBwYFBwYFBwYFBwYFBwYFBwYFBwYFBwYFBwYFBwYFBwYGBwcGBwcGCAcGCAcGCAcGCAcGCAcGCQgHCQgHCggHCgkICgoICwkJDAoJDAsJCgkHBgYFBAMDAwMDBAQDBAQDBQQDBQUEBQUEBQUFBgUFBgUFBwYFBwYFBwYGBwcGCAcGCQgHCQgHCQkHCQkICgkJCwoJCwoKDAsKDAsKDgwLDg0LDw4MEA4NEQ8OEg8PEhEPExEQFBIRFRMSFhQTFxUUFhMSEhAQExAQFBISFhQTFxUVGRYVGxkYHBkYHRsaHhsaHhsaHxwbHxwbHxwbIR0cKiclOTUyQDs3QTs3QDo1PzkzPjgxPDcwPDcwPjgyPTczNzEvNTAuNzAvQz08S0VES0ZFUUxMUU1OUE5PSkpKR0dHTExMVFRVYGBheXh7dXV5XF1hSkxSSEtRS01UWFpfZWVpa2lteXdylJCBiYNyYVlLPTcvIiAfIx8jKCQqJiErLCgyS0ZRRkJLSENLOTQ8NC83OjY8PTk+NTE1LCgsKSYpJiMnKCUpNzM3QDxAR0NIRUBFPTg5MSsqMCspLiknOTIxRUA/T0xMTUpMR0NGRUJESkZKT0tSVFFTaGJXenJidGtWaFY3bU8vdlEsflYliFwhkGMki10gkmcmo3s1q4Q/rINAnnQ0lm00qodUw6t6pZRvZFpJMS8tHyEiISIjIiIiIiIiJiMmKCQoKiYoPDc4U05OUk1NTEZDREA5X1lKdmpVaFpFVEQySDcmSzcjTj0rTkA0TkA2TkE4T0M7UEQ9UUZARz04NC0nLikjLigjLCYhKyUhKSQgKCMfJCAdIR0bHhsZGxkYGRYVFxQTGBUUGRYVFxQTFhMSFRISFBERFBERFRMTFhQTFhQUGBUVGRYWGBYWGRYWGBYWGBYWGBUWGBUVGBUVGBUVFxQVFxQUFxQUFhMUFhMTFhMTFRITFRISFBISFBERFBERExAQEhAQEhAQEQ8PEQ8PEQ8OEA4ODw0ODQsMDAoLCwkKCgkKCwkJCggJCggJCggJBgYFBgYFBgYFBgYFBgYFBgYFBgYFBwYFBwYFBwYFBwYFBwYFBwYFBwYGBwcGCAcGCAcGCAcGCAcGCAcGCQgHCQgHCQgHCgkICgkICwoJDAsJDAsJCQkHBAQEAwMDAwMDBAQDBAQDBQQDBQUEBQUEBQUEBgUFBgUFBgYFBwYFBwYGBwcGCAcHCQcHCQgHCgkICgkICwoJCwoJDAsJDAsKDQwLDQwLDw0MDw4NEA8NEQ8OEhEPExEPFBIRFRMSFhQTFxUTFhQSExAQExEQFRISFhQTFhUTGBcVGhgXGxgXHRkZHRsaHRsZHhsaHhwaHhwaHhwbJSIgMS0qPzk1Qjw3PzkzPjgxPjgxPzkxQTo0RD04QTo2NzAuNzEvQTo5R0A/SUJBUUxLVlNTUVBQSUlITExLU1JTUVFSUlJTZGRmY2NnSElOQkNJSEpQT1BXX19kbm1xamhvX1xiXVtcW1lXQT49JiQlJCEkKCMoKSUrKCMrLioyXllhWVRdVE9XSUVMRD9FSERJSERJNjM2MS0xNC8zLiovLyswOjU6PDg8Qj5CQj5CMiwwLCYoMisrNi8uPzcyTEU/TElGQkBAPDo6OTU2Qj5AT0xRT09QVVNNYl5RY11KZ1Y9clU3e1o3gWAximQrk2sxl3Ayn3g3r4tIsIpInXY3mnM3m3Y/qIRRpYpdemlKQTgrJiUjICMlIiUmISIjJCMkKSUpKiUqMS0zQz5GTUhNSUZIQEBBP0BBSkdBXVJEYFJAW0o0U0AoWUIoXkYsWUY0UkQ4UEM5UUQ8UEQ9UEU+UEVAQTgyMSolLykkLigkLCcjKyUiKSQhJyMgJSEeIR4cHxsZHBkYGRcVGBUUGRYVFxUTFhMTFRMSFBERExERExERFBISFRMTFhQUFxUVGBUVGBUVGBUVGBUVGBUVGBUVFxUVFxQVFxQUFxQUFhMUFhMTFRMTFRISFRISFBISFBERExERExAQEhAQEhAQEQ8PEQ8PEQ4OEA4ODw0NDAsLDAoLDAkKCgkKCgkJCggJCQgJCQgICQgIBgUFBgUFBgUFBgYFBgYFBgYFBgYFBgYFBgYFBgYFBwYFBwYFBwYFBwYFBwYFBwYGBwcGCAcGCAcGCAcGCAcGCAcGCQgHCgkHCgkHCgkICgkICwoJDAsJCwoJCAcGBQQEAwMDAwMDBAQDBAQDBAQDBQUEBQUEBQUEBgUFBgUFBwYFBwYGBwcGCAcHCAcHCQgHCQgHCgkICgkICgoJCwoKDAsKDQsLDgwLDg0MDw4NEA4OEA8OEhAPEhEQExIQFBIRFRQSFxUTFxUTFRMREhEQExERFRMSFhQUFxUUGBYVGhgWHBkXHRoYHRoZHRoZHhsaHhwaHhsaHxwaKickODMvQDozPzkxPzkyQDo0Qzs2Rz45Rz87PDQxNS4rPDUzRD48RD49Q0A/TkxLT01LRkRCT05MVVVVSkpKRERGUlFUVlVaSUlOR0dNTU5UWFhfbWxxeHd7aGZrVVJXTUxQQkBDMC0xKCUpKycrKycsKycsJiInLiouT0pPZWFlWVVaVFBUUEtQS0hNWFRYTUhNRkJHUk5STUlOPztAPzs/R0NHRD9DQjxBODA1MCktMCcoOzAsUUc1WVA8Tkg7PzwxPTgpPjYnRz8yTUo9REY9SEY+VU9BWFA/Wko4cl5GgmtLeWI5jnE7mXo/nX49pYdHooFJlW86k2w3mnM9nHZBk29Ab1MxVEEqOC8kIyAfICIkIiUnISQlJCQlKCQoKyYrOzc9RkJKSUNLQj9CPj0+QD9BT0Y/ZFM9fGZCkHdIfWU6bFQxblQzblQ5ZlE8Vkc7UUQ7UEQ8T0M7TUI9Sj87OjMuMSsmLyolLigkLCcjKiYiKSQhJyMgJSEfIR4cHxsaHBkYGhYWGRYVGBUVFxQTFRMSFRISExERExAQEhAQExAQFBESFhQTFxUUGBUVGBUVFxUVGBUVFxUVFxQUFxQUFxQUFhQUFhMTFRMTFRISFRISFBISFBERExERExAREhAQEhAPEg8PEA8OEA4OEA4ODgwMDAsLDAoLDAkKCgkKCgkJCggJCQgICQcICQcICQcIBgUFBgUFBgUFBgUFBgUFBgUFBgUFBgUFBgYFBgYFBgYFBgYFBgYFBwYFBwYFBwYFBwYFBwYFBwcGCAcGCAcGCAcGCAcGCAcGCQgHCgkHCgkHCgkICwkIDAoJDAsJDAoICAcGBAQDAwMCAwMDBAQDBAQEBAQEBQQEBQUEBQUEBgUFBwYFBwYFBwcGBwcGCAcGCQcHCQgHCgkICgkICwoICwoJDAsKDAsKDgwLDgwMDw4MEA4NEA4OERAPEhAPExERFBIRFRMSFxUUFxUUFBIREhEQExERFBISFRMTFhUUFxUVGRYWGhgXHBoYHBoZHBoYHRoZHhsaHxwaHxwaJCEfNjArPzkyQDkyQjo0RDw2Rj05SUA8PjUwMionODIuQz47Qz88QD46RUNAS0hHS0pHW1tZU1NTRENEQkJETk1QTUxQTk1TUFBWVVVbZWVrb25za2htXFhdTUtPPz1ALywwKSYqLSktLiouLiosMCwuNjI0ODU2REFDX1xebWlrXFlbU05TUk5TYV1gZ2NnUk5SWFRYZmJlWFRYRkJHVVBVU01SRDxDQTg9PjU5QTY4Sz82Y1c4b2E/aVs8YlMzZ1Mub1Yue2I7e2hCYFY1V0w1XE87WEw9UEU7VExBV1BBWE04eWVCnIVQn4pNmYRUknhRkm9HmnJGjGY7dlMta0woYUUmTzskMCgfHxscIB4hIyMmJCQmJSQlKCQpLSguREBHUU1VSkVNQj9EQUBBSUREV0xDYU44jG9AsZNSrpFTnoNPjXRJemFBd19DaVVBVEc7TkI6TUE6S0A6SkA7Rz06ODEtMComLyomLSglLCcjKiYjKSQhJyMhJSEfIh4cHxwaHBkXGhcXGRcVFxUUFhMTFRISFBIRExAQEhAQEg8QEQ8PEhAPFBISFRMTFxUUFxUUFxUUFxQUFxQUFhQUFhQTFhMTFRMTFRISFRISFBISFBERExEREhAQEhAQERAQEQ8PEQ8PEA4ODw0ODQwMDAoLDAoLDAoKCgkKCggJCggJCQgICQcICQcICAcHCAcHBgUEBgUEBgUEBgUEBgUEBgUFBgUFBgUFBgUFBgUFBgUFBgYFBgYFBgYFBgYFBwYFBwYFBwYFBwYFBwYFBwcGCAcGCAcGCAcGCAcGCQgGCQgHCgkHCgkICgkICwkIDAsJDAsKCgoIBgUEAwMDAwMCBAMDBAQDBAQEBQQEBQQEBQUEBgUFBgUFBgYFBwYGBwYGCAcGCAcHCAgHCQgICggICgkICwoJDAoKDAsKDQwKDgwMDw0MDw4MEQ8OEQ8OEhEPExEQFBIRFRMSFxUTGBYUFhQTEhAQERAPExIQExISFhMSFhQTFxYUGhcWGxkXHBoYHRoYHhsZHhwaIB0bIR0bKCMgOzQuQTgyQjkzRDo1Rjw2Rjw4OTEsLygjNS8rQD05QD46Pz45QkA9REJAUU9NXVtaUlJRRkZHQkJESEhLS0tOT05TVFNaWllgY2JnXVxgVVBVVFBURkNGMzI1JCMmJSImLywwMi4zMS0vOzc4VFBRSkZIR0NFUU5QYFxeVlNVT0tOXFhcbmpscGxuX1xdVVFUb2tsZWFkTEhLSkVKW1VaU0tQSD9ES0JDU0pGXFBCbV5AfmtDjXZCjXI5i2s4jGc4h2M0hGU1g2k5gGk+emVDalk/VU1BSUdERUJETkdJWExJbmFTgXVfiH1oiXtmh25Rf107bkwtY0EjYEAiWUAlSzknMichIBocIRwfJiMmLCorLy0wOzc8TEdOT0tSUUtTT0lRSERJREFES0dGTkY/Y1E2qIhMvZxWu59dvqNlt59kln5TfWZHd2BFZlI/UUQ5S0A5Sj44SD45SD87Qjk2NC4qLysmLyomLSglKyckKiUjKCQhJyMgJCEfIh8dHxwaHBkYGhcWGBYUFxUTFhMTFBIRExEQEhAQEg8QEQ8PEQ8PEA4PEQ8PExERFRISFhMTFhQUFhQUFhQTFhMTFRMTFRISFBISFBIRExERExERExEQEhAQEhAPEQ8PEQ8PEA4ODgwNDQsLDAoLDAoLDAkLCgkJCggJCQgJCQgICQcICAcICAcHCAYHCAYHBQUEBQUEBQUEBQUEBgUEBgUEBgUEBgUEBgUEBgUFBgUFBgUFBgUFBgUFBgYFBgYFBgYFBwYFBwYFBwYFBwYFBwYFBwcGCAcGCAcGCAcGCAcHCQgHCQgHCggICgkICgkICwoIDAsJDQsKCQgHBQQDAwMCAwMCBAQDBAQDBQQDBQUEBQUEBQUFBgUFBgYFBwYFBwcGBwcGCAcGCAgHCQgICgkICgkICgoJCwoJDAoKDQwKDQwMDgwMDw4NEA4OEQ8OEhAPExIQFBIRFRMSFxUUGBYVFhQTERAPERAPEhEPExIRFRMSFhQSFxYUGhcWGxkXHRoYHRsZHhwZIB0bIR4cIh8dMywoQDcxPzYwQjcyQzkzQTcyNCsmMSgjOjMvQz48Ozk1Ozk2PDo4QD08TUtJT01LSEZGQ0FDQD9CSUhLSEhMTEtRV1ZaXFtfVVNWS0hLT0pOTUhMNTM2KSkrJiUpJiMoLSkuMS0xMi4xOTY4Q0BDPjw/ODc6OTg6OTY3NTEzNDAyQDw+TEhJR0JEQDw+TklLa2doY19hUU1RTEdMU0xRVExQTURHVEpHaFtQdGRQZ1Q6g21GmYFIlXk8oYBLmnhDiWcxjWo2jGg3kHI+jHNHcF48YVQ/VU9LUEtPT0dPUElQVU1TYltZe3NngndnbFpFXkMtXkAnXj4lWkApUkAuSzwwPzIsKiEhIxweKSQmNDE0PjtASkJKVU5YUk1UTEdNSURLRUFHPz5BUEtLcGZZi3lVt5havZ9bvaRmu6FhvKZmt6JplH5Xd2JFbllAWko6Sj84SD44Rz04Rj05Rz87QTk2My4rLysnLionLCglKickKSUiKCQiJiIgJCEfIR4dHhwaHBgYGhcVFxUUFhQTFRISFBERExEQEg8PEQ8PEA8PEA4OEA4ODw0OEA0OEQ8PExAQFBESFRITFBISFRISFRISFBISFBERExERExEQEQ8PEQ8PEA8ODwwODgwMDAoLDAoLDAoLDAoLCwkKCgkJCggJCQgJCQgICQcICAcHCAYHCAYHBwYHBwYHBQUEBQUEBQUEBQUEBQUEBQUEBQUEBQUEBgUEBgUEBgUEBgUEBgUFBgUFBgUFBgUFBgYFBgYFBgYFBwYFBwYFBwYFBwYFBwYGCAcGCAcGCAcGCAcGCAcGCQgHCgkHCQkHCgkICwkIDAoJDAsKDAoJCAcGBAQDAwMCBAMDBAQDBAQEBQQEBQQEBQUEBgUFBgUFBgYFBwYGCAYGCAcGCAgHCAgICQgICgkICwkJCwoJDAoKDQsKDQwMDg0MEA0NEA8OERAOEhAQExEQFRIRFRMSFxUUGBYVFBMSEA8OERAPEhAQFBIRFBMSFhQTGRYUGxkWHBoYHhsYHxwaIB0bIR4cJSEeNS4oPjQuPjQuPzUvQDcxPTMtNSokNiwmQzs2S0RBPjs1ODYxPDo4QkE/RURBSkhGQj9BQT5AQ0BES0hLTEpOUE5SWVdcXFpcU1FTTkxOSkVIMi4xHhweHRwfIB4iHx4hJCImKCcrKSgsKSgsLi4yMjI2NDM4Ojk8NDEyLSkqKycpLyssMSwtKiQlKCEjLigqQDo8Pzo8OzQ3PDQ4PjY5PzY3QTc0U0g+f3BbeWhRZFU8lINcmoVapY5ruKB+n4VTk3I2oXxDmHRCjW49jnVJgG1JdGRHZl1TXVdZUktPT0hNVk9SXVZTYFhOWU9AVEUzVD8sVz8rWEQxVUQzUEAySTovQzUuNisoKCEgKSMkNC8zSkNLV0lXV0hWU0tUTEhNREBFQDtBQDpAXFJPnI98rp96uKVwvatywbB5vqpwuqRov6hxtJ5vi3dWbFpBYE86T0M3Rz44Rz44Rj05Rj86SEE9PTc0MCwoLysnLikmLCglKickKCUiKCMiJiIgIyEeIR0cHhsZGxgXGRYVFxUTFRQSFRISExEQEhAPEQ8PEA4OEA4OEA4ODw0NDw0NDwwNDgwNDwwODw0ODw0NEQ4OEQ8PEQ4PEA4PEA4ODw0ODgwMDQsMDQsMDAoLDAoLDAoLDAoLCwkKCwkKCggJCggJCggICQcICQcICAcHCAYHBwYHBwYGBwYGBwYGBQUEBQUEBQUEBQUEBQUEBQUEBQUEBQUEBQUEBQUEBQUEBgUEBgUEBgUEBgUEBgUFBgUFBgUFBgYFBgYFBgYFBwYFBwYFBwYFBwYFBwcGCAcGCAcGCAcGCAgGCQgGCQgHCQgICgkICgkICwoIDQsJDQsKCgoJBgYEAwMCAwMCBAMDBAQDBAQEBQQEBQUEBgUFBgUFBgYFBwYGBwYGCAcGCAcHCAgHCggICQkICgkICwoJDAsKDQwKDQwMDg0MDw4NEA8OERAOEhEQExIQFRMSFhQTGBUUGBYUEhEQEA8OERAPEhEQFBIRFxUSGBYUGxkWHRoXHhwYHxwaIR4bIh8cJyMfOjIqPjQsPTQtPTQtPzUuPC8pOCslPDIrSkE5TEU9Q0A5ODYySEVDR0VEPjs6QkA+Q0BAREJCREJDRkRETEpJVFFQWVdXV1RWVFFSR0RFLyorHxwdGxkaHBsdHx4hJSQoKiktKSktKCcrJiQpJyYqKSktKyouODc6Ozg6NzM0QD0/QT0/NS4xKyUnLSYoLSYoKyUnLCYoLykrMSotNCsuOjAuPzUuSUAzbWJObWRPdW5ahHtjenJciH9ulIdwlYNfpohUrIZLpoJOoINTmYFWiHRPbl09a11JXlRNQzs5PTc2QDk3Qjs3QjszQzwwST4uT0AwU0QzVUU1U0M1Tj8zRzgwQDMuPTEuMigoKyMmMSgsSz9JZFNjYE9eVU1VSUVKPTo+VlBRbmRdYVZHjIBssKaJvbSNwbiOubGGpJdwmIVkqZFrtKF3n5Fuc2VLXlE8VUk4SUA4Rj45Rj45Rj86R0E8RkE9OTUwMCsoLionLSgmKyglKiYjKSUiJyMhJCEgIyAeIB0bHRoYGhgWGBYUFxQTFRMSExERExAQEQ8PEQ8OEA4ODw0ODw0NDw0NDgwNDgwNDgwMDgwMDQsMDQsMDQsMDQsMDQsMDQsMDQsMDQoLDAoLDAoLDAoLDAoLDAoLCwkKCgkJCgkJCggJCQgJCQcICAcICAcHCAYHBwYHBwYGBwYGBwUGBwUGBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBQUEBQUEBQUEBgUEBgUEBgUEBgUFBgUFBgUFBgYFBgYFBgYFBwYFBwYFBwYFBwYFBwcGCAcGCAcGCAcGCQcHCQgHCgkHCQkHCgkICwkICwoJDQsKDQsKCAgHBAQDAwMCBAMDBAQDBAQDBQQEBQUEBQUFBgUFBgYFBwYGBwYGBwcGCAcHCAcHCQkICQkICwkJCwoJDAoKDQwLDQ0MDw0MDw4NEQ8OERAPExEQFBMRFRQTFxUUGRcVFxUTEA8OERAOEhEQFRMRFxUSGBYUGxkXHRoYHhwZIB0aIR4bIh8cLSgjPTUsPTUsPTQsPjQtPTQtPC4nOy0mRTkyUUY9TUQ6PTkzPDo4R0VEREJDREJAQ0E/QT89QT88QD47Qj88UVBJV1VMVVNJRUE+OTU0LSkoIx4fIBwdHxsdHx0gJCMmKyouLi0xJycrIiElISElJCQoJiUpISElISAjJyMlLiosR0JESkZGOTMzMywtODEyMywsKiMkKCEjKyUmNC4tODAvOjAtPzcvQjsxX1pMfHlpd3RmXltQRkc/Rkg/X1xRin9wrJV0r49gqIleoIRel4JjkH5he2pOcWJJVEk8PDQuNi8sMiwqNC8rOjMsPzguRz0xTUI0UEM1UUQ2UEI2Sz4zRDcxQDIuPzEvPC8vMyksMSctPDE5T0JNVktVUEtQS0dLQDs/XFRSopWBopV9rKOMvbigtbCXvLefr6qSfnZgeG1ef3FijYJmoJp3jYZpZ11JV049T0c6R0A5RT86RUA7RkA8SEM+RkI9ODMvLionLionLCglKiclKSUjKCQhJiIgJSEfIR4dHxsaHBkYGRcWFxUUFhQSFRISExEQEhAQERAPEA4ODw0NDw0NDwwNDgwMDgwMDQwMDQsMDQsMDQsMDAsMDAsLDQsLDAoLDAoLDAoLDAoLDAoLCwkKCwkKCgkJCggJCggJCQgICQcICQcICAcHCAcHCAYHBwYGBwYGBwUGBgUGBgUGBgUGBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBQUEBQUEBgUEBgUEBgUEBgUFBgUFBgUFBgYFBgYFBwYFBwYFBwYFBwYFBwYGCAcGCAcGCAcGCAgGCQgHCQgHCQgHCgkICwkICwoIDAsKDQwKCwoJBgYFAwMCBAMDBAQDBAQDBAQEBQQEBQUEBgUFBgYFBwYGBwYGCAcGCAcHCAcHCQkICgkICwkJDAoJDAsKDQwLDQ0LDw0NEA4NERAOEhAQFBIRFRMSFhUTGRYVGRYWEhAQERAOExIQFRQRFxUTGhcVHBoXHhwZHxwZIB4aIh8bJSIeODIpQTkuPjYtPjYsPjYtPTMqOi4kPTEpTEI7V01FTEE7Pjo2RkNCREJCQj9BSUdGSEZDQUA7Pjw3QT03SkY+V1JIXFdLWVVJQj42LiklJB8dJB8gJiIkIyAhISEkJycqKysvKSgsISAlHx4jICAkJSYoKiktJiUpISIiHh0dLCgpRkA/TEhGQTs5OzQ0NC0tLSYmKCEiKCEiNC0sPDYyPDcyPDYvPjgxPzszW1lPdHNnYmBZRkRANjUzNzgzVFNRcGtohXdmk4BinIZrlIJujX5yiHtwhHhpe29gVEo/QDcwODAqNS4pOzMtPzYvQjgwRjwxSD40S0A1TkE2TUE2STwzRDYwQTIvQDIvQjQyQjQ0Oi4xNisxOi82QDg9TEdKUUxOSkNFRjo8Z1dTiXtyj4d6k46CfXhskIuBqKSbhH92dXBodHBmb2xck49zn5h+fnZiXFVEV08/TUY7RUA6RUA6RkA7RkE7SUQ+Qj44Mi4rLionLSkmLCglKiYjKCUiJyMhJSEfIx8dIB0bHBoYGhcWGBYVFhUTFhQSFBIREhEQEhAPEQ4PEA4ODw0NDgwNDgwMDgwMDQsMDQsLDQsLDAsLDAoLDAoKDAoKDAoLDAkKCwkKCwkKCwkJCgkJCggJCggJCggICQgICQcICAcHCAcHCAYHBwYGBwYGBwYGBgUGBgUGBgUFBgUFBgUFBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBQUEBgUEBgUEBgUEBgUFBgUFBgYFBgYFBgYFBwYFBwYFBwYFBwYFBwcGCAcGCAcGCAcGCQgHCQgHCQgHCgkICwkICwoIDAoJDQwKDQwKBwYFAwMCBAMDBAMDBAQDBQQEBQQEBQUEBgUFBgYFBwYGBwYGCAcGCAcHCQgHCQgICgkICwoJCwoKDQsKDQwLDg0MDw4NEQ8OEhAPExIQFRMSFhQTGBYUGRcWFRQSEhAPFBMRFhUSGBYUGxgXHhsXHhwZIB4ZIh8bIh8cLiojQjsuQjotQDktPzctPzgtOzInOi4jQDYtU0tEVU9JRkE9SUdGUE5OTUtMRUJDS0hJT01LTUpGTEdCUklDTkQ7Vkk+YFRJVk5COzQsKiQgIh0cJSIjKSQnJSMmIyQnKCcrKiouIyMnISElJCQnJSUpJiYpJycpJSUmIiUjHiIhKygpUUZHWFFQSkNBPjU1MykpLiUlLCQkMy0tOzUyOzUyOzUxPDYxPDczPjo1XFhTcW9rWVZUPjs7NDAxOzg3U1BPaGRifXVthnprf3RmeW9oe3BqgXlygnpyeXJqaWNbSEE5PDUtPDQuQDcwPzYvPzYwQjgxRTsySD41S0A2S0A2SDw0RDYxQjMwRDMxRjY0Sjo3STk3PzI1OzE0PTQ2UUlJXVZVUEhIRz49Rzs8SD49VU5KXVlVYmBbcW5qhIF+h4WAfnt1fXpzhoN8hn9zlIt4l496cWlYWlNDV05AS0Q7RUA6RUA6RkA6RkE7SEM9QDs2MCwpLSknLCglKickKSUjJyQiJSIgJCEfIR4cHRsaGhgWGRcWGRYVFhQTFRMSFBEREhAQEhAPEA8ODw4NDg0NDgwMDQwMDQsLDQsLDAsLDAoLDAoKCwoKCwkKCwkKCwkJCwkJCggJCggJCggJCggICQgICQcICAcICAcHCAcHBwYHBwYGBwYGBgUGBgUGBgUFBgUFBgUFBQQFBQQFBAQDBAQDBAQDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBgUEBgUEBgUEBgUFBgUFBgUFBgYFBgYFBwYFBwYFBwYFBwYFBwYGCAcGCAcGCAcGCQgHCQgHCQgHCQkICwoICwkICwsJDQwKDQwKBwYFAwMCAwMDBAMDBAQDBQQEBQUEBQUEBgUFBgYFBwYGBwYGCAcHCAgHCQgHCgkICgkJCwoKDAsKDQwLDg0MDw4NEA8OEhAPExEQFRMSFhQTFxYUGhgWFxUTExIQFhQSFxYTGhgVHBoXHhsZHxwZIR4bIh8cJCAdNzInRT4vQjsuQTstQDktPzcsOTAjOzElRz81Vk5GUk1HUU5MV1RVTkxNUlBRUU5PUk9PWFZVXVlWYllVXU1JVUM9WEhAVUc9RDkvMysiJiAcJCAgJSMnJCImJCMnJSQoKCgsJyYqISElIyMmKysuLCsvKCcqJSYmJCYkIiQiIiQiMi0uT0RFUUdHQjc4OS0uNCkpMykqNi8uOjQyOjQyOjQxOzQwOjQwOTMwQj07Y19dcWxrXFdYQz9ANzI1OTQ2UExLbGhlj4qGlI6JcmtkZl5ZdGxlg3x0hH93eHRtdHBoUEpDQDoyQDgxQTcxPjUvPjUvPzUwQTgxRTs0Rz00RTszQzcwQzQwRTUxSDczTDo3Tzw4UT45TTw5QjQ0QjU0VEhGYldUUkdESUE9TURBSkE/SkNBTUpHVVNPamhlenh1f356d3ZwjYuFqqeihH54fnZpmJF9hX1rZl5OXFNFVkxBSkM7RUA5RUA5RUA6R0E7SEE7OTQwLionLCgmKyclKSYjKCQiJyMgJSAeIh8dHhwaGxkYGRYVGRYVFxUUFhQTFBMSExEQEhAQEA8PEA4ODw0NDgwMDQwMDQsLDQsLDAsLDAoKCwoKCwkKCgkKCgkJCgkJCggJCQgICQgICQgICQgICAcICAcHCAcHCAYHBwYHBwYGBwYGBgUGBgUFBgUFBgUFBQQFBQQFBQQEBQQEBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBgUEBgUEBgUEBgUFBgUFBgYFBgYFBgYFBwYFBwYFBwYFBwYGCAcGCAcGCAcGCAgGCQgHCQgHCQkHCwkICwoIDAsJDQwKDQwKBwYFAwMCAwMDBAMDBAQDBQQEBQQEBQUFBgUFBgYFBwYGBwYGCAcHCQgHCggICgkJCwoJDAoKDQwLDg0MDw0MEA8OERAPExEQFBMRFhQTGBUUGRgWFxUTFBMRFxUSGRcVHBoXHRsYHxwZIR0aIR8bIh8cKiYhPzksRD4uQjwuQjstQTsuPDQnOC8iPjYqUkpAVU1ETklDVVNQVlZWVFRWWlhbWVZYVVNTU1FQWlhTXFNOVEQ/WEVAUkI6QzctOC0kKyQdJSAcKScmKScpIyImJSYoJiYpJyYqJiUpJSUpJycrKyssLCwtKiYoJiUkJCYlJSYkJyUkMioqPTExPzEyPCwuOSssOCstOTExOTMyOTMxOTMwOjQwOjMwODEvNzAuQDk4W1VTXVdXVVBRTEdIOzY4Ozc4V1NScGxpi4eEk4+MeHJtdW5pkImCjYeBgnx1gX11c25nT0lCQz02Qjo0QjgzQDYxPzQvPzQvQDYwQTcwOzMsNy4mNCslOS0pSDYyUDs3VD85VkA6VkA7VUA6TDg0RjQwTj04XU9JXE5HVEtDT0hBTEVASEI+SkZDUE1KXVtYbWpncG5qcXBrh4WBnZqVhYF7fHdvkot+p5+Olo58aWBTWE5DUEc/RkA5RD45RD85Rj85SEE7RkA7NjEuLCgmLCclKiYkKSUiJyMhJCEgIyAdHxwbHBoYGRYVGBUUGRYVFxUUFhMSFBIRExEQEhAPEA8OEA4NDg0NDQwMDQsLDAsLDAoLDAoKCwoKCwkJCgkJCgkJCggJCQgICQgICQgICAcICAcHCAcHCAcHBwYHBwYGBwYGBwYGBgUGBgUFBgUFBQQFBQQFBQQEBQQEBQQEBQQEBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBgUEBgUEBgUFBgUFBgUFBgYFBgYFBwYFBwYFBwYFBwYGBwcGCAcGCAcGCAgGCQgHCQgHCQkHCwkICwoJDAoJDQwKDQwLBwYFAwMCBAMDBAQDBAQDBQQEBQUEBgUFBgUFBgYGBwYGBwcGCAcHCQgHCgkICgoJDAoKDQwKDQ0MDw0MEA8OERAPExEQFBMRFhQTGBYVGRYVFhQSFhQSGRcUGxkWHRsXHhsYIB0aIR8bIyAcJCEdNS8nQz0uQjwtQjwtQjsuQDksOjEkODAjQDksUEk/Tkc+SUQ+UU9MU1JSWFhZYF5hXVteVVRWVFFRVVNLSkU5T0U8VEY/RDcvOi4lLyUfJiAbJyQgLSonKSclJyYmKCgrKCcsJycqKSgsLCsvLSwvLCssKyoqKiUnJyQlJCUkJSMjKSUkMCgnOCssPCwuPSwuOiwuOTAwOTIxOTMxOTMxOTMwOTMwOjMwNy8sNiwqPDQyTkdFV1FRXFdYTklKPTk6OjY3WFRTbmtodHFueHRxdnFtenRvgXl0e3VvfHZwhH54hX15YVpVRj85RTs2RDk0QTYyQDQvPzQuPzQvOjErNCwlMSgjLiYhLSYiOi0pUjw3XEM8XUM7W0E7W0E6Uzs0SjQtSjYuWEg+YlVKV09DUUpARD42QTs1TEdCTkpHVFFOXVpXYV5aZmVgdXRviYeCiIeBjouFp6OcsqucrqaUgXhrWVBHUUc/SUE6RD44RD44RT44Rj46SUE8Qjs3MSwpKyclKyckKSUiJiMhJSIgIx8eIR0bHRoZGhcVFxUUGBUVGBYVFxUTFRMSFBIREhEPEQ8PEA4ODw4NDwwMDQwLDAsLDAoKCwoKCwoKCwkJCgkJCggJCQgICQgICQcICAcICAcHCAcHCAYHBwYHBwYGBwYGBwUGBgUGBgUFBgUFBQQFBQQEBQQEBQQEBQQEBAQEBAQEBAMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBgUEBgUEBgUFBgUFBgUFBgYFBgYFBwYFBwYFBwYFBwYGBwcGCAcGCAcGCAgHCQgHCQgHCQkICwkICwoIDAsJDQwLDQwLBwYFAwMCBAMDBAQDBAQEBQQEBQUEBgUFBgYFBwYGBwcGCAcHCQgHCgkICgkJCwsKDQsKDQ0MDw0MEA8OERAPExEQFRMSFhQTGBYVGRcVFhUTFxUTGhcVHBkXHRsYHxwZIB4bIh8bIyAcKCQgPDYrQTstQTotQDotQTotPDQnOjEkPjYpR0I0S0Y6TEg/T0xHT0xKTk1NT05PUVBRT05RWFZYX1xaUk9FS0c4Tkc7RTwyPDAnMichKB8bJiAeLSooLConJCQhJycmKSgsKSctKCcsKigtLiotLiorKycoLCgpLCgpKCQlJCEhJCAfJyEhLyYnNyorOSstOSwtOS4vOTAwOTExOTIxOTIwOTIwOjIwOjMwNy4sNCgmOTAuS0JBTkZFTUdHREBBODY2NTIyUU5NY2Ffamdla2dkbmpldnBseHJtbWhidnBqgn14j4eDcWlmSUA8Rz05RTo1QzcyQTUxQDMuPjIsNi4oMSkkLiYiLCQgKiMgKyQgPjArX0M7ZEU9YUI6X0E4Wz42UDctSjQpSzouVEg7W1NGVk9DQDgvOTEqTkhDUkxJT0tHVlJPXFhVYF5abGpmhoWBjoyInJqXu7m2s66nnpaLgXluZ2BXUkpDSkI7RT44RD04RD04Rj45Rz86SkE9PDYzLCglKyckKSYjJyQhJiEgJCAeIR4cHhoZGxgXFxUUFhQTGBYVGRYVFhQTFRMSExEREhAQEBAOEA4NDw4NDQwMDQwLDAsKDAoKCwoKCgkJCgkJCggICQgICQgICAcHCAcHCAcHCAYHBwYGBwYGBwYGBgUGBgUFBgUFBgUFBQQFBQQEBQQEBAQEBAQEBAQEBAMEBAMEBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBgUEBgUEBgUEBgUFBgUFBgYFBgYFBwYFBwYFBwYFBwYGBwcGCAcGCAcGCAgGCQgHCQgHCQkHCgkICwoJDAsJDgwLDgwLBgYFAwMDBAMDBAQEBQQEBQUEBgUFBgUFBwYGBwcGCAcHCQgICQkICwkJCwsKDAsKDg0MDw0MEA8OEhAPExEQFBMSFxQTGBcVGRcWGBYUGBYUGxgWHRoXHhsZHx0ZIh4bIx8cIyAdLikjPjcsPzgsPjksPzktPjYqOzEmPDMnSEIzT0s6RkE0SkY9T0xIS0lJTEtLSEdISktLT05RVlRWUU9LSEU7TEc7QjwwOTAnNSsjLSIeJh4cKyYlMzAvMC8tJSYkJiUmKCgrKyovLSsxKyouKSYnJyIjKiYnNC8xMi0vKCMkJB8gIx4eKSIiMigpNikrNyorOCwtOS0uOS8vOjEwOjIxOjIwOzMwOzMwPDMxOTAuMyclNSooRz08TUNCQTs6Qj8/Pjw8QT8+SUdFWVZUZWFebWlmc29rdnFseHNtb2lkcGpmfndziIB9a2JfSkA9Rz06RDo1QzcyQTYwQDMtPTEsNC0oLigjKyUgKSIfKCIfKCEfLSUiUTgxaEU8ZkI5YkA2Xj42WDsyTDUpQzMkQzcpUkk8VExARTsxOjEpQjs1S0Q/S0ZCUExJWFRRWFVSXlxZc3FtiIaDpaOgure1q6imiIN8cmxibmlgWVNMSkM8SEA4RT03RD04RT05Rj86SUE9Rj47MSwqKiYkKSYjKCQiJSIgIyAfIR8dHxsaGxkYGRYVFhQTFhQTGRcVFxUVFRQTFRMRExEQERAPEQ8ODw4ODw0MDQwLDQsLDAsKCwoKCgkJCgkJCggICQgICQgICAcHCAcHCAYHBwYGBwYGBwYGBgUGBgUFBgUFBQQFBQQEBQQEBQQEBAQEBAMEBAMEBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBgUEBgUEBgUFBgUFBgYFBgYFBwYFBwYFBwYFBwYGBwcGCAcGCAcGCAgHCQgHCQgHCQgICgkICwoJDAsKDg0LCwoJAwQDAwMDBAQEBQQEBQUEBgUFBgUFBwYGBwcGCAcHCQgICQkICwkJDAsKDAwKDgwMDw4NEA8OEhAPExIQFRMSFhQTGRcVGBYVFxUUGhcVGxkWHRoXHxwZIB0aIh8bIyAdJSIeMy0mPTYrPDYrPTYrPTcsPDQpOjEnQDgsT0k5UU48TUk8SUY+REI/Q0BBTEpLTUtMUE5PU1FRUU9NSEZBRkM7Qj40NjAmNS0kNSslLiUjKyMjLyorMy8wLS0sJSYlKCcoLCsvMjE1NTY5MC8yJyQlJB8gJyMkLikqLSgpKCMjJSAgJyAhLyUmNCgpNigpNyorOCssOS0uOi4vOjEwOzMxOzQyOzMxPTQyPTQyPTMyNSooMSYjPDIwTENCSkVESERDSURDT0tKT0xLU1BOXFlWaWdkd3RxdXFucWxobWdibWZieHFtfHRxWE9MST88Rz05RDo1QzcyQDUvQDQtOzEsMywoLScjKSMgJiEeJiAdJyAeJyAfNSglYT82a0M5ZD82Xzw0WjwzUDguQjIjPTEiQDYpRj0xRjwyQTgwPjUuPzYxS0RATEZDT0tIVFFOWFdTYV9cdHFulJCNm5eVjIiGhYB9fXlzc3BqZmFZTkY+TEM5TEI3Rz84RT05Rj46R0A8SUI+OzYzKyckKSUjKCQiJSMgJCAfIx8dHx0bHRoYGhcWGBUVFRQSFhQTGBYVGBYUFRMSFBMRExEQEQ8PEA8OEA4NDg0MDQwLDAsLDAoKCwoJCgkJCggICQgICQgICAcHCAcHBwYGBwYGBwYGBgUFBgUFBgUFBQUFBQQEBQQEBQQEBAQEBAMEBAMDBAMDBAMDBAMDBAMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBAMDBAMDBAMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBgUEBgUEBgUFBgUFBgYFBgYFBwYFBwYFBwYFBwYGBwcGCAcGCAcGCAgHCQgHCQgHCgkICwkJCwoJDQsKDgwLBwYGAwMDBAQDBQQEBQQEBQUFBgUFBwYGCAcGCAgHCQgHCgkJCgoJDAoKDQwLDg0MDw4NEA8OEhAPFBIRFRMSFhUTGRcVGBYUFxUUGhcVHBkXHRsYHxwZIR4bIyAcJCAdKSUgNzAoOzMqOzMqOzQqPDUrPDQpOzMoQzwwS0Y3S0Y2Tko/TElCRkRBSkdHV1RVU1FSWlhYX11bREI+Pz44Pjs1MS0lMCsiOTEqPDMvNy8sMSkqMCorLiorJygoJigoKyssLy8yLCsvKystJiUmJSEiJB8hJiIjKiYlKiUkKSMjKSMiLSMkLyUmMSUnNCcoNikpOCosOi0uOi8vOC8vODAvPDQyPzY0PzU0PzU1QDY1OjAuMSYkMignRDw6VE1NUEtKTUhHVFBPWVZVVFJQWVdVY2Feb21qbmtobmpmcWtncmxneXFubWViTURBSD07Rjw4Qjo0QTgyPzUvPjQtPDIsMy0pLSckKSMgJSAdJB4cJB8cJh8dKSEfQS4oZD42Zz82Xzw0WjszVToySzcsQDIlOjAiOi8kPDIoPzUtQzkySUA6U0lFTkZETEZFTUlHVFFOWldTZmJffXh2hH99eXRympeUqKeijImDioV5f3lqZl1QUUY7TUM5RT85RT46RT47R0E9RD06MCspKSUjKCUiJyMhJCEfIx8dIR4bHhsaGxkXGRcWFxUTFRMSFhQTGBYUFxUUFRMSFBIRExEPERAPEA4ODg0NDg0MDQsLDAsKCwoKCwkJCgkICQgICQgICAcHCAcHBwYGBwYGBwYGBgUFBgUFBQUFBQQEBQQEBQQEBAQEBAMEBAMDBAMDAwMDAwMDAwMDAwMDAwMCAwMCAwMCAwMDAwMDAwMDAwMDAwMDAwMDAwMDBAMDBAMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBgUEBgUFBgUFBgUFBgYFBgYFBwYFBwYFBwYGBwYGBwcGCAcGCAcGCQgHCQgHCQgICgkICwoJDAsKDgwLCwoJBAMDBAMDBQQEBQUEBQUFBgUFBwYGCAcGCAgHCQgHCgkJCwoJDAsKDQwLDg0MDw4NEQ8OEhEQFBIRFRMSFxUUGRcWGRcVGBYUGhcWHBoXHhsYHx0aIh4bIyAdJSEeKSUhOC8oOjIpOjIpOjIpPTYsPjYsPTUrQjsxQTswPTctSkY9SUQ/UUtJcWxsc3BwXlxcV1VVT01MQkA9Pjw4MC0nKiYfMiwkQjo1Rj05PTUzOjIyLigqKScoKCgoKCgrKSgsKiouKCgrKykqKicnKSUkKyYlLiknLiknKyYlKSMiKiMiLCMjLSMkMCQlMyUnNCcoNykqMScnKyUkJyIhJyMhLyooPzU0Qjg3Qjc2QTc2QDU0NisqMCYlNy0tRDw7TUVFTEZGVE9OXFhXVlNRUlBNWFZSZWJfaWVja2ZieXRuioR8hX54YlpVS0E/SkA9Rz05Qjo0QTgyPzUwPjUvPDQuNC4qLSgkKSMhJiAeJB4cIx0bJR4cJh8dKSIfSjEsZz82YT00WjozVTkyUDkxSzgvQDInOi4jOC0jOi4mPzMtSj46VEpHVEtJSEE/OjUzPjs4SkdEXllXdG9tkIuJg318hYCAm5mXj4uGkY1+oJuHhoBvWU9DT0U6SEA5RD45RD06RT46Rj88ODQxKickKSUjJyQhJSEgIyAeIR4dHx0bHRsZGxkWGRYWFxYUFhQSFhQTGBYUFhUUFRMSFBIREhAQEQ8OEA4NDw0MDg0LDQsLDAoKCwoKCgkJCQkICQgICAcHCAcHBwcGBwYGBwYGBgUFBgUFBQUFBQQEBQQEBAQEBAMEBAMDBAMDAwMDAwMDAwMDAwMDAwMDAwMCAwMCAwMCAwMCAwMCAwMCAwMCAwMCAwMDAwMDAwMDAwMDBAMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBgUEBgUFBgUFBgUFBgYFBgYFBwYFBwYFBwYGBwcGCAcGCAcGCAcHCQgHCQgHCgkICgkICwoJDQsLDgwLBwYGBAMDBQQEBQUEBgUFBgYFBwYGBwcGCQgHCQkICgkICwoJDAsKDQwLDg0MEA4NERAOEhEQFBIRFhQSFxUUGRcWGRYVGBYUGxgWHRkXHxwZIB0aIh8cJCEeJSIeKyYiNy0nOS8nOTAnOTAoPzcuQDkvPjYsQDkwPTYtNS4mQz42SUM+WlVShYGAgHx7YV5eUlBQQD09QT49OTYzLSgjKyUfNzApSUA7Rz47OTEwOzQzMS0uKCgpKCcpKSgsKCYsKyotMTAwOjUxPTcwPDYwPDYwOzUwNS8sKiQjJiAfJyAfKSEhKiIiLSMkMCQlMCQlKCEgIBwbHhsaHx0cIh8eJCEfNi4uRjs6RDk5RDk4Qzg3PzU0NCopLyUlMCcmPDQ0Rj8/SUNCUExLT0xJTEpGVFJPZWJfZmJfYl1YgHt0n5qQiIJ5cWpkVUxIUUdDTEI+Qzo2QjgzQDcyQDYxPzYxODEtLikmKSUiJiEeJB4cIh0bIh0bJR8cJx8eMCUiUDQuXz01Wjs0VDoyUDkxTTkxSjgwRDUsPjAnOy0mPC8pQDIuRTk1SD87Pzg0NS4tMy4rQj47WFNRZmBegHt5fXd3b2lpcm1tf3p3kIt/iYV0iIFyXVVJT0U6SkE4Qz04Qjw4Qjw4Qjw5PTg1LSknKSUjJyQiJiIgJCEfIh8dIB0cHx0bHRsZGxkYGhcXGBYVFhQTFxUTFxUUFhQTFBMRExIQEhAPEBAPDw4NDg0NDQwLDQwKDAsKCwkJCgkICQgICAgHCAcHBwcHBwYGBwYGBgUFBgUFBQUFBQQEBQQEBAQEBAMDBAMDAwMDAwMDAwMDAwMDAwICAwICAwMCAwMCAwMCAwMCAwMCAwMCAwMCAwMCAwMCAwMCAwMDAwMDAwMDAwMDBAMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBgUEBgUFBgUFBgUFBgYFBgYFBwYFBwYGBwYGBwcGCAcGCAcHCAgHCQgHCggICgkICwoJDAsKDgwLDAoJBAQEBAQDBQUFBgUFBgYFBwYGCAcGCAgHCggICgoJCwoJDAsLDQ0LDw0NEA8NERAPExEQFBIRFRQTFxYUGRcVGBYVGBYUGxkWHRoYHhsZIB4bIyAcJSEeJiMgMCgjOCwmOC0mOC0mOC4nPzYtQDkvPTYtPjYuPjcvPDYuUEtEYVxWd3NwiYWEgHx7aGVjX1tbSERDQDs5PDYzMSslMCohOTEqRDw3Qjo2NzAuNDAwMjAyKiktKSgtJiUqJSQpMzI2RkJBVklAU0c8TEI7SkI8S0I9NzEuJSAfJR8eJB8eJR8eKCAfKyEiKiEhIRwcHBkYHBkYHRoZHhwaIR4dIyAeLCclQzk4SD08RTk5Qzg3Qzc3OzAwLyUlLSMjMyoqQjs6RD49RkFASkZEUE1KYF1aaGVidnNwdXJub2todnFsc2xodG5qXVRRVUtIVEhFST87Qjk1QTg0QTk0Qzo1PjYyMSwpKycjJyIgJB4dIh0cIhwaIxwbJR4cJyAdMCUiSzQuWTw1VDs0UDkzTTkxTDoxSzoySTkwRTYuQTIsQDErPjErOjAqNzAqNzAtOTIvPjg1S0VDXFZUaWNhamRjZ2BfZ2JgjIeDr6ykjop/hIBxZ2FVTEQ6SUE4Qzw3QDk2Pzk1Pzg1PTc0MCwqKSYjKCQiJiMhJCEfIyAeIh8cIB0bHxwaHhsZHBoZGxkXGRcWGBUVFxUTFxUTFhQSFRISExEQERAPEQ8ODw4NDwwMDQwLDAsKDAsKCgoJCgkICQgICAgHCAcHBwYGBwYGBgYFBgUFBQUFBQQEBQQEBAQEBAMDBAMDAwMDAwMDAwMDAwICAwICAwICAwICAwICAwICAwICAwMCAwMCAwMCAwMCAwMCAwMCAwMCAwMCAwMDAwMDAwMDAwMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQEBQQEBQQEBQQEBQQEBQUEBQUEBQUEBgUFBgUFBgUFBgYFBgYFBwYFBwYFBwYGBwcGBwcGCAcGCAcHCQgHCQgICgkICwoIDAoJDgwLDQwLBQUEBAQDBQQFBgYFBgYFBwYGCAgHCAgICgkICgkJCwsKDQsLDg0MDw4NEA8OERAPExEQFBMRFhQTGBYVGRcVGBYUGRYVGxkXHRoYHxwaIB0bIyAdJiIeJyMgMCgjNyskNyslNywlNy0mOzMrPDQsOzQrQToxPjcvSEE6bWdhjYiEmJSRmJSSjYiHcGtqYV1cS0ZFQj06R0E8OjQsNS4lODAnOjIsNy8tMSwrLywuKSksKCgsJyYrHx4jJCMmPTw+U09MX1NJX1FHVUhDVEhEUkdDMCooJCAeJSAeJB8dJB8dJh8fJyAfIRwcGxkYGxkYGxgXGxkYHRoZIB0bIx8eJiIgNS4tRzw7Rzs7RTg4Qzc3QTY1OC0tLiQkLyYmNzAuOzQzQTs6T0lJamZlgX17aWZjj42KsrCtf3x4cGpodW9uZ2BgYVhYWU9MVUpHUERBRTw4RDo3RDo3Rj05RDw3NTAtLSgmKSQiJSEeIh0cIhwbIhwaIx0bJR8dJyAdMCUiQTArTzkzUjs1TjsyTDoyTDsyTDsySzsySToyRTYvPzMsOS4oNS0nNi4rPDQyPzk2Qz07TkhGXlhXYVxaYl1bamRih4KAnZmVko6FkpCAfXprUktBSD82Qzs1Pzg0PjczPDUyPDUyNzAuKyckKCUiJyQhJSIgJCEfIx8dIR4dIB0bHxwaHhsZHRoYGxkXGhgWGBYUFxUUFxUUFRMSFBMREhEQEQ8PEA8ODw4NDg0MDAwLDAsKCwoJCgoICQkICQgHCAcHBwcGBwYGBgYGBgUFBgUFBQUEBQQEBAQEBAMDBAMDAwMDAwMDAwICAwICAwICAwICAwICAwICAwICAwICAwICAwICAwICAwICAwMCAwMCAwMCAwMCAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQEBQQEBQQEBQQEBQUEBQUEBQUEBgUEBgUFBgUFBgUFBgYFBgYFBwYFBwYGBwYGBwcGCAcGCAcHCQgHCQgICQgICgkICwoJDAwKDQwLBwcGBAQEBQQFBgYFBwYGBwcGCAgHCQgICgkICwoKDAsKDQwLDg0MDw4NEA8OEhAPExEQFBMSFhQTGBYUGRcWGBYUGRcVHBgXHRsYHx0aIR4cJCAdJSMfKCMhLycjNiojNSkjNislNiwmNi4nNS4mNS4nPzgwQz01VE5HgHt1p6Oeraqnl5ORe3d1aGRiYVxbTklHSEM/T0lBT0g+PTYrODAlMiojKSMiJSEiJSMlJCUoJSUoIyQnHx8iJiYpQD8/TUtJWk9MYVFOV0lGVUZFV0pIOjEvJSAfJSEfJSAeJSAeJyIgJB8eHRoZHBoZGxkXGxgXGxgXHBoZHhwaIh4dJSEgKiYkQDY1ST07RTk4Qzc1Qjc1PzQyNCsoMCglMiwpPDU0SkNDY11df3t6k5COh4WBm5mWr6yplJCMoZyaiYSDW1NUZl5dZ15cVkxJUUZDSD88RT05Rj05Rz86SEA7OzUyMCspLCckKCIhJB8dIh0cIhwaIhwaIh0bJR8cJyEeKyMgOSwoSzgyUDw1Tz00TTwyTTwySzsySjsySDkxRDgxPTMsNi0oNCwoNS4qODEuOjQyPzk4VU9OX1taYFxbZmBfdW9viYSDiIN9fHdpeXRmXFZLRT01Qzs0PjgzPDYyPDQxPDQxOzQxMCsoKCUjKCQiJiMhJSEfIyAeIh8dIR4cIB0bHxwaHhsaHRsZHBkYGhgXGRcVGBUUFhQUFRQSFBIQEhEQERAODw4NDw0MDg0MDAsLDAoKCwoJCgkICQgICAcHCAcHBwYGBgYGBgUFBgUFBQUEBQQEBAQEBAMDBAMDAwMDAwMDAwICAwICAwICAwICAwICAwICAwICAwICAwICAwICAwICAwICAwICAwICAwMCAwMCAwMCAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBAQEBQQEBQQEBQQEBQUEBQUEBQUEBgUFBgUFBgUFBgYFBgYFBwYFBwYGBwYGBwcGCAcGCAcHCAgHCQgHCQgICgkJCwoJDAsKDgwLCQgIBAQEBQUFBgUFBwcGBwcGCQgHCQgICgoICwoJDAsKDQwLDg0MDw4NEA8PEhAPExIQFRMSFhQTGBYVGRcWGBYVGRcVHBkXHRsZHxwaIR8cIyAeJiIgKCQiLycjNCgjNSkjNSslNi0nMyslMSoiNC4mQz02R0I7UEtFc29qlZKOop6cnZqXko6MgX16bWdnVU9OUEpFW1VKX1lMRDwyOzEnMCghIh0bHxscHx0gISAkIiElISElIyIlKCkqNTc2OTo5SD9AWEhIT0JBUERCWExKQzo4JyMgKCQhKCQhKCQiLCYkJSEfHRsZHRoZHBkYGxgXGxgXGxoYHhsZIB0dJSEgKCQiNS4tRzw6Rjs4Qzg1Qjc0QTYzOzIuMywoNS4rQzw6U0xLamRjenV1dXJxhIF/ioiFd3RxjYiFj4qIe3Vzb2dmbWVjcmlmV05KUEZCTEM+Rz46Rz46Rz86SkI8QTo2My4sLikoKiUjJiIgJB8dIh0cIhwbIhwbIh0bJh8cJyEdKiMgMiklQzUvTz00UD81Tz4zTDwySTsyRjgwRDcwQDUvPTIuNi4qNCwpMywqNjAtOjQyRUA/W1dWX1tbYVtcaWJkfnh5g398ZGBWY2BTVlJHRD01Qzw0PjczPDUxPDQxPDQxPjUyOTMwLCgmJyMhJyMhJSIgJCEfIyAeIh8dIR8cIB0bIBwaHhsZHRoYHBkXGhgWGRcVFxUUFhQTFBMRFBEQEhAPEQ8ODw8NDg0MDgwMDAwLDAoKCwoJCgkICQgICAcHCAcGBwYGBgYFBgUFBQUFBQQEBAQEBAQDBAMDAwMDAwMDAwICAwICAgICAgICAgICAgICAgICAgICAgICAgICAwICAwICAwICAwICAwICAwICAwMCAwMCAwMCAwMCAwMCAwMDAwMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQUEBQUEBQUEBgUFBgUFBgUFBgYFBgYFBwYFBwYGBwYGBwcGCAcGCAcHCAgHCQgHCgkICgoJDAsKDQwLCgkIBQQEBQUFBgUFBwcGCAcHCAgHCggICgkJCwsJDAsLDgwLDw0MDw8OEQ8OEhAPExIRFRMSFhUTGBcVGRcWGBYVGhcWHBoYHhwZIBwbIh8dJCAeJiIgKCUjMCgkNCgjNSolNSsmNi0oMyslMCkiODErSUQ9R0E7R0I8YV5ZcnBsbWtobmxpgH16gn58eHNyYFpZVk5KYFlPZFxQTkU6PTQqMSkiIhwaHRoaHRwfHhwhHx0jIiAkJiYnKCgoKSspJSglKSclRjs5Rjw6Rz48UUhFRz89LSkmKyYkLCglLSkmMi0pLSkmHx0bHRoZHRoZGxkYGxkXHBkYHRsZIB0bJCEfKCQiLSknQDc0Rzw3RDk0QzgzQzcyQDYxNzArNjArQzw6TUZEZ2FhdnBwWFRTYF1abWpnZmJgbmtobmpoeXRxfnd2d29sc2pmVUxITkVATkM/Rz47Rz46Rz86R0A7RT86ODMwMi0rLiknKSQjJiIfJB8eIh0cIh0bIh0bIx0bJR8cJiAeKSIfLSYiOC4pRjgwTj00Tj0zSToyRjgwQjUvPzMvPTIuOzEuOTAuNy4sNzAtOjQyPzo5VE9PYFtbXllbZV9gdG9we3d0a2lhYF9VUExERkE6R0A5QDk1PTUyPTUyPTUyPjc0Qjs3PDYzLiooJyMhJSEfJSEfIyEeIyAdIR8dIR4cIB0bHxwaHhsZHBsYHBkXGhgWGBYVFxUTFhQTFBIRExEQEhAPEA8NDw4MDgwMDQwLDAsKCwoJCgkJCQkICQgHCAcHBwcGBwYGBgUFBQUFBQUEBQQEBAQEBAMDAwMDAwMDAwMCAwICAwMDBQQEAgICAgICAgICAgICAgICAgICAgICAgICAgICAwICAwICAwICAwICAwMCAwMCAwMCAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAQDBAQDBAQDBAQEBQQEBQQEBQQEBQUEBQUEBQUEBgUFBgUFBgUFBgYFBgYFBwYFBwYGBwYGBwcGCAcGCAcHCAgHCQgHCQkICgkJCwoJDQwLDAsKBgUEBQUEBgYGBwYGCAgHCQgHCQkJCwkJCwsKDAsLDgwMDg4MEA4OEQ8OEhEQFBIRFRMSFhUUGBcWGhgWGRcWGhcWHRoYHhwZIB0bIx8eJSEfJiMgKSYjMCglNColNSsnNiwpNy4qNCwmMSolOjMtTEZATEZAUUxGX1xXYF5aWlhVV1VSaGVifnp4f3p4amViXVZRWlNLYlpOVExBPzUrMikjJB4bIB0cHx4fHx4iHx4jIiEkJCUkKSkpJiYmHiAeISIeNzEuNjAsOjMwSEA9SkI/NC8rLikmMSwoMy4qNjEtOTQwKCUjHRsYHRsZHRoZHBkYHBkYHRsZIB0bJCAfKCQiKyclNzAtRjs2Rjo0RDkyQzgyQjgyPDMtNjArPDYzUEpHZ2FfZmFfTkpHW1hVgn98i4iGhoKAiYSCiIOAjIaEi4WCeHFuW1NQTUQ/TEE8Rz87RT46Rj46Rj85Rj86Pjg1NTAtMiwrLSgnKSQjJiIgIx8eIh4cIh0bIh0bIh0bJB4bJiAeJyEeKSMhLyckOTAqRTgwSTsxRTcwQDQvPjItPDAtOzAuOzEvPDMxOTIvOjQyPzk4U01LZF5cZV9fa2ZmeXV0end1bGpmZWNeV1JNTEZATEU/Rz87Pzc0PjYzPzc1QTk2Qz04R0E8RUA7OjYyLisnJyQiIyAeIyAdIyAdIh8cIB4cHx0bHxwaHhsZHRoYGxgXGRgWGRYVFxUTFRQSFBIREhEQEQ8OEA8NDg0MDgwMDAwLDAsKCwoJCgkICQkICAcHBwcGBwYGBgYFBgUFBQUFBQQEBAQEBAQDBAMDAwMDAwMCBQQECQgICgkJAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwICAwICAwICAwICAwMCAwMCAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAQDBAQDBAQDBAQEBQQEBQQEBQQEBQUEBQUEBQUEBgUFBgUFBgUFBgYFBgYFBwYGBwYGBwcGCAcGCAcHCQgHCQgICQgICwkICwoJDQwLDQsLBgYFBQUEBgYGBwYHCAcHCQkICgkICwoJCwsKDQwLDgwMDw4NEA4OERAPEhEQFBIRFRQSFxUUGRcWGhgWGRcWGhgXHRoZHhwaIB0cIyAeJCIfKCQiKSYkMCkmNiwoNi4pNy8qODEtNi8pNC0nPDYvUEpEUkxFYFtWb2xnZGNfX11aa2llcm9scG1qcm1qcmxnc21mZF1WY1xPVk5DPzYuMikjJR4bIyAfJiQmJyUpIyIlHx8gHx8fHx8fHh4eGxwcGhwaHhwZJB8bLyomPzk0RD03OzUxMi0pNS8rNzIuOjUxPzo2NzMwIB0cHRsZHhwaHBsZHBsZHRwaIB0cIyAeKCQiKyclMiwqRDkzRzw0RToyRDoyRDoyPDQtNS4oOjQwSUVAUk5KXFlWZWFfiYaDrKmmlZKQlZGPramnjYeFm5aUoZyacmxrY1xaUEZCST45Rz46RD46Qz04Qzw4RDw4Qzs3ODMwNC4sMiwrLSgnKiUjJiIhJCAeIx0cIh0bIRwbIh0bIh0bJB8dJyEeKCMgKiUiMSomPDMtQjUvQDQvPTEtPTAtPDAuPDEvPTQxPDMxOjIwQjs4TkhFXVdUdHBtdnRwfnt4d3RyZmRgaWVhamVgW1VRTUdCSUI9Qjs3QDg1QTk2Qjw3RD45R0E8S0VATEZBSEQ+Pzs3MC0qJSIgIh8cIh8dIR8cIR4bHx0bHhsaHRsYHBoYGxgXGRcVGBYUFRQSFBIRExIQEhAQEA8ODw4NDg0MDQwLDAsLCwoJCwoJCQkICQgHCAcHBwcGBwYGBgUFBQUFBQUEBQQEBAQEBAMDAwMDBAQFCQkICgkJCgkJAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwICAwICAwICAwICAwMCAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAQDBAQDBAQDBAQEBQQEBQQEBQQEBQUEBQUEBQUEBgUFBgUFBgUFBgYFBgYFBwYGBwYGBwcGCAcGCAcHCAgHCQgICggICgkICwoJDAsLDQsLBgYFBQUEBwYGBwcHCQcHCQkICgkJCwoJDAsLDQwLDg0MDw4NEA8OERAPEhEQFBIRFRQTFxUUGRcWGhgXGhgWGxkXHRoaHx0bIR4cIyAfJiMgJyUjKiYkMSonNy4rNy8sODAsOjIvNzArNS8pPjgzUkxHU05IdnJtkY6Ka2lmXFtXjoyJpKGfb2tpXVhVbWhienRtdG5mcGpeWFFHQDcvMSkjJB0aJCAgKSYpKSYpJCEkHhweGxscGxsbGxoaGxobGBgXGRgVJCAcNC8rPTYxPzcyQTg0PDQxNzEuOTQwPTczQTs3Qj05KykmHRsZHhwaHxwaHRwaHhwaIB0cIyAeKCQiLCgmLyspPjYvSDwzRTsyRDoyRDoyOzMsMi0nOTQvRkI+RkM+W1dUfXp2g4B8j4yJpKCeoZ2boZyac21rhH99j4qHZV5cYVlXUEhFRz46Rjw5RD06Qjs4Qjs3Qzs3RDs4Qjk3ODIwNC4tMi0rLiknKiUkJyMhJCAfIh4cIRwbIBwaIRwaIR0aIx4cJSAeJyIgKiQiLiglNS4qPDEtPzEvPjIvPjIvPjMxPzUyPzUyODEtQDk1TkpGXFlUamlka2tmdnVwc3Ftbmtocm5qcGtnbmllV1FNR0E9Qz05QTo3QTs3Qz04RT86R0A7SEM9SUQ+SkU/SUQ/RT88OjYyLCgmIh8dIR4cIR4cHx0bHx0aHRsaHRoYGxkXGhgWGRYVFxUTFBMSFBIQEhEQEg8PEA8NDw4NDQ0MDQwLDAsKCwoJCgkJCQgICAgHCAcHBwYGBgYFBgUFBQUFBQQEBAQEBAMDAwMDBwcGCgkICQgICQgIAgIBAgIBAgIBAgIBAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwICAwICAwICAwMCAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAQDBAQDBAQDBAQEBQQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYFBwYGBwYGBwYGCAcGCAcHCAgHCQgHCQgICgkJCwoJDAsKDAsKBgYFBQUFBwYGBwcGCAgICQgICwkJCwsKDAsKDQwMDg0MDw4NEA8OERAPExEQFBMSFhQTFxUUGBcWGhgXGhgXGxoZHhsaHx0bIR8dJCAfJSMhKCUjKiYkLyooNy8sOTAuOTIvOjQwOTMvODMtQDs2Uk1IXFhTfHh0h4WCa2lnXl1bg4F/kY2Mc29uXVlYcWxoiIJ7i4Z+cmxkTEU/Qjo0MSolIx0ZIR0dIx8iIh4gIBweHhocHBsbGxoaGxcZHBobISAfLSooQDs2T0lDSUE8PzYyRDs2S0E9Qzw4OzYyPTg0QTw4RkE9Ozc0IR8dHhwaHx0bHxwbHxwbIB0cIyAfJyQiLCgmLisoPDQvSDwzRjsyRDoyRDoyPDQtMi0nOTUvSEZBRkRAVFBNa2dkdHBtg398s6+sqqWjg359aWRiZ2FfbmlmcWpna2RhUUpHRz88Qzs4Qjw5Qjw4Qjo3Qzo3RTs4ST06RTo4ODEvMy0sMiwqLikoKyYkJyMhJCAfIh4cIBwbHxwaIBsaIBwaIR4bJB8dJyIgKiUiLigmMywpQDIvQjQxQjQyQjUyQjY0QDUyNy8rOjMvUEpGYV5ZV1VPU1FNY2FdbGpmeHVyioaDdHBsbWhkX1lWRkE9Qj05QDo3Qjs3Qz04RD45RkA7RkI8RkE7RkA7RD86RD45Qj04PTg0LCkmIh8dIR4bIB0bHx0aHxwaHRsYHBoYGhgWGRcWGBYVFRMSFBIREhEQEhEPEA8ODw4NDg0MDQwLDAsKDAoKCgoJCgkICQgHCAcHBwcGBwYGBgUFBgUFBQUEBQQEBAQDBQQDCAcHCQgICQgICQgIAgIBAgIBAgIBAgIBAgIBAgIBAgIBAgICAgICAgICAgICAgICAgICAgICAgICAwICAwICAwICAwMCAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAQDBAQDBAQEBQQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYFBwYFBwYGBwYGCAcGCAcHCAgHCQgHCQgICgkJCwoJDAsKDQsKCAcHBQUFBwYFCAcHCAgICQkICwkJCwoKDAwKDQwLDg0NDw4NEA8OERAQExEQFBMSFhQTFxUUGRcWGhgXGhgXHBoZHhwbIB4cIh8eJCEgJyMhKSYkKiclLiooNy8tOTEuOTIvOzQxOzYxOzYxQDw4TUlFZWJeiYaDi4mGb21rY2Jhd3V0iISDgHx8Yl5fZmJgioaBn5qUioR/V1BMRT05NC0pJB4bIBoZHxwcHxsdHRkbHRkbJB8iKSQnIRweJiIkQkA/Uk9LWlNOW1ROWFFLTUVASkE8UUdCVEtGRT86Pjg0QTw4RUA8R0I+LisoHhwaIB0cIB0cHx0cIR4cIyAfJyQiLCgmLiooNjEtRTszRjszRDoyRDozPzcwNC8pNzQuRkRAT0xIVlJPWFRSWVZTZGBeiIWCj4uKhH9+d3JwcWxqf3t3l5GOko6KcWxpUUpHQTs3Pjg1Qjs4Qzs5RDo4Rzs5Sjw6Tj89SDs6OTIwMy4sMSwqLyooKyYlJyMhJB8eIR4cIBwaHhsZHhsZIBwaIR0bJCAdJyIgKycjLyonOS8sRjczRzczRjczRTk0QTYyNSwpNi8sQz47WlZTVlRQUE1KVVNQX11acW5rkIyKhYF+dXBtYV1aRUE9QDw4Pzs1RD44SUI7SkI7R0A6RUA5RD45Qz04Qjw3QDs2Pjk0PTgzOzYxMS0pIiAdIB0bIB0bHhwaHRwZHRoYGxkXGhgWGRcVFxUTFBMRExEQEhEQEQ8OEA4NDw0NDg0MDQwLDAsKCwoJCgkICQkICQgHCAcHBwYGBgYFBgUFBQUEBQQEBAQDBQUDCAcHCQgICQgHCAgHAgEBAgIBAgIBAgIBAgIBAgIBAgIBAgIBAgIBAgICAgICAgICAgICAgICAgICAgICAwICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAQDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUEBgUFBgUFBgUFBgYFBgYFBwYGBwYGBwcGCAcHCAgHCAgHCQgICgkJCgoJDAoKDQwLCgkIBgUFBwYGCAcGCAgHCQkJCgkJCwoKDAwLDQwLDg0NDw4NEA8PEhAPExEQFBMSFhQTFxUUGRcWGhgXGxoYHRsaHxwcIB4cIiAeJSIhJyMiKSYkKycmLyopNy8tOTEuOTIvOjMxOzUyPTk0QD04R0NAaWVjko+NmZeWcXBvVlRUcW9vkY+QgH19VlJTTkpJaWVjl5GOrKajfnh1R0A+ODEuKCEfHxkYHRkXHxsbHhgcIBkeNC4xQzw/Pzo8R0NCXVtYXVlTUkpGVU1HW1NNX1dRXVVPVExGVExGTkdBPzo2QDs3Qz87SURANjMwHx0bIB4cIR4cIB4cIR4dIyAfJyQiLCgmLiooNS8tRTkzRzozRDozQzkzQjkzODMtNjMuQT46V1VRXlxYW1lWVFBPWFRUbWloeXV0ioeGhIF/bmpogn97sq6pqKSgiYaCZWFdQz06PDUyPzg2RDs5Rjs5SDs6Sj07TT48UT8+Tj89PzU0MS0rMCwqLyooKyYlJiIhIyAeIR0cHxsZHhsZHxsZHxwaIh4cJSEfKSQiLSglMywpRzgzSzs2STo1SDs2RDg0Ni0qNS4sQTs5UU5NTkxKSkhEUE1KVVJPZWFfeXVzenZ0dXFwaWVjVFBNRkI+RD85S0Q8UUhAU0lBUUdBTEU/SEI7RD44QDo1PTgzPTcyOzUxOzYxOjQwKickIB4bIB0bHxwaHhwaHRoZHBoYGhkXGRcWGBcVFRMSExIQExEPERAOEA8ODw4NDg0MDQ0LDAsKCwoKCwoJCQkICQgHCAcHBwcGBgYGBgUFBQUFBQUEBAQEBAUECQcHCQgICAcHCAcHAgEBAgEBAgEBAgEBAgEBAgEBAgIBAgIBAgIBAgIBAgICAgICAgICAgICAgICAgICAgICAwICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAQDBAQDBAQEBQQEBQQEBQQEBQUEBQUEBgUFBgUFBgUFBgYFBgYFBwYGBwYGBwcGCAcHCAcHCAgHCQgICgkICgkJDAoKDQwLCgkIBgUFBwYGCAcGCAgHCQkICgoJCwoKDAwLDQwMDg0MEA4OEBAOEhAPExIRFBMSFhQTFxYVGRcWGhgXHBoZHRsaHx0cIR8eIiEfJSIhJyQjKiclKygmLyspNy8sOTEuOTEvOTIwOjQxPDg1QDs4SUVCbWppjYuKlpSTaGVlTUtMamhojIqLj4yNZmJjSUVFU09Pe3d1nJeWlY+PVlBOODIwKyUjIBoYHBYVHhkYHRcZIhsdR0BCX1laXlhXWlVSWFRPVE9IUElCV09JXVVPYVlTbGNcZl5WVU1GUEhCRD45Pzs2Qj46R0I+NTIuHx0bIR4cIR4dIR4cIR4eIyAfJyQiKygmLiooNS8tRjkzRzozRDkzQzkzQzk0OjUxNzUxPzw4WFZTZ2ViXFpXWVZVXVlZb2tqeXZ1iIWEiYaFbmtpd3Rxn5yYjYqFcm9rbGllSkZCPzg2Pzc2RDo5Rzw6SDw7Sz08TD48Tj89UUFAUEA/PjUzMCwqMCspLSooKiYkJiIhIh8dHxwbHhsaHhoZHhsZIB0bIx8dJyMhLCclLiknQjYyUD85TD04Szw3STw3PTMwNi4sSkNCV1JRS0dGPzw5S0dFUk5MV1JRY2BeaGVja2dmaGVkYl5cWlZSVVBKWFBKXVNNWU9IVEpEUkpDT0lBS0Y9R0I4PzozOzYxOjQwOjQvOjUwOTQvKSUiHx0aHx0aHhwaHhsZHBoYGxkXGhgWGRcWFhUTExIQExEPEhAPEA8ODw8ODg0MDQ0LDAsKDAsKCwoJCgkICQkICAgHCAcGBwYGBgYFBgUFBQUEBAQEBAQECQcHCQgHCAcHCAcHAgEBAgEBAgEBAgEBAgEBAgEBAgEBAgEBAgIBAgIBAgIBAgICAgICAgICAgICAgICAgICAgICAwICAwICAwMCAwMCAwMDAwMDAwMDAwMDBAMDBAMDBAQDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYFBwYGBwYGBwcGCAcHCAcHCAgHCQgICgkICgkJCwoKDQwLCQkIBgUFBwYGCAcHCAgHCQkICgoKCwoKDAwLDQwMDw0NDw4OEBAOEhAQExIRFBMSFhQTFxYVGRcWGhgXHBoaHhwbIB4cIiAeIyEgJSQiJyUkKiclKygmLyspNy8sODAtOTEtOTIvOTMwOTQxPDg2SERDZmJhfnt7jYuLaWdoUE5PY2FigoCCjoyOZ2RmSEZGTktLW1lYf3t6nJeWb2ppOjY0LiknIh0bHBcVHBcWGxYUIhwaT0hFaGFdZF1ZX1pVV1NMU05GVU5GW1NMYltTZFxTbmVcdGthYFhPTEU+RT86Pjk1QDw4RkE9NDEuIB0bIR4dIR8dIR4dIR8eIyEfJyMiKycmLiooNS8sRjk0Rzo0RDgzQzgzQzk0OjUxNjQxQT88W1lXaGZlW1lYVVNRXFpYbmppcW5teXV0i4eGhYF/fHl2k4+MjouIeXZzgX57YFtYRD08Rz4+ST9AST4/SD08Sj08TD48TT49Tj8+UEJAT0FAPjY0LyspLiooLSknKSUkJSEgIR4dHhwaHhsZHhsZHxwaIh4cJiIfKiUjLCglQDUxU0E8UEA6TT86TEA6QTYxOS4sTUVDXVZVUUxKSEJCVE5NU05NT0pJV1NSXVlZY19faGRkZGFeZmNeaGNdfHRwfXJvd21oaF9aW1NNXFVOVlFHTkk+S0U6QTw0OjUvOjQvOjUwPDgyNDAsIR8cHhwaHhwaHhwZHRsZHBoYGxkXGRcWFxYUFBIRExEQEhEPEQ8ODw4NDw4MDg0MDQwLDAsLCwoJCgkJCgkICAgHCAcHBwYGBgYFBgUFBgUFBQQEBQQECAgHCAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgEBAgEBAgIBAgIBAgIBAgICAgICAgICAgICAgICAgICAwICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAQDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYFBwYGBwYGBwcGCAcHCAcHCQgHCQgICQkICwkJCwoKDQwLCQkIBgUFBwcGCAcHCQgICgkICgoJDAsLDAsLDQ0MDw0NDw8OEQ8PEhEQExIRFBMSFhQTFxYVGRcWGxgXHRsaHx0cIB8dIiAfJCIgJiQiKCYkKygmLCgnMCsqOC8sOTAsOTEtOTIuODIvNjEvOjY0T0pKYl1cZ2NjaGZmY2FiUU5QUE1PYF5gZGJkVlNWSEVHRUJDR0VEWlhXeXZ2gX99VFFPMi4sKiUjJCAdIx4cHhkWJyIfTEZBYl1VYVtUXFZQVVBJUkxFVE1FWFFIYlxSa2NZc2tfeHBkX1hOSEI6Qz03PTk0Pzs3Q0A8NDAtIB4cIR8dIh8dIR4dIR8eIyEfJyMiKyclLiooNS4sRjg0Rzk0RDgzQzgzQjg0ODMwNjMxR0VDXVtZV1VTV1VUWVdWXFlYZWFgc29vm5eWramonpuaeXVzfHh2r6upsKyqm5eVf3p4YltbVUxNT0VHTURESkBAST48Sj48Sz49TT89TUA/UURCUERCPTY0LiooLSknLCgmJyQiIyAeIB0bHhsaHhsZHxwaIh4cJSEfKiUjLCglNy8sUUM9U0U/UEM9TkI9QzgzOjArRTs3VU5KWFNOWFJPUkxKSkVDSUVDUExKVlJRWlZWZGFhamZkgn96b2pkdWxpfHFujYJ/hXt3f3lzjYmBeHRqWFJHUks/UEk9Qjw0OjUvOjUwPDgyPTk0KickHhwaHhwaHhwaHRsZHBsYGxkYGRgWGBYVFBMRExEQEhEQERAOEA8NDw4NDg0MDQwLDAwLDAoJCgkJCgkICQgHCAcHCAcGBwYGBgUFBgUFBQQEBQQFCAgHCAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgEBAgIBAgIBAgIBAgICAgICAgICAgICAgICAgICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAMDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYFBwYGBwYGBwcGCAcHCAcHCQgHCQgICQkICwkJCwoKDQwLCggIBgUFBwcGCAgHCQgICgkICwoJDAsLDAwLDgwMDg4NEA8OEQ8PEhEQExIRFRMSFhQTFxYVGRcWGxgXHRwbIB4dIR8eJCEfJSMhJiQiKCYlKygmLCknMCwqOTAsOjEsOjEtOTIuOTIvNzAvPzk3VVBQVVBQUE1MVlNUVFJUSUZJRkJGVVJVYF5hX11fUE1PQT8/Q0FBR0VFT0xNcG5tX1xaOTQyOTMwNS4rNS4rMSwoNDAqRkI7Uk5GU05HTUlCR0I7RD83RD02Rj83UElBW1NKYFdOX1hOT0g/R0A4Pzo1PDczPjo1Qj45My8tIB4dIh8dIh8dIR4dIR4dIyAfJiMhKyclLikoNC4sRjgzSDk0RTgzRDgzPzYyMy4rNjMxVlNRaGVlcm9uenh2Y2BfW1dWXFhXa2dmlpKRtLCwp6SjdnJwWVVTi4iFoZ2bioWEhH5+iYKEjYWHc2prVk1NS0NCSkE+Sj89Sj49Sz89TEE/TkNBU0hFUEZENTEvLSknLCgmKickJiMhIh8eHxwbHhsaHxwaIR0cJCEeKCQiKyclMy0qUUU/V0lDUkZAUUZASkE7PjQuPjUvS0Q9W1VPW1ZRSkRBRkA9TkhGU09NT0tKUExLV1NSYV5cgHx5fHZyZFxZZ15abGJeaGBcaWRfgHt0gn90f3tuYVpOV1BET0c+PTgyOzYxPTgzQT03MS0qHhwaHxwaHhwaHRsZHRsZGxkYGhgXGRcWFRMSExIQEhEQERAOEA8ODw4NDg0MDQ0MDQsKCwsKCgoJCgkICQkICQgHCAcGBwYGBgYGBgUFBQQEBQQFCAgHCAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgEBAgIBAgIBAgIBAgICAgICAgICAgICAgICAwICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAQDBAQDBAQEBQQEBQQEBQQEBQUEBQUFBgUFBgUFBgYFBgYFBwYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCgkIBgYFBwYGCAgHCQkICgkJCwoJDAsKDAwMDgwMDg0NEA4OERAPEhEQExIRFRMTFhQTFxYVGRcWGhgXHRwbIB8eIiAfJCIgJiMiJyUjKSYlKygmLCkoMCwqOjMtPDMuOzIuOzMuOzMwOzQyQDk3UkxMXVhYVVBQTEhJSkdJREFERkRHV1RXYV5hZWNmV1RXQkFBQkBARUNEPz0+TElJW1hWW1ZUVk5LWE5KUUdCRz85RkA6RkE6RkI7R0Q7R0M7Qz83PzoyPjcwPzcwQzszRj42SUE4SUE4SEE4Qz01OzcyOzcyPTk0Pjo2LSknIR8cIh8dIR8dIR4cIR4dIyAeJiIhKiYlLSknNC4sRjgzRzk0RTgzRDgzPzUxMSsoNTEuW1lWeHZ0h4SCioiFaWZjVFBPT0xLYl5dg39/l5OTlZKRe3d2XVlXYl5caWRkZ2Fia2RlmZKTurKzoZiZdGxrVExJTERATkVATkQ/S0A+TEI/TkRBUUhFVU1KSUNBMCwqLCgmKygmKSYkJCIfIR4cHx0aHxwaIR4cJCAeKCQiKyglLSknRT04WU5HVUpEU0lCUEdBRTs1PDMrPzcwSkM9UElERD04SUM/W1ZTWFRRTEhHT0tKT0xLU09OaWRjf3l2iIF9cmplV09KUktHTUZCYVtUi4d7paOVjIh7YltOV1BERkA4PDgxPTk0QT04My8sHx0bHhwaHhwaHhwaHRsZHBoZGhkXGRgWFhUTExIQExEQEhAPEA8ODw4NDg4NDgwLDAsLDAsKCwoJCgkICQkICQgHCAcGBwYGBgYGBgUFBQUEBQUFCAgHCAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgEBAgIBAgIBAgICAgICAgICAgICAgICAgICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAQDBAQDBAQEBAQEBQQEBQQEBQUEBQUFBgUFBgUFBgUFBgYFBwYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCgkIBgYFBwYGCAgHCQkICgkJCwoJDAsKDQwLDg0NDw0NEA8OERAPEhEQExIRFRMTFhQTFxYVGRcWGhgXHRwbISAeIyEfJCIhJiQiJyUkKiclKygnLCkoMS0qPTQvPzYvPjUvPjYxPDQxPzczR0A9Y1xbb2doYVtcTkpLRkNEQT5BRUNGWlhZZmNjamZnXVlaQkBBPTs8Qj9AREFCS0lIZ2Rhe3dzhH15mo6Ik4V7ZVhQU0lBTkY+R0M7R0M6RkI5Qj02QDszPzkyQDkyQTozRDw1Rj43RD42QTs0PDcyOzcyOzcyPTk0NjIuJCEfIiAdIiAeIR4dIB4cIB0cIx8eJSIgKiYkLSknNC0rRTczRzgzRDcyRDczOjAsLCciMSwpTktIbWpnc3BsgX16ZmJeTUpIR0NEVFBRcGxtfXl5g39+hIB/YV1bTkpJT0pKVlBRWlRWioOEoZqbf3d3eXFwb2dkXVVQUkpEUklCT0VATUNATkVCUElFVU1LV1FOPDg2KycmKygmKiclJyMiIh8eIB4cHx0bIR4cIyAeJyQiKyclLCgmNjAuVEtGWVBJVExFU0pETUU/QTkxOjEqOjMtPzcyRj46V1BNZV9cWlZTUExKT0xKSUVES0ZFYl1beHFvk4yJj4mEZF1YU0xIUktHXFZPenZqoqCRqaaYeHNmWlNHTEY9PTkyPzs1Qz85Pjo2JCIfHhwZHhwaHhwaHRwZHBsZGxkXGRgXFhUTExIRExEQEhEPEA8PDw4NDw4MDgwLDQwLDAsKCwoKCgoJCgkICAgHCAcHBwcGBgYFBgYFBQUEBQUEBwcGCAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgIBAgIBAgIBAgICAgICAgICAgICAgICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAQDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBwYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCgkIBgYFBwYGCAgHCQgICgoJCwoKDAsKDQwLDg0NDw4NEA8OERAPEhEQExISFRMSFhQTFxYVGRcWGhgXHRsbIiAfIyEgJSIhJiQjKCUkKiclKygnLCkoMS0rQDUxQjcyQDgyQDczPjcxQDkzU0tGdm1qfXNzbGRjUk5NRENEPz1BSEVHX1tZamVie3Nuc2xnSkZGPzw9Ozk5QEBAUk9Oa2ZkeHNvk4qFrJ6Tv7CejoByXlFHVUtCRT03Qjw1Qjw2QTw1QTw1Qj02Qj02Qjw2Qjw1QTw1PzszPTkyPDgyPDgyPDgzOjYxKyckIiAdIiAeIiAdIB0bHxwbIB0cIh8eJSIgKSUjLSknMy0rRDcxRjgyRDYyQjYyMyolKSIdKyUhMi0qW1ZUfHh1gH13Z2NfSUVEQj0/S0dIXVlacGxrh4SDiISDYl5cS0hGTEZHU0xPU01QYFtbbWdnamNidnBsdW5ocGhhXVVOUkpDUkhBTkZATkZDUEpHVE5KWlRRTkpHLywqKiclKiclKSYjJCIfIR4dIB4cIB4cIyAeJiMhKickLCkmLionR0A8W1NMV09IVEtFUUlDTEQ+PTUvNCsmNS0oPTUxVE1KZF9cYFxYVlFPUEtJTEhGT0tIXVhVaWNfcGlljoiAgXpzYFlUU01IVU5HamVZk5CCs7GjiIN2W1NHTEY9Pjo0QDw2RUA6Pzw3JCIfHhwZHh0aHhwaHRwaHBsZGxoYGhgXFhUUFBIRExIQEhEQEQ8PEA8NDw4MDg0MDQwLDAsLCwsJCwkJCQkICQgHCAcHBwcGBwYGBgYFBQUEBQQEBgYGCAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgIBAgIBAgICAgICAgICAgICAgICAgICAwICAwICAwMCAwMDAwMDAwMDBAMDBAMDBAQDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCgkIBgYFBwYHCAgHCQgICgoJCwoKDAsKDQwMDg0MDw4NEA8OERAPEhEQExISFRMSFhQTFxYVGRcWGRgXHRwbIiAfJCEgJSMiJyQjKCYkKicmLCgnLCkoMS0rQzgyRTo0Qzk0Qzo0QTkyQToyY1xUf3dvhXx2iYB7amRiS0pMQ0JGUU1PZV5camRekoV5lIh9YFpXSERFQD8+QEE+TUpIbGNhfG9ro5aOt6mcxLWilIR2ZVZLVUpBRDw2Qzw1Qz02Qj02Qj43Qz43Qz43Qz83Qz84Qj42QTw1QDs0PjozPjo0OzcxLCklIyAeIiAeISAeIR4bHhwbHhsbIB0bIR4cJCEgKCQjLCgnMy0rQzYxRTYyQzUxQTYxNComKSEcKCIeKCQhRkI+Uk5JUU5HWlZRSEREPzo8RUBCUk5PbWlpg39+eXV0YFtZTUdGRkBCR0FESkVJS0ZJUUtNY11df3p1hH53c21lc2xkY1tTV05GU0lBUUhDUUtHVE9LWVVRV1NQMzAuKickKiclKSYkJiMhIiAeIR4dIR4cIx8eJSIgKSUjLCkmLCgmNjIuVk9JW1NNVU1HUUpET0dCSkE8PjQwNCsnNCwoPzYyTUVCV1FOV1BOU05KVVBNV1JOXFZSaWNebWdgiIJ2npeKc2xkVU1JV1BJamVZhoJ1mpeKdnBkWlFGS0Q8QDs1Qj03RkI9NjMuHx0bHx0bHx0bHhwaHhwaHBsZGxoYGhkXFxUUFBIRExIQEhEQERAOEA8NDw4NDg0MDQwLDAwLDAoJCwoJCQkICQgHCAgHBwcGBwYGBgYFBgUEBQQEBwYGCAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgIBAgIBAgICAgICAgICAgICAgICAgICAwICAwICAwMCAwMDAwMDAwMDAwMDBAMDBAMDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCgkIBgYFBwYHCAgHCQgICgkJCwoKDAsKDQwMDg0MDw4NEA8OERAPEhEQExISFRMSFhUUFxUVGRcWGRgXHhwbIyEgIyIhJSMiJyQjKCYlKicmLCknLCkoMi0rRjs1ST03Rzs3Rjs3QjoyQTwxZl9Vh4F1jYh6lY+De3ZvS0hIPzs9VE5Obmdic2thl4l4n5CBYFhTQ0BAR0ZFTEtJWVNScmVki3p2r5+Wuaufo5SGd2dbZ1hMUUY+RT03Rj44RT43RD84RD84RUA5RkE6RkE6RkE5RUE5RUA5REA4Qj02OzgyLColIyAeIyAeIiAeIR4cHhwaHRsZHRsZHhwbIR4cJCAfKCQjLCgmMSspPzMvRDUxQTQvQTUwOzAsLCQfKyUhMy0pTEdCWVVOX1pTYl1XTEdHPjk7Qj1ASERGV1NUZ2NhamVibGdkXFZVQDk9NzE3OjY7OjY7RUBDWlVVd3JtjYiBi4V9ioR8l5KIdW1kWk9GV0xFUkxIVFBLWVVQW1dTPTo3KickKiclKSckKCQjIyEfIR8dIR8dISAdJCEgJyQjLCgmLCknLSooPzo2V1BKWFBKUktFT0dCTUM/S0I+Qjg1OjAtOjAsQDYyRj46S0RATkhET0lFTkhDTkdCV1BLY1xVg3xwiIF0X1dORj43RTw1TkY9W1NIYllPXVRKVU1CRD43QTw2RUA6R0M8Mi8rHhwaHx0bHx0bHh0aHhwaHRsZGxoYGhkXFxUUFBIRExIREhEQERAOEA8ODw4NDg0MDQwLDAwLDAoKCgoJCgkICQgICAgHCAcGBwYGBgYFBgUFBQQEBwYFCAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgIBAgICAgICAgICAgICAgICAgICAwICAwICAwMCAwMDAwMDAwMDAwMDBAMDBAMDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCgkJBgYGBwYGCAgHCQgICgkJCwsKDAsLDQwLDg0NDw4NEA8OERAPEhEQExISFRMSFhUUFxUVGRcWGRgXHhwbIyEgJCIhJSMiJyUkKCYlKicmKykoLCkoLysqQzk1TD86ST45ST46RT01Qj0xUUxAdnFki4Z4iYR4YVtUPDc1ODExRTw7X1dRd21ij4JzhXhrTURAOjU0Ojc1REA+UEhHYlZTd2diiXlxhnZtcWFXalpOXU9GSkA6Rz85Rz85RkA5R0E5SEI7SUQ8SkU+S0U+S0Y+SUQ8REA4Pzw0MzErKCUiIyAeIyAeIyAdIR8dHxwaHBsZHBoYHBoYHRsZIB0bJCAeJyMhLCclLyooOjAtQzQvQTMvQDMvPzQwNCsnLSciNjAsVU9IbGZeiIJ5iIN8X1pYQDs+Pzo/Qj1ASURFVVFOXVhWenRwhH57VU5QPjg+PTk/Pjw/QT0/UUxLZF9bZmBZcmtjhn91q6ablo6EZ1xSXVFJVU5IVVBMWVVQX1xXSEVBKickKiclKickKCYjJSIhIR8dIR4dIR8dIyEfJiQiKiclLCknLCknLSknPTg1VE1HVUxHUEdCTUM/S0E+S0E9Rz06QTg0Qzk1SUA7TUVATUZBSUI9RD04Qjs1RD03S0M8V09HU0tDRz83QDcwPDMrQDcuSUE3UEc9UEc+R0E4QTw1Qj43R0I7REA6KCUjHhwaHx0bHx0bHh0bHhwaHRsaGxoYGhkYFxYUFBMRFBIREhEPERAPEA8ODw4NDg0MDQ0MDAsKDAoKCgoJCgkICQgICAgHCAcGBwYGBgYFBgUFBQQEBwUFCAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgIBAgIBAgICAgICAgICAgICAgICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCgkJBgYGBwYGCAgICQgICgkJCwsKDAsLDQwLDg0NDw4NEA8OERAPEhEQExISFRQSFhQUFxUVGRcWGRgXHhwbIyEgJCIhJiQiJyUkKSYlKigmKykoLSopLSopPTQyTkA8TEA8S0E8SUA8RT82R0M2Uk5CWlZLVlFIRkA6OzQyODAvPjUxS0E6XFBHZVhOXVFJS0E8OzQyNC4tNi8uPjUzSz46WElEYlJLaFZOZ1ZNXU5GTEE7ST45SkA6SUE7SUM8SUM8RkA6Qz44OjUxNzMuODQvNTItKygkJyUhIyAdISAdIiAdIiAdIR8cHx0bHRsZGxkXGxgXGxgYHRoZHxwbIh8eJiIhKyYkLionOTAtQzMvQTMvQDMvQDQwPDEtMysnOTIuWVJNbGZfhYB3k46Gb2pnUUtPRD5CQTw+SUREVFFPVVBNbmhjnpiUfXd3UUxQS0dLQ0JCPjs7SUZFXFZUWFFMZVtUeG5knpOJnpSJcWZcYVZNVlBKVlFMWlVQYFxXR0RAKickKiclKiclKCYkJSMhIiAeIB4dIR4dIyAeJSIgKCUjKygmLCknLCknLCknPDczUEhEUUhETUNAS0E/SkA9ST89SD89Rz48SUE+TEVBTkdCTEVARj46Qzs1Qzw2Rz85SkI7S0M8SEA4QTkyPTUuPjcvQjsyQjw0QDszPzo0Qj42RUA5SEM8OjcyIiAdHx0aHx0bHx0bHx0bHRwaHRsZGxoYGhkYFxYUFBMRFBIQExEQERAPEA8ODw4NDg4MDQwMDAsKDAsKCgoJCgkICQkICQgHBwcGBwYGBgYGBQUFBQQEBQQECAgHCAcHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgIBAgIBAgICAgICAgICAgICAgICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCgkJBgYGBwYGCAgICQgICgkJCwsKDAsLDQwLDg0NDw4NEA8OERAPExEQExISFRQSFhQUFxUVGBcWGRgXHhwcIyEgJCIhJiQjJyUkKSYlKignLCknLSopLCopNTAuTUA9T0NATUI/TENASkI+SEM7SUU8SUU8R0I7Qjw3PDYzOjMwPzYxRz01UEQ8VUlAVUlBSkA7PTUzODEvNi4sOzEvRTg1UUE9WUhCVkdBUUM9ST04SD44Sj86SkA7TEM8TEQ+PjgzKyckKCUiJCAeIh8dIh8cIh8dIR8cIR8cIiAdIiAdIiAdIR8dHh0bHBsZGxkXGhgXGRcWGxgWHBkZHxwbIh8dJiIgKiYkLiknNC4qQTMvQjMvQDMvQDQwPzQwOTEtPTUxV1BKeHBqi4J8mZGKfXZzV1FTR0JERUBCTEdIV1NQU09LYVxXmZOOnpiWZmFiTUlLR0VFREBBSEVFWFRRaGFbd21lgXNqkYJ4kIJ4cWZbZltRWFJLVlJMW1ZQYFxXR0NAKSckKiclKiclKSYkJiQhIiAeIB4dIB4dIh8eJCIgJiQiKiclLCgmLCknLCknLCknOjQyS0I/TkRBTEJASkA+SUA+ST8+SD8+Rz8+RkA+R0A+R0E/RkE9RUA9RkE9SEI+SEI+R0I8RT84Qjw2Pzo0PjgyPjgxPjkxPzozQDs0Qj43RkI7Qj44JyQhHx0aHx4bHx4bHx0bHx0bHRwbHRwZGxoYGhkYFxYVFBMRFBIRExEQERAPEA8ODw4NDg0MDQ0LDQsKCwsKCwoJCgkICQkICQgHBwcGBwYGBgYGBQUFBQQEBQQEBwgHCAgHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgIBAgIBAgICAgICAgICAgICAgICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCQkJBgYGBwYGCAgICQgICgkJCwsKDAsLDQwLDg0NDw4NEA8OERAPExEQExISFRQSFhQUFxUVGBcWGRgXHhwcIyEgJCIhJiQjJyUkKSYlKignLCgnLSopLCspMC0rRzw7UkZET0VDTUVDTEVDSkRBSENAR0I+Qz87QDs4Pjg1PTc0PjcyQTgzRDs2Rj04Rjw4QTg1PjUzOzMxOTAvOi8tPDEuQDMwQzUxQjUxQjYyRTo1Rzw4ST45SkE7TEM8PjgzKCQhIh8cIh8cIyAdIyAdIiAdIiAdIiAdIiAdIiAdIh8dIh8dHx0aHRsZHBkXGhgWGRcVGRcVGhcWHBkYHhwaIh4dJiIgKiYkLiknMywqQTMvQzQwQjQwQTQxQTUyPjQxQDg0TkdDdm1omo6KoJWRd29sQz49ODM0OTQ1QTw6T0pHWFNQY11YkoyHopyYYlxbQDw8PTk5OjY2PTk4R0NAVk9JZFtTfG9mhXdudWlfal5UZlxRV1JKV1JMW1ZQYV1XS0hDKyglKiclKiclKSckJiQiIiAeIR8dIB4cIB8eIyAfJSMhKCYkKygmKygmKygmKygmKygmMS0rQjo4TEI/S0A/SUA/SEA+SEA+R0A+RkA+RUA+RUA+RkE/RkI/SENASENASEM/RkI9RD86Qjw3Pzo0PjkyPTgxPTgxPzozQDs0Qz84Q0A5LywoIB4bIB4bHx4cHx4cHx0bHx0bHR0bHRwZGxoYGhkYFxYUFRMSFBMREhIQEhAPEA8ODw4NDg0NDQ0LDQsLCwsKCwoJCgkJCQkICAgHCAcGBwYGBgYGBgUFBQUEBQUECAgHCAgHCAcHAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAgIBAgIBAgICAgICAgICAgICAgICAwICAwICAwMCAwMCAwMDAwMDAwMDBAMDBAMDBAQDBAQEBAQEBQQEBQQEBQUEBQUEBQUFBgUFBgUFBgYFBgYGBwYGBwcGCAcHCAcHCAgHCQgICQkICwkJCwoKDQwLCQkJBgYGBwcGCAcICQkICgkJCwsKDAsLDQwLDg0NDw4NEA8OERAPEhEQFBISFRQSFhQUFxUVGBcWGRgXHhwcIyEgJCIhJiQjJyUkKSYlKignLCgnLSopLSspLSsqQTk3U0dFUEZETkZETEVES0VDSERCRkE/Qj48QDs4PTg0PDYzPTYyPzczQjg0Qjk1Qjg1PzY0PDQxOjEvOS8tOS4sOS0sOi4sPTAtPzMvQjYyQzgzRTo2Rz04S0E7SD46KycjIh8cIyAdIyAdIyAdIiAdIiAdIiAdIh8dIh8dIh8dIh8dIB8cHx0aHBoZGxkXGhgWGBcVGBcVGRcWHBkXHhwaIh4dJiIgKiUkLikmMywqQTMwQzQwQjQwQjQxQTUyQDYyQzo3S0M/XVRQenFtenFtVE1KODMyLSgnKyYmMy8tQz47WVNQbmhjjoiDiYN/TkhGNzEvLikoLCcmLikoNC8rPTYwSUE4WU5EYFVLYFVLZVlPX1ZNVU9JWFNMW1ZQYV1XWlZSMjAtKSckKiclKSckJiQiIiAeIR8cIB4cIR8dIiEeJSIhJyUjKigmKygmKygmKygmKygmKSYlMS0rSD89S0E/SUA/SEA/SEA/RkA+RkA+RUA+RUA/RUE/R0I/R0NASENASEM/R0I9RD86Qj03Pzo0PTgyPDgxPTgxPjkyPzs0Qz84OjYxIiAdHx0bIB4cIB4cHx4cHx0bHx0bHR0bHRwZGxoYGhkYFxYUFRMSFBMREhIQEhAPEA8ODw4NDg0NDQ0LDQsLCwsKCwoJCgoJCQgICAgHCAcGBwYGBgYGBgUFBQUEBQUECAgHCAgHCAcH"
  }
});
