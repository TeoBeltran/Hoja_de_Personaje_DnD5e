// ==========================================================
// combate.js — Lógica del Rastreador de Combate.
// Reutiliza Estadisticas.js / Constantes.js (los mismos scripts
// que usa cada ficha) para que los cálculos de modificadores,
// salvaciones y proficiencia sean siempre consistentes.
// ==========================================================

import { ICONOS_PERSONAJE } from "./Scripts/Datos/Constantes.js";
import {
    calcularProficiencia,
    formatMod,
    statAMod,
    generarModificadores,
    generarSalvaciones
} from "./Scripts/Core/Estadisticas.js";

// Personajes "ya creados" que se pueden sumar a un combate.
// Para agregar uno nuevo: sumarlo acá con su id (nombre del .json en /personajes).
const PERSONAJES_DISPONIBLES = [
    { id: 'gangstur', nombre: 'Gangstur' },
    { id: 'leonidas', nombre: 'Leonidas' },
    { id: 'lothar', nombre: 'Lothar' },
    { id: 'lunareth', nombre: 'Lunareth' },
    { id: 'nika', nombre: 'Nika' },
    { id: 'orfe', nombre: 'Orfe' },
    { id: 'cedric', nombre: 'Cedric' },
    { id: 'kael', nombre: 'Kael' },
    { id: 'varis', nombre: 'Varis' }
];

const COMBATE_KEY = 'combate_participantes';
const TURNO_KEY = 'combate_turno';
const HISTORIAL_KEY = 'combate_historial';
const CONDICIONES_KEY = 'combate_condiciones';
const HISTORIAL_MAX = 30;

// Set curado de condiciones/marcadores rápidos. Para agregar una nueva: sumarla acá.
const CONDICIONES = [
    { key: 'stunned', icon: '😵', label: 'Aturdido' },
    { key: 'frightened', icon: '😨', label: 'Asustado' },
    { key: 'poisoned', icon: '🤢', label: 'Envenenado' },
    { key: 'grappled', icon: '⛓️', label: 'Agarrado' },
    { key: 'prone', icon: '⬇️', label: 'Derribado' },
    { key: 'blinded', icon: '🙈', label: 'Cegado' },
    { key: 'burning', icon: '🔥', label: 'Quemándose' },
    { key: 'concentration', icon: '🛡️', label: 'Concentración' }
];

let participantes = [];      // lo que se guarda en COMBATE_KEY (personajes + enemigos manuales)
let dataCache = {};          // personajeId -> json ya cargado
let hpModalTarget = null;    // participante mostrado en el modal de Vida
let caModalTargetUid = null;
let detalleModalUid = null;  // uid del participante mostrado en el modal de detalle
let turnoState = { ronda: 1, uidActual: null };
let historial = [];
let condiciones = {};        // uid -> array de keys de CONDICIONES activas

// ================== Persistencia del combate ==================

function cargarCombate() {
    try {
        const raw = localStorage.getItem(COMBATE_KEY);
        participantes = raw ? JSON.parse(raw) : [];
    } catch (e) {
        participantes = [];
    }
}

function guardarCombate() {
    localStorage.setItem(COMBATE_KEY, JSON.stringify(participantes));
}

// ================== Turno / Ronda ==================

function cargarTurno() {
    try {
        const raw = localStorage.getItem(TURNO_KEY);
        turnoState = raw ? JSON.parse(raw) : { ronda: 1, uidActual: null };
    } catch (e) {
        turnoState = { ronda: 1, uidActual: null };
    }
}

function guardarTurno() {
    localStorage.setItem(TURNO_KEY, JSON.stringify(turnoState));
}

function siguienteTurno(ordenados) {
    if (!ordenados.length) return;
    const idxActual = ordenados.findIndex(p => p.uid === turnoState.uidActual);
    let idxSiguiente;
    if (idxActual === -1) {
        idxSiguiente = 0; // no había nadie marcado (o ya no existe): arrancar del primero
    } else {
        idxSiguiente = idxActual + 1;
        if (idxSiguiente >= ordenados.length) {
            idxSiguiente = 0;
            turnoState.ronda += 1;
        }
    }
    turnoState.uidActual = ordenados[idxSiguiente].uid;
    guardarTurno();
    renderTurnoPanel(ordenados);
}

function renderTurnoPanel(ordenados) {
    document.getElementById('ronda-numero').textContent = `Ronda ${turnoState.ronda}`;
    const actual = ordenados.find(p => p.uid === turnoState.uidActual);
    document.getElementById('turno-de').textContent = actual ? `Turno de: ${actual.icono || ''} ${actual.nombre}` : '— (todavía no arrancó)';
}

// ================== Historial de daño / cura ==================

function cargarHistorial() {
    try {
        const raw = localStorage.getItem(HISTORIAL_KEY);
        historial = raw ? JSON.parse(raw) : [];
    } catch (e) {
        historial = [];
    }
}

function guardarHistorial() {
    localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
}

function agregarHistorial(nombre, delta) {
    if (!delta) return;
    historial.unshift({ nombre, delta, ts: Date.now() });
    historial = historial.slice(0, HISTORIAL_MAX);
    guardarHistorial();
    renderHistorial();
}

