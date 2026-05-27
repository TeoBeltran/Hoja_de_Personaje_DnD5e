// Selección de elementos del DOM

const modal = document.getElementById('skill-modal');

const modalTitle = document.getElementById('modal-title');

const modalDesc = document.getElementById('modal-desc');

const closeBtn = document.querySelector('.close-btn');

const skillButtons = document.querySelectorAll('.skill-btn');

const downloadBtn = document.getElementById('download-pdf');



// Asignar evento click a cada botón de habilidad

skillButtons.forEach(button => {

    button.addEventListener('click', () => {

        // Ignorar el botón de descarga si se le diera clase, pero aquí es específico

        if (button.id === 'download-pdf') return;



        const skillName = button.getAttribute('data-skill');

        const skillDescription = button.getAttribute('data-desc');

       

        // Rellenar el modal con los datos del botón

        modalTitle.textContent = skillName;

        modalDesc.textContent = skillDescription;

       

        // Mostrar el modal

        modal.style.display = 'flex';

    });

});



// Cerrar el modal al hacer clic en la "X"

closeBtn.addEventListener('click', () => {

    modal.style.display = 'none';

});



// Cerrar el modal al hacer clic fuera del recuadro

window.addEventListener('click', (e) => {

    if (e.target === modal) {

        modal.style.display = 'none';

    }

});



// Lógica de descarga PDF

downloadBtn.addEventListener('click', () => {

    const element = document.querySelector('.container');

    const opt = {

        margin:       0.5,

        filename:     'mi-personaje-dnd.pdf',

        image:        { type: 'jpeg', quality: 0.98 },

        html2canvas:  { scale: 2 },

        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }

    };



    // Generar y descargar el PDF

    html2pdf().set(opt).from(element).save();

});