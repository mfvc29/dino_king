/**
 * TileMap - Generador y renderizador del mapa real de Dino King
 * Utiliza el tileset original GRASS+.png (16x16 por tile, escalado a 32px)
 * con caminos de tierra, diferentes tipos de pasto, flores, cercas de madera y agua.
 */

// Mapeo de coordenadas (fila, columna) en el tileset GRASS+.png (25 cols x 14 rows, 16x16 px)
const TILES = {
    // Pastos base
    GRASS_LIGHT: { r: 0, c: 0 },
    GRASS_DETAIL_1: { r: 0, c: 2 },
    GRASS_DETAIL_2: { r: 0, c: 4 },
    GRASS_MED: { r: 4, c: 0 },
    GRASS_FLOWER_YELLOW: { r: 0, c: 1 },
    GRASS_FLOWER_RED: { r: 0, c: 3 },
    GRASS_FLOWER_WHITE: { r: 0, c: 5 },
    GRASS_TUFT: { r: 4, c: 2 },

    // Pasto silvestre / Hierba alta (donde aparecen dinos)
    TALL_GRASS_1: { r: 8, c: 0 },
    TALL_GRASS_2: { r: 8, c: 2 },
    TALL_GRASS_3: { r: 10, c: 0 },
    TALL_GRASS_TUFT: { r: 10, c: 2 },

    // Camino de tierra / Arena
    PATH_CENTER: { r: 1, c: 14 },
    PATH_TOP: { r: 0, c: 14 },
    PATH_BOTTOM: { r: 2, c: 14 },
    PATH_LEFT: { r: 1, c: 13 },
    PATH_RIGHT: { r: 1, c: 15 },
    PATH_CORNER_TL: { r: 0, c: 13 },
    PATH_CORNER_TR: { r: 0, c: 15 },
    PATH_CORNER_BL: { r: 2, c: 13 },
    PATH_CORNER_BR: { r: 2, c: 15 },
    PATH_ROUGH: { r: 4, c: 14 },

    // Vallas de madera (Sólidas)
    FENCE_HORIZ: { r: 0, c: 10, solid: true },
    FENCE_VERT: { r: 1, c: 10, solid: true },
    FENCE_POST: { r: 2, c: 10, solid: true },
    FENCE_CORNER: { r: 0, c: 11, solid: true },

    // Agua / Lago (Sólido)
    WATER_DEEP: { r: 11, c: 0, solid: true, isWater: true },
    WATER_SURF: { r: 11, c: 1, solid: true, isWater: true },
    WATER_SHORE_N: { r: 1, c: 0, solid: true, isWater: true },
    WATER_SHORE_S: { r: 1, c: 2, solid: true, isWater: true },

    // Rocas y Piedras (Sólidas)
    ROCK_LARGE: { r: 12, c: 2, solid: true },
    ROCK_SMALL: { r: 12, c: 3, solid: true },
    CLIFF_WALL: { r: 13, c: 12, solid: true },

    // ============================================================
    // ELEMENTOS ACUÁTICOS (Water+.png y assets/water_tiles/)
    // ============================================================
    WATER_DEEP_ANIM: { tileset: 'water', r: 3, c: 3, solid: true, isWater: true },
    WATER_RIPPLE: { tileset: 'water', r: 4, c: 3, solid: true, isWater: true },
    WATER_LILY_1: { tileset: 'water', r: 9, c: 0, solid: false },
    WATER_LILY_2: { tileset: 'water', r: 9, c: 2, solid: false },
    WATER_LILY_3: { tileset: 'water', r: 9, c: 4, solid: false },
    WATER_LOTUS_PINK: { tileset: 'water', r: 10, c: 0, solid: false },
    WATER_LOTUS_WHITE: { tileset: 'water', r: 10, c: 2, solid: false },
    WATER_REEDS: { tileset: 'water', r: 11, c: 4, solid: true },
    WATER_ROCK: { tileset: 'water', r: 12, c: 4, solid: true }
};

