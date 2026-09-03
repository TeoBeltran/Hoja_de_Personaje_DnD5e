# CONTEXT_ENEMIGOS.md — Sección Enemigos (pantalla DM)

> Parte de la documentación técnica del proyecto **Hoja de Personaje D&D 5e/5.5e**. Este archivo cubre la sección Enemigos (`enemigos.html`, `enemigo.html`/`enemigo.js`). Para el núcleo de la ficha de personaje ver `CONTEXT_NUCLEO.md`; para el Rastreador de Combate, `CONTEXT_COMBATE.md`; índice general en `PROJECT_CONTEXT.md`.

Sección independiente del sistema de personajes jugables (no toca `script.js` ni `personajes/*.json`). Pensada para que el DM cargue monstruos/NPCs de combate al vuelo, sin tener que escribir un JSON a mano por cada uno.

**`enemigos.html`** — menú/roster. **Sin login propio** (lo tuvo antes: usuario `DM`/clave `boss1234` — se sacó porque el login de `extras.html`, un nivel arriba, ya alcanza; ese usuario/clave pasaron a ser los de `extras.html`). La página renderiza el grid directo al cargar. A diferencia de `extras.html` (array `PERSONAJES_EXTRA` hardcodeado), acá NO hay índice separado: escanea `localStorage` por keys que empiecen con `enemigo_` — así se evita que un índice y los datos reales se desincronicen. Cada enemigo es una card que linkea a `enemigo.html?id=<id>`, más una card "+ Agregar" que abre el modal de creación.

El modal de creación pide: Nombre, Ícono (`select` curado + "🖊️ Personalizado..."), Vida, CA, Velocidad (número en pies, con sufijo "ft" en el render), Iniciativa, Acciones por turno (mínimo 1, default 1), checkbox "¿Tiene acciones legendarias?" (revela "¿Cuántas por ronda?", default 3), y los 6 modificadores de habilidad (ya calculados, no el puntaje bruto). Al mandar el form pasa a un panel de confirmación; "Sí" recién ahí genera el id (`slugify(nombre) + '_' + timestamp-base36`) y escribe `localStorage["enemigo_<id>"]`. Ningún modal se cierra clickeando afuera.

**Modelo de datos** (un solo blob JSON por enemigo, sin diffear contra nada — a diferencia de los personajes jugables):

```json
{
  "id": "owlbear_kx3f9a",
  "nombre": "Oso-Búho",
  "icono": "🦁",
  "vidaMaxima": 60, "vidaActual": 60,
  "caBase": 15, "caActual": 15,
  "velocidad": "40ft",
  "iniciativa": 1,
  "accionesPorTurno": 2,
  "legendariasHabilitadas": true,
  "legendariasPorRonda": 3,
  "turnoActual": { "accion": 2, "bonus": 1, "reaccion": 1, "legendaria": 3 },
  "mods": { "STR": 4, "DEX": 1, "CON": 3, "INT": -4, "WIS": 1, "CHA": -2 },
  "habilidades": [ "..." ],
  "acciones": [
    {
      "nombre": "Zarpazo", "bonoAtaque": 7, "alcance": "cuerpo a cuerpo 5 ft",
      "danos": [ { "cantidad": 2, "dado": "8", "extra": 4, "tipoDano": "cortante" } ],
      "consumo": 1, "desc": "Zarpazo con garras.", "efectoAdicional": ""
    },
    {
      "nombre": "Mordisco", "bonoAtaque": 7, "alcance": "cuerpo a cuerpo 5 ft",
      "danos": [ { "cantidad": 1, "dado": "10", "extra": 4, "tipoDano": "perforante" } ],
      "consumo": 2, "desc": "Mordisco fuerte.", "efectoAdicional": ""
    }
  ],
  "accionesBonus": [ "..." ],
  "reacciones": [ "..." ],
  "accionesLegendarias": [ "..." ]
}
```

`accionesPorTurno`/`legendariasHabilitadas`/`legendariasPorRonda` son la CONFIGURACIÓN (máximos); `turnoActual` es cuánto queda gastado en el turno actual, persiste en el mismo blob. Enemigos de esquemas viejos se migran solos al abrir su hoja (`migrarRecord()` en `enemigo.js`), incluida la conversión de `velocidad` texto libre → número en pies.