function renderHistorial() {
    const cont = document.getElementById('historial-lista');
    if (!historial.length) {
        cont.innerHTML = `<div class="historial-vacio">Todavía no pasó nada.</div>`;
        return;
    }
    cont.innerHTML = historial.map(h => {
        const clase = h.delta < 0 ? 'dano' : 'cura';
        const signo = h.delta > 0 ? '+' : '';
        const hora = new Date(h.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        return `<div class="historial-item ${clase}">${h.nombre} ${signo}${h.delta} HP <span style="color:var(--text-muted); font-size:0.75rem;">(${hora})</span></div>`;
    }).join('');
}

// ================== Condiciones / marcadores rápidos ==================

function cargarCondiciones() {
    try {
        const raw = localStorage.getItem(CONDICIONES_KEY);
        condiciones = raw ? JSON.parse(raw) : {};
    } catch (e) {
        condiciones = {};
    }
}

function guardarCondiciones() {
    localStorage.setItem(CONDICIONES_KEY, JSON.stringify(condiciones));
}

function toggleCondicion(uid, key) {
    const activas = condiciones[uid] || [];
    condiciones[uid] = activas.includes(key) ? activas.filter(k => k !== key) : [...activas, key];
    guardarCondiciones();
}

// ================== Stats de un personaje JSON ==================

// Aplica raza + ASI a las stats base (mismo criterio que aplicarImprovements en script.js)
function statsFinales(personaje) {
    const stats = { ...personaje.stats };
    const imp = personaje.improvements;
    if (imp) {
        (imp.race || []).forEach(r => {
            if (stats[r.atributo] != null) stats[r.atributo] += Number(r.valor) || 0;
        });
        (imp.asi || []).forEach(a => {
            Object.entries(a.atributos || {}).forEach(([k, v]) => {
                if (stats[k] != null) stats[k] += Number(v) || 0;
            });
        });
    }
    return stats;
}

// Cálculo de CA simplificado (armadura equipada por defecto + Unarmored Defense de
// Monje + bonos CA planos de otros ítems del equipo). No cubre escudos ni Mage Armor.
function calcularCASimplificada(data, stats) {
    const modDex = statAMod(stats['DEX'] ?? 10);
    const modWis = statAMod(stats['WIS'] ?? 10);
    const equipo = data.equipo || [];
    const armadura = equipo.find(e => e.esArmadura);
    let ca;
    if (armadura) {
        if (armadura.tipoArmadura === 'ligera') ca = armadura.armaduraBase + modDex;
        else if (armadura.tipoArmadura === 'mediana') ca = armadura.armaduraBase + Math.min(modDex, 2);
        else if (armadura.tipoArmadura === 'pesada') ca = armadura.armaduraBase;
        else ca = armadura.armaduraBase + modDex;
    } else if ((data.rasgos || []).some(r => r.nombre === 'Unarmored Defense')) {
        ca = 10 + modDex + modWis;
    } else {
        ca = 10 + modDex;
    }
    equipo.forEach(it => {
        if (it !== armadura && it.efectos) {
            it.efectos.forEach(ef => { if (ef.tipo === 'CA') ca += (ef.valor || 0); });
        }
    });
    return ca;
}

function nivelDePersonaje(data) {
    const st = (data.estadisticas || []).find(s => s.nombre === 'Nivel');
    return st ? parseInt(st.valor) || 1 : 1;
}

// ================== Vida / CA / Ranuras / Habilidades compartidas con la ficha ==================
// Estas leen y escriben las MISMAS keys de localStorage que usa personaje.html,
// así que bajar vida, gastar una ranura o gastar un uso de habilidad acá se
// refleja también en la ficha normal (y viceversa).

function leerVidaCompartida(personajeId, data) {
    const prefix = `pj_${personajeId}_`;
    const maxG = localStorage.getItem(prefix + 'vidaMaxima');
    const actG = localStorage.getItem(prefix + 'vidaActual');
    let maxDefault = 10, actDefault = 10;
    const vidaStat = (data.estadisticas || []).find(s => s.nombre === 'Vida');
    if (vidaStat && String(vidaStat.valor).includes('/')) {
        const [a, m] = String(vidaStat.valor).split('/');
        actDefault = parseInt(a);
        maxDefault = parseInt(m);
    }
    // Auto-sanación: si algo dejó "NaN" guardado en localStorage (ej: un bug viejo),
    // no lo arrastramos — volvemos al valor por defecto del JSON en vez de mostrar NaN.
    const maxParsed = maxG !== null ? parseInt(maxG) : NaN;
    const actParsed = actG !== null ? parseInt(actG) : NaN;
    const resultado = {
        vidaMaxima: !isNaN(maxParsed) ? maxParsed : maxDefault,
        vidaActual: !isNaN(actParsed) ? actParsed : actDefault
    };
    console.log(`[combate] leerVidaCompartida(${personajeId}):`, {
        keyMax: prefix + 'vidaMaxima', guardadoMax: maxG,
        keyAct: prefix + 'vidaActual', guardadoAct: actG,
        vidaStatJson: vidaStat && vidaStat.valor,
        resultado
    });
    return resultado;
}

function guardarVidaCompartida(personajeId, actual, maximo) {
    const prefix = `pj_${personajeId}_`;
    localStorage.setItem(prefix + 'vidaActual', String(actual));
    localStorage.setItem(prefix + 'vidaMaxima', String(maximo));
    console.log(`[combate] guardarVidaCompartida(${personajeId}) -> ${actual}/${maximo}`);
}

function leerCACompartida(personajeId, data, stats) {
    const guard = localStorage.getItem(`pj_${personajeId}_caActual`);
    const guardParsed = guard !== null ? parseInt(guard) : NaN;
    const valor = !isNaN(guardParsed) ? guardParsed : calcularCASimplificada(data, stats);
    console.log(`[combate] leerCACompartida(${personajeId}):`, {
        key: `pj_${personajeId}_caActual`, guardado: guard,
        usandoCalculoSimplificado: isNaN(guardParsed), valor
    });
    return valor;
}

function guardarCACompartida(personajeId, valor) {
    localStorage.setItem(`pj_${personajeId}_caActual`, String(valor));
}

function leerRanurasCompartidas(personajeId, data) {
    const raw = localStorage.getItem(`pj_${personajeId}_ranurasHechizos`);
    let estado = {};
    if (raw) {
        try { estado = JSON.parse(raw); } catch (e) { estado = {}; }
    }
    const def = (data.hechizos && data.hechizos.ranuras) || [];
    def.forEach(r => { if (!(r.nivel in estado)) estado[r.nivel] = r.cantidad; });
    return { estado, def };
}

function guardarRanurasCompartidas(personajeId, estado) {
    localStorage.setItem(`pj_${personajeId}_ranurasHechizos`, JSON.stringify(estado));
}

function leerHabilidadesUsoCompartidas(personajeId, data) {
    const raw = localStorage.getItem(`pj_${personajeId}_habilidadesUso`);
    let estado = {};
    if (raw) {
        try { estado = JSON.parse(raw); } catch (e) { estado = {}; }
    }
    // Solo las que tienen un pool de usos propio (ej: "5/5"). Las que solo
    // "consumeUsoDe" otra (ej: Cutting Words) no tienen contador propio.
    const def = (data.habilidadesUso || []).filter(h => h.usos && !h.oculto);
    def.forEach(h => { if (!(h.nombre in estado)) estado[h.nombre] = h.usos; });
    return { estado, def };
}

function guardarHabilidadesUsoCompartidas(personajeId, estado) {
    localStorage.setItem(`pj_${personajeId}_habilidadesUso`, JSON.stringify(estado));
}

// ================== Familiares / monturas invocadas ==================
// Busca en hechizos Y habilidadesUso cualquier entrada con un campo "familiar"
// (Find Familiar, Find Steed, Staff of the Python, etc.)

function buscarDefinicionesFamiliar(data) {
    const defs = [];
    ((data.hechizos && data.hechizos.lista) || []).forEach(h => { if (h.familiar) defs.push(h.familiar); });
    (data.habilidadesUso || []).forEach(h => { if (h.familiar) defs.push(h.familiar); });
    return defs;
}

function leerFamiliarActivo(personajeId, data) {
    const raw = localStorage.getItem(`pj_${personajeId}_familiar`);
    if (!raw) return null;
    let guardado;
    try { guardado = JSON.parse(raw); } catch (e) { return null; }
    const defs = buscarDefinicionesFamiliar(data);
    const def = defs.find(d => d.id === guardado.id);
    if (!def) return null;
    return { def, vidaActual: guardado.vidaActual };
}

function guardarFamiliarVida(personajeId, id, vidaActual) {
    localStorage.setItem(`pj_${personajeId}_familiar`, JSON.stringify({ id, vidaActual }));
}

// ================== Enemigos existentes (creados antes en Enemigos) ==================
// Un enemigo agregado al combate NO se "copia": el participante solo guarda su id
// (`enemigoId`) y todo lo demás (vida, CA, mods, habilidades/acciones) se lee y
// escribe en vivo contra la MISMA key `enemigo_<id>` que usa enemigo.html, igual
// criterio que ya se usa para los personajes 'json'. Así, cambiar la vida desde acá
// también se ve reflejado si el DM abre la ficha del enemigo, y viceversa.

function leerEnemigo(id) {
    try {
        const raw = localStorage.getItem(`enemigo_${id}`);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function guardarEnemigo(record) {
    localStorage.setItem(`enemigo_${record.id}`, JSON.stringify(record));
}

function listarEnemigosDisponibles() {
    const lista = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('enemigo_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.id && data.nombre) lista.push(data);
            } catch (e) { /* key corrupta, se ignora */ }
        }
    }
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return lista;
}

// ================== Vida / CA: acceso genérico (json, enemigo, manual o familiar) ==================
// Se leen SIEMPRE en vivo desde localStorage al momento de renderizar (no se guarda
// una "foto" fija al agregar al combate). Así, si equipás una armadura nueva en la
// ficha normal de un personaje (o cambiás la vida de un enemigo desde su propia
// ficha), el rastreador de combate lo va a reflejar solo.

function getVida(p) {
    if (p.origen === 'manual') return { actual: p.vidaActual, maximo: p.vidaMaxima };
    if (p.origen === 'enemigo') {
        const rec = leerEnemigo(p.enemigoId);
        if (!rec) return { actual: 0, maximo: 0 };
        return { actual: rec.vidaActual, maximo: rec.vidaMaxima };
    }
    if (p.origen === 'familiar') {
        const data = dataCache[p.personajeId];
        const activo = data && leerFamiliarActivo(p.personajeId, data);
        if (!activo) return { actual: 0, maximo: 0 };
        return { actual: activo.vidaActual, maximo: activo.def.vidaMaxima };
    }
    const data = dataCache[p.personajeId];
    if (!data) {
        console.log(`[combate] getVida(${p.personajeId}): todavía no hay data cacheada, devuelvo 0/0`);
        return { actual: 0, maximo: 0 };
    }
    const r = leerVidaCompartida(p.personajeId, data);
    return { actual: r.vidaActual, maximo: r.vidaMaxima };
}

function getCA(p) {
    if (p.origen === 'manual') return p.ca;
    if (p.origen === 'enemigo') {
        const rec = leerEnemigo(p.enemigoId);
        return rec ? rec.caActual : 0;
    }
    if (p.origen === 'familiar') {
        const data = dataCache[p.personajeId];
        const activo = data && leerFamiliarActivo(p.personajeId, data);
        return activo ? activo.def.ca : 0;
    }
    const data = dataCache[p.personajeId];
    if (!data) return 0;
    const stats = statsFinales(data.personaje);
    return leerCACompartida(p.personajeId, data, stats);
}

function setVida(p, actual, maximo) {
    const maxSeguro = isNaN(maximo) ? 1 : Math.max(0, maximo);
    const actSeguro = isNaN(actual) ? 0 : Math.max(0, Math.min(actual, maxSeguro));
    if (p.origen === 'manual') {
        p.vidaActual = actSeguro;
        p.vidaMaxima = maxSeguro;
        guardarCombate();
    } else if (p.origen === 'enemigo') {
        const rec = leerEnemigo(p.enemigoId);
        if (rec) {
            rec.vidaActual = actSeguro;
            rec.vidaMaxima = maxSeguro;
            guardarEnemigo(rec);
        }
    } else if (p.origen === 'familiar') {
        const data = dataCache[p.personajeId];
        const activo = data && leerFamiliarActivo(p.personajeId, data);
        if (activo) guardarFamiliarVida(p.personajeId, activo.def.id, actSeguro);
    } else {
        guardarVidaCompartida(p.personajeId, actSeguro, maxSeguro);
    }
}

function setCA(p, valor) {
    const seguro = isNaN(valor) ? 10 : valor;
    if (p.origen === 'manual') {
        p.ca = seguro;
        guardarCombate();
    } else if (p.origen === 'enemigo') {
        const rec = leerEnemigo(p.enemigoId);
        if (rec) {
            rec.caActual = seguro;
            guardarEnemigo(rec);
        }
    } else if (p.origen === 'json') {
        guardarCACompartida(p.personajeId, seguro);
    }
}

// ================== Carga de datos de personajes JSON en el combate ==================

async function asegurarDataCargada() {
    const ids = [...new Set(participantes.filter(p => p.origen === 'json').map(p => p.personajeId))];
    await Promise.all(ids.map(async id => {
        if (dataCache[id]) return;
        try {
            const resp = await fetch(`personajes/${id}.json`);
            dataCache[id] = await resp.json();
            console.log(`[combate] cargado personajes/${id}.json OK`);
        } catch (e) {
            console.error(`[combate] NO se pudo cargar personajes/${id}.json`, e);
        }
    }));
}

// ================== Agregar / quitar participantes ==================

async function agregarPersonajesJson(ids) {
    for (const id of ids) {
        const meta = PERSONAJES_DISPONIBLES.find(p => p.id === id);
        let data = dataCache[id];
        if (!data) {
            try {
                const resp = await fetch(`personajes/${id}.json`);
                data = await resp.json();
                dataCache[id] = data;
            } catch (e) {
                mostrarAviso(`No pude cargar personajes/${id}.json`);
                continue;
            }
        }
        const stats = statsFinales(data.personaje);
        const modDex = statAMod(stats['DEX'] ?? 10);

        const suma = await pedirIniciativa(data.personaje.nombre || meta.nombre, `DEX ${formatMod(modDex)}`);
        if (suma === null) continue; // omitió para este personaje
        const iniciativa = modDex + suma;

        participantes.push({
            uid: crypto.randomUUID(),
            origen: 'json',
            personajeId: id,
            nombre: data.personaje.nombre || meta.nombre,
            icono: ICONOS_PERSONAJE[id] || '🎲',
            // CA y Vida de un personaje 'json' NO se guardan acá — se leen en vivo
            // desde localStorage cada vez que se renderiza (ver getCA()/getVida()).
            iniciativa
        });
    }
    guardarCombate();
    await render();
}

async function agregarEnemigosExistentes(ids) {
    for (const id of ids) {
        const rec = leerEnemigo(id);
        if (!rec) continue;

        const suma = await pedirIniciativa(rec.nombre, `Iniciativa ${formatMod(rec.iniciativa || 0)}`);
        if (suma === null) continue; // omitió para este enemigo
        const iniciativa = (parseInt(rec.iniciativa) || 0) + suma;

        participantes.push({
            uid: crypto.randomUUID(),
            origen: 'enemigo',
            enemigoId: id,
            nombre: rec.nombre,
            icono: rec.icono || '👹',
            iniciativa
        });
    }
    guardarCombate();
    render();
}

function quitarParticipante(uid) {
    participantes = participantes.filter(p => p.uid !== uid);
    guardarCombate();
    render();
}

function borrarCombate() {
    abrirConfirmar(
        '¿Borrar todo el combate actual? (esto NO borra la vida, ranuras ni usos de las fichas, solo la lista, el turno, el historial y las condiciones de este combate)',
        () => {
            participantes = [];
            localStorage.removeItem(COMBATE_KEY);
            turnoState = { ronda: 1, uidActual: null };
            localStorage.removeItem(TURNO_KEY);
            historial = [];
            localStorage.removeItem(HISTORIAL_KEY);
            condiciones = {};
            localStorage.removeItem(CONDICIONES_KEY);
            render();
        }
    );
}

// ================== Modales genéricos (reemplazan confirm()/alert()/prompt() nativos) ==================
// Mismo criterio que enemigo.js/enemigo.html: sin X, no se cierran clickeando afuera, solo con
// sus botones explícitos (ver también la exclusión en el listener de cierre-por-afuera más abajo).

// ----- Confirmación (Sí/No) -----
const confirmarModal = document.getElementById('confirmar-modal');
const confirmarMensaje = document.getElementById('confirmar-mensaje');
const confirmarSiBtn = document.getElementById('confirmar-si');
const confirmarNoBtn = document.getElementById('confirmar-no');
let confirmarCallback = null;

function abrirConfirmar(mensaje, onSi) {
    confirmarMensaje.textContent = mensaje;
    confirmarCallback = onSi;
    confirmarModal.style.display = 'flex';
}

confirmarSiBtn.addEventListener('click', () => {
    const cb = confirmarCallback;
    confirmarModal.style.display = 'none';
    confirmarCallback = null;
    if (cb) cb();
});

confirmarNoBtn.addEventListener('click', () => {
    confirmarModal.style.display = 'none';
    confirmarCallback = null;
});

// ----- Aviso (informativo, un solo botón) -----
const avisoModal = document.getElementById('aviso-modal');
const avisoMensaje = document.getElementById('aviso-mensaje');

function mostrarAviso(mensaje) {
    avisoMensaje.textContent = mensaje;
    avisoModal.style.display = 'flex';
}

document.getElementById('aviso-cerrar').addEventListener('click', () => {
    avisoModal.style.display = 'none';
});

// ----- Iniciativa (reemplaza prompt(), resuelve una Promise con el número sumado o null si se omite) -----
const iniciativaModal = document.getElementById('iniciativa-modal');
const iniciativaTitulo = document.getElementById('iniciativa-modal-title');
const iniciativaInfo = document.getElementById('iniciativa-modal-info');
const iniciativaInput = document.getElementById('iniciativa-input');
const iniciativaOmitirBtn = document.getElementById('iniciativa-omitir');
const iniciativaAgregarBtn = document.getElementById('iniciativa-agregar');
let iniciativaResolve = null;

function pedirIniciativa(nombre, modificadorTexto) {
    return new Promise(resolve => {
        iniciativaTitulo.textContent = `Iniciativa de ${nombre}`;
        iniciativaInfo.textContent = `Modificador: ${modificadorTexto}`;
        iniciativaInput.value = '0';
        iniciativaResolve = resolve;
        iniciativaModal.style.display = 'flex';
        iniciativaInput.focus();
        iniciativaInput.select();
    });
}

function resolverIniciativa(valor) {
    iniciativaModal.style.display = 'none';
    const resolve = iniciativaResolve;
    iniciativaResolve = null;
    if (resolve) resolve(valor);
}

iniciativaAgregarBtn.addEventListener('click', () => resolverIniciativa(parseInt(iniciativaInput.value) || 0));
iniciativaOmitirBtn.addEventListener('click', () => resolverIniciativa(null));
iniciativaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        resolverIniciativa(parseInt(iniciativaInput.value) || 0);
    }
});