// Nombre real de cada tileset (en minúsculas -> archivo en assets/maps)
const TILESET_FILES = { outside: 'Outside.png', caves: 'Caves.png', charcos: 'charcos.png' };

class TileMap {
    constructor(cols = 120, rows = 90, tileSize = 32) {
        this.cols = cols;
        this.rows = rows;
        this.tileSize = tileSize; // Tamaño escalado en pantalla (32x32 px)
        this.sourceTileSize = 16;  // Tamaño en el tileset original GRASS+.png
        this.width = cols * tileSize;
        this.height = rows * tileSize;

        this.tilesetLoaded = false;
        this.tilesetImage = new Image();
        this.tilesetImage.onload = () => {
            this.tilesetLoaded = true;
        };
        this.tilesetImage.src = 'assets/maps/GRASS+.png';

        // Carga de tileset acuático Water+.png (desde assets/maps/)
        this.waterTilesetLoaded = false;
        this.waterTilesetImage = new Image();
        this.waterTilesetImage.onload = () => {
            this.waterTilesetLoaded = true;
        };
        this.waterTilesetImage.src = 'assets/maps/Water+.png';

        // Capas del mapa
        this.currentMapId = 'world_map';
        this.warps = [];
        this.npcs = [];            // Personajes de eventos (datos crudos del JSON)
        this.npcBlockers = new Set(); // Losas "col,row" ocupadas por NPCs
        this.layers = null;
        this.groundGrid = [];
        this.decorGrid = [];
        this.solidGrid = [];
        this.tallGrassGrid = [];

        // Cache de imágenes de tilesets dinámicos
        this.tilesetsCache = {};

        this.generateRealMap();
        this.loadSavedMap();
    }

    /**
     * Lee un mapa como archivo estático (assets/maps/<id>.json): funciona igual en local y en
     * Firebase. Si no existe, prueba la API del servidor local (/api/map).
     */
    static async fetchMap(mapId) {
        for (const url of [`assets/maps/${encodeURIComponent(mapId)}.json`, `/api/map?id=${encodeURIComponent(mapId)}`]) {
            try {
                const res = await fetch(url);
                const type = res.headers.get('content-type') || '';
                if (res.ok && type.includes('json')) return await res.json();
            } catch (e) { /* probar la siguiente */ }
        }
        return null;
    }

    getTilesetImage(rawName) {
        if (!rawName) return this.tilesetImage;
        let name = rawName.toLowerCase();
        if (name.endsWith('.png')) name = name.slice(0, -4);
        if (name === 'grass+' || name === 'grass') return this.tilesetImage;
        if (name === 'water+' || name === 'water') return this.waterTilesetImage;

        if (this.tilesetsCache[name]) return this.tilesetsCache[name];

        // Nombre real del archivo (Firebase distingue mayúsculas: "outside" -> "Outside.png")
        const file = TILESET_FILES[name] || `${name}.png`;
        const img = new Image();
        img.src = `assets/maps/${file}`;
        this.tilesetsCache[name] = img;
        return img;
    }

    async loadSavedMap() {
        await this.loadMapById('world_map');
    }

    async loadMapById(mapId) {
        if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
        try {
            const cleanId = (mapId || 'world_map').replace('.json', '');
            const token = this.loadToken = (this.loadToken || 0) + 1;
            const data = await TileMap.fetchMap(cleanId);
            if (data) {
                if (token !== this.loadToken) return false; // llegó una carga más reciente
                this.currentMapId = cleanId;
                this.applyMapData(data);
                console.log(`🗺️ ¡Mapa "${cleanId}" cargado correctamente!`);
                if (typeof this.onMapLoaded === 'function') {
                    this.onMapLoaded(this);
                }
                return true;
            }
        } catch (e) {
            console.warn('Usando mapa procedimental base:', e);
        }
        return false;
    }

