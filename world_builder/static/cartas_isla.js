/**
 * Cartas de la Isla — datos y progreso compartidos entre el modo juego del World Builder (app.js) y el Dino Lector.
 *
 * - Las 105 cartas dino están escondidas por la isla (static/cartas_ocultas.json, generado con
 *   tools/cartas_mapa/ubicar_cartas.py). El Dino Lector parpadea cuando hay una cerca.
 * - Son muchas cartas para una isla pequeña, así que las más fuertes están SELLADAS: el Dino Lector no las
 *   detecta hasta cumplir su requisito. Niveles según el poder (suma de estadísticas):
 *     común (≤37): siempre · rara (38-40): 10 cartas encontradas · épica (41-42): 25 cartas
 *     legendaria (≥43): vencer al campeón de su elemento + 40 cartas · mítica: guardián concreto o 50/75 cartas
 * - Progreso en localStorage ('dino_isla_progreso_v2'): { encontradas: [ids], guardianes: [ids] }.
 *   Mismo origen (localhost:8086) para el juego y para /dino_lector/, así que ambos lo comparten.
 *
 * Uso: CartasIsla.usarDinos(dinos.json → dinos) una vez; luego nivel(id), requisitoCumplido(id), textoRequisito(id)...
 * Para el futuro sistema de peleas: al ganar a un guardián basta con llamar CartasIsla.marcarGuardian('luter').
 */
