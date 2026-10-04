/**
 * Dino King - Advance Map Studio
 * Editor visual de mapas 2D y permisos de paso estilo ROM Hacking (Advance Map)
 */

class AdvanceMapEditor {
    constructor() {
        this.cols = 120;
        this.rows = 90;
        this.tileSize = 32;       // Tamaño en el mapa
        this.sourceTileSize = 16; // Tamaño en el tileset original
        this.paletteScale = 2;    // Escala del visor de tileset (16x16 -> 32x32)

        // Estado de edición
        this.activeLayer = 'ground'; // 'ground', 'decor', 'collision'
        this.activeTool = 'pencil';  // 'pencil', 'fill', 'eraser', 'picker'
        this.selectedPerm = 'solid'; // 'solid', 'walkable', 'tall_grass'
        this.showGrid = true;
        this.showCollisionOverlay = true;

        // Tilesets disponibles
        this.tilesets = {}; // filename -> Image
        this.currentTilesetKey = 'GRASS+.png';
        this.tilesetNames = ['GRASS+.png', 'Water+.png'];

        // Sello / Pincel seleccionado
        // Un sello puede ser 1x1 o un bloque multi-losa (ej. 2x2, 3x3)
        this.selectedStamp = {
            tileset: 'GRASS+.png',
            startR: 0,
            startC: 0,
            w: 1,
            h: 1,
            tiles: [[{ r: 0, c: 0 }]]
        };

        // Grillas de datos del mapa
        this.groundGrid = [];
        this.decorGrid = [];
        this.solidGrid = [];
        this.tallGrassGrid = [];

        // Historial para Deshacer / Rehacer (Undo / Redo)
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 30;

        // Viewport, zoom y arrastre
        this.zoom = 1.0;
        this.viewport = document.getElementById('viewport');
        this.canvasWrapper = document.getElementById('canvasWrapper');
        this.mapCanvas = document.getElementById('mapCanvas');
        this.ctx = this.mapCanvas.getContext('2d', { willReadFrequently: true });
        this.ctx.imageSmoothingEnabled = false;

        this.paletteCanvas = document.getElementById('paletteCanvas');
        this.paletteCtx = this.paletteCanvas.getContext('2d');
        this.paletteCtx.imageSmoothingEnabled = false;

        this.brushCanvas = document.getElementById('brushPreviewCanvas');
        this.brushCtx = this.brushCanvas.getContext('2d');
        this.brushCtx.imageSmoothingEnabled = false;

        this.minimapCanvas = document.getElementById('editorMinimap');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        // Estado del ratón
        this.isMouseDown = false;
        this.mouseButton = 0;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };
        this.hoverTile = { col: -1, row: -1 };
        this.isPaletteSelecting = false;
        this.paletteDragStart = { c: 0, r: 0 };

