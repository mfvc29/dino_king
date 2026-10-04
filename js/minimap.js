/**
 * MiniMap - Mapa del mundo a pantalla completa para Dino King (se abre con la tecla M)
 * Muestra el terreno completo, el área visible de la cámara, los jugadores conectados
 * y los personajes de eventos (entrenadores / NPCs) del mapa actual.
 */

class MiniMap {
    constructor(tileMap, options = {}) {
        this.tileMap = tileMap;
        // Resolución interna del prerender (píxeles por losa)
        this.pxPerTile = options.pxPerTile || 4;

        this.offscreenCanvas = document.createElement('canvas');
        this.prerender();
    }

    updateScaleAndPrerender() {
        this.prerender();
    }

    prerender() {
        const cols = this.tileMap.cols;
        const rows = this.tileMap.rows;
        this.offscreenCanvas.width = Math.max(1, cols * this.pxPerTile);
        this.offscreenCanvas.height = Math.max(1, rows * this.pxPerTile);

        const octx = this.offscreenCanvas.getContext('2d');
        const tileW = this.pxPerTile;
        const tileH = this.pxPerTile;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const ground = this.tileMap.groundGrid[r] ? this.tileMap.groundGrid[r][c] : null;
                const decor = this.tileMap.decorGrid[r] ? this.tileMap.decorGrid[r][c] : null;
                const solid = this.tileMap.solidGrid[r] ? this.tileMap.solidGrid[r][c] : false;
                const isTall = this.tileMap.tallGrassGrid[r] ? this.tileMap.tallGrassGrid[r][c] : false;

                let color = '#55a630'; // Pasto base

                if (isTall) {
                    color = '#1b4d0c'; // Pasto silvestre / Selva
                } else if (ground && ground.isWater) {
                    color = '#1d6fca'; // Agua de lagos y bebederos
                } else if (ground && ground.r >= 0 && ground.r <= 2 && ground.c >= 13 && ground.c <= 15) {
                    color = '#ddb892'; // Caminos de arena y plaza
                } else if (ground && ground.r === 4 && ground.c === 14) {
                    color = '#b08968'; // Cañón prehistórico y cantera
                } else if (solid) {
                    color = '#2f5d1e'; // Obstáculos (árboles, muros)
                }

                if (decor) {
                    if (decor.isWater) {
                        color = '#1d6fca';
                    } else if (decor.solid && (decor.r === 12 || decor.r === 13)) {
                        color = '#8d99ae'; // Rocas y muros del cañón
                    } else if (decor.solid) {
                        color = '#7f4f24'; // Vallas de madera
                    } else if (decor.r === 0 && (decor.c === 1 || decor.c === 3 || decor.c === 5)) {
                        color = '#ffb703'; // Praderas florales
                    }
                }

                octx.fillStyle = color;
                octx.fillRect(c * tileW, r * tileH, tileW, tileH);
            }
        }
    }

    /**
     * Dibuja el mapa completo centrado sobre la pantalla.
     * npcs: lista de NPCs del mapa actual ({ x, y, isTrainer, defeated }) en píxeles del mundo.
     */
    draw(ctx, camera, localPlayer, remotePlayers = {}, npcs = [], mapTitle = '') {
        const vw = camera.viewportWidth;
        const vh = camera.viewportHeight;
        const mapW = Math.max(1, this.tileMap.width);
        const mapH = Math.max(1, this.tileMap.height);

        // Área disponible (margen superior para el título e inferior para la leyenda)
        const margin = 30;
        const topPad = 56;
        const bottomPad = 44;
        const availW = vw - margin * 2;
        const availH = vh - topPad - bottomPad;
        const fit = Math.min(availW / mapW, availH / mapH);
        const drawW = mapW * fit;
        const drawH = mapH * fit;
        const posX = (vw - drawW) / 2;
        const posY = topPad + (availH - drawH) / 2;

        ctx.save();

        // 1. Fondo oscurecido
        ctx.fillStyle = 'rgba(8, 10, 18, 0.88)';
        ctx.fillRect(0, 0, vw, vh);

        // 2. Título
        ctx.fillStyle = '#ffbe0b';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`🗺️ MAPA — ${mapTitle}`, vw / 2, 34);

        // 3. Marco y terreno
        ctx.fillStyle = 'rgba(15, 17, 26, 0.95)';
        ctx.strokeStyle = '#fca311';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 12;
        ctx.fillRect(posX - 5, posY - 5, drawW + 10, drawH + 10);
        ctx.strokeRect(posX - 5, posY - 5, drawW + 10, drawH + 10);
        ctx.shadowBlur = 0;

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.offscreenCanvas, posX, posY, drawW, drawH);

        // 4. Área visible de la cámara
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
            posX + camera.x * fit,
            posY + camera.y * fit,
            (vw / camera.zoom) * fit,
            (vh / camera.zoom) * fit
        );

        const dot = (x, y, radius, color) => {
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(posX + x * fit, posY + y * fit, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        };

        // 5. Personajes de eventos
        for (const npc of npcs) {
            const color = npc.isTrainer ? (npc.defeated ? '#94a3b8' : '#ff9f1c') : '#c77dff';
            dot(npc.x, npc.y, 3.5, color);
        }

        // 6. Jugadores remotos
        for (const id in remotePlayers) {
            const rp = remotePlayers[id];
            dot(rp.x, rp.y, 4, '#ff3366');
        }

        // 7. Jugador local (parpadeo suave)
        if (localPlayer) {
            const pulse = 4.5 + Math.sin(Date.now() / 180) * 1.5;
            dot(localPlayer.x, localPlayer.y, pulse, '#00ffff');
        }

        // 8. Leyenda
        const totalCount = 1 + Object.keys(remotePlayers).length;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        const legendY = vh - 18;
        const legend = [
            ['#00ffff', 'Tú'],
            ['#ff3366', `Jugadores (${totalCount})`],
            ['#ff9f1c', 'Entrenador'],
            ['#94a3b8', 'Derrotado'],
            ['#c77dff', 'NPC'],
        ];
        const itemW = 120;
        let lx = vw / 2 - (legend.length * itemW) / 2 + 10;
        ctx.textAlign = 'left';
        for (const [color, label] of legend) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(lx, legendY - 4, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(label, lx + 9, legendY);
            lx += itemW;
        }

        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText('[M] / [ESC] cerrar', vw - 16, 34);

        ctx.restore();
    }
}
