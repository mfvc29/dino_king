/**
 * Dino King - 3D Mesh Studio (Clay + Quad Wireframe)
 * Sistema Multi-Ruta Sincronizado:
 *  - Editores individuales por Ruta / Tramo (Ruta 1 Norte, Ruta 1 Centro, Ruta 1 Sur, + Nuevas Rutas)
 *  - "🗺️ Ruta Completa (Mundo)" que se auto-actualiza al editar cualquier ruta individual
 *  - Conector de Rutas en el Mundo para mover rutas enteras (X, Y, Z o pegar al Norte/Sur/Este/Oeste)
 *  - Unión de Mallas 2D (Horizontal y Norte-Sur) que completa el relieve entre tramos y rutas.
 */

const state = {
  activeMode: 'single_route',     // 'single_route' | 'full_world'
  activeRouteId: 'ruta_1_norte',  // ID de la ruta actualmente abierta en modo editor individual
  selectedRouteToMove: 'ruta_1_norte',
  currentSceneName: 'ruta_1_norte',
  renderStyle: 'clay_wire',       // 'clay_wire', 'clay_only', 'wire_only'
  dimension: '2.5D',              // '2.5D', '3D', '2D'
  wireOpacity: 0.50,
  subdivisionMultiplier: 1.0,
  meshObjects: [],
  selectedGroup: null,
  markedVertices: [],             // Puntos marcados con Ctrl + Click Derecho [{ group, mesh, vertexIndex, marker }]
  sculptRadius: 1.8,              // Radio de influencia suave alrededor de los puntos marcados
  sculptSnapshot: null,           // Snapshot de posiciones base para los sliders ΔX/ΔY/ΔZ
  isDraggingSculpt: false,
  dragStartClientY: 0,
  dragMoved: false,
  routes: [],                     // Lista de rutas del mundo [{ id, name, desc, worldOffset:{x,y,z}, width, depth, objects:[] }]
  isRebuilding: false,
  sceneReady: false,
  lastLiveMtime: 0
};

let scene, perspectiveCamera, orthoCamera, activeCamera, renderer, controls;
let raycaster, mouse;
let clayMaterial, wireMaterial, highlightWireMaterial;

const STORAGE_KEY_ROUTES = 'dino_world_routes_v5';
const container = document.getElementById('canvas-container');
const appClock = new THREE.Clock();

window.addEventListener('DOMContentLoaded', () => {
  try {
    initThree();
  } catch (e) {
    mostrarErrorWebGL(e);
    return;
  }
  initMaterials();
  initEvents();
  if (window.DinoPhysics && typeof window.DinoPhysics.init === 'function') {
    window.DinoPhysics.init();
  }
  refreshScenesDropdown();

  // Inicializar o restaurar el sistema de rutas sincronizadas
  initWorldRoutesSystem();

  // Desde la pantalla de inicio (botón "Jugar" → /editor?jugar=1): la isla a pantalla completa, sin los paneles del
  // editor, y se entra directamente al modo juego. Al salir del modo juego se vuelve a la pantalla de inicio.
  if (document.documentElement.classList.contains('solo-juego')) iniciarSoloJuego();

  setInterval(() => checkLiveMesh(false), 1500);
  animate();
});

// El navegador no deja crear gráficos 3D (WebGL): aviso con los pasos para activarlo en vez de una página en blanco
function mostrarErrorWebGL(err) {
  console.error(err);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(180deg,#7cc8fb,#fef9c3);font-family:Fredoka,Nunito,system-ui,sans-serif;color:#44403c;';
  el.innerHTML = `
    <div style="max-width:560px;background:#fffbeb;border:4px solid #7c2d12;border-radius:26px;box-shadow:0 8px 0 #7c2d12;padding:22px 26px;">
      <h2 style="margin:0 0 6px;color:#7c2d12;">🦖 Tu navegador no puede mostrar la isla en 3D</h2>
      <p style="margin:0 0 10px;">El navegador bloqueó los gráficos 3D (WebGL). No es un fallo del juego. En Brave suele arreglarse así:</p>
      <ol style="margin:0 0 10px;padding-left:20px;line-height:1.5;">
        <li>Desactiva el escudo de Brave para esta página (icono del león → «Escudos desactivados»), o pon el bloqueo de huellas digitales en «Estándar».</li>
        <li>En <b>brave://settings/system</b> activa «Usar aceleración gráfica cuando esté disponible» y reinicia Brave.</li>
        <li>Si sigue igual: en <b>brave://flags</b> activa «Override software rendering list» y reinicia.</li>
        <li>Mira <b>brave://gpu</b>: «WebGL» debe decir «Hardware accelerated».</li>
      </ol>
      <p style="margin:0;font-size:.9rem;color:#78716c;">Mientras tanto, en Chromium funciona.</p>
    </div>`;
  document.body.appendChild(el);
}

function initThree() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb6d6f2);
  scene.fog = new THREE.FogExp2(0xb6d6f2, 0.0016);

  // Cielo panorámico con nubes
  const skyTextureLoader = new THREE.TextureLoader();
  skyTextureLoader.load('/static/cielo_nubes.jpg', (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = tex;
  });

  perspectiveCamera = new THREE.PerspectiveCamera(40, width / height, 0.5, 900);

  const aspect = width / height;
  const d = 34;
  orthoCamera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.5, 800);
  orthoCamera.position.set(0, 120, 0);
  orthoCamera.lookAt(0, 0, 0);

  activeCamera = perspectiveCamera;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    // Segundo intento más sencillo (algunos navegadores/GPU rechazan el modo de alto rendimiento o el antialias)
    console.warn('WebGL de alto rendimiento no disponible, probando modo básico', e);
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false });
  }
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(activeCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.01;
  controls.minDistance = 4;
  controls.maxDistance = 380;

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 0.85);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.92);
  keyLight.position.set(45, 85, 52);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 5;
  keyLight.shadow.camera.far = 320;
  const sc = 85;
  keyLight.shadow.camera.left = -sc;
  keyLight.shadow.camera.right = sc;
  keyLight.shadow.camera.top = sc;
  keyLight.shadow.camera.bottom = -sc;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.42);
  fillLight.position.set(-45, 35, -30);
  scene.add(fillLight);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  window.addEventListener('resize', onWindowResize);
}

function initMaterials() {
  clayMaterial = new THREE.MeshLambertMaterial({
    color: 0xe2e6ec,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  wireMaterial = new THREE.LineBasicMaterial({
    color: 0x222933,
    transparent: true,
    opacity: state.wireOpacity
  });

  highlightWireMaterial = new THREE.LineBasicMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.95
  });
}

// -------------------------------------------------------------
// CONSTRUCTOR DE MALLAS CON TOPOLOGÍA QUAD LIMPIA
// -------------------------------------------------------------
function buildQuadWireGeometry(geometry, quadCols, quadRows) {
  const pos = geometry.attributes.position;
  if (!quadCols || !quadRows || pos.count < (quadCols + 1) * (quadRows + 1)) {
    return new THREE.WireframeGeometry(geometry);
  }

  const verts = [];
  const stride = quadCols + 1;

  for (let r = 0; r <= quadRows; r++) {
    for (let c = 0; c <= quadCols; c++) {
      const idx = r * stride + c;
      const x = pos.getX(idx);
      const y = pos.getY(idx);
      const z = pos.getZ(idx);

      if (c < quadCols) {
        const rightIdx = idx + 1;
        verts.push(x, y, z, pos.getX(rightIdx), pos.getY(rightIdx), pos.getZ(rightIdx));
      }
      if (r < quadRows) {
        const downIdx = idx + stride;
        verts.push(x, y, z, pos.getX(downIdx), pos.getY(downIdx), pos.getZ(downIdx));
      }
    }
  }

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return lineGeo;
}

function createClayMesh(geometry, name = 'MeshPart', quadCols = null, quadRows = null) {
  geometry.computeVertexNormals();
  if (quadCols && quadRows) {
    geometry.userData.quadCols = quadCols;
    geometry.userData.quadRows = quadRows;
  }
  if (geometry.attributes.position && !geometry.userData.originalPositions) {
    geometry.userData.originalPositions = new Float32Array(geometry.attributes.position.array);
  }

  const mat = geometry.attributes.color
    ? new THREE.MeshLambertMaterial({
        color: 0xffffff,
        vertexColors: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      })
    : clayMaterial;

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;

  const wireGeo = buildQuadWireGeometry(geometry, quadCols, quadRows);
  const wireSegments = new THREE.LineSegments(wireGeo, wireMaterial);
  wireSegments.name = 'wireOverlay';
  mesh.add(wireSegments);

  applyRenderStyleToMesh(mesh);
  return mesh;
}

function registerSceneObject(group, label, category, moduleType, params = {}, explicitRouteId = null) {
  const routeId = explicitRouteId
    || group.userData?.routeId
    || (state.activeMode === 'single_route' ? state.activeRouteId : state.selectedRouteToMove)
    || (state.routes[0] && state.routes[0].id)
    || 'ruta_1_norte';

  group.userData = {
    id: 'mesh_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
    label: label || 'Objeto 3D',
    category: category || 'generic',
    moduleType: moduleType || 'generic',
    params: params,
    routeId: routeId
  };

  scene.add(group);
  state.meshObjects.push(group);
  updateStats();

  if (!state.isRebuilding) {
    syncActiveSceneToRouteStore();
  }
  return group;
}

// -------------------------------------------------------------
// MATEMÁTICA DE TERRENO: PENDIENTE GRADUAL + CUEVA LATERAL + MONTAÑA ALPINA
// -------------------------------------------------------------
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function boxMask(x, z, x0, x1, z0, z1, feather = 0.65) {
  const mx = smoothstep(x0 - feather, x0 + feather, x) * (1 - smoothstep(x1 - feather, x1 + feather, x));
  const mz = smoothstep(z0 - feather, z0 + feather, z) * (1 - smoothstep(z1 - feather, z1 + feather, z));
  return mx * mz;
}

function ridgedRockNoise(u, v) {
  const r1 = 1.0 - Math.abs(Math.sin(u * 0.55 + Math.cos(v * 0.45) * 0.8));
  const r2 = 1.0 - Math.abs(Math.sin(u * 1.15 - v * 0.65));
  const r3 = 1.0 - Math.abs(Math.cos(u * 2.1 + v * 1.3));
  return (Math.pow(r1, 1.8) * 0.55 + Math.pow(r2, 2.0) * 0.30 + Math.pow(r3, 2.2) * 0.15);
}

function evaluateSlopeAndMountainHeight(col, row) {
  if (row > 13.5 || col < 1.0 || col > 33.0) return 0;

  const envX = smoothstep(1.8, 5.5, col) * (1.0 - smoothstep(28.5, 32.2, col));

  // A. LIGERA PENDIENTE DE SUBIDA (Rampa gradual desde row 12.5 hasta row 5.0)
  const slopeProgress = 1.0 - smoothstep(4.8, 12.2, row);
  const backFade = smoothstep(-1.2, 1.2, row);
  let gentleSlopeY = slopeProgress * 2.85 * envX * backFade;

  const hillock = Math.sin(col * 0.28) * Math.cos(row * 0.35) * 0.35 * slopeProgress * envX;
  gentleSlopeY += hillock;

  const rampMask = boxMask(col, row, 7.0, 9.5, 6.5, 12.2, 0.5);
  gentleSlopeY -= rampMask * 0.28;

  // B. GRAN MONTAÑA ESCARPADA DETRÁS DE LA PENDIENTE (rows < 6.8)
  let mountainY = 0;
  if (row < 6.8) {
    const mtnEnvZ = smoothstep(-1.0, 0.8, row) * (1.0 - smoothstep(4.2, 6.4, row));
    const peaks = [
      { cx: 15.2, cz: 1.8, rx: 7.2, rz: 3.4, h: 12.2 },
      { cx: 20.4, cz: 2.2, rx: 6.2, rz: 3.2, h: 9.4 },
      { cx: 24.8, cz: 2.8, rx: 5.0, rz: 2.9, h: 6.2 },
      { cx: 9.5,  cz: 2.3, rx: 5.8, rz: 3.1, h: 8.2 },
      { cx: 6.0,  cz: 3.0, rx: 4.2, rz: 2.6, h: 4.8 }
    ];

    let baseMass = 0;
    peaks.forEach(p => {
      const dx = (col - p.cx) / p.rx;
      const dz = (row - p.cz) / p.rz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1.0) {
        const cone = Math.pow(1.0 - d, 1.5) * p.h;
        baseMass = Math.max(baseMass, cone);
      }
    });

    const relX = col - 15.2;
    const relZ = Math.max(0.3, row - 1.2);
    const fanU = (relX / (1.0 + relZ * 0.22)) * 2.2;
    const fanV = relZ * 0.9;
    const ridges = ridgedRockNoise(fanU, fanV);
    const heightFactor = Math.min(1.0, baseMass / 4.0);

    mountainY = (baseMass + ridges * 2.5 * heightFactor) * envX * mtnEnvZ;
  }

  return gentleSlopeY + mountainY;
}

function evaluateRuta1TerrainHeight(col, row, includeSouthZones = true) {
  let y = 0.0;

  y += evaluateSlopeAndMountainHeight(col, row);

  const pathNorthVert = boxMask(col, row, 7.2, 9.4, 7.0, 12.8, 0.45);
  const pathNorthHoriz = boxMask(col, row, 7.2, 28.0, 10.8, 13.0, 0.45);
  const pathNorth = Math.max(pathNorthVert, pathNorthHoriz);
  y -= pathNorth * 0.06; // sendero apenas marcado (antes 0.22: quedaba bajo el nivel del agua y se nadaba)

  const pond1Basin = boxMask(col, row, 9.0, 17.0, 19.0, 24.0, 0.55);
  const pond1Islet = boxMask(col, row, 11.8, 14.2, 20.8, 22.2, 0.35);
  y -= pond1Basin * (1.0 - pond1Islet) * 1.15;

  if (includeSouthZones) {
    const pond2Basin = boxMask(col, row, 6.0, 13.0, 30.0, 36.0, 0.55);
    const pond2Islet = boxMask(col, row, 7.8, 11.2, 31.8, 34.2, 0.35);
    y -= pond2Basin * (1.0 - pond2Islet) * 1.15;

    const pond3Basin = boxMask(col, row, 10.0, 21.0, 41.0, 47.0, 0.55);
    const pond3Islet = boxMask(col, row, 13.8, 17.2, 42.8, 45.2, 0.35);
    y -= pond3Basin * (1.0 - pond3Islet) * 1.15;

    const pathSouthHoriz = boxMask(col, row, 6.0, 18.0, 51.0, 53.0, 0.4);
    const pathSouthVert = boxMask(col, row, 15.0, 18.0, 51.0, 58.0, 0.4);
    const pathSouth = Math.max(pathSouthHoriz, pathSouthVert);
    y -= pathSouth * 0.06; // sendero apenas marcado (antes 0.24)
  }

  return y;
}

/**
 * Evalúa el color de vértice para el terreno de Ruta 1:
 * - Cumbres con nieve alpina y riscos de granito/pizarra.
 * - Senderos de tierra batida y arena cálida.
 * - Estanques (fondo limoso oscuro submarino, talud arenoso y borde de ribera).
 * - Isletas con pradera viva y corona rocosa.
 * - Pradera general exuberante con variaciones botánicas naturales.
 */
function evaluateRuta1TerrainColor(col, row, y) {
  const pathNorthVert = boxMask(col, row, 7.2, 9.4, 7.0, 12.8, 0.45);
  const pathNorthHoriz = boxMask(col, row, 7.2, 28.0, 10.8, 13.0, 0.45);
  const pathNorth = Math.max(pathNorthVert, pathNorthHoriz);

  const pathSouthHoriz = boxMask(col, row, 6.0, 18.0, 51.0, 53.0, 0.4);
  const pathSouthVert = boxMask(col, row, 15.0, 18.0, 51.0, 58.0, 0.4);
  const pathSouth = Math.max(pathSouthHoriz, pathSouthVert);
  const isPath = Math.max(pathNorth, pathSouth);

  const pond1Basin = boxMask(col, row, 9.0, 17.0, 19.0, 24.0, 0.55);
  const pond1Islet = boxMask(col, row, 11.8, 14.2, 20.8, 22.2, 0.35);

  const pond2Basin = boxMask(col, row, 6.0, 13.0, 30.0, 36.0, 0.55);
  const pond2Islet = boxMask(col, row, 7.8, 11.2, 31.8, 34.2, 0.35);

  const pond3Basin = boxMask(col, row, 10.0, 21.0, 41.0, 47.0, 0.55);
  const pond3Islet = boxMask(col, row, 13.8, 17.2, 42.8, 45.2, 0.35);

  const isBasin = Math.max(pond1Basin, pond2Basin, pond3Basin);
  const isIslet = Math.max(pond1Islet, pond2Islet, pond3Islet);

  const c = new THREE.Color();

  // 1. Zona de Montaña al Norte
  if (row < 12.5 && y > 0.8) {
    // La montaña llega a y ≈ 15: falda verde, granito en estratos hasta ~9 y nieve solo en la cumbre
    if (y > 2.2) {
      const estrato = 0.5 + 0.5 * Math.sin(y * 2.4 + Math.sin(col * 0.9) * 0.8);
      const veta = 0.5 + 0.5 * Math.sin(col * 1.7 + row * 1.3);
      c.setHex(0x6e685c).lerp(new THREE.Color(0x948a7c), 0.55 * estrato).lerp(new THREE.Color(0x5a5248), 0.25 * veta);
      // Manchas de musgo/pasto alpino en la parte baja de la roca
      if (y < 5.5 && Math.sin(col * 2.1) * Math.cos(row * 1.8) > 0.55) c.lerp(new THREE.Color(0x5e7a3c), 0.45 * (1 - (y - 2.2) / 3.3));
      const nieve = Math.max(0, Math.min(1, (y - 9.0 - 0.8 * Math.sin(col * 1.1 + row * 0.7)) / 2.5));
      c.lerp(new THREE.Color(0xf4f8fc), nieve * nieve * (3 - 2 * nieve)); // Nieve perpetua en la cumbre
    } else {
      const t = (y - 0.8) / 1.4;
      c.setHex(0x526e38).lerp(new THREE.Color(0x6e685c), t); // Falda alpina
    }
    return c;
  }

  // 2. Estanques (isletas, fondo y orilla)
  if (isBasin > 0.05) {
    if (isIslet > 0.25) {
      c.setHex(0x42862a);
      if (isIslet < 0.65) c.lerp(new THREE.Color(0x766c5e), 0.45);
      return c;
    }
    if (y < -0.2) {
      const prof = Math.min(1, Math.max(0, (-y - 0.2) / 0.8));
      c.setHex(0x3a9fd8).lerp(new THREE.Color(0x1e6fa8), prof); // Agua del estanque (claro en la orilla, profundo al centro)
      return c;
    }
    const tOrilla = Math.min(1, (isBasin - 0.05) / 0.5);
    c.setHex(0x46842c).lerp(new THREE.Color(0x786446), tOrilla * 0.85); // Talud arenoso
    return c;
  }

  // 3. Senderos de tierra batida
  if (isPath > 0.08) {
    const colTierra = new THREE.Color(0xc29858);
    const colBorde = new THREE.Color(0x8ea046);
    c.setHex(0x46882c);
    c.lerp(colBorde, Math.min(1, isPath * 1.5));
    c.lerp(colTierra, Math.min(1, (isPath - 0.25) / 0.65));
    return c;
  }

  // 4. Pradera general verde con variación natural
  const ruido = 0.06 * Math.sin(col * 1.6) * Math.cos(row * 1.4) + 0.03 * Math.sin(col * 3.8);
  c.setHex(0x42842c);
  c.lerp(new THREE.Color(0x5ca436), Math.max(0, Math.min(1, 0.5 + ruido)));
  return c;
}

// -------------------------------------------------------------
// EVALUACIÓN TOPOGRÁFICA Y COLOR PARA LA ALDEA (RUTA ESTE)
// -------------------------------------------------------------
const RED_CAMINOS_ALDEA = [
  // Camino 1: Norte (entra desde el bosque norte a z = -2.2)
  [[-17.0, -2.2], [-11.0, -2.2], [-6.0, -1.8], [-1.0, -0.2], [2.5, 1.5]],
  // Camino 2: Sur (entra desde el bosque sur a z = +5.8)
  [[-17.0, 5.8], [-11.0, 5.5], [-6.0, 4.2], [-1.0, 2.8], [2.5, 1.5]],
  // Avenida Principal Este (hacia el mirador este)
  [[2.5, 1.5], [8.0, 1.5], [15.5, 1.5]],
  // Callejón Norte
  [[-6.0, -1.8], [-5.5, -4.8], [-5.5, -7.5]],
  [[-5.5, -4.8], [4.5, -4.8], [4.5, -7.5]],
  // Callejón Sur
  [[-6.0, 4.2], [-3.0, 6.0], [-3.0, 8.5]],
  // Callejón Sureste
  [[8.0, 1.5], [10.5, 4.5], [10.5, 7.0]]
];

const SOLARES_ALDEA = [
  { id: 'Solar Noroeste', cx: -6.5, cz: -7.5, rx: 2.8, rz: 2.3, y: 0.06 },
  { id: 'Solar Norte Central', cx: 4.5, cz: -7.5, rx: 3.2, rz: 2.6, y: 0.06 },
  { id: 'Solar Nordeste', cx: 11.5, cz: -5.5, rx: 2.6, rz: 2.3, y: 0.08 },
  { id: 'Solar Sureste', cx: 10.5, cz: 7.0, rx: 3.2, rz: 2.6, y: 0.06 },
  { id: 'Solar Suroeste', cx: -3.0, cz: 8.5, rx: 2.6, rz: 2.2, y: 0.06 },
  { id: 'Solar Plaza Este', cx: 8.5, cz: -0.8, rx: 2.5, rz: 2.2, y: 0.05 }
];

function calcDistCaminoAldea(x, z) {
  const dPlaza = Math.hypot(x - 2.5, z - 1.5);
  if (dPlaza < 3.4) return Math.max(0, dPlaza - 2.6);
  let minDist = Infinity;
  for (let i = 0; i < RED_CAMINOS_ALDEA.length; i++) {
    const pts = RED_CAMINOS_ALDEA[i];
    for (let j = 0; j < pts.length - 1; j++) {
      const ax = pts[j][0], az = pts[j][1];
      const bx = pts[j + 1][0], bz = pts[j + 1][1];
      const dx = bx - ax, dz = bz - az;
      const lenSq = dx * dx + dz * dz;
      let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lenSq));
      const d = Math.hypot(x - (ax + t * dx), z - (az + t * dz));
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}

function calcSolarFactorAldea(x, z) {
  let maxF = 0;
  let targetY = 0;
  for (let i = 0; i < SOLARES_ALDEA.length; i++) {
    const s = SOLARES_ALDEA[i];
    const dx = Math.abs(x - s.cx);
    const dz = Math.abs(z - s.cz);
    if (dx < s.rx + 0.6 && dz < s.rz + 0.6) {
      const fx = Math.max(0, Math.min(1, (s.rx + 0.6 - dx) / 0.6));
      const fz = Math.max(0, Math.min(1, (s.rz + 0.6 - dz) / 0.6));
      const f = fx * fz;
      if (f > maxF) {
        maxF = f;
        targetY = s.y;
      }
    }
  }
  return { factor: maxF, targetY };
}

function evaluateAldeaTerrainHeight(x, z) {
  let y = 0.0;
  if (z < -9.0 && x > -13.0) {
    const fN = Math.min(1, (-9.0 - z) / 4.8);
    const factorColina = fN * fN * (3 - 2 * fN);
    y += factorColina * (1.15 + 0.16 * Math.sin(x * 0.45));
  }
  if (x > 11.5) {
    const fE = Math.min(1, (x - 11.5) / 4.8);
    const factorColina = fE * fE * (3 - 2 * fE);
    y += factorColina * (1.25 + 0.20 * Math.cos(z * 0.40));
  }
  if (z > 9.0 && x > -12.0) {
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

  // Zona de acceso al mar al este (caleta / bajada a la playa)
  if (x > 8.0 && Math.abs(z - 1.5) < 4.2) {
    const dRampaX = Math.max(0, Math.min(1, (x - 8.0) / 8.5));
    const fAncho = Math.cos(((z - 1.5) / 4.2) * (Math.PI / 2));
    const fRampa = dRampaX * Math.max(0, fAncho);
    y = y * (1.0 - fRampa) + (-0.14) * fRampa;
  }

  const dCam = calcDistCaminoAldea(x, z);
  const radioCamino = 1.25;
  if (dCam < radioCamino) {
    const fCam = 1.0 - dCam / radioCamino;
    y -= fCam * 0.07;
  }

  const sol = calcSolarFactorAldea(x, z);
  if (sol.factor > 0) {
    y = y * (1.0 - sol.factor) + sol.targetY * sol.factor;
  }

  // Costura curvada y orgánica en la unión con Ruta 1 al oeste
  const ondaCostura = 1.5 * Math.sin(z * 0.42);
  const limCostura = -11.5 + ondaCostura;
  if (x < limCostura) {
    const tCostura = Math.max(0, Math.min(1, (x - (limCostura - 4.5)) / 4.5));
    y *= (tCostura * tCostura * (3 - 2 * tCostura));
  }
  return y;
}

function evaluateAldeaTerrainColor(x, z, y) {
  const c = new THREE.Color();
  const dCam = calcDistCaminoAldea(x, z);
  const dPlaza = Math.hypot(x - 2.5, z - 1.5);
  const sol = calcSolarFactorAldea(x, z);

  // Acceso al mar en la caleta este: arena dorada de playa
  if (x > 8.0 && Math.abs(z - 1.5) < 4.5 && y <= 0.22) {
    const fPlaya = Math.min(1, (x - 8.0) / 5.5);
    const colPlaya = new THREE.Color(0xdfc89e).lerp(new THREE.Color(0xbda478), Math.max(0, (0.22 - y) / 0.35));
    if (y < -0.05) colPlaya.lerp(new THREE.Color(0x0ea5e9), 0.45); // Orilla húmeda con mar
    c.setHex(0x44862a);
    c.lerp(colPlaya, fPlaya);
    return c;
  }

  if (dPlaza < 3.8) {
    const fP = Math.min(1, (3.8 - dPlaza) / 0.9);
    const patronLosa = Math.sin(x * 5.2) * Math.cos(z * 5.2);
    const colPlaza = new THREE.Color(0x9a8a7a).lerp(new THREE.Color(0xb8905a), 0.45 + 0.35 * patronLosa);
    if (dPlaza < 1.35) {
      colPlaza.lerp(new THREE.Color(0x7e7062), 0.65);
    }
    c.setHex(0x44862a);
    c.lerp(colPlaza, fP);
    return c;
  }

  if (dCam < 1.40) {
    const fCamino = Math.min(1, (1.40 - dCam) / 0.55);
    const colCam = new THREE.Color(0xc39356);
    if (dCam < 0.55) {
      colCam.lerp(new THREE.Color(0xaf7e44), 1.0 - dCam / 0.55);
    } else if (dCam > 0.95) {
      const fVerge = (dCam - 0.95) / 0.45;
      colCam.lerp(new THREE.Color(0x84993e), fVerge);
    }
    c.setHex(0x44862a);
    c.lerp(colCam, fCamino);
    return c;
  }

  if (sol.factor > 0) {
    const patronSolar = Math.sin(x * 3.8 + z * 3.8) * 0.15;
    const colSolar = new THREE.Color(0xa98450).lerp(new THREE.Color(0x917142), 0.5 + patronSolar);
    c.setHex(0x44862a);
    c.lerp(colSolar, sol.factor);
    return c;
  }

  const ruido = 0.08 * Math.sin(x * 1.6) * Math.cos(z * 1.4) + 0.04 * Math.sin(x * 3.5);
  c.setHex(0x44862a);
  c.lerp(new THREE.Color(0x5ca635), Math.max(0, Math.min(1, 0.5 + ruido)));

  if (y > 0.95) {
    const factorRoca = Math.min(1, (y - 0.95) / 0.90);
    c.lerp(new THREE.Color(0x7c7365), factorRoca * 0.60);
  }
  return c;
}

// -------------------------------------------------------------
// CONSTRUCTORES DE PIEZAS Y TRAMOS
// -------------------------------------------------------------
/**
 * Pinta una geometría con colores por vértice: fn(x, y, z) → THREE.Color (coordenadas locales de la geometría).
 * createClayMesh detecta el atributo 'color' y usa material con vertexColors.
 */
function colorearGeo(geo, fn) {
  const p = geo.attributes.position, cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) fn(p.getX(i), p.getY(i), p.getZ(i)).toArray(cols, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}
const suaveC = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Roca con vetas, más clara arriba y con musgo en la parte alta
function colorRocaMusgo(base, claro, yMusgo, ruido = 1) {
  const cB = new THREE.Color(base), cC = new THREE.Color(claro), musgo = new THREE.Color(0x5a8a3a), musgo2 = new THREE.Color(0x76a648);
  return (x, y, z) => {
    const veta = 0.5 + 0.5 * Math.sin(x * 3.1 + Math.sin(z * 2.3) * 1.5 + y * 1.7) * ruido;
    const c = cB.clone().lerp(cC, 0.25 + 0.45 * veta * suaveC(-0.5, yMusgo, y));
    const m = suaveC(yMusgo - 0.25, yMusgo + 0.2, y + 0.15 * Math.sin(x * 4.2 + z * 3.3));
    return c.lerp(Math.sin(x * 7 + z * 5) > 0 ? musgo : musgo2, 0.85 * m);
  };
}

function buildCaveStructure3D(x = 0, y = 0, z = 0, scale = 1.0, routeId = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);

  const segW = Math.max(16, Math.round(20 * state.subdivisionMultiplier));
  const segH = Math.max(12, Math.round(14 * state.subdivisionMultiplier));

  const moundGeo = new THREE.SphereGeometry(2.6, segW, segH, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const mPos = moundGeo.attributes.position;
  for (let i = 0; i < mPos.count; i++) {
    let vx = mPos.getX(i) * 1.25;
    let vy = mPos.getY(i) * 1.05;
    let vz = mPos.getZ(i) * 1.15;

    const rockRipple = 1.0 + Math.sin(vx * 2.2) * Math.cos(vy * 2.5) * 0.12;
    vx *= rockRipple;
    vy *= rockRipple;

    if (vz > 0.8 && Math.abs(vx) < 1.35 && vy < 1.85) {
      const archFactor = Math.max(0, 1.0 - Math.hypot(vx / 1.35, (vy - 0.6) / 1.35));
      vz -= archFactor * 2.2;
    }

    mPos.setXYZ(i, vx, vy - 0.2, vz);
  }
  colorearGeo(moundGeo, colorRocaMusgo(0x6a6056, 0xa49a8c, 1.75));
  group.add(createClayMesh(moundGeo, 'BovedaRocosaCueva', segW, segH));

  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.55, -0.1, 1.65),
    new THREE.Vector3(-1.35, 1.45, 1.55),
    new THREE.Vector3(0.0,   2.15, 1.45),
    new THREE.Vector3(1.35,  1.45, 1.55),
    new THREE.Vector3(1.55, -0.1, 1.65)
  ]);
  const archGeo = new THREE.TubeGeometry(archCurve, 20, 0.42, 10, false);
  colorearGeo(archGeo, colorRocaMusgo(0x5a5148, 0x8a8074, 1.95));
  group.add(createClayMesh(archGeo, 'ArcoEntradaCueva', 20, 10));

  const leftButtress = new THREE.SphereGeometry(0.95, 12, 10);
  leftButtress.scale(1.2, 0.9, 1.1);
  leftButtress.translate(-1.85, 0.55, 1.6);
  colorearGeo(leftButtress, colorRocaMusgo(0x6a6056, 0x9a9082, 1.1));
  group.add(createClayMesh(leftButtress, 'ContrafuerteCuevaIzq', 12, 10));

  const rightButtress = new THREE.SphereGeometry(0.88, 12, 10);
  rightButtress.scale(1.1, 0.85, 1.1);
  rightButtress.translate(1.85, 0.5, 1.6);
  colorearGeo(rightButtress, colorRocaMusgo(0x6a6056, 0x9a9082, 1.05));
  group.add(createClayMesh(rightButtress, 'ContrafuerteCuevaDer', 12, 10));

  for (let s = 0; s < 2; s++) {
    const stepGeo = new THREE.BoxGeometry(2.4 + s * 0.3, 0.22, 0.75, 6, 1, 2);
    stepGeo.translate(0, -0.05 - s * 0.18, 2.0 + s * 0.65);
    colorearGeo(stepGeo, (x, y, z) => new THREE.Color(0x8a8276).lerp(new THREE.Color(0xa8a094), 0.5 + 0.5 * Math.sin(x * 2.7 + z * 4.1)));
    group.add(createClayMesh(stepGeo, `UmbralCueva_${s + 1}`));
  }

  return registerSceneObject(group, 'Cueva 3D con Desnivel', 'cave', 'cave3d', {}, routeId);
}

