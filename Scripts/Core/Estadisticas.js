import {
    PROFICIENCIAS_POR_CLASE,
    NOMBRES_STATS,
    SKILL_STAT,
    SKILL_DESC
} from "../Datos/Constantes.js";

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

// Formatea un número como "+3", "-1", "+0". También acepta strings de dados
// (ej: "1d6") para bonos de daño tipo dado, devolviéndolos como "+1d6".
function formatMod(num) {
    if (typeof num === 'string') return '+' + num;
    return (num >= 0 ? '+' : '') + num;
}

// Obtiene el modificador de un atributo desde data.modificadores
function obtenerMod(modificadores, nombreParcial) {
    const stat = modificadores.find(m => m.nombre.includes(nombreParcial));
    return stat ? parseMod(stat.valor) : 0;
}

// Calcula el modificador a partir del score (8→-1, 10→0, 14→+2, etc.)
function statAMod(score) {
    return Math.floor((score - 10) / 2);
}

// Calcula el valor de una skill: mod de la stat + (proficiencia si aplica)
function calcularValorSkill(skill, stats, profBonus) {
    const statKey = SKILL_STAT[skill.nombre];
    if (!statKey || !stats || stats[statKey] === undefined) return 0;
    let valor = statAMod(stats[statKey]);
    if (skill.proficiente) valor += profBonus;
    return valor;
}

// Genera el array de habilidades enriquecido (con valor y desc dinámicos)
function generarHabilidades(habilidadesBase, stats, profBonus) {
    if (!habilidadesBase) return [];
    return habilidadesBase.map(skill => {
        const valor = calcularValorSkill(skill, stats, profBonus);
        const statKey = SKILL_STAT[skill.nombre] || '';
        return {
            nombre: skill.nombre,
            valor: formatMod(valor),
            proficiente: skill.proficiente || false,
            stat: statKey,
            desc: SKILL_DESC[skill.nombre] || ''
        };
    });
}

// Genera el array de modificadores a partir de stats y clase
function generarModificadores(stats, clase) {
    const prof = PROFICIENCIAS_POR_CLASE[clase] || { principal: '', savingExtra: '' };
    /*return Object.keys(stats).map(key => ({
        nombre: NOMBRES_STATS[key],
        valor: formatMod(statAMod(stats[key])),
        proficiente: key === prof.principal
    }));*/
    return Object.keys(stats).map(key => {

        console.log(
            key,
            stats[key],
            statAMod(stats[key])
        );

        return {
            nombre: NOMBRES_STATS[key],
            valor: formatMod(statAMod(stats[key])),
            proficiente: key === prof.principal
        };
    });
}

// Genera el array de salvaciones a partir de stats, clase, proficiencia bonus, y una
// lista opcional de stats con competencia extra otorgada por rasgos (ej: Iron Mind → WIS).
function generarSalvaciones(stats, clase, profBonus, extraProficientes) {
    const prof = PROFICIENCIAS_POR_CLASE[clase] || { principal: '', savingExtra: '' };
    const extra = extraProficientes || [];
    return Object.keys(stats).map(key => {
        const esProficiente = (key === prof.principal || key === prof.savingExtra || extra.includes(key));
        const mod = statAMod(stats[key]);
        const valor = esProficiente ? mod + profBonus : mod;
        return {
            nombre: NOMBRES_STATS[key],
            valor: formatMod(valor),
            proficiente: esProficiente
        };
    });
}

export {
    calcularProficiencia,
    parseMod,
    formatMod,
    obtenerMod,
    statAMod,
    calcularValorSkill,
    generarHabilidades,
    generarModificadores,
    generarSalvaciones
};