Cada entrada de las 5 listas: `nombre`, `bonoAtaque` (número o `null`), `alcance` (texto libre), `danos` (**array**, no un solo set — un ataque puede tener más de un tipo de daño; cada elemento `{ cantidad, dado, extra, tipoDano }`, `dado` como string del número solo, ej. `"6"`, limitado a 4/6/8/10/12), `consumo` (default 1, solo importa en Acciones/Acciones Legendarias), `desc`, `efectoAdicional`. El modal de creación/edición arranca con un bloque de daño; "+ Más daño" agrega un segundo. Entradas de esquemas viejos se normalizan solas (`normalizarDanos()`/`normalizarConsumo()`).

**`enemigo.html` / `enemigo.js`** — hoja individual (`?id=<id>`; redirige a `enemigos.html` si no existe). Sin login propio. **`enemigo.js` es un script CLÁSICO, sin `type="module"`** — deliberado: rompía toda la hoja bajo `file://` por CORS cuando era módulo (bug real ya corregido, probado end-to-end).

Estructura de la hoja:

- **Header**: ícono clickeable + nombre, "🗑️ Borrar enemigo" (modal de confirmación propio).
- **Estadísticas**: 6 tiles clickeables, TODOS con ±1/±5 que aplican al toque: Vida (modal con barra de color + ±1/±5 HP + ±1 Vida Máx.), CA (±1/±5 + "Restaurar"), Velocidad, Iniciativa (modal genérico `#valor-modal`), Acciones/Turno y Acciones Legendarias (`#legendarias-modal`, ajustan `turnoActual` correspondiente al cambiar el máximo).
- **Modificadores**: 6 tiles de solo lectura.
- **"+ Agregar"** (`#entrada-modal`): Tipo (decide el array destino), Nombre, "Bono al d20 (ataque)", Alcance/Rango, bloque de daño A/B/C (+ "Más daño"), Tipo de Daño, campo "Consume cuántas Acciones/Acciones Legendarias" (solo si Tipo es Acción o Acción Legendaria), Descripción, Efecto Adicional. Mismo modal sirve para editar (botón ✏️ en cada card).
- **Las 5 categorías se muestran a lo largo de la página** en secciones colapsables: Habilidades/Pasivas, Acciones, Acciones Bonus, Reacciones, Acciones Legendarias. Cada card: ✏️ Editar / 🗑️ Borrar, badges (ataque, alcance, uno por elemento de `danos`, "Consume N..." si aplica), descripción, efecto adicional. Tocar la card (fuera de ✏️/🗑️) abre `#detalle-modal` con botón "Usar" (para Habilidades/Pasivas, sin botón "Usar" — no consumen nada). Mapeo categoría→pool en `MAPA_POOL_POR_SECCION`.
- **Menú flotante de turno** (`#turno-fab`, calcado de `personaje.html`): contadores Acción N/N, Acción Adicional 1/1, Reacción 1/1, y Acciones Legendarias M/M si aplica. Tocar un contador abre `#lista-modal` con las entradas de esa categoría; tocar una entrada abre `#detalle-modal` (NO consume todavía) — el consumo pasa recién al tocar "Usar" adentro. "🔄 Terminé mi turno" repone todos los pools.
- **Modal de confirmación genérico** (`#confirmar-modal`): sin botón de cerrar, sin cierre al clickear afuera — obliga a elegir "Sí, borrar" o "No".

Todo el estado persiste en la key `enemigo_<id>` en `localStorage`, reescribiendo el blob completo en cada cambio. `enemigos.html` vive detrás del login de `extras.html` (card "🐉 Enemigos", al lado de "⚔️ Combate") — ver `CONTEXT_COMBATE.md` para cómo un enemigo se suma después a un combate.

**Importar por JSON**: al lado de "+ Agregar" hay "📥 Importar" (`#modal-importar`) con: un `<textarea readonly>` de instrucciones fijas en español (esquema exacto esperado, sin el `id`) más botón "📋 Copiar instrucciones" (`execCommand('copy')`, con `clipboard.writeText` de fallback — `execCommand` es la vía principal porque la app se abre por `file://`); un segundo `<textarea>` para pegar el JSON de la IA + botón "Confirmar"; un div de error inline (sin `alert()` nativo).

Al confirmar: `JSON.parse` (error inline si falla, modal no se cierra); acepta objeto único o **array** de objetos; cada uno pasa por `normalizarEnemigoImportado()` (descarta silenciosamente los sin `nombre`, completa TODOS los defaults faltantes con el mismo criterio del resto de la app); cada entrada de las 5 categorías pasa por `normalizarEntradaImportada()` (fuerza `dado` a un valor válido de 4/6/8/10/12, `consumo` a 1 si falta/inválido, etc.). El `id` se genera igual que en creación manual + sufijo random corto (para no chocar si se importan varios de una). Si al menos uno resultó válido, se guardan y se refresca la grilla.
