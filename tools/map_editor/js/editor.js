/**
 * Dino King - Advance Map Studio (Herramienta Externa e Independiente)
 * Editor de Mapas 2D & Permisos de Paso
 */

class AdvanceMapEditor {
    constructor() {
        this.cols = 120;
        this.rows = 90;
        this.tileSize = 32;
        this.sourceTileSize = 16;
        this.paletteScale = 4; // Cada tile de 16x16 se visualiza ampliado a 64x64 px en la paleta
        this.tilesetTileSizes = {
            'GRASS+.png': 16,
            'Water+.png': 16,
            'Bridges.png': 16,
            'exterior.png': 16,
            'arboles.png': 16,
            'pasto.png': 16,
            'caver.png': 16,
            'fairwood.png': 16
        };

        // Estado de edición
        this.activeMode = 'tile';    // 'tile', 'collision' o 'warp'
        this.activeLayerIndex = 0;   // Índice en this.layers (0 = suelo, 1 = decoración, etc.)
        this.activeTool = 'pencil';  // 'pencil', 'fill', 'eraser', 'picker'
        this.selectedPerm = 'solid'; // 'solid', 'walkable', 'tall_grass'
        this.showGrid = true;
        this.showCollisionOverlay = true;

        // Warps & Conexiones entre mapas
        this.warps = [];
        this.showWarpsOverlay = true;
        this.selectedWarpIndex = -1;
        this.warpEditingTile = null;

        // Personajes fijos / Eventos de combate (entrenadores y NPCs)
        this.npcs = [];
        this.showNpcsOverlay = true;
        this.selectedNpcIndex = -1;
        this.npcEditingTile = null;
        this.characterSprites = [];   // nombres de PNG en assets/characters
        this.characterImages = {};    // nombre -> Image
        this.dinoCatalog = { elements: {}, dinos: [], attacks: [] }; // assets/dinos/dinos.json

        // Proyectos
        this.currentProjectName = 'proyecto_actual.json';
        this.projectList = [];

        // Tilesets disponibles
        this.tilesets = {}; // filename -> Image
        this.currentTilesetKey = 'GRASS+.png';
        this.tilesetNames = ['GRASS+.png', 'Water+.png'];

        // Sello / Pincel seleccionado (soporta bloques multi-tile)
        this.selectedStamp = {
            tileset: 'GRASS+.png',
            startR: 0,
            startC: 0,
            w: 1,
            h: 1,
            tiles: [[{ r: 0, c: 0, srcSize: 16 }]],
            srcSize: 16
        };

        // Capas Dinámicas Multicapa: [{ id, name, type, visible, grid }]
        this.layers = [];
        this.solidGrid = [];
        this.tallGrassGrid = [];

        // Historial (Undo / Redo)
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 30;

        // Viewport y zoom
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
        this.isPanning = false;
        this.panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };
        this.hoverTile = { col: -1, row: -1 };
        this.isPaletteSelecting = false;
        this.paletteDragStart = { c: 0, r: 0 };

