const btn = document.getElementById("gr-btnGenerar");
const estado = document.getElementById("gr-estado");
const contenedor = document.getElementById("gr-contenedorResumen");
const template = document.getElementById("gr-templatePersonaje");

btn.addEventListener("click", generarResumen);

async function leerJSON(ruta){

    const r = await fetch(ruta);

    if(!r.ok){

        throw new Error(ruta);

    }

    return await r.json();

}

function agregarLista(ul, lista, seccion){

    lista = [...new Set(lista)];

    if(lista.length==0){

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

    const nivel=datos.estadisticas.find(x=>x.nombre=="Nivel");

    if(!nivel)
        return "";

    return nivel.valor;

}

async function generarResumen(){

    btn.disabled=true;

    estado.textContent="Leyendo personajes...";

    contenedor.innerHTML="";

    try{

        const personajes=await leerJSON("personajes/personajes.json");

        for(const nombre of personajes){

            const datos=await leerJSON(`personajes/${nombre}.json`);

            crearFicha(datos);

        }

        estado.textContent=`${personajes.length} personajes cargados.`;

    }

    catch(e){

        console.error(e);

        estado.textContent="Error leyendo archivos.";

    }

    btn.disabled=false;

}

function crearFicha(datos){

    const ficha=template.content.cloneNode(true);

    const personaje=datos.personaje??{};

    ficha.querySelector(".gr-nombre").textContent=
        personaje.nombre??"Sin nombre";

    ficha.querySelector(".gr-raza").textContent=
        personaje.raza??"-";

    const nivel=obtenerNivel(datos);

    ficha.querySelector(".gr-clase").textContent=
        nivel
        ?`${personaje.clase} ${nivel}`
        :personaje.clase??"-";

    const sub=ficha.querySelector(".gr-subclase");

    if(personaje.subclase){

        sub.textContent=personaje.subclase;

    }
    else{

        sub.remove();

    }

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

    const habilidades=[];

    if(Array.isArray(datos.habilidadesUso)){

        datos.habilidadesUso.forEach(h=>{

            if(h.nombre)
                habilidades.push(h.nombre);

        });

    }

    const equipo=[];

    if(Array.isArray(datos.equipo)){

        datos.equipo.forEach(e=>{

            if(!e.nombre)
                return;

            if(e.esArmadura){

                equipo.push("🛡️ "+e.nombre);

                return;

            }

            if(
                e.dano||
                e.tipoDano||
                e.accion
            ){

                equipo.push("⚔️ "+e.nombre);

            }

        });

    }

    const hechizos=[];

    if(datos.hechizos?.lista){

        datos.hechizos.lista.forEach(h=>{

            if(h.nombre){

                hechizos.push("✨ "+h.nombre);

            }

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

}

