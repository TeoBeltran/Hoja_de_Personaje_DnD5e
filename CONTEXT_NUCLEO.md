# CONTEXT_NUCLEO.md — Núcleo de la ficha de personaje

> Parte de la documentación técnica del proyecto **Hoja de Personaje D&D 5e/5.5e**. Este archivo cubre el núcleo: la ficha de personaje jugable (`personaje.html`/`script.js`), el modelo de datos, los mecanismos genéricos reutilizables, y las convenciones/limitaciones que aplican a TODO el proyecto (no solo a este archivo).
>
> **No es el punto de entrada** — para el mapa completo de documentos, el estado actual del proyecto y qué archivo leer según la tarea, empezá por `PROJECT_CONTEXT.md`. Para el historial de cambios pasada por pasada, ver `CHANGELOG.md`. Para Enemigos, Rastreador de Combate o Tema oscuro/claro, ver `CONTEXT_ENEMIGOS.md`, `CONTEXT_COMBATE.md`, `CONTEXT_TEMA.md` respectivamente.

## 1. Qué es esto

Aplicación web (HTML/CSS/JS vanilla, sin build ni framework) que funciona como **hoja de personaje interactiva de D&D** para un grupo de mesa. La usa el DM y los jugadores desde el navegador (celular o PC). No hay backend: todo el estado dinámico (vida actual, ranuras gastadas, equipo puesto, etc.) se guarda en `localStorage`, y los datos "fijos" de cada personaje (stats, hechizos, equipo, rasgos) viven en archivos JSON estáticos.

El objetivo del proyecto es reducir la fricción de jugar: en vez de que cada jugador calcule a mano su daño, su CA, cuántas ranuras le quedan, etc., la hoja lo hace sola y automatiza reglas específicas de cada personaje (Divine Smite, Wild Shape, Extra Attack, etc.) con "scripts" propios por personaje, definidos en el JSON de cada uno.

Hay 9 personajes jugables activos con card en el menú público de `index.html` (Gangstur, Lothar, Nika, Lunareth, Leonidas, Orfe, Aredhel, Chiaragorn, Lyralei). Además: Kael y Varis tienen card en `extras.html` (detrás de un login usuario/clave hardcodeado en ese mismo archivo); Cedric y Aldren son personajes de respaldo del DM sin card en ningún menú — accesibles solo escribiendo la URL a mano (`personaje.html?p=cedric`). Los 13 personajes activos tienen Vida Máxima calculada por fórmula dinámica (`vidaFormula`, ver §6).

Chiaragorn (`personajes/chiaragorn.json`) es un Mago duplicado a pedido del usuario para que sea **idéntico** a Lunareth (mismos stats, hechizos, equipo, rasgos — nivel 8, School of Evocation): copia literal del JSON de Lunareth con solo el nombre y el `id` del familiar cambiados. Usa temporalmente el mismo retrato que Lunareth (`img/personajes/chiaragorn.png` es una copia de `lunareth.png`) hasta que el usuario provea uno propio, e ícono 🔥 (Lunareth usa 📖) para diferenciarlos en el menú y en el sistema de turno.

Lyralei (`personajes/lyralei.json`) es una Pícara Wood Elf, subclase Arcane Trickster, trasfondo Sage, nivel 8 — build armada íntegramente por Claude (reglas 2014): DEX 20 / WIS 12 vía ASI de nivel 4 (+2 DEX) y nivel 8 (+1 DEX/+1 WIS) sin feat, Expertise en Sigilo/Juego de Manos/Investigación/Engaño, Sneak Attack 4d6, Uncanny Dodge, Evasion, Cunning Action, y spellcasting de "tercer casteador" (lista de Mago, mayormente Encantamiento/Ilusión, con 2 hechizos de otra escuela permitidos por Arcane Trickster: Detect Magic y Find Familiar) con ranuras 4/2 (niveles 1-2). Equipo mágico +1 a la par del resto del grupo (armadura, estoque, ballesta de mano, capa de protección, botas de elfo). Todavía no tiene retrato propio — usa el fallback genérico `img/personajes/placeholder.png` hasta que el usuario mande una imagen. Ícono 🗝️.

