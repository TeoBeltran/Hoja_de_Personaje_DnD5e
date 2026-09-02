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
    parseMod,
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
    { id: 'aredhel', nombre: 'Aredhel' },
    { id: 'chiaragorn', nombre: 'Chiaragorn' },
    { id: 'lyralei', nombre: 'Lyralei' },
    { id: 'cedric', nombre: 'Cedric' },
    { id: 'aldren', nombre: 'Aldren' },
    { id: 'kael', nombre: 'Kael' },
    { id: 'varis', nombre: 'Varis' }
];

const COMBATE_KEY = 'combate_participantes';
const TURNO_KEY = 'combate_turno';
const HISTORIAL_KEY = 'combate_historial';
const CONDICIONES_KEY = 'combate_condiciones';
const BITACORA_KEY = 'combate_bitacora';
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
            agregarDivisorRonda(turnoState.ronda);
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

// 'aliado' = personaje jugable o su familiar/montura invocado; 'rival' = enemigo de
// la sección Enemigos o un "enemigo manual" viejo. Se usa para el punto de color del
// historial (para diferenciar de un vistazo quién perdió/ganó vida).
function tipoParticipante(p) {
    return (p.origen === 'json' || p.origen === 'familiar') ? 'aliado' : 'rival';
}

// opts: { delta } cambio de vida actual (daño negativo / cura positivo),
//       { deltaMax } cambio de bono TEMPORAL de vida máxima (ver aplicarBonoVidaMaxTemp),
//       { deltaCA } cambio de bono TEMPORAL de CA (ver aplicarBonoCATemp),
//       { cayoACero } true si este cambio de vida actual dejó al participante en 0.
// Nunca vienen combinados (cada acción del usuario dispara un solo tipo por vez).
function agregarHistorial(p, opts) {
    opts = opts || {};
    const delta = opts.delta || 0;
    const deltaMax = opts.deltaMax || 0;
    const deltaCA = opts.deltaCA || 0;
    if (!delta && !deltaMax && !deltaCA) return;
    historial.unshift({
        nombre: p.nombre,
        delta,
        deltaMax,
        deltaCA,
        tipo: tipoParticipante(p),
        cayoACero: !!opts.cayoACero,
        muerteMasiva: !!opts.muerteMasiva,
        ts: Date.now()
    });
    historial = historial.slice(0, HISTORIAL_MAX);
    guardarHistorial();
    renderHistorial();
}

