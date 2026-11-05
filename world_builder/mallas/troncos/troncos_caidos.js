/**
 * Troncos Caídos — dos troncos tumbados uno junto al otro (cortes con anillos al frente),
 * el delantero partido en astillas al fondo, ramas secas, hongos y una rama suelta en el suelo.
 * Origen: assets/arboles/imagenes/Gemini_Generated_Image_54ntb054ntb054nt.png
 * Medidas aprox.: 4,6 m de largo × 1,4 m de ancho.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) con paleta extraída de la ilustración original:
 *       • Corteza de roble/pino caída con surcos oscuros, tonos nogal y manto aterciopelado de musgo verde.
 *       • Secciones transversales con anillos concéntricos hiperdetallados (médula oscura, duramen dorado y albura clara).
 *       • Astillas rotas con fibras de madera viva desgarrada e intersticios de sombra profunda.
 *       • Hongos repisa con sombreros ocre/naranja y ribete crema nacarado.
 *       • Ramas secas desnudas con matices gris plateado y pátina de líquen.
 *   - Esqueleto y articulaciones (THREE.Bone) para ramas secas, ramitas y racimos de hongos.
 *   - Animaciones orgánicas de viento ('Brisa Suave', 'Viento Fuerte', 'Reposo').
 */
registrarMalla({
  id: 'troncos_caidos',
  categoria: 'troncos',
  nombre: 'Troncos Caídos',
  icono: '🪵',
  origen: 'assets/arboles/imagenes/Gemini_Generated_Image_54ntb054ntb054nt.png',

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
      ['TroncoBase', 'Raiz', 0, 0.35, 0],

      // Ramas secas del tronco trasero (vibran y oscilan con el viento)
      ['RamaSecaBase', 'TroncoBase', -1.15, 0.61, -0.52],
      ['RamaSecaPunta', 'RamaSecaBase', -0.85, 1.68, -0.37],
      ['RamitaSeca', 'RamaSecaBase', -0.40, 1.38, -0.42],

      // Ramas sueltas en el suelo (horquilla y extremos delgados)
      ['RamaSueloHorq', 'TroncoBase', 1.50, 0.60, 0.50],
      ['RamaSueloPunta', 'RamaSueloHorq', 1.75, 1.00, 0.35],
      ['RamaSueloExtr', 'TroncoBase', 2.50, 0.60, 0.85],

      // Hongos (micro-vibración orgánica)
      ['HongosVib', 'TroncoBase', -0.15, 0.40, 0.10]
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

    const colgar = (nombre, obj) => {
      const h = typeof nombre === 'string' ? hueso[nombre] : nombre;
      if (!h || !obj) return obj;
      h.attach(obj);
      return obj;
    };

    const corteza = (ang, u) => 1 + 0.022 * Math.sin(ang * 13 + u * 2) + 0.03 * Math.sin(ang * 3 + 0.7) + 0.015 * Math.sin(ang * 7 + u * 5);

    // ---------------- 2. TRONCO TRASERO ----------------
    const posTrasero = V(-0.6, 0.33, -0.52);
    const radioTrasero = 0.33;
    const largoTrasero = 3.0;
    const trasero = new THREE.Group();
    trasero.position.copy(posTrasero);
    g.add(trasero);

    const meshTroncoTrasero = M.cilindroTumbado(radioTrasero, largoTrasero, { perfil: corteza, segRadio: 18, segLargo: 10, nombre: 'TroncoTrasero' });
    trasero.add(meshTroncoTrasero);

    const anillosTrasFrente = M.anillos(0.03, radioTrasero, -largoTrasero / 2, { perfil: corteza, u: 0, anillos: 5, nombre: 'AnillosTraseroFrente' });
    trasero.add(anillosTrasFrente);

    const anillosTrasFondo = M.anillos(0.03, radioTrasero, largoTrasero / 2, { perfil: corteza, u: 1, anillos: 3, nombre: 'AnillosTraseroFondo' });
    trasero.add(anillosTrasFondo);

    // Rama seca con horquilla
    const meshRamaSeca = M.tubo([[-0.55, 0.28, 0], [-0.45, 0.75, 0.08], [-0.25, 1.35, 0.15]], 0.07, 0.02, { segLargo: 8, segRadio: 6, nombre: 'RamaSeca' });
    colgar('RamaSecaBase', meshRamaSeca);

    const meshRamita = M.tubo([[-0.45, 0.75, 0.08], [-0.1, 0.95, 0.1], [0.2, 1.05, 0.1]], 0.035, 0.012, { segLargo: 6, segRadio: 5, nombre: 'Ramita' });
    colgar('RamitaSeca', meshRamita);

    const hongoTrasero = M.hongo(-0.15, 0.3, 0.02, 0.1);
    colgar('HongosVib', hongoTrasero);

    // ---------------- 3. TRONCO DELANTERO ----------------
    const posDelantero = V(0.2, 0.42, 0.35);
    const radioDelantero = 0.42;
    const largoDelantero = 3.7;
    const delantero = new THREE.Group();
    delantero.position.copy(posDelantero);
    g.add(delantero);

    const meshTroncoDelantero = M.cilindroTumbado(radioDelantero, largoDelantero, {
      perfil: corteza, astillado: 0.55, semilla: 14, segRadio: 24, segLargo: 12, nombre: 'TroncoDelanteroAstillado'
    });
    delantero.add(meshTroncoDelantero);

    const anillosDelant = M.anillos(0.03, radioDelantero, -largoDelantero / 2, { perfil: corteza, u: 0, anillos: 6, nombre: 'AnillosDelantero' });
    delantero.add(anillosDelant);

    const fondoAstillado = M.anillos(0.03, 0.4, 1.7, { perfil: corteza, u: 1, anillos: 3, nombre: 'FondoAstillado' });
    delantero.add(fondoAstillado);

    const hongoD1 = M.hongo(-0.7, 0.4, 0.05, 0.13);
    const hongoD2 = M.hongo(-0.45, 0.4, -0.06, 0.1);
    const hongoD3 = M.hongo(0.5, 0.36, 0.14, 0.12, -0.25);
    colgar('HongosVib', hongoD1);
    colgar('HongosVib', hongoD2);
    colgar('HongosVib', hongoD3);

    // ---------------- 4. RAMA SUELTA EN EL SUELO ----------------
    const meshRamaSuelta = M.tubo([[0.3, 0.1, 1.0], [1.2, 0.14, 0.75], [2.4, 0.18, 0.4]], 0.1, 0.035, { segLargo: 10, segRadio: 7, nombre: 'RamaSuelta' });
    g.add(meshRamaSuelta);

    const meshRamaSueltaHorq = M.tubo([[1.2, 0.14, 0.75], [1.5, 0.6, 0.5], [1.75, 1.0, 0.35]], 0.05, 0.02, { segLargo: 6, segRadio: 6, nombre: 'RamaSueltaHorquilla' });
    colgar('RamaSueloHorq', meshRamaSueltaHorq);

    const meshRamaSueltaPunta = M.tubo([[1.7, 0.18, 0.55], [2.1, 0.45, 0.75], [2.5, 0.6, 0.85]], 0.04, 0.015, { segLargo: 6, segRadio: 5, nombre: 'RamaSueltaPunta' });
    colgar('RamaSueloExtr', meshRamaSueltaPunta);

    g.updateMatrixWorld(true);

    // ---------------- 5. PINTURA ARTÍSTICA POR VÉRTICE (M.pintar) ----------------
    // Paleta fiel a Gemini_Generated_Image_54ntb054ntb054nt.png
    const COL_CORTEZA_PROF = C(0x241812);    // Sombra de surcos profundos de corteza
    const COL_CORTEZA_BASE = C(0x4a3424);    // Pardo madera roble seco
    const COL_CORTEZA_CALIDA = C(0x6a4c35);  // Resalte cálido de corteza
    const COL_CORTEZA_GRIS = C(0x5a5046);    // Corteza intemperizada ceniza

    const COL_MUSGO_OSCURO = C(0x324d1c);    // Musgo de sombra húmedo
    const COL_MUSGO_VIVO = C(0x567e2a);      // Manto de musgo verde bosque
    const COL_MUSGO_LUZ = C(0x7ea83c);       // Borde de musgo iluminado por el sol

    const COL_MADERA_DURAMEN = C(0x764c24);  // Centro oscuro de anillos
    const COL_MADERA_MEDIA = C(0xb88850);    // Anillos medios cálidos
    const COL_MADERA_ALBURA = C(0xdcb57d);   // Madera fresca / albura clara
    const COL_ASTILLA_VIVA = C(0xe6c58e);    // Fibras desgarradas iluminadas

    const COL_HONGO_SOMBRERO = C(0xce7326);  // Sombrero ocre anaranjado de seta
    const COL_HONGO_CENTRO = C(0x9a4816);    // Centro tostado del sombrero
    const COL_HONGO_BORDE = C(0xf3e5cb);     // Borde crema claro
    const COL_HONGO_PIE = C(0xd6cbb8);       // Pie claro de hongo

    // Pintar corteza de troncos con surcos longitudinales y manto superior de musgo
    const pintarCortezaTronco = (mesh, centroY, radio, esAstillado) => {
      M.pintar(mesh, (i, p) => {
        const dy = (p.y - centroY) / radio;
        const estria = Math.sin(p.x * 12 + p.z * 18);
        const estriaFina = Math.sin(p.x * 32);

        // Color base de corteza con vetas
        let col = mezclar(COL_CORTEZA_BASE, COL_CORTEZA_CALIDA, 0.5 + 0.5 * estria);
        col = mezclar(col, COL_CORTEZA_PROF, suave(0.2, -0.6, dy)); // Sombra inferior de suelo
        if (estriaFina > 0.4) col = mezclar(col, COL_CORTEZA_GRIS, 0.35);

        // Manto de musgo en la parte superior donde da la luz y humedad
        const ruidoMusgo = 0.25 * Math.sin(p.x * 5.2 + 1.2) + 0.15 * Math.sin(p.z * 7.4);
        const factorMusgo = suave(0.15 + ruidoMusgo, 0.75 + ruidoMusgo, dy);
        if (factorMusgo > 0) {
          const colMusgo = (dy > 0.7 && estria > 0.2) ? COL_MUSGO_LUZ : (estria > 0 ? COL_MUSGO_VIVO : COL_MUSGO_OSCURO);
          col = mezclar(col, colMusgo, factorMusgo * 0.92);
        }

        // Astillas en el extremo roto (+X del tronco delantero)
        if (esAstillado && p.x > 1.3) {
          const factorAstillado = suave(1.3, 2.3, p.x);
          const fibra = Math.sin(p.z * 35 + p.y * 25);
          const colFibra = fibra > 0.1 ? COL_ASTILLA_VIVA : COL_MADERA_DURAMEN;
          col = mezclar(col, colFibra, factorAstillado * 0.85);
        }

        return col;
      }, g);
    };

    pintarCortezaTronco(meshTroncoTrasero, posTrasero.y, radioTrasero, false);
    pintarCortezaTronco(meshTroncoDelantero, posDelantero.y, radioDelantero, true);

    // Pintar anillos concéntricos en cortes transversales
    const pintarAnillosCorte = (mesh, centroY, centroZ, radioMax) => {
      M.pintar(mesh, (i, p) => {
        const rho = Math.hypot(p.y - centroY, p.z - centroZ) / radioMax;
        const anillo = 0.5 + 0.5 * Math.sin(rho * 38);
        const anilloFino = 0.5 + 0.5 * Math.sin(rho * 80);

        let col = mezclar(COL_MADERA_MEDIA, COL_MADERA_ALBURA, anillo);
        col = mezclar(col, COL_MADERA_DURAMEN, 1 - suave(0.0, 0.45, rho)); // Médula central
        if (anilloFino > 0.6) col = mezclar(col, COL_CORTEZA_PROF, 0.3); // Línea estacional oscura
        if (rho > 0.88) col = mezclar(col, COL_CORTEZA_PROF, suave(0.88, 1.0, rho)); // Borde de corteza

        return col;
      }, g);
    };

    pintarAnillosCorte(anillosTrasFrente, posTrasero.y, posTrasero.z, radioTrasero);
    pintarAnillosCorte(anillosTrasFondo, posTrasero.y, posTrasero.z, radioTrasero);
    pintarAnillosCorte(anillosDelant, posDelantero.y, posDelantero.z, radioDelantero);
    pintarAnillosCorte(fondoAstillado, posDelantero.y, posDelantero.z, 0.4);

    // Pintar ramas secas (madera descortezada y grisácea)
    const pintarRama = (mesh) => {
      M.pintar(mesh, (i, p) => {
        const veta = Math.sin(p.y * 25 + p.x * 12);
        let col = mezclar(COL_CORTEZA_GRIS, COL_CORTEZA_BASE, 0.4 + 0.3 * veta);
        if (p.y > 1.2) col = mezclar(col, COL_MADERA_ALBURA, 0.3); // Puntas más claras
        if (p.y < 0.6 && p.z > 0.3) col = mezclar(col, COL_MUSGO_OSCURO, 0.4); // Musgo basal
        return col;
      }, g);
    };

    [meshRamaSeca, meshRamita, meshRamaSuelta, meshRamaSueltaHorq, meshRamaSueltaPunta].forEach(pintarRama);

    // Pintar hongos
    const pintarSetas = (grupoHongo) => {
      grupoHongo.traverse((o) => {
        if (!o.isMesh) return;
        if (o.name === 'SombreroHongo') {
          M.pintar(o, (i, p) => {
            const radioSombrero = Math.hypot(p.x, p.z);
            let col = mezclar(COL_HONGO_CENTRO, COL_HONGO_SOMBRERO, suave(0, 0.05, radioSombrero));
            if (p.y < 0.02 || radioSombrero > 0.05) col = mezclar(col, COL_HONGO_BORDE, 0.85);
            return col;
          }, g);
        } else if (o.name === 'PieHongo') {
          M.pintar(o, (i, p) => mezclar(COL_CORTEZA_PROF, COL_HONGO_PIE, suave(0.0, 0.08, p.y)), g);
        }
      });
    };

    [hongoTrasero, hongoD1, hongoD2, hongoD3].forEach(pintarSetas);

    // ---------------- 6. ANIMACIONES DE VIENTO Y AMBIENTE ----------------
    function giro(nombre, dur, fn, n = 32) {
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
      return new THREE.QuaternionKeyframeTrack(`Hueso${nombre}.quaternion`, tiempos, valores);
    }

    const sen = (t, k = 1) => Math.sin(2 * Math.PI * k * t);
    const cos = (t, k = 1) => Math.cos(2 * Math.PI * k * t);

    // Brisa Suave: oscilación plácida de las ramas secas y micro-vaivén de setas
    const dB = 4.6;
    const brisa = new THREE.AnimationClip('Brisa Suave', dB, [
      giro('RamaSecaBase', dB, (t) => [0.8 * sen(t), 0, 1.2 * cos(t)]),
      giro('RamaSecaPunta', dB, (t) => [1.6 * sen(t), 0.5 * cos(t, 2), 2.4 * cos(t)]),
      giro('RamitaSeca', dB, (t) => [1.9 * cos(t), 0, -2.1 * sen(t)]),

      giro('RamaSueloHorq', dB, (t) => [1.1 * sen(t), 0, 0.9 * cos(t)]),
      giro('RamaSueloPunta', dB, (t) => [2.0 * sen(t), 0, 1.8 * cos(t)]),
      giro('RamaSueloExtr', dB, (t) => [1.5 * cos(t), 0, -1.3 * sen(t)]),

      giro('HongosVib', dB, (t) => [0.4 * sen(t, 2), 0, 0.3 * cos(t, 2)])
    ]);

    // Viento Fuerte: ráfagas que hacen cimbrar las ramas secas y silbar el aire
    const dV = 3.0;
    const viento = new THREE.AnimationClip('Viento Fuerte', dV, [
      giro('RamaSecaBase', dV, (t) => [2.5 * sen(t), 0, 3.8 * sen(t)]),
      giro('RamaSecaPunta', dV, (t) => [5.2 * sen(t), 1.2 * cos(t, 2), 6.5 * sen(t)]),
      giro('RamitaSeca', dV, (t) => [5.8 * cos(t), 0, -6.2 * sen(t)]),

      giro('RamaSueloHorq', dV, (t) => [3.2 * sen(t), 0, 3.6 * sen(t)]),
      giro('RamaSueloPunta', dV, (t) => [6.0 * sen(t), 0, 5.5 * sen(t)]),
      giro('RamaSueloExtr', dV, (t) => [4.5 * cos(t), 0, -4.0 * sen(t)]),

      giro('HongosVib', dV, (t) => [1.4 * sen(t, 3), 0, 1.1 * cos(t, 3)])
    ]);

    // Reposo: micro-vibración ambiental casi estática
    const dR = 5.5;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('RamaSecaBase', dR, (t) => [0.25 * sen(t), 0, 0.35 * cos(t)]),
      giro('RamaSecaPunta', dR, (t) => [0.50 * sen(t), 0, 0.65 * cos(t)]),
      giro('RamitaSeca', dR, (t) => [0.55 * cos(t), 0, -0.60 * sen(t)]),

      giro('RamaSueloHorq', dR, (t) => [0.30 * sen(t), 0, 0.25 * cos(t)]),
      giro('RamaSueloPunta', dR, (t) => [0.60 * sen(t), 0, 0.50 * cos(t)]),
      giro('RamaSueloExtr', dR, (t) => [0.45 * cos(t), 0, -0.35 * sen(t)]),

      giro('HongosVib', dR, (t) => [0.15 * sen(t), 0, 0.10 * cos(t)])
    ]);

    g.animations = [brisa, viento, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
