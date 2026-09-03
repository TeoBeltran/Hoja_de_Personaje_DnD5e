# PROJECT_CONTEXT.md — Índice y memoria técnica de continuidad

> Punto de entrada único para que OTRO chat de Claude (sin acceso a esta conversación) pueda seguir trabajando en el proyecto con autonomía. La documentación técnica está partida en varios archivos por tema (ver la tabla de abajo) — este documento es el índice y la capa de arranque: estado actual, decisiones ya tomadas, reglas de proceso. No duplica el detalle de cada mecanismo, remite al archivo de tema correspondiente.
>
> **Regla de proceso permanente**: ningún chat de Claude persiste memoria por sí solo — estos documentos son la ÚNICA fuente de continuidad entre sesiones. Cada vez que una sesión cierra un cambio funcional real (campo JSON nuevo, mecanismo genérico nuevo, bug corregido, decisión de diseño confirmada por el usuario), ANTES de cerrar esa sesión hay que: (1) agregar el detalle técnico al archivo de TEMA que corresponda (ver tabla), (2) agregar UNA línea nueva a `CHANGELOG.md` (nunca un párrafo largo — el detalle ya está en el archivo de tema), y (3) actualizar §2 ("Estado actual") y §9 ("Trabajo reciente") de ESTE documento. Saltearse esto obliga a la próxima sesión a reconstruir el contexto resumiendo el historial de chat viejo — más caro en tokens y con más margen de error que leer estos documentos ya actualizados. **Nunca volver a juntar todo en un solo archivo gigante** — la razón de partirlo fue evitar que cada edición obligue a reescribir un documento entero cada vez más grande (el Proyecto de Claude no permite editar solo una parte de un doc, así que el tamaño del archivo es directamente el costo de cada cambio).

## 0. Cómo está dividido el contexto (leer esto primero)

| Archivo | Qué tiene | Cuándo leerlo |
|---|---|---|
| `PROJECT_CONTEXT.md` (este archivo) | Índice, estado actual, arquitectura, decisiones técnicas, reglas e invariantes, problemas conocidos, próximas tareas. | **Siempre**, al arrancar cualquier sesión nueva. |
| `CONTEXT_NUCLEO.md` | La ficha de personaje (`personaje.html`/`script.js`): modelo de datos, funcionalidades, la tabla completa de mecanismos genéricos reutilizables (`vidaFormula`, `atributoMinimo`, `disparadores`, etc.), convenciones y limitaciones que aplican a TODO el proyecto. | Cualquier tarea sobre stats, hechizos, equipo, habilidades, turno, descansos, o para ver qué mecanismo genérico ya existe antes de inventar uno nuevo. |
| `CONTEXT_ENEMIGOS.md` | `enemigos.html` / `enemigo.html` / `enemigo.js`: roster, modelo de datos de un enemigo, importación por JSON. | Cualquier tarea sobre la pantalla de Enemigos del DM. |
| `CONTEXT_COMBATE.md` | `combate.html` / `combate.js`: participantes, bonos temporales, historial, salvaciones de muerte, descanso global, daño masivo. | Cualquier tarea sobre el Rastreador de Combate. |
| `CONTEXT_TEMA.md` | Sistema de tema oscuro/claro (las 6 páginas principales). | Solo si la tarea toca colores/tema — se toca poco. |
| `CHANGELOG.md` | Historial de cambios, UNA línea por pasada. No es referencia técnica. | Rara vez — solo para ver cuándo se agregó algo. |

**Regla al agregar contenido nuevo**: va en el archivo de TEMA que corresponda, nunca en uno nuevo ni repartido en varios. Si una tarea toca dos temas a la vez (ej. un cambio en Enemigos que también afecta cómo se lee desde Combate), documentar cada parte en su archivo — `CONTEXT_ENEMIGOS.md` para el modelo de datos del enemigo, `CONTEXT_COMBATE.md` para cómo lo consume el Rastreador.

## 1. Objetivo del proyecto