    getWarpAt(col, row) {
        if (!this.warps || this.warps.length === 0) return null;
        return this.warps.find(w => w.x === col && w.y === row) || null;
    }

    applyMapData(data) {
        if (!data) return;
        this.cols = data.cols || this.cols;
        this.rows = data.rows || this.rows;
        this.width = this.cols * this.tileSize;
        this.height = this.rows * this.tileSize;
        if (data.sourceTileSize) {
            this.sourceTileSize = data.sourceTileSize;
        }
        if (data.tilesetTileSizes) {
            this.tilesetTileSizes = Object.assign({}, this.tilesetTileSizes || {});
            for (const [k, v] of Object.entries(data.tilesetTileSizes)) {
                this.tilesetTileSizes[k] = v;
                const kLower = k.toLowerCase();
                this.tilesetTileSizes[kLower] = v;
                const clean = kLower.endsWith('.png') ? kLower.slice(0, -4) : kLower;
                this.tilesetTileSizes[clean] = v;
            }
        }
        if (data.spawn && typeof data.spawn.x === 'number' && typeof data.spawn.y === 'number') {
            this.spawn = { x: data.spawn.x, y: data.spawn.y };
        }
        this.mapName = data.name || this.currentMapId;

        // Cargar capas dinámicas si existen (formato multicapa v2)
        if (data.layers && Array.isArray(data.layers) && data.layers.length > 0) {
            this.layers = data.layers.map(lData => {
                const grid = [];
                for (let r = 0; r < this.rows; r++) {
                    grid[r] = [];
                    for (let c = 0; c < this.cols; c++) {
                        const cell = lData.grid && lData.grid[r] ? lData.grid[r][c] : null;
                        if (cell && Array.isArray(cell)) {
                            const isWater = (cell[0] === 'water' || cell[0] === 'water+.png');
                            grid[r][c] = {
                                tileset: cell[0],
                                r: cell[1],
                                c: cell[2],
                                srcSize: cell[3],
                                isWater: isWater
                            };
                        } else {
                            grid[r][c] = null;
                        }
                    }
                }
                return {
                    name: lData.name,
                    visible: lData.visible !== false,
                    grid: grid
                };
            });
        }

        // Rellenar también groundGrid, decorGrid, solidGrid y tallGrassGrid
        for (let r = 0; r < this.rows; r++) {
            if (!this.groundGrid[r]) this.groundGrid[r] = [];
            if (!this.decorGrid[r]) this.decorGrid[r] = [];
            if (!this.solidGrid[r]) this.solidGrid[r] = [];
            if (!this.tallGrassGrid[r]) this.tallGrassGrid[r] = [];

            for (let c = 0; c < this.cols; c++) {
                if (data.ground && data.ground[r]) {
                    const g = data.ground[r][c];
                    if (g && Array.isArray(g)) {
                        const isWater = (g[0] === 'water' || g[0] === 'water+.png');
                        this.groundGrid[r][c] = {
                            tileset: isWater ? 'water' : 'grass',
                            r: g[1],
                            c: g[2],
                            isWater: isWater
                        };
                    }
                }

                if (data.decor && data.decor[r]) {
                    const d = data.decor[r][c];
                    if (d && Array.isArray(d)) {
                        const isWater = (d[0] === 'water' || d[0] === 'water+.png');
                        this.decorGrid[r][c] = {
                            tileset: isWater ? 'water' : 'grass',
                            r: d[1],
                            c: d[2],
                            isWater: isWater
                        };
                    } else {
                        this.decorGrid[r][c] = null;
                    }
                }

                this.solidGrid[r][c] = (data.solid && data.solid[r]) ? (data.solid[r][c] === 1) : false;
                this.tallGrassGrid[r][c] = (data.tallGrass && data.tallGrass[r]) ? (data.tallGrass[r][c] === 1) : false;
            }
        }

        // Warps
        this.warps = Array.isArray(data.warps) ? data.warps : [];

        // Personajes de eventos (entrenadores / NPCs)
        this.npcs = Array.isArray(data.npcs) ? data.npcs : [];
    }