## 2. Estructura de archivos

```
index.html                     → Menú de selección de personaje (cards con emoji + nombre)
personaje.html                 → La hoja de personaje en sí (una sola plantilla para todos)
personajes.json                → Lista informativa de IDs de personajes activos. OJO: index.html NO la lee — sus cards están hardcodeadas directo en el HTML (ver §3). La usa GenerarResumen.js.
extras.html                     → Menú secundario detrás de login (usuario `DM` / clave `boss1234`, hardcodeados ahí mismo — único login de toda esta rama) para personajes que no van en el menú público (hoy: Kael, Varis), más las cards "⚔️ Combate" y "🐉 Enemigos" — lista propia PERSONAJES_EXTRA en su <script>, no lee ningún JSON tampoco. Tiene un botón "🔓 Cerrar sesión".
combate.html / combate.js       → Rastreador de Combate. Vive detrás del login de `extras.html`. Ver `CONTEXT_COMBATE.md`.
enemigos.html                   → Menú de Enemigos, sin login propio (usa el de `extras.html`, un nivel arriba). Ver `CONTEXT_ENEMIGOS.md`.
enemigo.html / enemigo.js       → Hoja individual de un enemigo. Ver `CONTEXT_ENEMIGOS.md`.
personajes/<id>.json           → Datos de cada personaje (uno por archivo)
script.js                      → TODA la lógica de la ficha de personaje individual (~4300+ líneas)
estilos.css                    → Estilos de personaje.html (tema "pergamino")
estilos-menu.css               → Estilos de index.html
Scripts/Datos/Constantes.js    → Diccionarios estáticos (iconos, proficiencias por clase, nombres de stats en español e inglés — `NOMBRES_STATS`/`NOMBRES_STATS_EN` —, descripciones de skills, maestrías de arma)
Scripts/Core/Estadisticas.js   → Funciones puras de cálculo de stats/skills/salvaciones a partir de los stats base
Scripts/Core/Util.js           → Funciones puras de cálculo de daño, ataques extra, requisitos de armadura/arma (incluye `obtenerHitDiceSegunClase()`, usado también por `vidaFormula` — ver §6)
img/personajes/<id>.png        → Foto de perfil de cada personaje
img/equipamiento/<slug>.png    → Ícono de cada arma/armadura/accesorio equipable. `placeholder.png` es el fallback.
```

No hay `package.json` ni bundler: los `<script type="module">` importan directo con rutas relativas. Todo corre abriendo los `.html` tal cual (o sirviéndolos como estáticos).

### Cómo se abre un personaje

`personaje.html?p=<id>` — el query param `p` determina qué archivo `personajes/<id>.json` se carga por `fetch`. Si no hay param, cae a `gangstur` por default (ver `personajeIdParam` en `script.js`).

### Persistencia

Todo el estado mutable usa `localStorage` con el prefijo `pj_<id>_` (constante `STORAGE_PREFIX`), por ejemplo `pj_kael_vidaActual`, `pj_kael_habilidadesUso`, `pj_kael_togglesActivos`. Cada personaje tiene su namespace propio, no se pisan entre sí.

## 3. Cómo interactúan los módulos

