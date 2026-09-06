/**
 * MiniMap - Radar en tiempo real con soporte multijugador para Dino King
 * Muestra el terreno completo, límites de la cámara y todos los jugadores conectados.
 */

class MiniMap {
    constructor(tileMap, options = {}) {
        this.tileMap = tileMap;
        this.width = options.width || 180;
        this.height = options.height || 135;
        this.scaleX = this.width / this.tileMap.width;
        this.scaleY = this.height / this.tileMap.height;

        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.width;
        this.offscreenCanvas.height = this.height;
        this.prerender();
    }

    prerender() {
        const octx = this.offscreenCanvas.getContext('2d');
        const tileW = this.width / this.tileMap.cols;
        const tileH = this.height / this.tileMap.rows;

        for (let r = 0; r < this.tileMap.rows; r++) {
            for (let c = 0; c < this.tileMap.cols; c++) {
                const ground = this.tileMap.groundGrid[r][c];
                const decor = this.tileMap.decorGrid[r][c];
                const solid = this.tileMap.solidGrid[r][c];
                const isTall = this.tileMap.tallGrassGrid[r][c];

                let color = '#55a630'; // Pasto base

                if (isTall) {
                    color = '#1b4d0c'; // Pasto silvestre / Selva
                } else if (ground && ground.isWater) {
                    color = '#1d6fca'; // Agua de lagos y bebederos
                } else if (ground && ground.r >= 0 && ground.r <= 2 && ground.c >= 13 && ground.c <= 15) {
                    color = '#ddb892'; // Caminos de arena y plaza
                } else if (ground && ground.r === 4 && ground.c === 14) {
                    color = '#b08968'; // Cañón prehistórico y cantera
                }

                if (decor) {
                    if (decor.solid && (decor.r === 12 || decor.r === 13)) {
                        color = '#8d99ae'; // Rocas y muros del cañón
                    } else if (decor.solid) {
                        color = '#7f4f24'; // Vallas de madera
                    } else if (decor.r === 0 && (decor.c === 1 || decor.c === 3 || decor.c === 5)) {
                        color = '#ffb703'; // Praderas florales
                    }
                }

                octx.fillStyle = color;
                octx.fillRect(c * tileW, r * tileH, Math.ceil(tileW), Math.ceil(tileH));
            }
        }
    }

    draw(ctx, camera, localPlayer, remotePlayers = {}) {
        ctx.save();

        const posX = camera.viewportWidth - this.width - 20;
        const posY = 20;

        // 1. Marco exterior
        ctx.fillStyle = 'rgba(15, 17, 26, 0.90)';
        ctx.strokeStyle = '#fca311';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 10;
        ctx.fillRect(posX - 4, posY - 4, this.width + 8, this.height + 26);
        ctx.strokeRect(posX - 4, posY - 4, this.width + 8, this.height + 26);
        ctx.shadowBlur = 0;

        // 2. Fondo del terreno
        ctx.drawImage(this.offscreenCanvas, posX, posY, this.width, this.height);

        // 3. Cuadro de visión de la cámara del jugador local
        const camBoxX = posX + camera.x * this.scaleX;
        const camBoxY = posY + camera.y * this.scaleY;
        const camBoxW = (camera.viewportWidth / camera.zoom) * this.scaleX;
        const camBoxH = (camera.viewportHeight / camera.zoom) * this.scaleY;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(camBoxX, camBoxY, camBoxW, camBoxH);

        // 4. Jugadores remotos conectados
        for (const id in remotePlayers) {
            const rp = remotePlayers[id];
            const rx = posX + rp.x * this.scaleX;
            const ry = posY + rp.y * this.scaleY;

            ctx.fillStyle = '#ff3366';
            ctx.shadowColor = '#ff3366';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 5. Jugador local (Tú)
        if (localPlayer) {
            const lx = posX + localPlayer.x * this.scaleX;
            const ly = posY + localPlayer.y * this.scaleY;

            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 7;
            ctx.beginPath();
            ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 6. Etiqueta del radar
        const totalCount = 1 + Object.keys(remotePlayers).length;
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffbe0b';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`RADAR DINO (${totalCount} JUGADORES)`, posX + 4, posY + this.height + 15);

        ctx.restore();
    }
}