// ================== Render ==================

function crearStatBtn(label, valor, interactivo = true) {
    const btn = document.createElement('button');
    btn.className = 'stat-clickable' + (interactivo ? '' : ' stat-no-click');
    btn.innerHTML = `<span class="stat-label">${label}</span>${valor}`;
    return btn;
}

function construirListaParaRender() {
    // Arma la lista final a mostrar: cada personaje 'json', seguido (si corresponde)
    // de su familiar/montura activa (misma iniciativa, para que queden juntos).
    const lista = [];
    participantes.forEach(p => {
        lista.push(p);
        if (p.origen === 'json') {
            const data = dataCache[p.personajeId];
            if (data) {
                const activo = leerFamiliarActivo(p.personajeId, data);
                if (activo) {
                    lista.push({
                        uid: p.uid + '__familiar',
                        origen: 'familiar',
                        personajeId: p.personajeId,
                        nombre: `${activo.def.nombre} (de ${p.nombre})`,
                        icono: activo.def.emoji || '🐾',
                        iniciativa: p.iniciativa,
                        familiarDef: activo.def
                    });
                }
            }
        }
    });
    return lista;
}

async function render() {
    await asegurarDataCargada();

    const cont = document.getElementById('lista-combate');
    cont.innerHTML = '';

    const listaCompleta = construirListaParaRender();

    if (listaCompleta.length === 0) {
        cont.innerHTML = `<div class="combate-vacio">No hay nadie en este combate todavía. Agregá un personaje o un enemigo para arrancar.</div>`;
        renderTurnoPanel([]);
        renderHistorial();
        return;
    }

    const ordenados = [...listaCompleta].sort((a, b) => b.iniciativa - a.iniciativa);

    ordenados.forEach((p, idx) => {
        const { actual, maximo } = getVida(p);

        const card = document.createElement('div');
        card.className = 'combatiente-card'
            + (p.origen === 'familiar' ? ' combatiente-familiar' : '')
            + (p.uid === turnoState.uidActual ? ' turno-activo' : '');

        const header = document.createElement('div');
        header.className = 'combatiente-header';
        header.innerHTML = `
            <span class="combatiente-orden">#${idx + 1}</span>
            <span class="combatiente-icono">${p.icono || '🎲'}</span>
            <span class="combatiente-nombre">${p.nombre}</span>
        `;
        if (p.origen === 'json' || p.origen === 'enemigo') {
            const linkFicha = document.createElement('a');
            linkFicha.className = 'btn-abrir-ficha';
            linkFicha.textContent = '🔗';
            linkFicha.title = 'Abrir ficha completa';
            linkFicha.target = '_blank';
            linkFicha.rel = 'noopener';
            linkFicha.href = p.origen === 'json'
                ? `personaje.html?p=${p.personajeId}`
                : `enemigo.html?id=${p.enemigoId}`;
            linkFicha.addEventListener('click', (e) => e.stopPropagation());
            header.appendChild(linkFicha);
        }
        if (p.origen !== 'familiar') {
            const btnQuitar = document.createElement('button');
            btnQuitar.className = 'btn-quitar';
            btnQuitar.textContent = '✕';
            btnQuitar.title = 'Quitar del combate';
            btnQuitar.addEventListener('click', (e) => {
                e.stopPropagation();
                quitarParticipante(p.uid);
            });
            header.appendChild(btnQuitar);
        }
        header.addEventListener('click', () => abrirModalDetalle(p));
        card.appendChild(header);

        const statsRow = document.createElement('div');
        statsRow.className = 'combatiente-stats';

        const btnVida = crearStatBtn('Vida', `${actual}/${maximo}`);
        btnVida.addEventListener('click', (e) => { e.stopPropagation(); abrirModalHp(p); });

        const btnCA = crearStatBtn('CA', getCA(p), p.origen !== 'familiar');
        if (p.origen !== 'familiar') {
            btnCA.addEventListener('click', (e) => { e.stopPropagation(); abrirModalCa(p); });
        }

        const btnIni = crearStatBtn('Iniciativa', formatMod(p.iniciativa), false);
        // La iniciativa no abre nada: no cambia durante el combate.

        statsRow.appendChild(btnVida);
        statsRow.appendChild(btnCA);
        statsRow.appendChild(btnIni);
        card.appendChild(statsRow);

        const condRow = document.createElement('div');
        condRow.className = 'condiciones-row';
        const activasDeEste = condiciones[p.uid] || [];
        CONDICIONES.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'condicion-btn' + (activasDeEste.includes(c.key) ? ' activa' : '');
            btn.textContent = c.icon;
            btn.title = c.label;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleCondicion(p.uid, c.key);
                render();
            });
            condRow.appendChild(btn);
        });
        card.appendChild(condRow);

        cont.appendChild(card);
    });

    renderTurnoPanel(ordenados);
    renderHistorial();
}