Aplicación web **HTML/CSS/JS vanilla, sin build ni framework, sin backend**, que funciona como **hoja de personaje interactiva de D&D 5e** para un grupo de mesa real (el usuario, Teo, es el DM). Todo el estado dinámico (vida actual, ranuras gastadas, equipo puesto, toggles activos, etc.) vive en `localStorage` del navegador; los datos "fijos" de cada personaje (stats base, hechizos, equipo, rasgos) viven en archivos JSON estáticos versionados en el repo.

**Problema que resuelve**: en vez de que cada jugador calcule a mano su daño, su CA, cuántas ranuras/usos le quedan, etc. durante la partida, la hoja lo hace sola y automatiza reglas específicas de cada personaje (Divine Smite, Wild Shape, Extra Attack, Weapon Mastery, etc.) declaradas como datos en el JSON de cada uno — ver `CONTEXT_NUCLEO.md` §4/§6 para el mecanismo exacto.

**Comportamiento final esperado**: cada jugador abre su propia ficha (`personaje.html?p=<id>`) desde el celular o la PC durante la sesión de juego y la usa como reemplazo interactivo de la hoja de papel. El DM tiene una zona aparte detrás de login (`extras.html`, usuario `DM`/clave `boss1234`) con personajes de respaldo, una sección de Enemigos/NPCs (`enemigos.html`/`enemigo.html`) y un Rastreador de Combate en vivo (`combate.html`) con orden de iniciativa, vida/CA editables, turnos, condiciones, salvaciones de muerte, bonos temporales de combate, descanso grupal y una regla de muerte instantánea por daño masivo.

**Reglas base**: D&D 5e 2014, con una mezcla deliberada y ya cerrada de mecánicas de 5.5e/2024 por clase (Weapon Mastery en Guerrero/Paladín, Circle of the Land con las 4 tierras 2024 + Underdark 2014 en Orfe, Lay on Hands como Bonus Action, Magical Cunning en Brujo, Second Wind mejorado/Tactical Shift/Remarkable Athlete en Guerrero — ver `README.md`) más homebrew propio del grupo (efecto "Enmielado"/habilidades de Miel en Paladín/Nika).

**Alcance actual**: 9 personajes jugables con card en el menú público `index.html` (Gangstur, Lothar, Nika, Lunareth, Leonidas, Orfe, Aredhel, Chiaragorn, Lyralei); Kael y Varis detrás del login de `extras.html`; Cedric y Aldren como personajes de respaldo del DM sin card en ningún menú (solo por URL directa). Los **13** personajes activos tienen Vida Máxima calculada por fórmula dinámica en vez de un número fijo (ver §9). Sección completa de Enemigos/NPCs para el DM. Rastreador de Combate completo. Tema claro/oscuro en las 6 páginas principales. Sin backend, sin tests automatizados persistentes, sin APIs externas.

## 2. Estado actual

**Implementado y funcionando** (ver el detalle exacto en el archivo de tema indicado):
- Núcleo de ficha de personaje: stats/skills/salvaciones/CA/vida/Hit Dice, sistema de turno, ataques con armas, Extra Attack, smites, Weapon Mastery, panel post-golpe, hechizos con ranuras/escalado/familiares, Circle of the Land, equipo mágico con bonos pasivos, inventario (`CONTEXT_NUCLEO.md` §5).
- **Vida Máxima por fórmula dinámica** (`vidaFormula`): reemplaza el número fijo de HP en los 13 personajes activos, derivado del dado de golpe de la clase + tiradas cargadas por nivel + modificador de CON final × nivel, con persistencia corregida (recalcula al cambiar CON/equipo en vez de quedar pegada al `localStorage` viejo) (`CONTEXT_NUCLEO.md` §4/§6).
- **Modales de detalle en modificadores y salvaciones**: click en cualquiera de los 6 tiles de atributo abre el nombre en inglés/español + valor real; click en cualquiera de los 6 tiles de salvación abre el desglose del cálculo (`CONTEXT_NUCLEO.md` §5).
- ~22 "mecanismos genéricos" reutilizables declarativos en el JSON de cada personaje, sin tocar `script.js` (`CONTEXT_NUCLEO.md` §6).
- Sección Enemigos completa: roster, form de creación/edición, importación por JSON pegado desde una IA externa, hoja individual con menú de turno, acciones legendarias (`CONTEXT_ENEMIGOS.md`).
- Rastreador de Combate completo: participantes json/enemigo/familiar/manual, bonos temporales de Vida Máx./CA, historial con divisores de ronda y marcas aliado/rival, salvaciones de muerte a 0 HP con pips pastel, modales propios sin `alert()/confirm()/prompt()` nativos, descanso corto/largo global y regla de daño masivo/muerte instantánea (`CONTEXT_COMBATE.md`).
- Tema claro/oscuro persistente en las 6 páginas principales (`CONTEXT_TEMA.md`).

