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
        habilidades: { titulo: 'Habilidad / Pasiva', lista: 'lista-habilidades' },
        acciones: { titulo: 'Acción', lista: 'lista-acciones' },
        accionesBonus: { titulo: 'Acción Adicional', lista: 'lista-accionesBonus' },
        reacciones: { titulo: 'Reacción', lista: 'lista-reacciones' },
        accionesLegendarias: { titulo: 'Acción Legendaria', lista: 'lista-accionesLegendarias' }
    };

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

    function formatoDano(item) {
        if (!item.danoDado) return '';
        var extra = parseInt(item.danoExtra) || 0;
        var cant = parseInt(item.danoCantidad) || 0;
        return cant + 'd' + item.danoDado + (extra >= 0 ? '+' + extra : extra) + (item.tipoDano ? ' ' + item.tipoDano : '');
    }

    function renderSeccion(clave) {
        var cfg = SECCIONES[clave];
        var cont = document.getElementById(cfg.lista);
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

            var badges = '';
            if (item.bonoAtaque !== undefined && item.bonoAtaque !== null && item.bonoAtaque !== '') {
                badges += '<span class="skill-mod" style="background-color:#2e7d32;color:white;">' + fmtMod(item.bonoAtaque) + ' al ataque</span>';
            }
            if (item.alcance) {
                badges += '<span class="skill-mod" style="background-color:#5d4037;color:white;">' + escapeHTML(item.alcance) + '</span>';
            }
            var dano = formatoDano(item);
            if (dano) {
                badges += '<span class="skill-mod" style="background-color:#6a1b9a;color:white;">' + escapeHTML(dano) + '</span>';
            }

            div.innerHTML =
                '<span class="entrada-borrar" title="Borrar">&times;</span>' +
                '<h4>' + escapeHTML(item.nombre) + '</h4>' +
                (badges ? '<div class="entrada-badges">' + badges + '</div>' : '') +
                (item.desc ? '<p>' + escapeHTML(item.desc).replace(/\n/g, '<br>') + '</p>' : '') +
                (item.efectoAdicional ? '<p><strong>Efecto adicional:</strong> ' + escapeHTML(item.efectoAdicional).replace(/\n/g, '<br>') + '</p>' : '');

            div.querySelector('.entrada-borrar').addEventListener('click', function () {
                if (!confirm('¿Borrar "' + item.nombre + '"?')) return;
                record[clave].splice(idx, 1);
                guardarRecord();
                renderSeccion(clave);
            });
            cont.appendChild(div);
        });
    }

    function renderTodo() {
        renderCabecera();
        renderStats();
        renderMods();
        Object.keys(SECCIONES).forEach(renderSeccion);
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

    // ===== Modal genérico Velocidad / Iniciativa / Ícono =====

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

    document.getElementById('icono-enemigo').addEventListener('click', function () {
        abrirModalValor('icono', 'Ícono (emoji)', 'text');
    });

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
        renderCabecera();
        valorModal.style.display = 'none';
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
    var entradaDesc = document.getElementById('entrada-desc');
    var entradaEfecto = document.getElementById('entrada-efecto');

    document.getElementById('btn-agregar-global').addEventListener('click', function () {
        formEntrada.reset();
        entradaDanoCant.value = 0;
        entradaDanoExtra.value = 0;
        entradaModal.style.display = 'flex';
        entradaNombre.focus();
    });

    formEntrada.addEventListener('submit', function (e) {
        e.preventDefault();
        var nombre = entradaNombre.value.trim();
        if (!nombre) return;
        var seccion = entradaTipo.value;
        if (!SECCIONES[seccion]) return;

        var item = {
            nombre: nombre,
            bonoAtaque: entradaBonoAtaque.value !== '' ? (parseInt(entradaBonoAtaque.value) || 0) : null,
            alcance: entradaAlcance.value.trim(),
            danoCantidad: parseInt(entradaDanoCant.value) || 0,
            danoDado: entradaDanoDado.value,
            danoExtra: parseInt(entradaDanoExtra.value) || 0,
            tipoDano: entradaTipoDano.value,
            desc: entradaDesc.value.trim(),
            efectoAdicional: entradaEfecto.value.trim()
        };

        record[seccion].push(item);
        guardarRecord();
        renderSeccion(seccion);

        // Abre la sección correspondiente para que se vea lo recién agregado.
        var detailsEl = document.getElementById(SECCIONES[seccion].lista).closest('details');
        if (detailsEl) detailsEl.open = true;

        entradaModal.style.display = 'none';
    });

    // ===== Borrar enemigo =====

    document.getElementById('btn-borrar-enemigo').addEventListener('click', function () {
        if (!confirm('¿Borrar a "' + record.nombre + '" definitivamente? Esta acción no se puede deshacer.')) return;
        localStorage.removeItem('enemigo_' + id);
        window.location.href = 'enemigos.html';
    });

    // ===== Cierre de modales (mismo patrón que enemigos.html/combate.html) =====

    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (el) {
        el.addEventListener('click', function () {
            document.getElementById(el.dataset.close).style.display = 'none';
            campoValorActual = null;
        });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.modal'), function (modal) {
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
