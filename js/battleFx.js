/**
 * BattleFx - Efectos del combate al estilo duelo de cartas (Yu-Gi-Oh).
 *
 * - Ataque físico: el dino sale de su lugar, cruza el campo con estela, golpea al rival y vuelve.
 * - Ataque especial: el dino carga y lanza un proyectil de su elemento (bola de fuego, burbuja,
 *   rayo, roca, hojas, ráfaga, prisma...) que explota sobre el rival.
 * - Impacto: destello, onda, chispas del elemento, zarpazo, retroceso del dino golpeado, número de
 *   daño y sacudida del campo en los golpes eficaces, críticos y K.O.
 *
 * Todo se dibuja en la capa #battleFx (encima del campo) con la Web Animations API, así el render
 * del combate no corta las animaciones. La velocidad (x1 / x2) la marca BattleSystem.speed.
 */

const FX_STYLES = {
    fuego:    { colors: ['#fff7d6', '#ffd166', '#fb8500', '#e63946'], particle: 'ember',  proj: 'fireball' },
    agua:     { colors: ['#f0fbff', '#9be7ff', '#38bdf8', '#0369a1'], particle: 'drop',   proj: 'bubble' },
    rayo:     { colors: ['#ffffff', '#fff59d', '#facc15', '#ca8a04'], particle: 'spark',  proj: 'bolt' },
    tierra:   { colors: ['#f1d7b5', '#c08552', '#8b5a2b', '#5c3a1a'], particle: 'rock',   proj: 'boulder' },
    planta:   { colors: ['#ecfccb', '#a3e635', '#22c55e', '#15803d'], particle: 'leaf',   proj: 'leaves' },
    viento:   { colors: ['#ffffff', '#e0f2fe', '#bae6fd', '#7dd3fc'], particle: 'streak', proj: 'gust' },
    especial: { colors: ['#ffffff', '#fbcfe8', '#f472b6', '#a855f7'], particle: 'star',   proj: 'prism' },
    normal:   { colors: ['#ffffff', '#e2e8f0', '#cbd5e1', '#94a3b8'], particle: 'dot',    proj: 'shock' }
};

class BattleFx {
    constructor(battle) {
        this.battle = battle;   // BattleSystem
        this.layer = document.getElementById('battleFx');
        this.field = document.getElementById('battleField');
    }

    get speed() {
        return this.battle.speed;
    }

    ms(t) {
        return t / this.speed;
    }

    wait(t) {
        return new Promise(resolve => setTimeout(resolve, this.ms(t)));
    }

    style(element) {
        return FX_STYLES[element] || FX_STYLES.normal;
    }

    clear() {
        if (this.layer) this.layer.innerHTML = '';
    }

    // ------------------------------------------------------------
    // Geometría (coordenadas relativas al campo)
    // ------------------------------------------------------------
    origin() {
        return this.field.getBoundingClientRect();
    }

    slot(f) {
        return this.battle.slotEl(f);
    }

