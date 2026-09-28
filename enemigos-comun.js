// ==========================================================
// Lógica compartida de Enemigos (la usan enemigos.html y enemigo.js).
// Script CLÁSICO (sin type="module") por el mismo motivo que enemigo.js:
// así funciona también abriendo los .html por file://.
//
// Todo cuelga de un único objeto global `EnemigosComun` para no chocar
// con nombres de funciones de las páginas que lo cargan.
//
// Modelo de "acciones por turno":
//   - record.accionesPorTurnoBase: valor manual (default 1), se usa solo si
//     el enemigo NO tiene Multiataque.
//   - Una entrada (en Acciones o Habilidades) con `multiataque: N` (N >= 2)
//     hace que las acciones por turno pasen a ser N, calculado en vivo.
//   - record.accionesPorTurno: SIEMPRE el valor efectivo ya calculado
//     (lo escribe sincronizarAcciones), así cualquier otra pantalla que lo
//     lea ve el número correcto.
//
// Modelo de "usos por turno" (por entrada):
//   - usosPorTurno: número >= 1, o null = sin límite propio (solo lo limita
//     el pool de su categoría: Acciones, Acción Adicional, etc.).
//   - usosRestantes: cuántos quedan en el turno actual. Se repone al tocar
//     "Terminé mi turno".
// ==========================================================