// ================== Modal de Vida ==================

function abrirModalHp(p) {
    hpModalTarget = p;
    actualizarHpModalDOM();
    document.getElementById('hp-modal').style.display = 'flex';
}

function actualizarHpModalDOM() {
    if (!hpModalTarget) return;
    const { actual, maximo } = getVida(hpModalTarget);
    document.getElementById('hp-modal-title').textContent = `Vida - ${hpModalTarget.nombre}`;
    document.getElementById('hp-display').textContent = `${actual} / ${maximo}`;
    const pct = maximo > 0 ? Math.max(0, Math.min(100, (actual / maximo) * 100)) : 0;
    const fill = document.getElementById('hp-bar-fill');
    fill.style.width = pct + '%';
    fill.style.backgroundColor = pct <= 25 ? '#c62828' : (pct <= 50 ? '#f9a825' : '#2e7d32');
}

function aplicarCambioHp(amount, maxAmount) {
    if (!hpModalTarget) return;
    const { actual, maximo } = getVida(hpModalTarget);
    if (maxAmount) {
        const nuevoMax = Math.max(1, maximo + maxAmount);
        const nuevoActual = Math.min(actual, nuevoMax);
        setVida(hpModalTarget, nuevoActual, nuevoMax);
    } else if (amount) {
        const nuevoActual = Math.max(0, Math.min(actual + amount, maximo));
        setVida(hpModalTarget, nuevoActual, maximo);
        agregarHistorial(hpModalTarget.nombre, nuevoActual - actual);
    }
    actualizarHpModalDOM();
    render();
}

