/**
 * Terreno de la Aldea — Malla procedural de terreno para asentamiento con red vial y solares edificables.
 * Diseñado para conectarse al borde este (+X) del bosque de la Ruta 1.
 *
 * Características principales:
 *   - Dos caminos principales que emergen fluidamente desde el bosque:
 *       • Camino Norte (Sendero del Bosque y la Montaña): entra desde z = -2.2
 *       • Camino Sur (Sendero de la Floresta y Arboleda): entra desde z = +5.8
 *   - Plaza Mayor central (Plaza de la Aldea) con pavimento de adoquín/tierra y pozo comunal rústico.
 *   - 6 Solares / parcelas de construcción perfectamente niveladas (y = +0.06m a +0.08m)
 *     para que el agente de edificaciones emplace las viviendas, talleres y tiendas.
 *   - Relieve perimetral de suaves lomas al norte, este y sur que abrazan y resguardan el valle.
 *   - Transición oeste limpia en y = 0.00m con cota cero exacta, garantizando continuidad con el bosque.
 *   - Pintura por vértice (M.pintar) con paleta coordinada de arcilla/tierra/hierba y wireframe quads limpio.
 *   - Esqueleto articulado THREE.Bone y animaciones sutiles de entorno ('Brisa de Aldea', 'Pisada Dino', 'Reposo').
 */