var EnemigosComun = (function () {

    var DADOS_VALIDOS = ['4', '6', '8', '10', '12'];

    var NUMEROS_EN_PALABRAS = {
        un: 1, uno: 1, una: 1, one: 1,
        dos: 2, two: 2, twice: 2,
        tres: 3, three: 3,
        cuatro: 4, four: 4,
        cinco: 5, five: 5,
        seis: 6, six: 6,
        siete: 7, seven: 7,
        ocho: 8, eight: 8,
        nueve: 9, nine: 9,
        diez: 10, ten: 10
    };

    var REGEX_NOMBRE_MULTIATAQUE = /multi[\s-]?(ataque|attack)/i;

    function quitarAcentos(s) {
        return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    // Busca "N ataques" / "N attacks" / "tres golpes" en un texto y devuelve N (o 0).
    function extraerCantidadAtaques(texto) {
        var t = quitarAcentos(texto).toLowerCase();
        var re = /(\d+|[a-z]+)\s+(ataques|attacks|golpes)/g;
        var m;
        while ((m = re.exec(t)) !== null) {
            var tok = m[1];
            var n = /^\d+$/.test(tok) ? parseInt(tok) : (NUMEROS_EN_PALABRAS[tok] || 0);
            if (n >= 2) return n;
        }
        return 0;
    }

    function esNombreMultiataque(nombre) {
        return REGEX_NOMBRE_MULTIATAQUE.test(quitarAcentos(nombre));
    }

    function normalizarDanos(e) {
        var lista = [];
        if (Array.isArray(e.danos)) {
            lista = e.danos;
        } else if (e.danoDado) {
            // Compatibilidad con entradas viejas que tenían los campos sueltos.
            lista = [{ cantidad: e.danoCantidad, dado: e.danoDado, extra: e.danoExtra, tipoDano: e.tipoDano }];
        }
        return lista.filter(function (d) { return d && typeof d === 'object'; }).map(function (d) {
            var dado = String(d.dado === undefined || d.dado === null ? '' : d.dado).replace(/\D/g, '');
            return {
                cantidad: parseInt(d.cantidad) || 0,
                dado: DADOS_VALIDOS.indexOf(dado) !== -1 ? dado : '6',
                extra: parseInt(d.extra) || 0,
                tipoDano: d.tipoDano ? String(d.tipoDano) : ''
            };
        });
    }

    // Normaliza UNA entrada de cualquiera de las 5 categorías. `permiteMultiataque`
    // solo es true para Acciones y Habilidades (donde puede vivir el Multiataque).
    function normalizarEntrada(e, permiteMultiataque) {
        e = (e && typeof e === 'object') ? e : {};
        var bono = e.bonoAtaque;
        var item = {
            nombre: e.nombre ? String(e.nombre) : 'Sin nombre',
            bonoAtaque: (bono !== undefined && bono !== null && bono !== '') ? (parseInt(bono) || 0) : null,
            alcance: e.alcance ? String(e.alcance) : '',
            danos: normalizarDanos(e),
            consumo: (parseInt(e.consumo) > 0) ? parseInt(e.consumo) : 1,
            usosPorTurno: (parseInt(e.usosPorTurno) > 0) ? parseInt(e.usosPorTurno) : null,
            desc: e.desc ? String(e.desc) : '',
            efectoAdicional: e.efectoAdicional ? String(e.efectoAdicional) : ''
        };

        if (item.usosPorTurno) {
            var r = parseInt(e.usosRestantes);
            item.usosRestantes = (!isNaN(r) && r >= 0) ? Math.min(r, item.usosPorTurno) : item.usosPorTurno;
        } else {
            item.usosRestantes = null;
        }

        if (permiteMultiataque) {
            if (e.multiataque !== undefined && e.multiataque !== null && e.multiataque !== '') {
                // Valor explícito (0 = el usuario dijo que NO es multiataque, se respeta).
                var n = parseInt(e.multiataque) || 0;
                item.multiataque = n >= 2 ? n : 0;
            } else if (esNombreMultiataque(item.nombre)) {
                // Sin campo explícito pero se llama "Multiataque"/"Multiattack":
                // se saca la cantidad de la descripción (default 2 si no dice).
                item.multiataque = extraerCantidadAtaques(item.desc + ' ' + item.efectoAdicional) || 2;
            } else {
                item.multiataque = 0;
            }
        } else {
            item.multiataque = 0;
        }

        return item;
    }

    // Devuelve { seccion, idx, cantidad } de la entrada de Multiataque, o null.
    function buscarMultiataque(record) {
        var mejor = null;
        ['acciones', 'habilidades'].forEach(function (sec) {
            (record[sec] || []).forEach(function (it, idx) {
                var n = parseInt(it && it.multiataque) || 0;
                if (n >= 2 && (!mejor || n > mejor.cantidad)) mejor = { seccion: sec, idx: idx, cantidad: n };
            });
        });
        return mejor;
    }

    function calcularAccionesPorTurno(record) {
        var multi = buscarMultiataque(record);
        if (multi) return multi.cantidad;
        return Math.max(1, parseInt(record.accionesPorTurnoBase) || 1);
    }

    // Recalcula record.accionesPorTurno y ajusta el pool del turno actual:
    // si estaba "lleno" pasa al nuevo máximo, si no se recorta al nuevo máximo.
    // Devuelve true si algo cambió.
    function sincronizarAcciones(record) {
        if (!record.turnoActual) record.turnoActual = { accion: 1, bonus: 1, reaccion: 1, legendaria: record.legendariasPorRonda || 0 };
        var viejo = parseInt(record.accionesPorTurno) || 1;
        var nuevo = calcularAccionesPorTurno(record);
        if (viejo === nuevo) return false;
        var estabaAlMax = (record.turnoActual.accion || 0) >= viejo;
        record.accionesPorTurno = nuevo;
        record.turnoActual.accion = estabaAlMax ? nuevo : Math.min(record.turnoActual.accion || 0, nuevo);
        return true;
    }

    // Repone los usos por turno de todas las entradas.
    function reponerUsos(record) {
        ['habilidades', 'acciones', 'accionesBonus', 'reacciones', 'accionesLegendarias'].forEach(function (sec) {
            (record[sec] || []).forEach(function (it) {
                if (it && it.usosPorTurno) it.usosRestantes = it.usosPorTurno;
            });
        });
    }

    return {
        normalizarEntrada: normalizarEntrada,
        normalizarDanos: normalizarDanos,
        buscarMultiataque: buscarMultiataque,
        calcularAccionesPorTurno: calcularAccionesPorTurno,
        sincronizarAcciones: sincronizarAcciones,
        reponerUsos: reponerUsos,
        extraerCantidadAtaques: extraerCantidadAtaques,
        esNombreMultiataque: esNombreMultiataque
    };
})();