function buildTieredPineMesh(x = 0, y = 0, z = 0, scale = 1.0, tiers = 3, routeId = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);

  const radialSegs = Math.max(12, Math.round(16 * state.subdivisionMultiplier));
  const heightSegs = Math.max(3, Math.round(4 * state.subdivisionMultiplier));

  // --- Tronco ---
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 0.9, radialSegs, 2, true);
  trunkGeo.translate(0, 0.45, 0);
  const troncoMesh = createClayMesh(trunkGeo, 'TroncoPino', radialSegs, 2);
  // Pintura procedural: corteza marrón oscura con musgo basal
  (function pintarTronco(malla) {
    const g = malla.geometry;
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const cCorteza = new THREE.Color(0x4c3a28);
    const cSombra  = new THREE.Color(0x322218);
    const cMusgo   = new THREE.Color(0x3a4c28);
    for (let i = 0; i < pos.count; i++) {
      const vy = pos.getY(i);
      const ang = Math.atan2(pos.getZ(i), pos.getX(i));
      const estria = 0.5 + 0.5 * Math.sin(ang * 7 + vy * 10);
      const c = cCorteza.clone().lerp(cSombra, estria * 0.38);
      if (vy < 0.45) c.lerp(cMusgo, Math.pow(1 - vy / 0.45, 1.4) * 0.6);
      col[i * 3]     = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    malla.material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    applyRenderStyleToMesh(malla);
  })(troncoMesh);
  group.add(troncoMesh);

  // --- Conos (capas de agujas) ---
  for (let t = 0; t < tiers; t++) {
    const p = t / Math.max(1, tiers - 1);
    const bottomR = 1.15 * (1 - p * 0.42);
    const topR = (t === tiers - 1) ? 0.04 : 0.28 * (1 - p * 0.4);
    const h = 1.15 * (1 - p * 0.18);
    const yBase = 0.65 + t * 0.72;

    const coneGeo = new THREE.CylinderGeometry(topR, bottomR, h, radialSegs, heightSegs, true);
    coneGeo.translate(0, yBase + h / 2, 0);
    const conoMesh = createClayMesh(coneGeo, `ConoPino_${t + 1}`, radialSegs, heightSegs);
    // Pintura procedural: verde pino con sombra profunda en la base y brillo en la cima
    (function pintarCono(malla, yB, altura) {
      const g = malla.geometry;
      const pos = g.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const cBase   = new THREE.Color(0x142c18); // sombra densa inferior
      const cCuerpo = new THREE.Color(0x285430); // verde bosque
      const cCima   = new THREE.Color(0x6ca448); // brillo acícula soleada
      for (let i = 0; i < pos.count; i++) {
        const yRel = Math.max(0, Math.min(1, (pos.getY(i) - yB) / altura));
        let c;
        if (yRel < 0.25) {
          c = cBase.clone().lerp(cCuerpo, yRel / 0.25);
        } else {
          c = cCuerpo.clone().lerp(cCima, Math.pow((yRel - 0.25) / 0.75, 1.2) * 0.9);
        }
        const ang = Math.atan2(pos.getZ(i), pos.getX(i));
        const rib = 0.5 + 0.5 * Math.sin(ang * 12);
        c.offsetHSL(0, (rib - 0.5) * 0.04, (rib - 0.5) * 0.03);
        col[i * 3]     = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      malla.material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      applyRenderStyleToMesh(malla);
    })(conoMesh, yBase, h);
    group.add(conoMesh);
  }

  return registerSceneObject(group, 'Pino Cónico en Capas', 'tree', 'pine', { tiers }, routeId);
}

function buildBoulderMesh(x = 0, y = 0, z = 0, radius = 0.65, routeId = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const segW = Math.max(10, Math.round(14 * state.subdivisionMultiplier));
  const segH = Math.max(8, Math.round(10 * state.subdivisionMultiplier));
  const geo = new THREE.SphereGeometry(radius, segW, segH);
  geo.scale(1.12, 0.78, 0.96);
  geo.translate(0, radius * 0.52, 0);

  colorearGeo(geo, colorRocaMusgo(0x777068, 0xb4ac9e, radius * 1.15));
  group.add(createClayMesh(geo, 'RocaEsferica', segW, segH));
  return registerSceneObject(group, 'Roca Esférica', 'boulder', 'boulder', { radius }, routeId);
}

function buildCuttableBushMesh(x = 0, y = 0, z = 0, radius = 0.75, routeId = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const segW = Math.max(12, Math.round(16 * state.subdivisionMultiplier));
  const segH = Math.max(8, Math.round(12 * state.subdivisionMultiplier));
  const geo = new THREE.SphereGeometry(radius, segW, segH);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);
    const angle = Math.atan2(vz, vx);
    const lobe = 1.0 + Math.cos(angle * 5) * 0.12;
    pos.setXYZ(i, vx * lobe, vy * 0.85 + radius * 0.65, vz * lobe);
  }

  colorearGeo(geo, (x, y, z) => new THREE.Color(0x2a6a2c).lerp(new THREE.Color(0x4fa040), suaveC(radius * 0.2, radius * 1.4, y))
    .lerp(new THREE.Color(0x6cc04e), 0.35 * Math.max(0, Math.sin(Math.atan2(z, x) * 5)) * suaveC(radius * 0.6, radius * 1.4, y)));
  group.add(createClayMesh(geo, 'ArbustoAtajo', segW, segH));
  return registerSceneObject(group, 'Arbusto de Atajo', 'bush', 'bush', { radius }, routeId);
}

function buildMataHierbaGroup(x = 0, y = 0, z = 0, scale = 1.0, seed = 1) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);

  const numHojas = Math.max(16, Math.round(28 * (state.subdivisionMultiplier || 1)));
  const radioBase = 0.32;
  const rnd = (s) => {
    let a = (s * 9301 + 49297) % 233280;
    return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  };
  const r = rnd(seed * 83 + 19);

  for (let i = 0; i < numHojas; i++) {
    const az = (i / numHojas) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const rb = Math.sqrt(r()) * radioBase;
    const centro = 1 - rb / radioBase;
    const alto = 0.65 + centro * 0.52 + r() * 0.28;
    const ancho = 0.05 + r() * 0.025;
    const inclinacion = 0.25 + (1 - centro) * 0.6 + r() * 0.22;

    const filas = Math.max(3, Math.round(5 * (state.subdivisionMultiplier || 1)));
    const geo = new THREE.PlaneGeometry(ancho, 1, 1, filas);
    const pos = geo.attributes.position;
    for (let p = 0; p < pos.count; p++) {
      const t = pos.getY(p) + 0.5;
      const w = pos.getX(p) * Math.pow(Math.max(0, 1 - t), 0.6);
      const yy = alto * t * (1 - 0.35 * inclinacion * t * t);
      const zz = alto * inclinacion * t * t * 0.7 - Math.abs(w) * 0.6;
      pos.setXYZ(p, w, yy, zz);
    }
    geo.rotateY(az);
    geo.translate(Math.sin(az) * rb, 0, Math.cos(az) * rb);

    const hojaMesh = createClayMesh(geo, `Hoja_${i + 1}`, 1, filas);
    // Pintura procedural: gradiente verde oscuro basal → verde vivo → amarillo-verde en punta
    {
      const hg = hojaMesh.geometry;
      const hPos = hg.attributes.position;
      const hCol = new Float32Array(hPos.count * 3);
      const cBase  = new THREE.Color(0x2e6e1a);
      const cMedio = new THREE.Color(0x46a028);
      const cPunta = new THREE.Color(0x78c844);
      for (let vi = 0; vi < hPos.count; vi++) {
        const t = Math.max(0, Math.min(1, hPos.getY(vi) / (alto > 0 ? alto : 1)));
        const c = t < 0.5
          ? cBase.clone().lerp(cMedio, t * 2)
          : cMedio.clone().lerp(cPunta, (t - 0.5) * 2);
        c.offsetHSL((r() - 0.5) * 0.04, 0, 0);
        hCol[vi * 3]     = c.r;
        hCol[vi * 3 + 1] = c.g;
        hCol[vi * 3 + 2] = c.b;
      }
      hg.setAttribute('color', new THREE.Float32BufferAttribute(hCol, 3));
      hojaMesh.material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      applyRenderStyleToMesh(hojaMesh);
    }
    group.add(hojaMesh);
  }

  return group;
}

function buildMataHierbaMesh(x = 0, y = 0, z = 0, scale = 1.0, routeId = null) {
  const tuft = buildMataHierbaGroup(x, y, z, scale, Math.floor(Math.random() * 5000));
  return registerSceneObject(tuft, 'Mata de Hierba', 'grass', 'mata_hierba', { scale }, routeId);
}

function buildTallGrassPatchMesh(x, z, wCols, hRows, routeId = null) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // 1. Suelo sutil de base con ligera ondulación
  const segW = Math.max(4, Math.round(wCols * 1.5 * state.subdivisionMultiplier));
  const segH = Math.max(4, Math.round(hRows * 1.5 * state.subdivisionMultiplier));
  const geo = new THREE.PlaneGeometry(wCols, hRows, segW, segH);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    const edgeX = 1.0 - Math.pow(px / (wCols * 0.5), 4);
    const edgeZ = 1.0 - Math.pow(pz / (hRows * 0.5), 4);
    const mask = Math.max(0, edgeX * edgeZ);
    const ripple = (0.08 + 0.05 * Math.sin(px * 3.5) * Math.cos(pz * 3.5)) * mask;
    pos.setY(i, ripple);
  }
  const lechoMesh = createClayMesh(geo, 'LechoHierbaAlta', segW, segH);
  // Pintura procedural: verde musgo oscuro con variación natural
  {
    const lg = lechoMesh.geometry;
    const lPos = lg.attributes.position;
    const lCol = new Float32Array(lPos.count * 3);
    const cMusgo  = new THREE.Color(0x2e6418);
    const cVerde  = new THREE.Color(0x3e7a20);
    const cClaro  = new THREE.Color(0x52922a);
    for (let i = 0; i < lPos.count; i++) {
      const px = lPos.getX(i);
      const pz = lPos.getZ(i);
      const n = 0.5 + 0.5 * Math.sin(px * 2.1) * Math.cos(pz * 1.9);
      const c = cMusgo.clone().lerp(cVerde, n * 0.7).lerp(cClaro, Math.max(0, n - 0.5) * 0.6);
      lCol[i * 3]     = c.r;
      lCol[i * 3 + 1] = c.g;
      lCol[i * 3 + 2] = c.b;
    }
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lCol, 3));
    lechoMesh.material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    applyRenderStyleToMesh(lechoMesh);
  }
  group.add(lechoMesh);

  // 2. Campo regular de Matas de Hierba 3D (como en la captura y el juego)
  const stepX = 1.35;
  const stepZ = 1.35;
  const countX = Math.max(1, Math.floor(wCols / stepX));
  const countZ = Math.max(1, Math.floor(hRows / stepZ));
  const startX = -((countX - 1) * stepX) / 2;
  const startZ = -((countZ - 1) * stepZ) / 2;

  const rnd = (seed) => {
    let s = (seed % 2147483647) || 1;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  };
  const rand = rnd(Math.round(wCols * 73 + hRows * 19));

  for (let r = 0; r < countZ; r++) {
    for (let c = 0; c < countX; c++) {
      const jx = (rand() - 0.5) * 0.3;
      const jz = (rand() - 0.5) * 0.3;
      const px = startX + c * stepX + jx;
      const pz = startZ + r * stepZ + jz;
      const sc = 0.85 + rand() * 0.3;

      const tuft = buildMataHierbaGroup(px, 0, pz, sc, r * countX + c + 1);
      group.add(tuft);
    }
  }

  return registerSceneObject(group, 'Zona de Hierba Alta', 'grass', 'tall_grass', { wCols, hRows }, routeId);
}

function buildRouteSignMesh(x = 0, y = 0, z = 0, routeId = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 1.2, 8, 2, true);
  postGeo.translate(0, 0.6, 0);
  colorearGeo(postGeo, (x, y) => new THREE.Color(0x6e4626).lerp(new THREE.Color(0x8a5a34), Math.abs(Math.sin(y * 9)) > 0.9 ? 0 : 0.7));
  group.add(createClayMesh(postGeo, 'PosteLetrero', 8, 2));

  const boardGeo = new THREE.BoxGeometry(1.1, 0.65, 0.18, 4, 2, 1);
  boardGeo.translate(0, 1.15, 0);
  colorearGeo(boardGeo, (x, y) => (Math.abs(y - 1.15) > 0.27 || Math.abs(x) > 0.5 ? new THREE.Color(0x7a4e2c) : new THREE.Color(0xd6a868).lerp(new THREE.Color(0xc08e52), 0.5 + 0.5 * Math.sin(y * 30))));
  group.add(createClayMesh(boardGeo, 'TablaLetrero'));

  return registerSceneObject(group, 'Letrero de Ruta', 'prop', 'sign', {}, routeId);
}

/**
 * Constructor de lámina de agua translúcida con ondulación animada
 */
function buildWaterPlane(x = 0, y = -0.42, z = 0, width = 8, depth = 5, label = 'Lámina de Agua', routeId = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const segW = Math.max(16, Math.round(width * 2.2));
  const segD = Math.max(12, Math.round(depth * 2.2));
  const geo = new THREE.PlaneGeometry(width, depth, segW, segD);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x1aaec8,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'SuperficieAgua';
  mesh.userData.isWaterSurface = true;
  mesh.userData.baseY = y;
  mesh.userData.width = width;
  mesh.userData.depth = depth;

  const origY = new Float32Array(geo.attributes.position.count);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    origY[i] = geo.attributes.position.getY(i);
  }
  mesh.userData.origY = origY;

  const wireGeo = buildQuadWireGeometry(geo, segW, segD);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x085078, transparent: true, opacity: 0.35 });
  const wire = new THREE.LineSegments(wireGeo, wireMat);
  wire.name = 'wireOverlay';
  mesh.add(wire);

  group.add(mesh);

  return registerSceneObject(group, label, 'water', 'water_plane', { width, depth }, routeId);
}

function buildRuta1SliceMesh(rowStart, rowEnd, label, divId, worldXOffset = 0, worldZCenter = 0, routeId = null) {
  const COLS = 34;
  const sliceRows = rowEnd - rowStart;

  const segCols = Math.max(24, Math.round(COLS * 3.2 * state.subdivisionMultiplier));
  const segRows = Math.max(12, Math.round(sliceRows * 3.2 * state.subdivisionMultiplier));

  const geo = new THREE.PlaneGeometry(COLS, sliceRows, segCols, segRows);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const col = localX + COLS / 2;
    const row = rowStart + (localZ + sliceRows / 2);
    const yVal = evaluateRuta1TerrainHeight(col, row, true);
    pos.setY(i, yVal);
    const colVal = evaluateRuta1TerrainColor(col, row, yVal);
    colors.push(colVal.r, colVal.g, colVal.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const group = new THREE.Group();
  group.position.set(worldXOffset, 0, worldZCenter);
  group.add(createClayMesh(geo, `Malla_${divId}`, segCols, segRows));

  return registerSceneObject(group, label, 'terrain', 'terrain_slice', {
    rowStart,
    rowEnd,
    width: COLS,
    depth: sliceRows,
    segCols,
    segRows,
    divId
  }, routeId);
}

/**
 * Faldón costero: suaviza el corte vertical entre una aldea y el mar.
 * Toma el borde real de la malla de terreno (alturas y colores) en los lados indicados ('N' = -z, 'S' = +z,
 * 'E' = +x, 'O' = -x) y baja en pendiente rocosa hasta debajo del agua (el mar de la isla está a y ≈ -0.32).
 * Las esquinas entre dos lados costeros se cierran con un abanico redondeado. Se añade al mismo grupo del terreno.
 */
function agregarFaldonCosta(group, geo, lados, opts = {}) {
  const ANCHO = opts.ancho || 1.8;
  const FONDO = opts.fondo ?? -1.05;
  const roca = new THREE.Color(opts.roca || 0x8c8378);
  const rocaOsc = new THREE.Color(opts.rocaOsc || 0x5a524a);
  const arena = new THREE.Color(opts.arena || 0xd8c49a);
  const pos = geo.attributes.position, col = geo.attributes.color;
  geo.computeBoundingBox();
  const bb = geo.boundingBox, eps = 1e-3;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const borde = (lado) => {
    const pts = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const ok = (lado === 'N' && Math.abs(z - bb.min.z) < eps) || (lado === 'S' && Math.abs(z - bb.max.z) < eps) ||
                 (lado === 'E' && Math.abs(x - bb.max.x) < eps) || (lado === 'O' && Math.abs(x - bb.min.x) < eps);
      if (ok) pts.push({ x, y: pos.getY(i), z, c: col ? new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)) : roca.clone() });
    }
    pts.sort((a, b) => (lado === 'N' || lado === 'S') ? a.x - b.x : a.z - b.z);
    return pts;
  };
  // Perfil: baja con curva suave, con bultos rocosos irregulares a media pendiente
  const perfil = (y0, s, u) => {
    const bulto = Math.max(0, Math.sin(u * 2.3) * Math.sin(u * 0.9 + 1.3) + 0.35 * Math.sin(u * 5.1)) * Math.sin(Math.PI * Math.min(1, s * 1.15));
    return y0 + (FONDO - y0) * sm(0, 1, s) + 0.22 * bulto;
  };
  const colorPerfil = (c0, s, y) => {
    const c = c0.clone().lerp(roca, sm(0.02, 0.3, s));
    if (y < -0.18 && y > -0.42) c.lerp(arena, 0.45); // franja de orilla
    return c.lerp(rocaOsc, sm(-0.3, -0.8, y));
  };
  const malla = (puntosBorde, nOut, haciaFuera, nombre) => {
    const nA = puntosBorde.length - 1;
    const g2 = new THREE.PlaneGeometry(1, 1, nA, nOut);
    const p2 = g2.attributes.position, colores = [];
    for (let r = 0; r <= nOut; r++) {
      for (let a = 0; a <= nA; a++) {
        const b = puntosBorde[a], s = r / nOut, [dx, dz] = haciaFuera(b, s);
        const y = perfil(b.y, s, b.u);
        p2.setXYZ(r * (nA + 1) + a, b.x + dx * ANCHO * s, y, b.z + dz * ANCHO * s);
        const c = colorPerfil(b.c, s, y);
        colores.push(c.r, c.g, c.b);
      }
    }
    g2.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
    group.add(createClayMesh(g2, nombre, nA, nOut));
  };
  const normal = { N: [0, -1], S: [0, 1], E: [1, 0], O: [-1, 0] };
  const nOut = 8;
  lados.forEach((lado) => {
    const pts = borde(lado);
    pts.forEach((p) => { p.u = (lado === 'N' || lado === 'S') ? p.x : p.z; });
    malla(pts, nOut, () => normal[lado], `FaldonCosta_${lado}`);
  });
  // Esquinas redondeadas entre lados costeros
  [['N', 'E'], ['E', 'S'], ['S', 'O'], ['O', 'N']].forEach(([l1, l2]) => {
    if (!lados.includes(l1) || !lados.includes(l2)) return;
    const cx = (l1 === 'E' || l2 === 'E') ? bb.max.x : bb.min.x;
    const cz = (l1 === 'S' || l2 === 'S') ? bb.max.z : bb.min.z;
    const b1 = borde(l1), esq = b1.reduce((m, p) => (Math.hypot(p.x - cx, p.z - cz) < Math.hypot(m.x - cx, m.z - cz) ? p : m), b1[0]);
    const a1 = Math.atan2(normal[l1][1], normal[l1][0]);
    let a2 = Math.atan2(normal[l2][1], normal[l2][0]);
    if (a2 < a1) a2 += Math.PI * 2;
    const nA = 8, abanico = [];
    for (let k = 0; k <= nA; k++) {
      const ang = a1 + (a2 - a1) * (k / nA);
      abanico.push({ x: esq.x, y: esq.y, z: esq.z, c: esq.c, u: cx + cz + k * 0.4, ang });
    }
    malla(abanico, nOut, (b) => [Math.cos(b.ang), Math.sin(b.ang)], `FaldonEsquina_${l1}${l2}`);
  });
}

function buildAldeaTerrainMesh(worldXOffset = 0, worldZCenter = 0, routeId = null) {
  const COLS = 34;
  const DEPTH = 28;

  const segCols = Math.max(24, Math.round(COLS * 3.2 * state.subdivisionMultiplier));
  const segRows = Math.max(12, Math.round(DEPTH * 3.2 * state.subdivisionMultiplier));

  const geo = new THREE.PlaneGeometry(COLS, DEPTH, segCols, segRows);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const yVal = evaluateAldeaTerrainHeight(lx, lz);
    pos.setY(i, yVal);
    const colVal = evaluateAldeaTerrainColor(lx, lz, yVal);
    colors.push(colVal.r, colVal.g, colVal.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const group = new THREE.Group();
  group.position.set(worldXOffset, 0, worldZCenter);
  group.add(createClayMesh(geo, 'Malla_aldea_terreno_base', segCols, segRows));
  agregarFaldonCosta(group, geo, ['N', 'S', 'E'], { roca: 0x8a7a68, rocaOsc: 0x5a4c40 });

  // Brocal y pozo rústico en la plaza central
  const px = 2.5;
  const pz = 1.5;
  const brocalGeo = new THREE.CylinderGeometry(0.95, 1.05, 0.70, 16, 1, true);
  brocalGeo.translate(px, 0.35, pz);
  const brocalMesh = createClayMesh(brocalGeo, 'BrocalPozoAldea', 16, 1);
  brocalMesh.material = clayMaterial.clone();
  brocalMesh.material.flatShading = true;
  brocalMesh.material.color.setHex(0x8a7d6e);
  group.add(brocalMesh);

  // Lámina de agua dentro del pozo
  const aguaGeo = new THREE.CircleGeometry(0.85, 16);
  aguaGeo.rotateX(-Math.PI / 2);
  aguaGeo.translate(px, 0.30, pz);
  const matAgua = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
    roughness: 0.15,
    metalness: 0.10
  });
  group.add(new THREE.Mesh(aguaGeo, matAgua));

  return registerSceneObject(group, 'Terreno Base de la Aldea (Caminos y Solares)', 'terrain', 'aldea_terrain', {
    width: COLS,
    depth: DEPTH,
    segCols,
    segRows,
    divId: 'aldea_terreno_base'
  }, routeId);
}

function buildPuertoTerrainMesh(worldXOffset = 0, worldZCenter = 0, routeId = null) {
  const COLS = 34;
  const DEPTH = 28;
  const segCols = Math.max(24, Math.round(COLS * 3.2 * state.subdivisionMultiplier));
  const segRows = Math.max(12, Math.round(DEPTH * 3.2 * state.subdivisionMultiplier));

  const geo = new THREE.PlaneGeometry(COLS, DEPTH, segCols, segRows);
  geo.rotateX(-Math.PI / 2);

  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // Altura del Puerto: bahía en media luna, rampa al mar y toda la tierra cubierta de arena con dunas suaves
  const alturaPuerto = (lx, lz) => {
    let y = 0.0;
    // Costa curvada en media luna (bahía en arco orgánico)
    const arcoBahia = 1.2 - 2.8 * Math.cos((lz / 14.0) * Math.PI * 0.5);
    if (lx < arcoBahia) {
      const fAgua = Math.min(1, (arcoBahia - lx) / 14.0);
      y -= fAgua * fAgua * 0.68;
    }
    // Acceso al mar: rampa central / varadero suave entre muelles hacia el agua
    if (Math.abs(lz) < 3.2 && lx >= -3.5 && lx <= 4.2) {
      const fRampa = Math.max(0, Math.min(1, (4.2 - lx) / 7.7));
      y = y * (1.0 - fRampa) + (-0.14) * fRampa;
    }
    // Dunas bajas y ondas de viento en la arena (solo en tierra firme)
    if (lx > arcoBahia + 0.5) {
      const fTierra = sm(arcoBahia + 0.5, arcoBahia + 2.5, lx);
      y += fTierra * (0.05 * Math.sin(lx * 0.8 + 0.6) * Math.sin(lz * 0.65 + 1.1) + 0.012 * Math.sin(lx * 3.1 + Math.sin(lz * 1.7) * 2.0));
    }
    // Costura orgánica curvada con la Ruta 1 Norte al este
    const corteUnion = 12.0 + 1.6 * Math.sin(lz * 0.42);
    if (lx > corteUnion) {
      const tCostura = Math.max(0, Math.min(1, (17.0 - lx) / (17.0 - corteUnion)));
      y *= (tCostura * tCostura * (3 - 2 * tCostura));
    }
    return y;
  };

  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const y = alturaPuerto(lx, lz);
    pos.setY(i, y);

    const c = new THREE.Color();
    if (y < -0.20) {
      c.setHex(0x0284c7).lerp(new THREE.Color(0x0369a1), Math.min(1, (-0.20 - y) / 0.40)); // Fondo de la bahía
    } else {
      // Arena de playa en toda la aldea, con vetas de viento; más oscura y húmeda junto al agua
      const veta = 0.5 + 0.5 * Math.sin(lx * 3.1 + Math.sin(lz * 1.7) * 2.0);
      c.setHex(0xead29c).lerp(new THREE.Color(0xd8ba82), 0.35 * veta);
      c.lerp(new THREE.Color(0xc4a06a), sm(0.03, -0.12, y));
      if (y < -0.08) c.lerp(new THREE.Color(0x38bdf8), 0.35 * sm(-0.08, -0.2, y));
      // Transición a la hierba del bosque en la costura este
      c.lerp(new THREE.Color(0x48882d), sm(14.0, 16.8, lx));
    }
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const group = new THREE.Group();
  group.position.set(worldXOffset, 0, worldZCenter);
  group.add(createClayMesh(geo, 'Malla_puerto_terreno_base', segCols, segRows));
  agregarFaldonCosta(group, geo, ['N', 'S', 'O'], { roca: 0xa89878, arena: 0xe0c890 });

  // Sendero de peldaños medio enterrados en la arena (piedras planas y tablones de madera)
  // que une la playa con las 4 viviendas pasando por un cruce central.
  const SENDERO_PUERTO = [
    [[3.2, 0.0], [6.0, 0.35], [9.0, 0.0]],                    // playa / muelles → cruce
    [[9.0, 0.0], [7.6, -1.7], [6.5, -3.9]],                   // → Casa del Puerto
    [[9.0, 0.0], [7.6, 1.8], [6.5, 3.6]],                     // → Casa del Marinero
    [[9.0, 0.0], [12.0, 1.0], [14.85, 2.4]],                  // → Casa del Viento
    [[9.0, 0.0], [11.0, -3.0], [11.6, -7.5], [10.8, -11.4]]   // → Casa del Marinero (norte)
  ];
  const matPiedra = clayMaterial.clone(); matPiedra.color.setHex(0xb8b0a4);
  const matPiedra2 = clayMaterial.clone(); matPiedra2.color.setHex(0x9a9288);
  const matMadera = clayMaterial.clone(); matMadera.color.setHex(0x9a6a40);
  let nPeldano = 0;
  SENDERO_PUERTO.forEach((tramo) => {
    const curva = new THREE.CatmullRomCurve3(tramo.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const n = Math.max(2, Math.round(curva.getLength() / 0.72));
    curva.getSpacedPoints(n).forEach((p, k) => {
      if (k === 0 && tramo !== SENDERO_PUERTO[0]) return; // el cruce ya tiene su peldaño
      const t = curva.getTangent(k / n);
      const ang = Math.atan2(t.x, t.z);
      const lado = (k % 2 ? 1 : -1) * 0.1;
      const px = p.x + Math.cos(ang) * lado, pz = p.z - Math.sin(ang) * lado;
      const yS = alturaPuerto(px, pz);
      let m;
      if (nPeldano % 3 === 2) {
        const g = new THREE.BoxGeometry(0.72, 0.1, 0.3, 3, 1, 2);
        m = createClayMesh(g, 'PeldanoMadera', 3, 1);
        m.material = matMadera;
        m.rotation.y = ang;
        m.position.set(px, yS + 0.005, pz);
      } else {
        const r = 0.27 + 0.05 * Math.sin(nPeldano * 2.3);
        const g = new THREE.SphereGeometry(1, 12, 6);
        g.scale(r, 0.07, r * 0.82);
        m = createClayMesh(g, 'PeldanoPiedra', 12, 6);
        m.material = nPeldano % 2 ? matPiedra : matPiedra2;
        m.rotation.y = ang + nPeldano;
        m.position.set(px, yS - 0.005, pz);
      }
      group.add(m);
      nPeldano++;
    });
  });

  // Lámina de agua de la bahía
  const aguaGeo = new THREE.PlaneGeometry(18.0, 26.0, 16, 16);
  aguaGeo.rotateX(-Math.PI / 2);
  aguaGeo.translate(-8.0, -0.15, 0);
  const matAgua = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.80,
    roughness: 0.12,
    metalness: 0.08
  });
  group.add(new THREE.Mesh(aguaGeo, matAgua));

  // Muelles de madera con tablones
  [-6.0, 6.0].forEach(mz => {
    for (let k = 0; k < 18; k++) {
      const tx = 1.0 - k * 0.55;
      const tGeo = new THREE.BoxGeometry(0.50, 0.12, 2.4, 2, 1, 4);
      tGeo.translate(tx, 0.12, mz);
      const mTab = createClayMesh(tGeo, 'TablonMuelle', 2, 1);
      mTab.material = clayMaterial.clone();
      mTab.material.flatShading = true;
      mTab.material.color.setHex(0x785e43);
      group.add(mTab);
    }
  });

  // Mástiles con banderolas de viento (Viento 🌪️)
  [[1.5, -9.0], [1.5, 9.0], [2.5, 0.0]].forEach(([mx, mz], idx) => {
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.8, 6, 1);
    postGeo.translate(mx, 1.9, mz);
    const mPost = createClayMesh(postGeo, `MastilViento_${idx}`, 6, 1);
    mPost.material = clayMaterial.clone();
    mPost.material.color.setHex(0x8a7a68);
    group.add(mPost);

    const bandGeo = new THREE.BoxGeometry(1.6, 0.38, 0.04, 4, 1, 1);
    bandGeo.translate(mx + 0.8, 3.5, mz);
    const mBand = createClayMesh(bandGeo, `BanderolaViento_${idx}`, 4, 1);
    mBand.material = clayMaterial.clone();
    mBand.material.color.setHex(0x93c5fd); // Celeste Viento
    group.add(mBand);
  });

  return registerSceneObject(group, 'Puerto del Viento (Bahía y Muelles)', 'terrain', 'puerto_terrain', {
    width: COLS, depth: DEPTH, segCols, segRows, divId: 'puerto_terreno_base'
  }, routeId);
}

