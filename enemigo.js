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

    // ===== Daño: siempre se trabaja como un array de {cantidad, dado, extra, tipoDano} =====
    // (compatibilidad con entradas viejas que tenían los campos sueltos en vez del array).

    function normalizarDanos(item) {
        if (item.danos && Array.isArray(item.danos)) return item.danos;
        if (item.danoDado) {
            return [{ cantidad: item.danoCantidad, dado: item.danoDado, extra: item.danoExtra, tipoDano: item.tipoDano }];
        }
        return [];
    }

    function formatoDano(d) {
        if (!d || !d.dado) return '';
        var extra = parseInt(d.extra) || 0;
        var cant = parseInt(d.cantidad) || 0;
        return cant + 'd' + d.dado + (extra >= 0 ? '+' + extra : extra) + (d.tipoDano ? ' ' + d.tipoDano : '');
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

    function renderMenuCategorias() {
        Object.keys(SECCIONES).forEach(function (clave) {
            var el = document.getElementById('count-' + clave);
            if (el) el.textContent = (record[clave] || []).length;
        });
    }

    function renderTodo() {
        renderCabecera();
        renderStats();
        renderMods();
        renderMenuCategorias();
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

    // ===== Modal genérico Velocidad / Iniciativa =====

    var valorModal = document.getElementById('valor-modal');
    var valorModalTitle = document.getElementById('valor-modal-title');
    var valorInput = document.getElementById('valor-input');
    var formValor = document.getElementById('form-valor');
    var campoValorActual = null;

    function abrirModalValor(campo, etiqueta, tipo) {
        campoValorActual = campo;
        valorModalTitle.textContent = etiqueta;
        valorInput.type = tipo;
        valorInput.value = record[campo];
        valorModal.style.display = 'flex';
        valorInput.focus();
    }

    formValor.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!campoValorActual) return;
        if (valorInput.type === 'number') {
            record[campoValorActual] = parseInt(valorInput.value) || 0;
        } else {
            record[campoValorActual] = valorInput.value.trim();
        }
        guardarRecord();
        renderStats();
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

    // ===== Modal único para agregar una entrada (el tipo lo elige un desplegable) =====

    var entradaModal = document.getElementById('entrada-modal');
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
    var entradaDesc = document.getElementById('entrada-desc');
    var entradaEfecto = document.getElementById('entrada-efecto');

    entradaMasDanoCheck.addEventListener('change', function () {
        bloqueDanoExtra.style.display = entradaMasDanoCheck.checked ? 'block' : 'none';
    });

    document.getElementById('btn-agregar-global').addEventListener('click', function () {
        formEntrada.reset();
        entradaDanoCant.value = 0;
        entradaDanoExtra.value = 0;
        entradaDano2Cant.value = 0;
        entradaDano2Extra.value = 0;
        bloqueDanoExtra.style.display = 'none';
        entradaModal.style.display = 'flex';
        entradaNombre.focus();
    });

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
            desc: entradaDesc.value.trim(),
            efectoAdicional: entradaEfecto.value.trim()
        };

        record[seccion].push(item);
        guardarRecord();
        renderMenuCategorias();
        entradaModal.style.display = 'none';
    });

    // ===== Modal: lista de entradas de una categoría =====

    var listaModal = document.getElementById('lista-modal');
    var listaModalTitulo = document.getElementById('lista-modal-titulo');
    var listaModalContenido = document.getElementById('lista-modal-contenido');

    function abrirListaModal(clave) {
        listaModalTitulo.textContent = SECCIONES[clave].titulo;
        listaModalContenido.innerHTML = '';
        var items = record[clave] || [];

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
                    abrirDetalleModal(clave, idx);
                });
                listaModalContenido.appendChild(btn);
            });
        }

        listaModal.style.display = 'flex';
    }

    Array.prototype.forEach.call(document.querySelectorAll('#menu-categorias [data-cat]'), function (btn) {
        btn.addEventListener('click', function () {
            abrirListaModal(btn.dataset.cat);
        });
    });

    // ===== Modal: detalle de una entrada =====

    var detalleModal = document.getElementById('detalle-modal');
    var detalleNombre = document.getElementById('detalle-nombre');
    var detalleBadges = document.getElementById('detalle-badges');
    var detalleDesc = document.getElementById('detalle-desc');
    var detalleEfectoCont = document.getElementById('detalle-efecto-cont');
    var detalleEfecto = document.getElementById('detalle-efecto');
    var seccionDetalleActual = null;
    var idxDetalleActual = null;

    function abrirDetalleModal(clave, idx) {
        var item = (record[clave] || [])[idx];
        if (!item) return;
        seccionDetalleActual = clave;
        idxDetalleActual = idx;

        detalleNombre.textContent = item.nombre;

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
        detalleBadges.innerHTML = badges;

        detalleDesc.innerHTML = item.desc ? escapeHTML(item.desc).replace(/\n/g, '<br>') : '<em style="color:var(--text-muted);">Sin descripción.</em>';

        if (item.efectoAdicional) {
            detalleEfecto.innerHTML = escapeHTML(item.efectoAdicional).replace(/\n/g, '<br>');
            detalleEfectoCont.style.display = 'block';
        } else {
            detalleEfectoCont.style.display = 'none';
        }

        detalleModal.style.display = 'flex';
    }

    document.getElementById('btn-borrar-entrada').addEventListener('click', function () {
        if (seccionDetalleActual === null || idxDetalleActual === null) return;
        var item = record[seccionDetalleActual][idxDetalleActual];
        abrirConfirmar('¿Borrar "' + item.nombre + '"?', function () {
            record[seccionDetalleActual].splice(idxDetalleActual, 1);
            guardarRecord();
            renderMenuCategorias();
            detalleModal.style.display = 'none';
            seccionDetalleActual = null;
            idxDetalleActual = null;
        });
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