        this.init();
    }

    async init() {
        this.showToast('Cargando tilesets y mapa del servidor...');

        // 1. Cargar lista de tilesets desde la API
        await this.loadTilesetList();

        // 2. Cargar imágenes de los tilesets
        await this.loadTilesetImages();

        // 3. Inicializar grillas vacías y cargar mapa desde /api/map
        this.initEmptyGrids();
        await this.loadMapFromServer();

        // 4. Configurar eventos de interfaz y herramientas
        this.initUIEvents();
        this.initMapEvents();
        this.initPaletteEvents();
        this.initMinimapEvents();
        this.initKeyboardShortcuts();

        // 5. Renderizar vista inicial
        this.renderPalette();
        this.updateBrushPreview();
        this.renderMap();
        this.renderMinimap();

        // Centrar vista en Pueblo Raíz (X: 60, Y: 45)
        this.centerViewportOnTile(60, 45);
        this.showToast('¡Advance Map Studio listo! Puedes comenzar a diseñar.');
    }

    // ============================================================
    // CARGA DE ASSETS Y DATOS
    // ============================================================
    async loadTilesetList() {
        try {
            const res = await fetch('/api/tilesets');
            if (res.ok) {
                this.tilesetNames = await res.json();
                const selector = document.getElementById('tilesetSelector');
                if (selector) {
                    selector.innerHTML = '';
                    this.tilesetNames.forEach(name => {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        selector.appendChild(opt);
                    });
                }
            }
        } catch (e) {
            console.warn('Error cargando lista de tilesets:', e);
        }
    }

    loadTilesetImages() {
        const promises = this.tilesetNames.map(name => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.tilesets[name] = img;
                    resolve(img);
                };
                img.onerror = () => {
                    console.error('Error cargando imagen tileset:', name);
                    resolve(null);
                };
                img.src = `assets/maps/${name}`;
            });
        });
        return Promise.all(promises);
    }

    initEmptyGrids() {
        this.groundGrid = [];
        this.decorGrid = [];
        this.solidGrid = [];
        this.tallGrassGrid = [];

        for (let r = 0; r < this.rows; r++) {
            this.groundGrid[r] = [];
            this.decorGrid[r] = [];
            this.solidGrid[r] = [];
            this.tallGrassGrid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.groundGrid[r][c] = { tileset: 'GRASS+.png', r: 0, c: 0 };
                this.decorGrid[r][c] = null;
                this.solidGrid[r][c] = 0;
                this.tallGrassGrid[r][c] = 0;
            }
        }
    }

    async loadMapFromServer() {
        try {
            const res = await fetch('/api/map');
            if (res.ok) {
                const data = await res.json();
                this.applyMapData(data);
                this.pushHistory('Cargar mapa inicial');
            }
        } catch (e) {
            console.warn('No se pudo cargar /api/map:', e);
        }
    }

    applyMapData(data) {
        if (!data || !data.ground) return;
        this.cols = data.cols || 120;
        this.rows = data.rows || 90;

        for (let r = 0; r < this.rows; r++) {
            if (!this.groundGrid[r]) this.groundGrid[r] = [];
            if (!this.decorGrid[r]) this.decorGrid[r] = [];
            if (!this.solidGrid[r]) this.solidGrid[r] = [];
            if (!this.tallGrassGrid[r]) this.tallGrassGrid[r] = [];

            for (let c = 0; c < this.cols; c++) {
                // Suelo
                const g = data.ground[r] ? data.ground[r][c] : null;
                if (g && Array.isArray(g)) {
                    let ts = g[0];
                    if (ts === 'grass') ts = 'GRASS+.png';
                    if (ts === 'water') ts = 'Water+.png';
                    this.groundGrid[r][c] = { tileset: ts, r: g[1], c: g[2] };
                } else {
                    this.groundGrid[r][c] = { tileset: 'GRASS+.png', r: 0, c: 0 };
                }

                // Decoración
                const d = data.decor[r] ? data.decor[r][c] : null;
                if (d && Array.isArray(d)) {
                    let ts = d[0];
                    if (ts === 'grass') ts = 'GRASS+.png';
                    if (ts === 'water') ts = 'Water+.png';
                    this.decorGrid[r][c] = { tileset: ts, r: d[1], c: d[2] };
                } else {
                    this.decorGrid[r][c] = null;
                }

                // Permisos
                this.solidGrid[r][c] = (data.solid && data.solid[r]) ? data.solid[r][c] : 0;
                this.tallGrassGrid[r][c] = (data.tallGrass && data.tallGrass[r]) ? data.tallGrass[r][c] : 0;
            }
        }
    }

    getExportableMapData() {
        const data = {
            version: 1,
            name: "Mundo Jurásico - Ruta 1",
            cols: this.cols,
            rows: this.rows,
            tileSize: this.tileSize,
            sourceTileSize: this.sourceTileSize,
            tilesets: {
                "grass": "GRASS+.png",
                "water": "Water+.png"
            },
            ground: [],
            decor: [],
            solid: [],
            tallGrass: []
        };

        for (let r = 0; r < this.rows; r++) {
            const gRow = [];
            const dRow = [];
            const sRow = [];
            const tRow = [];

            for (let c = 0; c < this.cols; c++) {
                const g = this.groundGrid[r][c];
                gRow.push(g ? [g.tileset.replace('.png', '').toLowerCase(), g.r, g.c] : ['grass', 0, 0]);

                const d = this.decorGrid[r][c];
                dRow.push(d ? [d.tileset.replace('.png', '').toLowerCase(), d.r, d.c] : null);

                sRow.push(this.solidGrid[r][c] ? 1 : 0);
                tRow.push(this.tallGrassGrid[r][c] ? 1 : 0);
            }

            data.ground.push(gRow);
            data.decor.push(dRow);
            data.solid.push(sRow);
            data.tallGrass.push(tRow);
        }

        return data;
    }

    // ============================================================
    // SISTEMA DE HISTORIAL (UNDO / REDO)
    // ============================================================
    pushHistory(actionDesc = '') {
        // Cortar historial si estábamos en medio de un undo
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Clonar estado actual de forma eficiente
        const snapshot = {
            ground: this.groundGrid.map(row => row.map(cell => cell ? { ...cell } : null)),
            decor: this.decorGrid.map(row => row.map(cell => cell ? { ...cell } : null)),
            solid: this.solidGrid.map(row => [...row]),
            tallGrass: this.tallGrassGrid.map(row => [...row]),
            desc: actionDesc
        };

        this.history.push(snapshot);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreSnapshot(this.history[this.historyIndex]);
            this.showToast(`Deshacer: ${this.history[this.historyIndex + 1].desc}`);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreSnapshot(this.history[this.historyIndex]);
            this.showToast(`Rehacer: ${this.history[this.historyIndex].desc}`);
        }
    }

    restoreSnapshot(snapshot) {
        this.groundGrid = snapshot.ground.map(row => row.map(cell => cell ? { ...cell } : null));
        this.decorGrid = snapshot.decor.map(row => row.map(cell => cell ? { ...cell } : null));
        this.solidGrid = snapshot.solid.map(row => [...row]);
        this.tallGrassGrid = snapshot.tallGrass.map(row => [...row]);
        this.renderMap();
        this.renderMinimap();
    }

    // ============================================================
    // RENDERIZADO DEL MAPA Y CAPAS
    // ============================================================
    renderMap() {
        this.ctx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);

        // 1. Capa de Suelo
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.groundGrid[r][c];
                if (cell) {
                    this.drawTile(this.ctx, cell, c * this.tileSize, r * this.tileSize);
                }
            }
        }

        // 2. Capa de Decoraciones
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.decorGrid[r][c];
                if (cell) {
                    this.drawTile(this.ctx, cell, c * this.tileSize, r * this.tileSize);
                }
            }
        }

        // 3. Capa de Permisos de Paso / Colisiones (Movement Permissions)
        if (this.showCollisionOverlay) {
            this.renderCollisionOverlay();
        }

        // 4. Cuadrícula de Losas (Grid)
        if (this.showGrid) {
            this.renderGridLines();
        }
    }

    drawTile(ctx, tileData, dx, dy, destSize = this.tileSize) {
        const img = this.tilesets[tileData.tileset];
        if (!img) return;

        const sx = tileData.c * this.sourceTileSize;
        const sy = tileData.r * this.sourceTileSize;

        ctx.drawImage(
            img,
            sx, sy, this.sourceTileSize, this.sourceTileSize,
            dx, dy, destSize, destSize
        );
    }

    renderCollisionOverlay() {
        this.ctx.save();
        this.ctx.font = 'bold 13px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const x = c * this.tileSize;
                const y = r * this.tileSize;

                // 1: Sólido / Bloqueado (Rojo)
                if (this.solidGrid[r][c]) {
                    this.ctx.fillStyle = 'rgba(230, 57, 70, 0.45)';
                    this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                    this.ctx.strokeStyle = '#e63946';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x + 0.5, y + 0.5, this.tileSize - 1, this.tileSize - 1);
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.fillText('1', x + 16, y + 16);
                }
                // C: Hierba Silvestre (Verde oscuro / Púrpura)
                else if (this.tallGrassGrid[r][c]) {
                    this.ctx.fillStyle = 'rgba(85, 166, 48, 0.45)';
                    this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                    this.ctx.strokeStyle = '#55a630';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x + 0.5, y + 0.5, this.tileSize - 1, this.tileSize - 1);
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.fillText('C', x + 16, y + 16);
                }
            }
        }
        this.ctx.restore();
    }

    renderGridLines() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        // Líneas verticales
        for (let c = 0; c <= this.cols; c++) {
            const x = c * this.tileSize;
            this.ctx.moveTo(x + 0.5, 0);
            this.ctx.lineTo(x + 0.5, this.mapCanvas.height);
        }
        // Líneas horizontales
        for (let r = 0; r <= this.rows; r++) {
            const y = r * this.tileSize;
            this.ctx.moveTo(0, y + 0.5);
            this.ctx.lineTo(this.mapCanvas.width, y + 0.5);
        }

        this.ctx.stroke();
        this.ctx.restore();
    }

    // ============================================================
    // PALETA DE TILESET INTERACTIVA
    // ============================================================
    renderPalette() {
        const img = this.tilesets[this.currentTilesetKey];
        if (!img) return;

        // Ajustar tamaño del canvas de la paleta según el tileset escalado a 2x
        const cols = Math.floor(img.width / this.sourceTileSize);
        const rows = Math.floor(img.height / this.sourceTileSize);

        const scaledTile = this.sourceTileSize * this.paletteScale; // 32px
        this.paletteCanvas.width = cols * scaledTile;
        this.paletteCanvas.height = rows * scaledTile;

        this.paletteCtx.clearRect(0, 0, this.paletteCanvas.width, this.paletteCanvas.height);

        // Dibujar tileset escalado nítido
        this.paletteCtx.drawImage(
            img,
            0, 0, img.width, img.height,
            0, 0, this.paletteCanvas.width, this.paletteCanvas.height
        );

        // Cuadrícula en la paleta
        this.paletteCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.paletteCtx.lineWidth = 1;
        this.paletteCtx.beginPath();
        for (let c = 0; c <= cols; c++) {
            this.paletteCtx.moveTo(c * scaledTile + 0.5, 0);
            this.paletteCtx.lineTo(c * scaledTile + 0.5, this.paletteCanvas.height);
        }
        for (let r = 0; r <= rows; r++) {
            this.paletteCtx.moveTo(0, r * scaledTile + 0.5);
            this.paletteCtx.lineTo(this.paletteCanvas.width, r * scaledTile + 0.5);
        }
        this.paletteCtx.stroke();

        // Resaltar sello/selección actual
        if (this.selectedStamp.tileset === this.currentTilesetKey) {
            const sx = this.selectedStamp.startC * scaledTile;
            const sy = this.selectedStamp.startR * scaledTile;
            const sw = this.selectedStamp.w * scaledTile;
            const sh = this.selectedStamp.h * scaledTile;

            this.paletteCtx.strokeStyle = '#ffbe0b';
            this.paletteCtx.lineWidth = 3;
            this.paletteCtx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);

            this.paletteCtx.fillStyle = 'rgba(255, 190, 11, 0.25)';
            this.paletteCtx.fillRect(sx, sy, sw, sh);
        }
    }

    updateBrushPreview() {
        this.brushCtx.clearRect(0, 0, this.brushCanvas.width, this.brushCanvas.height);

        const stamp = this.selectedStamp;
        const img = this.tilesets[stamp.tileset];
        const infoEl = document.getElementById('brushInfoText');

        if (this.activeLayer === 'collision') {
            // Previsualización de permiso
            this.brushCtx.save();
            this.brushCtx.font = 'bold 24px monospace';
            this.brushCtx.textAlign = 'center';
            this.brushCtx.textBaseline = 'middle';
            if (this.selectedPerm === 'solid') {
                this.brushCtx.fillStyle = '#e63946';
                this.brushCtx.fillRect(8, 8, 48, 48);
                this.brushCtx.fillStyle = '#fff';
                this.brushCtx.fillText('1', 32, 32);
                if (infoEl) infoEl.innerHTML = '<strong>Permiso:</strong> [1 - Sólido]<br>Bloquea el paso.';
            } else if (this.selectedPerm === 'walkable') {
                this.brushCtx.fillStyle = '#2ec4b6';
                this.brushCtx.fillRect(8, 8, 48, 48);
                this.brushCtx.fillStyle = '#0b0f19';
                this.brushCtx.fillText('0', 32, 32);
                if (infoEl) infoEl.innerHTML = '<strong>Permiso:</strong> [0 - Paso Libre]<br>Camino transitable.';
            } else {
                this.brushCtx.fillStyle = '#55a630';
                this.brushCtx.fillRect(8, 8, 48, 48);
                this.brushCtx.fillStyle = '#fff';
                this.brushCtx.fillText('C', 32, 32);
                if (infoEl) infoEl.innerHTML = '<strong>Permiso:</strong> [C - Hierba Alta]<br>Encuentros salvajes.';
            }
            this.brushCtx.restore();
            return;
        }

        if (!img) return;

        // Dibujar el sello seleccionado en el preview centrado
        const drawW = Math.min(64, stamp.w * 32);
        const drawH = Math.min(64, stamp.h * 32);
        const startX = (64 - drawW) / 2;
        const startY = (64 - drawH) / 2;

        const srcX = stamp.startC * this.sourceTileSize;
        const srcY = stamp.startR * this.sourceTileSize;
        const srcW = stamp.w * this.sourceTileSize;
        const srcH = stamp.h * this.sourceTileSize;

        this.brushCtx.drawImage(img, srcX, srcY, srcW, srcH, startX, startY, drawW, drawH);

        if (infoEl) {
            infoEl.innerHTML = `
                <strong>Tileset:</strong> ${stamp.tileset}<br>
                <strong>Bloque:</strong> ${stamp.w} x ${stamp.h} losas (F:${stamp.startR}, C:${stamp.startC})
            `;
        }
    }

    // ============================================================
    // EVENTOS DE LA PALETA
    // ============================================================
    initPaletteEvents() {
        const selector = document.getElementById('tilesetSelector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.currentTilesetKey = e.target.value;
                this.selectedStamp.tileset = this.currentTilesetKey;
                this.renderPalette();
                this.updateBrushPreview();
            });
        }

        this.paletteCanvas.addEventListener('mousedown', (e) => {
            const rect = this.paletteCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const scaledTile = this.sourceTileSize * this.paletteScale;

            const c = Math.floor(x / scaledTile);
            const r = Math.floor(y / scaledTile);

            this.isPaletteSelecting = true;
            this.paletteDragStart = { c, r };

            this.setStampSelection(c, r, c, r);
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isPaletteSelecting) return;
            const rect = this.paletteCanvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width - 1, e.clientX - rect.left));
            const y = Math.max(0, Math.min(rect.height - 1, e.clientY - rect.top));
            const scaledTile = this.sourceTileSize * this.paletteScale;

            const curC = Math.floor(x / scaledTile);
            const curR = Math.floor(y / scaledTile);

            this.setStampSelection(this.paletteDragStart.c, this.paletteDragStart.r, curC, curR);
        });

        window.addEventListener('mouseup', () => {
            if (this.isPaletteSelecting) {
                this.isPaletteSelecting = false;
            }
        });
    }

    setStampSelection(c1, r1, c2, r2) {
        const minC = Math.min(c1, c2);
        const maxC = Math.max(c1, c2);
        const minR = Math.min(r1, r2);
        const maxR = Math.max(r1, r2);

        const w = maxC - minC + 1;
        const h = maxR - minR + 1;

        const tiles = [];
        for (let dr = 0; dr < h; dr++) {
            tiles[dr] = [];
            for (let dc = 0; dc < w; dc++) {
                tiles[dr][dc] = { r: minR + dr, c: minC + dc };
            }
        }

        this.selectedStamp = {
            tileset: this.currentTilesetKey,
            startR: minR,
            startC: minC,
            w,
            h,
            tiles
        };

        this.renderPalette();
        this.updateBrushPreview();
    }

    // ============================================================
    // EVENTOS DEL MAPA Y HERRAMIENTAS DE DIBUJO
    // ============================================================
    initMapEvents() {
        this.mapCanvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || e.button === 2 || e.shiftKey) {
                // Arrastre / Pan con clic central o clic derecho o Shift+clic
                e.preventDefault();
                this.isPanning = true;
                this.panStart = {
                    x: e.clientX,
                    y: e.clientY,
                    scrollLeft: this.viewport.scrollLeft,
                    scrollTop: this.viewport.scrollTop
                };
                this.viewport.classList.add('panning');
                return;
            }

            if (e.button === 0) {
                this.isMouseDown = true;
                const { col, row } = this.getTileAtMouse(e);
                this.pushHistory(`Pintar con ${this.activeTool}`);
                this.applyToolAt(col, row);
            }
        });

        this.mapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.panStart.x;
                const dy = e.clientY - this.panStart.y;
                this.viewport.scrollLeft = this.panStart.scrollLeft - dx;
                this.viewport.scrollTop = this.panStart.scrollTop - dy;
                return;
            }

            const { col, row } = this.getTileAtMouse(e);
            this.updateStatusCoords(col, row);

            if (this.isMouseDown && (col !== this.hoverTile.col || row !== this.hoverTile.row)) {
                this.applyToolAt(col, row);
            }

            this.hoverTile = { col, row };
        });

        window.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.viewport.classList.remove('panning');
            }
            if (this.isMouseDown) {
                this.isMouseDown = false;
                this.renderMinimap();
            }
        });

        // Zoom con la rueda del ratón
        this.viewport.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.15 : -0.15;
                this.setZoom(this.zoom + delta);
            }
        }, { passive: false });
    }

    getTileAtMouse(e) {
        const rect = this.mapCanvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        // Escalar por zoom
        const scaleX = this.mapCanvas.width / rect.width;
        const scaleY = this.mapCanvas.height / rect.height;

        const x = clientX * scaleX;
        const y = clientY * scaleY;

        const col = Math.floor(x / this.tileSize);
        const row = Math.floor(y / this.tileSize);

        return { col, row, px: Math.round(x), py: Math.round(y) };
    }

    applyToolAt(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;

        if (this.activeTool === 'pencil') {
            this.paintStampAt(col, row);
        } else if (this.activeTool === 'eraser') {
            this.eraseAt(col, row);
        } else if (this.activeTool === 'picker') {
            this.pickTileAt(col, row);
        } else if (this.activeTool === 'fill') {
            this.floodFillAt(col, row);
        }

        this.renderMap();
    }

    paintStampAt(baseCol, baseRow) {
        if (this.activeLayer === 'collision') {
            // Pintar colisión / permiso
            if (this.selectedPerm === 'solid') {
                this.solidGrid[baseRow][baseCol] = 1;
                this.tallGrassGrid[baseRow][baseCol] = 0;
            } else if (this.selectedPerm === 'tall_grass') {
                this.tallGrassGrid[baseRow][baseCol] = 1;
                this.solidGrid[baseRow][baseCol] = 0;
            } else {
                this.solidGrid[baseRow][baseCol] = 0;
                this.tallGrassGrid[baseRow][baseCol] = 0;
            }
            return;
        }

        // Pintar suelo o decoración usando el sello (stamp)
        const stamp = this.selectedStamp;
        for (let dr = 0; dr < stamp.h; dr++) {
            for (let dc = 0; dc < stamp.w; dc++) {
                const targetC = baseCol + dc;
                const targetR = baseRow + dr;
                if (targetC >= 0 && targetC < this.cols && targetR >= 0 && targetR < this.rows) {
                    const tileInfo = stamp.tiles[dr][dc];
                    const entry = {
                        tileset: stamp.tileset,
                        r: tileInfo.r,
                        c: tileInfo.c
                    };

                    if (this.activeLayer === 'ground') {
                        this.groundGrid[targetR][targetC] = entry;
                    } else if (this.activeLayer === 'decor') {
                        this.decorGrid[targetR][targetC] = entry;
                    }
                }
            }
        }
    }

    eraseAt(col, row) {
        if (this.activeLayer === 'ground') {
            this.groundGrid[row][col] = { tileset: 'GRASS+.png', r: 0, c: 0 };
        } else if (this.activeLayer === 'decor') {
            this.decorGrid[row][col] = null;
        } else if (this.activeLayer === 'collision') {
            this.solidGrid[row][col] = 0;
            this.tallGrassGrid[row][col] = 0;
        }
    }

    pickTileAt(col, row) {
        let picked = null;
        if (this.activeLayer === 'decor' && this.decorGrid[row][col]) {
            picked = this.decorGrid[row][col];
        } else if (this.groundGrid[row][col]) {
            picked = this.groundGrid[row][col];
        }

        if (picked) {
            this.currentTilesetKey = picked.tileset;
            const selector = document.getElementById('tilesetSelector');
            if (selector) selector.value = picked.tileset;
            this.setStampSelection(picked.c, picked.r, picked.c, picked.r);
            this.setActiveTool('pencil');
            this.showToast(`Tile clonado: [${picked.tileset}, r:${picked.r}, c:${picked.c}]`);
        }
    }

    floodFillAt(startCol, startRow) {
        if (this.activeLayer === 'collision') {
            const targetVal = this.solidGrid[startRow][startCol];
            const newVal = (this.selectedPerm === 'solid') ? 1 : 0;
            if (targetVal === newVal) return;

            const queue = [[startCol, startRow]];
            const visited = new Set();

            while (queue.length > 0) {
                const [c, r] = queue.pop();
                const key = `${c},${r}`;
                if (visited.has(key)) continue;
                visited.add(key);

                if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) continue;
                if (this.solidGrid[r][c] !== targetVal) continue;

                this.solidGrid[r][c] = newVal;
                if (newVal === 1) this.tallGrassGrid[r][c] = 0;

                queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
            }
            return;
        }

        // Relleno de Suelo
        if (this.activeLayer === 'ground') {
            const targetTile = this.groundGrid[startRow][startCol];
            const newTile = {
                tileset: this.selectedStamp.tileset,
                r: this.selectedStamp.startR,
                c: this.selectedStamp.startC
            };

            if (targetTile && targetTile.tileset === newTile.tileset && targetTile.r === newTile.r && targetTile.c === newTile.c) {
                return;
            }

            const queue = [[startCol, startRow]];
            const visited = new Set();

            while (queue.length > 0 && visited.size < 5000) {
                const [c, r] = queue.pop();
                const key = `${c},${r}`;
                if (visited.has(key)) continue;
                visited.add(key);

                if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) continue;
                const cur = this.groundGrid[r][c];
                if (!cur) continue;
                if (cur.tileset !== targetTile.tileset || cur.r !== targetTile.r || cur.c !== targetTile.c) continue;

                this.groundGrid[r][c] = { ...newTile };

                queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
            }
        }
    }

    autoDetectCollisions() {
        let count = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const dec = this.decorGrid[r][c];
                const gnd = this.groundGrid[r][c];

                // Cercas de madera o rocas en decorGrid
                if (dec) {
                    if (dec.tileset === 'GRASS+.png' && (dec.r === 12 && dec.c >= 2)) {
                        this.solidGrid[r][c] = 1;
                        count++;
                    } else if (dec.tileset === 'GRASS+.png' && (dec.c === 10 || dec.c === 11)) {
                        this.solidGrid[r][c] = 1;
                        count++;
                    } else if (dec.tileset === 'Water+.png' && dec.r === 11 && dec.c === 4) {
                        this.solidGrid[r][c] = 1; // Juncos
                        count++;
                    }
                }

                // Agua profunda en groundGrid
                if (gnd && gnd.tileset === 'Water+.png') {
                    this.solidGrid[r][c] = 1;
                    count++;
                }

                // Hierba alta en groundGrid
                if (gnd && gnd.tileset === 'GRASS+.png' && (gnd.r === 8 || gnd.r === 10)) {
                    this.tallGrassGrid[r][c] = 1;
                }
            }
        }
        this.pushHistory('Auto-generar colisiones');
        this.renderMap();
        this.renderMinimap();
        this.showToast(`¡Auto-detección completada! ${count} losas actualizadas.`);
    }

    // ============================================================
    // MINIMAPA NAVEGADOR
    // ============================================================
    renderMinimap() {
        this.minimapCtx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
        const scaleX = this.minimapCanvas.width / this.cols;
        const scaleY = this.minimapCanvas.height / this.rows;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const g = this.groundGrid[r][c];
                const d = this.decorGrid[r][c];
                const s = this.solidGrid[r][c];

                let color = '#2d6a14'; // Pasto por defecto
                if (g && g.tileset === 'Water+.png') color = '#0077b6';
                else if (g && g.tileset === 'GRASS+.png' && g.c >= 13) color = '#d4a373'; // Caminos
                if (d && d.tileset === 'GRASS+.png' && (d.c === 1 || d.c === 3 || d.c === 5)) color = '#ffbe0b'; // Flores
                if (s) color = '#e63946'; // Sólidos

                this.minimapCtx.fillStyle = color;
                this.minimapCtx.fillRect(c * scaleX, r * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
            }
        }
    }

    initMinimapEvents() {
        this.minimapCanvas.addEventListener('click', (e) => {
            const rect = this.minimapCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const col = Math.floor((x / rect.width) * this.cols);
            const row = Math.floor((y / rect.height) * this.rows);

            this.centerViewportOnTile(col, row);
        });
    }

    centerViewportOnTile(col, row) {
        const px = col * this.tileSize * this.zoom;
        const py = row * this.tileSize * this.zoom;

        this.viewport.scrollLeft = px - this.viewport.clientWidth / 2;
        this.viewport.scrollTop = py - this.viewport.clientHeight / 2;
    }

    // ============================================================
    // CONTROLES DE ZOOM Y VIEWPORT
    // ============================================================
    setZoom(val) {
        this.zoom = Math.max(0.4, Math.min(2.5, val));
        this.canvasWrapper.style.transform = `scale(${this.zoom})`;
        document.getElementById('zoomLevelDisplay').textContent = `${Math.round(this.zoom * 100)}%`;
    }

    // ============================================================
    // CONFIGURACIÓN DE EVENTOS DE INTERFAZ
    // ============================================================
    initUIEvents() {
        // Pestañas de capa
        document.querySelectorAll('.layer-tab-btn[data-layer]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setActiveLayer(btn.dataset.layer);
            });
        });

        // Botones de herramientas
        document.getElementById('toolPencil').addEventListener('click', () => this.setActiveTool('pencil'));
        document.getElementById('toolFill').addEventListener('click', () => this.setActiveTool('fill'));
        document.getElementById('toolEraser').addEventListener('click', () => this.setActiveTool('eraser'));
        document.getElementById('toolPicker').addEventListener('click', () => this.setActiveTool('picker'));

        // Deshacer / Rehacer
        document.getElementById('btnUndo').addEventListener('click', () => this.undo());
        document.getElementById('btnRedo').addEventListener('click', () => this.redo());

        // Alternar Cuadrícula
        const gridBtn = document.getElementById('btnToggleGrid');
        gridBtn.addEventListener('click', () => {
            this.showGrid = !this.showGrid;
            gridBtn.classList.toggle('active', this.showGrid);
            this.renderMap();
        });

        // Alternar Overlay de Colisiones
        const colBtn = document.getElementById('btnToggleCollisionsOverlay');
        colBtn.addEventListener('click', () => {
            this.showCollisionOverlay = !this.showCollisionOverlay;
            colBtn.classList.toggle('active', this.showCollisionOverlay);
            this.renderMap();
        });

        // Selector de tipo de permiso de paso
        document.querySelectorAll('.perm-card[data-perm]').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.perm-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedPerm = card.dataset.perm;
                this.updateBrushPreview();
            });
        });

        // Botón auto-colisiones
        document.getElementById('btnAutoCollisions').addEventListener('click', () => {
            this.autoDetectCollisions();
        });

        // Zoom buttons
        document.getElementById('btnZoomIn').addEventListener('click', () => this.setZoom(this.zoom + 0.25));
        document.getElementById('btnZoomOut').addEventListener('click', () => this.setZoom(this.zoom - 0.25));
        document.getElementById('btnResetView').addEventListener('click', () => {
            this.setZoom(1.0);
            this.centerViewportOnTile(60, 45);
        });

        // Botón Guardar en Servidor
        document.getElementById('btnSaveServer').addEventListener('click', async () => {
            await this.saveMapToServer();
        });

        // Botón Exportar JSON local
        document.getElementById('btnExportJson').addEventListener('click', () => {
            const data = this.getExportableMapData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'world_map.json';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('📥 world_map.json descargado.');
        });

        // Importar JSON local
        const importInput = document.getElementById('fileImportJson');
        importInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const json = JSON.parse(ev.target.result);
                        this.applyMapData(json);
                        this.pushHistory('Importar archivo JSON');
                        this.renderMap();
                        this.renderMinimap();
                        this.showToast('📂 Mapa importado correctamente.');
                    } catch (err) {
                        alert('Error al leer el archivo JSON: ' + err.message);
                    }
                };
                reader.readAsText(e.target.files[0]);
            }
        });
    }

    setActiveLayer(layer) {
        this.activeLayer = layer;
        document.querySelectorAll('.layer-tab-btn[data-layer]').forEach(b => {
            b.classList.toggle('active', b.dataset.layer === layer);
        });

        const colSection = document.getElementById('collisionPaletteSection');
        if (colSection) {
            colSection.style.display = (layer === 'collision') ? 'block' : 'none';
        }

        this.updateBrushPreview();
        this.updateStatusMode();
    }

    setActiveTool(tool) {
        this.activeTool = tool;
        document.querySelectorAll('.tool-btn[id^="tool"]').forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById(`tool${tool.charAt(0).toUpperCase() + tool.slice(1)}`);
        if (activeBtn) activeBtn.classList.add('active');
        this.updateStatusMode();
    }

    updateStatusMode() {
        const modeEl = document.getElementById('statusMode');
        if (modeEl) {
            const layerNames = { ground: 'Suelo', decor: 'Decoración', collision: 'Permisos (Colisiones)' };
            const toolNames = { pencil: 'Lápiz', fill: 'Relleno', eraser: 'Borrador', picker: 'Pipeta' };
            modeEl.innerHTML = `Capa: <strong>${layerNames[this.activeLayer]}</strong> | Herramienta: <strong>${toolNames[this.activeTool]}</strong>`;
        }
    }

    updateStatusCoords(col, row) {
        const coordsEl = document.getElementById('statusCoords');
        if (coordsEl) {
            const px = col * this.tileSize;
            const py = row * this.tileSize;
            coordsEl.textContent = `📍 Losa: X: ${col}, Y: ${row} | Píxel: X: ${px}, Y: ${py}`;
        }

        const zoneEl = document.getElementById('statusZone');
        if (zoneEl) {
            let zoneName = 'Ruta 1';
            if (col >= 44 && col <= 76 && row >= 36 && row <= 54) zoneName = '🏡 Pueblo Raíz (Plaza Central)';
            else if (col <= 44 && row <= 36) zoneName = '🌊 Lago Espejo & Bahía';
            else if (col >= 76 && row <= 36) zoneName = '🌿 Selva Jurásica';
            else if (col <= 44 && row >= 54) zoneName = '🦕 Santuario Jurásico';
            else if (col >= 76 && row >= 54) zoneName = '🪨 Cañón Prehistórico';
            else if (row < 36) zoneName = '🌺 Ruta 1 Norte';
            else if (row > 54) zoneName = '🌾 Ruta 1 Sur';
            zoneEl.textContent = zoneName;
        }
    }

    initKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            // Herramientas
            if (e.key === 'p' || e.key === 'b') this.setActiveTool('pencil');
            if (e.key === 'f' || e.key === 'g') this.setActiveTool('fill');
            if (e.key === 'e') this.setActiveTool('eraser');
            if (e.key === 'i') this.setActiveTool('picker');
            if (e.key === 'h') document.getElementById('btnToggleGrid').click();

            // Capas (1, 2, 3)
            if (e.key === '1') this.setActiveLayer('ground');
            if (e.key === '2') this.setActiveLayer('decor');
            if (e.key === '3') this.setActiveLayer('collision');

            // Deshacer / Rehacer
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }

            // Guardar (Ctrl + S)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveMapToServer();
            }
        });
    }

    async saveMapToServer() {
        const btn = document.getElementById('btnSaveServer');
        if (btn) btn.textContent = '⏳ Guardando...';

        try {
            const data = this.getExportableMapData();
            const res = await fetch('/api/map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                this.showToast('✅ ¡Mapa guardado en el servidor con éxito!');
            } else {
                this.showToast('❌ Error al guardar el mapa en el servidor.');
            }
        } catch (e) {
            console.error('Error guardando mapa:', e);
            this.showToast('❌ Error de conexión al guardar.');
        } finally {
            if (btn) btn.textContent = '💾 Guardar en Juego';
        }
    }

    showToast(msg) {
        const toast = document.getElementById('editorToast');
        if (toast) {
            toast.textContent = msg;
            toast.style.opacity = '1';
            setTimeout(() => {
                if (toast.textContent === msg) toast.style.opacity = '0';
            }, 4000);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.advanceMapEditor = new AdvanceMapEditor();
});
