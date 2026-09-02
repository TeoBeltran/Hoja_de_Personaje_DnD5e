# PROJECT_CONTEXT.md — Memoria técnica de continuidad

> Documento de onboarding para que OTRO chat de Claude (sin acceso a esta conversación) pueda seguir trabajando en el proyecto con autonomía. No reemplaza a `CONTEXT.md` (referencia exhaustiva, feature por feature, organizada en "pasadas" numeradas): úsalo como capa de arranque y consulta siempre `CONTEXT.md` para el detalle de implementación de cualquier mecánica puntual antes de tocarla.
>
> Generado analizando el historial de esta conversación y contrastándolo contra el estado real de los archivos del proyecto (lectura directa de `script.js`, `combate.js`, `combate.html`, `enemigo.js`, `enemigo.html`, `enemigos.html`, `CONTEXT.md`, `README.md`, y `git status`/`git log` del clon local). Donde hubo diferencia entre lo dicho en el chat y lo que el archivo realmente contenía, se priorizó el archivo — se señala explícitamente en cada caso.

## 1. Objetivo del proyecto

Aplicación web **HTML/CSS/JS vanilla, sin build ni framework, sin backend**, que funciona como **hoja de personaje interactiva de D&D 5e** para un grupo de mesa real (el usuario, Teo, es el DM). Todo el estado dinámico (vida actual, ranuras gastadas, equipo puesto, toggles activos, etc.) vive en `localStorage` del navegador; los datos "fijos" de cada personaje (stats base, hechizos, equipo, rasgos) viven en archivos JSON estáticos versionados en el repo.

**Problema que resuelve**: en vez de que cada jugador calcule a mano su daño, su CA, cuántas ranuras/usos le quedan, etc. durante la partida, la hoja lo hace sola y automatiza reglas específicas de cada personaje (Divine Smite, Wild Shape, Extra Attack, Weapon Mastery, etc.) declaradas como datos en el JSON de cada uno — ver §4/§6 de `CONTEXT.md` para el mecanismo exacto.

**Comportamiento final esperado**: cada jugador abre su propia ficha (`personaje.html?p=<id>`) desde el celular o la PC durante la sesión de juego y la usa como reemplazo interactivo de la hoja de papel. El DM tiene una zona aparte detrás de login (`extras.html`, usuario `DM`/clave `boss1234`) con personajes de respaldo, una sección de Enemigos/NPCs (`enemigos.html`/`enemigo.html`) y un Rastreador de Combate en vivo (`combate.html`) con orden de iniciativa, vida/CA editables, turnos, condiciones, salvaciones de muerte, bonos temporales de combate, y (desde esta última pasada) descanso grupal y una regla de muerte instantánea por daño masivo.

**Reglas base**: D&D 5e 2014, con una mezcla deliberada y ya cerrada de mecánicas de 5.5e/2024 por clase (Weapon Mastery en Guerrero/Paladín, Circle of the Land con las 4 tierras 2024 + Underdark 2014 en Orfe, Lay on Hands como Bonus Action, Magical Cunning en Brujo, Second Wind mejorado/Tactical Shift/Remarkable Athlete en Guerrero — ver `README.md`) más homebrew propio del grupo (efecto "Enmielado"/habilidades de Miel en Paladín/Nika).

**Alcance actual**: 9 personajes jugables con card en el menú público `index.html` (Gangstur, Lothar, Nika, Lunareth, Leonidas, Orfe, Aredhel, Chiaragorn, Lyralei); Kael y Varis detrás del login de `extras.html`; Cedric y Aldren como personajes de respaldo del DM sin card en ningún menú (solo por URL directa). Sección completa de Enemigos/NPCs para el DM. Rastreador de Combate completo. Tema claro/oscuro en las 6 páginas principales. Sin backend, sin tests automatizados persistentes, sin APIs externas.

## 2. Estado actual

