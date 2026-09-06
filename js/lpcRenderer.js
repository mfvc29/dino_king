/**
 * LPCRenderer - Maneja la carga y animación de spritesheets compatibles con
 * Universal LPC (Liberated Pixel Cup) Spritesheet Character Generator.
 */

class LPCRenderer {
    constructor(options = {}) {
        this.frameWidth = options.frameWidth || 64;
        this.frameHeight = options.frameHeight || 64;
        this.scale = options.scale || 2.0;
        this.image = null;
        this.loaded = false;
        this.fallbackColor = options.fallbackColor || '#2b78e4';
        this.accentColor = options.accentColor || '#00e5ff';
        this.archetype = options.archetype || 'guerrero';
        this.name = options.name || 'Entrenador';

        // Definición de animaciones estándar LPC
        this.animations = {
            idle: { startRow: 8, frameCount: 1, speed: 0, customFrames: [0] },
            walk: { startRow: 8, frameCount: 9, speed: 7, loop: true },
            slash: { startRow: 12, frameCount: 6, speed: 5, loop: false },
            thrust: { startRow: 4, frameCount: 8, speed: 5, loop: false },
            spellcast: { startRow: 0, frameCount: 7, speed: 6, loop: false },
            hurt: { startRow: 20, frameCount: 6, speed: 7, loop: false, singleRow: true }
        };

        if (options.src) {
            this.loadFromUrl(options.src);
        }
    }

    loadFromUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.loaded = true;
                resolve(img);
            };
            img.onerror = () => {
                this.loaded = false;
                this.image = null;
                resolve(null);
            };
            img.src = url;
        });
    }

    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.loadFromUrl(e.target.result).then(resolve);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    getDirectionIndex(dir) {
        switch (dir) {
            case 'up': return 0;
            case 'left': return 1;
            case 'down': return 2;
            case 'right': return 3;
            default: return 2;
        }
    }

    draw(ctx, state) {
        const {
            x, y,
            direction = 'down',
            animState = 'idle',
            animTimer = 0,
            isHurt = false,
            invulnerableTimer = 0,
            customScale = null
        } = state;

        const scale = customScale || this.scale;
        const dirIndex = this.getDirectionIndex(direction);
        const anim = this.animations[animState] || this.animations.idle;

        let currentFrameIndex = 0;
        if (anim.customFrames) {
            currentFrameIndex = anim.customFrames[0];
        } else if (anim.frameCount > 1 && anim.speed > 0) {
            const cycle = Math.floor(animTimer / anim.speed);
            currentFrameIndex = anim.loop ? (cycle % anim.frameCount) : Math.min(cycle, anim.frameCount - 1);
        }

        const row = (anim.singleRow ? anim.startRow : anim.startRow + dirIndex);
        const sx = currentFrameIndex * this.frameWidth;
        const sy = row * this.frameHeight;

        const destWidth = this.frameWidth * scale;
        const destHeight = this.frameHeight * scale;
        const destX = x - destWidth / 2;
        const destY = y - destHeight + 14;

        // Sombra suave en los pies
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 16 * (scale / 2), 6 * (scale / 2), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (invulnerableTimer > 0 && Math.floor(invulnerableTimer / 4) % 2 === 0) {
            return;
        }

        ctx.save();
        if (this.loaded && this.image) {
            if (isHurt) {
                ctx.filter = 'brightness(2) drop-shadow(0 0 4px #ff3333)';
            }
            ctx.drawImage(
                this.image,
                sx, sy, this.frameWidth, this.frameHeight,
                destX, destY, destWidth, destHeight
            );
        } else {
            // Render procedural de respaldo según el arquetipo
            this.drawArchetypeFallback(ctx, {
                x, y,
                direction,
                animState,
                currentFrameIndex,
                scale
            });
        }
        ctx.restore();
    }

    drawArchetypeFallback(ctx, p) {
        const { x, y, direction, animState, currentFrameIndex, scale } = p;
        const bob = (animState === 'walk') ? Math.sin(currentFrameIndex * 0.8) * 2.5 : 0;
        const bodyY = y - 36 + bob;

        ctx.save();

        // 1. Capa de cuerpo según arquetipo
        ctx.fillStyle = this.fallbackColor;
        ctx.beginPath();
        ctx.roundRect(x - 12, bodyY, 24, 26, 4);
        ctx.fill();

        // 2. Detalle / Pechera / Túnica
        ctx.fillStyle = this.accentColor;
        ctx.fillRect(x - 6, bodyY + 6, 12, 14);

        // 3. Cabeza
        ctx.fillStyle = '#f6d5b0'; // Tono de piel
        ctx.beginPath();
        ctx.arc(x, bodyY - 8, 10, 0, Math.PI * 2);
        ctx.fill();

        // 4. Casco / Pelo según arquetipo
        if (this.archetype === 'guerrero') {
            ctx.fillStyle = '#3a4b68'; // Casco con cuernos
            ctx.beginPath();
            ctx.arc(x, bodyY - 11, 11, Math.PI, 0);
            ctx.fill();
            // Cuernos
            ctx.fillStyle = '#ffbe0b';
            ctx.fillRect(x - 12, bodyY - 18, 4, 8);
            ctx.fillRect(x + 8, bodyY - 18, 4, 8);
        } else if (this.archetype === 'exploradora') {
            ctx.fillStyle = '#2d6a4f'; // Pañuelo / Capucha verde
            ctx.beginPath();
            ctx.arc(x, bodyY - 10, 11, Math.PI * 0.8, Math.PI * 2.2);
            ctx.fill();
        } else if (this.archetype === 'cazador') {
            ctx.fillStyle = '#8b5a2b'; // Sombrero de cazador
            ctx.fillRect(x - 14, bodyY - 16, 28, 5);
            ctx.fillRect(x - 8, bodyY - 22, 16, 7);
        } else if (this.archetype === 'domadora') {
            ctx.fillStyle = '#7209b7'; // Tiara mágica
            ctx.beginPath();
            ctx.arc(x, bodyY - 10, 11, 0, Math.PI);
            ctx.fill();
            ctx.fillStyle = '#ffd166';
            ctx.fillRect(x - 4, bodyY - 18, 8, 4);
        }

        // 5. Ojos según dirección
        ctx.fillStyle = '#111827';
        let ex = 0;
        let ey = bodyY - 8;
        if (direction === 'left') ex = -4;
        if (direction === 'right') ex = 4;
        if (direction === 'up') ey = bodyY - 12; // De espaldas no se ven ojos
        if (direction !== 'up') {
            ctx.fillRect(x + ex - 2, ey, 2, 3);
            ctx.fillRect(x + ex + 1, ey, 2, 3);
        }

        ctx.restore();
    }
}