function buildCiudadSurTerrainMesh(worldXOffset = 0, worldZCenter = 0, routeId = null) {
  const COLS = 34;
  const DEPTH = 24;
  // Resolución más alta que las otras aldeas para que se note el relieve de las baldosas
  const segCols = Math.max(24, Math.round(COLS * 6 * state.subdivisionMultiplier));
  const segRows = Math.max(12, Math.round(DEPTH * 6 * state.subdivisionMultiplier));

  const geo = new THREE.PlaneGeometry(COLS, DEPTH, segCols, segRows);
  geo.rotateX(-Math.PI / 2);

  // ---- Pavimento de baldosas de la Ciudad de la Forja (la aldea más moderna) ----
  // zona: 'avenida' | 'plaza' | 'acera' | 'solar' | 'muro' | 'pavimento' | null ; baldosa: { borde (0 = junta, 1 = centro), id }
  // Muralla perimetral: rectángulo de esquinas redondeadas abierto al norte (entrada del bosque, cerrada con vallas)
  // y con un único hueco al sur (rampa al mar). distBorde > 0 = fuera del recinto (sobre la muralla).
  const suaveF = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const distBorde = (lx, lz) => {
    const HX = 15.3, ZS = 10.3, R = 3.5;
    const qx = Math.abs(lx) - (HX - R), qz = lz - (ZS - R);
    if (qz < 0) return Math.abs(lx) - HX;
    if (qx < 0) return lz - ZS;
    return Math.hypot(qx, qz) - R;
  };
  const alturaMuro = (lx, lz) => {
    let h = 0.95 * suaveF(-0.1, 1.0, distBorde(lx, lz));
    if (lz > 4.5) h *= suaveF(3.4, 4.6, Math.abs(lx)); // hueco de la rampa al mar
    return h;
  };
  const zonaForja = (lx, lz) => {
    if (Math.abs(lx) < 3.4 && lz > 4.5) return null; // rampa al mar
    if (alturaMuro(lx, lz) > 0.06) return 'muro';
    if (Math.hypot(lx, lz - 1.0) < 4.5) return 'plaza';
    if (Math.abs(lx) < 2.5 && lz > -12) return 'avenida';
    if ((Math.abs(Math.abs(lx) - 8.0) < 3.5 && Math.abs(lz + 4.5) < 2.8) || (Math.abs(Math.abs(lx) - 8.5) < 3.2 && Math.abs(lz - 5.5) < 2.6)) return 'solar';
    if (Math.abs(lx) < 4.6 && lz > -11 && lz < 4.5) return 'acera';
    return 'pavimento';
  };
  const baldosa = (u, v, tam, desfase = 0) => {
    const fv = v / tam, fila = Math.floor(fv);
    const fu = u / tam + (fila % 2 ? desfase : 0), col = Math.floor(fu);
    const du = Math.min(fu - col, col + 1 - fu) * tam, dv = Math.min(fv - fila, fila + 1 - fv) * tam;
    const borde = Math.min(1, Math.min(du, dv) / 0.13);
    return { borde, id: (col * 73856093) ^ (fila * 19349663) };
  };
  const baldosaZona = (zona, lx, lz) => {
    if (zona === 'plaza') {
      const r = Math.hypot(lx, lz - 1.0), a = Math.atan2(lz - 1.0, lx);
      const anillo = Math.floor(r / 0.9), nSeg = Math.max(6, anillo * 8);
      const fa = (a / (Math.PI * 2) + 0.5) * nSeg + anillo * 0.5;
      const dr = Math.min(r / 0.9 - anillo, anillo + 1 - r / 0.9) * 0.9;
      const da = Math.min(fa - Math.floor(fa), Math.ceil(fa) - fa) * (Math.PI * 2 * Math.max(r, 0.3) / nSeg);
      return { borde: Math.min(1, Math.min(dr, anillo === 0 ? 1 : da) / 0.13), id: anillo * 31 + Math.floor(fa) };
    }
    if (zona === 'avenida') return baldosa(lx + 2.5, lz, 1.25, 0.5);
    if (zona === 'acera') return baldosa(lx, lz, 0.7);
    if (zona === 'solar') return baldosa(lx, lz, 0.85, 0.5);
    if (zona === 'pavimento') return baldosa(lx + 0.3, lz, 1.0, 0.5);
    if (zona === 'muro') return baldosa(lx + 0.5, lz + 0.25, 1.1, 0.5);
    return { borde: 1, id: 0 };
  };

  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);

    // Muralla perimetral redondeada (cierra la ciudad salvo la rampa al mar y la entrada del bosque)
    let y = alturaMuro(lx, lz);

    // Rampa / embarcadero de acceso al mar al sur (continuación de la gran avenida)
    if (Math.abs(lx) < 3.4 && lz > 4.5) {
      const fRampaS = Math.min(1, (lz - 4.5) / 7.5);
      y = y * (1.0 - fRampaS) + (-0.16) * fRampaS;
    }

    if (Math.abs(lx) < 2.2 && lz < 2.0) y -= 0.05;
    if (Math.hypot(lx, lz - 1.0) < 4.5) y -= 0.04;
    if (Math.abs(Math.abs(lx) - 8.0) < 3.5 && Math.abs(lz + 4.5) < 2.8) y = 0.08;
    if (Math.abs(Math.abs(lx) - 8.5) < 3.2 && Math.abs(lz - 5.5) < 2.6) y = 0.08;
    if (Math.abs(lx) < 3.0 && Math.abs(lz - 7.5) < 2.4 && lz <= 4.5) y = 0.08;

    // Relieve de baldosas: aceras elevadas como bordillo y juntas hundidas entre piezas
    const zonaB = zonaForja(lx, lz);
    if (zonaB) {
      if (zonaB === 'acera') y = Math.max(y, 0.07);
      const bz = baldosaZona(zonaB, lx, lz);
      y -= 0.045 * (1 - bz.borde * bz.borde * (3 - 2 * bz.borde));
    }

    // Costura curvada orgánica en la unión norte con Ruta 1 Sur
    const ondaNorte = 1.4 * Math.sin(lx * 0.38);
    const corteNorte = -7.5 + ondaNorte;
    if (lz < corteNorte) {
      const tCostura = Math.max(0, Math.min(1, (lz - (-12.0)) / (corteNorte - (-12.0))));
      y *= (tCostura * tCostura * (3 - 2 * tCostura));
    }
    pos.setY(i, y);

    const c = new THREE.Color();
    const dPlaza = Math.hypot(lx, lz - 1.0);
    const zonaC = zonaForja(lx, lz);
    const bC = zonaC ? baldosaZona(zonaC, lx, lz) : null;
    const tono = bC ? ((bC.id % 3) + 3) % 3 : 0; // variación suave entre baldosas
    const junta = bC ? 1 - bC.borde : 0;

    // Acceso al mar al sur: rampa de atraque de piedra volcánica
    if (Math.abs(lx) < 3.4 && lz > 4.5) {
      c.setHex(0x5a4d46).lerp(new THREE.Color(0x3e342f), Math.min(1, (lz - 4.5) / 7.5));
      if (y < -0.06) c.lerp(new THREE.Color(0x38bdf8), 0.40);
    } else if (zonaC === 'plaza') {
      // Plaza en anillos de baldosas cobre/basalto, aro dorado y centro de Rayo
      const anillo = Math.floor(dPlaza / 0.9);
      c.setHex(anillo % 2 ? 0x8a5a3a : 0x5a4a44).lerp(new THREE.Color(0xb86c32), 0.12 * tono);
      if (dPlaza < 1.6) c.setHex(0xd4a017).lerp(new THREE.Color(0xfacc15), 0.2 * tono); // Destello Rayo
      if (Math.abs(dPlaza - 3.6) < 0.12) c.setHex(0xfacc15); // Aro de luz dorado
      c.lerp(new THREE.Color(0x2a2226), junta * 0.75);
    } else if (zonaC === 'avenida') {
      // Gran calzada de losas de pizarra con línea central de energía y guías laterales
      c.setHex([0x5c5866, 0x535060, 0x625d6c][tono]);
      if (Math.abs(lx) < 0.14) c.setHex(0xfacc15);
      else if (Math.abs(Math.abs(lx) - 2.3) < 0.08) c.setHex(0x67e8f9);
      c.lerp(new THREE.Color(0x26222a), junta * 0.75);
    } else if (zonaC === 'acera') {
      c.setHex([0xb8b0a6, 0xaaa298, 0xc4bcb2][tono]); // Aceras claras de piedra pulida
      c.lerp(new THREE.Color(0x6a625c), junta * 0.7);
    } else if (zonaC === 'solar') {
      c.setHex([0x7a3e2e, 0x6e382a, 0x844634][tono]); // Solares de baldosa de ladrillo
      c.lerp(new THREE.Color(0x3a2620), junta * 0.7);
    } else if (zonaC === 'muro') {
      // Muralla de sillares de basalto con remate claro y franja dorada
      const dB = distBorde(lx, lz);
      c.setHex([0x4a4248, 0x544a50, 0x403a3e][tono]);
      if (dB > 0.75) c.lerp(new THREE.Color(0x7a7078), 0.6);
      if (Math.abs(dB - 0.45) < 0.07) c.setHex(0xeab308);
      c.lerp(new THREE.Color(0x221c20), junta * 0.7);
    } else {
      // Pavimento general de la ciudad: losas de piedra cálida
      c.setHex([0x8a7d72, 0x7e7268, 0x958779][tono]);
      c.lerp(new THREE.Color(0x4a4038), junta * 0.7);
    }
    // Transición suave hacia la hierba del bosque en el borde norte (salvo la calzada, que continúa)
    if (lz < -10.4 && Math.abs(lx) > 2.6) c.lerp(new THREE.Color(0x4c8030), suaveF(-10.4, -12.0, lz));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const group = new THREE.Group();
  group.position.set(worldXOffset, 0, worldZCenter);
  group.add(createClayMesh(geo, 'Malla_ciudad_forja_base', segCols, segRows));
  agregarFaldonCosta(group, geo, ['S', 'E', 'O'], { roca: 0x5a5058, rocaOsc: 0x342e34, arena: 0x8a7a70 });

  // Obelisco central de Pararrayos (Rayo ⚡)
  const baseOb = new THREE.CylinderGeometry(0.70, 0.95, 0.80, 8, 1);
  baseOb.translate(0, 0.40, 1.0);
  const mBaseOb = createClayMesh(baseOb, 'BaseObeliscoRayo', 8, 1);
  mBaseOb.material = clayMaterial.clone();
  mBaseOb.material.color.setHex(0x5a5048);
  group.add(mBaseOb);

  const aguja = new THREE.ConeGeometry(0.22, 3.6, 6);
  aguja.translate(0, 2.6, 1.0);
  const mAguja = createClayMesh(aguja, 'AgujaRayo', 6, 1);
  mAguja.material = clayMaterial.clone();
  mAguja.material.color.setHex(0xeab308); // Oro Rayo
  group.add(mAguja);

  // Pebeteros de fuego (Fuego 🔥)
  [-4.0, 4.0].forEach((px, idx) => {
    const peb = new THREE.CylinderGeometry(0.45, 0.30, 0.90, 8, 1);
    peb.translate(px, 0.45, -9.0);
    const mPeb = createClayMesh(peb, `Pebetero_${idx}`, 8, 1);
    mPeb.material = clayMaterial.clone();
    mPeb.material.color.setHex(0x6e4a3c);
    group.add(mPeb);

    const llama = new THREE.ConeGeometry(0.28, 0.65, 6);
    llama.translate(px, 1.15, -9.0);
    const mLlama = createClayMesh(llama, `LlamaFuego_${idx}`, 6, 1);
    mLlama.material = clayMaterial.clone();
    mLlama.material.color.setHex(0xef4444); // Rojo Fuego
    group.add(mLlama);
  });

  return registerSceneObject(group, 'Ciudad de la Forja y el Rayo', 'terrain', 'ciudad_sur_terrain', {
    width: COLS, depth: DEPTH, segCols, segRows, divId: 'ciudad_forja_base'
  }, routeId);
}

function buildOceanIslandMesh(worldXOffset = 0, worldZCenter = null, routeId = null) {
  // Margen de exactamente 2 cuadros / bloques (2 metros) de distancia desde el borde de las tierras
  const MARGIN = 2.0;

  let minX = -51, maxX = 51, minZ = -29, maxZ = 53;
  if (typeof state !== 'undefined' && Array.isArray(state.routes) && state.routes.length > 0) {
    minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity;
    state.routes.forEach(r => {
      const ox = r.worldOffset ? r.worldOffset.x : 0;
      const oz = r.worldOffset ? r.worldOffset.z : 0;
      const hw = (r.width || 34) / 2;
      const hd = (r.depth || 28) / 2;
      minX = Math.min(minX, ox - hw);
      maxX = Math.max(maxX, ox + hw);
      minZ = Math.min(minZ, oz - hd);
      maxZ = Math.max(maxZ, oz + hd);
    });
  }

  const seaMinX = minX - MARGIN;
  const seaMaxX = maxX + MARGIN;
  const seaMinZ = minZ - MARGIN;
  const seaMaxZ = maxZ + MARGIN;

  const ANCHO = Math.round(seaMaxX - seaMinX); // ~106m
  const FONDO = Math.round(seaMaxZ - seaMinZ); // ~86m
  const centerX = (seaMinX + seaMaxX) / 2;     // 0
  const centerZ = (worldZCenter !== null && worldZCenter !== undefined) ? worldZCenter : (seaMinZ + seaMaxZ) / 2; // ~12

  const segCols = Math.round(ANCHO * 0.45);
  const segRows = Math.round(FONDO * 0.45);

  const geo = new THREE.PlaneGeometry(ANCHO, FONDO, segCols, segRows);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);

    const ax = Math.abs(lx) / (ANCHO * 0.5);
    const az = Math.abs(lz) / (FONDO * 0.5);
    const bordeMax = Math.max(ax, az);

    let y = -0.32;
    // Límite visible: cresta de arrecife y espuma en el perímetro a 2 cuadros
    if (bordeMax > 0.88) {
      const fBorde = (bordeMax - 0.88) / 0.12;
      y += Math.sin(fBorde * Math.PI) * 0.28;
    }
    pos.setY(i, y);

    const c = new THREE.Color();
    if (bordeMax > 0.90) {
      c.setHex(0xf0f9ff); // Espuma límite visible
    } else {
      const dC = Math.hypot(lx, lz);
      const fCosta = Math.max(0, Math.min(1, (55.0 - dC) / 35.0));
      c.setHex(0x0284c7).lerp(new THREE.Color(0x034a75), 1.0 - fCosta);
      c.lerp(new THREE.Color(0x38bdf8), fCosta * 0.60);
    }
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const group = new THREE.Group();
  group.position.set(centerX + worldXOffset, 0, centerZ);

  const mallaMar = createClayMesh(geo, 'Malla_MarOceanoIsla', segCols, segRows);
  mallaMar.material = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.82,
    roughness: 0.14,
    metalness: 0.08,
    vertexColors: true
  });
  group.add(mallaMar);

  // Marco exterior zócalo de límite abisal a exactamente 2 cuadros de distancia
  const marcoGeo = new THREE.BoxGeometry(ANCHO + 1.2, 0.45, FONDO + 1.2, 2, 1, 2);
  marcoGeo.translate(0, -0.55, 0);
  const meshMarco = createClayMesh(marcoGeo, 'MarcoLimiteMar', 2, 1);
  meshMarco.material = clayMaterial.clone();
  meshMarco.material.color.setHex(0x1e3a5f);
  group.add(meshMarco);

  // -------------------------------------------------------------------
  // PEÑASCOS Y ROCAS EN MEDIO DEL MAR (Caminos e interferencias marinas)
  // -------------------------------------------------------------------
  const rocasMarinas = [
    // 1. Camino de rocas / paso marino del Puerto del Viento (Oeste)
    { wx: -37.0, wz: -21.0, rad: 1.6, alt: 1.4, name: 'PasoMarino_Oeste_1' },
    { wx: -41.5, wz: -16.0, rad: 1.9, alt: 1.8, name: 'PasoMarino_Oeste_2' },
    { wx: -46.0, wz: -10.0, rad: 2.3, alt: 2.2, name: 'PasoMarino_Oeste_3' },
    { wx: -49.5, wz: -2.0,  rad: 1.8, alt: 1.7, name: 'PasoMarino_Oeste_4' },
    { wx: -50.0, wz: 6.0,   rad: 2.1, alt: 2.0, name: 'PasoMarino_Oeste_5' },
    { wx: -47.0, wz: 14.0,  rad: 1.7, alt: 1.6, name: 'PasoMarino_Oeste_6' },
    { wx: -42.0, wz: 21.0,  rad: 1.5, alt: 1.4, name: 'PasoMarino_Oeste_7' },
    { wx: -37.0, wz: 26.0,  rad: 1.4, alt: 1.3, name: 'PasoMarino_Oeste_8' },

    // 2. Arrecife y camino de peñascos de la Aldea del Valle (Este)
    { wx: 37.0,  wz: -19.0, rad: 1.5, alt: 1.3, name: 'Arrecife_Este_1' },
    { wx: 42.0,  wz: -13.0, rad: 2.0, alt: 1.9, name: 'Arrecife_Este_2' },
    { wx: 47.0,  wz: -5.0,  rad: 2.4, alt: 2.4, name: 'Arrecife_Este_3' },
    { wx: 50.0,  wz: 3.0,   rad: 2.1, alt: 2.1, name: 'Arrecife_Este_4' },
    { wx: 48.0,  wz: 11.0,  rad: 1.8, alt: 1.7, name: 'Arrecife_Este_5' },
    { wx: 43.0,  wz: 19.0,  rad: 1.5, alt: 1.4, name: 'Arrecife_Este_6' },
    { wx: 38.0,  wz: 25.0,  rad: 1.4, alt: 1.2, name: 'Arrecife_Este_7' },

    // 3. Grandes farallones e interferencias en las aguas del Norte
    { wx: -20.0, wz: -30.0, rad: 2.4, alt: 3.2, name: 'Farallon_Norte_1' },
    { wx: -8.0,  wz: -30.5, rad: 2.0, alt: 2.7, name: 'Farallon_Norte_2' },
    { wx: 6.0,   wz: -30.5, rad: 2.6, alt: 3.5, name: 'Farallon_Norte_3' },
    { wx: 19.0,  wz: -30.0, rad: 2.2, alt: 2.9, name: 'Farallon_Norte_4' },

    // 4. Rompeolas y peñascos frente a la Ciudad de la Forja (Sur)
    { wx: -15.0, wz: 47.0,  rad: 1.8, alt: 1.6, name: 'Rompeolas_Sur_1' },
    { wx: -6.0,  wz: 50.0,  rad: 2.2, alt: 2.1, name: 'Rompeolas_Sur_2' },
    { wx: 6.0,   wz: 50.0,  rad: 2.2, alt: 2.1, name: 'Rompeolas_Sur_3' },
    { wx: 15.0,  wz: 47.0,  rad: 1.8, alt: 1.6, name: 'Rompeolas_Sur_4' },

    // 5. Interferencias adicionales en esquinas de alta mar
    { wx: -48.0, wz: -28.0, rad: 2.0, alt: 2.3, name: 'Interferencia_NW' },
    { wx: 48.0,  wz: -28.0, rad: 2.0, alt: 2.3, name: 'Interferencia_NE' },
    { wx: -46.0, wz: 49.0,  rad: 1.9, alt: 1.8, name: 'Interferencia_SW' },
    { wx: 46.0,  wz: 49.0,  rad: 1.9, alt: 1.8, name: 'Interferencia_SE' }
  ];

  rocasMarinas.forEach((r, idx) => {
    const rxLocal = r.wx - centerX;
    const rzLocal = r.wz - centerZ;

    // Cuerpo facetado del peñasco (Dodecaedro estilizado en clay)
    const rockGeo = new THREE.DodecahedronGeometry(r.rad, 1);
    const rPos = rockGeo.attributes.position;
    for (let k = 0; k < rPos.count; k++) {
      const px = rPos.getX(k);
      const py = rPos.getY(k);
      const pz = rPos.getZ(k);
      rPos.setY(k, py * (r.alt / r.rad));
      const perturb = 1.0 + 0.12 * Math.sin(px * 2.5 + pz * 2.0);
      rPos.setX(k, px * perturb);
      rPos.setZ(k, pz * perturb);
    }
    rockGeo.computeVertexNormals();

    const elevY = (r.alt * 0.40) - 0.22;
    rockGeo.translate(rxLocal, elevY, rzLocal);

    const mRoca = createClayMesh(rockGeo, r.name, 6, 4);
    mRoca.material = clayMaterial.clone();
    mRoca.material.flatShading = true;

    // Tonalidad de roca marina: base húmeda / musgo y cresta erosionada
    const colRoca = new THREE.Color(0x645c54);
    if (idx % 2 === 0) colRoca.lerp(new THREE.Color(0x766d64), 0.35);
    mRoca.material.color = colRoca;
    group.add(mRoca);

    // Anillo de espuma marina alrededor de la base del peñasco
    const anilloGeo = new THREE.RingGeometry(r.rad * 0.95, r.rad * 1.45, 12);
    anilloGeo.rotateX(-Math.PI / 2);
    anilloGeo.translate(rxLocal, -0.22, rzLocal);
    const matEspuma = new THREE.MeshBasicMaterial({
      color: 0xf0f9ff,
      transparent: true,
      opacity: 0.70,
      side: THREE.DoubleSide
    });
    group.add(new THREE.Mesh(anilloGeo, matEspuma));
  });

  return registerSceneObject(group, 'Océano de la Isla (Límite a 2 Cuadros con Peñascos)', 'terrain', 'ocean_island', {
    width: ANCHO, depth: FONDO, divId: 'isla_oceano_base'
  }, routeId);
}

