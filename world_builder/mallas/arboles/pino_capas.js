/**
 * Pino Cónico en Capas — pino estilizado con faldas cónicas escalonadas y topología de quads.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar):
 *       • Tronco en corteza de pino de montaña con estrías y musgo basal.
 *       • Faldas cónicas con degradado de pino alpino (sombra profunda en la base de cada falda,
 *         cuerpo verde bosque y borde superior soleado con reflejos de acícula fresca).
 *   - Esqueleto articulado de 5 huesos con piel deformable en tronco (M.pielConHuesos)
 *     y vaivén elástico en cada nivel cónico.
 *   - Animaciones orgánicas de viento (Brisa Suave, Viento Fuerte, Reposo Zen).
 */
registrarMalla({
  id: 'pino_capas',
  categoria: 'arboles',
  nombre: 'Pino en Capas',
  icono: '🌲',
  origen: 'procedural/ruta_1',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const grad = Math.PI / 180;
    const radialSegs = M.seg(16, 10);
    const heightSegs = M.seg(4, 3);
    const tiers = 3;

    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    // ---------------- 1. ESQUELETO Y BONES ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['Tronco', 'Raiz', 0, 0.65, 0],
      ['Capa1', 'Tronco', 0, 1.37, 0],
      ['Capa2', 'Capa1', 0, 2.09, 0],
      ['Capa3', 'Capa2', 0, 2.80, 0]
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

    // ---------------- 2. TRONCO PRINCIPAL ----------------
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 0.9, radialSegs, 2, false);
    trunkGeo.translate(0, 0.45, 0);
    const tronco = M.pieza(trunkGeo, 'TroncoPino', radialSegs, 2);
    g.add(tronco);

    M.pielConHuesos(tronco, g, (i, x, y, z) => {
      const w = suave(0.1, 0.8, y);
      return [[hueso.Raiz, 1 - w], [hueso.Tronco, w]];
    });

    // ---------------- 3. FALDAS CÓNICAS ESCALONADAS ----------------
    for (let t = 0; t < tiers; t++) {
      const p = t / (tiers - 1);
      const bottomR = 1.15 * (1 - p * 0.42);
      const topR = (t === tiers - 1) ? 0.04 : 0.28 * (1 - p * 0.4);
      const h = 1.15 * (1 - p * 0.18);
      const yBase = 0.65 + t * 0.72;

      const coneGeo = new THREE.CylinderGeometry(topR, bottomR, h, radialSegs, heightSegs, false);
      coneGeo.translate(0, yBase + h / 2, 0);
      const cono = M.pieza(coneGeo, `ConoPino_${t + 1}`, radialSegs, heightSegs);
      colgar(`Capa${t + 1}`, cono);
    }

    // ---------------- 4. PINTURA PROCEDURAL ----------------
    // Tronco de pino
    M.pintar(tronco, (i, p) => {
      const c = new THREE.Color(0x4c3a28);
      c.lerp(new THREE.Color(0x322218), 0.35);
      if (p.y < 0.45) {
        c.lerp(new THREE.Color(0x3a4c28), (1 - p.y / 0.45) * 0.65);
      }
      return c;
    }, g);

    // Conos de hojas
    for (let t = 0; t < tiers; t++) {
      const cono = g.getObjectByName(`ConoPino_${t + 1}`);
      if (cono) {
        const yBase = 0.65 + t * 0.72;
        const h = 1.15 * (1 - (t / Math.max(1, tiers - 1)) * 0.18);
        M.pintar(cono, (i, p) => {
          const yRel = (p.y - yBase) / h; // 0 en la falda inferior, 1 en la cima
          const c = new THREE.Color(0x285430);
          if (yRel < 0.25) {
            c.lerp(new THREE.Color(0x142c18), Math.min(1, (0.25 - yRel) * 3.5));
          } else {
            const factorLuz = Math.pow(yRel, 1.2);
            c.lerp(new THREE.Color(0x6ca448), Math.min(1, factorLuz * 0.95));
          }
          const ang = Math.atan2(p.z, p.x);
          const rib = 0.5 + 0.5 * Math.sin(ang * 12);
          c.offsetHSL(0, (rib - 0.5) * 0.04, (rib - 0.5) * 0.03);
          return c;
        }, g);
      }
    }

    // ---------------- 5. ANIMACIONES ORGÁNICAS DE VIENTO ----------------
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

    // Brisa Suave: balanceo elástico de conífera
    const dB = 4.6;
    const brisa = new THREE.AnimationClip('Brisa Suave', dB, [
      giro('Tronco', dB, (t) => [0.4 * sen(t), 0, 0.3 * cos(t)]),
      giro('Capa1', dB, (t) => [0.9 * sen(t), 0, 0.6 * cos(t)]),
      giro('Capa2', dB, (t) => [1.6 * sen(t), 0, 1.1 * cos(t)]),
      giro('Capa3', dB, (t) => [2.4 * sen(t), 0.5 * sen(t, 2), 1.7 * cos(t)])
    ]);

    // Viento Fuerte: flexión montañosa
    const dV = 3.0;
    const viento = new THREE.AnimationClip('Viento Fuerte', dV, [
      giro('Tronco', dV, (t) => [1.2 * sen(t), 0, 0.8 * sen(t)]),
      giro('Capa1', dV, (t) => [2.6 * sen(t), 0, 1.8 * sen(t)]),
      giro('Capa2', dV, (t) => [4.8 * sen(t), 0, 3.2 * sen(t)]),
      giro('Capa3', dV, (t) => [7.2 * sen(t), 1.6 * sen(t, 2), 4.8 * sen(t)])
    ]);

    // Reposo: suave balanceo imperceptible
    const dR = 5.8;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('Tronco', dR, (t) => [0.12 * sen(t), 0, 0.08 * cos(t)]),
      giro('Capa1', dR, (t) => [0.28 * sen(t), 0, 0.18 * cos(t)]),
      giro('Capa2', dR, (t) => [0.50 * sen(t), 0, 0.32 * cos(t)]),
      giro('Capa3', dR, (t) => [0.75 * sen(t), 0.2 * sen(t), 0.50 * cos(t)])
    ]);

    g.animations = [brisa, viento, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
