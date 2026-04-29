// Guardar formulario de contacto
document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const mensaje = document.getElementById('mensaje').value;
    
    // Obtener mensajes anteriores
    let mensajes = JSON.parse(localStorage.getItem('mensajesContacto')) || [];
    
    // Agregar nuevo mensaje con fecha
    const nuevoMensaje = {
        id: Date.now(),
        nombre: nombre,
        email: email,
        mensaje: mensaje,
        fecha: new Date().toLocaleString('es-ES')
    };
    
    mensajes.push(nuevoMensaje);
    
    // Guardar en localStorage
    localStorage.setItem('mensajesContacto', JSON.stringify(mensajes));
    
    // Mostrar mensaje de éxito
    const mensajeExito = document.getElementById('mensajeExito');
    mensajeExito.style.display = 'block';
    setTimeout(() => {
        mensajeExito.style.display = 'none';
    }, 3000);
    
    // Limpiar formulario
    this.reset();
});

// Ver todos los mensajes guardados
function verMensajes() {
    let mensajes = JSON.parse(localStorage.getItem('mensajesContacto')) || [];
    
    if (mensajes.length === 0) {
        alert('No hay mensajes guardados');
        return;
    }
    
    let html = '📧 MENSAJES GUARDADOS\n' + '='.repeat(50) + '\n\n';
    
    mensajes.forEach((msg, index) => {
        html += `${index + 1}. NOMBRE: ${msg.nombre}\n`;
        html += `   EMAIL: ${msg.email}\n`;
        html += `   MENSAJE: ${msg.mensaje}\n`;
        html += `   FECHA: ${msg.fecha}\n`;
        html += `   ${'-'.repeat(50)}\n\n`;
    });
    
    alert(html);
}

// Función para descargar mensajes como JSON
function descargarMensajes() {
    let mensajes = JSON.parse(localStorage.getItem('mensajesContacto')) || [];
    const dataStr = JSON.stringify(mensajes, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mensajes-contacto.json';
    link.click();
}