**Implementado y funcionando** (ver el detalle exacto de cada uno en `CONTEXT.md`, sección indicada):
- Núcleo de ficha de personaje: stats/skills/salvaciones/CA/vida/Hit Dice, sistema de turno, ataques con armas, Extra Attack, smites, Weapon Mastery, panel post-golpe, hechizos con ranuras/escalado/familiares, Circle of the Land, equipo mágico con bonos pasivos, inventario (`CONTEXT.md` §5).
- ~20 "mecanismos genéricos" reutilizables declarativos en el JSON de cada personaje, sin tocar `script.js` (`CONTEXT.md` §6).
- Sección Enemigos completa: roster, form de creación/edición, importación por JSON pegado desde una IA externa, hoja individual con menú de turno, acciones legendarias (`CONTEXT.md` §10).
- Rastreador de Combate completo: participantes json/enemigo/familiar/manual, bonos temporales de Vida Máx./CA, historial con divisores de ronda y marcas aliado/rival, salvaciones de muerte a 0 HP con pips pastel, modales propios sin `alert()/confirm()/prompt()` nativos, **descanso corto/largo global para los 9 personajes de campaña** y **regla de daño masivo/muerte instantánea** (ambos agregados en la pasada recién cerrada — `CONTEXT.md` §11).
- Tema claro/oscuro persistente en `index.html`, `extras.html`, `enemigos.html`, `combate.html`, `personaje.html`, `enemigo.html` (`CONTEXT.md` §12).

**Parcialmente implementado**:
- Cedric (Bardo) y Aldren (Artífice): solo tienen el JSON de datos base + rasgos descriptivos. Les faltan los scripts interactivos de habilidad (Bardic Inspiration, Steel Defender, Infuse Item, etc.) — confirmado en `CONTEXT.md` §9 y en el propio JSON.
- `curacionExtra` de la Moon Scimitar de Orfe: declarado en el JSON, no enganchado a ningún cálculo (`CONTEXT.md` §9).
- Velocidad: string fijo en `estadisticas`, no se recalcula desde feats/rasgos que la modifiquen (Mobile, Unarmored Movement) — limitación conocida, no bug (`CONTEXT.md` §8).

**Falta implementar / no iniciado**:
- `GenerarResumen.html` (herramienta aparte del DM) no tiene el toggle de tema oscuro que sí tienen las otras 6 páginas.
- Ninguna suite de tests automatizados persiste en el repo — cada sesión escribe scripts Playwright descartables y los borra antes de entregar (ver §6 más abajo, es una regla de proceso, no una tarea pendiente en sí).

**Punto exacto donde quedó el trabajo**: la sesión anterior cerró la "decimocuarta pasada" (botones de descanso corto/largo global + regla de daño masivo) completamente: implementada, verificada con Playwright (todos los escenarios, incluidos los casos límite del "más que" estricto), entregada a la carpeta local del usuario, sincronizada al Proyecto de Claude, y documentada en `CONTEXT.md`. **No hay ningún trabajo a medio terminar.** No hay bugs pendientes conocidos de esa pasada.

**Siguiente paso lógico**: no hay tarea en curso — esperar el próximo pedido del usuario en el chat nuevo. Si es un bug report, reproducirlo con un script Playwright descartable antes de tocar código (ver §6/§11 más abajo). Si es una feature nueva, seguir el flujo establecido de principio a fin (implementar → `node --check` → verificar con Playwright → entregar + sincronizar → actualizar `CONTEXT.md` con una nueva "pasada" numerada).

## 3. Arquitectura

- **Sin backend, sin bundler, sin framework.** Los `.html` se abren directo (o se sirven como estáticos para poder navegar entre páginas y usar `fetch` de los JSON sin bloqueo CORS de `file://`).
- **Persistencia: únicamente `localStorage` del navegador.** Dos patrones distintos conviven:
  - Personajes jugables/respaldo: prefijo `pj_<id>_*` (constante `STORAGE_PREFIX` en `script.js`), muchas keys chicas diffeadas contra el JSON estático del personaje (vida actual, hechizos usados, toggles, equipo puesto, etc.).
  - Enemigos: un solo blob JSON completo por key `enemigo_<id>`, sin diffear contra nada (no tienen JSON estático — el DM los crea a mano o los importa).
  - Rastreador de Combate: `combate_participantes`, `combate_historial`, `combate_bitacora`, `combate_turno`, `combate_condiciones`, más el flag por personaje `pj_<id>_descansoPendiente` agregado en la última pasada.
