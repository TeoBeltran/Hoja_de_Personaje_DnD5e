# CONTEXT.md — Hoja de Personaje D&D 5e/5.5e (Web)

> Documento de contexto para retomar el desarrollo de este proyecto en una conversación nueva, sin depender del historial de chat previo. Última actualización: sesión donde se agregó el sistema de "bonos condicionales" (badge naranja para daño que la app no puede calcular sola, ej. Aura del Gran Panal de Nika), el de "toggles con duración en turnos" (Radiant Soul se apaga solo a los 6 turnos), se corrigió que casi ninguna habilidad/hechizo de curación abría el panel de vida al usarse (Nika, Kael, Leonidas, Aldren, Cedric), se agregó el modal "¿Qué puedo usar con mi X?" en el menú de turno, se reorganizó `img/` en subcarpetas (`personajes/`, `equipamiento/`) sumando una imagen al lado del modal de detalle para todo ítem equipable (con nombres de archivo simples vía el campo `imagen` en el JSON), se sumó un séptimo personaje jugable al menú público: Aredhel (Bardo Elfo Eladrin, College of Lore, nivel 8), se agregó soporte real de Expertise (doble bono de competencia) al cálculo de skills, y se subió a nivel 8 a los 6 personajes originales del menú público (Gangstur, Lothar, Nika, Lunareth, Leonidas, Orfe): ASI/Feat de nivel 8 (reglas 2014, mutuamente excluyentes), Vida recalculada con el método average, ranuras de hechizo de nivel 4 corregidas a 4/3/3/2 para los 3 full casters (Lunareth, Leonidas, Orfe — Gangstur usa Pact Magic y Nika es half-caster, ambos sin cambios de ranuras entre nivel 7 y 8, y Lothar no tiene magia), y un hechizo nuevo agregado a cada uno de los 5 casters (Lothar no, por ser Guerrero puro). Después de eso: se detectaron y corrigieron 2 features automáticas de nivel 8 que faltaban (Divine Strike de Leonidas — Dominio de la Vida — y la Ability Score Improvement extra de nivel 6 de los Guerreros, aplicada a Lothar como el feat Tough, +16 HP), Lunareth sumó un segundo hechizo nuevo (los Magos aprenden 2 por nivel, no 1), se le agregó equipo mágico a Aredhel (antes no tenía ninguno: Cuero Tachonado +1, Estoque +1, Capa de Protección, Medallón de la Elocuencia +1, Botas del Pueblo Feérico), se reemplazó `img/personajes/aredhel.png` por el retrato real provisto por el usuario, y se agregó que clickear el NOMBRE del personaje en `personaje.html` (no solo el ícono/emoji a los costados) también abre el modal de imagen de perfil. Se sumó un octavo personaje jugable al menú público: Chiaragorn (Mago, copia exacta de Lunareth a pedido del usuario — ver detalle en §1). Por último se sumó un noveno: Lyralei (Wood Elf, Pícara Arcane Trickster, trasfondo Sage, nivel 8 — armada desde cero por Claude, ver detalle en §1), y se agregó un fallback genérico (`img/personajes/placeholder.png`, copia de `orfe.png`) para cuando el modal de imagen de perfil intenta cargar el retrato de un personaje que todavía no tiene uno propio (caso de Lyralei, a la espera de que el usuario mande su imagen). Por último se agregó una sección nueva completa: **Enemigos** (`enemigos.html` + `enemigo.html`/`enemigo.js`), una pantalla solo para el DM (login usuario `DM` / clave `boss1234`, mismo patrón que `extras.html`) para cargar y llevar la hoja de monstruos/NPCs de combate — ver detalle en §10. Inmediatamente después se corrigió esa misma sección: `enemigo.html` cargaba `enemigo.js` como `type="module"` sin necesitarlo, lo cual lo hacía fallar por completo (CORS) al abrirse por `file://` — de ahí que "Borrar enemigo" y todo lo demás pareciera no funcionar; se pasó a script clásico y se probó de punta a punta con un test automatizado. Se agregó también un ícono elegible por el DM para cada enemigo (antes todos usaban el mismo 👹 fijo), y se rediseñó el sistema de "Agregar" de la hoja individual: un solo botón global en vez de uno por sección, con un desplegable de Tipo que decide a qué segmento va la entrada, y campos completos por entrada (Bono de Ataque, Alcance, daño en formato AdB+C con selector de dado, Tipo de Daño, Descripción y Efecto Adicional). Una tercera pasada terminó de pulir esa sección: el selector de dado quedó limitado a 4/6/8/10/12 mostrados como el número solo (sin la "d"), se puede tildar "+ Más daño" para que una entrada tenga dos daños distintos (ej. un aliento que hace fuego y necrótico juntos — el campo `danoDado` plano pasó a ser un array `danos`), el campo de Bono de Ataque se renombró a "Bono al d20 (ataque)" para que se entienda de un vistazo, el ícono pasó de campo de texto libre a un `select` curado (con opción personalizada), se agregó el mismo patrón de menú de dos modales que usa la hoja de jugador para "¿Qué puedo usar con mi X?" (tocás una categoría → lista → tocás una entrada → su detalle), y se sacaron todos los `confirm()`/`alert()` nativos del navegador a favor de un modal de confirmación propio — ver detalle en §10.

## 1. Qué es esto

Aplicación web (HTML/CSS/JS vanilla, sin build ni framework) que funciona como **hoja de personaje interactiva de D&D** para un grupo de mesa. La usa el DM y los jugadores desde el navegador (celular o PC). No hay backend: todo el estado dinámico (vida actual, ranuras gastadas, equipo puesto, etc.) se guarda en `localStorage`, y los datos "fijos" de cada personaje (stats, hechizos, equipo, rasgos) viven en archivos JSON estáticos.

El objetivo del proyecto es reducir la fricción de jugar: en vez de que cada jugador calcule a mano su daño, su CA, cuántas ranuras le quedan, etc., la hoja lo hace sola y further automatiza reglas específicas de cada personaje (Divine Smite, Wild Shape, Extra Attack, etc.) con "scripts" propios por personaje, definidos en el JSON de cada uno.

