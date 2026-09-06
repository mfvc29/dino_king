/**
 * Arena - Escenario de combate Prehistórico "Dino King Colosseum"
 * Dibuja el ring, los límites, efectos visuales (chispas, ondas, polvo) y temblores de cámara.
 */

class Arena {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        // Límites del ring de combate
        this.bounds = {
            minX: 70,
            maxX: width - 70,
            minY: 100,
            maxY: height - 50
        };

        this.particles = [];
        this.shockwaves = [];
        this.damageNumbers = [];
        this.screenShake = 0;
        this.time = 0;
    }

    update() {
        this.time += 0.05;

        // Reducir temblor de cámara
        if (this.screenShake > 0) {
            this.screenShake *= 0.88;
            if (this.screenShake < 0.2) this.screenShake = 0;
        }

        // Actualizar partículas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Actualizar ondas expansivas
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.growth;
            sw.alpha -= sw.fade;
            if (sw.alpha <= 0) {
                this.shockwaves.splice(i, 1);
            }
        }

        // Actualizar números de daño
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.y -= 1.2;
            dn.life -= 0.03;
            if (dn.life <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }
    }

    constrain(player) {
        const radius = 20;
        if (player.x < this.bounds.minX + radius) player.x = this.bounds.minX + radius;
        if (player.x > this.bounds.maxX - radius) player.x = this.bounds.maxX - radius;
        if (player.y < this.bounds.minY + radius) player.y = this.bounds.minY + radius;
        if (player.y > this.bounds.maxY) player.y = this.bounds.maxY;
    }

    addHitSparks(x, y, count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: Math.random() > 0.5 ? '#ffff00' : '#ff3300',
                size: 2 + Math.random() * 3,
                life: 1.0,
                decay: 0.04 + Math.random() * 0.04
            });
        }
    }

    addShockwave(x, y, color = '#00ffff') {
        this.shockwaves.push({
            x, y,
            radius: 10,
            growth: 7,
            alpha: 1.0,
            fade: 0.04,
            color
        });
        this.screenShake = 12;
    }

    addDamageNumber(x, y, damage, isCrit = false) {
        this.damageNumbers.push({
            x: x + (Math.random() * 20 - 10),
            y: y - 30,
            damage,
            isCrit,
            life: 1.0
        });
    }

    draw(ctx) {
        // Fondo general
        ctx.fillStyle = '#141724';
        ctx.fillRect(0, 0, this.width, this.height);

        // Suelo del Coliseo / Ring
        const ringGrad = ctx.createRadialGradient(
            this.width / 2, this.height / 2 + 30, 80,
            this.width / 2, this.height / 2 + 30, this.width / 2
        );
        ringGrad.addColorStop(0, '#363d52');
        ringGrad.addColorStop(0.7, '#242a3b');
        ringGrad.addColorStop(1, '#181b26');
        
        ctx.fillStyle = ringGrad;
        ctx.fillRect(
            this.bounds.minX - 10,
            this.bounds.minY - 10,
            (this.bounds.maxX - this.bounds.minX) + 20,
            (this.bounds.maxY - this.bounds.minY) + 20
        );

        // Patrón de cuadrícula de piedras del suelo
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 2;
        const step = 64;
        for (let x = this.bounds.minX; x <= this.bounds.maxX; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, this.bounds.minY);
            ctx.lineTo(x, this.bounds.maxY);
            ctx.stroke();
        }
        for (let y = this.bounds.minY; y <= this.bounds.maxY; y += step) {
            ctx.beginPath();
            ctx.moveTo(this.bounds.minX, y);
            ctx.lineTo(this.bounds.maxX, y);
            ctx.stroke();
        }

        // Círculo central con emblema Dino King
        ctx.save();
        const centerX = this.width / 2;
        const centerY = (this.bounds.minY + this.bounds.maxY) / 2;

        ctx.strokeStyle = 'rgba(255, 180, 0, 0.25)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 90, 0, Math.PI * 2);
        ctx.stroke();

        // Icono de garra de dinosaurio en el centro del suelo
        ctx.fillStyle = 'rgba(255, 180, 0, 0.12)';
        ctx.beginPath();
        ctx.arc(centerX - 24, centerY - 15, 14, 0, Math.PI * 2);
        ctx.arc(centerX, centerY - 28, 16, 0, Math.PI * 2);
        ctx.arc(centerX + 24, centerY - 15, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX, centerY + 10, 32, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Borde / Muros del Coliseo
        ctx.strokeStyle = '#fca311';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fca311';
        ctx.shadowBlur = 8;
        ctx.strokeRect(
            this.bounds.minX,
            this.bounds.minY,
            this.bounds.maxX - this.bounds.minX,
            this.bounds.maxY - this.bounds.minY
        );
        ctx.shadowBlur = 0;

        // Antorchas en las cuatro esquinas
        const corners = [
            { x: this.bounds.minX + 20, y: this.bounds.minY + 20 },
            { x: this.bounds.maxX - 20, y: this.bounds.minY + 20 },
            { x: this.bounds.minX + 20, y: this.bounds.maxY - 20 },
            { x: this.bounds.maxX - 20, y: this.bounds.maxY - 20 }
        ];

        corners.forEach((c) => {
            // Pilar
            ctx.fillStyle = '#444';
            ctx.fillRect(c.x - 8, c.y - 8, 16, 16);

            // Fuego animado
            const flameRadius = 10 + Math.sin(this.time * 6 + c.x) * 3;
            const flameGrad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, flameRadius);
            flameGrad.addColorStop(0, '#ffff55');
            flameGrad.addColorStop(0.5, '#ff6600');
            flameGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
            ctx.fillStyle = flameGrad;
            ctx.beginPath();
            ctx.arc(c.x, c.y, flameRadius * 1.5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Dibujar ondas expansivas
        this.shockwaves.forEach((sw) => {
            ctx.save();
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = 4;
            ctx.globalAlpha = sw.alpha;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });

        // Dibujar partículas
        this.particles.forEach((p) => {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            ctx.restore();
        });

        // Dibujar números de daño flotantes
        this.damageNumbers.forEach((dn) => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, dn.life);
            ctx.font = dn.isCrit ? 'bold 22px monospace' : 'bold 16px monospace';
            ctx.fillStyle = dn.isCrit ? '#ff0033' : '#ffea00';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(`-${dn.damage}`, dn.x, dn.y);
            ctx.fillText(`-${dn.damage}`, dn.x, dn.y);
            ctx.restore();
        });
    }
}
