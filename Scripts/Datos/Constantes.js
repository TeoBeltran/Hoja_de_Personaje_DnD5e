// === Funciones del sistema de turno ===

// Íconos por personaje (los mismos que en el menú principal)
const ICONOS_PERSONAJE = {
    'gangstur': '🔮',
    'nika': '🛡️',
    'lothar': '🗡️',
    'lunareth': '📖',
    'leonidas': '✨',
    'orfe': '🌿'
};

// === Sistema de stats y proficiencias ===

// Stats con proficiencia de Saving Throw por clase
// El primero es la stat principal (también proficiente en modificadores)
// El segundo es solo proficiente en saving throws
const PROFICIENCIAS_POR_CLASE = {
    'Bárbaro':   { principal: 'STR', savingExtra: 'CON' },
    'Bardo':     { principal: 'CHA', savingExtra: 'DEX' },
    'Brujo':     { principal: 'CHA', savingExtra: 'WIS' },
    'Clérigo':   { principal: 'WIS', savingExtra: 'CHA' },
    'Druida':    { principal: 'WIS', savingExtra: 'INT' },
    'Explorador':{ principal: 'WIS', savingExtra: 'STR' },
    'Ranger':    { principal: 'WIS', savingExtra: 'STR' },
    'Guerrero':  { principal: 'STR', savingExtra: 'CON' },
    'Hechicero': { principal: 'CHA', savingExtra: 'CON' },
    'Mago':      { principal: 'INT', savingExtra: 'WIS' },
    'Monje':     { principal: 'DEX', savingExtra: 'STR' },
    'Paladín':   { principal: 'CHA', savingExtra: 'WIS' },
    'Pícaro':    { principal: 'DEX', savingExtra: 'INT' },
    'Artífice':  { principal: 'INT', savingExtra: 'CON' }
};

// Nombres completos para mostrar en el grid
const NOMBRES_STATS = {
    'STR': 'Fuerza (STR)',
    'DEX': 'Destreza (DEX)',
    'CON': 'Constitución (CON)',
    'INT': 'Inteligencia (INT)',
    'WIS': 'Sabiduría (WIS)',
    'CHA': 'Carisma (CHA)'
};

// Mapa de skill → stat asociada
const SKILL_STAT = {
    'Atletismo': 'STR',
    'Acrobacias': 'DEX',
    'Juego de manos': 'DEX',
    'Sigilo': 'DEX',
    'Conoc. Arcano': 'INT',
    'Historia': 'INT',
    'Investigación': 'INT',
    'Naturaleza': 'INT',
    'Religión': 'INT',
    'Trato animal': 'WIS',
    'Perspicacia': 'WIS',
    'Medicina': 'WIS',
    'Percepción': 'WIS',
    'Supervivencia': 'WIS',
    'Engaño': 'CHA',
    'Intimidación': 'CHA',
    'Interpretación': 'CHA',
    'Persuasión': 'CHA'
};

// Descripciones genéricas de cada skill
const SKILL_DESC = {
    'Atletismo': 'Escalar, saltar, nadar o cualquier acción atlética.',
    'Acrobacias': 'Controla tu capacidad para mantenerte en pie y movimientos ágiles.',
    'Juego de manos': 'Habilidad manual, robar de forma sigilosa y prestidigitación.',
    'Sigilo': 'Escabullirse sin ser visto ni oído.',
    'Conoc. Arcano': 'Saber sobre magia, hechizos, planos y criaturas mágicas.',
    'Historia': 'Recordar eventos antiguos, reinos perdidos, guerras y dinastías.',
    'Investigación': 'Deducir hechos mediante pistas y razonamiento.',
    'Naturaleza': 'Conocimiento sobre flora, fauna, clima y ciclos naturales.',
    'Religión': 'Conocimiento sobre deidades, ritos sagrados y jerarquías religiosas.',
    'Trato animal': 'Tu habilidad para calmar, entender o controlar animales.',
    'Perspicacia': 'Mide tu capacidad de leer intenciones y mentiras.',
    'Medicina': 'Estabilizar heridos y diagnosticar enfermedades.',
    'Percepción': 'Notar detalles del entorno con todos tus sentidos.',
    'Supervivencia': 'Seguir rastros, cazar, sobrevivir en la naturaleza.',
    'Engaño': 'Convencer a otros de una falsedad con palabras o gestos.',
    'Intimidación': 'Capacidad de infundir miedo mediante amenazas o presencia.',
    'Interpretación': 'Tu capacidad para actuar, cantar, contar historias o entretener.',
    'Persuasión': 'Influir en otros con tacto, diplomacia y razón.'
};

export {
    ICONOS_PERSONAJE,
    PROFICIENCIAS_POR_CLASE,
    NOMBRES_STATS,
    SKILL_STAT,
    SKILL_DESC
};