/**
 * Puerto del Viento — Malla procedural de puerto y bahía marina con temática de Viento (🌪️) y Agua (💧).
 * Conectado en el borde oeste (-X) de la Ruta 1 Norte.
 *
 * Características:
 *   - Bahía marina navegable con agua translúcida y orilla de arena costera.
 *   - Dos muelles de madera robustos con pilotes sumergidos para amarre de barcos.
 *   - Mástiles de viento con mangas y banderolas ondeantes de color celeste (#93c5fd).
 *   - Solares planos para lonja, almacenes portuarios, astillero y taberna marinera.
 *   - Conexión este limpia a cota cero (y = 0.00m) para enlazar con los senderos del bosque.
 *   - Esqueleto y animaciones de oleaje y viento ('Brisa Marina', 'Marea Alta', 'Reposo').
 */
registrarMalla({
  id: 'puerto_viento',
  categoria: 'terrenos',
  nombre: 'Puerto del Viento',
  icono: '⚓',
  origen: 'Bahía Costera de Viento y Agua',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const C = (hex) => new THREE.Color(hex);
    const grad = Math.PI / 180;

    const mezclar = (c1, c2, t) => c1.clone().lerp(c2, Math.max(0, Math.min(1, t)));
    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    // ---------------- 1. ESQUELETO Y BONES ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['PuertoCentro', 'Raiz', 0.00, 0.00, 0.00],
      ['MuelleNorte', 'PuertoCentro', -7.00, 0.20, -6.00],
      ['MuelleSur', 'PuertoCentro', -7.00, 0.20, 6.00],
      ['MaleconAgua', 'PuertoCentro', -5.00, -0.15, 0.00],
      ['VientoMastil1', 'PuertoCentro', 1.00, 1.80, -9.00],
      ['VientoMastil2', 'PuertoCentro', 1.00, 1.80, 9.00]
    ];

    const hueso = {};
    HUESOS.forEach(([nombre, padre, x, y, z]) => {
      const b = new THREE.Bone();
      b.name = 'Hueso' + nombre;
      b.userData.reposo = V(x, y, z);
      const p = padre ? hueso[padre] : null;
      b.position.set(x, y, z).sub(p ? p.userData.reposo : V(0, 0, 0));
      (p || g).add(b);
      hueso[nombre] = b;
    });
    g.updateMatrixWorld(true);

    // ---------------- 2. MODELADO TOPOGRÁFICO DE LA COSTA ----------------
    const ancho = 34.0; // X: [-17, +17]
    const fondo = 28.0; // Z: [-14, +14]
    const cols = M.seg(64, 32);
    const rows = M.seg(56, 28);

    const geo = new THREE.PlaneGeometry(ancho, fondo, cols, rows);
    geo.rotateX(-Math.PI / 2);

    // Solares de edificación portuaria
    const SOLARES_PUERTO = [
      { id: 'Solar Lonja', cx: 6.5, cz: -6.5, rx: 3.2, rz: 2.5, y: 0.06 },
      { id: 'Solar Almacen', cx: 6.5, cz: 6.5, rx: 3.2, rz: 2.5, y: 0.06 },
      { id: 'Solar Astillero', cx: 10.5, cz: 0.0, rx: 3.5, rz: 2.6, y: 0.06 }
    ];

    function calcSolarPuerto(x, z) {
      let maxF = 0, targetY = 0;
      for (let i = 0; i < SOLARES_PUERTO.length; i++) {
        const s = SOLARES_PUERTO[i];
        const dx = Math.abs(x - s.cx);
        const dz = Math.abs(z - s.cz);
        if (dx < s.rx + 0.6 && dz < s.rz + 0.6) {
          const fx = Math.max(0, Math.min(1, (s.rx + 0.6 - dx) / 0.6));
          const fz = Math.max(0, Math.min(1, (s.rz + 0.6 - dz) / 0.6));
          const f = fx * fz;
          if (f > maxF) { maxF = f; targetY = s.y; }
        }
      }
      return { factor: maxF, targetY };
    }

    function calcAlturaPuerto(x, z) {
      let y = 0.0;

      // Bahía curvada en media luna orgánica (x < arcoBahia)
      const arcoBahia = 1.2 - 2.8 * Math.cos((z / 14.0) * Math.PI * 0.5);
      if (x < arcoBahia) {
        const fAgua = Math.min(1, (arcoBahia - x) / 14.0);
        y -= fAgua * fAgua * 0.68;
      }

      // Zona de acceso al mar: rampa suave / varadero entre los muelles (x: 4.2 a -3.5)
      if (Math.abs(z) < 3.2 && x >= -3.5 && x <= 4.2) {
        const fRampa = Math.max(0, Math.min(1, (4.2 - x) / 7.7));
        y = y * (1.0 - fRampa) + (-0.14) * fRampa;
      }

      // Camino portuario que conecta con el este (bosque) en z = -2.2 y z = 5.8
      const dCam1 = Math.abs(z - (-2.2));
      const dCam2 = Math.abs(z - 5.8);
      const dCam = Math.min(dCam1, dCam2);
      if (dCam < 1.35 && x >= 0) {
        y -= (1.35 - dCam) * 0.05;
      }

      // Nivelado de solares
      const sol = calcSolarPuerto(x, z);
      if (sol.factor > 0) {
        y = y * (1.0 - sol.factor) + sol.targetY * sol.factor;
      }

      // Costura orgánica curvada con el bosque al este (elimina uniones rectas)
      const ondaUnion = 1.6 * Math.sin(z * 0.42);
      const corteUnion = 12.0 + ondaUnion;
      if (x > corteUnion) {
        const tCostura = Math.max(0, Math.min(1, (17.0 - x) / (17.0 - corteUnion)));
        y *= (tCostura * tCostura * (3 - 2 * tCostura));
      }

      return y;
    }

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, calcAlturaPuerto(x, z));
    }
    geo.computeVertexNormals();

    const mallaTerreno = M.pieza(geo, 'TerrenoPuertoBase', cols, rows);
    g.add(mallaTerreno);

    // ---------------- 3. PINTURA POR VÉRTICE (M.pintar) ----------------
    const COL_AGUA_BAHIA = C(0x0284c7);
    const COL_ORILLA_ARENA = C(0xd4b27b);
    const COL_ADOQUIN_PUERTO = C(0x78716c);
    const COL_PRADERA_COSTA = C(0x48882d);
    const COL_VIENTO_CELESTE = C(0x93c5fd);

    M.pintar(mallaTerreno, (i, p) => {
      const x = p.x;
      const z = p.z;
      const y = p.y;

      // Acceso al mar: rampa varadero entre muelles
      if (Math.abs(z) < 3.4 && x >= -3.5 && x <= 4.2 && y < 0.06) {
        const colRampa = COL_ORILLA_ARENA.clone().lerp(C(0xbba070), Math.max(0, (0.06 - y) / 0.20));
        if (y < -0.06) colRampa.lerp(COL_VIENTO_CELESTE, 0.40);
        return colRampa;
      }

      // Zona marina / fondo de bahía
      if (y < -0.20) {
        const fProfundo = Math.min(1, (-0.20 - y) / 0.40);
        return mezclar(COL_ORILLA_ARENA, COL_AGUA_BAHIA, fProfundo * 0.85);
      }

      // Playa / Orilla de arena
      if (y >= -0.20 && y < 0.02 && x < 2.5) {
        const fArena = Math.min(1, (0.02 - y) / 0.22);
        return mezclar(COL_PRADERA_COSTA, COL_ORILLA_ARENA, fArena);
      }

      // Muelles y explanada empedrada
      if (x >= -2.0 && x <= 8.0 && Math.abs(z) < 11.0) {
        const patronAdoquin = 0.5 + 0.3 * Math.sin(x * 6.0) * Math.cos(z * 6.0);
        const colMal = mezclar(COL_ADOQUIN_PUERTO, C(0xa8a29e), patronAdoquin);
        return mezclar(COL_PRADERA_COSTA, colMal, 0.75);
      }

      // Solares de almacén
      const sol = calcSolarPuerto(x, z);
      if (sol.factor > 0) {
        return mezclar(COL_PRADERA_COSTA, C(0xa18256), sol.factor);
      }

      // Pradera costera con brisa marina
      const vetaViento = 0.08 * Math.sin(x * 2.2 + z * 1.8);
      return mezclar(COL_PRADERA_COSTA, C(0x5ea838), 0.5 + vetaViento);
    }, g);

    // ---------------- 4. MUELLES DE MADERA Y LÁMINA DE AGUA DE BAHÍA ----------------
    // Lámina de agua de la bahía
    const aguaGeo = new THREE.PlaneGeometry(18.0, 26.0, 16, 16);
    aguaGeo.rotateX(-Math.PI / 2);
    aguaGeo.translate(-8.0, -0.15, 0);
    const matAguaBahia = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.80,
      roughness: 0.12,
      metalness: 0.08
    });
    const meshAguaBahia = new THREE.Mesh(aguaGeo, matAguaBahia);
    meshAguaBahia.name = 'AguaBahiaPuerto';
    g.add(meshAguaBahia);

    // Función auxiliar para construir un muelle con pilotes
    function crearMuelle(xInicio, zMuelle, largo) {
      const grupoMuelle = new THREE.Group();
      const numTablones = Math.floor(largo / 0.55);
      for (let k = 0; k < numTablones; k++) {
        const tx = xInicio - k * 0.55;
        const geoTablon = new THREE.BoxGeometry(0.50, 0.12, 2.4, 2, 1, 4);
        geoTablon.translate(tx, 0.12, zMuelle);
        const meshT = M.pieza(geoTablon, 'TablonMuelle', 2, 1);
        meshT.material = M.materialFacetado();
        meshT.material.color.setHex(0x785e43);
        grupoMuelle.add(meshT);
      }
      // Pilotes de soporte cilíndricos
      for (let p = 0; p < largo; p += 2.2) {
        const px = xInicio - p;
        [-1.0, 1.0].forEach((dz) => {
          const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.90, 6, 2, true);
          postGeo.translate(px, -0.18, zMuelle + dz);
          const meshP = M.pieza(postGeo, 'PiloteMuelle', 6, 2);
          meshP.material = M.materialFacetado();
          meshP.material.color.setHex(0x3b2d1f);
          grupoMuelle.add(meshP);
        });
      }
      return grupoMuelle;
    }

    g.add(crearMuelle(1.0, -6.0, 11.0));
    g.add(crearMuelle(1.0, 6.0, 11.0));

    // ---------------- 5. MÁSTILES DE VIENTO CON BANDEROLAS ----------------
    // Mástiles con mangas/banderolas de viento celestes (Viento 🌪️)
    [
      [1.5, -9.0],
      [1.5, 9.0],
      [2.5, 0.0]
    ].forEach(([mx, mz], idx) => {
      const mastil = M.tubo([[mx, 0.0, mz], [mx, 3.8, mz]], 0.09, 0.06, { nombre: `MastilViento_${idx}` });
      g.add(mastil);

      // Banderola de viento extendida hacia el este por la brisa
      const bandGeo = new THREE.BoxGeometry(1.6, 0.38, 0.04, 4, 1, 1);
      bandGeo.translate(mx + 0.8, 3.5, mz);
      const meshBand = M.pieza(bandGeo, `BanderolaViento_${idx}`, 4, 1);
      meshBand.material = clayMaterial.clone();
      meshBand.material.color.setHex(0x93c5fd); // Celeste Viento
      g.add(meshBand);
    });

    // ---------------- 6. ANIMACIONES DE OLEAJE Y VIENTO ----------------
    function giro(nombreHueso, dur, fn, n = 32) {
      const tiempos = [], valores = [];
      const q = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YXZ');
      for (let i = 0; i <= n; i++) {
        const [x, y, z] = fn(i / n);
        eu.set(x * grad, y * grad, z * grad);
        q.setFromEuler(eu);
        tiempos.push(i * (dur / n));
        valores.push(q.x, q.y, q.z, q.w);
      }
      return new THREE.QuaternionKeyframeTrack(`Hueso${nombreHueso}.quaternion`, tiempos, valores);
    }
    const sen = (t, k = 1) => Math.sin(2 * Math.PI * k * t);
    const cos = (t, k = 1) => Math.cos(2 * Math.PI * k * t);

    const dB = 5.0;
    const brisa = new THREE.AnimationClip('Brisa Marina', dB, [
      giro('VientoMastil1', dB, (t) => [0.8 * sen(t, 2), 0, 1.2 * cos(t, 2)]),
      giro('VientoMastil2', dB, (t) => [0.9 * cos(t, 2), 0, 1.4 * sen(t, 2)]),
      giro('MuelleNorte', dB, (t) => [0.2 * sen(t), 0, 0.15 * cos(t)]),
      giro('MuelleSur', dB, (t) => [0.2 * cos(t), 0, 0.15 * sen(t)])
    ]);

    const dM = 3.2;
    const marea = new THREE.AnimationClip('Marea Alta', dM, [
      giro('MuelleNorte', dM, (t) => [0.6 * sen(t), 0, 0.5 * cos(t)]),
      giro('MuelleSur', dM, (t) => [0.6 * cos(t), 0, 0.5 * sen(t)]),
      giro('VientoMastil1', dM, (t) => [2.0 * sen(t, 3), 0, 1.8 * cos(t, 3)])
    ]);

    const dR = 5.0;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('PuertoCentro', dR, (t) => [0.01 * sen(t), 0, 0.01 * cos(t)])
    ]);

    g.animations = [brisa, marea, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombreH]) => 'Hueso' + nombreH);

    return g;
  }
});