Hay 9 personajes jugables activos con card en el menú público de `index.html` (Gangstur, Lothar, Nika, Lunareth, Leonidas, Orfe, Aredhel, Chiaragorn, Lyralei). Además: Kael y Varis tienen card en `extras.html` (detrás de un login usuario/clave hardcodeado en ese mismo archivo); Cedric y Aldren son personajes de respaldo del DM sin card en ningún menú — accesibles solo escribiendo la URL a mano (`personaje.html?p=cedric`).

Chiaragorn (`personajes/chiaragorn.json`) es un Mago duplicado a pedido del usuario para que sea **idéntico** a Lunareth (mismos stats, hechizos, equipo, rasgos — nivel 8, School of Evocation): copia literal del JSON de Lunareth con solo el nombre y el `id` del familiar cambiados. Usa temporalmente el mismo retrato que Lunareth (`img/personajes/chiaragorn.png` es una copia de `lunareth.png`) hasta que el usuario provea uno propio, e ícono 🔥 (Lunareth usa 📖) para diferenciarlos en el menú y en el sistema de turno.

Lyralei (`personajes/lyralei.json`) es una Pícara Wood Elf, subclase Arcane Trickster, trasfondo Sage, nivel 8 — build armada íntegramente por Claude (reglas 2014): DEX 20 / WIS 12 vía ASI de nivel 4 (+2 DEX) y nivel 8 (+1 DEX/+1 WIS) sin feat, Expertise en Sigilo/Juego de Manos/Investigación/Engaño, Sneak Attack 4d6, Uncanny Dodge, Evasion, Cunning Action, y spellcasting de "tercer casteador" (lista de Mago, mayormente Encantamiento/Ilusión, con 2 hechizos de otra escuela permitidos por Arcane Trickster: Detect Magic y Find Familiar) con ranuras 4/2 (niveles 1-2). Equipo mágico +1 a la par del resto del grupo (armadura, estoque, ballesta de mano, capa de protección, botas de elfo). Todavía no tiene retrato propio — usa el fallback genérico `img/personajes/placeholder.png` hasta que el usuario mande una imagen. Ícono 🗝️.

## 2. Estructura de archivos

```
index.html                     → Menú de selección de personaje (cards con emoji + nombre)
personaje.html                 → La hoja de personaje en sí (una sola plantilla para todos)
personajes.json                → Lista informativa de IDs de personajes activos. OJO: index.html NO la lee — sus cards están hardcodeadas directo en el HTML (ver §3). La usa GenerarResumen.js.
extras.html                     → Menú secundario detrás de login (usuario/clave hardcodeados ahí mismo) para personajes que no van en el menú público (hoy: Kael, Varis) — lista propia PERSONAJES_EXTRA en su <script>, no lee ningún JSON tampoco.
enemigos.html                   → Menú de Enemigos (solo DM), detrás de login propio (usuario `DM` / clave `boss1234`, hardcodeados en su <script>). Sin JSON: escanea localStorage por prefijo `enemigo_` para listar. Modal "Agregar" con form → paso de confirmación (Sí/No; No vuelve al form sin cerrar el modal).
enemigo.html / enemigo.js       → Hoja individual de un enemigo (`enemigo.html?id=<id>`). Ver detalle en §10.
personajes/<id>.json           → Datos de cada personaje (uno por archivo)
script.js                      → TODA la lógica de la app (~3900 líneas)
estilos.css                    → Estilos de personaje.html (tema "pergamino")
estilos-menu.css               → Estilos de index.html
Scripts/Datos/Constantes.js    → Diccionarios estáticos (iconos, proficiencias por clase, nombres de stats, descripciones de skills, maestrías de arma)
Scripts/Core/Estadisticas.js   → Funciones puras de cálculo de stats/skills/salvaciones a partir de los stats base
Scripts/Core/Util.js           → Funciones puras de cálculo de daño, ataques extra, requisitos de armadura/arma
img/personajes/<id>.png        → Foto de perfil de cada personaje (antes vivían sueltas en img/)
img/equipamiento/<slug>.png    → Ícono de cada arma/armadura/accesorio equipable (por nombre "slugificado", ver §5). `placeholder.png` (copia de orfe.png) es el fallback para cualquier ítem que no tenga su propio archivo.
```

No hay `package.json` ni bundler: los `<script type="module">` importan directo con rutas relativas. Todo corre abriendo los `.html` tal cual (o sirviéndolos como estáticos).

### Cómo se abre un personaje

`personaje.html?p=<id>` — el query param `p` determina qué archivo `personajes/<id>.json` se carga por `fetch`. Si no hay param, cae a `gangstur` por default (ver `personajeIdParam` en `script.js`).

### Persistencia

Todo el estado mutable usa `localStorage` con el prefijo `pj_<id>_` (constante `STORAGE_PREFIX`), por ejemplo `pj_kael_vidaActual`, `pj_kael_habilidadesUso`, `pj_kael_togglesActivos`. Cada personaje tiene su namespace propio, no se pisan entre sí.

## 3. Cómo interactúan los módulos

1. `index.html` tiene las cards de personajes (ícono + nombre + link a `personaje.html?p=<id>`) escritas a mano directo en el HTML — agregar un personaje nuevo al menú público implica sumar su `<a class="personaje-card">` ahí, no editar ningún JSON.
2. `personaje.html` es la plantilla visual: todos los modales, badges y contenedores están ahí como HTML fijo, mayormente vacíos, y `script.js` los llena dinámicamente en `init()`.
3. `script.js` (`init()`) hace `fetch` del JSON del personaje, y con eso:
   - Aplica mejoras de stats (`aplicarImprovements`, ver §5).
   - Calcula stats derivados (`Estadisticas.js`).
   - Renderiza cada sección (stats, skills, rasgos, equipo, hechizos, habilidades, inventario).
   - Restaura desde `localStorage` todo lo que haya quedado guardado de sesiones anteriores.
   - Cablea todos los listeners de todos los modales.
4. `Estadisticas.js` y `Util.js` son librerías de funciones **puras** (sin tocar el DOM ni `localStorage`): reciben datos y devuelven números/strings. `script.js` es quien orquesta todo y toca el DOM.
5. `Constantes.js` es el único lugar con datos "de reglas generales de D&D" que no cambian por personaje (a qué stat corresponde cada skill, qué clase es proficiente en qué saving throws, qué hace cada maestría de arma, etc.).

