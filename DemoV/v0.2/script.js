const modal = document.getElementById('skill-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const closeBtn = document.querySelector('.close-btn');

async function init() {
    const response = await fetch('datos.json');
    const data = await response.json(); // Usamos 'data' aquí

    const createBtn = (item) => {
        const btn = document.createElement('button');
        btn.className = `skill-btn ${item.proficiente ? 'proficient' : ''}`;
        btn.innerHTML = `<span>${item.nombre}</span> ${item.valor ? `<span class="skill-mod">${item.valor}</span>` : ''}`;
        if (item.desc) {
            btn.addEventListener('click', () => {
                modalTitle.textContent = item.nombre;
                modalDesc.textContent = item.desc;
                modal.style.display = 'flex';
            });
        }
        return btn;
    };

    const sG = document.getElementById('stats-grid');
    const mG = document.getElementById('mods-grid');
    const vG = document.getElementById('saves-grid');
    const skG = document.getElementById('skills-grid');
    const rG = document.getElementById('rasgos-grid'); // Nuevo contenedor

    data.estadisticas.forEach(i => sG.appendChild(createBtn(i)));
    data.modificadores.forEach(i => mG.appendChild(createBtn(i)));
    data.salvaciones.forEach(i => vG.appendChild(createBtn(i)));
    data.habilidades.forEach(i => skG.appendChild(createBtn(i)));

    // Ahora usamos 'data' correctamente aquí:
    data.rasgos.forEach(i => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.style.flexDirection = 'column'; 
        btn.style.alignItems = 'flex-start';
        btn.style.height = 'auto';

        // Usamos .replace(/\n/g, '<br>') para convertir los saltos del JSON en HTML
        btn.innerHTML = `
            <span style="font-weight: bold; margin-bottom: 5px;">${i.nombre}</span>
            <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${i.desc.replace(/\n/g, '<br>')}</span>
        `;
        
        btn.onclick = () => {
            modalTitle.innerHTML = i.nombre; // Cambiado de textContent a innerHTML
            modalDesc.innerHTML = i.desc.replace(/\n/g, '<br>'); 
            modal.style.display = 'flex';
        };
        document.getElementById('rasgos-grid').appendChild(btn);
    });

    // Carga de Equipo
    data.equipo.forEach(i => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.style.flexDirection = 'column'; 
        btn.style.alignItems = 'flex-start';
        btn.style.height = 'auto';
        
        btn.innerHTML = `
            <span style="font-weight: bold; margin-bottom: 5px;">${i.nombre}</span>
            <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${i.desc.replace(/\n/g, '<br>')}</span>
        `;
        
        btn.onclick = () => {
            modalTitle.innerHTML = i.nombre; // Cambiado de textContent a innerHTML
            modalDesc.innerHTML = i.desc.replace(/\n/g, '<br>');
            modal.style.display = 'flex';
        };
        document.getElementById('equipo-grid').appendChild(btn);
    });

    // Renderizar Ranuras (Grid de 4)
    const ranurasG = document.getElementById('ranuras-grid');
    data.hechizos.ranuras.forEach(i => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.style.textAlign = 'center'; // Centramos texto para las ranuras
        btn.innerHTML = `<span style="font-size: 0.8rem; display:block;">${i.nivel}</span><span style="font-weight:bold;">${i.cantidad}</span>`;
        ranurasG.appendChild(btn);
    });

    // Renderizar Lista de Hechizos (Estilo Rasgos/Armas)
    const contenedorHechizos = document.getElementById('hechizos-contenedor');
    const niveles = ["CANTRIPS", "NIVEL 1", "NIVEL 2", "NIVEL 3"];

    niveles.forEach(lvl => {
        // Crear título de nivel
        const h4 = document.createElement('h4');
        h4.textContent = lvl;
        h4.style.color = "var(--accent-color)";
        h4.style.marginBottom = "5px";
        contenedorHechizos.appendChild(h4);

        // Crear grid para este nivel
        const grid = document.createElement('div');
        grid.className = 'skills-grid';
        grid.style.gridTemplateColumns = '1fr';
        grid.style.marginBottom = '15px';
        contenedorHechizos.appendChild(grid);

        // Filtrar y crear botones
        data.hechizos.lista.filter(h => h.nivel === lvl).forEach(h => {
            const btn = document.createElement('button');
            btn.className = 'skill-btn';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'flex-start';
            btn.style.height = 'auto';
            btn.innerHTML = `
                <span style="font-weight: bold; margin-bottom: 5px;">${h.nombre}</span>
                <span style="font-size: 0.9rem; color: var(--text-muted); text-align: left;">${h.desc.replace(/\n/g, '<br>')}</span>
            `;
            btn.onclick = () => {
                modalTitle.innerHTML = h.nombre; // Cambiado de textContent a innerHTML
                modalDesc.innerHTML = h.desc.replace(/\n/g, '<br>');
                modal.style.display = 'flex';
            };
            grid.appendChild(btn);
        });
    });
}

closeBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

document.getElementById('download-pdf').addEventListener('click', () => {
    const element = document.querySelector('.container');
    const opt = {
        margin:       0.5,
        filename:     'Hoja_Personaje.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, letterRendering: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
});

document.addEventListener('DOMContentLoaded', init);