**Parcialmente implementado**:
- Cedric (Bardo) y Aldren (Artífice): solo tienen el JSON de datos base + rasgos descriptivos. Les faltan los scripts interactivos de habilidad — confirmado en `CONTEXT_NUCLEO.md` §9 y en el propio JSON.
- `curacionExtra` de la Moon Scimitar de Orfe: declarado en el JSON, no enganchado a ningún cálculo (`CONTEXT_NUCLEO.md` §9).
- Velocidad: string fijo, no se recalcula desde feats/rasgos que la modifiquen — limitación conocida, no bug (`CONTEXT_NUCLEO.md` §8).
- Las `tiradas` de `vidaFormula` de los 13 personajes están cargadas con el valor "average" como placeholder en vez del resultado real de cada tirada de Hit Die.

**Falta implementar / no iniciado**:
- `GenerarResumen.html` no tiene el toggle de tema oscuro que sí tienen las otras 6 páginas.
- Ninguna suite de tests automatizados persiste en el repo — cada sesión escribe scripts Playwright descartables y los borra antes de entregar (regla de proceso, no una tarea pendiente en sí).

**Punto exacto donde quedó el trabajo**: la sesión más reciente cerró tres cosas, en este orden: (1) reestructuración de toda la documentación del `CONTEXT.md` monolítico a los archivos separados por tema listados en §0; (2) un bug real de `vidaFormula` — un `vidaMaxima` viejo guardado en `localStorage` quedaba pegado para siempre e ignoraba el recálculo (equipar el Amulet of Health de Kael no subía la Vida) — corregido con la key `vidaFormulaCalculada` y delta de vida actual, ver `CHANGELOG.md` entrada 18 y `CONTEXT_NUCLEO.md` §6; (3) los tiles de modificador de atributo y de salvación, que antes no hacían nada al hacer click, ahora abren un modal (nombre inglés/español + valor real para modificadores; desglose del cálculo para salvaciones), ver `CHANGELOG.md` entrada 19 y `CONTEXT_NUCLEO.md` §5. Todo entregado a la carpeta local del usuario y sincronizado al Proyecto de Claude. **No hay ningún trabajo a medio terminar.**

**Siguiente paso lógico**: no hay tarea en curso — esperar el próximo pedido del usuario en el chat nuevo. Si es un bug report, reproducirlo con un script Playwright descartable antes de tocar código. Si es una feature nueva, seguir el flujo: implementar → `node --check`/validar JSON → verificar → entregar + sincronizar → **actualizar el archivo de tema correspondiente + `CHANGELOG.md` + este documento antes de cerrar la sesión** (ver la regla de proceso al inicio).

## 3. Arquitectura

- **Sin backend, sin bundler, sin framework.** Los `.html` se abren directo (o se sirven como estáticos para poder navegar entre páginas y usar `fetch` de los JSON sin bloqueo CORS de `file://`).
- **Persistencia: únicamente `localStorage` del navegador.** Dos patrones distintos conviven:
  - Personajes jugables/respaldo: prefijo `pj_<id>_*` (constante `STORAGE_PREFIX` en `script.js`), muchas keys chicas diffeadas contra el JSON estático del personaje.
  - Enemigos: un solo blob JSON completo por key `enemigo_<id>`, sin diffear contra nada.
  - Rastreador de Combate: `combate_participantes`, `combate_historial`, `combate_bitacora`, `combate_turno`, `combate_condiciones`, más el flag por personaje `pj_<id>_descansoPendiente`.
