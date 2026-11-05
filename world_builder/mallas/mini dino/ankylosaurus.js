/**
 * Mini Ankylosaurus (Tierra) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte de:
 *   assets/dinos/arte/tierra/ankylosaurus_izq.webp
 *
 * Características del Ankylosaurus ("lagarto acorazado"):
 *   - Anquilosáurido bajo y ancho color terracota con vientre crema (estilo liso chibi).
 *   - Coraza de escudos y púas cónicas por todo el lomo, púas en los flancos de la cola.
 *   - Gran maza ósea de dos lóbulos al final de la cola; cuernitos en la parte trasera de la cabeza.
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
  id: "mini_ankylosaurus",
  categoria: "mini dino",
  nombre: "Mini Ankylosaurus (Tierra)",
  icono: "🦕",
  origen: "assets/dinos/arte/tierra/ankylosaurus_izq.webp",

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
      const C_PUA = new THREE.Color(0xeed2a6), C_ESC = PAL.lomo.clone().multiplyScalar(0.78);
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
      const C = new THREE.Color(0xd8a07a);
      [-1, 1].forEach((s) => pintarLuego(colgar("Cola3", bloque(s * 0.045 * 1.45, yf + 0.005, zf + 0.03, 0.06 * 1.45, 0.05 * 1.45, 0.07 * 1.45, 0.3, "MazaCola", 18, 14)), () => C));
      pintarLuego(colgar("Cola3", bloque(0, yf + 0.005, zf - 0.02, 0.05 * 1.45, 0.045 * 1.45, 0.05 * 1.45, 0.3, "MazaCola", 14, 12)), () => C);
    }

    LADOS.forEach((s) => {
      const h = superficie(V(s * 1.5, 0.465, 0.45), V(-s, 0, 0)); if (!h) return;
      const b = h.p.clone();
      pintarLuego(colgar("Cabeza", punta([b, b.clone().add(V(s * 0.03, 0.03, -0.02)), b.clone().add(V(s * 0.05, 0.06, -0.05))], 0.02, "CuernoCabeza", 8, 10, 0.9)), fijo(0xeed2a6));
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
    "nombreCorto": "Ankylosaurus",
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
    "lomo": 13135946,
    "panza": 15914686,
    "pico": 15255720,
    "patas": 14191202,
    "aleta": 10111536},
    "patron": {
    "tipo": "manchas",
    "color": "oscuro",
    "escala": 0.8},
    "caracter": {
    "ojos": "molesto",
    "mirar": [0.8, 0],
    "pose": {
    "Cabeza": [4, -18, 0],
    "Cola1": [2, 0, 0]},
    "arquetipo": "grunon"}},

  textura: {
    w: 260, h: 136, k: 2,
    datos: "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4bib4bOW4LKU3q6Q3auM4KyN36yL4KSB5Jhu6p5z2Zdsv4BVw3lLxnZGvm9BvXFIzX1U3odd65Vq35lv1plv6rKM772a8sOg8MKayJBltGtGvGZHtVo8tVo8wGRHw2hMvGlKs2VBqGU/qG1Jyo1p66eD2JNvrWxMvnxdw3xcsGVEuGxLwoFcxoxnuH9brG5Op2lTqm9as3xluYJpuYJmt35hs3hbq29Tn2ZLk1tCiE84hks3klU9pWlGvIhex599yq+ZoYdzeWJQaFNDXks/W0g9XEk+X0tAX0tBXkpCYEtEYk9IZFJLaFZQZ1ZQU0M8RDUtQzQsQzMtQjMsQTIrPzErPzErPjErPjEsPjEsPjEsPjIsPjIsPTIsPTIsPTIsPTIrPTIrPTIrPTMrPjMrPTMrPTMrPTQsPzYvQDozRD44Rj86RT85RT44RT44Rj44Rj44Rj44Rjw4RTo2Qzg1PzQxOy8tNywqNighNysjPjMsRTkySTs0STszTDwyTTwyTjwyTzwyTzsxTjkvTTcvTDcvTDQvTDQuTDUwTjUwTTIsSy8mSi0kTC4nXz03eE9KdE1JbklAcUY5iE05lE83lU4woFo0snBHtXhWvIduv5SBuJJ9n3tqgWRWjXVlgWxbYU8/WUk5U0U5UUQ7UEQ8UEQ8UEM9UEM+TkA7SDgzQTIqPS8nOi0lNiojMychMCUfLSQeLCIeKyIdKiIdKiIdKiEeKiIeLCMgLSQhLiYhMScjMygkNislOCwnOS0nOi0nPjErQjUwRDYxRTcyRjkzSDo0Sj02TD43UD83VUE2WkEzYEIzaUg4iWBOq3pkqnZfo2dPo2tTpXBZoG5Uo3JTm2hGjFo5hFMyhVQ2nmtNvYVkvYFgnV5ChkYpk08yuGpKxHRQsmpHnFs8mVg8nVw+n109ol49ol08nlk6mlU2t29Q3JBoxHFEwm9BwG5BtGY8qmI5pF02pVs1pl03qWA6rGM7uG9A1o1d56B177mV8cur7MWk4KSF15l5xIdlsHNPr3VSu4xpz62H5MSe6MKf5bqZ47aW4rOU4bCT5LGS5bSS57CM6KR/245lx3dKwnBBwm8+xXZHy39RyX5T1IZf7J1y6p1x3JRr3Ztz7bSM7rmR7r6V8MOX77mN15RwwnRYvGlOt15Av2FBwWFDu2BBsV86qmI5rGlDvntYzYNfwHNSvHJUw3NRsmVCr2dHuXVUyJBt1KmK1bCVxZuDvI96xJuGz6qU0rGa06+U0KaK0J+EzpqBxpZ9v5F7soNuoW9cmWBKlFs9pnVPwJRy0a+T07ijuaGQfmhYY05AXko8Yk4/Z1NEaFRFZ1NGY09GZFBJZlNLZ1VOaFdRY1NOUkM8SjkxSTcvSDgvSDcvRzcvRjYvRjcvRTcwRTYwRDYwRDYwRDYvQzYvQzYvQzYvQjYvQjYuQzYuQjcuQjcuQjcuRDoySEE5S0U/S0U/SkM+SEI7R0E5R0A5R0A4Rz84Rz44Rz44Rjw4RTo1Qjg0PjQwOi8sNiwpMSYeMiUfMycgOS0lQzcvSTszSzwzTDwzTDwyTDsxTDoxSjgwSTcvSDYvSDUvSDUvSjUwSzYyTTcyTjYxSC8oRislUDMubkpGe1ZRdU5Gb0k7d0k3jU83llA1nVYyq2xCsHZRs4BfvY95sop2sYt4r499r5eCsZuFiHRhXUw8VEU2U0U6UkU8UUM8UUI8T0E7TT85TDw4SDgzQjMtQDEpPi8nOi0lNysjNSkjMyghMSchMCchMCYhMCYhMCYiMigjMykkNCslNywnOC0nOi4oOy0nPC4nQDMtQzcyRDYxRDYxRjcxRzgxSDkzTDs0UD41V0I2XkU2YEU1Y0U1g11NrH1srXlmo2dSoWVNqmxSpWxVoGpRom5Qm2dJlmBDjlo9iFU7iFY8lF1DkVU+hEUyiUcuqV9DxHBRu25HpGE7jVAvjlI0k1A1l04xplg4qFs7m1IzmE0tqVcvvmY5xG5Awmw/wmo9wGc3rl8zql42rF02q1w1rV00sWAzuWk6xndJ1Iph8bSS88Gf1J14y4Nfzo1twYNdwoJTuHhLpWg/qHFIvItk37SO7sWh5r2Z4LOR4rOV5bSV6LiT67mO359vyXtKx3JDx29BzXdJ04JV141fzodX1pJq5Z9335Ro2otf2Ytd45xt7K177bSC7Kx/7p5376yM6rqe2aqSx4tovXNMuWhGuGdFsmNAqWA8qmM/smxMt29Os2hKumxTwG1UvXFSvHlYwIJYwYZYyppw37+h2sKo1LWc1rih1rah1LKc1rOX0amL0KCEyZd8yJ2D1bCZ0rCayaeStox1onFVqXZUvIpmyp170rag1sCuqJB/alNFcVpJmoJtoIh0fWhWcFtKaVZIZlFIZlJLZVNMY1NMYFFMWk1HUUM+TD03STs1SDg0RzgzRzk0STo0Sjo0STs0STs0STs0SToySToySDszSDoySDsySDsySDsySDsyST01S0E5TkY/UElCT0hCTkdATUU/S0Q9S0Q8SkI7SkI6S0M6TEQ7S0M8S0I7ST85Qzg0PjQwOi8sNispKyIbLCIcLiMdMCUeNSghPzIrSDoySzw0Sz0zSzszSToxSDcwRjYvRTUvRTQvRTQvRjQxSTUxSjUyTjcySzMvRSwnSi4qYD86e1VPeVFKcUk9bUg2g005lVM7mFQ1n2I9rHdUtIRluoxyvJF4vZWCvJmGtZmFuaKMrpmEaVdGUkEzU0Q3VEU7UkM7UUI6UEA5TT44Sjs1Rzg1RDczQjUwQTMsQDIqPjAnPC4nOi0lOSwlNywmNysmNysmNywmOC0nOS0oOi4oOy4oOy4oPS8pQTQuRDgzRTo2RTg0RDYyRjYwRjcwSDgxTTsyUz4zWkE1YEY3aU49e11JhmVPqYFrs4RyqXJhpWdUpWhSqGhQmVxHl15ImWNImmVIll9BjFU4i1U6jVU8iEg0gD4ugT4ukUw1smVIr1o6p1o3oVw4kUwql08tpFEvq1IuuV44s1o0qFYxrV43tmM7tGE5umc9xGs9wmc4v2Y5t2I4s2A3sl85rlo0r1ksr1cnslsqvGY1y3ZG55Zm04xft25FxnlUw4Jgu31WwoNTtnZIp2c8p2k/pmtCr3pQ1qd87cCX47OL1KN936+O7LqT7Kt75I5Y24FM131M2n1L3n9M3YdW4phr6Kh72Jpy1pFp14tez31OzHZFzn1K1otX3plm6KJ16qJ37bWT9tC19tfC8da358ih5b+Y57KN6aKAynpbtGZHr2hJr2pLuXNUx4Bl1JB13qKE2qJ/zI9fwoBIwINNyplr2bSP276g17mf1bGY0qqS062S0aiMzZ6DyJd7xJt/yKyRzree0bagv5mCqXldsnxauIFcv4xnx6CG0bilxKyYkXVjr41z17eb3cWrv6eOgGlWb1lIaFNHZFFJY1FJYFBJW0xHVkhDUEQ/TD87STs4Rzk2Rzk2Rzk2STs4Sjw5Sj47Sj89Sj87Sj86Sj45Sj04Szw3Szs1TDs1TD01TT42TkE5T0U9UUc/UkhBUklBUUpBUUhAUEg/UEc/TkY9UEg9VE5CVlFFVU9FVU1EVEpCTkM8QjcyOjAsNi0p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"
  }
});
