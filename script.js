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

// Mapea nivel de hechizo a ranura. Si es Brujo, TODO va a Nivel 3.
function mapNivelHechizoARanura(nivelHechizo) {
    if (nivelHechizo === "CANTRIPS") return null; // Cantrips nunca consumen
    if (claseEsBrujo) return "Nivel 3"; // Pact Magic: todo cuenta como nivel 3
    if (nivelHechizo === "NIVEL 1") return "Nivel 1";
    if (nivelHechizo === "NIVEL 2") return "Nivel 2";
    if (nivelHechizo === "NIVEL 3") return "Nivel 3";
    if (nivelHechizo === "NIVEL 4") return "Nivel 4";
    return null;
}

let ranurasInfo = {}; // Guarda qué descanso recupera cada ranura
let habilidadesInfo = {}; // Guarda qué descanso recupera cada habilidad

function guardarRanuras() {
    localStorage.setItem(STORAGE_PREFIX + 'ranurasHechizos', JSON.stringify(ranurasState));
}

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

function guardarVida() {
    localStorage.setItem(STORAGE_PREFIX + 'vidaActual', String(vidaActual));
    localStorage.setItem(STORAGE_PREFIX + 'vidaMaxima', String(vidaMaxima));
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
    caOriginal = caActual;
    guardarCA();
    actualizarCaDOM();
}