## 4. El modelo de datos: todo vive en el JSON del personaje

Esta es la decisión de arquitectura más importante del proyecto: **casi toda la lógica de juego de un personaje se declara como datos en su JSON, no como código nuevo en `script.js`**. `script.js` define un conjunto de "mecanismos genéricos" (ver §6) que cualquier personaje puede activar poniendo los campos correctos en su JSON. Esto permite agregar habilidades nuevas a un personaje sin tocar `script.js` en el 90% de los casos.

Estructura típica de `personajes/<id>.json`:

```
personaje       → nombre, clase, raza, tamaño, stats BASE (sin mejoras aplicadas)
improvements    → race / feats / asi: de dónde salen los bonos que se suman a los stats base
estadisticas    → HP, nivel, CA, iniciativa, velocidad, etc. ("auto" = lo calcula script.js)
habilidades     → skills, con nombre en ESPAÑOL exacto (ver §7), proficiente true/false, y opcional experto true (Expertise: duplica el bono de competencia, ver §6)
background      → nombre + rasgos de trasfondo (se renderizan junto a los rasgos de clase)
rasgos          → pasivas de clase/raza/feat. Texto + metadatos opcionales (disparadores, colorCard, oculto...)
habilidadesUso  → cosas con botón "Usar" (limitadas o no). Acá vive casi toda la mecánica interactiva.
equipo          → armas, armaduras, accesorios mágicos
hechizos        → { ranuras: [...], lista: [...] }
inventario      → objetos no-equipo, con cantidad/peso, algunos usables
circuloDeLaTierra → (solo Orfe) sistema de Land del Druida 5.5e
```

**Importante:** `personaje.stats` son los stats **base**, no los finales. Los finales los calcula `aplicarImprovements()` sumando `improvements.race` + `improvements.feats` + `improvements.asi` en tiempo de carga. Nunca hardcodear el stat final en el JSON — así subir de nivel es solo agregar una entrada a `asi`.

## 5. Funcionalidades implementadas

### Núcleo de personaje
- Stats, modificadores, salvaciones, skills — calculados desde stats base + proficiencias de clase (`Estadisticas.js`).
- CA automática: armadura equipada, escudo, Mage Armor (toggle), **Unarmored Defense** (Monje: 10+DEX+WIS si no hay armadura ni escudo — implementado como caso especial en `calcularCA()`, buscando el rasgo `"Unarmored Defense"` por nombre).
- Equipar/desequipar armas, armaduras, accesorios — con validación de manos disponibles y de si la clase puede usar esa armadura/arma.
- Peso cargado y penalización de velocidad por sobrepeso.
- Vida (con botón +/-, vida máxima editable), Hit Dice, CA (con botón +/- y "restaurar").
- Sistema de turno: Acción, Acción Bonus, Reacción, Interacción con Objeto — cada uno gasta/recupera independiente, con botón "Terminar turno" que resetea todo.
- **"¿Qué puedo usar con mi X?"**: tocar cualquiera de los 4 contadores del menú de turno abre un modal con TODO lo que tenga declarado ese tipo de acción (armas equipadas, hechizos/cantrips, habilidades, objetos de inventario), clasificado con las mismas reglas que `consumirAccion()` (`clasificarTipoAccion()` en `script.js`). Excluye lo que no se puede usar directo desde su propia card (smites, `soloPostGolpe`, pools compartidos como Channel Divinity). Tocar un resultado cierra este modal y abre el modal real de ese item (mismo que si lo hubieras tocado desde su pestaña).
- Descansos corto/largo: recuperan ranuras, habilidades y HP según reglas propias por item (ver §6).

### Combate
- **Ataques con armas**, con cálculo de daño mostrando el desglose de bonos (STR/DEX, Fighting Style, arma mágica, Weapon Mastery, toggles activos) en texto chico debajo del badge de daño — para que nunca sea "un número mágico sin explicación".
- **Extra Attack**: el primer golpe gasta la Acción real; si el personaje tiene el rasgo "Extra Attack", automáticamente habilita N-1 golpes extra que NO vuelven a gastar Acción (contador `turnoEstado.golpesRestantes`).
- **Divine Smite y "smites" en general**: sistema genérico, soporta **múltiples smites por personaje** (ej. Nika tiene Divine Smite + Honey Smite simultáneos). Al pegar con arma melee se abre un selector de nivel de ranura a gastar. El botón de un smite en su propia card no se puede usar directo ("Intentar usar" → bloqueado, hay que golpear primero).
- **Weapon Mastery (D&D 5.5e)**: cada arma puede tener `maestriaArma` (Cleave/Graze/Nick/Push/Sap/Slow/Topple/Vex, traducidos). Si el personaje tiene el rasgo "Weapon Mastery", se auto-inyecta como card en el modal de efectos al atacar con esa arma — sin tener que declararlo a mano en cada arma.
- **Panel "post-golpe"** (nuevo, hecho para Kael/Monje): tras un golpe cuerpo a cuerpo se abre un modal con las habilidades marcadas `postGolpe: true` (Martial Arts, Flurry of Blows, Stunning Strike, Hand of Harm...). Se puede elegir más de una si no comparten recurso; cada elección re-renderiza el modal reflejando qué queda disponible. Estas habilidades están bloqueadas si se intenta usarlas directo desde su propia card (`soloPostGolpe: true`, mismo patrón que Smite).

### Hechizos
- Ranuras por nivel, consumo automático al lanzar.
- Cantrips que escalan por nivel de personaje (`escala`), y hechizos que dejan elegir con qué ranura lanzarlos (`escalaSlot`, ej. Fireball) — abren un selector de nivel antes de tirar el daño.
- **Familiares/compañeros invocados** (Find Familiar, Find Steed, Wild Shape, Staff of the Python): un solo "slot" de compañero activo por personaje, con botón flotante propio, HP editable, lista de ataques. Sobrevive descansos (no se resetea solo). Wild Shape abre un selector de animal antes de invocar.
- **Circle of the Land (Orfe, 5.5e)**: selector de "Land" (Arid/Polar/Temperate/Tropical/Underdark homebrew) que mezcla hechizos extra a la lista según nivel de personaje. Se resetea (queda "sin elegir") en cada descanso largo y el selector se abre solo.
- **Recuperación de ranuras**: Pearl of Power (elegir 1 ranura gastada para restaurar) y Arcane/Natural Recovery (presupuesto = mitad de nivel redondeado arriba, elegís varias mientras alcance) — mismo modal genérico, dos modos.
- **Efectos automáticos por rasgo** (Disciple of Life, Blessed Healer, etc.): fórmulas simples (`2 + nivelHechizo`) evaluadas y mostradas en el modal de efectos al lanzar el hechizo correspondiente.