1. `index.html` tiene las cards de personajes (ícono + nombre + link a `personaje.html?p=<id>`) escritas a mano directo en el HTML — agregar un personaje nuevo al menú público implica sumar su `<a class="personaje-card">` ahí, no editar ningún JSON. Solo tiene dos cards que no son personajes: "Extras" (a `extras.html`) y nada más — "Enemigos" y "Combate" viven DENTRO de `extras.html`.
2. `personaje.html` es la plantilla visual: todos los modales, badges y contenedores están ahí como HTML fijo, mayormente vacíos, y `script.js` los llena dinámicamente en `init()`.
3. `script.js` (`init()`) hace `fetch` del JSON del personaje, y con eso: aplica mejoras de stats (`aplicarImprovements`, ver §5), calcula stats derivados (`Estadisticas.js`), renderiza cada sección, restaura desde `localStorage` lo guardado de sesiones anteriores, y cablea todos los listeners de todos los modales.
4. `Estadisticas.js` y `Util.js` son librerías de funciones **puras** (sin tocar el DOM ni `localStorage`): reciben datos y devuelven números/strings. `script.js` es quien orquesta todo y toca el DOM.
5. `Constantes.js` es el único lugar con datos "de reglas generales de D&D" que no cambian por personaje (a qué stat corresponde cada skill, qué clase es proficiente en qué saving throws, qué hace cada maestría de arma, etc.).

## 4. El modelo de datos: todo vive en el JSON del personaje

Esta es la decisión de arquitectura más importante del proyecto: **casi toda la lógica de juego de un personaje se declara como datos en su JSON, no como código nuevo en `script.js`**. `script.js` define un conjunto de "mecanismos genéricos" (ver §6) que cualquier personaje puede activar poniendo los campos correctos en su JSON. Esto permite agregar habilidades nuevas a un personaje sin tocar `script.js` en el 90% de los casos.

Estructura típica de `personajes/<id>.json`:

```
personaje       → nombre, clase, raza, tamaño, stats BASE (sin mejoras aplicadas)
improvements    → race / feats / asi: de dónde salen los bonos que se suman a los stats base
vidaFormula     → { tiradas: [...] }, insumo de la fórmula de Vida Máxima dinámica (ver §6) — un valor por nivel arriba del 1
estadisticas    → HP, nivel, CA, iniciativa, velocidad, etc. ("auto" = lo calcula script.js; Vida usa "auto" + vidaFormula)
habilidades     → skills, con nombre en ESPAÑOL exacto (ver §7), proficiente true/false, y opcional experto true (Expertise, ver §6)
background      → nombre + rasgos de trasfondo (se renderizan junto a los rasgos de clase)
rasgos          → pasivas de clase/raza/feat. Texto + metadatos opcionales (disparadores, colorCard, oculto...)
habilidadesUso  → cosas con botón "Usar" (limitadas o no). Acá vive casi toda la mecánica interactiva.
equipo          → armas, armaduras, accesorios mágicos
hechizos        → { ranuras: [...], lista: [...] }
inventario      → objetos no-equipo, con cantidad/peso, algunos usables
circuloDeLaTierra → (solo Orfe) sistema de Land del Druida 5.5e
```

**Importante:** `personaje.stats` son los stats **base**, no los finales. Los finales los calcula `aplicarImprovements()` sumando `improvements.race` + `improvements.feats` + `improvements.asi` en tiempo de carga. Nunca hardcodear el stat final en el JSON — así subir de nivel es solo agregar una entrada a `asi`. **Lo mismo aplica a Vida Máxima**: nunca reescribir a mano el número fijo de `estadisticas.Vida` — subir de nivel es agregar una tirada nueva a `vidaFormula.tiradas`.

## 5. Funcionalidades implementadas

