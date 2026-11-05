/**
 * Biblioteca de mallas — plugin del World Builder.
 *
 * Carga dinámicamente el catálogo de mallas desde /mallas/catalogo.json,
 * añade la sección "3. Biblioteca de Mallas (Carpeta mallas/)" al panel izquierdo,
 * y ofrece el modal "Seleccionar Mallas" con un visor 3D individual interactivo
 * para inspeccionar cada elemento por separado sin borrar la ruta activa.
 */
(function () {
  const biblioteca = {};
  let catalogo = null;

  // Estado del modal "Seleccionar Mallas" (Visor 3D individual)
  let modalEl = null;
  let previewRenderer = null;
  let previewScene = null;
  let previewCamera = null;
  let previewControls = null;
  let previewMeshGroup = null;
  let previewAnimId = null;
  let previewAutoRotate = false;
  let previewShowWire = true;
  let selectedMallaId = null;
  let activeCategoryFilter = 'todas';
  let searchQuery = '';

  // Carpeta base: la misma desde la que se cargó este script (/mallas/ o /world_builder/mallas/)
  const src = document.currentScript && document.currentScript.src;
  const base = src ? src.replace(/biblioteca\.js(\?.*)?$/, '') : '/mallas/';

  // Cada archivo de malla se registra a sí mismo con esta función
  window.registrarMalla = function (def) {
    biblioteca[def.id] = def;
  };

  function cargarScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar ' + url));
      document.head.appendChild(s);
    });
  }

  function construir(id, x = 0, y = 0, z = 0, escala = 1, routeId = null) {
    const def = biblioteca[id];
    if (!def || !window.MallasComun) {
      console.warn('Malla no disponible:', id);
      return null;
    }
    const group = def.construir(window.MallasComun);
    group.position.set(x, y, z);
    group.scale.setScalar(escala);
    return registerSceneObject(group, def.nombre, def.categoria, 'malla', { id }, routeId);
  }

  function insertarMallaEnRutaActual(id, cerrarModal = false) {
    const def = biblioteca[id];
    if (!def) return;
    const r = () => (Math.random() - 0.5) * 8;
    const g = construir(id, r(), 0, r(), 1);
    if (g && typeof selectMeshGroup === 'function') {
      selectMeshGroup(g);
    }
    if (typeof syncActiveSceneToRouteStore === 'function') {
      syncActiveSceneToRouteStore();
    } else if (typeof autoSaveToLocal === 'function') {
      autoSaveToLocal();
    }
    if (cerrarModal) {
      cerrarSelectorMallas();
    }
    if (typeof showToast === 'function') {
      showToast(`${def.icono || '📦'} "${def.nombre}" añadida a la ruta actual`);
    }
  }

  // Lista filtrada según categoría y búsqueda
  function obtenerMallasFiltradas() {
    if (!catalogo || !Array.isArray(catalogo.mallas)) return [];
    const q = searchQuery.trim().toLowerCase();
    return catalogo.mallas.filter((m) => {
      const def = biblioteca[m.id];
      if (!def) return false;
      if (activeCategoryFilter !== 'todas' && m.categoria !== activeCategoryFilter) return false;
      if (q) {
        const texto = `${def.nombre} ${m.id} ${m.categoria} ${m.archivo} ${def.origen || ''}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }

  // =========================================================
  // MODAL: SELECCIONAR MALLAS (VISOR 3D INDIVIDUAL)
  // =========================================================
  function asegurarModalDOM() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.id = 'modal-seleccionar-mallas';
    modalEl.className = 'mallas-modal-backdrop hidden';
    modalEl.innerHTML = `
      <div class="mallas-modal-container" onclick="event.stopPropagation()">
        <div class="mallas-modal-header">
          <div class="mallas-modal-title">
            <span>🧩 Seleccionar Mallas — Vista Individual</span>
            <span class="badge" id="modal-mallas-count">0 elementos</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="text" id="modal-mallas-search" class="mallas-modal-search" placeholder="🔍 Buscar malla por nombre o tipo...">
            <button type="button" id="btn-modal-recargar" class="action-btn" title="Escanear carpeta mallas/ en busca de archivos nuevos">
              🔄 Recargar carpeta
            </button>
            <button type="button" id="btn-modal-cerrar" class="action-btn" style="background: rgba(244,63,94,0.18); border-color: #f43f5e; color: #fda4af;">
              ✕ Cerrar (Esc)
            </button>
          </div>
        </div>

        <div class="mallas-modal-body">
          <!-- COLUMNA IZQUIERDA: CATEGORÍAS Y LISTA INDIVIDUAL -->
          <div class="mallas-modal-sidebar">
            <div class="mallas-cat-tabs" id="modal-mallas-tabs"></div>
            <div class="mallas-individual-list" id="modal-mallas-list"></div>
          </div>

          <!-- COLUMNA DERECHA: VISOR 3D INDIVIDUAL -->
          <div class="mallas-modal-preview">
            <div class="mallas-preview-viewport" id="modal-mallas-viewport">
              <div class="mallas-preview-hud-top">
                <div class="mallas-preview-card-info">
                  <h3 id="preview-malla-title">Selecciona una malla</h3>
                  <p id="preview-malla-meta">Archivo: - | Categoría: -</p>
                  <p id="preview-malla-stats">Vértices: 0 | Polígonos: 0</p>
                </div>

                <div class="mallas-preview-cam-controls">
                  <button type="button" class="action-btn" data-cam="3/4">📐 3/4</button>
                  <button type="button" class="action-btn" data-cam="frente">⬆️ Frente</button>
                  <button type="button" class="action-btn" data-cam="lado">➡️ Lado</button>
                  <button type="button" class="action-btn" data-cam="espalda">⬇️ Espalda</button>
                  <button type="button" class="action-btn" data-cam="arriba">🔝 Superior</button>
                  <button type="button" id="btn-preview-autorotate" class="action-btn">🔄 Auto-Giro</button>
                  <button type="button" id="btn-preview-wire" class="action-btn" style="border-color: #38bdf8; color: #38bdf8;">🕸️ Wireframe</button>
                </div>
              </div>
            </div>

            <div class="mallas-preview-footer">
              <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" id="btn-preview-prev" class="action-btn">◀ Anterior</button>
                <span id="preview-index-indicator" style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace; min-width: 70px; text-align: center;">1 / 1</span>
                <button type="button" id="btn-preview-next" class="action-btn">Siguiente ▶</button>
              </div>

              <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" id="btn-preview-insert" class="action-btn" style="background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #6ee7b7; font-weight: 700;">
                  ➕ Añadir a la Ruta Actual
                </button>
                <button type="button" id="btn-preview-insert-close" class="ai-generate-btn" style="padding: 8px 14px; font-size: 0.82rem; background: linear-gradient(135deg, #0284c7, #38bdf8); color: #082f49;">
                  ✅ Seleccionar e Insertar en Ruta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Eventos del modal
    modalEl.addEventListener('click', () => cerrarSelectorMallas());
    modalEl.querySelector('#btn-modal-cerrar').onclick = () => cerrarSelectorMallas();
    modalEl.querySelector('#btn-modal-recargar').onclick = () => recargarBiblioteca(true);

    const searchInput = modalEl.querySelector('#modal-mallas-search');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value || '';
      renderizarListaModal();
    });

    modalEl.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => encuadrarPreview(btn.getAttribute('data-cam')));
    });

    const btnAutoRotate = modalEl.querySelector('#btn-preview-autorotate');
    btnAutoRotate.addEventListener('click', () => {
      previewAutoRotate = !previewAutoRotate;
      if (previewControls) previewControls.autoRotate = previewAutoRotate;
      btnAutoRotate.style.borderColor = previewAutoRotate ? '#38bdf8' : '';
      btnAutoRotate.style.color = previewAutoRotate ? '#38bdf8' : '';
    });

    const btnWire = modalEl.querySelector('#btn-preview-wire');
    btnWire.addEventListener('click', () => {
      previewShowWire = !previewShowWire;
      btnWire.style.borderColor = previewShowWire ? '#38bdf8' : '';
      btnWire.style.color = previewShowWire ? '#38bdf8' : '';
      if (previewMeshGroup) {
        previewMeshGroup.traverse((ch) => {
          if (ch.name === 'wireOverlay') ch.visible = previewShowWire;
        });
      }
    });

    modalEl.querySelector('#btn-preview-prev').onclick = () => navegarMallaModal(-1);
    modalEl.querySelector('#btn-preview-next').onclick = () => navegarMallaModal(1);

    modalEl.querySelector('#btn-preview-insert').onclick = () => {
      if (selectedMallaId) insertarMallaEnRutaActual(selectedMallaId, false);
    };
    modalEl.querySelector('#btn-preview-insert-close').onclick = () => {
      if (selectedMallaId) insertarMallaEnRutaActual(selectedMallaId, true);
    };

    window.addEventListener('keydown', (e) => {
      if (!modalEl || modalEl.classList.contains('hidden')) return;
      if (e.key === 'Escape') {
        cerrarSelectorMallas();
      } else if (document.activeElement !== searchInput) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          navegarMallaModal(1);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          navegarMallaModal(-1);
        }
      }
    });

    window.addEventListener('resize', ajustarTamanoPreview);

    return modalEl;
  }

  function inicializarVisor3DIndividual() {
    if (previewRenderer) return;
    const viewport = modalEl.querySelector('#modal-mallas-viewport');
    if (!viewport) return;

    const w = Math.max(viewport.clientWidth, 480);
    const h = Math.max(viewport.clientHeight, 380);

    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0xb8bfc6);

    previewCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 500);
    previewCamera.position.set(6, 5, 8);

    previewRenderer = new THREE.WebGLRenderer({ antialias: true });
    previewRenderer.setSize(w, h);
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    previewRenderer.shadowMap.enabled = true;
    previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewport.appendChild(previewRenderer.domElement);

    previewControls = new THREE.OrbitControls(previewCamera, previewRenderer.domElement);
    previewControls.enableDamping = true;
    previewControls.dampingFactor = 0.07;
    previewControls.autoRotate = previewAutoRotate;
    previewControls.autoRotateSpeed = 2.0;

    // Iluminación de estudio estilo Blender Clay
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6e7681, 0.78);
    hemi.position.set(0, 40, 0);
    previewScene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfffaf0, 0.72);
    keyLight.position.set(18, 32, 22);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    previewScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xcfd8e3, 0.35);
    fillLight.position.set(-18, 14, -14);
    previewScene.add(fillLight);

    // Rejilla de referencia sutil para ver la escala de cada elemento individual
    const grid = new THREE.GridHelper(16, 16, 0x64748b, 0x94a3b8);
    grid.position.y = -0.01;
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    previewScene.add(grid);
  }

  function ajustarTamanoPreview() {
    if (!previewRenderer || !modalEl || modalEl.classList.contains('hidden')) return;
    const viewport = modalEl.querySelector('#modal-mallas-viewport');
    if (!viewport) return;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (w > 0 && h > 0) {
      previewCamera.aspect = w / h;
      previewCamera.updateProjectionMatrix();
      previewRenderer.setSize(w, h);
    }
  }

  // ---- Esqueleto y animaciones en el visor (mallas con huesos THREE.Bone, p. ej. personajes) ----
  let previewMixer = null;
  let previewReloj = null;
  let previewHuesos = null;        // [SkeletonHelper, puntos en las articulaciones]
  let previewVerHuesos = false;
  let previewAnim = null;          // { id, nombre }: se mantiene si se reconstruye la misma malla (#malla=alvin&anim=Caminar&huesos)

  function barraEsqueletoPreview() {
    let barra = modalEl.querySelector('#preview-malla-esqueleto');
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'preview-malla-esqueleto';
      barra.className = 'mallas-preview-cam-controls';
      barra.style.cssText = 'position: absolute; left: 14px; bottom: 14px; z-index: 10;';
      modalEl.querySelector('#modal-mallas-viewport').appendChild(barra);
    }
    return barra;
  }

  function quitarHuesosPreview() {
    if (!previewHuesos) return;
    previewHuesos.forEach((o) => { previewScene.remove(o); o.geometry.dispose(); o.material.dispose(); });
    previewHuesos = null;
  }

  function mostrarHuesosPreview() {
    quitarHuesosPreview();
    if (!previewVerHuesos || !previewMeshGroup) return;
    const lineas = new THREE.SkeletonHelper(previewMeshGroup);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(lineas.bones.length * 3), 3));
    const puntos = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xf59e0b, size: 7, sizeAttenuation: false, depthTest: false, transparent: true }));
    lineas.renderOrder = 999;
    puntos.renderOrder = 1000;
    puntos.frustumCulled = false;
    previewHuesos = [lineas, puntos];
    previewScene.add(lineas, puntos);
  }

  // Botones del visor: ver esqueleto, pose quieta y un botón por animación (group.animations)
  function prepararEsqueletoPreview() {
    if (previewMixer) previewMixer.stopAllAction();
    previewMixer = null;
    quitarHuesosPreview();
    const barra = barraEsqueletoPreview();
    let huesos = 0;
    previewMeshGroup.traverse((o) => { if (o.isBone) huesos++; });
    barra.innerHTML = '';
    barra.style.display = huesos ? 'flex' : 'none';
    if (!huesos) return;

    previewMixer = new THREE.AnimationMixer(previewMeshGroup);
    previewReloj = previewReloj || new THREE.Clock();
    previewReloj.getDelta();
    const marcar = (b, on) => { b.style.borderColor = on ? '#f59e0b' : ''; b.style.color = on ? '#fbbf24' : ''; };
    const boton = (texto, titulo, alPulsar) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'action-btn';
      b.textContent = texto;
      b.title = titulo;
      b.onclick = alPulsar;
      barra.appendChild(b);
      return b;
    };
    const bHuesos = boton(`🦴 Esqueleto (${huesos})`, 'Mostrar u ocultar los huesos', () => {
      previewVerHuesos = !previewVerHuesos;
      marcar(bHuesos, previewVerHuesos);
      mostrarHuesosPreview();
    });
    marcar(bHuesos, previewVerHuesos);
    const clips = previewMeshGroup.animations || [];
    const botones = [];
    const reproducir = (clip, b) => {
      previewMixer.stopAllAction();                       // al parar, los huesos vuelven a la pose de reposo
      botones.forEach((x) => marcar(x, x === b));
      if (clip) previewMixer.clipAction(clip).reset().play();
      previewAnim = clip ? { id: selectedMallaId, nombre: clip.name } : null;
    };
    const bQuieto = boton('⏹ Quieto', 'Pose de reposo', () => reproducir(null, bQuieto));
    botones.push(bQuieto);
    clips.forEach((clip) => {
      const b = boton(`▶ ${clip.name}`, `Animación "${clip.name}"`, () => reproducir(clip, b));
      botones.push(b);
    });
    marcar(bQuieto, true);
    mostrarHuesosPreview();
    if (previewAnim && previewAnim.id === selectedMallaId && previewAnim.nombre) {
      const i = clips.findIndex((c) => c.name.toLowerCase() === previewAnim.nombre.toLowerCase());
      if (i >= 0) botones[i + 1].click();
    }
  }

  function actualizarEsqueletoPreview() {
    if (previewMixer && previewReloj) previewMixer.update(Math.min(previewReloj.getDelta(), 0.1));
    if (previewHuesos && previewMeshGroup) {
      const [lineas, puntos] = previewHuesos;
      previewMeshGroup.updateMatrixWorld(true);
      const pos = puntos.geometry.attributes.position;
      lineas.bones.forEach((b, i) => pos.setXYZ(i, b.matrixWorld.elements[12], b.matrixWorld.elements[13], b.matrixWorld.elements[14]));
      pos.needsUpdate = true;
    }
  }

  function bucleAnimacionPreview() {
    if (!modalEl || modalEl.classList.contains('hidden')) {
      previewAnimId = null;
      return;
    }
    previewAnimId = requestAnimationFrame(bucleAnimacionPreview);
    if (previewControls) previewControls.update();
    actualizarEsqueletoPreview();
    if (previewRenderer && previewScene && previewCamera) {
      previewRenderer.render(previewScene, previewCamera);
    }
  }

  function encuadrarPreview(vista = '3/4') {
    if (!previewMeshGroup || !previewCamera || !previewControls) return;
    const caja = new THREE.Box3().setFromObject(previewMeshGroup);
    const centro = caja.getCenter(new THREE.Vector3());
    const tamVec = caja.getSize(new THREE.Vector3());
    const tam = Math.max(tamVec.length(), 1.5);
    const d = tam * 1.25;

    const posiciones = {
      frente: [0, tam * 0.18, d],
      lado: [d, tam * 0.18, 0],
      espalda: [0, tam * 0.18, -d],
      arriba: [0, d * 1.15, 0.01],
      '3/4': [tam * 0.55, tam * 0.42, tam * 0.95]
    };
    const [dx, dy, dz] = posiciones[vista] || posiciones['3/4'];
    previewCamera.position.set(centro.x + dx, centro.y + dy, centro.z + dz);
    previewControls.target.copy(centro);
    previewControls.update();
  }

  function mostrarMallaIndividualEnModal(id, vista = '3/4') {
    const def = biblioteca[id];
    if (!def || !window.MallasComun) return;
    selectedMallaId = id;

    inicializarVisor3DIndividual();

    // Limpiar malla previa del visor individual
    if (previewMeshGroup) {
      previewScene.remove(previewMeshGroup);
      previewMeshGroup = null;
    }

    previewMeshGroup = def.construir(window.MallasComun);
    previewMeshGroup.position.set(0, 0, 0);
    previewMeshGroup.traverse((ch) => {
      if (ch.name === 'wireOverlay') ch.visible = previewShowWire;
    });
    previewScene.add(previewMeshGroup);
    prepararEsqueletoPreview();

    // Calcular estadísticas de vértices y polígonos de esta malla individual
    let verts = 0;
    let faces = 0;
    previewMeshGroup.traverse((ch) => {
      if (ch.isMesh && ch.geometry) {
        const pos = ch.geometry.attributes.position;
        if (pos) {
          verts += pos.count;
          faces += ch.geometry.index ? Math.round(ch.geometry.index.count / 3) : Math.round(pos.count / 3);
        }
      }
    });

    const itemCat = (catalogo && catalogo.mallas.find((m) => m.id === id)) || {};
    const nombresCat = (catalogo && catalogo.categorias) || {};
    const catLabel = nombresCat[def.categoria] || def.categoria || 'General';

    const titleEl = modalEl.querySelector('#preview-malla-title');
    const metaEl = modalEl.querySelector('#preview-malla-meta');
    const statsEl = modalEl.querySelector('#preview-malla-stats');

    if (titleEl) titleEl.textContent = `${def.icono || '📦'} ${def.nombre}`;
    if (metaEl) metaEl.textContent = `Archivo: mallas/${itemCat.archivo || id + '.js'}  |  Categoría: ${catLabel}`;
    if (statsEl) statsEl.textContent = `Vértices: ${verts.toLocaleString()}  |  Polígonos: ${faces.toLocaleString()}  |  Origen: ${def.origen || 'mallas/'}`;

    encuadrarPreview(vista);

    // Actualizar resaltado en la lista y el indicador N / Total
    const filtradas = obtenerMallasFiltradas();
    const idx = filtradas.findIndex((m) => m.id === id);
    const indEl = modalEl.querySelector('#preview-index-indicator');
    if (indEl) {
      indEl.textContent = idx >= 0 ? `${idx + 1} / ${filtradas.length}` : `- / ${filtradas.length}`;
    }

    modalEl.querySelectorAll('.malla-item-card').forEach((card) => {
      const esActiva = card.getAttribute('data-malla-id') === id;
      card.classList.toggle('active', esActiva);
      if (esActiva) {
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  function navegarMallaModal(delta) {
    const filtradas = obtenerMallasFiltradas();
    if (filtradas.length === 0) return;
    let idx = filtradas.findIndex((m) => m.id === selectedMallaId);
    if (idx < 0) idx = 0;
    else idx = (idx + delta + filtradas.length) % filtradas.length;
    mostrarMallaIndividualEnModal(filtradas[idx].id);
  }

  function renderizarTabsModal() {
    if (!modalEl || !catalogo) return;
    const tabsWrap = modalEl.querySelector('#modal-mallas-tabs');
    if (!tabsWrap) return;
    tabsWrap.innerHTML = '';

    const nombresCat = catalogo.categorias || {};
    const conteoPorCat = {};
    let totalDisponibles = 0;

    catalogo.mallas.forEach((m) => {
      if (biblioteca[m.id]) {
        conteoPorCat[m.categoria] = (conteoPorCat[m.categoria] || 0) + 1;
        totalDisponibles++;
      }
    });

    const countBadge = modalEl.querySelector('#modal-mallas-count');
    if (countBadge) countBadge.textContent = `${totalDisponibles} elementos individuales`;

    const crearTab = (idCat, etiqueta) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mallas-cat-tab' + (activeCategoryFilter === idCat ? ' active' : '');
      btn.textContent = etiqueta;
      btn.onclick = () => {
        activeCategoryFilter = idCat;
        renderizarTabsModal();
        renderizarListaModal();
      };
      tabsWrap.appendChild(btn);
    };

    crearTab('todas', `🗂️ Todas (${totalDisponibles})`);
    Object.keys(conteoPorCat).forEach((cat) => {
      const nombre = nombresCat[cat] || cat;
      crearTab(cat, `${nombre} (${conteoPorCat[cat]})`);
    });
  }

  function renderizarListaModal() {
    if (!modalEl || !catalogo) return;
    const listWrap = modalEl.querySelector('#modal-mallas-list');
    if (!listWrap) return;
    listWrap.innerHTML = '';

    const filtradas = obtenerMallasFiltradas();
    const nombresCat = catalogo.categorias || {};

    if (filtradas.length === 0) {
      listWrap.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">No se encontraron mallas con ese filtro.</div>`;
      return;
    }

    filtradas.forEach((m) => {
      const def = biblioteca[m.id];
      const card = document.createElement('div');
      card.className = 'malla-item-card' + (selectedMallaId === m.id ? ' active' : '');
      card.setAttribute('data-malla-id', m.id);

      const info = document.createElement('div');
      info.className = 'malla-item-info';
      info.innerHTML = `
        <div class="malla-item-name">
          <span>${def.icono || '📦'}</span>
          <span>${def.nombre}</span>
        </div>
        <div class="malla-item-meta">${nombresCat[m.categoria] || m.categoria} · mallas/${m.archivo}</div>
      `;

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'malla-item-add-btn';
      addBtn.textContent = '➕ Añadir';
      addBtn.title = 'Insertar directamente esta malla en la ruta actual';
      addBtn.onclick = (e) => {
        e.stopPropagation();
        mostrarMallaIndividualEnModal(m.id);
        insertarMallaEnRutaActual(m.id, false);
      };

      card.onclick = () => mostrarMallaIndividualEnModal(m.id);
      card.ondblclick = () => insertarMallaEnRutaActual(m.id, true);

      card.appendChild(info);
      card.appendChild(addBtn);
      listWrap.appendChild(card);
    });

    // Si la malla seleccionada no está en el filtro actual, seleccionar la primera disponible
    if (!selectedMallaId || !filtradas.some((m) => m.id === selectedMallaId)) {
      mostrarMallaIndividualEnModal(filtradas[0].id);
    } else {
      mostrarMallaIndividualEnModal(selectedMallaId);
    }
  }

  function abrirSelectorMallas(idInicial, vistaInicial = '3/4') {
    const modal = asegurarModalDOM();
    modal.classList.remove('hidden');

    if (idInicial && biblioteca[idInicial]) {
      selectedMallaId = idInicial;
      activeCategoryFilter = 'todas';
    }

    renderizarTabsModal();
    renderizarListaModal();

    setTimeout(() => {
      ajustarTamanoPreview();
      if (selectedMallaId) {
        mostrarMallaIndividualEnModal(selectedMallaId, vistaInicial);
      }
      if (!previewAnimId) {
        bucleAnimacionPreview();
      }
    }, 20);
  }

  function cerrarSelectorMallas() {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    if (previewAnimId) {
      cancelAnimationFrame(previewAnimId);
      previewAnimId = null;
    }
  }

  // Alias para compatibilidad si se llama verMallaSola(id, vista)
  function verMallaSola(id, vista = '3/4') {
    if (!biblioteca[id]) {
      if (typeof showToast === 'function') showToast(`No existe la malla "${id}"`);
      return;
    }
    abrirSelectorMallas(id, vista);
  }

  // =========================================================
  // PANEL LATERAL IZQUIERDO: 3. BIBLIOTECA DE MALLAS
  // =========================================================
  function pintarPanel() {
    const panel = document.getElementById('left-panel');
    if (!panel || !catalogo) return;
    const viejo = document.getElementById('seccion-biblioteca-mallas');
    if (viejo) viejo.remove();

    const totalMallas = catalogo.mallas.filter((m) => biblioteca[m.id]).length;

    const sec = document.createElement('div');
    sec.className = 'panel-section';
    sec.id = 'seccion-biblioteca-mallas';
    sec.innerHTML = `
      <div class="panel-title">
        <span>3. Biblioteca de Mallas (Carpeta mallas/)</span>
        <button type="button" class="btn-recargar-mallas" style="background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.35); color: #38bdf8; border-radius: 5px; padding: 2px 7px; font-size: 0.7rem; cursor: pointer;" title="Escanear carpeta mallas/ en busca de nuevas mallas">🔄 Recargar</button>
      </div>
      <div class="blueprint-list" style="margin-bottom: 8px;">
        <button class="blueprint-btn" type="button" id="btn-abrir-seleccionar-mallas" style="border-color: #38bdf8; background: rgba(56, 189, 248, 0.14);">
          <strong>🧩 Seleccionar Mallas (${totalMallas} individuales)</strong>
          <span>Abre la vista individual para ver, rotar en 3D y elegir cada malla una por una sin alterar tu ruta actual.</span>
        </button>
      </div>
      <div class="module-grid"></div>`;

    sec.querySelector('#btn-abrir-seleccionar-mallas').onclick = () => abrirSelectorMallas();
    sec.querySelector('.btn-recargar-mallas').onclick = () => recargarBiblioteca(true);
    const rejilla = sec.querySelector('.module-grid');

    const nombres = catalogo.categorias || {};
    const porCategoria = {};
    catalogo.mallas.forEach((m) => {
      if (biblioteca[m.id]) (porCategoria[m.categoria] = porCategoria[m.categoria] || []).push(m);
    });

    Object.keys(porCategoria).forEach((cat) => {
      const titulo = document.createElement('div');
      titulo.textContent = nombres[cat] || cat;
      titulo.style.cssText = 'grid-column:1/-1;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-top:4px;';
      rejilla.appendChild(titulo);

      porCategoria[cat].forEach((m) => {
        const def = biblioteca[m.id];
        const b = document.createElement('button');
        b.className = 'module-btn';
        b.type = 'button';
        b.textContent = `${def.icono || '📦'} ${def.nombre}`;
        b.title = `Clic: Añadir a ruta actual\nDoble clic: Ver individualmente en Seleccionar Mallas\nArchivo: mallas/${m.archivo}`;
        b.onclick = () => insertarMallaEnRutaActual(m.id, false);
        b.ondblclick = (e) => {
          e.preventDefault();
          abrirSelectorMallas(m.id);
        };
        rejilla.appendChild(b);
      });
    });

    // Antes de la sección de Topología si existe; si no, al final del panel
    const secciones = Array.from(panel.querySelectorAll('.panel-section'));
    const topologia = secciones.find((s) => /Topolog/i.test(s.textContent));
    if (topologia) panel.insertBefore(sec, topologia);
    else panel.appendChild(sec);
  }

  // Guardar/cargar: añade las mallas de la biblioteca al reconstruir un diseño guardado
  function engancharCarga() {
    const original = window.rebuildSceneFromData;
    if (typeof original !== 'function' || original.__conBiblioteca) return;
    const envuelta = function (data) {
      original(data);
      ((data && data.objects) || []).filter((o) => o.moduleType === 'malla').forEach((item) => {
        const p = item.params || {};
        const pos = item.position || { x: 0, y: 0, z: 0 };
        const g = construir(p.id, pos.x, pos.y, pos.z, 1);
        if (!g) return;
        if (item.rotation) g.rotation.set(item.rotation.x || 0, item.rotation.y || 0, item.rotation.z || 0);
        if (item.scale) g.scale.set(item.scale.x || 1, item.scale.y || 1, item.scale.z || 1);
      });
    };
    envuelta.__conBiblioteca = true;
    window.rebuildSceneFromData = envuelta;
  }

  async function recargarBiblioteca(mostrarAviso = false) {
    const bust = '?t=' + Date.now();
    try {
      const res = await fetch(base + 'catalogo.json' + bust, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      catalogo = await res.json();
      await cargarScript(base + '_comun.js' + bust);
    } catch (e) {
      console.error('Biblioteca de mallas: no se pudo cargar el catálogo', e);
      return;
    }

    // Carga paralela ultrarrápida de todas las mallas para evitar carreras de tiempo
    if (catalogo && Array.isArray(catalogo.mallas)) {
      await Promise.all(
        catalogo.mallas.map(m => cargarScript(base + m.archivo + bust).catch(e => console.warn(e)))
      );
    }

    pintarPanel();
    engancharCarga();
    if (modalEl && !modalEl.classList.contains('hidden')) {
      renderizarTabsModal();
      renderizarListaModal();
    }
    if (mostrarAviso && typeof showToast === 'function') {
      showToast(`🔄 Repositorio mallas/ actualizado (${Object.keys(biblioteca).length} mallas disponibles)`);
    }
  }

  function procesarHash() {
    const params = new URLSearchParams(decodeURIComponent(location.hash.slice(1)));
    if (params.has('seleccionar') || params.has('vitrina')) {
      abrirSelectorMallas();
    } else if (params.get('malla')) {
      if (params.get('anim')) previewAnim = { id: params.get('malla'), nombre: params.get('anim') };
      if (params.has('huesos')) previewVerHuesos = true;
      abrirSelectorMallas(params.get('malla'), params.get('vista') || '3/4');
    }
  }

  async function iniciar() {
    await recargarBiblioteca(false);
    window.BibliotecaMallas._cargado = true;
    window.dispatchEvent(new CustomEvent('biblioteca-mallas-ready'));

    const params = new URLSearchParams(decodeURIComponent(location.hash.slice(1)));
    if (params.has('seleccionar') || params.has('vitrina') || params.get('malla')) {
      procesarHash();
    } else if (typeof state !== 'undefined' && Array.isArray(state.routes) && state.sceneReady) {
      // Si la escena ya se había inicializado antes y faltaban mallas por instanciar, instanciarlas sin borrar nada
      const hayMallasFaltantes = state.routes.some((r) => {
        const mallasEnRuta = (r.objects || []).filter(o => o.moduleType === 'malla');
        return mallasEnRuta.some(mObj => {
          const mId = mObj.params?.id || mObj.id;
          return !state.meshObjects.some(g => g.userData?.params?.id === mId || g.userData?.id === mId);
        });
      });

      if (hayMallasFaltantes) {
        state.isRebuilding = true;
        if (state.activeMode === 'full_world' && typeof openFullWorldRoute === 'function') {
          openFullWorldRoute();
        } else if (typeof openRouteEditor === 'function') {
          openRouteEditor(state.activeRouteId);
        }
        state.isRebuilding = false;
      }
    }
  }

  window.addEventListener('hashchange', procesarHash);

  window.BibliotecaMallas = {
    construir,
    abrirSelector: abrirSelectorMallas,
    cerrarSelector: cerrarSelectorMallas,
    verMallaSola,
    recargar: () => recargarBiblioteca(true),
    mallas: biblioteca,
    _cargado: false,
    ready: null
  };

  // Iniciar la carga de inmediato para que esté disponible cuanto antes
  window.BibliotecaMallas.ready = iniciar();
})();
