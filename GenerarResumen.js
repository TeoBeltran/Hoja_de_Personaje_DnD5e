const btn = document.getElementById("gr-btnGenerar");
const btnDescargar = document.getElementById("gr-btnDescargar");
const estado = document.getElementById("gr-estado");
const contenedor = document.getElementById("gr-contenedorResumen");
const template = document.getElementById("gr-templatePersonaje");

let resumenJSON = [];

btn.addEventListener("click", generarResumen);
btnDescargar.addEventListener("click", descargarResumen);

async function leerJSON(ruta){

    const r = await fetch(ruta);

    if(!r.ok){

        throw new Error(ruta);

    }

    return await r.json();

}

function agregarLista(ul, lista, seccion){

    lista=[...new Set(lista)];

    if(lista.length===0){

        seccion.classList.add("gr-oculto");

        return;

    }

    seccion.classList.remove("gr-oculto");

    ul.innerHTML="";

    lista.sort();

    lista.forEach(nombre=>{

        const li=document.createElement("li");

        li.textContent=nombre;

        ul.appendChild(li);

    });

}

function obtenerNivel(datos){

    if(!Array.isArray(datos.estadisticas))
        return "";

    const nivel=datos.estadisticas.find(x=>x.nombre==="Nivel");

    return nivel?nivel.valor:"";

}

function detectarASI(personaje){

    if(!personaje.stats)
        return "Desconocido";

    const s=personaje.stats;

    const total=
        coste(s.STR)+
        coste(s.DEX)+
        coste(s.CON)+
        coste(s.INT)+
        coste(s.WIS)+
        coste(s.CHA);

    if(total>27)
        return "✔ Probablemente sí";

    if(total===27)
        return "Sin detectar";

    return "Revisar";

}

function coste(v){

    switch(v){

        case 8:return 0;
        case 9:return 1;
        case 10:return 2;
        case 11:return 3;
        case 12:return 4;
        case 13:return 5;
        case 14:return 7;
        case 15:return 9;

        default:return 9;

    }

}

async function generarResumen(){

    btn.disabled=true;
    btnDescargar.disabled=true;

    estado.textContent="Leyendo personajes...";

    contenedor.innerHTML = "";
    resumenJSON = [];

    try{

        const personajes=await leerJSON("personajes/personajes.json");

        for(const nombre of personajes){

            const datos=await leerJSON(`personajes/${nombre}.json`);

            crearFicha(datos);

        }

        estado.textContent=`${personajes.length} personajes cargados.`;

        btnDescargar.disabled=false;

    }

    catch(e){

        console.error(e);

        estado.textContent="Error leyendo archivos.";

    }

    btn.disabled=false;

}

function descargarResumen(){

    const datos = {

        fechaGeneracion: new Date().toISOString(),

        cantidad: resumenJSON.length,

        personajes: resumenJSON

    };

    const blob = new Blob(
        [JSON.stringify(datos, null, 4)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = "ResumenPersonajes.json";

    a.click();

    URL.revokeObjectURL(url);

}

function crearFicha(datos){

    const ficha = template.content.cloneNode(true);

    const personaje = datos.personaje ?? {};

    ficha.querySelector(".gr-nombre").textContent =
        personaje.nombre ?? "Sin nombre";

    ficha.querySelector(".gr-raza").textContent =
        personaje.raza ?? "-";

    const nivel = obtenerNivel(datos);

    ficha.querySelector(".gr-clase").textContent =
        nivel
        ? `${personaje.clase} ${nivel}`
        : personaje.clase ?? "-";

    const sub = ficha.querySelector(".gr-subclase");

    if(personaje.subclase){

        sub.textContent = personaje.subclase;

    }
    else{

        sub.remove();

    }

    ficha.querySelector(".gr-asi").textContent =
        detectarASI(personaje);

    /* ===========================
       STATS
    =========================== */

    const statsDiv = ficha.querySelector(".gr-stats");

    if(personaje.stats){

        const orden = [
            "STR",
            "DEX",
            "CON",
            "INT",
            "WIS",
            "CHA"
        ];

        orden.forEach(stat=>{

            const caja=document.createElement("div");

            caja.className="gr-stat";

            caja.innerHTML=`
                <strong>${stat}</strong>
                <span>${personaje.stats[stat]}</span>
            `;

            statsDiv.appendChild(caja);

        });

    }

    /* ===========================
       RASGOS
    =========================== */

    const rasgos=[];

    if(Array.isArray(datos.rasgos)){

        datos.rasgos.forEach(r=>{

            if(r.nombre)
                rasgos.push(r.nombre);

        });

    }

    if(datos.background?.habilidades){

        datos.background.habilidades.forEach(h=>{

            if(h.nombre)
                rasgos.push(h.nombre);

        });

    }

    /* ===========================
       HABILIDADES
    =========================== */

    const habilidades=[];

    if(Array.isArray(datos.habilidadesUso)){

        datos.habilidadesUso.forEach(h=>{

            if(h.nombre)
                habilidades.push(h.nombre);

        });

    }

    /* ===========================
       EQUIPO
    =========================== */

    const equipo=[];

    if(Array.isArray(datos.equipo)){

        datos.equipo.forEach(e=>{

            if(!e.nombre)
                return;

            if(e.esArmadura){

                equipo.push(e.nombre);

                return;

            }

            if(
                e.dano ||
                e.tipoDano ||
                e.accion
            ){

                equipo.push(e.nombre);

            }

        });

    }

    /* ===========================
       HECHIZOS
    =========================== */

    const hechizos=[];

    if(datos.hechizos?.lista){

        datos.hechizos.lista.forEach(h=>{

            if(h.nombre)
                hechizos.push(h.nombre);

        });

    }

    agregarLista(
        ficha.querySelector(".gr-secRasgos ul"),
        rasgos,
        ficha.querySelector(".gr-secRasgos")
    );

    agregarLista(
        ficha.querySelector(".gr-secHab ul"),
        habilidades,
        ficha.querySelector(".gr-secHab")
    );

    agregarLista(
        ficha.querySelector(".gr-secEquipo ul"),
        equipo,
        ficha.querySelector(".gr-secEquipo")
    );

    agregarLista(
        ficha.querySelector(".gr-secHechizos ul"),
        hechizos,
        ficha.querySelector(".gr-secHechizos")
    );

    contenedor.appendChild(ficha);

    /* ===========================
    JSON DESCARGA
    =========================== */

    resumenJSON.push({

        ...datos,

        resumen: {

            nivel,

            asi: detectarASI(personaje),

            rasgos,

            habilidades,

            equipo,

            hechizos

        }

    });

}

