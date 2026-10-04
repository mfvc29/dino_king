/**
 * SaveManager - Partidas guardadas de Dino Rey.
 *
 * - 3 ranuras en localStorage (dinoRey_slot_N). Cada guardado también se copia al servidor
 *   (POST /api/save?slot=N -> carpeta saves/) para no perder el progreso si se borra el navegador.
 * - Autoguardado tras combates, capturas y avances de historia (se puede desactivar en Opciones).
 * - Exportar / importar una partida como archivo .json.
 * - Las partidas antiguas de Dino King (dinoKing_cards) se importan a la ranura 1.
 */

const SAVE_SLOTS = 3;
const SAVE_VERSION = 1;
const SAVE_PREFIX = 'dinoRey_slot_';
const SETTINGS_KEY = 'dinoRey_settings';

class SaveManager {
    constructor(game) {
        this.game = game;
        this.currentSlot = null;
        this.autoSaveTimer = null;
        this.settings = this.loadSettings();
        this.migrateLegacy();
    }

    // ------------------------------------------------------------
    // Ajustes
    // ------------------------------------------------------------
    loadSettings() {
        try {
            return { autoSave: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
        } catch (e) {
            return { autoSave: true };
        }
    }

    setSetting(key, value) {
        this.settings[key] = value;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* sin almacenamiento */ }
    }

    // ------------------------------------------------------------
    // Ranuras
    // ------------------------------------------------------------
    read(slot) {
        try {
            const raw = localStorage.getItem(SAVE_PREFIX + slot);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    write(slot, data) {
        try {
            localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data));
        } catch (e) {
            this.game.notifyStatus('⚠️ No se pudo guardar en el navegador.');
            return false;
        }
        fetch(`/api/save?slot=${slot}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(() => {});
        return true;
    }

    remove(slot) {
        try { localStorage.removeItem(SAVE_PREFIX + slot); } catch (e) { /* sin almacenamiento */ }
        fetch(`/api/save?slot=${slot}`, { method: 'DELETE' }).catch(() => {});
    }

    listSlots() {
        const out = [];
        for (let s = 1; s <= SAVE_SLOTS; s++) out.push({ slot: s, data: this.read(s) });
        return out;
    }

    /** La partida guardada más reciente (para "Continuar"). */
    latest() {
        return this.listSlots()
            .filter(s => s.data)
            .sort((a, b) => (b.data.savedAt || 0) - (a.data.savedAt || 0))[0] || null;
    }

    /** Recupera del servidor las ranuras que falten en este navegador. */
    async syncFromServer() {
        try {
            const res = await fetch('/api/saves');
            if (!res.ok) return false;
            const remote = await res.json();
            let changed = false;
            for (const [slot, data] of Object.entries(remote || {})) {
                const local = this.read(slot);
                if (data && (!local || (data.savedAt || 0) > (local.savedAt || 0))) {
                    localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data));
                    changed = true;
                }
            }
            return changed;
        } catch (e) {
            return false;
        }
    }

    // ------------------------------------------------------------
    // Guardar / cargar el estado del juego
    // ------------------------------------------------------------
    collect() {
        const g = this.game;
        const p = g.localPlayer;
        return {
            version: SAVE_VERSION,
            savedAt: Date.now(),
            playTime: Math.round(g.playTime),
            player: {
                name: p.name,
                protagonist: g.protagonist ? g.protagonist.id : null,
                sprite: p.spriteFile,
                level: p.level,
                exp: p.exp,
                expNext: p.expNext,
                map: g.tileMap.currentMapId || 'world_map',
                x: Math.round(p.x),
                y: Math.round(p.y),
                direction: p.direction
            },
            cards: g.cards.serialize(),
            defeatedTrainers: [...g.defeatedTrainers],
            story: g.story.serialize()
        };
    }

    save(slot = this.currentSlot, { silent = false } = {}) {
        if (!slot || this.game.state !== 'overworld') return false;
        clearTimeout(this.autoSaveTimer);
        const ok = this.write(slot, this.collect());
        if (ok && !silent) this.game.notifyStatus(`💾 Partida guardada en la ranura ${slot}.`);
        if (ok) this.game.flashSaveIcon();
        return ok;
    }

    /** Autoguardado (agrupa varios cambios seguidos en uno solo). */
    autoSave() {
        if (!this.settings.autoSave || !this.currentSlot || this.game.state !== 'overworld') return;
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => this.save(this.currentSlot, { silent: true }), 800);
    }

    // ------------------------------------------------------------
    // Archivos
    // ------------------------------------------------------------
    exportSlot(slot) {
        const data = this.read(slot);
        if (!data) return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        const name = (data.player && data.player.name ? data.player.name : 'partida').replace(/[^\w-]+/g, '_');
        a.href = URL.createObjectURL(blob);
        a.download = `dino_rey_${name}_ranura${slot}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    async importFile(file, slot) {
        const data = JSON.parse(await file.text());
        if (!data || !data.player || !data.cards) throw new Error('El archivo no es una partida de Dino Rey.');
        data.savedAt = Date.now();
        this.write(slot, data);
        return data;
    }

    // ------------------------------------------------------------
    // Partida antigua (antes de las ranuras)
    // ------------------------------------------------------------
    migrateLegacy() {
        try {
            const raw = localStorage.getItem('dinoKing_cards');
            if (!raw || this.read(1)) return;
            const cards = JSON.parse(raw);
            const defeated = JSON.parse(localStorage.getItem('dinoKing_defeatedTrainers') || '[]');
            const hasDinos = Array.isArray(cards.collection) && cards.collection.length > 0;
            localStorage.setItem(SAVE_PREFIX + 1, JSON.stringify({
                version: SAVE_VERSION,
                savedAt: Date.now(),
                playTime: 0,
                player: { name: 'Fer', protagonist: 'fer', sprite: 'Fer.png', level: 1, exp: 0, expNext: 100, map: 'world_map', x: 2896, y: 2096, direction: 'down' },
                cards,
                defeatedTrainers: defeated,
                story: {
                    flags: hasDinos ? { talkedMom: true, starter: true, 'defeated:rival_1': true } : {},
                    stones: [],
                    rival: { name: 'Ander', sprite: 'Ander.png', starter: 'triceratops' }
                }
            }));
            localStorage.removeItem('dinoKing_cards');
            localStorage.removeItem('dinoKing_defeatedTrainers');
        } catch (e) { /* sin almacenamiento */ }
    }

    // ------------------------------------------------------------
    // Resumen para la pantalla de título
    // ------------------------------------------------------------
    static formatTime(seconds = 0) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}:${String(m).padStart(2, '0')}`;
    }

    static formatDate(ts) {
        if (!ts) return '';
        return new Date(ts).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
}
