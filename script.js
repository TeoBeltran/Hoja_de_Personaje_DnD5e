import {
    ICONOS_PERSONAJE,
    PROFICIENCIAS_POR_CLASE,
    NOMBRES_STATS,
    SKILL_STAT,
    SKILL_DESC,
    MAESTRIA_ARMA_INFO
} from "./Scripts/Datos/Constantes.js";

import {
    calcularProficiencia,
    calcularPactMagic,
    parseMod,
    formatMod,
    obtenerMod,
    statAMod,
    calcularValorSkill,
    generarHabilidades,
    generarModificadores,
    generarSalvaciones
} from "./Scripts/Core/Estadisticas.js";

import {
    resolverAtaques,
    resolverDanoBase,
    formatearDanoConBonos,
    formatearDetalleBonos,
    calcularExtraAttacks,
    resolverBono,
    bonoAplicaA,
    calcularBonosDano,
    obtenerHitDiceSegunClase,
    armaduraMaximaSegunClase,
    puedeUsarEscudoSegunClase,
    validarRequerimientosStats,
    validarArmaduraPorClase
} from "./Scripts/Core/Util.js";

let modal, modalTitle, modalDesc, closeBtn, modalActions, useSpellBtn;

// Estado global
let ranurasState = {};
let ranurasOriginales = {};
let claseEsBrujo = false;
let vidaActual = 0;
let vidaMaxima = 0;
let vidaMaximaOriginal = 0;
let caActual = 0;
let caOriginal = 0;
let habilidadesUsoState = {};
let togglesActivos = {}; // { "Radiant Soul": true, ... } - habilidades tipo interruptor (se activan y desactivan, no se "gastan" al apagarlas)
let habilidadesUsoOriginales = {};
let hitDiceActual = 0;
let hitDiceMaximo = 0;
let hitDiceDado = 'd8';
let hdCantidadAUsar = 0;
let proficienciaActual = 2;         // El personaje a nivel 1 tiene 2
let modPrincipal = 0;
let nombreModPrincipal = '';
let claseActual = '';
let armaduraEquipadaId = null;
let armaduraEquipadaBase = 0;
let armaduraEquipadaTipo = '';
let escudoEquipadoId = null;
let escudoEquipadoBase = 0;
let armasEquipadas = [];   // array de nombres de armas equipadas
let notasEquipoActuales = []; // notas de items equipados a mostrar al lanzar hechizos (ej: "ignora cobertura")
let ultimoDanoMostrado = ''; // último "Xd6 fuego" calculado, para repetirlo en el modal de Efectos Activados

// === Circle of the Land (DnD 5.5e) ===
let circuloDeLaTierraGlobal = null; // { landActual, opciones } del JSON, si la clase lo tiene
let landActualGlobal = null;        // Land elegida actualmente (o null si no eligió)

// Emojis para cada Land, solo estético
const EMOJI_LAND = {
    'Arid': '🏜️',
    'Polar': '❄️',
    'Temperate': '🌳',
    'Tropical': '🌴',
    'Underdark': '🕳️'
};

// Abre el selector de Land. Función top-level (no depende de closures de init) para poder
// llamarla también desde tomarDescanso() al terminar un descanso largo.
function abrirModalLand() {
    if (!circuloDeLaTierraGlobal) return;
    const landModal = document.getElementById('land-modal');
    const landOpcionesCont = document.getElementById('land-opciones');
    if (!landModal || !landOpcionesCont) return;

    landOpcionesCont.innerHTML = '';
    Object.keys(circuloDeLaTierraGlobal.opciones).forEach(nombreLand => {
        const info = circuloDeLaTierraGlobal.opciones[nombreLand];
        const emoji = EMOJI_LAND[nombreLand] || '🌍';
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.style.cssText = 'display: flex; align-items: flex-start; gap: 10px; height: auto; text-align: left; padding: 12px;';
        btn.innerHTML = `
            <span style="font-size: 1.8rem; line-height: 1;">${emoji}</span>
            <span style="display: flex; flex-direction: column;">
                <strong>${nombreLand}${landActualGlobal === nombreLand ? ' ✓ (actual)' : ''}</strong>
                <span style="font-size: 0.85rem; color: var(--text-muted);">${info.descCorta || ''}</span>
            </span>
        `;
        btn.onclick = () => {
            localStorage.setItem(STORAGE_PREFIX + 'landActual', nombreLand);
            mostrarToast(`${emoji} Land elegida: ${nombreLand}. Recargando la hoja...`);
            setTimeout(() => location.reload(), 700);
        };
        landOpcionesCont.appendChild(btn);
    });
    landModal.style.display = 'flex';
}
let manosUsadas = 0;       // total de manos ocupadas (escudo + armas)
let modDexGlobal = 0;
let modStrGlobal = 0;
let modWisGlobal = 0;
let statsGlobal = {};
let rasgosGlobal = [];

// === Inventario ===
let inventarioState = []; // array con {nombre, peso, cantidad, desc}
let itemInventarioActual = null;
let cantidadInventarioPendiente = 0;

// === Sistema de peso y velocidad ===
let velocidadBase = 30; // Velocidad original del personaje (en ft)
let velocidadActual = 30;
let pesoCargado = 0;
let pesoMaximo = 0;
let tamanoPersonaje = 'estandar';

// === Sistema de turno ===
let turnoEstado = { accion: 1, bonus: 1, reaccion: 1, objeto: 1, golpesRestantes: 0 };
let extraAttacks = 1; // 2 si tiene "Extra Attack", 3 si tiene "Extra Attack (2)", etc.
let actionSurgeActivo = false; // Flag: cuando se usa Action Surge, el próximo "Terminé mi turno" no termina sino que reinicia
let mageArmorActivo = false; // Flag: si Mage Armor está activo, la CA se calcula con armaduraMagicaBase + DEX
let mageArmorBase = 13; // CA base cuando Mage Armor está activo

// === Familiar / Steed (Find Familiar, Find Steed, etc.) ===
let familiarDataActual = null; // { id, nombre, tipo, emoji, ca, mod, vidaMaxima, ataques: [{nombre, dano, desc}] }
let familiarVidaActual = 0;
let familiarActivo = false; // true mientras esté vivo y no haya sido despedido. NO se resetea con descansos.
let nivelPersonajeGlobal = 1; // Nivel del personaje, usado por funciones fuera de init() (ej: abrirModalEscalaSlot)

// === FUNCIONES DE GUARDADO
function guardarRanuras() {
    localStorage.setItem(STORAGE_PREFIX + 'ranurasHechizos', JSON.stringify(ranurasState));
}

function guardarVida() {
    localStorage.setItem(STORAGE_PREFIX + 'vidaActual', String(vidaActual));
    localStorage.setItem(STORAGE_PREFIX + 'vidaMaxima', String(vidaMaxima));
}

function guardarCA() {
    localStorage.setItem(STORAGE_PREFIX + 'caActual', String(caActual));
}

function guardarArmaduraEquipada() {
    if (armaduraEquipadaId) {
        localStorage.setItem(STORAGE_PREFIX + 'armaduraEquipada', armaduraEquipadaId);
    } else {
        localStorage.removeItem(STORAGE_PREFIX + 'armaduraEquipada');
    }
}

function guardarEscudoEquipado() {
    if (escudoEquipadoId) {
        localStorage.setItem(STORAGE_PREFIX + 'escudoEquipado', escudoEquipadoId);
    } else {
        localStorage.removeItem(STORAGE_PREFIX + 'escudoEquipado');
    }
}

function guardarArmasEquipadas() {
    localStorage.setItem(STORAGE_PREFIX + 'armasEquipadas', JSON.stringify(armasEquipadas));
}

function guardarHitDice() {
    localStorage.setItem(STORAGE_PREFIX + 'hitDiceActual', String(hitDiceActual));
}

function guardarHabilidadesUso() {
    localStorage.setItem(STORAGE_PREFIX + 'habilidadesUso', JSON.stringify(habilidadesUsoState));
}

function guardarToggles() {
    localStorage.setItem(STORAGE_PREFIX + 'togglesActivos', JSON.stringify(togglesActivos));
}

// Suma el daño extra de cualquier habilidad tipo "interruptor" (toggleBonoDano) que esté
// activa (ej: Radiant Soul: +nivel de daño radiante mientras esté prendida). Devuelve una
// lista de {nombre, valor} para mezclar con los demás bonos de daño de un arma.
function bonoDanoDeTogglesActivos() {
    const detalles = [];
    (window._habilidadesUsoData || []).forEach(h => {
        if (h.toggleBonoDano && togglesActivos[h.nombre]) {
            const formula = h.toggleBonoDano.formula;
            // Si la fórmula es notación de dado (ej: "1d6"), no se evalúa como matemática:
            // se pasa tal cual para mostrarse como "+1d6" en el badge de daño (violeta).
            const esDado = /^\d+d\d+$/i.test(String(formula).trim());
            const valor = esDado ? String(formula).trim() : evaluarFormula(formula, { nivelPersonaje: nivelPersonajeGlobal });
            if (valor) detalles.push({ nombre: h.nombre, valor });
        }
    });
    return detalles;
}

function guardarInventario() {
    localStorage.setItem(STORAGE_PREFIX + 'inventario', JSON.stringify(inventarioState));
}

function guardarTurnoEstado() {
    localStorage.setItem(STORAGE_PREFIX + 'turno', JSON.stringify(turnoEstado));
}

// Guarda solo el ID del familiar (para saber cuál era) y su vida actual.
// Los datos completos (ataques, CA, etc.) siempre se vuelven a leer del JSON del personaje.
// Esto NO se toca en tomarDescanso(): el familiar sigue vivo/activo hasta que llega a 0 HP
// o se lo despide manualmente, sin importar cuántos descansos cortos o largos pasen.
function guardarFamiliar() {
    if (familiarActivo && familiarDataActual) {
        localStorage.setItem(STORAGE_PREFIX + 'familiar', JSON.stringify({
            id: familiarDataActual.id,
            vidaActual: familiarVidaActual,
            activo: true
        }));
    } else {
        localStorage.removeItem(STORAGE_PREFIX + 'familiar');
    }
}

// === Sistema de efectos automáticos ===

// Evalúa una fórmula sustituyendo variables conocidas
// Variables soportadas: nivelHechizo, nivelPersonaje, WIS, STR, DEX, CON, INT, CHA
function evaluarFormula(formula, contexto) {
    let expr = formula;

    // Reemplazar variables por sus valores
    expr = expr.replace(/nivelHechizo/g, contexto.nivelHechizo || 0);
    expr = expr.replace(/nivelPersonaje/g, contexto.nivelPersonaje || 0);
    expr = expr.replace(/WIS/g, statAMod(statsGlobal.WIS || 10));
    expr = expr.replace(/STR/g, statAMod(statsGlobal.STR || 10));
    expr = expr.replace(/DEX/g, statAMod(statsGlobal.DEX || 10));
    expr = expr.replace(/CON/g, statAMod(statsGlobal.CON || 10));
    expr = expr.replace(/INT/g, statAMod(statsGlobal.INT || 10));
    expr = expr.replace(/CHA/g, statAMod(statsGlobal.CHA || 10));

    // Evaluar la expresión matemática (segura: solo permite + - * / números y paréntesis)
    if (!/^[\d+\-*/() .]+$/.test(expr)) return 0;
    try {
        return Function('"use strict"; return (' + expr + ')')();
    } catch (e) {
        return 0;
    }
}

// Verifica si el personaje tiene un rasgo dado (por nombre)
function tieneRasgo(nombreRasgo) {
    if (!rasgosGlobal) return false;
    return rasgosGlobal.some(r => r.nombre === nombreRasgo);
}

// Flag global para indicar que al cerrar el modal de efectos, hay que abrir el modal de vida
let abrirModalVidaTrasEfectos = false;

// Efectos "pasivos" de equipo: se aplican solos (CA, salvaciones, bonos de ataque, etc. via
// calcularBonosEquipoActivo) y NUNCA deben disparar el modal de notificaciones de procesarEfectos.
const TIPOS_EFECTO_PASIVO_EQUIPO = ['CA', 'salvaciones', 'bonoAtaqueHechizo', 'bonoCDHechizo', 'bonoAtaqueMelee', 'ignorarCobertura', 'curacionExtra'];

// Chequea si un rasgo (con campo "disparadores") aplica al contexto actual.
// disparadores = { arma: true, hechizo: true, curacion: {tipoDano:'curación'}, habilidad: "Second Wind" }
// - true            → aplica siempre que ese tipo de contexto esté activo
// - string          → aplica solo si item.nombre coincide exactamente (ej: una habilidad puntual)
// - objeto {a:b}    → aplica solo si item[a] === b para TODAS las claves (ej: {manos:2, tipo:'melee'})
function rasgoAplicaAContexto(rasgo, tiposContexto, item) {
    if (!rasgo.disparadores) return false;
    return tiposContexto.some(tipo => {
        const cond = rasgo.disparadores[tipo];
        if (!cond) return false;
        if (cond === true) return true;
        if (typeof cond === 'string') return !!item && item.nombre === cond;
        if (typeof cond === 'object') return !!item && Object.keys(cond).every(k => item[k] === cond[k]);
        return false;
    });
}

// Procesa los efectos de un item y muestra el modal si hay alguno aplicable.
// contexto.tipos = array de etiquetas del disparo actual, ej: ['arma'], ['hechizo'], ['habilidad'].
// contexto.danoTexto = si se pasa, se muestra como recap arriba de todo (ej: "9d6 fuego").
function procesarEfectos(item, contexto) {
    if (!item) return;
    contexto = contexto || {};
    const tiposContexto = contexto.tipos || [];

    // Armar la lista de efectos a evaluar. Si el item es un arma con maestriaArma asignada
    // y el personaje tiene el rasgo "Weapon Mastery", se agrega automáticamente una notificación
    // con esa propiedad (Tajo, Rozar, etc.) sin tener que declararla a mano en cada arma.
    let listaEfectos = Array.isArray(item.efectos) ? [...item.efectos] : [];
    if (item.maestriaArma && tieneRasgo('Weapon Mastery') && MAESTRIA_ARMA_INFO[item.maestriaArma]) {
        const m = MAESTRIA_ARMA_INFO[item.maestriaArma];
        listaEfectos.unshift({
            tipo: 'notificacion',
            descripcion: `${m.emoji} Maestría: ${m.nombre}`,
            mensaje: m.desc
        });
    }

    // Rasgos "globales" del personaje con disparadores que matcheen este contexto (ej: Improved
    // Critical o Remarkable Athlete en CUALQUIER arma, sin tener que copiarlo en cada una).
    (rasgosGlobal || []).forEach(rasgo => {
        if (rasgoAplicaAContexto(rasgo, tiposContexto, item)) {
            const yaEstaba = listaEfectos.some(e => e.rasgoRequerido === rasgo.nombre || e.descripcion === rasgo.nombre);
            if (!yaEstaba) {
                listaEfectos.push({ tipo: 'notificacion', descripcion: rasgo.nombre, mensaje: rasgo.desc, colorCard: rasgo.colorCard, colorCardFondo: rasgo.colorCardFondo });
            }
        }
    });

    // Habilidades (no rasgos) con disparadores propios. Dos casos:
    // - "disparadores" directo: siempre activo (ej: Eldritch Invocation: Grasp of Hadar,
    //   que no se "usa" con botón, es un recordatorio pasivo atado a Eldritch Blast).
    // - "disparadoresSiActivo" + "toggleBonoDano": solo si está prendida (ej: Radiant Soul).
    (window._habilidadesUsoData || []).forEach(hab => {
        const yaEstaba = () => listaEfectos.some(e => e.descripcion === hab.nombre);
        if (hab.disparadores && rasgoAplicaAContexto(hab, tiposContexto, item) && !yaEstaba()) {
            listaEfectos.push({ tipo: 'notificacion', descripcion: hab.nombre, mensaje: hab.desc });
        } else if (hab.toggleBonoDano && togglesActivos[hab.nombre] && hab.disparadoresSiActivo
            && rasgoAplicaAContexto({ disparadores: hab.disparadoresSiActivo }, tiposContexto, item) && !yaEstaba()) {
            const formula = hab.toggleBonoDano.formula;
            const esDado = /^\d+d\d+$/i.test(String(formula).trim());
            const valor = esDado ? String(formula).trim() : evaluarFormula(formula, { nivelPersonaje: nivelPersonajeGlobal });
            const notaExtraTxt = hab.toggleBonoDano.notaExtra ? ` ${hab.toggleBonoDano.notaExtra}` : '';
            listaEfectos.push({
                tipo: 'notificacion',
                descripcion: `⚡ ${hab.nombre} (activo)`,
                mensaje: `Sumás +${valor} de daño${hab.toggleBonoDano.tipoDano ? ' ' + hab.toggleBonoDano.tipoDano : ''} extra a este ataque.${notaExtraTxt} Se apaga desde el botón de ${hab.nombre}.`
            });
        }
    });

    if (listaEfectos.length === 0 && !contexto.danoTexto) return;

    const efectosAplicables = listaEfectos.filter(e => {
        // Los efectos pasivos de equipo no van en este modal, se aplican solos
        if (TIPOS_EFECTO_PASIVO_EQUIPO.includes(e.tipo)) return false;
        // Si requiere un rasgo, validar que el personaje lo tenga
        if (e.rasgoRequerido && !tieneRasgo(e.rasgoRequerido)) return false;
        return true;
    });

    if (efectosAplicables.length === 0 && !contexto.danoTexto) return;

    // Si hay un efecto de tipo "notificacionYAbreVida", marcar para abrir modal de vida al cerrar
    abrirModalVidaTrasEfectos = efectosAplicables.some(e => e.tipo === 'notificacionYAbreVida');

    // Construir HTML del modal
    const lista = document.getElementById('efectos-lista');
    if (!lista) return;
    lista.innerHTML = '';

    // Recap del daño (ej: para Fireball elegido en Nivel 4, repetir "9d6 fuego" acá arriba)
    if (contexto.danoTexto) {
        const divDano = document.createElement('div');
        divDano.style.cssText = 'padding: 12px; background-color: #f3e5f5; border: 2px solid #6a1b9a; border-radius: var(--border-radius); text-align: center;';
        divDano.innerHTML = `<span style="font-size: 1.3rem; font-weight: bold; color: #6a1b9a;">💥 ${contexto.danoTexto}</span>`;
        lista.appendChild(divDano);
    }

    efectosAplicables.forEach(efecto => {
        const div = document.createElement('div');
        const colorBorde = efecto.colorCard || 'var(--accent-color)';
        const colorFondo = efecto.colorCard ? (efecto.colorCardFondo || '#f3e5f5') : '#fbf9f4';
        div.style.cssText = `padding: 12px; background-color: ${colorFondo}; border: 1px solid var(--border-color); border-left: 4px solid ${colorBorde}; border-radius: var(--border-radius);`;

        let mensaje = '';
        if (efecto.tipo === 'autoCuracion') {
            const valor = evaluarFormula(efecto.formula, contexto);
            mensaje = `Tenés que curarte <strong style="color: #2e7d32; font-size: 1.2rem;">${valor} HP</strong>`;
        } else if (efecto.tipo === 'autoDano') {
            const valor = evaluarFormula(efecto.formula, contexto);
            mensaje = `Recibís <strong style="color: #c62828; font-size: 1.2rem;">${valor} de daño</strong>`;
        } else if (efecto.tipo === 'notificacion' || efecto.tipo === 'notificacionYAbreVida' || efecto.tipo === 'activarActionSurge' || efecto.tipo === 'toggleArmaduraMagica') {
            // Reemplazar placeholders en el mensaje: {nivelPersonaje}, {WIS}, {STR}, etc.
            mensaje = (efecto.mensaje || '').replace(/\{(\w+)\}/g, (match, key) => {
                if (key === 'nivelPersonaje') return contexto.nivelPersonaje || 0;
                if (key === 'nivelHechizo') return contexto.nivelHechizo || 0;
                if (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(key)) {
                    return statAMod(statsGlobal[key] || 10);
                }
                return match;
            });
            // Si es Action Surge, activar el flag
            if (efecto.tipo === 'activarActionSurge') {
                actionSurgeActivo = true;
                turnoEstado.accion = 1;
                guardarTurnoEstado();
                actualizarTurnoDOM();
            }
            // Si es toggleArmaduraMagica, activar Mage Armor y recalcular CA
            if (efecto.tipo === 'toggleArmaduraMagica') {
                mageArmorActivo = true;
                mageArmorBase = efecto.caBase || 13;
                localStorage.setItem(STORAGE_PREFIX + 'mageArmorActivo', 'true');
                localStorage.setItem(STORAGE_PREFIX + 'mageArmorBase', String(mageArmorBase));
                recalcularYActualizarCA();
            }
        }

        div.innerHTML = `
            <div style="font-weight: bold; color: ${colorBorde}; margin-bottom: 4px;">${efecto.descripcion}</div>
            <div style="font-size: 0.95rem; color: ${efecto.colorCard ? colorBorde : 'var(--text-color)'};">${mensaje}</div>
        `;
        lista.appendChild(div);
    });

    document.getElementById('efectos-modal').style.display = 'flex';
}

// === Divine Smite ===
let smitesData = []; // Guarda TODOS los objetos "smite" del JSON (Divine Smite, Honey Smite, etc.)