// Entrada neutral (sin daño/cura/bono de nadie) que marca el paso de una ronda a la
// siguiente, para poder ubicar de un vistazo qué pasó en qué ronda mirando el log.
function agregarDivisorRonda(numeroRonda) {
    historial.unshift({ divisorRonda: numeroRonda, ts: Date.now() });
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
        if (h.divisorRonda) {
            return `<div class="historial-divisor">Ronda ${h.divisorRonda}</div>`;
        }
        const esCA = !!h.deltaCA;
        const esVidaMax = !esCA && !!h.deltaMax;
        const clase = esCA ? 'ca' : (esVidaMax ? 'vidamax' : (h.delta < 0 ? 'dano' : 'cura'));
        const tipo = h.tipo === 'aliado' ? 'aliado' : (h.tipo === 'rival' ? 'rival' : '');
        const dot = tipo ? `<span class="historial-dot ${tipo}" title="${tipo === 'aliado' ? 'Aliado' : 'Rival'}"></span>` : '';
        const hora = new Date(h.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        let texto;
        if (esCA) {
            const signo = h.deltaCA > 0 ? '+' : '';
            texto = `${h.nombre} CA (temp.) ${signo}${h.deltaCA}`;
        } else if (esVidaMax) {
            const signo = h.deltaMax > 0 ? '+' : '';
            texto = `${h.nombre} Vida Máx. (temp.) ${signo}${h.deltaMax}`;
        } else {
            const signo = h.delta > 0 ? '+' : '';
            texto = `${h.nombre} ${signo}${h.delta} HP`;
        }
        const notaCaida = h.muerteMasiva
            ? ` <span class="historial-caida">💀 ¡MUERTE INSTANTÁNEA (daño masivo)!</span>`
            : (h.cayoACero ? ` <span class="historial-caida">☠️ ¡Llegó a 0!</span>` : '');
        return `<div class="historial-item ${clase}">${dot}${texto}${notaCaida} <span style="color:var(--text-muted); font-size:0.75rem;">(${hora})</span></div>`;
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

// ================== Bitácora de sesión (bloc de notas libre) ==================

// Se guarda con un pequeño debounce mientras se tipea (no en cada tecla), y muestra
// "Guardado ✓ hh:mm" para que quede claro que no se pierde nada al cerrar la pestaña.
let bitacoraDebounceId = null;

function cargarBitacora() {
    const textarea = document.getElementById('bitacora-texto');
    textarea.value = localStorage.getItem(BITACORA_KEY) || '';
}

function guardarBitacora() {
    const textarea = document.getElementById('bitacora-texto');
    localStorage.setItem(BITACORA_KEY, textarea.value);
    const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('bitacora-guardado').textContent = `Guardado ✓ ${hora}`;
}

function toggleCondicion(uid, key) {
    const activas = condiciones[uid] || [];
    condiciones[uid] = activas.includes(key) ? activas.filter(k => k !== key) : [...activas, key];
    guardarCondiciones();
}

// ================== Stats de un personaje JSON ==================

// Aplica raza + ASI a las stats base (mismo criterio que aplicarImprovements en script.js)
// OJO: "improvements" vive en el nivel de arriba del JSON (data.improvements),
// NO adentro de "personaje" (data.personaje NO tiene su propio .improvements) —
// por eso esta función recibe el "data" completo, no solo "data.personaje".
// Antes de esta corrección se le pasaba data.personaje y leía personaje.improvements
// (siempre undefined), así que NINGUNA mejora de raza/feat/ASI se aplicaba nunca acá,
// dejando los modificadores y salvaciones del Rastreador de Combate desactualizados
// contra la ficha real (bug real: Puntos de Ki/DEX de Kael, entre otros).
function statsFinales(data) {
    const personaje = (data && data.personaje) || {};
    const stats = { ...(personaje.stats || {}) };
    const imp = data && data.improvements;
    if (imp) {
        (imp.race || []).forEach(r => {
            if (stats[r.atributo] != null) stats[r.atributo] += Number(r.valor) || 0;
        });
        // Feats: mismo criterio que aplicarImprovements() en script.js — faltaba acá.
        (imp.feats || []).forEach(f => {
            if (!f.atributos) return;
            Object.entries(f.atributos).forEach(([stat, valor]) => {
                if (stats[stat] != null) stats[stat] += Number(valor) || 0;
            });
        });
        (imp.asi || []).forEach(a => {
            Object.entries(a.atributos || {}).forEach(([k, v]) => {
                if (stats[k] != null) stats[k] += Number(v) || 0;
            });
        });
    }
    return stats;
}

// Bono plano a TODAS las salvaciones que dan los ítems de equipo actualmente
// EQUIPADOS de este personaje (ej: Anillo de Protección +1 → +1 a salvaciones).
// Lee el mismo estado de "qué está equipado" que guarda personaje.html en
// localStorage (pj_<id>_armaduraEquipada / _escudoEquipado / _armasEquipadas),
// igual criterio que calcularBonosEquipoActivo() en script.js, para que el
// detalle del Rastreador de Combate coincida con la ficha real.
function calcularBonoSalvacionesEquipoCompartido(personajeId, data) {
    const prefix = `pj_${personajeId}_`;
    const equipo = (data && data.equipo) || [];
    const nombresEquipados = [];
    const armadura = localStorage.getItem(prefix + 'armaduraEquipada');
    if (armadura) nombresEquipados.push(armadura);
    const escudo = localStorage.getItem(prefix + 'escudoEquipado');
    if (escudo) nombresEquipados.push(escudo);
    try {
        const armas = JSON.parse(localStorage.getItem(prefix + 'armasEquipadas') || '[]');
        if (Array.isArray(armas)) nombresEquipados.push(...armas);
    } catch (e) { /* localStorage corrupto: se ignora, bono queda en 0 */ }

    let bono = 0;
    nombresEquipados.forEach(nombre => {
        const item = equipo.find(e => e.nombre === nombre);
        if (item && item.efectos) {
            item.efectos.forEach(ef => { if (ef.tipo === 'salvaciones') bono += (ef.valor || 0); });
        }
    });
    return bono;
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
    // Habilidades cuyo máximo de usos escala con el nivel (ej: Channel Divinity) o es
    // directamente igual al nivel (ej: Puntos de Ki del Monje) no traen un "usos" fijo en
    // el JSON — hay que calcularlo acá igual que hace script.js al cargar la ficha real
    // (ver aplicarASIs/carga de habilidadesUso ahí). Sin esto quedan afuera del filtro de
    // abajo y nunca se ven en este modal — era el caso real de Puntos de Ki, que no tiene
    // ningún "usos" estático de respaldo en el JSON.
    const nivel = nivelDePersonaje(data);
    (data.habilidadesUso || []).forEach(h => {
        if (h.usosPorNivel) {
            let maxCalc = 1;
            Object.keys(h.usosPorNivel)
                .map(k => parseInt(k))
                .sort((a, b) => a - b)
                .forEach(umbral => {
                    if (nivel >= umbral) maxCalc = h.usosPorNivel[String(umbral)];
                });
            h.usos = `${maxCalc}/${maxCalc}`;
        }
        if (h.usosIgualANivel) {
            h.usos = `${nivel}/${nivel}`;
        }
    });
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

// getVida/getCA devuelven el valor EFECTIVO (base + bono temporal de combate, ver
// "Bonos temporales de combate" más abajo) — maximoBase se devuelve aparte para que quien
// escriba un cambio de vida actual (aplicarCambioHp) nunca persista el máximo ya inflado
// por el bono en la key permanente del personaje/enemigo.
function getVidaBase(p) {
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
        console.log(`[combate] getVidaBase(${p.personajeId}): todavía no hay data cacheada, devuelvo 0/0`);
        return { actual: 0, maximo: 0 };
    }
    const r = leerVidaCompartida(p.personajeId, data);
    return { actual: r.vidaActual, maximo: r.vidaMaxima };
}

function getVida(p) {
    const base = getVidaBase(p);
    const bono = p.bonoVidaMaxTemp || 0;
    const maximo = Math.max(1, base.maximo + bono);
    const actual = Math.max(0, Math.min(base.actual, maximo));
    return { actual, maximo, maximoBase: base.maximo };
}

function getCABase(p) {
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
    const stats = statsFinales(data);
    return leerCACompartida(p.personajeId, data, stats);
}

function getCA(p) {
    return getCABase(p) + (p.bonoCATemp || 0);
}

// El segundo parámetro SIEMPRE es el máximo BASE (nunca el efectivo con bono incluido) —
// así un cambio de vida actual (daño/cura) nunca termina "horneando" el bono temporal de
// combate dentro del máximo permanente del personaje/enemigo.
function setVida(p, actual, maximoBase) {
    const maxSeguro = isNaN(maximoBase) ? 1 : Math.max(0, maximoBase);
    const maximoEfectivo = Math.max(1, maxSeguro + (p.bonoVidaMaxTemp || 0));
    const actSeguro = isNaN(actual) ? 0 : Math.max(0, Math.min(actual, maximoEfectivo));
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

function setCA(p, valorBase) {
    const seguro = isNaN(valorBase) ? 10 : valorBase;
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

// ================== Bonos temporales de combate (Vida Máxima y CA) ==================
// Capa aparte de la vida máxima/CA "real" del personaje o enemigo: pensada para efectos de
// combate (Aid, Shield of Faith, un debuff que baja el máximo, etc.) que NO deben quedar
// grabados en la ficha permanente y que se borran solos con cualquier descanso. Vive en el
// propio objeto participante (dentro de combate_participantes), no en las keys pj_<id>_* /
// enemigo_<id> — así nunca corrompe el valor real, y basta con sacar al personaje del combate
// (o "🗑️ Nuevo combate") para que desaparezca. Para personajes 'json' TAMBIÉN se borra al
// tomar cualquier descanso corto/largo desde su propia ficha (ver limpiarBonosTemporalesCombate
// en script.js) — los enemigos/manuales no tienen concepto de descanso, así que su bono queda
// hasta que el DM lo saque a mano (con el mismo campo "Restar") o se reinicie el combate.

// Escribe SOLO la vida actual, sin tocar la key/campo de vida máxima para nada (ni para
// "reescribirla igual") — a diferencia de setVida(), que por cómo guarda 'json' (las dos keys
// juntas en un solo helper) siempre terminaba creando una key pj_<id>_vidaMaxima nueva con el
// valor calculado apenas se tocaba algo acá, aunque no hubiese cambiado. Eso es justo lo que
// NO tiene que pasar con un bono temporal: si el personaje sube de nivel después y su Vida base
// del JSON cambia, no debe quedar tapada por una copia vieja guardada sin necesidad.
function setVidaActualSolo(p, actual) {
    const actSeguro = isNaN(actual) ? 0 : Math.max(0, actual);
    if (p.origen === 'manual') {
        p.vidaActual = actSeguro;
        guardarCombate();
    } else if (p.origen === 'enemigo') {
        const rec = leerEnemigo(p.enemigoId);
        if (rec) {
            rec.vidaActual = actSeguro;
            guardarEnemigo(rec);
        }
    } else if (p.origen === 'familiar') {
        const data = dataCache[p.personajeId];
        const activo = data && leerFamiliarActivo(p.personajeId, data);
        if (activo) guardarFamiliarVida(p.personajeId, activo.def.id, actSeguro);
    } else {
        localStorage.setItem(`pj_${p.personajeId}_vidaActual`, String(actSeguro));
    }
}

function aplicarBonoVidaMaxTemp(p, delta) {
    if (!delta) return;
    const antes = getVida(p);
    p.bonoVidaMaxTemp = (p.bonoVidaMaxTemp || 0) + delta;
    const despues = getVida(p);
    // Solo hace falta persistir la vida actual si el bono nuevo (uno negativo, un debuff)
    // obligó a recortarla porque quedó por encima del máximo efectivo nuevo. Si el bono sube
    // el máximo (o baja pero la vida actual ya estaba por debajo), no hay nada que reescribir
    // — así un "Sumar" nunca toca ninguna key permanente del personaje/enemigo.
    if (despues.actual !== antes.actual) {
        setVidaActualSolo(p, despues.actual);
    }
    guardarCombate();
    agregarHistorial(p, { deltaMax: delta });
}

function aplicarBonoCATemp(p, delta) {
    if (!delta) return;
    p.bonoCATemp = (p.bonoCATemp || 0) + delta;
    guardarCombate();
    agregarHistorial(p, { deltaCA: delta });
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
        const stats = statsFinales(data);
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

// ================== Descanso corto/largo para TODA la campaña ==================
// A diferencia del resto del Rastreador (que solo toca a quien está EN el combate actual),
// esto pega sobre TODOS los personajes jugables de PERSONAJES_DISPONIBLES, estén o no en este
// combate — para el caso típico de "el grupo entero descansa" entre encuentros. Ranuras de
// hechizo, usos de habilidad, Hit Dice, toggles activos y mecánicas puntuales (Mage Armor,
// Circle of the Land) son cosas MUY específicas de cada personaje (su clase, su nivel, qué
// rasgos tiene) — esa lógica ya existe y está probada en tomarDescanso() de script.js, así que
// en vez de reimplementarla acá (con el riesgo de que las dos copias se desincronicen, como ya
// pasó una vez con statsFinales — ver §11 del CONTEXT) se marca un "descanso pendiente" por
// personaje en localStorage, que personaje.html aplica solo —con tomarDescanso(), la función
// real— la próxima vez que ese jugador abra su ficha (ver aplicarDescansoPendienteSiCorresponde
// al final de init() en script.js). Lo único que SÍ se actualiza automáticamente para no
// depender de que alguien abra su ficha es el bono TEMPORAL de combate y, en descanso largo,
// la vida — pero SOLO para quien ya está en este combate, así el DM lo ve reflejado al toque.
function marcarDescansoPendiente(personajeId, tipo) {
    // Un 'largo' pendiente no se debe degradar a 'corto' si se pide un corto después (un largo
    // ya incluye todo lo que da uno corto y más); al revés sí se puede subir de corto a largo.
    const actual = localStorage.getItem(`pj_${personajeId}_descansoPendiente`);
    if (actual === 'largo' && tipo === 'corto') return;
    localStorage.setItem(`pj_${personajeId}_descansoPendiente`, tipo);
}

async function tomarDescansoGlobal(tipo) {
    await asegurarDataCargada();

    PERSONAJES_DISPONIBLES.forEach(pj => marcarDescansoPendiente(pj.id, tipo));

    // Actualización inmediata para quien YA está en este combate: el bono temporal de combate
    // se borra siempre (mismo criterio que un descanso individual), y en descanso largo la vida
    // se repone a full de una, sin esperar a que abran su ficha.
    participantes.forEach(p => {
        if (p.origen !== 'json') return;
        p.bonoVidaMaxTemp = 0;
        p.bonoCATemp = 0;
        if (tipo === 'largo') {
            const data = dataCache[p.personajeId];
            if (data) {
                const { vidaMaxima } = leerVidaCompartida(p.personajeId, data);
                guardarVidaCompartida(p.personajeId, vidaMaxima, vidaMaxima);
            }
        }
    });
    guardarCombate();
    render();

    const cuantos = PERSONAJES_DISPONIBLES.length;
    mostrarAviso(
        `Descanso ${tipo} aplicado a los ${cuantos} personajes de la campaña, estén o no en este combate. `
        + `Ranuras, usos de habilidad y Hit Dice de cada uno se van a ver actualizados la próxima vez que abran su ficha.`
    );
}

// ================== Modales genéricos (reemplazan confirm()/alert()/prompt() nativos) ==================
// Mismo criterio que enemigo.js/enemigo.html y que TODOS los modales del proyecto: sin X propia,
// no se cierran clickeando afuera, solo con sus botones explícitos (Sí/No, Cerrar, etc.).

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

        // Si hay un bono TEMPORAL de combate activo (ver §"Bonos temporales de combate" en
        // combate.js), se lo marca al lado del número para que se note de un vistazo por qué
        // difiere del valor real de la ficha — sin abrir el modal.
        const bonoVidaMax = p.bonoVidaMaxTemp || 0;
        const vidaTexto = `${actual}/${maximo}` + (bonoVidaMax ? ` <span class="stat-bono">(${bonoVidaMax > 0 ? '+' : ''}${bonoVidaMax})</span>` : '');
        const btnVida = crearStatBtn('Vida', vidaTexto);
        btnVida.addEventListener('click', (e) => { e.stopPropagation(); abrirModalHp(p); });

        const bonoCA = p.bonoCATemp || 0;
        const caTexto = `${getCA(p)}` + (bonoCA ? ` <span class="stat-bono">(${bonoCA > 0 ? '+' : ''}${bonoCA})</span>` : '');
        const btnCA = crearStatBtn('CA', caTexto, p.origen !== 'familiar');
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

        // Salvaciones de muerte: solo para jugadores ('json') a 0 HP. Los dados se
        // tiran en persona — esto solo lleva la cuenta de lo que ya salió (aciertos/
        // fallos) hasta estabilizarse (3 aciertos) o morir (3 fallos).
        if (p.origen === 'json' && actual === 0) {
            card.appendChild(crearMuerteRow(p));
        }

        cont.appendChild(card);
    });

    renderTurnoPanel(ordenados);
    renderHistorial();
}

// ================== Salvaciones de muerte (jugador a 0 HP) ==================
// Estado guardado directo en el participante (p.muerteExitos/p.muerteFallos/...),
// que ya viaja con el resto de "combate_participantes" vía guardarCombate(). No
// se tira ningún dado acá: el DM tilda lo que salió tirando en persona.

function crearMuerteRow(p) {
    const row = document.createElement('div');
    row.className = 'muerte-row';

    const estado = document.createElement('span');
    estado.className = 'muerte-estado' + (p.muerto ? ' muerto' : (p.estabilizado ? ' estable' : ''));
    estado.textContent = p.muerto
        ? (p.muerteMasiva ? '💀 Muerto (daño masivo)' : '☠️ Muerto')
        : (p.estabilizado ? '✅ Estabilizado' : 'Salv. de muerte:');
    row.appendChild(estado);

    if (!p.muerto && !p.estabilizado) {
        row.appendChild(crearMuertePips(p, 'exitos', 'muerteExitos'));
        row.appendChild(crearMuertePips(p, 'fallos', 'muerteFallos'));
    }

    return row;
}

function crearMuertePips(p, tipo, campo) {
    const wrap = document.createElement('span');
    wrap.className = 'muerte-pips';
    const valor = p[campo] || 0;
    for (let i = 0; i < 3; i++) {
        const pip = document.createElement('span');
        const lleno = i < valor;
        pip.className = `muerte-pip ${tipo}` + (lleno ? ' lleno' : '');
        pip.textContent = lleno ? (tipo === 'exitos' ? '✔' : '✘') : '○';
        pip.title = tipo === 'exitos' ? 'Acierto de salvación de muerte' : 'Fallo de salvación de muerte';
        pip.addEventListener('click', (e) => {
            e.stopPropagation();
            setMuertePip(p, campo, i);
        });
        wrap.appendChild(pip);
    }
    return wrap;
}

function setMuertePip(p, campo, index) {
    const valorActual = p[campo] || 0;
    // Clickear el último pip lleno lo vacía (permite corregir); clickear cualquier
    // otro pip llena hasta ahí, como un selector de estrellas.
    p[campo] = (valorActual === index + 1) ? index : index + 1;

    if ((p.muerteExitos || 0) >= 3) {
        p.estabilizado = true;
        p.muerteExitos = 3;
        p.muerteFallos = 0;
    }
    if ((p.muerteFallos || 0) >= 3) {
        p.muerto = true;
    }
    guardarCombate();
    render();
}

// ================== Modal de Vida ==================

function abrirModalHp(p) {
    hpModalTarget = p;
    actualizarHpModalDOM();
    document.getElementById('hp-input-danio').value = '0';
    document.getElementById('hp-input-cura').value = '0';
    document.getElementById('hp-max-input-sumar').value = '0';
    document.getElementById('hp-max-input-restar').value = '0';
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
    // Mismos 5 tramos que el tile de Vida de personaje.html/enemigo.html (ver claseColorVida
    // en script.js): 100%-66% verde, 65%-36% amarillo, 35%-15% naranja, <15% rojo, 0 gris.
    // Se usan las variables CSS (no un hex fijo) para que el color se resuelva solo según
    // el tema activo, igual que el resto de la app.
    fill.style.backgroundColor = actual <= 0 ? 'var(--gris-fill)'
        : pct < 15 ? 'var(--rojo-fill)'
        : pct <= 35 ? 'var(--naranja-fill)'
        : pct <= 65 ? 'var(--amarillo-fill)'
        : 'var(--vida-full-fill)';

    // Bloque de Vida Máxima temporal: no aplica a familiares (su máximo viene fijo de la
    // definición del compañero, no hay dónde persistir un bono en cada render).
    const bloqueMax = document.getElementById('hp-max-temp-bloque');
    if (hpModalTarget.origen === 'familiar') {
        bloqueMax.style.display = 'none';
    } else {
        bloqueMax.style.display = '';
        const bono = hpModalTarget.bonoVidaMaxTemp || 0;
        const info = document.getElementById('hp-max-bono-info');
        info.textContent = bono
            ? `Bono temporal activo: ${bono > 0 ? '+' : ''}${bono} (se borra solo en cualquier descanso)`
            : 'Sin bono temporal activo — se borra solo en cualquier descanso.';
        document.getElementById('hp-quitar-bono').style.display = bono ? '' : 'none';
    }
}

// Regla de "daño masivo" (instant death) de D&D: si un golpe deja a alguien en 0 HP y el daño
// que sobra después de restar lo que tenía (o, si ya estaba en 0, el daño nuevo entero) supera
// su vida máxima EFECTIVA (base + bono temporal de combate), muere directo, sin salvaciones de
// muerte que tirar. Solo se chequea para personajes 'json' — son los únicos con salvaciones de
// muerte en esta app; un enemigo que llega a 0 ya lo maneja el DM a criterio.
// Ejemplo del propio pedido: 20/40 HP, entra un golpe de 70 → 20 para llegar a 0, sobran 50;
// 50 > 40 (máximo) → muere en el acto.
function esDanoMasivo(p, actualAntes, maximoEfectivo, amount) {
    if (p.origen !== 'json' || amount >= 0) return false;
    const dano = -amount;
    const sobrante = actualAntes > 0 ? Math.max(0, dano - actualAntes) : dano;
    return sobrante > maximoEfectivo;
}

function aplicarCambioHp(amount) {
    if (!hpModalTarget || !amount) return;
    const { actual, maximo, maximoBase } = getVida(hpModalTarget);
    const nuevoActual = Math.max(0, Math.min(actual + amount, maximo));
    const muerteMasiva = nuevoActual === 0 && esDanoMasivo(hpModalTarget, actual, maximo, amount);
    setVida(hpModalTarget, nuevoActual, maximoBase);
    if (nuevoActual > 0 && hpModalTarget.origen === 'json') {
        // Se curó por encima de 0: vuelve a estar consciente, se borra cualquier estado de
        // muerte/salvaciones que tuviera tildado (incluida una muerte instantánea previa —
        // mismo criterio "blando" que ya usaba esta app con 3 fallos de salvación: una cura
        // alcanza para revivir, esta app no distingue eso de un hechizo de resurrección real).
        hpModalTarget.muerteExitos = 0;
        hpModalTarget.muerteFallos = 0;
        hpModalTarget.estabilizado = false;
        hpModalTarget.muerto = false;
        hpModalTarget.muerteMasiva = false;
        guardarCombate();
    } else if (muerteMasiva) {
        hpModalTarget.muerto = true;
        hpModalTarget.muerteMasiva = true;
        hpModalTarget.muerteExitos = 0;
        hpModalTarget.muerteFallos = 3;
        hpModalTarget.estabilizado = false;
        guardarCombate();
    }
    agregarHistorial(hpModalTarget, {
        delta: nuevoActual - actual,
        cayoACero: nuevoActual === 0 && actual > 0 && !muerteMasiva,
        muerteMasiva
    });
    actualizarHpModalDOM();
    render();
}

function aplicarCambioVidaMaxTemp(delta) {
    if (!hpModalTarget || !delta) return;
    aplicarBonoVidaMaxTemp(hpModalTarget, delta);
    actualizarHpModalDOM();
    render();
}

function quitarBonoVidaMaxTemp() {
    if (!hpModalTarget) return;
    const bono = hpModalTarget.bonoVidaMaxTemp || 0;
    if (!bono) return;
    aplicarBonoVidaMaxTemp(hpModalTarget, -bono);
    actualizarHpModalDOM();
    render();
}

// ================== Modal de CA ==================

function abrirModalCa(p) {
    caModalTargetUid = p.uid;
    actualizarCaModalDOM();
    document.getElementById('ca-input-sumar').value = '0';
    document.getElementById('ca-input-restar').value = '0';
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
    const bono = p.bonoCATemp || 0;
    const info = document.getElementById('ca-bono-info');
    info.textContent = bono
        ? `Bono temporal activo: ${bono > 0 ? '+' : ''}${bono} (se borra solo en cualquier descanso)`
        : 'Sin bono temporal activo — se borra solo en cualquier descanso.';
    document.getElementById('ca-quitar-bono').style.display = bono ? '' : 'none';
}

function aplicarCambioCaTemp(delta) {
    const p = participanteActualCa();
    if (!p || !delta) return;
    aplicarBonoCATemp(p, delta);
    actualizarCaModalDOM();
    render();
}

function quitarBonoCaTemp() {
    const p = participanteActualCa();
    if (!p) return;
    const bono = p.bonoCATemp || 0;
    if (!bono) return;
    aplicarBonoCATemp(p, -bono);
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

    const stats = statsFinales(data);
    const nivel = nivelDePersonaje(data);
    const profBonus = parseInt(calcularProficiencia(nivel).replace('+', ''));
    const mods = generarModificadores(stats, data.personaje.clase);

    const salvacionesExtra = (data.rasgos || [])
        .filter(r => r.otorgaSalvacionProficiente)
        .map(r => r.otorgaSalvacionProficiente);
    const saves = generarSalvaciones(stats, data.personaje.clase, profBonus, salvacionesExtra);
    // Suma el bono plano de equipo (ej. Anillo de Protección +1) a cada salvación,
    // igual que hace actualizarSalvacionesDOM() en script.js con la ficha real.
    const bonoSalvEquipo = calcularBonoSalvacionesEquipoCompartido(p.personajeId, data);
    if (bonoSalvEquipo) {
        saves.forEach(s => { s.valor = formatMod(parseMod(s.valor) + bonoSalvEquipo); });
    }

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
    cargarBitacora();
    render();

    document.getElementById('bitacora-texto').addEventListener('input', () => {
        clearTimeout(bitacoraDebounceId);
        bitacoraDebounceId = setTimeout(guardarBitacora, 500);
    });

    document.getElementById('btn-siguiente-turno').addEventListener('click', () => {
        const ordenados = [...construirListaParaRender()].sort((a, b) => b.iniciativa - a.iniciativa);
        siguienteTurno(ordenados);
        render();
    });

    document.getElementById('btn-agregar-personaje').addEventListener('click', abrirModalAgregarPersonaje);
    document.getElementById('btn-agregar-enemigo').addEventListener('click', abrirModalAgregarEnemigo);
    document.getElementById('btn-borrar-combate').addEventListener('click', borrarCombate);

    document.getElementById('btn-descanso-corto-todos').addEventListener('click', () => {
        abrirConfirmar(
            `¿Aplicar un descanso CORTO a los ${PERSONAJES_DISPONIBLES.length} personajes de la campaña (estén o no en este combate)?`,
            () => tomarDescansoGlobal('corto')
        );
    });
    document.getElementById('btn-descanso-largo-todos').addEventListener('click', () => {
        abrirConfirmar(
            `¿Aplicar un descanso LARGO a los ${PERSONAJES_DISPONIBLES.length} personajes de la campaña (estén o no en este combate)? Se restaura su vida, Hit Dice, ranuras y habilidades.`,
            () => tomarDescansoGlobal('largo')
        );
    });

    // Cierre por X / botón "Salir": aplica a TODOS los modales, incluido el de detalle.
    document.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById(el.dataset.close).style.display = 'none';
        });
    });

    // Regla general del proyecto: NINGÚN modal se cierra clickeando afuera, en ninguna
    // página (evita que un misclick en medio de un combate cierre algo sin querer) —
    // solo la X o el botón de cancelar/cerrar propio de cada modal lo hacen. Antes de
    // esta corrección, acá se excluía solo a detalle/confirmar/aviso/iniciativa y el
    // resto (agregar personaje/enemigo, vida) sí se cerraba con un click afuera.

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

    // Daño/Curación del modal de Vida: se tipean los dos montos y se aplican juntos como un
    // solo cambio neto (cura - daño), para que el historial registre una única entrada.
    const hpInputDanio = document.getElementById('hp-input-danio');
    const hpInputCura = document.getElementById('hp-input-cura');
    document.getElementById('hp-aplicar-btn').addEventListener('click', () => {
        const danio = Math.max(0, parseInt(hpInputDanio.value) || 0);
        const cura = Math.max(0, parseInt(hpInputCura.value) || 0);
        aplicarCambioHp(cura - danio);
        hpInputDanio.value = '0';
        hpInputCura.value = '0';
        hpInputDanio.focus();
    });
    [hpInputDanio, hpInputCura].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('hp-aplicar-btn').click();
            }
        });
    });

    // Vida Máxima TEMPORAL: mismo patrón de 2 inputs (Sumar/Restar) + Aplicar como Daño/Curación,
    // pero es un bono aparte (ver aplicarBonoVidaMaxTemp) que nunca toca el máximo real.
    const hpMaxInputSumar = document.getElementById('hp-max-input-sumar');
    const hpMaxInputRestar = document.getElementById('hp-max-input-restar');
    document.getElementById('hp-max-aplicar-btn').addEventListener('click', () => {
        const sumar = Math.max(0, parseInt(hpMaxInputSumar.value) || 0);
        const restar = Math.max(0, parseInt(hpMaxInputRestar.value) || 0);
        aplicarCambioVidaMaxTemp(sumar - restar);
        hpMaxInputSumar.value = '0';
        hpMaxInputRestar.value = '0';
    });
    [hpMaxInputSumar, hpMaxInputRestar].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('hp-max-aplicar-btn').click();
            }
        });
    });
    document.getElementById('hp-quitar-bono').addEventListener('click', quitarBonoVidaMaxTemp);

    // CA: mismo patrón de 2 inputs (Sumar/Restar) para el bono TEMPORAL — reemplaza los viejos
    // botones ±1 (que antes escribían directo sobre la CA real, permanente, del personaje/enemigo).
    const caInputSumar = document.getElementById('ca-input-sumar');
    const caInputRestar = document.getElementById('ca-input-restar');
    document.getElementById('ca-aplicar-btn').addEventListener('click', () => {
        const sumar = Math.max(0, parseInt(caInputSumar.value) || 0);
        const restar = Math.max(0, parseInt(caInputRestar.value) || 0);
        aplicarCambioCaTemp(sumar - restar);
        caInputSumar.value = '0';
        caInputRestar.value = '0';
    });
    [caInputSumar, caInputRestar].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('ca-aplicar-btn').click();
            }
        });
    });
    document.getElementById('ca-quitar-bono').addEventListener('click', quitarBonoCaTemp);
    document.getElementById('ca-reset').addEventListener('click', restaurarCaOriginal);
});