(function () {
  'use strict';
  // v2: el 2026-11-05 se empezó de cero (el progreso de pruebas anterior quedó en 'dino_isla_progreso')
  const CLAVE = 'dino_isla_progreso_v2';

  // Guardianes de la isla (sus ids son los de los personajes colocados en el mapa)
  const GUARDIANES = {
    luter: { nombre: 'Luter', titulo: 'Campeón del Fuego', elemento: 'fuego', lugar: 'Ciudad de la Forja' },
    macy: { nombre: 'Macy y Maxwell', titulo: 'Campeones del Agua', elemento: 'agua', lugar: 'Puerto del Viento' },
    eldon: { nombre: 'Eldon', titulo: 'Campeón del Rayo', elemento: 'rayo', lugar: 'Ciudad de la Forja' },
    tiberius: { nombre: 'Tiberius', titulo: 'Campeón de Tierra', elemento: 'tierra', lugar: 'Aldea del Valle' },
    livia: { nombre: 'Livia', titulo: 'Campeona de Planta', elemento: 'planta', lugar: 'el Bosque' },
    blanche: { nombre: 'Blanche', titulo: 'Campeona del Viento', elemento: 'viento', lugar: 'la Montaña' },
    ulises: { nombre: 'Ulises', titulo: 'Guardián Errante del Mapa', elemento: 'tierra', lugar: 'el Bosque' },
    nelly: { nombre: 'Nelly', titulo: 'Campeona Suprema', elemento: 'fuego', lugar: 'Ciudad de la Forja' }
  };
  const CAMPEON = { fuego: 'luter', agua: 'macy', rayo: 'eldon', tierra: 'tiberius', planta: 'livia', viento: 'blanche' };

  // Cartas míticas y su requisito
  const MITICAS = {
    black_tyrannosaurus_rex: { guardian: 'nelly' },
    alpha_acrocanthosaurus: { guardian: 'luter' },
    indoraptor: { guardian: 'eldon' },
    megalosaurus: { guardian: 'macy' },
    brontosaurus: { guardian: 'tiberius' },
    therizinosaurus: { guardian: 'livia' },
    cryolophosaurus: { guardian: 'blanche' },
    indominus_rex: { guardian: 'ulises' },
    deinonychus: { cartas: 50 },
    pachycephalosaurus: { cartas: 75 }
  };

  const NIVELES = {
    comun: { nombre: 'Común', icono: '⚪', color: '#a8a29e' },
    rara: { nombre: 'Rara', icono: '🔷', color: '#0ea5e9' },
    epica: { nombre: 'Épica', icono: '💜', color: '#a855f7' },
    legendaria: { nombre: 'Legendaria', icono: '🌟', color: '#f59e0b' },
    mitica: { nombre: 'Mítica', icono: '✨', color: '#ec4899' }
  };

  const ZONAS = {
    forja: 'Ciudad de la Forja', puerto: 'Puerto del Viento', valle: 'Aldea del Valle',
    bosque: 'el Bosque', montana: 'la Montaña del norte'
  };

  let DINOS = {};
  function usarDinos(lista) {
    DINOS = {};
    (lista || []).forEach((d) => { DINOS[d.id] = d; });
  }
  const poder = (d) => (d && d.stats ? d.stats.reduce((a, b) => a + b, 0) : 0);

  function nivel(id) {
    if (MITICAS[id]) return 'mitica';
    const p = poder(DINOS[id]);
    if (p >= 43) return 'legendaria';
    if (p >= 41) return 'epica';
    if (p >= 38) return 'rara';
    return 'comun';
  }

  // Lista de requisitos: [{ cartas: N }] y/o [{ guardian: id }]
  function requisitos(id) {
    const n = nivel(id);
    if (n === 'mitica') return [MITICAS[id]];
    if (n === 'legendaria') {
      const c = CAMPEON[(DINOS[id] || {}).element];
      return c ? [{ guardian: c }, { cartas: 40 }] : [{ cartas: 40 }];
    }
    if (n === 'epica') return [{ cartas: 25 }];
    if (n === 'rara') return [{ cartas: 10 }];
    return [];
  }

  function leer() {
    try {
      const p = JSON.parse(localStorage.getItem(CLAVE) || '{}');
      return {
        encontradas: Array.isArray(p.encontradas) ? p.encontradas : [],
        guardianes: Array.isArray(p.guardianes) ? p.guardianes : [],
        invocado: typeof p.invocado === 'string' ? p.invocado : null, // dino que te acompaña por la isla
        vinculos: Array.isArray(p.vinculos) ? p.vinculos : [],         // misión de vínculo cumplida → puede combatir
        metros: p.metros && typeof p.metros === 'object' ? p.metros : {} // metros caminados junto a cada dino
      };
    } catch (e) {
      return { encontradas: [], guardianes: [], invocado: null, vinculos: [], metros: {} };
    }
  }

  function guardar(p) {
    try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch (e) { /* sin almacenamiento */ }
  }

  const cumple = (r, p) => (r.guardian ? p.guardianes.includes(r.guardian) : r.cartas ? p.encontradas.length >= r.cartas : true);
  const esMitica = (id) => !!MITICAS[id];
  const sellada = (id, p = leer()) => !requisitos(id).every((r) => cumple(r, p));
  const requisitoCumplido = (id, p = leer()) => !sellada(id, p);

  function textoUno(r) {
    if (r.guardian) {
      const g = GUARDIANES[r.guardian] || { nombre: r.guardian, lugar: '' };
      return `derrota a ${g.nombre}${g.lugar ? ' (' + g.lugar + ')' : ''}`;
    }
    if (r.cartas) return `encuentra ${r.cartas} cartas`;
    return '';
  }

  // Texto de lo que falta (o de todos los requisitos si se pide completo)
  function textoRequisito(id, p = leer(), completo = false) {
    const rs = requisitos(id).filter((r) => completo || !cumple(r, p));
    if (!rs.length) return '';
    const t = rs.map(textoUno).join(' y ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function marcarEncontrada(id) {
    const p = leer();
    if (!p.encontradas.includes(id)) { p.encontradas.push(id); guardar(p); }
    return p;
  }

  function marcarGuardian(id) {
    const p = leer();
    if (!p.guardianes.includes(id)) { p.guardianes.push(id); guardar(p); }
    return p;
  }

  // ---------------- Invocación y misiones de vínculo (assets/dinos/requisitos_chibi.json) ----------------
  let REQ = {};
  async function cargarRequisitos() {
    try { REQ = (await (await fetch('/assets/dinos/requisitos_chibi.json')).json()).requisitos || {}; } catch (e) { REQ = {}; }
    return REQ;
  }
  const requisitoVinculo = (id) => REQ[id] || null;
  // Metros a recorrer si la misión es de distancia ("Correr 2 km", "paseo de 500 m"); null si no se mide así todavía
  function metaMetros(id) {
    const r = REQ[id];
    if (!r || r.tipo !== 'caminar') return null;
    let m = /(\d+(?:,\d+)?)\s*km\b/.exec(r.texto);
    if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1000);
    m = /(\d+)\s*m\b/.exec(r.texto);
    return m ? parseInt(m[1], 10) : null;
  }
  function estadoVinculo(id, p = leer()) {
    const meta = metaMetros(id), hechos = Math.round(p.metros[id] || 0);
    return { hecho: p.vinculos.includes(id), meta, hechos, medible: meta !== null };
  }
  function invocar(id) { const p = leer(); p.invocado = id; guardar(p); return p; }
  function guardarCompanero() { const p = leer(); p.invocado = null; guardar(p); return p; }
  // Suma metros caminados con el dino invocado; si su misión es de distancia y se alcanza, se crea el vínculo
  function sumarMetros(id, m) {
    const p = leer();
    p.metros[id] = (p.metros[id] || 0) + m;
    let nuevo = false;
    const meta = metaMetros(id);
    if (meta !== null && p.metros[id] >= meta && !p.vinculos.includes(id)) { p.vinculos.push(id); nuevo = true; }
    guardar(p);
    return { p, nuevo };
  }

  // Dinos iniciales de los hermanos protagonistas: ya vienen con la carta y el vínculo (listos para combatir)
  const INICIALES = { fer: 'deltadromeus', ander: 'acrocanthosaurus' };
  function otorgarInicial(heroe) {
    const id = INICIALES[heroe];
    if (!id) return null;
    const p = leer();
    let cambio = false;
    if (!p.encontradas.includes(id)) { p.encontradas.push(id); cambio = true; }
    if (!p.vinculos.includes(id)) { p.vinculos.push(id); cambio = true; }
    if (cambio) guardar(p);
    return id;
  }

  window.CartasIsla = {
    INICIALES, otorgarInicial,
    cargarRequisitos, requisitoVinculo, metaMetros, estadoVinculo, invocar, guardarCompanero, sumarMetros,
    CLAVE, GUARDIANES, CAMPEON, MITICAS, NIVELES, ZONAS,
    usarDinos, poder, nivel, requisitos, leer, guardar, esMitica, sellada, requisitoCumplido, textoRequisito,
    marcarEncontrada, marcarGuardian
  };
})();
