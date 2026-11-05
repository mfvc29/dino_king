/**
 * Mini Pinacosaurus (Tierra) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte de:
 *   assets/dinos/arte/tierra/pinacosaurus_der.webp
 *
 * Pinacosaurus: Anquilosáurido amarillo mostaza con vientre crema, púas marfil y maza ósea en la cola.
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
  id: "mini_pinacosaurus",
  categoria: "mini dino",
  nombre: "Mini Pinacosaurus (Tierra)",
  icono: "🦕",
  origen: "assets/dinos/arte/tierra/pinacosaurus_der.webp",

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
      const C_PUA = new THREE.Color(0xf6f0da), C_ESC = PAL.lomo.clone().multiplyScalar(0.78);
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
      const C = new THREE.Color(0xf0e2b0);
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
    "nombreCorto": "Pinacosaurus",
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
    "lomo": 14201920,
    "panza": 16182992,
    "pico": 15786672,
    "patas": 14860892,
    "aleta": 11045418},
    "patron": {
    "tipo": "manchas",
    "color": "oscuro",
    "escala": 0.7},
    "caracter": {
    "ojos": "picaro",
    "mirar": [-0.6, 0],
    "pose": {
    "Cabeza": [0, -10, -10],
    "Mandibula": [6, 0, 0],
    "Cola3": [0, 25, 0]},
    "arquetipo": "picaro"}},

  textura: {
    w: 260, h: 165, k: 2,
    datos: "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"
  }
});
