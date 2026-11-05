/**
 * Mini Saichania (Tierra) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte de:
 *   assets/dinos/arte/tierra/saichania_der.webp
 *
 * Saichania: Anquilosáurido morado oscuro con vientre lila, púas amarillas y maza ósea clara en la cola.
 * Estilo liso chibi: cuerpo bajo y ancho, patas cortas, ojos grandes, colores planos del dibujo.
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
  id: "mini_saichania",
  categoria: "mini dino",
  nombre: "Mini Saichania (Tierra)",
  icono: "🦕",
  origen: "assets/dinos/arte/tierra/saichania_der.webp",

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

    // Coraza: púas cónicas y escudos sobre el lomo, colgados del hueso de su tramo
    {
      const azar = M.azar(4242);
      const C_PUA = new THREE.Color(0xeec462), C_ESC = PAL.lomo.clone().multiplyScalar(0.78);
      const sobreLomo = (z, th, uMin, uMax) => {
        const fila = filaEnZ(z, uMin, uMax); const fi = filaInfo[fila];
        const d = V(Math.sin(th), Math.cos(th), 0);
        const h = superficie(V(0, fi.y, z).addScaledVector(d, 1.2), d.clone().negate());
        return h ? { h, fi } : null;
      };
      const cono = (z, th, alto, rad, uMin, uMax, color, inclinaZ = 0, nombre = "PuaCoraza") => {
        const r = sobreLomo(z, th, uMin, uMax); if (!r) return;
        const n = r.h.n.clone().add(V(0, 0, inclinaZ)).normalize();
        const b = r.h.p.clone().addScaledVector(n, -rad * 0.5);
        const c = punta([b, b.clone().addScaledVector(n, alto * 0.5), b.clone().addScaledVector(n, alto)], rad, nombre, 8, 10, 0.9);
        g.add(c); colgar(huesoEnU(r.fi.u), c); pintarLuego(c, () => color);
      };
      const escudo = (z, th, tam, uMin, uMax) => {
        const r = sobreLomo(z, th, uMin, uMax); if (!r) return;
        const e = bloque(0, 0, 0, tam, tam * 0.35, tam * 1.1, 0.5, "Escudo", 10, 8);
        e.position.copy(r.h.p).addScaledVector(r.h.n, -tam * 0.05);
        e.quaternion.setFromUnitVectors(V(0, 1, 0), r.h.n);
        g.add(e); colgar(huesoEnU(r.fi.u), e); pintarLuego(e, () => C_ESC);
      };
      for (let k = 0; k < 48; k++) {
        const z = -0.3 + (0.22 - -0.3) * azar();
        const th = (azar() * 2 - 1) * 1.25;
        if (k % 2) cono(z, th, 0.075 * (0.7 + 0.6 * azar()) * Math.cos(th * 0.6), 0.024, 0.1, U_PECHO + 0.03, C_PUA);
        else escudo(z, th, 0.026 + 0.012 * azar(), 0.1, U_PECHO + 0.03);
      }
      if (true) for (let k = 0; k < 6; k++) LADOS.forEach((s) => cono(-0.62 + 0.06 * k, s * 1.2, 0.034, 0.014, 0, 0.45, C_PUA, -0.4, "PuaCola"));
      // Fila de púas grandes a lo largo de cada flanco
      for (let k = 0; k < 7; k++) LADOS.forEach((s) => cono(-0.26 + 0.075 * k, s * 1.32, 0.075 * 0.95, 0.024, 0.1, U_PECHO + 0.03, C_PUA, -0.15, "PuaFlanco"));
    }

    // Maza ósea al final de la cola
    {
      const zf = P.EJE[0][0], yf = P.EJE[0][1];
      const C = new THREE.Color(0xdccab2);
      [-1, 1].forEach((s) => pintarLuego(colgar("Cola3", bloque(s * 0.045 * 1.45, yf + 0.005, zf + 0.03, 0.06 * 1.45, 0.05 * 1.45, 0.07 * 1.45, 0.3, "MazaCola", 18, 14)), () => C));
      pintarLuego(colgar("Cola3", bloque(0, yf + 0.005, zf - 0.02, 0.05 * 1.45, 0.045 * 1.45, 0.05 * 1.45, 0.3, "MazaCola", 14, 12)), () => C);
    }

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
    "nombreCorto": "Saichania",
    "tipo": "cuadrúpedo",
    "brillo": 1.02,
    "inclinacion": 0.35,
    "mezcla": 0.16,
    "colorBase": 13658730,
    "colorUna": 9411244,
    "iris": 3811872,
    "iris2": 657414,
    "EJE": [[-0.72, 0.345, 0, 0, 0, 2.0],
      [-0.68, 0.345, 0.03, 0.03, 0.03, 2.0],
      [-0.58, 0.35, 0.05, 0.05, 0.05, 2.1],
      [-0.46, 0.355, 0.08, 0.08, 0.08, 2.2],
      [-0.34, 0.365, 0.14, 0.13, 0.12, 2.4],
      [-0.2, 0.385, 0.26, 0.24, 0.18, 2.8],
      [0.0, 0.405, 0.3, 0.28, 0.2, 3.0],
      [0.18, 0.395, 0.27, 0.24, 0.18, 2.8],
      [0.3, 0.375, 0.17, 0.15, 0.13, 2.4],
      [0.36, 0.385, 0.15, 0.13, 0.12, 2.4],
      [0.42, 0.405, 0.17, 0.15, 0.13, 2.6],
      [0.5, 0.415, 0.19, 0.16, 0.13, 2.8],
      [0.58, 0.405, 0.17, 0.14, 0.11, 2.8],
      [0.65, 0.385, 0.13, 0.11, 0.08, 2.6],
      [0.7, 0.375, 0.1, 0.08, 0.06, 2.4],
      [0.73, 0.37, 0.06, 0.05, 0.04, 2.2],
      [0.745, 0.365, 0, 0, 0, 2.0]],
    "IMG_EJE": [[20, 25, 3, 3],
      [22, 50, 6, 6],
      [30, 80, 9, 9],
      [55, 110, 14, 14],
      [100, 130, 25, 25],
      [170, 140, 75, 72],
      [260, 130, 95, 92],
      [340, 150, 75, 65],
      [380, 190, 40, 40],
      [400, 180, 40, 40],
      [420, 167, 44, 40],
      [440, 167, 40, 35],
      [460, 177, 34, 30],
      [480, 190, 24, 20],
      [495, 195, 18, 14],
      [505, 200, 10, 8],
      [510, 202, 2, 2]],
    "bultos": [[-0.2, 0, 0.14, 0.02, 1],
      [0.18, 0, 0.13, 0.02, 1]],
    "HUESOS": {
    "Cadera": [0.385, -0.2],
    "Cola1": [0.365, -0.34],
    "Cola2": [0.355, -0.46],
    "Cola3": [0.35, -0.58],
    "Pecho": [0.395, 0.18],
    "Cuello1": [0.375, 0.3],
    "Cuello2": [0.385, 0.38],
    "Cabeza": [0.415, 0.5],
    "Mandibula": [0.365, 0.48]},
    "PATAS": [{
    "nombre": "PataTrasera",
    "trasera": true,
    "padre": "Cadera",
    "huesos": ["Muslo",
    "Pierna",
    "Pie"],
    "cortes": [0.42, 0.78],
    "camino": [[0.15, 0.32499999999999996, -0.2],
      [0.2, 0.27, -0.2],
      [0.21, 0.16, -0.2],
      [0.21, 0.08, -0.2],
      [0.21, 0.035, -0.2]],
    "radios": [[0, 0.118],
      [0.3, 0.112],
      [0.6, 0.1],
      [0.85, 0.096],
      [1, 0.094]],
    "img": [[110, 240, 28, 28],
      [105, 270, 22, 22],
      [100, 295, 20, 20],
      [100, 310, 20, 20],
      [100, 318, 20, 20]],
    "pie": "saurópodo"}, {
    "nombre": "PataDelantera",
    "trasera": false,
    "padre": "Pecho",
    "huesos": ["Brazo",
    "Antebrazo",
    "Mano"],
    "cortes": [0.42, 0.78],
    "camino": [[0.15, 0.32499999999999996, 0.17],
      [0.2, 0.27, 0.17],
      [0.21, 0.16, 0.18],
      [0.21, 0.08, 0.18],
      [0.21, 0.035, 0.18]],
    "radios": [[0, 0.11],
      [0.3, 0.105],
      [0.6, 0.094],
      [0.85, 0.09],
      [1, 0.088]],
    "img": [[255, 240, 30, 30],
      [255, 280, 24, 24],
      [255, 310, 22, 22],
      [255, 330, 20, 20],
      [255, 340, 20, 20]],
    "pie": "saurópodo"}],
    "MANDIBULA": [[0.45, 0.13, 0.03, 2.4],
      [0.52, 0.13, 0.03, 2.5],
      [0.6, 0.11, 0.026, 2.4],
      [0.66, 0.085, 0.022, 2.3],
      [0.71, 0.05, 0.018, 2.1],
      [0.735, 0, 0, 2.0]],
    "IMG_MAND": [[440, 215, 8, 8],
      [455, 222, 7, 7],
      [470, 225, 6, 6],
      [485, 224, 5, 5],
      [495, 222, 3, 3],
      [500, 220, 2, 2]],
    "DIENTES": {
    "sup": [0.66, 0.69],
    "inf": [0.675],
    "largo": 0.01,
    "radio": 0.005,
    "ancho": 0.8},
    "paladarDesde": 13,
    "OJO": {
    "y": 0.46499999999999997,
    "z": 0.56,
    "tam": 1.1,
    "frente": 0.4,
    "img": [410, 175]},
    "FOSAS": [[0.03, 0.395, 0.72, 0.009]],
    "oscuroParpado": 0.75,
    "rugir": {
    "pecho": -3,
    "cuello1": -6,
    "cuello2": -6,
    "cabeza": -8,
    "boca": 24},
    "estilo": "liso",
    "zigzag": {
    "base": -0.3,
    "amp": 0.1,
    "periodo": 0.22},
    "filasLiso": {
    "cabeza": 99,
    "cara": [99, 100],
    "pico": [14.2, 15.2]},
    "paleta": {
    "lomo": 6044764,
    "panza": 12362940,
    "pico": 14205136,
    "patas": 7097452,
    "aleta": 3810362},
    "patron": {
    "tipo": "franjas",
    "color": 14200906,
    "escala": 1},
    "caracter": {
    "ojos": "sorprendido",
    "pose": {
    "Cuello1": [-8, 0, 0],
    "Cabeza": [-10, 0, 0],
    "Mandibula": [14, 0, 0]},
    "arquetipo": "asombrado"}},

  textura: {
    w: 260, h: 163, k: 2,
    datos: "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mHuZooagpYujpYufooubnYaWnoiXqpWitaCsuKOtvqmywq25wqu6xa26xa67rIyKi1pEfU9AbElQVjxRRS1CRitASS5DSTBERi9FSjRJWUFUX0ZYYktZaVVfa1ZgZk9ZZ0ZUaUFTa0VWhF9vonWJvoqgxJOpnXqKm3uLqIGTl26BeFJkcVBgRTE9IxYfMB8pTjVDZ0VWakhYdlFii2F0imJ0gV5uf2BvjG59s5OiuJinpYaUsI+evpipupOltZCgvpqqq4iYcVZjSjVATjVAWDxHe1tnqIeTsJCJso5nsYlXuY5XzaZq1LJ8r5NtdF1EQjk0PTIsOy0nQTItVkI9cFZUd1ZabktRa0lPaUlQaEpRYkZOWj9KUDZDSi9ATzNFUzdIWDxNUzdLWDxQaU9edFtlgmltj3d6clleUzpBUTg7W0I/Z01DblVHgmpcqY9+ln5rYE8/TkAyTEM2Tkc+TEc/TElATElDPTo0LyolKyYiJiMfIyAcIR4bIR4bIh4bIyAcJiEdKSUhLSciLykkNjAqQjs2SkM9S0Q/SkM8SUI7SEE7R0A6Rj45Rj05ST46Sz86UEI9XE1BZVVFm4VrzrCPx6aBxaN7yah+zK2JrpWFh3J7kHZ0oXtfoHJLkV9BlGRGqnhRrIJolnqEdV2Ha1KJYUiAWj9jXz5LdEtGmmZNmGRImGNFoG9Ti214cF+ScmKldmKqbVeWUz5yQSpbRChZXj9WhF5Vm25Vpm5NrmdBsGE2rWAvxHtDv4Rhk2l1gl6JhV+XhV+Wj2mboXuWu5SEvZNytYVbpHRJjWQ5q4lg2L+Z5NK249O9376c3Kt4xZh4pIONooSgnHqemXGloXixiGKUbEhzbEZ1YjpuWDBjWDBhYDZmbkNzdUl5b0J1az5yZThsZztvZjxwa0F3a0F1YzpwZjt2ckV9fVCEfVCDZDtra0NwkGuNj22HgWFwq46MzbOk2sOnwq+Qm4V+jneAg2uDinCOiG6KgGZ9jnSKm4CXsJetpoyjl32WiG2IlXiUn4KfpYimqIuroYSlnH+emn+coIaeoYqcmYKVjXaLm4KXtJ2puaKsuaKrvKWyu6GzvJ2yuJ2ynoORd1VXakhMZkhVVDhKSi1ASS0/SS5BRzBDSDJISDJITDhFW0hSblxifGptkn6CjHV7aUtWWDZEWTtJaU1bd1Zml26BmG+CcU5fkmZ6yZWszZyxrIGUr4iai2x7RC46UDJBiF9xsH6UyI2mz5Kr1Jix0JivxJCltYKYsH+TuomevY2iuIueuI+hu5Wlso6erYqau5Wms46fknKBbFNfWUJMTzpDTDM+YUZRiGpwpYFusIdet4lT0qdn7seQ376Wh25SQzo2Qzk1PDAsOywpQi4tWUBDfFxkfVtjdVRcdVZebU9YYEJNWTtIUTZDVzxOVjtPVTpNVjtPW0FWYUhdZU1fbldkgGhve2VpaFFVV0BFVD1BWD9BXENEa1NShW5ok3xxaldMTj4zSj0yTUU7TUc+TEc/TUlCSUZANzItLyolKiYiJiMfJCEeIyAdIyAdJSEeKCIfKyYiLikjMCkkNjAqRUA6TUZBTEU/TEQ9S0Q9S0Q8S0M8SkI7SEE7SD86SD46SD46TUI7WU1BY1NFkXxnxaiKwJ9+vJp3vZp3wqB/q4+DhG1/gWyBkXJunHRamG1Si2JUeVhgcFV1aVODa1aJcVuSRzRrMiBQOCVNRy9MWz1OVTpLVj5TYk5wbFyTdWWofGyxcF+iXUqGQS1fOCJTPSRWOSJOQCpLVDlPYEBQZEJOaEJJbUNGf1NUfVVvZ0V0dlSCkm2jj2uelXGfoXudtYyIxZp3uIZTpG41nmkxo3A6vI5d2a2C48Ce5sOe47Jw0KNtnX1/hWiLjGmZl2+kon2rmXqej3OSh2iNeVWEaUR0YjxsaEFzcEl+bER6ZTtzXDRpVy9hYDhpa0N4dUyDbkV4ZTxzZjp6aj95cUd8YjltWS9jZj5rhGF2knR2s5mKz7ed1b2f07yft6CNm4SCiHGFhW6In4efo42ipo+guKCzs5qurpSor5apsZestZqwwKS9t5u0qo+ppouon4KimHuanoSeqZGmooqcg2yBY0pkaE1ol32OuJ6rwaa0wqa4wqe7vJ+3lnmTcVZvZ0xbak1XZUpWVjtJUDVFTTNDRy9ARzFDSDRIVkdKWkxHVkZKZlRYfGlqkHt8mIGEeV9mYkhRXkZRaVVfbVRgcVNhZ0dWkmN4sHePyYmk5aO+7LHK5bXKvZWna0hZUyo9nml/15mz3Zq12Zaxz5Gqy5CoyY+nxoujwYeewoifwoqhwo2kvY2huo2gsIaZrIKVu5CjvpOluZCiroaYnXiHeltnTzVARi44b1NgooCEsYp0v5Jl1aVp6L2EzKuChWtPQDk2Qjo3Qzk3PzAvQCwuSjM3blBXh2dvf2Fod1tiblFaX0JMUzZAWj9LYUVVWDxOUzhMUzlOWkJWZ09lbldrg2x6moOMiHN3ZlJUXklMVkJFXEZJZE5RbVdYclxaX0xGSTozRjcwSUA4TEY+S0Y+S0c/TElCQ0E6My4pLyomKycjKCQhJiMfJyMfKCQgKiUhLSgjLykkMismOjQuRkE8TEZBS0U/TEU+TEU9TUU9TkY9TUU9TUU8TUQ8SkI7SUA6ST86TEI8VkpAbV1QtJ+NzbKcv52Cso5zr4hru5Z1spKCgmV4dFd1dVltc1ZZdlZWY0hfUTxpUj14V0KBcF6Xbl2TPitjOCddOytgOilfPCtiSDlrU0ZzXVGGbV2Ze2qtd2apW0qLUD15PiphNyFVPidaOCJTMx9MOCVPPStUPi9VPjBXOitYTjhjb1J4cVB6c1OAhmaaiGWZf1yLgV+JmHR/wJR5vYhdsG40sm8yo2InpWYtun9J15de56hs469l06hvnXuDfV6Ng2OYl3elwqzA2MrM2c7OzL7Fsp6unIObjnGRhmWRgV2WelOVbkeKYTxzXDdpaEF0ckqAd06DcUh7bUR7cUeDc0mDc0qBZDpwXTNmbEVtlnR9sZeD0LmR1L+S0buSybGatJuSnYWKkHmNlH6RqZOmuqa2xK+9uaKxqZGhqpGjqZChpoueup+zrpKpmHyUnIGZmX+YjnWPmIGYtaK0xrPAspyshGuCZUtmXkFegWR7t5quxaa7u521t5u0mH2WZEpkVTtVY0dcbFFdZkxYUzpGSjA+Ri08Ri4/RjFAWUpFf3hOgXpRb2NTZldTc2BghG5viXF0gmtwa1RbYEhTbldic1xnYEhTYkVSmWl+snKNvnOR2JCu4aO916K5sIOXZUFSOhoreE9iuoWczY6oz5Cqxoujw4uixoujxoujwImfwY2jvoqguomdu4ufuIqes4WYs4aZuoygv5GkwpSnyZmty5uutIyciGh1e11pcVVhfl9wnnyBtIt0vJJmpoJbh2lLdVxCPjg2QDk3Qjo4RDk4QzIzQy4xTjc8ZUpQc1Zdb1NaYkdPUjhBUDdAV0JLWD5LVDhJSzFFUDdMYEdea1NrdV1yj3aGn4eSm4SIe2ZpaFRWU0JEVkNGW0ZJUj8/SDc1QTIvPzAsRDgzS0Q9S0U+SkY+SkdASkhBPjo1Mi0oMCsnLCgkKiYiKiYiKyYiLCgkLikkLykkNjArQz45TUlFTEhDS0U/S0U+TEU9Tkg9U0w+VlBAWFBBV09AU0k9T0U8TEM7S0E7TEI8UUc+cmJWyrOg1Lmjt49xoHVUnnNRqINhmXpwblNvYkZqWkJnSThcUT5jUkBvTzxuSzZtQi9nZVWJY1KKRTRvQzJuQS9uOyprPCtsTT54Wkx9XVGGYlWRalycXk6OTj1+SDN3Tjh7Ri9pQSpfPSdXOiVUQzBfRjRiQDBYQDNbQjFpVUBpjHGBsZWji2+WeVuRdVeKZEV3X0NyaE1ukmtrrXderWk8r2g2o2AwklAcl1Uaq2Qq0opB6a1i06V/nXuQhGaXgGKVknifyri72cu84tXI7efa5+HV39bL0cS+wKywqo6ilXObfFiLb0x9dVN9e1iFfFaGe1ODb0d4bUV1fVZ/j2iMiWKDhV56jml7lXJ9r4+HwaWD0LiIzraMr5WAnoKCnoKHlXuKpI2et6OyxbTDzLvJyLXDuKKwqpOhqpGhq5Ciq46jrpGnl3uSk3iQmn+Xi3GKeGF5j3mOxbTD49Te0brJpYqhh2qIcFJxhmiHp4ekn4CdkHGQhGiEY0lkRi1GTjRLYkdYb1RhZkxYVjtITjNBTDI/UjhIUTxGdmxJmJdOlpRXqKGAnZCEfGtnfmhqfGRohGxxbVRcaU9Zf2Vwhm14YUlUYERRclBfjVxwpmuDu36XvYGaunyXuHyWelBiOiAuUjVEh11voGyCtXyTxIqhw4uhwoigs32Tq3uPtoaavIyhtYaauImduoygtYWZuYmdu5CjvpKmwpOmxparyZqtyp6vzaW0x6OwlHaDalFif2V4g2drcVRIbFA/blM8bVQ8PTg3Pzk3QTk4Qzo5RDk5QjE0QS0xRC8zSzQ5SzU6SDE5TDQ9UzxFTzpETzdETjNFSC1CUDVMZ0xlb1Zwb1ZtiXCBnYSPm4SKiXR3dGFkVUVHTT0/RjY2Pi4sPC0qPC0qQTUySkI9SkQ+SUQ+SEU+SEZARkQ+OjQwMy4qMiwpLysmLiklLiklLiklLikkMi0oPjk0Uk1JVlNOUEtHS0dCSkU/SkU9Tkc9VVA/XFZBYlxHZVxHZFlGYVVDWk0+U0c7TkM6Sj84TEI7XlBIpo99yamNsYpnpXtTnHVUkG5fbVNoVEJtVEFrTT1nVUd1Y1WIZVOMX0yGRDFnOilbTT1wSztzQzJvQi9zRTJ5SjeAVEGJW0mLY1OOY1WPZFaWT0F9QjNrRzV3TjiDZE2YVj+BSzRwTDdwUDx1UkF5U0J4VUF5WkV/VD5wcVlszrGk8NPFiW6SclSMZkp8WD1uVjxrUDlkWj9edUxSjVdEml4/m2NFjVUyiE0dk08ftnQ505tuwZSVo4GigGKMdFeJhGiQtp6cvaKHspV4zr6g5t7D6uPR6N/J5ty53cimzKyUuJGHn3qDjW2GjG+GmnmRl3GPj2mGnnqKvJuXw6SUv56Ox6iR0bOUzrGPyquJ0LOJyq2GrZB+j255g2R4hml9l3yQp4+iooudtKGx2cfU2MjUvqm4qZCipIqcrpKlsJSppYiflHeQknSNlXiSim2JdFd3dVl4jHGLt56zya7CqoymiWqKj26Sp4WqpISmh2aKb09yYUVlRi5KQChATzZKXUNQYUZSaU1ZXkJPX0ROalFWa1FbZlFVioRSo6VQq6lr2NG008mxloh4d2JigGhugGhuZUxUbFFaeV5ohWp2b1RgYkdSXUFOZkZThVtsrnuPqXGJpmB/yICewoifdE1dUDE/h1hrvH6Vv4CYwoCYxYObxYadsnmOqHSJtYSXu46hnniIqYGTu46huYuevZCkuZOktY6fsIeZwpaoyZyuyJ6vzqa1v5qokXWCgG16iXaFdmBqWkNEXkY/YEk8XUk9PTk3Pjk4QDo5QTo5Qjo5Qzg5QTM1Py0wPiouPiouPCcuPSgxSDM9TjdETjRFUDRKTzNJTDFJXEBZak5oZk1lfmV2l3+KiXN5g25ze2hsXUtPSjk6RDQyRTUwSDcxSDkzSkE8S0Q+SUQ+SEM+R0M+RkM+Q0E8OTMwNS8rMy4qMiwpMSsnMComMy0oPzo1Uk5KX1tXXVpVVlJNT0tGS0dBSUQ+SkQ9Ukw+W1VBd29aqJ6FnpF3f29XcWBLZ1ZCYE88V0g4TUA1ST05Sz89cV9Xqo56p4p0nHtoh2diZElgTThnTjxtUkNuUkVwbmKSfXClb1+dX0yNPStiOypaQzRlPzNlOytmRjR5ZFGaaVagbViidWKmcmKib2CeX1GQPC5pQTNsTTqAZlKfcl6oWkWLYUyOYUyMX02NWEmDXUx5Zk58aEt7dllns5eE79G0yaimc1SDak6FW0BvUjhkUjpmSzRfRStVSy5RVzhMaURNdkxNdUpFdEY6h1E5oW5bqH+LqYKmlHCXcVR+bk+GeFqHo4WEtph1p4VdqoZcw6SB3sqy5NW/39Ct4s2f4r+J4bV70Kd9tJOCsJWMv6SavqCXxKWWzrCX1rmY07iP0LSL1LeO2LyM07aKy62FzrGHtJWBf1xqe1h0fl55h2mCr5WqpoyjgGeDdFp2spyvxrDDqI+jl36Sn4OZspWusJOrnn+Zk3SOk3OPlHORh2eGb1FzaUtvYEFjc1NylXWRk3GRhmOHp4WquJa8nXuiclB4WTlgTjJUPidEQStDVz9QaE5ZYEVPak5YclVfgGZpmoJ8fWdibVpTk4tZq6tbtbFxu7SFta58hHhdY01PgGhvd19mY0tTa1BZZktUblNdel9qgGRwblFeX0NPaUlWkmh5q3SOpV9/rWiGxImgnG2AcUlap2uD0YqkyYSdxH2WxX+Xzomi0Y2ly4yjxY+jwZanu5movZqrvpipvJKkt42fnXmKmniIqYWWw5yuyp6yypywzJywrISVblNgg3F7tKKshXF7VkNJVEFDVEFAUkBBPTk4Pjo5Pzo5QDo5QTo5QTk5QTk6QDU3PzE0OyswMyEoMyApOicyTjZHWTxRWTxSVTpQSzBJUjZQZEljZkxkfWZ0l4GHh3F2gWxxgGxxcmBjW0pIdmRYhXNiYU9CW0k9UkY+SkM+SUM+RkI8RUE8REE8Qz87OzYyNi8sNC4rMy0pNS8qPzk1UU1IYF1YZWJcYV1XW1dSVlJLT0xFS0dBSUQ9TEU8VE09aWBMsaiP1syw18emxK6Kr5Vwj3dWdF9DZlI7WEc3Tj45Rjg8VEVNhm98jnSGclZuVjteSTBgRi9gTTpoVkZvYlSAfHChiHyycmOiVUSDPy9lPS5dQzZkQTZkPy9pXUyOemmrdGKkbFmcdmWncmSicmSgUEKAPi9tSDl5WkeQeGSyinfBcl6ibFeZZ1KSYlCObVuLqZao0ru6waKZz6+Y1bikrZGae2GMZEuFYUd/VT1pVT1jUThhTTVgRitWQyhRQilPRi1TSzBVSy9UTS9SbEpenXyHlHONiGKFiWSKe1uIcFKFclSEkHJ9s5Jzto9ntoVfqHROuI1h3L+Z1MKk0L+h3sSb3rV9165rz6tuy6yD0LWW0baU07eR07aQ0LSKzLODzrWD0raPzK+MyqyM1LeTw6aJkW91c09rcU5tdVZzjG+Js5ivnoSedFl7ZUptdVx6moCck3iUg2eCl3qVrZCrrI2pm3uXkG+Mj26LimmIeVh6Z0hrWjxfVzhbYEBjcU9yflt+pH+ltZK3p4WrgWCHWztkTi9WRyxOPCVCSzVLa1RfcFdfa1Bac1hhhWlvoYiCybOgkXxqdWBSlYhisKlqv7d1raVnoJlefG5PWUJIaVBbZk5XYklRaU5XYUVOZElTel9pj3R/fWFtZkpWYEFOckxbnmyBpm+HnWeAnW6Dkmh8lmN6rHCIyH6az4GfzX2cyHmYyXuZzIOfyYmixIyiw5OnxZ2vxKCwv5usvZSmu5CitY2fu5Snxp+yyaK0yJywyZSsz5ewxZGokGd6gGNxqpOfh3J8V0NMUUBHTz5BTDw/NC4sNzMxPjo5Pzs6Pzk5Pzg5Pzg4Pzc5QDc6PzQ5NScuMB4oNiMuRzBAX0NXXUBVTzNKSS1HTzJPX0NgY0hfkHl9sJ2WmoWHkXyBjXuBjXt+moV2w62R0byfkX1nZE8/Wkk+SkI9R0E8RUA6Qz46Qj46Q0A8RUE9QTw5Pjk1RUE8UEtGW1dSYV5YYV1XX1tVXVlSWlVOVVBKUEtETEdASkM9TEQ7Vks7aVxHr6GF18Wj072U1rqP17WGzat5tpZinn5RgGRGY09EX1BValttfGqKeGKJTDRhQSlXRSxeSTFhSzdkT0BqY1aDaV2NbF+WcWKhTDt6PjBlQTRiRztoTUFwXE2FcWGcfm+mh3asjXqyhHKscmOdZFiRSz16SDp4UEF/ZVOXfGm1j3zFcV6fYU2MY02MYEyFinSU6NHL//XU+9y40LOojnOMXkV/Tzd8UDl5V0B2W0Zob1p0XkhsTDNdUDNdSy9XQylQRCtRSjJWSTBWTTNWjHF7zbClyqmjuJOhon6dfl6HaEx7ak59hmaFrId5vpNtu4dhrntRqHdLuYtZzq57yb+eyMKr2MSd1bFn0KZTz6lpy7CDy7GEy7CEzLCKz7OMz7SHyq+EwKKJqYqDr5KMz7SgoIJ/flp8cExzcU9ydFV0m36ZtZmxk3iWZUpuWj9lUzddXEFme16CkHKVlXeWoYKhn4Cej2+Oj26Nh2WGfl1+fFt/bk5zUTNXUDBVWDddWzdeYz9miWKLnnmhmHObWThhSipUTjBWRSpMQClEa1ZkkXx/gmpwc1pheV5igWdnnYV6t6GItJ6GkXxtkn9sqJpyvbF5tKprnJFeeGVWYUdTYUZWY0tVZUxUZUtUaE1VZkxUc1hiinB5fGJrZ0xWY0RRcU5YnnR/qX2Kkmp6fV1vfFlulmV9ommDt3GOzX2d0X2gzXmcyneZzYCgyYiiyI6mxpKow5Knw5SpwZSnv5GkvY+jwJOoxJquwpesw5OpxY6nyI2n0JKu2Zu3z5WunXGEnXqKhml3WENNUT9ISztARzg8KiIiLCUkMiwrOjU1PTo5PTk4PTc4PTc4PTY5PzY6PjQ6NiYwNiIvRC09XUJVWj9TTDBHRitERSpEUjdSYEVakHVwuKCNoYyIloKEj32ElICEsZqGxayH0LmQoottaFE/X0s8TEE7Rj46RT05Qj04Qj05REA9SkdCUE1IU1BLWFVPW1hSW1dRWlZQW1dQW1ZQW1VNW1RLWlNJV1BGU0pCTUU9TEQ6VUg4YU86i3VXyq2Ay6Nuw49TyJhezKds06xp16xpzqJpro5woJGRj4KWd2eGWklsQC5TQi5WRS9ZSDJfRzVkSjppV0h3W018Vkh8UkN8PCxpPi9mQTRlTkJwW02Abl6We2uih3ipmou4uqTUp5DCeWicWUuBSz53STt0SzxxXU6FcWCed2iiZ1eQXEqCaVOFf2iLxKmu+t/L+93Fza2jiXKKVkR7Ri9yPiVhPSZgVD9vgnGGsaKpdWJ7RCxUSi1bTjBbWD1dX0Vcclhij3JyooN7yayW6M2r+du9yKeug2OFZkp0WD5rYkZ2j2yWpHx/soVirH9XrHxRpnRHjloronE4y7aEx8Whw7iRz6pq055M0KJcyal7x6qAy62Hy66PxqqKx6yJrpJ/iml1dFNvfF1yo4mKknaJfFyFbkx2dlZ7f2ODrJCrsJWuemF/WD1iVTpiUjVeSCtUVjdfd1h+hmiLj3CSnX6eimuLi2uMdlZ3clF0hmWKe1uBWTlfTi1VVjNbXThgaEFrdk96g1yFdE50Ty1XSCpVSCxSQCdHTzpMjnp9pJGPkHp9gWhsfWNkclhXl351tJ2I0rykt6GRlX9yjHhmk4Bli3pZc19PZk5TZUxWZUxZZU1XZ05WcVdefWRqdVxie2FokHd/fGVqYUhNa05Wg2FilG5ulnF0imhwfFtueFZsjGF5oGqEq2qHuXCQwneZyX2eyn+fuXWSpW2FsXyStIOYvY2hxJOowJClwpGlwY+lwYykwY+mw5Oqwo6mxYukzo6p1JSw1pey3Z24zZiuuYugfV1sWUFNUT1HRzg/QjU7JR8eJh8fJiAgLCYmNC8vOjc3Ozc4PDc4PDY5PTY6PzY8Oyw2NyMwQCo5Vz1QYkdZTTFGSC5DSC5FUDZQZEdff19pmX96mYSClH+AjXiCkXyBo4x/t594xqt8nIJjZU49W0c4TD84RT05RDw4Qjw4Qz46RkI+SkZDUU1IVVFMV1NNV1JMV1JLV1JLV1JLWVJLXVVIY1hIZVlIZVlJYldKWU9EUEY9UUM0Xkgzc1c7rIFUxYxTvHcyu3crtHoruIQ1zJhT26Zo1qp+s52SjICQaVt6TkBjQTFWQC9WQTBWQjBaQjFjQjFmRTZlVUZ0XEyAQTFnNSdbPi9jQDNnSTxwTj92T0F4UER4Ukl5a1+NloKykHqrb1uNTD1wSDlsRjdrRzhoYVOBbF+IZluDYFKDcWCKqJOozbOw4cSs79O5w6SidVd3WER2RjdxPixqOCNfPypjTztrd2iCraGqaVhxPSdPSi9bdFZwo4SErI+BtZiA0rKR3beR3rmR4cKhyq6mjG+MYkVyWT1qUztoXEBwi2SUk2p+lmdRm2tIpHJKqHhIk2EzgEsenXE3zrF00bZ/xZlc0ppS0p9fyKV+zKqMxaSLnoF3iG1rl3p5hWZya0ppbk1tgGN3jXWBfWOAclZ7bVB3e16Eim+Rpo2phm2IUDhWTzVYWDxiVThfUDNZTC9VSy5RYURnf2KEjXCQk3WVjW+RcFBzclJ2hGSJfF2CXj9lUTFYVzVdYDxla0RweFB/dVB8XDhfUDBZRy1WQypQQitJY05cl4J/loF9gmltd1xigWZogWdloYmCwKmez7ipw66fnoh9hW9lemNbbldRYUlLZUxRb1ZccVhia1NYemJij3Z3hm1wfGNpiXB0hW1ydFxfYUlLa05SoH9zqYdykXBkjWxrimh0i2p5kW2AlmqDlV18mFl7rG2OxISkx4imt3yXrnSMo2yCpXCFwouguomdp3uOsYOXv4yjwo2lwY2mt4iesYOZxI+owYqkvYeg0Zex2Z643ai/zpyxdlZkWD5LUD1GRjg/QDQ7IBwbIRwcIh0eJR4fKCEiMSwuOTY2Ozc5PDc6PTY6PzY8PjE6OCQxOyQzTzVGW0BSSi9DTTJHTjRLWT5b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QTkyYlZKfW1floh5rKSXvbqxsq+odHFsSkZDPDc1NC4rNS0oOjErQDcxRz83SkM8SEM8Pzw2NTMvMjAtMjAtMjEuMjAtKikmJiQiJSMhIiIgIB4dHBsaGRkYFxcVFBQSFBMTGBYWGBYWFRMTEhESERAPDw4ODgwMDAsMDAoLCgkJCgkJCgkJCggJCgkJCgkJCwkKDAoLDQsMDgwNEA0OEQ4PEw8RFRESFhIUEhAREQ8QEhESExITFRMUFhQVGBUWGRYYGxcZHBgbHRocHxwdIB0fIh4gIx8gJB8hJCAhJSAhJiIiKicnMCwtNzQ0PDk4Pzw7Pz08Pjs6PDk5OTc2NTIxMC4tLSopKicmKiclKSYkJiMhJiMhJSIhIh8eIR8dIB4cIB4dIB4cHx4cHh0cHh0cHh0bHRwbHBwaHBsZGhkYGBcXFxYVFRUUFBMSExEREhAQEA8ODw0NDg0MDQsMDAsLCwsKCwoKAwMDAwMDAwMDAwMDAwMDBAMDBAMDBAMDBAMDBAMDBAMEBAMEBQQEBQQEBQQEBQQEBgQFBgUFBgUFBwYGBwYGCQYHCQgIBgUGAwIDBAMDBAMEBAQEBQQEBQUFBgUFBgUGBwYGBwYGCAcHCQcICQgICwkJCwkKDAsKDQsMDgwMDw0NEA4OEQ8PExAQExEREhAQEhERFBMTFRQTFhUVFxYWGRcXGhkYGxkZHBoZHBoaHRsbHhwcHx0cHx0cIB0dIB4dIB4eIR8eIR8fISAfIiAfIiAfIiAfIh8fIR8fIR8eIR4eHx0dHx0cHhwcHRsaHBoaGhkYGRcXFxYWFhUUFRQUFBISExISEhEQERAQEA8PDw8ODw0ODQ0NDQwMDQwMDg0NDgwMDQsLDAoLDAoKCwoKCwoKCwoKDAoKDAoLDgsMDwwNEA4OEg8QFRESEQ8QDg0NEQ4PEhEQFRMTFxUWGxgYHxsbIR0eIx8gJiAhMCwsNzY1ODQzODQzOTQzOzYzPTYzOzAqPTAqRDgyZltTg3lvgHhwW1NPRD48PDU1LygpJyAhKyQhNCwmPzcvVEtCioB0sqyhs7CofXp0T0xIRkM/PDg2OTU0NzQxNjIvODIuOzUxPDcyNzQwMjAsMC8sMS8sMS8sMTAtLy8sKSglJiQiJSQhIiEgIB8dHBsaGRkYFxcVFBQSFBMTGBYWGBYWFRMTEhESERAPDw4ODgwMDAsMDAoLCgkJCgkJCgkJCggJCgkJCgkJCwkKDAoLDQsMDgwNEA0OEQ4PEg8RFRESFhIUExESEA8QEhERExETFBIUFhQUFxQWGBUXGRcYGxgZHBkbHhocHxwdIR0fIh4gIx8gJB8gJCAhJCAhJB8gJSEhJyQkLCkpNDEwPDo5PTs6OTc2MC0tKicmJyQjJiMhJSIgJSEgJCEgJCEfIyAeIiAeIh8dIR8dIB4dIB4cHx4cHx0cHh0bHh0bHRwbHRwbHBsaGxoZGRkXGBcWFhYVFBQUFBMSFBEREhAQEA8ODw0NDg0MDQsMDAsLCwsKCwoK"
  }
});