- **Datos estáticos**: `personajes/<id>.json`, uno por personaje jugable/respaldo (stats base, `improvements`, `vidaFormula`, hechizos, equipo, rasgos, `habilidadesUso`). Los enemigos NO tienen JSON estático.
- **Módulos ES vs. scripts clásicos**: `personaje.html` carga `script.js` como `type="module"`; `combate.html` carga `combate.js` como `type="module"`; `enemigo.html` carga `enemigo.js` como **script clásico** (deliberado, ver `CONTEXT_ENEMIGOS.md`); `enemigos.html` no tiene `.js` propio (lógica inline); `index.html`/`extras.html` también inline.
- `script.js` y `combate.js` importan de `Scripts/Core/Estadisticas.js`, `Scripts/Core/Util.js` y `Scripts/Datos/Constantes.js` — **estos son los ÚNICOS 3 archivos bajo `Scripts/` realmente usados**. `Util.js` es también de donde sale `obtenerHitDiceSegunClase()`, usada por Hit Dice y por `vidaFormula`. Todo lo demás bajo `Scripts/UI/`, `Scripts/Clases/`, y el resto de `Scripts/Core/`/`Scripts/Datos/` **es código muerto, no importado por nadie**.
- **Sin servicios externos ni APIs.** El único "servicio externo" conceptual es que el DM puede pegarle una descripción de monstruo a una IA aparte y pegar el JSON resultante en el modal "Importar" de Enemigos.
- **Testing durante desarrollo** (no forma parte de la app entregada): Playwright con Chromium en `/opt/pw-browsers/chromium`, contra un `python3 -m http.server` local. Scripts de test siempre descartables. Para cambios puramente numéricos (como `vidaFormula`) alcanza con un dry-run en Node/Python comparando contra el valor esperado, sin necesitar un navegador.

## 4. Estructura del código (archivos relevantes para modificar el proyecto)

| Archivo | Rol |
|---|---|
| `script.js` (~4300+ líneas) | **El archivo más importante del proyecto.** Toda la lógica de la ficha de personaje individual. |
| `personaje.html` | Plantilla visual única para todos los personajes jugables. |
| `combate.js` (~1660 líneas) / `combate.html` | Rastreador de Combate. Ver `CONTEXT_COMBATE.md`. |
| `enemigo.js` (~900 líneas, script clásico) / `enemigo.html` | Hoja individual de un enemigo/NPC del DM. |
| `enemigos.html` (sin `.js` propio) | Roster de enemigos + modal de creación/edición + modal de importación por JSON. |
| `Scripts/Core/Estadisticas.js` | Funciones puras de cálculo de stats/skills/salvaciones. |
| `Scripts/Core/Util.js` | Funciones puras de daño, ataques extra, requisitos de armadura/arma, `obtenerHitDiceSegunClase()`. |
| `Scripts/Datos/Constantes.js` | Diccionarios estáticos de reglas generales. |
| `personajes/<id>.json` | Un archivo por personaje (13 activos, todos con `vidaFormula`). |
| `estilos.css` | Estilos de `personaje.html`/`combate.html`/`enemigo.html`/`enemigos.html` (tema "pergamino" + variables de tema oscuro). |
| `estilos-menu.css` | Estilos de `index.html`/`extras.html`. |
| `index.html` / `extras.html` | Menú público / menú DM detrás de login. |
| `PROJECT_CONTEXT.md` (este archivo) | Índice + estado + arquitectura + decisiones + reglas. |
| `CONTEXT_NUCLEO.md` / `CONTEXT_ENEMIGOS.md` / `CONTEXT_COMBATE.md` / `CONTEXT_TEMA.md` | Referencia técnica por tema — ver tabla en §0. |
| `CHANGELOG.md` | Historial de pasadas, una línea cada una. |
| `GenerarResumen.html/.css/.js` | Herramienta aparte del DM, no cubierta en profundidad por esta documentación. |
| `README.md` | Notas breves sobre qué reglas de 5.5e/2024 y homebrew se mezclaron con el 2014 base, por clase. |

No hay `package.json` ni bundler — todo corre con rutas relativas directas.

## 5. Decisiones técnicas importantes (no reconsiderar sin pedido explícito del usuario)

