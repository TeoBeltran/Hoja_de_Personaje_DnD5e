import {
    ICONOS_PERSONAJE,
    PROFICIENCIAS_POR_CLASE,
    NOMBRES_STATS,
    SKILL_STAT,
    SKILL_DESC
} from "./Scripts/Datos/Constantes.js";

import {
    calcularProficiencia,
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
let manosUsadas = 0;       // total de manos ocupadas (escudo + armas)
let modDexGlobal = 0;
let modStrGlobal = 0;
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
let turnoEstado = { accion: 1, bonus: 1, reaccion: 1 };
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

// Procesa los efectos de un item y muestra el modal si hay alguno aplicable
function procesarEfectos(item, contexto) {
    if (!item || !item.efectos || !Array.isArray(item.efectos)) return;

    const efectosAplicables = item.efectos.filter(e => {
        // Si requiere un rasgo, validar que el personaje lo tenga
        if (e.rasgoRequerido && !tieneRasgo(e.rasgoRequerido)) return false;
        return true;
    });

    if (efectosAplicables.length === 0) return;

    // Si hay un efecto de tipo "notificacionYAbreVida", marcar para abrir modal de vida al cerrar
    abrirModalVidaTrasEfectos = efectosAplicables.some(e => e.tipo === 'notificacionYAbreVida');

    // Construir HTML del modal
    const lista = document.getElementById('efectos-lista');
    if (!lista) return;
    lista.innerHTML = '';

    efectosAplicables.forEach(efecto => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 12px; background-color: #fbf9f4; border: 1px solid var(--border-color); border-left: 4px solid var(--accent-color); border-radius: var(--border-radius);';

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
            <div style="font-weight: bold; color: var(--accent-color); margin-bottom: 4px;">${efecto.descripcion}</div>
            <div style="font-size: 0.95rem;">${mensaje}</div>
        `;
        lista.appendChild(div);
    });

    document.getElementById('efectos-modal').style.display = 'flex';
}

// === Divine Smite ===
let smiteData = null; // Guarda el objeto smite del JSON si la clase lo tiene

// Mapea nivel de hechizo a ranura.
// Genérico: soporta cualquier "NIVEL n" (1-9), no solo hasta el 4.
// Nota: ya NO fuerza a los Brujos a usar siempre "Nivel 3". El nivel real de
// la ranura de Pact Magic depende del nivel del personaje (nivel 3 hasta
// personaje nivel 6, nivel 4 desde personaje nivel 7, etc.), así que cada
// hechizo del JSON debe tener puesto directamente el "nivel" real de su ranura
// (ej: "NIVEL 4" si el personaje ya tiene ranuras de nivel 4).
function mapNivelHechizoARanura(nivelHechizo) {
    if (nivelHechizo === "CANTRIPS") return null; // Cantrips nunca consumen
    const match = /^NIVEL (\d+)$/.exec(nivelHechizo || '');
    if (!match) return null;
    return `Nivel ${match[1]}`;
}

let ranurasInfo = {}; // Guarda qué descanso recupera cada ranura
let habilidadesInfo = {}; // Guarda qué descanso recupera cada habilidad



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
    } else {
        // Sin armadura: 10 + DEX
        ca = 10 + modDexGlobal;
    }
    if (escudoEquipadoId) {
        ca += escudoEquipadoBase;
    }
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
    let manos = 0;
    if (escudoEquipadoId) {
        const esc = equipoData.find(e => e.nombre === escudoEquipadoId);
        if (esc) manos += (esc.manos || 1);
    }
    armasEquipadas.forEach(nombre => {
        const arma = equipoData.find(e => e.nombre === nombre);
        if (arma) manos += (arma.manos || 1);
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
    document.getElementById('inv-item-modal').style.display = 'flex';
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
        try { turnoEstado = JSON.parse(guardado); } catch(e) { turnoEstado = { accion: 1, bonus: 1, reaccion: 1 }; }
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
    if (t.includes('bonus') || t.includes('adicional')) {
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

function resetearTurno() {
    turnoEstado = { accion: 1, bonus: 1, reaccion: 1 };
    guardarTurnoEstado();
    actualizarTurnoDOM();
}

// === Divine Smite ===

// Verifica si el arma usada califica para Smite (debe ser melee)
function armaPuedeGatillarSmite(nombreArma, equipoData) {
    if (!smiteData) return false;
    const arma = equipoData.find(e => e.nombre === nombreArma);
    if (!arma) return false;
    // Smite solo aplica a ataques melee (no a ranged como ballestas)
    // Consideramos melee si tipo es 'melee' o si tiene 'finesse' (las finesse pueden usarse melee)
    return arma.tipo === 'melee' || arma.tipo === 'finesse';
}

// Abre el modal de Smite con los niveles disponibles
function abrirModalSmite() {
    const smiteModal = document.getElementById('smite-modal');
    const cont = document.getElementById('smite-opciones');
    if (!smiteModal || !cont || !smiteData) return;

    cont.innerHTML = '';

    // Recorrer ranuras y mostrar solo las disponibles con daño correspondiente
    Object.keys(smiteData.danoPorNivel).forEach(nivelNum => {
        const nivelKey = `Nivel ${nivelNum}`;
        const disponibles = parseInt(ranurasState[nivelKey] || 0);
        const dano = smiteData.danoPorNivel[nivelNum];

        const btn = document.createElement('button');
        btn.className = 'hp-btn';
        btn.style.cssText = `width: 100%; padding: 12px; text-align: left; font-weight: bold; ${disponibles <= 0 ? 'background-color: #999; cursor: not-allowed;' : 'background-color: #6a1b9a; color: white;'}`;
        btn.disabled = disponibles <= 0;
        btn.innerHTML = `Slot Nivel ${nivelNum} → ${dano} ${smiteData.tipoDano} <span style="float: right; font-weight: normal; font-size: 0.85rem;">(${disponibles} disponibles)</span>`;

        btn.onclick = () => {
            if (disponibles <= 0) return;
            // Consumir la ranura
            ranurasState[nivelKey] = String(disponibles - 1);
            guardarRanuras();
            actualizarRanuraDOM(nivelKey);
            smiteModal.style.display = 'none';
            mostrarToast(`⚔️ ¡Divine Smite! +${dano} ${smiteData.tipoDano}`);
        };
        cont.appendChild(btn);
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
                mostrarToast(`✨ ¡${item.nombre} usado! ${dano}${item.tipoDano ? ' ' + item.tipoDano : ''} (ranura Nivel ${nivelNum}). ${r.mensaje}`.trim());

                // Disparar efectos automáticos y familiar igual que un hechizo normal
                if (item.efectos) {
                    setTimeout(() => {
                        procesarEfectos(item, { nivelHechizo: nivelNum, nivelPersonaje: nivelPersonajeGlobal });
                    }, 400);
                }
                if (item.familiar) {
                    setTimeout(() => activarFamiliar(item.familiar), item.efectos ? 900 : 400);
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
        if (tipo === 'largo' || tipoRecup === 'corto') {
            habilidadesUsoState[nombre] = habilidadesUsoOriginales[nombre];
            actualizarHabilidadUsoDOM(nombre);
        }
    });
    guardarHabilidadesUso();

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
    }

    // Cerrar modal y notificar
    document.getElementById('rest-modal').style.display = 'none';
    if (tipo === 'largo') {
        mostrarToast('🛏️ Descanso largo completado. ¡Todo restaurado!');
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
        data.salvaciones = generarSalvaciones(statsGlobal, data.personaje.clase, profBonusTmp);
        data.habilidades = generarHabilidades(data.habilidades, statsGlobal, profBonusTmp);
    }

    // Stat principal según clase (para Spell Save DC, Spell Attack Bonus, etc)
    const profDatos = PROFICIENCIAS_POR_CLASE[claseActual] || { principal: 'STR' };
    nombreModPrincipal = profDatos.principal;
    modPrincipal = obtenerMod(data.modificadores, nombreModPrincipal);

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
                    (data.habilidadesUso || []).forEach(h => {
                        if (h.formasSalvajes) {
                            const encontrada = h.formasSalvajes.find(f => f.id === saved.id);
                            if (encontrada) datosEncontrados = encontrada;
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
    const modDex = formatMod(obtenerMod(data.modificadores, "DEX"));
    proficienciaActual = profBonusTmp;

    // Pre-cargar armadura, escudo y armas equipadas desde localStorage
    modDexGlobal = obtenerMod(data.modificadores, "DEX");

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
    data.salvaciones.forEach(i => vG.appendChild(createBtn(i)));
    data.habilidades.forEach(i => skG.appendChild(createBtn(i)));

    // Rasgos (mergeamos los del background primero para que aparezcan en la lista)
    aplicarBackground(data.background, data.equipo);

    rasgosGlobal.forEach(i => {
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
        if (i.dano && i.tipo) {
            const modUsado = (i.tipo === 'finesse') ? modDexNum : modStr;
            const nombreModUsado = (i.tipo === 'finesse') ? 'DEX' : 'STR';
            const bonosInfo = calcularBonosDano(i, false, rasgosGlobal, statsGlobal, armasEquipadas);
            danoFinal = formatearDanoConBonos(i.dano, modUsado, bonosInfo.detalles);
        }
        if (i.ataques && i.ataques > 1 && danoFinal) {
            danoFinal = `${danoFinal} ×${i.ataques}`;
        }

        const danoHTML = danoFinal ? `<span class="skill-mod" style="background-color: #6a1b9a; color: white;">${danoFinal}</span>` : '';
        const tipoDanoHTML = i.tipoDano ? `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid var(--accent-color); border-radius: 4px; color: var(--accent-color); margin-left: 6px;">${i.tipoDano}</span>` : '';

        let armaduraHTML = '';
        if (i.esArmadura) {
            const esEscudo = (i.tipoArmadura === 'escudo');
            const labelBadge = esEscudo ? `+${i.armaduraBase} CA` : `CA: ${i.armaduraBase}`;
            const tipoLabel = i.tipoArmadura ? ` (${i.tipoArmadura})` : '';
            armaduraHTML = `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #6a1b9a; border-radius: 4px; color: #6a1b9a; margin-right: 6px;">${labelBadge}${tipoLabel}</span>`;
        }

        let manosHTML = '';
        if (i.manos && i.manos > 0) {
            manosHTML = `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid var(--accent-color); border-radius: 4px; color: var(--accent-color); margin-right: 6px;">${i.manos === 2 ? '2 manos' : '1 mano'}</span>`;
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
                </div>
            </div>
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
            const bonosModalInfo = calcularBonosDano(item, esHechizoItem, rasgosGlobal, statsGlobal, data.equipo);
            const ataquesItem = esHechizoItem ? resolverAtaques(item, nivelPersonaje) : (item.ataques || 1);
            danoTexto = formatearDanoConBonos(danoBase, modUsado, bonosModalInfo.detalles);
            if (ataquesItem > 1) danoTexto = `${danoTexto} ×${ataquesItem}`;
            partes.push(`<span class="skill-mod" style="background-color: #6a1b9a; color: white;">${danoTexto}</span>`);

            // Tooltip con detalle de bonos
            const detalleStr = formatearDetalleBonos(modUsado, nombreModUsado, bonosModalInfo.detalles);
            if (detalleStr) {
                partes.push(`<span style="font-size: 0.8rem; color: var(--text-muted); padding: 2px 6px;">${detalleStr}</span>`);
            }
        }

        // Tipo de daño
        if (item.tipoDano) {
            partes.push(`<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid var(--accent-color); border-radius: 4px; color: var(--accent-color);">${item.tipoDano}</span>`);
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
        useSpellBtn.style.backgroundColor = '#6a1b9a'; // Reset color

        const tieneDano = !!item.dano;
        const esHabilidad = !!item.usos || item.tipo === 'smite';
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

            // Caso especial: Divine Smite no se puede usar directamente
            if (item.tipo === 'smite') {
                useSpellBtn.dataset.smite = 'true';
                useSpellBtn.disabled = false;
                useSpellBtn.textContent = 'Intentar usar';
            } else {
                useSpellBtn.dataset.habilidad = item.nombre;
                useSpellBtn.dataset.smite = '';
                const dispActuales = parseInt(habilidadesUsoState[item.nombre].split('/')[0]);
                useSpellBtn.disabled = dispActuales <= 0;
                useSpellBtn.textContent = dispActuales > 0
                    ? `Usar Habilidad (${habilidadesUsoState[item.nombre]})`
                    : 'Sin usos disponibles';
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

        // Llenar badges (mini cards) y línea celeste
        renderModalBadges(item);
        renderModalInfoLinea(item);

        // Mostrar botón "Usar" si tiene daño (es un arma)
        renderBotonUsar(item, 'arma');

        // Botón Equipar (solo armaduras, escudos o armas con manos)
        const modalEquipar = document.getElementById('modal-equipar');
        const btnEqModal = document.getElementById('btn-equipar-modal');
        const esEquipable = item.esArmadura || (item.manos && item.manos > 0);

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
        smiteData = data.habilidadesUso.find(h => h.tipo === 'smite') || null;
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
    window.addEventListener('click', (e) => { if (e.target === inventarioModal) inventarioModal.style.display = 'none'; });

    if (invItemCloseBtn) {
        invItemCloseBtn.addEventListener('click', () => invItemModal.style.display = 'none');
    }
    window.addEventListener('click', (e) => { if (e.target === invItemModal) invItemModal.style.display = 'none'; });

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
    window.addEventListener('click', (e) => {
        if (e.target === invConfirmModal) {
            cantidadInventarioPendiente = 0;
            invConfirmModal.style.display = 'none';
        }
    });

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
    window.addEventListener('click', (e) => { if (e.target === familiarModal) familiarModal.style.display = 'none'; });

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

    // Click en cada contador → solo permite RESTAURAR (no gastar manualmente)
    // Acción Adicional y Reacción NO se pueden restaurar a mano (solo al terminar turno).
    // Acción solo se puede restaurar si tiene Extra Attack (max > 1).
    document.querySelectorAll('.turno-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tipo = btn.dataset.tipo;
            // Bonus y Reacción no se restauran manualmente
            if (tipo !== 'accion') return;
            // Solo restaurar Acción si tiene Extra Attack
            if (extraAttacks <= 1) return;
            if (turnoEstado[tipo] === 0) {
                turnoEstado[tipo] = 1;
                guardarTurnoEstado();
                actualizarTurnoDOM();
                mostrarToast('Acción restaurada');
            }
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
    window.addEventListener('click', (e) => { if (e.target === actionSurgeModal) actionSurgeModal.style.display = 'none'; });

    // Calcular y mostrar Save DC y Spell Attack Bonus en headers
    const saveDC = 8 + proficienciaActual + modPrincipal;
    const spellAttackBonus = formatMod(proficienciaActual + modPrincipal);

    // Calcular Atk Bonus de armas Melee (STR) y Finesse (DEX)
    const atkMeleeBonus = formatMod(proficienciaActual + modStr);
    const atkFinesseBonus = formatMod(proficienciaActual + modDexNum);

    // Detectar si el personaje tiene armas de cada tipo
    const tieneMelee = data.equipo.some(e => e.tipo === 'melee');
    const tieneFinesse = data.equipo.some(e => e.tipo === 'finesse');

    document.querySelectorAll('.proficient').forEach(span => {
        const txt = span.textContent;
        if (txt.includes('Spell Attack Bonus')) {
            span.textContent = `Spell Attack Bonus: ${spellAttackBonus}`;
        } else if (txt.includes('Spell Save DC')) {
            span.textContent = `Spell Save DC: ${saveDC}`;
        } else if (txt.includes('Save DC')) {
            span.textContent = `Save DC: ${saveDC}`;
        } else if (txt.includes('Atk Melee')) {
            span.textContent = `Atk Melee: ${atkMeleeBonus}`;
            if (!tieneMelee) span.style.display = 'none';
        } else if (txt.includes('Atk Finesse')) {
            span.textContent = `Atk Finesse: ${atkFinesseBonus}`;
            if (!tieneFinesse) span.style.display = 'none';
        }
    });

    // Habilidades con usos
    if (data.habilidadesUso) {
        // Inicializar estado: localStorage > JSON
        data.habilidadesUso.forEach(h => {
            if (h.usos) {
                habilidadesUsoOriginales[h.nombre] = h.usos;
                habilidadesInfo[h.nombre] = h.recupera || 'largo';
            }
        });
        const guardadasHab = localStorage.getItem(STORAGE_PREFIX + 'habilidadesUso');
        if (guardadasHab) {
            habilidadesUsoState = JSON.parse(guardadasHab);
            data.habilidadesUso.forEach(h => {
                if (!(h.nombre in habilidadesUsoState)) habilidadesUsoState[h.nombre] = h.usos;
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
                ? `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid var(--accent-color); border-radius: 4px; color: var(--accent-color);">${h.tipoDano}</span>`
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
            const tipoDanoHTML = h.tipoDano ? `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid var(--accent-color); border-radius: 4px; color: var(--accent-color); margin-left: 6px;">${h.tipoDano}</span>` : '';

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

            // Validar que tenga acciones disponibles ANTES de consumir
            if (tipoAccion) {
                const t = tipoAccion.toLowerCase();
                if (t.includes('bonus') || t.includes('adicional')) {
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
                    if (turnoEstado.accion === 0) {
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

            // Caso 1: habilidad con usos
            const habilidad = useSpellBtn.dataset.habilidad;
            if (habilidad) {
                const habObj = data.habilidadesUso ? data.habilidadesUso.find(h => h.nombre === habilidad) : null;

                // Si la habilidad tiene formas salvajes (Wild Shape), abrir el selector de animal
                // en vez de gastar el uso automáticamente; el uso se gasta al elegir el animal.
                if (habObj && habObj.formasSalvajes) {
                    modal.style.display = 'none';
                    useSpellBtn.dataset.habilidad = '';
                    abrirModalFormaSalvaje(habObj, tipoAccion);
                    return;
                }

                usarHabilidad(habilidad);
                useSpellBtn.dataset.habilidad = '';
                const r = consumirAccion(tipoAccion);
                if (r.mensaje) mostrarToast(r.mensaje);

                // Procesar efectos de la habilidad (Second Wind, etc.)
                if (habObj && habObj.efectos) {
                    setTimeout(() => {
                        procesarEfectos(habObj, {
                            nivelPersonaje: nivelPersonaje
                        });
                    }, 400);
                }
                return;
            }

            // Caso 2: cantrip
            if (useSpellBtn.dataset.cantrip === 'true') {
                modal.style.display = 'none';
                const r = consumirAccion(tipoAccion);
                mostrarToast(`¡Cantrip usado! ✨ ${r.mensaje}`.trim());
                useSpellBtn.dataset.cantrip = '';
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
                const r = consumirAccion(tipoAccion);
                mostrarToast(`¡${arma} usada! ⚔️ ${r.mensaje}`.trim());
                useSpellBtn.dataset.arma = '';

                // Procesar efectos del arma (Great Weapon Fighting, Improved Critical, etc.)
                const armaObj = data.equipo.find(e => e.nombre === arma);
                if (armaObj && armaObj.efectos) {
                    setTimeout(() => {
                        procesarEfectos(armaObj, {
                            nivelPersonaje: nivelPersonaje
                        });
                    }, 400);
                }

                // Si la clase tiene Smite y el arma califica, abrir modal de Smite
                if (smiteData && armaPuedeGatillarSmite(arma, data.equipo)) {
                    setTimeout(() => abrirModalSmite(), 600);
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
                if (actual === 0) {
                    mostrarToast(`¡Hechizo usado! Sin ranuras de ${nivel}. ${r.mensaje}`.trim(), 'warning');
                } else {
                    mostrarToast(`¡Hechizo usado! Quedan ${actual} de ${nivel}. ${r.mensaje}`.trim());
                }

                // Disparar efectos automáticos del hechizo (Blessed Healer, Disciple of Life, etc.)
                const hechizoUsado = itemContextoActual && itemContextoActual.item ? itemContextoActual.item : itemContextoActual;
                if (hechizoUsado && hechizoUsado.efectos) {
                    const nivelNumerico = parseInt(nivel.replace(/[^0-9]/g, '')) || 1;
                    setTimeout(() => {
                        procesarEfectos(hechizoUsado, {
                            nivelHechizo: nivelNumerico,
                            nivelPersonaje: nivelPersonaje
                        });
                    }, 400);
                }

                // Si el hechizo trae datos de familiar (Find Familiar, Find Steed, etc.), invocarlo
                if (hechizoUsado && hechizoUsado.familiar) {
                    setTimeout(() => activarFamiliar(hechizoUsado.familiar), hechizoUsado.efectos ? 900 : 400);
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
    window.addEventListener('click', (e) => {
        if (e.target === confirmBorrarModal) confirmBorrarModal.style.display = 'none';
    });

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
    window.addEventListener('click', (e) => { if (e.target === confirmModal) confirmModal.style.display = 'none'; });

    // Cerrar modal de descanso
    const restModal = document.getElementById('rest-modal');
    const restCloseBtn = document.querySelector('.close-btn-rest');
    if (restCloseBtn) {
        restCloseBtn.addEventListener('click', () => restModal.style.display = 'none');
    }
    window.addEventListener('click', (e) => { if (e.target === restModal) restModal.style.display = 'none'; });

    // Listeners para cerrar modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
    }
    window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

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
    window.addEventListener('click', (e) => { if (e.target === hpModal) hpModal.style.display = 'none'; });

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
    window.addEventListener('click', (e) => { if (e.target === caModal) caModal.style.display = 'none'; });

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
    window.addEventListener('click', (e) => { if (e.target === smiteModal) smiteModal.style.display = 'none'; });

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
    window.addEventListener('click', (e) => { if (e.target === escalaModal) escalaModal.style.display = 'none'; });

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
    window.addEventListener('click', (e) => { if (e.target === wildshapeModal) wildshapeModal.style.display = 'none'; });

    // Modal de Hit Dice: cerrar
    const hdModal = document.getElementById('hd-modal');
    const hdCloseBtn = document.querySelector('.close-btn-hd');
    if (hdCloseBtn) {
        hdCloseBtn.addEventListener('click', () => hdModal.style.display = 'none');
    }
    window.addEventListener('click', (e) => { if (e.target === hdModal) hdModal.style.display = 'none'; });

    // Modal de imagen del personaje: cerrar
    const imagenModal = document.getElementById('imagen-modal');
    const imagenCloseBtn = document.querySelector('.close-btn-imagen');
    if (imagenCloseBtn) {
        imagenCloseBtn.addEventListener('click', () => imagenModal.style.display = 'none');
    }
    window.addEventListener('click', (e) => { if (e.target === imagenModal) imagenModal.style.display = 'none'; });

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
    window.addEventListener('click', (e) => { if (e.target === efectosModal) cerrarEfectosYContinuar(); });
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