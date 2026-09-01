// ==========================================================
// Hoja de Enemigo (DM). Cada enemigo vive en localStorage bajo
// la key "enemigo_<id>" como UN solo bloque JSON (sin archivo
// JSON estático como los personajes jugables), porque no hay
// una "base" con la que diffear: todo lo carga el DM a mano
// desde acá.
//
// Script CLÁSICO a propósito (no type="module"): no importa
// nada de otro archivo, y así funciona también abriendo el
// .html directo por doble click (file://), donde los módulos
// ES quedan bloqueados por CORS.
// ==========================================================

var params = new URLSearchParams(window.location.search);
var id = params.get('id');

function cargarRecord() {
    if (!id) return null;
    try {
        var raw = localStorage.getItem('enemigo_' + id);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

var record = cargarRecord();

if (!record) {
    window.location.href = 'enemigos.html';
} else {

    // Migración: enemigos creados antes de que existieran acciones/turno,
    // acciones legendarias o el tracker de turno arrancan con los defaults.
    (function migrarRecord() {
        var cambio = false;
        if (record.accionesPorTurno === undefined) { record.accionesPorTurno = 1; cambio = true; }
        if (record.legendariasHabilitadas === undefined) { record.legendariasHabilitadas = false; cambio = true; }
        if (record.legendariasPorRonda === undefined) { record.legendariasPorRonda = 0; cambio = true; }
        if (!record.turnoActual) {
            record.turnoActual = {
                accion: record.accionesPorTurno,
                bonus: 1,
                reaccion: 1,
                legendaria: record.legendariasPorRonda
            };
            cambio = true;
        }
        if (cambio) localStorage.setItem('enemigo_' + id, JSON.stringify(record));
    })();

    function guardarRecord() {
        localStorage.setItem('enemigo_' + id, JSON.stringify(record));
    }

    function fmtMod(n) {
        n = parseInt(n) || 0;
        return n >= 0 ? '+' + n : '' + n;
    }

    function escapeHTML(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    var SECCIONES = {
        habilidades: { titulo: 'Habilidades / Pasivas' },
        acciones: { titulo: 'Acciones' },
        accionesBonus: { titulo: 'Acciones Adicionales' },
        reacciones: { titulo: 'Reacciones' },
        accionesLegendarias: { titulo: 'Acciones Legendarias' }
    };

    // Categorías cuyo "consumo" (cuántas unidades del pool gastan) es configurable por entrada.
    var CATEGORIAS_CON_CONSUMO = { acciones: 'Acciones', accionesLegendarias: 'Acciones Legendarias' };

    // ===== Daño: siempre se trabaja como un array de {cantidad, dado, extra, tipoDano} =====
    // (compatibilidad con entradas viejas que tenían los campos sueltos en vez del array).

    function normalizarDanos(item) {
        if (item.danos && Array.isArray(item.danos)) return item.danos;
        if (item.danoDado) {
            return [{ cantidad: item.danoCantidad, dado: item.danoDado, extra: item.danoExtra, tipoDano: item.tipoDano }];
        }
        return [];
    }

    function normalizarConsumo(item) {
        var n = parseInt(item.consumo);
        return (n && n > 0) ? n : 1;
    }

    function formatoDano(d) {
        if (!d || !d.dado) return '';
        var extra = parseInt(d.extra) || 0;
        var cant = parseInt(d.cantidad) || 0;
        return cant + 'd' + d.dado + (extra >= 0 ? '+' + extra : extra) + (d.tipoDano ? ' ' + d.tipoDano : '');
    }

    // Arma el HTML de badges de una entrada (bono de ataque, alcance, cada daño, y el badge de
    // "consume" si la categoría lo usa). Se reutiliza tanto en las cards inline como en el modal
    // de detalle del menú de turno, para no duplicar la lógica en dos lugares.
    function construirBadgesHTML(item, seccionClave) {
        var badges = '';
        if (item.bonoAtaque !== undefined && item.bonoAtaque !== null && item.bonoAtaque !== '') {
            badges += '<span class="skill-mod" style="background-color:#2e7d32;color:white;">' + fmtMod(item.bonoAtaque) + ' al ataque</span>';
        }
        if (item.alcance) {
            badges += '<span class="skill-mod" style="background-color:#5d4037;color:white;">' + escapeHTML(item.alcance) + '</span>';
        }
        normalizarDanos(item).forEach(function (d) {
            var texto = formatoDano(d);
            if (texto) badges += '<span class="skill-mod" style="background-color:#6a1b9a;color:white;">' + escapeHTML(texto) + '</span>';
        });
        if (CATEGORIAS_CON_CONSUMO[seccionClave]) {
            var consumo = normalizarConsumo(item);
            badges += '<span class="skill-mod" style="background-color:#e65100;color:white;">Consume ' + consumo + ' ' + CATEGORIAS_CON_CONSUMO[seccionClave] + '</span>';
        }
        return badges;
    }

    // ===== Render general =====

    function renderCabecera() {
        document.getElementById('nombre-texto').textContent = record.nombre || 'Enemigo';
        document.getElementById('icono-enemigo').textContent = record.icono || '👹';
        document.title = (record.nombre || 'Enemigo') + ' - Enemigos';
    }

    function renderStats() {
        var grid = document.getElementById('stats-grid');
        grid.innerHTML = '';

        var btnVida = document.createElement('button');
        btnVida.type = 'button';
        btnVida.className = 'skill-btn';
        btnVida.id = 'btn-vida';
        btnVida.innerHTML = '<span>Vida</span><span class="skill-mod">' + record.vidaActual + '/' + record.vidaMaxima + '</span>';
        btnVida.addEventListener('click', abrirModalHp);
        grid.appendChild(btnVida);

        var btnCa = document.createElement('button');
        btnCa.type = 'button';
        btnCa.className = 'skill-btn';
        btnCa.id = 'btn-ca';
        btnCa.innerHTML = '<span>CA</span><span class="skill-mod">' + record.caActual + '</span>';
        btnCa.addEventListener('click', abrirModalCa);
        grid.appendChild(btnCa);

        var btnVel = document.createElement('button');
        btnVel.type = 'button';
        btnVel.className = 'skill-btn';
        btnVel.innerHTML = '<span>Velocidad</span><span class="skill-mod">' + (record.velocidad || '—') + '</span>';
        btnVel.addEventListener('click', function () { abrirModalValor('velocidad', 'Velocidad', 'text'); });
        grid.appendChild(btnVel);

        var btnIni = document.createElement('button');
        btnIni.type = 'button';
        btnIni.className = 'skill-btn';
        btnIni.innerHTML = '<span>Iniciativa</span><span class="skill-mod">' + fmtMod(record.iniciativa) + '</span>';
        btnIni.addEventListener('click', function () { abrirModalValor('iniciativa', 'Iniciativa', 'number'); });
        grid.appendChild(btnIni);

        var btnAcciones = document.createElement('button');
        btnAcciones.type = 'button';
        btnAcciones.className = 'skill-btn';
        btnAcciones.innerHTML = '<span>Acciones/Turno</span><span class="skill-mod">' + record.accionesPorTurno + '</span>';
        btnAcciones.addEventListener('click', function () { abrirModalValor('accionesPorTurno', 'Acciones por turno', 'number'); });
        grid.appendChild(btnAcciones);

        var btnLegendarias = document.createElement('button');
        btnLegendarias.type = 'button';
        btnLegendarias.className = 'skill-btn';
        var valorLeg = record.legendariasHabilitadas ? (record.legendariasPorRonda + '/ronda') : 'No';
        btnLegendarias.innerHTML = '<span>Acciones Legendarias</span><span class="skill-mod">' + valorLeg + '</span>';
        btnLegendarias.addEventListener('click', abrirModalLegendarias);
        grid.appendChild(btnLegendarias);
    }

    function renderMods() {
        var grid = document.getElementById('mods-grid');
        grid.innerHTML = '';
        ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach(function (stat) {
            var btn = document.createElement('div');
            btn.className = 'skill-btn';
            btn.innerHTML = '<span>' + stat + '</span><span class="skill-mod">' + fmtMod(record.mods ? record.mods[stat] : 0) + '</span>';
            grid.appendChild(btn);
        });
    }

    function renderSeccion(clave) {
        var cont = document.getElementById('lista-' + clave);
        if (!cont) return;
        cont.innerHTML = '';
        var items = record[clave] || [];

        if (items.length === 0) {
            var vacio = document.createElement('p');
            vacio.className = 'lista-vacia';
            vacio.textContent = 'Todavía no hay nada acá.';
            cont.appendChild(vacio);
            return;
        }

        items.forEach(function (item, idx) {
            var div = document.createElement('div');
            div.className = 'entrada-item';

            div.innerHTML =
                '<div class="entrada-item-header">' +
                '<h4>' + escapeHTML(item.nombre) + '</h4>' +
                '<div class="entrada-item-botones">' +
                '<button type="button" class="entrada-editar" title="Editar">✏️</button>' +
                '<button type="button" class="entrada-borrar" title="Borrar">🗑️</button>' +
                '</div></div>' +
                '<div class="entrada-badges">' + construirBadgesHTML(item, clave) + '</div>' +
                (item.desc ? '<p>' + escapeHTML(item.desc).replace(/\n/g, '<br>') + '</p>' : '') +
                (item.efectoAdicional ? '<p><strong>Efecto adicional:</strong> ' + escapeHTML(item.efectoAdicional).replace(/\n/g, '<br>') + '</p>' : '');

            div.querySelector('.entrada-editar').addEventListener('click', function () {
                abrirEditarEntrada(clave, idx);
            });

            div.querySelector('.entrada-borrar').addEventListener('click', function () {
                abrirConfirmar('¿Borrar "' + item.nombre + '"?', function () {
                    record[clave].splice(idx, 1);
                    guardarRecord();
                    renderSeccion(clave);
                });
            });

            cont.appendChild(div);
        });
    }

    function renderTodasLasSecciones() {
        Object.keys(SECCIONES).forEach(renderSeccion);
    }

    function renderTodo() {
        renderCabecera();
        renderStats();
        renderMods();
        renderTodasLasSecciones();
        actualizarTurnoPanelDOM();
    }

    // ===== Modal de Vida (mismo patrón de combate.js: colores por umbral, clamp) =====

    var hpModal = document.getElementById('hp-modal');
    var hpDisplay = document.getElementById('hp-display');
    var hpBarFill = document.getElementById('hp-bar-fill');

    function actualizarHpModalDOM() {
        var max = Math.max(0, record.vidaMaxima || 0);
        var actual = Math.max(0, Math.min(record.vidaActual, max));
        hpDisplay.textContent = actual + ' / ' + max;
        var pct = max > 0 ? (actual / max) * 100 : 0;
        hpBarFill.style.width = pct + '%';
        if (pct <= 25) {
            hpBarFill.style.backgroundColor = '#c62828';
        } else if (pct <= 50) {
            hpBarFill.style.backgroundColor = '#f9a825';
        } else {
            hpBarFill.style.backgroundColor = '#2e7d32';
        }
    }

    function abrirModalHp() {
        actualizarHpModalDOM();
        hpModal.style.display = 'flex';
    }

    Array.prototype.forEach.call(hpModal.querySelectorAll('[data-amount]'), function (btn) {
        btn.addEventListener('click', function () {
            var cambio = parseInt(btn.dataset.amount);
            record.vidaActual = Math.max(0, Math.min(record.vidaMaxima, (record.vidaActual || 0) + cambio));
            guardarRecord();
            actualizarHpModalDOM();
            renderStats();
        });
    });

    Array.prototype.forEach.call(hpModal.querySelectorAll('[data-max-amount]'), function (btn) {
        btn.addEventListener('click', function () {
            var cambio = parseInt(btn.dataset.maxAmount);
            record.vidaMaxima = Math.max(1, (record.vidaMaxima || 0) + cambio);
            record.vidaActual = Math.max(0, Math.min(record.vidaActual, record.vidaMaxima));
            guardarRecord();
            actualizarHpModalDOM();
            renderStats();
        });
    });

    // ===== Modal de CA (con "restaurar original", igual a combate.js) =====

    var caModal = document.getElementById('ca-modal');
    var caDisplay = document.getElementById('ca-display');

    function actualizarCaModalDOM() {
        caDisplay.textContent = record.caActual;
    }

    function abrirModalCa() {
        actualizarCaModalDOM();
        caModal.style.display = 'flex';
    }

    Array.prototype.forEach.call(caModal.querySelectorAll('[data-ca-amount]'), function (btn) {
        btn.addEventListener('click', function () {
            var cambio = parseInt(btn.dataset.caAmount);
            record.caActual = Math.max(0, (record.caActual || 0) + cambio);
            guardarRecord();
            actualizarCaModalDOM();
            renderStats();
        });
    });

    document.getElementById('ca-reset').addEventListener('click', function () {
        record.caActual = record.caBase;
        guardarRecord();
        actualizarCaModalDOM();
        renderStats();
    });

    // ===== Modal genérico Velocidad / Iniciativa / Acciones por turno =====

    var valorModal = document.getElementById('valor-modal');
    var valorModalTitle = document.getElementById('valor-modal-title');
    var valorInput = document.getElementById('valor-input');
    var formValor = document.getElementById('form-valor');
    var campoValorActual = null;

    function abrirModalValor(campo, etiqueta, tipo) {
        campoValorActual = campo;
        valorModalTitle.textContent = etiqueta;
        valorInput.type = tipo;
        if (tipo === 'number') valorInput.min = 1;
        valorInput.value = record[campo];
        valorModal.style.display = 'flex';
        valorInput.focus();
    }

    formValor.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!campoValorActual) return;

        if (campoValorActual === 'accionesPorTurno') {
            var nuevoMax = Math.max(1, parseInt(valorInput.value) || 1);
            var estabaAlMax = record.turnoActual.accion >= record.accionesPorTurno;
            record.accionesPorTurno = nuevoMax;
            record.turnoActual.accion = estabaAlMax ? nuevoMax : Math.min(record.turnoActual.accion, nuevoMax);
        } else if (valorInput.type === 'number') {
            record[campoValorActual] = parseInt(valorInput.value) || 0;
        } else {
            record[campoValorActual] = valorInput.value.trim();
        }

        guardarRecord();
        renderStats();
        actualizarTurnoPanelDOM();
        valorModal.style.display = 'none';
    });

    // ===== Modal para cambiar el ícono (desplegable + opción personalizada) =====

    var iconoModal = document.getElementById('icono-modal');
    var iconoSelect = document.getElementById('icono-select');
    var iconoCustom = document.getElementById('icono-custom');
    var formIcono = document.getElementById('form-icono');

    document.getElementById('icono-enemigo').addEventListener('click', function () {
        var valorActual = record.icono || '👹';
        var opciones = Array.prototype.map.call(iconoSelect.options, function (o) { return o.value; });
        if (opciones.indexOf(valorActual) !== -1) {
            iconoSelect.value = valorActual;
            iconoCustom.style.display = 'none';
            iconoCustom.value = '';
        } else {
            iconoSelect.value = '__custom__';
            iconoCustom.style.display = 'block';
            iconoCustom.value = valorActual;
        }
        iconoModal.style.display = 'flex';
    });

    iconoSelect.addEventListener('change', function () {
        var esCustom = iconoSelect.value === '__custom__';
        iconoCustom.style.display = esCustom ? 'block' : 'none';
        if (esCustom) iconoCustom.focus();
    });

    formIcono.addEventListener('submit', function (e) {
        e.preventDefault();
        var elegido = iconoSelect.value === '__custom__'
            ? (iconoCustom.value.trim() || '👹')
            : iconoSelect.value;
        record.icono = elegido;
        guardarRecord();
        renderCabecera();
        iconoModal.style.display = 'none';
    });

    // ===== Modal para configurar Acciones Legendarias =====

    var legendariasModal = document.getElementById('legendarias-modal');
    var legCheck = document.getElementById('leg-check');
    var legCantCont = document.getElementById('leg-cant-cont');
    var legCant = document.getElementById('leg-cant');
    var formLegendarias = document.getElementById('form-legendarias');

    function abrirModalLegendarias() {
        legCheck.checked = !!record.legendariasHabilitadas;
        legCant.value = record.legendariasPorRonda || 3;
        legCantCont.style.display = legCheck.checked ? 'block' : 'none';
        legendariasModal.style.display = 'flex';
    }

    legCheck.addEventListener('change', function () {
        legCantCont.style.display = legCheck.checked ? 'block' : 'none';
    });

    formLegendarias.addEventListener('submit', function (e) {
        e.preventDefault();
        record.legendariasHabilitadas = legCheck.checked;
        record.legendariasPorRonda = legCheck.checked ? Math.max(1, parseInt(legCant.value) || 1) : 0;
        record.turnoActual.legendaria = record.legendariasPorRonda;
        guardarRecord();
        renderStats();
        actualizarTurnoPanelDOM();
        legendariasModal.style.display = 'none';
    });

    // ===== Modal único para agregar/editar una entrada (el tipo lo elige un desplegable) =====

    var entradaModal = document.getElementById('entrada-modal');
    var entradaModalTitulo = document.getElementById('entrada-modal-titulo');
    var entradaSubmitBtn = document.getElementById('entrada-submit-btn');
    var formEntrada = document.getElementById('form-entrada');
    var entradaTipo = document.getElementById('entrada-tipo');
    var entradaNombre = document.getElementById('entrada-nombre');
    var entradaBonoAtaque = document.getElementById('entrada-bono-ataque');
    var entradaAlcance = document.getElementById('entrada-alcance');
    var entradaDanoCant = document.getElementById('entrada-dano-cant');
    var entradaDanoDado = document.getElementById('entrada-dano-dado');
    var entradaDanoExtra = document.getElementById('entrada-dano-extra');
    var entradaTipoDano = document.getElementById('entrada-tipo-dano');
    var entradaMasDanoCheck = document.getElementById('entrada-mas-dano-check');
    var bloqueDanoExtra = document.getElementById('bloque-dano-extra');
    var entradaDano2Cant = document.getElementById('entrada-dano2-cant');
    var entradaDano2Dado = document.getElementById('entrada-dano2-dado');
    var entradaDano2Extra = document.getElementById('entrada-dano2-extra');
    var entradaTipoDano2 = document.getElementById('entrada-tipo-dano2');
    var bloqueConsumo = document.getElementById('bloque-consumo');
    var entradaConsumoLabel = document.getElementById('entrada-consumo-label');
    var entradaConsumo = document.getElementById('entrada-consumo');
    var entradaDesc = document.getElementById('entrada-desc');
    var entradaEfecto = document.getElementById('entrada-efecto');

    var editando = null; // { seccion, idx } mientras se edita una entrada existente, null si es "Agregar"

    entradaMasDanoCheck.addEventListener('change', function () {
        bloqueDanoExtra.style.display = entradaMasDanoCheck.checked ? 'block' : 'none';
    });

    function actualizarBloqueConsumo() {
        var tipo = entradaTipo.value;
        if (CATEGORIAS_CON_CONSUMO[tipo]) {
            bloqueConsumo.style.display = 'block';
            entradaConsumoLabel.textContent = 'Consume cuántas ' + CATEGORIAS_CON_CONSUMO[tipo];
        } else {
            bloqueConsumo.style.display = 'none';
        }
    }

    entradaTipo.addEventListener('change', actualizarBloqueConsumo);

    function resetFormularioEntrada() {
        formEntrada.reset();
        entradaDanoCant.value = 0;
        entradaDanoExtra.value = 0;
        entradaDano2Cant.value = 0;
        entradaDano2Extra.value = 0;
        entradaConsumo.value = 1;
        bloqueDanoExtra.style.display = 'none';
        actualizarBloqueConsumo();
    }

    function abrirAgregarEntrada() {
        editando = null;
        resetFormularioEntrada();
        entradaModalTitulo.textContent = 'Agregar';
        entradaSubmitBtn.textContent = 'Confirmar';
        entradaModal.style.display = 'flex';
        entradaNombre.focus();
    }

    function abrirEditarEntrada(seccion, idx) {
        var item = (record[seccion] || [])[idx];
        if (!item) return;
        editando = { seccion: seccion, idx: idx };

        entradaTipo.value = seccion;
        entradaNombre.value = item.nombre || '';
        entradaBonoAtaque.value = (item.bonoAtaque !== null && item.bonoAtaque !== undefined) ? item.bonoAtaque : '';
        entradaAlcance.value = item.alcance || '';

        var danos = normalizarDanos(item);
        var d1 = danos[0] || {};
        entradaDanoCant.value = d1.cantidad || 0;
        entradaDanoDado.value = d1.dado || '';
        entradaDanoExtra.value = (d1.extra !== undefined) ? d1.extra : 0;
        entradaTipoDano.value = d1.tipoDano || '';

        var d2 = danos[1];
        if (d2) {
            entradaMasDanoCheck.checked = true;
            bloqueDanoExtra.style.display = 'block';
            entradaDano2Cant.value = d2.cantidad || 0;
            entradaDano2Dado.value = d2.dado || '';
            entradaDano2Extra.value = (d2.extra !== undefined) ? d2.extra : 0;
            entradaTipoDano2.value = d2.tipoDano || '';
        } else {
            entradaMasDanoCheck.checked = false;
            bloqueDanoExtra.style.display = 'none';
            entradaDano2Cant.value = 0;
            entradaDano2Dado.value = '';
            entradaDano2Extra.value = 0;
            entradaTipoDano2.value = '';
        }

        entradaConsumo.value = normalizarConsumo(item);
        actualizarBloqueConsumo();

        entradaDesc.value = item.desc || '';
        entradaEfecto.value = item.efectoAdicional || '';

        entradaModalTitulo.textContent = 'Editar';
        entradaSubmitBtn.textContent = 'Guardar cambios';
        entradaModal.style.display = 'flex';
        entradaNombre.focus();
    }

    document.getElementById('btn-agregar-global').addEventListener('click', abrirAgregarEntrada);

    formEntrada.addEventListener('submit', function (e) {
        e.preventDefault();
        var nombre = entradaNombre.value.trim();
        if (!nombre) return;
        var seccion = entradaTipo.value;
        if (!SECCIONES[seccion]) return;

        var danos = [];
        if (entradaDanoDado.value) {
            danos.push({
                cantidad: parseInt(entradaDanoCant.value) || 0,
                dado: entradaDanoDado.value,
                extra: parseInt(entradaDanoExtra.value) || 0,
                tipoDano: entradaTipoDano.value
            });
        }
        if (entradaMasDanoCheck.checked && entradaDano2Dado.value) {
            danos.push({
                cantidad: parseInt(entradaDano2Cant.value) || 0,
                dado: entradaDano2Dado.value,
                extra: parseInt(entradaDano2Extra.value) || 0,
                tipoDano: entradaTipoDano2.value
            });
        }

        var item = {
            nombre: nombre,
            bonoAtaque: entradaBonoAtaque.value !== '' ? (parseInt(entradaBonoAtaque.value) || 0) : null,
            alcance: entradaAlcance.value.trim(),
            danos: danos,
            consumo: Math.max(1, parseInt(entradaConsumo.value) || 1),
            desc: entradaDesc.value.trim(),
            efectoAdicional: entradaEfecto.value.trim()
        };

        if (editando) {
            record[editando.seccion].splice(editando.idx, 1);
            record[seccion].push(item);
            guardarRecord();
            renderSeccion(editando.seccion);
            if (seccion !== editando.seccion) renderSeccion(seccion);
        } else {
            record[seccion].push(item);
            guardarRecord();
            renderSeccion(seccion);
        }

        editando = null;
        entradaModal.style.display = 'none';
    });

    // ===== Modal: lista de entradas de una categoría (se abre desde el menú de turno) =====

    var listaModal = document.getElementById('lista-modal');
    var listaModalTitulo = document.getElementById('lista-modal-titulo');
    var listaModalContenido = document.getElementById('lista-modal-contenido');

    function abrirListaModalTurno(seccionClave, poolKey) {
        listaModalTitulo.textContent = SECCIONES[seccionClave].titulo;
        listaModalContenido.innerHTML = '';
        var items = record[seccionClave] || [];

        if (items.length === 0) {
            var vacio = document.createElement('p');
            vacio.className = 'lista-vacia';
            vacio.textContent = 'Todavía no hay nada acá.';
            listaModalContenido.appendChild(vacio);
        } else {
            items.forEach(function (item, idx) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'skill-btn';
                var primerDano = formatoDano(normalizarDanos(item)[0]);
                btn.innerHTML =
                    '<span class="fila-lista-btn">' +
                    '<strong>' + escapeHTML(item.nombre) + '</strong>' +
                    (primerDano ? '<span class="skill-mod" style="background-color:#6a1b9a;color:white;">' + escapeHTML(primerDano) + '</span>' : '') +
                    '</span>';
                btn.addEventListener('click', function () {
                    listaModal.style.display = 'none';
                    consumirYMostrarDetalle(seccionClave, idx, poolKey);
                });
                listaModalContenido.appendChild(btn);
            });
        }

        listaModal.style.display = 'flex';
    }

    // ===== Modal: detalle de una entrada (solo lectura, para consultar en combate) =====

    var detalleModal = document.getElementById('detalle-modal');
    var detalleNombre = document.getElementById('detalle-nombre');
    var detalleBadges = document.getElementById('detalle-badges');
    var detalleDesc = document.getElementById('detalle-desc');
    var detalleEfectoCont = document.getElementById('detalle-efecto-cont');
    var detalleEfecto = document.getElementById('detalle-efecto');

    function mostrarDetalle(item, seccionClave) {
        detalleNombre.textContent = item.nombre;
        detalleBadges.innerHTML = construirBadgesHTML(item, seccionClave);
        detalleDesc.innerHTML = item.desc ? escapeHTML(item.desc).replace(/\n/g, '<br>') : '<em style="color:var(--text-muted);">Sin descripción.</em>';
        if (item.efectoAdicional) {
            detalleEfecto.innerHTML = escapeHTML(item.efectoAdicional).replace(/\n/g, '<br>');
            detalleEfectoCont.style.display = 'block';
        } else {
            detalleEfectoCont.style.display = 'none';
        }
        detalleModal.style.display = 'flex';
    }

    // Descuenta del pool correspondiente (turnoActual) el "consumo" de la entrada elegida desde
    // el menú de turno, y muestra su detalle para que el DM pueda leerlo/resolver el ataque.
    function consumirYMostrarDetalle(seccionClave, idx, poolKey) {
        var item = (record[seccionClave] || [])[idx];
        if (!item) return;
        var costo = CATEGORIAS_CON_CONSUMO[seccionClave] ? normalizarConsumo(item) : 1;
        record.turnoActual[poolKey] = Math.max(0, (record.turnoActual[poolKey] || 0) - costo);
        guardarRecord();
        actualizarTurnoPanelDOM();
        mostrarDetalle(item, seccionClave);
    }

    // ===== Modal de confirmación genérico (reemplaza confirm()/alert() nativos) =====

    var confirmarModal = document.getElementById('confirmar-modal');
    var confirmarMensaje = document.getElementById('confirmar-mensaje');
    var confirmarSiBtn = document.getElementById('confirmar-si');
    var confirmarNoBtn = document.getElementById('confirmar-no');
    var confirmarCallback = null;

    function abrirConfirmar(mensaje, onSi) {
        confirmarMensaje.textContent = mensaje;
        confirmarCallback = onSi;
        confirmarModal.style.display = 'flex';
    }

    confirmarSiBtn.addEventListener('click', function () {
        var cb = confirmarCallback;
        confirmarModal.style.display = 'none';
        confirmarCallback = null;
        if (cb) cb();
    });

    confirmarNoBtn.addEventListener('click', function () {
        confirmarModal.style.display = 'none';
        confirmarCallback = null;
    });

    // ===== Borrar enemigo =====

    document.getElementById('btn-borrar-enemigo').addEventListener('click', function () {
        abrirConfirmar('¿Borrar a "' + record.nombre + '" definitivamente? Esta acción no se puede deshacer.', function () {
            localStorage.removeItem('enemigo_' + id);
            window.location.href = 'enemigos.html';
        });
    });

    // ===== Menú flotante de turno (mismo patrón que personaje.html) =====

    var turnoFab = document.getElementById('turno-fab');
    var turnoToggle = document.getElementById('turno-toggle');
    var turnoPanel = document.getElementById('turno-panel');
    var turnoReset = document.getElementById('turno-reset');

    function actualizarTurnoPanelDOM() {
        function pintar(id2, actual, max) {
            var el = document.getElementById(id2);
            if (!el) return;
            el.textContent = actual + ' / ' + max;
            el.classList.toggle('agotado', actual <= 0);
        }
        pintar('turno-valor-accion', record.turnoActual.accion, record.accionesPorTurno);
        pintar('turno-valor-bonus', record.turnoActual.bonus, 1);
        pintar('turno-valor-reaccion', record.turnoActual.reaccion, 1);

        var itemLeg = document.getElementById('turno-item-legendaria');
        if (record.legendariasHabilitadas) {
            itemLeg.style.display = 'flex';
            pintar('turno-valor-legendaria', record.turnoActual.legendaria, record.legendariasPorRonda);
        } else {
            itemLeg.style.display = 'none';
        }
    }

    turnoToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var visible = turnoPanel.style.display === 'block';
        turnoPanel.style.display = visible ? 'none' : 'block';
        if (!visible) actualizarTurnoPanelDOM();
    });

    document.addEventListener('click', function (e) {
        if (turnoFab && !turnoFab.contains(e.target)) {
            turnoPanel.style.display = 'none';
        }
    });

    var MAPA_TURNO = {
        accion: { seccion: 'acciones', pool: 'accion' },
        bonus: { seccion: 'accionesBonus', pool: 'bonus' },
        reaccion: { seccion: 'reacciones', pool: 'reaccion' },
        legendaria: { seccion: 'accionesLegendarias', pool: 'legendaria' }
    };

    Array.prototype.forEach.call(document.querySelectorAll('.turno-item'), function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var tipo = btn.dataset.tipo;
            var mapa = MAPA_TURNO[tipo];
            if (!mapa) return;
            turnoPanel.style.display = 'none';
            abrirListaModalTurno(mapa.seccion, mapa.pool);
        });
    });

    turnoReset.addEventListener('click', function (e) {
        e.stopPropagation();
        record.turnoActual = {
            accion: record.accionesPorTurno,
            bonus: 1,
            reaccion: 1,
            legendaria: record.legendariasPorRonda
        };
        guardarRecord();
        actualizarTurnoPanelDOM();
        turnoPanel.style.display = 'none';
    });

    // ===== Cierre de modales (mismo patrón que enemigos.html/combate.html) =====
    // El modal de confirmación NO tiene botón de cerrar ni se cierra clickeando afuera
    // a propósito: obliga a elegir Sí o No explícitamente (mismo criterio que ya usaba
    // #detalle-modal en combate.html para no cerrarse por accidente).

    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (el) {
        el.addEventListener('click', function () {
            document.getElementById(el.dataset.close).style.display = 'none';
            campoValorActual = null;
        });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.modal'), function (modal) {
        if (modal.id === 'confirmar-modal') return;
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                campoValorActual = null;
            }
        });
    });

    // ===== Carga inicial =====
    renderTodo();
}