// ================== Modal de CA ==================

function abrirModalCa(p) {
    caModalTargetUid = p.uid;
    actualizarCaModalDOM();
    document.getElementById('ca-modal').style.display = 'flex';
}

function participanteActualCa() {
    return participantes.find(x => x.uid === caModalTargetUid)
        || construirListaParaRender().find(x => x.uid === caModalTargetUid);
}

function actualizarCaModalDOM() {
    const p = participanteActualCa();
    if (!p) return;
    document.getElementById('ca-modal-title').textContent = `Clase de Armadura - ${p.nombre}`;
    document.getElementById('ca-display').textContent = getCA(p);
}

function aplicarCambioCa(amount) {
    const p = participanteActualCa();
    if (!p) return;
    setCA(p, getCA(p) + amount);
    actualizarCaModalDOM();
    render();
}

function restaurarCaOriginal() {
    const p = participanteActualCa();
    if (!p) return;
    if (p.origen === 'manual') return; // no hay "original" calculado para uno manual
    if (p.origen === 'enemigo') {
        const rec = leerEnemigo(p.enemigoId);
        if (rec) {
            rec.caActual = rec.caBase;
            guardarEnemigo(rec);
        }
        actualizarCaModalDOM();
        render();
        return;
    }
    localStorage.removeItem(`pj_${p.personajeId}_caActual`);
    actualizarCaModalDOM();
    render();
}