// -------------------------------------------------------------
// SISTEMA MULTI-RUTA SINCRONIZADO CON "🗺️ RUTA COMPLETA"
// -------------------------------------------------------------
function buildDefaultRoutesData() {
  const COLS = 34;
  const toX = (col) => col - COLS / 2;

  // 1. RUTA 1: TRAMO NORTE (Rows 0..28, centro local en row 14)
  const r1NorteObjs = [];
  const toZNorte = (row) => row - 14;

  r1NorteObjs.push({
    moduleType: 'terrain_slice',
    label: 'Terreno Ruta 1 Norte (Pendiente + Montaña + Estanque 1)',
    category: 'terrain',
    params: { rowStart: 0, rowEnd: 28, width: 34, depth: 28, divId: 'r1_norte_base' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  const caveY = evaluateRuta1TerrainHeight(8.2, 6.2, false);
  r1NorteObjs.push({
    moduleType: 'cave3d',
    label: 'Cueva 3D con Desnivel',
    category: 'cave',
    params: {},
    position: { x: toX(8.2), y: caveY - 0.15, z: toZNorte(6.2) },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  [
    [11.5, 8.6, 0.72],
    [12.5, 9.2, 0.55],
    [19.5, 9.5, 0.58],
    [24.5, 9.8, 0.55],
    [22.5, 13.5, 0.55]
  ].forEach(([c, r, rad]) => {
    const ry = evaluateRuta1TerrainHeight(c, r, false);
    r1NorteObjs.push({
      moduleType: 'boulder',
      label: 'Roca Esférica',
      category: 'boulder',
      params: { radius: rad },
      position: { x: toX(c), y: ry, z: toZNorte(r) },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  });

  const pineLeftY = evaluateRuta1TerrainHeight(4.5, 10.2, false);
  r1NorteObjs.push({
    moduleType: 'pine',
    label: 'Pino Cónico en Capas',
    category: 'tree',
    params: { tiers: 3 },
    position: { x: toX(4.5), y: pineLeftY, z: toZNorte(10.2) },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 0.95, y: 0.95, z: 0.95 }
  });

  // Hileras de pinos 1 y 2 en Tramo Norte
  for (let c = 4.8; c <= 29.2; c += 1.75) {
    if (Math.abs(c - 8.5) >= 1.0 && (c < 25.6 || c > 28.8)) {
      r1NorteObjs.push({
        moduleType: 'pine', label: 'Pino Barrera 1', category: 'tree', params: { tiers: 3 },
        position: { x: toX(c), y: 0, z: toZNorte(15.2) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.78, y: 0.78, z: 0.78 }
      });
    }
    if ((c < 5.0 || c > 7.8) && Math.abs(c - 25.5) >= 1.0) {
      r1NorteObjs.push({
        moduleType: 'pine', label: 'Pino Barrera 2', category: 'tree', params: { tiers: 3 },
        position: { x: toX(c), y: 0, z: toZNorte(26.0) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.78, y: 0.78, z: 0.78 }
      });
    }
  }
  r1NorteObjs.push({
    moduleType: 'bush', label: 'Arbusto de Atajo 1', category: 'bush', params: { radius: 0.65 },
    position: { x: toX(8.5), y: 0, z: toZNorte(15.6) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });
  r1NorteObjs.push({
    moduleType: 'bush', label: 'Arbusto de Atajo 2', category: 'bush', params: { radius: 0.65 },
    position: { x: toX(25.5), y: 0, z: toZNorte(26.3) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });

  for (let r = 5.5; r <= 26.5; r += 2.4) {
    const yL = evaluateRuta1TerrainHeight(1.8, r, false);
    const yR = evaluateRuta1TerrainHeight(32.2, r, false);
    r1NorteObjs.push({
      moduleType: 'pine', label: 'Pino Borde Izq', category: 'tree', params: { tiers: 3 },
      position: { x: toX(1.8), y: yL, z: toZNorte(r) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.85, y: 0.85, z: 0.85 }
    });
    r1NorteObjs.push({
      moduleType: 'pine', label: 'Pino Borde Der', category: 'tree', params: { tiers: 3 },
      position: { x: toX(32.2), y: yR, z: toZNorte(r) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.85, y: 0.85, z: 0.85 }
    });
  }

  r1NorteObjs.push({
    moduleType: 'tall_grass', label: 'Hierba Alta Norte Izq', category: 'grass', params: { wCols: 3.6, hRows: 3.6 },
    position: { x: toX(6.0), y: 0, z: toZNorte(19.0) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });
  r1NorteObjs.push({
    moduleType: 'tall_grass', label: 'Hierba Alta Norte Der', category: 'grass', params: { wCols: 11.0, hRows: 6.2 },
    position: { x: toX(24.0), y: 0, z: toZNorte(21.5) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });
  r1NorteObjs.push({
    moduleType: 'mata_hierba', label: 'Mata de Hierba Borde Camino', category: 'grass', params: { scale: 1.05 },
    position: { x: toX(6.2), y: 0, z: toZNorte(13.8) }, rotation: { x: 0, y: 0.5, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });
  r1NorteObjs.push({
    moduleType: 'mata_hierba', label: 'Mata de Hierba Rocas', category: 'grass', params: { scale: 0.95 },
    position: { x: toX(18.5), y: 0, z: toZNorte(11.2) }, rotation: { x: 0, y: 1.1, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });

  // Lámina de agua para Estanque 1 (zona hundida con isla central)
  r1NorteObjs.push({
    moduleType: 'water_plane',
    label: 'Lámina de Agua Estanque 1',
    category: 'water',
    params: { width: 8.0, depth: 5.0 },
    position: { x: toX(13.0), y: -0.42, z: toZNorte(21.5) },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  // 2. RUTA 1: TRAMO CENTRO (Rows 28..46, depth 18, centro local en row 37)
  const r1CentroObjs = [];
  const toZCentro = (row) => row - 37;

  r1CentroObjs.push({
    moduleType: 'terrain_slice',
    label: 'Terreno Ruta 1 Centro (Estanques 2 y 3 con Islas)',
    category: 'terrain',
    params: { rowStart: 28, rowEnd: 46, width: 34, depth: 18, divId: 'r1_centro_base' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  for (let c = 4.8; c <= 29.2; c += 1.75) {
    if (Math.abs(c - 8.5) >= 1.0 && (c < 24.6 || c > 27.8)) {
      r1CentroObjs.push({
        moduleType: 'pine', label: 'Pino Barrera 3', category: 'tree', params: { tiers: 3 },
        position: { x: toX(c), y: 0, z: toZCentro(38.2) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.78, y: 0.78, z: 0.78 }
      });
    }
  }
  r1CentroObjs.push({
    moduleType: 'bush', label: 'Arbusto de Atajo 3', category: 'bush', params: { radius: 0.65 },
    position: { x: toX(8.5), y: 0, z: toZCentro(38.5) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });

  [[5.0, 29.5], [22.0, 29.5], [28.0, 41.0], [25.0, 42.0]].forEach(([c, r]) => {
    r1CentroObjs.push({
      moduleType: 'pine', label: 'Pino Grande Centro', category: 'tree', params: { tiers: 3 },
      position: { x: toX(c), y: 0, z: toZCentro(r) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.95, y: 0.95, z: 0.95 }
    });
  });

  for (let r = 29.0; r <= 45.0; r += 2.5) {
    r1CentroObjs.push({
      moduleType: 'pine', label: 'Pino Borde Izq', category: 'tree', params: { tiers: 3 },
      position: { x: toX(1.8), y: 0, z: toZCentro(r) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.85, y: 0.85, z: 0.85 }
    });
    r1CentroObjs.push({
      moduleType: 'pine', label: 'Pino Borde Der', category: 'tree', params: { tiers: 3 },
      position: { x: toX(32.2), y: 0, z: toZCentro(r) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.85, y: 0.85, z: 0.85 }
    });
  }

  r1CentroObjs.push({
    moduleType: 'tall_grass', label: 'Hierba Alta Centro 1', category: 'grass', params: { wCols: 10.5, hRows: 6.2 },
    position: { x: toX(19.5), y: 0, z: toZCentro(33.5) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });
  r1CentroObjs.push({
    moduleType: 'tall_grass', label: 'Hierba Alta Centro 2', category: 'grass', params: { wCols: 4.5, hRows: 4.5 },
    position: { x: toX(6.5), y: 0, z: toZCentro(43.5) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });

  // Láminas de agua para Estanques 2 y 3 (cuencas con islas y puente)
  r1CentroObjs.push({
    moduleType: 'water_plane',
    label: 'Lámina de Agua Estanque 2',
    category: 'water',
    params: { width: 7.0, depth: 6.0 },
    position: { x: toX(9.5), y: -0.42, z: toZCentro(33.0) },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
  r1CentroObjs.push({
    moduleType: 'water_plane',
    label: 'Lámina de Agua Estanque 3',
    category: 'water',
    params: { width: 11.0, depth: 6.0 },
    position: { x: toX(15.5), y: -0.42, z: toZCentro(44.0) },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  // 3. RUTA 1: TRAMO SUR / ENTRADA (Rows 46..58, depth 12, centro local en row 52)
  const r1SurObjs = [];
  const toZSur = (row) => row - 52;

  r1SurObjs.push({
    moduleType: 'terrain_slice',
    label: 'Terreno Ruta 1 Sur (Camino L + Entrada)',
    category: 'terrain',
    params: { rowStart: 46, rowEnd: 58, width: 34, depth: 12, divId: 'r1_sur_base' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  for (let c = 4.8; c <= 29.2; c += 1.75) {
    if ((c < 4.8 || c > 7.8) && Math.abs(c - 24.5) >= 1.0) {
      r1SurObjs.push({
        moduleType: 'pine', label: 'Pino Barrera 4', category: 'tree', params: { tiers: 3 },
        position: { x: toX(c), y: 0, z: toZSur(49.2) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.78, y: 0.78, z: 0.78 }
      });
    }
  }
  r1SurObjs.push({
    moduleType: 'bush', label: 'Arbusto de Atajo 4', category: 'bush', params: { radius: 0.65 },
    position: { x: toX(24.5), y: 0, z: toZSur(49.5) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });

  r1SurObjs.push({
    moduleType: 'sign', label: 'Letrero Entrada Ruta 1', category: 'prop', params: {},
    position: { x: toX(14.2), y: 0, z: toZSur(55.2) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });

  for (let c = 1.8; c <= 32.2; c += 2.3) {
    if (c < 14.2 || c > 18.8) {
      r1SurObjs.push({
        moduleType: 'pine', label: 'Pino Cerca Sur', category: 'tree', params: { tiers: 3 },
        position: { x: toX(c), y: 0, z: toZSur(56.8) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.85, y: 0.85, z: 0.85 }
      });
    }
  }

  for (let r = 47.5; r <= 55.0; r += 2.5) {
    r1SurObjs.push({
      moduleType: 'pine', label: 'Pino Borde Sur Izq', category: 'tree', params: { tiers: 3 },
      position: { x: toX(1.8), y: 0, z: toZSur(r) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.85, y: 0.85, z: 0.85 }
    });
    r1SurObjs.push({
      moduleType: 'pine', label: 'Pino Borde Sur Der', category: 'tree', params: { tiers: 3 },
      position: { x: toX(32.2), y: 0, z: toZSur(r) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.85, y: 0.85, z: 0.85 }
    });
  }

  r1SurObjs.push({
    moduleType: 'tall_grass', label: 'Hierba Alta Sur Izq', category: 'grass', params: { wCols: 8.5, hRows: 2.8 },
    position: { x: toX(8.5), y: 0, z: toZSur(54.2) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });
  r1SurObjs.push({
    moduleType: 'tall_grass', label: 'Hierba Alta Sur Der', category: 'grass', params: { wCols: 9.5, hRows: 4.2 },
    position: { x: toX(25.0), y: 0, z: toZSur(53.5) }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }
  });

  return [
    {
      id: 'ruta_1_norte',
      name: '⛰️ Ruta 1: Tramo Norte',
      desc: 'Pendiente gradual + Cueva 3D lateral + Montaña Alpina + Camino L + Estanque 1',
      worldOffset: { x: 0, y: 0, z: -15 },
      width: 34,
      depth: 28,
      objects: r1NorteObjs
    },
    {
      id: 'ruta_1_centro',
      name: '💧 Ruta 1: Tramo Centro',
      desc: 'Estanques 2 y 3 con islas + Barreras de pinos en zigzag + Hierba alta',
      worldOffset: { x: 0, y: 0, z: 8 },
      width: 34,
      depth: 18,
      objects: r1CentroObjs
    },
    {
      id: 'ruta_1_sur',
      name: '🪧 Ruta 1: Tramo Sur (Entrada)',
      desc: 'Camino en L de entrada sur + Letrero de ruta + Cerca de pinos',
      worldOffset: { x: 0, y: 0, z: 23 },
      width: 34,
      depth: 12,
      objects: r1SurObjs
    },
    {
      id: 'ruta_aldea',
      name: '🏡 Aldea del Valle (Planta y Tierra)',
      desc: 'Al ESTE del Bosque. Temática: Planta 🌿 + Tierra ⛰️. Dos caminos, plaza con pozo comunal y 6 solares',
      worldOffset: { x: 34, y: 0, z: -15 },
      width: 34,
      depth: 28,
      objects: [
        {
          moduleType: 'aldea_terrain',
          label: 'Terreno Base de la Aldea (Caminos y Solares)',
          category: 'terrain',
          params: { width: 34, depth: 28, divId: 'aldea_terreno_base' },
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }
      ]
    },
    {
      id: 'ruta_puerto',
      name: '⚓ Puerto del Viento (Viento y Agua)',
      desc: 'Al OESTE del Bosque. Temática: Viento 🌪️ + Agua 💧. Bahía navegable, muelles de madera, mástiles de viento y solares',
      worldOffset: { x: -34, y: 0, z: -15 },
      width: 34,
      depth: 28,
      objects: [
        {
          moduleType: 'puerto_terrain',
          label: 'Terreno del Puerto del Viento (Bahía y Muelles)',
          category: 'terrain',
          params: { width: 34, depth: 28, divId: 'puerto_terreno_base' },
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }
      ]
    },
    {
      id: 'ruta_ciudad_sur',
      name: '🏛️ Ciudad de la Forja (Fuego y Rayo)',
      desc: 'Al SUR frente a la entrada del Bosque. Temática: Fuego 🔥 + Rayo ⚡. Gran calzada, Obelisco de Pararrayos y pebeteros',
      worldOffset: { x: 0, y: 0, z: 41 },
      width: 34,
      depth: 24,
      objects: [
        {
          moduleType: 'ciudad_sur_terrain',
          label: 'Terreno de la Ciudad de la Forja y el Rayo',
          category: 'terrain',
          params: { width: 34, depth: 24, divId: 'ciudad_forja_base' },
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }
      ]
    }
  ];
}

async function ensureBibliotecaMallasLoaded() {
  if (window.BibliotecaMallas && window.BibliotecaMallas._cargado) return;
  if (window.BibliotecaMallas && window.BibliotecaMallas.ready) {
    try {
      await window.BibliotecaMallas.ready;
      return;
    } catch (e) {}
  }

  // Esperar a que biblioteca.js se cargue completamente (con timeout defensivo de 2.5s)
  await new Promise(resolve => {
    let timeoutId;
    const onReady = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('biblioteca-mallas-ready', onReady);
      resolve();
    };
    window.addEventListener('biblioteca-mallas-ready', onReady);
    timeoutId = setTimeout(() => {
      window.removeEventListener('biblioteca-mallas-ready', onReady);
      resolve();
    }, 2500);

    if (window.BibliotecaMallas && window.BibliotecaMallas._cargado) {
      onReady();
    }
  });
}

async function initWorldRoutesSystem() {
  // 0. Esperar a que la biblioteca de mallas esté lista para asegurar que rocas, troncos y casas se reconstruyan
  await ensureBibliotecaMallasLoaded();

  const defaults = buildDefaultRoutesData();
  let loadedRoutes = null;
  let savedMode = 'single_route';
  let savedRouteId = 'ruta_1_norte';
  let savedCam = null;

  // 1. PRIORIDAD ABSOLUTA: Cargar desde tu carpeta en disco (world_builder/scenes/) vía /api/world-state
  try {
    const res = await fetch('/api/world-state', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data && Array.isArray(json.data.routes) && json.data.routes.length > 0) {
        const r1 = json.data.routes.find(r => r.id === 'ruta_1_norte');
        if (!r1 || (r1.objects && r1.objects.length > 0)) {
          loadedRoutes = json.data.routes;
          savedMode = json.data.activeMode || 'single_route';
          savedRouteId = json.data.activeRouteId || loadedRoutes[0].id;
          savedCam = json.data.camera || null;
        }
      }
    }
  } catch (e) {
    console.warn('No se pudo leer /api/world-state, intentando localStorage', e);
  }

  // 2. Respaldo en localStorage si aún no había archivo en scenes/
  if (!loadedRoutes) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ROUTES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const r1 = parsed.find(r => r.id === 'ruta_1_norte');
          if (!r1 || (r1.objects && r1.objects.length > 0)) {
            loadedRoutes = parsed;
          }
        }
      }
    } catch (e) {}
  }

  state.routes = loadedRoutes || defaults;
  state.selectedRouteToMove = savedRouteId || state.routes[0].id;
  state.sceneReady = false;

  renderRoutesSidebarList();
  if (savedMode === 'full_world') {
    openFullWorldRoute();
  } else {
    const validRoute = state.routes.find(r => r.id === savedRouteId) ? savedRouteId : state.routes[0].id;
    openRouteEditor(validRoute);
  }

  if (savedCam && savedCam.position && savedCam.target) {
    activeCamera.position.set(savedCam.position.x, savedCam.position.y, savedCam.position.z);
    controls.target.set(savedCam.target.x, savedCam.target.y, savedCam.target.z);
    controls.update();
  }

  state.sceneReady = true;
}

function resetDefaultRoutes() {
  if (!confirm('¿Restaurar todos los editores de ruta a su diseño base original? (Recuerda pulsar "💾 Guardar" si deseas conservar este reinicio en tu carpeta)')) return;
  state.sceneReady = false;
  state.routes = buildDefaultRoutesData();
  state.selectedRouteToMove = state.routes[0].id;
  renderRoutesSidebarList();
  openRouteEditor(state.routes[0].id);
  state.sceneReady = true;
  showToast('↺ Todos los editores restaurados a la base (Pulsa "💾 Guardar" para guardar en tu carpeta)');
}

function restoreCurrentRouteToDefault() {
  const defaults = buildDefaultRoutesData();
  if (state.activeMode === 'single_route') {
    const defRoute = defaults.find(r => r.id === state.activeRouteId);
    const curIdx = state.routes.findIndex(r => r.id === state.activeRouteId);
    if (defRoute && curIdx >= 0) {
      if (!confirm(`¿Restaurar "${defRoute.name}" a su diseño original?`)) return;
      state.sceneReady = false;
      state.routes[curIdx] = JSON.parse(JSON.stringify(defRoute));
      openRouteEditor(state.activeRouteId);
      state.sceneReady = true;
      showToast(`↺ "${defRoute.name}" restaurada a su diseño original (Pulsa "💾 Guardar" si deseas guardarlo)`);
      return;
    }
  }
  resetDefaultRoutes();
}

function saveRoutesToLocalStorage() {
  // No hace autoguardado automático; solo se persiste cuando el usuario pulsa "💾 Guardar"
}

async function saveToServerFolderNow(targetName = 'mundo_actual', silent = false) {
  // Sincronizar siempre el estado 3D actual antes de serializar
  syncActiveSceneToRouteStore();

  try {
    localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(state.routes));
  } catch (e) {}

  const payloadData = {
    version: 4,
    timestamp: new Date().toISOString(),
    sceneName: targetName,
    activeMode: state.activeMode,
    activeRouteId: state.activeRouteId,
    dimension: state.dimension,
    renderStyle: state.renderStyle,
    wireOpacity: state.wireOpacity,
    subdivisionMultiplier: state.subdivisionMultiplier,
    routes: state.routes,
    camera: {
      position: { x: activeCamera.position.x, y: activeCamera.position.y, z: activeCamera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z }
    },
    objects: state.meshObjects.map(g => ({
      id: g.userData.id,
      moduleType: g.userData.moduleType || 'generic',
      label: g.userData.label,
      category: g.userData.category,
      routeId: g.userData.routeId,
      params: g.userData.params || {},
      position: { x: g.position.x, y: g.position.y, z: g.position.z },
      rotation: { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z },
      scale: { x: g.scale.x, y: g.scale.y, z: g.scale.z }
    }))
  };

  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: targetName, data: payloadData })
    });
    const result = await res.json();
    if (result.success && !silent) {
      const totalPiezas = state.meshObjects.length;
      showToast(`💾 Guardado en disco con éxito (${totalPiezas} piezas en ${result.name}.json)`);
      await refreshScenesDropdown(result.name);
    }
    return result;
  } catch (e) {
    if (!silent) showToast('Error de conexión al guardar en carpeta');
    return null;
  }
}

/**
 * Sincroniza todos los objetos actualmente en pantalla hacia `state.routes`,
 * de modo que si editas "Ruta 1: Tramo Norte", "Ruta Completa" ya tiene los cambios al instante
 * (y viceversa si editas dentro de "Ruta Completa").
 */
function syncActiveSceneToRouteStore() {
  if (state.isRebuilding || !state.sceneReady) return;
  if (!state.meshObjects || state.meshObjects.length === 0) return;

  if (state.activeMode === 'single_route') {
    const route = state.routes.find(r => r.id === state.activeRouteId);
    if (!route) return;

    // Preservar cualquier objeto de mallas que no esté aún en la escena 3D activa
    const activeMeshIds = new Set(state.meshObjects.map(g => g.userData?.params?.id || g.userData?.id));
    const pendingBibObjs = (route.objects || []).filter(o => {
      if (o.moduleType !== 'malla') return false;
      const mId = o.params?.id || o.id;
      return !activeMeshIds.has(mId);
    });

    route.objects = state.meshObjects.map(g => ({
      id: g.userData.id,
      moduleType: g.userData.moduleType || 'generic',
      label: g.userData.label,
      category: g.userData.category,
      params: g.userData.params || {},
      position: { x: g.position.x, y: g.position.y, z: g.position.z },
      rotation: { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z },
      scale: { x: g.scale.x, y: g.scale.y, z: g.scale.z }
    })).concat(pendingBibObjs);

    // Actualizar ancho/largo estimado de la ruta según sus terrenos
    const terrains = state.meshObjects.filter(g => g.userData.category === 'terrain');
    if (terrains.length > 0) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      terrains.forEach(t => {
        const w = (t.userData.params?.width || 34) * t.scale.x;
        const d = (t.userData.params?.depth || 20) * t.scale.z;
        minX = Math.min(minX, t.position.x - w / 2);
        maxX = Math.max(maxX, t.position.x + w / 2);
        minZ = Math.min(minZ, t.position.z - d / 2);
        maxZ = Math.max(maxZ, t.position.z + d / 2);
      });
      route.width = Math.max(10, maxX - minX);
      route.depth = Math.max(10, maxZ - minZ);
    }
  } else if (state.activeMode === 'full_world') {
    // En Ruta Completa, cada objeto guarda su routeId; restamos el worldOffset de su ruta
    state.routes.forEach(route => {
      const routeGroups = state.meshObjects.filter(g => g.userData.routeId === route.id);
      const activeIds = new Set(routeGroups.map(g => g.userData?.params?.id || g.userData?.id));
      const pendingObjs = (route.objects || []).filter(o => {
        if (o.moduleType !== 'malla') return false;
        const mId = o.params?.id || o.id;
        return !activeIds.has(mId);
      });

      const updatedObjs = routeGroups.map(g => ({
        id: g.userData.id,
        moduleType: g.userData.moduleType || 'generic',
        label: g.userData.label,
        category: g.userData.category,
        params: g.userData.params || {},
        position: {
          x: g.position.x - route.worldOffset.x,
          y: g.position.y - route.worldOffset.y,
          z: g.position.z - route.worldOffset.z
        },
        rotation: { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z },
        scale: { x: g.scale.x, y: g.scale.y, z: g.scale.z }
      }));

      route.objects = updatedObjs.concat(pendingObjs);
    });
  }

  saveRoutesToLocalStorage();
}

function autoSaveToLocal() {
  syncActiveSceneToRouteStore();
}

/**
 * Renderiza la lista de botones de rutas en el panel izquierdo y el selector de rutas a mover
 */
function renderRoutesSidebarList() {
  const listEl = document.getElementById('routes-editor-list');
  const selectMoveEl = document.getElementById('select-route-to-move');
  const fullBtn = document.getElementById('btn-ruta-completa');

  if (fullBtn) {
    if (state.activeMode === 'full_world') {
      fullBtn.style.borderColor = '#38bdf8';
      fullBtn.style.background = 'rgba(56, 189, 248, 0.22)';
    } else {
      fullBtn.style.borderColor = 'var(--border)';
      fullBtn.style.background = 'rgba(15, 23, 42, 0.55)';
    }
  }

  if (listEl) {
    listEl.innerHTML = '';
    state.routes.forEach((route, idx) => {
      const isSelected = (state.activeMode === 'single_route' && state.activeRouteId === route.id);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display: flex; gap: 4px; align-items: stretch;';

      const btn = document.createElement('button');
      btn.className = 'blueprint-btn';
      btn.style.flex = '1';
      if (isSelected) {
        btn.style.borderColor = '#38bdf8';
        btn.style.background = 'rgba(56, 189, 248, 0.18)';
      }
      btn.innerHTML = `
        <strong>${route.name}</strong>
        <span>${route.desc || 'Tramo editable conectado a Ruta Completa'} (${route.objects.length} piezas · Mundo X:${route.worldOffset.x.toFixed(0)} Z:${route.worldOffset.z.toFixed(0)})</span>
      `;
      btn.onclick = () => openRouteEditor(route.id);
      wrap.appendChild(btn);

      // Si hay más de 1 ruta, permitir eliminar rutas adicionales
      if (state.routes.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.className = 'action-btn';
        delBtn.style.cssText = 'padding: 0 7px; color: #f87171; border-color: rgba(239,68,68,0.3);';
        delBtn.title = `Eliminar ${route.name}`;
        delBtn.textContent = '✕';
        delBtn.onclick = (ev) => {
          ev.stopPropagation();
          deleteRouteById(route.id);
        };
        wrap.appendChild(delBtn);
      }

      listEl.appendChild(wrap);
    });
  }

  if (selectMoveEl) {
    selectMoveEl.innerHTML = '';
    state.routes.forEach(route => {
      const opt = document.createElement('option');
      opt.value = route.id;
      opt.textContent = `${route.name} (X:${route.worldOffset.x.toFixed(0)}, Z:${route.worldOffset.z.toFixed(0)})`;
      if (route.id === state.selectedRouteToMove) opt.selected = true;
      selectMoveEl.appendChild(opt);
    });
    updateRouteConnectorSlidersUI();
  }
}

function updateTopBadges(modeLabel) {
  const badge = document.getElementById('active-route-badge');
  const statMode = document.getElementById('stat-mode');
  if (badge) badge.textContent = modeLabel.toUpperCase();
  if (statMode) statMode.textContent = modeLabel;
}

/**
 * Instancia un objeto serializado aplicando un offset de mundo (offsetX, offsetY, offsetZ)
 */
function instantiateSerializedObject(item, offset = { x: 0, y: 0, z: 0 }, routeId = null) {
  let created = null;
  const p = item.params || {};
  const pos = item.position || { x: 0, y: 0, z: 0 };
  const wx = pos.x + offset.x;
  const wy = pos.y + offset.y;
  const wz = pos.z + offset.z;
  const sc = (item.scale && item.scale.x) ? item.scale.x : 1.0;

  if (item.moduleType === 'terrain_slice') {
    created = buildRuta1SliceMesh(p.rowStart ?? 0, p.rowEnd ?? 28, item.label, p.divId || 'slice', wx, wz, routeId);
  } else if (item.moduleType === 'aldea_terrain') {
    created = buildAldeaTerrainMesh(wx, wz, routeId);
  } else if (item.moduleType === 'puerto_terrain') {
    created = buildPuertoTerrainMesh(wx, wz, routeId);
  } else if (item.moduleType === 'ciudad_sur_terrain') {
    created = buildCiudadSurTerrainMesh(wx, wz, routeId);
  } else if (item.moduleType === 'ocean_island') {
    created = buildOceanIslandMesh(wx, wz, routeId);
  } else if (item.moduleType === 'merged_terrain') {
    const w = p.width || 34;
    const d = p.depth || 28;
    const sC = p.segCols || 60;
    const sR = p.segRows || 48;
    const mGeo = new THREE.PlaneGeometry(w, d, sC, sR);
    mGeo.rotateX(-Math.PI / 2);
    const mGroup = new THREE.Group();
    mGroup.position.set(wx, wy, wz);
    mGroup.add(createClayMesh(mGeo, 'MallaUnidaMundo', sC, sR));
    created = registerSceneObject(mGroup, item.label || 'Terreno Unido', 'terrain', 'merged_terrain', {
      width: w, depth: d, segCols: sC, segRows: sR
    }, routeId);
  } else if (item.moduleType === 'water_plane') {
    created = buildWaterPlane(wx, wy, wz, p.width || 8, p.depth || 5, item.label, routeId);
  } else if (item.moduleType === 'cave3d' || item.moduleType === 'cave_arch') {
    created = buildCaveStructure3D(wx, wy, wz, sc, routeId);
  } else if (item.moduleType === 'pine') {
    created = buildTieredPineMesh(wx, wy, wz, sc, p.tiers || 3, routeId);
  } else if (item.moduleType === 'boulder') {
    created = buildBoulderMesh(wx, wy, wz, p.radius || 0.65, routeId);
  } else if (item.moduleType === 'bush') {
    created = buildCuttableBushMesh(wx, wy, wz, p.radius || 0.75, routeId);
  } else if (item.moduleType === 'sign') {
    created = buildRouteSignMesh(wx, wy, wz, routeId);
  } else if (item.moduleType === 'tall_grass') {
    created = buildTallGrassPatchMesh(wx, wz, p.wCols || 4, p.hRows || 4, routeId);
  } else if (item.moduleType === 'mata_hierba') {
    created = buildMataHierbaMesh(wx, wy, wz, sc, routeId);
  } else if (item.moduleType === 'malla' && window.BibliotecaMallas && p.id) {
    // Personajes colocados en el mapa: con menos polígonos que el modelo completo (cada chibi tiene ~100 000
    // vértices; 27 de ellos cuadruplicaban la carga de la escena y de sus sombras). De lejos no se nota.
    const multAntes = state.subdivisionMultiplier;
    if (item.category === 'personajes') state.subdivisionMultiplier = (multAntes || 1) * 0.55;
    try {
      created = window.BibliotecaMallas.construir(p.id, wx, wy, wz, 1, routeId);
    } finally {
      state.subdivisionMultiplier = multAntes;
    }
    if (created && routeId) created.userData.routeId = routeId;
  }

  if (created) {
    if (item.id) created.userData.id = item.id;
    if (routeId) created.userData.routeId = routeId;
    created.position.set(wx, wy, wz);
    if (item.rotation) created.rotation.set(item.rotation.x || 0, item.rotation.y || 0, item.rotation.z || 0);
    if (item.scale) created.scale.set(item.scale.x || 1, item.scale.y || 1, item.scale.z || 1);
    created.userData.params = { ...p, ...(created.userData.params || {}) };
    if (p.vertexEdits) {
      created.userData.params.vertexEdits = p.vertexEdits;
      applySavedVertexEdits(created, p.vertexEdits);
    }
  }
  return created;
}

/**
 * Abre el editor individual de una Ruta / Tramo (por ejemplo "Ruta 1: Tramo Norte")
 */
function openRouteEditor(routeId) {
  // Primero sincronizamos cualquier cambio pendiente de la vista actual
  syncActiveSceneToRouteStore();

  const route = state.routes.find(r => r.id === routeId);
  if (!route) return;

  state.isRebuilding = true;
  clearAllMeshes(false);

  state.activeMode = 'single_route';
  state.activeRouteId = route.id;
  state.selectedRouteToMove = route.id;
  state.currentSceneName = route.id;

  route.objects.forEach(item => {
    instantiateSerializedObject(item, { x: 0, y: 0, z: 0 }, route.id);
  });

  state.isRebuilding = false;
  updateStats();
  renderRoutesSidebarList();
  updateTopBadges(route.name);

  setDimension('2.5D');
  perspectiveCamera.position.set(0, 22, 30);
  controls.target.set(0, 2.0, 0);
  controls.update();

  showToast(`✏️ Editando "${route.name}" (Tus cambios actualizarán "🗺️ Ruta Completa" automáticamente)`);
}

/**
 * Abre "🗺️ Ruta Completa": reúne todas las rutas existentes en sus coordenadas del mundo,
 * reflejando automáticamente cualquier edición hecha en cada ruta individual.
 */
function openFullWorldRoute() {
  // Guardar cambios del tramo activo antes de abrir Ruta Completa
  syncActiveSceneToRouteStore();

  state.isRebuilding = true;
  clearAllMeshes(false);

  state.activeMode = 'full_world';
  state.currentSceneName = 'ruta_completa_mundo';

  // Capa marina circundante a 2 cuadros de distancia que simula la Isla
  buildOceanIslandMesh(0, null, 'isla_oceano');

  state.routes.forEach(route => {
    const offset = route.worldOffset || { x: 0, y: 0, z: 0 };
    route.objects.forEach(item => {
      instantiateSerializedObject(item, offset, route.id);
    });
  });

  state.isRebuilding = false;
  updateStats();
  renderRoutesSidebarList();
  updateTopBadges('🏝️ Isla Completa (3 Aldeas + Bosque)');

  setDimension('2.5D');
  perspectiveCamera.position.set(0, 68, 82);
  controls.target.set(0, 0, 12);
  controls.update();

  showToast(`🏝️ Isla Completa (Mar a 2 bloques de distancia con límite visible)`);
}

/**
 * Crea una nueva Ruta / Tramo editable y la añade al mundo y a "Ruta Completa"
 */
function createNewRoutePrompt() {
  syncActiveSceneToRouteStore();

  const nextNum = state.routes.length + 1;
  const name = prompt('Nombre para la nueva Ruta o Tramo:', `🌲 Ruta ${nextNum}: Nuevo Tramo`);
  if (!name) return;

  const direction = prompt(
    '¿Dónde deseas conectar inicialmente esta nueva ruta en el mundo?\nEscribe:\n- "este" (a la derecha)\n- "oeste" (a la izquierda)\n- "norte" (arriba)\n- "sur" (abajo)',
    'este'
  ) || 'este';

  // Tomar como referencia la ruta actualmente seleccionada
  const refRoute = state.routes.find(r => r.id === state.selectedRouteToMove) || state.routes[state.routes.length - 1];
  const refW = refRoute ? (refRoute.width || 34) : 34;
  const refD = refRoute ? (refRoute.depth || 24) : 24;
  const newW = 34;
  const newD = 24;

  const worldOffset = {
    x: refRoute ? refRoute.worldOffset.x : 0,
    y: refRoute ? refRoute.worldOffset.y : 0,
    z: refRoute ? refRoute.worldOffset.z : 0
  };

  const dirClean = direction.trim().toLowerCase();
  if (dirClean.startsWith('est') || dirClean.startsWith('der')) {
    worldOffset.x += (refW / 2 + newW / 2);
  } else if (dirClean.startsWith('oest') || dirClean.startsWith('izq')) {
    worldOffset.x -= (refW / 2 + newW / 2);
  } else if (dirClean.startsWith('nor') || dirClean.startsWith('arr')) {
    worldOffset.z -= (refD / 2 + newD / 2);
  } else {
    worldOffset.z += (refD / 2 + newD / 2);
  }

  const newId = 'ruta_' + Date.now();
  const newRoute = {
    id: newId,
    name: name.trim(),
    desc: `Conectada al ${dirClean.toUpperCase()} de ${refRoute ? refRoute.name : 'Mundo'}`,
    worldOffset,
    width: newW,
    depth: newD,
    objects: [
      {
        moduleType: 'terrain_slice',
        label: `Terreno Base (${name.trim()})`,
        category: 'terrain',
        params: { rowStart: 14, rowEnd: 38, width: newW, depth: newD, divId: newId + '_terrain' },
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      },
      {
        moduleType: 'sign',
        label: `Letrero de ${name.trim()}`,
        category: 'prop',
        params: {},
        position: { x: -3, y: 0, z: 6 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
    ]
  };

  state.routes.push(newRoute);
  state.selectedRouteToMove = newId;
  saveRoutesToLocalStorage();
  renderRoutesSidebarList();

  // Abrimos directamente el editor de la nueva ruta para que pueda diseñarla
  openRouteEditor(newId);
  showToast(`➕ "${newRoute.name}" creada y vinculada a Ruta Completa`);
}

function deleteRouteById(routeId) {
  if (state.routes.length <= 1) {
    showToast('Debe existir al menos una ruta en el mundo');
    return;
  }
  const route = state.routes.find(r => r.id === routeId);
  if (!route) return;
  if (!confirm(`¿Eliminar la ruta "${route.name}" del mundo?`)) return;

  state.routes = state.routes.filter(r => r.id !== routeId);
  saveRoutesToLocalStorage();

  if (state.activeMode === 'full_world') {
    openFullWorldRoute();
  } else {
    openRouteEditor(state.routes[0].id);
  }
}

// -------------------------------------------------------------
// CONECTOR DE RUTAS EN EL MUNDO (MOVER Y ENCAJAR RUTAS COMPLETAS)
// -------------------------------------------------------------
function onSelectRouteToMove(routeId) {
  state.selectedRouteToMove = routeId;
  updateRouteConnectorSlidersUI();

  // Si estamos en Ruta Completa, resaltar visualmente los objetos de esa ruta o enfocar cámara
  if (state.activeMode === 'full_world') {
    const route = state.routes.find(r => r.id === routeId);
    if (route) {
      showToast(`🧭 Ruta seleccionada para mover en el mundo: ${route.name}`);
    }
  }
}

function updateRouteConnectorSlidersUI() {
  const route = state.routes.find(r => r.id === state.selectedRouteToMove);
  if (!route) return;

  const setVal = (sliderId, labelId, val) => {
    const s = document.getElementById(sliderId);
    const l = document.getElementById(labelId);
    if (s) s.value = val;
    if (l) l.textContent = Number(val).toFixed(1);
  };

  setVal('slider-route-wx', 'val-route-wx', route.worldOffset.x);
  setVal('slider-route-wz', 'val-route-wz', route.worldOffset.z);
  setVal('slider-route-wy', 'val-route-wy', route.worldOffset.y);
}

function onRouteWorldOffsetSlider() {
  const route = state.routes.find(r => r.id === state.selectedRouteToMove);
  if (!route) return;

  const newX = parseFloat(document.getElementById('slider-route-wx').value) || 0;
  const newZ = parseFloat(document.getElementById('slider-route-wz').value) || 0;
  const newY = parseFloat(document.getElementById('slider-route-wy').value) || 0;

  applyRouteWorldOffsetChange(route, newX, newY, newZ);
}

function applyRouteWorldOffsetChange(route, newX, newY, newZ) {
  const dx = newX - route.worldOffset.x;
  const dy = newY - route.worldOffset.y;
  const dz = newZ - route.worldOffset.z;

  route.worldOffset.x = newX;
  route.worldOffset.y = newY;
  route.worldOffset.z = newZ;

  updateRouteConnectorSlidersUI();

  // Si no estamos en Ruta Completa, cambiamos automáticamente a Ruta Completa para que vea cómo se mueve y conecta la ruta en el mundo
  if (state.activeMode !== 'full_world') {
    openFullWorldRoute();
    return;
  }

  // Mover en tiempo real todas las piezas de esa ruta en la escena
  state.meshObjects.forEach(g => {
    if (g.userData.routeId === route.id) {
      g.position.x += dx;
      g.position.y += dy;
      g.position.z += dz;
    }
  });

  saveRoutesToLocalStorage();
  renderRoutesSidebarList();
}

/**
 * Encaja magnéticamente la ruta seleccionada al Norte, Sur, Este u Oeste de otra ruta vecina
 */
function snapSelectedRoute(direction) {
  const route = state.routes.find(r => r.id === state.selectedRouteToMove);
  if (!route || state.routes.length < 2) {
    showToast('Necesitas al menos 2 rutas para encajarlas');
    return;
  }

  // Buscar la ruta de referencia (la anterior en la lista, o la primera distinta)
  const idx = state.routes.indexOf(route);
  const targetRoute = state.routes[idx > 0 ? idx - 1 : 1];
  if (!targetRoute) return;

  const wA = route.width || 34;
  const dA = route.depth || 24;
  const wB = targetRoute.width || 34;
  const dB = targetRoute.depth || 24;

  let nx = targetRoute.worldOffset.x;
  let ny = targetRoute.worldOffset.y;
  let nz = targetRoute.worldOffset.z;

  if (direction === 'north') {
    nz = targetRoute.worldOffset.z - (dB / 2 + dA / 2);
  } else if (direction === 'south') {
    nz = targetRoute.worldOffset.z + (dB / 2 + dA / 2);
  } else if (direction === 'east') {
    nx = targetRoute.worldOffset.x + (wB / 2 + wA / 2);
  } else if (direction === 'west') {
    nx = targetRoute.worldOffset.x - (wB / 2 + wA / 2);
  }

  applyRouteWorldOffsetChange(route, nx, ny, nz);
  showToast(`🧲 "${route.name}" encajada al ${direction.toUpperCase()} de "${targetRoute.name}"`);
}

// -------------------------------------------------------------
// DIVISIONES DE TERRENO Y UNIÓN 2D (HORIZONTAL Y NORTE-SUR)
// -------------------------------------------------------------
function spawnTerrainDivision(divType) {
  const appendHoriz = document.getElementById('chk-append-horiz')?.checked;
  let offsetX = 0;
  let offsetZ = 0;

  const existingTerrains = state.meshObjects.filter(g => g.userData.category === 'terrain');
  if (appendHoriz && existingTerrains.length > 0) {
    let maxRightX = -Infinity;
    let refZ = 0;
    existingTerrains.forEach(t => {
      const w = (t.userData.params?.width || 34) * t.scale.x;
      const rightEdge = t.position.x + w / 2;
      if (rightEdge > maxRightX) {
        maxRightX = rightEdge;
        refZ = t.position.z;
      }
    });
    offsetX = maxRightX + 17 + 2.0;
    offsetZ = refZ;
  }

  let created = null;
  if (divType === 'div_mountain_cave') {
    created = buildRuta1SliceMesh(0, 10, 'División 1: Subida + Cueva + Montaña', divType, offsetX, offsetZ);
    const caveY = evaluateRuta1TerrainHeight(8.2, 6.2, false);
    buildCaveStructure3D(offsetX + (8.2 - 17), caveY, offsetZ + (6.2 - 5), 1.0);
  } else if (divType === 'div_lpath') {
    created = buildRuta1SliceMesh(8, 17, 'División 2: Camino en L + Pinos', divType, offsetX, offsetZ);
  } else if (divType === 'div_pond1') {
    created = buildRuta1SliceMesh(17, 27, 'División 3: Zona Estanque 1 + Isla', divType, offsetX, offsetZ);
    buildWaterPlane(offsetX - 4.0, -0.42, offsetZ - 0.5, 8.0, 5.0, 'Lámina de Agua Estanque 1', created.userData.routeId);
  } else if (divType === 'div_pond2') {
    created = buildRuta1SliceMesh(27, 39, 'División 4: Zona Estanque 2 + Isla', divType, offsetX, offsetZ);
    buildWaterPlane(offsetX - 7.5, -0.42, offsetZ, 7.0, 6.0, 'Lámina de Agua Estanque 2', created.userData.routeId);
  } else if (divType === 'div_pond3') {
    created = buildRuta1SliceMesh(39, 50, 'División 5: Zona Estanque 3 + Isla', divType, offsetX, offsetZ);
    buildWaterPlane(offsetX - 1.5, -0.42, offsetZ - 0.5, 11.0, 6.0, 'Lámina de Agua Estanque 3', created.userData.routeId);
  } else if (divType === 'div_south_entry') {
    created = buildRuta1SliceMesh(50, 58, 'División 6: Entrada Sur + Camino L', divType, offsetX, offsetZ);
  } else if (divType === 'div_grass_patch') {
    created = buildRuta1SliceMesh(27, 39, 'División 7: Campo con Matas de Hierba', divType, offsetX, offsetZ);
    buildTallGrassPatchMesh(offsetX + 3.0, offsetZ - 1.0, 10.5, 5.5, created.userData.routeId);
    buildMataHierbaMesh(offsetX - 7.5, 0, offsetZ + 2.5, 1.05, created.userData.routeId);
    buildMataHierbaMesh(offsetX - 10.0, 0, offsetZ + 1.2, 0.95, created.userData.routeId);
  }

  if (created) {
    selectMeshGroup(created);
    showToast(`🧩 ${created.userData.label} añadida (Sincronizada con Ruta Completa)`);
  }
}

function spawnSingleMataHierba() {
  const appendHoriz = document.getElementById('chk-append-horiz')?.checked;
  let offsetX = 0;
  let offsetZ = 0;
  if (state.selectedGroup) {
    offsetX = state.selectedGroup.position.x + (appendHoriz ? 3.0 : 0);
    offsetZ = state.selectedGroup.position.z + (appendHoriz ? 0 : 3.0);
  } else {
    offsetX = (Math.random() - 0.5) * 6;
    offsetZ = (Math.random() - 0.5) * 6;
  }
  const m = buildMataHierbaMesh(offsetX, 0, offsetZ, 1.0);
  selectMeshGroup(m);
  syncActiveSceneToRouteStore();
  showToast('🌿 Mata de Hierba añadida (lista para mover, escalar o clonar)');
}

function sampleTerrainWorldHeight(terrainGroup, wx, wz) {
  const mesh = terrainGroup.children.find(c => c.isMesh);
  if (!mesh || !mesh.geometry) return 0;

  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const qCols = geo.userData.quadCols || 32;
  const qRows = geo.userData.quadRows || 32;

  const baseW = terrainGroup.userData.params?.width || 34;
  const baseD = terrainGroup.userData.params?.depth || 28;
  const worldW = baseW * terrainGroup.scale.x;
  const worldD = baseD * terrainGroup.scale.z;

  const minX = terrainGroup.position.x - worldW / 2;
  const minZ = terrainGroup.position.z - worldD / 2;

  const u = Math.max(0, Math.min(1, (wx - minX) / worldW));
  const v = Math.max(0, Math.min(1, (wz - minZ) / worldD));

  const fc = u * qCols;
  const fr = v * qRows;
  const c0 = Math.min(qCols, Math.floor(fc));
  const c1 = Math.min(qCols, c0 + 1);
  const r0 = Math.min(qRows, Math.floor(fr));
  const r1 = Math.min(qRows, r0 + 1);
  const tx = fc - c0;
  const tz = fr - r0;

  const stride = qCols + 1;
  const y00 = pos.getY(r0 * stride + c0);
  const y10 = pos.getY(r0 * stride + c1);
  const y01 = pos.getY(r1 * stride + c0);
  const y11 = pos.getY(r1 * stride + c1);

  const yTop = y00 * (1 - tx) + y10 * tx;
  const yBot = y01 * (1 - tx) + y11 * tx;
  const localY = yTop * (1 - tz) + yBot * tz;

  return terrainGroup.position.y + localY * terrainGroup.scale.y;
}

/**
 * Une dos o más mallas de terreno (tanto en horizontal X como en norte-sur Z),
 * completando suavemente los espacios entre divisiones o entre rutas conectadas.
 */
function mergeTerrainsHorizontally() {
  let terrains = state.meshObjects.filter(g => g.userData.category === 'terrain');

  if (terrains.length === 0) {
    showToast('Primero genera o añade una división de terreno');
    return;
  }

  if (terrains.length === 1) {
    const first = terrains[0];
    const w = (first.userData.params?.width || 34) * first.scale.x;
    const newX = first.position.x + w + 3.0;
    buildRuta1SliceMesh(0, 28, 'Tramo Horizontal 2', 'auto_horiz', newX, first.position.z);
    terrains = state.meshObjects.filter(g => g.userData.category === 'terrain');
  }

  const bounds = terrains.map(t => {
    const w = (t.userData.params?.width || 34) * t.scale.x;
    const d = (t.userData.params?.depth || 28) * t.scale.z;
    return {
      group: t,
      minX: t.position.x - w / 2,
      maxX: t.position.x + w / 2,
      minZ: t.position.z - d / 2,
      maxZ: t.position.z + d / 2,
      width: w,
      depth: d
    };
  });

  const totalMinX = Math.min(...bounds.map(b => b.minX));
  const totalMaxX = Math.max(...bounds.map(b => b.maxX));
  const totalMinZ = Math.min(...bounds.map(b => b.minZ));
  const totalMaxZ = Math.max(...bounds.map(b => b.maxZ));

  const totalWidth = totalMaxX - totalMinX;
  const totalDepth = totalMaxZ - totalMinZ;
  const centerX = (totalMinX + totalMaxX) / 2;
  const centerZ = (totalMinZ + totalMaxZ) / 2;

  const segCols = Math.min(220, Math.max(60, Math.round(totalWidth * 2.5 * state.subdivisionMultiplier)));
  const segRows = Math.min(220, Math.max(48, Math.round(totalDepth * 2.5 * state.subdivisionMultiplier)));

  const mergedGeo = new THREE.PlaneGeometry(totalWidth, totalDepth, segCols, segRows);
  mergedGeo.rotateX(-Math.PI / 2);
  // Guardar copia plana original para que recordGroupVertexEdits registre el relieve fusionado en disco
  mergedGeo.userData.originalPositions = new Float32Array(mergedGeo.attributes.position.array);

  const pos = mergedGeo.attributes.position;
  const mergedColors = [];
  for (let i = 0; i < pos.count; i++) {
    const wx = centerX + pos.getX(i);
    const wz = centerZ + pos.getZ(i);

    // Interpolación 2D ponderada por distancia a cada bloque de terreno (funciona en X y en Z)
    let weightSum = 0;
    let heightSum = 0;

    for (let k = 0; k < bounds.length; k++) {
      const b = bounds[k];
      const clampedX = Math.max(b.minX, Math.min(b.maxX, wx));
      const clampedZ = Math.max(b.minZ, Math.min(b.maxZ, wz));
      const dx = wx - clampedX;
      const dz = wz - clampedZ;
      const distSq = dx * dx + dz * dz;

      const sampleY = sampleTerrainWorldHeight(b.group, clampedX, clampedZ);
      if (distSq < 1e-4) {
        weightSum = 1;
        heightSum = sampleY;
        break;
      } else {
        const w = 1.0 / Math.pow(distSq + 0.05, 1.6);
        weightSum += w;
        heightSum += sampleY * w;
      }
    }

    const yVal = weightSum > 0 ? heightSum / weightSum : 0;
    pos.setY(i, yVal);
    const colVal = evaluateRuta1TerrainColor(wx + 17, wz + 14, yVal);
    mergedColors.push(colVal.r, colVal.g, colVal.b);
  }
  mergedGeo.setAttribute('color', new THREE.Float32BufferAttribute(mergedColors, 3));

  terrains.forEach(t => {
    scene.remove(t);
    state.meshObjects = state.meshObjects.filter(o => o !== t);
  });

  const mergedGroup = new THREE.Group();
  mergedGroup.position.set(centerX, 0, centerZ);
  mergedGroup.add(createClayMesh(mergedGeo, 'MallaUnidaMundo', segCols, segRows));

  const unified = registerSceneObject(
    mergedGroup,
    `Terreno Unido (${totalWidth.toFixed(0)}x${totalDepth.toFixed(0)}m)`,
    'terrain',
    'merged_terrain',
    { width: totalWidth, depth: totalDepth, segCols, segRows }
  );
  recordGroupVertexEdits(unified);
  syncActiveSceneToRouteStore();

  selectMeshGroup(unified);
  showToast('🔗 ¡Terrenos unidos y guardados en tu carpeta!');
}

function duplicateSelectedHorizontally() {
  if (!state.selectedGroup) return;
  const src = state.selectedGroup;
  const w = (src.userData.params?.width || 6) * src.scale.x;
  const newX = src.position.x + w + 2.0;

  if (src.userData.category === 'terrain') {
    const rStart = src.userData.params?.rowStart ?? 0;
    const rEnd = src.userData.params?.rowEnd ?? 28;
    const copy = buildRuta1SliceMesh(
      rStart,
      rEnd,
      src.userData.label + ' (Copia)',
      'copy_slice',
      newX,
      src.position.z,
      src.userData.routeId
    );
    copy.scale.copy(src.scale);
    copy.position.y = src.position.y;
    selectMeshGroup(copy);
    syncActiveSceneToRouteStore();
    showToast('➕ División clonada al lado (Usa "Unir Malla" para fusionarlas)');
  } else {
    const cloneGroup = src.clone(true);
    cloneGroup.position.x = newX;
    registerSceneObject(
      cloneGroup,
      src.userData.label + ' (Copia)',
      src.userData.category,
      src.userData.moduleType,
      { ...src.userData.params },
      src.userData.routeId
    );
    selectMeshGroup(cloneGroup);
    showToast('➕ Pieza clonada al lado');
  }
}

// -------------------------------------------------------------
// GUARDAR, CARGAR Y EXPORTAR DISEÑOS DE MALLA
// -------------------------------------------------------------
function serializeCurrentScene() {
  syncActiveSceneToRouteStore();
  return {
    version: 4,
    timestamp: new Date().toISOString(),
    sceneName: state.currentSceneName,
    activeMode: state.activeMode,
    activeRouteId: state.activeRouteId,
    dimension: state.dimension,
    renderStyle: state.renderStyle,
    wireOpacity: state.wireOpacity,
    subdivisionMultiplier: state.subdivisionMultiplier,
    routes: state.routes,
    camera: {
      position: { x: activeCamera.position.x, y: activeCamera.position.y, z: activeCamera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z }
    },
    objects: state.meshObjects.map(g => ({
      moduleType: g.userData.moduleType || 'generic',
      label: g.userData.label,
      category: g.userData.category,
      routeId: g.userData.routeId,
      params: g.userData.params || {},
      position: { x: g.position.x, y: g.position.y, z: g.position.z },
      rotation: { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z },
      scale: { x: g.scale.x, y: g.scale.y, z: g.scale.z }
    }))
  };
}

async function saveCurrentDesign() {
  syncActiveSceneToRouteStore();
  const defaultName = state.activeMode === 'full_world' ? 'ruta_completa_mundo' : (state.activeRouteId || 'ruta_1_norte');
  await saveToServerFolderNow(defaultName, false);
}

async function refreshScenesDropdown(selectedName = '') {
  try {
    const res = await fetch('/api/scenes');
    const result = await res.json();
    const sel = document.getElementById('scene-select');
    if (!sel) return;

    sel.innerHTML = '<option value="">📂 Cargar...</option>';
    if (result.scenes && result.scenes.length > 0) {
      result.scenes.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = `📐 ${s}`;
        if (s === selectedName) opt.selected = true;
        sel.appendChild(opt);
      });
    }
  } catch (e) {}
}

async function loadSavedDesign(name) {
  if (!name) return;
  try {
    const res = await fetch(`/api/load?name=${encodeURIComponent(name)}`);
    const result = await res.json();
    if (result.success && result.data) {
      state.currentSceneName = result.name;
      rebuildSceneFromData(result.data);
      showToast(`📂 Diseño "${result.name}" cargado`);
    } else {
      showToast('No se pudo cargar el diseño');
    }
  } catch (e) {
    showToast('Error al cargar el diseño');
  }
}

function rebuildSceneFromData(data) {
  if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
    state.routes = data.routes;
    saveRoutesToLocalStorage();
    renderRoutesSidebarList();
    if (data.activeMode === 'full_world') {
      openFullWorldRoute();
    } else {
      const targetId = data.activeRouteId || state.routes[0].id;
      openRouteEditor(targetId);
    }
    return;
  }

  state.isRebuilding = true;
  clearAllMeshes(false);

  if (data.objects && Array.isArray(data.objects)) {
    data.objects.forEach(item => {
      if (item.moduleType !== 'malla') {
        instantiateSerializedObject(item, { x: 0, y: 0, z: 0 }, state.activeRouteId);
      }
    });
  }

  state.isRebuilding = false;
  syncActiveSceneToRouteStore();

  if (data.camera && data.camera.position && data.camera.target) {
    activeCamera.position.set(data.camera.position.x, data.camera.position.y, data.camera.position.z);
    controls.target.set(data.camera.target.x, data.camera.target.y, data.camera.target.z);
    controls.update();
  }
}

function exportToOBJ() {
  let objContent = '# Dino King 3D Mesh Studio Export\n';
  let vertexOffset = 1;

  state.meshObjects.forEach((group, gIdx) => {
    group.updateMatrixWorld(true);
    objContent += `o Grupo_${gIdx + 1}_${(group.userData.moduleType || 'Mesh')}\n`;

    group.traverse(child => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry;
        const pos = geo.attributes.position;
        if (!pos) return;

        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
          objContent += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
        }

        if (geo.index) {
          const idx = geo.index;
          for (let i = 0; i < idx.count; i += 3) {
            const a = idx.getX(i) + vertexOffset;
            const b = idx.getX(i + 1) + vertexOffset;
            const c = idx.getX(i + 2) + vertexOffset;
            objContent += `f ${a} ${b} ${c}\n`;
          }
        } else {
          for (let i = 0; i < pos.count; i += 3) {
            const a = i + vertexOffset;
            const b = i + 1 + vertexOffset;
            const c = i + 2 + vertexOffset;
            objContent += `f ${a} ${b} ${c}\n`;
          }
        }
        vertexOffset += pos.count;
      }
    });
  });

  const blob = new Blob([objContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.currentSceneName || 'ruta_malla'}.obj`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Archivo 3D .OBJ descargado');
}

// -------------------------------------------------------------
// MODOS DE RENDERIZADO Y DIMENSIONES
// -------------------------------------------------------------
function setRenderStyle(style) {
  state.renderStyle = style;
  document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`style-${style}`);
  if (btn) btn.classList.add('active');

  state.meshObjects.forEach(group => {
    group.traverse(child => {
      if (child.isMesh) applyRenderStyleToMesh(child);
    });
  });
}

function applyRenderStyleToMesh(mesh) {
  const wire = mesh.getObjectByName('wireOverlay');
  if (state.renderStyle === 'clay_wire') {
    mesh.material.visible = true;
    if (wire) wire.visible = true;
  } else if (state.renderStyle === 'clay_only') {
    mesh.material.visible = true;
    if (wire) wire.visible = false;
  } else if (state.renderStyle === 'wire_only') {
    mesh.material.visible = false;
    if (wire) wire.visible = true;
  }
}

function setDimension(dim) {
  state.dimension = dim;
  document.querySelectorAll('.dim-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`dim-${dim}`);
  if (btn) btn.classList.add('active');

  const w = container.clientWidth;
  const h = container.clientHeight;

  if (dim === '2.5D') {
    activeCamera = perspectiveCamera;
    perspectiveCamera.position.set(0, 24, 32);
    controls.object = activeCamera;
    controls.enableRotate = true;
    controls.target.set(0, 2, 0);
  } else if (dim === '3D') {
    activeCamera = perspectiveCamera;
    perspectiveCamera.position.set(26, 26, 32);
    controls.object = activeCamera;
    controls.enableRotate = true;
    controls.target.set(0, 2, 0);
  } else if (dim === '2D') {
    const aspect = w / h;
    const d = state.activeMode === 'full_world' ? 38 : 24;
    orthoCamera.left = -d * aspect;
    orthoCamera.right = d * aspect;
    orthoCamera.top = d;
    orthoCamera.bottom = -d;
    orthoCamera.updateProjectionMatrix();
    orthoCamera.position.set(0, 120, 0);
    orthoCamera.lookAt(0, 0, 0);

    activeCamera = orthoCamera;
    controls.object = activeCamera;
    controls.enableRotate = false;
    controls.target.set(0, 0, 0);
  }
  controls.update();
}

// -------------------------------------------------------------
// INSPECTOR CON CONTROLES PARA MOVER PIEZA O MOVER RUTA COMPLETA EN BLOQUE
// Y SISTEMA DE ESCULPIDO DE PUNTOS DE SUPERFICIE (CTRL + CLICK DERECHO)
// -------------------------------------------------------------
function initEvents() {
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDownSculpt);

  document.getElementById('wire-opacity-slider').addEventListener('input', (e) => {
    state.wireOpacity = parseFloat(e.target.value);
    document.getElementById('wire-opacity-val').textContent = `${Math.round(state.wireOpacity * 100)}%`;
    wireMaterial.opacity = state.wireOpacity;
  });

  document.getElementById('subdiv-slider').addEventListener('input', (e) => {
    state.subdivisionMultiplier = parseFloat(e.target.value);
    document.getElementById('subdiv-val').textContent = `${state.subdivisionMultiplier.toFixed(1)}x`;
  });

  // Sliders del panel de esculpido de puntos (Ctrl + Click Derecho)
  const radSlider = document.getElementById('sculpt-radius-slider');
  if (radSlider) {
    radSlider.addEventListener('input', (e) => {
      state.sculptRadius = parseFloat(e.target.value);
      const lbl = document.getElementById('val-sculpt-radius');
      if (lbl) lbl.textContent = `${state.sculptRadius.toFixed(1)}m`;
    });
  }

  const bindSculptDeltaSlider = (sliderId, labelId) => {
    const sl = document.getElementById(sliderId);
    const lb = document.getElementById(labelId);
    if (!sl) return;
    sl.addEventListener('input', () => {
      const dx = parseFloat(document.getElementById('sculpt-dx-slider')?.value || 0);
      const dy = parseFloat(document.getElementById('sculpt-dy-slider')?.value || 0);
      const dz = parseFloat(document.getElementById('sculpt-dz-slider')?.value || 0);
      if (lb) lb.textContent = parseFloat(sl.value).toFixed(2);
      applySculptFromSnapshot(dx, dy, dz);
    });
    sl.addEventListener('change', () => {
      finalizeSculptSession();
    });
  };

  bindSculptDeltaSlider('sculpt-dy-slider', 'val-sculpt-dy');
  bindSculptDeltaSlider('sculpt-dx-slider', 'val-sculpt-dx');
  bindSculptDeltaSlider('sculpt-dz-slider', 'val-sculpt-dz');

  const bindInspectorSlider = (id, valId, suffix, applyFn) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (!el) return;
    el.addEventListener('input', () => {
      if (!state.selectedGroup) return;
      const v = parseFloat(el.value);
      if (valEl) valEl.textContent = v.toFixed(2) + suffix;
      applyFn(state.selectedGroup, v);
      updateMarkedVertexMarkersPositions();
      syncActiveSceneToRouteStore();
    });
  };

  bindInspectorSlider('insp-pos-x', 'val-pos-x', '', (g, v) => {
    const moveWhole = document.getElementById('chk-move-whole-route')?.checked;
    if (state.activeMode === 'full_world' && moveWhole && g.userData.routeId) {
      const dx = v - g.position.x;
      const route = state.routes.find(r => r.id === g.userData.routeId);
      if (route) applyRouteWorldOffsetChange(route, route.worldOffset.x + dx, route.worldOffset.y, route.worldOffset.z);
    } else {
      g.position.x = v;
    }
  });

  bindInspectorSlider('insp-pos-y', 'val-pos-y', '', (g, v) => {
    const moveWhole = document.getElementById('chk-move-whole-route')?.checked;
    if (state.activeMode === 'full_world' && moveWhole && g.userData.routeId) {
      const dy = v - g.position.y;
      const route = state.routes.find(r => r.id === g.userData.routeId);
      if (route) applyRouteWorldOffsetChange(route, route.worldOffset.x, route.worldOffset.y + dy, route.worldOffset.z);
    } else {
      g.position.y = v;
    }
  });

  bindInspectorSlider('insp-pos-z', 'val-pos-z', '', (g, v) => {
    const moveWhole = document.getElementById('chk-move-whole-route')?.checked;
    if (state.activeMode === 'full_world' && moveWhole && g.userData.routeId) {
      const dz = v - g.position.z;
      const route = state.routes.find(r => r.id === g.userData.routeId);
      if (route) applyRouteWorldOffsetChange(route, route.worldOffset.x, route.worldOffset.y, route.worldOffset.z + dz);
    } else {
      g.position.z = v;
    }
  });

  bindInspectorSlider('insp-scale-x', 'val-scale-x', 'x', (g, v) => { g.scale.x = v; });
  bindInspectorSlider('insp-scale-z', 'val-scale-z', 'x', (g, v) => { g.scale.z = v; });
  bindInspectorSlider('insp-scale-y', 'val-scale-y', 'x', (g, v) => { g.scale.y = v; });
  bindInspectorSlider('insp-rot-y', 'val-rot-y', '', (g, v) => { g.rotation.y = v; });

  // Permitir arrastrar los paneles flotantes (#vertex-sculpt-panel y #mesh-inspector) desde su cabecera
  document.querySelectorAll('.floating-panel-header').forEach(header => {
    const panel = header.parentElement;
    if (!panel) return;
    let dragging = false;
    let startX = 0, startY = 0, origLeft = 0, origTop = 0;

    header.addEventListener('mousedown', (ev) => {
      if (ev.target.closest('button')) return;
      ev.preventDefault();
      const parentRect = container.getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      origLeft = rect.left - parentRect.left;
      origTop = rect.top - parentRect.top;
      panel.style.left = `${origLeft}px`;
      panel.style.top = `${origTop}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      startX = ev.clientX;
      startY = ev.clientY;
      dragging = true;
    });

    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const nx = Math.max(6, Math.min(container.clientWidth - panel.offsetWidth - 6, origLeft + (ev.clientX - startX)));
      const ny = Math.max(6, Math.min(container.clientHeight - panel.offsetHeight - 6, origTop + (ev.clientY - startY)));
      panel.style.left = `${nx}px`;
      panel.style.top = `${ny}px`;
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
    });
  });
}

function onPointerDown(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  // CTRL + CLICK DERECHO (o Ctrl + Shift + Click Izquierdo): Marcar / Editar Puntos de Superficie
  if ((e.button === 2 && (e.ctrlKey || e.metaKey)) || (e.button === 0 && e.ctrlKey && e.shiftKey)) {
    e.preventDefault();
    e.stopPropagation();

    controls.enabled = false;
    handleCtrlRightClickSurfacePoint(e.clientY);
    return;
  }

  if (e.button !== 0) return;

  raycaster.setFromCamera(mouse, activeCamera);

  const allMeshes = [];
  state.meshObjects.forEach(g => {
    g.traverse(c => { if (c.isMesh && c.name !== 'wireOverlay') allMeshes.push(c); });
  });

  const hits = raycaster.intersectObjects(allMeshes, false);
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj.parent && obj.parent !== scene) {
      obj = obj.parent;
    }
    selectMeshGroup(obj);
  } else {
    selectMeshGroup(null);
  }
}

function onPointerMove(e) {
  if (!state.isDraggingSculpt) return;
  const dyPixels = state.dragStartClientY - e.clientY;
  if (Math.abs(dyPixels) > 4) {
    state.dragMoved = true;
    const deltaY = dyPixels * 0.025;
    const dySlider = document.getElementById('sculpt-dy-slider');
    const dyLabel = document.getElementById('val-sculpt-dy');
    if (dySlider) dySlider.value = Math.max(-5, Math.min(5, deltaY));
    if (dyLabel) dyLabel.textContent = deltaY.toFixed(2);
    applySculptFromSnapshot(0, deltaY, 0);
  }
}

function onPointerUp(e) {
  if (state.isDraggingSculpt) {
    state.isDraggingSculpt = false;
    controls.enabled = true;
    if (state.dragMoved) {
      finalizeSculptSession();
      showToast('⛰️ Superficie ajustada');
    } else if (state.pendingUnmarkEntry) {
      // Si hizo Ctrl+Click Derecho sobre un punto ya marcado y no arrastró, lo desmarca
      removeMarkedVertexEntry(state.pendingUnmarkEntry);
      state.pendingUnmarkEntry = null;
      captureSculptSnapshot();
      updateSculptPanelUI();
    }
    state.pendingUnmarkEntry = null;
  } else if (!controls.enabled) {
    controls.enabled = true;
  }
}

function onKeyDownSculpt(e) {
  if (state.markedVertices.length === 0) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    nudgeMarkedVertices(0, 0.15, 0);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    nudgeMarkedVertices(0, -0.15, 0);
  } else if (e.key === 'Escape') {
    clearMarkedVertices();
  }
}

/**
 * Detecta el vértice más cercano en la superficie donde se hizo Ctrl + Click Derecho,
 * coloca una esfera marcadora 3D naranja y habilita el esculpido en vivo.
 */
function handleCtrlRightClickSurfacePoint(clientY) {
  raycaster.setFromCamera(mouse, activeCamera);

  const allMeshes = [];
  state.meshObjects.forEach(g => {
    g.traverse(c => { if (c.isMesh && c.name !== 'wireOverlay') allMeshes.push(c); });
  });

  const hits = raycaster.intersectObjects(allMeshes, false);
  if (hits.length === 0) return;

  const hit = hits[0];
  const mesh = hit.object;
  if (!mesh.geometry || !mesh.geometry.attributes.position) return;

  let parentGroup = mesh;
  while (parentGroup.parent && parentGroup.parent !== scene) {
    parentGroup = parentGroup.parent;
  }

  mesh.updateMatrixWorld(true);
  const localHit = mesh.worldToLocal(hit.point.clone());
  const pos = mesh.geometry.attributes.position;

  let bestIdx = 0;
  let minDistSq = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - localHit.x;
    const dy = pos.getY(i) - localHit.y;
    const dz = pos.getZ(i) - localHit.z;
    const dSq = dx * dx + dy * dy + dz * dz;
    if (dSq < minDistSq) {
      minDistSq = dSq;
      bestIdx = i;
    }
  }

  const vx = pos.getX(bestIdx);
  const vy = pos.getY(bestIdx);
  const vz = pos.getZ(bestIdx);

  // Verificar si este punto (o uno prácticamente idéntico en la misma malla) ya estaba marcado
  const existing = state.markedVertices.find(m => {
    if (m.mesh !== mesh) return false;
    if (m.vertexIndex === bestIdx) return true;
    const mx = pos.getX(m.vertexIndex);
    const my = pos.getY(m.vertexIndex);
    const mz = pos.getZ(m.vertexIndex);
    return Math.hypot(mx - vx, my - vy, mz - vz) < 0.12;
  });

  state.pendingUnmarkEntry = null;
  if (existing) {
    // Si ya estaba marcado, permitimos arrastrar para subir/bajar o soltar para desmarcar
    state.pendingUnmarkEntry = existing;
  } else {
    // Crear marcador 3D naranja brillante en el punto exacto
    const markerGeo = new THREE.SphereGeometry(0.22, 12, 10);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.renderOrder = 999;
    marker.userData.isVertexMarker = true;

    const worldPt = new THREE.Vector3(vx, vy, vz).applyMatrix4(mesh.matrixWorld);
    marker.position.copy(worldPt);
    scene.add(marker);

    state.markedVertices.push({
      group: parentGroup,
      mesh: mesh,
      vertexIndex: bestIdx,
      marker: marker
    });

    showToast(`🎯 Punto marcado (${state.markedVertices.length} activos). Arrastra o usa el panel para subir/bajar/suavizar.`);
  }

  captureSculptSnapshot();
  updateSculptPanelUI();

  state.isDraggingSculpt = true;
  state.dragStartClientY = clientY;
  state.dragMoved = false;
}

function removeMarkedVertexEntry(entry) {
  if (entry.marker) scene.remove(entry.marker);
  state.markedVertices = state.markedVertices.filter(m => m !== entry);
}

function clearMarkedVertices() {
  state.markedVertices.forEach(m => {
    if (m.marker) scene.remove(m.marker);
  });
  state.markedVertices = [];
  state.sculptSnapshot = null;
  updateSculptPanelUI();
}

function updateSculptPanelUI() {
  const panel = document.getElementById('vertex-sculpt-panel');
  const countEl = document.getElementById('sculpt-point-count');
  if (!panel) return;

  if (state.markedVertices.length > 0) {
    panel.classList.remove('hidden');
    if (countEl) countEl.textContent = state.markedVertices.length;
  } else {
    panel.classList.add('hidden');
  }
}

function resetSculptDeltaSliders() {
  ['sculpt-dy-slider', 'sculpt-dx-slider', 'sculpt-dz-slider'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = 0;
  });
  ['val-sculpt-dy', 'val-sculpt-dx', 'val-sculpt-dz'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0.00';
  });
}

function captureSculptSnapshot() {
  resetSculptDeltaSliders();
  const map = new Map();
  state.markedVertices.forEach(m => {
    if (!map.has(m.mesh)) {
      const arr = m.mesh.geometry.attributes.position.array;
      map.set(m.mesh, new Float32Array(arr));
    }
  });
  state.sculptSnapshot = map;
}

function updateMarkedVertexMarkersPositions() {
  const v = new THREE.Vector3();
  state.markedVertices.forEach(m => {
    if (!m.mesh || !m.marker) return;
    m.mesh.updateMatrixWorld(true);
    const pos = m.mesh.geometry.attributes.position;
    v.fromBufferAttribute(pos, m.vertexIndex).applyMatrix4(m.mesh.matrixWorld);
    m.marker.position.copy(v);
  });
}

function refreshMeshAndWireframeAfterSculpt(mesh, group) {
  const geo = mesh.geometry;
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();

  const wire = mesh.getObjectByName('wireOverlay');
  if (wire) {
    wire.geometry.dispose();
    wire.geometry = buildQuadWireGeometry(geo, geo.userData.quadCols, geo.userData.quadRows);
  }

  if (group) {
    recordGroupVertexEdits(group);
  }
}

/**
 * Aplica una deformación (dx, dy, dz) relativa al snapshot actual sobre todos los puntos marcados
 * y su vecindario dentro de `state.sculptRadius` con caída suave (smooth falloff).
 */
function applySculptFromSnapshot(dx, dy, dz) {
  if (!state.sculptSnapshot || state.markedVertices.length === 0) return;

  const byMesh = new Map();
  state.markedVertices.forEach(m => {
    if (!byMesh.has(m.mesh)) byMesh.set(m.mesh, { group: m.group, indices: [] });
    byMesh.get(m.mesh).indices.push(m.vertexIndex);
  });

  const radius = state.sculptRadius;

  byMesh.forEach(({ group, indices }, mesh) => {
    const baseArr = state.sculptSnapshot.get(mesh);
    if (!baseArr) return;

    const pos = mesh.geometry.attributes.position;
    const centers = indices.map(idx => ({
      x: baseArr[idx * 3],
      y: baseArr[idx * 3 + 1],
      z: baseArr[idx * 3 + 2]
    }));

    for (let i = 0; i < pos.count; i++) {
      const bx = baseArr[i * 3];
      const by = baseArr[i * 3 + 1];
      const bz = baseArr[i * 3 + 2];

      let maxW = 0;
      for (let c = 0; c < centers.length; c++) {
        const dist = Math.hypot(bx - centers[c].x, bz - centers[c].z, (by - centers[c].y) * 0.5);
        if (radius <= 0.05) {
          if (dist < 0.06) maxW = 1.0;
        } else if (dist < radius) {
          const t = 1.0 - dist / radius;
          const w = t * t * (3 - 2 * t);
          if (w > maxW) maxW = w;
        }
      }

      if (maxW > 0) {
        pos.setXYZ(i, bx + dx * maxW, by + dy * maxW, bz + dz * maxW);
      } else {
        pos.setXYZ(i, bx, by, bz);
      }
    }

    refreshMeshAndWireframeAfterSculpt(mesh, group);
  });

  updateMarkedVertexMarkersPositions();
}

function finalizeSculptSession() {
  captureSculptSnapshot();
  syncActiveSceneToRouteStore();
}

function nudgeMarkedVertices(dx, dy, dz) {
  if (state.markedVertices.length === 0) return;
  if (!state.sculptSnapshot) captureSculptSnapshot();
  applySculptFromSnapshot(dx, dy, dz);
  finalizeSculptSession();
}

/**
 * Suaviza (Smooth Laplaciano) los bordes o desniveles alrededor de los puntos marcados
 */
function smoothMarkedVertices() {
  if (state.markedVertices.length === 0) return;

  const byMesh = new Map();
  state.markedVertices.forEach(m => {
    if (!byMesh.has(m.mesh)) byMesh.set(m.mesh, { group: m.group, indices: [] });
    byMesh.get(m.mesh).indices.push(m.vertexIndex);
  });

  const radius = Math.max(0.8, state.sculptRadius);

  byMesh.forEach(({ group, indices }, mesh) => {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const oldArr = new Float32Array(pos.array);
    const qCols = geo.userData.quadCols;
    const qRows = geo.userData.quadRows;

    const centers = indices.map(idx => ({
      x: oldArr[idx * 3],
      y: oldArr[idx * 3 + 1],
      z: oldArr[idx * 3 + 2]
    }));

    for (let i = 0; i < pos.count; i++) {
      const vx = oldArr[i * 3];
      const vy = oldArr[i * 3 + 1];
      const vz = oldArr[i * 3 + 2];

      let maxW = 0;
      for (let c = 0; c < centers.length; c++) {
        const dist = Math.hypot(vx - centers[c].x, vz - centers[c].z);
        if (dist < radius) {
          const t = 1.0 - dist / radius;
          const w = t * t * (3 - 2 * t);
          if (w > maxW) maxW = w;
        }
      }
      if (maxW <= 0.01) continue;

      // Promediar con los vértices vecinos
      let sumY = 0;
      let count = 0;

      if (qCols && qRows && pos.count === (qCols + 1) * (qRows + 1)) {
        const stride = qCols + 1;
        const r = Math.floor(i / stride);
        const c = i % stride;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr <= qRows && nc >= 0 && nc <= qCols) {
              const nIdx = nr * stride + nc;
              sumY += oldArr[nIdx * 3 + 1];
              count++;
            }
          }
        }
      } else {
        for (let j = 0; j < pos.count; j++) {
          const nx = oldArr[j * 3];
          const nz = oldArr[j * 3 + 2];
          if (Math.hypot(nx - vx, nz - vz) < 1.35) {
            sumY += oldArr[j * 3 + 1];
            count++;
          }
        }
      }

      if (count > 0) {
        const avgY = sumY / count;
        const blend = 0.65 * maxW;
        pos.setY(i, vy * (1 - blend) + avgY * blend);
      }
    }

    refreshMeshAndWireframeAfterSculpt(mesh, group);
  });

  updateMarkedVertexMarkersPositions();
  finalizeSculptSession();
  showToast('✨ Zona suavizada alrededor de los puntos marcados');
}