// Mapea nivel de hechizo a ranura.
// Genérico: soporta cualquier "NIVEL n" (1-9), no solo hasta el 4.
// Nota: ya NO fuerza a los Brujos a usar siempre "Nivel 3". El nivel real de
// la ranura de Pact Magic depende del nivel del personaje (nivel 3 hasta
// personaje nivel 6, nivel 4 desde personaje nivel 7, etc.), así que cada
// hechizo del JSON debe tener puesto directamente el "nivel" real de su ranura
// (ej: "NIVEL 4" si el personaje ya tiene ranuras de nivel 4).
function mapNivelHechizoARanura(nivelHechizo) {
    if (nivelHechizo === "CANTRIPS") return null; // Cantrips nunca consumen
    // Pact Magic (Brujo): TODOS los hechizos (sin importar su nivel real) se lanzan
    // siempre con la única ranura de Pacto disponible a este nivel de personaje.
    if (pactMagicNivelRanura) return pactMagicNivelRanura;
    const match = /^NIVEL (\d+)$/.exec(nivelHechizo || '');
    if (!match) return null;
    return `Nivel ${match[1]}`;
}

let ranurasInfo = {}; // Guarda qué descanso recupera cada ranura
let habilidadesInfo = {}; // Guarda qué descanso recupera cada habilidad
let habilidadesRecuperaCortoCantidad = {}; // Cuántos usos suma un descanso corto (ej: Second Wind: +1, aunque el máximo sea 2)
// Pact Magic (Brujo): si el personaje tiene el rasgo "esPactMagic", acá se guarda la
// única ranura ("Nivel N") que existe siempre, sea cual sea el nivel real del hechizo.
let pactMagicNivelRanura = null;



function actualizarRanuraDOM(nivel) {
    const id = `ranura-${nivel.replace(' ', '-')}`;
    const el = document.getElementById(id);
    if (el) {
        const valor = ranurasState[nivel];
        el.querySelector('.valor-ranura').textContent = valor;
        if (parseInt(valor) <= 0) {
            el.classList.add('ranura-vacia');
        } else {
            el.classList.remove('ranura-vacia');
        }
    }
}

let toastTimeout = null;
function mostrarToast(mensaje, tipo = 'normal') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = mensaje;
    toast.className = 'visible' + (tipo === 'warning' ? ' warning' : '');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.className = '';
    }, 2000);
}

function actualizarVidaDOM() {
    const btnVida = document.getElementById('vida-btn');
    if (btnVida) {
        btnVida.querySelector('.skill-mod').textContent = `${vidaActual}/${vidaMaxima}`;
        // Marcar como modificado si la vida máx. cambió respecto al original
        if (vidaMaxima !== vidaMaximaOriginal) {
            btnVida.classList.add('modificado');
        } else {
            btnVida.classList.remove('modificado');
        }
    }
    const display = document.getElementById('hp-display');
    const barFill = document.getElementById('hp-bar-fill');
    if (display) display.textContent = `${vidaActual} / ${vidaMaxima}`;
    if (barFill) {
        const porcentaje = vidaMaxima > 0 ? (vidaActual / vidaMaxima) * 100 : 0;
        barFill.style.width = `${porcentaje}%`;
        if (porcentaje > 50) barFill.style.backgroundColor = '#2e7d32';
        else if (porcentaje > 25) barFill.style.backgroundColor = '#f9a825';
        else barFill.style.backgroundColor = '#c62828';
    }
}

function modificarVidaMaxima(cantidad) {
    vidaMaxima = Math.max(1, vidaMaxima + cantidad);
    // Si la vida actual quedó por encima del nuevo máximo, ajustarla
    if (vidaActual > vidaMaxima) vidaActual = vidaMaxima;
    guardarVida();
    actualizarVidaDOM();
    if (cantidad < 0) {
        mostrarToast(`Vida máxima reducida: ${vidaMaxima}`, 'warning');
    } else {
        mostrarToast(`Vida máxima aumentada: ${vidaMaxima}`);
    }
}

// === Lógica del Familiar / Steed ===

function actualizarFamiliarFabVisibilidad() {
    const fab = document.getElementById('familiar-fab');
    if (fab) fab.style.display = familiarActivo ? 'block' : 'none';
}

function actualizarFamiliarVidaDOM() {
    if (!familiarDataActual) return;
    const display = document.getElementById('familiar-hp-display');
    const barFill = document.getElementById('familiar-hp-bar-fill');
    if (display) display.textContent = `${familiarVidaActual} / ${familiarDataActual.vidaMaxima}`;
    if (barFill) {
        const porcentaje = familiarDataActual.vidaMaxima > 0 ? (familiarVidaActual / familiarDataActual.vidaMaxima) * 100 : 0;
        barFill.style.width = `${porcentaje}%`;
        if (porcentaje > 50) barFill.style.backgroundColor = '#2e7d32';
        else if (porcentaje > 25) barFill.style.backgroundColor = '#f9a825';
        else barFill.style.backgroundColor = '#c62828';
    }
}