### Núcleo de personaje
- Stats, modificadores, salvaciones, skills — calculados desde stats base + proficiencias de clase (`Estadisticas.js`).
- **Modales de detalle en los tiles de modificador/salvación**: click en cualquiera de los 6 tiles de `#mods-grid` abre un modal chico con el nombre del atributo en inglés y en español + el valor REAL del atributo (ej. "Constitution / Constitución: 19"), no solo el modificador que ya se ve en el tile. Click en cualquiera de los 6 tiles de `#saves-grid` abre un modal con el desglose del cálculo de esa salvación (modificador de atributo + proficiencia si aplica + bono de equipo activo si aplica, ej. un anillo de protección — recalculado en el momento del click, no congelado al cargar la página). Antes de esto el click en ambos grupos de tiles no hacía nada (`createBtn()` solo agrega listener a items con `desc`, y ninguno de los dos lo traía).
- CA automática: armadura equipada, escudo, Mage Armor (toggle), **Unarmored Defense** (Monje: 10+DEX+WIS si no hay armadura ni escudo).
- Equipar/desequipar armas, armaduras, accesorios — con validación de manos disponibles y de si la clase puede usar esa armadura/arma.
- Peso cargado y penalización de velocidad por sobrepeso.
- **Vida Máxima calculada por fórmula dinámica** (ver §6, mecanismo `vidaFormula`), Hit Dice, CA (con botón +/- y "restaurar").
- Sistema de turno: Acción, Acción Bonus, Reacción, Interacción con Objeto — cada uno gasta/recupera independiente, con botón "Terminar turno" que resetea todo.
- **"¿Qué puedo usar con mi X?"**: tocar cualquiera de los 4 contadores del menú de turno abre un modal con TODO lo que tenga declarado ese tipo de acción, clasificado con `clasificarTipoAccion()`. Excluye lo que no se puede usar directo (smites, `soloPostGolpe`, pools compartidos).
- Descansos corto/largo: recuperan ranuras, habilidades y HP según reglas propias por item (ver §6). También se pueden disparar "de afuera", para toda la campaña de una, desde el Rastreador de Combate (ver `CONTEXT_COMBATE.md`).

### Combate
- **Ataques con armas**, con desglose de bonos (STR/DEX, Fighting Style, arma mágica, Weapon Mastery, toggles activos) en texto chico debajo del daño.
- **Extra Attack**: automáticamente habilita N-1 golpes extra que no gastan Acción de nuevo.
- **Divine Smite y "smites" en general**: sistema genérico, soporta múltiples smites por personaje. El botón de un smite en su propia card está bloqueado ("Intentar usar" → hay que golpear primero).
- **Weapon Mastery (D&D 5.5e)**: cada arma puede tener `maestriaArma` (Cleave/Graze/Nick/Push/Sap/Slow/Topple/Vex).
- **Panel "post-golpe"**: tras un golpe cuerpo a cuerpo se abre un modal con las habilidades marcadas `postGolpe: true`. Bloqueadas fuera de ese panel con `soloPostGolpe: true`.

### Hechizos
- Ranuras por nivel, consumo automático al lanzar. Cantrips que escalan por nivel (`escala`), hechizos con selector de ranura (`escalaSlot`).
- **Familiares/compañeros invocados**: un solo "slot" activo por personaje, con botón flotante propio, HP editable, lista de ataques. Sobrevive descansos.
- **Circle of the Land (Orfe, 5.5e)**: selector de "Land" que mezcla hechizos extra según nivel. Se resetea en cada descanso largo.
- **Recuperación de ranuras**: Pearl of Power, Arcane/Natural Recovery (presupuesto = mitad de nivel redondeado arriba).
- **Efectos automáticos por rasgo** (Disciple of Life, Blessed Healer, etc.): fórmulas evaluadas y mostradas en el modal de efectos.

### Equipo mágico
- Accesorios dan bonos pasivos mientras están equipados: CA, salvaciones, bono de ataque con hechizos, CD de hechizos, bono de ataque melee, y un mínimo forzado de atributo (`atributoMinimo`, ver §6). No ocupan manos si son accesorios puros (`manos: 0`).
- El bono "horneado" en el string de daño de un arma (ej. `"2d6+2"`) y el bono en campo separado (`bonoDano`) nunca deben coexistir en el mismo ítem.
- **Badge de CA (+N)**: se muestra tanto para armaduras como para cualquier ítem no-armadura que declare un efecto `{tipo: "CA", valor: N}` en `efectos` (Bracers of Defense, anillos/capas de protección).
- **Imagen al lado del modal de detalle** para ítems equipables (`#modal-imagen-equipo`, hermano de `#skill-modal`): `img/equipamiento/<nombre-slugificado>.png` o el campo `imagen` declarado, con fallback a `placeholder.png`.
- **Íconos de equipamiento (`img/equipamiento/*.png`)**: generados a partir de SVGs de game-icons.net (CC BY 3.0, atribución a Lorc/Delapouite/Sbed/Carl-Olsen), recoloreados a la paleta de la app. Cada ítem declara `"imagen": "Nombre_Del_Archivo.png"` (recomendado) o cae a un auto-slug del nombre.

