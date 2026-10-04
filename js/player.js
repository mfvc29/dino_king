/**
 * Player - Personaje (entrenador) controlado por el jugador o recibido por red.
 * x, y = punto de los pies del personaje en píxeles del mundo.
 * El nivel y la EXP son del entrenador; la progresión de combate está en los dinos (cards.js).
 */

class Player {
    constructor(id, name, x, y, options = {}) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.spriteFile = options.spriteFile || null;

        // Nivel de entrenador (sube con EXP de combates y capturas)
        this.level = 1;
        this.exp = 0;
        this.expNext = 100;
        this.onExpGain = null; // callback para notificaciones del HUD

        this.walkSpeed = 3.2;
        this.runSpeed = 5.4;
        this.isRunning = false;
        this.inTallGrass = false;

        this.direction = options.initialDirection || 'down';
        this.state = 'idle';
        this.animTimer = 0;
        this.dustParticles = [];
        this.bubbleAlert = false;

        this.renderer = new LPCRenderer({
            src: options.spriteUrl || null,
            fallbackColor: options.fallbackColor || '#2b78e4',
            accentColor: options.accentColor || '#00e5ff',
            name: this.name,
            scale: 1.8 // Escala para cuadrícula de 32px
        });
    }

    gainExp(amount, reason = '') {
        this.exp += amount;
        let leveledUp = false;
        while (this.exp >= this.expNext) {
            this.exp -= this.expNext;
            this.level++;
            this.expNext = Math.floor(this.expNext * 1.4);
            leveledUp = true;
        }
        if (this.onExpGain) {
            this.onExpGain({ amount, reason, leveledUp, level: this.level });
        }
        return { leveledUp, level: this.level };
    }

    /** Actualización del jugador LOCAL controlado por teclado. Devuelve true si se movió. */
    update(input, tileMap) {
        const { dx, dy, run } = input;
        this.isRunning = !!run;
        const speed = this.isRunning ? this.runSpeed : this.walkSpeed;

        for (let i = this.dustParticles.length - 1; i >= 0; i--) {
            const p = this.dustParticles[i];
            p.y -= 0.5;
            p.life -= 0.08;
            if (p.life <= 0) this.dustParticles.splice(i, 1);
        }

        if (dx === 0 && dy === 0) {
            this.state = 'idle';
            this.animTimer = 0;
            return false;
        }

        const norm = Math.hypot(dx, dy) || 1;
        const nextX = this.x + (dx / norm) * speed;
        const nextY = this.y + (dy / norm) * speed;
        let moved = false;

        // Deslizamiento suave en ejes separados
        if (!tileMap.isSolid(nextX, this.y)) {
            this.x = nextX;
            moved = true;
        }
        if (!tileMap.isSolid(this.x, nextY)) {
            this.y = nextY;
            moved = true;
        }
        // Anti-atascos: si quedó dentro de un obstáculo, dejarle salir
        if (!moved && tileMap.isSolid(this.x, this.y)) {
            this.x = nextX;
            this.y = nextY;
            moved = true;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'right' : 'left';
        } else {
            this.direction = dy > 0 ? 'down' : 'up';
        }

        this.state = 'walk';
        this.animTimer += this.isRunning ? 1.4 : 1.0;
        this.inTallGrass = tileMap.isTallGrass(this.x, this.y);

        if (this.isRunning && Math.random() < 0.25) {
            this.dustParticles.push({
                x: this.x + (Math.random() * 6 - 3),
                y: this.y + 2,
                size: 3 + Math.random() * 2,
                life: 1.0
            });
        }
        return moved;
    }

    /** Actualización de jugadores REMOTOS que llegan por WebSocket. */
    updateRemote(data) {
        this.targetX = data.x;
        this.targetY = data.y;
        this.direction = data.direction || this.direction;
        this.state = data.state || this.state;
        this.isRunning = !!data.isRunning;

        this.x += (this.targetX - this.x) * 0.35;
        this.y += (this.targetY - this.y) * 0.35;

        if (this.state === 'walk') {
            this.animTimer += this.isRunning ? 1.4 : 1.0;
        } else {
            this.animTimer = 0;
        }
    }

    draw(ctx) {
        this.dustParticles.forEach(p => {
            ctx.save();
            ctx.fillStyle = `rgba(212, 163, 115, ${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        this.renderer.draw(ctx, {
            x: this.x,
            y: this.y,
            direction: this.direction,
            animState: this.state,
            animTimer: Math.floor(this.animTimer),
            isHurt: false,
            invulnerableTimer: 0
        });

        // Hierba alta tapando los pies
        if (this.inTallGrass) {
            ctx.save();
            ctx.fillStyle = '#2d6a14';
            for (let i = -10; i <= 10; i += 5) {
                ctx.beginPath();
                ctx.moveTo(this.x + i, this.y + 4);
                ctx.lineTo(this.x + i + 2, this.y - 3);
                ctx.lineTo(this.x + i + 4, this.y + 4);
                ctx.fill();
            }
            ctx.restore();
        }

        // Globo de alerta '!'
        if (this.bubbleAlert) {
            ctx.save();
            const bx = this.x;
            const by = this.y - 56;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(bx - 9, by - 10, 18, 20, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#e63946';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('!', bx, by + 5);
            ctx.restore();
        }

        // Nombre
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(this.name, this.x, this.y - 42);
        ctx.fillText(this.name, this.x, this.y - 42);
        ctx.restore();
    }
}