// ================== Modal de Detalle (mods, salvaciones, ranuras, habilidades) ==================
// No se cierra clickeando afuera: solo con la X o el botón "Salir".

function abrirModalDetalle(p) {
    detalleModalUid = p.uid;
    renderModalDetalle();
    document.getElementById('detalle-modal').style.display = 'flex';
}

function renderModalDetalle() {
    const listaCompleta = construirListaParaRender();
    const p = listaCompleta.find(x => x.uid === detalleModalUid);
    const body = document.getElementById('detalle-modal-body');
    const titulo = document.getElementById('detalle-modal-title');
    body.innerHTML = '';
    if (!p) { titulo.textContent = 'Detalle'; return; }
    titulo.textContent = p.nombre;

    if (p.origen === 'manual') {
        body.innerHTML = `<div class="sin-datos">Enemigo cargado a mano, no tiene ficha con más datos.</div>`;
        return;
    }

    if (p.origen === 'enemigo') {
        const rec = leerEnemigo(p.enemigoId);
        if (!rec) {
            body.innerHTML = `<div class="sin-datos">No se encontró la ficha de este enemigo (¿se borró desde Enemigos?).</div>`;
            return;
        }
        let html = `<div class="expand-titulo">Modificadores</div><div class="expand-grid">`;
        ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach(k => {
            const val = (rec.mods && rec.mods[k]) || 0;
            html += `<div class="expand-stat"><span class="es-nombre">${k}</span><span class="es-valor">${formatMod(val)}</span></div>`;
        });
        html += `</div>`;

        const secciones = [
            ['habilidades', 'Habilidades / Pasivas'],
            ['acciones', 'Acciones'],
            ['accionesBonus', 'Acciones Adicionales'],
            ['reacciones', 'Reacciones'],
            ['accionesLegendarias', 'Acciones Legendarias']
        ];
        secciones.forEach(([clave, titulo]) => {
            const lista = rec[clave] || [];
            if (!lista.length) return;
            html += `<div class="expand-titulo">${titulo}</div>`;
            lista.forEach(it => {
                html += `<div class="expand-ataque"><strong>${it.nombre}</strong>${it.desc ? ' — ' + it.desc : ''}</div>`;
            });
        });

        html += `<div class="sin-datos" style="margin-top:10px;">Para ver el detalle completo (daños, bonos, efectos) abrí la ficha del enemigo con el botón 🔗 de su card.</div>`;
        body.innerHTML = html;
        return;
    }

    if (p.origen === 'familiar') {
        const def = p.familiarDef;
        let html = `<div class="expand-titulo">${def.tipo || 'Invocado'}</div>`;
        if (def.mod) html += `<div class="sin-datos" style="margin-bottom:8px;">${def.mod}</div>`;
        if (def.notas) html += `<div class="sin-datos" style="margin-bottom:10px;">${def.notas}</div>`;
        if (def.ataques && def.ataques.length) {
            html += `<div class="expand-titulo">Ataques</div>`;
            def.ataques.forEach(a => {
                html += `<div class="expand-ataque"><strong>${a.nombre}</strong> — ${a.dano || ''}<br>${a.desc || ''}</div>`;
            });
        }
        body.innerHTML = html;
        return;
    }

    // p.origen === 'json'
    const data = dataCache[p.personajeId];
    if (!data) {
        body.innerHTML = `<div class="sin-datos">No se pudo cargar la ficha de este personaje.</div>`;
        return;
    }

    const stats = statsFinales(data.personaje);
    const nivel = nivelDePersonaje(data);
    const profBonus = parseInt(calcularProficiencia(nivel).replace('+', ''));
    const mods = generarModificadores(stats, data.personaje.clase);

    const salvacionesExtra = (data.rasgos || [])
        .filter(r => r.otorgaSalvacionProficiente)
        .map(r => r.otorgaSalvacionProficiente);
    const saves = generarSalvaciones(stats, data.personaje.clase, profBonus, salvacionesExtra);

    const tituloMod = document.createElement('div');
    tituloMod.className = 'expand-titulo';
    tituloMod.textContent = 'Modificadores';
    body.appendChild(tituloMod);
    const gridMod = document.createElement('div');
    gridMod.className = 'expand-grid';
    mods.forEach(m => {
        const d = document.createElement('div');
        d.className = 'expand-stat' + (m.proficiente ? ' proficiente' : '');
        d.innerHTML = `<span class="es-nombre">${m.nombre}</span><span class="es-valor">${m.valor}</span>`;
        gridMod.appendChild(d);
    });
    body.appendChild(gridMod);

    const tituloSalv = document.createElement('div');
    tituloSalv.className = 'expand-titulo';
    tituloSalv.textContent = 'Salvaciones';
    body.appendChild(tituloSalv);
    const gridSalv = document.createElement('div');
    gridSalv.className = 'expand-grid';
    saves.forEach(s => {
        const d = document.createElement('div');
        d.className = 'expand-stat' + (s.proficiente ? ' proficiente' : '');
        d.innerHTML = `<span class="es-nombre">${s.nombre}</span><span class="es-valor">${s.valor}</span>`;
        gridSalv.appendChild(d);
    });
    body.appendChild(gridSalv);

    const ranurasDef = (data.hechizos && data.hechizos.ranuras) || [];
    if (ranurasDef.length) {
        const tituloRan = document.createElement('div');
        tituloRan.className = 'expand-titulo';
        tituloRan.textContent = 'Ranuras de conjuro';
        body.appendChild(tituloRan);

        const { estado } = leerRanurasCompartidas(p.personajeId, data);
        ranurasDef.forEach(r => {
            const row = document.createElement('div');
            row.className = 'ranura-row';
            const actual = parseInt(estado[r.nivel]);
            row.innerHTML = `
                <span class="ranura-nivel">${r.nivel}</span>
                <button class="ranura-menos" data-delta="-1">-</button>
                <span class="ranura-cantidad">${actual}/${r.cantidad}</span>
                <button class="ranura-mas" data-delta="1">+</button>
            `;
            row.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const { estado: estadoActual } = leerRanurasCompartidas(p.personajeId, data);
                    const delta = parseInt(btn.dataset.delta);
                    const max = parseInt(r.cantidad);
                    let val = parseInt(estadoActual[r.nivel]) + delta;
                    val = Math.max(0, Math.min(val, max));
                    estadoActual[r.nivel] = String(val);
                    guardarRanurasCompartidas(p.personajeId, estadoActual);
                    renderModalDetalle();
                });
            });
            body.appendChild(row);
        });
    }

    // Habilidades con usos: TODAS las que tengan un pool propio (usos: "X/Y"),
    // para poder controlar que los jugadores las vayan gastando bien.
    const { estado: estadoHab, def: habilidadesConUsos } = leerHabilidadesUsoCompartidas(p.personajeId, data);
    if (habilidadesConUsos.length) {
        const tituloHab = document.createElement('div');
        tituloHab.className = 'expand-titulo';
        tituloHab.textContent = 'Habilidades con usos';
        body.appendChild(tituloHab);

        habilidadesConUsos.forEach(h => {
            const partes = String(estadoHab[h.nombre] || h.usos).split('/');
            const actualH = parseInt(partes[0]);
            const maxH = parseInt(partes[1]);
            const row = document.createElement('div');
            row.className = 'ranura-row';
            row.innerHTML = `
                <span class="ranura-nivel">${h.nombre}</span>
                <button class="ranura-menos" data-delta="-1">-</button>
                <span class="ranura-cantidad">${actualH}/${maxH}</span>
                <button class="ranura-mas" data-delta="1">+</button>
            `;
            row.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const { estado: estadoActual } = leerHabilidadesUsoCompartidas(p.personajeId, data);
                    const partesActuales = String(estadoActual[h.nombre] || h.usos).split('/');
                    const delta = parseInt(btn.dataset.delta);
                    const maxActual = parseInt(partesActuales[1]);
                    let val = parseInt(partesActuales[0]) + delta;
                    val = Math.max(0, Math.min(val, maxActual));
                    estadoActual[h.nombre] = `${val}/${maxActual}`;
                    guardarHabilidadesUsoCompartidas(p.personajeId, estadoActual);
                    renderModalDetalle();
                });
            });
            body.appendChild(row);
        });
    }
}