### Inventario
- Ítems con cantidad, se pueden sumar/restar. Ítems con campo `accion` muestran botón "Usar" que gasta 1 unidad y consume el recurso de turno correspondiente.

### UI / temas visuales
- Sistema de colores por card en "Efectos Activados": normalmente marrón, un efecto puede declarar `colorCard`/`colorCardFondo` para resaltar en otro color.
- Badges de info (Manos, Atk Melee/Finesse, Save DC, Spell Attack Bonus/Save DC, tipo de daño, costo en Ki `costoKi` en celeste `#4fc3f7`).
- **Tema oscuro/claro**: ver `CONTEXT_TEMA.md`.

## 6. Mecanismos genéricos reutilizables (lo importante para seguir extendiendo)

Estos son los "verbos" que cualquier personaje puede usar declarando los campos correspondientes en su JSON, sin tocar `script.js`:

| Campo (en rasgo o habilidadUso, salvo que se indique otro nivel) | Qué hace |
|---|---|
| `vidaFormula: { tiradas: [n1, n2, ...] }` (en la RAÍZ del JSON del personaje, junto con `estadisticas: [{nombre: "Vida", valor: "auto"}]`) | Reemplaza el string fijo de Vida Máxima por un cálculo dinámico: `dadoDeGolpe + suma(tiradas) + modCON_final × nivelPersonaje`. El dado de golpe sale de `obtenerHitDiceSegunClase(clase)` (`Scripts/Core/Util.js`) — el mismo que usa el sistema de Hit Dice de descanso corto. `tiradas` es un array con UNA entrada por nivel arriba del 1 (nivel 8 → 7 entradas), pensado para que el jugador cargue a mano el resultado real de su tirada de Hit Die al subir de nivel; hoy todos los personajes arrancaron con el valor "average" de D&D (`floor(dado/2) + 1`, ej. d8 → 5) como placeholder inicial. El mod CON usado es el FINAL — con ASI y bonos de equipo (`atributoMinimo`, ver abajo) ya aplicados — porque el cálculo corre en el loop de `estadisticas` de `init()`, después de que `aplicarBonosAtributoDeEquipo()` ya mutó `statsGlobal`. Subir de nivel = agregar una tirada nueva al array, nunca reescribir el número de Vida a mano. **Persistencia (bug real corregido)**: el resultado se compara contra una key nueva, `pj_<id>_vidaFormulaCalculada` (el último valor que la fórmula misma calculó), para distinguir un `vidaMaxima` guardado que es solo el resultado viejo de la fórmula (se recalcula) de un ajuste manual real hecho con los botones +/- de Vida Máx (se respeta). Sin esto, el primer `vidaMaxima` que se guardaba (con cualquier daño/curación) quedaba pegado para siempre y la fórmula dejaba de tener efecto — equipar el Amulet of Health no subía la Vida ni recargando la página. Cuando no hay ajuste manual, la vida actual sube/baja el mismo delta que el máximo recalculado (no salta a full ni queda pegada), igual que una suba real de CON en las reglas de D&D. |
| `atributoMinimo: {atributo: "CON", valor: 19}` (dentro de `efectos` de un ítem de `equipo`) | Mientras el ítem está equipado, fuerza ese atributo a un mínimo (nunca lo baja si ya es mayor por otros bonos). Se aplica en `aplicarBonosAtributoDeEquipo()`, ANTES de que se calculen modificadores/salvaciones/Vida. **No toca ninguna otra estadística directamente** — ej. el Amulet of Health de Kael solo sube CON a 19; que la Vida Máxima suba a 75 es un efecto lateral automático de `vidaFormula`. Esta separación es deliberada: no duplicar en el ítem un número (HP) que ya se deriva solo de otro (CON). |
| `costoKi: N` (en una habilidadUso) | Badge celeste "N Ki" en la card de la habilidad y en `renderModalBadges()` — puramente informativo/visual. Si además tiene que descontar del pool real de Ki, la habilidad sigue necesitando `consumeUsoDe: "Puntos de Ki"` — `costoKi` no descuenta nada por sí solo. |
| Placeholders dinámicos en `desc` de una habilidadUso: `{nivelPersonaje}`, `{modDEX}`, `{danoCaidaSlowFall}`, `{dcKi}` | Resueltos en vivo por `resolverDescDinamicaHabilidad(desc)` (función top-level en `script.js`, después de `evaluarFormula()`) contra los globals ya calculados del personaje. `{dcKi}` = `8 + proficiencia + modWIS` (la DC real de Ki del Monje — OJO, distinta del `modPrincipal` genérico basado en DEX que usa el resto de la app). Reemplaza texto fijo tipo "DC 15" que quedaba desactualizado al subir de nivel. |
| `disparadores: { arma: true\|objeto\|{condición}, hechizo: true\|"Nombre", cantrip: true, habilidad: "Nombre", smite: true, postgolpe: true }` | Auto-inyecta el rasgo como card en el modal de "Efectos Activados" cuando el contexto matchea. `true` = siempre en ese contexto; string = solo si `item.nombre` coincide; objeto = solo si los campos del item coinciden. |
| `disparadoresSiActivo` (+ `toggleBonoDano`) | Igual que `disparadores` pero solo mientras el toggle está prendido (ver Radiant Soul). |
| `toggleBonoDano: {formula, tipoDano}` | Habilidad tipo interruptor: botón "Usar" la prende (gasta 1 uso), y mientras esté prendida suma `formula` como bono de daño etiquetado a CUALQUIER arma/hechizo. Se apaga solo en cualquier descanso. |
| `toggleDuracionTurnos: N` (junto con `toggleBonoDano`) | Simula la duración real del toggle en turnos de mesa. Se apaga solo al llegar a N turnos y avisa vía `mostrarNotificacionGenerica()`. Muestra badge "⏱️ N turnos" en la card (`actualizarBadgeDuracionDOM()`). |
| `consumeUsoDe: "Nombre de otro pool"` | La habilidad no tiene contador propio: gasta 1 uso del pool compartido indicado. **Toda opción que comparte un pool DEBE llevar este campo** — si falta, esa opción no tiene botón "Usar". |
| `esPoolCompartido: true` (en la habilidad "contenedora" del pool) | La card muestra el contador pero NO tiene botón "Usar" propio — solo se gasta a través de opciones con `consumeUsoDe`. |
| `otorgaGolpes: N` (+ opcional `consumeUsoDe`, `requiereAccionGastada`) | Suma N al contador `golpesRestantes` (el mismo que usa Extra Attack). Usado por Martial Arts (N=1, gratis) y Flurry of Blows (N=2, cuesta 1 Ki). |
| `postGolpe: true` | La habilidad aparece en el panel post-golpe. |
| `soloPostGolpe: true` | Bloquea el uso directo desde la propia card. |
| `restaurarRanura: {maxNivel: N}` o `{maxNivelFormula: "mitadProficienciaArriba"}` | Abre el selector para restaurar 1 ranura gastada de nivel ≤ N. |
| `recuperacionPresupuesto: {formula: "mitadNivelArriba", maxNivelSlot: N}` | Abre el selector de "presupuesto": restaurar varias ranuras mientras alcance `ceil(nivel/2)`. |
| `restaurarTodasLasRanuras: true` | Al usarse, restaura TODAS las ranuras de golpe. |
| `restaurarUsoDe: "Nombre de otro pool"` | Al usarse, gasta 1 uso propio y restaura 1 uso al pool indicado. |
| `usosPorNivel: {"1":1, "6":2, "18":3}` | Máximo de usos por umbral de nivel (ej. Channel Divinity). |
| `usosIgualANivel: true` | Máximo de usos = nivel exacto (ej. Puntos de Ki). **Ojo**: este cálculo está duplicado entre `script.js` y `leerHabilidadesUsoCompartidas()` en `combate.js` — replicar cualquier mecanismo nuevo en LOS DOS lugares. |
| `recuperaCortoCantidad: N` | En descanso corto, SUMA N usos (no resetea a full) — ej. Second Wind. |
| `recupera: "turno"` | Se recarga solo al terminar el turno — ej. Slow Fall. |
| `oculto: true` (en rasgo, habilidadUso, o un ítem de `equipo`) | No se muestra en la lista visible (para equipo: ni en la grilla ni en `recolectarRecursosPorTipo()`), pero sigue funcionando para todo lo demás. Sirve para retirar un ítem de la vista sin perder sus datos. |
| `familiar: {...}` (en un hechizo o habilidadUso) | Al usarse, activa el panel de compañero (familiar/steed/wildshape). |
| `formasSalvajes: [...]` (en una habilidadUso) | Abre un selector entre varias formas (Wild Shape). |
| `maestriaArma: "Cleave"` (en un arma) | Asigna la propiedad de Weapon Mastery de esa arma. |
| `colorCard`, `colorCardFondo` (en un rasgo) | Personaliza el color de la card en el modal de efectos. |
| `bonoCondicional: {formula, tipoDano, nota}` (en un rasgo, junto con `disparadores`) | Daño extra que la app NO puede calcular sola porque depende de un estado externo no trackeado. Se muestra como badge naranja aparte, nunca se suma al total. |
| `efectos: [...]` (en cualquier item) | Lista de efectos ad-hoc propios de ESE item. Tipos: `notificacion`, `notificacionYAbreVida`, `autoCuracion`/`autoDano`, `activarActionSurge`, `toggleArmaduraMagica`, `atributoMinimo`, y los "pasivos de equipo" (`CA`, `salvaciones`, `bonoAtaqueHechizo`, `bonoCDHechizo`, `bonoAtaqueMelee`) que se aplican solos vía `calcularBonosEquipoActivo()`. |
| `experto: true` (en `habilidades`, junto con `proficiente: true`) | Expertise: duplica el bono de competencia. Sin `proficiente: true` no hace nada. |