    generateRealMap() {
        for (let r = 0; r < this.rows; r++) {
            this.groundGrid[r] = [];
            this.decorGrid[r] = [];
            this.solidGrid[r] = [];
            this.tallGrassGrid[r] = [];

            for (let c = 0; c < this.cols; c++) {
                // 1. Base de pasto con variación natural
                let baseTile = TILES.GRASS_LIGHT;
                const rand = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
                const frac = rand - Math.floor(rand);

                if (frac < 0.35) baseTile = TILES.GRASS_DETAIL_1;
                else if (frac < 0.60) baseTile = TILES.GRASS_MED;
                else if (frac < 0.75) baseTile = TILES.GRASS_DETAIL_2;

                this.groundGrid[r][c] = baseTile;
                this.decorGrid[r][c] = null;
                this.solidGrid[r][c] = false;
                this.tallGrassGrid[r][c] = false;

                // Bordes exteriores sólidos (valla de madera alrededor de todo el mapa)
                if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
                    this.decorGrid[r][c] = (r === 0 || r === this.rows - 1) ? TILES.FENCE_HORIZ : TILES.FENCE_VERT;
                    this.solidGrid[r][c] = true;
                }
            }
        }

        // ============================================================
        // 2. RED PRINCIPAL DE CAMINOS Y AVENIDAS
        // ============================================================
        // Gran Avenida Central Horizontal (Este - Oeste)
        for (let c = 4; c < this.cols - 4; c++) {
            for (let dr = 0; dr <= 2; dr++) {
                const r = 44 + dr;
                this.groundGrid[r][c] = (dr === 0) ? TILES.PATH_TOP : (dr === 2) ? TILES.PATH_BOTTOM : TILES.PATH_CENTER;
            }
        }

        // Gran Avenida Central Vertical (Norte - Sur)
        for (let r = 4; r < this.rows - 4; r++) {
            for (let dc = 0; dc <= 2; dc++) {
                const c = 59 + dc;
                this.groundGrid[r][c] = (dc === 0) ? TILES.PATH_LEFT : (dc === 2) ? TILES.PATH_RIGHT : TILES.PATH_CENTER;
            }
        }

        // Caminos Secundarios Verticales hacia Zonas Exteriores
        // Camino Oeste (conecta Lago con Santuario)
        for (let r = 10; r < this.rows - 10; r++) {
            for (let dc = 0; dc <= 1; dc++) {
                const c = 26 + dc;
                this.groundGrid[r][c] = TILES.PATH_CENTER;
            }
        }
        // Camino Este (conecta Selva con Cañón)
        for (let r = 10; r < this.rows - 10; r++) {
            for (let dc = 0; dc <= 1; dc++) {
                const c = 92 + dc;
                this.groundGrid[r][c] = TILES.PATH_CENTER;
            }
        }

        // ============================================================
        // 3. ZONA CENTRAL: PUEBLO RAÍZ (Plaza de los Entrenadores)
        // ============================================================
        // Gran Plaza adoquinada central completamente abierta, limpia y transitable
        for (let r = 40; r <= 48; r++) {
            for (let c = 54; c <= 66; c++) {
                this.groundGrid[r][c] = TILES.PATH_CENTER;
                this.decorGrid[r][c] = null;
                this.solidGrid[r][c] = false;
            }
        }