1. **Sin backend, todo en `localStorage`.** Elegido para minimizar fricción e infraestructura. Implica: sin sync entre dispositivos, y que un cambio de fórmula de cálculo no migra automáticamente valores ya guardados.
2. **"Bonos temporales de combate" separados de las keys permanentes** (Vida Máxima/CA, `CONTEXT_COMBATE.md`): evita que un buff temporal de combate (Aid, Shield of Faith) quede pegado permanentemente a la ficha del personaje.
3. **"Descanso pendiente" (flag consumido por `script.js`) en vez de duplicar `tomarDescanso()` en `combate.js`**: razonado a partir del bug de duplicación de `statsFinales()` (ver §8) como precedente de riesgo. Cualquier feature futura del Rastreador que dispare lógica específica de personaje debería seguir este mismo patrón.
4. **"Muerte masiva" reutiliza el flag `p.muerto` existente** en vez de un estado de muerte permanente aparte, más un flag extra puramente visual (`muerteMasiva`).
5. **`enemigo.js` como script clásico, no módulo ES** — deliberado, para que funcione abierto directo por `file://` sin bloqueo CORS.
6. **Sin tirador de dados ni botón de "deshacer" en el Rastreador de Combate** — pedido y luego **descartado explícitamente por el usuario**. **No reabrir sin que el usuario lo pida de nuevo.**
7. **Ningún modal de ninguna página se cierra clickeando afuera** — regla de proyecto confirmada explícitamente por el usuario, sin excepciones.
8. **Todos los `alert()`/`confirm()`/`prompt()` nativos fueron reemplazados por modales propios** con el estilo visual de la app.
9. **Vida Máxima como fórmula derivada, no como número escrito a mano** (`vidaFormula`): mismo espíritu que `personaje.stats` base vs. final — nunca hardcodear un valor derivable de otros que ya viven en el JSON/localStorage. Un ítem mágico que sube un atributo (`atributoMinimo`) nunca debe tocar directamente una estadística derivada de ese atributo — eso se calcula solo.
10. **Documentación partida por tema, en vez de un `CONTEXT.md` monolítico** (ver §0): el Proyecto de Claude no permite editar solo una parte de un documento — cada edición reescribe el archivo entero — así que un documento único y creciente hace que cada pasada nueva sea más cara de documentar que la anterior, indefinidamente. Partirlo por tema acota el costo de cada edición al tamaño del archivo de ESE tema, y le permite a una sesión nueva leer solo lo que necesita para la tarea que le tocó.

## 6. Reglas e invariantes (no romper al modificar)

