/**
 * Camera - Sistema de Cámara 2D con seguimiento suave (estilo Pokémon)
 */
class Camera {
    constructor(viewportWidth, viewportHeight, worldWidth, worldHeight) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.x = 0;
        this.y = 0;
        this.zoom = 1.0;
        this.target = null;
        this.smooth = 0.12;
    }

    follow(target) {
        this.target = target;
    }

    update() {
        if (!this.target) return;

        // Centrar objetivo en pantalla
        const desiredX = this.target.x - this.viewportWidth / (2 * this.zoom);
        const desiredY = this.target.y - this.viewportHeight / (2 * this.zoom);

        // Suavizado de movimiento (lerp)
        this.x += (desiredX - this.x) * this.smooth;
        this.y += (desiredY - this.y) * this.smooth;

        this.clamp();
    }

    clamp() {
        const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);
        const maxCamY = Math.max(0, this.worldHeight - this.viewportHeight / this.zoom);
        this.x = Math.max(0, Math.min(this.x, maxCamX));
        this.y = Math.max(0, Math.min(this.y, maxCamY));
    }

    apply(ctx) {
        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-Math.floor(this.x), -Math.floor(this.y));
    }

    restore(ctx) {
        ctx.restore();
    }
}
