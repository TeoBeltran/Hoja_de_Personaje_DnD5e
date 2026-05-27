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

    // Si es descanso largo, restaurar vida al máximo
    if (tipo === 'largo') {
        vidaActual = vidaMaxima;
        guardarVida();
        actualizarVidaDOM();
    }

    // Cerrar modal y notificar
    document.getElementById('rest-modal').style.display = 'none';
    if (tipo === 'largo') {
        mostrarToast('🛏️ Descanso largo completado. ¡Todo restaurado!');
    } else {
        mostrarToast('☕ Descanso corto completado.');
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
        btn.innerHTML = `<span>${item.nombre}</span> ${item.valor ? `<span class="skill-mod">${item.valor}</span>` : ''}`;
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

    data.estadisticas.forEach(i => {
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
            // Marcar como modificado al cargar si corresponde
            if (vidaMaxima !== vidaMaximaOriginal) btn.classList.add('modificado');
            btn.addEventListener('click', () => {
                document.getElementById('hp-modal').style.display = 'flex';
                actualizarVidaDOM();
            });
            sG.appendChild(btn);
        } else if (i.nombre === "CA") {
            // Tratamiento especial para CA
            caOriginal = parseInt(i.valor);
            const guardadaCa = localStorage.getItem(STORAGE_PREFIX + 'caActual');
            caActual = guardadaCa !== null ? parseInt(guardadaCa) : caOriginal;
            const btn = document.createElement('button');
            btn.className = 'skill-btn vida-btn';
            btn.id = 'ca-btn';
            btn.innerHTML = `<span>${i.nombre}</span><span class="skill-mod">${caActual}</span>`;
            // Marcar como modificado al cargar si corresponde
            if (caActual !== caOriginal) btn.classList.add('modificado');
            btn.addEventListener('click', () => {
                document.getElementById('ca-modal').style.display = 'flex';
                actualizarCaDOM();
            });
            sG.appendChild(btn);
        } else {
            sG.appendChild(createBtn(i));
        }
    });
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
            modal.style.display = 'flex';
        };
        document.getElementById('rasgos-grid').appendChild(btn);
    });

    // Equipo
    data.equipo.forEach(i => {
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
            modal.style.display = 'flex';
        };
        document.getElementById('equipo-grid').appendChild(btn);
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
                if (modalActions && useSpellBtn) {
                    modalActions.style.display = 'block';
                    // Reutilizamos useSpellBtn pero con un marcador especial
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
            btn.innerHTML = `
                <span style="font-weight: bold; margin-bottom: 5px;">${h.nombre}</span>
                <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${h.desc.replace(/\n/g, '<br>')}</span>
            `;
            btn.onclick = () => {
                modalTitle.innerHTML = h.nombre;
                modalDesc.innerHTML = h.desc.replace(/\n/g, '<br>');

                const nivelRanura = mapNivelHechizoARanura(h.nivel);
                if (nivelRanura && modalActions && useSpellBtn) {
                    modalActions.style.display = 'block';
                    useSpellBtn.dataset.nivel = nivelRanura;
                    const disponibles = parseInt(ranurasState[nivelRanura]);
                    useSpellBtn.disabled = disponibles <= 0;
                    useSpellBtn.textContent = disponibles > 0
                        ? `Usar Hechizo (${disponibles} disponibles en ${nivelRanura})`
                        : 'Sin ranuras disponibles';
                } else if (modalActions) {
                    modalActions.style.display = 'none';
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
            // Caso 2: es un hechizo (ranura)
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
    if (restLargo) restLargo.addEventListener('click', () => tomarDescanso('largo'));

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
}

document.addEventListener('DOMContentLoaded', init);