function guardarArmasEquipadas() {
    localStorage.setItem(STORAGE_PREFIX + 'armasEquipadas', JSON.stringify(armasEquipadas));
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

function guardarHitDice() {
    localStorage.setItem(STORAGE_PREFIX + 'hitDiceActual', String(hitDiceActual));
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

function calcularProficiencia(nivel) {
    if (nivel >= 17) return '+6';
    if (nivel >= 13) return '+5';
    if (nivel >= 9) return '+4';
    if (nivel >= 5) return '+3';
    return '+2';
}

// Convierte "+3" o "-1" a número 3 o -1
function parseMod(modStr) {
    return parseInt(modStr.replace('+', '')) || 0;
}

// Formatea un número como "+3", "-1", "+0"
function formatMod(num) {
    return (num >= 0 ? '+' : '') + num;
}

// Obtiene el modificador de un atributo desde data.modificadores
function obtenerMod(modificadores, nombreParcial) {
    const stat = modificadores.find(m => m.nombre.includes(nombreParcial));
    return stat ? parseMod(stat.valor) : 0;
}

function obtenerHitDiceSegunClase(clase) {
    const mapa = {
        'Mago': 'd6',
        'Hechicero': 'd6',
        'Bardo': 'd8',
        'Clérigo': 'd8',
        'Druida': 'd8',
        'Monje': 'd8',
        'Pícaro': 'd8',
        'Artífice': 'd8',
        'Brujo': 'd8',
        'Guerrero': 'd10',
        'Paladín': 'd10',
        'Ranger': 'd10',
        'Bárbaro': 'd12'
    };
    return mapa[clase] || 'd8';
}

// Devuelve el nivel máximo de armadura permitido: 'ninguna' | 'ligera' | 'mediana' | 'pesada'
function armaduraMaximaSegunClase(clase) {
    const mapa = {
        'Mago': 'ninguna',
        'Hechicero': 'ninguna',
        'Monje': 'ninguna',
        'Bárbaro': 'ninguna',
        'Bardo': 'ligera',
        'Pícaro': 'ligera',
        'Brujo': 'ligera',
        'Artífice': 'ligera',
        'Druida': 'mediana',
        'Explorador': 'mediana',
        'Ranger': 'mediana',
        'Paladín': 'pesada',
        'Guerrero': 'pesada',
        'Clérigo': 'pesada'
    };
    return mapa[clase] || 'pesada'; // Default: permite todo si la clase no está mapeada
}

function puedeUsarEscudoSegunClase(clase) {
    const conEscudo = ['Paladín', 'Guerrero', 'Clérigo', 'Druida', 'Explorador', 'Ranger', 'Bárbaro', 'Artífice'];
    return conEscudo.includes(clase);
}

// Verifica si la clase puede equipar la armadura. Devuelve {permitido: bool, razon: string}
function validarArmaduraPorClase(item, clase) {
    if (!item.esArmadura) return { permitido: true, razon: '' };

    // Escudo
    if (item.tipoArmadura === 'escudo') {
        if (!puedeUsarEscudoSegunClase(clase)) {
            return { permitido: false, razon: `${clase} no puede usar escudos` };
        }
        return { permitido: true, razon: '' };
    }

    // Armadura corporal
    const max = armaduraMaximaSegunClase(clase);
    const orden = { 'ninguna': 0, 'ligera': 1, 'mediana': 2, 'pesada': 3 };
    const nivelItem = orden[item.tipoArmadura] ?? 0;
    const nivelMax = orden[max] ?? 0;

    if (nivelItem > nivelMax) {
        if (max === 'ninguna') {
            return { permitido: false, razon: `${clase} no puede usar armaduras` };
        }
        return { permitido: false, razon: `${clase} solo puede usar armadura ${max} o menor` };
    }
    return { permitido: true, razon: '' };
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

function guardarHabilidadesUso() {
    localStorage.setItem(STORAGE_PREFIX + 'habilidadesUso', JSON.stringify(habilidadesUsoState));
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
const params = new URLSearchParams(window.location.search);
const personajeId = params.get('p') || 'gangstur'; // default por si no viene

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

    // Cargar Clase y Raza desde el JSON
    if (data.personaje) {
        const claseEl = document.getElementById('clase-valor');
        const razaEl = document.getElementById('raza-valor');
        if (claseEl) claseEl.textContent = data.personaje.clase || '';
        if (razaEl) razaEl.textContent = data.personaje.raza || '';
        claseEsBrujo = (data.personaje.clase === "Brujo");
        claseActual = data.personaje.clase || '';
        hitDiceDado = obtenerHitDiceSegunClase(data.personaje.clase);

        // Determinar la stat principal según la clase
        const statPorClase = {
            'Bardo': 'CHA', 'Brujo': 'CHA', 'Hechicero': 'CHA', 'Paladín': 'CHA',
            'Clérigo': 'WIS', 'Druida': 'WIS', 'Ranger': 'WIS', 'Explorador': 'WIS',
            'Mago': 'INT', 'Artífice': 'INT',
            'Bárbaro': 'STR', 'Guerrero': 'STR',
            'Pícaro': 'DEX',
            'Monje': 'WIS'
        };
        nombreModPrincipal = statPorClase[data.personaje.clase] || 'STR';
        modPrincipal = obtenerMod(data.modificadores, nombreModPrincipal);
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

    // Calcular valores automáticos antes de renderizar
    const nivelStat = data.estadisticas.find(s => s.nombre === "Nivel");
    const nivelPersonaje = nivelStat ? parseInt(nivelStat.valor) : 1;
    const modDex = formatMod(obtenerMod(data.modificadores, "DEX"));
    proficienciaActual = parseMod(calcularProficiencia(nivelPersonaje));

    // Pre-cargar armadura, escudo y armas equipadas desde localStorage
    modDexGlobal = obtenerMod(data.modificadores, "DEX");
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

    // Rasgos
    data.rasgos.forEach(i => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.style.flexDirection = 'column';
        btn.style.alignItems = 'flex-start';
        btn.style.height = 'auto';
        btn.innerHTML = `
            <span style="font-weight: bold; margin-bottom: 5px;">${i.nombre}</span>
            <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${i.desc.replace(/\n/g, '<br>')}</span>
        `;
        btn.onclick = () => {
            modalTitle.innerHTML = i.nombre;
            modalDesc.innerHTML = i.desc.replace(/\n/g, '<br>');
            if (modalActions) modalActions.style.display = 'none';
            const modalEquipar = document.getElementById('modal-equipar');
            if (modalEquipar) modalEquipar.style.display = 'none';
            modal.style.display = 'flex';
        };
        document.getElementById('rasgos-grid').appendChild(btn);
    });

    // Equipo
    const modStr = obtenerMod(data.modificadores, "STR");
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

        let attackBonusHTML = '';
        let danoFinal = i.dano || '';
        if (i.tipo) {
            const modUsado = (i.tipo === 'finesse') ? modDexNum : modStr;
            const bonus = proficienciaActual + modUsado;
            attackBonusHTML = `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid #6a1b9a; border-radius: 4px; color: #6a1b9a; margin-right: 6px;">Atk: ${formatMod(bonus)}</span>`;
            if (i.dano && modUsado !== 0) {
                danoFinal = `${i.dano}${formatMod(modUsado)}`;
            }
        }
        // Agregar multiplicador de ataques si existe
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

        btn.innerHTML = `
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 5px; gap: 10px; flex-wrap: wrap;">
                <span style="font-weight: bold;">${i.nombre}</span>
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                    ${attackBonusHTML}
                    ${armaduraHTML}
                    ${manosHTML}
                    ${danoHTML}
                    ${tipoDanoHTML}
                </div>
            </div>
            <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${i.desc.replace(/\n/g, '<br>')}</span>
            ${equipadoBadgeHTML}
        `;
        btn.onclick = () => abrirModalEquipo(i, data.equipo);
        document.getElementById('equipo-grid').appendChild(btn);
    });

    // === Lógica de equipar/desequipar desde el modal ===
    let itemModalActual = null;

    function abrirModalEquipo(item, equipoData) {
        itemModalActual = item;
        modalTitle.innerHTML = item.nombre;
        modalDesc.innerHTML = item.desc.replace(/\n/g, '<br>');
        if (modalActions) modalActions.style.display = 'none';

        const modalEquipar = document.getElementById('modal-equipar');
        const btnEqModal = document.getElementById('btn-equipar-modal');

        // Solo mostrar botón si el ítem es equipable (armadura, escudo o arma con manos)
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
                // 1° Validar restricción por clase
                const validacion = validarArmaduraPorClase(item, claseActual);
                if (!validacion.permitido) {
                    btnEqModal.textContent = `🚫 ${validacion.razon}`;
                    btnEqModal.style.backgroundColor = '#c62828';
                    btnEqModal.style.color = 'white';
                    btnEqModal.disabled = true;
                } else {
                    // 2° Validar manos disponibles
                    const manosNecesarias = item.manos || 0;
                    const manosLibres = 2 - manosUsadas;
                    const tieneEspacio = manosNecesarias <= manosLibres;

                    if (tieneEspacio) {
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

    // Calcular y mostrar Save DC y Spell Attack Bonus en headers
    const saveDC = 8 + proficienciaActual + modPrincipal;
    const spellAttackBonus = formatMod(proficienciaActual + modPrincipal);
    document.querySelectorAll('.proficient').forEach(span => {
        const txt = span.textContent;
        if (txt.includes('Spell Attack Bonus')) {
            span.textContent = `Spell Attack Bonus: ${spellAttackBonus}`;
        } else if (txt.includes('Spell Save DC')) {
            span.textContent = `Spell Save DC: ${saveDC}`;
        } else if (txt.includes('Save DC')) {
            span.textContent = `Save DC: ${saveDC}`;
        }
    });

    // Habilidades con usos
    if (data.habilidadesUso) {
        // Inicializar estado: localStorage > JSON
        data.habilidadesUso.forEach(h => {
            habilidadesUsoOriginales[h.nombre] = h.usos;
            habilidadesInfo[h.nombre] = h.recupera || 'largo';
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
            const btn = document.createElement('button');
            btn.className = 'skill-btn';
            btn.id = `hab-uso-${h.nombre.replace(/[^a-zA-Z0-9]/g, '-')}`;
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'flex-start';
            btn.style.height = 'auto';
            const usosActuales = habilidadesUsoState[h.nombre];
            btn.innerHTML = `
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 5px;">
                    <span style="font-weight: bold;">${h.nombre}</span>
                    <span class="skill-mod usos-valor">${usosActuales}</span>
                </div>
                <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${h.desc.replace(/\n/g, '<br>')}</span>
            `;
            // Marcar agotada al cargar si corresponde
            const disponibles = parseInt(usosActuales.split('/')[0]);
            if (disponibles <= 0) btn.classList.add('ranura-vacia');

            btn.onclick = () => {
                modalTitle.innerHTML = h.nombre;
                modalDesc.innerHTML = h.desc.replace(/\n/g, '<br>');
                const modalEquipar = document.getElementById('modal-equipar');
                if (modalEquipar) modalEquipar.style.display = 'none';
                if (modalActions && useSpellBtn) {
                    modalActions.style.display = 'block';
                    useSpellBtn.dataset.nivel = '';
                    useSpellBtn.dataset.habilidad = h.nombre;
                    const dispActuales = parseInt(habilidadesUsoState[h.nombre].split('/')[0]);
                    useSpellBtn.disabled = dispActuales <= 0;
                    useSpellBtn.textContent = dispActuales > 0
                        ? `Usar Habilidad (${habilidadesUsoState[h.nombre]})`
                        : 'Sin usos disponibles';
                }
                modal.style.display = 'flex';
            };
            habGrid.appendChild(btn);
        });
    }

    // Renderizar Ranuras
    const ranurasG = document.getElementById('ranuras-grid');
    data.hechizos.ranuras.forEach(i => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.id = `ranura-${i.nivel.replace(' ', '-')}`;
        btn.style.textAlign = 'center';
        const valorActual = ranurasState[i.nivel];
        btn.innerHTML = `<span style="font-size: 0.8rem; display:block;">${i.nivel}</span><span class="valor-ranura" style="font-weight:bold;">${valorActual}</span>`;
        if (parseInt(valorActual) <= 0) btn.classList.add('ranura-vacia');
        ranurasG.appendChild(btn);
    });

    // Renderizar Lista de Hechizos
    const contenedorHechizos = document.getElementById('hechizos-contenedor');
    const niveles = ["CANTRIPS", "NIVEL 1", "NIVEL 2", "NIVEL 3"];

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
            const danoTexto = h.ataques && h.ataques > 1 ? `${h.dano} ×${h.ataques}` : h.dano;
            const danoHTML = h.dano ? `<span class="skill-mod" style="background-color: #6a1b9a; color: white; flex-shrink: 0;">${danoTexto}</span>` : '';
            const tipoDanoHTML = h.tipoDano ? `<span style="font-size: 0.85rem; font-weight: bold; padding: 2px 8px; border: 1px solid var(--accent-color); border-radius: 4px; color: var(--accent-color); margin-left: 6px;">${h.tipoDano}</span>` : '';
            btn.innerHTML = `
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 5px; gap: 10px; flex-wrap: wrap;">
                    <span style="font-weight: bold;">${h.nombre}</span>
                    <div style="display: flex; align-items: center;">
                        ${danoHTML}
                        ${tipoDanoHTML}
                    </div>
                </div>
                <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${h.desc.replace(/\n/g, '<br>')}</span>
            `;
            btn.onclick = () => {
                modalTitle.innerHTML = h.nombre;
                modalDesc.innerHTML = h.desc.replace(/\n/g, '<br>');

                // Ocultar el botón Equipar (este NO es un ítem de equipo)
                const modalEquipar = document.getElementById('modal-equipar');
                if (modalEquipar) modalEquipar.style.display = 'none';

                if (modalActions && useSpellBtn) {
                    if (h.nivel === "CANTRIPS") {
                        // Cantrips: se pueden usar libremente, no consumen ranura
                        modalActions.style.display = 'block';
                        useSpellBtn.dataset.nivel = '';
                        useSpellBtn.dataset.cantrip = 'true';
                        useSpellBtn.disabled = false;
                        useSpellBtn.textContent = 'Usar Cantrip';
                    } else {
                        const nivelRanura = mapNivelHechizoARanura(h.nivel);
                        if (nivelRanura) {
                            modalActions.style.display = 'block';
                            useSpellBtn.dataset.nivel = nivelRanura;
                            useSpellBtn.dataset.cantrip = '';
                            const disponibles = parseInt(ranurasState[nivelRanura]);
                            useSpellBtn.disabled = disponibles <= 0;
                            useSpellBtn.textContent = disponibles > 0
                                ? `Usar Hechizo (${disponibles} disponibles en ${nivelRanura})`
                                : 'Sin ranuras disponibles';
                        } else {
                            modalActions.style.display = 'none';
                        }
                    }
                }
                modal.style.display = 'flex';
            };
            grid.appendChild(btn);
        });
    });

    // Listener: Usar Hechizo (cierra modal al usarse)
    if (useSpellBtn) {
        useSpellBtn.addEventListener('click', () => {
            // Caso 1: es una habilidad con usos
            const habilidad = useSpellBtn.dataset.habilidad;
            if (habilidad) {
                usarHabilidad(habilidad);
                useSpellBtn.dataset.habilidad = '';
                return;
            }
            // Caso 2: es un cantrip (no consume ranura)
            if (useSpellBtn.dataset.cantrip === 'true') {
                modal.style.display = 'none';
                mostrarToast('¡Cantrip usado! ✨');
                useSpellBtn.dataset.cantrip = '';
                return;
            }
            // Caso 3: es un hechizo (ranura)
            const nivel = useSpellBtn.dataset.nivel;
            if (!nivel) return;
            let actual = parseInt(ranurasState[nivel]);
            if (actual > 0) {
                actual -= 1;
                ranurasState[nivel] = String(actual);
                guardarRanuras();
                actualizarRanuraDOM(nivel);
                modal.style.display = 'none';
                if (actual === 0) {
                    mostrarToast(`¡Hechizo usado! Ya no quedan ranuras de ${nivel}`, 'warning');
                } else {
                    mostrarToast(`¡Hechizo usado! Quedan ${actual} ranuras de ${nivel}`);
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
    if (restCorto) restCorto.addEventListener('click', () => tomarDescanso('corto'));
    if (restLargo) {
        restLargo.addEventListener('click', () => {
            // Cerrar modal de descanso y abrir el de confirmación del DM
            document.getElementById('rest-modal').style.display = 'none';
            document.getElementById('confirm-largo-modal').style.display = 'flex';
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

    // Modal de Hit Dice: cerrar
    const hdModal = document.getElementById('hd-modal');
    const hdCloseBtn = document.querySelector('.close-btn-hd');
    if (hdCloseBtn) {
        hdCloseBtn.addEventListener('click', () => hdModal.style.display = 'none');
    }
    window.addEventListener('click', (e) => { if (e.target === hdModal) hdModal.style.display = 'none'; });
}

document.addEventListener('DOMContentLoaded', init);