- Nombres de skills en el JSON deben matchear EXACTO las claves en español de `SKILL_STAT` (`Constantes.js`).
- Nombres de clase deben matchear EXACTO las claves de `PROFICIENCIAS_POR_CLASE` (y de `obtenerHitDiceSegunClase()` para el dado de golpe de `vidaFormula` — una clase no mapeada cae a `d8`).
- `tipoDano` siempre en minúscula. El bono mágico de daño de un arma va horneado en `dano` **o** en `bonoDano` — nunca ambos.
- `window._equipoData`/`window._habilidadesUsoData` deben quedar seteados temprano en `init()`, antes de cualquier función top-level que los use.
- Cuidado con "temporal dead zone": todo bloque nuevo en `init()` va DESPUÉS de las `const` que usa. Cuidado con substrings en `tipoAccion`.
- Toda `habilidadUso`/hechizo que cura DEBE tener `efectos: [{tipo: "notificacionYAbreVida", ...}]`.
- El color del tile de Vida está **duplicado en 3 archivos** (`script.js`/`enemigo.js`/`combate.js`) — si cambia el criterio, tocar los 3.
- El cálculo de `usosPorNivel`/`usosIgualANivel` está duplicado entre `script.js` y `leerHabilidadesUsoCompartidas()` en `combate.js` — replicar cualquier mecanismo nuevo en LOS DOS lugares.
- Los bonos temporales de combate (`bonoVidaMaxTemp`/`bonoCATemp`) viven SOLO en `p` dentro de `combate_participantes` — nunca en `pj_<id>_vidaMaxima`/`caActual` ni en `enemigo_<id>`.
- La regla de daño masivo/muerte instantánea aplica SOLO a `origen === 'json'`.
- **Vida Máxima nunca se escribe a mano en `estadisticas`**: si tiene `{nombre: "Vida", valor: "auto"}`, el JSON DEBE tener también `vidaFormula: {tiradas: [...]}` en la raíz. Subir de nivel = agregar una tirada nueva al array.
- **Un ítem de equipo que sube un atributo (`atributoMinimo`) no debe declarar además un bono directo de Vida Máxima** (el mecanismo viejo `bonoVidaMaximaEquipado` fue eliminado por esta razón).
- **Convención de proceso — verificación**: cualquier cambio se verifica ANTES de entregar (Playwright descartable para UI/interactivo, dry-run numérico para cálculo puro); los artefactos de test se borran antes de la entrega.
- **Convención de proceso — entrega**: `SendUserFile` + `device_commit_files` a la carpeta local del usuario (`C:\Users\teobe\OneDrive\Escritorio\DnD\Hoja_de_Personaje_DnD5e\`), sincronizar al Proyecto de Claude (ver convención de paths en §12). **Claude nunca corre `git commit`/`git push`** — el usuario sube a GitHub a mano.
- **Convención de proceso — documentación**: actualizar el archivo de TEMA correspondiente + `CHANGELOG.md` (una línea) + §2/§9 de este documento, ANTES de cerrar la sesión, sin excepción — ver la nota de proceso al inicio de este documento y la tabla de §0.
- Mínimo de sanidad antes de cualquier entrega: `node --check` sobre cada `.js` tocado, `python3 -c "import json; json.load(...)"` sobre cada `.json` tocado.

## 7. Problemas y bugs conocidos

**Confirmados (limitaciones de diseño, no bugs)**:
- No hay tirador de dados (deliberado). Velocidad no dinámica. Un solo "slot" de compañero invocado activo por personaje.
- Valores en `localStorage` pueden quedar desactualizados si cambia una fórmula de cálculo (CA, Vida) — no hay migración automática, usar los botones "Restaurar".
- El bono temporal de combate de un enemigo/`'manual'` nunca se borra solo — hay que sacarlo a mano o empezar combate nuevo.
- No hay suite de tests automatizados persistente (por diseño de proceso).
- Las `tiradas` de `vidaFormula` están en el valor "average" como placeholder, no el resultado real tirado — trabajo manual pendiente, no bloqueante.

**Sospechados, NO confirmados/verificados**:
- Posible duplicado visual de "Repelling Blast" en Gangstur — no verificado.
- Si Counterspell (u otros hechizos de Reacción) debería tener su propia card visual "gastada" — pregunta abierta.

**No implementado** (huecos de alcance, no bugs):
- `curacionExtra` de la Moon Scimitar de Orfe. Scripts interactivos de Cedric y Aldren. Toggle de tema oscuro en `GenerarResumen.html`.

## 8. Intentos anteriores (probados y descartados — para no repetirlos)

- **Duplicar la lógica de descanso específica por clase dentro de `combate.js`**: rechazado — mismo riesgo que el bug de `statsFinales()` de abajo. Se eligió flag pendiente + reusar `tomarDescanso()` real.
- **Escribir los bonos temporales de combate directo en las keys permanentes**: contaminaba el estado real del personaje. Reemplazado por el sistema de bono aparte.
- **Bug real ya corregido — `statsFinales()` en `combate.js`**: recibía `data.personaje` en vez de `data` completo, ignorando silenciosamente mejoras de raza/feat/ASI y el bono de salvaciones de equipo. Corregido aplicando raza→feats→ASI en el mismo orden que `aplicarImprovements()`. **Razón citada para nunca duplicar lógica de personaje dentro de `combate.js` sin reusar la función real.**
- **Bug real ya corregido — `type="module"` en `enemigo.js`**: rompía toda la hoja bajo `file://` por CORS. Corregido pasando a script clásico.
- **Bug real ya corregido — badge de CA (+N) solo se generaba para armaduras**: corregido generalizando la condición a cualquier ítem con efecto `{tipo: "CA"}`.
- **Mecanismo descartado — `bonoVidaMaximaEquipado`**: un hack que sumaba/restaba HP fijo al equipar/desequipar. Quedó redundante y en riesgo de conflicto una vez que existió `vidaFormula` (que ya deriva sola el aumento de HP a partir de un CON más alto). Lección: si un valor se puede derivar de otro ya modelado, no declarar además un bono directo y fijo para el mismo efecto.
- **Playwright — `browser.new_page()` NO comparte `localStorage` entre "páginas"**: reusar el mismo objeto `page` y navegar con `.goto()`.
- **Playwright — el tema oscuro se guarda como `'oscuro'`/`'claro'`**, no `'dark'`/`'light'`.
- **Playwright — un solo click en "Siguiente turno" con un participante ya rota de ronda**: hace falta un segundo click.
- **Playwright — cerrar el `#aviso-modal` explícitamente** entre pasos de un test, si no bloquea clicks posteriores.

## 9. Trabajo reciente

Última pasada cerrada — ver `CHANGELOG.md` entradas 17, 18 y 19. Detalle:

1. **Doce correcciones puntuales en la ficha de Kael (Monje)**: descripciones dinámicas vía placeholders (`resolverDescDinamicaHabilidad()`), badges de costo en Ki (`costoKi`), `oculto` extendido a `equipo`, párrafos de advertencia redundantes eliminados, fix del badge de CA en accesorios no-armadura — detalle completo en `CONTEXT_NUCLEO.md` §6/§7.
2. **Sistema de Vida Máxima por fórmula dinámica** (`vidaFormula`): aplicado a los 13 personajes activos, validado numéricamente contra el HP fijo anterior de cada uno (sin cambios visibles para los jugadores) — detalle completo en `CONTEXT_NUCLEO.md` §4/§6.
3. **Confirmación de diseño**: el Amuleto de la Salud de Kael solo fuerza CON a 19 (`atributoMinimo`), la Vida sube sola como efecto derivado — se eliminó el mecanismo viejo `bonoVidaMaximaEquipado`.
4. **Reestructuración de la documentación** (esta misma sesión): `CONTEXT.md` (monolítico) se dividió en `CONTEXT_NUCLEO.md`, `CONTEXT_ENEMIGOS.md`, `CONTEXT_COMBATE.md`, `CONTEXT_TEMA.md` y `CHANGELOG.md`, con este documento como índice — ver §0. `CONTEXT.md` se dejó como un puntero corto a los archivos nuevos, no se borró (para no dejar un link roto).
5. **Bug real corregido — `vidaFormula` no recalculaba** (reportado por el usuario: equipar el Amulet of Health de Kael no subía la Vida ni recargando ni descansando): la key `vidaMaxima` vieja en `localStorage` quedaba pegada para siempre. Se agregó `vidaFormulaCalculada` para distinguir el último resultado de la fórmula de un ajuste manual real, más ajuste por delta de la vida actual — detalle completo en `CONTEXT_NUCLEO.md` §6, verificado con dry-run numérico de 4 escenarios (todos pasaron).
6. **Modales de detalle en modificadores y salvaciones** (pedido nuevo del usuario): antes el click en los 6 tiles de atributo y los 6 de salvación no hacía nada. Ahora cada tile de atributo abre un modal con el nombre en inglés y en español + el valor real del atributo (ej. "Constitution / Constitución: 19"); cada tile de salvación abre un modal con el desglose del cálculo (modificador + proficiencia si aplica + bono de equipo activo si aplica, ej. un anillo de protección). Se agregó `NOMBRES_STATS_EN` a `Constantes.js`. Detalle completo en `CONTEXT_NUCLEO.md` §5, verificado con dry-run numérico (los 6 atributos + 3 escenarios de salvación, todos pasaron) y `node --check`.
7. Todo entregado a la carpeta local del usuario y sincronizado al Proyecto de Claude.

No hay ningún cambio a medio hacer después de esto.

## 10. Próximas tareas

**Imprescindible**: ninguna identificada — la app está en estado funcional y verificado, sin bugs bloqueantes conocidos.

**Importante**:
- Completar los scripts interactivos de Cedric (Bardo) y Aldren (Artífice).
- Verificar/resolver el posible duplicado visual de "Repelling Blast" en Gangstur.
- Ir reemplazando los valores "average" placeholder de `vidaFormula.tiradas` por los resultados reales de Hit Die a medida que cada jugador suba de nivel.

**Opcional / mejora futura**:
- Enganchar `curacionExtra` de la Moon Scimitar de Orfe a un cálculo real.
- Hacer dinámica la velocidad. Agregar el toggle de tema oscuro a `GenerarResumen.html`. Definir si Counterspell/hechizos de Reacción necesitan su propia card visual de "gastado".

**Explícitamente descartado, no reabrir sin pedido nuevo del usuario**: tirador de dados y botón de "deshacer" en el Rastreador de Combate.

## 11. Cómo continuar

- **Leer primero la tabla de §0** para saber qué archivo de tema corresponde a la tarea, y leer SOLO ese (más este índice). No hace falta leer los 4 archivos de tema para una tarea puntual.
- **No asumir que el clon git local refleja GitHub** — ver §12.
- **No reintroducir**: tirador de dados o botón de deshacer en el Rastreador, `type="module"` en `enemigo.js`, escritura de bonos temporales de combate en las keys permanentes, lógica de descanso o de cálculo de usos duplicada dentro de `combate.js` sin replicarla en `script.js`, un bono de Vida Máxima fijo (`bonoVidaMaximaEquipado`) en paralelo a `vidaFormula`, ni volver a juntar la documentación en un solo archivo monolítico.
- **Decisiones ya tomadas, no relitigar sin pedido explícito del usuario**: ver §5 completa.
- **Siguiente paso concreto**: no hay tarea en curso — esperar el pedido del usuario. Ante un bug report, reproducirlo primero (Playwright descartable, o dry-run numérico si es cálculo puro). Ante una feature nueva: implementar → `node --check`/validar JSON → verificar → entregar → sincronizar → **actualizar el archivo de tema + `CHANGELOG.md` + este documento (§2/§9) antes de cerrar la sesión** → nunca `git commit`/`git push`.

## 12. Contexto adicional

- **Convención de paths en el Proyecto de Claude**: los archivos que espejan un archivo de raíz real del repo (`script.js`, `estilos.css`, `personaje.html`, `index.html`, `estilos-menu.css`, los `personajes/*.json`, `Util.js`, `Estadisticas.js`, `Constantes.js`) se guardan con su nombre tal cual. `combate.js`, `combate.html` y los documentos de contexto (`CONTEXT.md`/`CONTEXT_NUCLEO.md`/`CONTEXT_ENEMIGOS.md`/`CONTEXT_COMBATE.md`/`CONTEXT_TEMA.md`/`CHANGELOG.md`) están namespaced bajo `claude/` en el Proyecto. `PROJECT_CONTEXT.md` sigue la misma convención (`claude/PROJECT_CONTEXT.md`) en el Proyecto, pero fue pedido explícitamente para vivir en la **raíz real del repo** en la carpeta local del usuario — igual que los demás archivos de contexto nuevos (`CONTEXT_NUCLEO.md`, etc.), que también van a la raíz local para que estén junto al resto del código.
- 4 personajes que existían en la carpeta local (`aredhel.json`, `chiaragorn.json`, `lyralei.json`, `varis.json`) no estaban sincronizados al Proyecto de Claude — se detectó y corrigió, quedaron namespaced bajo `claude/` (por ser nuevos en el Proyecto) en vez de en la raíz como los demás `personajes/*.json` — no es bloqueante.
- **Caveat de git**: el clon git local de un workspace de sesión puede estar desactualizado respecto al trabajo real. Esto NO significa que el usuario no lo haya subido a GitHub — Claude nunca hace `git commit`/`git push`, el usuario sube a mano. No confiar en `git log`/`git status` de una sesión nueva como fuente de verdad del repo remoto.
- El remoto configurado es un repo privado de GitHub bajo la cuenta del usuario (`TeoBeltran/Hoja_de_Personaje_DnD5e`), accedido con un token ya embebido en la config de git del workspace — **no exponer ni imprimir ese token en ningún documento o output**.
- **Idioma**: todo el texto de cara al usuario, comentarios de código, valores de campos JSON y la documentación técnica están en español (Argentina). Mantener esa convención en cualquier código o contenido nuevo.
- No hay CI ni suite de tests persistida — cada sesión escribe y borra sus propios scripts Playwright de verificación.
