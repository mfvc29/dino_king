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
        this.groundGrid = [];
        this.decorGrid = [];
        this.solidGrid = [];
        this.tallGrassGrid = [];

        this.generateRealMap();
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
        // Gran Plaza adoquinada central
        for (let r = 40; r <= 48; r++) {
            for (let c = 54; c <= 66; c++) {
                this.groundGrid[r][c] = TILES.PATH_CENTER;
            }
        }
        // Fuente / Monumento central de piedra en la plaza
        for (let r = 43; r <= 45; r++) {
            for (let c = 59; c <= 61; c++) {
                if (r === 44 && c === 60) {
                    this.groundGrid[r][c] = TILES.WATER_DEEP_ANIM;
                    this.decorGrid[r][c] = TILES.WATER_LOTUS_PINK; // Loto rosa flotante en la fuente
                } else {
                    this.decorGrid[r][c] = TILES.ROCK_SMALL;
                    this.solidGrid[r][c] = true;
                }
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

    getZoneAt(x, y) {
        const col = Math.floor(x / this.tileSize);
        const row = Math.floor(y / this.tileSize);

        if (col >= 44 && col <= 76 && row >= 36 && row <= 54) {
            return {
                id: 'town',
                name: '🏡 Pueblo Raíz - Plaza Central',
                banner: '🏡 PUEBLO RAÍZ'
            };
        }
        if (col <= 44 && row <= 36) {
            return {
                id: 'lake',
                name: '🌊 Lago Espejo - Bahía Jurásica',
                banner: '🌊 LAGO ESPEJO'
            };
        }
        if (col >= 76 && row <= 36) {
            return {
                id: 'jungle',
                name: '🌿 Selva Jurásica - Bosque Sombrío',
                banner: '🌿 SELVA JURÁSICA'
            };
        }
        if (col <= 44 && row >= 54) {
            return {
                id: 'sanctuary',
                name: '🦕 Santuario Jurásico - Corrales Dino',
                banner: '🦕 SANTUARIO JURÁSICO'
            };
        }
        if (col >= 76 && row >= 54) {
            return {
                id: 'canyon',
                name: '🪨 Cañón Prehistórico - Cantera Rocosa',
                banner: '🪨 CAÑÓN PREHISTÓRICO'
            };
        }
        if (row < 36) {
            return {
                id: 'route_north',
                name: '🌺 Ruta 1 Norte - Pradera Floral',
                banner: '🌺 RUTA 1 NORTE'
            };
        }
        if (row > 54) {
            return {
                id: 'route_south',
                name: '🌾 Ruta 1 Sur - Sendero del Valle',
                banner: '🌾 RUTA 1 SUR'
            };
        }
        return {
            id: 'route_main',
            name: '📍 Ruta 1 - Cruce Central',
            banner: '📍 RUTA 1'
        };
    }

    isSolid(x, y, w = 20, h = 14) {
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

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const px = c * sz;
                const py = r * sz;

                const ground = this.groundGrid[r][c];
                const decor = this.decorGrid[r][c];

                // 1. Dibujar tile de suelo
                if (ground) {
                    if (ground.tileset === 'water' && this.waterTilesetLoaded && this.waterTilesetImage) {
                        let gr = ground.r;
                        let gc = ground.c;
                        // Efecto suave de rizo / oleaje de agua
                        if (gr === 3 && gc === 3) {
                            const wave = (Math.floor(Date.now() / 450) + r + c) % 2;
                            if (wave === 1) gr = 4;
                        }
                        ctx.drawImage(
                            this.waterTilesetImage,
                            gc * srcSz, gr * srcSz, srcSz, srcSz,
                            px, py, sz, sz
                        );
                    } else if (this.tilesetLoaded && this.tilesetImage) {
                        ctx.drawImage(
                            this.tilesetImage,
                            ground.c * srcSz, ground.r * srcSz, srcSz, srcSz,
                            px, py, sz, sz
                        );
                    } else {
                        // Render procedural si la imagen está cargando
                        ctx.fillStyle = ground && ground.isWater ? '#1d6fca' : '#4fa22d';
                        ctx.fillRect(px, py, sz, sz);
                    }
                }

                // 2. Dibujar decoración / obstáculo / nenúfares / lotos
                if (decor) {
                    if (decor.tileset === 'water' && this.waterTilesetLoaded && this.waterTilesetImage) {
                        ctx.drawImage(
                            this.waterTilesetImage,
                            decor.c * srcSz, decor.r * srcSz, srcSz, srcSz,
                            px, py, sz, sz
                        );
                    } else if (this.tilesetLoaded && this.tilesetImage) {
                        ctx.drawImage(
                            this.tilesetImage,
                            decor.c * srcSz, decor.r * srcSz, srcSz, srcSz,
                            px, py, sz, sz
                        );
                    }
                }
            }
        }
    }
}