        // Jardines florales ornamentales en las 4 esquinas de Pueblo Raíz
        const townGardens = [
            { r: 38, c: 48, flower: TILES.GRASS_FLOWER_RED },
            { r: 38, c: 70, flower: TILES.GRASS_FLOWER_YELLOW },
            { r: 50, c: 48, flower: TILES.GRASS_FLOWER_WHITE },
            { r: 50, c: 70, flower: TILES.GRASS_FLOWER_YELLOW }
        ];
        townGardens.forEach(g => {
            for (let dr = 0; dr < 3; dr++) {
                for (let dc = 0; dc < 4; dc++) {
                    const r = g.r + dr;
                    const c = g.c + dc;
                    this.decorGrid[r][c] = g.flower;
                }
            }
            // Valla decorativa alrededor de cada jardín
            for (let dc = 0; dc < 4; dc++) {
                this.decorGrid[g.r - 1][g.c + dc] = TILES.FENCE_HORIZ;
                this.solidGrid[g.r - 1][g.c + dc] = true;
            }
        });

        // ============================================================
        // 4. ZONA NOROESTE: LAGO ESPEJO & BAHÍA JURÁSICA
        // ============================================================
        // Gran Lago de agua profunda animada desde Water+.png
        for (let r = 12; r <= 32; r++) {
            for (let c = 10; c <= 42; c++) {
                // Forma redondeada orgánica del lago
                const dx = (c - 26) / 16;
                const dy = (r - 22) / 10;
                if (dx * dx + dy * dy <= 1.05) {
                    this.groundGrid[r][c] = TILES.WATER_DEEP_ANIM;
                    this.solidGrid[r][c] = true;
                }
            }
        }

        // Elementos acuáticos: Nenúfares y Lotos en Lago Espejo
        const waterDecorations = [
            { r: 16, c: 18, t: TILES.WATER_LILY_1 },
            { r: 18, c: 34, t: TILES.WATER_LILY_2 },
            { r: 25, c: 16, t: TILES.WATER_LOTUS_PINK },
            { r: 20, c: 36, t: TILES.WATER_LOTUS_WHITE },
            { r: 27, c: 32, t: TILES.WATER_LILY_3 },
            { r: 14, c: 26, t: TILES.WATER_LOTUS_PINK },
            { r: 28, c: 20, t: TILES.WATER_LILY_1 },
            { r: 17, c: 22, t: TILES.WATER_LOTUS_WHITE },
            // Juncos de orilla acuática
            { r: 14, c: 15, t: TILES.WATER_REEDS },
            { r: 30, c: 18, t: TILES.WATER_REEDS },
            { r: 30, c: 34, t: TILES.WATER_REEDS }
        ];
        waterDecorations.forEach(wd => {
            if (wd.r < this.rows && wd.c < this.cols) {
                this.decorGrid[wd.r][wd.c] = wd.t;
                if (wd.t.solid) this.solidGrid[wd.r][wd.c] = true;
            }
        });

        // Islote secreto en medio del lago
        for (let r = 20; r <= 24; r++) {
            for (let c = 24; c <= 28; c++) {
                const dx = (c - 26) / 2.5;
                const dy = (r - 22) / 2.5;
                if (dx * dx + dy * dy <= 1) {
                    this.groundGrid[r][c] = TILES.GRASS_LIGHT;
                    this.solidGrid[r][c] = false;
                    if (r === 22 && c === 26) {
                        this.decorGrid[r][c] = TILES.ROCK_LARGE;
                        this.solidGrid[r][c] = true;
                    } else if (r === 21 && c === 25) {
                        this.decorGrid[r][c] = TILES.GRASS_FLOWER_RED;
                    }
                }
            }
        }

        // Muelle de madera con vallas que entra al lago
        for (let r = 29; r <= 33; r++) {
            this.groundGrid[r][26] = TILES.PATH_CENTER;
            this.solidGrid[r][26] = false;
            this.decorGrid[r][25] = TILES.FENCE_VERT;
            this.solidGrid[r][25] = true;
            this.decorGrid[r][27] = TILES.FENCE_VERT;
            this.solidGrid[r][27] = true;
        }