### Equipo mágico
- Accesorios (capas, anillos, amuletos) dan bonos pasivos mientras están equipados: CA, salvaciones, bono de ataque con hechizos, CD de hechizos, bono de ataque melee. No ocupan manos si son accesorios puros (`manos: 0`).
- El bono "horneado" en el string de daño de un arma (ej. `"2d6+2"`) y el bono en campo separado (`bonoDano`) nunca deben coexistir en el mismo ítem — se estandarizó a uno u otro para no duplicar. `extraerBonusHorneado()` separa el bono horneado y lo etiqueta igual que cualquier otro bono, para que siempre se vea de dónde sale cada número.
- **Imagen al lado del modal de detalle para ítems equipables**: el mismo `#skill-modal` que usan todos los detalles ahora tiene un segundo `.modal-content` hermano (`#modal-imagen-equipo`, estilo calcado del modal de "foto de perfil"). `abrirModalEquipo()` decide si mostrarlo con la misma condición `esEquipable` que ya usaba para el botón "Equipar" (armadura/escudo, ocupa manos, tiene `efectos` numéricos, o `equipable: true`); si aplica, angosta el modal de texto con la clase `con-imagen-lateral` y el par queda centrado como grupo (el flex del `.modal` los centra a los dos juntos). La imagen intenta primero `img/equipamiento/<nombre-slugificado>.png` (`slugificarNombreItem()`, saca tildes/mayúsculas/espacios) y si no existe cae a `img/equipamiento/placeholder.png` vía `onerror`. Cualquier otro lugar que abra `#skill-modal` (rasgos, hechizos, habilidades, stats/skills) tiene que resetear este bloque a `display:none` + sacar la clase, porque el modal es compartido y si no queda pegada la imagen del ítem anterior — todos los call sites de `modal.style.display = 'flex'` ya lo hacen (ver `abrirModalGenericoItem()` como referencia si se agrega uno nuevo).
- **Íconos de equipamiento (`img/equipamiento/*.png`)**: cada arma/armadura/accesorio equipable de todos los personajes tiene su propio ícono (26 archivos, algunos reutilizados entre varios ítems de la misma categoría), generado a partir de SVGs de [game-icons.net](https://game-icons.net) (licencia **CC BY 3.0** — requiere atribución si se redistribuye: autores usados acá son Lorc, Delapouite, Sbed y Carl-Olsen, repo fuente `github.com/game-icons/icons`), recoloreados a la paleta de la app (fondo `#eae3d0`, ícono `#5d4037`) y rasterizados a 512×512. Los nombres de archivo son simples y en inglés, tipo `Dagger.png`, `Plate_Armor.png`, `Hide_Armor.png` (Title_Case, sin tildes ni paréntesis) — pensados para poder escribirlos/reconocerlos a mano sin tener que recalcular ningún slug.
  - **Cómo se elige la imagen de un ítem**: cada objeto en `equipo` puede declarar `"imagen": "Nombre_Del_Archivo.png"` apuntando a un archivo dentro de `img/equipamiento/`. Es el método recomendado — así el nombre del archivo lo elegís vos, no depende de adivinar cómo queda "slugificado" el `nombre` del ítem. Todos los ítems equipables de todos los personajes ya tienen este campo puesto.
  - Si un ítem NO tiene `imagen` declarada (ej. uno nuevo que se agregue a futuro), `abrirModalEquipo()` en `script.js` cae a un auto-slug del `nombre` del ítem vía `slugificarNombreItem()` (saca tildes/mayúsculas/paréntesis/espacios, todo a minúscula con guiones bajos) y busca `img/equipamiento/<ese-slug>.png` — este es solo un fallback de compatibilidad, no la forma recomendada de nombrar archivos nuevos.
  - En cualquier caso, si el archivo (declarado o auto-slug) no existe, cae a `img/equipamiento/placeholder.png` vía `onerror` en el `<img>`.
  - La elección de qué ícono usar para cada ítem es aproximada por categoría (ej. los 4 martillos de distintos personajes comparten `Hammer.png`, todas las capas comparten `Cloak.png`) — no es arte 1:1 por ítem.

### Inventario
- Ítems con cantidad, se pueden sumar/restar.
- Ítems con campo `accion` muestran botón "Usar" que gasta 1 unidad y consume el recurso de turno correspondiente (incluye "Interacción con Objeto" como recurso real, no solo decorativo).

### UI / temas visuales
- Sistema de colores por card en el modal de "Efectos Activados": normalmente marrón, pero un efecto puede declarar `colorCard` (+ opcional `colorCardFondo`) para resaltar en otro color (ej. violeta para Aura del Gran Panal de Nika).
- Badges de info (Manos, Atk Melee/Finesse, Save DC, Spell Attack Bonus/Save DC, tipo de daño) con fondo clarito a juego con su color de borde. Tipo de daño/curación en gris neutro con mayúscula inicial, separado visualmente del resto (que usa marrón/violeta).

## 6. Mecanismos genéricos reutilizables (lo importante para seguir extendiendo)

Estos son los "verbos" que cualquier personaje puede usar declarando los campos correspondientes en su JSON, sin tocar `script.js`:

| Campo (en rasgo o habilidadUso) | Qué hace |
|---|---|
| `disparadores: { arma: true\|objeto\|{condición}, hechizo: true\|"Nombre", cantrip: true, habilidad: "Nombre", smite: true, postgolpe: true }` | Auto-inyecta el rasgo como card en el modal de "Efectos Activados" cuando el contexto matchea. `true` = siempre en ese contexto; string = solo si `item.nombre` coincide; objeto = solo si los campos del item coinciden (ej. `{manos:2, tipo:'melee'}` para Great Weapon Fighting). |
| `disparadoresSiActivo` (+ `toggleBonoDano`) | Igual que `disparadores` pero solo mientras el toggle está prendido (ver Radiant Soul). |
| `toggleBonoDano: {formula, tipoDano}` | Habilidad tipo interruptor: botón "Usar" la prende (gasta 1 uso), y mientras esté prendida suma `formula` (evaluada con `evaluarFormula`) como bono de daño etiquetado a CUALQUIER arma/hechizo. El botón pasa a decir "Desactivar" (gratis, no gasta acción ni uso). Se apaga solo en cualquier descanso. |
| `toggleDuracionTurnos: N` (junto con `toggleBonoDano`) | Simula la duración real del toggle en turnos de mesa (ej. Radiant Soul: "1 minuto" → 6 turnos con rondas de 10s). Cada vez que se aprieta "Terminar turno" con el toggle prendido, suma 1 a un contador (`togglesDuracionContador`); al llegar a N se apaga solo Y avisa reutilizando el modal genérico de "Efectos Activados" (`mostrarNotificacionGenerica()`, NUNCA un modal nuevo). El contador arranca en 0 al activar (recién cuenta como "1 turno" al terminar el turno actual) y se borra al desactivar (manual, por expirar, o por descanso). |
| `consumeUsoDe: "Nombre de otro pool"` | La habilidad no tiene contador propio: gasta 1 uso del pool compartido indicado (ej. las 3 opciones de Channel Divinity comparten un solo contador "Channel Divinity"; Harness Divine Power gasta ese mismo pool para restaurar una ranura). **Toda opción que comparte un pool DEBE llevar este campo** — si falta, esa opción no tiene botón "Usar" (bug real que ya pasó con Turn Undead y Preserve Life de Leonidas). |
| `esPoolCompartido: true` (en la habilidad "contenedora" del pool) | La card sigue mostrando el contador (ej. "Channel Divinity 2/2", "Puntos de Ki N/N") pero NO tiene botón "Usar" propio — nunca se gasta "directo", solo a través de las opciones que le apuntan con `consumeUsoDe`. Sin este campo, la card del pool queda accionable por sí sola y deja gastar un uso sin elegir ninguna opción real (bug real que ya pasó con Channel Divinity de Nika/Leonidas y Puntos de Ki de Kael). |
| `otorgaGolpes: N` (+ opcional `consumeUsoDe`, `requiereAccionGastada`) | Suma N al contador `golpesRestantes` (el mismo que usa Extra Attack), permitiendo golpear N veces más sin gastar la Acción de nuevo. Usado por Martial Arts (N=1, gratis) y Flurry of Blows (N=2, cuesta 1 Ki). |
| `postGolpe: true` | La habilidad aparece en el panel que se abre después de un golpe melee (ver §5). |
| `soloPostGolpe: true` | Bloquea el uso directo desde la propia card (mismo patrón que Smite: "Intentar usar" → aviso de que hace falta golpear primero). |
| `restaurarRanura: {maxNivel: N}` o `{maxNivelFormula: "mitadProficienciaArriba"}` | Abre el selector para restaurar 1 ranura gastada de nivel ≤ N. |
| `recuperacionPresupuesto: {formula: "mitadNivelArriba", maxNivelSlot: N}` | Abre el selector de "presupuesto": restaurar varias ranuras mientras alcance `ceil(nivel/2)`, tope de nivel por ranura individual. |
| `restaurarTodasLasRanuras: true` | Al usarse, restaura TODAS las ranuras de golpe (ej. Magical Cunning). |
| `restaurarUsoDe: "Nombre de otro pool"` | Al usarse, gasta 1 uso propio y restaura 1 uso al pool indicado (ej. Amulet of the Devout recarga Channel Divinity). |
| `usosPorNivel: {"1":1, "6":2, "18":3}` | Máximo de usos calculado por umbral de nivel de personaje (ej. Channel Divinity de Clérigo/Paladín). |
| `usosIgualANivel: true` | Máximo de usos = nivel de personaje exacto, sin escalones (ej. Puntos de Ki del Monje). |
| `recuperaCortoCantidad: N` | En descanso corto, SUMA N usos (no resetea a full) — ej. Second Wind: +1 en corto, full en largo. |
| `recupera: "turno"` | Se recarga solo al terminar el turno (botón "Terminar turno"), no con descansos — ej. Slow Fall. |
| `oculto: true` (en rasgo o habilidadUso) | No se muestra en la lista visible, pero sigue funcionando para todo lo demás (disparadores, cálculos). Sirve para tener una versión "resumen" de un rasgo largo que se muestra en el modal de efectos, sin duplicar el texto completo ahí. |
| `familiar: {...}` (en un hechizo o habilidadUso) | Al usarse, activa el panel de compañero (familiar/steed/wildshape) con esos datos. |
| `formasSalvajes: [...]` (en una habilidadUso) | En vez de un solo `familiar`, abre un selector entre varias formas (Wild Shape). |
| `maestriaArma: "Cleave"` (en un arma) | Asigna la propiedad de Weapon Mastery de esa arma (ver diccionario en `Constantes.js`). |
| `colorCard`, `colorCardFondo` (en un rasgo) | Personaliza el color de la card en el modal de efectos cuando se auto-inyecta. |
| `bonoCondicional: {formula, tipoDano, nota}` (en un rasgo, junto con `disparadores`) | Daño extra que la app NO puede calcular sola porque depende de un estado externo que no se trackea (ej: si el objetivo está Enmielado — Aura del Gran Panal de Nika). Se muestra SIEMPRE como badge naranja aparte del daño automático (violeta), en la card del arma/hechizo y en su modal — nunca se suma al total, es un recordatorio visual para aplicarlo a mano solo cuando corresponda. `formula` se muestra tal cual (no se evalúa como dado, ej. `"1d4+3"` → `"+1d4+3"`). |
| `efectos: [...]` (en cualquier item) | Lista de efectos ad-hoc propios de ESE item específico (no reutilizables por otros). Tipos soportados: `notificacion` (texto con placeholders `{nivelPersonaje}`, `{WIS}`, etc.), `notificacionYAbreVida` (además abre el modal de vida al cerrar), `autoCuracion`/`autoDano` (evalúa fórmula y la muestra resaltada), `activarActionSurge`, `toggleArmaduraMagica` (Mage Armor), y los "pasivos de equipo" (`CA`, `salvaciones`, `bonoAtaqueHechizo`, `bonoCDHechizo`, `bonoAtaqueMelee`) que NUNCA disparan el modal, se aplican solos vía `calcularBonosEquipoActivo()`. |
| `experto: true` (en una entrada de `habilidades`, junto con `proficiente: true`) | Expertise: duplica el bono de competencia de esa skill (`calcularValorSkill()` en `Estadisticas.js` lo suma dos veces). Sin `proficiente: true` no hace nada — la Expertise duplica una competencia existente, nunca la reemplaza. Visualmente la card queda con el mismo violeta de "proficient" más un aro dorado (`.skill-btn.experto` en `estilos.css`), para distinguirla de un vistazo. |

El **modal de "Efectos Activados"** (`procesarEfectos()`) es el punto de entrada común: recibe un item + `contexto.tipos` (array de tags: `arma`, `hechizo`, `cantrip`, `habilidad`, `smite`, `postgolpe`) y arma la lista final combinando: efectos propios del item + rasgos con `disparadores` que matcheen + habilidades con `disparadores`/`disparadoresSiActivo` que matcheen. Si se le pasa `contexto.danoTexto`, se muestra como card de recap arriba de todo (útil para repetir el daño calculado, por ejemplo cuando Flurry of Blows hace que el mismo golpe se repita 2 veces).

## 7. Convenciones importantes (para no romper nada)

- **Nombres de skills en el JSON deben ser exactamente los que usa `SKILL_STAT` en `Constantes.js`** (en español: "Acrobacias", "Atletismo", "Trato animal", etc., NO en inglés). Si no matchean, el skill se calcula como 0 aunque esté marcado proficiente — bug real que ya pasó.
- Nombres de clase deben matchear exactamente las claves de `PROFICIENCIAS_POR_CLASE` en `Constantes.js` ('Bardo', 'Monje', 'Artífice', 'Paladín', etc.) para que las proficiencias de salvación se calculen bien.
- `tipoDano` de armas/hechizos: usar minúscula en el JSON (ej. `"radiante"`), la UI lo capitaliza sola.
- El campo `tipo` de un arma (`melee` / `finesse` / `ranged`) determina qué stat usa para pegar (STR / DEX / — sin header propio para ranged todavía). `finesse` se usa también para Unarmed Strike y armas de monje para que tomen DEX.
- Cuando un arma tiene bono mágico de daño: usarlo **o** horneado en el string de `dano` (`"2d6+2"`) **o** en el campo `bonoDano` — nunca ambos a la vez (se duplicaría).
- `window._equipoData` y `window._habilidadesUsoData` se setean bien temprano en `init()` (antes de cualquier cálculo) para que funciones top-level como `calcularCA()` los puedan usar. Si se agrega un cálculo nuevo que dependa del equipo/habilidades fuera de `init()`, hay que asegurarse de leer de ahí y no de un `data` local.
- **Cuidado con "temporal dead zone"**: cualquier bloque nuevo insertado en `init()` debe ir DESPUÉS de la declaración `const` de las variables que usa (`nivelPersonaje`, etc.). Ya hubo un bug real por esto (Circle of the Land rompía toda la carga de la página).
- **Cuidado con substrings en `tipoAccion`**: "Interacción con Objeto" contiene "acción", "Sin acción" contiene "acción" — `consumirAccion()` y el pre-check de recursos tienen que revisar esos casos ANTES del check genérico de "acción", si no consumen el recurso equivocado. Patrón ya resuelto, pero tenerlo en cuenta si se agrega un nuevo tipo de acción con nombre parecido.
- Los toasts (`mostrarToast`) son la confirmación visual estándar de "algo pasó"; el modal de efectos es para "esto es lo que tenés que aplicar/recordar".
- **Toda habilidadUso o hechizo que cura DEBE tener `efectos: [{tipo: "notificacionYAbreVida", ...}]`** (ver §6), si no el "Usar" solo gasta el uso y no pasa nada más — bug real que ya pasó (Healing Hands, Lay on Hands, Hand of Healing, Preserve Life, y varios Cure Wounds/Healing Word estaban así). No alcanza con `autoCuracion` solo: ese tipo únicamente muestra un texto extra condicionado a un rasgo (ej. Disciple of Life), no abre el panel de vida por sí solo.
- Colores de la paleta: marrón/pergamino (`var(--accent-color)` = `#5d4037`) para lo "normal", violeta (`#6a1b9a`) para lo mágico/hechizos/smite, verde (`#2e7d32`) para curación, rojo (`#c62828`) para daño/advertencias, gris (`#757575` texto / `#eeeeee` fondo) para tipo de daño.

## 8. Limitaciones conocidas / supuestos

- **No hay tirador de dados**: la app nunca tira dados por el jugador. Todo lo que requiere una tirada (iniciativa con ventaja, ataques, salvaciones) se documenta en texto pero no se simula.
- **Velocidad no es dinámica**: a diferencia de CA/ataque, la velocidad final es un string fijo en `estadisticas`, no se recalcula desde feats/rasgos. Si un personaje tiene algo que la modifica (Mobile, Unarmored Movement), se documenta en texto/rasgo pero el número hay que dejarlo bien puesto a mano.
- **Un solo "slot" de compañero invocado por personaje**: no soporta tener familiar + wildshape + steed simultáneos, es una elección de diseño (así era antes de este sistema, y simplifica mucho la UI).
- **`localStorage` puede quedar desactualizado**: si se cambia una fórmula de cálculo (ej. la de CA), los valores ya guardados en `localStorage` de sesiones viejas no se recalculan solos — hay que usar el botón "Restaurar" correspondiente (CA, vida, etc.) para que tome el nuevo valor. Ya pasó al menos una vez y probablemente vuelva a pasar.
- Los 3 personajes de respaldo del DM (Cedric, Aldren, Kael) están armados con datos base + rasgos descriptivos, pero **no todos tienen scripts de habilidades armados todavía** — eso se va haciendo personaje por personaje, a pedido.
- El proyecto no tiene tests automatizados. La validación de cada entrega es: `node --check` sobre `script.js` (sintaxis) + `python3 -c "import json; json.load(...)"` sobre cada JSON tocado.
- Cuando se entregan cambios, la convención de esta conversación fue: **enviar solo los archivos que cambiaron** (no todo el proyecto) en un `.zip`, para que el usuario los pise manualmente sobre su copia local.

## 9. Tareas pendientes / ideas sueltas mencionadas pero no implementadas

- Terminar los "scripts de habilidades" de Cedric (Bardo) y Aldren (Artífice) — por ahora solo tienen el JSON de datos base, sin las mecánicas interactivas (Bardic Inspiration, Steel Defender, Infuse Item, etc.).
- Posible duplicado a revisar en Gangstur: "Repelling Blast" existe como rasgo Y como "Eldritch Invocation: Repelling Blast" en habilidadesUso — quedó así a pedido explícito pero puede estar mostrando la card dos veces en el modal de efectos.
- Evaluar si conviene que Counterspell (u otros hechizos de Reacción) también tengan su propia card "gastada" visual además de consumir el recurso de Reacción compartido (quedó pendiente, no bloqueante).
- `curacionExtra` de la Moon Scimitar de Orfe (1d4 extra al curar con hechizo mientras está equipada) está declarado en el JSON pero no enganchado a ningún cálculo todavía.
- Posible mejora: hacer que la velocidad final sí sea dinámica (sumar feats/rasgos automáticamente) en vez de texto fijo.

## 10. Enemigos (pantalla DM)

Sección nueva, independiente del sistema de personajes jugables (no toca `script.js` ni `personajes/*.json`). Pensada para que el DM cargue monstruos/NPCs de combate al vuelo, sin tener que escribir un JSON a mano por cada uno.

**`enemigos.html`** — menú/roster. Detrás de un login hardcodeado en el propio `<script>` del archivo (usuario `DM`, clave `boss1234`; mismo patrón de `localStorage` que `extras.html`, pero con sus propias keys `enemigos_usuario`/`enemigos_clave` para no compartir sesión con Extras). A diferencia de `extras.html` (que tiene un array `PERSONAJES_EXTRA` hardcodeado), acá NO hay ningún índice separado: la página arma la lista escaneando `localStorage` en busca de keys que empiecen con `enemigo_` y parseando cada una — así se evita que un índice y los datos reales se desincronicen. Cada enemigo es una card que linkea a `enemigo.html?id=<id>`, más una card "+ Agregar" (dashed, estilo `.personaje-card.btn-agregar`) que abre el modal de creación.

El modal de creación pide: Nombre, **Ícono** (`select` con ~30 emojis curados por arquetipo de monstruo — dragón, no-muerto, bestia, elemental, humanoide, etc. — más una opción "🖊️ Personalizado..." al fondo que revela un campo de texto libre; antes era un campo de texto suelto y todos los enemigos terminaban usando el mismo 👹 fijo, así que se armó el desplegable para que sea rápido elegir algo distinto por monstruo sin tener que salir a buscar el emoji), Vida, CA, Velocidad (texto libre, ej. "30ft"), Iniciativa, y los 6 modificadores de habilidad (STR/DEX/CON/INT/WIS/CHA, un número con signo cada uno — no el puntaje bruto, directamente el "más o menos" ya calculado). Al mandar el form no se guarda todavía: pasa a un panel de confirmación ("¿Estás seguro?") con un resumen de los datos; "No" vuelve al form sin cerrar el modal (no descarta lo tipeado), "Sí" recién ahí genera el id (`slugify(nombre) + '_' + timestamp-en-base36`, para evitar colisiones si hay dos enemigos con el mismo nombre) y escribe el registro en `localStorage["enemigo_<id>"]`. El ícono elegido es también lo que se muestra en la card del roster.

**Modelo de datos** (un solo blob JSON por enemigo, sin diffear contra nada — a diferencia de los personajes jugables, que usan `STORAGE_PREFIX = pj_<id>_` con muchas keys chicas diffeadas contra su JSON estático):

```json
{
  "id": "goblin_jefe_kx3f9a",
  "nombre": "Goblin Jefe",
  "icono": "👺",
  "vidaMaxima": 21, "vidaActual": 21,
  "caBase": 17, "caActual": 17,
  "velocidad": "30ft",
  "iniciativa": 2,
  "mods": { "STR": 0, "DEX": 2, "CON": 1, "INT": -1, "WIS": 0, "CHA": 1 },
  "habilidades": [
    {
      "nombre": "Mordisco", "bonoAtaque": 4, "alcance": "cuerpo a cuerpo 5 ft",
      "danos": [
        { "cantidad": 1, "dado": "6", "extra": 2, "tipoDano": "perforante" }
      ],
      "desc": "Ataque de mordisco.",
      "efectoAdicional": "El objetivo debe superar TS de FUE o cae Derribado."
    }
  ],
  "acciones": [ "..." ],
  "accionesBonus": [ "..." ],
  "reacciones": [ "..." ],
  "accionesLegendarias": [ "..." ]
}
```

Cada entrada dentro de las 5 listas es un objeto con: `nombre`, `bonoAtaque` (número o `null` si no aplica), `alcance` (texto libre, ej. "alcance 30/120 ft"), `danos` (**array**, no un solo set de campos — un ataque puede tener más de un tipo de daño, ej. un aliento que hace fuego Y necrótico en el mismo golpe; cada elemento es `{ cantidad, dado, extra, tipoDano }`, donde `dado` es el string del número nada más, ej. `"6"` — nunca `"d6"` — limitado a 4/6/8/10/12, que son los tamaños de dado que pidió el usuario), `desc` (descripción/efecto general) y `efectoAdicional` (rider opcional, ej. una tirada de salvación con su efecto). El render arma cada badge de daño como `AdB+C tipoDaño` (ahí sí con la "d" en el medio, es solo el formato de visualización). El modal de creación arranca con un solo bloque de daño visible; tildando el checkbox "+ Más daño" aparece un segundo bloque idéntico, y si el usuario lo completa se agrega un segundo elemento al array `danos`. Entradas viejas guardadas con el esquema plano anterior (`danoCantidad`/`danoDado`/`danoExtra`/`tipoDano` sueltos, o incluso solo `nombre`/`desc` de la primerísima versión) se siguen leyendo bien — `normalizarDanos()` en `enemigo.js` convierte cualquiera de los dos formatos viejos a un array de un elemento antes de renderizar.

**`enemigo.html` / `enemigo.js`** — hoja individual (`?id=<id>`; si el id no existe en `localStorage`, redirige a `enemigos.html`). No pide login propio (igual que `personaje.html`, que tampoco lo pide — la seguridad ya la dio el login de `enemigos.html` para llegar a la lista). **Importante: `enemigo.js` es un script CLÁSICO, sin `type="module"`** — a diferencia de `script.js` (que sí lo necesita porque importa de `Scripts/Core/` y `Scripts/Datos/`), `enemigo.js` no importa nada, así que no hay motivo para pagar el costo de que sea un módulo ES. Esto importa porque los módulos ES quedan bloqueados por CORS cuando el HTML se abre directo por doble click (`file://` — el mismo error que ya se había visto con Chiaragorn); en la primera versión de este archivo quedó puesto `type="module"` por costumbre/copia de `personaje.html`, lo cual rompía TODA la hoja (nada renderizaba, ningún botón respondía, incluido "Borrar enemigo") apenas se abría sin servidor. Ya está corregido y probado con tests automatizados end-to-end abriendo el archivo vía `file://` — el más reciente cubre: crear enemigo con ícono del desplegable → crear otro con ícono personalizado → entrar a la hoja → abrir "+ Agregar" → confirmar que el `select` de dado solo tiene 4/6/8/10/12 (sin la "d") → tildar "+ Más daño" y cargar una entrada con 2 daños distintos → verificar que quedó guardada como array `danos` de 2 elementos → abrir el menú "Acción" → verificar que lista la entrada → tocarla → verificar que el modal de detalle muestra ambos badges de daño, el bono de ataque y el alcance → borrarla desde ahí vía el modal de confirmación propio (sin que se dispare ningún `confirm()`/`alert()` nativo del navegador) → borrar el enemigo entero de la misma forma → confirmar que desaparece de `localStorage` y redirige. Todos los pasos pasan sin errores de consola.

Estructura de la hoja, de arriba a abajo:

- **Header**: ícono clickeable (abre un modal de cambio de ícono — mismo `select` curado + opción personalizada que usa el modal de creación en `enemigos.html`) + nombre, y a la derecha el botón "🗑️ Borrar enemigo" (abre el modal de confirmación propio, no un `alert()`/`confirm()` nativo — ver más abajo).
- **Estadísticas**: 4 tiles clickeables (mismo look `.skill-btn`/`.skill-mod` que usa `script.js` en las hojas de jugador). Vida abre un modal con barra de color por umbral (verde >50%, amarillo 25-50%, rojo ≤25%, igual que `combate.js`) y botones ±1/±5 HP más ±1 Vida Máx. CA abre un modal con ±1 y un botón "Restaurar valor original" (vuelve a `caBase`, igual que `combate.js`). Velocidad e Iniciativa abren un modal genérico de un solo campo de texto.
- **Modificadores**: 6 tiles de solo lectura (STR a CHA, formato con signo).
- **Menú "Habilidades y Acciones"**: reemplaza lo que antes eran 5 secciones colapsables mostrando todo el texto de cada entrada de una — ahora es, como pidió el usuario, "el botón de menú como los personajes": 5 tiles (`.skill-btn`, con un badge numérico de cuántas entradas tiene cada uno) — Habilidad/Pasiva, Acción, Acción Adicional, Reacción, Acción Legendaria. Tocar un tile abre `#lista-modal`, que lista todas las entradas de esa categoría como filas clickeables (nombre + badge del primer daño si tiene). Tocar una fila cierra esa lista y abre `#detalle-modal` con el nombre, todos los badges (bono de ataque en verde, alcance en marrón, un badge violeta por cada elemento de `danos`), la descripción y, si tiene, el efecto adicional — y ahí mismo un botón "🗑️ Borrar" para esa entrada puntual. Este es exactamente el mismo patrón de dos modales que ya usa la hoja de jugador para "¿Qué puedo usar con mi Acción/Bonus/Reacción/Objeto?" (`abrirModalRecursosPorTipo`/`recolectarRecursosPorTipo` en `script.js`, línea ~2790) — se replicó la misma UX para que sea consistente entre personajes y enemigos.
- Debajo del menú, un único botón grande **"+ Agregar"** (uno solo para las 5 categorías, no uno por sección) que abre `#entrada-modal` con: un **desplegable "Tipo"** (decide a qué array va la entrada), Nombre, "Bono al d20 (ataque)" (número, opcional — el nombre del campo se acortó a propósito para que quede claro de un vistazo que es lo que se suma a una tirada de 1d20 de ataque, sin tener que leer un párrafo), Alcance/Rango, el bloque de daño A/B/C (dado limitado a 4/6/8/10/12, mostrados en el `select` como el número solo) + Tipo de Daño, el checkbox "+ Más daño" que revela un segundo bloque A/B/C idéntico para armar un `danos` de 2 elementos, Descripción y Efecto Adicional.
- **Modal de confirmación genérico** (`#confirmar-modal`): reemplaza todo uso de `confirm()`/`alert()` nativos del navegador en esta sección — se usa tanto para borrar una entrada individual como para borrar el enemigo entero. A propósito NO tiene botón de cerrar (×) ni se cierra clickeando afuera del modal — obliga a elegir "Sí, borrar" o "No" explícitamente, mismo criterio que ya usaba `#detalle-modal` en `combate.html` para no cerrarse por accidente.

Todo el estado (ícono, vida actual, CA actual, velocidad, iniciativa, y las 5 listas) persiste en la misma key `enemigo_<id>` en `localStorage`, reescribiendo el blob completo en cada cambio (no hay noción de "valor original" separado del guardado, salvo `caBase` que se preserva aparte de `caActual` para el botón de restaurar).

El menú público (`index.html`) tiene una card "🐉 Enemigos" al lado de "🔒 Extras" que linkea a `enemigos.html`.
