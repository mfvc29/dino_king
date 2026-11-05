/**
 * Mini Quetzalcoatlus (Normal) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte de:
 *   assets/dinos/arte/normal/quetzalcoatlus_izq.webp
 *
 * Características del Quetzalcoatlus (azdárquido gigante):
 *   - Pterosaurio de cuello muy largo, cuerpo y alas gris azabache con franjas crema y ocre en forma de rayos.
 *   - Pico enorme, recto y sin dientes, verde lima con franjas oscuras; cresta alta verde y morada.
 *   - Plumón ocre en el pecho, garritas en la muñeca del ala y patitas de tres dedos.
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
  id: "mini_quetzalcoatlus",
  categoria: "mini dino",
  nombre: "Mini Quetzalcoatlus (Normal)",
  icono: "🦅",
  origen: "assets/dinos/arte/normal/quetzalcoatlus_izq.webp",

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

    const DY = -0.12;
    // Membranas de las alas
    alaMembrana({ ataque: [[0.09, 0.54, 0.08], [0.15, 0.57, 0.08], [0.36, 0.68, 0.11], [0.6, 0.7, 0.05], [1.0, 0.62, -0.09]], fuga: [[0.08, 0.38, -0.12], [0.25, 0.41000000000000003, -0.32], [0.55, 0.5, -0.36], [0.8, 0.57, -0.22], [1.0, 0.62, -0.1]], huesos: ["Brazo", "Antebrazo", "Mano"], cortes: [0.3, 0.58],
      imgAtaque: [[235, 190], [210, 130], [185, 55], [100, 30], [15, 10]], imgFuga: [[205, 235], [160, 215], [120, 160], [70, 80], [15, 12]], comba: 0.05, luz: 1.1 });
    // Garritas en la muñeca del ala
    LADOS.forEach((s) => {
      const w = V(s * 0.6, 0.82 + DY, 0.06);
      [-0.012, 0, 0.012].forEach((dy, k) => {
        const c = colgar("Mano" + L(s), punta([w.clone().add(V(0, dy, 0.02)), w.clone().add(V(-s * 0.005, dy + 0.012, 0.05)), w.clone().add(V(-s * 0.01, dy, 0.07))], 0.007, "GarraAla", 8, 6));
        pintarLuego(c, () => C_MARFIL);
      });
    });

    // Cresta alta verde y morada sobre la cabeza
    {
      const zc = 0.3;
      const q = lomo(zc, U_CABEZA, 1);
      const c = bloque(0, 0, 0, 0.013, 0.075, 0.05, 0.2, "Cresta", 14, 14);
      c.position.set(0, q.y + 0.045, zc - 0.035);
      c.rotation.x = -0.4;
      g.add(c);
      colgar("Cabeza", c);
      const C_V = new THREE.Color(0x8ac840), C_M = new THREE.Color(0x7a4a8a);
      pintarLuego(c, (i, p) => cTmp.copy(C_V).lerp(C_M, suave(q.y + 0.04, q.y + 0.1, p.y)));
    }
    // Plumón ocre en el pecho
    for (let k = 0; k < 10; k++) {
      const a = Math.PI * (0.25 + 0.5 * k / 9);
      const p0 = V(Math.cos(a) * 0.12, 0.5 - Math.sin(a) * 0.04, 0.05 + 0.02 * (k % 2));
      const p2 = p0.clone().add(V(Math.cos(a) * 0.03, -0.06, -0.02));
      pintarLuego(colgar("Pecho", M.tubo([p0, p0.clone().lerp(p2, 0.5), p2], 0.012, 0.002, { segLargo: 8, segRadio: 6, nombre: "Plumon" })), fijo(0xc8a050));
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
    "tipo": "bípedo",
    "brillo": 1.1,
    "luzMand": 1.05,
    "luzPatas": 1.15,
    "mandDesdeCabeza": null,
    "inclinacion": 0.45,
    "colorBase": 3816512,
    "iris": 16757818,
    "iris2": 10111488,
    "EJE": [[-0.42, 0.38, 0, 0, 0, 2.0],
      [-0.39, 0.38, 0.02, 0.02, 0.02, 2.0],
      [-0.34, 0.38, 0.03, 0.03, 0.03, 2.0],
      [-0.28, 0.38, 0.068, 0.065, 0.065, 2.1],
      [-0.22, 0.385, 0.108, 0.104, 0.104, 2.2],
      [-0.12, 0.4, 0.189, 0.195, 0.182, 2.4],
      [0.0, 0.42, 0.216, 0.221, 0.208, 2.5],
      [0.1, 0.46, 0.189, 0.195, 0.182, 2.4],
      [0.17, 0.58, 0.07, 0.07, 0.07, 2.2],
      [0.2, 0.7, 0.06, 0.06, 0.06, 2.2],
      [0.24, 0.81, 0.07, 0.07, 0.07, 2.2],
      [0.31, 0.86, 0.1, 0.1, 0.08, 2.5],
      [0.4, 0.85, 0.07, 0.075, 0.055, 2.4],
      [0.52, 0.83, 0.045, 0.05, 0.035, 2.3],
      [0.64, 0.81, 0.03, 0.035, 0.025, 2.2],
      [0.74, 0.795, 0.016, 0.02, 0.015, 2.1],
      [0.79, 0.79, 0, 0, 0, 2.0]],
    "IMG_EJE": [[175, 250, 2, 2],
      [180, 247, 4, 4],
      [185, 244, 6, 6],
      [190, 240, 9, 9],
      [195, 236, 13, 13],
      [210, 228, 25, 25],
      [230, 215, 30, 30],
      [252, 200, 28, 28],
      [275, 170, 12, 12],
      [295, 130, 11, 11],
      [315, 85, 11, 11],
      [340, 50, 14, 12],
      [370, 55, 11, 9],
      [410, 63, 8, 6],
      [450, 72, 6, 4],
      [480, 78, 4, 3],
      [495, 80, 2, 2]],
    "bultos": [[-0.1, 0, 0.08, 0.02, 1]],
    "HUESOS": {
    "Cadera": [0.4, -0.12],
    "Cola1": [0.38, -0.24],
    "Cola2": [0.38, -0.31],
    "Cola3": [0.38, -0.37],
    "Pecho": [0.46, 0.1],
    "Cuello1": [0.6, 0.17],
    "Cuello2": [0.74, 0.21],
    "Cabeza": [0.86, 0.3],
    "Mandibula": [0.82, 0.29]},
    "PATAS": [{
    "nombre": "PiernaTrasera",
    "trasera": true,
    "padre": "Cadera",
    "huesos": ["Muslo",
    "Pierna",
    "Pie"],
    "cortes": [0.42, 0.78],
    "camino": [[0.08, 0.38, -0.08],
      [0.11, 0.3, -0.08],
      [0.12, 0.178, -0.04],
      [0.12, 0.1, -0.07],
      [0.12, 0.05, -0.06]],
    "radios": [[0, 0.095],
      [0.3, 0.085],
      [0.55, 0.065],
      [0.8, 0.055],
      [1, 0.052]],
    "img": [[190, 255, 8, 8],
      [185, 275, 6, 6],
      [175, 290, 5, 5],
      [170, 300, 5, 5],
      [168, 305, 5, 5]],
    "pie": "terópodo",
    "largoDedo": 0.055}, {
    "nombre": "Ala",
    "trasera": false,
    "padre": "Pecho",
    "huesos": ["Brazo",
    "Antebrazo",
    "Mano"],
    "cortes": [0.3, 0.58],
    "camino": [[0.06, 0.52, 0.08],
      [0.15, 0.57, 0.09],
      [0.36, 0.68, 0.12],
      [0.6, 0.7, 0.06],
      [1.0, 0.62, -0.08]],
    "radios": [[0, 0.055],
      [0.3, 0.046],
      [0.55, 0.034],
      [0.75, 0.022],
      [1, 0.008]],
    "cupulaFinal": 0.04,
    "img": [[235, 190, 6, 6],
      [210, 130, 6, 6],
      [185, 55, 5, 5],
      [100, 30, 4, 4],
      [15, 10, 3, 3]],
    "pie": "ala"}],
    "MANDIBULA": [[0.28, 0.07, 0.026, 2.3],
      [0.38, 0.06, 0.024, 2.3],
      [0.48, 0.045, 0.02, 2.2],
      [0.58, 0.032, 0.016, 2.1],
      [0.68, 0.02, 0.012, 2.0],
      [0.74, 0.01, 0.007, 2.0],
      [0.775, 0, 0, 2.0]],
    "IMG_MAND": [[360, 75, 7, 7],
      [380, 85, 6, 6],
      [400, 97, 5, 5],
      [420, 110, 5, 5],
      [435, 125, 4, 4],
      [448, 138, 3, 3],
      [455, 145, 2, 2]],
    "DIENTES": {
    "sup": [],
    "inf": [],
    "largo": 0.02,
    "radio": 0.004,
    "ancho": 0.85},
    "paladarDesde": 11,
    "OJO": {
    "y": 0.9,
    "z": 0.31,
    "tam": 0.9,
    "frente": 0.3,
    "img": [332, 58]},
    "FOSAS": [[0.02, 0.85, 0.45, 0.006]],
    "oscuroParpado": 0.7,
    "rugir": {
    "pecho": -6,
    "cuello1": -10,
    "cuello2": -8,
    "cabeza": -10,
    "boca": 30},
    "alas": true,
    "mezcla": 0.12,
    "holguraBoca": -0.006,
    "nombreCorto": "Quetzalcoatlus",
    "DY": -0.12,
    "caracter": {
    "ojos": "decidido",
    "pose": {
    "Cuello1": [-6, 0, 0],
    "Cabeza": [-12, 0, 0]},
    "arquetipo": "altivo"}},

  textura: {
    w: 260, h: 160, k: 2,
    datos: "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"
  }
});