// ================== Modal: agregar personaje existente ==================

function abrirModalAgregarPersonaje() {
    const yaAgregados = new Set(participantes.filter(p => p.origen === 'json').map(p => p.personajeId));
    const cont = document.getElementById('lista-checks-personajes');
    cont.innerHTML = '';
    PERSONAJES_DISPONIBLES.forEach(pj => {
        const label = document.createElement('label');
        const disabled = yaAgregados.has(pj.id);
        label.innerHTML = `
            <input type="checkbox" value="${pj.id}" ${disabled ? 'disabled' : ''}>
            ${ICONOS_PERSONAJE[pj.id] || '🎲'} ${pj.nombre}${disabled ? ' (ya está en el combate)' : ''}
        `;
        cont.appendChild(label);
    });
    document.getElementById('modal-agregar-personaje').style.display = 'flex';
}

// ================== Modal: agregar enemigo existente ==================

function abrirModalAgregarEnemigo() {
    const yaAgregados = new Set(participantes.filter(p => p.origen === 'enemigo').map(p => p.enemigoId));
    const cont = document.getElementById('lista-checks-enemigos');
    cont.innerHTML = '';
    const disponibles = listarEnemigosDisponibles();
    if (!disponibles.length) {
        cont.innerHTML = `<div class="sin-datos">Todavía no creaste ningún enemigo. Andá a Extras → 🐉 Enemigos y cargá uno primero.</div>`;
    } else {
        disponibles.forEach(en => {
            const label = document.createElement('label');
            const disabled = yaAgregados.has(en.id);
            label.innerHTML = `
                <input type="checkbox" value="${en.id}" ${disabled ? 'disabled' : ''}>
                ${en.icono || '👹'} ${en.nombre}${disabled ? ' (ya está en el combate)' : ''}
            `;
            cont.appendChild(label);
        });
    }
    document.getElementById('modal-agregar-enemigo').style.display = 'flex';
}

