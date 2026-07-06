import { formatMod } from "./Estadisticas.js";
import { NOMBRES_STATS } from "../Datos/Constantes.js";
import { statAMod } from "./Estadisticas.js";

// Resuelve la cantidad de ataques de un cantrip que escala con nivel del personaje
function resolverAtaques(item, nivelPersonaje) {
    if (!item.escalaAtaques || typeof item.escalaAtaques !== 'object') {
        return item.ataques || 1;
    }
    let ataquesFinal = item.ataques || 1;
    Object.keys(item.escalaAtaques)
        .map(k => parseInt(k))
        .sort((a, b) => a - b)
        .forEach(umbral => {
            if (nivelPersonaje >= umbral) {
                ataquesFinal = item.escalaAtaques[String(umbral)];
            }
        });
    return ataquesFinal;
}

// Resuelve el daño base de un cantrip que escala con nivel del personaje
function resolverDanoBase(item, nivelPersonaje) {
    if (!item.escala || typeof item.escala !== 'object') return item.dano;

    // Buscar el umbral más alto que sea <= nivelPersonaje
    let danoFinal = item.dano;
    Object.keys(item.escala)
        .map(k => parseInt(k))
        .sort((a, b) => a - b)
        .forEach(umbral => {
            if (nivelPersonaje >= umbral) {
                danoFinal = item.escala[String(umbral)];
            }
        });
    return danoFinal;
}

// Genera el string de daño con bonos: "1d10+3+2"
function formatearDanoConBonos(danoBase, modBase, bonos) {
    let resultado = danoBase;
    if (modBase !== 0) {
        resultado += formatMod(modBase);
    }
    bonos.forEach(b => {
        if (b.valor !== 0) resultado += formatMod(b.valor);
    });
    return resultado;
}

// Genera el HTML de tooltip con detalles: "(+3 CHA, +2 Dueling)"
function formatearDetalleBonos(modBase, nombreModBase, bonos) {
    const partes = [];
    if (modBase !== 0) partes.push(`${formatMod(modBase)} ${nombreModBase}`);
    bonos.forEach(b => {
        if (b.valor !== 0) partes.push(`${formatMod(b.valor)} ${b.nombre}`);
    });
    return partes.length > 0 ? `(${partes.join(', ')})` : '';
}

function calcularExtraAttacks(rasgos, clase, nivel) {
    // Caso especial: Guerrero tiene escalado automático según nivel
    if (clase === 'Guerrero') {
        if (nivel >= 20) return 4;
        if (nivel >= 11) return 3;
        if (nivel >= 5) return 2;
        return 1;
    }

    // Resto de clases: usar el rasgo del JSON
    if (!rasgos) return 1;
    const extra = rasgos.find(r => /extra attack/i.test(r.nombre));
    if (!extra) return 1;
    const match = extra.nombre.match(/\((\d+)\)/);
    if (match) return 1 + parseInt(match[1]);
    return 2;
}

// === Sistema de bonos de daño dinámicos ===

// Calcula el valor numérico de un bonoDano (puede ser número o nombre de stat)
function resolverBono(bonoDano, stats) {
    if (typeof bonoDano === 'number') return bonoDano;
    if (typeof bonoDano === 'string' && stats && stats[bonoDano] !== undefined) {
        return statAMod(stats[bonoDano]);
    }
    return 0;
}

// Determina si un bono se aplica a un item dado (arma o hechizo)
function bonoAplicaA(rasgo, item, esHechizo, equipoData) {
    if (!rasgo.aplicaA) return false;
    const aplicaA = rasgo.aplicaA;

    // Match por nombre específico
    if (aplicaA.startsWith('hechizo:')) {
        return esHechizo && aplicaA.substring(8).toLowerCase() === item.nombre.toLowerCase();
    }
    if (aplicaA.startsWith('arma:')) {
        return !esHechizo && aplicaA.substring(5).toLowerCase() === item.nombre.toLowerCase();
    }

    // Match por categoría (solo armas)
    if (esHechizo) return false;

    if (aplicaA === 'armasUnaMano') return item.manos === 1;
    if (aplicaA === 'armasDosManos') return item.manos === 2;
    if (aplicaA === 'armasMelee') return item.tipo === 'melee';
    if (aplicaA === 'armasRanged') return item.tipo === 'ranged';

    // Caso especial: Dueling
    if (aplicaA === 'duelingMelee') {
        if (item.tipo !== 'melee' || item.manos !== 1) return false;
        // Verificar que no haya OTRA arma equipada (escudo permitido)
        //const otrasArmas = equipoData.filter(n => n !== item.nombre);
        const otrasArmas = (equipoData ?? []).filter(n => n !== item.nombre);
        if (otrasArmas.length === 0) return true; // Solo este arma
        // Si hay otras armas equipadas → no aplica
        return false;
    }

    return false;
}

// Calcula los bonos aplicables a un item
// Devuelve { totalBono: number, detalles: [{nombre, valor, fuente}] }
function calcularBonosDano(item, esHechizo, rasgos, stats, equipoData) {
    const detalles = [];
    let total = 0;

    if (!rasgos) return { totalBono: 0, detalles: [] };

    rasgos.forEach(rasgo => {
        if (rasgo.bonoDano !== undefined && bonoAplicaA(rasgo, item, esHechizo, equipoData)) {
            const valor = resolverBono(rasgo.bonoDano, stats);
            if (valor !== 0) {
                detalles.push({ nombre: rasgo.nombre, valor: valor });
                total += valor;
            }
        }
    });

    return { totalBono: total, detalles };
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
// Verifica si el personaje cumple los requerimientos de stats del item
// Devuelve { permitido: bool, razon: string }
function validarRequerimientosStats(item, stats) {
    if (!item.requiere || !stats) return { permitido: true, razon: '' };

    for (const statKey of Object.keys(item.requiere)) {
        const requerido = item.requiere[statKey];
        const actual = stats[statKey] || 0;
        if (actual < requerido) {
            const nombreStat = NOMBRES_STATS[statKey] || statKey;
            return {
                permitido: false,
                razon: `Requiere ${statKey} ${requerido} (Tenés ${actual})`
            };
        }
    }
    return { permitido: true, razon: '' };
}

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

export {
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
};