    /** Caja del dino en pantalla (o de su lugar si no tiene arte). */
    dinoBox(f) {
        const slot = this.slot(f);
        const img = slot && slot.querySelector('.duel-dino');
        const target = img || (slot && slot.querySelector('.duel-card-anchor'));
        const o = this.origin();
        if (!target) return { x: o.width / 2, y: o.height / 2, w: 0, h: 0, cx: o.width / 2, cy: o.height / 2 };
        const r = target.getBoundingClientRect();
        return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, cx: r.left - o.left + r.width / 2, cy: r.top - o.top + r.height / 2 };
    }

    /** Hocico del dino: por donde sale el ataque especial. */
    frontOf(f) {
        const b = this.dinoBox(f);
        const dir = f.side === 'player' ? 1 : -1;
        return { x: b.cx + dir * b.w * 0.36, y: b.y + b.h * 0.32 };
    }

    centerOf(f) {
        const b = this.dinoBox(f);
        return { x: b.cx, y: b.y + b.h * 0.55 };
    }

    // ------------------------------------------------------------
    // Utilidades
    // ------------------------------------------------------------
    add(cls, x, y, html = '') {
        const el = document.createElement('div');
        el.className = cls;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        if (html) el.innerHTML = html;
        this.layer.appendChild(el);
        return el;
    }

    /** Anima un elemento de la capa de efectos y lo borra al terminar. */
    run(el, frames, { duration, delay = 0, easing = 'ease-out' }) {
        const a = el.animate(frames, { duration: this.ms(duration), delay: this.ms(delay), easing, fill: 'both' });
        a.finished.then(() => el.remove(), () => el.remove());
        return a;
    }

    /** Partícula del elemento: suelta (estela) o disparada en una dirección (explosión). */
    particle(x, y, st, { burst = false, delay = 0, life = 450, dist = 40, spread = 8, size = 1 } = {}) {
        const p = this.add(`fx-p ${st.particle}`, x, y);
        p.style.setProperty('--c', st.colors[1 + Math.floor(Math.random() * 3)]);
        p.style.setProperty('--s', (size * (0.7 + Math.random() * 0.6)).toFixed(2));
        const ang = Math.random() * Math.PI * 2;
        const dx = burst ? Math.cos(ang) * dist : (Math.random() - 0.5) * spread * 2;
        const dy = burst ? Math.sin(ang) * dist * 0.75 : (Math.random() - 0.5) * spread * 2;
        // Las rocas y gotas caen; las brasas suben
        const fall = (st.particle === 'rock' || st.particle === 'drop') ? 38 : (st.particle === 'ember' ? -26 : 0);
        const rot = (Math.random() - 0.5) * 540;
        this.run(p, [
            { transform: 'translate(-50%, -50%) scale(0.6) rotate(0deg)', opacity: 0 },
            { transform: `translate(calc(-50% + ${dx * 0.12}px), calc(-50% + ${dy * 0.12}px)) scale(1) rotate(${rot / 8}deg)`, opacity: 1, offset: 0.1 },
            { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(1) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.5 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + fall}px)) scale(0.3) rotate(${rot}deg)`, opacity: 0 }
        ], { duration: life, delay, easing: 'cubic-bezier(.2, .7, .4, 1)' });
    }

    flash(c, color, big = false) {
        const el = this.add('fx-flash', c.x, c.y);
        el.style.setProperty('--c', color);
        const s = big ? 1.6 : 1;
        this.run(el, [
            { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 1 },
            { transform: `translate(-50%, -50%) scale(${s})`, opacity: 0.9, offset: 0.35 },
            { transform: `translate(-50%, -50%) scale(${s * 1.3})`, opacity: 0 }
        ], { duration: 280 });
    }

    ring(c, color, big = false, delay = 0) {
        const el = this.add('fx-ring', c.x, c.y);
        el.style.setProperty('--c', color);
        this.run(el, [
            { transform: 'translate(-50%, -50%) scale(0.15)', opacity: 1 },
            { transform: `translate(-50%, -50%) scale(${big ? 2.6 : 1.9})`, opacity: 0 }
        ], { duration: 520, delay, easing: 'cubic-bezier(.1, .7, .3, 1)' });
    }

    /** Tres zarpazos cruzando al rival (ataques físicos). */
    claw(c, color, side) {
        const el = this.add(`fx-claw ${side}`, c.x, c.y, '<i></i><i></i><i></i>');
        el.style.setProperty('--c', color);
        this.run(el, [
            { opacity: 1, clipPath: 'inset(0 100% 0 0)' },
            { opacity: 1, clipPath: 'inset(0 0 0 0)', offset: 0.35 },
            { opacity: 0, clipPath: 'inset(0 0 0 0)' }
        ], { duration: 420, easing: 'ease-out' });
    }

    /** Sacude el campo. */
    shake(px = 6) {
        this.field.animate([
            { transform: 'translate(0, 0)' },
            { transform: `translate(${-px}px, ${px * 0.5}px)` },
            { transform: `translate(${px * 0.8}px, ${-px * 0.6}px)` },
            { transform: `translate(${-px * 0.5}px, ${px * 0.3}px)` },
            { transform: `translate(${px * 0.3}px, 0)` },
            { transform: 'translate(0, 0)' }
        ], { duration: this.ms(340), easing: 'ease-out' });
    }

    /** Destello de toda la pantalla (rayos, críticos, K.O.). */
    screenFlash(color = '#fff', strength = 0.55) {
        const el = this.add('fx-screen', 0, 0);
        el.style.setProperty('--c', color);
        this.run(el, [{ opacity: strength }, { opacity: 0 }], { duration: 260 });
    }

    /** Aviso corto sobre un dino: "¡TU TURNO!", "¡Se levanta!", "¡En guardia!"... */
    cue(f, text, color = '#38bdf8') {
        const box = this.dinoBox(f);
        const el = this.add('fx-callout cue', box.cx, box.y, `<span>${escapeHtml(text)}</span>`);
        el.style.setProperty('--c', color);
        this.run(el, [
            { opacity: 0, transform: 'translate(-50%, -40%) scale(0.5)' },
            { opacity: 1, transform: 'translate(-50%, -115%) scale(1.1)', offset: 0.15 },
            { opacity: 1, transform: 'translate(-50%, -110%) scale(1)', offset: 0.3 },
            { opacity: 1, transform: 'translate(-50%, -115%) scale(1)', offset: 0.8 },
            { opacity: 0, transform: 'translate(-50%, -135%) scale(0.95)' }
        ], { duration: 1100 });
    }

    // ------------------------------------------------------------
    // Fases del ataque
    // ------------------------------------------------------------
    /** El dino se prepara: nombre del ataque, aura del elemento y un pequeño impulso. */
    async windup(f, attack) {
        const st = this.style(attack.element);
        const el = this.battle.cards.catalog.elements[attack.element];
        const box = this.dinoBox(f);
        const dir = f.side === 'player' ? 1 : -1;
        const call = this.add(`fx-callout ${f.side}`, box.cx, box.y, `<span>${el ? el.icon : '•'} ${escapeHtml(attack.name)}</span>`);
        call.style.setProperty('--c', st.colors[2]);
        this.run(call, [
            { opacity: 0, transform: 'translate(-50%, -40%) scale(0.5)' },
            { opacity: 1, transform: 'translate(-50%, -115%) scale(1.08)', offset: 0.14 },
            { opacity: 1, transform: 'translate(-50%, -110%) scale(1)', offset: 0.3 },
            { opacity: 1, transform: 'translate(-50%, -118%) scale(1)', offset: 0.82 },
            { opacity: 0, transform: 'translate(-50%, -140%) scale(0.96)' }
        ], { duration: 1500 });

        // Aura que sube desde la carta
        const aura = this.add('fx-aura', box.cx, box.y + box.h);
        aura.style.setProperty('--c', st.colors[2]);
        aura.style.width = `${Math.max(40, box.w * 0.9)}px`;
        aura.style.height = `${Math.max(50, box.h * 1.15)}px`;
        this.run(aura, [
            { opacity: 0, transform: 'translate(-50%, -100%) scaleY(0.2)' },
            { opacity: 0.85, transform: 'translate(-50%, -100%) scaleY(1)', offset: 0.45 },
            { opacity: 0, transform: 'translate(-50%, -100%) scaleY(1.15)' }
        ], { duration: 520 });
        for (let i = 0; i < 6; i++) {
            this.particle(box.cx + (Math.random() - 0.5) * box.w * 0.7, box.y + box.h * (0.5 + Math.random() * 0.5), st,
                { delay: i * 40, life: 420, spread: 14, size: 0.8 });
        }

        const fx = this.slot(f) && this.slot(f).querySelector('.duel-dino-fx');
        if (fx) {
            fx.animate([
                { transform: 'none', filter: 'none' },
                { transform: `translateX(${-dir * 5}%) scale(1.05, 0.93)`, filter: `brightness(1.6) drop-shadow(0 0 8px ${st.colors[2]})`, offset: 0.65 },
                { transform: 'none', filter: 'none' }
            ], { duration: this.ms(400), easing: 'ease-in-out' });
        }
        await this.wait(340);
    }

    /**
     * Ataque físico: una copia del dino cruza el campo hasta el rival (el original se oculta).
     * Devuelve una función que lo trae de vuelta a su carta.
     */
    async dash(f, t) {
        const slot = this.slot(f);
        const img = slot && slot.querySelector('.duel-dino');
        if (!img) return async () => {};
        const o = this.origin();
        const r = img.getBoundingClientRect();
        const clone = img.cloneNode();
        clone.removeAttribute('class');
        clone.className = 'fx-clone';
        Object.assign(clone.style, { left: `${r.left - o.left}px`, top: `${r.top - o.top}px`, width: `${r.width}px`, height: `${r.height}px` });
        this.layer.appendChild(clone);
        slot.classList.add('away');

        const dir = f.side === 'player' ? 1 : -1;
        const from = { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height * 0.55 };
        const to = this.centerOf(t);
        const dx = (to.x - from.x) - dir * r.width * 0.28;
        const dy = (to.y - from.y) * 0.9;
        const s = f.side === 'player' ? 0.84 : 1.18;   // perspectiva: al alejarse se ve más chico
        const hit = `translate(${dx}px, ${dy}px) scale(${s})`;
        const go = clone.animate([
            { transform: 'translate(0, 0) scale(1)' },
            { transform: `translate(${-dir * r.width * 0.12}px, ${r.height * 0.05}px) scale(1.05, 0.92)`, offset: 0.32 },
            { transform: hit }
        ], { duration: this.ms(440), easing: 'cubic-bezier(.55, 0, .85, .45)', fill: 'forwards' });
        const trail = setInterval(() => this.ghost(clone), this.ms(38));
        await go.finished.catch(() => {});
        clearInterval(trail);

        return async () => {
            const back = clone.animate([
                { transform: hit },
                { transform: `translate(${dx - dir * r.width * 0.2}px, ${dy - r.height * 0.22}px) scale(${s})`, offset: 0.3 },
                { transform: 'translate(0, 0) scale(1)' }
            ], { duration: this.ms(440), easing: 'ease-in-out', fill: 'forwards' });
            await back.finished.catch(() => {});
            clone.remove();
            slot.classList.remove('away');
        };
    }

    /** Imagen fantasma que deja el dino al embestir. */
    ghost(clone) {
        if (!clone.isConnected) return;
        const g = clone.cloneNode();
        g.className = 'fx-ghost';
        g.style.transform = getComputedStyle(clone).transform;
        this.layer.insertBefore(g, clone);
        this.run(g, [{ opacity: 0.5 }, { opacity: 0 }], { duration: 260 });
    }

    /** Ataque especial: proyectil del elemento en arco hasta el rival. */
    async projectile(f, t, element) {
        const st = this.style(element);
        if (st.proj === 'bolt') return this.bolt(f, t, st);
        const a = this.frontOf(f);
        const b = this.centerOf(t);
        const lift = Math.min(90, Math.hypot(b.x - a.x, b.y - a.y) * 0.22);
        const steps = 8;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            pts.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - Math.sin(Math.PI * u) * lift });
        }
        const p = this.add(`fx-proj ${st.proj}`, 0, 0, '<i></i><i></i>');
        p.style.setProperty('--c0', st.colors[0]);
        p.style.setProperty('--c1', st.colors[1]);
        p.style.setProperty('--c2', st.colors[2]);
        p.style.setProperty('--c3', st.colors[3]);
        const dur = 470;
        const spin = st.proj === 'fireball' || st.proj === 'bubble' ? 0 : 110;
        const anim = p.animate(pts.map((q, i) => ({
            transform: `translate(${q.x}px, ${q.y}px) translate(-50%, -50%) scale(${(0.45 + 0.55 * Math.min(1, i / 2)).toFixed(2)}) rotate(${i * spin}deg)`
        })), { duration: this.ms(dur), easing: 'linear', fill: 'forwards' });
        // Estela del elemento
        pts.forEach((q, i) => {
            if (i === 0) return;
            const at = dur * (i / steps);
            this.particle(q.x, q.y, st, { delay: at - 30, life: 460, spread: 10, size: 1.3 });
            this.particle(q.x, q.y, st, { delay: at - 10, life: 400, spread: 7, size: 1 });
            this.particle(q.x, q.y, st, { delay: at, life: 340, spread: 5, size: 0.7 });
        });
        this.flash(a, st.colors[1]);
        await anim.finished.catch(() => {});
        p.remove();
    }

    /** Rayo: una descarga en zigzag que parpadea entre el dino y su objetivo. */
    async bolt(f, t, st) {
        const a = this.frontOf(f);
        const b = this.centerOf(t);
        const o = this.origin();
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'fx-bolt');
        svg.setAttribute('width', o.width);
        svg.setAttribute('height', o.height);
        svg.setAttribute('viewBox', `0 0 ${o.width} ${o.height}`);
        const zigzag = () => {
            const n = 9;
            let d = `M${a.x.toFixed(1)},${a.y.toFixed(1)}`;
            for (let i = 1; i < n; i++) {
                const u = i / n;
                d += ` L${(a.x + (b.x - a.x) * u + (Math.random() - 0.5) * 30).toFixed(1)},${(a.y + (b.y - a.y) * u + (Math.random() - 0.5) * 30).toFixed(1)}`;
            }
            return `${d} L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
        };
        const paths = [[10, st.colors[2], 0.55], [4, st.colors[1], 1], [1.6, '#ffffff', 1]].map(([w, c, op]) => {
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', c);
            path.setAttribute('stroke-width', w);
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('opacity', op);
            svg.appendChild(path);
            return path;
        });
        const redraw = () => { const d = zigzag(); paths.forEach(p => p.setAttribute('d', d)); };
        redraw();
        this.layer.appendChild(svg);
        this.flash(a, st.colors[1]);
        const flicker = setInterval(redraw, this.ms(70));
        const anim = svg.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.35, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0.5, offset: 0.7 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }],
            { duration: this.ms(420), fill: 'forwards' });
        this.screenFlash(st.colors[1], 0.35);
        await this.wait(260);
        clearInterval(flicker);
        anim.finished.then(() => svg.remove(), () => svg.remove());
    }

    /**
     * Impacto en el rival: destello, onda, chispas, zarpazo, retroceso, número de daño y sacudida.
     * o: { damage, weak, crit, resisted, guarded, element, physical, ko }
     */
    impact(f, t, o) {
        const st = this.style(o.element);
        const c = this.centerOf(t);
        const big = o.weak || o.crit || o.ko;
        this.flash(c, st.colors[0], big);
        this.ring(c, st.colors[2], big);
        if (big) this.ring(c, st.colors[1], true, 90);
        const n = big ? 18 : 11;
        for (let i = 0; i < n; i++) {
            this.particle(c.x, c.y, st, { burst: true, life: 520 + Math.random() * 280, dist: (big ? 74 : 50) * (0.55 + Math.random() * 0.7) });
        }
        if (o.physical) this.claw(c, st.colors[1], f.side);
        if (o.guarded) this.ring(c, '#7dd3fc', false, 40);

        // El dino golpeado retrocede en la dirección del golpe y se pone blanco
        const fx = this.slot(t) && this.slot(t).querySelector('.duel-dino-fx');
        const dir = f.side === 'player' ? 1 : -1;
        if (fx) {
            const k = big ? 1.5 : 1;
            fx.animate([
                { transform: 'none', filter: 'none' },
                { transform: `translate(${dir * 9 * k}%, -3%) rotate(${dir * 7 * k}deg)`, filter: 'brightness(4) saturate(0)', offset: 0.12 },
                { transform: `translate(${dir * 6 * k}%, 0) rotate(${dir * 3}deg)`, filter: 'brightness(1.3) sepia(1) hue-rotate(-50deg) saturate(5)', offset: 0.32 },
                { transform: `translate(${-dir * 2}%, 0)`, filter: 'none', offset: 0.62 },
                { transform: 'none', filter: 'none' }
            ], { duration: this.ms(560), easing: 'ease-out' });
        }
        this.damage(t, o);
        if (big) this.shake(o.crit || o.ko ? 9 : 6);
        if (o.crit) this.screenFlash('#ffffff', 0.4);
    }

    /** Número de daño que salta sobre el dino. */
    damage(t, { damage, weak, crit, resisted, guarded }) {
        const box = this.dinoBox(t);
        const tag = crit ? '¡CRÍTICO!' : (weak ? '¡DÉBIL!' : (resisted ? 'POCO EFICAZ' : (guarded ? '🛡️ DEFENSA' : '')));
        const cls = crit ? 'crit' : (weak ? 'weak' : (resisted ? 'resisted' : ''));
        const el = this.add(`fx-dmg ${cls}`, box.cx, box.y + box.h * 0.2, `${tag ? `<small>${tag}</small>` : ''}<b>-${damage}</b>`);
        this.run(el, [
            { opacity: 0, transform: 'translate(-50%, -20%) scale(0.3)' },
            { opacity: 1, transform: 'translate(-50%, -85%) scale(1.4)', offset: 0.14 },
            { opacity: 1, transform: 'translate(-50%, -95%) scale(1)', offset: 0.3 },
            { opacity: 1, transform: 'translate(-50%, -125%) scale(1)', offset: 0.78 },
            { opacity: 0, transform: 'translate(-50%, -160%) scale(0.9)' }
        ], { duration: 1250 });
    }

    /** K.O.: el dino se deshace en partículas que suben. */
    ko(t) {
        const box = this.dinoBox(t);
        const st = this.style(t.element);
        for (let i = 0; i < 20; i++) {
            const p = this.add('fx-p dust', box.x + Math.random() * box.w, box.y + box.h * (0.25 + Math.random() * 0.75));
            p.style.setProperty('--c', i % 3 ? '#e2e8f0' : st.colors[2]);
            p.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
            this.run(p, [
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
                { transform: `translate(-50%, calc(-50% - ${10 + Math.random() * 15}px)) scale(1)`, opacity: 1, offset: 0.25 },
                { transform: `translate(calc(-50% + ${(Math.random() - 0.5) * 30}px), calc(-50% - ${50 + Math.random() * 50}px)) scale(0.2)`, opacity: 0 }
            ], { duration: 900 + Math.random() * 400, delay: 250 + i * 25 });
        }
        this.ring(this.centerOf(t), '#f8fafc', true, 200);
    }

    /** Rugido (ataques de estado): ondas que salen del hocico. */
    roar(f) {
        const a = this.frontOf(f);
        for (let i = 0; i < 3; i++) this.ring(a, '#fde68a', false, i * 120);
    }

    /** Relevo: una esfera de luz viaja de un dino a otro. */
    async relay(from, to) {
        const a = this.centerOf(from);
        const b = this.centerOf(to);
        const st = { colors: ['#ffffff', '#e0f2fe', '#38bdf8', '#0284c7'], particle: 'star' };
        const orb = this.add('fx-proj relay', 0, 0, '<i></i><i></i>');
        const lift = 60;
        const frames = [];
        for (let i = 0; i <= 6; i++) {
            const u = i / 6;
            const x = a.x + (b.x - a.x) * u;
            const y = a.y + (b.y - a.y) * u - Math.sin(Math.PI * u) * lift;
            frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` });
            if (i) this.particle(x, y, st, { delay: 420 * u, life: 360, spread: 8, size: 0.7 });
        }
        const anim = orb.animate(frames, { duration: this.ms(420), easing: 'ease-in-out', fill: 'forwards' });
        await anim.finished.catch(() => {});
        orb.remove();
        this.ring(b, '#38bdf8', true);
        this.flash(b, '#e0f2fe');
    }

    /** Victoria: los dinos que siguen en pie saltan de alegría. */
    cheer(side) {
        for (const f of this.battle.alive(side)) {
            const fx = this.slot(f) && this.slot(f).querySelector('.duel-dino-fx');
            if (!fx) continue;
            fx.animate([
                { transform: 'none' },
                { transform: 'translateY(-16%) scale(1.04, 0.98)', offset: 0.2 },
                { transform: 'none', offset: 0.42 },
                { transform: 'translateY(-10%)', offset: 0.62 },
                { transform: 'none' }
            ], { duration: this.ms(1100), delay: this.ms(f.idx * 120), easing: 'ease-out' });
            const c = this.centerOf(f);
            const st = this.style('especial');
            for (let i = 0; i < 8; i++) this.particle(c.x, c.y - 30, st, { burst: true, delay: 200 + f.idx * 120, life: 900, dist: 70, size: 1.1 });
        }
    }
}