- **Datos estáticos**: `personajes/<id>.json`, uno por personaje jugable/respaldo (stats base, `improvements`, hechizos, equipo, rasgos, `habilidadesUso`). Los enemigos NO tienen JSON estático.
- **Módulos ES vs. scripts clásicos** (verificado leyendo los `<script>` de cada HTML):
  - `personaje.html` carga `script.js` como `type="module"`.
  - `combate.html` carga `combate.js` como `type="module"`.
  - `enemigo.html` carga `enemigo.js` como **script clásico** (sin `type="module"`) — **decisión deliberada**: no importa nada de otro archivo, y usar `type="module"` rompía TODA la página bajo `file://` por CORS (bug real ya corregido, ver §5/§8). No convertirlo a módulo sin re-probar bajo `file://`.
  - `enemigos.html` **no tiene un `.js` propio** — toda su lógica vive en `<script>` inline dentro del mismo HTML.
  - `index.html`/`extras.html` también tienen su lógica en `<script>` inline (login, cards).
- `script.js` y `combate.js` importan de `Scripts/Core/Estadisticas.js`, `Scripts/Core/Util.js` y `Scripts/Datos/Constantes.js` — **estos son los ÚNICOS 3 archivos bajo `Scripts/` realmente usados** (confirmado por grep de imports en todos los `.html`/`.js` de raíz). Todo lo demás bajo `Scripts/UI/`, `Scripts/Clases/`, y el resto de `Scripts/Core/`/`Scripts/Datos/` (`Descansos.js`, `Eventos.js`, `Guardado.js`, `Render.js`, `Config.js`, `Dados.js`, y las 12 clases en `Scripts/Clases/`) **es código muerto, no importado por nadie** — no asumir que está vivo solo porque existe el archivo.
- **Sin servicios externos ni APIs.** El único "servicio externo" conceptual es que el DM puede pegarle una descripción de monstruo a una IA aparte (ChatGPT, Claude, etc. — fuera de esta app) y pegar el JSON que le devuelva en el modal "Importar" de Enemigos; la app no llama a ninguna IA por su cuenta.
- **Testing durante desarrollo** (no forma parte de la app entregada): Playwright con Chromium en `/opt/pw-browsers/chromium`, contra un `python3 -m http.server` local. Los scripts de test son siempre descartables — se escriben, se corren, se borran antes de entregar. No hay suite persistida en el repo.

## 4. Estructura del código (archivos relevantes para modificar el proyecto)