/**
 * Nivela / aplana los puntos marcados a su altura promedio
 */
function flattenMarkedVertices() {
  if (state.markedVertices.length === 0) return;

  let sumTargetY = 0;
  state.markedVertices.forEach(m => {
    sumTargetY += m.mesh.geometry.attributes.position.getY(m.vertexIndex);
  });
  const targetY = sumTargetY / state.markedVertices.length;

  const byMesh = new Map();
  state.markedVertices.forEach(m => {
    if (!byMesh.has(m.mesh)) byMesh.set(m.mesh, { group: m.group, indices: [] });
    byMesh.get(m.mesh).indices.push(m.vertexIndex);
  });

  const radius = Math.max(0.5, state.sculptRadius);

  byMesh.forEach(({ group, indices }, mesh) => {
    const pos = mesh.geometry.attributes.position;
    const centers = indices.map(idx => ({
      x: pos.getX(idx),
      z: pos.getZ(idx)
    }));

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      let maxW = 0;
      for (let c = 0; c < centers.length; c++) {
        const dist = Math.hypot(vx - centers[c].x, vz - centers[c].z);
        if (dist < radius) {
          const t = 1.0 - dist / radius;
          const w = t * t * (3 - 2 * t);
          if (w > maxW) maxW = w;
        }
      }
      if (maxW > 0) {
        pos.setY(i, vy * (1 - maxW) + targetY * maxW);
      }
    }

    refreshMeshAndWireframeAfterSculpt(mesh, group);
  });

  updateMarkedVertexMarkersPositions();
  finalizeSculptSession();
  showToast('📏 Superficie nivelada a la altura promedio de los puntos');
}

/**
 * Restaura los puntos marcados (y su radio de influencia) a su forma y altura original sin deformaciones
 */