        // Senderos y rocas costeras alrededor del lago
        for (let c = 8; c <= 44; c++) {
            if (this.groundGrid[10][c] !== TILES.WATER_DEEP) {
                this.groundGrid[10][c] = TILES.PATH_CENTER;
            }
        }
        [
            { r: 12, c: 11 }, { r: 15, c: 9 }, { r: 28, c: 9 },
            { r: 14, c: 42 }, { r: 27, c: 41 }, { r: 33, c: 38 }
        ].forEach(rk => {
            this.decorGrid[rk.r][rk.c] = TILES.ROCK_LARGE;
            this.solidGrid[rk.r][rk.c] = true;
        });

        // ============================================================
        // 5. ZONA NORDESTE: SELVA JURÁSICA & BOSQUE SOMBRÍO
        // ============================================================
        // Grandes extensiones de hierba alta donde habitan los dinos salvajes
        const junglePatches = [
            { r: 8, c: 76, w: 18, h: 12 },
            { r: 22, c: 76, w: 16, h: 14 },
            { r: 8, c: 96, w: 18, h: 14 },
            { r: 24, c: 94, w: 20, h: 14 }
        ];
        junglePatches.forEach(p => {
            for (let r = p.r; r < p.r + p.h; r++) {
                for (let c = p.c; c < p.c + p.w; c++) {
                    if (r < this.rows - 2 && c < this.cols - 2 && this.groundGrid[r][c].r !== 1) {
                        this.groundGrid[r][c] = (r + c) % 2 === 0 ? TILES.TALL_GRASS_1 : TILES.TALL_GRASS_2;
                        this.tallGrassGrid[r][c] = true;
                    }
                }
            }
        });

        // Senderos sinuosos entre la hierba alta de la selva
        for (let c = 76; c <= 112; c++) {
            const r = 20 + Math.floor(Math.sin(c * 0.3) * 3);
            this.groundGrid[r][c] = TILES.PATH_CENTER;
            this.tallGrassGrid[r][c] = false;
        }

        // Flores y rocas de la selva
        [
            { r: 12, c: 84, t: TILES.GRASS_FLOWER_RED },
            { r: 15, c: 104, t: TILES.GRASS_FLOWER_YELLOW },
            { r: 28, c: 82, t: TILES.GRASS_FLOWER_WHITE },
            { r: 32, c: 108, t: TILES.GRASS_FLOWER_RED }
        ].forEach(f => {
            this.decorGrid[f.r][f.c] = f.t;
        });
        [
            { r: 10, c: 90 }, { r: 25, c: 88 }, { r: 18, c: 110 }, { r: 30, c: 100 }
        ].forEach(rk => {
            this.decorGrid[rk.r][rk.c] = TILES.ROCK_LARGE;
            this.solidGrid[rk.r][rk.c] = true;
        });

        // ============================================================
        // 6. ZONA SUROESTE: SANTUARIO JURÁSICO (Granja y Corrales Dino)
        // ============================================================
        // Cerca perimetral del corral de dinosaurios
        const corralR1 = 58, corralR2 = 82;
        const corralC1 = 10, corralC2 = 44;

        for (let c = corralC1; c <= corralC2; c++) {
            this.decorGrid[corralR1][c] = TILES.FENCE_HORIZ;
            this.solidGrid[corralR1][c] = true;
            this.decorGrid[corralR2][c] = TILES.FENCE_HORIZ;
            this.solidGrid[corralR2][c] = true;
        }
        for (let r = corralR1; r <= corralR2; r++) {
            this.decorGrid[r][corralC1] = TILES.FENCE_VERT;
            this.solidGrid[r][corralR1] = true;
            this.decorGrid[r][corralC2] = TILES.FENCE_VERT;
            this.solidGrid[r][corralC2] = true;
        }
        // Puertas abiertas del corral
        this.decorGrid[corralR1][26] = null;
        this.solidGrid[corralR1][26] = false;
        this.decorGrid[corralR1][27] = null;
        this.solidGrid[corralR1][27] = false;