| Archivo | Rol |
|---|---|
| `script.js` (~4300 líneas) | **El archivo más importante del proyecto.** Toda la lógica de la ficha de personaje individual: carga del JSON, cálculo de stats, render de cada sección, todos los modales, sistema de turno, descansos (incluida la nueva `aplicarDescansoPendienteSiCorresponde()`, llamada al final de `init()`). |
| `personaje.html` | Plantilla visual única para todos los personajes jugables — HTML fijo, mayormente vacío, que `script.js` llena en `init()`. |
| `combate.js` (~1660 líneas) / `combate.html` | Rastreador de Combate. Ver `CONTEXT.md` §11 para cada mecanismo (participantes `json`/`enemigo`/`familiar`/`manual`, bonos temporales, historial, salvaciones de muerte, descanso global, daño masivo). |
| `enemigo.js` (~900 líneas, script clásico) / `enemigo.html` | Hoja individual de un enemigo/NPC del DM. |
| `enemigos.html` (sin `.js` propio) | Roster de enemigos + modal de creación/edición + modal de importación por JSON. |
| `Scripts/Core/Estadisticas.js` | Funciones puras de cálculo de stats/skills/salvaciones desde los stats base. |
| `Scripts/Core/Util.js` | Funciones puras de cálculo de daño, ataques extra, requisitos de armadura/arma. |
| `Scripts/Datos/Constantes.js` | Diccionarios estáticos de reglas generales (iconos por personaje, proficiencias por clase, `SKILL_STAT`, descripciones de skills, maestrías de arma). |
| `personajes/<id>.json` | Un archivo por personaje (11 activos: gangstur, lothar, nika, lunareth, leonidas, orfe [+ `orfe_old.json` de respaldo], aredhel, chiaragorn, lyralei, kael, varis, cedric, aldren). |
| `estilos.css` | Estilos de `personaje.html`/`combate.html`/`enemigo.html`/`enemigos.html` (tema "pergamino" + variables de tema oscuro). |
| `estilos-menu.css` | Estilos de `index.html`/`extras.html`. |
| `index.html` / `extras.html` | Menú público / menú DM detrás de login. Cards hardcodeadas a mano, no leen ningún JSON de índice. |
| `CONTEXT.md` (348 líneas) | **Referencia técnica exhaustiva**, organizada por secciones §1–§12 y por "pasadas" numeradas en orden cronológico. Es donde vive el detalle real de CÓMO funciona cada mecanismo — consultar siempre antes de tocar algo que ya existe. |
| `GenerarResumen.html/.css/.js` | Herramienta aparte del DM, no cubierta en profundidad por `CONTEXT.md` ni por este documento. |
| `README.md` | Notas breves sobre qué reglas de 5.5e/2024 y homebrew se mezclaron con el 2014 base, por clase. |

No hay `package.json` ni bundler — todo corre con rutas relativas directas.

## 5. Decisiones técnicas importantes (no reconsiderar sin pedido explícito del usuario)

1. **Sin backend, todo en `localStorage`.** Elegido para minimizar fricción e infraestructura. Implica: sin sync entre dispositivos, y que un cambio de fórmula de cálculo no migra automáticamente valores ya guardados (ver limitación en §7).
2. **"Bonos temporales de combate" separados de las keys permanentes** (Vida Máxima/CA, pasada 13): antes, los botones ±1 del Rastreador escribían DIRECTO sobre `pj_<id>_vidaMaxima`/`caActual` (o el blob del enemigo), contaminando el valor real del personaje aunque el cambio fuera solo para ese combate. Se reemplazó por un bono guardado únicamente en el objeto participante dentro de `combate_participantes`. Evita: que un buff temporal de combate (Aid, Shield of Faith) quede pegado permanentemente a la ficha del personaje.
3. **"Descanso pendiente" (flag consumido por `script.js`) en vez de duplicar `tomarDescanso()` en `combate.js`** (pasada 14): decisión explícita razonada a partir del bug de duplicación de `statsFinales()` (pasada 12, ver §8) como precedente de riesgo. Cualquier feature futura del Rastreador que necesite disparar lógica específica de personaje (ranuras, Pact Magic, Hit Dice, Circle of the Land, etc.) debería seguir este mismo patrón — flag pendiente + reutilizar la función real de `script.js` — en vez de reimplementar esa lógica dentro de `combate.js`.
4. **"Muerte masiva" reutiliza el flag `p.muerto` existente** (mismo criterio "blando" que las 3 salvaciones de muerte falladas: cualquier cura por encima de 0 lo revierte) en vez de un estado de muerte permanente aparte — consistente con que la app nunca modeló la distinción real de D&D entre Revivify y curación común. Se agregó solo un flag extra puramente visual (`muerteMasiva`) para mostrar la causa distinta en pantalla.
5. **`enemigo.js` como script clásico, no módulo ES** — deliberado, para que la hoja de enemigo funcione abierta directo por `file://` sin bloqueo CORS.
6. **Sin tirador de dados ni botón de "deshacer" en el Rastreador de Combate** — pedido y luego **descartado explícitamente por el usuario** (pasada 11). Los dados se tiran en persona; un error de daño se corrige cargándolo como curación. **No reabrir esta idea sin que el usuario la pida de nuevo.**
7. **Ningún modal de ninguna página se cierra clickeando afuera** — regla de proyecto confirmada explícitamente por el usuario (pasada 12), sin excepciones, en las 6+ páginas.
8. **Todos los `alert()`/`confirm()`/`prompt()` nativos fueron reemplazados por modales propios** con el estilo visual de la app — decisión de consistencia de UX aplicada en cada sección a medida que se fue encontrando un diálogo nativo.