// Pinta el contenido completo del modal (nombre, badges, vida, ataques) según familiarDataActual
function renderFamiliarModal() {
    if (!familiarDataActual) return;
    const f = familiarDataActual;

    const titulo = document.getElementById('familiar-modal-title');
    if (titulo) titulo.innerHTML = `${f.emoji || '🐾'} ${f.nombre}${f.tipo ? ` <span style="font-size:0.9rem; color: var(--text-muted); font-weight:normal;">(${f.tipo})</span>` : ''}`;

    const badges = document.getElementById('familiar-badges');
    if (badges) {
        const partes = [];
        if (f.ca !== undefined && f.ca !== null && f.ca !== '') {
            partes.push(`<span class="proficient" style="font-weight:bold; padding:2px 8px; border:1px solid #6a1b9a; border-radius:4px;">CA ${f.ca}</span>`);
        }
        if (f.mod) {
            partes.push(`<span class="proficient" style="font-weight:bold; padding:2px 8px; border:1px solid #6a1b9a; border-radius:4px;">${f.mod}</span>`);
        }
        badges.innerHTML = partes.join('');
    }

    actualizarFamiliarVidaDOM();

    // Nota opcional (ej: "los familiares no pueden atacar"), se muestra arriba de los ataques
    const notasEl = document.getElementById('familiar-notas');
    if (notasEl) {
        notasEl.textContent = f.notas || '';
        notasEl.style.display = f.notas ? 'block' : 'none';
    }

    const lista = document.getElementById('familiar-ataques-lista');
    if (lista) {
        lista.innerHTML = '';
        if (!f.ataques || f.ataques.length === 0) {
            const vacio = document.createElement('div');
            vacio.style.cssText = 'font-size: 0.9rem; color: var(--text-muted); text-align: center; padding: 8px;';
            vacio.textContent = 'No tiene ataques.';
            lista.appendChild(vacio);
        }
        (f.ataques || []).forEach(a => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px; background-color: #fbf9f4; border: 1px solid var(--border-color); border-radius: var(--border-radius);';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="font-weight:bold;">${a.nombre}</span>
                    ${a.dano ? `<span class="skill-mod" style="background-color:#6a1b9a; color:white; flex-shrink:0;">${a.dano}</span>` : ''}
                </div>
                ${a.desc ? `<span style="font-size:0.9rem; color: var(--text-muted);">${a.desc}</span>` : ''}
            `;
            lista.appendChild(div);
        });
    }
}

// Se llama cuando se usa un hechizo que trae un campo "familiar" (Find Familiar, Find Steed),
// o cuando se elige una forma en el selector de Wild Shape. mensajeToast es opcional.
function activarFamiliar(datosFamiliar, mensajeToast) {
    if (!datosFamiliar || !datosFamiliar.id) return;
    familiarDataActual = datosFamiliar;
    familiarVidaActual = datosFamiliar.vidaMaxima;
    familiarActivo = true;
    guardarFamiliar();
    actualizarFamiliarFabVisibilidad();
    renderFamiliarModal();
    mostrarToast(mensajeToast || `${datosFamiliar.emoji || '🐾'} ¡${datosFamiliar.nombre} fue invocado!`);
}

// Despedir/matar al familiar: cierra el modal, oculta el botón flotante y borra el guardado.
// Se usa tanto al llegar a 0 HP como al apretar "Despedir familiar" manualmente.
function desactivarFamiliar() {
    familiarActivo = false;
    const modalFamiliar = document.getElementById('familiar-modal');
    if (modalFamiliar) modalFamiliar.style.display = 'none';
    actualizarFamiliarFabVisibilidad();
    guardarFamiliar();
}

function modificarVidaFamiliar(cantidad) {
    if (!familiarDataActual) return;
    familiarVidaActual = Math.max(0, Math.min(familiarDataActual.vidaMaxima, familiarVidaActual + cantidad));
    guardarFamiliar();
    actualizarFamiliarVidaDOM();
    if (cantidad < 0) {
        mostrarToast(`${familiarDataActual.nombre} recibió ${Math.abs(cantidad)} de daño`, 'warning');
    } else if (cantidad > 0) {
        mostrarToast(`${familiarDataActual.nombre} se curó ${cantidad} HP`);
    }
    if (familiarVidaActual === 0) {
        mostrarToast(`💀 ${familiarDataActual.nombre} llegó a 0 HP`, 'warning');
        setTimeout(() => desactivarFamiliar(), 700);
    }
}

function modificarVida(cantidad) {
    vidaActual = Math.max(0, Math.min(vidaMaxima, vidaActual + cantidad));
    guardarVida();
    actualizarVidaDOM();
    if (cantidad < 0) {
        mostrarToast(`Daño recibido: ${Math.abs(cantidad)} HP`, 'warning');
    } else if (cantidad > 0) {
        mostrarToast(`Curación: +${cantidad} HP`);
    }
    if (vidaActual === 0) {
        mostrarToast('¡Estás inconsciente! 0 HP', 'warning');
    }
}

// === Bonos de equipo (efectos de items NO-armadura que sí se llevan puestos) ===
// Suma los "efectos" de: armadura equipada, escudo equipado, y todo lo que esté en
// armasEquipadas (armas, varitas, capas, botas, etc — cualquier accesorio equipable
// que no sea la armadura/escudo principal). También suma el bono de ataque intrínseco
// de un arma mágica (item.bonoAtaque) al header de Atk Melee/Finesse correspondiente,
// solo si esa arma está efectivamente equipada.
// Algunas armas tienen el bono mágico horneado directo en el string de daño (ej: "2d6+2")
// en vez de en el campo separado "bonoDano". Esto lo separa para poder mostrarlo etiquetado
// igual que cualquier otro bono ("Arma mágica"), en vez de quedar pegado sin explicación.
// Pone mayúscula la primera letra (ej: "radiante" → "Radiante")
function capitalizar(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function extraerBonusHorneado(danoStr) {
    const match = /^(\d+d\d+)\+(\d+)$/.exec(danoStr || '');
    if (match) return { base: match[1], bonus: parseInt(match[2]) };
    return { base: danoStr, bonus: 0 };
}

function calcularBonosEquipoActivo() {
    const bonos = { CA: 0, salvaciones: 0, bonoAtaqueHechizo: 0, bonoCDHechizo: 0, atkMeleeExtra: 0, atkFinesseExtra: 0 };
    const notas = [];
    const equipo = window._equipoData || [];

    const itemsEquipados = [];
    if (armaduraEquipadaId) {
        const it = equipo.find(e => e.nombre === armaduraEquipadaId);
        if (it) itemsEquipados.push(it);
    }
    if (escudoEquipadoId) {
        const it = equipo.find(e => e.nombre === escudoEquipadoId);
        if (it) itemsEquipados.push(it);
    }
    armasEquipadas.forEach(nombre => {
        const it = equipo.find(e => e.nombre === nombre);
        if (it) itemsEquipados.push(it);
    });

    itemsEquipados.forEach(it => {
        if (it.efectos) {
            it.efectos.forEach(ef => {
                if (ef.tipo === 'CA') bonos.CA += (ef.valor || 0);
                else if (ef.tipo === 'salvaciones') bonos.salvaciones += (ef.valor || 0);
                else if (ef.tipo === 'bonoAtaqueHechizo') bonos.bonoAtaqueHechizo += (ef.valor || 0);
                else if (ef.tipo === 'bonoCDHechizo') bonos.bonoCDHechizo += (ef.valor || 0);
                else if (ef.tipo === 'bonoAtaqueMelee') bonos.atkMeleeExtra += (ef.valor || 0);
                else if (ef.tipo === 'ignorarCobertura') notas.push(`${it.nombre}: ignora cobertura ${ef.valor}.`);
            });
        }
        // Bono de ataque propio de un arma mágica (ej: Daga +1, Moon Scimitar +1)
        if (it.bonoAtaque) {
            if (it.tipo === 'finesse') bonos.atkFinesseExtra += it.bonoAtaque;
            else if (it.tipo === 'melee') bonos.atkMeleeExtra += it.bonoAtaque;
            // 'ranged' no tiene header propio todavía, así que no se refleja en ningún lado
        }
    });

    return { bonos, notas };
}

// Devuelve los nombres de armasEquipadas que REALMENTE ocupan una mano (manos > 0).
// Necesario porque armasEquipadas ahora también puede tener accesorios sin manos
// (capas, botas) que no deberían contar para reglas tipo Dueling ("sin otra arma en la otra mano").
function nombresQueOcupanMano() {
    const equipo = window._equipoData || [];
    return armasEquipadas.filter(nombre => {
        const it = equipo.find(e => e.nombre === nombre);
        return it && it.manos > 0;
    });
}

function calcularCA() {
    let ca = 0;
    if (armaduraEquipadaId) {
        if (armaduraEquipadaTipo === 'ligera') {
            ca = armaduraEquipadaBase + modDexGlobal;
        } else if (armaduraEquipadaTipo === 'mediana') {
            // Mediana: máx +2 de DEX. Si DEX es negativo, sí se resta.
            const dexAplicado = Math.min(modDexGlobal, 2);
            ca = armaduraEquipadaBase + dexAplicado;
        } else if (armaduraEquipadaTipo === 'pesada') {
            // Pesada: no aplica DEX en absoluto.
            ca = armaduraEquipadaBase;
        } else {
            ca = armaduraEquipadaBase + modDexGlobal;
        }
    } else if (mageArmorActivo) {
        // Mage Armor: 13 + DEX (sin tope)
        ca = mageArmorBase + modDexGlobal;
    } else if (!escudoEquipadoId && tieneRasgo('Unarmored Defense')) {
        // Unarmored Defense (Monje): 10 + DEX + WIS, sin armadura NI escudo.
        // (Si en el futuro se agrega un Bárbaro con Unarmored Defense propio, esto habría
        // que generalizarlo porque el Bárbaro usa CON en vez de WIS.)
        ca = 10 + modDexGlobal + modWisGlobal;
    } else {
        // Sin armadura: 10 + DEX
        ca = 10 + modDexGlobal;
    }
    if (escudoEquipadoId) {
        ca += escudoEquipadoBase;
    }
    // Sumar CA de accesorios equipados que no son armadura (ej: Capa de Protección +1 CA)
    ca += calcularBonosEquipoActivo().bonos.CA;
    return ca;
}

function recalcularYActualizarCA() {
    caActual = calcularCA();
    // NO actualizamos caOriginal acá: queremos que se mantenga el valor "base" sin Mage Armor
    // para que el botón se marque como modificado cuando hay un cambio
    guardarCA();
    actualizarCaDOM();
}

function recalcularManosUsadas(equipoData) {
    // OJO: usar "!== undefined" y no "|| 1", porque un accesorio con "manos: 0" explícito
    // (capas, botas, etc.) es un valor falsy en JS y el "||" lo confundiría con "sin definir".
    // Solo si el campo "manos" no existe en absoluto asumimos 1 (arma por defecto).
    const manosDe = (item) => (item.manos !== undefined && item.manos !== null) ? item.manos : 1;
    let manos = 0;
    if (escudoEquipadoId) {
        const esc = equipoData.find(e => e.nombre === escudoEquipadoId);
        if (esc) manos += manosDe(esc);
    }
    armasEquipadas.forEach(nombre => {
        const arma = equipoData.find(e => e.nombre === nombre);
        if (arma) manos += manosDe(arma);
    });
    manosUsadas = manos;
    return manos;
}

function actualizarManosDOM() {
    const span = document.getElementById('manos-display');
    if (span) span.textContent = `${manosUsadas} / 2`;
}

function actualizarCaDOM() {
    const btnCa = document.getElementById('ca-btn');
    if (btnCa) {
        btnCa.querySelector('.skill-mod').textContent = caActual;
        // Marcar como modificado si la CA cambió respecto al original
        if (caActual !== caOriginal) {
            btnCa.classList.add('modificado');
        } else {
            btnCa.classList.remove('modificado');
        }
    }
    const display = document.getElementById('ca-display');
    if (display) display.textContent = caActual;
}

function modificarCa(cantidad) {
    caActual = Math.max(0, caActual + cantidad);
    guardarCA();
    actualizarCaDOM();
    if (cantidad < 0) {
        mostrarToast(`CA reducida: ${caActual}`, 'warning');
    } else {
        mostrarToast(`CA aumentada: ${caActual}`);
    }
}

function actualizarHitDiceDOM() {
    const btn = document.getElementById('hd-btn');
    if (btn) {
        btn.querySelector('.skill-mod').textContent = `${hitDiceActual}/${hitDiceMaximo}`;
        if (hitDiceActual !== hitDiceMaximo) {
            btn.classList.add('modificado');
        } else {
            btn.classList.remove('modificado');
        }
    }
    const display = document.getElementById('hd-display');
    if (display) display.textContent = `${hitDiceActual} / ${hitDiceMaximo}`;
}

// === Sistema de peso y velocidad ===

// Multiplicador según tamaño del personaje
function multiplicadorTamano(tamano) {
    if (tamano === 'diminuto') return 0.5;
    if (tamano === 'grande') return 2;
    return 1; // estandar
}

// Calcula el peso total cargado: equipo (siempre) + inventario (cantidad × peso)
function calcularPesoCargado(equipoData) {
    let total = 0;
    if (equipoData) {
        equipoData.forEach(item => {
            if (item.peso) total += item.peso;
        });
    }
    inventarioState.forEach(item => {
        if (item.peso && item.cantidad) {
            total += item.peso * item.cantidad;
        }
    });
    return Math.round(total * 100) / 100; // 2 decimales
}

// Calcula el peso máximo que puede llevar (STR × 15 × multiplicador tamaño)
function calcularPesoMaximo(stats, tamano) {
    const str = stats?.STR || 10;
    const mult = multiplicadorTamano(tamano);
    return str * 15 * mult;
}

// Calcula la velocidad actual según peso cargado
function calcularVelocidad(pesoCargado, stats, tamano, velocidadBase) {
    const str = stats?.STR || 10;
    const mult = multiplicadorTamano(tamano);
    const limite1 = str * 5 * mult;
    const limite2 = str * 10 * mult;
    const limite3 = str * 15 * mult;

    if (pesoCargado <= limite1) return velocidadBase;
    if (pesoCargado <= limite2) return Math.max(0, velocidadBase - 10);
    if (pesoCargado <= limite3) return Math.max(0, velocidadBase - 20);
    return 0; // Sobre el peso máximo
}

// Recalcula peso/velocidad y actualiza el DOM
function recalcularPesoYVelocidad(equipoData) {
    pesoCargado = calcularPesoCargado(equipoData);
    pesoMaximo = calcularPesoMaximo(statsGlobal, tamanoPersonaje);
    velocidadActual = calcularVelocidad(pesoCargado, statsGlobal, tamanoPersonaje, velocidadBase);
    actualizarVelocidadDOM();
    actualizarPesoInventarioDOM();
}

// Actualiza la velocidad mostrada en la stat
function actualizarVelocidadDOM() {
    // Buscamos el botón de Velocidad en el grid (no tiene id, lo identificamos por texto)
    const stats = document.querySelectorAll('#stats-grid .skill-btn');
    stats.forEach(btn => {
        const span = btn.querySelector('span');
        if (span && span.textContent === 'Velocidad') {
            const mod = btn.querySelector('.skill-mod');
            if (mod) mod.textContent = `${velocidadActual}ft`;
            // Marcar en rojo si la velocidad bajó
            if (velocidadActual < velocidadBase) {
                btn.classList.add('velocidad-reducida');
            } else {
                btn.classList.remove('velocidad-reducida');
            }
        }
    });
}

// Actualiza el peso mostrado en el header del modal de inventario
function actualizarPesoInventarioDOM() {
    const span = document.getElementById('inventario-peso');
    if (span) {
        span.textContent = `${pesoCargado} / ${pesoMaximo} lb`;
        if (pesoCargado > pesoMaximo) {
            span.style.color = '#c62828';
        } else if (pesoCargado > pesoMaximo * (5/15)) {
            // Más de STR×5 → ya tiene penalidad
            span.style.color = '#f9a825';
        } else {
            span.style.color = 'var(--text-muted)';
        }
    }
}

// === ASI (Ability Score Improvement) ===

// Aplica los ASIs definidos en habilidadesUso al statsGlobal
// Suma a las stats base del JSON cada vez que se carga la página (sin guardar en localStorage)
function aplicarASIs(habilidadesUsoData) {
    if (!habilidadesUsoData || !Array.isArray(habilidadesUsoData)) return;

    habilidadesUsoData.forEach(hab => {
        if (hab.tipo === 'asi' && hab.stats) {
            Object.keys(hab.stats).forEach(statKey => {
                if (statsGlobal[statKey] !== undefined) {
                    statsGlobal[statKey] += hab.stats[statKey];
                }
            });
        }
    });
}

// === Background ===

// Aplica el background al personaje (solo mergea rasgos)
function aplicarBackground(background, equipoData) {
    if (!background) return;

    // Mergear habilidades del background a rasgos globales
    if (background.habilidades && Array.isArray(background.habilidades)) {
        background.habilidades.forEach(hab => {
            // Evitar duplicados si ya existe un rasgo con el mismo nombre
            const yaExiste = rasgosGlobal.some(r => r.nombre === hab.nombre);
            if (!yaExiste) {
                rasgosGlobal.push(hab);
            }
        });
    }
}

// === Inventario ===

function cargarInventario(inventarioJSON) {
    const guardado = localStorage.getItem(STORAGE_PREFIX + 'inventario');
    if (guardado) {
        try {
            inventarioState = JSON.parse(guardado);
            // Sincronizar con JSON: agregar items nuevos del JSON que no estén en localStorage
            inventarioJSON.forEach(itemJSON => {
                const existe = inventarioState.find(i => i.nombre === itemJSON.nombre);
                if (!existe) {
                    inventarioState.push({ ...itemJSON });
                } else {
                    // Actualizar peso/desc del JSON pero mantener cantidad del localStorage
                    existe.peso = itemJSON.peso;
                    existe.desc = itemJSON.desc;
                }
            });
        } catch(e) {
            inventarioState = inventarioJSON.map(i => ({ ...i }));
        }
    } else {
        inventarioState = inventarioJSON.map(i => ({ ...i }));
    }
}

function renderInventarioLista() {
    const cont = document.getElementById('inventario-lista');
    if (!cont) return;
    cont.innerHTML = '';

    if (inventarioState.length === 0) {
        cont.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Inventario vacío</p>';
        return;
    }

    inventarioState.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%;';
        btn.innerHTML = `
            <span style="font-weight: bold;">${item.nombre}</span>
            <span class="skill-mod" style="background-color: #6a1b9a; color: white;">x${item.cantidad}</span>
        `;
        btn.onclick = () => abrirModalItemInventario(item);
        cont.appendChild(btn);
    });
}

function abrirModalItemInventario(item) {
    itemInventarioActual = item;
    document.getElementById('inv-item-title').textContent = item.nombre;
    document.getElementById('inv-item-info').textContent = `Peso: ${item.peso} lb por unidad`;
    document.getElementById('inv-item-desc').innerHTML = (item.desc || '').replace(/\n/g, '<br>');
    document.getElementById('inv-item-cantidad-actual').textContent = item.cantidad;
    document.getElementById('inv-item-input').value = 0;

    // El botón "Usar" solo aparece si el item tiene un campo "accion" (ej: "Acción", "Acción Bonus",
    // "Interacción c/Objeto") — así se sabe qué recurso del turno gastar al usarlo.
    const usarCont = document.getElementById('inv-item-usar-cont');
    const usarBtn = document.getElementById('inv-item-usar');
    if (usarCont && usarBtn) {
        if (item.accion && item.cantidad > 0) {
            usarCont.style.display = 'block';
            usarBtn.textContent = `Usar (gasta ${item.accion})`;
            usarBtn.disabled = false;
        } else if (item.accion) {
            usarCont.style.display = 'block';
            usarBtn.textContent = 'Sin unidades';
            usarBtn.disabled = true;
        } else {
            usarCont.style.display = 'none';
        }
    }

    document.getElementById('inv-item-modal').style.display = 'flex';
}

// Gasta 1 unidad del item y consume el recurso de turno correspondiente (Acción, Acción Bonus,
// Interacción c/Objeto, etc. según lo que diga item.accion en el JSON)
function usarItemInventario(item) {
    if (!item || !item.accion || item.cantidad <= 0) return;
    const r = consumirAccion(item.accion);
    if (!r.ok) {
        mostrarToast(r.mensaje, 'warning');
        return;
    }
    item.cantidad = Math.max(0, item.cantidad - 1);
    guardarInventario();
    document.getElementById('inv-item-cantidad-actual').textContent = item.cantidad;
    renderInventarioLista();
    recalcularPesoYVelocidad(window._equipoData);
    mostrarToast(`¡${item.nombre} usado! ${r.mensaje}`.trim());
    document.getElementById('inv-item-modal').style.display = 'none';
}

function modificarCantidadInventario(cantidad) {
    if (!itemInventarioActual || cantidad === 0) return;
    cantidadInventarioPendiente = cantidad;
    const actual = itemInventarioActual.cantidad;
    const nueva = Math.max(0, actual + cantidad);
    const signo = cantidad > 0 ? '+' : '';
    document.getElementById('inv-confirm-texto').innerHTML =
        `¿Querés <strong>${signo}${cantidad}</strong> de <strong>${itemInventarioActual.nombre}</strong>?<br>` +
        `<span style="color: var(--text-muted); font-size: 0.9rem;">Cantidad actual: ${actual} → Nueva: ${nueva}</span>`;
    document.getElementById('inv-confirm-modal').style.display = 'flex';
}

function aplicarCambioInventario() {
    if (!itemInventarioActual) return;
    const nuevaCantidad = Math.max(0, itemInventarioActual.cantidad + cantidadInventarioPendiente);
    const cantidad = cantidadInventarioPendiente;
    itemInventarioActual.cantidad = nuevaCantidad;
    guardarInventario();
    document.getElementById('inv-item-cantidad-actual').textContent = nuevaCantidad;
    renderInventarioLista();
    if (cantidad < 0) {
        mostrarToast(`-${Math.abs(cantidad)} ${itemInventarioActual.nombre}`, 'warning');
    } else if (cantidad > 0) {
        mostrarToast(`+${cantidad} ${itemInventarioActual.nombre}`);
    }
    cantidadInventarioPendiente = 0;

    // Recalcular peso y velocidad después del cambio
    recalcularPesoYVelocidad(window._equipoData);
}

function cargarTurnoEstado() {
    const guardado = localStorage.getItem(STORAGE_PREFIX + 'turno');
    if (guardado) {
        try {
            turnoEstado = JSON.parse(guardado);
            // Compatibilidad con turnos guardados antes de que existieran estos campos
            if (turnoEstado.objeto === undefined) turnoEstado.objeto = 1;
            if (turnoEstado.golpesRestantes === undefined) turnoEstado.golpesRestantes = 0;
        } catch(e) { turnoEstado = { accion: 1, bonus: 1, reaccion: 1, objeto: 1, golpesRestantes: 0 }; }
    }
}

function actualizarTurnoDOM() {
    document.querySelectorAll('.turno-valor').forEach(span => {
        const tipo = span.dataset.tipo;
        const valor = turnoEstado[tipo];
        span.textContent = `${valor} / 1`;
        span.style.backgroundColor = valor > 0 ? '#2e7d32' : '#c62828';
    });
    const badge = document.getElementById('extra-attack-badge');
    if (badge) {
        if (extraAttacks > 1) {
            badge.textContent = `×${extraAttacks} si golpeás`;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function consumirAccion(tipoAccion) {
    if (!tipoAccion) return { ok: true, mensaje: '' };
    const t = tipoAccion.toLowerCase();
    // "Sin acción" (ej: Stunning Strike, Hand of Harm) no gasta ningún recurso de turno.
    // Va primero porque "sin acción" también contiene la palabra "acción" como substring.
    if (t.includes('sin acción') || t.includes('sin accion') || t === 'ninguna' || t === 'ninguno') {
        return { ok: true, mensaje: '' };
    }
    // OJO: este check va primero porque "interacción" contiene la palabra "acción" como substring,
    // así que si no lo revisamos antes, caería en el branch genérico de Acción por error.
    if (t.includes('objeto') || t.includes('interacción') || t.includes('interaccion')) {
        if (turnoEstado.objeto > 0) {
            turnoEstado.objeto = 0;
            guardarTurnoEstado();
            actualizarTurnoDOM();
            return { ok: true, mensaje: '' };
        } else {
            return { ok: false, mensaje: 'Ya usaste tu Interacción con Objeto este turno' };
        }
    } else if (t.includes('bonus') || t.includes('adicional')) {
        if (turnoEstado.bonus > 0) {
            turnoEstado.bonus = 0;
            guardarTurnoEstado();
            actualizarTurnoDOM();
            return { ok: true, mensaje: '' };
        } else if (turnoEstado.accion > 0) {
            turnoEstado.accion = 0;
            guardarTurnoEstado();
            actualizarTurnoDOM();
            return { ok: true, mensaje: '(consumió tu Acción principal)' };
        } else {
            return { ok: false, mensaje: 'No te quedan acciones disponibles' };
        }
    } else if (t.includes('reacción') || t.includes('reaccion')) {
        if (turnoEstado.reaccion > 0) {
            turnoEstado.reaccion = 0;
            guardarTurnoEstado();
            actualizarTurnoDOM();
            return { ok: true, mensaje: '' };
        } else {
            return { ok: false, mensaje: 'Ya usaste tu Reacción este turno' };
        }
    } else if (t.includes('acción') || t.includes('accion')) {
        if (turnoEstado.accion > 0) {
            turnoEstado.accion = 0;
            guardarTurnoEstado();
            actualizarTurnoDOM();
            return { ok: true, mensaje: '' };
        } else {
            return { ok: false, mensaje: 'Ya usaste tu Acción este turno' };
        }
    }
    return { ok: true, mensaje: '' };
}

// Descuenta 1 uso de un pool de habilidadesUsoState (ej: "Puntos de Ki"). Devuelve true si pudo.
function consumirDeUsoPool(nombrePool) {
    const partes = (habilidadesUsoState[nombrePool] || '0/0').split('/');
    let actual = parseInt(partes[0]);
    const max = parseInt(partes[1]);
    if (actual <= 0) {
        mostrarToast(`Sin usos restantes de ${nombrePool}`, 'warning');
        return false;
    }
    actual -= 1;
    habilidadesUsoState[nombrePool] = `${actual}/${max}`;
    guardarHabilidadesUso();
    actualizarHabilidadUsoDOM(nombrePool);
    return true;
}

// Ejecuta una habilidad que otorga golpes extra (Martial Arts bonus attack, Flurry of Blows).
// Usa el mismo contador golpesRestantes que Extra Attack, así que el arma/golpe desarmado los
// deja usar sin volver a pedir la Acción. Devuelve true si se ejecutó.
function ejecutarOtorgaGolpes(habObj) {
    if (habObj.requiereAccionGastada && turnoEstado.accion > 0) {
        mostrarToast(`${habObj.nombre} se usa después de la Acción de Atacar`, 'warning');
        return false;
    }
    if (habObj.consumeUsoDe && !consumirDeUsoPool(habObj.consumeUsoDe)) return false;

    turnoEstado.golpesRestantes = (turnoEstado.golpesRestantes || 0) + habObj.otorgaGolpes;
    guardarTurnoEstado();
    const r = consumirAccion(habObj.accion);
    mostrarToast(`✊ ${habObj.nombre}: +${habObj.otorgaGolpes} golpe(s) disponibles sin gastar Acción. ${r.mensaje}`.trim());

    // Mostrar el panel de Efectos Activados con el daño repetido tantas veces como golpes otorgue
    // (ej: Flurry of Blows = 2 golpes = el daño del Unarmed Strike aparece 2 veces).
    if (ultimoDanoMostrado) {
        const danoRepetido = Array(habObj.otorgaGolpes).fill(ultimoDanoMostrado).join('  +  ');
        setTimeout(() => {
            procesarEfectos(habObj, {
                nivelPersonaje: nivelPersonajeGlobal,
                tipos: ['postgolpe'],
                danoTexto: danoRepetido
            });
        }, 300);
    }
    return true;
}

// Ejecuta una habilidad simple post-golpe que solo gasta un pool (Stunning Strike, Hand of Harm):
// no otorga golpes extra, solo abre el panel de efectos con su propio recordatorio.
function ejecutarHabilidadPostGolpe(habObj) {
    if (habObj.consumeUsoDe && !consumirDeUsoPool(habObj.consumeUsoDe)) return false;
    const r = consumirAccion(habObj.accion);
    mostrarToast(`✨ ¡${habObj.nombre} usada! ${r.mensaje}`.trim());
    setTimeout(() => {
        procesarEfectos(habObj, {
            nivelPersonaje: nivelPersonajeGlobal,
            tipos: ['postgolpe']
        });
    }, 300);
    return true;
}

// Chequea si una opción post-golpe (Martial Arts, Flurry of Blows, Stunning Strike, etc.)
// se puede usar ahora mismo, sin gastarla todavía (para pintar el botón habilitado o no).
function opcionPostGolpeDisponible(hab) {
    if (hab.requiereAccionGastada && turnoEstado.accion > 0) return false;
    if (hab.consumeUsoDe) {
        const actual = parseInt((habilidadesUsoState[hab.consumeUsoDe] || '0/0').split('/')[0]);
        if (actual <= 0) return false;
    }
    if (hab.otorgaGolpes && turnoEstado.bonus <= 0 && turnoEstado.accion <= 0) return false;
    return true;
}

// Abre el panel de opciones post-golpe con todo lo que el personaje tenga marcado postGolpe:true
// (ej: Martial Arts, Flurry of Blows, Stunning Strike, Hand of Harm). Se puede elegir más de una
// mientras alcancen los recursos; el panel se re-renderiza después de cada elección.
function abrirModalPostGolpe() {
    const modalPG = document.getElementById('post-golpe-modal');
    const cont = document.getElementById('post-golpe-opciones');
    if (!modalPG || !cont) return;
    const opciones = (window._habilidadesUsoData || []).filter(h => h.postGolpe);
    if (opciones.length === 0) return;

    function render() {
        cont.innerHTML = '';
        opciones.forEach(hab => {
            const disponible = opcionPostGolpeDisponible(hab);
            const btn = document.createElement('button');
            btn.className = 'hp-btn';
            btn.style.cssText = `width: 100%; padding: 12px; text-align: left; font-weight: bold; ${disponible ? 'background-color: #6a1b9a; color: white;' : 'background-color: #999; cursor: not-allowed;'}`;
            btn.disabled = !disponible;
            const etiquetaCosto = [];
            if (hab.consumeUsoDe) etiquetaCosto.push(`1 ${hab.consumeUsoDe}`);
            if (hab.otorgaGolpes) etiquetaCosto.push('Acción Bonus');
            btn.innerHTML = `${hab.nombre} <span style="float: right; font-weight: normal; font-size: 0.85rem;">(${etiquetaCosto.join(' + ') || 'gratis'})</span>`;
            btn.onclick = () => {
                const ok = hab.otorgaGolpes ? ejecutarOtorgaGolpes(hab) : ejecutarHabilidadPostGolpe(hab);
                if (ok) render();
            };
            cont.appendChild(btn);
        });
    }
    render();
    modalPG.style.display = 'flex';
}

function resetearTurno() {
    turnoEstado = { accion: 1, bonus: 1, reaccion: 1, objeto: 1, golpesRestantes: 0 };
    guardarTurnoEstado();
    actualizarTurnoDOM();

    // Habilidades que se recargan cada turno nuevo (ej: Slow Fall, atado a la Reacción
    // que ya se resetea arriba). No confundir con descansos: esto es SOLO al terminar turno.
    let huboRecargaDeTurno = false;
    Object.keys(habilidadesUsoState).forEach(nombre => {
        if (habilidadesInfo[nombre] === 'turno' && habilidadesUsoOriginales[nombre]) {
            habilidadesUsoState[nombre] = habilidadesUsoOriginales[nombre];
            actualizarHabilidadUsoDOM(nombre);
            huboRecargaDeTurno = true;
        }
    });
    if (huboRecargaDeTurno) guardarHabilidadesUso();
}

// === Divine Smite (y cualquier otro "smite", ej: Honey Smite) ===

// Verifica si el arma usada califica para algún Smite disponible (debe ser melee)
function armaPuedeGatillarSmite(nombreArma, equipoData) {
    if (!smitesData || smitesData.length === 0) return false;
    const arma = equipoData.find(e => e.nombre === nombreArma);
    if (!arma) return false;
    // Smite solo aplica a ataques melee (no a ranged como ballestas)
    // Consideramos melee si tipo es 'melee' o si tiene 'finesse' (las finesse pueden usarse melee)
    return arma.tipo === 'melee' || arma.tipo === 'finesse';
}

// Abre el modal de Smite combinando las opciones de TODOS los smites que tenga el personaje
// (ej: Divine Smite con varios niveles de ranura + Honey Smite con su propio uso fijo Nivel 1).
function abrirModalSmite() {
    const smiteModal = document.getElementById('smite-modal');
    const cont = document.getElementById('smite-opciones');
    if (!smiteModal || !cont || !smitesData || smitesData.length === 0) return;

    cont.innerHTML = '';

    smitesData.forEach(smite => {
        // Header con el nombre del smite, solo si hay más de uno (para no ensuciar si es solo Divine Smite)
        if (smitesData.length > 1) {
            const header = document.createElement('div');
            header.style.cssText = 'font-weight: bold; color: var(--accent-color); margin-top: 8px;';
            header.textContent = smite.nombre;
            cont.appendChild(header);
        }

        Object.keys(smite.danoPorNivel).forEach(nivelNum => {
            const nivelKey = `Nivel ${nivelNum}`;
            const disponibles = parseInt(ranurasState[nivelKey] || 0);
            const dano = smite.danoPorNivel[nivelNum];

            const btn = document.createElement('button');
            btn.className = 'hp-btn';
            btn.style.cssText = `width: 100%; padding: 12px; text-align: left; font-weight: bold; ${disponibles <= 0 ? 'background-color: #999; cursor: not-allowed;' : 'background-color: #6a1b9a; color: white;'}`;
            btn.disabled = disponibles <= 0;
            btn.innerHTML = `Slot Nivel ${nivelNum} → ${dano} ${smite.tipoDano} <span style="float: right; font-weight: normal; font-size: 0.85rem;">(${disponibles} disponibles)</span>`;

            btn.onclick = () => {
                if (disponibles <= 0) return;
                ranurasState[nivelKey] = String(disponibles - 1);
                guardarRanuras();
                actualizarRanuraDOM(nivelKey);
                smiteModal.style.display = 'none';
                mostrarToast(`⚔️ ¡${smite.nombre}! +${dano} ${smite.tipoDano}`);

                // Abrir el modal de Efectos Activados con el recap del daño del smite,
                // y cualquier rasgo/habilidad que corresponda a este contexto (tag 'smite').
                setTimeout(() => {
                    procesarEfectos(smite, {
                        nivelHechizo: parseInt(nivelNum),
                        nivelPersonaje: nivelPersonajeGlobal,
                        tipos: ['smite'],
                        danoTexto: `${dano} ${smite.tipoDano}`
                    });
                }, 300);
            };
            cont.appendChild(btn);
        });
    });

    smiteModal.style.display = 'flex';
}

// === Selector de ranura para hechizos que escalan al subirlos de nivel ===
// (ej: Fireball, Guiding Bolt). Funciona igual que el modal de Divine Smite:
// el hechizo trae en su JSON un campo "escalaSlot.danoPorNivel" con el daño
// correspondiente a cada nivel de ranura posible, y acá se muestra un botón
// por cada nivel, deshabilitado si no hay ranuras disponibles de ese nivel.
function abrirModalEscalaSlot(item, tipoAccion) {
    const escalaModal = document.getElementById('escala-modal');
    const cont = document.getElementById('escala-opciones');
    const titulo = document.getElementById('escala-modal-titulo');
    const desc = document.getElementById('escala-modal-desc');
    if (!escalaModal || !cont || !item || !item.escalaSlot) return;

    if (titulo) titulo.textContent = `${item.nombre}: elegí la ranura`;
    if (desc) desc.textContent = 'Cuanto más alta la ranura que uses, más fuerte sale el hechizo.';

    cont.innerHTML = '';
    const danoPorNivel = item.escalaSlot.danoPorNivel || {};
    Object.keys(danoPorNivel)
        .map(n => parseInt(n))
        .sort((a, b) => a - b)
        .forEach(nivelNum => {
            const nivelKey = `Nivel ${nivelNum}`;
            const disponibles = parseInt(ranurasState[nivelKey] || 0);
            const dano = danoPorNivel[String(nivelNum)];

            const btn = document.createElement('button');
            btn.className = 'hp-btn';
            btn.style.cssText = `width: 100%; padding: 12px; text-align: left; font-weight: bold; ${disponibles <= 0 ? 'background-color: #999; cursor: not-allowed;' : 'background-color: #6a1b9a; color: white;'}`;
            btn.disabled = disponibles <= 0;
            btn.innerHTML = `Slot Nivel ${nivelNum} → ${dano}${item.tipoDano ? ' ' + item.tipoDano : ''} <span style="float: right; font-weight: normal; font-size: 0.85rem;">(${disponibles} disponibles)</span>`;

            btn.onclick = () => {
                if (disponibles <= 0) return;
                ranurasState[nivelKey] = String(disponibles - 1);
                guardarRanuras();
                actualizarRanuraDOM(nivelKey);
                escalaModal.style.display = 'none';
                const r = consumirAccion(tipoAccion);
                const notasTxt = notasEquipoActuales.length ? ` 🪄 ${notasEquipoActuales.join(' ')}` : '';
                mostrarToast(`✨ ¡${item.nombre} usado! ${dano}${item.tipoDano ? ' ' + item.tipoDano : ''} (ranura Nivel ${nivelNum}). ${r.mensaje}${notasTxt}`.trim());

                // Disparar efectos automáticos (rasgos de hechizo, etc.) y familiar
                setTimeout(() => {
                    procesarEfectos(item, {
                        nivelHechizo: nivelNum,
                        nivelPersonaje: nivelPersonajeGlobal,
                        tipos: ['hechizo'],
                        danoTexto: `${dano}${item.tipoDano ? ' ' + item.tipoDano : ''}`
                    });
                }, 400);
                if (item.familiar) {
                    setTimeout(() => activarFamiliar(item.familiar), 900);
                }
            };
            cont.appendChild(btn);
        });

    escalaModal.style.display = 'flex';
}

// === Selector de animal para Wild Shape (o cualquier habilidad con "formasSalvajes") ===
// Al elegir un animal: gasta 1 uso de la habilidad y activa el panel de "familiar"
// (mismo botón flotante y modal) con las stats de esa forma.
function abrirModalFormaSalvaje(habObj, tipoAccion) {
    const wsModal = document.getElementById('wildshape-modal');
    const cont = document.getElementById('wildshape-opciones');
    if (!wsModal || !cont || !habObj || !habObj.formasSalvajes) return;

    cont.innerHTML = '';
    habObj.formasSalvajes.forEach(forma => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.style.textAlign = 'left';
        btn.innerHTML = `<span>${forma.emoji || '🐾'} ${forma.nombre}</span><span class="skill-mod">CA ${forma.ca} · ${forma.vidaMaxima} HP</span>`;

        btn.onclick = () => {
            // Gastar 1 uso de la habilidad (ej: Wild Shape 2/2 → 1/2)
            const partes = (habilidadesUsoState[habObj.nombre] || '0/0').split('/');
            let actual = parseInt(partes[0]);
            const max = parseInt(partes[1]);
            if (actual <= 0) {
                mostrarToast(`Sin usos restantes de ${habObj.nombre}`, 'warning');
                return;
            }
            actual -= 1;
            habilidadesUsoState[habObj.nombre] = `${actual}/${max}`;
            guardarHabilidadesUso();
            actualizarHabilidadUsoDOM(habObj.nombre);

            wsModal.style.display = 'none';
            const r = consumirAccion(tipoAccion);
            activarFamiliar(forma, `${forma.emoji || '🐾'} ¡Te transformaste en ${forma.nombre}! ${r.mensaje}`.trim());
        };
        cont.appendChild(btn);
    });

    wsModal.style.display = 'flex';
}

// === Recuperación de ranuras (Pearl of Power, Arcane Recovery, Natural Recovery) ===
// Dos modos:
// - Modo "1 sola ranura" (presupuesto null): Pearl of Power. Elegís UNA ranura gastada
//   de nivel <= maxNivel y se restaura. Se cierra solo.
// - Modo "presupuesto combinado" (presupuesto = número): Arcane/Natural Recovery. Podés
//   restaurar varias ranuras mientras alcance el presupuesto (nivel combinado), sin
//   superar maxNivel por ranura individual. Se cierra con "Listo".
function abrirModalRestaurarRanura(habObj, tipoAccion, maxNivel, presupuestoInicial, nombreControl) {
    const restModal = document.getElementById('restaurar-modal');
    const cont = document.getElementById('restaurar-opciones');
    const titulo = document.getElementById('restaurar-modal-titulo');
    const desc = document.getElementById('restaurar-modal-desc');
    const presupuestoEl = document.getElementById('restaurar-presupuesto');
    const listoBtn = document.getElementById('restaurar-listo');
    if (!restModal || !cont || !habObj) return;

    // Si la habilidad consume el pool de OTRA (ej: Harness Divine Power usa "Channel Divinity"),
    // nombreControl indica qué contador de habilidadesUsoState hay que chequear/gastar.
    const controlKey = nombreControl || habObj.nombre;

    const esBudget = (presupuestoInicial !== null && presupuestoInicial !== undefined);
    let presupuesto = esBudget ? presupuestoInicial : null;
    let usoConsumido = false; // el cargo de la habilidad se gasta recién en la 1ra restauración real

    titulo.textContent = habObj.nombre;
    desc.textContent = esBudget
        ? `Elegí qué ranuras restaurar (nivel combinado disponible: ${presupuesto}). Ninguna puede ser mayor a Nivel ${maxNivel}.`
        : `Elegí UNA ranura gastada de Nivel ${maxNivel} o menor para restaurar.`;

    function consumirUsoSiHaceFalta() {
        if (usoConsumido) return true;
        const partes = (habilidadesUsoState[controlKey] || '0/0').split('/');
        let actual = parseInt(partes[0]);
        const max = parseInt(partes[1]);
        if (actual <= 0) {
            mostrarToast(`Sin usos restantes de ${controlKey}`, 'warning');
            return false;
        }
        actual -= 1;
        habilidadesUsoState[controlKey] = `${actual}/${max}`;
        guardarHabilidadesUso();
        actualizarHabilidadUsoDOM(controlKey);
        usoConsumido = true;
        return true;
    }

    function render() {
        if (presupuestoEl) {
            if (esBudget) {
                presupuestoEl.style.display = 'block';
                presupuestoEl.textContent = `Nivel combinado disponible: ${presupuesto}`;
            } else {
                presupuestoEl.style.display = 'none';
            }
        }
        cont.innerHTML = '';
        let hayOpciones = false;
        Object.keys(ranurasOriginales)
            .filter(nivelKey => /^Nivel (\d+)$/.test(nivelKey))
            .sort((a, b) => parseInt(a.replace('Nivel ', '')) - parseInt(b.replace('Nivel ', '')))
            .forEach(nivelKey => {
                const nivelNum = parseInt(nivelKey.replace('Nivel ', ''));
                if (nivelNum > maxNivel) return;
                const actual = parseInt(ranurasState[nivelKey] || 0);
                const max = parseInt(ranurasOriginales[nivelKey] || 0);
                const gastadas = max - actual;
                if (gastadas <= 0) return; // no hay nada gastado en este nivel para restaurar
                hayOpciones = true;

                const sinBudgetSuficiente = esBudget && nivelNum > presupuesto;

                const btn = document.createElement('button');
                btn.className = 'hp-btn';
                btn.style.cssText = `width: 100%; padding: 12px; text-align: left; font-weight: bold; ${sinBudgetSuficiente ? 'background-color: #999; cursor: not-allowed;' : 'background-color: var(--accent-color); color: white;'}`;
                btn.disabled = sinBudgetSuficiente;
                btn.innerHTML = `Restaurar ${nivelKey} <span style="float: right; font-weight: normal; font-size: 0.85rem;">(${gastadas} gastada${gastadas === 1 ? '' : 's'})</span>`;
                btn.onclick = () => {
                    if (!consumirUsoSiHaceFalta()) return;
                    ranurasState[nivelKey] = String(actual + 1);
                    guardarRanuras();
                    actualizarRanuraDOM(nivelKey);
                    mostrarToast(`✨ Se restauró una ranura de ${nivelKey}`);
                    if (esBudget) {
                        presupuesto -= nivelNum;
                        render(); // permite seguir eligiendo mientras alcance el presupuesto
                    } else {
                        restModal.style.display = 'none';
                        const r = consumirAccion(tipoAccion);
                        if (r.mensaje) mostrarToast(r.mensaje);
                    }
                };
                cont.appendChild(btn);
            });

        if (!hayOpciones) {
            const vacio = document.createElement('div');
            vacio.style.cssText = 'text-align: center; color: var(--text-muted); padding: 10px;';
            vacio.textContent = 'No tenés ranuras gastadas en ese rango para restaurar.';
            cont.appendChild(vacio);
        }
    }

    if (listoBtn) {
        listoBtn.onclick = () => {
            restModal.style.display = 'none';
            if (usoConsumido) {
                const r = consumirAccion(tipoAccion);
                if (r.mensaje) mostrarToast(r.mensaje);
            }
        };
    }

    render();
    restModal.style.display = 'flex';
}

function actualizarHdCantidadDOM() {
    const span = document.getElementById('hd-cantidad');
    if (span) span.textContent = hdCantidadAUsar;
    const lanzarTexto = document.getElementById('hd-lanzar-texto');
    if (lanzarTexto) {
        if (hdCantidadAUsar > 0) {
            lanzarTexto.textContent = `Lanzar ${hdCantidadAUsar}${hitDiceDado}`;
        } else {
            lanzarTexto.textContent = '';
        }
    }
    // Habilitar/deshabilitar botón Siguiente
    const btnSiguiente = document.getElementById('hd-siguiente');
    if (btnSiguiente) {
        btnSiguiente.disabled = hdCantidadAUsar === 0;
        btnSiguiente.style.opacity = hdCantidadAUsar === 0 ? '0.5' : '1';
        btnSiguiente.style.cursor = hdCantidadAUsar === 0 ? 'not-allowed' : 'pointer';
    }
}

function actualizarHabilidadUsoDOM(nombre) {
    const id = `hab-uso-${nombre.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const el = document.getElementById(id);
    if (el) {
        const span = el.querySelector('.usos-valor');
        if (span) span.textContent = habilidadesUsoState[nombre];
        // Detectar usos disponibles (parte izquierda de "x/y")
        const partes = habilidadesUsoState[nombre].split('/');
        const disponibles = parseInt(partes[0]);
        if (disponibles <= 0) {
            el.classList.add('ranura-vacia');
        } else {
            el.classList.remove('ranura-vacia');
        }
    }
}

function usarHabilidad(nombre) {
    const partes = habilidadesUsoState[nombre].split('/');
    let actual = parseInt(partes[0]);
    const max = parseInt(partes[1]);
    if (actual > 0) {
        actual -= 1;
        habilidadesUsoState[nombre] = `${actual}/${max}`;
        guardarHabilidadesUso();
        actualizarHabilidadUsoDOM(nombre);
        modal.style.display = 'none';
        if (actual === 0) {
            mostrarToast(`¡${nombre} usada! Sin usos restantes`, 'warning');
        } else {
            mostrarToast(`¡${nombre} usada! Quedan ${actual}/${max}`);
        }
    }
}

function tomarDescanso(tipo) {
    // tipo = 'corto' o 'largo'
    let recuperaCorto = (tipo === 'corto');
    
    // Recuperar ranuras
    Object.keys(ranurasState).forEach(nivel => {
        const tipoRecup = ranurasInfo[nivel];
        if (tipo === 'largo' || tipoRecup === 'corto') {
            ranurasState[nivel] = ranurasOriginales[nivel];
            actualizarRanuraDOM(nivel);
        }
    });
    guardarRanuras();

    // Recuperar habilidades
    Object.keys(habilidadesUsoState).forEach(nombre => {
        const tipoRecup = habilidadesInfo[nombre];
        if (tipo === 'largo') {
            habilidadesUsoState[nombre] = habilidadesUsoOriginales[nombre];
            actualizarHabilidadUsoDOM(nombre);
        } else if (tipoRecup === 'corto') {
            if (habilidadesRecuperaCortoCantidad[nombre] !== undefined) {
                // El descanso corto SIEMPRE suma esta cantidad de usos (tope al máximo real).
                // Ej: Second Wind con 0/2 pasa a 1/2; con 1/2 pasa a 2/2; con 2/2 se queda igual.
                const max = parseInt((habilidadesUsoOriginales[nombre] || '0/0').split('/')[1]);
                const actual = parseInt((habilidadesUsoState[nombre] || '0/0').split('/')[0]);
                const ganancia = habilidadesRecuperaCortoCantidad[nombre];
                const nuevoActual = Math.min(max, actual + ganancia);
                habilidadesUsoState[nombre] = `${nuevoActual}/${max}`;
            } else {
                habilidadesUsoState[nombre] = habilidadesUsoOriginales[nombre];
            }
            actualizarHabilidadUsoDOM(nombre);
        }
    });
    guardarHabilidadesUso();

    // Cualquier habilidad tipo interruptor (Radiant Soul, etc.) se apaga sola en CUALQUIER
    // descanso: su efecto real dura 1 minuto, así que para cuando termina un descanso corto
    // o largo ya se cortó solo. Si no la apagamos acá, el botón se queda trabado en
    // "Desactivar X" y tapa el hecho de que el uso ya se recargó.
    let huboToggleApagado = false;
    Object.keys(togglesActivos).forEach(nombre => {
        if (togglesActivos[nombre]) {
            togglesActivos[nombre] = false;
            huboToggleApagado = true;
        }
    });
    if (huboToggleApagado) guardarToggles();

    // Si es descanso largo, restaurar vida y Hit Dice al máximo
    if (tipo === 'largo') {
        vidaActual = vidaMaxima;
        guardarVida();
        actualizarVidaDOM();
        hitDiceActual = hitDiceMaximo;
        guardarHitDice();
        actualizarHitDiceDOM();

        // Desactivar Mage Armor (dura 8 hs, se cae con descanso largo)
        if (mageArmorActivo) {
            mageArmorActivo = false;
            localStorage.removeItem(STORAGE_PREFIX + 'mageArmorActivo');
            localStorage.removeItem(STORAGE_PREFIX + 'mageArmorBase');
            recalcularYActualizarCA();
            mostrarToast('🛡️ Mage Armor expiró (descanso largo)', 'warning');
        }

        // Circle of the Land (DnD 5.5e): la Land elegida se resetea en cada descanso largo,
        // así que hay que volver a elegir. El selector se abre solo al terminar el descanso.
        if (circuloDeLaTierraGlobal) {
            localStorage.removeItem(STORAGE_PREFIX + 'landActual');
            landActualGlobal = null;
            const landBadge = document.getElementById('land-badge');
            if (landBadge) landBadge.textContent = '🌍 Land: Esperando selección';
        }
    }

    // Cerrar modal y notificar
    document.getElementById('rest-modal').style.display = 'none';
    if (tipo === 'largo') {
        mostrarToast('🛏️ Descanso largo completado. ¡Todo restaurado!');
        if (circuloDeLaTierraGlobal) {
            setTimeout(() => abrirModalLand(), 600);
        }
    } else {
        mostrarToast('☕ Descanso corto completado.');
        // Abrir automáticamente modal de Hit Dice
        setTimeout(() => {
            hdCantidadAUsar = 0;
            // Mostrar paso 1, ocultar paso 2
            document.getElementById('hd-paso-1').style.display = 'block';
            document.getElementById('hd-paso-2').style.display = 'none';
            actualizarHdCantidadDOM();
            actualizarHitDiceDOM();
            document.getElementById('hd-modal').style.display = 'flex';
        }, 400);
    }
}

// Obtener qué personaje cargar desde la URL (?p=gangstur)
// Obtener qué personaje cargar desde la URL (?p=gangstur)
const params = new URLSearchParams(window.location.search);
const personajeIdParam = params.get('p');

// Si no se especificó personaje en la URL, redirigir al menú principal
if (!personajeIdParam) {
    window.location.replace('index.html');
}

const personajeId = personajeIdParam || 'gangstur';

// Prefijo único para localStorage de este personaje
const STORAGE_PREFIX = `pj_${personajeId}_`;

async function init() {
    modal = document.getElementById('skill-modal');
    modalTitle = document.getElementById('modal-title');
    modalDesc = document.getElementById('modal-desc');
    closeBtn = document.querySelector('.close-btn');
    modalActions = document.getElementById('modal-actions');
    useSpellBtn = document.getElementById('use-spell-btn');

    const response = await fetch(`personajes/${personajeId}.json`);
    const data = await response.json();

    data.personaje.improvements = data.improvements;

    aplicarImprovements(data.personaje);

    // Cargar Nombre, Clase y Raza desde el JSON
    if (data.personaje) {
        const nombreTextoEl = document.getElementById('nombre-texto');
        const iconoEl = document.getElementById('icono-personaje');
        const claseEl = document.getElementById('clase-valor');
        const razaEl = document.getElementById('raza-valor');
        if (nombreTextoEl && data.personaje.nombre) {
            nombreTextoEl.textContent = data.personaje.nombre;
            document.title = `${data.personaje.nombre} - Hoja de Personaje`;
        }
        const iconosEl = document.querySelectorAll('.icono-personaje');
        iconosEl.forEach(iconoEl => {
            iconoEl.textContent = ICONOS_PERSONAJE[personajeId] || '🎭';
            iconoEl.addEventListener('click', () => {
                document.getElementById('imagen-modal-titulo').textContent = data.personaje.nombre || '';
                const img = document.getElementById('imagen-modal-img');
                img.src = `img/${personajeId}.png`;
                img.alt = data.personaje.nombre || '';
                document.getElementById('imagen-modal').style.display = 'flex';
            });
        });
        if (claseEl) claseEl.textContent = data.personaje.clase || '';
        if (razaEl) razaEl.textContent = data.personaje.raza || '';
        claseEsBrujo = (data.personaje.clase === "Brujo");
        claseActual = data.personaje.clase || '';
        hitDiceDado = obtenerHitDiceSegunClase(data.personaje.clase);
    }

    // Guardar rasgos globalmente para cálculo de bonos
    rasgosGlobal = data.rasgos || [];

    // Inicializar tamaño del personaje (estandar por defecto)
    tamanoPersonaje = (data.personaje && data.personaje.tamano) || 'estandar';

    // Guardar velocidad base del personaje (parseando el string del JSON)
    const velStat = data.estadisticas.find(s => s.nombre === "Velocidad");
    if (velStat) {
        velocidadBase = parseInt(velStat.valor) || 30;
        velocidadActual = velocidadBase;
    }

    // Generar modificadores y salvaciones desde stats
    // Primero necesitamos el nivel para calcular la proficiencia
    const nivelStatTmp = data.estadisticas.find(s => s.nombre === "Nivel");
    const nivelTmp = nivelStatTmp ? parseInt(nivelStatTmp.valor) : 1;
    const profBonusTmp = parseMod(calcularProficiencia(nivelTmp));

    if (data.personaje && data.personaje.stats) {
        // Hacemos una copia profunda para que el JSON original no se modifique entre cargas
        statsGlobal = { ...data.personaje.stats };

        // Aplicar ASIs ANTES de generar modificadores/salvaciones/skills
        aplicarASIs(data.habilidadesUso);

        data.modificadores = generarModificadores(statsGlobal, data.personaje.clase);
        // Rasgos que otorgan competencia extra en una salvación puntual (ej: Iron Mind → WIS),
        // sin tocar la tabla de clase (que es compartida por todos los personajes).
        const salvacionesExtra = (data.rasgos || [])
            .filter(r => r.otorgaSalvacionProficiente)
            .map(r => r.otorgaSalvacionProficiente);
        data.salvaciones = generarSalvaciones(statsGlobal, data.personaje.clase, profBonusTmp, salvacionesExtra);
        data.habilidades = generarHabilidades(data.habilidades, statsGlobal, profBonusTmp);
    }

    // Stat principal según clase (para Spell Save DC, Spell Attack Bonus, etc)
    const profDatos = PROFICIENCIAS_POR_CLASE[claseActual] || { principal: 'STR' };
    nombreModPrincipal = profDatos.principal;
    modPrincipal = obtenerMod(data.modificadores, nombreModPrincipal);

    // === Pact Magic (Brujo): ranuras dinámicas según nivel de personaje ===
    // Se detecta por CUALQUIER rasgo con "esPactMagic": true, así que un personaje
    // nuevo que tenga ese mismo rasgo ya queda cubierto sin tocar este script.
    pactMagicNivelRanura = null;
    const tienePactMagic = (data.rasgos || []).some(r => r.esPactMagic);
    if (tienePactMagic && data.hechizos && data.hechizos.ranuras) {
        const { nivelRanura, cantidad } = calcularPactMagic(nivelTmp);
        pactMagicNivelRanura = `Nivel ${nivelRanura}`;
        // Reemplaza lo que hubiera en el JSON: la única ranura real es esta, calculada
        // en vivo. Así, si el personaje sube de nivel, se recalcula solo la próxima carga.
        data.hechizos.ranuras = [{ nivel: pactMagicNivelRanura, cantidad: String(cantidad), recupera: 'corto' }];
    }

    // Inicializar ranuras
    data.hechizos.ranuras.forEach(r => {
        ranurasOriginales[r.nivel] = r.cantidad;
        ranurasInfo[r.nivel] = r.recupera || 'largo'; // Default: largo si no está definido
    });
    const guardadas = localStorage.getItem(STORAGE_PREFIX + 'ranurasHechizos');
    if (guardadas) {
        ranurasState = JSON.parse(guardadas);
        data.hechizos.ranuras.forEach(r => {
            if (!(r.nivel in ranurasState)) ranurasState[r.nivel] = r.cantidad;
        });
    } else {
        ranurasState = { ...ranurasOriginales };
    }

    // Restaurar Familiar/Steed activo (si había uno). Los datos completos (ataques, CA, etc.)
    // se vuelven a buscar en el JSON por su "id", solo la vida actual se guarda en localStorage.
    // No se toca en descansos: sigue activo hasta 0 HP o hasta que se lo despide manualmente.
    const familiarGuardado = localStorage.getItem(STORAGE_PREFIX + 'familiar');
    if (familiarGuardado) {
        try {
            const saved = JSON.parse(familiarGuardado);
            if (saved && saved.activo && saved.id) {
                let datosEncontrados = null;
                const spellConFamiliar = (data.hechizos.lista || []).find(h => h.familiar && h.familiar.id === saved.id);
                if (spellConFamiliar) {
                    datosEncontrados = spellConFamiliar.familiar;
                } else {
                    // Buscar también entre las formas salvajes de habilidadesUso (Wild Shape, etc.)
                    // y entre habilidades que invocan un compañero fijo (ej: Staff of the Python).
                    (data.habilidadesUso || []).forEach(h => {
                        if (h.formasSalvajes) {
                            const encontrada = h.formasSalvajes.find(f => f.id === saved.id);
                            if (encontrada) datosEncontrados = encontrada;
                        }
                        if (h.familiar && h.familiar.id === saved.id) {
                            datosEncontrados = h.familiar;
                        }
                    });
                }
                if (datosEncontrados) {
                    familiarDataActual = datosEncontrados;
                    familiarVidaActual = Math.max(0, Math.min(saved.vidaActual, familiarDataActual.vidaMaxima));
                    familiarActivo = true;
                }
            }
        } catch (e) {
            // Datos corruptos en localStorage: ignorar y seguir sin familiar activo
        }
    }

    const createBtn = (item) => {
        const btn = document.createElement('button');
        btn.className = `skill-btn ${item.proficiente ? 'proficient' : ''}`;
        // Texto en bordó para Percepción P. (recordatorio de actualizar)
        const colorEspecial = (item.nombre === "Percepción P.") ? 'style="color: #8b0000;"' : '';
        btn.innerHTML = `<span ${colorEspecial}>${item.nombre}</span> ${item.valor ? `<span class="skill-mod">${item.valor}</span>` : ''}`;
        if (item.desc) {
            btn.addEventListener('click', () => {
                modalTitle.textContent = item.nombre;
                modalDesc.textContent = item.desc;
                if (modalActions) modalActions.style.display = 'none';
                modal.style.display = 'flex';
            });
        }
        return btn;
    };

    const sG = document.getElementById('stats-grid');
    const mG = document.getElementById('mods-grid');
    const vG = document.getElementById('saves-grid');
    const skG = document.getElementById('skills-grid');
    const impG = document.getElementById('improvements-grid');

    // Calcular valores automáticos antes de renderizar
    const nivelPersonaje = nivelTmp;
    nivelPersonajeGlobal = nivelTmp;

    // === Circle of the Land (DnD 5.5e): mezclar los hechizos de la Land elegida ===
    // Se puede cambiar la Land en cualquier momento desde el badge (pensado para usarse
    // en cada descanso largo). Solo se agregan los hechizos ya desbloqueados por nivel.
    let landActual = null;
    if (data.circuloDeLaTierra) {
        const landGuardada = localStorage.getItem(STORAGE_PREFIX + 'landActual');
        const candidata = landGuardada || data.circuloDeLaTierra.landActual || null;
        if (candidata && data.circuloDeLaTierra.opciones[candidata]) {
            landActual = candidata;
            const spellsDeLand = data.circuloDeLaTierra.opciones[landActual].spells
                .filter(s => (s.nivelDruidaRequerido || 0) <= nivelPersonaje);
            data.hechizos.lista = [...data.hechizos.lista, ...spellsDeLand];
        }
    }

    const modDex = formatMod(obtenerMod(data.modificadores, "DEX"));
    proficienciaActual = profBonusTmp;

    // Pre-cargar armadura, escudo y armas equipadas desde localStorage
    modDexGlobal = obtenerMod(data.modificadores, "DEX");
    modWisGlobal = obtenerMod(data.modificadores, "WIS");

    // Pre-cargar estado de Mage Armor
    const mageArmorGuardado = localStorage.getItem(STORAGE_PREFIX + 'mageArmorActivo');
    if (mageArmorGuardado === 'true') {
        mageArmorActivo = true;
        const baseGuardada = localStorage.getItem(STORAGE_PREFIX + 'mageArmorBase');
        if (baseGuardada) mageArmorBase = parseInt(baseGuardada);
    }
    const armaduraGuardada = localStorage.getItem(STORAGE_PREFIX + 'armaduraEquipada');
    const escudoGuardado = localStorage.getItem(STORAGE_PREFIX + 'escudoEquipado');
    const armasGuardadas = localStorage.getItem(STORAGE_PREFIX + 'armasEquipadas');
    if (data.equipo) {
        if (armaduraGuardada) {
            const arm = data.equipo.find(e => e.esArmadura && e.tipoArmadura !== 'escudo' && e.nombre === armaduraGuardada);
            if (arm) {
                armaduraEquipadaId = arm.nombre;
                armaduraEquipadaBase = arm.armaduraBase || 0;
                armaduraEquipadaTipo = arm.tipoArmadura || 'ligera';
            }
        }
        if (escudoGuardado) {
            const esc = data.equipo.find(e => e.esArmadura && e.tipoArmadura === 'escudo' && e.nombre === escudoGuardado);
            if (esc) {
                escudoEquipadoId = esc.nombre;
                escudoEquipadoBase = esc.armaduraBase || 0;
            }
        }
        if (armasGuardadas) {
            try {
                armasEquipadas = JSON.parse(armasGuardadas);
                // Filtrar las que aún existen en el JSON
                armasEquipadas = armasEquipadas.filter(n => data.equipo.some(e => e.nombre === n && !e.esArmadura));
            } catch(e) { armasEquipadas = []; }
        }
        recalcularManosUsadas(data.equipo);
    }

    // Guardar equipo globalmente cuanto antes: lo necesitan funciones top-level como
    // calcularCA()/calcularBonosEquipoActivo() que corren ANTES de llegar al bloque
    // original donde esto se seteaba (línea de más abajo, ahora redundante pero inofensiva).
    window._equipoData = data.equipo;
    window._habilidadesUsoData = data.habilidadesUso || [];

    // Cargar toggles activos guardados (ej: Radiant Soul activado en una sesión anterior)
    const togglesGuardados = localStorage.getItem(STORAGE_PREFIX + 'togglesActivos');
    if (togglesGuardados) {
        try { togglesActivos = JSON.parse(togglesGuardados); } catch (e) { togglesActivos = {}; }
    }

    if (impG && data.improvements) {
        const agregar = (titulo, texto) => {
            const btn = document.createElement('button');
            btn.className = 'skill-btn';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'flex-start';
            btn.style.height = 'auto';

            btn.innerHTML = `
                <strong>${titulo}</strong>
                <span style="font-size:.9rem;color:var(--text-muted)">
                    ${texto}
                </span>
            `;

            impG.appendChild(btn);
        };

        if (Array.isArray(data.improvements.race)) {
            data.improvements.race.forEach(r=>{
                agregar(
                    "Racial",
                    `${r.atributo} +${r.valor} (${r.motivo})`
                );
            });
        }

        if (Array.isArray(data.improvements.feats)) {
            data.improvements.feats.forEach(f=>{
                Object.entries(f.atributos).forEach(([a,v])=>{
                    agregar(
                        `Feat - ${f.nombre}`,
                        `${a} +${v}`
                    );
                });
            });
        }

        if (Array.isArray(data.improvements.asi)) {
            data.improvements.asi.forEach(a=>{
                Object.entries(a.atributos).forEach(([atr,v])=>{
                    agregar(
                        `ASI Nivel ${a.nivel}`,
                        `${atr} +${v}`
                    );
                });
            });
        }
    }

    data.estadisticas.forEach(i => {
        // Resolver valores "auto"
        if (i.valor === "auto") {
            if (i.nombre === "Iniciativa") {
                i.valor = modDex;
            } else if (i.nombre === "Proficiencia") {
                i.valor = calcularProficiencia(nivelPersonaje);
            } else if (i.nombre === "Hit Dice") {
                i.valor = `${nivelPersonaje}/${nivelPersonaje}`;
            } else if (i.nombre === "CA") {
                i.valor = String(calcularCA());
            }
        }

        // Tratamiento especial para Vida
        if (i.nombre === "Vida" && i.valor.includes("/")) {
            const partes = i.valor.split("/");
            vidaMaximaOriginal = parseInt(partes[1]);
            const guardadaMax = localStorage.getItem(STORAGE_PREFIX + 'vidaMaxima');
            vidaMaxima = guardadaMax !== null ? parseInt(guardadaMax) : vidaMaximaOriginal;
            const guardada = localStorage.getItem(STORAGE_PREFIX + 'vidaActual');
            vidaActual = guardada !== null ? parseInt(guardada) : parseInt(partes[0]);
            const btn = document.createElement('button');
            btn.className = 'skill-btn vida-btn';
            btn.id = 'vida-btn';
            btn.innerHTML = `<span>${i.nombre}</span><span class="skill-mod">${vidaActual}/${vidaMaxima}</span>`;
            if (vidaMaxima !== vidaMaximaOriginal) btn.classList.add('modificado');
            btn.addEventListener('click', () => {
                document.getElementById('hp-modal').style.display = 'flex';
                actualizarVidaDOM();
            });
            sG.appendChild(btn);
        } else if (i.nombre === "CA") {
            caOriginal = parseInt(i.valor);
            const guardadaCa = localStorage.getItem(STORAGE_PREFIX + 'caActual');
            caActual = guardadaCa !== null ? parseInt(guardadaCa) : caOriginal;
            const btn = document.createElement('button');
            btn.className = 'skill-btn vida-btn';
            btn.id = 'ca-btn';
            btn.innerHTML = `<span>${i.nombre}</span><span class="skill-mod">${caActual}</span>`;
            if (caActual !== caOriginal) btn.classList.add('modificado');
            btn.addEventListener('click', () => {
                document.getElementById('ca-modal').style.display = 'flex';
                actualizarCaDOM();
            });
            sG.appendChild(btn);
        } else if (i.nombre === "Hit Dice" && i.valor.includes("/")) {
            const partes = i.valor.split("/");
            hitDiceMaximo = parseInt(partes[1]);
            const guardadoHd = localStorage.getItem(STORAGE_PREFIX + 'hitDiceActual');
            hitDiceActual = guardadoHd !== null ? parseInt(guardadoHd) : parseInt(partes[0]);
            const btn = document.createElement('button');
            btn.className = 'skill-btn';
            btn.id = 'hd-btn';
            btn.innerHTML = `<span>${i.nombre}</span><span class="skill-mod">${hitDiceActual}/${hitDiceMaximo}</span>`;
            if (hitDiceActual !== hitDiceMaximo) btn.classList.add('modificado');
            sG.appendChild(btn);
        } else {
            sG.appendChild(createBtn(i));
        }
    });

    // Después del Nivel (segundo elemento), agregar un slot vacío para mantener el grid 3x3
    const nivelBtn = sG.children[1]; // Vida=0, Nivel=1
    if (nivelBtn) {
        const placeholder = document.createElement('div');
        placeholder.className = 'stat-vacio';
        sG.insertBefore(placeholder, sG.children[2]);
    }
    data.modificadores.forEach(i => mG.appendChild(createBtn(i)));
    data.salvaciones.forEach(i => {
        const btn = createBtn(i);
        btn.dataset.saveNombre = i.nombre;
        btn.dataset.saveBase = String(parseMod(i.valor));
        vG.appendChild(btn);
    });
    data.habilidades.forEach(i => skG.appendChild(createBtn(i)));

    // Rasgos (mergeamos los del background primero para que aparezcan en la lista)
    aplicarBackground(data.background, data.equipo);

    rasgosGlobal.forEach(i => {
        // Rasgos marcados "oculto" no se muestran en la lista (pero rasgosGlobal los sigue
        // teniendo, así que procesarEfectos igual los usa para el popup de "Efectos Activados").
        if (i.oculto) return;

        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.style.flexDirection = 'column';
        btn.style.alignItems = 'flex-start';
        btn.style.height = 'auto';
        btn.innerHTML = `
            <span style="font-weight: bold; margin-bottom: 5px;">${i.nombre}</span>
            <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${(i.desc || '').replace(/\n/g, '<br>')}</span>
        `;
        btn.onclick = () => {
            modalTitle.innerHTML = i.nombre;
            modalDesc.innerHTML = (i.desc || '').replace(/\n/g, '<br>');
            if (modalActions) modalActions.style.display = 'none';
            const modalEquipar = document.getElementById('modal-equipar');
            if (modalEquipar) modalEquipar.style.display = 'none';
            // Limpiar badges y línea celeste (los rasgos no los tienen)
            renderModalBadges({});
            renderModalInfoLinea({});
            modal.style.display = 'flex';
        };
        document.getElementById('rasgos-grid').appendChild(btn);
    });

    // Equipo
    const modStr = obtenerMod(data.modificadores, "STR");
    modStrGlobal = modStr;
    const modDexNum = obtenerMod(data.modificadores, "DEX");

    // Función auxiliar: ¿el ítem está equipado?
    const estaEquipado = (item) => {
        if (item.esArmadura) {
            return item.tipoArmadura === 'escudo'
                ? (escudoEquipadoId === item.nombre)
                : (armaduraEquipadaId === item.nombre);
        }
        return armasEquipadas.includes(item.nombre);
    };

    // Refresca solo el badge "Equipado" de una card sin re-renderizar todo
    const refrescarCardEquipado = (item) => {
        const card = document.querySelector(`.skill-btn[data-item-nombre="${item.nombre}"]`);
        if (!card) return;
        const eq = estaEquipado(item);
        let badge = card.querySelector('.badge-equipado');
        if (eq && !badge) {
            const span = document.createElement('span');
            span.className = 'badge-equipado';
            span.textContent = '✓ Equipado';
            span.style.cssText = 'display: inline-block; margin-top: 8px; padding: 4px 10px; font-size: 0.8rem; font-weight: bold; border-radius: var(--border-radius); background-color: #2e7d32; color: white;';
            card.appendChild(span);
        } else if (!eq && badge) {
            badge.remove();
        }
    };

    data.equipo.forEach(i => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.dataset.itemNombre = i.nombre;
        btn.style.flexDirection = 'column';
        btn.style.alignItems = 'flex-start';
        btn.style.height = 'auto';

        let danoFinal = i.dano || '';
        let detalleDanoHTML = '';
        if (i.dano && i.tipo) {
            const modUsado = (i.tipo === 'finesse') ? modDexNum : modStr;
            const nombreModUsado = (i.tipo === 'finesse') ? 'DEX' : 'STR';
            const bonosInfo = calcularBonosDano(i, false, rasgosGlobal, statsGlobal, nombresQueOcupanMano());
            const { base: danoBaseLimpio, bonus: bonusHorneado } = extraerBonusHorneado(i.dano);
            const detallesConMagico = [...bonosInfo.detalles];
            if (i.bonoDano) detallesConMagico.push({ nombre: 'Arma mágica', valor: i.bonoDano });
            if (bonusHorneado) detallesConMagico.push({ nombre: 'Arma mágica', valor: bonusHorneado });
            detallesConMagico.push(...bonoDanoDeTogglesActivos());
            danoFinal = formatearDanoConBonos(danoBaseLimpio, modUsado, detallesConMagico);

            // Mostrar de dónde sale cada "+N" (STR/DEX, Fighting Style, arma mágica, etc.)
            // para que no quede como una suma rara sin explicación (ej: "1d6+2+2+1").
            const detalleStr = formatearDetalleBonos(modUsado, nombreModUsado, detallesConMagico);
            if (detalleStr) {
                detalleDanoHTML = `<span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 2px;">${detalleStr}</span>`;
            }
        }
        if (i.ataques && i.ataques > 1 && danoFinal) {
            danoFinal = `${danoFinal} ×${i.ataques}`;
        }

        const danoHTML = danoFinal ? `<span class="skill-mod" style="background-color: #6a1b9a; color: white;">${danoFinal}</span>` : '';
        const tipoDanoHTML = i.tipoDano ? `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #757575; border-radius: 4px; color: #757575; background-color: #eeeeee; margin-left: 6px;">${capitalizar(i.tipoDano)}</span>` : '';
        const maestriaHTML = (i.maestriaArma && tieneRasgo('Weapon Mastery') && MAESTRIA_ARMA_INFO[i.maestriaArma])
            ? `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #6a1b9a; border-radius: 4px; color: #6a1b9a; background-color: #f3e5f5; margin-left: 6px;">${MAESTRIA_ARMA_INFO[i.maestriaArma].emoji} ${MAESTRIA_ARMA_INFO[i.maestriaArma].nombre}</span>`
            : '';

        let armaduraHTML = '';
        if (i.esArmadura) {
            const esEscudo = (i.tipoArmadura === 'escudo');
            const labelBadge = esEscudo ? `+${i.armaduraBase} CA` : `CA: ${i.armaduraBase}`;
            const tipoLabel = i.tipoArmadura ? ` (${i.tipoArmadura})` : '';
            armaduraHTML = `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #6a1b9a; border-radius: 4px; color: #6a1b9a; background-color: #f3e5f5; margin-right: 6px;">${labelBadge}${tipoLabel}</span>`;
        }

        let manosHTML = '';
        if (i.manos && i.manos > 0) {
            manosHTML = `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid var(--accent-color); border-radius: 4px; color: var(--accent-color); background-color: #ede0d0; margin-right: 6px;">${i.manos === 2 ? '2 manos' : '1 mano'}</span>`;
        }

        const eq = estaEquipado(i);
        const equipadoBadgeHTML = eq
            ? `<span class="badge-equipado" style="display: inline-block; margin-top: 8px; padding: 4px 10px; font-size: 0.8rem; font-weight: bold; border-radius: var(--border-radius); background-color: #2e7d32; color: white;">✓ Equipado</span>`
            : '';

        // Construir línea de info celeste (acción, distancia, duración)
        const partesInfo = [];
        if (i.accion) partesInfo.push(i.accion);
        if (i.distancia) partesInfo.push(i.distancia);
        if (i.duracion) partesInfo.push(i.duracion);
        const infoLineaHTML = partesInfo.length > 0
            ? `<span style="color: #0277bd; font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 4px;">${partesInfo.join(' • ')}</span>`
            : '';

        btn.innerHTML = `
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 5px; gap: 10px; flex-wrap: wrap;">
                <span style="font-weight: bold;">${i.nombre}</span>
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                    ${armaduraHTML}
                    ${manosHTML}
                    ${danoHTML}
                    ${tipoDanoHTML}
                    ${maestriaHTML}
                </div>
            </div>
            ${detalleDanoHTML}
            ${infoLineaHTML}
            <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${i.desc.replace(/\n/g, '<br>')}</span>
            ${equipadoBadgeHTML}
        `;
        btn.onclick = () => abrirModalEquipo(i, data.equipo);
        document.getElementById('equipo-grid').appendChild(btn);
    });

    // === Lógica de equipar/desequipar desde el modal ===
    let itemModalActual = null;
    let itemContextoActual = null;

    // Llena el contenedor #modal-badges con las mini-cards (daño, tipo, manos, armadura)
    function renderModalBadges(item) {
        const cont = document.getElementById('modal-badges');
        if (!cont) return;
        cont.innerHTML = '';
        ultimoDanoMostrado = '';

        const partes = [];

        // Daño + multiplicador + bonos
        if (item.dano) {
            const esHechizoItem = !item.manos && !item.esArmadura;
            const danoBase = esHechizoItem ? resolverDanoBase(item, nivelPersonaje) : item.dano;
            let danoTexto = danoBase;
            let modUsado = 0;
            let nombreModUsado = '';
            if (item.tipo) {
                modUsado = (item.tipo === 'finesse') ? modDexGlobal : modStrGlobal;
                nombreModUsado = (item.tipo === 'finesse') ? 'DEX' : 'STR';
            }
            const bonosModalInfo = calcularBonosDano(item, esHechizoItem, rasgosGlobal, statsGlobal, nombresQueOcupanMano());
            const ataquesItem = esHechizoItem ? resolverAtaques(item, nivelPersonaje) : (item.ataques || 1);
            let danoBaseFinal = danoBase;
            const detallesModalConMagico = [...bonosModalInfo.detalles];
            if (!esHechizoItem) {
                if (item.bonoDano) detallesModalConMagico.push({ nombre: 'Arma mágica', valor: item.bonoDano });
                const { base: baseSinHornear, bonus: bonusHorneado } = extraerBonusHorneado(danoBase);
                if (bonusHorneado) {
                    danoBaseFinal = baseSinHornear;
                    detallesModalConMagico.push({ nombre: 'Arma mágica', valor: bonusHorneado });
                }
            }
            // Toggles activos (ej: Radiant Soul) suman daño extra tanto a armas como a hechizos
            detallesModalConMagico.push(...bonoDanoDeTogglesActivos());
            danoTexto = formatearDanoConBonos(danoBaseFinal, modUsado, detallesModalConMagico);
            if (ataquesItem > 1) danoTexto = `${danoTexto} ×${ataquesItem}`;
            ultimoDanoMostrado = item.tipoDano ? `${danoTexto} ${item.tipoDano}` : danoTexto;
            partes.push(`<span class="skill-mod" style="background-color: #6a1b9a; color: white;">${danoTexto}</span>`);

            // Tooltip con detalle de bonos
            const detalleStr = formatearDetalleBonos(modUsado, nombreModUsado, detallesModalConMagico);
            if (detalleStr) {
                partes.push(`<span style="font-size: 0.8rem; color: var(--text-muted); padding: 2px 6px;">${detalleStr}</span>`);
            }

            // Curación extra por rasgo (ej: Disciple of Life, Blessed Healer): se muestra como
            // badge "+N (Nombre del rasgo)" directo en el modal, antes de siquiera usar el hechizo.
            if (item.tipoDano === 'curación' && item.efectos) {
                const nivelBaseSpell = parseInt((item.nivel || '').replace(/[^0-9]/g, '')) || 0;
                item.efectos
                    .filter(e => e.tipo === 'autoCuracion' && (!e.rasgoRequerido || tieneRasgo(e.rasgoRequerido)))
                    .forEach(e => {
                        const valorExtra = evaluarFormula(e.formula, { nivelHechizo: nivelBaseSpell, nivelPersonaje: nivelPersonajeGlobal });
                        partes.push(`<span class="skill-mod" style="background-color: #2e7d32; color: white;">+${valorExtra} (${e.descripcion || e.rasgoRequerido})</span>`);
                    });
            }
        }

        // Tipo de daño
        if (item.tipoDano) {
            partes.push(`<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #757575; border-radius: 4px; color: #757575; background-color: #eeeeee;">${capitalizar(item.tipoDano)}</span>`);
        }

        // Weapon Mastery (badge compacto; la descripción completa va debajo, en modalDesc)
        if (item.maestriaArma && tieneRasgo('Weapon Mastery') && MAESTRIA_ARMA_INFO[item.maestriaArma]) {
            const m = MAESTRIA_ARMA_INFO[item.maestriaArma];
            partes.push(`<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #6a1b9a; border-radius: 4px; color: #6a1b9a;">${m.emoji} ${m.nombre}</span>`);
        }

        // Manos
        if (item.manos && item.manos > 0) {
            partes.push(`<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid var(--accent-color); border-radius: 4px; color: var(--accent-color);">${item.manos === 2 ? '2 manos' : '1 mano'}</span>`);
        }

        // Armadura/escudo
        if (item.esArmadura) {
            const esEscudo = (item.tipoArmadura === 'escudo');
            const labelBadge = esEscudo ? `+${item.armaduraBase} CA` : `CA: ${item.armaduraBase}`;
            const tipoLabel = item.tipoArmadura ? ` (${item.tipoArmadura})` : '';
            partes.push(`<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #6a1b9a; border-radius: 4px; color: #6a1b9a;">${labelBadge}${tipoLabel}</span>`);
        }

        // Usos (habilidades)
        if (item.usos) {
            const valorUsos = habilidadesUsoState[item.nombre] || item.usos;
            partes.push(`<span class="skill-mod" style="background-color: #6a1b9a; color: white;">${valorUsos}</span>`);
        }

        cont.innerHTML = partes.join('');
        cont.style.display = partes.length > 0 ? 'flex' : 'none';
    }

    // Llena la línea celeste con accion • distancia • duracion
    function renderModalInfoLinea(item) {
        const cont = document.getElementById('modal-info-linea');
        if (!cont) return;
        const partes = [];
        if (item.accion) partes.push(item.accion);
        if (item.distancia) partes.push(item.distancia);
        if (item.duracion) partes.push(item.duracion);
        cont.textContent = partes.join(' • ');
        cont.style.display = partes.length > 0 ? 'block' : 'none';
    }

    // Muestra u oculta el botón "Usar" según el item
    // tipo: 'arma' | 'hechizo' | 'cantrip' | 'habilidad' | null
    function renderBotonUsar(item, tipo) {
        if (!modalActions || !useSpellBtn) return;

        useSpellBtn.dataset.nivel = '';
        useSpellBtn.dataset.cantrip = '';
        useSpellBtn.dataset.habilidad = '';
        useSpellBtn.dataset.arma = '';
        useSpellBtn.dataset.smite = '';
        useSpellBtn.dataset.postGolpeSolo = '';
        useSpellBtn.style.backgroundColor = '#6a1b9a'; // Reset color

        const tieneDano = !!item.dano;
        const esHabilidad = !!item.usos || item.tipo === 'smite' || !!item.consumeUsoDe || !!item.otorgaGolpes || !!item.soloPostGolpe;
        const esHechizoConRanura = (tipo === 'hechizo');
        const esCantrip = (tipo === 'cantrip');
        const esArma = (tipo === 'arma') && tieneDano;

        if (esArma) {
            modalActions.style.display = 'block';
            useSpellBtn.dataset.arma = item.nombre;
            const armaEquipada = armasEquipadas.includes(item.nombre);
            if (armaEquipada) {
                useSpellBtn.disabled = false;
                useSpellBtn.textContent = `Usar ${item.nombre}`;
                useSpellBtn.style.backgroundColor = '#6a1b9a';
            } else {
                useSpellBtn.disabled = true;
                useSpellBtn.textContent = `🚫 Equipá ${item.nombre} primero`;
                useSpellBtn.style.backgroundColor = '#999';
            }
        } else if (esCantrip) {
            modalActions.style.display = 'block';
            useSpellBtn.dataset.cantrip = 'true';
            useSpellBtn.disabled = false;
            useSpellBtn.textContent = 'Usar Cantrip';
        } else if (esHechizoConRanura) {
            const nivelRanura = mapNivelHechizoARanura(item.nivel);
            if (nivelRanura) {
                modalActions.style.display = 'block';
                useSpellBtn.dataset.nivel = nivelRanura;
                const disponibles = parseInt(ranurasState[nivelRanura]);
                useSpellBtn.disabled = disponibles <= 0;
                useSpellBtn.textContent = disponibles > 0
                    ? `Usar Hechizo (${disponibles} en ${nivelRanura})`
                    : 'Sin ranuras disponibles';
            } else {
                modalActions.style.display = 'none';
            }
        } else if (esHabilidad || item.tipo === 'smite') {
            modalActions.style.display = 'block';

            // Caso especial: Divine Smite (y similares) no se pueden usar directamente
            if (item.tipo === 'smite') {
                useSpellBtn.dataset.smite = 'true';
                useSpellBtn.disabled = false;
                useSpellBtn.textContent = 'Intentar usar';
            } else if (item.soloPostGolpe) {
                // Igual que Smite: solo se pueden usar desde el panel post-golpe, después de
                // golpear con un arma. Si tocás "Usar" directo desde su propia card, se bloquea.
                useSpellBtn.dataset.smite = '';
                useSpellBtn.dataset.postGolpeSolo = 'true';
                useSpellBtn.disabled = false;
                useSpellBtn.textContent = 'Intentar usar';
            } else {
                useSpellBtn.dataset.habilidad = item.nombre;
                useSpellBtn.dataset.smite = '';
                useSpellBtn.dataset.postGolpeSolo = '';

                if (item.toggleBonoDano && togglesActivos[item.nombre]) {
                    // Ya está activa: el botón pasa a ser "Desactivar", no gasta usos
                    useSpellBtn.disabled = false;
                    useSpellBtn.textContent = `Desactivar ${item.nombre}`;
                } else if (item.otorgaGolpes && !item.consumeUsoDe) {
                    // Otorga golpes gratis (ej: Martial Arts bonus attack): no tiene contador
                    // propio, solo depende de que tengas la Acción Bonus disponible.
                    useSpellBtn.disabled = false;
                    useSpellBtn.textContent = 'Usar Habilidad';
                } else {
                    // Si el item consume el pool de OTRA habilidad (ej: Harness Divine Power usa
                    // el contador compartido de "Channel Divinity"), mostrar y chequear ESE pool.
                    const nombreControl = item.consumeUsoDe || item.nombre;
                    const dispActuales = parseInt((habilidadesUsoState[nombreControl] || '0/0').split('/')[0]);
                    useSpellBtn.disabled = dispActuales <= 0;
                    useSpellBtn.textContent = dispActuales > 0
                        ? `Usar Habilidad (${habilidadesUsoState[nombreControl]})`
                        : 'Sin usos disponibles';
                }
            }
        } else {
            modalActions.style.display = 'none';
        }
    }

    function abrirModalEquipo(item, equipoData) {
        itemModalActual = item;
        itemContextoActual = { tipo: 'equipo', item: item };

        modalTitle.innerHTML = item.nombre;
        modalDesc.innerHTML = item.desc.replace(/\n/g, '<br>');

        // Weapon Mastery (DnD 5.5e / 2024): si el arma tiene una maestría asignada y el
        // personaje tiene el rasgo "Weapon Mastery", mostrar qué hace esa propiedad.
        if (item.maestriaArma && tieneRasgo('Weapon Mastery') && MAESTRIA_ARMA_INFO[item.maestriaArma]) {
            const m = MAESTRIA_ARMA_INFO[item.maestriaArma];
            modalDesc.innerHTML += `<br><br><strong style="color:#6a1b9a;">${m.emoji} Maestría: ${m.nombre}</strong><br>${m.desc}`;
        }

        // Llenar badges (mini cards) y línea celeste
        renderModalBadges(item);
        renderModalInfoLinea(item);

        // Mostrar botón "Usar" si tiene daño (es un arma)
        renderBotonUsar(item, 'arma');

        // Botón Equipar (solo armaduras, escudos o armas con manos)
        const modalEquipar = document.getElementById('modal-equipar');
        const btnEqModal = document.getElementById('btn-equipar-modal');
        // Equipable si: es armadura/escudo, ocupa manos (arma/vara/varita), tiene efectos numéricos
        // (capas, etc. que no ocupan manos), o está marcado explícitamente como "equipable"
        // (accesorios sin efecto numérico, como botas, que igual querés poder marcar como puestas).
        const esEquipable = item.esArmadura || (item.manos && item.manos > 0) || (item.efectos && item.efectos.length > 0) || item.equipable === true;

        if (esEquipable && modalEquipar && btnEqModal) {
            modalEquipar.style.display = 'block';
            const eq = estaEquipado(item);

            if (eq) {
                btnEqModal.textContent = '✓ Desequipar';
                btnEqModal.style.backgroundColor = '#2e7d32';
                btnEqModal.style.color = 'white';
                btnEqModal.disabled = false;
            } else {
                const validacion = validarArmaduraPorClase(item, claseActual);
                const validacionStats = validarRequerimientosStats(item, statsGlobal);
                if (!validacion.permitido) {
                    btnEqModal.textContent = `🚫 ${validacion.razon}`;
                    btnEqModal.style.backgroundColor = '#c62828';
                    btnEqModal.style.color = 'white';
                    btnEqModal.disabled = true;
                } else if (!validacionStats.permitido) {
                    btnEqModal.textContent = `🚫 ${validacionStats.razon}`;
                    btnEqModal.style.backgroundColor = '#c62828';
                    btnEqModal.style.color = 'white';
                    btnEqModal.disabled = true;
                } else {
                    const manosNecesarias = item.manos || 0;
                    const manosLibres = 2 - manosUsadas;
                    if (manosNecesarias <= manosLibres) {
                        btnEqModal.textContent = 'Equipar';
                        btnEqModal.style.backgroundColor = 'var(--accent-color)';
                        btnEqModal.style.color = 'white';
                        btnEqModal.disabled = false;
                    } else {
                        btnEqModal.textContent = `No hay manos libres (${manosLibres}/2)`;
                        btnEqModal.style.backgroundColor = 'var(--text-muted)';
                        btnEqModal.style.color = 'white';
                        btnEqModal.disabled = true;
                    }
                }
            }
        } else if (modalEquipar) {
            modalEquipar.style.display = 'none';
        }

        modal.style.display = 'flex';
    }

    // Listener único del botón Equipar dentro del modal
    const btnEquiparModal = document.getElementById('btn-equipar-modal');
    if (btnEquiparModal) {
        btnEquiparModal.addEventListener('click', () => {
            if (!itemModalActual) return;
            const item = itemModalActual;
            const yaEquipado = estaEquipado(item);

            if (yaEquipado) {
                // === DESEQUIPAR ===
                if (item.esArmadura && item.tipoArmadura === 'escudo') {
                    escudoEquipadoId = null;
                    escudoEquipadoBase = 0;
                    guardarEscudoEquipado();
                } else if (item.esArmadura) {
                    armaduraEquipadaId = null;
                    armaduraEquipadaBase = 0;
                    armaduraEquipadaTipo = '';
                    guardarArmaduraEquipada();
                } else {
                    // Arma
                    armasEquipadas = armasEquipadas.filter(n => n !== item.nombre);
                    guardarArmasEquipadas();
                }
                mostrarToast(`${item.nombre} desequipado`);
            } else {
                // === EQUIPAR ===
                // Validar restricción por clase
                const validacion = validarArmaduraPorClase(item, claseActual);
                if (!validacion.permitido) {
                    mostrarToast(validacion.razon, 'warning');
                    return;
                }

                // Validar requerimientos de stats
                const validacionStats = validarRequerimientosStats(item, statsGlobal);
                if (!validacionStats.permitido) {
                    mostrarToast(validacionStats.razon, 'warning');
                    return;
                }

                const manosNecesarias = item.manos || 0;
                const manosLibres = 2 - manosUsadas;
                if (manosNecesarias > manosLibres) {
                    mostrarToast(`No tenés manos libres para equipar ${item.nombre}`, 'warning');
                    return;
                }

                if (item.esArmadura && item.tipoArmadura === 'escudo') {
                    escudoEquipadoId = item.nombre;
                    escudoEquipadoBase = item.armaduraBase || 0;
                    guardarEscudoEquipado();
                } else if (item.esArmadura) {
                    armaduraEquipadaId = item.nombre;
                    armaduraEquipadaBase = item.armaduraBase || 0;
                    armaduraEquipadaTipo = item.tipoArmadura || 'ligera';
                    guardarArmaduraEquipada();
                } else {
                    // Arma
                    if (!armasEquipadas.includes(item.nombre)) {
                        armasEquipadas.push(item.nombre);
                    }
                    guardarArmasEquipadas();
                }
                mostrarToast(`${item.nombre} equipado ✓`);
            }

            // Recalcular manos, CA y refrescar UI
            recalcularManosUsadas(data.equipo);
            actualizarManosDOM();
            recalcularYActualizarCA();
            actualizarBonosHeaderDOM();
            actualizarSalvacionesDOM();

            // Refrescar todas las cards de equipo (para badge "Equipado")
            data.equipo.forEach(eqItem => refrescarCardEquipado(eqItem));

            // Cerrar modal
            modal.style.display = 'none';
        });
    }

    // Inicializar el contador de manos en el header
    actualizarManosDOM();

    // Guardar equipo globalmente para recálculos posteriores
    window._equipoData = data.equipo;

    // Inicializar inventario
    cargarInventario(data.inventario || []);

    // Aplicar background (mergea rasgos y suma oro inicial una sola vez)
    aplicarBackground(data.background, data.equipo);

    renderInventarioLista();

    // Calcular peso y velocidad inicial
    recalcularPesoYVelocidad(data.equipo);

    // Inicializar sistema de turno (acá ya está STORAGE_PREFIX definido)
    extraAttacks = calcularExtraAttacks(data.rasgos, claseActual, nivelPersonaje);
    cargarTurnoEstado();
    actualizarTurnoDOM();

    // Detectar Divine Smite (si la clase tiene una habilidad con tipo "smite")
    if (data.habilidadesUso) {
        smitesData = (data.habilidadesUso || []).filter(h => h.tipo === 'smite');
    }

    // === Listeners del inventario ===
    const inventarioToggle = document.getElementById('inventario-toggle');
    const inventarioModal = document.getElementById('inventario-modal');
    const invItemModal = document.getElementById('inv-item-modal');
    const invCloseBtn = document.querySelector('.close-btn-inventario');
    const invItemCloseBtn = document.querySelector('.close-btn-inv-item');

    if (inventarioToggle && inventarioModal) {
        inventarioToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            renderInventarioLista();
            inventarioModal.style.display = 'flex';
        });
    }

    if (invCloseBtn) {
        invCloseBtn.addEventListener('click', () => inventarioModal.style.display = 'none');
    }

    if (invItemCloseBtn) {
        invItemCloseBtn.addEventListener('click', () => invItemModal.style.display = 'none');
    }

    const invItemUsarBtn = document.getElementById('inv-item-usar');
    if (invItemUsarBtn) {
        invItemUsarBtn.addEventListener('click', () => {
            if (itemInventarioActual) usarItemInventario(itemInventarioActual);
        });
    }

    // Listeners del modal de confirmación
    const invConfirmModal = document.getElementById('inv-confirm-modal');
    const invConfirmSi = document.getElementById('inv-confirm-si');
    const invConfirmNo = document.getElementById('inv-confirm-no');
    const invConfirmClose = document.querySelector('.close-btn-inv-confirm');

    if (invConfirmSi) {
        invConfirmSi.addEventListener('click', () => {
            aplicarCambioInventario();
            invConfirmModal.style.display = 'none';
        });
    }
    if (invConfirmNo) {
        invConfirmNo.addEventListener('click', () => {
            cantidadInventarioPendiente = 0;
            invConfirmModal.style.display = 'none';
        });
    }
    if (invConfirmClose) {
        invConfirmClose.addEventListener('click', () => {
            cantidadInventarioPendiente = 0;
            invConfirmModal.style.display = 'none';
        });
    }

    // Botones +/- predefinidos
    document.querySelectorAll('.inv-modif').forEach(btn => {
        btn.addEventListener('click', () => {
            const cantidad = parseInt(btn.dataset.cant);
            modificarCantidadInventario(cantidad);
        });
    });

    // Botón Aplicar (input manual)
    const invItemAplicar = document.getElementById('inv-item-aplicar');
    if (invItemAplicar) {
        invItemAplicar.addEventListener('click', () => {
            const input = document.getElementById('inv-item-input');
            const cantidad = parseInt(input.value) || 0;
            modificarCantidadInventario(cantidad);
            input.value = 0;
        });
    }

    // === Listeners del Familiar / Steed ===
    const familiarToggle = document.getElementById('familiar-toggle');
    const familiarModal = document.getElementById('familiar-modal');
    const familiarCloseBtn = document.querySelector('.close-btn-familiar');
    const familiarDespedirBtn = document.getElementById('familiar-despedir');

    // Mostrar el botón flotante si ya había un familiar activo guardado de una sesión anterior
    actualizarFamiliarFabVisibilidad();
    if (familiarActivo) renderFamiliarModal();

    if (familiarToggle && familiarModal) {
        familiarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            renderFamiliarModal();
            familiarModal.style.display = 'flex';
        });
    }
    if (familiarCloseBtn) {
        familiarCloseBtn.addEventListener('click', () => familiarModal.style.display = 'none');
    }

    document.getElementById('familiar-hp-menos1')?.addEventListener('click', () => modificarVidaFamiliar(-1));
    document.getElementById('familiar-hp-mas1')?.addEventListener('click', () => modificarVidaFamiliar(1));
    document.getElementById('familiar-hp-menos5')?.addEventListener('click', () => modificarVidaFamiliar(-5));
    document.getElementById('familiar-hp-mas5')?.addEventListener('click', () => modificarVidaFamiliar(5));

    if (familiarDespedirBtn) {
        familiarDespedirBtn.addEventListener('click', () => {
            if (familiarDataActual) mostrarToast(`👋 ${familiarDataActual.nombre} fue despedido`);
            desactivarFamiliar();
        });
    }

    // === Listeners del menú flotante de turno ===
    const turnoToggle = document.getElementById('turno-toggle');
    const turnoPanel = document.getElementById('turno-panel');
    const turnoReset = document.getElementById('turno-reset');

    if (turnoToggle && turnoPanel) {
        turnoToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const visible = turnoPanel.style.display === 'block';
            turnoPanel.style.display = visible ? 'none' : 'block';
        });

        // Cerrar al hacer click fuera (con verificación más estricta)
        document.addEventListener('click', (e) => {
            const fab = document.getElementById('turno-fab');
            if (fab && !fab.contains(e.target)) {
                turnoPanel.style.display = 'none';
            }
        });
    }

    // Click en cada contador → ya no se restaura nada manualmente acá. Extra Attack ahora se
    // maneja automático y preciso con turnoEstado.golpesRestantes (ver Caso 3 del listener de
    // useSpellBtn): el primer golpe con un arma gasta la Acción real, y los golpes extra que
    // corresponden por Extra Attack salen solos sin volver a pedir la Acción.
    document.querySelectorAll('.turno-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    // Botón "Terminé mi turno"
    if (turnoReset) {
        turnoReset.addEventListener('click', (e) => {
            e.stopPropagation();
            // Si Action Surge está activo, abrir modal de recordatorio en vez de resetear directamente
            if (actionSurgeActivo) {
                turnoPanel.style.display = 'none';
                document.getElementById('action-surge-modal').style.display = 'flex';
                return;
            }
            resetearTurno();
            mostrarToast('🔄 Turno reiniciado');
            turnoPanel.style.display = 'none';
        });
    }

    // Modal Action Surge: listeners
    const actionSurgeModal = document.getElementById('action-surge-modal');
    const actionSurgeCerrar = document.getElementById('action-surge-cerrar');
    const actionSurgeCloseBtn = document.querySelector('.close-btn-action-surge');
    if (actionSurgeCerrar) {
        actionSurgeCerrar.addEventListener('click', () => {
            actionSurgeActivo = false; // Apagar el flag
            actionSurgeModal.style.display = 'none';
            // Ahora sí terminar el turno definitivamente
            resetearTurno();
            mostrarToast('🔄 Turno terminado');
        });
    }
    if (actionSurgeCloseBtn) {
        actionSurgeCloseBtn.addEventListener('click', () => actionSurgeModal.style.display = 'none');
    }

    // Calcular y mostrar Save DC, Spell Attack Bonus y Atk Melee/Finesse en headers
    // (función reutilizable: se vuelve a llamar cada vez que se equipa/desequipa algo)
    function actualizarBonosHeaderDOM() {
        const { bonos, notas } = calcularBonosEquipoActivo();
        notasEquipoActuales = notas; // Guardado global para mostrarlas al usar un hechizo

        const saveDCActual = 8 + proficienciaActual + modPrincipal + bonos.bonoCDHechizo;
        const spellAttackBonusActual = formatMod(proficienciaActual + modPrincipal + bonos.bonoAtaqueHechizo);
        const atkMeleeBonusActual = formatMod(proficienciaActual + modStr + bonos.atkMeleeExtra);
        const atkFinesseBonusActual = formatMod(proficienciaActual + modDexNum + bonos.atkFinesseExtra);

        const tieneMelee = data.equipo.some(e => e.tipo === 'melee');
        const tieneFinesse = data.equipo.some(e => e.tipo === 'finesse');

        document.querySelectorAll('.proficient').forEach(span => {
            const txt = span.textContent;
            if (txt.includes('Spell Attack Bonus')) {
                span.textContent = `Spell Attack Bonus: ${spellAttackBonusActual}`;
            } else if (txt.includes('Spell Save DC')) {
                span.textContent = `Spell Save DC: ${saveDCActual}`;
            } else if (txt.includes('Save DC')) {
                span.textContent = `Save DC: ${saveDCActual}`;
            } else if (txt.includes('Atk Melee')) {
                span.textContent = `Atk Melee: ${atkMeleeBonusActual}`;
                if (!tieneMelee) span.style.display = 'none';
            } else if (txt.includes('Atk Finesse')) {
                span.textContent = `Atk Finesse: ${atkFinesseBonusActual}`;
                if (!tieneFinesse) span.style.display = 'none';
            }
        });
    }
    actualizarBonosHeaderDOM();

    // Recalcula el valor mostrado de cada salvación sumando el bono de equipo activo
    // (ej: Capa de Protección +1 a todas las salvaciones)
    function actualizarSalvacionesDOM() {
        const { bonos } = calcularBonosEquipoActivo();
        document.querySelectorAll('#saves-grid .skill-btn[data-save-nombre]').forEach(btn => {
            const base = parseInt(btn.dataset.saveBase, 10) || 0;
            const mod = btn.querySelector('.skill-mod');
            if (mod) mod.textContent = formatMod(base + bonos.salvaciones);
        });
    }
    actualizarSalvacionesDOM();

    // Habilidades con usos
    if (data.habilidadesUso) {
        // Inicializar estado: localStorage > JSON
        data.habilidadesUso.forEach(h => {
            // Si la habilidad escala su cantidad de usos con el nivel de personaje (ej:
            // Channel Divinity: 1/1 en nivel 1, 2/2 en nivel 6, 3/3 en nivel 18), calcularlo acá.
            if (h.usosPorNivel) {
                let maxCalc = 1;
                Object.keys(h.usosPorNivel)
                    .map(k => parseInt(k))
                    .sort((a, b) => a - b)
                    .forEach(umbral => {
                        if (nivelPersonaje >= umbral) maxCalc = h.usosPorNivel[String(umbral)];
                    });
                h.usos = `${maxCalc}/${maxCalc}`;
            }
            // Si los usos son directamente iguales al nivel de personaje (ej: Puntos de Ki del
            // Monje: siempre = nivel de monje, sin escalones).
            if (h.usosIgualANivel) {
                h.usos = `${nivelPersonaje}/${nivelPersonaje}`;
            }
            if (h.usos) {
                habilidadesUsoOriginales[h.nombre] = h.usos;
                habilidadesInfo[h.nombre] = h.recupera || 'largo';
                if (h.recuperaCortoCantidad !== undefined) habilidadesRecuperaCortoCantidad[h.nombre] = h.recuperaCortoCantidad;
            }
        });
        const guardadasHab = localStorage.getItem(STORAGE_PREFIX + 'habilidadesUso');
        if (guardadasHab) {
            habilidadesUsoState = JSON.parse(guardadasHab);
            data.habilidadesUso.forEach(h => {
                if (!(h.nombre in habilidadesUsoState)) {
                    habilidadesUsoState[h.nombre] = h.usos;
                } else if (h.usosPorNivel || h.usosIgualANivel) {
                    // El máximo pudo haber cambiado (subida de nivel desde el último guardado):
                    // ajustar sin perder usos ya gastados de más.
                    const savedActual = parseInt((habilidadesUsoState[h.nombre] || '0/0').split('/')[0]);
                    const newMax = parseInt(h.usos.split('/')[1]);
                    habilidadesUsoState[h.nombre] = `${Math.min(savedActual, newMax)}/${newMax}`;
                }
            });
        } else {
            habilidadesUsoState = { ...habilidadesUsoOriginales };
        }

        const habGrid = document.getElementById('habilidades-uso-grid');
        data.habilidadesUso.forEach(h => {
            // Skipear ASIs (son silenciosos, solo modifican stats)
            if (h.tipo === 'asi' || h.oculto) return;

            const btn = document.createElement('button');
            btn.className = 'skill-btn';
            btn.id = `hab-uso-${h.nombre.replace(/[^a-zA-Z0-9]/g, '-')}`;
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'flex-start';
            btn.style.height = 'auto';
            const usosActuales = habilidadesUsoState[h.nombre];

            // Construir línea celeste de info (acción, distancia, duración)
            const partesInfoH = [];
            if (h.accion) partesInfoH.push(h.accion);
            if (h.distancia) partesInfoH.push(h.distancia);
            if (h.duracion) partesInfoH.push(h.duracion);
            const infoLineaHabHTML = partesInfoH.length > 0
                ? `<span style="color: #0277bd; font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 4px;">${partesInfoH.join(' • ')}</span>`
                : '';

            // Badge de usos solo si existe
            const usosBadgeHTML = usosActuales
                ? `<span class="skill-mod usos-valor">${usosActuales}</span>`
                : '';

            // Si es Smite, mostrar badge especial con tipo de daño
            const smiteBadgeHTML = h.tipo === 'smite' && h.tipoDano
                ? `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #757575; border-radius: 4px; color: #757575; background-color: #eeeeee;">${capitalizar(h.tipoDano)}</span>`
                : '';

            btn.innerHTML = `
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 5px;">
                    <span style="font-weight: bold;">${h.nombre}</span>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        ${smiteBadgeHTML}
                        ${usosBadgeHTML}
                    </div>
                </div>
                ${infoLineaHabHTML}
                <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${h.desc.replace(/\n/g, '<br>')}</span>
            `;

            // Marcar agotada al cargar si corresponde (solo si tiene usos)
            if (usosActuales) {
                const disponibles = parseInt(usosActuales.split('/')[0]);
                if (disponibles <= 0) btn.classList.add('ranura-vacia');
            }

            btn.onclick = () => {
                itemContextoActual = h;
                modalTitle.innerHTML = h.nombre;
                modalDesc.innerHTML = h.desc.replace(/\n/g, '<br>');

                const modalEquipar = document.getElementById('modal-equipar');
                if (modalEquipar) modalEquipar.style.display = 'none';

                renderModalBadges(h);
                renderModalInfoLinea(h);
                renderBotonUsar(h, 'habilidad');

                modal.style.display = 'flex';
            };
            habGrid.appendChild(btn);
        });
    }

    // Renderizar Ranuras
    const ranurasG = document.getElementById('ranuras-grid');
    // Si la cantidad MÁXIMA original de un nivel es 0 (el personaje nunca tiene ranuras de
    // ese nivel a su nivel actual, ej: Nika con Nivel 3/4 en 0), ni se muestra el botón.
    // Si en cambio son 0 porque ya se gastaron todas, sí se sigue mostrando (uso normal).
    data.hechizos.ranuras.filter(i => parseInt(i.cantidad) > 0).forEach(i => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.id = `ranura-${i.nivel.replace(' ', '-')}`;
        btn.style.textAlign = 'center';
        const valorActual = ranurasState[i.nivel];
        btn.innerHTML = `<span style="font-weight:bold;">${i.nivel} (<span class="valor-ranura">${valorActual}</span>)</span>`;
        if (parseInt(valorActual) <= 0) btn.classList.add('ranura-vacia');
        ranurasG.appendChild(btn);
    });

    // Renderizar Lista de Hechizos
    const contenedorHechizos = document.getElementById('hechizos-contenedor');
    // Antes esto estaba hardcodeado hasta "NIVEL 3", por eso los hechizos de nivel 4+
    // nunca se mostraban aunque estuvieran bien cargados en el JSON.
    // Ahora se arma dinámicamente según qué niveles existan realmente en data.hechizos.lista,
    // soportando cantrips + niveles 1 a 9 (D&D 5e no tiene hechizos de nivel 10+).
    const nivelesConHechizos = new Set(data.hechizos.lista.map(h => h.nivel));
    const niveles = ["CANTRIPS", ...Array.from({ length: 9 }, (_, i) => `NIVEL ${i + 1}`)]
        .filter(lvl => nivelesConHechizos.has(lvl));

    niveles.forEach(lvl => {
        const h4 = document.createElement('h4');
        h4.textContent = lvl;
        h4.style.color = "var(--accent-color)";
        h4.style.marginBottom = "5px";
        contenedorHechizos.appendChild(h4);

        const grid = document.createElement('div');
        grid.className = 'skills-grid';
        grid.style.gridTemplateColumns = '1fr';
        grid.style.marginBottom = '15px';
        contenedorHechizos.appendChild(grid);

        data.hechizos.lista.filter(h => h.nivel === lvl).forEach(h => {
            const btn = document.createElement('button');
            btn.className = 'skill-btn';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'flex-start';
            btn.style.height = 'auto';
            const danoBaseSpell = resolverDanoBase(h, nivelPersonaje);
            const ataquesSpell = resolverAtaques(h, nivelPersonaje);
            let danoTextoSpell = danoBaseSpell || '';
            if (danoBaseSpell) {
                const bonosSpellInfo = calcularBonosDano(h, true, rasgosGlobal, statsGlobal, data.equipo);
                danoTextoSpell = formatearDanoConBonos(danoBaseSpell, 0, bonosSpellInfo.detalles);
                if (ataquesSpell > 1) danoTextoSpell = `${danoTextoSpell} ×${ataquesSpell}`;
            }
            const danoHTML = h.dano ? `<span class="skill-mod" style="background-color: #6a1b9a; color: white; flex-shrink: 0;">${danoTextoSpell}</span>` : '';
            const tipoDanoHTML = h.tipoDano ? `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #757575; border-radius: 4px; color: #757575; background-color: #eeeeee; margin-left: 6px;">${capitalizar(h.tipoDano)}</span>` : '';

            // Línea celeste de info
            const partesInfoSpell = [];
            if (h.accion) partesInfoSpell.push(h.accion);
            if (h.distancia) partesInfoSpell.push(h.distancia);
            if (h.duracion) partesInfoSpell.push(h.duracion);
            const infoLineaSpellHTML = partesInfoSpell.length > 0
                ? `<span style="color: #0277bd; font-weight: bold; font-size: 0.9rem; display: block; margin-bottom: 4px;">${partesInfoSpell.join(' • ')}</span>`
                : '';

            btn.innerHTML = `
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 5px; gap: 10px; flex-wrap: wrap;">
                    <span style="font-weight: bold;">${h.nombre}</span>
                    <div style="display: flex; align-items: center;">
                        ${danoHTML}
                        ${tipoDanoHTML}
                    </div>
                </div>
                ${infoLineaSpellHTML}
                <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${h.desc.replace(/\n/g, '<br>')}</span>
            `;
            btn.onclick = () => {
                itemContextoActual = h;
                modalTitle.innerHTML = h.nombre;
                modalDesc.innerHTML = h.desc.replace(/\n/g, '<br>');

                const modalEquipar = document.getElementById('modal-equipar');
                if (modalEquipar) modalEquipar.style.display = 'none';

                renderModalBadges(h);
                renderModalInfoLinea(h);

                const tipoHechizo = (h.nivel === "CANTRIPS") ? 'cantrip' : 'hechizo';
                renderBotonUsar(h, tipoHechizo);

                modal.style.display = 'flex';
            };
            grid.appendChild(btn);
        });
    });

    // Listener: Usar Hechizo / Cantrip / Arma / Habilidad
    if (useSpellBtn) {
        useSpellBtn.addEventListener('click', () => {
            // Obtener el item desde el contexto actual para saber su tipo de acción
            const item = itemContextoActual && itemContextoActual.item ? itemContextoActual.item : itemContextoActual;
            const tipoAccion = item ? item.accion : '';

            // Validar que tenga acciones disponibles ANTES de consumir.
            // Excepción: si esto va a DESACTIVAR una habilidad tipo interruptor (ej: Radiant
            // Soul ya prendida), es gratis y no depende de que te queden acciones este turno.
            const esDesactivarToggle = item && item.toggleBonoDano && togglesActivos[item.nombre];
            if (tipoAccion && !esDesactivarToggle) {
                const t = tipoAccion.toLowerCase();
                if (t.includes('sin acción') || t.includes('sin accion') || t === 'ninguna' || t === 'ninguno') {
                    // No consume ningún recurso de turno (ej: Stunning Strike, Hand of Harm)
                } else if (t.includes('bonus') || t.includes('adicional')) {
                    if (turnoEstado.bonus === 0 && turnoEstado.accion === 0) {
                        mostrarToast('No te quedan acciones disponibles este turno', 'warning');
                        return;
                    }
                } else if (t.includes('reacción') || t.includes('reaccion')) {
                    if (turnoEstado.reaccion === 0) {
                        mostrarToast('Ya usaste tu Reacción este turno', 'warning');
                        return;
                    }
                } else if (t.includes('acción') || t.includes('accion')) {
                    // Si es un ataque de arma y todavía le quedan golpes extra de Extra Attack,
                    // dejarlo pasar aunque la Acción ya esté gastada (no vuelve a consumirla).
                    const esAtaqueDeArma = itemContextoActual && itemContextoActual.tipo === 'equipo' && !!item.dano;
                    const tieneGolpeExtraDisponible = esAtaqueDeArma && turnoEstado.golpesRestantes > 0;
                    if (turnoEstado.accion === 0 && !tieneGolpeExtraDisponible) {
                        mostrarToast('Ya usaste tu Acción este turno', 'warning');
                        return;
                    }
                }
            }

            // Caso 0: intento de usar Smite directamente → bloquear
            if (useSpellBtn.dataset.smite === 'true') {
                modal.style.display = 'none';
                mostrarToast('❌ Necesitás golpear con un arma melee primero', 'warning');
                useSpellBtn.dataset.smite = '';
                return;
            }

            // Caso 0b: intento de usar Martial Arts / Flurry / Stunning Strike / Hand of Harm
            // directamente desde su propia card → bloquear, solo se usan desde el panel post-golpe.
            if (useSpellBtn.dataset.postGolpeSolo === 'true') {
                modal.style.display = 'none';
                mostrarToast('❌ Necesitás golpear con un arma melee primero (elegilo en el panel que se abre después)', 'warning');
                useSpellBtn.dataset.postGolpeSolo = '';
                return;
            }

            // Caso 1: habilidad con usos
            const habilidad = useSpellBtn.dataset.habilidad;
            if (habilidad) {
                const habObj = data.habilidadesUso ? data.habilidadesUso.find(h => h.nombre === habilidad) : null;

                // Si la habilidad otorga golpes extra (ej: Flurry of Blows, Martial Arts bonus
                // attack): usa el mismo contador golpesRestantes que Extra Attack, así que el
                // arma/golpe desarmado los deja usar sin volver a pedir la Acción.
                if (habObj && habObj.otorgaGolpes) {
                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';
                    ejecutarOtorgaGolpes(habObj);
                    return;
                }

                // Si es una habilidad tipo interruptor (ej: Radiant Soul), este click puede ser
                // para ACTIVARLA (gasta 1 uso, como cualquier habilidad) o para DESACTIVARLA
                // (no gasta nada, simplemente apaga el bono mientras estaba prendida).
                if (habObj && habObj.toggleBonoDano) {
                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';

                    if (togglesActivos[habObj.nombre]) {
                        // Desactivar: no cuesta acción ni uso
                        togglesActivos[habObj.nombre] = false;
                        guardarToggles();
                        mostrarToast(`${habObj.nombre} desactivado`);
                    } else {
                        const partesTog = (habilidadesUsoState[habObj.nombre] || '0/0').split('/');
                        let actualTog = parseInt(partesTog[0]);
                        const maxTog = parseInt(partesTog[1]);
                        if (actualTog <= 0) {
                            mostrarToast(`Sin usos restantes de ${habObj.nombre}`, 'warning');
                            return;
                        }
                        actualTog -= 1;
                        habilidadesUsoState[habObj.nombre] = `${actualTog}/${maxTog}`;
                        guardarHabilidadesUso();
                        actualizarHabilidadUsoDOM(habObj.nombre);
                        togglesActivos[habObj.nombre] = true;
                        guardarToggles();
                        const rTog = consumirAccion(tipoAccion);
                        mostrarToast(`✨ ¡${habObj.nombre} activado! ${rTog.mensaje}`.trim());
                    }
                    return;
                }

                // Si la habilidad tiene formas salvajes (Wild Shape), abrir el selector de animal
                // en vez de gastar el uso automáticamente; el uso se gasta al elegir el animal.
                if (habObj && habObj.formasSalvajes) {
                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';
                    abrirModalFormaSalvaje(habObj, tipoAccion);
                    return;
                }

                // Si la habilidad invoca un compañero fijo (ej: Staff of the Python), no hay que
                // elegir nada: se activa directo. Pero no se puede usar si el personaje está
                // actualmente transformado con Wild Shape (no tiene manos para usar el bastón).
                if (habObj && habObj.familiar) {
                    const enFormaSalvaje = familiarActivo && familiarDataActual && familiarDataActual.tipo && familiarDataActual.tipo.startsWith('Forma Salvaje');
                    if (enFormaSalvaje) {
                        mostrarToast(`No podés usar ${habObj.nombre} mientras estás transformado con Wild Shape`, 'warning');
                        return;
                    }
                    const partesComp = (habilidadesUsoState[habObj.nombre] || '0/0').split('/');
                    let actualComp = parseInt(partesComp[0]);
                    const maxComp = parseInt(partesComp[1]);
                    if (actualComp <= 0) {
                        mostrarToast(`Sin usos restantes de ${habObj.nombre}`, 'warning');
                        return;
                    }
                    actualComp -= 1;
                    habilidadesUsoState[habObj.nombre] = `${actualComp}/${maxComp}`;
                    guardarHabilidadesUso();
                    actualizarHabilidadUsoDOM(habObj.nombre);
                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';
                    const rComp = consumirAccion(tipoAccion);
                    activarFamiliar(habObj.familiar, `${habObj.familiar.emoji || '🐾'} ¡${habObj.familiar.nombre} invocada! ${rComp.mensaje}`.trim());
                    return;
                }

                // Si la habilidad restaura UNA ranura gastada (ej: Pearl of Power, o Harness Divine
                // Power que comparte el pool de "Channel Divinity" vía consumeUsoDe)
                if (habObj && habObj.restaurarRanura) {
                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';
                    let maxNivelCalc = habObj.restaurarRanura.maxNivel;
                    if (habObj.restaurarRanura.maxNivelFormula === 'mitadProficienciaArriba') {
                        maxNivelCalc = Math.ceil(proficienciaActual / 2);
                    }
                    abrirModalRestaurarRanura(habObj, tipoAccion, maxNivelCalc, null, habObj.consumeUsoDe || null);
                    return;
                }

                // Si la habilidad restaura ranuras por presupuesto combinado (ej: Arcane Recovery,
                // Natural Recovery): presupuesto = mitad del nivel de personaje, redondeado arriba.
                if (habObj && habObj.recuperacionPresupuesto) {
                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';
                    const presupuesto = Math.ceil(nivelPersonajeGlobal / 2);
                    abrirModalRestaurarRanura(habObj, tipoAccion, habObj.recuperacionPresupuesto.maxNivelSlot, presupuesto);
                    return;
                }

                // Si la habilidad restaura 1 uso de OTRA habilidad (ej: Amulet of the Devout
                // recupera 1 de los 2 usos de Channel Divinity)
                if (habObj && habObj.restaurarUsoDe) {
                    const partesAmu = (habilidadesUsoState[habObj.nombre] || '0/0').split('/');
                    let actualAmu = parseInt(partesAmu[0]);
                    const maxAmu = parseInt(partesAmu[1]);
                    if (actualAmu <= 0) {
                        mostrarToast(`Sin usos restantes de ${habObj.nombre}`, 'warning');
                        return;
                    }
                    actualAmu -= 1;
                    habilidadesUsoState[habObj.nombre] = `${actualAmu}/${maxAmu}`;
                    actualizarHabilidadUsoDOM(habObj.nombre);

                    const objetivo = habObj.restaurarUsoDe;
                    const partesObj = (habilidadesUsoState[objetivo] || '0/0').split('/');
                    let actualObj = parseInt(partesObj[0]);
                    const maxObj = parseInt(partesObj[1]);
                    actualObj = Math.min(maxObj, actualObj + 1);
                    habilidadesUsoState[objetivo] = `${actualObj}/${maxObj}`;
                    actualizarHabilidadUsoDOM(objetivo);
                    guardarHabilidadesUso();

                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';
                    const rAmu = consumirAccion(tipoAccion);
                    mostrarToast(`✨ ${habObj.nombre}: se restauró 1 uso de ${objetivo} (${habilidadesUsoState[objetivo]}). ${rAmu.mensaje}`.trim());
                    return;
                }

                // Si la habilidad restaura TODAS las ranuras de golpe (ej: Magical Cunning)
                if (habObj && habObj.restaurarTodasLasRanuras) {
                    const partesMC = (habilidadesUsoState[habObj.nombre] || '0/0').split('/');
                    let actualMC = parseInt(partesMC[0]);
                    const maxMC = parseInt(partesMC[1]);
                    if (actualMC <= 0) {
                        mostrarToast(`Sin usos restantes de ${habObj.nombre}`, 'warning');
                        return;
                    }
                    actualMC -= 1;
                    habilidadesUsoState[habObj.nombre] = `${actualMC}/${maxMC}`;
                    actualizarHabilidadUsoDOM(habObj.nombre);
                    guardarHabilidadesUso();

                    Object.keys(ranurasState).forEach(nivel => {
                        ranurasState[nivel] = ranurasOriginales[nivel];
                        actualizarRanuraDOM(nivel);
                    });
                    guardarRanuras();

                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';
                    const rMC = consumirAccion(tipoAccion);
                    mostrarToast(`✨ ${habObj.nombre}: ¡todas tus ranuras de hechizo fueron restauradas! ${rMC.mensaje}`.trim());
                    return;
                }

                // Fallback genérico: si consume el pool de OTRA habilidad (ej: las opciones de
                // Channel Divinity de Nika comparten un único contador), gastar de ESE contador
                // pero mantener el nombre de la opción específica en el toast.
                const nombreControlFallback = (habObj && habObj.consumeUsoDe) || habilidad;
                if (nombreControlFallback !== habilidad) {
                    const partesCD = (habilidadesUsoState[nombreControlFallback] || '0/0').split('/');
                    let actualCD = parseInt(partesCD[0]);
                    const maxCD = parseInt(partesCD[1]);
                    if (actualCD <= 0) {
                        mostrarToast(`Sin usos restantes de ${nombreControlFallback}`, 'warning');
                        return;
                    }
                    actualCD -= 1;
                    habilidadesUsoState[nombreControlFallback] = `${actualCD}/${maxCD}`;
                    guardarHabilidadesUso();
                    actualizarHabilidadUsoDOM(nombreControlFallback);
                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';
                    const rCD = consumirAccion(tipoAccion);
                    mostrarToast(`¡${habilidad} usada! (${nombreControlFallback}: ${habilidadesUsoState[nombreControlFallback]}) ${rCD.mensaje}`.trim());
                } else {
                    usarHabilidad(habilidad);
                    useSpellBtn.dataset.habilidad = '';
                    const r = consumirAccion(tipoAccion);
                    if (r.mensaje) mostrarToast(r.mensaje);
                }

                // Procesar efectos de la habilidad (Second Wind, Tactical Shift, etc.)
                if (habObj) {
                    setTimeout(() => {
                        procesarEfectos(habObj, {
                            nivelPersonaje: nivelPersonaje,
                            tipos: ['habilidad']
                        });
                    }, 400);
                }
                return;
            }

            // Caso 2: cantrip
            if (useSpellBtn.dataset.cantrip === 'true') {
                modal.style.display = 'none';
                const r = consumirAccion(tipoAccion);
                const notasTxt = notasEquipoActuales.length ? ` 🪄 ${notasEquipoActuales.join(' ')}` : '';
                mostrarToast(`¡Cantrip usado! ✨ ${r.mensaje}${notasTxt}`.trim());
                useSpellBtn.dataset.cantrip = '';

                const cantripUsado = itemContextoActual && itemContextoActual.item ? itemContextoActual.item : itemContextoActual;
                if (cantripUsado) {
                    setTimeout(() => {
                        procesarEfectos(cantripUsado, {
                            nivelPersonaje: nivelPersonaje,
                            tipos: ['hechizo', 'cantrip'],
                            danoTexto: ultimoDanoMostrado
                        });
                    }, 400);
                }
                return;
            }

            // Caso 3: arma
            const arma = useSpellBtn.dataset.arma;
            if (arma) {
                if (!armasEquipadas.includes(arma)) {
                    mostrarToast(`No podés usar ${arma} sin equiparla`, 'warning');
                    return;
                }
                modal.style.display = 'none';

                // Extra Attack: el primer golpe gasta la Acción de verdad. Si el personaje tiene
                // Extra Attack, ese golpe habilita N-1 golpes más que NO vuelven a gastar la Acción
                // (se van descontando de turnoEstado.golpesRestantes). Cada vez que se vuelve a
                // gastar una Acción entera (turno nuevo, o Action Surge), se recarga de nuevo.
                let mensajeAccion = '';
                let esGolpeExtra = false;
                if (turnoEstado.accion > 0) {
                    const r = consumirAccion(tipoAccion);
                    mensajeAccion = r.mensaje;
                    turnoEstado.golpesRestantes = extraAttacks > 1 ? extraAttacks - 1 : 0;
                    guardarTurnoEstado();
                } else if (turnoEstado.golpesRestantes > 0) {
                    esGolpeExtra = true;
                    turnoEstado.golpesRestantes -= 1;
                    guardarTurnoEstado();
                } else {
                    mostrarToast('Ya usaste tu Acción este turno', 'warning');
                    return;
                }

                const restantesTxt = turnoEstado.golpesRestantes > 0
                    ? ` (te quedan ${turnoEstado.golpesRestantes} golpe${turnoEstado.golpesRestantes > 1 ? 's' : ''} más de Extra Attack)`
                    : '';
                mostrarToast(`¡${arma} usada! ⚔️${esGolpeExtra ? ' (golpe extra)' : ''} ${mensajeAccion}${restantesTxt}`.trim());
                useSpellBtn.dataset.arma = '';

                // Procesar efectos del arma (Great Weapon Fighting, Improved Critical, Weapon Mastery, etc.)
                const armaObj = data.equipo.find(e => e.nombre === arma);
                if (armaObj) {
                    setTimeout(() => {
                        procesarEfectos(armaObj, {
                            nivelPersonaje: nivelPersonaje,
                            tipos: ['arma'],
                            danoTexto: ultimoDanoMostrado
                        });
                    }, 400);
                }

                // Si la clase tiene Smite y el arma califica, abrir modal de Smite
                const haySmite = smitesData.length > 0 && armaPuedeGatillarSmite(arma, data.equipo);
                if (haySmite) {
                    setTimeout(() => abrirModalSmite(), 600);
                }

                // Panel de opciones post-golpe (Martial Arts, Flurry of Blows, Stunning Strike,
                // Hand of Harm, etc.) — solo tiene sentido después de un golpe cuerpo a cuerpo.
                const esMelee = armaObj && (armaObj.tipo === 'melee' || armaObj.tipo === 'finesse');
                const tienePostGolpe = (window._habilidadesUsoData || []).some(h => h.postGolpe);
                if (esMelee && tienePostGolpe) {
                    setTimeout(() => abrirModalPostGolpe(), haySmite ? 900 : 600);
                }
                return;
            }

            // Caso 4: hechizo con ranura
            const nivel = useSpellBtn.dataset.nivel;
            if (!nivel) return;

            // Si el hechizo permite elegir con qué ranura lanzarlo (ej: Fireball, Guiding Bolt),
            // abrir el selector de ranura en vez de consumir automáticamente la ranura base.
            const hechizoConEscala = itemContextoActual && itemContextoActual.item ? itemContextoActual.item : itemContextoActual;
            if (hechizoConEscala && hechizoConEscala.escalaSlot) {
                modal.style.display = 'none';
                abrirModalEscalaSlot(hechizoConEscala, tipoAccion);
                return;
            }

            let actual = parseInt(ranurasState[nivel]);
            if (actual > 0) {
                actual -= 1;
                ranurasState[nivel] = String(actual);
                guardarRanuras();
                actualizarRanuraDOM(nivel);
                modal.style.display = 'none';
                const r = consumirAccion(tipoAccion);
                const notasTxt = notasEquipoActuales.length ? ` 🪄 ${notasEquipoActuales.join(' ')}` : '';
                if (actual === 0) {
                    mostrarToast(`¡Hechizo usado! Sin ranuras de ${nivel}. ${r.mensaje}${notasTxt}`.trim(), 'warning');
                } else {
                    mostrarToast(`¡Hechizo usado! Quedan ${actual} de ${nivel}. ${r.mensaje}${notasTxt}`.trim());
                }

                // Disparar efectos automáticos del hechizo (Blessed Healer, Disciple of Life, etc.)
                const hechizoUsado = itemContextoActual && itemContextoActual.item ? itemContextoActual.item : itemContextoActual;
                if (hechizoUsado) {
                    const nivelNumerico = parseInt(nivel.replace(/[^0-9]/g, '')) || 1;
                    setTimeout(() => {
                        procesarEfectos(hechizoUsado, {
                            nivelHechizo: nivelNumerico,
                            nivelPersonaje: nivelPersonaje,
                            tipos: ['hechizo'],
                            danoTexto: ultimoDanoMostrado
                        });
                    }, 400);
                }

                // Si el hechizo trae datos de familiar (Find Familiar, Find Steed, etc.), invocarlo
                if (hechizoUsado && hechizoUsado.familiar) {
                    setTimeout(() => activarFamiliar(hechizoUsado.familiar), 900);
                }
            }
        });
    }

    // Listener: Reset de ranuras (descanso largo)
    // Botón Descanso (header)
    const btnDescanso = document.getElementById('btn-descanso');
    if (btnDescanso) {
        btnDescanso.addEventListener('click', () => {
            document.getElementById('rest-modal').style.display = 'flex';
        });
    }

    // Botones dentro del modal de descanso
    const restCorto = document.getElementById('rest-corto');
    const restLargo = document.getElementById('rest-largo');
    const restBorrar = document.getElementById('rest-borrar');
    if (restCorto) restCorto.addEventListener('click', () => tomarDescanso('corto'));
    if (restLargo) {
        restLargo.addEventListener('click', () => {
            // Cerrar modal de descanso y abrir el de confirmación del DM
            document.getElementById('rest-modal').style.display = 'none';
            document.getElementById('confirm-largo-modal').style.display = 'flex';
        });
    }
    if (restBorrar) {
        restBorrar.addEventListener('click', () => {
            document.getElementById('rest-modal').style.display = 'none';
            document.getElementById('confirm-borrar-modal').style.display = 'flex';
        });
    }

    // Modal de confirmación de borrado: listeners
    const confirmBorrarSi = document.getElementById('confirm-borrar-si');
    const confirmBorrarNo = document.getElementById('confirm-borrar-no');
    const confirmBorrarClose = document.querySelector('.close-btn-borrar');
    const confirmBorrarModal = document.getElementById('confirm-borrar-modal');

    if (confirmBorrarSi) {
        confirmBorrarSi.addEventListener('click', () => {
            // Borrar TODAS las keys de localStorage que pertenezcan a este personaje
            const keysABorrar = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(STORAGE_PREFIX)) {
                    keysABorrar.push(key);
                }
            }
            keysABorrar.forEach(k => localStorage.removeItem(k));
            // Recargar la página
            location.reload();
        });
    }
    if (confirmBorrarNo) {
        confirmBorrarNo.addEventListener('click', () => {
            confirmBorrarModal.style.display = 'none';
        });
    }
    if (confirmBorrarClose) {
        confirmBorrarClose.addEventListener('click', () => {
            confirmBorrarModal.style.display = 'none';
        });
    }

    // Modal de confirmación del DM para descanso largo
    const confirmSi = document.getElementById('confirm-largo-si');
    const confirmNo = document.getElementById('confirm-largo-no');
    if (confirmSi) {
        confirmSi.addEventListener('click', () => {
            document.getElementById('confirm-largo-modal').style.display = 'none';
            tomarDescanso('largo');
        });
    }
    if (confirmNo) {
        confirmNo.addEventListener('click', () => {
            document.getElementById('confirm-largo-modal').style.display = 'none';
            mostrarToast('Descanso largo no aprobado por el DM', 'warning');
        });
    }

    // Modal de confirmación: cerrar con la X
    const confirmModal = document.getElementById('confirm-largo-modal');
    const confirmCloseBtn = document.querySelector('.close-btn-confirm');
    if (confirmCloseBtn) {
        confirmCloseBtn.addEventListener('click', () => confirmModal.style.display = 'none');
    }

    // Cerrar modal de descanso
    const restModal = document.getElementById('rest-modal');
    const restCloseBtn = document.querySelector('.close-btn-rest');
    if (restCloseBtn) {
        restCloseBtn.addEventListener('click', () => restModal.style.display = 'none');
    }

    // Listeners para cerrar modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
    }

    // Modal de Vida: botones de daño/curación
    document.querySelectorAll('.hp-btn[data-amount]').forEach(btn => {
        btn.addEventListener('click', () => {
            const cantidad = parseInt(btn.dataset.amount);
            modificarVida(cantidad);
        });
    });

    // Modal de Vida: botones de vida máxima
    document.querySelectorAll('.hp-btn[data-max-amount]').forEach(btn => {
        btn.addEventListener('click', () => {
            const cantidad = parseInt(btn.dataset.maxAmount);
            modificarVidaMaxima(cantidad);
        });
    });

    // Modal de Vida: cerrar
    const hpModal = document.getElementById('hp-modal');
    const hpCloseBtn = document.querySelector('.close-btn-hp');
    if (hpCloseBtn) {
        hpCloseBtn.addEventListener('click', () => hpModal.style.display = 'none');
    }

    // Modal de CA: botones de +/-
    document.querySelectorAll('.hp-btn[data-ca-amount]').forEach(btn => {
        btn.addEventListener('click', () => {
            const cantidad = parseInt(btn.dataset.caAmount);
            modificarCa(cantidad);
        });
    });

    // Modal de CA: botón restaurar
    const caReset = document.getElementById('ca-reset');
    if (caReset) {
        caReset.addEventListener('click', () => {
            caActual = caOriginal;
            guardarCA();
            actualizarCaDOM();
            mostrarToast('CA restaurada ✓');
        });
    }

    // Modal de CA: cerrar
    const caModal = document.getElementById('ca-modal');
    const caCloseBtn = document.querySelector('.close-btn-ca');
    if (caCloseBtn) {
        caCloseBtn.addEventListener('click', () => caModal.style.display = 'none');
    }

    // Modal de Hit Dice: botón menos (mínimo 0)
    const hdMenos = document.getElementById('hd-menos');
    const hdMas = document.getElementById('hd-mas');
    if (hdMenos) {
        hdMenos.addEventListener('click', () => {
            if (hdCantidadAUsar > 0) {
                hdCantidadAUsar -= 1;
                actualizarHdCantidadDOM();
            }
        });
    }
    if (hdMas) {
        hdMas.addEventListener('click', () => {
            // Máximo: la cantidad de Hit Dice disponibles
            if (hdCantidadAUsar < hitDiceActual) {
                hdCantidadAUsar += 1;
                actualizarHdCantidadDOM();
            } else {
                mostrarToast(`No tenés más Hit Dice disponibles (${hitDiceActual}/${hitDiceMaximo})`, 'warning');
            }
        });
    }

    // Modal de Hit Dice: botón Siguiente (paso 1 → paso 2)
    const hdSiguiente = document.getElementById('hd-siguiente');
    if (hdSiguiente) {
        hdSiguiente.addEventListener('click', () => {
            if (hdCantidadAUsar === 0) return;
            document.getElementById('hd-paso-1').style.display = 'none';
            document.getElementById('hd-paso-2').style.display = 'block';
            document.getElementById('hd-curacion-input').value = 0;
        });
    }

    // Modal de Hit Dice: botón Sin curarse (cierra el modal sin gastar dados)
    const hdSaltar = document.getElementById('hd-saltar');
    if (hdSaltar) {
        hdSaltar.addEventListener('click', () => {
            document.getElementById('hd-modal').style.display = 'none';
            mostrarToast('Descanso corto finalizado sin curarse');
        });
    }

    // Modal de Hit Dice: botón Volver (paso 2 → paso 1)
    const hdVolver = document.getElementById('hd-volver');
    if (hdVolver) {
        hdVolver.addEventListener('click', () => {
            document.getElementById('hd-paso-2').style.display = 'none';
            document.getElementById('hd-paso-1').style.display = 'block';
        });
    }

    // Modal de Hit Dice: botón Aceptar (aplica curación y consume dados)
    const hdAceptar = document.getElementById('hd-aceptar');
    if (hdAceptar) {
        hdAceptar.addEventListener('click', () => {
            const input = document.getElementById('hd-curacion-input');
            const curacion = Math.max(0, parseInt(input.value) || 0);
            // Curar sin pasarse del máximo
            vidaActual = Math.min(vidaMaxima, vidaActual + curacion);
            guardarVida();
            actualizarVidaDOM();
            // Consumir los dados usados
            hitDiceActual -= hdCantidadAUsar;
            guardarHitDice();
            actualizarHitDiceDOM();
            // Cerrar modal
            document.getElementById('hd-modal').style.display = 'none';
            mostrarToast(`Te curaste ${curacion} HP usando ${hdCantidadAUsar}${hitDiceDado}`);
        });
    }

    // Modal de Smite: cerrar
    const smiteModal = document.getElementById('smite-modal');
    const smiteCloseBtn = document.querySelector('.close-btn-smite');
    const smiteCancelar = document.getElementById('smite-cancelar');
    if (smiteCloseBtn) {
        smiteCloseBtn.addEventListener('click', () => smiteModal.style.display = 'none');
    }
    if (smiteCancelar) {
        smiteCancelar.addEventListener('click', () => {
            smiteModal.style.display = 'none';
            mostrarToast('Smite no usado');
        });
    }

    // Modal de escala de ranura (Fireball, Guiding Bolt, etc.): cerrar/cancelar
    const escalaModal = document.getElementById('escala-modal');
    const escalaCloseBtn = document.querySelector('.close-btn-escala');
    const escalaCancelar = document.getElementById('escala-cancelar');
    if (escalaCloseBtn) {
        escalaCloseBtn.addEventListener('click', () => escalaModal.style.display = 'none');
    }
    if (escalaCancelar) {
        escalaCancelar.addEventListener('click', () => {
            escalaModal.style.display = 'none';
            mostrarToast('Hechizo no usado');
        });
    }

    // Modal de Wild Shape (selector de animal): cerrar/cancelar
    const wildshapeModal = document.getElementById('wildshape-modal');
    const wildshapeCloseBtn = document.querySelector('.close-btn-wildshape');
    const wildshapeCancelar = document.getElementById('wildshape-cancelar');
    if (wildshapeCloseBtn) {
        wildshapeCloseBtn.addEventListener('click', () => wildshapeModal.style.display = 'none');
    }
    if (wildshapeCancelar) {
        wildshapeCancelar.addEventListener('click', () => {
            wildshapeModal.style.display = 'none';
            mostrarToast('Wild Shape no usado');
        });
    }

    // Modal de restaurar ranuras (Pearl of Power, Arcane/Natural Recovery): cerrar con la X
    const restaurarModal = document.getElementById('restaurar-modal');
    const restaurarCloseBtn = document.querySelector('.close-btn-restaurar');
    if (restaurarCloseBtn) {
        restaurarCloseBtn.addEventListener('click', () => restaurarModal.style.display = 'none');
    }

    // Modal de opciones post-golpe: cerrar con la X o con "Listo / Ninguna"
    const postGolpeModal = document.getElementById('post-golpe-modal');
    const postGolpeCloseBtn = document.querySelector('.close-btn-post-golpe');
    const postGolpeListoBtn = document.getElementById('post-golpe-listo');
    if (postGolpeCloseBtn) {
        postGolpeCloseBtn.addEventListener('click', () => postGolpeModal.style.display = 'none');
    }
    if (postGolpeListoBtn) {
        postGolpeListoBtn.addEventListener('click', () => postGolpeModal.style.display = 'none');
    }


    // === UI de selección de Land (Circle of the Land, DnD 5.5e) ===
    const landBadge = document.getElementById('land-badge');
    const landModal = document.getElementById('land-modal');
    const landCloseBtn = document.querySelector('.close-btn-land');

    // Guardar en globales para que abrirModalLand() y tomarDescanso() puedan usarlos sin closures
    circuloDeLaTierraGlobal = data.circuloDeLaTierra || null;
    landActualGlobal = landActual;

    if (data.circuloDeLaTierra && landBadge) {
        landBadge.style.display = 'inline-block';
        landBadge.textContent = landActual
            ? `${EMOJI_LAND[landActual] || '🌍'} Land: ${landActual}`
            : '🌍 Land: Esperando selección';
        landBadge.addEventListener('click', () => abrirModalLand());

        // Si la clase tiene Circle of the Land pero no hay Land elegida (recién cargada la
        // página, o se reseteó en el último descanso largo), abrir el selector automáticamente.
        if (!landActual) {
            setTimeout(() => abrirModalLand(), 400);
        }
    }
    if (landCloseBtn && landModal) {
        landCloseBtn.addEventListener('click', () => landModal.style.display = 'none');
    }

    // Modal de Hit Dice: cerrar
    const hdModal = document.getElementById('hd-modal');
    const hdCloseBtn = document.querySelector('.close-btn-hd');
    if (hdCloseBtn) {
        hdCloseBtn.addEventListener('click', () => hdModal.style.display = 'none');
    }

    // Modal de imagen del personaje: cerrar
    const imagenModal = document.getElementById('imagen-modal');
    const imagenCloseBtn = document.querySelector('.close-btn-imagen');
    if (imagenCloseBtn) {
        imagenCloseBtn.addEventListener('click', () => imagenModal.style.display = 'none');
    }

    // Modal genérico de efectos: cerrar
    const efectosModal = document.getElementById('efectos-modal');
    const efectosCloseBtn = document.querySelector('.close-btn-efectos');
    const efectosCerrar = document.getElementById('efectos-cerrar');

    const cerrarEfectosYContinuar = () => {
        efectosModal.style.display = 'none';
        // Si hay un efecto de Second Wind o similar que requiere abrir modal de vida
        if (abrirModalVidaTrasEfectos) {
            abrirModalVidaTrasEfectos = false;
            setTimeout(() => {
                document.getElementById('hp-modal').style.display = 'flex';
                actualizarVidaDOM();
            }, 200);
        }
    };

    if (efectosCloseBtn) {
        efectosCloseBtn.addEventListener('click', cerrarEfectosYContinuar);
    }
    if (efectosCerrar) {
        efectosCerrar.addEventListener('click', cerrarEfectosYContinuar);
    }
}

