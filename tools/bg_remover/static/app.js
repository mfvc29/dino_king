// Dino King - QuitaFondos Studio & Retoque Manual

document.addEventListener('DOMContentLoaded', () => {
  // State
  let foldersList = [];
  let currentFolder = '';
  let currentImages = [];
  let currentImageObj = null;

  let activeTool = 'brush_eraser'; // Por defecto, borrador manual
  let brushSize = 24;
  let currentMode = 'border_only'; // Modo exterior seguro para cartas (evita agujeros en la piel)
  let zoom = 1.0;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Split comparison
  let viewMode = 'editor'; // 'editor', 'split'
  let splitPosition = 50;
  let isDraggingSplit = false;

  // History Stack for Undo/Redo
  const MAX_HISTORY = 20;
  let historyStack = [];
  let redoStack = [];

  // DOM Elements
  const folderSelect = document.getElementById('folderSelect');
  const btnBrowseFolder = document.getElementById('btnBrowseFolder');
  const btnCustomPath = document.getElementById('btnCustomPath');
  const localFolderPicker = document.getElementById('localFolderPicker');
  const directFilePicker = document.getElementById('directFilePicker');
  const btnOpenDirectFile = document.getElementById('btnOpenDirectFile');
  const btnEmptyOpenImage = document.getElementById('btnEmptyOpenImage');
  const btnEmptyOpenFolder = document.getElementById('btnEmptyOpenFolder');
  const imageSelect = document.getElementById('imageSelect');
  const btnPrevImg = document.getElementById('btnPrevImg');
  const btnNextImg = document.getElementById('btnNextImg');

  const mainCanvas = document.getElementById('mainCanvas');
  const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
  const splitOriginalCanvas = document.getElementById('splitOriginalCanvas');
  const splitCtx = splitOriginalCanvas.getContext('2d');

  const canvasTransformWrapper = document.getElementById('canvasTransformWrapper');
  const canvasStage = document.getElementById('canvasStage');
  const emptyState = document.getElementById('emptyState');
  const brushCursor = document.getElementById('brushCursor');
  const splitOverlayContainer = document.getElementById('splitOverlayContainer');
  const splitDivider = document.getElementById('splitDivider');

  const toolButtons = document.querySelectorAll('.tool-btn');
  const brushControls = document.getElementById('brushControls');
  const brushSizeRange = document.getElementById('brushSizeRange');
  const brushSizeVal = document.getElementById('brushSizeVal');

  const toleranceRange = document.getElementById('toleranceRange');
  const toleranceVal = document.getElementById('toleranceVal');
  const chokeRange = document.getElementById('chokeRange');
  const chokeVal = document.getElementById('chokeVal');
  const featherRange = document.getElementById('featherRange');
  const featherVal = document.getElementById('featherVal');
  const cleanPocketsCheck = document.getElementById('cleanPocketsCheck');
  const trimCheck = document.getElementById('trimCheck');
  const modeCards = document.querySelectorAll('.mode-card');

  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnResetOriginal = document.getElementById('btnResetOriginal');
  const btnProcess = document.getElementById('btnProcess');
  const btnProcessTop = document.getElementById('btnProcessTop');
  const btnHeaderAutoCut = document.getElementById('btnHeaderAutoCut');
  const btnBatch = document.getElementById('btnBatch');
  const btnAutoProcess = document.getElementById('btnAutoProcess');
  const btnHoldOriginal = document.getElementById('btnHoldOriginal');
  const btnSaveDirect = document.getElementById('btnSaveDirect');
  const btnHeaderSave = document.getElementById('btnHeaderSave');
  const btnHeaderDownload = document.getElementById('btnHeaderDownload');

  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnZoomReset = document.getElementById('btnZoomReset');
  const zoomLevelText = document.getElementById('zoomLevel');
  const viewModeButtons = document.querySelectorAll('#viewModeGroup .btn-tool');
  const patternButtons = document.querySelectorAll('.btn-pattern');

  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingMsg = document.getElementById('loadingMsg');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const statFilename = document.getElementById('statFilename');
  const statDimensions = document.getElementById('statDimensions');
  const statActiveTool = document.getElementById('statActiveTool');

  // Offscreen Original Image Buffer
  let originalImage = new Image();
  let isOriginalLoaded = false;

  // 1. Initial Load: Sin carpetas precargadas
  function initEmptyFolders() {
    folderSelect.innerHTML = '<option value="" selected disabled>📂 Abre tu carpeta con "Examinar..." o "Ruta"</option>';
    imageSelect.innerHTML = '<option value="" selected disabled>-- Primero abre tu carpeta --</option>';
    imageSelect.disabled = true;
    btnPrevImg.disabled = true;
    btnNextImg.disabled = true;
    statusText.textContent = 'Abre tu carpeta con "Examinar..." o "Ruta" para comenzar';
  }

  async function onFolderChange(folderId) {
    if (!folderId || folderId === '__local__') return;
    currentFolder = folderId;
    currentImageObj = null;

    // Resetear lienzo a estado vacío
    if (emptyState) emptyState.style.display = 'flex';
    if (canvasTransformWrapper) canvasTransformWrapper.style.display = 'none';
    statFilename.textContent = '--';
    statDimensions.textContent = '--';

    imageSelect.disabled = false;
    btnPrevImg.disabled = true;
    btnNextImg.disabled = true;
    imageSelect.innerHTML = '<option value="" selected disabled>Cargando lista de imágenes...</option>';

    try {
      showLoading(`Leyendo imágenes JPEG de ${folderId}...`);
      const res = await fetch(`/api/folder_images?folder=${encodeURIComponent(folderId)}`);
      const data = await res.json();
      
      // Filtrar estrictamente solo JPEG y ordenar alfabéticamente de la A a la Z
      currentImages = (data.images || []).filter(img => /\.(jpe?g)$/i.test(img.name));
      currentImages.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      imageSelect.innerHTML = '';
      if (currentImages.length === 0) {
        imageSelect.innerHTML = '<option value="" selected disabled>(No hay imágenes JPEG en esta carpeta)</option>';
        imageSelect.disabled = true;
        statusText.textContent = 'No se encontraron archivos JPEG en esta carpeta';
        return;
      }

      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = `-- Selecciona un JPEG (${currentImages.length}) --`;
      defaultOpt.selected = true;
      defaultOpt.disabled = true;
      imageSelect.appendChild(defaultOpt);

      currentImages.forEach((img) => {
        const opt = document.createElement('option');
        opt.value = img.full_path;
        opt.textContent = `${img.name} ${img.has_png ? '✓' : ''}`;
        imageSelect.appendChild(opt);
      });

      statusText.textContent = `Carpeta cargada (${currentImages.length} JPEGs). Elige una imagen para editar`;
    } catch (err) {
      console.error(err);
      statusText.textContent = 'Error al cargar imágenes';
    } finally {
      hideLoading();
    }
  }

  folderSelect.addEventListener('change', (e) => onFolderChange(e.target.value));

  // Cargar lista de archivos seleccionados (Imágenes sueltas o Carpeta)
  function handleFilesSelected(filesList, sourceName) {
    const files = Array.from(filesList).filter(f => /\.(jpe?g|png)$/i.test(f.name));
    if (files.length === 0) {
      alert('Por favor selecciona archivos de imagen (.jpg, .jpeg o .png).');
      return;
    }

    // Ordenar alfabéticamente por nombre de la A a la Z
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const folderName = sourceName || (files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Imágenes');
    
    folderSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '__local__';
    opt.textContent = `📁 ${folderName} (${files.length} imágenes)`;
    opt.selected = true;
    folderSelect.appendChild(opt);
    currentFolder = folderName;

    currentImages = files.map(file => ({
      name: file.name,
      base_name: file.name.replace(/\.[^/.]+$/, ""),
      full_path: file.name,
      isLocal: true,
      file: file,
      has_png: false
    }));

    imageSelect.disabled = false;
    imageSelect.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = `-- Selecciona una imagen (${currentImages.length}) --`;
    defaultOpt.disabled = true;
    imageSelect.appendChild(defaultOpt);

    currentImages.forEach((img) => {
      const iOpt = document.createElement('option');
      iOpt.value = img.name;
      iOpt.textContent = img.name;
      imageSelect.appendChild(iOpt);
    });

    statusText.textContent = `${files.length} imágenes cargadas. Abriendo primera imagen...`;

    // Abrir de inmediato la primera imagen seleccionada sin requerir clics adicionales
    selectImage(currentImages[0]);
  }

  // Abrir imagen directa (JPEG suelto)
  if (btnOpenDirectFile && directFilePicker) {
    btnOpenDirectFile.addEventListener('click', () => directFilePicker.click());
    directFilePicker.addEventListener('change', (e) => handleFilesSelected(e.target.files, 'Imagen Seleccionada'));
  }

  // Botones dentro del área vacía (Empty State)
  if (btnEmptyOpenImage && directFilePicker) {
    btnEmptyOpenImage.addEventListener('click', () => directFilePicker.click());
  }
  if (btnEmptyOpenFolder && localFolderPicker) {
    btnEmptyOpenFolder.addEventListener('click', () => localFolderPicker.click());
  }

  // Abrir carpeta local desde el explorador del sistema del usuario
  btnBrowseFolder.addEventListener('click', () => {
    localFolderPicker.click();
  });

  localFolderPicker.addEventListener('change', (e) => {
    handleFilesSelected(e.target.files);
  });

  // Soporte Drag & Drop: arrastra cualquier imagen JPEG o carpeta directamente a la ventana
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files, 'Arrastrados');
    }
  });

  // Abrir ruta personalizada escrita por el usuario (Ruta...)
  btnCustomPath.addEventListener('click', () => {
    const path = prompt('Ingresa la ruta de la carpeta (ej: /home/mvargasch/Documentos/dino_king/assets/dinos/grande/agua):');
    if (path && path.trim()) {
      const customPath = path.trim();
      folderSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = customPath;
      opt.textContent = `📁 ${customPath}`;
      opt.selected = true;
      folderSelect.appendChild(opt);
      onFolderChange(customPath);
    }
  });

  // 2. Select Image
  function selectImage(imgObj) {
    if (!imgObj) return;
    currentImageObj = imgObj;
    imageSelect.value = imgObj.isLocal ? imgObj.name : imgObj.full_path;
    btnPrevImg.disabled = currentImages.length <= 1;
    btnNextImg.disabled = currentImages.length <= 1;

    // Mostrar el canvas y ocultar el emptyState
    if (emptyState) emptyState.style.display = 'none';
    if (canvasTransformWrapper) canvasTransformWrapper.style.display = 'inline-block';

    statFilename.textContent = imgObj.name;
    showLoading(`Abriendo ${imgObj.name}...`);

    originalImage = new Image();

    originalImage.onload = () => {
      isOriginalLoaded = true;
      mainCanvas.width = originalImage.naturalWidth;
      mainCanvas.height = originalImage.naturalHeight;
      splitOriginalCanvas.width = originalImage.naturalWidth;
      splitOriginalCanvas.height = originalImage.naturalHeight;

      // Dibujar imagen original en ambos lienzos
      ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
      ctx.drawImage(originalImage, 0, 0);

      splitCtx.clearRect(0, 0, splitOriginalCanvas.width, splitOriginalCanvas.height);
      splitCtx.drawImage(originalImage, 0, 0);

      statDimensions.textContent = `${mainCanvas.width} × ${mainCanvas.height} px`;
      
      // Reset historial
      historyStack = [];
      redoStack = [];
      saveState();

      fitToScreen();
      hideLoading();
      statusText.textContent = `Imagen cargada: ${imgObj.name}. Lista para "⚡ BORRAR FONDO AUTOMÁTICO" o retocar con el borrador.`;
    };

    originalImage.onerror = (err) => {
      hideLoading();
      console.error('Error cargando imagen:', err);
      alert('Error al abrir la imagen. Comprueba que el archivo sea una imagen válida.');
      statusText.textContent = 'Error al cargar imagen';
    };

    if (imgObj.isLocal && imgObj.file) {
      // Usar FileReader base64 DataURL (100% inmune a bloqueos de CORS o blob: URLs en navegadores)
      const reader = new FileReader();
      reader.onload = (re) => {
        originalImage.src = re.target.result;
      };
      reader.onerror = () => {
        hideLoading();
        alert('Error al leer el archivo en tu equipo.');
      };
      reader.readAsDataURL(imgObj.file);
    } else {
      originalImage.crossOrigin = 'anonymous';
      originalImage.src = `/api/image?path=${encodeURIComponent(imgObj.full_path)}&t=${Date.now()}`;
    }
  }

  imageSelect.addEventListener('change', (e) => {
    const selected = currentImages.find(img => img.full_path === e.target.value || img.name === e.target.value);
    if (selected) selectImage(selected);
  });

  // Next / Prev navigation
  btnPrevImg.addEventListener('click', () => {
    if (!currentImageObj || currentImages.length <= 1) return;
    const curIdx = currentImages.findIndex(i => i.full_path === currentImageObj.full_path);
    const prevIdx = (curIdx - 1 + currentImages.length) % currentImages.length;
    selectImage(currentImages[prevIdx]);
  });

  btnNextImg.addEventListener('click', () => {
    if (!currentImageObj || currentImages.length <= 1) return;
    const curIdx = currentImages.findIndex(i => i.full_path === currentImageObj.full_path);
    const nextIdx = (curIdx + 1) % currentImages.length;
    selectImage(currentImages[nextIdx]);
  });

  // 3. History (Undo / Redo)
  function saveState() {
    if (!ctx) return;
    try {
      const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
      historyStack.push(imageData);
      if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
      }
      redoStack = [];
      updateUndoRedoUI();
    } catch (e) {
      console.warn('No se pudo guardar estado en historial:', e);
    }
  }

  function undo() {
    if (historyStack.length <= 1) return;
    const current = historyStack.pop();
    redoStack.push(current);
    const previous = historyStack[historyStack.length - 1];
    ctx.putImageData(previous, 0, 0);
    updateUndoRedoUI();
    statusText.textContent = 'Deshecho';
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop();
    historyStack.push(next);
    ctx.putImageData(next, 0, 0);
    updateUndoRedoUI();
    statusText.textContent = 'Rehecho';
  }

  function updateUndoRedoUI() {
    btnUndo.disabled = (historyStack.length <= 1);
    btnRedo.disabled = (redoStack.length === 0);
  }

  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);

  // Reset to raw original
  btnResetOriginal.addEventListener('click', () => {
    if (!isOriginalLoaded) return;
    if (confirm('¿Restablecer la imagen completa al original sin ningún corte?')) {
      ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
      ctx.drawImage(originalImage, 0, 0);
      saveState();
      statusText.textContent = 'Imagen restablecida al original';
    }
  });

  // 4. Tools Setup (Borrador Manual, Restaurador y Mano)
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.getAttribute('data-tool');
      
      const labels = {
        brush_eraser: 'Borrador Manual (Arrastra sobre la imagen para borrar fondo blanco)',
        magic_wand: 'Varita Mágica (Haz 1 clic en un hueco blanco para borrarlo)',
        brush_restore: 'Pincel Restaurador (Pinta sobre la piel para recuperar zonas comidas)',
        pan: 'Mover / Desplazar Lienzo'
      };
      statActiveTool.textContent = labels[activeTool] || activeTool;

      if (activeTool === 'pan') {
        canvasStage.style.cursor = 'grab';
        brushCursor.style.display = 'none';
      } else if (activeTool === 'magic_wand') {
        canvasStage.style.cursor = 'crosshair';
        brushCursor.style.display = 'none';
      } else {
        canvasStage.style.cursor = 'none';
        brushCursor.className = `brush-cursor ${activeTool === 'brush_restore' ? 'restore' : ''}`;
        updateBrushCursorSize();
      }
    });
  });

  // Conectar Selección de Modo de Recorte (Opciones anteriores)
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentMode = card.getAttribute('data-mode') || 'smart';
      const modeNames = {
        smart: 'Inteligente (Exterior + huecos)',
        border_only: 'Solo Exterior (Bordes)',
        all_white: 'Global (Todo el blanco)'
      };
      statusText.textContent = `Modo seleccionado: ${modeNames[currentMode] || currentMode}`;
    });
  });

  brushSizeRange.addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    brushSizeVal.textContent = `${brushSize} px`;
    updateBrushCursorSize();
  });

  toleranceRange.addEventListener('input', (e) => {
    toleranceVal.textContent = e.target.value;
  });

  chokeRange.addEventListener('input', (e) => {
    chokeVal.textContent = `${e.target.value} px`;
  });

  featherRange.addEventListener('input', (e) => {
    featherVal.textContent = `${e.target.value} px`;
  });

  function updateBrushCursorSize() {
    const visualSize = brushSize * zoom;
    brushCursor.style.width = `${visualSize}px`;
    brushCursor.style.height = `${visualSize}px`;
  }

  // 5. Interactive Canvas Drawing & Magic Wand
  function getCanvasCoords(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const scaleX = mainCanvas.width / rect.width;
    const scaleY = mainCanvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
      clientX: e.clientX,
      clientY: e.clientY
    };
  }

  // Brush drawing stroke
  function paintBrush(x, y) {
    if (!ctx || !isOriginalLoaded) return;

    if (activeTool === 'brush_eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (activeTool === 'brush_restore') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(originalImage, 0, 0);
      ctx.restore();
    }
  }

  // Magic Wand: Borra huecos cerrados con 1 solo clic (Flood Fill)
  function magicWand(startX, startY) {
    if (!ctx || !isOriginalLoaded || !mainCanvas) return;
    if (startX < 0 || startX >= mainCanvas.width || startY < 0 || startY >= mainCanvas.height) return;

    showLoading('Borrando hueco con varita mágica...');
    setTimeout(() => {
      try {
        const w = mainCanvas.width;
        const h = mainCanvas.height;
        const totalPixels = w * h;
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const startIdx = (startY * w + startX) * 4;
        const startA = data[startIdx + 3];
        if (startA === 0) {
          hideLoading();
          return;
        }

        const startR = data[startIdx];
        const startG = data[startIdx + 1];
        const startB = data[startIdx + 2];

        const tol = (parseFloat(toleranceRange.value) || 25) * 2.2;
        const visited = new Uint8Array(totalPixels);
        const queue = new Int32Array(totalPixels);
        let qHead = 0;
        let qTail = 0;

        const startPos = startY * w + startX;
        visited[startPos] = 1;
        queue[qTail++] = startPos;

        let cleared = 0;
        while (qHead < qTail) {
          const pos = queue[qHead++];
          const px = pos % w;
          const py = (pos / w) | 0;
          const idx = pos * 4;

          data[idx + 3] = 0;
          cleared++;

          if (px > 0) {
            const left = pos - 1;
            if (!visited[left]) {
              visited[left] = 1;
              const nIdx = left * 4;
              if (data[nIdx + 3] > 0) {
                const dr = data[nIdx] - startR;
                const dg = data[nIdx + 1] - startG;
                const db = data[nIdx + 2] - startB;
                if (Math.sqrt(dr * dr + dg * dg + db * db) <= tol) {
                  queue[qTail++] = left;
                }
              }
            }
          }
          if (px < w - 1) {
            const right = pos + 1;
            if (!visited[right]) {
              visited[right] = 1;
              const nIdx = right * 4;
              if (data[nIdx + 3] > 0) {
                const dr = data[nIdx] - startR;
                const dg = data[nIdx + 1] - startG;
                const db = data[nIdx + 2] - startB;
                if (Math.sqrt(dr * dr + dg * dg + db * db) <= tol) {
                  queue[qTail++] = right;
                }
              }
            }
          }
          if (py > 0) {
            const top = pos - w;
            if (!visited[top]) {
              visited[top] = 1;
              const nIdx = top * 4;
              if (data[nIdx + 3] > 0) {
                const dr = data[nIdx] - startR;
                const dg = data[nIdx + 1] - startG;
                const db = data[nIdx + 2] - startB;
                if (Math.sqrt(dr * dr + dg * dg + db * db) <= tol) {
                  queue[qTail++] = top;
                }
              }
            }
          }
          if (py < h - 1) {
            const bottom = pos + w;
            if (!visited[bottom]) {
              visited[bottom] = 1;
              const nIdx = bottom * 4;
              if (data[nIdx + 3] > 0) {
                const dr = data[nIdx] - startR;
                const dg = data[nIdx + 1] - startG;
                const db = data[nIdx + 2] - startB;
                if (Math.sqrt(dr * dr + dg * dg + db * db) <= tol) {
                  queue[qTail++] = bottom;
                }
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        saveState();
        statusText.textContent = `Hueco eliminado (${cleared} píxeles borrados)`;
        showToast(`✨ Hueco eliminado con éxito (${cleared} px)`);
      } catch (err) {
        console.error(err);
      } finally {
        hideLoading();
      }
    }, 15);
  }

  // Pointer Events on Canvas
  function handlePointerDown(e) {
    if (viewMode === 'split' || isPanning) return;

    if (e.button === 1 || activeTool === 'pan' || e.altKey) {
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
      canvasStage.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    if (activeTool === 'magic_wand') {
      magicWand(x, y);
      return;
    }

    if (activeTool === 'brush_eraser' || activeTool === 'brush_restore') {
      isDrawing = true;
      lastX = x;
      lastY = y;
      paintBrush(x, y);
    }
  }

  function handlePointerMove(e) {
    // Actualizar posición del cursor virtual de pincel
    const stageRect = canvasStage.getBoundingClientRect();
    if (e.clientX >= stageRect.left && e.clientX <= stageRect.right &&
        e.clientY >= stageRect.top && e.clientY <= stageRect.bottom &&
        (activeTool === 'brush_eraser' || activeTool === 'brush_restore')) {
      brushCursor.style.left = `${e.clientX - stageRect.left}px`;
      brushCursor.style.top = `${e.clientY - stageRect.top}px`;
      brushCursor.style.display = 'block';
    } else {
      brushCursor.style.display = 'none';
    }

    if (isPanning) {
      panX = e.clientX - startPanX;
      panY = e.clientY - startPanY;
      applyTransform();
      return;
    }

    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);

    if (activeTool === 'brush_eraser') {
      // Trazo continuo de borrado súper rápido y suave a 60 FPS
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      lastX = x;
      lastY = y;
    } else if (activeTool === 'brush_restore') {
      const dist = Math.hypot(x - lastX, y - lastY);
      const steps = Math.max(1, Math.min(25, Math.ceil(dist / (brushSize * 0.4))));
      for (let i = 0; i <= steps; i++) {
        const curX = lastX + (x - lastX) * (i / steps);
        const curY = lastY + (y - lastY) * (i / steps);
        ctx.save();
        ctx.beginPath();
        ctx.arc(curX, curY, brushSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(originalImage, 0, 0);
        ctx.restore();
      }
      lastX = x;
      lastY = y;
    }
  }

  function handlePointerUp() {
    if (isPanning) {
      isPanning = false;
      canvasStage.style.cursor = activeTool === 'pan' ? 'grab' : (activeTool === 'magic_wand' ? 'crosshair' : 'none');
    }
    if (isDrawing) {
      isDrawing = false;
      saveState();
    }
  }

  mainCanvas.addEventListener('pointerdown', handlePointerDown);
  mainCanvas.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);

  canvasStage.addEventListener('pointerleave', () => {
    brushCursor.style.display = 'none';
  });

  // 6. Hold to View Raw Original Image
  let isHoldingOriginal = false;
  let tempBeforeHold = null;

  function showRawOriginal() {
    if (!isOriginalLoaded || isHoldingOriginal) return;
    isHoldingOriginal = true;
    tempBeforeHold = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    ctx.drawImage(originalImage, 0, 0);
    statusText.textContent = 'Visualizando imagen original (sin corte)';
  }

  function hideRawOriginal() {
    if (!isHoldingOriginal) return;
    isHoldingOriginal = false;
    if (tempBeforeHold) {
      ctx.putImageData(tempBeforeHold, 0, 0);
      tempBeforeHold = null;
    }
    statusText.textContent = 'Modo edición';
  }

  btnHoldOriginal.addEventListener('pointerdown', showRawOriginal);
  window.addEventListener('pointerup', hideRawOriginal);

  // Keyboard shortcut: Spacebar to peek original
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isHoldingOriginal && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      showRawOriginal();
    } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) {
      e.preventDefault();
      redo();
    } else if (e.key === '[') {
      brushSizeRange.value = Math.max(2, brushSize - 5);
      brushSizeRange.dispatchEvent(new Event('input'));
    } else if (e.key === ']') {
      brushSizeRange.value = Math.min(150, brushSize + 5);
      brushSizeRange.dispatchEvent(new Event('input'));
    } else if (e.code === 'KeyB') {
      document.querySelector('[data-tool="brush_eraser"]').click();
    } else if (e.code === 'KeyR') {
      document.querySelector('[data-tool="brush_restore"]').click();
    } else if (e.code === 'KeyW') {
      document.querySelector('[data-tool="magic_wand"]').click();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && isHoldingOriginal) {
      hideRawOriginal();
    }
  });

  // 7. Recorte Automático e Inteligente en Canvas (Cliente ultra rápido y seguro)
  function runProcessCanvas() {
    if (!ctx || !isOriginalLoaded || !mainCanvas) {
      alert('Por favor selecciona una imagen primero.');
      return;
    }

    const modeLabels = {
      border_only: 'Solo Exterior (Seguro para dinosaurios)',
      smart: 'Inteligente (Exterior + huecos)',
      all_white: 'Global (Todo blanco)'
    };

    showLoading(`Eliminando fondo (${modeLabels[currentMode] || currentMode})...`);

    setTimeout(() => {
      try {
        const w = mainCanvas.width;
        const h = mainCanvas.height;
        const totalPixels = w * h;
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const tol = parseFloat(toleranceRange.value) || 25;
        const maxDist = tol * 2.1;

        // Detector de color blanco / grisáceo de fondo JPEG
        function isWhitePixel(idx) {
          const a = data[idx + 3];
          if (a === 0) return true; // Ya es transparente
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const dr = 255 - r;
          const dg = 255 - g;
          const db = 255 - b;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);

          if (dist <= maxDist) return true;

          // Canal mínimo muy claro y saturación muy baja (típico halo JPEG)
          const minC = Math.min(r, g, b);
          const maxC = Math.max(r, g, b);
          if (minC >= Math.max(180, 255 - tol * 1.6) && (maxC - minC) <= 20) {
            return true;
          }
          return false;
        }

        const mask = new Uint8Array(totalPixels); // 1 = marcado para borrar

        if (currentMode === 'all_white') {
          // Modo Global: borra todo píxel blanco
          for (let i = 0; i < totalPixels; i++) {
            if (isWhitePixel(i * 4)) mask[i] = 1;
          }
        } else {
          // Modo Solo Exterior (o Inteligente): Flood fill desde los 4 bordes exteriores
          const queue = new Int32Array(totalPixels);
          let head = 0;
          let tail = 0;

          // Semillas en borde superior e inferior
          for (let x = 0; x < w; x++) {
            // Superior y = 0
            if (isWhitePixel(x * 4) && !mask[x]) {
              mask[x] = 1;
              queue[tail++] = x;
            }
            // Inferior y = h - 1
            const bPos = (h - 1) * w + x;
            if (isWhitePixel(bPos * 4) && !mask[bPos]) {
              mask[bPos] = 1;
              queue[tail++] = bPos;
            }
          }

          // Semillas en borde izquierdo y derecho
          for (let y = 0; y < h; y++) {
            // Izquierdo x = 0
            const lPos = y * w;
            if (isWhitePixel(lPos * 4) && !mask[lPos]) {
              mask[lPos] = 1;
              queue[tail++] = lPos;
            }
            // Derecho x = w - 1
            const rPos = y * w + (w - 1);
            if (isWhitePixel(rPos * 4) && !mask[rPos]) {
              mask[rPos] = 1;
              queue[tail++] = rPos;
            }
          }

          // BFS Flood Fill
          while (head < tail) {
            const pos = queue[head++];
            const px = pos % w;
            const py = (pos / w) | 0;

            // Vecinos 4-conectados
            if (px > 0) {
              const left = pos - 1;
              if (!mask[left] && isWhitePixel(left * 4)) {
                mask[left] = 1;
                queue[tail++] = left;
              }
            }
            if (px < w - 1) {
              const right = pos + 1;
              if (!mask[right] && isWhitePixel(right * 4)) {
                mask[right] = 1;
                queue[tail++] = right;
              }
            }
            if (py > 0) {
              const top = pos - w;
              if (!mask[top] && isWhitePixel(top * 4)) {
                mask[top] = 1;
                queue[tail++] = top;
              }
            }
            if (py < h - 1) {
              const bottom = pos + w;
              if (!mask[bottom] && isWhitePixel(bottom * 4)) {
                mask[bottom] = 1;
                queue[tail++] = bottom;
              }
            }
          }
        }

        // Choke: Eliminación de halo de 1 a 3 px en el borde
        const choke = parseInt(chokeRange.value) || 0;
        let finalMask = mask;
        if (choke > 0) {
          finalMask = new Uint8Array(mask);
          for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
              const pos = py * w + px;
              if (mask[pos] === 1) continue;

              // Si está cerca del borde cortado y es un pixel claro de halo
              let touchesBg = false;
              for (let dy = -choke; dy <= choke; dy++) {
                for (let dx = -choke; dx <= choke; dx++) {
                  const nx = px + dx;
                  const ny = py + dy;
                  if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    if (mask[ny * w + nx] === 1) {
                      touchesBg = true;
                      break;
                    }
                  }
                }
                if (touchesBg) break;
              }

              if (touchesBg) {
                const idx = pos * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                if ((r + g + b) / 3 > 185) {
                  finalMask[pos] = 1;
                }
              }
            }
          }
        }

        // Aplicar la máscara a los datos de la imagen (alpha = 0)
        let transparentCount = 0;
        for (let i = 0; i < totalPixels; i++) {
          if (finalMask[i] === 1) {
            data[i * 4 + 3] = 0;
            transparentCount++;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        saveState();

        const pct = Math.round((transparentCount / totalPixels) * 100);
        statusText.textContent = `Fondo eliminado con éxito (${pct}% transparente). Puedes retocar con el borrador manual.`;
        showToast(`✂️ ¡Fondo eliminado con éxito! (${pct}% transparente)`);
      } catch (err) {
        console.error(err);
        alert('Error al recortar fondo: ' + err.message);
      } finally {
        hideLoading();
      }
    }, 15);
  }

  if (btnProcess) btnProcess.addEventListener('click', runProcessCanvas);
  if (btnProcessTop) btnProcessTop.addEventListener('click', runProcessCanvas);
  if (btnHeaderAutoCut) btnHeaderAutoCut.addEventListener('click', runProcessCanvas);
  if (btnAutoProcess) btnAutoProcess.addEventListener('click', runProcessCanvas);

  if (btnBatch) {
    btnBatch.addEventListener('click', async () => {
      if (!currentImages || currentImages.length === 0) {
        alert('Primero selecciona una carpeta con imágenes.');
        return;
      }
      if (!confirm(`¿Deseas procesar TODAS las (${currentImages.length}) imágenes de esta carpeta con el modo "${currentMode}" y tolerancia ${toleranceRange.value}?`)) {
        return;
      }
      showLoading(`Procesando lote de ${currentImages.length} imágenes...`);
      try {
        const res = await fetch('/api/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder_path: currentFolder,
            tolerance: parseFloat(toleranceRange.value),
            mode: currentMode,
            choke: parseInt(chokeRange.value),
            feather: parseFloat(featherRange.value),
            trim: trimCheck ? trimCheck.checked : false
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`🎉 ¡Procesadas ${data.processed_count} imágenes con éxito!`);
          onFolderChange(currentFolder);
        } else {
          alert('Error en lote: ' + data.error);
        }
      } catch (err) {
        console.error(err);
        alert('Error de conexión al procesar el lote');
      } finally {
        hideLoading();
      }
    });
  }

  // 8. Save PNG directly to disk & Download
  async function saveImageToDisk() {
    if (!currentImageObj || !mainCanvas) return;

    if (currentImageObj.isLocal && (!currentImageObj.full_path || !currentImageObj.full_path.includes('/'))) {
      const a = document.createElement('a');
      a.href = mainCanvas.toDataURL('image/png');
      const baseName = currentImageObj.name.replace(/\.[^/.]+$/, "");
      a.download = `${baseName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`💾 Descargado como ${baseName}.png`);
      statusText.textContent = `Descargado: ${baseName}.png`;
      return;
    }

    showLoading('Guardando PNG transparente en disco...');
    try {
      const dataUrl = mainCanvas.toDataURL('image/png');
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_path: currentImageObj.full_path,
          image_data: dataUrl,
          update_directions: true
        })
      });
      const data = await res.json();

      if (data.success) {
        currentImageObj.has_png = true;
        const opt = imageSelect.querySelector(`option[value="${CSS.escape(currentImageObj.full_path)}"]`);
        if (opt && !opt.textContent.includes('✓')) {
          opt.textContent += ' ✓';
        }
        showToast(`✅ ¡Guardado con éxito en ${data.rel_path}!`);
        statusText.textContent = `Guardado: ${data.rel_path}`;
      } else {
        alert('Error al guardar: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar.');
    } finally {
      hideLoading();
    }
  }

  if (btnSaveDirect) btnSaveDirect.addEventListener('click', saveImageToDisk);
  if (btnHeaderSave) btnHeaderSave.addEventListener('click', saveImageToDisk);

  btnHeaderDownload.addEventListener('click', () => {
    if (!mainCanvas || !currentImageObj) return;
    const a = document.createElement('a');
    a.href = mainCanvas.toDataURL('image/png');
    const baseName = currentImageObj.name.replace(/\.[^/.]+$/, "");
    a.download = `${baseName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // 9. Split Comparison Mode
  function updateSplit(pct) {
    splitPosition = Math.max(0, Math.min(100, pct));
    splitDivider.style.left = `${splitPosition}%`;
    splitOriginalCanvas.style.clipPath = `polygon(0 0, ${splitPosition}% 0, ${splitPosition}% 100%, 0 100%)`;
  }

  splitDivider.addEventListener('pointerdown', (e) => {
    isDraggingSplit = true;
    splitDivider.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDraggingSplit) return;
    const rect = canvasTransformWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    updateSplit(pct);
  });

  window.addEventListener('pointerup', () => {
    isDraggingSplit = false;
  });

  viewModeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      viewModeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      viewMode = btn.getAttribute('data-view');

      if (viewMode === 'split') {
        splitOverlayContainer.style.display = 'block';
        updateSplit(50);
        statusText.textContent = 'Modo split: compara arrastrando la barra central';
      } else {
        splitOverlayContainer.style.display = 'none';
        statusText.textContent = 'Modo editor: listo para pintar';
      }
    });
  });

  // 10. Zoom, Pan & Background Patterns
  function applyTransform() {
    canvasTransformWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    updateBrushCursorSize();
  }

  function setZoom(newZoom) {
    zoom = Math.max(0.1, Math.min(8.0, newZoom));
    zoomLevelText.textContent = `${Math.round(zoom * 100)}%`;
    applyTransform();
  }

  function fitToScreen() {
    if (!mainCanvas.width || !mainCanvas.height) return;
    const stageWidth = canvasStage.clientWidth - 40;
    const stageHeight = canvasStage.clientHeight - 40;
    const scaleX = stageWidth / mainCanvas.width;
    const scaleY = stageHeight / mainCanvas.height;
    panX = 0;
    panY = 0;
    setZoom(Math.min(scaleX, scaleY, 1.0));
  }

  btnZoomIn.addEventListener('click', () => setZoom(zoom + 0.25));
  btnZoomOut.addEventListener('click', () => setZoom(zoom - 0.25));
  btnZoomReset.addEventListener('click', fitToScreen);

  // Wheel Zoom
  canvasStage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(zoom + delta);
  }, { passive: false });

  // Background Pattern Selector
  patternButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      patternButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pattern = btn.getAttribute('data-pattern');
      canvasStage.className = `canvas-stage pattern-${pattern}`;
    });
  });

  // Helpers
  function showLoading(msg) {
    loadingMsg.textContent = msg;
    loadingOverlay.classList.add('active');
  }

  function hideLoading() {
    loadingOverlay.classList.remove('active');
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '55px';
    toast.style.right = '24px';
    toast.style.backgroundColor = '#10b981';
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.6)';
    toast.style.fontWeight = '700';
    toast.style.fontSize = '0.9rem';
    toast.style.zIndex = '1000';
    toast.style.transition = 'all 0.3s ease';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3500);
  }

  // Initial Boot: Iniciar limpio sin ninguna carpeta precargada
  initEmptyFolders();
});