## 6. Reglas e invariantes (no romper al modificar)

- Nombres de skills en el JSON deben matchear EXACTO las claves en español de `SKILL_STAT` (`Constantes.js`) — si no matchean, el skill calcula 0 sin avisar.
- Nombres de clase deben matchear EXACTO las claves de `PROFICIENCIAS_POR_CLASE`.
- `tipoDano` siempre en minúscula en el JSON.
- El bono mágico de daño de un arma va horneado en el string `dano` (ej. `"2d6+2"`) **o** en el campo `bonoDano` — **nunca ambos** (se duplicaría).
- `window._equipoData`/`window._habilidadesUsoData` deben quedar seteados temprano en `init()`, antes de cualquier función top-level que los use.
- Cuidado con "temporal dead zone": todo bloque nuevo insertado en `init()` va DESPUÉS de las `const` que usa.
- Cuidado con substrings en `tipoAccion` ("Interacción con Objeto" contiene "acción") — casos especiales tienen que chequearse antes del check genérico.
- Toda `habilidadUso`/hechizo que cura DEBE tener `efectos: [{tipo: "notificacionYAbreVida", ...}]`, si no el botón "Usar" gasta el uso pero no abre el panel de vida.
- El color del tile de Vida (5 tramos por %) está **duplicado en 3 archivos** (`script.js`/`enemigo.js`/`combate.js`, sin módulo compartido) — si cambia el criterio, hay que tocar los 3.
- El cálculo de `usosPorNivel`/`usosIgualANivel` está duplicado entre `script.js` y `leerHabilidadesUsoCompartidas()` en `combate.js` — cualquier mecanismo de cálculo de usos nuevo debe replicarse en LOS DOS lugares (ya causó un bug real con los Puntos de Ki de Kael).
- Los bonos temporales de combate (`bonoVidaMaxTemp`/`bonoCATemp`) viven SOLO en `p` dentro de `combate_participantes` — nunca escribir en `pj_<id>_vidaMaxima`/`caActual` ni en el blob `enemigo_<id>` para representarlos.
- La regla de daño masivo/muerte instantánea aplica SOLO a participantes `origen === 'json'` — enemigos y `'manual'` no tienen sistema de salvaciones de muerte en esta app.
- **Convención de proceso — verificación**: cualquier cambio se verifica con un script Playwright descartable contra un `http.server` local ANTES de entregar; el/los script(s) de test se borran y el server se detiene antes de la entrega — nunca dejar artefactos de test en el repo/entrega.
- **Convención de proceso — entrega**: tras verificar, entregar los archivos cambiados con `SendUserFile` + `device_commit_files` a la carpeta local del usuario (`C:\Users\teobe\OneDrive\Escritorio\DnD\Hoja_de_Personaje_DnD5e\`), sincronizar los mismos archivos al Proyecto de Claude (los que reflejan un archivo de raíz real del repo — `script.js`, `estilos.css`, `personaje.html`, `index.html`, los `personajes/*.json`, etc. — van al path de raíz del Proyecto; `combate.js`, `combate.html`, `CONTEXT.md` y este mismo `PROJECT_CONTEXT.md` están namespaced bajo `claude/` en el Proyecto — ver §12), y actualizar `CONTEXT.md` con una nueva "pasada" numerada describiendo el cambio. **Claude nunca corre `git commit`/`git push`** — el usuario sube a GitHub a mano.
- Mínimo de sanidad antes de cualquier entrega: `node --check` sobre cada `.js` tocado, `python3 -c "import json; json.load(...)"` sobre cada `.json` tocado.

## 7. Problemas y bugs conocidos

**Confirmados (limitaciones de diseño, no bugs)**:
- No hay tirador de dados (deliberado).
- La velocidad final no es dinámica, es texto fijo.
- Un solo "slot" de compañero invocado activo por personaje.
- Valores en `localStorage` pueden quedar desactualizados si cambia una fórmula de cálculo — no hay migración automática, hay que usar los botones "Restaurar".
- El bono temporal de combate de un enemigo/`'manual'` nunca se borra solo (no hay hook de "fin de combate") — hay que sacarlo a mano o empezar combate nuevo.
- No hay suite de tests automatizados persistente en el repo (por diseño de proceso, no un olvido).

**Sospechados, NO confirmados/verificados esta sesión** (señalados así en `CONTEXT.md` §9, sin resolver):
- Posible duplicado visual de "Repelling Blast" en Gangstur (existe como rasgo Y como entrada de `habilidadesUso` "Eldritch Invocation: Repelling Blast") — podría estar mostrando la card dos veces en el modal de efectos. No verificado.
- Si Counterspell (u otros hechizos de Reacción) debería tener su propia card visual "gastada" además de consumir el recurso compartido de Reacción — pregunta abierta, no bloqueante.

**No implementado** (no son bugs, son huecos de alcance):
- `curacionExtra` de la Moon Scimitar de Orfe declarado pero no enganchado a ningún cálculo.
- Scripts interactivos de Cedric y Aldren.
- Toggle de tema oscuro en `GenerarResumen.html`.

## 8. Intentos anteriores (probados y descartados — para no repetirlos)

- **Duplicar la lógica de descanso específica por clase dentro de `combate.js`**: considerado y rechazado explícitamente para el descanso global (pasada 14) — razón: mismo riesgo de desincronización que ya causó el bug real de `statsFinales()` (pasada 12, ver abajo). Se eligió el patrón de flag pendiente + reusar `tomarDescanso()` real.
- **Escribir los bonos temporales de combate directo en las keys permanentes** (comportamiento viejo de los botones ±1 antes de la pasada 13): contaminaba el estado real del personaje. Reemplazado por el sistema de bono aparte.
- **Bug real ya corregido — `statsFinales()` en `combate.js` (pasada 12)**: recibía `data.personaje` en vez de `data` completo y buscaba `improvements` en el lugar equivocado (es hermano de `personaje`, no está adentro) — TODAS las mejoras de raza/feat/ASI se ignoraban silenciosamente en el modal de detalle del Rastreador, y tampoco se sumaba el bono de salvaciones de equipo mágico equipado. Corregido aplicando raza→feats→ASI en el mismo orden que `aplicarImprovements()` de `script.js`, y sumando el bono de equipo por separado. **Este bug es la razón citada explícitamente para no duplicar lógica de personaje dentro de `combate.js` en el futuro.**
- **Bug real ya corregido — `type="module"` en `enemigo.js`**: rompía toda la hoja de enemigo bajo `file://` por CORS (incluido el botón de borrar). Corregido pasando a script clásico.
- **Playwright — asumir que `browser.new_page()` comparte `localStorage` entre "páginas"**: NO comparte, cada llamada crea un contexto aislado. Hay que reusar el mismo objeto `page` y navegar con `.goto()` a otra URL.
- **Playwright — asumir que el tema oscuro se guarda como `'dark'`/`'light'`**: la app guarda español, `localStorage['tema'] = 'oscuro'|'claro'`.
- **Playwright — asumir que un solo click en "Siguiente turno" con un participante ya rota de ronda**: el primer click solo fija `uidActual` (arranca en `null`); hace falta un segundo click para que efectivamente pase de ronda.
- **Playwright — no cerrar el `#aviso-modal` (toast propio) entre pasos de un test**: queda tapando la pantalla y bloquea clicks posteriores con un timeout de Playwright — hay que cerrarlo explícito (`#aviso-cerrar`) antes de seguir interactuando.

## 9. Trabajo reciente

Última pasada cerrada — **"decimocuarta pasada"** (documentada en `CONTEXT.md`, intro §1 y detalle en §11):

1. **Descanso corto/largo global**: dos botones nuevos en el Rastreador (`#btn-descanso-corto-todos`/`#btn-descanso-largo-todos`) que aplican el descanso a los 9 personajes de `PERSONAJES_DISPONIBLES` (se corrigió de paso que Aldren faltaba en esa lista), estén o no en el combate actual, vía un flag `pj_<id>_descansoPendiente` consumido por una función nueva `aplicarDescansoPendienteSiCorresponde()` al final de `init()` en `script.js`. Para quien ya está en el combate, el bono temporal se limpia y (en largo) la vida vuelve a full de inmediato, sin esperar a que abra su ficha.
2. **Daño masivo / muerte instantánea**: `esDanoMasivo()` + reescritura de `aplicarCambioHp()` en `combate.js` — si el daño sobrante tras llegar a 0 HP supera estrictamente la vida máxima efectiva, el personaje `'json'` muere directo sin salvaciones de muerte. Reusa el flag `p.muerto` + agrega `p.muerteMasiva` (solo visual).
3. Verificado con 2 scripts Playwright descartables cubriendo: el ejemplo textual exacto del usuario (20/40 HP + 70 de daño), el caso límite "sobra justo lo mismo que el máximo" (no mata) vs "sobra uno más" (mata), tanto cayendo a 0 desde arriba como ya estando en 0; que el flag de descanso puede subir de corto a largo pero no bajar de largo a corto; que Aldren aparece en el selector de "+ Personaje existente"; sin diálogos nativos ni errores de consola. Todo pasó.
4. Entregado a la carpeta local del usuario (`combate.js`, `combate.html`, `script.js`, `CONTEXT.md`), sincronizado al Proyecto de Claude, `CONTEXT.md` actualizado con la entrada de esta pasada. Scripts de test borrados, servidor de pruebas (puerto 8796) detenido.

No hay ningún cambio a medio hacer después de esto.

## 10. Próximas tareas

**Imprescindible**: ninguna identificada — la app está en estado funcional y verificado, sin bugs bloqueantes conocidos.

**Importante**:
- Completar los scripts interactivos de Cedric (Bardo) y Aldren (Artífice) — hoy solo tienen datos base.
- Verificar/resolver el posible duplicado visual de "Repelling Blast" en Gangstur (sospechado, no confirmado).

**Opcional / mejora futura**:
- Enganchar `curacionExtra` de la Moon Scimitar de Orfe a un cálculo real.
- Hacer dinámica la velocidad (sumar feats/rasgos automáticamente).
- Agregar el toggle de tema oscuro a `GenerarResumen.html`.
- Definir si Counterspell/hechizos de Reacción necesitan su propia card visual de "gastado".

**Explícitamente descartado, no reabrir sin pedido nuevo del usuario**: tirador de dados y botón de "deshacer" en el Rastreador de Combate.

## 11. Cómo continuar

- **Leer primero `CONTEXT.md`** (en el Proyecto de Claude, path `claude/CONTEXT.md`) para el detalle exacto de cualquier mecánica antes de tocarla — es la referencia canónica; este documento es la capa de arranque, no la reemplaza.
- **Archivos a revisar según la tarea**: `script.js` para cualquier cosa de la ficha de un personaje jugable; `combate.js`/`combate.html` para el Rastreador; `enemigo.js`/`enemigo.html`/`enemigos.html` para la sección Enemigos; `Scripts/Core/Estadisticas.js` + `Scripts/Core/Util.js` + `Scripts/Datos/Constantes.js` para lógica de cálculo compartida (los únicos 3 archivos vivos bajo `Scripts/`).
- **No asumir que el clon git local refleja GitHub** — ver §12, el estado de git en el workspace de esta sesión estaba muy desactualizado/no confiable como fuente de verdad.
- **No reintroducir**: tirador de dados o botón de deshacer en el Rastreador (descartados explícitamente), `type="module"` en `enemigo.js`, escritura de bonos temporales de combate en las keys permanentes, lógica de descanso o de cálculo de usos duplicada dentro de `combate.js` sin replicarla también en `script.js` (o, mejor, reusar el patrón de flag pendiente).
- **Decisiones ya tomadas, no relitigar sin pedido explícito del usuario**: arquitectura de bonos temporales de combate, patrón de descanso pendiente, muerte masiva reusando el flag `muerto`, regla de "ningún modal se cierra clickeando afuera", modales propios en vez de diálogos nativos, sin backend/todo en `localStorage`.
- **Siguiente paso concreto**: no hay tarea en curso — esperar el pedido del usuario. Ante un bug report, reproducirlo primero con un script Playwright descartable contra un `http.server` local. Ante una feature nueva, seguir el flujo: implementar → `node --check` (+ validar JSON tocado) → verificar con Playwright (borrar el/los script(s) y detener el server antes de entregar) → entregar con `SendUserFile` + `device_commit_files` a la carpeta local del usuario → sincronizar al Proyecto de Claude → agregar una nueva "pasada" numerada a `CONTEXT.md` → **nunca correr `git commit`/`git push`**, eso lo hace el usuario a mano.

## 12. Contexto adicional

- **Convención de paths en el Proyecto de Claude**: los archivos que espejan un archivo de raíz real del repo (`script.js`, `estilos.css`, `personaje.html`, `index.html`, `estilos-menu.css`, los `personajes/*.json`, `Util.js`, `Estadisticas.js`, `Constantes.js`) se guardan con su nombre de archivo tal cual en el Proyecto. `combate.js`, `combate.html` y `CONTEXT.md` están namespaced bajo `claude/` en el Proyecto (convención establecida en una pasada anterior — no está documentado el motivo exacto, probablemente el default de auto-namespacing de la herramienta al escribirlos por primera vez). Este `PROJECT_CONTEXT.md` sigue la misma convención (`claude/PROJECT_CONTEXT.md`), pero fue pedido explícitamente para vivir en la **raíz real del repo** en la carpeta local del usuario y en el workspace de trabajo — ahí sí está en la raíz.
- **Caveat de git verificado esta sesión**: el clon git local del workspace de esta conversación estaba muy desactualizado respecto al trabajo real — `git status` mostraba decenas de archivos modificados/sin trackear contra el último commit (`"Mayor fixes"`, del 2026-07-22), y **`enemigo.html`, `enemigo.js` y `enemigos.html` — la sección Enemigos completa — figuraban como completamente sin trackear** en ese clon. Esto NO significa necesariamente que el usuario no los haya subido a GitHub — el flujo de este proyecto es que Claude nunca hace `git commit`/`git push`, el usuario sube a mano cuando quiere — así que el estado de git de un workspace de sesión no debe tomarse como fuente de verdad de "qué hay realmente en GitHub". Si hace falta saber el estado real del repo remoto, hay que asumir que el clon local puede estar desactualizado y no confiar en `git log`/`git status` de una sesión nueva sin verificarlo de otra forma (o simplemente ignorar git y trabajar contra los archivos que la sesión tenga disponibles vía el Proyecto de Claude / la carpeta local del usuario).
- El remoto configurado es un repo privado de GitHub bajo la cuenta del usuario (`TeoBeltran/Hoja_de_Personaje_DnD5e`), accedido con un token ya embebido en la config de git del workspace — **no exponer ni imprimir ese token en ningún documento o output**.
- **Idioma**: todo el texto de cara al usuario, comentarios de código, valores de campos JSON y el propio `CONTEXT.md` están en español (Argentina). Mantener esa convención en cualquier código o contenido nuevo.
- No hay CI ni suite de tests persistida — cada sesión escribe y borra sus propios scripts Playwright de verificación, por diseño de proceso (ver §6).