registrarMalla({
  id: 'terreno_aldea',
  categoria: 'terrenos',
  nombre: 'Terreno de la Aldea',
  icono: '🏡',
  origen: 'Valle de la Aldea — Solares y Caminos',

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
      ['AldeaCentro', 'Raiz', 0.00, 0.00, 0.00],
      ['PlazaMayor', 'AldeaCentro', 2.50, 0.00, 1.50],
      ['ColinaNorte', 'AldeaCentro', 2.00, 1.10, -11.50],
      ['ColinaEste', 'AldeaCentro', 13.50, 1.20, 0.00],
      ['ColinaSur', 'AldeaCentro', 2.00, 0.95, 11.50],
      ['PozoAgua', 'PlazaMayor', 0.00, 0.35, 0.00]
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

    // ---------------- 2. MODELADO TOPOGRÁFICO DE LA MALLA ----------------
    const ancho = 32.0; // Eje X: [-16.0, +16.0]
    const fondo = 28.0; // Eje Z: [-14.0, +14.0]
    const cols = M.seg(64, 32);
    const rows = M.seg(56, 28);

    const geo = new THREE.PlaneGeometry(ancho, fondo, cols, rows);
    geo.rotateX(-Math.PI / 2);

    // Definición de las líneas de caminos de la red vial
    const RED_CAMINOS = [
      // Camino 1: Norte (salida directa del bosque norte hacia la plaza)
      [[-16.0, -2.2], [-11.0, -2.2], [-6.0, -1.8], [-1.0, -0.2], [2.5, 1.5]],
      // Camino 2: Sur (salida directa del bosque sur hacia la plaza)
      [[-16.0, 5.8], [-11.0, 5.5], [-6.0, 4.2], [-1.0, 2.8], [2.5, 1.5]],
      // Avenida Principal Este (conecta la plaza con los solares orientales y el mirador)
      [[2.5, 1.5], [8.0, 1.5], [14.5, 1.5]],
      // Callejón Norte (acceso a solares Noroeste y Norte)
      [[-6.0, -1.8], [-5.5, -4.8], [-5.5, -7.5]],
      [[-5.5, -4.8], [4.5, -4.8], [4.5, -7.5]],
      // Callejón Sur (acceso a solar Suroeste)
      [[-6.0, 4.2], [-3.0, 6.0], [-3.0, 8.5]],
      // Callejón Sureste (acceso a solar Sureste)
      [[8.0, 1.5], [10.5, 4.5], [10.5, 7.0]]
    ];

    function distPuntoSegmento(px, pz, ax, az, bx, bz) {
      const dx = bx - ax;
      const dz = bz - az;
      const lenSq = dx * dx + dz * dz;
      if (lenSq === 0) return Math.hypot(px - ax, pz - az);
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
      return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
    }

    function distPolilinea(px, pz, pts) {
      let minD = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = distPuntoSegmento(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        if (d < minD) minD = d;
      }
      return minD;
    }

    function calcDistCamino(x, z) {
      const dPlaza = Math.hypot(x - 2.5, z - 1.5);
      if (dPlaza < 3.4) return Math.max(0, dPlaza - 2.6);
      let minDist = Infinity;
      for (let i = 0; i < RED_CAMINOS.length; i++) {
        const d = distPolilinea(x, z, RED_CAMINOS[i]);
        if (d < minDist) minDist = d;
      }
      return minDist;
    }

    // 6 Solares/Terrazas niveladas listas para emplazamiento de casas
    const SOLARES = [
      { id: 'Solar Noroeste', cx: -6.5, cz: -7.5, rx: 2.8, rz: 2.3, y: 0.06 },
      { id: 'Solar Norte Central', cx: 4.5, cz: -7.5, rx: 3.2, rz: 2.6, y: 0.06 },
      { id: 'Solar Nordeste', cx: 11.5, cz: -5.5, rx: 2.6, rz: 2.3, y: 0.08 },
      { id: 'Solar Sureste', cx: 10.5, cz: 7.0, rx: 3.2, rz: 2.6, y: 0.06 },
      { id: 'Solar Suroeste', cx: -3.0, cz: 8.5, rx: 2.6, rz: 2.2, y: 0.06 },
      { id: 'Solar Plaza Este', cx: 8.5, cz: -0.8, rx: 2.5, rz: 2.2, y: 0.05 }
    ];

    function calcSolarFactor(x, z) {
      let maxF = 0;
      let targetY = 0;
      let solarId = null;
      for (let i = 0; i < SOLARES.length; i++) {
        const s = SOLARES[i];
        const dx = Math.abs(x - s.cx);
        const dz = Math.abs(z - s.cz);
        if (dx < s.rx + 0.6 && dz < s.rz + 0.6) {
          const fx = Math.max(0, Math.min(1, (s.rx + 0.6 - dx) / 0.6));
          const fz = Math.max(0, Math.min(1, (s.rz + 0.6 - dz) / 0.6));
          const f = fx * fz;
          if (f > maxF) {
            maxF = f;
            targetY = s.y;
            solarId = s.id;
          }
        }
      }
      return { factor: maxF, targetY, solarId };
    }

    function calcAltura(x, z) {
      let y = 0.0;

      // Lomas perimetrales suaves (norte, este, sur) para abrigar la aldea
      if (z < -9.0 && x > -12.0) {
        const fN = Math.min(1, (-9.0 - z) / 4.8);
        const factorColina = fN * fN * (3 - 2 * fN);
        y += factorColina * (1.15 + 0.16 * Math.sin(x * 0.45));
      }
      if (x > 11.0) {
        const fE = Math.min(1, (x - 11.0) / 4.8);
        const factorColina = fE * fE * (3 - 2 * fE);
        y += factorColina * (1.25 + 0.20 * Math.cos(z * 0.40));
      }
      if (z > 9.0 && x > -11.0) {
        const fS = Math.min(1, (z - 9.0) / 4.8);
        const factorColina = fS * fS * (3 - 2 * fS);
        y += factorColina * (1.05 + 0.14 * Math.sin(x * 0.55));
      }

      // Redondeo orgánico de esquinas exteriores para eliminar bordes rectos
      if (x > 8.0 && z < -7.0) {
        const dCorner = Math.hypot(x - 8.0, z - (-7.0));
        if (dCorner > 5.5) y += (dCorner - 5.5) * 0.25;
      }
      if (x > 8.0 && z > 7.0) {
        const dCorner = Math.hypot(x - 8.0, z - 7.0);
        if (dCorner > 5.5) y += (dCorner - 5.5) * 0.25;
      }

      // Zona de acceso al mar al este (caleta / bajada suave a la orilla)
      if (x > 8.0 && Math.abs(z - 1.5) < 4.2) {
        const dRampaX = Math.max(0, Math.min(1, (x - 8.0) / 8.5));
        const fAncho = Math.cos(((z - 1.5) / 4.2) * (Math.PI / 2));
        const fRampa = dRampaX * Math.max(0, fAncho);
        y = y * (1.0 - fRampa) + (-0.14) * fRampa;
      }

      // Vaguada natural sutil y ligera depresión en caminos transitados
      const dCam = calcDistCamino(x, z);
      const radioCamino = 1.25;
      if (dCam < radioCamino) {
        const fCam = 1.0 - dCam / radioCamino;
        y -= fCam * 0.07;
      }

      // Nivelado perfecto de los solares de construcción
      const sol = calcSolarFactor(x, z);
      if (sol.factor > 0) {
        y = y * (1.0 - sol.factor) + sol.targetY * sol.factor;
      }

      // Costura oeste orgánica curvada con el bosque (elimina uniones rectas)
      const ondaCostura = 1.5 * Math.sin(z * 0.42);
      const limCostura = -11.5 + ondaCostura;
      if (x < limCostura) {
        const tCostura = Math.max(0, Math.min(1, (x - (limCostura - 4.5)) / 4.5));
        y *= (tCostura * tCostura * (3 - 2 * tCostura));
      }

      return y;
    }

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = calcAltura(x, z);
      pos.setY(i, y);
    }
    geo.computeVertexNormals();

    const mallaTerreno = M.pieza(geo, 'TerrenoAldeaBase', cols, rows);
    g.add(mallaTerreno);

    // ---------------- 3. PINTURA POR VÉRTICE (M.pintar) ----------------
    // Paleta de materiales y naturaleza
    const COL_PRADERA_BASE = C(0x44862a);
    const COL_PRADERA_VIVA = C(0x5ca635);
    const COL_TIERRA_CAMINO = C(0xc39356);
    const COL_HUELLA_RUEDA = C(0xaf7e44);
    const COL_BORDE_CAMINO = C(0x84993e);
    const COL_ADOQUIN_PLAZA = C(0x9a8a7a);
    const COL_JUNTA_PLAZA = C(0xb8905a);
    const COL_SOLAR_GRAVA = C(0xa98450);
    const COL_ROCA_COLINA = C(0x7c7365);

    M.pintar(mallaTerreno, (i, p) => {
      const x = p.x;
      const z = p.z;
      const y = p.y;

      const dCam = calcDistCamino(x, z);
      const dPlaza = Math.hypot(x - 2.5, z - 1.5);
      const sol = calcSolarFactor(x, z);

      // Acceso al mar al este: playa / caleta de arena dorada
      if (x > 8.0 && Math.abs(z - 1.5) < 4.5 && y <= 0.22) {
        const fPlaya = Math.min(1, (x - 8.0) / 5.5);
        const colPlaya = C(0xdfc89e).lerp(C(0xbda478), Math.max(0, (0.22 - y) / 0.35));
        if (y < -0.05) colPlaya.lerp(C(0x0ea5e9), 0.45);
        return mezclar(COL_PRADERA_BASE, colPlaya, fPlaya);
      }

      // A. Plaza Central de la Aldea
      if (dPlaza < 3.8) {
        const fP = Math.min(1, (3.8 - dPlaza) / 0.9);
        const patronLosa = Math.sin(x * 5.2) * Math.cos(z * 5.2);
        const colPlaza = mezclar(COL_ADOQUIN_PLAZA, COL_JUNTA_PLAZA, 0.45 + 0.35 * patronLosa);
        if (dPlaza < 1.35) {
          // Anillo empedrado concéntrico del brocal del pozo
          const colBrocalPiso = C(0x7e7062);
          colPlaza.lerp(colBrocalPiso, 0.65);
        }
        return mezclar(COL_PRADERA_BASE, colPlaza, fP);
      }

      // B. Caminos y senderos transitados
      if (dCam < 1.40) {
        const fCamino = Math.min(1, (1.40 - dCam) / 0.55);
        let colCam = COL_TIERRA_CAMINO.clone();
        if (dCam < 0.55) {
          // Huella central más comprimida
          colCam = mezclar(COL_HUELLA_RUEDA, COL_TIERRA_CAMINO, dCam / 0.55);
        } else if (dCam > 0.95) {
          // Borde de hierba pisada y polvo
          const fVerge = (dCam - 0.95) / 0.45;
          colCam = mezclar(COL_TIERRA_CAMINO, COL_BORDE_CAMINO, fVerge);
        }
        return mezclar(COL_PRADERA_BASE, colCam, fCamino);
      }

      // C. Solares / Terrazas de edificación
      if (sol.factor > 0) {
        const patronSolar = Math.sin(x * 3.8 + z * 3.8) * 0.15;
        const colSolar = mezclar(COL_SOLAR_GRAVA, C(0x917142), 0.5 + patronSolar);
        return mezclar(COL_PRADERA_BASE, colSolar, sol.factor);
      }

      // D. Pradera general y lomas perimetrales
      const ruidoPasto = 0.08 * Math.sin(x * 1.6) * Math.cos(z * 1.4) + 0.04 * Math.sin(x * 3.5);
      let colPasto = mezclar(COL_PRADERA_BASE, COL_PRADERA_VIVA, 0.5 + ruidoPasto);

      if (y > 0.95) {
        const factorRoca = Math.min(1, (y - 0.95) / 0.90);
        colPasto = mezclar(colPasto, COL_ROCA_COLINA, factorRoca * 0.60);
      }

      return colPasto;
    }, g);

    // ---------------- 4. ELEMENTOS EMBLEMÁTICOS DE LA PLAZA ----------------
    // Pozo Comunal de la Aldea (en el centro de la Plaza Mayor)
    const px = 2.5;
    const pz = 1.5;

    // A. Brocal de piedra tallada
    const brocalGeo = new THREE.CylinderGeometry(0.95, 1.05, 0.70, M.seg(16, 10), 1, true);
    brocalGeo.translate(px, 0.35, pz);
    const meshBrocal = M.pieza(brocalGeo, 'BrocalPozo', M.seg(16, 10), 1);
    meshBrocal.material = M.materialFacetado();
    if (typeof applyRenderStyleToMesh === 'function') applyRenderStyleToMesh(meshBrocal);
    g.add(meshBrocal);

    // Borde superior redondeado del pozo
    const aroBrocal = M.aro(px, 0.70, pz, 1.00, 1.00, 0.12, 'BordePozo');
    aroBrocal.material = M.materialFacetado();
    if (typeof applyRenderStyleToMesh === 'function') applyRenderStyleToMesh(aroBrocal);
    g.add(aroBrocal);

    // B. Lámina de agua translúcida dentro del pozo
    const aguaPozoGeo = new THREE.CircleGeometry(0.85, M.seg(16, 8));
    aguaPozoGeo.rotateX(-Math.PI / 2);
    aguaPozoGeo.translate(px, 0.28, pz);
    const matAguaPozo = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      roughness: 0.15,
      metalness: 0.10
    });
    const meshAguaPozo = new THREE.Mesh(aguaPozoGeo, matAguaPozo);
    meshAguaPozo.name = 'AguaPozo';
    g.add(meshAguaPozo);

    // C. Estructura de vigas de madera y techumbre a dos aguas
    const posteIzq = M.tubo([[px, 0.0, pz - 0.95], [px, 1.95, pz - 0.95]], 0.08, 0.07, { nombre: 'PostePozoIzq' });
    const posteDer = M.tubo([[px, 0.0, pz + 0.95], [px, 1.95, pz + 0.95]], 0.08, 0.07, { nombre: 'PostePozoDer' });
    const travesano = M.tubo([[px, 1.85, pz - 1.05], [px, 1.85, pz + 1.05]], 0.07, 0.07, { nombre: 'TravesanoPozo' });
    g.add(posteIzq);
    g.add(posteDer);
    g.add(travesano);

    // Tejadillo rústico a dos aguas del pozo
    const vigaCumbrera = M.tubo([[px - 0.70, 2.25, pz], [px + 0.70, 2.25, pz]], 0.06, 0.06, { nombre: 'CumbreraPozo' });
    const faldonNorte = M.tubo([[px - 0.65, 1.85, pz - 1.05], [px + 0.65, 1.85, pz - 1.05]], 0.05, 0.05, { nombre: 'AleroNorte' });
    const faldonSur = M.tubo([[px - 0.65, 1.85, pz + 1.05], [px + 0.65, 1.85, pz + 1.05]], 0.05, 0.05, { nombre: 'AleroSur' });
    g.add(vigaCumbrera);
    g.add(faldonNorte);
    g.add(faldonSur);

    // Guijarros y piedras de borde en el perímetro de la plaza
    M.guijarros(g, [
      [px + 2.8, pz - 1.8, 0.22, 0.16],
      [px + 3.1, pz - 1.5, 0.15, 0.12],
      [px - 2.6, pz + 2.2, 0.20, 0.14],
      [px + 3.5, pz + 2.0, 0.24, 0.17],
      [-10.5, -2.9, 0.26, 0.18],
      [-10.8, 6.4, 0.25, 0.17]
    ]);

    // ---------------- 5. ANIMACIONES SUTILES ----------------
    function giro(nombreHueso, dur, fn, n = 32) {
      const tiempos = [];
      const valores = [];
      const q = new THREE.Quaternion();
      const eu = new THREE.Euler(0, 0, 0, 'YXZ');
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

    // Brisa de Aldea: oscilación sutil y orgánica en las lomas y el entorno
    const dB = 6.0;
    const brisa = new THREE.AnimationClip('Brisa de Aldea', dB, [
      giro('ColinaNorte', dB, (t) => [0.18 * sen(t), 0, 0.12 * cos(t)]),
      giro('ColinaEste', dB, (t) => [0.15 * cos(t), 0, 0.18 * sen(t)]),
      giro('ColinaSur', dB, (t) => [-0.16 * sen(t), 0, -0.14 * cos(t)]),
      giro('PlazaMayor', dB, (t) => [0.03 * sen(t, 2), 0, 0.03 * cos(t, 2)])
    ]);

    // Pisada Dino: ligera vibración geológica por pisada colosal
    const dP = 1.8;
    const decae = (t) => Math.exp(-3.5 * t);
    const pisada = new THREE.AnimationClip('Pisada Dino', dP, [
      giro('AldeaCentro', dP, (t) => [1.2 * sen(t, 5) * decae(t), 0, 0.8 * cos(t, 5) * decae(t)]),
      giro('ColinaNorte', dP, (t) => [-1.8 * cos(t, 5) * decae(t), 0, -1.2 * sen(t, 5) * decae(t)]),
      giro('ColinaEste', dP, (t) => [1.6 * sen(t, 5) * decae(t), 0, 1.4 * cos(t, 5) * decae(t)]),
      giro('ColinaSur', dP, (t) => [1.5 * cos(t, 5) * decae(t), 0, -1.1 * sen(t, 5) * decae(t)])
    ]);

    // Reposo: postura calma
    const dR = 5.0;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('AldeaCentro', dR, (t) => [0.02 * sen(t), 0, 0.02 * cos(t)])
    ]);

    g.animations = [brisa, pisada, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombreH]) => 'Hueso' + nombreH);

    return g;
  }
});

