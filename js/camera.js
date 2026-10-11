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
        const viewW = this.viewportWidth / this.zoom;
        const viewH = this.viewportHeight / this.zoom;
        // Mapas más chicos que la pantalla (interiores de casas): centrados
        this.x = this.worldWidth < viewW ? -(viewW - this.worldWidth) / 2 : Math.max(0, Math.min(this.x, this.worldWidth - viewW));
        this.y = this.worldHeight < viewH ? -(viewH - this.worldHeight) / 2 : Math.max(0, Math.min(this.y, this.worldHeight - viewH));
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