El **modal de "Efectos Activados"** (`procesarEfectos()`) es el punto de entrada común: recibe un item + `contexto.tipos` y arma la lista combinando efectos propios + rasgos/habilidades con `disparadores` que matcheen.

## 7. Convenciones importantes (para no romper nada)

- **Nombres de skills en el JSON deben ser exactamente los que usa `SKILL_STAT` en `Constantes.js`** (español: "Acrobacias", "Atletismo", etc.). Si no matchean, el skill se calcula como 0 aunque esté marcado proficiente.
- Nombres de clase deben matchear exactamente las claves de `PROFICIENCIAS_POR_CLASE`. La misma lista la usa `obtenerHitDiceSegunClase()` para el dado de golpe de `vidaFormula` — una clase no mapeada cae a `d8` por default.
- `tipoDano` en minúscula en el JSON. El campo `tipo` de un arma (`melee`/`finesse`/`ranged`) determina qué stat usa para pegar.
- El bono mágico de daño de un arma va horneado en `dano` **o** en `bonoDano` — nunca ambos.
- `window._equipoData`/`window._habilidadesUsoData` deben quedar seteados temprano en `init()`, antes de cualquier función top-level que los use.
- Cuidado con "temporal dead zone": todo bloque nuevo en `init()` va DESPUÉS de las `const` que usa.
- Cuidado con substrings en `tipoAccion` ("Interacción con Objeto" contiene "acción") — casos especiales antes del check genérico.
- **Toda habilidadUso/hechizo que cura DEBE tener `efectos: [{tipo: "notificacionYAbreVida", ...}]`**, si no el "Usar" gasta el uso pero no abre el panel de vida.
- Colores de paleta: marrón (`--accent-color`) normal, violeta (`#6a1b9a`) mágico/hechizos/smite, verde (`#2e7d32`) curación, rojo (`#c62828`) daño, gris tipo de daño, celeste (`#4fc3f7`) costo en Ki.
- **Tile de Vida coloreado por % actual** (mismas clases CSS y criterio en `script.js`/`enemigo.js`/`combate.js`, duplicado en los 3 por no compartir módulos): 5 tramos — 100%-66% verde, 65%-36% amarillo, 35%-15% naranja, <15% rojo, exactamente 0% gris.
- **Ningún modal de NINGUNA página se cierra clickeando afuera** — regla de todo el proyecto, sin excepciones.
- **Truco de selector de atributo** para overridear colores embebidos en `style="..."` generado por JS: `[style^="color: #RRGGBB"]`.
- **Regla de proceso — documentación**: cualquier cambio funcional real se documenta ANTES de cerrar la sesión, en el archivo de tema correspondiente (este archivo para cambios del núcleo, `CONTEXT_ENEMIGOS.md`/`CONTEXT_COMBATE.md`/`CONTEXT_TEMA.md` para esos subsistemas) más una línea nueva en `CHANGELOG.md` y la actualización de §2/§9 de `PROJECT_CONTEXT.md`. Ver la nota de proceso al inicio de `PROJECT_CONTEXT.md` para el detalle completo de esta regla.