        this.init();
    }

    async init() {
        this.showToast('Inicializando Advance Map Studio...');

        this.initEmptyGrids();
        await this.loadTilesetList();
        await this.loadTilesetImages();
        await this.loadCharacterList();
        await this.loadDinoCatalog();
        await this.loadProjectList();
        await this.loadProject(this.currentProjectName);

        this.initUIEvents();
        this.initMapEvents();
        this.initPaletteEvents();
        this.initMinimapEvents();
        this.initKeyboardShortcuts();

        this.updatePaletteControlsUI();
        this.renderPalette();
        this.updateBrushPreview();
        this.renderLayersPanel();
        this.renderMap();
        this.renderMinimap();

        this.centerViewportOnTile(60, 45);
        this.showToast('¡Herramienta lista! Puedes diseñar libremente sin alterar el juego.');
    }

    // ============================================================
    // CARGA DE TILESETS Y PROYECTOS DESDE EL SERVIDOR LOCAL
    // ============================================================
    async loadTilesetList() {
        try {
            const res = await fetch('/api/tilesets');
            if (res.ok) {
                this.tilesetNames = await res.json();
                if (!this.tilesetNames.includes(this.currentTilesetKey) && this.tilesetNames.length > 0) {
                    this.currentTilesetKey = this.tilesetNames[0];
                }
                this.sourceTileSize = this.getTilesetTileSize(this.currentTilesetKey);
                this.updateTilesetDropdown();
                this.updatePaletteControlsUI();
            }
        } catch (e) {
            console.warn('Error cargando lista de tilesets:', e);
        }
    }

    updateTilesetDropdown() {
        const selector = document.getElementById('tilesetSelector');
        if (!selector) return;
        selector.innerHTML = '';
        this.tilesetNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            selector.appendChild(opt);
        });
        selector.value = this.currentTilesetKey;
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
                    console.warn('Error cargando imagen tileset:', name);
                    resolve(null);
                };
                img.src = `/assets/maps/${name}`;
            });
        });
        return Promise.all(promises);
    }

    async loadProjectList() {
        try {
            const res = await fetch('/api/projects');
            if (res.ok) {
                this.projectList = await res.json();
                const sel = document.getElementById('projectSelect');
                if (sel) {
                    sel.innerHTML = '';
                    this.projectList.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p;
                        opt.textContent = p.replace('.json', '');
                        sel.appendChild(opt);
                    });
                    if (this.projectList.includes(this.currentProjectName)) {
                        sel.value = this.currentProjectName;
                    }
                }

                // Actualizar selector de destinos de Warp
                const warpTargetSel = document.getElementById('warpTargetMapSelect');
                if (warpTargetSel) {
                    const currentVal = warpTargetSel.value;
                    warpTargetSel.innerHTML = '';
                    this.projectList.forEach(p => {
                        const mapId = p.replace('.json', '');
                        const opt = document.createElement('option');
                        opt.value = mapId;
                        opt.textContent = mapId;
                        warpTargetSel.appendChild(opt);
                    });
                    if (currentVal && Array.from(warpTargetSel.options).some(o => o.value === currentVal)) {
                        warpTargetSel.value = currentVal;
                    }
                }
            }
        } catch (e) {
            console.warn('Error cargando lista de proyectos:', e);
        }
    }

    async loadProject(name) {
        try {
            const res = await fetch(`/api/project?name=${encodeURIComponent(name)}`);
            if (res.ok) {
                const data = await res.json();
                this.currentProjectName = name;
                this.applyMapData(data);
                this.history = [];
                this.historyIndex = -1;
                this.pushHistory('Cargar proyecto: ' + name);
                this.renderMap();
                this.renderMinimap();
                this.showToast(`Borrador cargado: "${name}"`);
            }
        } catch (e) {
            console.warn('Error cargando proyecto:', e);
        }
    }

    initEmptyGrids() {
        this.layers = [
            {
                id: 'layer_0',
                name: 'Suelo Base',
                type: 'ground',
                visible: true,
                grid: []
            },
            {
                id: 'layer_1',
                name: 'Decoración',
                type: 'decor',
                visible: true,
                grid: []
            }
        ];
        this.solidGrid = [];
        this.tallGrassGrid = [];

        for (let r = 0; r < this.rows; r++) {
            this.layers[0].grid[r] = [];
            this.layers[1].grid[r] = [];
            this.solidGrid[r] = [];
            this.tallGrassGrid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.layers[0].grid[r][c] = { tileset: 'GRASS+.png', r: 0, c: 0 };
                this.layers[1].grid[r][c] = null;
                this.solidGrid[r][c] = 0;
                this.tallGrassGrid[r][c] = 0;
            }
        }
        this.activeMode = 'tile';
        this.activeLayerIndex = 0;
    }

    applyMapData(data) {
        if (!data) return;
        this.cols = data.cols || 120;
        this.rows = data.rows || 90;
        if (data.sourceTileSize) {
            this.sourceTileSize = data.sourceTileSize;
        }
        if (data.tilesetTileSizes && typeof data.tilesetTileSizes === 'object') {
            Object.assign(this.tilesetTileSizes, data.tilesetTileSizes);
        }

        if (data.layers && Array.isArray(data.layers) && data.layers.length > 0) {
            this.layers = data.layers.map((lData, idx) => {
                const grid = [];
                for (let r = 0; r < this.rows; r++) {
                    grid[r] = [];
                    for (let c = 0; c < this.cols; c++) {
                        const cell = lData.grid && lData.grid[r] ? lData.grid[r][c] : null;
                        if (cell && Array.isArray(cell)) {
                            let ts = cell[0];
                            if (ts === 'grass') ts = 'GRASS+.png';
                            if (ts === 'water') ts = 'Water+.png';
                            if (!ts.endsWith('.png')) ts += '.png';
                            const cellSrcSz = cell[3] || this.getTilesetTileSize(ts);
                            grid[r][c] = { tileset: ts, r: cell[1], c: cell[2], srcSize: cellSrcSz };
                        } else if (cell && typeof cell === 'object' && cell.tileset) {
                            grid[r][c] = { ...cell, srcSize: cell.srcSize || this.getTilesetTileSize(cell.tileset) };
                        } else {
                            grid[r][c] = null;
                        }
                    }
                }
                return {
                    id: lData.id || `layer_${idx}`,
                    name: lData.name || (idx === 0 ? 'Suelo Base' : `Capa ${idx + 1}`),
                    type: idx === 0 ? 'ground' : (idx === 1 ? 'decor' : 'custom'),
                    visible: lData.visible !== false,
                    grid: grid
                };
            });
        } else if (data.ground) {
            // Formato anterior (ground + decor)
            const gGrid = [];
            const dGrid = [];
            for (let r = 0; r < this.rows; r++) {
                gGrid[r] = [];
                dGrid[r] = [];
                for (let c = 0; c < this.cols; c++) {
                    const g = data.ground[r] ? data.ground[r][c] : null;
                    if (g && Array.isArray(g)) {
                        let ts = g[0];
                        if (ts === 'grass') ts = 'GRASS+.png';
                        if (ts === 'water') ts = 'Water+.png';
                        if (!ts.endsWith('.png')) ts += '.png';
                        gGrid[r][c] = { tileset: ts, r: g[1], c: g[2] };
                    } else {
                        gGrid[r][c] = { tileset: 'GRASS+.png', r: 0, c: 0 };
                    }

                    const d = data.decor && data.decor[r] ? data.decor[r][c] : null;
                    if (d && Array.isArray(d)) {
                        let ts = d[0];
                        if (ts === 'grass') ts = 'GRASS+.png';
                        if (ts === 'water') ts = 'Water+.png';
                        if (!ts.endsWith('.png')) ts += '.png';
                        dGrid[r][c] = { tileset: ts, r: d[1], c: d[2] };
                    } else {
                        dGrid[r][c] = null;
                    }
                }
            }
            this.layers = [
                { id: 'layer_0', name: 'Suelo Base', type: 'ground', visible: true, grid: gGrid },
                { id: 'layer_1', name: 'Decoración', type: 'decor', visible: true, grid: dGrid }
            ];
        }

        // Colisiones y hierba alta
        this.solidGrid = [];
        this.tallGrassGrid = [];
        for (let r = 0; r < this.rows; r++) {
            this.solidGrid[r] = [];
            this.tallGrassGrid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.solidGrid[r][c] = (data.solid && data.solid[r]) ? data.solid[r][c] : 0;
                this.tallGrassGrid[r][c] = (data.tallGrass && data.tallGrass[r]) ? data.tallGrass[r][c] : 0;
            }
        }

        // Warps & Conexiones entre mapas
        this.warps = Array.isArray(data.warps) ? JSON.parse(JSON.stringify(data.warps)) : [];
        this.selectedWarpIndex = -1;
        this.warpEditingTile = null;

        // Personajes fijos / Eventos de combate
        this.npcs = Array.isArray(data.npcs) ? JSON.parse(JSON.stringify(data.npcs)) : [];
        this.selectedNpcIndex = -1;
        this.npcEditingTile = null;

        // Ajustar tamaño del lienzo al tamaño de este mapa
        this.mapCanvas.width = this.cols * this.tileSize;
        this.mapCanvas.height = this.rows * this.tileSize;
        this.ctx.imageSmoothingEnabled = false;

        this.activeLayerIndex = Math.min(this.activeLayerIndex, Math.max(0, this.layers.length - 1));
        this.renderLayersPanel();
        this.renderWarpsList();
        this.renderNpcsList();
        this.updateDimensionsDisplay();
    }

    updateDimensionsDisplay() {
        const dimEl = document.getElementById('statusDims');
        if (dimEl) dimEl.textContent = `📐 Dimensiones: ${this.cols} x ${this.rows} losas`;
    }

    getExportableMapData() {
        const mapNameClean = (this.currentProjectName || 'world_map').replace('.json', '');
        const data = {
            version: 2,
            name: mapNameClean,
            cols: this.cols,
            rows: this.rows,
            tileSize: this.tileSize,
            sourceTileSize: this.sourceTileSize,
            tilesetTileSizes: this.tilesetTileSizes,
            tilesets: {
                "grass": "GRASS+.png",
                "water": "Water+.png",
                "bridges": "Bridges.png",
                "exterior": "exterior.png"
            },
            layers: this.layers.map(l => ({
                id: l.id,
                name: l.name,
                visible: l.visible,
                grid: l.grid.map(row => row.map(c => {
                    if (!c) return null;
                    let tsName = c.tileset.replace('.png', '').toLowerCase();
                    if (tsName === 'grass+') tsName = 'grass';
                    if (tsName === 'water+') tsName = 'water';
                    if (tsName === 'bridges') tsName = 'bridges';
                    return [tsName, c.r, c.c, c.srcSize || this.getTilesetTileSize(c.tileset)];
                }))
            })),
            // Warps y teletransportes entre mapas
            warps: (this.warps || []).map(w => ({
                x: Number(w.x),
                y: Number(w.y),
                targetMap: (w.targetMap || 'world_map').replace('.json', ''),
                targetX: Number(w.targetX !== undefined ? w.targetX : 0),
                targetY: Number(w.targetY !== undefined ? w.targetY : 0),
                desc: w.desc || ''
            })),
            // Personajes fijos / Eventos de combate
            npcs: (this.npcs || []).map(n => ({
                id: n.id,
                x: Number(n.x),
                y: Number(n.y),
                name: n.name || '',
                sprite: n.sprite || '',
                direction: n.direction || 'down',
                type: ['npc', 'tutor'].includes(n.type) ? n.type : 'trainer',
                sightRange: Number(n.sightRange) || 0,
                dialog: n.dialog || '',
                defeatDialog: n.defeatDialog || '',
                team: Array.isArray(n.team) ? n.team.slice(0, 3).map(m => ({
                    species: m.species,
                    name: m.name || m.species,
                    element: m.element || 'normal',
                    image: m.image || '',
                    card: m.card || '',
                    level: Number(m.level) || 1,
                    attacks: Array.isArray(m.attacks) ? m.attacks.slice(0, 3) : []
                })) : [],
                moveCard: n.moveCard || null,
                rewardExp: Number(n.rewardExp) || 0
            })),
            // Compatibilidad hacia atrás:
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
                const g = this.layers[0] ? this.layers[0].grid[r][c] : null;
                let gName = g ? g.tileset.replace('.png', '').toLowerCase() : 'grass';
                if (gName === 'grass+') gName = 'grass';
                if (gName === 'water+') gName = 'water';
                gRow.push(g ? [gName, g.r, g.c] : ['grass', 0, 0]);

                const d = (this.layers.length > 1 && this.layers[1]) ? this.layers[1].grid[r][c] : null;
                if (d) {
                    let dName = d.tileset.replace('.png', '').toLowerCase();
                    if (dName === 'grass+') dName = 'grass';
                    if (dName === 'water+') dName = 'water';
                    dRow.push([dName, d.r, d.c]);
                } else {
                    dRow.push(null);
                }

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
    // HISTORIAL (UNDO / REDO)
    // ============================================================
    pushHistory(actionDesc = '') {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const snapshot = {
            layers: this.layers.map(l => ({
                id: l.id,
                name: l.name,
                type: l.type,
                visible: l.visible,
                grid: l.grid.map(row => row.map(cell => cell ? { ...cell } : null))
            })),
            solid: this.solidGrid.map(row => [...row]),
            tallGrass: this.tallGrassGrid.map(row => [...row]),
            warps: JSON.parse(JSON.stringify(this.warps || [])),
            npcs: JSON.parse(JSON.stringify(this.npcs || [])),
            activeMode: this.activeMode,
            activeLayerIndex: this.activeLayerIndex,
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
        this.layers = snapshot.layers.map(l => ({
            id: l.id,
            name: l.name,
            type: l.type,
            visible: l.visible,
            grid: l.grid.map(row => row.map(cell => cell ? { ...cell } : null))
        }));
        this.solidGrid = snapshot.solid.map(row => [...row]);
        this.tallGrassGrid = snapshot.tallGrass.map(row => [...row]);
        if (snapshot.warps) {
            this.warps = JSON.parse(JSON.stringify(snapshot.warps));
            this.renderWarpsList();
        }
        if (snapshot.npcs) {
            this.npcs = JSON.parse(JSON.stringify(snapshot.npcs));
            this.selectedNpcIndex = -1;
            this.renderNpcsList();
        }
        this.activeMode = snapshot.activeMode || 'tile';
        this.activeLayerIndex = Math.min(snapshot.activeLayerIndex || 0, this.layers.length - 1);
        this.renderLayersPanel();
        this.renderMap();
        this.renderMinimap();
        this.updateStatusMode();
    }

    // ============================================================
    // RENDERIZADO DEL MAPA
    // ============================================================
    renderMap() {
        this.ctx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);

        // 1. Dibujar todas las capas de tiles activas y visibles en orden (0 = base ... N-1 = superior)
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (!layer.visible) continue;

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = layer.grid[r][c];
                    if (cell) {
                        this.drawTile(this.ctx, cell, c * this.tileSize, r * this.tileSize);
                    }
                }
            }
        }

        // 2. Permisos de paso (Capa de colisiones)
        if (this.showCollisionOverlay) {
            this.renderCollisionOverlay();
        }

        // 3. Warps & Puertas (Capa de eventos)
        if (this.showWarpsOverlay) {
            this.renderWarpsOverlay();
        }

        // 3b. Personajes fijos / Eventos de combate
        if (this.showNpcsOverlay) {
            this.renderNpcsOverlay();
        }

        // 4. Cuadrícula
        if (this.showGrid) {
            this.renderGridLines();
        }
    }

    renderWarpsOverlay() {
        if (!this.warps || this.warps.length === 0) return;

        this.ctx.save();
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (let i = 0; i < this.warps.length; i++) {
            const w = this.warps[i];
            const x = w.x * this.tileSize;
            const y = w.y * this.tileSize;
            const isSelected = (this.selectedWarpIndex === i);

            // Relleno violeta / cian
            this.ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.55)' : 'rgba(147, 51, 234, 0.45)';
            this.ctx.fillRect(x, y, this.tileSize, this.tileSize);

            // Borde brillante
            this.ctx.strokeStyle = isSelected ? '#38bdf8' : '#c084fc';
            this.ctx.lineWidth = isSelected ? 2.5 : 1.5;
            this.ctx.strokeRect(x + 1, y + 1, this.tileSize - 2, this.tileSize - 2);

            // Icono de vórtice / puerta
            this.ctx.fillText('🌀', x + 16, y + 15);
        }

        // Resaltar la losa actualmente seleccionada en modo Warp
        if (this.activeMode === 'warp' && this.warpEditingTile) {
            const ex = this.warpEditingTile.col * this.tileSize;
            const ey = this.warpEditingTile.row * this.tileSize;
            this.ctx.strokeStyle = '#f43f5e';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(ex + 1, ey + 1, this.tileSize - 2, this.tileSize - 2);
            this.ctx.setLineDash([]);
        }

        this.ctx.restore();
    }

    drawTile(ctx, tileData, dx, dy, destSize = this.tileSize) {
        const img = this.tilesets[tileData.tileset];
        if (!img) return;

        const srcSize = tileData.srcSize || this.getTilesetTileSize(tileData.tileset);
        const sx = tileData.c * srcSize;
        const sy = tileData.r * srcSize;

        ctx.drawImage(
            img,
            sx, sy, srcSize, srcSize,
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

                if (this.solidGrid[r][c]) {
                    this.ctx.fillStyle = 'rgba(230, 57, 70, 0.45)';
                    this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                    this.ctx.strokeStyle = '#e63946';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x + 0.5, y + 0.5, this.tileSize - 1, this.tileSize - 1);
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.fillText('1', x + 16, y + 16);
                } else if (this.tallGrassGrid[r][c]) {
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

        for (let c = 0; c <= this.cols; c++) {
            const x = c * this.tileSize;
            this.ctx.moveTo(x + 0.5, 0);
            this.ctx.lineTo(x + 0.5, this.mapCanvas.height);
        }
        for (let r = 0; r <= this.rows; r++) {
            const y = r * this.tileSize;
            this.ctx.moveTo(0, y + 0.5);
            this.ctx.lineTo(this.mapCanvas.width, y + 0.5);
        }

        this.ctx.stroke();
        this.ctx.restore();
    }

    // ============================================================
    // GESTIÓN DE TAMAÑO DE TILE Y ZOOM DE LA PALETA
    // ============================================================
    getTilesetTileSize(tilesetKey = this.currentTilesetKey) {
        if (!tilesetKey) return this.sourceTileSize || 16;
        if (this.tilesetTileSizes && this.tilesetTileSizes[tilesetKey]) {
            return this.tilesetTileSizes[tilesetKey];
        }
        return this.sourceTileSize || 16;
    }

    setTilesetTileSize(tilesetKey, newSize) {
        const sz = parseInt(newSize, 10) || 32;
        if (tilesetKey) {
            this.tilesetTileSizes[tilesetKey] = sz;
        }
        this.sourceTileSize = sz;
        this.setStampSelection(0, 0, 0, 0);
        this.updatePaletteControlsUI();
        this.renderPalette();
        this.updateBrushPreview();
        this.showToast(`📐 Cuadrícula de "${tilesetKey}" configurada a ${sz}x${sz} px.`);
    }

    setPaletteScale(newScale) {
        this.paletteScale = Math.max(0.25, Math.min(8.0, newScale));
        this.renderPalette();
        this.updatePaletteControlsUI();
    }

    setPaletteVisualSize(targetPx) {
        const tileSrc = this.getTilesetTileSize(this.currentTilesetKey);
        this.setPaletteScale(targetPx / tileSrc);
    }

    updatePaletteControlsUI() {
        const tileSrc = this.getTilesetTileSize(this.currentTilesetKey);
        
        // Indicador de tamaño de tile
        const sizeDisplay = document.getElementById('currentTileSizeDisplay');
        if (sizeDisplay) {
            sizeDisplay.textContent = `${tileSrc}x${tileSrc} px`;
        }
        
        // Botones de cuadrícula 16x16, 32x32, 64x64
        const sizeBtns = document.querySelectorAll('#tileSizeButtons .btn-chip');
        sizeBtns.forEach(btn => {
            const bSize = parseInt(btn.getAttribute('data-size'), 10);
            btn.classList.toggle('active', bSize === tileSrc);
        });

        // Indicador de zoom
        const visualPx = Math.round(tileSrc * this.paletteScale);
        const pct = Math.round(this.paletteScale * 100);
        const zoomDisplay = document.getElementById('paletteZoomDisplay');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${visualPx}px (${pct}%)`;
        }

        // Botones rápidos de zoom 32x32 y 64x64
        const btn32 = document.getElementById('btnZoomPalette32');
        const btn64 = document.getElementById('btnZoomPalette64');
        if (btn32) btn32.classList.toggle('active', Math.abs(visualPx - 32) <= 1);
        if (btn64) btn64.classList.toggle('active', Math.abs(visualPx - 64) <= 1);
    }

    // ============================================================
    // PALETA INTERACTIVA DE TILESETS
    // ============================================================
    renderPalette() {
        const img = this.tilesets[this.currentTilesetKey];
        if (!img) return;

        const tileSrc = this.getTilesetTileSize(this.currentTilesetKey);
        const cols = Math.max(1, Math.floor(img.width / tileSrc));
        const rows = Math.max(1, Math.floor(img.height / tileSrc));

        const scaledTile = tileSrc * this.paletteScale;
        this.paletteCanvas.width = cols * scaledTile;
        this.paletteCanvas.height = rows * scaledTile;

        this.paletteCtx.imageSmoothingEnabled = false;
        this.paletteCtx.clearRect(0, 0, this.paletteCanvas.width, this.paletteCanvas.height);

        this.paletteCtx.drawImage(
            img,
            0, 0, img.width, img.height,
            0, 0, this.paletteCanvas.width, this.paletteCanvas.height
        );

        this.paletteCtx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
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
        this.brushCtx.imageSmoothingEnabled = false;
        this.brushCtx.clearRect(0, 0, this.brushCanvas.width, this.brushCanvas.height);

        const stamp = this.selectedStamp;
        const img = this.tilesets[stamp.tileset];
        const infoEl = document.getElementById('brushInfoText');

        if (this.activeMode === 'collision') {
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

        const tileSrc = stamp.srcSize || this.getTilesetTileSize(stamp.tileset);
        const drawW = Math.min(64, stamp.w * 32);
        const drawH = Math.min(64, stamp.h * 32);
        const startX = (64 - drawW) / 2;
        const startY = (64 - drawH) / 2;

        const srcX = stamp.startC * tileSrc;
        const srcY = stamp.startR * tileSrc;
        const srcW = stamp.w * tileSrc;
        const srcH = stamp.h * tileSrc;

        this.brushCtx.drawImage(img, srcX, srcY, srcW, srcH, startX, startY, drawW, drawH);

        if (infoEl) {
            const currentLayer = this.layers[this.activeLayerIndex];
            const layerName = currentLayer ? currentLayer.name : 'Suelo Base';
            infoEl.innerHTML = `
                <strong>Tileset:</strong> ${stamp.tileset} (${tileSrc}x${tileSrc})<br>
                <strong>Bloque:</strong> ${stamp.w} x ${stamp.h} losas (F:${stamp.startR}, C:${stamp.startC})<br>
                <strong>Capa Destino:</strong> <span style="color:var(--cyan)">${layerName}</span>
            `;
        }
    }

    initPaletteEvents() {
        const selector = document.getElementById('tilesetSelector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.currentTilesetKey = e.target.value;
                this.sourceTileSize = this.getTilesetTileSize(this.currentTilesetKey);
                this.selectedStamp.tileset = this.currentTilesetKey;
                this.setStampSelection(0, 0, 0, 0);
                this.updatePaletteControlsUI();
                this.renderPalette();
                this.updateBrushPreview();
            });
        }

        // Botones de cuadrícula / tamaño de tile (16x16, 32x32, 64x64)
        const sizeButtons = document.querySelectorAll('#tileSizeButtons .btn-chip');
        sizeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.getAttribute('data-size'), 10);
                this.setTilesetTileSize(this.currentTilesetKey, size);
            });
        });

        // Controles de zoom de paleta (32x32, 64x64, +, -, 1x)
        const btnZoom32 = document.getElementById('btnZoomPalette32');
        if (btnZoom32) {
            btnZoom32.addEventListener('click', () => this.setPaletteVisualSize(32));
        }

        const btnZoom64 = document.getElementById('btnZoomPalette64');
        if (btnZoom64) {
            btnZoom64.addEventListener('click', () => this.setPaletteVisualSize(64));
        }

        const btnZoomIn = document.getElementById('btnPaletteZoomIn');
        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => this.setPaletteScale(this.paletteScale * 1.25));
        }

        const btnZoomOut = document.getElementById('btnPaletteZoomOut');
        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => this.setPaletteScale(this.paletteScale / 1.25));
        }

        const btnZoomReset = document.getElementById('btnPaletteZoomReset');
        if (btnZoomReset) {
            btnZoomReset.addEventListener('click', () => this.setPaletteScale(1.0));
        }

        const paletteContainer = document.getElementById('tilesetPaletteContainer');
        if (paletteContainer) {
            paletteContainer.addEventListener('wheel', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const factor = e.deltaY < 0 ? 1.2 : 0.833;
                    this.setPaletteScale(this.paletteScale * factor);
                }
            }, { passive: false });
        }

        // Subir nuevo tileset PNG
        const inputNew = document.getElementById('inputNewTileset');
        if (inputNew) {
            inputNew.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const formData = await file.arrayBuffer();
                    try {
                        const res = await fetch(`/api/upload_tileset?filename=${encodeURIComponent(file.name)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/octet-stream' },
                            body: formData
                        });
                        if (res.ok) {
                            this.showToast(`¡Tileset "${file.name}" importado con éxito!`);
                            await this.loadTilesetList();
                            await this.loadTilesetImages();
                            this.currentTilesetKey = file.name;
                            this.sourceTileSize = this.getTilesetTileSize(file.name);
                            this.updateTilesetDropdown();
                            this.updatePaletteControlsUI();
                            this.setStampSelection(0, 0, 0, 0);
                        }
                    } catch (err) {
                        alert('Error subiendo tileset: ' + err.message);
                    }
                }
            });
        }

        this.paletteCanvas.addEventListener('mousedown', (e) => {
            const rect = this.paletteCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const tileSrc = this.getTilesetTileSize(this.currentTilesetKey);
            const scaledTile = tileSrc * this.paletteScale;

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
            const tileSrc = this.getTilesetTileSize(this.currentTilesetKey);
            const scaledTile = tileSrc * this.paletteScale;

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
        const img = this.tilesets[this.currentTilesetKey];
        const tileSrc = this.getTilesetTileSize(this.currentTilesetKey);
        const maxCols = img ? Math.max(0, Math.floor(img.width / tileSrc) - 1) : 999;
        const maxRows = img ? Math.max(0, Math.floor(img.height / tileSrc) - 1) : 999;

        const minC = Math.max(0, Math.min(Math.min(c1, c2), maxCols));
        const maxC = Math.max(0, Math.min(Math.max(c1, c2), maxCols));
        const minR = Math.max(0, Math.min(Math.min(r1, r2), maxRows));
        const maxR = Math.max(0, Math.min(Math.max(r1, r2), maxRows));

        const w = maxC - minC + 1;
        const h = maxR - minR + 1;

        const tiles = [];
        for (let dr = 0; dr < h; dr++) {
            tiles[dr] = [];
            for (let dc = 0; dc < w; dc++) {
                tiles[dr][dc] = { r: minR + dr, c: minC + dc, srcSize: tileSrc };
            }
        }

        this.selectedStamp = {
            tileset: this.currentTilesetKey,
            startR: minR,
            startC: minC,
            w,
            h,
            tiles,
            srcSize: tileSrc
        };

        this.renderPalette();
        this.updateBrushPreview();
    }

    // ============================================================
    // MAPA & HERRAMIENTAS
    // ============================================================
    initMapEvents() {
        this.mapCanvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || e.button === 2 || e.shiftKey) {
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
                if (this.activeMode !== 'npc' && this.activeMode !== 'warp') {
                    this.pushHistory(`Pintar con ${this.activeTool}`);
                }
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
                if (this.activeMode !== 'warp' && this.activeMode !== 'npc') {
                    this.applyToolAt(col, row);
                }
            }

            this.hoverTile = { col, row };
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.viewport.classList.remove('panning');
            }
            if (this.isMouseDown) {
                this.isMouseDown = false;
                this.renderMinimap();
            }
        });

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

        if (this.activeMode === 'warp') {
            this.handleWarpClick(col, row);
            this.renderMap();
            return;
        }

        if (this.activeMode === 'npc') {
            this.handleNpcClick(col, row);
            this.renderMap();
            return;
        }

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
        if (this.activeMode === 'collision') {
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

        const activeLayer = this.layers[this.activeLayerIndex];
        if (!activeLayer) return;

        const stamp = this.selectedStamp;
        const tileSrc = stamp.srcSize || this.getTilesetTileSize(stamp.tileset);
        for (let dr = 0; dr < stamp.h; dr++) {
            for (let dc = 0; dc < stamp.w; dc++) {
                const targetC = baseCol + dc;
                const targetR = baseRow + dr;
                if (targetC >= 0 && targetC < this.cols && targetR >= 0 && targetR < this.rows) {
                    const tileInfo = stamp.tiles[dr][dc];
                    activeLayer.grid[targetR][targetC] = {
                        tileset: stamp.tileset,
                        r: tileInfo.r,
                        c: tileInfo.c,
                        srcSize: tileSrc
                    };
                }
            }
        }
    }

    eraseAt(col, row) {
        if (this.activeMode === 'collision') {
            this.solidGrid[row][col] = 0;
            this.tallGrassGrid[row][col] = 0;
            return;
        }

        const activeLayer = this.layers[this.activeLayerIndex];
        if (!activeLayer) return;

        if (this.activeLayerIndex === 0) {
            // Capa 0 es el suelo base -> se resetea al pasto por defecto
            activeLayer.grid[row][col] = { tileset: 'GRASS+.png', r: 0, c: 0, srcSize: 16 };
        } else {
            // Capas superiores -> se vuelven transparentes (null)
            activeLayer.grid[row][col] = null;
        }
    }

    pickTileAt(col, row) {
        let picked = null;
        // Primero busca en la capa activa
        const activeLayer = this.layers[this.activeLayerIndex];
        if (activeLayer && activeLayer.grid[row] && activeLayer.grid[row][col]) {
            picked = activeLayer.grid[row][col];
        } else {
            // Si está vacío, busca de arriba a abajo en las capas visibles
            for (let i = this.layers.length - 1; i >= 0; i--) {
                const l = this.layers[i];
                if (l.visible && l.grid[row] && l.grid[row][col]) {
                    picked = l.grid[row][col];
                    break;
                }
            }
        }

        if (picked) {
            this.currentTilesetKey = picked.tileset;
            const selector = document.getElementById('tilesetSelector');
            if (selector) selector.value = picked.tileset;
            if (picked.srcSize) {
                this.tilesetTileSizes[picked.tileset] = picked.srcSize;
                this.sourceTileSize = picked.srcSize;
            } else {
                this.sourceTileSize = this.getTilesetTileSize(picked.tileset);
            }
            this.updatePaletteControlsUI();
            this.setStampSelection(picked.c, picked.r, picked.c, picked.r);
            this.setActiveTool('pencil');
            this.showToast(`Tile clonado: [${picked.tileset}, r:${picked.r}, c:${picked.c}] (${this.sourceTileSize}x${this.sourceTileSize})`);
        }
    }

    floodFillAt(startCol, startRow) {
        if (this.activeMode === 'collision') {
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

        const activeLayer = this.layers[this.activeLayerIndex];
        if (!activeLayer) return;

        const targetTile = activeLayer.grid[startRow][startCol];
        const tileSrc = this.selectedStamp.srcSize || this.getTilesetTileSize(this.selectedStamp.tileset);
        const newTile = {
            tileset: this.selectedStamp.tileset,
            r: this.selectedStamp.startR,
            c: this.selectedStamp.startC,
            srcSize: tileSrc
        };

        const isSame = (a, b) => {
            if (!a && !b) return true;
            if (!a || !b) return false;
            return a.tileset === b.tileset && a.r === b.r && a.c === b.c;
        };

        if (isSame(targetTile, newTile)) return;

        const queue = [[startCol, startRow]];
        const visited = new Set();

        while (queue.length > 0 && visited.size < 5000) {
            const [c, r] = queue.pop();
            const key = `${c},${r}`;
            if (visited.has(key)) continue;
            visited.add(key);

            if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) continue;
            const cur = activeLayer.grid[r][c];
            if (!isSame(cur, targetTile)) continue;

            activeLayer.grid[r][c] = { ...newTile };
            queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
        }
    }

    autoDetectCollisions() {
        let count = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                // Revisar todas las capas para detectar rocas, vallas y agua
                for (let i = 0; i < this.layers.length; i++) {
                    const tile = this.layers[i].grid[r][c];
                    if (!tile) continue;

                    if (tile.tileset.includes('GRASS') && (tile.r === 12 && tile.c >= 2)) {
                        this.solidGrid[r][c] = 1;
                        count++;
                    } else if (tile.tileset.includes('GRASS') && (tile.c === 10 || tile.c === 11)) {
                        this.solidGrid[r][c] = 1;
                        count++;
                    } else if (tile.tileset.includes('Water') && tile.r === 11 && tile.c === 4) {
                        this.solidGrid[r][c] = 1;
                        count++;
                    }

                    if (tile.tileset.includes('Water') && tile.r <= 6) {
                        this.solidGrid[r][c] = 1;
                        count++;
                    }

                    if (tile.tileset.includes('GRASS') && (tile.r === 8 || tile.r === 10)) {
                        this.tallGrassGrid[r][c] = 1;
                    }
                }
            }
        }
        this.pushHistory('Auto-generar colisiones');
        this.renderMap();
        this.renderMinimap();
        this.showToast(`¡Auto-detección completada! ${count} losas actualizadas.`);
    }

    // ============================================================
    // MINIMAPA
    // ============================================================
    renderMinimap() {
        this.minimapCtx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
        const scaleX = this.minimapCanvas.width / this.cols;
        const scaleY = this.minimapCanvas.height / this.rows;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let color = '#2d6a14';

                // Buscar de capa 0 hacia arriba
                for (let i = 0; i < this.layers.length; i++) {
                    const tile = this.layers[i].grid[r][c];
                    if (!tile) continue;
                    if (tile.tileset.includes('Water')) color = '#0077b6';
                    else if (tile.tileset.includes('GRASS') && tile.c >= 13) color = '#d4a373';
                    else if (tile.tileset.includes('GRASS') && (tile.c === 1 || tile.c === 3 || tile.c === 5)) color = '#ffbe0b';
                }

                if (this.solidGrid[r][c]) color = '#e63946';

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

    setZoom(val) {
        this.zoom = Math.max(0.4, Math.min(2.5, val));
        this.canvasWrapper.style.transform = `scale(${this.zoom})`;
        document.getElementById('zoomLevelDisplay').textContent = `${Math.round(this.zoom * 100)}%`;
    }

    // ============================================================
    // EVENTOS DE INTERFAZ & GUARDADO
    // ============================================================
    // ============================================================
    // EVENTOS DE INTERFAZ & CAPAS MULTICAPA
    // ============================================================
    initUIEvents() {
        // Botón Nueva Capa
        const btnAddLayer = document.getElementById('btnAddLayer');
        if (btnAddLayer) {
            btnAddLayer.addEventListener('click', () => this.addNewLayer());
        }

        // Capa Especial de Eventos: Puertas & Warps
        const warpLayerItem = document.getElementById('layerItemWarp');
        if (warpLayerItem) {
            warpLayerItem.addEventListener('click', (e) => {
                if (e.target.closest('#btnEyeWarp')) return;
                this.selectWarpMode();
            });
        }

        const eyeWarp = document.getElementById('btnEyeWarp');
        if (eyeWarp) {
            eyeWarp.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showWarpsOverlay = !this.showWarpsOverlay;
                eyeWarp.classList.toggle('off', !this.showWarpsOverlay);
                eyeWarp.textContent = this.showWarpsOverlay ? '👁️' : '🕶️';
                const warpOverlayBtn = document.getElementById('btnToggleWarpsOverlay');
                if (warpOverlayBtn) warpOverlayBtn.classList.toggle('active', this.showWarpsOverlay);
                this.renderMap();
            });
        }

        // Capa Especial de Eventos: Personajes / Entrenadores
        const npcLayerItem = document.getElementById('layerItemNpc');
        if (npcLayerItem) {
            npcLayerItem.addEventListener('click', (e) => {
                if (e.target.closest('#btnEyeNpc')) return;
                this.selectNpcMode();
            });
        }
        const eyeNpc = document.getElementById('btnEyeNpc');
        if (eyeNpc) {
            eyeNpc.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNpcsOverlay();
            });
        }
        const npcOverlayBtn = document.getElementById('btnToggleNpcsOverlay');
        if (npcOverlayBtn) {
            npcOverlayBtn.addEventListener('click', () => this.toggleNpcsOverlay());
        }
        const toolNpcBtn = document.getElementById('toolNpc');
        if (toolNpcBtn) toolNpcBtn.addEventListener('click', () => this.selectNpcMode());

        document.getElementById('btnSaveNpc')?.addEventListener('click', () => this.saveCurrentNpc());
        document.getElementById('btnDeleteNpc')?.addEventListener('click', () => this.deleteCurrentNpc());
        document.getElementById('npcType')?.addEventListener('change', () => this.updateNpcFormVisibility());
        document.getElementById('npcSpriteSelect')?.addEventListener('change', () => this.updateNpcSpritePreview());
        document.getElementById('npcDirection')?.addEventListener('change', () => this.updateNpcSpritePreview());

        // Capa Especial de Permisos / Colisiones
        const colItem = document.getElementById('layerItemCollision');
        if (colItem) {
            colItem.addEventListener('click', (e) => {
                if (e.target.closest('#btnEyeCollision')) return;
                this.selectCollisionLayer();
            });
        }

        const eyeCol = document.getElementById('btnEyeCollision');
        if (eyeCol) {
            eyeCol.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showCollisionOverlay = !this.showCollisionOverlay;
                const colBtn = document.getElementById('btnToggleCollisionsOverlay');
                if (colBtn) colBtn.classList.toggle('active', this.showCollisionOverlay);
                this.renderLayersPanel();
                this.renderMap();
            });
        }

        // Herramientas
        document.getElementById('toolPencil').addEventListener('click', () => this.setActiveTool('pencil'));
        document.getElementById('toolFill').addEventListener('click', () => this.setActiveTool('fill'));
        document.getElementById('toolEraser').addEventListener('click', () => this.setActiveTool('eraser'));
        document.getElementById('toolPicker').addEventListener('click', () => this.setActiveTool('picker'));
        const toolWarpBtn = document.getElementById('toolWarp');
        if (toolWarpBtn) toolWarpBtn.addEventListener('click', () => this.selectWarpMode());

        // Botones de formulario de Warp
        const btnSaveWarp = document.getElementById('btnSaveWarp');
        if (btnSaveWarp) {
            btnSaveWarp.addEventListener('click', () => this.saveCurrentWarp());
        }
        const btnDelWarp = document.getElementById('btnDeleteWarp');
        if (btnDelWarp) {
            btnDelWarp.addEventListener('click', () => this.deleteCurrentWarp());
        }

        // Modal Nuevo Mapa
        const btnNewMap = document.getElementById('btnNewMap');
        const modalNewMap = document.getElementById('modalNewMap');
        if (btnNewMap && modalNewMap) {
            btnNewMap.addEventListener('click', () => {
                modalNewMap.style.display = 'flex';
                const idInput = document.getElementById('inputNewMapId');
                if (idInput) {
                    idInput.value = '';
                    idInput.focus();
                }
            });
        }
        const closeModal = () => {
            if (modalNewMap) modalNewMap.style.display = 'none';
        };
        const btnCloseNewMap = document.getElementById('btnCloseNewMapModal');
        if (btnCloseNewMap) btnCloseNewMap.addEventListener('click', closeModal);
        const btnCancelNewMap = document.getElementById('btnCancelNewMap');
        if (btnCancelNewMap) btnCancelNewMap.addEventListener('click', closeModal);
        const btnConfirmNewMap = document.getElementById('btnConfirmNewMap');
        if (btnConfirmNewMap) {
            btnConfirmNewMap.addEventListener('click', () => this.handleCreateNewMap());
        }

        // Deshacer / Rehacer
        document.getElementById('btnUndo').addEventListener('click', () => this.undo());
        document.getElementById('btnRedo').addEventListener('click', () => this.redo());

        // Cuadrícula y Overlays
        const gridBtn = document.getElementById('btnToggleGrid');
        gridBtn.addEventListener('click', () => {
            this.showGrid = !this.showGrid;
            gridBtn.classList.toggle('active', this.showGrid);
            this.renderMap();
        });

        const colBtn = document.getElementById('btnToggleCollisionsOverlay');
        colBtn.addEventListener('click', () => {
            this.showCollisionOverlay = !this.showCollisionOverlay;
            colBtn.classList.toggle('active', this.showCollisionOverlay);
            this.renderLayersPanel();
            this.renderMap();
        });

        const warpOverlayBtn = document.getElementById('btnToggleWarpsOverlay');
        if (warpOverlayBtn) {
            warpOverlayBtn.addEventListener('click', () => {
                this.showWarpsOverlay = !this.showWarpsOverlay;
                warpOverlayBtn.classList.toggle('active', this.showWarpsOverlay);
                const eyeWarp = document.getElementById('btnEyeWarp');
                if (eyeWarp) {
                    eyeWarp.classList.toggle('off', !this.showWarpsOverlay);
                    eyeWarp.textContent = this.showWarpsOverlay ? '👁️' : '🕶️';
                }
                this.renderMap();
            });
        }

        // Permisos de colisión
        document.querySelectorAll('.perm-card[data-perm]').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.perm-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedPerm = card.dataset.perm;
                this.updateBrushPreview();
            });
        });

        document.getElementById('btnAutoCollisions').addEventListener('click', () => {
            this.autoDetectCollisions();
        });

        // Zoom
        document.getElementById('btnZoomIn').addEventListener('click', () => this.setZoom(this.zoom + 0.25));
        document.getElementById('btnZoomOut').addEventListener('click', () => this.setZoom(this.zoom - 0.25));
        document.getElementById('btnResetView').addEventListener('click', () => {
            this.setZoom(1.0);
            this.centerViewportOnTile(60, 45);
        });

        // Selector de proyecto
        const projSelect = document.getElementById('projectSelect');
        if (projSelect) {
            projSelect.addEventListener('change', (e) => {
                this.loadProject(e.target.value);
            });
        }

        // GUARDAR BORRADOR (no toca el juego)
        document.getElementById('btnSaveDraft').addEventListener('click', async () => {
            await this.saveDraft();
        });

        // PUBLICAR AL JUEGO (Deploy)
        document.getElementById('btnDeployGame').addEventListener('click', async () => {
            await this.deployToGame();
        });

        // Exportar JSON local
        document.getElementById('btnExportJson').addEventListener('click', () => {
            const data = this.getExportableMapData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.currentProjectName || 'world_map.json';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('📥 Copia local descargada.');
        });

        // Importar JSON
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
                        this.showToast('📂 Archivo JSON cargado.');
                    } catch (err) {
                        alert('Error al leer el archivo JSON: ' + err.message);
                    }
                };
                reader.readAsText(e.target.files[0]);
            }
        });
    }

    // ============================================================
    // GESTIÓN DINÁMICA DE CAPAS
    // ============================================================
    renderLayersPanel() {
        const container = document.getElementById('layersListContainer');
        if (!container) return;
        container.innerHTML = '';

        // Actualizar item de Colisión
        const colItem = document.getElementById('layerItemCollision');
        const eyeCol = document.getElementById('btnEyeCollision');
        if (colItem) {
            colItem.classList.toggle('active', this.activeMode === 'collision');
        }
        if (eyeCol) {
            eyeCol.classList.toggle('off', !this.showCollisionOverlay);
            eyeCol.textContent = this.showCollisionOverlay ? '👁️' : '🕶️';
        }

        // Actualizar item de Warp / Puertas
        const warpItem = document.getElementById('layerItemWarp');
        const eyeWarp = document.getElementById('btnEyeWarp');
        if (warpItem) {
            warpItem.classList.toggle('active', this.activeMode === 'warp');
        }
        if (eyeWarp) {
            eyeWarp.classList.toggle('off', !this.showWarpsOverlay);
            eyeWarp.textContent = this.showWarpsOverlay ? '👁️' : '🕶️';
        }

        // Actualizar item de Personajes / Eventos
        const npcItem = document.getElementById('layerItemNpc');
        const eyeNpc = document.getElementById('btnEyeNpc');
        if (npcItem) {
            npcItem.classList.toggle('active', this.activeMode === 'npc');
        }
        if (eyeNpc) {
            eyeNpc.classList.toggle('off', !this.showNpcsOverlay);
            eyeNpc.textContent = this.showNpcsOverlay ? '👁️' : '🕶️';
        }

        const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Mostrar de arriba hacia abajo (Z-order: índice N-1 arriba, índice 0 abajo)
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            const isTop = (i === this.layers.length - 1);
            const isBottom = (i === 0);
            const isActive = (this.activeMode === 'tile' && this.activeLayerIndex === i);

            const card = document.createElement('div');
            card.className = `layer-item ${isActive ? 'active' : ''} ${!layer.visible ? 'layer-hidden' : ''}`;
            card.title = `Capa: ${layer.name} (Z-Index: ${i})`;

            // Badge de capa
            let badgeClass = 'badge-custom';
            let badgeText = `CAPA ${i + 1}`;
            if (i === 0) {
                badgeClass = 'badge-ground';
                badgeText = 'SUELO BASE';
            } else if (i === 1 && layer.name.toLowerCase().includes('decor')) {
                badgeClass = 'badge-decor';
                badgeText = 'DECORACIÓN';
            }

            card.innerHTML = `
                <div class="layer-item-left">
                    <button class="layer-btn-eye ${!layer.visible ? 'off' : ''}" title="${layer.visible ? 'Ocultar capa' : 'Mostrar capa'}">
                        ${layer.visible ? '👁️' : '🕶️'}
                    </button>
                    <div class="layer-item-info">
                        <span class="layer-badge ${badgeClass}">${badgeText}</span>
                        <strong class="layer-name" title="Doble clic para renombrar">${escapeHtml(layer.name)}</strong>
                    </div>
                </div>
                <div class="layer-item-actions">
                    <button class="layer-action-btn btn-up" title="Mover capa arriba" ${isTop ? 'disabled' : ''}>🔼</button>
                    <button class="layer-action-btn btn-down" title="Mover capa abajo" ${isBottom ? 'disabled' : ''}>🔽</button>
                    <button class="layer-action-btn btn-rename" title="Renombrar capa">✏️</button>
                    <button class="layer-action-btn btn-delete" title="Eliminar capa" ${this.layers.length <= 1 ? 'disabled' : ''}>🗑️</button>
                </div>
                <span class="layer-active-indicator"></span>
            `;

            // Clic en la tarjeta selecciona la capa
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                this.selectLayer(i);
            });

            // Botón Ojo (Visibilidad)
            const eyeBtn = card.querySelector('.layer-btn-eye');
            eyeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLayerVisibility(i);
            });

            // Mover arriba
            const upBtn = card.querySelector('.btn-up');
            if (upBtn) {
                upBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.moveLayer(i, 1);
                });
            }

            // Mover abajo
            const downBtn = card.querySelector('.btn-down');
            if (downBtn) {
                downBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.moveLayer(i, -1);
                });
            }

            // Renombrar
            const renameBtn = card.querySelector('.btn-rename');
            if (renameBtn) {
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.renameLayer(i);
                });
            }

            const nameEl = card.querySelector('.layer-name');
            nameEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.renameLayer(i);
            });

            // Eliminar
            const delBtn = card.querySelector('.btn-delete');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteLayer(i);
                });
            }

            container.appendChild(card);
        }
    }

    selectLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeMode = 'tile';
        this.activeLayerIndex = index;

        const colSection = document.getElementById('collisionPaletteSection');
        if (colSection) colSection.style.display = 'none';

        const warpSection = document.getElementById('warpPaletteSection');
        if (warpSection) warpSection.style.display = 'none';

        const toolWarpBtn = document.getElementById('toolWarp');
        if (toolWarpBtn) toolWarpBtn.classList.remove('active');
        this.hideNpcPanel();

        this.renderLayersPanel();
        this.updateBrushPreview();
        this.updateStatusMode();
    }

    selectCollisionLayer() {
        this.activeMode = 'collision';

        const colSection = document.getElementById('collisionPaletteSection');
        if (colSection) colSection.style.display = 'block';

        const warpSection = document.getElementById('warpPaletteSection');
        if (warpSection) warpSection.style.display = 'none';

        const toolWarpBtn = document.getElementById('toolWarp');
        if (toolWarpBtn) toolWarpBtn.classList.remove('active');
        this.hideNpcPanel();

        this.renderLayersPanel();
        this.updateBrushPreview();
        this.updateStatusMode();
    }

    selectWarpMode() {
        this.activeMode = 'warp';

        const colSection = document.getElementById('collisionPaletteSection');
        if (colSection) colSection.style.display = 'none';

        const warpSection = document.getElementById('warpPaletteSection');
        if (warpSection) warpSection.style.display = 'block';
        this.hideNpcPanel();

        document.querySelectorAll('.tool-btn[id^="tool"]').forEach(b => b.classList.remove('active'));
        const toolWarpBtn = document.getElementById('toolWarp');
        if (toolWarpBtn) toolWarpBtn.classList.add('active');

        this.renderLayersPanel();
        this.renderWarpsList();
        this.updateStatusMode();
        this.showToast('🌀 Modo Warps: Haz clic en una losa del mapa para crear o editar un teletransporte.');
    }

    handleWarpClick(col, row) {
        this.warpEditingTile = { col, row };
        const existingIdx = this.warps.findIndex(w => w.x === col && w.y === row);
        this.selectedWarpIndex = existingIdx;

        const coordsEl = document.getElementById('warpCurrentTileCoords');
        if (coordsEl) coordsEl.textContent = `Losa: (${col}, ${row})`;

        const mapSel = document.getElementById('warpTargetMapSelect');
        const xInput = document.getElementById('warpTargetX');
        const yInput = document.getElementById('warpTargetY');
        const descInput = document.getElementById('warpDesc');
        const btnDel = document.getElementById('btnDeleteWarp');

        if (existingIdx >= 0) {
            const w = this.warps[existingIdx];
            if (mapSel) mapSel.value = w.targetMap;
            if (xInput) xInput.value = w.targetX;
            if (yInput) yInput.value = w.targetY;
            if (descInput) descInput.value = w.desc || '';
            if (btnDel) btnDel.style.display = 'inline-block';
            this.showToast(`🚪 Warp existente en (${col}, ${row}) -> ${w.targetMap}`);
        } else {
            if (xInput) xInput.value = 5;
            if (yInput) yInput.value = 5;
            if (descInput) descInput.value = `Puerta (${col}, ${row})`;
            if (btnDel) btnDel.style.display = 'none';
            this.showToast(`✨ Losa (${col}, ${row}) lista. Configura el mapa destino y presiona "Guardar Warp".`);
        }
        this.renderWarpsList();
    }

    saveCurrentWarp() {
        if (!this.warpEditingTile) {
            alert('Por favor haz clic en una losa del mapa primero para ubicar el Warp.');
            return;
        }
        const col = this.warpEditingTile.col;
        const row = this.warpEditingTile.row;
        const targetMap = (document.getElementById('warpTargetMapSelect')?.value || 'world_map').replace('.json', '');
        const targetX = parseInt(document.getElementById('warpTargetX')?.value || '0', 10);
        const targetY = parseInt(document.getElementById('warpTargetY')?.value || '0', 10);
        const desc = document.getElementById('warpDesc')?.value?.trim() || `Warp (${col}, ${row})`;

        const existingIdx = this.warps.findIndex(w => w.x === col && w.y === row);
        const warpObj = { x: col, y: row, targetMap, targetX, targetY, desc };

        if (existingIdx >= 0) {
            this.warps[existingIdx] = warpObj;
            this.selectedWarpIndex = existingIdx;
            this.pushHistory(`Modificar warp en (${col}, ${row})`);
            this.showToast(`✅ Warp en (${col}, ${row}) actualizado a "${targetMap}".`);
        } else {
            this.warps.push(warpObj);
            this.selectedWarpIndex = this.warps.length - 1;
            this.pushHistory(`Crear warp en (${col}, ${row})`);
            this.showToast(`✨ Warp creado en (${col}, ${row}) -> ${targetMap} (${targetX}, ${targetY}).`);
        }

        const btnDel = document.getElementById('btnDeleteWarp');
        if (btnDel) btnDel.style.display = 'inline-block';

        this.renderWarpsList();
        this.renderMap();
    }

    deleteCurrentWarp() {
        if (this.selectedWarpIndex < 0 || this.selectedWarpIndex >= this.warps.length) {
            if (this.warpEditingTile) {
                const idx = this.warps.findIndex(w => w.x === this.warpEditingTile.col && w.y === this.warpEditingTile.row);
                if (idx >= 0) this.selectedWarpIndex = idx;
            }
        }
        if (this.selectedWarpIndex < 0 || this.selectedWarpIndex >= this.warps.length) return;

        const w = this.warps[this.selectedWarpIndex];
        if (!confirm(`¿Eliminar el warp en (${w.x}, ${w.y}) que lleva a "${w.targetMap}"?`)) return;

        this.warps.splice(this.selectedWarpIndex, 1);
        this.selectedWarpIndex = -1;
        this.warpEditingTile = null;

        const coordsEl = document.getElementById('warpCurrentTileCoords');
        if (coordsEl) coordsEl.textContent = 'Ninguna losa seleccionada';
        const btnDel = document.getElementById('btnDeleteWarp');
        if (btnDel) btnDel.style.display = 'none';

        this.pushHistory(`Eliminar warp en (${w.x}, ${w.y})`);
        this.renderWarpsList();
        this.renderMap();
        this.showToast(`🗑️ Warp eliminado.`);
    }

    renderWarpsList() {
        const container = document.getElementById('warpsListContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!this.warps || this.warps.length === 0) {
            container.innerHTML = '<small style="color: #64748b; display: block; padding: 6px 0;">No hay warps en este mapa aún.</small>';
            return;
        }

        this.warps.forEach((w, idx) => {
            const card = document.createElement('div');
            card.className = `warp-card-item ${this.selectedWarpIndex === idx ? 'active' : ''}`;
            card.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
                    <span class="warp-card-title">🌀 (${w.x}, ${w.y}) ${w.desc || ''}</span>
                    <span class="warp-card-target">Destino: <strong>${w.targetMap}</strong> (${w.targetX}, ${w.targetY})</span>
                </div>
                <button class="layer-action-btn btn-delete" style="width: 22px; height: 22px; font-size: 0.65rem;" title="Eliminar warp">🗑️</button>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete')) return;
                this.selectWarpFromList(idx);
            });

            const delBtn = card.querySelector('.btn-delete');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectedWarpIndex = idx;
                    this.deleteCurrentWarp();
                });
            }

            container.appendChild(card);
        });
    }

    selectWarpFromList(idx) {
        if (idx < 0 || idx >= this.warps.length) return;
        const w = this.warps[idx];
        this.selectedWarpIndex = idx;
        this.warpEditingTile = { col: w.x, row: w.y };

        const coordsEl = document.getElementById('warpCurrentTileCoords');
        if (coordsEl) coordsEl.textContent = `Losa: (${w.x}, ${w.y})`;

        const mapSel = document.getElementById('warpTargetMapSelect');
        const xInput = document.getElementById('warpTargetX');
        const yInput = document.getElementById('warpTargetY');
        const descInput = document.getElementById('warpDesc');
        const btnDel = document.getElementById('btnDeleteWarp');

        if (mapSel) mapSel.value = w.targetMap;
        if (xInput) xInput.value = w.targetX;
        if (yInput) yInput.value = w.targetY;
        if (descInput) descInput.value = w.desc || '';
        if (btnDel) btnDel.style.display = 'inline-block';

        this.centerViewportOnTile(w.x, w.y);
        this.renderWarpsList();
        this.renderMap();
    }

    // ============================================================
    // PERSONAJES FIJOS / EVENTOS DE COMBATE (ENTRENADORES Y NPCs)
    // ============================================================
    async loadCharacterList() {
        try {
            const res = await fetch('/api/characters');
            if (res.ok) {
                this.characterSprites = await res.json();
            } else {
                console.warn(`/api/characters respondió ${res.status}. ¿Reiniciaste app.py tras actualizarlo?`);
                this.showToast('⚠️ No se pudo cargar la lista de personajes. Reinicia el editor (run_editor.sh).');
            }
        } catch (e) {
            console.warn('Error cargando lista de personajes:', e);
        }

        const sel = document.getElementById('npcSpriteSelect');
        if (sel) {
            sel.innerHTML = '';
            this.characterSprites.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
            });
        }

        await Promise.all(this.characterSprites.map(name => new Promise(resolve => {
            const img = new Image();
            img.onload = () => { this.characterImages[name] = img; resolve(); };
            img.onerror = () => resolve();
            img.src = `/assets/characters/${encodeURIComponent(name)}`;
        })));

        this.buildCharacterGallery();
    }

    /** Galería de miniaturas: un clic elige el sprite del personaje. */
    buildCharacterGallery() {
        const gallery = document.getElementById('npcSpriteGallery');
        if (!gallery) return;
        gallery.innerHTML = '';

        if (this.characterSprites.length === 0) {
            gallery.innerHTML = '<small style="color: #64748b;">No hay PNG en assets/characters.</small>';
            return;
        }

        this.characterSprites.forEach(name => {
            const thumb = document.createElement('canvas');
            thumb.width = 64;
            thumb.height = 64;
            thumb.title = name;
            thumb.dataset.sprite = name;
            const tctx = thumb.getContext('2d');
            tctx.imageSmoothingEnabled = false;
            this.drawCharacterFrame(tctx, name, 'down', 0, 0, 64);
            thumb.addEventListener('click', () => {
                const sel = document.getElementById('npcSpriteSelect');
                if (sel) sel.value = name;
                this.updateNpcSpritePreview();
            });
            gallery.appendChild(thumb);
        });
    }

    /** Dibuja el primer fotograma LPC (64x64) mirando en la dirección indicada. */
    drawCharacterFrame(ctx, spriteName, direction, dx, dy, size) {
        const img = this.characterImages[spriteName];
        const dirRow = { up: 8, left: 9, down: 10, right: 11 }[direction] ?? 10;
        if (img) {
            ctx.drawImage(img, 0, dirRow * 64, 64, 64, dx, dy, size, size);
            return true;
        }
        return false;
    }

    selectNpcMode() {
        this.activeMode = 'npc';

        const colSection = document.getElementById('collisionPaletteSection');
        if (colSection) colSection.style.display = 'none';
        const warpSection = document.getElementById('warpPaletteSection');
        if (warpSection) warpSection.style.display = 'none';
        const npcSection = document.getElementById('npcPaletteSection');
        if (npcSection) npcSection.style.display = 'block';

        document.querySelectorAll('.tool-btn[id^="tool"]').forEach(b => b.classList.remove('active'));
        const toolNpcBtn = document.getElementById('toolNpc');
        if (toolNpcBtn) toolNpcBtn.classList.add('active');

        if (!this.showNpcsOverlay) this.toggleNpcsOverlay();
        this.updateNpcFormVisibility();
        this.updateNpcSpritePreview();
        this.renderLayersPanel();
        this.renderNpcsList();
        this.updateStatusMode();
        this.renderMap();
        this.showToast('🧑 Modo Personajes: Haz clic en una losa para colocar o editar un entrenador / NPC.');
    }

    hideNpcPanel() {
        const npcSection = document.getElementById('npcPaletteSection');
        if (npcSection) npcSection.style.display = 'none';
        const toolNpcBtn = document.getElementById('toolNpc');
        if (toolNpcBtn) toolNpcBtn.classList.remove('active');
    }

    toggleNpcsOverlay() {
        this.showNpcsOverlay = !this.showNpcsOverlay;
        const btn = document.getElementById('btnToggleNpcsOverlay');
        if (btn) btn.classList.toggle('active', this.showNpcsOverlay);
        this.renderLayersPanel();
        this.renderMap();
    }

    updateNpcFormVisibility() {
        const isTrainer = (document.getElementById('npcType')?.value || 'trainer') === 'trainer';
        document.querySelectorAll('.npc-trainer-only').forEach(el => {
            el.style.display = isTrainer ? '' : 'none';
        });
        const lbl = document.getElementById('npcDialogLabel');
        const type = document.getElementById('npcType')?.value;
        if (lbl) lbl.textContent = isTrainer ? 'Diálogo antes del combate:' : (type === 'tutor' ? 'Saludo del maestro (luego se abre el cambio de ataques):' : 'Diálogo:');
    }

    updateNpcSpritePreview() {
        const canvas = document.getElementById('npcSpritePreview');
        if (!canvas) return;
        const pctx = canvas.getContext('2d');
        pctx.imageSmoothingEnabled = false;
        pctx.clearRect(0, 0, canvas.width, canvas.height);
        const sprite = document.getElementById('npcSpriteSelect')?.value;
        const dir = document.getElementById('npcDirection')?.value || 'down';
        document.querySelectorAll('#npcSpriteGallery canvas').forEach(c => {
            c.classList.toggle('selected', c.dataset.sprite === sprite);
        });
        if (!this.drawCharacterFrame(pctx, sprite, dir, 0, 0, 64)) {
            pctx.fillStyle = '#64748b';
            pctx.font = '28px sans-serif';
            pctx.textAlign = 'center';
            pctx.fillText('🧑', 32, 42);
        }
    }

    fillNpcForm(npc, col, row) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const coordsEl = document.getElementById('npcCurrentTileCoords');
        if (coordsEl) coordsEl.textContent = `Losa: (${col}, ${row})`;

        if (npc) {
            set('npcName', npc.name || '');
            if (npc.sprite && this.characterSprites.includes(npc.sprite)) set('npcSpriteSelect', npc.sprite);
            set('npcType', ['npc', 'tutor'].includes(npc.type) ? npc.type : 'trainer');
            set('npcDirection', npc.direction || 'down');
            set('npcSightRange', npc.sightRange ?? 4);
            set('npcRewardExp', npc.rewardExp ?? 0);
            set('npcDialog', npc.dialog || '');
            set('npcDefeatDialog', npc.defeatDialog || '');
            this.setTeamInForm(npc.team || []);
            set('npcMoveCard', npc.moveCard && this.dinoCatalog.attacks.some(a => a.id === npc.moveCard) ? npc.moveCard : '');
        } else {
            // Valores por defecto para un nuevo entrenador (conserva sprite/tipo elegidos)
            set('npcName', `Entrenador ${this.npcs.length + 1}`);
            set('npcDialog', '¡Eh, tú! ¡Nuestras miradas se cruzaron!\n¡Prepárate para el combate!');
            set('npcDefeatDialog', '¡Vaya, qué fuerza tienen tus dinos!');
            const first = this.dinoCatalog.dinos[0];
            this.setTeamInForm(first ? [{ species: first.id, level: 5, attacks: this.getDefaultAttacks(first.id) }] : []);
            set('npcMoveCard', '');
        }

        const btnDel = document.getElementById('btnDeleteNpc');
        if (btnDel) btnDel.style.display = npc ? 'inline-block' : 'none';
        this.updateNpcFormVisibility();
        this.updateNpcSpritePreview();
    }

    handleNpcClick(col, row) {
        this.npcEditingTile = { col, row };
        const idx = this.npcs.findIndex(n => n.x === col && n.y === row);
        this.selectedNpcIndex = idx;
        this.fillNpcForm(idx >= 0 ? this.npcs[idx] : null, col, row);

        if (idx >= 0) {
            this.showToast(`🧑 Personaje existente en (${col}, ${row}): ${this.npcs[idx].name}`);
        } else {
            if (this.solidGrid[row] && this.solidGrid[row][col]) {
                this.showToast(`⚠️ La losa (${col}, ${row}) es sólida; el personaje podría quedar dentro de un obstáculo.`);
            } else {
                this.showToast(`✨ Losa (${col}, ${row}) lista. Configura el personaje y presiona "Guardar Personaje".`);
            }
        }
        this.renderNpcsList();
    }

    // ------------------------------------------------------------
    // Equipo de dinos del entrenador (3 dinos x 3 ataques)
    // ------------------------------------------------------------
    async loadDinoCatalog() {
        try {
            const res = await fetch('/api/dinos');
            if (res.ok) this.dinoCatalog = await res.json();
        } catch (e) {
            console.warn('Error cargando catálogo de dinos:', e);
        }
        this.buildTeamSlots();
    }

    getDino(id) {
        return this.dinoCatalog.dinos.find(d => d.id === id) || null;
    }

    /** Ataques sugeridos para un nivel: los 2 más fuertes de su elemento + el normal más fuerte. */
    getDefaultAttacks(dinoId, level = 5) {
        const dino = this.getDino(dinoId);
        if (!dino) return [];
        // Las cartas de movimiento (moveCard) no se sugieren como ataques
        const ok = (a) => !a.moveCard && a.power > 0 && (a.level || 1) <= level;
        const byPower = (a, b) => b.power - a.power;
        const atks = this.dinoCatalog.attacks;
        const own = atks.filter(a => ok(a) && a.element === dino.element).sort(byPower);
        const normal = atks.filter(a => ok(a) && a.element === 'normal').sort(byPower);
        const picked = [...own.slice(0, 2), ...normal].slice(0, 3);
        for (const a of [...own, ...normal]) {
            if (picked.length >= 3) break;
            if (!picked.includes(a)) picked.push(a);
        }
        return picked.map(a => a.id);
    }

    buildTeamSlots() {
        const container = document.getElementById('npcTeamSlots');
        if (!container) return;
        const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const { elements, dinos, attacks } = this.dinoCatalog;

        const dinoOptions = '<option value="">— Vacío —</option>' + dinos.map(d => {
            const el = elements[d.element];
            return `<option value="${escapeHtml(d.id)}">${el ? el.icon + ' ' : ''}${escapeHtml(d.name)}</option>`;
        }).join('');

        // Ataques agrupados por elemento
        const groups = {};
        attacks.filter(a => !a.moveCard).forEach(a => { (groups[a.element] = groups[a.element] || []).push(a); });
        const attackOptions = '<option value="">— Ataque —</option>' + Object.entries(groups).map(([elKey, list]) => {
            const el = elements[elKey];
            const label = el ? `${el.icon} ${el.name}` : elKey;
            return `<optgroup label="${escapeHtml(label)}">` + list.map(a =>
                `<option value="${escapeHtml(a.id)}">${(this.dinoCatalog.categories || {})[a.category]?.icon || ''} ${escapeHtml(a.name)} (${a.power}) · Nv.${a.level || 1}</option>`).join('') + '</optgroup>';
        }).join('');

        // Carta de movimiento del entrenador (1, se puede usar varias veces en el combate)
        const moveSel = document.getElementById('npcMoveCard');
        if (moveSel) {
            moveSel.innerHTML = '<option value="">— Sin carta de movimiento —</option>' + attacks.filter(a => a.moveCard).map(a => {
                const el = elements[a.element];
                return `<option value="${escapeHtml(a.id)}">🃏 ${el ? el.icon + ' ' : ''}${escapeHtml(a.name)} (${a.power})</option>`;
            }).join('');
        }

        container.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const slot = document.createElement('div');
            slot.className = 'dino-slot empty';
            slot.dataset.slot = i;
            slot.innerHTML = `
                <div class="dino-card-thumb">?</div>
                <div class="dino-slot-fields">
                    <div class="dino-slot-head">
                        <select class="retro-select dino-species" title="Dino ${i + 1}">${dinoOptions}</select>
                        <input type="number" class="retro-input-mini dino-level" min="1" max="100" value="5" title="Nivel">
                    </div>
                    <span class="dino-element-badge"></span>
                    <select class="retro-select dino-attack">${attackOptions}</select>
                    <select class="retro-select dino-attack">${attackOptions}</select>
                    <select class="retro-select dino-attack">${attackOptions}</select>
                </div>
            `;
            slot.querySelector('.dino-species').addEventListener('change', (e) => {
                const id = e.target.value;
                // Al elegir un dino, sugerir sus ataques si el espacio no tenía ninguno
                const atkSels = [...slot.querySelectorAll('.dino-attack')];
                if (id && atkSels.every(s => !s.value)) {
                    const lvl = parseInt(slot.querySelector('.dino-level').value || '5', 10) || 5;
                    this.getDefaultAttacks(id, lvl).forEach((aid, k) => { if (atkSels[k]) atkSels[k].value = aid; });
                }
                this.updateTeamSlotVisual(slot);
            });
            container.appendChild(slot);
        }
    }

    updateTeamSlotVisual(slot) {
        const id = slot.querySelector('.dino-species').value;
        const dino = this.getDino(id);
        const thumb = slot.querySelector('.dino-card-thumb');
        const badge = slot.querySelector('.dino-element-badge');
        slot.classList.toggle('empty', !dino);
        slot.querySelectorAll('.dino-attack, .dino-level').forEach(el => { el.disabled = !dino; });

        if (dino) {
            const src = dino.card || dino.image;
            thumb.style.backgroundImage = `url("/assets/dinos/${encodeURI(src)}")`;
            thumb.classList.toggle('full-card', !dino.card);
            thumb.textContent = '';
            const el = this.dinoCatalog.elements[dino.element];
            const s5 = Array.isArray(dino.stats) ? dino.stats : [];
            const st = s5.length >= 5 ? ` · ❤️${s5[0]} 💪${s5[1]} 🛡️${s5[2]} 🔮${s5[3]} ✨${s5[4]}` : '';
            badge.textContent = (el ? `${el.icon} ${el.name}` : dino.element) + st;
        } else {
            thumb.style.backgroundImage = '';
            thumb.classList.remove('full-card');
            thumb.textContent = '?';
            badge.textContent = '';
        }
    }

    setTeamInForm(team) {
        const slots = document.querySelectorAll('#npcTeamSlots .dino-slot');
        slots.forEach((slot, i) => {
            const m = team[i];
            const valid = m && this.getDino(m.species);
            slot.querySelector('.dino-species').value = valid ? m.species : '';
            slot.querySelector('.dino-level').value = valid ? (m.level || 5) : 5;
            const atkSels = slot.querySelectorAll('.dino-attack');
            atkSels.forEach((sel, k) => {
                const aid = valid && Array.isArray(m.attacks) ? m.attacks[k] : '';
                sel.value = aid && this.dinoCatalog.attacks.some(a => a.id === aid) ? aid : '';
            });
            this.updateTeamSlotVisual(slot);
        });
    }

    getTeamFromForm() {
        const team = [];
        document.querySelectorAll('#npcTeamSlots .dino-slot').forEach(slot => {
            const dino = this.getDino(slot.querySelector('.dino-species').value);
            if (!dino) return;
            team.push({
                species: dino.id,
                name: dino.name,
                element: dino.element,
                image: dino.image,
                card: dino.card || '',
                level: Math.max(1, parseInt(slot.querySelector('.dino-level').value || '1', 10) || 1),
                attacks: [...slot.querySelectorAll('.dino-attack')].map(s => s.value).filter(Boolean)
            });
        });
        return team;
    }

    saveCurrentNpc() {
        if (!this.npcEditingTile) {
            alert('Por favor haz clic en una losa del mapa primero para ubicar al personaje.');
            return;
        }
        const { col, row } = this.npcEditingTile;
        const val = (id) => document.getElementById(id)?.value ?? '';
        const idx = this.npcs.findIndex(n => n.x === col && n.y === row);

        const npcObj = {
            id: idx >= 0 ? this.npcs[idx].id : `npc_${Date.now().toString(36)}`,
            x: col,
            y: row,
            name: val('npcName').trim() || 'Entrenador',
            sprite: val('npcSpriteSelect'),
            direction: val('npcDirection') || 'down',
            type: ['npc', 'tutor'].includes(val('npcType')) ? val('npcType') : 'trainer',
            sightRange: Math.max(0, parseInt(val('npcSightRange') || '0', 10) || 0),
            dialog: val('npcDialog').trim(),
            defeatDialog: val('npcDefeatDialog').trim(),
            team: this.getTeamFromForm(),
            moveCard: val('npcMoveCard') || null,
            rewardExp: Math.max(0, parseInt(val('npcRewardExp') || '0', 10) || 0)
        };
        if (npcObj.type !== 'trainer') {
            npcObj.sightRange = 0;
            npcObj.team = [];
            npcObj.moveCard = null;
            npcObj.rewardExp = 0;
            npcObj.defeatDialog = '';
        }

        if (idx >= 0) {
            this.npcs[idx] = npcObj;
            this.selectedNpcIndex = idx;
            this.pushHistory(`Modificar personaje en (${col}, ${row})`);
            this.showToast(`✅ Personaje "${npcObj.name}" actualizado.`);
        } else {
            this.npcs.push(npcObj);
            this.selectedNpcIndex = this.npcs.length - 1;
            this.pushHistory(`Crear personaje en (${col}, ${row})`);
            this.showToast(`✨ ${npcObj.type === 'trainer' ? 'Entrenador' : 'NPC'} "${npcObj.name}" colocado en (${col}, ${row}).`);
        }

        const btnDel = document.getElementById('btnDeleteNpc');
        if (btnDel) btnDel.style.display = 'inline-block';
        this.renderNpcsList();
        this.renderMap();
    }

    deleteCurrentNpc() {
        if ((this.selectedNpcIndex < 0 || this.selectedNpcIndex >= this.npcs.length) && this.npcEditingTile) {
            this.selectedNpcIndex = this.npcs.findIndex(n => n.x === this.npcEditingTile.col && n.y === this.npcEditingTile.row);
        }
        if (this.selectedNpcIndex < 0 || this.selectedNpcIndex >= this.npcs.length) return;

        const n = this.npcs[this.selectedNpcIndex];
        if (!confirm(`¿Eliminar al personaje "${n.name}" en (${n.x}, ${n.y})?`)) return;

        this.npcs.splice(this.selectedNpcIndex, 1);
        this.selectedNpcIndex = -1;
        this.npcEditingTile = null;

        const coordsEl = document.getElementById('npcCurrentTileCoords');
        if (coordsEl) coordsEl.textContent = '(Ninguna - Haz clic en el mapa)';
        const btnDel = document.getElementById('btnDeleteNpc');
        if (btnDel) btnDel.style.display = 'none';

        this.pushHistory(`Eliminar personaje en (${n.x}, ${n.y})`);
        this.renderNpcsList();
        this.renderMap();
        this.showToast('🗑️ Personaje eliminado.');
    }

    renderNpcsList() {
        const container = document.getElementById('npcsListContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!this.npcs || this.npcs.length === 0) {
            container.innerHTML = '<small style="color: #64748b; display: block; padding: 6px 0;">No hay personajes en este mapa aún.</small>';
            return;
        }

        const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        this.npcs.forEach((n, idx) => {
            const isTrainer = n.type === 'trainer' || !n.type;
            const typeIcon = isTrainer ? '⚔️' : (n.type === 'tutor' ? '📚' : '💬');
            const teamText = n.type === 'tutor' ? 'Maestro de ataques' : isTrainer
                ? ((n.team || []).map(m => `${m.name || m.species} Nv.${m.level}`).join(', ') || 'Sin equipo')
                  + (n.moveCard ? ` + 🃏 ${(this.dinoCatalog.attacks.find(a => a.id === n.moveCard) || {}).name || n.moveCard}` : '')
                : 'Solo diálogo';
            const card = document.createElement('div');
            card.className = `warp-card-item npc-card-item ${this.selectedNpcIndex === idx ? 'active' : ''}`;
            card.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
                    <span class="warp-card-title">${typeIcon} (${n.x}, ${n.y}) ${escapeHtml(n.name || '')}</span>
                    <span class="warp-card-target">${escapeHtml(teamText)}</span>
                </div>
                <button class="layer-action-btn btn-delete" style="width: 22px; height: 22px; font-size: 0.65rem;" title="Eliminar personaje">🗑️</button>
            `;
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete')) return;
                this.selectedNpcIndex = idx;
                this.npcEditingTile = { col: n.x, row: n.y };
                this.fillNpcForm(n, n.x, n.y);
                this.centerViewportOnTile(n.x, n.y);
                this.renderNpcsList();
                this.renderMap();
            });
            card.querySelector('.btn-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedNpcIndex = idx;
                this.deleteCurrentNpc();
            });
            container.appendChild(card);
        });
    }

    renderNpcsOverlay() {
        const ts = this.tileSize;
        const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        this.ctx.save();

        for (let i = 0; i < this.npcs.length; i++) {
            const n = this.npcs[i];
            const x = n.x * ts;
            const y = n.y * ts;
            const isSelected = (this.selectedNpcIndex === i);
            const isTrainer = n.type === 'trainer' || !n.type;

            // Línea de visión del entrenador (se corta en obstáculos)
            if (isTrainer && n.sightRange > 0) {
                const [dx, dy] = dirs[n.direction] || dirs.down;
                this.ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.35)' : 'rgba(239, 68, 68, 0.22)';
                for (let s = 1; s <= n.sightRange; s++) {
                    const c = n.x + dx * s;
                    const r = n.y + dy * s;
                    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) break;
                    if (this.solidGrid[r] && this.solidGrid[r][c]) break;
                    this.ctx.fillRect(c * ts + 2, r * ts + 2, ts - 4, ts - 4);
                }
            }

            // Losa base
            this.ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.45)' : (isTrainer ? 'rgba(239, 68, 68, 0.35)' : 'rgba(167, 139, 250, 0.35)');
            this.ctx.fillRect(x, y, ts, ts);
            this.ctx.strokeStyle = isSelected ? '#fbbf24' : (isTrainer ? '#ef4444' : '#a78bfa');
            this.ctx.lineWidth = isSelected ? 2.5 : 1.5;
            this.ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);

            // Sprite (2 losas de alto, pies sobre la losa)
            const size = ts * 2;
            if (!this.drawCharacterFrame(this.ctx, n.sprite, n.direction, x + ts / 2 - size / 2, y + ts - size + 4, size)) {
                this.ctx.font = 'bold 16px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillStyle = '#fff';
                this.ctx.fillText(isTrainer ? '⚔️' : (n.type === 'tutor' ? '📚' : '💬'), x + ts / 2, y + ts / 2);
            }

            // Nombre
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'alphabetic';
            this.ctx.lineWidth = 3;
            this.ctx.strokeStyle = '#000';
            this.ctx.fillStyle = isTrainer ? '#fbbf24' : '#ffffff';
            const label = `${isTrainer ? '⚔️ ' : ''}${n.name || ''}`;
            this.ctx.strokeText(label, x + ts / 2, y - ts + 2);
            this.ctx.fillText(label, x + ts / 2, y - ts + 2);
        }

        // Losa en edición
        if (this.activeMode === 'npc' && this.npcEditingTile) {
            this.ctx.strokeStyle = '#f43f5e';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(this.npcEditingTile.col * ts + 1, this.npcEditingTile.row * ts + 1, ts - 2, ts - 2);
            this.ctx.setLineDash([]);
        }

        this.ctx.restore();
    }

    async handleCreateNewMap() {
        const idInput = document.getElementById('inputNewMapId');
        let rawId = (idInput?.value || '').trim();
        if (!rawId) {
            alert('Por favor introduce un ID / nombre para el nuevo mapa (ej: casa_martin, cueva_1).');
            return;
        }

        // Sanitizar id
        let mapId = rawId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (!mapId.endsWith('.json')) {
            mapId = `${mapId}.json`;
        }

        const nameInput = document.getElementById('inputNewMapName');
        const mapTitle = (nameInput?.value || '').trim() || mapId.replace('.json', '');

        const colsInput = document.getElementById('inputNewMapCols');
        const rowsInput = document.getElementById('inputNewMapRows');
        const cols = Math.max(8, Math.min(250, parseInt(colsInput?.value || '20', 10)));
        const rows = Math.max(8, Math.min(250, parseInt(rowsInput?.value || '16', 10)));

        const tilesetSelect = document.getElementById('selectNewMapTileset');
        const chosenTileset = tilesetSelect?.value || 'exterior.png';

        const sizeSelect = document.getElementById('selectNewMapTileSize');
        const chosenTileSize = parseInt(sizeSelect?.value || '32', 10);
        this.tilesetTileSizes[chosenTileset] = chosenTileSize;
        this.sourceTileSize = chosenTileSize;

        // Generar estructura de mapa en blanco
        const groundGrid = [];
        const decorGrid = [];
        const solidGrid = [];
        const tallGrassGrid = [];

        for (let r = 0; r < rows; r++) {
            groundGrid[r] = [];
            decorGrid[r] = [];
            solidGrid[r] = [];
            tallGrassGrid[r] = [];
            for (let c = 0; c < cols; c++) {
                groundGrid[r][c] = { tileset: chosenTileset, r: 0, c: 0, srcSize: chosenTileSize };
                decorGrid[r][c] = null;
                solidGrid[r][c] = 0;
                tallGrassGrid[r][c] = 0;
            }
        }

        const newMapData = {
            version: 2,
            name: mapTitle,
            cols: cols,
            rows: rows,
            tileSize: this.tileSize,
            sourceTileSize: chosenTileSize,
            tilesetTileSizes: { ...this.tilesetTileSizes, [chosenTileset]: chosenTileSize },
            tilesets: {
                "exterior": "exterior.png",
                "grass": "GRASS+.png",
                "water": "Water+.png",
                "bridges": "Bridges.png"
            },
            layers: [
                { id: 'layer_0', name: 'Suelo Base', type: 'ground', visible: true, grid: groundGrid },
                { id: 'layer_1', name: 'Muebles & Paredes', type: 'decor', visible: true, grid: decorGrid }
            ],
            warps: [],
            solid: solidGrid,
            tallGrass: tallGrassGrid,
            ground: [],
            decor: []
        };

        // Cerrar modal
        const modal = document.getElementById('modalNewMap');
        if (modal) modal.style.display = 'none';

        // Establecer proyecto activo y cargar tileset si necesario
        this.currentProjectName = mapId;
        this.currentTilesetKey = chosenTileset;
        const tilesetSel = document.getElementById('tilesetSelector');
        if (tilesetSel) tilesetSel.value = chosenTileset;

        this.applyMapData(newMapData);
        this.history = [];
        this.historyIndex = -1;
        this.pushHistory(`Crear nuevo mapa: ${mapId}`);

        // Guardar borrador en el servidor inmediatamente
        await this.saveDraft();
        await this.loadProjectList();

        this.renderPalette();
        this.renderMap();
        this.renderMinimap();
        this.centerViewportOnTile(Math.floor(cols / 2), Math.floor(rows / 2));

        this.showToast(`✨ ¡Nuevo mapa "${mapId}" creado con éxito (${cols}x${rows})! Listo para editar.`);
    }

    addNewLayer(customName) {
        const num = this.layers.length + 1;
        const suggestedName = customName || `Capa ${num} (Detalles)`;
        const name = prompt('Nombre de la nueva capa:', suggestedName);
        if (!name || !name.trim()) return;

        const newGrid = [];
        for (let r = 0; r < this.rows; r++) {
            newGrid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                newGrid[r][c] = null;
            }
        }

        const newLayer = {
            id: `layer_${Date.now()}`,
            name: name.trim(),
            type: 'custom',
            visible: true,
            grid: newGrid
        };

        this.layers.push(newLayer);
        this.activeMode = 'tile';
        this.activeLayerIndex = this.layers.length - 1;

        this.pushHistory(`Crear capa: ${name.trim()}`);
        this.renderLayersPanel();
        this.renderMap();
        this.updateBrushPreview();
        this.updateStatusMode();
        this.showToast(`✨ Capa "${name.trim()}" creada y lista para pintar.`);
    }

    deleteLayer(index) {
        if (this.layers.length <= 1) {
            alert('No se puede eliminar la única capa restante.');
            return;
        }
        const layer = this.layers[index];
        if (!confirm(`¿Eliminar la capa "${layer.name}"? Los tiles que contiene se perderán.`)) return;

        this.layers.splice(index, 1);
        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        }

        this.pushHistory(`Eliminar capa: ${layer.name}`);
        this.renderLayersPanel();
        this.renderMap();
        this.renderMinimap();
        this.updateBrushPreview();
        this.updateStatusMode();
        this.showToast(`🗑️ Capa "${layer.name}" eliminada.`);
    }

    moveLayer(index, delta) {
        const target = index + delta;
        if (target < 0 || target >= this.layers.length) return;

        const cur = this.layers[index];
        this.layers[index] = this.layers[target];
        this.layers[target] = cur;

        if (this.activeLayerIndex === index) {
            this.activeLayerIndex = target;
        } else if (this.activeLayerIndex === target) {
            this.activeLayerIndex = index;
        }

        this.pushHistory(`Reordenar capa ${cur.name}`);
        this.renderLayersPanel();
        this.renderMap();
        this.showToast(`↕️ Capa "${cur.name}" movida a la posición ${target + 1}.`);
    }

    toggleLayerVisibility(index) {
        if (this.layers[index]) {
            this.layers[index].visible = !this.layers[index].visible;
            this.renderLayersPanel();
            this.renderMap();
        }
    }

    renameLayer(index) {
        const current = this.layers[index].name;
        const newName = prompt('Nuevo nombre para la capa:', current);
        if (newName && newName.trim() && newName.trim() !== current) {
            this.layers[index].name = newName.trim();
            this.renderLayersPanel();
            this.updateStatusMode();
            this.updateBrushPreview();
            this.showToast(`✏️ Capa renombrada a "${newName.trim()}".`);
        }
    }

    setActiveTool(tool) {
        this.activeTool = tool;
        if (this.activeMode === 'warp') {
            this.activeMode = 'tile';
            const warpSection = document.getElementById('warpPaletteSection');
            if (warpSection) warpSection.style.display = 'none';
        }
        if (this.activeMode === 'npc') {
            this.activeMode = 'tile';
        }
        this.hideNpcPanel();
        document.querySelectorAll('.tool-btn[id^="tool"]').forEach(b => b.classList.remove('active'));
        const toolWarpBtn = document.getElementById('toolWarp');
        if (toolWarpBtn) toolWarpBtn.classList.remove('active');

        const activeBtn = document.getElementById(`tool${tool.charAt(0).toUpperCase() + tool.slice(1)}`);
        if (activeBtn) activeBtn.classList.add('active');
        this.renderLayersPanel();
        this.updateStatusMode();
    }

    updateStatusMode() {
        const modeEl = document.getElementById('statusMode');
        if (modeEl) {
            const toolNames = { pencil: 'Lápiz', fill: 'Relleno', eraser: 'Borrador', picker: 'Pipeta' };
            let currentLayerName = 'Suelo Base';
            if (this.activeMode === 'collision') {
                currentLayerName = '🚫 Colisiones & Permisos';
            } else if (this.activeMode === 'warp') {
                currentLayerName = '🌀 Puertas & Warps';
            } else if (this.activeMode === 'npc') {
                currentLayerName = '🧑 Personajes & Combates';
            } else if (this.layers[this.activeLayerIndex]) {
                currentLayerName = `📑 ${this.layers[this.activeLayerIndex].name}`;
            }

            const activeToolText = (this.activeMode === 'warp') ? 'Colocar Warp'
                : (this.activeMode === 'npc') ? 'Colocar Personaje'
                : (toolNames[this.activeTool] || 'Lápiz');
            modeEl.innerHTML = `Capa Activa: <strong id="statusCurrentLayerName">${currentLayerName}</strong> | Herramienta: <strong>${activeToolText}</strong>`;
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
            if (this.currentProjectName.includes('casa')) {
                zoneName = '🏠 Interior de Casa';
            } else if (this.currentProjectName.includes('cueva')) {
                zoneName = '⛰️ Cueva Subterránea';
            } else if (col >= 44 && col <= 76 && row >= 36 && row <= 54) {
                zoneName = '🏡 Pueblo Raíz (Plaza Central)';
            } else if (col <= 44 && row <= 36) {
                zoneName = '🌊 Lago Espejo & Bahía';
            } else if (col >= 76 && row <= 36) {
                zoneName = '🌿 Selva Jurásica';
            } else if (col <= 44 && row >= 54) {
                zoneName = '🦕 Santuario Jurásico';
            } else if (col >= 76 && row >= 54) {
                zoneName = '🪨 Cañón Prehistórico';
            } else if (row < 36) {
                zoneName = '🌺 Ruta 1 Norte';
            } else if (row > 54) {
                zoneName = '🌾 Ruta 1 Sur';
            }
            zoneEl.textContent = zoneName;
        }
    }

    initKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'p' || e.key === 'b') this.setActiveTool('pencil');
            if (e.key === 'f' || e.key === 'g') this.setActiveTool('fill');
            if (e.key === 'e') this.setActiveTool('eraser');
            if (e.key === 'i') this.setActiveTool('picker');
            if (e.key === 'w') this.selectWarpMode();
            if (e.key === 'n') this.selectNpcMode();
            if (e.key === 'h') document.getElementById('btnToggleGrid').click();

            // Atajos numéricos para capas
            if (e.key >= '1' && e.key <= '9') {
                const layerIdx = parseInt(e.key, 10) - 1;
                if (layerIdx < this.layers.length) {
                    this.selectLayer(layerIdx);
                }
            } else if (e.key === '0') {
                this.selectCollisionLayer();
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveDraft();
            }
        });
    }

    async saveDraft() {
        const btn = document.getElementById('btnSaveDraft');
        if (btn) btn.textContent = '⏳ Guardando...';

        try {
            const data = this.getExportableMapData();
            const res = await fetch(`/api/project?name=${encodeURIComponent(this.currentProjectName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                this.showToast(`💾 Borrador guardado en projects/${this.currentProjectName} (el juego no ha sido modificado).`);
            } else {
                this.showToast('❌ Error al guardar el borrador.');
            }
        } catch (e) {
            console.error('Error guardando borrador:', e);
            this.showToast('❌ Error de conexión al guardar.');
        } finally {
            if (btn) btn.textContent = '💾 Guardar Borrador';
        }
    }

    async deployToGame() {
        const btn = document.getElementById('btnDeployGame');
        if (btn) btn.textContent = '🚀 Publicando...';

        try {
            const data = this.getExportableMapData();
            const mapName = (this.currentProjectName || 'world_map.json').endsWith('.json')
                ? this.currentProjectName
                : `${this.currentProjectName}.json`;

            const res = await fetch(`/api/deploy?name=${encodeURIComponent(mapName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                this.showToast(`🎉 ¡MAPA "${mapName}" PUBLICADO AL JUEGO! Ya puedes recargar http://localhost:8000 para verlo en vivo.`);
            } else {
                this.showToast('❌ Error al publicar en el juego.');
            }
        } catch (e) {
            console.error('Error al publicar:', e);
            this.showToast('❌ Error de conexión al publicar.');
        } finally {
            if (btn) btn.textContent = '🚀 Publicar al Juego';
        }
    }

    showToast(msg) {
        const toast = document.getElementById('editorToast');
        if (toast) {
            toast.textContent = msg;
            toast.style.opacity = '1';
            setTimeout(() => {
                if (toast.textContent === msg) toast.style.opacity = '0';
            }, 5000);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.advanceMapEditor = new AdvanceMapEditor();
});
