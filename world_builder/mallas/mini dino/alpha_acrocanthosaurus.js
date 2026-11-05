/**
 * Mini Alpha Acrocanthosaurus (Fuego) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte de:
 *   assets/dinos/arte/fuego/alpha_acrocanthosaurus_der.webp
 *
 * Características del Alpha Acrocanthosaurus (forma alfa del Acrocanthosaurus):
 *   - Piel gris oliva con una gran franja magenta brillante por el lomo, la nuca y la cabeza, con vetas blancas.
 *   - Hilera de púas altas y afiladas a lo largo de toda la espalda.
 *   - Cabeza enorme con boca muy grande, cejas óseas y ojos celestes.
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
  id: "mini_alpha_acrocanthosaurus",
  categoria: "mini dino",
  nombre: "Mini Alpha Acrocanthosaurus (Fuego)",
  icono: "🦖",
  origen: "assets/dinos/arte/fuego/alpha_acrocanthosaurus_der.webp",

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
      const c = colgar("Cabeza", punta([base, base.clone().add(V(s * 0.006, 0.024 * 0.6, -0.004)), base.clone().add(V(s * 0.01, 0.024, -0.012))],
        0.02 * 1.0, "CejaOsea", 10, 10, 0.7));
      pintarLuego(c, fijo(0x8a2a5a));
    });

    // Hilera de púas altas por toda la espalda
    pinchosDorsales({ n: 30, z0: -0.62, z1: 0.42, uMin: 0, uMax: U_CABEZA, nombre: "PuaDorsal",
      alto: (t) => 0.02 + 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.15)), radio: (t) => 0.009 + 0.006 * Math.sin(Math.PI * t),
      inclina: -0.3, potencia: 1, color: () => cTmp.setHex(0xe8d6e2) });

    // ---- Detalle extra: escamas laterales, placas ventrales y pómulos ----
    LADOS.forEach((s) => pinchosDorsales({
      n: 16, z0: -0.5, z1: 0.3, x: s * 0.075, uMin: 0, uMax: U_CUELLO, nombre: "EscamaLateral",
      alto: (t) => 0.012 + 0.008 * Math.sin(Math.PI * t), radio: (t) => 0.012 + 0.006 * Math.sin(Math.PI * t),
      inclina: -0.15, potencia: 0.45, color: (i, p) => colorCuerpo(filaEnZ(p.z, 0, U_CABEZA), 0.85, cTmp).multiplyScalar(0.82) }));
    {
      const C_PLACA = null;
      for (let k = 0; k < 9; k++) {
        const z = -0.08 + k * 0.045;
        const r = filaEnZ(z, 0.1, U_CUELLO);
        const arco = [];
        for (let c = -6; c <= 6; c++) {
          const col = (c + COLS) % COLS;
          arco.push(vCuerpo(r, col).add(V(0, -0.002, 0)));
        }
        const cen = filaInfo[r];
        arco.forEach((q) => { const d = V(q.x, q.y - cen.y, 0).normalize(); q.addScaledVector(d, 0.002); });
        const b = M.tubo(arco, 0.0055, 0.0055, { segLargo: 24, segRadio: 8, nombre: "PlacaVentral" });
        g.add(b); colgar(huesoEnU(cen.u), b);
        pintarLuego(b, (i, p) => (C_PLACA ? cTmp.copy(C_PLACA) : colorCuerpo(r, -1, cTmp).multiplyScalar(0.86)));
      }
    }
    LADOS.forEach((s) => {
      const h = superficie(V(s * 1.5, P.OJO.y - 0.075, P.OJO.z - 0.04), V(-s, 0, 0));
      if (!h) return;
      const b = colgar("Cabeza", bloque(h.p.x - s * 0.006, h.p.y, h.p.z, 0.022, 0.016, 0.03, 0.4, "Pomulo", 12, 10));
      pintarLuego(b, (i, p) => colorCuerpo(filaEnZ(p.z, U_CUELLO, 1), 0.2, cTmp).multiplyScalar(0.9));
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
    "tipo": "bípedo",
    "brillo": 1.0,
    "luzMand": 1.15,
    "luzPatas": 1.15,
    "mandDesdeCabeza": [10.5, 15.5],
    "inclinacion": 0.35,
    "colorBase": 8026722,
    "iris": 10475775,
    "iris2": 2779816,
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
    "IMG_EJE": [[3, 95, 3, 3],
      [31.5, 82.5, 6.5, 6.5],
      [60, 70, 10, 10],
      [95.0, 71.0, 15.0, 15.0],
      [130, 72, 20, 20],
      [195, 118, 52, 55],
      [260, 112, 66, 70],
      [320, 108, 60, 66],
      [365, 92, 44, 44],
      [380.0, 82.0, 39.0, 39.0],
      [395, 72, 34, 34],
      [425, 72, 30, 26],
      [446.5, 83.5, 28.0, 23.0],
      [468, 95, 26, 20],
      [484.0, 104.0, 19.5, 15.5],
      [495.2, 110.3, 15.0, 12.4],
      [500, 113, 13, 11]],
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
    "img": [[200, 215, 28, 28],
      [182, 250, 20, 20],
      [176, 280, 14, 14],
      [180, 300, 12, 12],
      [185, 310, 12, 12]],
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
      [0.157, 0.515, 0.235],
      [0.153, 0.545, 0.28],
      [0.151, 0.557, 0.294]],
    "radios": [[0, 0.056],
      [0.35, 0.046],
      [0.7, 0.036],
      [1, 0.033]],
    "img": [[290, 185, 9, 9],
      [300, 205, 7, 7],
      [310, 215, 6, 6],
      [325, 218, 6, 6],
      [330, 218, 6, 6]],
    "pie": "mano",
    "colorPie": [330, 218],
    "dedos": [[-0.55, 0.85, 0.95],
      [0.55, 1, 0.95]]}],
    "MANDIBULA": [[0.42, 0.105, 0.036, 2.3],
      [0.49, 0.112, 0.04, 2.4],
      [0.57, 0.105, 0.038, 2.4],
      [0.645, 0.088, 0.034, 2.3],
      [0.7, 0.07, 0.028, 2.2],
      [0.745, 0.043, 0.02, 2.1],
      [0.765, 0.0, 0.0, 2.0]],
    "IMG_MAND": [[412.0, 160.0, 12.0, 12.0],
      [416.3, 175.0, 11.3, 11.3],
      [420.7, 190.0, 10.7, 10.7],
      [425.0, 205.0, 10.0, 10.0],
      [430.0, 218.3, 9.0, 9.0],
      [435.0, 231.7, 8.0, 8.0],
      [440.0, 245.0, 7.0, 7.0]],
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
    "img": [405, 88]},
    "FOSAS": [[0.03, 0.915, 0.745, 0.009]],
    "oscuroParpado": 0.7,
    "rugir": {
    "pecho": -6,
    "cuello1": -8,
    "cuello2": -6,
    "cabeza": -14,
    "boca": 34},
    "nombreCorto": "AlphaAcrocanthosaurus",
    "detalle": 1.6,
    "caracter": {
    "ojos": "picaro",
    "mirar": [0.6, 0.4],
    "pose": {
    "Pecho": [-6, 0, 0],
    "Cabeza": [-12, 10, 8],
    "Mandibula": [6, 0, 0],
    "BrazoI": [-40, 0, 0],
    "AntebrazoI": [-45, 0, 0],
    "Cola2": [0, -14, 0]},
    "arquetipo": "presumido"}},

  textura: {
    w: 260, h: 163, k: 2,
    datos: "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vXmHt4iNsYmLtYmPzZml2JqrwXKQrGeDx52vxrC6sJ6mqY6YqYOSs4mXu5KdwpihuomOpnx8uJCQyqinzaan06Gm0JKczoaUyHmJvG5+oFlomllon15vnVltoVhusVFwvTNm0CJj2zV650KT9T+g8jWRxihphhY9aA8rZREtfyA/miRKoyVMpyxQkipHeSk+cy0+YCs4Vio1VC02US82UTM4Sy0zPBslNBYfLhYdKRQaJxMZKikmKikmKiglMC4sREE+TkpITUtITUlGTElFS0lES0hDTUlDVVFIXFdNXFhMXVlMZWFTdG9gfXlogHxsfXhoaGNTYFxLYFtJamRUbmdZYFhMdW1idW1geXNkeXNjeHNje3ZmhoBxdW9gbGdXamRUa2VVaGFSa2RUbWdXbWhXeHNidnBgZmBQb2lZdW5ec21dd3FieHBihH1uiIRzeHJiZ2FRbGRWfndqlIt/kIV6bWNYYFdLXVRIY1lLb2RaoZKWwpqttVB4uzpsxzxxxz1xukJxpkpvr22GwZ6qsouZvHCPvkR1vilk0TNx0Spr0Choxy5psCheqCpcrjlnpjRemSZQoCdUqy1drS1epyhZpilarCdbuClhuilhvCphwiliyihj0yhn2S1s2TZy0UZ5vWmIzbO/3c/ax36b1DNuzzNsvGGC2rfAu6yof3Bja1tKallKaFlLaltNqHh6wlh415KqxauwcGFZXFBEWU09YFREYVVIp5qX5avD30aG6DuG5WCZ3IWmuH6NtGB631CH5nyp3K/CrJmaZVJLZVdQrJiZv5Ggw0Z04y5y6yNt7iNu8S107C1y4ilt3C1u1DFtzjNs2z135lyQ5Hae1XCVy2WJxmKDxGiH1GuO02SJxGKCxWaEw2aDv2mExnSN1Ymg0IqfyYmbyY+eyo6e2JSo3JGm2YmfxHKJrmV5sGx9sW18vHSDs3mEtH2HxYCO2IOY3oaeq1twgCtBgy5EjUNUm1tpkVhjoGdys3uGpG94qXh+sIWFl3dqmX5qwqaYzpykvHCDzYmYsm58uHF/tYWKq4KEuo6TzJyj156qzIGbrGaBsnyQvpuou5mms4aXr4GSuoyavpagw5efrnyBoXZ2tY6NupeVrY2Jon99qXx+voWKyYON0oeSx3mHum99pWRwmldnuGt/xXCJoz5frSFRvhxTzSVn7DaM90SZ6EOIvSlgmB5Jfhw9iSBCmSFGoyNKqytRnyhLfylBdy9DaS49WSo2Viw2Uy42UTE4UDI4RCMsNxghMRceLRUcKhUbKiklLConMi8tQj48TEhGS0hFS0hES0dES0dDS0hCTktDVVBGWlVKXVhNYl1QZmJScWxbfHdngHxrenZmbWhYYlxNYFpLYVtLeHJkfXZpZl5RdGxfb2haamNUaGJSWFNEWFNDYFtLV1JCUUw8UUw8Ukw8XFVFWFFBU009XFZGXVdHW1REV1FBYVtLbGVVcWtbcWpZcmxbhX9ukot6fnlneHNifHZmfXdmfXdmeHFhbWdWbGZWZl9RZVtLd2Jbp3KDvmKIvEx4sDtot0dytlx/uH2VwZ2tsJigin17mICFvJGksVN6xi1q1i5z1ypv2i9z0zRyui1lpzplt26LtGqGo0pqqUVrrzJhtiheryRarCJZvydizCppwCtmvSxkyytn2S1r2Cxq1yxp30V61GqOpnWFkIaJp46ZuWqHxD1twWCD4LzLx7S3gnFpbmBPalxIYlVDYVREa1pMo3V3zH6Qz52pmIN/YVdJXVVDWU48WU89W1FChnhx66u/9FyX8UyP4F+St2eBkVxks0ts6Hil26C6l3l9a15TY1JGf3JqzMPB06i32FCC5S1y5ihv5ypx4CZq0TNt3GqX4pC04Zm82muZ3Ud+4GSTy2KIv1l9xGOEynyX0pGp13ya2GmN1G2Ox2qHwWqGyXWP1YGb0YSbxH+SuHqJu4GQxoyb0I+fzYiZu3eGqmd3rGl3q2x3qWp1s3aAqXJ5n2pwsXB61YKUwHWEfDtGcy08fTpIiE1Xll9qlF5oo254qnZ/oXR3oXl5kG5mjnNhr5d9yK+Xz6CjuWx+wniIwHWExHWGrHR9p3h8qYSBrY6IvpSVx46buoeYtoeauYCUun2Tr3qMs4CRvIuay620zJ6mrnh9s4eHvJWTqIWCc1xUVEE4Yk1EgGJcl3Rws4KDx4qRwX+JtXJ8p2Vwq2Z0vXWHk0ddjiZHtR9RyiFe5Ct36zB96i536C1x0y9otylZoCFLoh1IsRpLsCBNpSJKiChFezBGczFDYCw5WCs2Vi42Uy82UjE3SywyPRwlNBggMBceLRYdMjAsOzg1RUE+SERCSUVCSUVCSUVCSUZCSUZBTEhAUU1DVlJGXVhMZ2JVbmpZa2dWcWxcgHtrg39ubmlZb2pacm1ebGdXXllJZFxPZ19SVE0/VExAVE1AUEo8Ukw+UEo8T0k6Tkg5SkU1SkQ0TEc2U0w8VE09T0g4TUY2Uks7U0s7Uko6UEk5VU0+X1hHamNSamNSZFxKZ2BNdGxacmxab2lYfnlofXhmgnpphHxsl45/jIZ1c3BfeXBfiGxosGJ9xVSAvk96rVh5uH6WsIOUrYyXqpKXemhmX1FJkXx8wJ+pvF+C0C1u2iZu2Cpu2DR0xTVstkp0t3eTy627yqm3u4ydu3+WpzVgwCNewSJfySZk0y1syTVuuVZ/xnaaxEx62TZy1StpyTZp222SunGGfmJoXlRTh2BruV18wU920Z6x2svRppWVcmNXaFpHZlhDX1M/X1JCa1xOn4J95sPHu52daFhPY1ZHX1RDYVZEX1NBWU49cWFW3Kmw63Sby1R+q1t0kGpunXZ6ynKS4p27qYWOYFpMWFRAX1BBd2xk1tLQ37nJ3FuN7DyA6zR54DN01FCB1Iyq3L7N1L/N4cja4IOq3kh/zFF/xFuB0HGT05at17jE0q670IKb13WU0nGQznSPz3qV0n6Y14Gb2oSd0oGXxHmMvXmJyIeWyImXtnyInmhxm2ZuqG93qW51omlwnGtvg11cgVZUq21yyYGJo2psbz5Acj9Cd0ZIjVxhmGRsj1pjmmhxm21zlHJviGljel5QlH9lsKB9wKuP1a+t1JqkunmEvG1+1X+Tvn2Jrnl/ooF6m4h4oYx+qIeGwaOqzbnCyKi2wZOlrn6OuYiYv5WiyKqwzZWfvH2EsX6Bv5SUsIWEclVPTTsxSj0wWk5CYlVJel9Ylm5tq3+AvIiLx4mQvn6Jr298j1JghTRMqCNPxyFe3yt14CZv2yZj3zNo2zBnzi1lqiBQnRtHnRhEnhxFniFIkCVGfCxEeC9Fai0+XCo3Vyw2VC02Ui82Ty81QyMsORojNBkgMRgfQT47REE+RkI/R0M/R0M/SENASERASUVASkY+TUo/Uk5CW1ZKa2ZYcGtcdG9eeHNif3pqh4Jzh4JyaWRUZ2JSYFtLVVBBTkg6Rj8yRj8ySkQ2SEE0SkI2UEk7TEY3T0g5T0c5UEg5VEs7U0s7WFA/XVZEXVVEZV5NYVpKYFhIX1dIU0s7VU0+U0s8VU09WlJBXlZDXVVDXVVCW1NAWVNCWlRDc2xbcGpZdm9dfnZkn5aFiYRwe3pljYZzf2hisXGEzXyaxH6YwZ2spYyUgGhsdmRidmZfZFhMY1ZLnImJxJuox1J91iht2iVu1ytuxDRrsFh5wZOmzrbCyLnAxLe7zr/EwJipqjRixiFh1CJm2ixtxzNovlh7zqW23sbVvmmMzjpy0TVu0m+SrHeHf1xgZ1dUXE9KfVtgtmZ/x22LyaCtloCCgW9pcmNVbV5LbV9LbGBMbWBOcmVVf3BkvKynp5WQYFdKZVxLX1VCW1A9WEw6VEs4d21d4M7I1aaugFZeZlNMenBjzb2578rawp+qcV5WUks5XlNAXE0/f3Zv3NLVyoyn20mE7kCF3Tp52V+N36S6vqiuq5ufzbzE3rnL1V6J3kl/01WCzmmN1Iul1am60bjAwJaixXqQxnCLxnKM0n6Y0YCZ1oSc3YWe4IKd44Oe3oKa1YOXxoGRqm97i1tjeE9Th1xfpnF2qXN3l2lqfFtXWkc+fFVRvHp9un99hF5UZEc9c1VNfllVr4KDp3Z7jllhkGJpkGtrkHhuhW5gjnlirZ59tKiBvKmNy6ihyouTwXKBxnGF24GYxn6NtnuFoIF3lYdxlop0mId3oo2JnY2OpJCUon+Ip3qGxJWivpqjv5qg0JOd0IiTyouRz5udu4eJiGBdZ0tEY05EYFNHXVFDZFFHg2ZgnH55royHypudyouVzoaTmWBreD1LnS1Ruh1VzyZn0ytryidhxiRbzSBb1TBrwzBltyhanR9Kix1AkSBEkSBFgCRBdCk/bik9Yyo5Wio2Vis1Uiw1Ty40SSowPh0mORojNhoiQT86Qj87REA8RUI9RkI+R0I+SEQ/S0c+TUk/Tks/WFRIbGhadHBhc25fd3FjfXhpgn9vfnpqcWxeVlJERkI0RUEzQz8wR0M1R0I2RkAzT0k8Uk0+VU9AW1RFWlJCY1pKZlxNa2FSa19QbmNUcGdWb2hVeXFggXhnfHNjcGdXamFSZFpMb2ZXaWBQZFtKWlFAXFNCXVRCWVA/Vk48UUo3TEc0XldFYlpJYFhFYlpGenBdY1tHamJNi4Fvi31yuqinwaituqKmtaSjiXl0d2ticGZZYVlJYVdHYVVJoIuQt2yKwilh0iVqyjBvvTdqrlBwxaOuxba4p5aWm4yKrqChyb/DvI6iuStkxxtgyh9huC5ft2yEvJadtqKkzbS9u2GEzD500maP3LPDk3h7ZFJNYFRMW1FIcltZs4KPzJimpoSHfWpiemtdemtbd2hVcWRQdmlXbmFQbWFRZ1xOeG1ie3BlZmBQaGJPZFpGXlNAV0s6UEg1Z19Ppp+Tk4p/YlhNVk8/d3Fe0sy+wLWtg3NrWEw9UEY1Wk4/XVFGnZCNyp6uxVCA50WJ20CB0maR5LDFxq+whHFmmoiF2MjR1KK31VaA52aPxGKAmFlrnnJ+yZ+q1665yYaYw3SKtGl+vnSJxHmPxn6S1Yqg2oef2oCY3n6X13ySwnWGoWZyfFJZcUxPfVdZlWtsrHl8kmVkc1NNalVLZFBGk2dkw4GDqXxzbVJFYFBCaFpNgmRdu46Pl2ZqlF9oi2Jnim1mj35siHhhl4dosaWCtamEv6+Qv5eMu215zGd/3HuV34Sc3ZWmwYmQkXZokYNsmIlyiXpkgXJic2VaaFlShGlqrIGKvY6YxqGn0amv1Jah1IeUw3eBxX6GxYSKom5vh15bfV9XZlVJW01AX1BEbVlPgmphlnx0rYeEx4iP04ORsnB7hEtWlj1YrixbvSRexiRi1CNm1B5jxyFfyC9n0jdv1DFquylaoCJMjxxCkBxCkSFDeyQ9cSc8ays8YCo3WCo1Uys0Ty00TC0zRCUsPRwlOxwlQD04QT45Q0A7REE8RkI9S0ZAT0lBT0lAUU1CWlZKbGhZdXJjbWpbbWlbY19RYV1OYV5PWlZHSkY4R0M1RUEzRkIzSUU2T0s8V1FFX1lMZmBTcGtbd3Jhf3logXpof3Zmf3VlgHVnh3xulot+lYx9lIx7mI9/mI+Al41/kYh6h31uhXttiX9wiH9vg3lob2ZUaF5NaV9NYlhHW1NAWVE+SUIvSUAvUUg3VU06XFM/ZFpHT0UzUUc2amFRhn1vpJmOjoB3hXZtloZ8l4p9k4l5g3pndG1ZeHFdd2tgrIyYv1qDxyljvzVsvm+QrnuNp3qDq5KSkYJ6e21je25kk4OAvayysXGLvCtkwyFgszBfuHiLup+ijnx3dmdhrZOaynKSykp415WuxKiwiXRxYlZMWlJGW1NIZlpSmoaFrpuXhHdqd29bfnNefG5acmNQem1ZiHxphXhoc2ZWa2FSZ15RbWVWe3Rie3Nfc2pWcWZSYVZEU0k4WlNDYl1NXVdIWFFBV08/hHtqsaeXeG5dYlhHXlNDX1ZGWE5Ae25mvKOovWiH10WA3lKN4Yav5MDRuqWoiXlwbGFNl4qA3c/S3bW/4IyiyH+Pg1leUkZBaFlVsI2S052p1ICWwGqBrWd6sHCBtHKDw36Q2Iyh2oyi4Iyh1HqQq15uilBae05VYkpJcFVTmG1wsYOEo3l3b05IZU9FalpNe2FXpXVxsHl2h2VbZU9BZ1RHZFJGhmVgq39/hV1eflVXbk9LhnBfkYJnmYxts6aApZhyq518vqqQuJOHvH+C0ICP4Iyi4Y6l5aCxxJCVi3NllINtuKiSn456fm1aaFpKXVFEe2Jeq4OHyaKn0LGz0qes05eh1IaTv216um13yoGKx4aLqHR0hmJdclxSZVZJYlNGYVFEZ1VKdmJXnYB4yJaX042V0YSRrmx4p2J1tFl6rTJhrihaxyhjyyZlxyZiziNi1CJj0SNhzSpixihdqR5MlxxDlyBCkSNCeSc+cy1Aay4+Wyo2VSs1USw0TS40SS0zQiEqPx0nPzw3QD44Qj85REA7UEpEV1BJVE1FVlFHYl1QcW5fdXJhcW5dZGFQWldHTUk6REAxREAyRkI0QDwtQD0tR0M0UU4+WVVFW1dIY1xPcmxedG5fcWxcdW9ffHZlfHVkd29fd25fe3FkiH5xkYd6k4l8kYh5lYx9npSGoJaJopeKopeJm5CCiX1wj4R1lYp6kIV0iH5rjIFthHlnc2lVb2ZTY1tIUUc2VUs6WlA+VEk2Vko4U0c1TkQ1VEs9X1VGcWZUcWVSc2ZVjoBvinxqi4FskIhympJ8kop2joV6uI2dw1F+vUJwtmqIrYiUjHd1gXBnfnBgcmVUcmZVdWlahnVvs5egtFt9vzVosz9puoKTpZiUdWpfYVZJXVNJppGU1Jmux3WPsYWOg3FqYlxMXVZHVU0/VUxAZF1QdG1hgXZmf3RheW9XgnVejH5pjH5pkIJthHhkg3dkem5denBeeW9ddm5cenJfgnllb2VQb2RPa2FOWE49WVNCV1FBWlNDXFNEWlJChn1sopiHcWZUZVtJbmRTamFQa2BUpZiT3K+7zFyF222a4J292LrIrJ6cc2dcYVlHWlQ8iH9x29PR1s3GsZKOeF5ZVEk/Qj0yXU9HpoWHxYmVz3iOw26Dtm2At3OFu3WHzoKV0YGVyHuNzYKTu29/kFJbgFZYYkVEVUU/d1xYm29wrIKAgGVbY1BCZlRFb11PhWZboXNtmG9ncVlLZFNDa1ZJclhOjGdioXl3fGNeZExGW0U5jXxkqJp5ua2Dy76OrJ52p5l5rpuCqIl8qoR9vo2P25mn5pqv05WkvY6TrpCHk4BsoJB6nIx4d2ZVW0s8Y1FEc1hRoXx83sHC2sTC1bO00ZykzHqJzXmHyXqFvnV9yIiNtIGBmnRvfmdedWZZbV1RZVZJZ1dLbltPfWdcqIN9zpqa0YeSyX6LxYaVy4yju3GMsVh3tkhvu0BtyDVq0SlmyhlbxRhXwx1WzSRduCBSmBlAlR9BniVHjChEfC5EeDRGZC07WCs2Uy02Ty42SzA2RikwQx8pPjw2Pzw3Qj85Uk5GYVxTXldPX1lObGhabGhadHBhdHFgX1xJTks4REEwRUIyQj8uQj8uRkMxQ0AvQj8wSUc3V1VFXlpKXFhIXllLYlxPXlhKVU9BVE0+VU5AVk9BWVJDXVRHYVhMZVxRa2JWb2VacGZad21gfnRnfnRniX5ylIl7lIh7j4N2lYl7nZGCnpKCnpOBn5SAkYZzhntoioBsj4dzfnRiaF1LaF1KZVtIWEw5V0w7VEk6SUAyUEU1VEo2Vkw3dWpVhXllenBbf3Vfk4tzrKWOlYt4lIV9u4ebv097vnmRq4iOj3dzb2NWcW9adW9aZltHZ11Lal5Of2tmtZCdvGaGwGSFxJimsKCfZV5TUUo8WVFDZVpRm46L2MPGqomMemZdbWVUYFpHXFRDVk4+Y1tMbGVWZ2JRd2xYgnFbdWdOe25VkYNsn5F7opV/i39qf3Neg3difHFcg3lkh39phHxnfHNebGNNZVxHa2JOYFdEWFE/UEo3W1RCYllIX1dEeG9ckIZyc2lWbWRRe3JfamFOjoF608LI25+21XaZ5bnM18HKkn19XVJGXlREXFI/YlhChXtrtq6miIF0X1FDX1VIUUg8SkI2ZFNLm3Z3uXqGvnKCwXOFwXOFw3KFwXKEuG9+tm58rWZyoWdummNpmGZpgF9bVEY8WEk/gGRem3ZyjGpjZlRHZ1xLa1xLeGNVlnNpoHdvknFmcFtMcGBPdF5RfmJXkXBokG9ocmFXXlBEZFNCk4Ron5Ftu7CEyLyNva6IpJV5lINujXhojHZnlHhus4KGyouYqXh/tImO1rGzt6aYkYRtinxmZVVEW0o6bFpKeF9UmXp0zrOv17683cfIz6KquW18x3eEzYGKxHyDzpKVzKCeqomCfWtfdGdaa11PZVdJZldKY1RGZVdHemVYm3pyu4GCz4+VyY+ZyZSjvYybwo6dwYGVw3SPyW2N0F+JyT1wuh5VrRtNsiNRrx5MoRdDmR1CmiVGmSdIhy1HfzRKcTJDXSw5Vy04Ui44TzI4TDI3SCoyPjw2QD04T0xCY15TZmFVZ2FWcWxffHhnfHhqaWZXX1xMS0g2QkAtQj8rQ0AtSkc0Skk1R0UyRkQyREExSUY3T0w+Uk9BU09BVVBDVE9CUUs9Tkg6S0U3TEU3TkY4UEg8VEtAWE9EXFNJYVdNZVtQZVtPYlhMYFVKYFVJZVpOaV5Tcmdaem9hhnttlot8opeGp5yJppyJmY59iH1rjYRwlIt2l456joVwdmtXbmJQb2NSaV5NWU8/TkU1TUMzRz0sQzkmXVJAbGFQcGZTdGxWg3tkpZ6HmY98k4F5vpilzZKor5iWkod3fnNhbWRSdW5abWNQYlhGW1RBZFlKf3BpuqWsxqWyx660p5iWd2piWk9FWFBDXlZIYlpPk4yCt7CmeW5hbGFRbWFQZVlHWlA+XlZDbmdTbmdUcGlUeXFadmpTeGxUem5VfHBZjH9oiHtkjYFrlIhyin5ne29XgndfiH9nhX1lfXVeZF1FYVlBaGBKYFlDTEMwTUYyYVlFaGBLcmhVc2lWeXBbe3JegXdkiYBsdWxaraGe38fVz4qn2ae63MzOqZmVaFlNUUU0Wk88YlZCbGBKfnRffHNhYlpKXldHXlhKUk1AVk1Ce2Jeqn+Bt36FrW96vXiEu299v3B/s2p2nF1miVJYgVBSjWRhjmtld1xUZVRIW1FCdGNVj3JqkXJqdFpOb19PZ1pJdGNThm5glXdroYR3gGhabVpKcmFQdGFRfWhZhW1hcVxQXE0/XE0/eGpWqpx+p5p3t6qGsKOBmYpugnFafm9ceGpWdWlUcmNSfmdfk29wnXR2xZmh4r3L1sbBraGLhXhiY1RBaFlGeWlVgm9cmYBwwKaZ1bq15MnMv5eduIOI05icy4yR1pSZ25ac36ysrI2GeGlbbWFSbF5QaFtMZlhJY1VFY1VFaVlJdl9RpoJ5rYF+r4GFxZeiwpShyJuoxZSjwYmax46hyoKdxl+DqihUriRQtjNbtC5WrSBLpRxFnCJHmCRHkypJhC9IfDJHZS49Wy46VzA6UzI6UDQ7TDU7QD44SUc/WVZKYFxQaWVXeXVnfnpsenZkaGVVVFBCSUY4RkM0R0QzTUo4T0w5T0w4S0k2RkQyQ0AwQT4vQ0EzSEQ4TUo9U05CVlFEVVBDT0o+SUM4RD40RD00RD00Rj42SUA4TUM8UUdAVUtDWU1FWk9HWlBGWlBFW1BGXFBFXlNHYlhLZlxPbWNWdmxeg3lqkYd2m5B+mpB9mI56lo15kYh1k4l3lYx6k4d1gHRjfXFhe3BgbGJRY1pJV04+SUAxPjUmRDoqT0U1Vkw6WFA7Zl5HeXNbhX5nh3xuwre3zMDAm5GDjYZvgHdhcGdTdWxYgXlne3NhZF1MXFdFeXJmubGv0czLurKsiH9yamVVaWNUbGZVZ19PZVxNjIFykYV3eGxddWdXaVtLZVhIamBOZ19Ma2NOeXFcg3xlfXZehXxjioBnh3xkgnZehXlhgXRdeW1VgHVchnphfnJZem9Wh35lioBpenJab2lPaGJJZ2FJX1hCVk45Z2BKcGdRbmVPf3Vgf3VgiH5piH5pmI55fnVgb2VTsami3MzU1ae4zrK4qZmUeGteXlJBV0s4ZVlGdWhTeW1XdmpUbGJNYlpIXVdIXVdJWFJEYVVLiW5qxJmbvYiMr3d+sXV7sm92wHuDqW1yfU5NdU5LeltTeV5UbVdKX05AZVVGdWNUkHptknltc1tPblpMcmJSY1NDd2RWjndpjnZomoFya1VGbVpKeWhXeGdWloVzdGNSZ1dGV0g4X1A/iHpjsqWHrZ9/tKaFoZJ2jH1lbl5Ja1tGd2hScWVOaFpHa1tNg2pfsZSI3MK44cfG1ca/pJmEbmJLYlVAa11HhXZekH9oqJV72cWp5dC50birtJSPoYJ8rYmEu4uKy5WV2ZGX4KansZGKempdal5PbWBRbmBRa1xMZldHYVRDZ1lJa1dIfWNWgmBYlm9wv5SezZ6sxJCgtoiVvJeiyKOvypmsw3eSrz9kritUrTRWqjZXry5TtiBNvSpXtS1XoCtPhixHgTBIbzBCYC89XDE8VzM9UzY9UTc9TEpCUk9FVlRIYl9Qd3RkhIBwfHlpYF1MS0g4SUU3SkY5UE5BVVNFWFVFVFE/S0c3Qz8xQDwvQTwvQT0wREA0R0Q5TEg+TklATUlASUY9REA5QTw2PjozPDcxPDYwPTYxQTcyRTo2ST45TUE8UUVAU0dDVktFV01HWU9IW1BIW1JJX1ZMZFtPaWBUbWRXbmRXb2ZYcmlbenFhhXxrk4l4mY5/mY1/lYh7koZ5lIh5lIl5k4h4j4R0g3lpb2RVZVtLV04+SkExSD8uRz4sQzsmTkYuW1Q8bWRMem5btKmhq5+Xg3ZkhHlhioBqiYFsh35rnZOBjoZ0fHVjZmFNdG1cp56UubKqo5uMj4p0hYJriodwhoFqdW1Xc2pUhXlmjoBtintqfG5cbWBPa2BPaF1LcGhUdW5YfXVegntjh35niYBphHpif3NbhXpji39oin5mgHVdfHBYiX1kn5N6joJqhHpijIJreXFYbWdOamRLZWBJXVdBY1xFg3lifHFbcmdSfHJbjYJsjYJslIl0pZmFb2VQaV9Mlo6Dy8fF2M/No5eOeGxdZFhHaFxKa19LdGhSh3tliHtlem9Ze3Jcb2dTaGBPYVpLXFZId2Zdq4yJuo+RuoiKq3h7rXh6woaKs3Z5jWFfb1FIbVZJbF1MX1hEVk06Xk89eGFSj3Noknhsi3RmcV9Pc2VUaVlJXEs9fmxfk39wgm1efWdXbVhJcF1MemlWg3Jfj39rZlZCZVhEZFdEZllEf3FZhnhdkIJkoJN0mIluh3hfdWRMa1tDalxEcmVObV9JbWBJfG9UpZV03cyp7d7F7+TVtamXXVE8U0YyZVZAkIBmlINpnYxvv7COvayPoY95kHlsdWBVeWNYiGtjpHx3xoqM2Z+g2Kqon4B4dGRWc2ZYdmhYcGFQbV1NbF5NbV9Oa1lJcVpMcldMi2Zlt4eRzpCiy4aaxISWx5alx6Ctw56rxpapt2aAnDtXkzZRnj5arTZasyFNsyRQvDBbripTjypJhy5JeS9GZy8/YTE/XDQ/WDZAVzhAU1FIU1JIW1lMcG1df3xqd3RhWllDSkc1S0c5Tks+VlJGWldLV1RGTkw9RkM0QDwvPzsvQDswQTwxQT0yQz81RUE4RkM6RkI8RUE7Q0A6Qj46Pzw3PTgzOzUwOjQvOzMvPjUwQzg0SDs4TD87UEM/U0ZDVUpFWE1IWVBKW1FNW1RNW1RNXFVNYFlQZl5TaWFWaF9TZFtPYlhNZVxQc2lch3xwmIyAnpKGlouAlIp8mY9/n5WCo5eEm5F+kIZ0kIV0hHpoaV9OUko4UUk2SD8rRTwmTEQtUkkxXVM+f3JkgHJlbWNObmRMgHZgmpF8k4t2lo17jYVyhX5skop1lIh1lYZ5lYl7opeDm5N8n5mBnph/k450kYpwkYhwm5F6opeBk4h1gXRhc2ZTbmRRcWhVcmlWc2tWbWVQcGhSe3JbeW9YgXZghXlijYFpk4dviHxkfXFagXRchHhgkYVtk4dvgnhggHVfgHZfdm5WYFpCYFtDYVpEbGNNh3xlenBZgnhih31mo5eBlot2n5R/opeDfHFecWZUkYp8xsW8ubmth4Jwe3Fbb2ROdWtWfnNdhHljin9pdGhSeGxVgHVgdGxZaWBOZFxLYltMfWthq4eEsIGDvYmMq3t8tYaFs4KBlGRieltSZVNFYFBAZFpHWVhCUU44Xk47hGhao4V4m4Bzg29geWtbe21cZFRFVUQ3fGtegnBhcl5OcFpMe2dWgG1beWhVhHRgdWZRXlA7ZVhEZVlFal9Iem5Vem5SjoFij4JjlIVpiHlgeGhPeWpRemtSc2ZMalxDcmVJeW1Po5dxwrKFz7+c5djFtamWa19LW045cGFKlYRqkoFmj4Fkr6OFlIhsc2VPb19NaFVIa1hLbllOhmxip4J72Z+g35+iv5CNlX1xhndoeWpac2NSeGhWeWtZaltKaVdGcl5OZU9ChGNfu4WQxIKUr2l8s2V7vWWAx3+XyJ6ty6CwxYWYvXeMq110oT5atTdduSlVpx1HqCBLuCZVpClQiytJhCxIcS9DZjJBYjVCXjhDWzpEVFJKWVhNaWhZcnFgamhVVlM/SUcyTEk3TUs9VFFFVlNIUU1BRkM3PzswPjsuPjsvPTkvPTgvPjkwPzozQT01RD84RUE7RkI8RkM9RUI8Qj87QDw3PDgzOTQwODEtODEtPDIvQDUyRjk2Sz07T0E/U0ZDVUpGWE1JWlBLW1NNW1ROW1VOWlVOWVRMWVNLWVRMXFVMXFRKW1NJXVNIYVdNaF5Vd21ii4B1mpCEmpGCl5B+l496oJWBqZ6LopiEo5qGppuJioBuZVxLWVE9V086TkYxSkItQjomSEAsVkw8YFZHYFlGYllEa2JMgXljiH9pi4JuiYBse3JglIx3pp2Hmo98nJJ/qJ6Kkol0n5eBl495jYVulIx0m5N8mJB5mZB7iX9reW5cbF9NbmRRa2FOaWFNZl5KZFtIb2ZRenFcfHBbf3Ndin1mk4ZskoRsh3lhhnhhkoRulIZwhHdhdmpSdmtTiH5nhnxleG9YY1xFXlU/XVU9cmlRiX9od2xVkYZumo14qZ6ImIx3nJB8mIx4i35tem9epp6Q1M/DmZKFiH9snZN6joVrcWlSf3ZghXxljIJsf3VedmxWe3FcaF5LZ19LYVhGZV1NdGNXkGpntoKEuYWHr4KBroaBnntzim5jc19RZVZFbGBOZ15KXFZBVk86a1pHk3lpmn9vgWtacF5OeWpae2tdZldIWko8d2ZYa1pKYE8+a1hHhHBdi3ple2tXe2tXaVtGW086W046X1Q/dmpTlotxnZF1mY1ujYJhmYtuj4Blhndej4BognRbcGJIdmhNf3FUn5By1MajwLGOw7aXo5Z/hXlibmJLbWBJfnBWmYtumIlst6mM6d3AmY1xZVc/aVlEbFtJalhJaldKdmRXlHpvuoOC3Zib0aCcnIV4inxrfm5dgG9eeWlVdmhUd2hVd2JTclxNZ1REeFhSlFdiiEBRjDtQpTpZrCVPrzddvHGKzpqsy5yryI2fzYmevmyDpUJfpTBVuSxZwSNWxidawCxcmSlMiyhHfi1GbTJFaDZFZDpGYTxIV1RMZmNYcXBiZ2ZWVVNCTUo5Skc0TUo4TEk6S0g8RkM4QD0zPjswPTovPDkvOjYuODQtOTUuPDYvPjoyQDw2Qz85RUI8R0Q/R0Q/RkM+REE9QD05PDg0ODMwNjAsNy8sOi8tPzMxRTc1Sjw6T0E/VEZEWEtJW1BMXFJOXVVPXVZQW1ZQWlVOWFRMVlJLVVBJU09HVE5HVE5HVk9HW1NKYVhPZFtTbGNZfHRojYZ3mJF+lo97koh2mo59nJF/n5WEsaeVpZuJkId2d29bYlpGWFA8UUg2RTwqPjUkRDsrTkQ2WU8/YVdEYllDa2FMd25Yf3Zggnlle3JfhXxokYl0m5N+mZB8lIt4ioFtk4t3f3Zhd29ah35plY13kIZxiYBtfXRgeG5adGhVbWJQXVRBYFhEZFxJZFpHbGFNgXZigXVgdWlTeWtVjoBomItxhHZeemxVlIZvm414gXReaFxFZltEdmtVenBadm1YaWBLX1ZAW1M8bGRMfXNdgnhgmIx1nZF8qZ2Im456oZN/koRxloh2f3NikYV4qp+Vhnpthnxom5N5iIBlioFpjINue3JcmZB5j4VufnNefXJdZ1xJZ15LXlVFY1tLZ1ZJkmxmvYuLp3l4qIJ9oIF2k3ttkH5ub2FQZlhGd2lXal5KY1ZBbF5KgnJeg29cemVTZlJAbFlJempacmJTbV1PdmZYeWhaYE8/ZFREcV9OiXdjfGxXcGJMeGhTXlE8XVE8UkYxU0cyfHBYrKCGraGGjYBigXVXi3xffnBUg3VbiHlgemxSfG5TjH1hhnharZ5/yLmZwbOSu66Qc2dNYFU9al9HdGdPhHVbr6GDm41vvK6Q4NK2jX5ka1xFalpEc2JOallHa1lLcWBSeWdZinFmso6HsJGGjntriHlnhXViinlninpmfG1Ye2tZfGdXf2lZalpJa01Fdz5Gij9Pr0hksDBWqBxHoBxGmC1PsmR/yo+lyIWZzY+h1KCwtnCFpjpcyjlo0ypgzSpe1DNnsixXkiZIiipHeTJIbzhJajxKZz9LYlxVcGxicW5jZGJUW1hLVFFDS0g3REEyQD0wPzwwQDwzQDwzPTkwOTYuNzQtNjItNjItNzQtOjYwPTgyQDw2RD86R0M+SUZCSUZBR0RAQT46PTk2ODQwNDAsNC8rNS8rNjAsODEuPDMwPjYyQDg0ST47UUZDU0pGWVFNX1dSX1hTXllTW1ZQWFROVVJLU09IUU1HUExGUExGUk1HVVBJWVNMX1dPYVpPYltPamRWgnpqlIt6mY1/lIZ7jYF2j4R3rqOWrqSVo5mJnZOChHxpZFxIW1JAWlE/S0ExQjkpRTwtU0k5Vkw5V044WlE7eG5ZenBdbGNPb2ZSfXRghn1oh39ph39qd21Zdm1ZjoVybWRQcWhUe3FehXxnhn1ohHpmeW9cfHFegnhlcGdTZl1KZ19LaGBMX1VCaF1JfXJee29bfnFcgnNdin1kjH9mfXBXf3JajoBpjH5oc2ZRX1I9XVM9bmNPd2xYaWBLYVhDX1ZAXlY/Y1pDc2hSh31lkYVukIRvo5aBkYNwnI16lIRymot5joBvgnVnh3tvhHlqgndjk4lvh4BlqKCHoJeBgXhijIJsj4RvhntmnpJ+i4FsZltHW1A/WU8+ZlRHmnlyr4mEk3Jrmn9zkXpsi3pof3JdY1dDXE86b2BLbFtGcF1Ig3FcdmhRbF9HaFhEZFE/b1xMcF9PaVhJcGBRkoFzeWhbWUo7cmNUd2ZVfm5acGBLWkw1b2FLdGdSWk44TEEqXFA5eW1VnJB1saWJhnhbc2VJcmVIc2VJfW5TeGlOgXJVjn5hkYJkopN1qJl5opRzrJ19j4FkZVg8aFxCgnZbj4Jni3pfnYxvkYFjmYpsn5F1gnNZa1tEZlY/cWBMblxJaFZHZVVFZVtKXVVDfHBfiXlognJgiXhmhHNheWhUi3plhXRgg3FfiXRkgWxdaVhIaktDbzw/i0BNsURfrTBUpB9Itx1MrB1Lpi5Wukxwx2mGwnuRz5SnyH6Wpz5fuDRevipZxyZa3TNr0TBmoilPlilLiTFLdjpMcD5ObkFOdGtjdm5lZ2NWX1xOXFlNTUo+PjsvOTUqODUqPDkuPToyOzcwNzQuNjIuNTItNTEtNTEtNzMtOTUvPDgzQTw3REA7REA8QT06OTYyNjMvMS4qLywoMCwpMCwoMS0pMi4qMy8qMy8rNDArNDEsNTEtNzMuOjUwOjUwQTw3R0I9T0lEV1JNWlZQWFVOVVFMUU5IT0xGTkpFTkpGUUxHUk5JVVFMWVRNXFZNXFdLXlhLZF1QdWxfjYF1lomAkoZ+iH10lIqAppyQnJGEn5WGopqIj4d0bGRSYVhHV04/TUQ1TUQ2UUg4TUMwTEQuVUw2c2lTd25aZlxJX1VDb2ZSg3plfXReg3pkeW9agHdkkol1bmRQdmxZenFddGxXbWZQcmlVal9NeG1bhXtnamJOX1dDZV5JZmBLZFxIb2VRem9aem5ahHdihHdggnVckYRrnpF5mIpziHtkgXNddGhRZlpFXlI9al9KgHVhdGtVW1M+X1dBYVpEYVpDdmxVin9oiX1miXxnl4l0j4Fuq5yJlYh0l4t3lYl1gXVkhHhofXFgi4Bqj4Vse3NZjoVtk4lyi4Frg3hilYlzkYRup5yGjIJsamBLXVE/WU47bFtMjnVpmYB0h3Fkh3VlhnVkhXhkd2xXZ1tGZVhCYlQ/cmBLh3JdgG5Za2BHYllAW044X087bVpJbVxLY1NDb19PkH9wdmZXWUs5gHJgiHhma1xIZldCYVM9XlA8ZllHXVE+XVE8cWVOkIRqopZ6p5t9hndZbV9DbmBFh3lelodshHVXmIhpopJzq5t8vKyMvK2KqJl2jH9eemxPa11BcmVJjoFlm4xwjXxfhHJVmYdplINljn5iiHlecGBIa1pCblxHcV9LaVdGXU08ZFREa1tKeGpYdmlWe2xahXRjhnRjh3Vhg3JdgnFei3hmlH9uh3RjcF5McVBFeEJCkz9MuktluDZauiNR1hxZziBavCVZxzhpzGKExIGW15+xy3qUtEdprTFZtyZV1yJd4ito4zVwwC9gpCtRnTBRhDpQdkBRc0NRf3Rsd2xkY1xPWFNHTEk+PjsxODQqNTIoNjMpNzQsNjQuNTIuNjMuNTIuNTIuNTEtNTEtNjIuODQwOTUxOjUxNTIuMS4qLCklKigjKigjKyklLCklLSkmLiomLisnMCsoMCwoMi0pMi0qMy8qNC8rNDAsNTAsNTEsNjEtNTEtODQvPDgzREA7RkM9TUlEUE1HTktGTUpFTkpFT0xIUk5JVVFMWFROWldPW1dOW1ZKXlhLYllOamBXf3NrjoN8j4V+iH53kod/j4V6iX9xmpCAqqKQmZGAenJhZ19PZVxOXFNFXVRFT0c0Rz8qTkUxWlE9X1VCXVNBUkg3U0k2ZlxIYFdCdGtXenFcioBrnpSAdm1Zdm1ab2ZSY1xHXVZBWlE9XVM/eG1afXNfaWBMamJNaGJNY15JZV5JcGhTdmxYcWdTdWpUgXZelYpxsKSLsaSMmox1gHJbc2ROal1HY1dCZltGY1pFaF9Kb2hTYl1GYFpDZF5IZl9Jdm1XhXtjhXlikoZwoZN/mYx3opV/koVwlYt0kIVwjoJuhXdke21afHBaem9WiX9niX9oioBohHlhg3hhjIBphXdhkoZvhntkd2xXYFVAYFI/alpJgW9fjnxshndmgHJffG9cgnljeG5Ya2BKd2lTZFdAbV9IalpEdWZPb2NLYVc/VkkzWks2aVpFcGBMaFhFeGdVgG9dcGFNZlhDc2VQiHtlbWBKXFA6ZllEalxIVkc3XlFAbmNPeGxVrKGEppl8iXtcf29ScGBGeWlRmYpxnIxxoJBxq5x7oZJwpZR0sqF/vrCIpJVvjX9df3BSemxPeWtNhXVZn45xppZ4m4lruqeJo5J0h3ZahXVZfG1TdGNLeWdRdGJNaFVCZlNAZFE+a1hFaFZFZlVEeGdXgG5dgW9dhXJgfGpXfm1YiXhkkH9rhnZhb1xIdlhJfFBJhUBEpD9TvjddySNY5B9k5S1uzzBoxTZmw1F3y3iS2qi40YifxkhwuCxZwCZY3CRh3yRl5zZ33jRzti9crjJYnzdXf0BTd0NTZ19YaWFYWlNJSUU8Pzs0OzcwNjQsMzAqMjAqMzAsMzEsNTIuNTIuNTIvNTIvNTIvNDEuMzAsMS4qLSomKScjKCYiJyUhKCYiKCYjKSYjKSYjKickKyckLCgkLCglLSkmLionLysnMCwoMS0pMi0pMi4qMy8rMzAsNDAsNDEsNTEtNTItNTItNzMuOjcyQT04RUI9SkdDTktHUE1JU1BLVlNNWVZQWlhQXFlQXFlPXFdNXVZMXVRMYFZPbmVehHp0j4V+kYZ/i4B3e3BjhHtrn5eGsaqZpJyMkYl6g3pscmhbcGZXcGdWX1ZDUUc1TUMwUEYzUUY1SUAtRDomTUMvUEYwZlxIbWNOdGpWf3RhXVNBa2JPYlpHU004U0s3Ukk1XVM/fHFehntneXBbamJNYlxHWlVAXlhDbmdSdm9ZcGhScWdQf3NbkodunZF4p5qCopV+hXdgdWdSaFtGW086ZlxGa2JOcGdSbWZQYVtFX1lDZV9JZV9Jb2dRfnRcgXZfm495qJuGoJR/koZwi4FqjINshXtlin5of3NdfXBZc2ZPjoNrnJJ6h31ngXZfh3xlo5eAjoJqem1WgnZfdmtUaV5IW087XlA9bV9Mf3Bdinpog3RidmpWbGJNcGVQdGpUb2ROd2xVal9IZlpDXFA5al1GaVxEZllBWk03XE44W0w3ZVVAalpFcGBLZlZBaltFb2JKZFc/bGBKa19JWU04X1M+ZVlGYVNBYlZCeG1XmY5ys6iGm45ujn9gg3RWcWFGgnJZl4hwmIltrp5+oZFvjX1bo5Jwr595uaqCrJ53no9sjX5fkIFkkIFjjHteoZBzq5p7mohqmIRng3BSf25RinlcfWtRdmRLd2VNdGNLcF5Ibl1HaVdBX003Yk87aldDc2FNd2VTfGpWfmxXe2pVhXNei3pkgXJcdGRObVlEgWZViWVah0hJrURYwDlfzyJc8SVt2yhpxypiyyxjxjZnwExyyXWP25qu0GuMui5atydVxCtd0R5g7S579z2I2jp3uDVgsDdcjz5Xe0NUSkQ+S0Y/RkI6Qj02PjozODUuMzArMS4qMC4qMS4qMjAsMzAtNDIvNjMwNjIvMS8sLComKCYiJiQgJiQgJiQgJiQgJiQgJiQgJiQhJyQhJyQhJyUiKCUiKSYjKSYjKickKyglLCglLSkmLionLysnMCwpMCwpMS4qMi4qMi8rMzArMzAsNDEtNTIuNjMuNzMvOTYxPjs2RkM/T01JVVRPWFZRWlhSW1lSXFlRW1lQW1hPWlVNWVFJV09IWlFLZFpTe3FpjoN6lId+hHhseW9gi4RynZWFq6SUtayepJuMi4FzgHVmj4V1fHFfYVdFUkc2TkUyTkUzS0IvQzonRTwnTUQtXVM+ZVtHX1VCVUo4UUg3Z15NYFhGVk88U0o4VUw5Z11JgndjhHlldWtXa2NOZ2FMX1pFYl1HaGFMbGRPcmlUgnhij4RshXtignZdnpF5u66Xq52GjX5obGBJWE43YlpDbmZQenFcd3FbYVxFW1U/YVtFYVtFbGRPdmxWf3VfnJB6ppuFn5R+kIVujoRti4Jqg3lig3dhfnJbcGNMbWBJk4Zwl4x2lIp1gnZhfnJcinxlmIpzi31mgHNcgHRecGZQYFRAXVA8b2NPgnVhlIZyjoBtcmVRZVpGbWJNe3Bbc2hSal9JZVpDaFxEZVlCY1c/X1M6al5GZVlAal5FZ1dAXk43aVlCb19IaFhBZldAa1tDZlc/ZllDX1I9W086YFVAXlM/ZFhDZlpCgndaua6LxruVraF+kIFhempLdmdJhXVak4Npk4NnmopqjXtbl4Zlr598qZlysqN7qpl1nY5skYJji3tekIFik4BinYtssZ+AmoZoiHJUgm1Pn45wqJZ4gG1RaVc9ZFM6a1tBcmFIcF9GalhAWUcvXUkxZlI7cF5Hd2VPdmROc2FMcmFLd2VOemhRaVhBY1I8d2JMk3lnk2xijkhLpD5QujRa1yZg7iZu4Cps3ipr6i1v0i1lpSxTsUpr2Iqj0o2islJvqDdZuC5byBtX6ihz/0aW+keTyztwsjZfnzpag0FVRUE7Qz83QDw1PTgyNzMtMy8qMS4pLy0pLywpLy0pMS4sMzAtNDEuMi4sLCkmJiQgJSMfJSMfJCIeJCIeJCIeJCIeJCIfJCIfJCIfJCIfJSIgJSIgJiMhJiMhJyQhKCQiKCUjKiYjKickKyclLCglLSknLisnLywoLywpMC0pMC4pMS4qMS8rMzAsNDEtNTIuNzQvODUwOjcyQT45S0lEV1ZQXlxVXVtTXFpRWlhPWVZNWFRMV1JKVU5HVExGWE5IX1VOcGZdi391jIF1e3JkgnpqjIJzkoh5q6GTvLKksaeZoZeIpJqJj4Rzem9eZlxKV007Ukg2TUMxS0AuST8rTEItUkg1VEo3TEIwSj8uUUg2V1A9V1A9U006U0s4Uko2Zl1Jf3VhgHVhenBd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EREPExEQExMQFRMSFRQSFxUUHh0bIiEgISEgISEgISIgISEgISEgIiEfIiEgISEfISAeIR8eICAeIB8dHx4cHx0cHRwbHRwbHRsaHBoZGxoYGRgXGBcWFhYUFhQTFRMSFBMRExEQEhEPEhAOEA8ODw8NDg0MDg0LDQwLDQsKCwoJCwoJCgkICQgICQgHCAcGBwcGBwYGBgYFBgUFBQUEBQUEBQQEBAQDBAQDBAMDBAMDBAMDBAMDBAMDBAQDBAQDBQQDBQQEBQQEBQQEBQUEBQUEBgUEBgUEBgUEBgUFBgUFBgUFBgUFBgUFBgUFBgUEBgUEBgUEBgUEBQUEBQUEBQUEBQQEBQQEBwUFCwkICwkICwkHCggHCggHCQcGCQcGCQcGCAcGCAYFCAYFCAYFBwYFBwYFBwYFBwYFBwUFBwUFBwUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEAgIBAgIBAgIBAgIBAgIBAgIBAgICAgICAgICAgICAgICAwICAwMCAwMCAwMCAwMDAwMDBAMDBAMDBAQDBAQDBAQDBQQEBQQEBQUEBQUEBQUEBgUEBgYFBgYFBwYFBwcFCAcGCAcGCAgGCQgHCgkICwsJCwsJBgUFBQQEBgYFBwYFBwgHCAgHCgkICgkJCwsJDAsKDQwLDg4MDw4MERAOEhEPExIQFRQRFxYTFxYTFRQSFhUTGRgVGhkXHBsYHRwZHh0aHx4bIB8cIR8cMCwpPTY0OTMxNzIvNjAuNC8tNjAuODMwOTQyNzMxNjMxNzYyODgzOjg1Ojo1Ozo0Ozo0PTs0Pzw1QD02Q0A4RUE5SUU8UUtDUkxDWFJIdW5idGtgVk5FT0Y/TkY+SkU+SEQ+R0Q8R0Q6R0U5R0U3R0U3RkQ3RUE3Qj83QD03Pzo2Pjk1Pjg1PTg1Pjk1Pzo2Qj05Mi8sIB8dIR8dIR8eIh8eIR8eIR8eIR8eIB8dHhwbHBsaFxYUEhEQEhEPEA8OEA8NDw4NDw4NDw4NDw4NEA8OEA8OEBAOEhEPEhEQExIQFBMSFRQSFhQTGBcWHx8eISAfISAfISAfISAfISAfICAfICAeIB8eIB8eHx8dHx4dHh4dHh0bHh0bHRwaHBwaHBoZGxoYGhgXGBcWFxYUFhQTFRQSFRMRExMRExEQEhAPERAPEA8NEA4NDg4MDgwLDQwLDAsKDAoJCgoJCgkICQgHCAgHCAcGCAcGBwYGBgYFBgUFBQUEBQQEBQQEBAQDBAQDBAMDBAMDBAMDBAMDBAMDBAQDBAQDBAQDBQQEBQQEBQQEBQQEBQUEBQUEBQUEBQUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBQUEBQUEBQUEBQUEBQQEBQQEBQQEBQQECQcGDAoICwkICgkHCggHCggHCQcGCQcGCAcGCAcGCAYFCAYFCAYFBwYFBwYFBwYFBwYFBwUFBwUFBwUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUEBgUE"
  }
});