        // Bebedero de agua para dinosaurios dentro del corral
        for (let r = 68; r <= 74; r++) {
            for (let c = 28; c <= 36; c++) {
                this.groundGrid[r][c] = TILES.WATER_DEEP_ANIM;
                this.solidGrid[r][c] = true;
            }
        }
        this.decorGrid[70][30] = TILES.WATER_LILY_1;
        this.decorGrid[72][34] = TILES.WATER_LOTUS_WHITE;
        this.decorGrid[69][35] = TILES.WATER_REEDS;
        this.solidGrid[69][35] = true;
        this.decorGrid[73][29] = TILES.WATER_REEDS;
        this.solidGrid[73][29] = true;
        // Pasto de forraje / hierba alta dentro del corral
        for (let r = 62; r <= 78; r++) {
            for (let c = 14; c <= 24; c++) {
                this.groundGrid[r][c] = (r + c) % 2 === 0 ? TILES.TALL_GRASS_1 : TILES.TALL_GRASS_2;
                this.tallGrassGrid[r][c] = true;
            }
        }

        // ============================================================
        // 7. ZONA SURESTE: CAÑÓN PREHISTÓRICO & CANTERA ROCOSA
        // ============================================================
        // Terreno árido de piedras y acantilados
        for (let r = 58; r <= 84; r++) {
            for (let c = 78; c <= 114; c++) {
                if ((r + c) % 3 === 0) {
                    this.groundGrid[r][c] = TILES.PATH_ROUGH;
                }
            }
        }
        // Formaciones rocosas y pilares del cañón
        const canyonRocks = [
            { r: 60, c: 80 }, { r: 60, c: 81 }, { r: 61, c: 80 },
            { r: 64, c: 96 }, { r: 64, c: 97 }, { r: 65, c: 96 },
            { r: 70, c: 84 }, { r: 70, c: 85 }, { r: 71, c: 84 },
            { r: 72, c: 104 }, { r: 72, c: 105 }, { r: 73, c: 104 },
            { r: 78, c: 88 }, { r: 78, c: 89 }, { r: 79, c: 88 },
            { r: 80, c: 108 }, { r: 80, c: 109 }, { r: 81, c: 108 },
            { r: 66, c: 110 }, { r: 74, c: 94 }, { r: 82, c: 78 }
        ];
        canyonRocks.forEach(cr => {
            if (cr.r < this.rows - 1 && cr.c < this.cols - 1) {
                this.decorGrid[cr.r][cr.c] = TILES.ROCK_LARGE;
                this.solidGrid[cr.r][cr.c] = true;
            }
        });