function restoreMarkedVerticesToOriginal() {
  if (state.markedVertices.length === 0) return;

  const byMesh = new Map();
  state.markedVertices.forEach(m => {
    if (!byMesh.has(m.mesh)) byMesh.set(m.mesh, { group: m.group, indices: [] });
    byMesh.get(m.mesh).indices.push(m.vertexIndex);
  });

  const radius = Math.max(0.4, state.sculptRadius);

  byMesh.forEach(({ group, indices }, mesh) => {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const orig = geo.userData.originalPositions;
    if (!pos || !orig || orig.length !== pos.array.length) return;

    const centers = indices.map(idx => ({
      x: orig[idx * 3],
      z: orig[idx * 3 + 2]
    }));

    for (let i = 0; i < pos.count; i++) {
      const ox = orig[i * 3];
      const oy = orig[i * 3 + 1];
      const oz = orig[i * 3 + 2];

      let maxW = 0;
      for (let c = 0; c < centers.length; c++) {
        const dist = Math.hypot(ox - centers[c].x, oz - centers[c].z);
        if (radius <= 0.05) {
          if (dist < 0.06) maxW = 1.0;
        } else if (dist < radius) {
          const t = 1.0 - dist / radius;
          const w = t * t * (3 - 2 * t);
          if (w > maxW) maxW = w;
        }
      }

      if (maxW > 0) {
        pos.setXYZ(i, ox, oy, oz);
      }
    }

    refreshMeshAndWireframeAfterSculpt(mesh, group);
  });

  [' dy', 'dx', 'dz'].forEach(axis => {
    const k = axis.trim();
    const sl = document.getElementById(`sculpt-${k}-slider`);
    const lb = document.getElementById(`val-sculpt-${k}`);
    if (sl) sl.value = 0;
    if (lb) lb.textContent = '0.00';
  });

  updateMarkedVertexMarkersPositions();
  finalizeSculptSession();
  showToast('↺ Puntos restaurados al 100% a su forma original');
}

/**
 * Restaura por completo la pieza seleccionada (geometría/relieve original, escala 1x y rotación 0)
 */
function restoreSelectedMeshToOriginal() {
  if (!state.selectedGroup) return;
  const g = state.selectedGroup;

  g.scale.set(1, 1, 1);
  g.rotation.set(0, 0, 0);

  g.traverse(child => {
    if (child.isMesh && child.name !== 'wireOverlay' && child.geometry) {
      const orig = child.geometry.userData.originalPositions;
      const pos = child.geometry.attributes.position;
      if (orig && pos && orig.length === pos.array.length) {
        pos.array.set(orig);
        pos.needsUpdate = true;
        child.geometry.computeVertexNormals();
        const wire = child.getObjectByName('wireOverlay');
        if (wire) {
          wire.geometry.dispose();
          wire.geometry = buildQuadWireGeometry(
            child.geometry,
            child.geometry.userData.quadCols,
            child.geometry.userData.quadRows
          );
        }
      }
    }
  });

  if (g.userData.params) {
    delete g.userData.params.vertexEdits;
  }

  updateMarkedVertexMarkersPositions();
  if (state.markedVertices.length > 0) captureSculptSnapshot();
  selectMeshGroup(g);
  syncActiveSceneToRouteStore();
  showToast('↺ Pieza y relieve restaurados a su estado original');
}

/**
 * Guarda de forma compacta los vértices editados en `group.userData.params.vertexEdits`
 * para que se sincronicen automáticamente con Ruta Completa y con el guardado en disco.
 */
function recordGroupVertexEdits(group) {
  if (!group || !group.userData) return;
  group.userData.params = group.userData.params || {};
  const editsByMesh = {};

  let meshOrder = 0;
  group.traverse(child => {
    if (child.isMesh && child.name !== 'wireOverlay' && child.geometry) {
      const key = child.name || `m_${meshOrder}`;
      meshOrder++;
      const pos = child.geometry.attributes.position;
      const orig = child.geometry.userData.originalPositions;
      if (!pos || !orig || orig.length !== pos.array.length) return;

      const diffs = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const ox = orig[i * 3];
        const oy = orig[i * 3 + 1];
        const oz = orig[i * 3 + 2];
        if (Math.abs(x - ox) > 1e-3 || Math.abs(y - oy) > 1e-3 || Math.abs(z - oz) > 1e-3) {
          diffs.push([i, Number(x.toFixed(3)), Number(y.toFixed(3)), Number(z.toFixed(3))]);
        }
      }
      if (diffs.length > 0) {
        editsByMesh[key] = diffs;
      }
    }
  });

  if (Object.keys(editsByMesh).length > 0) {
    group.userData.params.vertexEdits = editsByMesh;
  } else {
    delete group.userData.params.vertexEdits;
  }
}

function applySavedVertexEdits(group, vertexEdits) {
  if (!group || !vertexEdits) return;
  group.userData = group.userData || {};
  group.userData.params = group.userData.params || {};
  group.userData.params.vertexEdits = vertexEdits;
  let meshOrder = 0;
  group.traverse(child => {
    if (child.isMesh && child.name !== 'wireOverlay' && child.geometry) {
      const key = child.name || `m_${meshOrder}`;
      meshOrder++;
      const diffs = vertexEdits[key];
      if (!Array.isArray(diffs) || diffs.length === 0) return;

      const pos = child.geometry.attributes.position;
      diffs.forEach(([idx, x, y, z]) => {
        if (idx >= 0 && idx < pos.count) {
          pos.setXYZ(idx, x, y, z);
        }
      });

      child.geometry.attributes.position.needsUpdate = true;
      child.geometry.computeVertexNormals();
      const wire = child.getObjectByName('wireOverlay');
      if (wire) {
        wire.geometry.dispose();
        wire.geometry = buildQuadWireGeometry(
          child.geometry,
          child.geometry.userData.quadCols,
          child.geometry.userData.quadRows
        );
      }
    }
  });
}

function selectMeshGroup(group) {
  if (state.selectedGroup) {
    state.selectedGroup.traverse(c => {
      if (c.name === 'wireOverlay') c.material = wireMaterial;
    });
  }

  state.selectedGroup = group;
  const insp = document.getElementById('mesh-inspector');

  if (group) {
    group.traverse(c => {
      if (c.name === 'wireOverlay') c.material = highlightWireMaterial;
    });
    insp.classList.remove('hidden');
    document.getElementById('insp-title').textContent = group.userData.label || 'Malla Seleccionada';

    const routeTagEl = document.getElementById('insp-route-tag');
    const moveWholeRow = document.getElementById('insp-move-whole-route-row');
    const ownerRoute = state.routes.find(r => r.id === group.userData.routeId);

    if (ownerRoute) {
      if (routeTagEl) routeTagEl.textContent = `Pertenece a: ${ownerRoute.name}`;
      state.selectedRouteToMove = ownerRoute.id;
      renderRoutesSidebarList();
    } else if (routeTagEl) {
      routeTagEl.textContent = '';
    }

    if (moveWholeRow) {
      moveWholeRow.style.display = (state.activeMode === 'full_world' && ownerRoute) ? 'flex' : 'none';
    }

    const setSlider = (id, valId, val, suffix = '') => {
      const el = document.getElementById(id);
      const vEl = document.getElementById(valId);
      if (el) el.value = val;
      if (vEl) vEl.textContent = Number(val).toFixed(2) + suffix;
    };

    setSlider('insp-pos-x', 'val-pos-x', group.position.x);
    setSlider('insp-pos-y', 'val-pos-y', group.position.y);
    setSlider('insp-pos-z', 'val-pos-z', group.position.z);
    setSlider('insp-scale-x', 'val-scale-x', group.scale.x, 'x');
    setSlider('insp-scale-z', 'val-scale-z', group.scale.z, 'x');
    setSlider('insp-scale-y', 'val-scale-y', group.scale.y, 'x');
    setSlider('insp-rot-y', 'val-rot-y', group.rotation.y);
  } else {
    insp.classList.add('hidden');
  }
}

function deleteSelectedMesh() {
  if (!state.selectedGroup) return;
  clearMarkedVertices();
  scene.remove(state.selectedGroup);
  state.meshObjects = state.meshObjects.filter(g => g !== state.selectedGroup);
  state.selectedGroup = null;
  document.getElementById('mesh-inspector').classList.add('hidden');
  updateStats();
  syncActiveSceneToRouteStore();
  showToast('Pieza eliminada (Sincronizado con Ruta Completa)');
}

function clearAllMeshes(confirmUser = true) {
  if (confirmUser && !confirm('¿Limpiar todas las mallas de la vista actual?')) return;
  clearMarkedVertices();
  state.meshObjects.forEach(g => scene.remove(g));
  state.meshObjects = [];
  state.selectedGroup = null;
  document.getElementById('mesh-inspector').classList.add('hidden');
  updateStats();
  if (confirmUser) {
    syncActiveSceneToRouteStore();
    showToast('Lienzo 3D limpio');
  }
}

function updateStats() {
  let vertices = 0;
  let faces = 0;
  state.meshObjects.forEach(g => {
    g.traverse(c => {
      if (c.isMesh && c.geometry) {
        const pos = c.geometry.attributes.position;
        if (pos) vertices += pos.count;
        if (c.geometry.index) faces += c.geometry.index.count / 3;
        else if (pos) faces += pos.count / 3;
      }
    });
  });

  document.getElementById('stat-objects').textContent = state.meshObjects.length;
  document.getElementById('stat-verts').textContent = vertices.toLocaleString();
  document.getElementById('stat-faces').textContent = Math.round(faces).toLocaleString();
}

async function checkLiveMesh(initial = false) {
  try {
    const res = await fetch('/api/live-check');
    const data = await res.json();
    if (data.mtime && data.mtime > state.lastLiveMtime) {
      state.lastLiveMtime = data.mtime;
    }
  } catch (e) {}
}

function onWindowResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  perspectiveCamera.aspect = w / h;
  perspectiveCamera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

/**
 * Actualiza la ondulación de las láminas de agua en tiempo real
 */
// Lista de láminas de agua con oleaje (se recalcula solo cuando cambian los objetos del mundo, no en cada fotograma:
// recorrer los ~28 000 objetos de la isla para buscarlas costaba ~11 ms por fotograma)
let _aguaCache = null, _aguaN = -1;
function updateWaterSurfaces(time) {
  if (_aguaN !== state.meshObjects.length || !_aguaCache) {
    _aguaN = state.meshObjects.length;
    _aguaCache = [];
    state.meshObjects.forEach((group) => group.traverse((c) => { if (c.userData && c.userData.isWaterSurface && c.geometry) _aguaCache.push(c); }));
  }
  _aguaCache.forEach((c) => {
    const pos = c.geometry.attributes.position;
    const orig = c.userData.origY;
    if (!orig || orig.length !== pos.count) return;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const wave = Math.sin(x * 1.6 + time * 2.4) * 0.045 + Math.cos(z * 2.0 + time * 1.9) * 0.038;
      pos.setY(i, orig[i] + wave);
    }
    pos.needsUpdate = true;
  });
}

// Modo /jugar: el mundo no se mueve, así que se quitan las mallas de alambre del editor (ocultas en el juego) y se
// congelan las matrices de los objetos fijos. Antes la escena recalculaba ~28 000 objetos en cada fotograma (~25 ms).
// Los personajes (huesos animados), el avatar, el compañero y los efectos siguen actualizándose.
function congelarMundoEstatico() {
  let quitadas = 0, congelados = 0;
  state.meshObjects.forEach((group) => {
    const alambres = [];
    group.traverse((o) => { if (o.name === 'wireOverlay') alambres.push(o); });
    alambres.forEach((o) => { if (o.parent) { o.parent.remove(o); quitadas++; } });
    if (group.userData.category === 'personajes') return; // tienen huesos que se animan
    group.updateMatrixWorld(true);
    group.traverse((o) => { o.matrixAutoUpdate = false; o.matrixWorldNeedsUpdate = false; congelados++; });
  });
  console.info(`Mundo congelado: ${congelados} objetos fijos, ${quitadas} mallas de alambre retiradas`);
}

