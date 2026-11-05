/**
 * Mini Gojirasaurus (Viento) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte de:
 *   assets/dinos/arte/viento/gojirasaurus_der.webp
 *
 * Gojirasaurus: índigo con franjas doradas y vientre arena; fila de escamas doradas por el lomo.
 * Estilo liso chibi (referencia del usuario): colores planos del dibujo, vientre crema, ojos grandes.
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
  id: "mini_gojirasaurus",
  categoria: "mini dino",
  nombre: "Mini Gojirasaurus (Viento)",
  icono: "🦖",
  origen: "assets/dinos/arte/viento/gojirasaurus_der.webp",

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
      pintarLuego(c, fijo(0x2a2a6a));
    });

    // Fila de escamas/púas a lo largo del lomo
    pinchosDorsales({ n: 26, z0: -0.66, z1: 0.36, uMin: 0, uMax: U_CABEZA, nombre: "EscamaDorsal",
      alto: (t) => 0.022 * (0.6 + 0.4 * Math.sin(Math.PI * t)), radio: (t) => 0.013 * (0.6 + 0.4 * Math.sin(Math.PI * t)),
      inclina: -0.35, potencia: 0.8, color: () => cTmp.setHex(0xd8b040), });

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
    "brillo": 1.0,
    "luzMand": 1.15,
    "luzPatas": 1.15,
    "mandDesdeCabeza": [10.5, 15.5],
    "inclinacion": 0.35,
    "colorBase": 9071184,
    "iris": 16757818,
    "iris2": 10115584,
    "EJE": [[-0.8, 0.56, 0.0, 0.0, 0.0, 2.0],
      [-0.76, 0.56, 0.03, 0.032, 0.03, 2.0],
      [-0.64, 0.555, 0.06, 0.065, 0.06, 2.1],
      [-0.5, 0.555, 0.1, 0.11, 0.1, 2.2],
      [-0.35, 0.56, 0.15, 0.17, 0.15, 2.3],
      [-0.18, 0.565, 0.205, 0.235, 0.2, 2.4],
      [0.0, 0.575, 0.22, 0.25, 0.22, 2.5],
      [0.15, 0.6, 0.2, 0.23, 0.21, 2.4],
      [0.25, 0.68, 0.16, 0.17, 0.16, 2.3],
      [0.31, 0.77, 0.15, 0.155, 0.145, 2.3],
      [0.37, 0.85, 0.16, 0.16, 0.15, 2.4],
      [0.46, 0.91, 0.175, 0.17, 0.15, 2.6],
      [0.55, 0.905, 0.16, 0.155, 0.12, 2.6],
      [0.64, 0.88, 0.125, 0.125, 0.085, 2.5],
      [0.71, 0.865, 0.095, 0.1, 0.065, 2.4],
      [0.755, 0.855, 0.06, 0.065, 0.042, 2.2],
      [0.775, 0.85, 0.0, 0.0, 0.0, 2.0]],
    "IMG_EJE": [[3, 140, 3, 3],
      [31.5, 124.0, 6.5, 6.5],
      [60, 108, 10, 10],
      [95.0, 102.5, 14.0, 14.0],
      [130, 97, 18, 18],
      [195, 137, 55, 58],
      [255, 132, 62, 66],
      [315, 127, 56, 62],
      [350, 95, 44, 44],
      [362.5, 73.5, 37.0, 36.0],
      [375, 52, 30, 28],
      [420, 47, 26, 20],
      [445.0, 54.5, 24.0, 17.0],
      [470, 62, 22, 14],
      [485.0, 66.0, 17.0, 10.5],
      [495.5, 68.8, 13.5, 8.1],
      [500, 70, 12, 7]],
    "bultos": [[-0.16, 0, 0.13, 0.034, 1],
      [0.15, 0, 0.11, 0.014, 1],
      [0.46, 0.93, 0.08, 0.012, 1],
      [0.51, 1.01, 0.05, 0.016, 2],
      [0.44, 0.895, 0.06, 0.018, 1],
      [0.15, 0, 0.07, 0.012, 1]],
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
    "img": [[175, 240, 30, 30],
      [160, 280, 22, 22],
      [151, 310, 15, 15],
      [150, 328, 13, 13],
      [155, 338, 13, 13]],
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
    "img": [[290, 200, 9, 9],
      [310, 215, 7, 7],
      [330, 220, 6, 6],
      [360, 220, 6, 6],
      [380, 222, 6, 6]],
    "pie": "mano",
    "colorPie": [380, 222],
    "dedos": [[-0.55, 0.85, 0.95],
      [0.55, 1, 0.95]]}],
    "MANDIBULA": [[0.42, 0.105, 0.036, 2.3],
      [0.49, 0.112, 0.04, 2.4],
      [0.57, 0.105, 0.038, 2.4],
      [0.645, 0.088, 0.034, 2.3],
      [0.7, 0.07, 0.028, 2.2],
      [0.745, 0.043, 0.02, 2.1],
      [0.765, 0.0, 0.0, 2.0]],
    "IMG_MAND": [[430.0, 135.0, 12.0, 12.0],
      [438.3, 143.3, 11.3, 11.3],
      [446.7, 151.7, 10.7, 10.7],
      [455.0, 160.0, 10.0, 10.0],
      [463.3, 166.7, 8.7, 8.7],
      [471.7, 173.3, 7.3, 7.3],
      [480.0, 180.0, 6.0, 6.0]],
    "DIENTES": {
    "sup": [0.52, 0.54, 0.56, 0.58, 0.6, 0.6225, 0.645, 0.665, 0.685, 0.7025, 0.72, 0.735, 0.75],
    "inf": [0.54, 0.5625, 0.585, 0.6075, 0.63, 0.65, 0.67, 0.6875, 0.705, 0.72, 0.735],
    "largo": 0.022,
    "radio": 0.0072,
    "ancho": 0.86,
    "escalaSup": null,
    "escalaInf": null},
    "paladarDesde": 11,
    "OJO": {
    "y": 0.975,
    "z": 0.5,
    "tam": 1.0,
    "frente": 0.32,
    "img": [385, 57]},
    "FOSAS": [[0.03, 0.915, 0.745, 0.009]],
    "oscuroParpado": 0.7,
    "rugir": {
    "pecho": -6,
    "cuello1": -8,
    "cuello2": -6,
    "cabeza": -14,
    "boca": 34},
    "nombreCorto": "Gojirasaurus",
    "estilo": "liso",
    "paleta": {
    "lomo": 4868762,
    "panza": 15392434,
    "pico": 6639175,
    "patas": 5921448,
    "aleta": 14200896},
    "zigzag": {
    "base": -0.2,
    "amp": 0.0,
    "periodo": 1},
    "filasLiso": {
    "cabeza": 99,
    "cara": [99, 100],
    "pico": [99, 100]},
    "detalle": 1.3,
    "patron": {
    "tipo": "franjas",
    "color": 14200896,
    "escala": 1},
    "caracter": {
    "ojos": "sorprendido",
    "pose": {
    "Pecho": [-6, 0, 0],
    "Cabeza": [-4, 0, 0],
    "Mandibula": [16, 0, 0],
    "Brazo": [-42, 0, 18],
    "Antebrazo": [-25, 0, 0]},
    "arquetipo": "asombrado"}},

  textura: {
    w: 260, h: 164, k: 2,
    datos: "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sKqtfnl7Qz4+XFVRZVxWTkY+Qj0yPTwvOzwvOjswPDo0Qz48SUNAS0M+R0A5RUE6TkxFS0tFPDw4QUE+bW9igYNyZWRYRT85YFVMgHFminxujn1scF1TXU5UWk9eYFZwYVh8WlJ2WlFyYVd2Y1hybmJtfmlYd1w1fGZJfGpkfGhlh3Fpi3l0jYKJioaZf32WfHaRdGmCd2NwiGtRkG40gGU+gHFpcG19VFR6RUd0OzphRzlJYEImglgmtYNEoHhBmnpLnH1Se21lYWB7ZWKGd2+Cpolcw5pFrIM3i2IeimIoel1FYlZkZ2J6Yl99VlJ2YVZ6g21wvpNa1KJSvI9HfFkqVDgZalVPhnKIemZ3fW1+g32VhYSij46kiYeUeHN2eGlxhGtmgGA5h2EvhWREeml2f3ifenWbhHiMu6KLxKqOn5efoKXDn6bEcHSLgXRnqH1DuYc8jW5YX12UU16oPkuUN0aSMD6EJzRqKzBcMjNaNzZnNzVzPTlzcmFqwKBl47do4rFoyJlblXA3gV0jh10hZ0kaUDkYaFM2spZqtJNdroRKtItOt5BKuZRLvaRnwLKQcG14WVp6cm2NgHeggHije2mGkVdVoEs8okg5rFRAuWBIsmVK0p1+zpl9zJmFrHprcz0scTojczoncTQobjQscTQrayohYhsVZx0Ycyohdy0feywddygaeS0deSsfkzo1s11Um1NJZzcvUywnUDUwT0A8TEA9S0E+S0M/TkVAUEZBVElDVUlDVklDVUlEVElDUkhDUEhBT0hBTEZASkM9SkM9SkM9IiAlIyEmJCMpJSQqJyUvKCc0Kik3MC88RURTWVloX11tZF1ghHJOi3VDXlE+S0ZYSEZfR0NeSURaT0lXTEVST0dXT0dcSENcR0JeZ2F4fnqKZ2N2XltyXltzWFRuVVBtTEhjPzpXNzNRNzNTOTZUQz5XQj1QRD9MUk5gWVRtZmJ+bGiDb2yHfHWEhnJhlX9bdGNVaV1pXFVtXVlzXVJ0YFJmcFtLiGs8oINOjXhZd2togHqCkIyUhoOLZF1ffnVvkIeBbWRbRD0xU1JCZWhUVVZIPjw6Qz4+U0tJUkhCS0E4XFdPeHpzeHhzS0lISEdHdHVqenxwcnFuXlRScl1Mln9hqJRyqpNzhGpcX01YVEVeWUpuZFZ4bF90bF1zaVh2ZVdza2FufmlYgmNAc2FXcmlyhnmBkYGFiXqBg3WEeG+JbGqHcGuLdGeBf2xyiWtNhGAxcldOcGd8ZWqLUlaAQkVwOzxmOzVQVTsqckwcvYk6zJNCtotPhm9gXFpuVlp5amePgXSCs5BTyZxBuIo5k2okhWQ3aVtgbGeChIGebWyKZWKDcmmHlntqxJVSv41JhVkpZEMlZExChnR/h250fFZJfllJgG93gIGegoSifoGeY2SBb2SEgGx8e11IeVUvelxKeGiEdm6ecmqciniJqolypYl4hX6WlJjAlJnEcHOXc2Bdf1EhmGUndVVLXFuXV2KvMz6MMz6PN0KOJS9rGiJTGyBMLS5cPzttRjtxdWV1y7CB27Zyz6RhsIhLgF4oeVUgiF8oeFUjTj0mUUo9jXpbq5BkqoVPqXw+tIlFw5pUzKZpw6qAiH+AamiFbGeIcWmQa2SJZ2CBfFxpmVNLqVNFsVxEsV5Fr2dP0p+CyZp/y5yKlGBTajEpai8lbTAncTIpcTQqcjctcTIsbSkjbycgcSkgcSkadioafC8fey8fizstvmtj2o6Io2RdZjo0WTQwUjs3T0A9TEA9SkA+SkI/TURBUEdCU0pEVktFVEhDT0Q/TkQ/TUQ/Rz85Qjo0PjYxOjIsOjIsOjItIiAlIyAmJCIoJSQsJyYzKSc2NTNDSEZZV1ZoXFxtVlVrT0laZ1RDc1oxZ1Q1V01MUExeUk5jTkpeSUVUSEJPRj9OPzhLPDdLSERaZWFzd3SCe3iGdHGBZWJzZGJ0amd6Y2BzVlJoS0hgREBbOjVRNjJNODNOPjpTQkBcTEloVlNyWlZzZ2KBamRwe2tXgXFkbGFrdWuEYlh6Vk50Wk91ZldmfGNHk3U+lntLeGNVZFljZWByamd6Z2Z5bmZvhHVsl4d1koFna11EcW9Xf4Nrc3VmTktPVlBWgXl3em5kdGVRk4duj4l5h4J6ZWJpVFJlYmBwamd5b2uAa15lfWJOmHlVtp1tqI9nc15WXUxpWEdwY1BvhG51gW5jZFNVX09qcmeEcGhxhXFVi3RWcGZubWh8iX2Nn46ZkoGIemp5bmOAZGB/Xld7cWN+loOEl4F0el9YbFVraWCIV1mHTlB/VFSBPj9uOzZYVTwsc04ZxZVD1J5PpH9ebl5yVlV0XF+EbWmNjXl0vZNMyJhAsYI0lWwteWJQa2V8kI2rl5SxbWqHdHGOhnyNoIBdwpVOmWs0Zj0fcVhOhnWAj3uEflpMe0stek0yfmhnf3+bbHGRaGyNXWCEZWGHd2VzeltEb08qbFJBa2GCZWOaZWCUlYKOqYZvinFwa2WNb3KhbHCgVViIVEhdakUsfU8ea05BWlqQVV+oND2JLzeFMzmHJClvHCFaHiNSMzZhSEZsU0tueWlzsZJkuI5PqX5BlW41f1wof1onjmYxgl4xTEAyRENBZ11OnYlnl3tPmXI+qIA/r4hDtJFduJ51oJODdW19Z19/ZFyCYlt+cGuJfXCCl2Bar1pFtV1Cql1Ft3Vf1aCGy5Z8wZB+gk5DZy4mZiwjZysiaiwibzEkcTMnbi8kdC8lfzcqeDAjcSgbdiobgTYlfzQjkUY20Il53puOoGtiZ0A6XDw4VUA9UUE/TUE/SkFASkFAS0NBSkE9Rjs3RDo2QDYxOjEsOjEsOTEsODAqNi4pNi8pNi4pNi4pNi4pIiAmIyAmJSMqJyUxKCY0MzBCTEleWFVrU1FlTkxiRkRhQj1YVUlKZE82aFM1U0c9QTtGPTpIOjZFMi05MCo3MCo4Lig5Lys8NjNDPjxKT01YWlhjVlRgWlhmZ2Rzb2x6eHaCc3B9Z2VzW1hoTElcSERaPjlVPzpXPDlWPDhXQz5dR0BhUUlrWVJiXVRTYltpbmmFe3ORcGSGaVyDZVx7b2BmhWxOinBLcltLXktXXFFpV1NsUVFqUlJrZl1shG5eo4hcvqJupItfe25TdnNscG56YVx2dXCElY2Po5R+u6Z8yLOFtKB9j39tY1xqUlBvT0xtUExuWFNxXFFYa04zlW9DtpZkmYJiaV9pUUhxVkhvcltlknFZgmdHaFZSbWJ7e3iUdnN7fm9lfnFybWmEZ2OAe3GGj3+TeWp/bF96amCDZl6FW1F4XlF1inuOk4SMgnGHalyCWVWJR0mAP0NzTk9/Pj9xPztgXUQyhF0jxJdLto1WgW12YleBXluDY2WMcmyEooNix5lNyZlFtopAlnRJb2JuYl59dHKQgH2bfHqYhoKfjX2Em3RKm280c0gacVA4gHV+jYOXfmhmdUwvek4wgF9Phnd/fn+caW2QYmWJXWGGZF99e2FagVs8cFAzX0tLVlR/VVuVYGGSh3eBlHZge2x9W1mLUVOFREl7OjxzS0d6ZlJfcU8yZ047TU54QkqKOUCDNT2FMjh/Ky5vMDJmSUhsW1h0dm19mIuNm4NtnHU5nnEtmmwrmG8ynXlFp4JQroZTmnpQVEpAPz0+S0hEe29YnYppmH9YoH9Ju5lZza54wKl3vKuJgHN6XlR1X1l9cGqOjYimlo2hpXhwumlQvmZMrWFJvX9m0ZZ90ZZ7tX9rcToxYCcfXyYaaS8hczgodjwofUItezoofDIglEk3kEY3fDImeS8jhz0ufDMji0g1zJV+0p2KhVxRZUM8XEE8V0NBU0NBT0NCTENCS0NCRTw5PTEtOS4qNy0pNi4pNi0oNS0oNCwoNC0oNC0oMywoMywnMywnMiwnIyAmJiMrKCYxKCYzMS8/SUZbVlJqUU1nSkdiQ0BbQj9cREFfS0ZUUkU9TD0wPDEuMisvLSgxKiYxKiUwKCMvKCMwLCY1Lys6Ly06MzI9OTg/PDtCPTxEQD9IQkBLREJNVFJeaGZxcW95cnF6c3F8bmt6VFFmS0hhRUJfPDhYPDRVQDdWRTpcSEBZSkZZTU1lWVh1amR/d2yIhHePe3J6fGdZgGVLbldLWERNTjxTSTxNTENSQEBaR0loWExeblM3q4hIxKNkjG9AY080dGx2Z2KEW1V8bmqHk42TloVtt51tzLB6m4Bacl1QU0pfQkBmPjpgNzNaQDlYX01Ge10sqoNHrYpaiXdtZWN6VVR1XVFsfmVcoXxWlHhgem52bmeEY2KAeHSFdWd3cGV+ameKYF2Aa2OAbGKBYlt+XlZ8WlF4WE94UkhxUUV0YleIcGeQb2eOc3CZXl+PPkF1NThrOjtuPD1yRkJoalE6nnU1s4hCi25QcGeFY16LY2GJaWqLf3N2p4NOy5tLyJlFrYU/iW9acWh/fHubbWyMd3SThIGgioeji3RwjmI5eUocaDwWdV5Rg4SVh4STaVFGcE0zhmlfkoOOioWcf4CghIesbXCZWFuGa2B1hmRMg1w+aE5MUEZtTEyGTlWSYGOUiXuGmoFxgnmSXV+UQEV7O0F1QER/VFSXa2KSaVVcWklBQUBmLzVxOkN9QEyJPkeGPT96WlV7pJmZvKiXxaqQxqqMpIFTlWsqkGcem3IsqIJEvZ5wzrCF0rGFqI9wWlNRQkFEQD9CZ2BXlYZukHhak3NLsJFcya9ytZtavqVthXVwVU9rXlyBcW6Ti4WkqZebxZt8yodlxnddunBVvHlfyoRrzIpuqG5aYi0nVyAaajAmik08pWtTtHtgrW9VnlhCiz4qmko3pVlHkEo7gT0xhkAyezUkkFQ/x5Z/vI97eldKYUM7W0Q/WEZEVUZEUUVFUEZGSkFBPTEuOC0pOC0pNi0oMysoMiomMSklLyklLiglLickLicjLScjLScjLScjKCUtLCkzKyk1Mi8/RkJYT0xiT0tlS0ZmR0NjREFcREFbQj9XODVBMywuMSgmMScmLygrLCYuKyYvLSkyLys0MCs2NjE8OjVANzM+ODU+ODY9ODY9ODc+NzY+NjU9NDM8MzI7PDpDUE5Yamlzf3yIhoSQfHuKcXCAW1puR0NdUkpiUUZXPDBFOzNLR0NdREJeREBdT0dkZl11fnR9fm1ejG1LhmhQd2ZnYU1jUjtLZU9Ca1hMUUtfTktrXlFVg2c4t5BImXM0Y0ceXks+UUloTUl4T0l4WFR+c2+AbltEpoNNsopWdVU6Xk5SSkVlRUFrSUNyQTxmSj5Tclo/jWszonpDjWxIemx2cm2MZ2KBaVtpg2RMjG1PeGhmc26Da2eHZWGFcWmLdWiJaV6AX1l7XVd6XlV4XVN3XlZ9WlF7UkhyTkRuSD9rTEJyVU1+bGeYeXeoamqbVlaJPj91MjNqODhvP0B2R0Nrd15FrIQ+oHg7fmdbaWeJZGOMbGuQd3aUi3t0p4NGyZ9LvZREmHZBgm9wc2iAeHSQeHWTc3GPhYKhk46nhWtfg1YtfUofcUQkdGNgdnuNfX+Na1padF5ei32LkIyoenubc3aZbG+WV1mIWFmNZl12eFxIcVRHTkVkRkR/S0uNSE2JamqalISKsJN2kYaVYWSYPUR9Nj50Vl6ZY2awZ2OnZVyIVEhgPjlnMDJsPkN2Q0+DPkuISEmIcmmK0L6p682e4bl+xJ1njGMxflMdlW0xs45RtZdnvqqMx7KUvamMiH1vWVZYTktQQ0NJVlFRjX1qnIJkfVs0h2c4qY5Up4xGuJ1Wi3lkUU1iWVd8ZmOFcmZ5qIpvzaV0zp1yx4hnx4JlwnZazHxhyoJlnWBMWisjVSgfbzcrjUc2uXlf2pyAzYZsuG5WpFlEo1I+tGtXsHBdjVFDfT4vdjIfm2BLzp6MpHlpa0s/X0Q7XEZCWkhGV0hHVUhIU0lKRjo4OS0pOCwoNisnMSklLickLSYjKyUiKiQhKiMgKSMgKCMgKSMgKCMgKCMg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"
  }
});