        // ============================================================
        // 8. RUTA 1 NORTE Y SUR (Praderas Florales)
        // ============================================================
        // Campos de flores en Ruta Norte
        for (let r = 8; r <= 34; r += 2) {
            this.decorGrid[r][54] = TILES.GRASS_FLOWER_YELLOW;
            this.decorGrid[r + 1][55] = TILES.GRASS_FLOWER_RED;
            this.decorGrid[r][66] = TILES.GRASS_FLOWER_WHITE;
            this.decorGrid[r + 1][67] = TILES.GRASS_FLOWER_YELLOW;
        }
        // Parches de hierba silvestre en Ruta Sur
        for (let r = 60; r <= 80; r += 4) {
            for (let c = 52; c <= 56; c++) {
                this.groundGrid[r][c] = TILES.TALL_GRASS_1;
                this.tallGrassGrid[r][c] = true;
            }
            for (let c = 64; c <= 68; c++) {
                this.groundGrid[r + 1][c] = TILES.TALL_GRASS_2;
                this.tallGrassGrid[r + 1][c] = true;
            }
        }
    }

    isSolid(x, y, w = 14, h = 10) {
        const checkPoints = [
            { x: x - w / 2, y: y - h / 2 },
            { x: x + w / 2, y: y - h / 2 },
            { x: x - w / 2, y: y + h / 2 },
            { x: x + w / 2, y: y + h / 2 }
        ];

        for (const pt of checkPoints) {
            const col = Math.floor(pt.x / this.tileSize);
            const row = Math.floor(pt.y / this.tileSize);

            if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
                return true;
            }
            if (this.solidGrid[row][col]) {
                return true;
            }
            if (this.npcBlockers.has(`${col},${row}`)) {
                return true;
            }
        }
        return false;
    }

    isTallGrass(x, y) {
        const col = Math.floor(x / this.tileSize);
        const row = Math.floor(y / this.tileSize);
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            return this.tallGrassGrid[row][col];
        }
        return false;
    }

    draw(ctx, camera) {
        const startCol = Math.max(0, Math.floor(camera.x / this.tileSize));
        const endCol = Math.min(this.cols - 1, Math.ceil((camera.x + camera.viewportWidth) / this.tileSize));
        const startRow = Math.max(0, Math.floor(camera.y / this.tileSize));
        const endRow = Math.min(this.rows - 1, Math.ceil((camera.y + camera.viewportHeight) / this.tileSize));

        const sz = this.tileSize;
        const srcSz = this.sourceTileSize;

        // Si existen capas dinámicas (formato multicapa), dibujarlas en orden secuencial
        if (this.layers && this.layers.length > 0) {
            for (let i = 0; i < this.layers.length; i++) {
                const layer = this.layers[i];
                if (layer.visible === false) continue;

                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        const cell = layer.grid[r][c];
                        if (!cell) continue;

                        const px = c * sz;
                        const py = r * sz;
                        this.drawTileCell(ctx, cell, px, py, sz, srcSz, r, c);
                    }
                }
            }
            return;
        }

        // Modo Fallback: suelo y decoración
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const px = c * sz;
                const py = r * sz;

                const ground = this.groundGrid[r][c];
                const decor = this.decorGrid[r][c];

                if (ground) {
                    this.drawTileCell(ctx, ground, px, py, sz, srcSz, r, c);
                }

                if (decor) {
                    this.drawTileCell(ctx, decor, px, py, sz, srcSz, r, c);
                }
            }
        }
    }

    drawTileCell(ctx, cell, px, py, sz, srcSz, r, c) {
        let gr = cell.r;
        let gc = cell.c;
        const isWater = (cell.tileset === 'water' || cell.isWater);

        let cellSrcSz = cell.srcSize;
        if (!cellSrcSz) {
            if (this.tilesetTileSizes) {
                let tsKey = (cell.tileset || '').toLowerCase();
                let tsKeyClean = tsKey.endsWith('.png') ? tsKey.slice(0, -4) : tsKey;
                cellSrcSz = this.tilesetTileSizes[cell.tileset] || this.tilesetTileSizes[tsKey] || this.tilesetTileSizes[tsKeyClean];
            }
            if (!cellSrcSz) {
                cellSrcSz = srcSz || this.sourceTileSize || 16;
            }
        }

        if (isWater && this.waterTilesetLoaded && this.waterTilesetImage) {
            // Efecto suave de rizo / oleaje de agua
            if (gr === 3 && gc === 3) {
                const wave = (Math.floor(Date.now() / 450) + r + c) % 2;
                if (wave === 1) gr = 4;
            }
            ctx.drawImage(
                this.waterTilesetImage,
                gc * cellSrcSz, gr * cellSrcSz, cellSrcSz, cellSrcSz,
                px, py, sz, sz
            );
        } else {
            const img = this.getTilesetImage(cell.tileset);
            if (img && img.complete && img.naturalWidth !== 0) {
                ctx.drawImage(
                    img,
                    gc * cellSrcSz, gr * cellSrcSz, cellSrcSz, cellSrcSz,
                    px, py, sz, sz
                );
            } else {
                ctx.fillStyle = isWater ? '#1d6fca' : '#4fa22d';
                ctx.fillRect(px, py, sz, sz);
            }
        }
    }
}