// -------------------------------------------------------------
// MOTOR DE FÍSICAS, COLISIONES Y AVATAR EXPLORADOR
// -------------------------------------------------------------
window.DinoPhysics = {
  active: false,
  avatar: null,
  shadowMesh: null,
  bodyParts: {},
  pos: new THREE.Vector3(0, 0, 52),
  vel: new THREE.Vector3(0, 0, 0),
  heading: 0,
  targetHeading: 0,
  isGrounded: false,
  isSwimming: false,
  isOnBridge: false,
  currentSurfaceType: 'ground',
  walkCycle: 0,
  keys: {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false,
    shift: false
  },
  colliders: [],
  waterZones: [],
  bridges: [],
  raycaster: new THREE.Raycaster(),
  downVec: new THREE.Vector3(0, -1, 0),

  init() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
  },

  onKey(e, isDown) {
    const k = e.key.toLowerCase();
    // Con el Dino Lector abierto, Esc solo lo cierra y el juego no recibe teclas
    if (window.dinoLectorAbierto && window.dinoLectorAbierto()) {
      if (isDown && k === 'escape') window.cerrarDinoLector();
      return;
    }
    if (k === 'w' || k === 'arrowup') this.keys.w = isDown;
    if (k === 's' || k === 'arrowdown') this.keys.s = isDown;
    if (k === 'a' || k === 'arrowleft') this.keys.a = isDown;
    if (k === 'd' || k === 'arrowright') this.keys.d = isDown;
    if (k === ' ' || k === 'spacebar') {
      if (isDown && !this.keys.space && this.active) {
        this.tryJump();
      }
      this.keys.space = isDown;
    }
    if (k === 'shift') this.keys.shift = isDown;
    if (k === 'escape' && this.active && isDown) {
      togglePlayableAvatar();
    }
    if (!this.active) return;
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (k === 'q') this.keys.q = isDown;
    if (k === 'e') this.keys.e = isDown;
    if (!isDown) return;
    if (k === 'c') this.toggleColisiones();
    if (k === 'f') this.celebrar();
    if (k === 'p') this.mostrarPanelEntrada(!this.panelVisible);
    if (k === 'r') this.excavar();
    if (k === 'g') this.jugarConCompanero();
    const iEnt = '123456'.indexOf(k);
    if (iEnt >= 0 && this.ENTRADAS[iEnt]) this.teletransportar(iEnt);
  },

  // ================= ENTRAR AL MUNDO: personaje jugable, puntos de aparición, cámara y colisiones visibles =================
  ENTRADAS: [
    { nombre: '🏛️ Plaza de la Forja', x: 0, z: 45.2 },
    { nombre: '🌲 Entrada de la Forja (bosque)', x: 0, z: 30.5 },
    { nombre: '⚓ Puerto del Viento', x: -25, z: -15 },
    { nombre: '🏡 Plaza del Valle', x: 36.5, z: 7.6 },
    { nombre: '🪧 Bosque: Ruta 1 Sur', x: -0.5, z: 25 },
    { nombre: '⛰️ Bosque: Montaña y cueva', x: 0, z: -17 }
  ],
  camYaw: 0,
  camDist: 9,
  ESCALA_JUGADOR: 0.82, // tamaño del personaje jugable respecto al modelo original (~1,30 m → ~1,07 m)
  panelVisible: false,

  personajesDisponibles() {
    const B = window.BibliotecaMallas && window.BibliotecaMallas.mallas;
    if (!B) return [];
    return Object.keys(B).filter((id) => B[id].categoria === 'personajes').map((id) => ({ id, nombre: B[id].nombre || id }));
  },

  ponerPersonaje(id) {
    const B = window.BibliotecaMallas && window.BibliotecaMallas.mallas;
    if (!B || !B[id] || !window.MallasComun || !this.avatar) return;
    if (this.modelo) { this.avatar.remove(this.modelo); this.modelo = null; this.mixer = null; }
    // Se construye la malla sin registrarla en la escena (no se guarda en las rutas)
    const m = B[id].construir(window.MallasComun);
    const bb = new THREE.Box3().setFromObject(m), alto = bb.max.y - bb.min.y;
    // Tamaño del jugador: los chibis miden ~1,30 m; en el modo juego van al 82 % (~1,07 m) para que casas y puertas
    // se vean más grandes a su lado. Un modelo fuera de rango se lleva a esa misma altura.
    const ESCALA = this.ESCALA_JUGADOR;
    m.scale.setScalar(alto > 0.01 && (alto < 1.0 || alto > 2.2) ? (1.3 * ESCALA) / alto : ESCALA);
    if (this.shadowMesh) this.shadowMesh.scale.setScalar(ESCALA);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.name !== 'wireOverlay') applyRenderStyleToMesh(o); } });
    this.avatar.add(m);
    this.modelo = m;
    const bbM = new THREE.Box3().setFromObject(m);
    this.altoModelo = Math.max(0.6, bbM.max.y - bbM.min.y);
    this.personajeId = id;
    if (this.bodyParts && this.bodyParts.rig) this.bodyParts.rig.visible = false;
    if (m.animations && m.animations.length) {
      // Modo juego: las piernas chibi miden 17 cm y con el paso original (26°) avanzan solo 0,37 m/s sin patinar.
      // Se alargan los pasos (×1,4) y se crea 'Correr' (zancada ×2 y tronco inclinado). Solo en esta copia del modelo.
      const caminar = m.animations.find((c) => c.name === 'Caminar');
      if (caminar && !m.animations.find((c) => c.name === 'Correr')) {
        const correr = caminar.clone();
        correr.name = 'Correr';
        this.ampliarPaso(caminar, 1.4, 0);
        this.ampliarPaso(correr, 2.0, 10);
        m.animations.push(correr);
      }
      this.zancada = this.medirZancada(m, 'Caminar');
      this.zancadaCorrer = this.medirZancada(m, 'Correr');
      this.mixer = new THREE.AnimationMixer(m);
      this.acciones = {};
      m.animations.forEach((c) => { this.acciones[c.name] = this.mixer.clipAction(c); });
      this.animActual = null;
      this.ponerAnim('Reposo');
    }
    try { localStorage.setItem('dino_personaje_jugable', id); } catch (e) {}
    showToast(`🧍 Ahora juegas como ${B[id].nombre || id}`);
  },

  ponerAnim(nombre, velocidad = 1) {
    if (!this.acciones) return;
    const a = this.acciones[nombre] || this.acciones.Reposo;
    if (!a) return;
    a.timeScale = velocidad;
    if (this.animActual === a) return;
    const previa = this.animActual;
    if (previa) previa.fadeOut(0.25);
    // Si la animación aún se estaba apagando se retoma donde iba (no salta al primer fotograma);
    // entre Caminar y Correr se conserva la fase del paso (mismo pie adelante)
    if (!a.isRunning()) {
      a.reset();
      const PASOS = ['Caminar', 'Correr'];
      if (previa && PASOS.includes(nombre) && PASOS.includes(previa.getClip().name)) a.time = previa.time;
    }
    a.fadeIn(0.25).play();
    this.animActual = a;
  },

  // Multiplica el balanceo (giro X) de piernas, pies y brazos de un clip y, opcionalmente, inclina el pecho (grados)
  ampliarPaso(clip, k, inclina) {
    const e = new THREE.Euler(), q = new THREE.Quaternion();
    clip.tracks.forEach((tr) => {
      const extremidad = /^Hueso(Pierna|Pie|Brazo)[ID]\.quaternion$/.test(tr.name);
      const pecho = inclina && tr.name === 'HuesoPecho.quaternion';
      if (!extremidad && !pecho) return;
      const v = tr.values;
      for (let i = 0; i < v.length; i += 4) {
        e.setFromQuaternion(q.set(v[i], v[i + 1], v[i + 2], v[i + 3]), 'XYZ');
        if (extremidad) e.x *= k; else e.x += (inclina * Math.PI) / 180;
        q.setFromEuler(e);
        v[i] = q.x; v[i + 1] = q.y; v[i + 2] = q.z; v[i + 3] = q.w;
      }
    });
  },

  // Velocidad (m/s) a la que un clip de pasos, a ritmo 1, avanza sin que los pies patinen:
  // recorrido del pie adelante-atrás medido en el esqueleto (HuesoPieI) × 2 pasos / duración del ciclo.
  medirZancada(m, nombreClip = 'Caminar') {
    const clip = (m.animations || []).find((c) => c.name === nombreClip);
    let pie = null;
    const huesos = [];
    m.traverse((o) => {
      if (!o.isBone) return;
      huesos.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
      if (!pie && /^HuesoPie[ID]$/.test(o.name)) pie = o;
    });
    if (!clip || !pie || !(clip.duration > 0)) return 1.0;
    const mx = new THREE.AnimationMixer(m);
    mx.clipAction(clip).play();
    const v = new THREE.Vector3();
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < 32; i++) {
      mx.setTime((clip.duration * i) / 32);
      m.updateMatrixWorld(true);
      m.worldToLocal(pie.getWorldPosition(v));
      zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
    }
    mx.stopAllAction();
    mx.uncacheRoot(m);
    huesos.forEach(([o, p, q, s]) => { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); });
    m.updateMatrixWorld(true);
    const recorrido = (zMax - zMin) * m.scale.x;
    return recorrido > 0.02 ? Math.max(0.25, Math.min(3, (2 * recorrido) / clip.duration)) : 1.0;
  },

  celebrar() {
    if (!this.acciones || !this.acciones.Celebrar) return;
    this.celebrandoHasta = performance.now() + this.acciones.Celebrar.getClip().duration * 1000;
    this.ponerAnim('Celebrar');
  },

  teletransportar(i) {
    const E = this.ENTRADAS[i];
    if (!E) return;
    this.pos.set(E.x, 0, E.z);
    this.pos.y = this.getGroundHeight(E.x, E.z).height + 0.05;
    this.vel.set(0, 0, 0);
    this.rapidez = 0; this.giroVel = 0;
    this.visY = this.camBaseY = this.pos.y;
    this.heading = Math.PI; this.camYaw = 0; this.camYawVel = 0;
    if (this.avatar) { this.avatar.position.copy(this.pos); this.avatar.rotation.y = this.heading; }
    const cam = this.camaraDeseada();
    activeCamera.position.copy(cam.pos);
    controls.target.copy(cam.mira);
    activeCamera.lookAt(controls.target);
    showToast(`📍 ${E.nombre}`);
  },

  // ================= DINO LECTOR DE MANO: cartas dino escondidas por la isla =================
  // Las 105 cartas están en static/cartas_ocultas.json. El lector parpadea más rápido cuanto más cerca hay una carta
  // (con el color de su elemento) y con [R] se excava al estar encima. Las cartas fuertes están selladas hasta cumplir
  // su requisito (ver static/cartas_isla.js) y el lector no las detecta. El progreso lo comparte la página del Dino Lector.
  COLOR_ELEMENTO: { fuego: '#ef4444', agua: '#0ea5e9', rayo: '#eab308', tierra: '#b45309', planta: '#22c55e', viento: '#38bdf8', especial: '#d946ef', normal: '#a8a29e' },
  ICONO_ELEMENTO: { fuego: '🔥', agua: '💧', rayo: '⚡', tierra: '⛰️', planta: '🌿', viento: '🌪️', especial: '✨', normal: '⚪' },
  RADIO_LECTOR: 10,

  async cargarCartas() {
    if (this.cartas || this._cargandoCartas || !window.CartasIsla) return;
    this._cargandoCartas = true;
    try {
      const [oc, dj] = await Promise.all([
        fetch('/static/cartas_ocultas.json', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/assets/dinos/dinos.json').then((r) => r.json())
      ]);
      this.infoDinos = {};
      (dj.dinos || []).forEach((d) => { this.infoDinos[d.id] = d; });
      window.CartasIsla.usarDinos(dj.dinos || []);
      await window.CartasIsla.cargarRequisitos(); // misiones de vínculo de los compañeros
      this.cartas = oc.cartas || [];
      // Fer y Ander ya tienen su dino inicial (carta y vínculo)
      if (window.CartasIsla.otorgarInicial(this.personajeId)) this._prog = null;
      this._prog = window.CartasIsla.leer();
      this.desbloqueadas = new Set(this.cartas.filter((c) => !window.CartasIsla.sellada(c.id, this._prog)).map((c) => c.id));
      window.addEventListener('storage', (e) => { if (e.key === window.CartasIsla.CLAVE) { this._prog = null; this.revisarDesbloqueos(); } });
    } catch (e) {
      console.warn('No se pudieron cargar las cartas escondidas', e);
      this.cartas = [];
    }
    this._cargandoCartas = false;
  },

  progreso() {
    if (!this._prog && window.CartasIsla) this._prog = window.CartasIsla.leer();
    return this._prog || { encontradas: [], guardianes: [] };
  },

  // Avisa cuando una carta sellada pasa a poder detectarse (por cartas encontradas o guardianes vencidos)
  revisarDesbloqueos() {
    if (!this.cartas || !window.CartasIsla) return;
    const C = window.CartasIsla, p = this.progreso(), nuevas = [];
    this.cartas.forEach((c) => {
      if (this.desbloqueadas.has(c.id) || C.sellada(c.id, p)) return;
      this.desbloqueadas.add(c.id);
      if (!p.encontradas.includes(c.id)) nuevas.push(c);
    });
    if (!nuevas.length) return;
    const porNivel = {};
    nuevas.forEach((c) => { const n = C.nivel(c.id); porNivel[n] = (porNivel[n] || 0) + 1; });
    const txt = Object.entries(porNivel).map(([n, k]) => `${k} ${C.NIVELES[n].nombre.toLowerCase()}${k > 1 ? 's' : ''}`).join(', ');
    showToast(`📡 Tu Dino Lector capta señales nuevas: ${txt}`);
  },

  crearLector() {
    if (document.getElementById('dino-lector-hud')) return;
    const css = document.createElement('style');
    css.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap');
#dino-lector-hud{position:absolute;right:18px;bottom:18px;z-index:32;font-family:'Fredoka',system-ui,sans-serif;user-select:none;display:none;flex-direction:column;align-items:flex-end;gap:6px;--dlh-color:#facc15}
#dino-lector-hud.visible{display:flex}
.dlh-cuerpo{position:relative;display:flex;align-items:center;gap:12px;padding:12px 16px 12px 12px;background:linear-gradient(160deg,#ffc46b,#fb923c 50%,#ea580c);border-radius:28px;border:3px solid #7c2d12;box-shadow:0 6px 0 #7c2d12,0 16px 30px rgba(0,0,0,.35),inset 0 3px 0 rgba(255,255,255,.55)}
.dlh-cuerpo::before{content:'';position:absolute;left:30px;top:-24px;width:9px;height:24px;background:#7c2d12;border-radius:5px 5px 0 0}
.dlh-cuerpo::after{content:'';position:absolute;left:25px;top:-36px;width:19px;height:19px;border-radius:50%;background:#fde68a;border:3px solid #7c2d12}
#dino-lector-hud.on .dlh-cuerpo::after{background:var(--dlh-color);box-shadow:0 0 14px 4px var(--dlh-color)}
.dlh-radar{position:relative;width:78px;height:78px;border-radius:50%;background:radial-gradient(circle,#f7fee7 0 28%,#bef264 29% 31%,#ecfccb 32% 60%,#a3e635 61% 63%,#d9f99d 64%);border:4px solid #7c2d12;overflow:hidden;box-shadow:inset 0 3px 8px rgba(0,0,0,.25)}
.dlh-barrido{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(21,128,61,.5),rgba(21,128,61,0) 28%);animation:dlhGiro 2.2s linear infinite}
@keyframes dlhGiro{to{transform:rotate(360deg)}}
.dlh-led{position:absolute;left:50%;top:50%;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:#78716c;border:3px solid #fff7ed}
#dino-lector-hud.on .dlh-led{background:var(--dlh-color);box-shadow:0 0 20px 8px var(--dlh-color)}
.dlh-pantalla{width:178px;background:#fefce8;border:3px solid #7c2d12;border-radius:16px;padding:6px 10px 7px;color:#3f6212;box-shadow:inset 0 2px 6px rgba(0,0,0,.18)}
.dlh-titulo{display:flex;justify-content:space-between;font-weight:700;font-size:.7rem;letter-spacing:.1em;color:#9a3412}
.dlh-senal{display:flex;gap:3px;align-items:flex-end;height:15px;margin:3px 0}
.dlh-senal i{width:8px;border-radius:2px;background:#d6d3d1}
.dlh-senal i:nth-child(1){height:5px}.dlh-senal i:nth-child(2){height:8px}.dlh-senal i:nth-child(3){height:11px}.dlh-senal i:nth-child(4){height:15px}
.dlh-senal i.on{background:var(--dlh-color)}
.dlh-texto{font-weight:600;font-size:.86rem;line-height:1.15;min-height:2.3em}
.dlh-cuenta{font-size:.74rem;color:#78716c;margin-top:2px}
.dlh-sonido{position:absolute;top:-12px;right:-10px;width:32px;height:32px;border-radius:50%;border:3px solid #7c2d12;background:#fde68a;cursor:pointer;font-size:.85rem;padding:0}
.dlh-abrir{font-size:.76rem;font-weight:600;color:#fff;background:rgba(124,45,18,.88);padding:3px 11px;border-radius:10px;text-decoration:none}
#dino-lector-hud.aqui .dlh-cuerpo{animation:dlhSalto .45s ease-in-out infinite alternate}
@keyframes dlhSalto{to{transform:translateY(-5px) rotate(-1.5deg)}}
#carta-encontrada{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:40;pointer-events:none;font-family:'Fredoka',system-ui,sans-serif}
.ce-tarjeta{pointer-events:auto;width:310px;padding:14px 16px 16px;border-radius:28px;background:linear-gradient(180deg,rgba(255,251,235,0) 0,rgba(255,251,235,.15) 45%,#fffbeb 74%),var(--ce-fondo,linear-gradient(175deg,#fffbeb,#fde68a)) center top/cover no-repeat;border:4px solid var(--ce-color);box-shadow:0 10px 0 rgba(0,0,0,.2),0 26px 50px rgba(0,0,0,.45);text-align:center;color:#44403c;animation:ceEntra .55s cubic-bezier(.2,1.6,.4,1)}
@keyframes ceEntra{from{transform:scale(.3) rotate(-12deg);opacity:0}}
.ce-etiqueta{display:inline-block;padding:3px 12px;border-radius:999px;background:var(--ce-color);color:#fff;font-weight:700;font-size:.8rem}
.ce-img{display:block;width:190px;height:265px;margin:8px auto 6px;object-fit:contain;border-radius:12px;border:3px solid #7c2d12;background:#fff;filter:drop-shadow(0 8px 6px rgba(0,0,0,.25));animation:ceFlota 1.8s ease-in-out infinite alternate}
@keyframes ceFlota{to{transform:translateY(-7px)}}
.ce-nombre{font-size:1.5rem;font-weight:700;line-height:1.1}
.ce-sub{font-size:.9rem;color:#78716c;margin-top:2px}
.ce-botones{display:flex;gap:8px;justify-content:center;margin-top:12px}
.ce-botones a,.ce-botones button{font-family:inherit;font-weight:600;border-radius:12px;border:3px solid #7c2d12;padding:5px 12px;cursor:pointer;background:#fb923c;color:#fff;text-decoration:none;font-size:.85rem}
.ce-botones button{background:#fef3c7;color:#7c2d12}`;
    document.head.appendChild(css);
    const el = document.createElement('div');
    el.id = 'dino-lector-hud';
    el.innerHTML = `
      <div class="dlh-cuerpo">
        <div class="dlh-radar"><div class="dlh-barrido"></div><div class="dlh-led"></div></div>
        <div class="dlh-pantalla">
          <div class="dlh-titulo"><span>DINO LECTOR</span><span class="dlh-nivel"></span></div>
          <div class="dlh-senal"><i></i><i></i><i></i><i></i></div>
          <div class="dlh-texto">Buscando señales…</div>
          <div class="dlh-cuenta"></div>
        </div>
        <button class="dlh-sonido" title="Sonido del lector">🔊</button>
      </div>
      <a class="dlh-abrir" href="/dino_lector/" title="Ver tu colección en el Dino Lector">Abrir Dino Lector</a>`;
    (document.getElementById('canvas-container') || document.body).appendChild(el);
    el.querySelector('.dlh-abrir').onclick = (e) => { if (window.abrirDinoLector) { e.preventDefault(); window.abrirDinoLector(); } };
    // Con el Dino Lector abierto el personaje se queda quieto (teclas sueltas)
    window.addEventListener('dino-lector-abierto', () => { Object.keys(this.keys).forEach((k) => { this.keys[k] = false; }); });
    const bs = el.querySelector('.dlh-sonido');
    bs.onclick = () => { this.sonidoLector = this.sonidoLector === false; bs.textContent = this.sonidoLector === false ? '🔇' : '🔊'; bs.blur(); };
  },

  mostrarLector(ver) {
    const el = document.getElementById('dino-lector-hud');
    if (el) el.classList.toggle('visible', !!ver);
    if (!ver) { const p = document.getElementById('carta-encontrada'); if (p) p.remove(); }
  },

  pitido(freq, dur = 0.07, vol = 0.07) {
    if (this.sonidoLector === false) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!this._audio && AC) this._audio = new AC();
      const a = this._audio;
      if (!a) return;
      if (a.state === 'suspended') a.resume();
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
    } catch (e) {}
  },

  actualizarLector(dt) {
    const hud = document.getElementById('dino-lector-hud');
    if (!hud || !this.cartas || !window.CartasIsla) return;
    const C = window.CartasIsla, p = this.progreso();
    let mejor = null, dMejor = Infinity, sellada = null, dSellada = Infinity;
    for (const c of this.cartas) {
      if (p.encontradas.includes(c.id)) continue;
      const d = Math.hypot(c.x - this.pos.x, c.z - this.pos.z);
      if (!this.desbloqueadas.has(c.id)) { if (d < dSellada) { dSellada = d; sellada = c; } continue; }
      if (d < dMejor) { dMejor = d; mejor = c; }
    }
    this.cartaCerca = mejor && dMejor < 1.1 ? mejor : null;
    let encendido = false, nivel = 0, texto, color = '#facc15', etiqueta = '';
    if (sellada && dSellada < 1.6 && dSellada < dMejor) {
      color = '#a855f7';
      texto = `🔒 Algo poderoso resuena bajo tierra… ${C.textoRequisito(sellada.id, p)}`;
      this._fase = 0;
    } else if (mejor && dMejor < this.RADIO_LECTOR) {
      const t = 1 - dMejor / this.RADIO_LECTOR, periodo = 1.4 - 1.25 * t;
      nivel = Math.min(4, 1 + Math.floor(t * 4));
      this._fase = (this._fase || 0) + dt;
      if (this._fase >= periodo) { this._fase = 0; this.pitido(this.cartaCerca ? 1500 : 500 + 900 * t); }
      encendido = this.cartaCerca ? true : this._fase < periodo * 0.38;
      color = this.COLOR_ELEMENTO[mejor.elemento] || color;
      const nv = C.NIVELES[C.nivel(mejor.id)];
      etiqueta = nv ? nv.icono : '';
      texto = this.cartaCerca ? '¡Está aquí! Pulsa [R] para excavar' : t > 0.65 ? 'Señal muy fuerte' : t > 0.3 ? 'Señal cerca' : 'Señal débil';
    } else if (sellada && dSellada < 2.2) {
      color = '#a855f7';
      texto = `🔒 Algo poderoso resuena bajo tierra… ${C.textoRequisito(sellada.id, p)}`;
      this._fase = 0;
    } else {
      texto = 'Sin señales cerca';
      this._fase = 0;
    }
    const cuenta = `🎴 ${p.encontradas.length} / ${this.cartas.length} · 🏅 ${p.guardianes.length} / ${Object.keys(C.GUARDIANES).length}`;
    // Solo se toca el DOM cuando algo cambia
    const clave = [encendido, nivel, texto, color, etiqueta, cuenta, !!this.cartaCerca].join('|');
    if (clave === this._lectorClave) return;
    this._lectorClave = clave;
    hud.style.setProperty('--dlh-color', color);
    hud.classList.toggle('on', encendido);
    hud.classList.toggle('aqui', !!this.cartaCerca);
    hud.querySelectorAll('.dlh-senal i').forEach((b, i) => b.classList.toggle('on', i < nivel));
    hud.querySelector('.dlh-texto').textContent = texto;
    hud.querySelector('.dlh-nivel').textContent = etiqueta;
    hud.querySelector('.dlh-cuenta').textContent = cuenta;
  },

  excavar() {
    const c = this.cartaCerca;
    if (!c || !window.CartasIsla) return;
    this._prog = window.CartasIsla.marcarEncontrada(c.id);
    this.cartaCerca = null;
    this._lectorClave = null;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.pitido(f, 0.16, 0.08), i * 110));
    this.efectoCarta3D(c);
    this.mostrarCartaEncontrada(c);
    this.revisarDesbloqueos();
  },

  // La carta sale del suelo girando y brillando
  efectoCarta3D(c) {
    const d = (this.infoDinos || {})[c.id] || {};
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true });
    if (d.card) new THREE.TextureLoader().load('/assets/dinos/' + d.card, (t) => { mat.map = t; mat.needsUpdate = true; });
    const carta = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.6), mat);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.55, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(this.COLOR_ELEMENTO[c.elemento] || '#facc15'), transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.add(carta, halo);
    g.position.set(c.x, (c.y || 0) + 0.05, c.z);
    scene.add(g);
    (this._efectos = this._efectos || []).push({ g, carta, halo, t: 0 });
  },

  animarEfectosCarta(dt) {
    if (!this._efectos || !this._efectos.length) return;
    this._efectos = this._efectos.filter((e) => {
      e.t += dt;
      const k = Math.min(1, e.t / 1.6);
      e.carta.position.y = 0.3 + 1.1 * (1 - Math.pow(1 - k, 3));
      e.carta.rotation.y = e.t * 7;
      e.halo.scale.setScalar(1 + e.t * 2.2);
      e.halo.material.opacity = Math.max(0, 0.8 - e.t * 0.5);
      if (e.t > 1.6) e.carta.material.opacity = Math.max(0, 1 - (e.t - 1.6) * 2.5);
      if (e.t > 2.1) { scene.remove(e.g); return false; }
      return true;
    });
  },

  mostrarCartaEncontrada(c) {
    const prev = document.getElementById('carta-encontrada');
    if (prev) prev.remove();
    const C = window.CartasIsla, d = (this.infoDinos || {})[c.id] || { name: c.id, element: c.elemento };
    const nv = C.NIVELES[C.nivel(c.id)] || C.NIVELES.comun, p = this.progreso();
    const el = document.createElement('div');
    el.id = 'carta-encontrada';
    el.style.setProperty('--ce-color', this.COLOR_ELEMENTO[d.element] || '#fb923c');
    el.style.setProperty('--ce-fondo', `url('/assets/dinos/fondos/fondo_${d.element || 'normal'}.jpg')`);
    // Lo que se encuentra es la carta real (assets/dinos/cards); el dino grande queda para el álbum del Dino Lector
    const carta = d.card ? '/assets/dinos/' + d.card : '', arte = d.art && d.art.right ? '/assets/dinos/' + d.art.right : '';
    el.innerHTML = `
      <div class="ce-tarjeta">
        <span class="ce-etiqueta">¡Carta encontrada! · ${nv.icono} ${nv.nombre}</span>
        <img class="ce-img" src="${carta}" alt="Carta de ${d.name}" onerror="this.onerror=null;this.src='${arte}'">
        <div class="ce-nombre">${d.name}</div>
        <div class="ce-sub">${this.ICONO_ELEMENTO[d.element] || ''} ${(d.element || '').replace(/^./, (m) => m.toUpperCase())} · Colección ${p.encontradas.length} / ${this.cartas.length}</div>
        <div class="ce-botones">
          <a href="/dino_lector/?dino=${encodeURIComponent(c.id)}" class="ce-ver">Ver en el Dino Lector</a>
          <button type="button">Seguir explorando</button>
        </div>
      </div>`;
    (document.getElementById('canvas-container') || document.body).appendChild(el);
    const cerrar = () => { if (el.parentNode) el.remove(); };
    el.querySelector('button').onclick = cerrar;
    el.querySelector('.ce-ver').onclick = (e) => { if (window.abrirDinoLector) { e.preventDefault(); cerrar(); window.abrirDinoLector(c.id); } };
    setTimeout(cerrar, 7000);
  },

  // ================= COMPAÑERO: el dino invocado desde el Dino Lector te sigue por la isla =================
  // Mientras te acompaña se cuentan los metros que caminan juntos; las misiones de vínculo de distancia se cumplen solas
  // (ver CartasIsla.sumarMetros). Las demás misiones (jugar, alimentar, misiones con personajes) se programarán después.
  ponerCompanero(id) {
    if (this.companero) {
      scene.remove(this.companero.g);
      if (this.companero.mixer) this.companero.mixer.stopAllAction();
      this.companero = null;
    }
    this.companeroId = id || null;
    const B = window.BibliotecaMallas && window.BibliotecaMallas.mallas;
    const def = id && B && B['mini_' + id];
    if (!def || !this.avatar) return;
    const multAntes = state.subdivisionMultiplier;
    state.subdivisionMultiplier = (multAntes || 1) * 0.7;
    let g;
    try { g = def.construir(window.MallasComun); } finally { state.subdivisionMultiplier = multAntes; }
    g.scale.setScalar(0.8);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.name !== 'wireOverlay') applyRenderStyleToMesh(o); } });
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const pos = new THREE.Vector3(this.pos.x + fx * 2.2 + fz * 0.8, this.pos.y, this.pos.z + fz * 2.2 - fx * 0.8);
    g.position.copy(pos);
    scene.add(g);
    const c = { g, pos, rumbo: this.heading, mixer: null, acciones: {}, actual: null, ultimo: this.pos.clone(), pendientes: 0 };
    if (g.animations && g.animations.length) {
      c.mixer = new THREE.AnimationMixer(g);
      g.animations.forEach((clip) => { c.acciones[clip.name] = c.mixer.clipAction(clip); });
    }
    this.companero = c;
    const nombre = ((this.infoDinos || {})[id] || {}).name || id;
    showToast(`🐾 ${nombre} te acompaña por la isla`);
    if (c.acciones.Rugir) { c.acciones.Rugir.setLoop(THREE.LoopOnce); c.acciones.Rugir.clampWhenFinished = false; c.acciones.Rugir.reset().play(); c.actual = c.acciones.Rugir; }
  },

  // [G] Jugar con el compañero: se gira hacia ti, ruge contento y salen corazones. Cuenta caricias para su misión.
  jugarConCompanero() {
    const c = this.companero, C = window.CartasIsla;
    const nombre = ((this.infoDinos || {})[this.companeroId] || {}).name || 'tu dino';
    if (!c || !C) { showToast('🦖 Invoca un dino desde el Dino Lector para jugar con él'); return; }
    const d = Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
    if (d > 3) { showToast(`🐾 Acércate a ${nombre} para jugar con él`); return; }
    c.rumbo = Math.atan2(this.pos.x - c.pos.x, this.pos.z - c.pos.z);
    c.quieto = 1.6; // se queda mirándote un momento
    const rugir = c.acciones.Rugir;
    if (rugir) { if (c.actual && c.actual !== rugir) c.actual.fadeOut(0.15); rugir.setLoop(THREE.LoopOnce); rugir.reset().fadeIn(0.15).play(); c.actual = rugir; }
    this.corazones(c);
    const r = C.sumarCaricia(this.companeroId);
    this._prog = r.p;
    showToast(r.nuevo ? `✅ ¡Vínculo creado con ${nombre}! Ya puede usarse en combate.` : `❤️ ¡${nombre} está feliz! (${r.p.caricias[this.companeroId]} caricias)`);
  },

  corazones(c) {
    if (!this._texCorazon) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const x = cv.getContext('2d');
      x.font = '52px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('❤️', 32, 36);
      this._texCorazon = new THREE.CanvasTexture(cv);
    }
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._texCorazon, transparent: true, depthWrite: false }));
      sp.scale.setScalar(0.22);
      sp.position.set(c.pos.x + (Math.random() - 0.5) * 0.6, c.pos.y + 1.0, c.pos.z + (Math.random() - 0.5) * 0.6);
      scene.add(sp);
      (this._corazones = this._corazones || []).push({ sp, t: -i * 0.15, x0: sp.position.x });
    }
  },

  animarCorazones(dt) {
    if (!this._corazones || !this._corazones.length) return;
    this._corazones = this._corazones.filter((h) => {
      h.t += dt;
      if (h.t < 0) { h.sp.visible = false; return true; }
      h.sp.visible = true;
      h.sp.position.y += dt * 0.9;
      h.sp.position.x = h.x0 + Math.sin(h.t * 6) * 0.08;
      h.sp.material.opacity = Math.max(0, 1 - h.t / 1.3);
      if (h.t > 1.3) { scene.remove(h.sp); h.sp.material.dispose(); return false; }
      return true;
    });
  },

  animarCompanero(c, nombre, ritmo) {
    const a = c.acciones[nombre];
    if (!a) return;
    a.timeScale = ritmo;
    if (c.actual === a) return;
    if (c.actual && c.actual.isRunning() && c.actual.getClip().name === 'Rugir' && c.actual.time < c.actual.getClip().duration * 0.9) return;
    if (c.actual) c.actual.fadeOut(0.25);
    a.reset().fadeIn(0.25).play();
    c.actual = a;
  },

  actualizarCompanero(dt) {
    const C = window.CartasIsla;
    if (!C || !this.avatar) return;
    const p = this.progreso();
    const id = p.invocado && p.encontradas.includes(p.invocado) ? p.invocado : null;
    if (id !== this.companeroId && window.BibliotecaMallas && window.BibliotecaMallas.mallas) this.ponerCompanero(id);
    const c = this.companero;
    if (!c) return;
    // Lugar al que va: a tu lado y un poco por delante, donde la cámara (que va detrás de ti) lo ve
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const tx = this.pos.x + fx * 2.2 + fz * 0.8, tz = this.pos.z + fz * 2.2 - fx * 0.8;
    let dx = tx - c.pos.x, dz = tz - c.pos.z, d = Math.hypot(dx, dz);
    if (d > 12) { c.pos.set(tx, this.pos.y, tz); dx = dz = d = 0; } // se quedó muy atrás: te alcanza
    this.animarCorazones(dt);
    if (c.quieto > 0) { c.quieto -= dt; dx = dz = d = 0; } // jugando: se queda mirándote
    const vel = d > 0.3 ? Math.min(d * 2.0, 4.2) : 0;
    let objetivo = c.quieto > 0 ? c.rumbo : this.heading;
    if (vel > 0) {
      c.pos.x += (dx / d) * vel * dt;
      c.pos.z += (dz / d) * vel * dt;
      objetivo = Math.atan2(dx, dz);
    }
    let dr = objetivo - c.rumbo;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    c.rumbo += dr * (1 - Math.exp(-dt * 6));
    const suelo = this.getGroundHeight(c.pos.x, c.pos.z);
    c.pos.y += (suelo.height - c.pos.y) * (1 - Math.exp(-dt * 12));
    c.g.position.copy(c.pos);
    c.g.rotation.y = c.rumbo;
    if (c.mixer) {
      if (vel > 0.25) this.animarCompanero(c, 'Caminar', Math.max(0.6, Math.min(2.5, vel / 1.1)));
      else this.animarCompanero(c, 'Reposo', 1);
      c.mixer.update(dt);
    }
    // Metros caminados juntos (se guardan cada 5 m)
    const paso = Math.hypot(this.pos.x - c.ultimo.x, this.pos.z - c.ultimo.z);
    c.ultimo.copy(this.pos);
    if (paso > 0 && paso < 2) c.pendientes += paso;
    if (c.pendientes >= 5) {
      const r = C.sumarMetros(id, c.pendientes);
      c.pendientes = 0;
      this._prog = r.p;
      if (r.nuevo) showToast(`✅ ¡Vínculo creado con ${((this.infoDinos || {})[id] || {}).name || id}! Ya puede usarse en combate.`);
    }
  },

  toggleColisiones() {
    if (this.grupoColisiones) {
      scene.remove(this.grupoColisiones);
      this.grupoColisiones = null;
      showToast('Colisiones ocultas');
      return;
    }
    const g = new THREE.Group();
    g.name = 'DepuracionColisiones';
    const mat = new THREE.LineBasicMaterial({ color: 0xff3b6b, depthTest: false, transparent: true, opacity: 0.9 });
    const y0 = (x, z) => this.getGroundHeight(x, z).height;
    this.colliders.forEach((c) => {
      const h = Math.min(c.height || 1.5, 3), base = y0(c.x, c.z) + 0.03;
      let pts = [];
      if (c.type === 'cylinder') {
        for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2; pts.push(new THREE.Vector3(c.x + Math.cos(a) * c.radius, base, c.z + Math.sin(a) * c.radius)); }
      } else {
        const hx = c.type === 'obb' ? c.hx : c.w / 2, hz = c.type === 'obb' ? c.hz : c.d / 2, an = c.type === 'obb' ? c.ang : 0;
        const co = Math.cos(an), si = Math.sin(an);
        pts = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz], [-hx, -hz]].map(([lx, lz]) => new THREE.Vector3(c.x + lx * co + lz * si, base, c.z - lx * si + lz * co));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const l1 = new THREE.Line(geo, mat); g.add(l1);
      const l2 = new THREE.Line(geo, mat); l2.position.y = h; g.add(l2);
      l1.renderOrder = l2.renderOrder = 999;
    });
    // Puentes en verde (superficie caminable sobre el agua)
    const matP = new THREE.LineBasicMaterial({ color: 0x22ee88, depthTest: false });
    this.bridges.forEach((b) => {
      const co = Math.cos(b.ang || 0), si = Math.sin(b.ang || 0);
      const pts = [[-b.hx, -b.hz], [b.hx, -b.hz], [b.hx, b.hz], [-b.hx, b.hz], [-b.hx, -b.hz]].map(([lx, lz]) => new THREE.Vector3(b.x + lx * co + lz * si, b.deckY + 0.04, b.z - lx * si + lz * co));
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matP); l.renderOrder = 999; g.add(l);
    });
    scene.add(g);
    this.grupoColisiones = g;
    showToast(`🟥 ${this.colliders.length} obstáculos visibles (tecla C para ocultar)`);
  },

  mostrarPanelEntrada(ver) {
    let el = document.getElementById('panel-entrar-mundo');
    if (!el) {
      el = document.createElement('div');
      el.id = 'panel-entrar-mundo';
      el.style.cssText = 'position:absolute;top:150px;left:16px;width:270px;background:rgba(15,23,42,0.95);border:1px solid #10b981;border-radius:12px;padding:12px;z-index:31;color:#fff;font-size:0.8rem;display:flex;flex-direction:column;gap:8px;box-shadow:0 10px 30px rgba(0,0,0,0.6);';
      const opciones = this.personajesDisponibles().map((p) => `<option value="${p.id}">${p.nombre}</option>`).join('');
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;"><b style="color:#34d399;font-size:0.9rem;">🌍 Entrar al mundo</b>
          <button class="action-btn" style="padding:2px 8px;font-size:0.72rem;" id="pem-cerrar">Ocultar [P]</button></div>
        <label style="display:flex;flex-direction:column;gap:4px;">🧍 Personaje
          <select id="pem-personaje" style="background:#0f172a;color:#fff;border:1px solid #334155;border-radius:6px;padding:4px;">${opciones}</select></label>
        <div style="display:flex;flex-direction:column;gap:4px;">📍 Aparecer en
          ${this.ENTRADAS.map((E, i) => `<button class="action-btn pem-ent" data-i="${i}" style="text-align:left;padding:4px 8px;font-size:0.76rem;">[${i + 1}] ${E.nombre}</button>`).join('')}</div>
        <div style="color:#94a3b8;line-height:1.45;font-size:0.72rem;">
          <b>W / S</b> avanzar / retroceder · <b>A / D</b> girar · <b>Shift</b> correr · <b>Espacio</b> saltar<br>
          La cámara va detrás de ti mirando al frente, hacia donde mira el personaje · <b>Q / E</b> vistazo a los lados<br>
          <b>R</b> excavar carta · <b>G</b> jugar con tu dino · <b>C</b> ver colisiones · <b>F</b> celebrar · <b>1-6</b> ir a un lugar · <b>Esc</b> salir</div>`;
      (document.getElementById('canvas-container') || document.body).appendChild(el);
      el.querySelector('#pem-cerrar').onclick = () => this.mostrarPanelEntrada(false);
      const sel = el.querySelector('#pem-personaje');
      sel.onchange = () => { this.ponerPersonaje(sel.value); sel.blur(); };
      el.querySelectorAll('.pem-ent').forEach((b) => { b.onclick = () => { this.teletransportar(Number(b.dataset.i)); b.blur(); }; });
    }
    const sel = el.querySelector('#pem-personaje');
    if (sel && this.personajeId) sel.value = this.personajeId;
    el.style.display = ver ? 'flex' : 'none';
    this.panelVisible = ver;
  },

  // ¿El avatar (radio 0.38) solaparía algún obstáculo en (x, z)?
  choca(x, z) {
    const R = 0.38 * (this.modelo ? this.ESCALA_JUGADOR : 1);
    for (const c of this.colliders) {
      const dx = x - c.x, dz = z - c.z;
      if (c.type === 'cylinder') { if (dx * dx + dz * dz < (R + c.radius) * (R + c.radius)) return true; }
      else if (c.type === 'obb') {
        const co = Math.cos(c.ang), si = Math.sin(c.ang);
        if (Math.abs(dx * co - dz * si) < c.hx + R && Math.abs(dx * si + dz * co) < c.hz + R) return true;
      } else if (c.type === 'box') { if (Math.abs(dx) < c.w / 2 + R && Math.abs(dz) < c.d / 2 + R) return true; }
    }
    return false;
  },

  // Cámara FIJA (elegida por el usuario el 2026-11-06): la rueda ya no la mueve, solo se evita que la página se desplace
  alRueda(e) {
    if (!this.active) return;
    e.preventDefault();
  },

  // Distancia fija de la cámara: equivale a alejar 6 pasos de rueda desde la vista "sobre la cabeza" (1,12^6 ≈ 1,97).
  // Queda detrás y por encima del personaje, mirando al frente, con la parte de arriba de su cabeza asomando abajo.
  CAM_ZOOM_FIJO: 1.97,

  // Cámara de juego: detrás y por encima del personaje, mirando AL FRENTE (hacia donde mira el personaje), algo
  // inclinada hacia abajo. La posición sale de camZoom (1 = sobre la cabeza … 5 = vista amplia), hoy fijo en CAM_ZOOM_FIJO.
  camaraDeseada() {
    const alto = this.altoModelo || 1.4, cabeza = alto * 0.38;
    const t = Math.max(0, Math.min(1, (this.CAM_ZOOM_FIJO - 1) / 4));
    const atras = cabeza + t * 4.5, sobreCabeza = cabeza * 2 + t * 1.2, inclina = 0.17 + t * 0.28;
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    const baseY = this.camBaseY != null ? this.camBaseY : this.pos.y;
    const pos = new THREE.Vector3(this.pos.x + sy * atras, baseY + alto + sobreCabeza, this.pos.z + cy * atras);
    const L = 10, h = Math.cos(inclina) * L;
    const mira = new THREE.Vector3(pos.x - sy * h, pos.y - Math.sin(inclina) * L, pos.z - cy * h);
    return { pos, mira };
  },

  tryJump() {
    if (this.isGrounded || this.isOnBridge) {
      this.vel.y = 7.0;
      this.isGrounded = false;
      this.isOnBridge = false;
    } else if (this.isSwimming) {
      this.vel.y = 4.2; // Impulso dentro del agua
    }
  },

  createAvatar() {
    if (this.avatar) {
      if (!scene.children.includes(this.avatar)) scene.add(this.avatar);
      return;
    }

    const group = new THREE.Group();
    group.name = 'AvatarExploradorDino';

    // Sombra proyectada en el suelo
    const shadowGeo = new THREE.CircleGeometry(0.38, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x0a101d, transparent: true, opacity: 0.42 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.02;
    group.add(shadow);
    this.shadowMesh = shadow;

    // Rig visual del personaje
    const rig = new THREE.Group();
    group.add(rig);

    // 1. Torso con chaqueta roja de aventurero
    const torsoGeo = new THREE.BoxGeometry(0.42, 0.48, 0.32, 2, 2, 2);
    torsoGeo.translate(0, 0.48, 0);
    const torsoMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    rig.add(torso);

    // 2. Cabeza
    const headGeo = new THREE.BoxGeometry(0.34, 0.32, 0.32);
    headGeo.translate(0, 0.88, 0.02);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xfbd0a6 });
    const head = new THREE.Mesh(headGeo, headMat);
    rig.add(head);

    // 3. Gorra con visera frontal
    const capGeo = new THREE.BoxGeometry(0.36, 0.14, 0.34);
    capGeo.translate(0, 1.05, 0.01);
    const capMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const cap = new THREE.Mesh(capGeo, capMat);
    rig.add(cap);

    const visorGeo = new THREE.BoxGeometry(0.32, 0.04, 0.16);
    visorGeo.translate(0, 1.01, -0.22);
    const visorMat = new THREE.MeshLambertMaterial({ color: 0xd92626 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    rig.add(visor);

    // 4. Ojos
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.09, 0.88, -0.15);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.09, 0.88, -0.15);
    rig.add(leftEye);
    rig.add(rightEye);

    // 5. Mochila exploradora
    const packGeo = new THREE.BoxGeometry(0.32, 0.34, 0.16);
    packGeo.translate(0, 0.52, 0.22);
    const packMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const pack = new THREE.Mesh(packGeo, packMat);
    rig.add(pack);

    // 6. Piernas
    const legGeo = new THREE.BoxGeometry(0.14, 0.28, 0.14);
    legGeo.translate(0, -0.14, 0);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.11, 0.26, 0);
    rig.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.11, 0.26, 0);
    rig.add(rightLeg);

    // 7. Brazos
    const armGeo = new THREE.BoxGeometry(0.10, 0.32, 0.10);
    armGeo.translate(0, -0.16, 0);
    const armMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.26, 0.62, 0);
    rig.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.26, 0.62, 0);
    rig.add(rightArm);

    this.bodyParts = { rig, leftLeg, rightLeg, leftArm, rightArm, head };
    this.avatar = group;
    scene.add(group);
  },

  // Colisión de una malla del catálogo: caja orientada (respeta giro y escala del objeto en el editor).
  // Casas: solo las paredes (se puede llegar a la puerta). Postes/faroles: cilindro fino. Vallas en L: dos cajas.
  colliderDeMalla(group, id, cat) {
    const POSTE = ['farol_poste_madera', 'farola_forja', 'farola_electrica', 'torre_tesla', 'estandarte_forja', 'sombrilla_playa'];
    const ang = group.rotation.y, sc = group.scale, P0 = group.position.clone();
    const aMundo = (lx, lz) => ({ x: P0.x + lx * Math.cos(ang) + lz * Math.sin(ang), z: P0.z - lx * Math.sin(ang) + lz * Math.cos(ang) });
    const label = group.userData.label;
    if (POSTE.includes(id)) return [{ type: 'cylinder', x: P0.x, z: P0.z, radius: (id === 'torre_tesla' ? 0.6 : 0.26) * sc.x, height: 3, label }];
    if (id === 'valla_madera_esquina') {
      const a = aMundo(0.9 * sc.x, 0), b = aMundo(0, 0.9 * sc.z);
      return [{ type: 'obb', x: a.x, z: a.z, hx: 0.95 * sc.x, hz: 0.12, ang, height: 1.2, label },
              { type: 'obb', x: b.x, z: b.z, hx: 0.12, hz: 0.95 * sc.z, ang, height: 1.2, label }];
    }
    const rot = group.rotation.clone();
    group.rotation.set(0, 0, 0); group.position.set(0, 0, 0); group.updateMatrixWorld(true);
    const box = new THREE.Box3();
    if (cat === 'casas') group.traverse((o) => { if (o.isMesh && o.name === 'Paredes') box.expandByObject(o); });
    if (box.isEmpty()) box.setFromObject(group);
    group.rotation.copy(rot); group.position.copy(P0); group.updateMatrixWorld(true);
    if (box.isEmpty()) return [];
    const extra = [];
    group.traverse((o) => {
      if (o.isMesh && o.name === 'TroncoArbol') {
        const cA = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
        extra.push({ type: 'cylinder', x: cA.x, z: cA.z, radius: 0.6 * sc.x, height: 2, label: 'Árbol de ' + label });
      }
    });
    const c = box.getCenter(new THREE.Vector3()), t = box.getSize(new THREE.Vector3());
    const k = cat === 'casas' ? 0.98 : 0.85, w = aMundo(c.x, c.z);
    return [{ type: 'obb', x: w.x, z: w.z, hx: (t.x / 2) * k, hz: (t.z / 2) * k, ang, height: t.y, label }, ...extra];
  },

  scanSceneColliders() {
    this.pararNPCs(); // se vuelven a animar en el siguiente fotograma con los objetos actuales
    this.colliders = [];
    this.waterZones = [];
    this.bridges = [];
    this.terrainMeshes = [];
    this.pisoMeshes = [];
    this.limites = null;

    // Piezas sólidas que forman parte de una malla de terreno (sin objeto propio): llevan colisión con su tamaño real
    const SOLIDOS_TERRENO = { BrocalPozoAldea: 'Pozo de la plaza' };
    const procesar = (group) => {
      const type = group.userData.type || '';
      const mod = group.userData.moduleType || '';
      const label = (group.userData.label || '').toLowerCase();
      const p = group.userData.params || {};

      const pos = new THREE.Vector3();
      group.getWorldPosition(pos);

      // Terreno: mallas para el raycast de suelo y límites reales de la isla
      group.traverse((c) => {
        if (c.isMesh && (c.name.startsWith('Malla_') || c.name.startsWith('Faldon') || c.name === 'MallaUnidaMundo' || (c.userData && c.userData.type === 'terrain'))) this.terrainMeshes.push(c);
        if (c.isMesh && SOLIDOS_TERRENO[c.name]) {
          const bS = new THREE.Box3().setFromObject(c), cS = bS.getCenter(new THREE.Vector3()), tS = bS.getSize(new THREE.Vector3());
          this.colliders.push({ type: 'cylinder', x: cS.x, z: cS.z, radius: Math.max(tS.x, tS.z) / 2, height: tS.y, label: SOLIDOS_TERRENO[c.name], sinRecorte: true });
        }
      });
      if (group.userData.category === 'terrain' && mod !== 'ocean_island') {
        const bb = new THREE.Box3().setFromObject(group);
        if (!bb.isEmpty()) this.limites = this.limites ? this.limites.union(bb) : bb;
      }

      if (mod === 'malla' && group.userData.category === 'personajes') {
        // Personajes de la isla: cilindro del ancho de su cabeza chibi (no se atraviesan)
        this.colliders.push({ type: 'cylinder', x: pos.x, z: pos.z, radius: 0.34 * (group.scale.x || 1), height: 1.3 * (group.scale.y || 1), label: group.userData.label || 'Personaje', sinRecorte: true });
        return;
      }
      if (mod === 'malla' && ['casas', 'decoraciones', 'piedras'].includes(group.userData.category)) {
        this.colliders.push(...this.colliderDeMalla(group, p.id || '', group.userData.category));
        // Zócalo, escalones y caminos de las casas: son suelo pisable (antes el personaje se hundía en ellos)
        if (group.userData.category === 'casas') {
          const PISO = ['Zocalo', 'Escalon', 'PiedraCamino', 'Tabla', 'Huella', 'Dedo'];
          group.traverse((c) => { if (c.isMesh && PISO.includes(c.name)) this.pisoMeshes.push(c); });
        }
        return;
      }

      if (mod === 'pine' || type === 'tree' || group.userData.category === 'arboles' || label.includes('pino') || label.includes('árbol') || label.includes('roble') || label.includes('abedul')) {
        // Radio según el ancho real del árbol (cerca del 45 % del radio de la copa) para que no se atraviese
        const bbA = new THREE.Box3().setFromObject(group), tA = bbA.getSize(new THREE.Vector3());
        const rA = Math.max(0.5, Math.min(1.4, 0.45 * Math.max(tA.x, tA.z) / 2));
        this.colliders.push({
          type: 'cylinder',
          x: pos.x,
          z: pos.z,
          radius: rA,
          height: 3.5,
          label: 'Árbol'
        });
      } else if (mod === 'boulder' || type === 'boulder' || label.includes('roca') || label.includes('peñasco') || label.includes('cúmulo')) {
        this.colliders.push({
          type: 'cylinder',
          x: pos.x,
          z: pos.z,
          radius: (p.radius || 0.72) * (group.scale.x || 1),
          height: 1.8,
          label: 'Roca'
        });
      } else if (mod === 'cave3d' || mod === 'cave_arch' || label.includes('cueva')) {
        // Cueva 3D: la bóveda hasta justo bajo el arco (caja) y los dos contrafuertes de roca (cilindros), con el giro y
        // la escala del objeto. Los escalones de la entrada (UmbralCueva_*) quedan libres y son suelo pisable: se suben
        // y el personaje llega hasta la boca de la cueva, bajo el arco.
        const scC = group.scale.x || 1, angC = group.rotation.y, coC = Math.cos(angC), siC = Math.sin(angC);
        const enMundo = (lx, lz) => ({ x: group.position.x + (lx * coC + lz * siC) * scC, z: group.position.z + (-lx * siC + lz * coC) * scC });
        const cB = enMundo(0, -0.9);
        this.colliders.push({ type: 'obb', x: cB.x, z: cB.z, hx: 3.4 * scC, hz: 2.1 * scC, ang: angC, height: 3.5 * scC, label: 'Cueva', sinRecorte: true });
        [[-1.85, 1.6, 1.1], [1.85, 1.6, 0.95]].forEach(([lx, lz, r]) => {
          const cC = enMundo(lx, lz);
          this.colliders.push({ type: 'cylinder', x: cC.x, z: cC.z, radius: r * scC, height: 1.8 * scC, label: 'Roca de la cueva', sinRecorte: true });
        });
        group.traverse((c) => { if (c.isMesh && /^UmbralCueva/.test(c.name)) this.pisoMeshes.push(c); });
      } else if (mod === 'bush' || label.includes('arbusto')) {
        this.colliders.push({
          type: 'cylinder',
          x: pos.x,
          z: pos.z,
          radius: 0.58,
          height: 1.2,
          label: 'Arbusto'
        });
      } else if (label.includes('tronco')) {
        this.colliders.push({
          type: 'cylinder',
          x: pos.x,
          z: pos.z,
          radius: 0.75,
          height: 0.8,
          label: 'Tronco'
        });
      } else if (label.includes('muelle') || mod === 'muelle_madera' || p.id === 'muelle_madera') {
        // Cubierta real del puente/muelle: caja de sus tablones con el giro, la escala y la altura del objeto
        const angB = group.rotation.y, rotB = group.rotation.clone(), P0 = group.position.clone();
        group.rotation.set(0, 0, 0); group.position.set(0, 0, 0); group.updateMatrixWorld(true);
        const bl = new THREE.Box3();
        group.traverse((o) => { if (o.isMesh && /^Tablon/.test(o.name)) bl.expandByObject(o); });
        if (bl.isEmpty()) bl.setFromObject(group);
        group.rotation.copy(rotB); group.position.copy(P0); group.updateMatrixWorld(true);
        const cB = bl.getCenter(new THREE.Vector3()), tB = bl.getSize(new THREE.Vector3());
        this.bridges.push({
          x: P0.x + cB.x * Math.cos(angB) + cB.z * Math.sin(angB),
          z: P0.z - cB.x * Math.sin(angB) + cB.z * Math.cos(angB),
          hx: tB.x / 2, hz: tB.z / 2, ang: angB,
          deckY: P0.y + bl.max.y,
          label: 'Puente de Madera'
        });
      } else if (mod === 'water_plane' || label.includes('agua') || label.includes('estanque')) {
        this.waterZones.push({
          x: pos.x,
          z: pos.z,
          width: p.width || 8.0,
          depth: p.depth || 5.0,
          waterY: pos.y || -0.42,
          label: group.userData.label || 'Estanque'
        });
      }
    };
    // Cada obstáculo recuerda su objeto para recortarlo luego a la parte que asoma sobre el suelo
    state.meshObjects.forEach((group) => {
      const n0 = this.colliders.length;
      procesar(group);
      for (let i = n0; i < this.colliders.length; i++) this.colliders[i]._grupo = group;
    });

    // Añadir las 3 zonas de estanques de Ruta 1 si estamos en modo mundo completo
    if (state.activeMode === 'full_world') {
      this.waterZones.push({ x: -4.0, z: -7.5, width: 8.0, depth: 5.0, waterY: -0.42, label: 'Estanque 1' });
      this.waterZones.push({ x: -7.5, z: 4.0, width: 7.0, depth: 6.0, waterY: -0.42, label: 'Estanque 2' });
      this.waterZones.push({ x: -1.5, z: 15.0, width: 11.0, depth: 6.0, waterY: -0.42, label: 'Estanque 3' });
    }
    this.indexarTerreno();
    this.recortarEnterrados();
    this._nEscaneados = state.meshObjects.length;
  },

  // Objetos medio enterrados o bajo tierra: la colisión se recorta a la parte que asoma más de 20 cm sobre el suelo
  // y, si no asoma nada, se quita (antes la parte enterrada frenaba al personaje sin que se viera nada).
  // Árboles y casas solo se quitan si están enterrados del todo (su colisión tiene a propósito otro tamaño).
  recortarEnterrados() {
    const UMBRAL = 0.2, MUESTRAS = 220, v = new THREE.Vector3(), cache = new Map();
    // Vértices muestreados (x, z) que asoman sobre el suelo; con primero=true basta con encontrar uno
    const muestrear = (g, primero) => {
      g.updateMatrixWorld(true);
      let total = 0;
      g.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position) total += o.geometry.attributes.position.count; });
      const pts = [];
      let listo = false;
      g.traverse((o) => {
        if (listo || !o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
        const pos = o.geometry.attributes.position;
        const n = Math.max(8, Math.round((MUESTRAS * pos.count) / Math.max(1, total)));
        for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / n))) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          const suelo = this.rayoTerreno(v.x, v.z);
          if (!suelo || v.y > suelo.h + UMBRAL) {
            pts.push(v.x, v.z);
            if (primero) { listo = true; break; }
          }
        }
      });
      return pts;
    };
    const puntosVisibles = (g) => {
      if (!cache.has(g)) cache.set(g, muestrear(g, false));
      return cache.get(g);
    };
    let quitados = 0, recortados = 0;
    this.colliders = this.colliders.filter((c) => {
      const g = c._grupo;
      if (!g || c.sinRecorte) return true;
      if (/^Árbol/.test(c.label || '') || g.userData.category === 'casas') {
        if (muestrear(g, true).length) return true;
        quitados++; // enterrado del todo
        return false;
      }
      const pts = puntosVisibles(g);
      if (!pts.length) { quitados++; return false; } // enterrado del todo
      if (c.type === 'cylinder') {
        let dMax = -1;
        for (let i = 0; i < pts.length; i += 2) {
          const d = Math.hypot(pts[i] - c.x, pts[i + 1] - c.z);
          if (d <= c.radius * 1.2 && d > dMax) dMax = d;
        }
        if (dMax < 0) { quitados++; return false; }
        const r = Math.max(0.15, Math.min(c.radius, dMax * 0.9));
        if (r < c.radius - 0.02) { c.radius = r; recortados++; }
        return true;
      }
      // Caja (orientada o no): parte visible en el marco de la caja, sin salirse de la caja original
      const obb = c.type === 'obb';
      const hx = obb ? c.hx : c.w / 2, hz = obb ? c.hz : c.d / 2, an = obb ? c.ang : 0;
      const co = Math.cos(an), si = Math.sin(an);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        const dx = pts[i] - c.x, dz = pts[i + 1] - c.z, lx = dx * co - dz * si, lz = dx * si + dz * co;
        if (Math.abs(lx) > hx * 1.2 || Math.abs(lz) > hz * 1.2) continue;
        x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); z0 = Math.min(z0, lz); z1 = Math.max(z1, lz);
      }
      if (x0 === Infinity) { quitados++; return false; }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const ax0 = Math.max(-hx, cx - ((x1 - x0) / 2) * 0.9), ax1 = Math.min(hx, cx + ((x1 - x0) / 2) * 0.9);
      const az0 = Math.max(-hz, cz - ((z1 - z0) / 2) * 0.9), az1 = Math.min(hz, cz + ((z1 - z0) / 2) * 0.9);
      if (ax1 <= ax0 || az1 <= az0) { quitados++; return false; }
      const nhx = Math.max(0.08, (ax1 - ax0) / 2), nhz = Math.max(0.08, (az1 - az0) / 2);
      if (nhx < hx - 0.02 || nhz < hz - 0.02) {
        const mx = (ax0 + ax1) / 2, mz = (az0 + az1) / 2;
        c.x += mx * co + mz * si;
        c.z += -mx * si + mz * co;
        if (obb) { c.hx = nhx; c.hz = nhz; } else { c.w = nhx * 2; c.d = nhz * 2; }
        recortados++;
      }
      return true;
    });
    this.recorte = { quitados, recortados };
  },

  // Personajes de la isla: mientras se juega respiran con su animación de reposo, cada uno con su propio ritmo
  animarNPCs(dt) {
    if (!this.npcs) {
      this.npcs = [];
      state.meshObjects.forEach((g) => {
        if (g.userData.category !== 'personajes') return;
        let raiz = null;
        g.traverse((o) => { if (!raiz && o.animations && o.animations.length) raiz = o; });
        const clip = raiz && raiz.animations.find((c) => c.name === 'Reposo');
        if (!clip) return;
        const mx = new THREE.AnimationMixer(raiz), a = mx.clipAction(clip);
        a.timeScale = 0.85 + Math.random() * 0.3;
        a.time = Math.random() * clip.duration;
        a.play();
        this.npcs.push(mx);
      });
    }
    for (const mx of this.npcs) mx.update(dt);
  },

  pararNPCs() {
    (this.npcs || []).forEach((mx) => { mx.stopAllAction(); mx.uncacheRoot(mx.getRoot()); });
    this.npcs = null;
  },

  // Índice espacial del terreno: los triángulos de cada malla repartidos en una rejilla XZ de 1 m (en coordenadas
  // de mundo). Con el Raycaster cada rayo recorría las ~175 000 caras del suelo (~10 ms en la Forja, y se lanzaban
  // 3 por fotograma: el paso iba a tirones). Ahora la altura sale de los pocos triángulos de una celda.
  indexarTerreno() {
    const C = 1, celdas = new Map(), mallas = [], v = new THREE.Vector3();
    const pisos = new Set(this.pisoMeshes || []);
    [...(this.terrainMeshes || []), ...pisos].forEach((m) => {
      const g = m.geometry;
      if (!g || !g.attributes || !g.attributes.position) return;
      m.updateMatrixWorld(true);
      const pos = g.attributes.position, n = pos.count, P = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        P[3 * i] = v.x; P[3 * i + 1] = v.y; P[3 * i + 2] = v.z;
      }
      const idx = g.index ? g.index.array : null, nt = Math.floor((idx ? idx.length : n) / 3), mi = mallas.length;
      mallas.push({ P, idx, mar: m.name === 'Malla_MarOceanoIsla', piso: pisos.has(m) });
      for (let t = 0; t < nt; t++) {
        const a = 3 * (idx ? idx[3 * t] : 3 * t), b = 3 * (idx ? idx[3 * t + 1] : 3 * t + 1), c = 3 * (idx ? idx[3 * t + 2] : 3 * t + 2);
        const i0 = Math.floor(Math.min(P[a], P[b], P[c]) / C), i1 = Math.floor(Math.max(P[a], P[b], P[c]) / C);
        const j0 = Math.floor(Math.min(P[a + 2], P[b + 2], P[c + 2]) / C), j1 = Math.floor(Math.max(P[a + 2], P[b + 2], P[c + 2]) / C);
        for (let i = i0; i <= i1; i++) {
          for (let j = j0; j <= j1; j++) {
            const k = i * 100003 + j;
            let L = celdas.get(k);
            if (!L) celdas.set(k, (L = []));
            L.push(mi, t);
          }
        }
      }
    });
    this.indiceSuelo = { C, celdas, mallas };
  },

  // Superficie de terreno más alta en (x, z), como un rayo vertical desde arriba: { h, mar } o null
  rayoTerreno(x, z) {
    const I = this.indiceSuelo;
    if (!I) return null;
    const L = I.celdas.get(Math.floor(x / I.C) * 100003 + Math.floor(z / I.C));
    if (!L) return null;
    let hMax = -Infinity, mar = false, piso = false;
    for (let q = 0; q < L.length; q += 2) {
      const M = I.mallas[L[q]], t = L[q + 1], P = M.P, idx = M.idx;
      const a = 3 * (idx ? idx[3 * t] : 3 * t), b = 3 * (idx ? idx[3 * t + 1] : 3 * t + 1), c = 3 * (idx ? idx[3 * t + 2] : 3 * t + 2);
      const ax = P[a], az = P[a + 2], bx = P[b], bz = P[b + 2], cx = P[c], cz = P[c + 2];
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-12) continue; // cara vertical
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
      const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
      const h = l1 * P[a + 1] + l2 * P[b + 1] + l3 * P[c + 1];
      if (h > hMax && h < 40) { hMax = h; mar = M.mar; piso = M.piso; }
    }
    return hMax > -Infinity ? { h: hMax, mar, piso } : null;
  },

  getGroundHeight(x, z) {
    // 1. Revisar si está sobre un puente / muelle
    for (const b of this.bridges) {
      const dx = x - b.x, dz = z - b.z, co = Math.cos(b.ang || 0), si = Math.sin(b.ang || 0);
      if (Math.abs(dx * co - dz * si) <= b.hx && Math.abs(dx * si + dz * co) <= b.hz) {
        return { height: b.deckY, isBridge: true, isWater: false };
      }
    }

    // 2. Revisar si está dentro de una zona de agua
    let insideWater = false;
    let waterY = -0.42;
    for (const w of this.waterZones) {
      if (Math.abs(x - w.x) <= w.width / 2 && Math.abs(z - w.z) <= w.depth / 2) {
        insideWater = true;
        waterY = w.waterY;
        break;
      }
    }

    // 3. Revisar terreno: altura de las mallas (índice espacial, ver indexarTerreno)
    let meshHeight = null, esPiso = false;
    if ((this.terrainMeshes || []).length > 0) {
      const r = this.rayoTerreno(x, z);
      if (r) {
        meshHeight = r.h;
        esPiso = r.piso;
        // Mar abierto alrededor de la isla: se nada sobre su superficie
        if (r.mar) return { height: meshHeight - 0.22, isBridge: false, isWater: true, bedHeight: meshHeight - 1 };
      }
    }
    // Fondo por debajo de la lámina de agua (bahía del Puerto a -0.15, estanques, orillas): se nada
    if (!insideWater && meshHeight !== null && meshHeight < -0.16) {
      return { height: -0.15 - 0.22, isBridge: false, isWater: true, bedHeight: meshHeight };
    }

    // 4. Si no hubo hit de raycast, calcular matemáticamente por la fórmula de la ruta
    let mathHeight = 0;
    if (state.activeMode === 'full_world') {
      const col = x + 17;
      const row = z + 29;
      if (col >= 0 && col <= 34 && row >= 0 && row <= 58) {
        mathHeight = evaluateRuta1TerrainHeight(col, row, false);
      }
    }

    const groundH = meshHeight !== null ? meshHeight : mathHeight;

    if (insideWater && groundH < waterY) {
      return { height: waterY - 0.22, isBridge: false, isWater: true, bedHeight: groundH };
    }

    return { height: groundH, isBridge: false, isWater: false, isPiso: esPiso };
  },

  update(dt) {
    if (!this.active || !this.avatar) return;

    // Si el mundo se reconstruyó (rutas que cargan tarde, recarga en vivo) se vuelven a escanear suelo y obstáculos
    this._revisar = (this._revisar || 0) + dt;
    if (this._revisar > 1) {
      this._revisar = 0;
      const enEscena = (o) => { while (o.parent) o = o.parent; return o === scene; };
      if (state.meshObjects.length !== this._nEscaneados || (this.terrainMeshes || []).some((m) => !enEscena(m))) this.scanSceneColliders();
    }

    // 1. Entrada de control
    // Controles en tercera persona: A/D giran al personaje, W avanza hacia donde mira y S retrocede.
    // Giro y velocidad con aceleración suave: sin arranques, frenazos ni giros a tirones.
    const giroInput = (this.keys.a ? 1 : 0) - (this.keys.d ? 1 : 0);
    const avance = (this.keys.w ? 1 : 0) - (this.keys.s ? 1 : 0);
    this.giroVel = (this.giroVel || 0) + (giroInput * 2.0 - (this.giroVel || 0)) * (1 - Math.exp(-dt * 8));
    if (!giroInput && Math.abs(this.giroVel) < 0.005) this.giroVel = 0;
    this.heading += this.giroVel * dt;
    this.avatar.rotation.y = this.heading;
    const isMoving = avance !== 0;

    // 2. Altura de terreno en posición actual
    const groundInfo = this.getGroundHeight(this.pos.x, this.pos.z);
    this.isSwimming = groundInfo.isWater;
    this.isOnBridge = groundInfo.isBridge;

    // 3. Velocidad horizontal: paso tranquilo de chibi y correr con Shift, proporcionales al tamaño del personaje
    // (a tamaño original 1,0 y 3,0 m/s; al 82 %: 0,82 y 2,46 m/s). Así los pasos coinciden con el avance (medirZancada).
    const tam = this.modelo ? this.ESCALA_JUGADOR : 1;
    let currentSpeed = (this.keys.shift ? 3.0 : 1.0) * tam;
    if (this.isSwimming) {
      currentSpeed *= 0.52; // Arrastre / fricción del agua
    }
    const objetivo = isMoving ? (avance > 0 ? currentSpeed : -currentSpeed * 0.6) : 0; // hacia atrás más despacio
    this.rapidez = (this.rapidez || 0) + (objetivo - (this.rapidez || 0)) * (1 - Math.exp(-dt * (isMoving ? 5 : 8)));
    if (!isMoving && Math.abs(this.rapidez) < 0.02) this.rapidez = 0;
    this.vel.x = Math.sin(this.heading) * this.rapidez;
    this.vel.z = Math.cos(this.heading) * this.rapidez;
    this.walkCycle = Math.abs(this.rapidez) > 0.05 ? this.walkCycle + dt * Math.abs(this.rapidez) * 3.4 : 0;

    // Pendientes medidas 30 cm por delante (igual a cualquier velocidad): no se sube ni se baja nada más empinado
    // que ~42°. Al borde de un acantilado, de la muralla o de la montaña el personaje se frena como ante un muro
    // invisible; como sube y baja con el mismo límite, nunca queda atrapado abajo.
    // El agua no se puede pisar: se frena en la orilla (si ya estuviera en el agua, puede salir).
    const sePuede = (nx, nz) => {
      const g = this.getGroundHeight(nx, nz);
      if (g.isBridge) return true;
      if (g.isWater) return this.isSwimming;
      if (this.isSwimming) return g.height < groundInfo.height + 0.35;
      if (groundInfo.isBridge) return true; // bajar de un puente o muelle a tierra
      // Escalones, zócalos y caminos de las casas: se suben y se bajan como escalones
      if ((g.isPiso || groundInfo.isPiso) && Math.abs(g.height - groundInfo.height) < 0.4) return true;
      const d = Math.hypot(nx - this.pos.x, nz - this.pos.z);
      if (d < 1e-6) return true;
      const L = 0.3, a = this.getGroundHeight(this.pos.x + ((nx - this.pos.x) / d) * L, this.pos.z + ((nz - this.pos.z) / d) * L);
      if (a.isBridge || a.isPiso) return true;
      const hA = a.isWater ? a.height + 0.22 : a.height; // hacia el agua se mide hasta su superficie
      return Math.abs(hA - groundInfo.height) <= L * 0.9;
    };
    // Al toparse con un obstáculo, agua o cuesta empinada el personaje se DETIENE (no resbala alrededor)
    const nxP = this.pos.x + this.vel.x * dt, nzP = this.pos.z + this.vel.z * dt;
    this.bloqueado = false;
    if (sePuede(nxP, nzP) && !(this.choca(nxP, nzP) && !this.choca(this.pos.x, this.pos.z))) {
      this.pos.x = nxP; this.pos.z = nzP;
    } else {
      this.vel.x = 0; this.vel.z = 0; this.rapidez = 0;
      this.bloqueado = isMoving;
    }

    // 4. Resolver colisiones contra obstáculos cilíndricos y cajas
    const avatarR = 0.38 * (this.modelo ? this.ESCALA_JUGADOR : 1);
    for (const c of this.colliders) {
      if (c.type === 'cylinder') {
        const dx = this.pos.x - c.x;
        const dz = this.pos.z - c.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = avatarR + c.radius;
        if (dist < minDist && dist > 0.0001) {
          const overlap = minDist - dist;
          this.pos.x += (dx / dist) * overlap;
          this.pos.z += (dz / dist) * overlap;
        }
      } else if (c.type === 'box') {
        const halfW = c.w / 2 + avatarR;
        const halfD = c.d / 2 + avatarR;
        const dx = this.pos.x - c.x;
        const dz = this.pos.z - c.z;
        if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
          const penX = halfW - Math.abs(dx);
          const penZ = halfD - Math.abs(dz);
          if (penX < penZ) {
            this.pos.x += Math.sign(dx) * penX;
          } else {
            this.pos.z += Math.sign(dz) * penZ;
          }
        }
      } else if (c.type === 'obb') {
        // Caja orientada: se pasa a coordenadas locales de la caja, se empuja por el lado más cercano y se vuelve
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
        const co = Math.cos(c.ang), si = Math.sin(c.ang);
        const lx = dx * co - dz * si, lz = dx * si + dz * co;
        const hx = c.hx + avatarR, hz = c.hz + avatarR;
        if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
          let nx = lx, nz = lz;
          if (hx - Math.abs(lx) < hz - Math.abs(lz)) nx = (Math.sign(lx) || 1) * hx; else nz = (Math.sign(lz) || 1) * hz;
          this.pos.x = c.x + nx * co + nz * si;
          this.pos.z = c.z - nx * si + nz * co;
        }
      }
    }

    // Límites perimetrales de la ruta
    const Lm = this.limites;
    if (Lm) {
      // Los límites ya incluyen los faldones costeros (1.8 m mar adentro); el mar de la isla llega a 2 m
      this.pos.x = Math.max(Lm.min.x, Math.min(Lm.max.x, this.pos.x));
      this.pos.z = Math.max(Lm.min.z, Math.min(Lm.max.z, this.pos.z));
    } else {
      this.pos.x = Math.max(-16.2, Math.min(16.2, this.pos.x));
    }

    // 5. Físicas verticales (Gravedad, salto y flotabilidad)
    const newGroundInfo = this.getGroundHeight(this.pos.x, this.pos.z);
    this.isSwimming = newGroundInfo.isWater;
    this.isOnBridge = newGroundInfo.isBridge;

    if (this.isSwimming) {
      const targetWaterY = newGroundInfo.height + Math.sin(Date.now() * 0.004) * 0.04;
      this.vel.y += (targetWaterY - this.pos.y) * 8.0 * dt;
      this.vel.y *= Math.max(0, 1 - dt * 5.0);
      this.pos.y += this.vel.y * dt;
      this.isGrounded = false;
      this.currentSurfaceType = 'water';
    } else {
      const sobreSuelo = this.pos.y - newGroundInfo.height;
      if (this.isGrounded && this.vel.y <= 0 && sobreSuelo > 0 && sobreSuelo < 0.3) {
        // Pegado al suelo al bajar cuestas y bordes de baldosas: sin saltitos ni caídas en cada paso
        this.pos.y = newGroundInfo.height;
        this.vel.y = 0;
        this.currentSurfaceType = newGroundInfo.isBridge ? 'bridge' : 'ground';
      } else {
        this.vel.y -= 19.0 * dt;
        this.pos.y += this.vel.y * dt;

        if (this.pos.y <= newGroundInfo.height) {
          this.pos.y = newGroundInfo.height;
          this.vel.y = 0;
          this.isGrounded = true;
          this.currentSurfaceType = newGroundInfo.isBridge ? 'bridge' : 'ground';
        } else {
          this.isGrounded = false;
          this.currentSurfaceType = 'air';
        }
      }
    }

    // Altura visual suavizada: el relieve de las baldosas y del terreno no hace temblar al personaje
    if (this.isGrounded && this.visY != null && Math.abs(this.pos.y - this.visY) < 0.45) {
      this.visY += (this.pos.y - this.visY) * (1 - Math.exp(-dt * 16));
    } else {
      this.visY = this.pos.y;
    }
    this.avatar.position.set(this.pos.x, this.visY, this.pos.z);

    // Personaje chibi del catálogo: Caminar / Reposo / Celebrar con su propio mezclador
    if (this.mixer) {
      const celebrando = this.celebrandoHasta && performance.now() < this.celebrandoHasta;
      const rap = Math.abs(this.rapidez || 0);
      if (rap > 0.15 && !this.bloqueado) {
        this.celebrandoHasta = 0;
        // Ritmo de los pasos acorde a la velocidad real (medida del esqueleto): los pies no patinan.
        // Con Shift, clip 'Correr' (zancada larga). Hacia atrás la animación va al revés.
        const corre = this.keys.shift && !this.isSwimming && this.acciones.Correr;
        const base = corre ? this.zancadaCorrer || 1 : this.zancada || 1;
        const ritmo = this.isSwimming ? 0.7 : Math.max(0.5, Math.min(3, rap / base));
        this.ponerAnim(corre ? 'Correr' : 'Caminar', this.rapidez < 0 ? -ritmo : ritmo);
      } else if (!celebrando || (isMoving && this.bloqueado)) { if (isMoving) this.celebrandoHasta = 0; this.ponerAnim('Reposo'); }
      this.mixer.update(dt);
      if (this.modelo) this.modelo.position.y = this.isSwimming ? -0.35 : 0;
    }
    this.animarNPCs(dt);
    this.actualizarLector(dt);
    this.animarEfectosCarta(dt);
    this.actualizarCompanero(dt);
    const vistazo = (this.keys.q ? 1.1 : 0) - (this.keys.e ? 1.1 : 0);
    let dYaw = this.heading + Math.PI + vistazo - this.camYaw;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    // Resorte críticamente amortiguado: la cámara acompaña el giro acelerando y frenando con suavidad (sin tirones al
    // empezar o dejar de girar) y sin quedarse atrás ni pasarse de largo
    const W_CAM = 7;
    this.camYawVel = (this.camYawVel || 0) + (W_CAM * W_CAM * dYaw - 2 * W_CAM * (this.camYawVel || 0)) * dt;
    this.camYaw += this.camYawVel * dt;

    if (this.shadowMesh) {
      this.shadowMesh.visible = !this.isSwimming;
      this.shadowMesh.position.y = 0.02;
    }

    // 6. Animación del cuerpo y extremidades
    const b = this.bodyParts;
    if (b && b.leftLeg) {
      if (this.isSwimming) {
        const swimCycle = Date.now() * 0.007;
        b.leftLeg.rotation.x = Math.sin(swimCycle) * 0.65;
        b.rightLeg.rotation.x = -Math.sin(swimCycle) * 0.65;
        b.leftArm.rotation.x = Math.sin(swimCycle) * 0.55;
        b.rightArm.rotation.x = -Math.sin(swimCycle) * 0.55;
        b.rig.rotation.x = 0.35;
      } else if (isMoving) {
        const swing = Math.sin(this.walkCycle);
        b.leftLeg.rotation.x = swing * 0.75;
        b.rightLeg.rotation.x = -swing * 0.75;
        b.leftArm.rotation.x = -swing * 0.65;
        b.rightArm.rotation.x = swing * 0.65;
        b.rig.position.y = Math.abs(Math.sin(this.walkCycle * 2)) * 0.05;
        b.rig.rotation.x = this.keys.shift ? 0.22 : 0.08;
      } else {
        b.leftLeg.rotation.x = 0;
        b.rightLeg.rotation.x = 0;
        b.leftArm.rotation.x = 0;
        b.rightArm.rotation.x = 0;
        b.rig.position.y = 0;
        b.rig.rotation.x = 0;
      }
    }

    // 7. Cámara: sobre la cabeza y un poco detrás, mirando AL FRENTE. Sigue al personaje sin tirones
    // (suavizado independiente de los FPS; la altura se suaviza aparte para no rebotar con el relieve).
    this.camBaseY = this.camBaseY == null ? this.pos.y : this.camBaseY + (this.pos.y - this.camBaseY) * (1 - Math.exp(-dt * 5));
    const cam = this.camaraDeseada();
    activeCamera.position.lerp(cam.pos, 1 - Math.exp(-dt * 14));
    // La mirada sale del ángulo de la cámara (no de un punto que se arrastra aparte): sin bamboleos al girar
    controls.target.copy(activeCamera.position).add(cam.mira.sub(cam.pos));
    activeCamera.lookAt(controls.target);

    // 8. Actualizar HUD flotante
    const statusEl = document.getElementById('physics-status');
    if (statusEl) {
      if (this.isSwimming) {
        statusEl.innerHTML = '🏊 <b>Nadando en Estanque</b> (Arrastre de agua activo)';
        statusEl.style.borderColor = '#0ea5e9';
        statusEl.style.color = '#38bdf8';
        statusEl.style.background = 'rgba(14, 165, 233, 0.2)';
      } else if (this.isOnBridge) {
        statusEl.innerHTML = '🌉 <b>Sobre Puente de Madera</b>';
        statusEl.style.borderColor = '#f59e0b';
        statusEl.style.color = '#fbbf24';
        statusEl.style.background = 'rgba(245, 158, 11, 0.2)';
      } else if (!this.isGrounded) {
        statusEl.innerHTML = '⬆️ <b>En el Aire (Salto)</b>';
        statusEl.style.borderColor = '#a855f7';
        statusEl.style.color = '#c084fc';
        statusEl.style.background = 'rgba(168, 85, 247, 0.2)';
      } else if (this.pos.y > 1.2) {
        statusEl.innerHTML = '⛰️ <b>Subiendo Pendiente / Montaña</b>';
        statusEl.style.borderColor = '#10b981';
        statusEl.style.color = '#6ee7b7';
        statusEl.style.background = 'rgba(16, 185, 129, 0.2)';
      } else if (this.keys.shift && isMoving) {
        statusEl.innerHTML = '🏃 <b>Corriendo por la Pradera</b>';
        statusEl.style.borderColor = '#10b981';
        statusEl.style.color = '#6ee7b7';
        statusEl.style.background = 'rgba(16, 185, 129, 0.2)';
      } else {
        statusEl.innerHTML = '🚶 <b>Caminando sobre el Terreno</b>';
        statusEl.style.borderColor = '#10b981';
        statusEl.style.color = '#6ee7b7';
        statusEl.style.background = 'rgba(16, 185, 129, 0.2)';
      }
    }
  }
};

function iniciarSoloJuego() {
  document.documentElement.classList.add('solo-juego');
  state.renderStyle = 'clay_only'; // en el juego, solo arcilla (sin la malla de alambre del editor)
  setTimeout(onWindowResize, 50);
  // Esperar a que el mundo y la biblioteca de mallas estén cargados; después entrar al modo juego
  const espera = setInterval(() => {
    const listo = state.sceneReady && state.routes && state.routes.length && window.BibliotecaMallas && window.BibliotecaMallas.mallas;
    if (!listo || window.DinoPhysics.active) return;
    clearInterval(espera);
    setRenderStyle('clay_only');
    togglePlayableAvatar();
    congelarMundoEstatico();
    window.DinoPhysics.mostrarPanelEntrada(false);
    setTimeout(() => showToast('W/S avanzar · A/D girar · Shift correr · R excavar carta · G jugar con tu dino · P panel · Esc salir'), 1500);
    onWindowResize();
    // Se quita la pantalla de carga cuando ya hay cartas cargadas y un par de fotogramas del juego dibujados
    const listoJuego = setInterval(() => {
      if (!window.DinoPhysics.cartas) return;
      clearInterval(listoJuego);
      requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('juego-listo')));
    }, 200);
  }, 300);
}

function togglePlayableAvatar() {
  const p = window.DinoPhysics;
  const hud = document.getElementById('game-physics-hud');
  const btn = document.getElementById('btn-physics-mode');

  if (!p.active) {
    // Para recorrer las 3 aldeas y el bosque se entra siempre a la isla completa
    if (state.activeMode !== 'full_world' && typeof openFullWorldRoute === 'function') openFullWorldRoute();
    p.active = true;
    p.createAvatar();
    p.scanSceneColliders();
    // Lente de juego más abierta (60°) que la del editor (40°): con la cámara tan cerca, la de 40° parece
    // un zoom y el paisaje pasa a tirones. Se restaura al salir.
    if (activeCamera && activeCamera.isPerspectiveCamera) {
      p.fovEditor = activeCamera.fov;
      activeCamera.fov = 60;
      activeCamera.updateProjectionMatrix();
    }
    if (!p._ruedaLista && renderer && renderer.domElement) {
      renderer.domElement.addEventListener('wheel', (e) => p.alRueda(e), { passive: false });
      p._ruedaLista = true;
    }
    if (!p.modelo) {
      let id = null;
      try { id = localStorage.getItem('dino_personaje_jugable'); } catch (e) {}
      const lista = p.personajesDisponibles();
      if (!lista.find((x) => x.id === id)) id = lista.length ? lista[0].id : null;
      if (id) p.ponerPersonaje(id);
    }
    p.mostrarPanelEntrada(true);
    p.crearLector();
    p.mostrarLector(true);
    p.cargarCartas();

    if (state.activeMode === 'full_world') {
      p.pos.set(p.ENTRADAS[0].x, 0, p.ENTRADAS[0].z);
    } else {
      p.pos.set(0, 0, 0);
    }
    const ground = p.getGroundHeight(p.pos.x, p.pos.z);
    p.pos.y = ground.height;
    p.vel.set(0, 0, 0);
    p.rapidez = 0; p.giroVel = 0;
    p.visY = p.camBaseY = p.pos.y;
    if (p.avatar) {
      p.avatar.visible = true;
      p.avatar.position.copy(p.pos);
    }

    if (hud) hud.classList.remove('hidden');
    if (btn) {
      btn.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.85)';
      btn.textContent = '🎮 Salir de Modo Juego';
    }
    if (state.activeMode === 'full_world') p.teletransportar(0);
    showToast('🎮 Modo Juego activado: ¡Explora con [W][A][S][D] y [Espacio]!');
  } else {
    p.active = false;
    p.pararNPCs(); // vuelven a su pose del editor
    p.ponerCompanero(null);
    if (activeCamera && activeCamera.isPerspectiveCamera && p.fovEditor) {
      activeCamera.fov = p.fovEditor;
      activeCamera.updateProjectionMatrix();
    }
    if (p.avatar) p.avatar.visible = false;
    p.mostrarPanelEntrada(false);
    p.mostrarLector(false);
    if (p.grupoColisiones) { scene.remove(p.grupoColisiones); p.grupoColisiones = null; }
    if (hud) hud.classList.add('hidden');
    if (btn) {
      btn.style.boxShadow = '';
      btn.textContent = '🎮 Modo Juego (Físicas)';
    }
    showToast('Visor 3D libre restaurado');
    if (document.documentElement.classList.contains('solo-juego')) location.href = '/';
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(appClock.getDelta(), 0.1);
  const elapsedTime = appClock.getElapsedTime();

  updateWaterSurfaces(elapsedTime);

  if (window.DinoPhysics && window.DinoPhysics.active) {
    window.DinoPhysics.update(dt);
  } else {
    controls.update();
  }

  renderer.render(scene, activeCamera);
}