## 8. Limitaciones conocidas / supuestos

- **No hay tirador de dados**: la app nunca tira dados por el jugador.
- **Velocidad no es dinámica**: string fijo en `estadisticas`, no se recalcula desde feats/rasgos (Mobile, Unarmored Movement).
- **Un solo "slot" de compañero invocado por personaje**: no soporta familiar + wildshape + steed simultáneos.
- **`localStorage` puede quedar desactualizado**: si cambia una fórmula de cálculo (CA, Vida), los valores ya guardados no se recalculan solos — usar el botón "Restaurar" correspondiente.
- Cedric, Aldren y Kael (personajes de respaldo del DM) tienen datos base + rasgos descriptivos, pero no todos tienen scripts de habilidades armados todavía.
- El proyecto no tiene tests automatizados. Validación de cada entrega: `node --check` sobre `script.js` + `python3 -c "import json; json.load(...)"` sobre cada JSON tocado (para cambios de cálculo puro como `vidaFormula`, además un dry-run numérico comparando contra el valor esperado).
- Cuando se entregan cambios: solo los archivos que cambiaron (no todo el proyecto), directo a la carpeta local del usuario si el dispositivo está vinculado a la sesión.

## 9. Tareas pendientes / ideas sueltas (detalle técnico — ver también §10 de `PROJECT_CONTEXT.md` para la lista priorizada)

- Terminar los "scripts de habilidades" de Cedric (Bardo) y Aldren (Artífice) — hoy solo tienen el JSON de datos base.
- Posible duplicado a revisar en Gangstur: "Repelling Blast" existe como rasgo Y como entrada de `habilidadesUso` — podría estar mostrando la card dos veces en el modal de efectos. No verificado.
- Evaluar si Counterspell (u otros hechizos de Reacción) necesitan su propia card visual "gastada" además de consumir el recurso de Reacción compartido.
- `curacionExtra` de la Moon Scimitar de Orfe declarado en el JSON pero no enganchado a ningún cálculo.
- Posible mejora: hacer dinámica la velocidad final (sumar feats/rasgos automáticamente).
- `GenerarResumen.html`/`GenerarResumen.css` quedó sin el toggle de tema oscuro que sí tienen las 6 páginas principales.
- Tirador de dados y botón de "deshacer" en el Rastreador: **descartados explícitamente por el usuario**, no reabrir sin que lo pida de nuevo.
- Las `tiradas` de `vidaFormula` de todos los personajes están con el valor "average" como placeholder inicial — reemplazarlas por el resultado real de cada tirada a medida que cada jugador suba de nivel (edición manual del array).
