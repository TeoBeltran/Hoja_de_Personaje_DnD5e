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
        // Velocidad pasó de texto libre (ej. "40ft") a número en pies, para poder
        // editarla con el mismo stepper ±1/±5 que Vida/CA. Se extrae el primer
        // número que aparezca en el texto viejo (default 30 si no hay ninguno).
        if (typeof record.velocidad !== 'number') {
            var match = String(record.velocidad || '').match(/\d+/);
            record.velocidad = match ? parseInt(match[0]) : 30;
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

    // Colorea el tile de Vida según el % actual (mismo criterio que personaje.html):
    // 100%-66% = verde, 65%-36% = amarillo, 35%-15% = naranja, <15% = rojo, y
    // exactamente 0 = gris (estado aparte, no "rojo más fuerte").
    function claseColorVida(actual, maximo) {
        if (!maximo || maximo <= 0) return null;
        if (actual <= 0) return 'vida-cero';
        var pct = (actual / maximo) * 100;
        if (pct < 15) return 'vida-muy-critica';
        if (pct <= 35) return 'vida-critica';
        if (pct <= 65) return 'vida-baja';
        return 'vida-full'; // 66% a 100% es todo verde
    }

    function aplicarClaseColorVida(btn, actual, maximo) {
        if (!btn) return;
        btn.classList.remove('vida-full', 'vida-baja', 'vida-critica', 'vida-muy-critica', 'vida-cero');
        var clase = claseColorVida(actual, maximo);
        if (clase) btn.classList.add(clase);
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
            badges += '<span class="skill-mod" style="background-color:var(--accent-color);color:white;">' + escapeHTML(item.alcance) + '</span>';
        }
        normalizarDanos(item).forEach(function (d) {
            var texto = formatoDano(d);
            if (texto) badges += '<span class="skill-mod" style="background-color:#6a1b9a;color:white;">' + escapeHTML(texto) + '</span>';
        });
        if (CATEGORIAS_CON_CONSUMO[seccionClave]) {
            var consumo = normalizarConsumo(item);
            badges += '<span class="skill-mod" style="background-color:var(--naranja-fill);color:white;">Consume ' + consumo + ' ' + CATEGORIAS_CON_CONSUMO[seccionClave] + '</span>';
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
        aplicarClaseColorVida(btnVida, record.vidaActual, record.vidaMaxima);
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
        btnVel.innerHTML = '<span>Velocidad</span><span class="skill-mod">' + record.velocidad + 'ft</span>';
        btnVel.addEventListener('click', function () { abrirModalValor('velocidad', 'Velocidad', { min: 0, sufijo: 'ft' }); });
        grid.appendChild(btnVel);

        var btnIni = document.createElement('button');
        btnIni.type = 'button';
        btnIni.className = 'skill-btn';
        btnIni.innerHTML = '<span>Iniciativa</span><span class="skill-mod">' + fmtMod(record.iniciativa) + '</span>';
        btnIni.addEventListener('click', function () { abrirModalValor('iniciativa', 'Iniciativa', {}); });
        grid.appendChild(btnIni);

        var btnAcciones = document.createElement('button');
        btnAcciones.type = 'button';
        btnAcciones.className = 'skill-btn';
        btnAcciones.innerHTML = '<span>Acciones/Turno</span><span class="skill-mod">' + record.accionesPorTurno + '</span>';
        btnAcciones.addEventListener('click', function () { abrirModalValor('accionesPorTurno', 'Acciones por turno', { min: 1 }); });
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

            div.querySelector('.entrada-editar').addEventListener('click', function (e) {
                e.stopPropagation();
                abrirEditarEntrada(clave, idx);
            });

            div.querySelector('.entrada-borrar').addEventListener('click', function (e) {
                e.stopPropagation();
                abrirConfirmar('¿Borrar "' + item.nombre + '"?', function () {
                    record[clave].splice(idx, 1);
                    guardarRecord();
                    renderSeccion(clave);
                });
            });

            // Tocar la card (fuera de los botones ✏️/🗑️) abre el mismo modal de detalle
            // que usa el menú de turno, con el botón "Usar" — igual que en la hoja de jugador.
            div.addEventListener('click', function () {
                mostrarDetalle(item, clave, idx);
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
        // Mismos 5 tramos que el tile de Vida (claseColorVida más arriba) y que combate.js:
        // 100%-66% verde, 65%-36% amarillo, 35%-15% naranja, <15% rojo, 0 gris. Se usan las
        // variables CSS (no un hex fijo) para que el color se resuelva solo según el tema activo.
        if (actual <= 0) {
            hpBarFill.style.backgroundColor = 'var(--gris-fill)';
        } else if (pct < 15) {
            hpBarFill.style.backgroundColor = 'var(--rojo-fill)';
        } else if (pct <= 35) {
            hpBarFill.style.backgroundColor = 'var(--naranja-fill)';
        } else if (pct <= 65) {
            hpBarFill.style.backgroundColor = 'var(--amarillo-fill)';
        } else {
            hpBarFill.style.backgroundColor = 'var(--vida-full-fill)';
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

    // ===== Modal genérico (stepper ±1/±5) para Velocidad / Iniciativa / Acciones por turno =====
    // Mismo patrón que Vida/CA: cada click aplica y guarda al toque, no hay "Guardar" aparte.

    var valorModal = document.getElementById('valor-modal');
    var valorModalTitle = document.getElementById('valor-modal-title');
    var valorDisplay = document.getElementById('valor-display');
    var campoValorActual = null;
    var valorMinActual = null;   // null = sin mínimo (permite negativos, ej. Iniciativa)
    var valorSufijoActual = '';  // ej. "ft" para Velocidad

    function actualizarValorModalDOM() {
        if (!campoValorActual) return;
        var val = record[campoValorActual];
        var texto = (campoValorActual === 'iniciativa') ? fmtMod(val) : String(val);
        valorDisplay.textContent = texto + valorSufijoActual;
    }

    function abrirModalValor(campo, etiqueta, opts) {
        campoValorActual = campo;
        valorModalTitle.textContent = etiqueta;
        valorMinActual = (opts && opts.min !== undefined) ? opts.min : null;
        valorSufijoActual = (opts && opts.sufijo) || '';
        actualizarValorModalDOM();
        valorModal.style.display = 'flex';
    }

    Array.prototype.forEach.call(valorModal.querySelectorAll('[data-valor-amount]'), function (btn) {
        btn.addEventListener('click', function () {
            if (!campoValorActual) return;
            var delta = parseInt(btn.dataset.valorAmount);

            if (campoValorActual === 'accionesPorTurno') {
                var maxViejo = record.accionesPorTurno;
                var estabaAlMax = record.turnoActual.accion >= maxViejo;
                var nuevoMax = Math.max(1, maxViejo + delta);
                record.accionesPorTurno = nuevoMax;
                record.turnoActual.accion = estabaAlMax ? nuevoMax : Math.min(record.turnoActual.accion, nuevoMax);
            } else {
                var actual = parseInt(record[campoValorActual]) || 0;
                var nuevo = actual + delta;
                if (valorMinActual !== null) nuevo = Math.max(valorMinActual, nuevo);
                record[campoValorActual] = nuevo;
            }

            guardarRecord();
            actualizarValorModalDOM();
            renderStats();
            actualizarTurnoPanelDOM();
        });
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

    // ===== Modal para configurar Acciones Legendarias (checkbox + stepper ±1/±5) =====
    // Igual que el resto: cada click/toggle aplica y guarda al toque, no hay "Guardar" aparte.

    var legendariasModal = document.getElementById('legendarias-modal');
    var legCheck = document.getElementById('leg-check');
    var legCantCont = document.getElementById('leg-cant-cont');
    var legCantDisplay = document.getElementById('leg-cant-display');

    function actualizarLegendariasModalDOM() {
        legCheck.checked = !!record.legendariasHabilitadas;
        legCantCont.style.display = legCheck.checked ? 'block' : 'none';
        legCantDisplay.textContent = record.legendariasPorRonda || 0;
    }

    function abrirModalLegendarias() {
        actualizarLegendariasModalDOM();
        legendariasModal.style.display = 'flex';
    }

    legCheck.addEventListener('change', function () {
        record.legendariasHabilitadas = legCheck.checked;
        if (legCheck.checked && !record.legendariasPorRonda) {
            record.legendariasPorRonda = 3;
        }
        if (!legCheck.checked) {
            record.legendariasPorRonda = 0;
        }
        record.turnoActual.legendaria = record.legendariasPorRonda;
        guardarRecord();
        actualizarLegendariasModalDOM();
        renderStats();
        actualizarTurnoPanelDOM();
    });

    Array.prototype.forEach.call(legendariasModal.querySelectorAll('[data-leg-amount]'), function (btn) {
        btn.addEventListener('click', function () {
            var delta = parseInt(btn.dataset.legAmount);
            var maxViejo = record.legendariasPorRonda || 0;
            var estabaAlMax = record.turnoActual.legendaria >= maxViejo;
            var nuevo = Math.max(1, maxViejo + delta);
            record.legendariasPorRonda = nuevo;
            record.turnoActual.legendaria = estabaAlMax ? nuevo : Math.min(record.turnoActual.legendaria, nuevo);
            guardarRecord();
            actualizarLegendariasModalDOM();
            renderStats();
            actualizarTurnoPanelDOM();
        });
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

    // Categorías cuyas entradas consumen un pool del menú de turno, mapeadas a la key
    // de ese pool en turnoActual. "habilidades" queda afuera a propósito: son pasivas,
    // no consumen nada, así que su modal de detalle no muestra el botón "Usar".
    var MAPA_POOL_POR_SECCION = {
        acciones: 'accion',
        accionesBonus: 'bonus',
        reacciones: 'reaccion',
        accionesLegendarias: 'legendaria'
    };

    // ===== Modal: lista de entradas de una categoría (se abre desde el menú de turno) =====

    var listaModal = document.getElementById('lista-modal');
    var listaModalTitulo = document.getElementById('lista-modal-titulo');
    var listaModalContenido = document.getElementById('lista-modal-contenido');

    function abrirListaModalTurno(seccionClave) {
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
                    mostrarDetalle(item, seccionClave, idx);
                });
                listaModalContenido.appendChild(btn);
            });
        }

        listaModal.style.display = 'flex';
    }

    // ===== Modal: detalle de una entrada, con botón "Usar" (igual que la hoja de jugador) =====
    // Se abre TANTO al tocar una card inline como al elegir una entrada desde el menú de
    // turno — en ningún caso consume nada solo por abrirse; el consumo pasa a ser explícito,
    // recién al tocar "Usar" adentro.

    var detalleModal = document.getElementById('detalle-modal');
    var detalleNombre = document.getElementById('detalle-nombre');
    var detalleBadges = document.getElementById('detalle-badges');
    var detalleDesc = document.getElementById('detalle-desc');
    var detalleEfectoCont = document.getElementById('detalle-efecto-cont');
    var detalleEfecto = document.getElementById('detalle-efecto');
    var detalleModalAcciones = document.getElementById('detalle-modal-acciones');
    var detalleUsarBtn = document.getElementById('detalle-usar-btn');
    var detalleContexto = null; // { seccionClave, idx } de la entrada mostrada actualmente

    function mostrarDetalle(item, seccionClave, idx) {
        detalleContexto = { seccionClave: seccionClave, idx: idx };
        detalleNombre.textContent = item.nombre;
        detalleBadges.innerHTML = construirBadgesHTML(item, seccionClave);
        detalleDesc.innerHTML = item.desc ? escapeHTML(item.desc).replace(/\n/g, '<br>') : '<em style="color:var(--text-muted);">Sin descripción.</em>';
        if (item.efectoAdicional) {
            detalleEfecto.innerHTML = escapeHTML(item.efectoAdicional).replace(/\n/g, '<br>');
            detalleEfectoCont.style.display = 'block';
        } else {
            detalleEfectoCont.style.display = 'none';
        }

        // "Usar" solo tiene sentido si esta categoría gasta un pool del menú de turno
        // (Habilidades/Pasivas son a voluntad, no consumen nada).
        if (MAPA_POOL_POR_SECCION[seccionClave]) {
            detalleUsarBtn.style.display = 'block';
            detalleModalAcciones.classList.remove('una-columna');
        } else {
            detalleUsarBtn.style.display = 'none';
            detalleModalAcciones.classList.add('una-columna');
        }

        detalleModal.style.display = 'flex';
    }

    detalleUsarBtn.addEventListener('click', function () {
        if (!detalleContexto) return;
        var seccionClave = detalleContexto.seccionClave;
        var idx = detalleContexto.idx;
        var poolKey = MAPA_POOL_POR_SECCION[seccionClave];
        if (poolKey) {
            var item = (record[seccionClave] || [])[idx];
            if (item) {
                var costo = CATEGORIAS_CON_CONSUMO[seccionClave] ? normalizarConsumo(item) : 1;
                record.turnoActual[poolKey] = Math.max(0, (record.turnoActual[poolKey] || 0) - costo);
                guardarRecord();
                actualizarTurnoPanelDOM();
            }
        }
        detalleModal.style.display = 'none';
    });

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
        accion: 'acciones',
        bonus: 'accionesBonus',
        reaccion: 'reacciones',
        legendaria: 'accionesLegendarias'
    };

    Array.prototype.forEach.call(document.querySelectorAll('.turno-item'), function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var tipo = btn.dataset.tipo;
            var seccionClave = MAPA_TURNO[tipo];
            if (!seccionClave) return;
            turnoPanel.style.display = 'none';
            abrirListaModalTurno(seccionClave);
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

    // ===== Cierre de modales =====
    // Ningún modal de esta hoja se cierra clickeando afuera — solo con su botón de
    // cerrar/cancelar (la X, o "Cerrar"/"Cancelar"/"No"). Es a propósito: un misclick
    // durante el combate no debe cerrar nada por accidente.

    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (el) {
        el.addEventListener('click', function () {
            document.getElementById(el.dataset.close).style.display = 'none';
            campoValorActual = null;
        });
    });

    // ===== Carga inicial =====
    renderTodo();
}