// ================== Eventos ==================

document.addEventListener('DOMContentLoaded', () => {
    cargarCombate();
    cargarTurno();
    cargarHistorial();
    cargarCondiciones();
    render();

    document.getElementById('btn-siguiente-turno').addEventListener('click', () => {
        const ordenados = [...construirListaParaRender()].sort((a, b) => b.iniciativa - a.iniciativa);
        siguienteTurno(ordenados);
        render();
    });

    document.getElementById('btn-agregar-personaje').addEventListener('click', abrirModalAgregarPersonaje);
    document.getElementById('btn-agregar-enemigo').addEventListener('click', abrirModalAgregarEnemigo);
    document.getElementById('btn-borrar-combate').addEventListener('click', borrarCombate);

    // Cierre por X / botón "Salir": aplica a TODOS los modales, incluido el de detalle.
    document.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById(el.dataset.close).style.display = 'none';
        });
    });

    // Cierre clickeando afuera: aplica a todos MENOS a los modales de detalle/confirmación/
    // aviso/iniciativa (pedido explícito: que no se cierren solo por un misclick).
    const MODALES_SIN_CIERRE_AFUERA = new Set(['detalle-modal', 'confirmar-modal', 'aviso-modal', 'iniciativa-modal']);
    document.querySelectorAll('.modal').forEach(modal => {
        if (MODALES_SIN_CIERRE_AFUERA.has(modal.id)) return;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });

    document.getElementById('btn-confirmar-agregar-personajes').addEventListener('click', async () => {
        const ids = [...document.querySelectorAll('#lista-checks-personajes input:checked')].map(i => i.value);
        document.getElementById('modal-agregar-personaje').style.display = 'none';
        if (ids.length) await agregarPersonajesJson(ids);
    });

    document.getElementById('btn-confirmar-agregar-enemigos').addEventListener('click', async () => {
        const ids = [...document.querySelectorAll('#lista-checks-enemigos input:checked')].map(i => i.value);
        document.getElementById('modal-agregar-enemigo').style.display = 'none';
        if (ids.length) await agregarEnemigosExistentes(ids);
    });

    document.querySelectorAll('#hp-modal .hp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = btn.dataset.amount ? parseInt(btn.dataset.amount) : 0;
            const maxAmount = btn.dataset.maxAmount ? parseInt(btn.dataset.maxAmount) : 0;
            aplicarCambioHp(amount, maxAmount);
        });
    });

    document.querySelectorAll('#ca-modal [data-ca-amount]').forEach(btn => {
        btn.addEventListener('click', () => aplicarCambioCa(parseInt(btn.dataset.caAmount)));
    });
    document.getElementById('ca-reset').addEventListener('click', restaurarCaOriginal);
});