document.addEventListener('DOMContentLoaded', init);

function aplicarImprovements(personaje){

    console.log("Aplicando improvements TRUE");

    if(!personaje?.improvements){
        console.log("No existe improvements");
        return;
    }

    const stats = personaje.stats;

    console.log("Stats antes:", JSON.parse(JSON.stringify(stats)));
    console.log("Improvements:", personaje.improvements);

    // Race
    if(Array.isArray(personaje.improvements.race)){

        console.log("Race:", personaje.improvements.race);

        personaje.improvements.race.forEach(r=>{

            console.log("Procesando Race:", r);
            console.log("Antes:", r.atributo, stats[r.atributo]);

            if(stats[r.atributo]!=null){

                stats[r.atributo]+=Number(r.valor)||0;

                console.log("Después:", r.atributo, stats[r.atributo]);

            }else{

                console.log("No existe stat:", r.atributo);

            }

        });

    }

    // Feats
    if(Array.isArray(personaje.improvements.feats)){

        console.log("Feats:", personaje.improvements.feats);

        personaje.improvements.feats.forEach(f=>{

            if(!f.atributos)
                return;

            Object.entries(f.atributos).forEach(([stat,valor])=>{

                console.log("Feat:", stat, valor, "Antes:", stats[stat]);

                if(stats[stat]!=null){

                    stats[stat]+=valor;

                    console.log("Después:", stat, stats[stat]);

                }else{

                    console.log("No existe stat:", stat);

                }

            });

        });

    }

    // ASI
    if(Array.isArray(personaje.improvements.asi)){

        console.log("ASI:", personaje.improvements.asi);

        personaje.improvements.asi.forEach(a=>{

            Object.entries(a.atributos).forEach(([stat,valor])=>{

                console.log("ASI:", stat, valor, "Antes:", stats[stat]);

                if(stats[stat]!=null){

                    stats[stat]+=valor;

                    console.log("Después:", stat, stats[stat]);

                }else{

                    console.log("No existe stat:", stat);

                }

            });

        });

    }

    console.log("Stats finales:", JSON.parse(JSON.stringify(stats)));

}