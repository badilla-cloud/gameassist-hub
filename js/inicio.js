/* ==========================================================
   GameAssist Hub – Página de inicio
   - Portadas, estadísticas y comunidades destacadas desde JSON
   - Pestañas interactivas con los tipos de publicación
   ========================================================== */

// Contenido de cada pestaña (cuándo usar cada tipo de publicación)
const INFO_TIPOS = {
  error: {
    titulo: "Error",
    texto: "Úsalo cuando el juego no funciona como debería.",
    ejemplos: [
      "El juego se cierra o se congela en cierta zona.",
      "Una misión no avanza aunque cumpliste los pasos.",
      "Problemas de rendimiento en una plataforma específica."
    ]
  },
  "easter-egg": {
    titulo: "Easter egg",
    texto: "Úsalo para compartir secretos, referencias ocultas o curiosidades.",
    ejemplos: [
      "Un nombre o acción que activa un efecto escondido.",
      "Una zona secreta difícil de encontrar.",
      "Referencias a otros juegos o a la cultura popular."
    ]
  },
  pregunta: {
    titulo: "Pregunta",
    texto: "Úsalo cuando necesitas que la comunidad te oriente.",
    ejemplos: [
      "¿Dónde consigo cierta habilidad u objeto?",
      "¿Cómo derroto a un jefe complicado?",
      "¿Qué requisito falta para desbloquear algo?"
    ]
  }
};

const COLORES_TIPO = { error: "--tipo-error", "easter-egg": "--tipo-egg", pregunta: "--tipo-pregunta" };

document.addEventListener("DOMContentLoaded", function () {
  iniciarPestanas();
  cargarContenidoDinamico();
});

/* ---------- Pestañas (interacción inmediata sin recargar) ---------- */
function iniciarPestanas() {
  const pestanas = document.querySelectorAll(".tab");
  pestanas.forEach(function (pestana) {
    pestana.addEventListener("click", function () {
      pestanas.forEach(function (p) {
        p.setAttribute("aria-selected", "false");
      });
      pestana.setAttribute("aria-selected", "true");
      mostrarPanelTipo(pestana.dataset.tipo, pestana.id);
    });
  });
  mostrarPanelTipo("error", "tab-error");
}

function mostrarPanelTipo(tipo, idPestana) {
  const panel = document.getElementById("panel-tipo");
  const info = INFO_TIPOS[tipo];

  panel.setAttribute("aria-labelledby", idPestana);
  panel.style.borderTopColor = "var(" + COLORES_TIPO[tipo] + ")";
  panel.innerHTML =
    "<h3>" + info.titulo + "</h3>" +
    "<p>" + info.texto + "</p>" +
    "<ul>" + info.ejemplos.map(function (e) { return "<li>" + e + "</li>"; }).join("") + "</ul>";

  // Reinicia la animación de aparición
  panel.style.animation = "none";
  void panel.offsetWidth;
  panel.style.animation = "";
}

/* ---------- Datos desde JSON ---------- */
async function cargarContenidoDinamico() {
  const zonaStats = document.getElementById("stats-inicio");
  const zonaDestacados = document.getElementById("destacados");
  const zonaPortadas = document.getElementById("portadas-inicio");

  try {
    const juegos = await cargarJuegos();
    const ordenados = ordenarPorActividad(juegos);
    pintarPortadas(ordenados.slice(0, 6), zonaPortadas);
    pintarEstadisticas(juegos, zonaStats);
    pintarDestacados(ordenados.slice(0, 3), zonaDestacados);
  } catch (error) {
    console.error(error);
    const mensaje = '<p class="mensaje mensaje--error">No se pudieron cargar los juegos. Intenta recargar la página.</p>';
    zonaStats.innerHTML = mensaje;
    zonaDestacados.innerHTML = mensaje;
  }
}

// Ordena de mayor a menor cantidad de publicaciones
function ordenarPorActividad(juegos) {
  return juegos.slice().sort(function (a, b) {
    return obtenerPublicaciones(b).length - obtenerPublicaciones(a).length;
  });
}

function pintarPortadas(juegos, zona) {
  zona.innerHTML = "";
  juegos.forEach(function (juego) {
    const img = document.createElement("img");
    img.alt = "Portada de " + juego.nombre;
    img.width = 640;
    img.height = 360;
    prepararImagen(img, juego);
    zona.appendChild(img);
  });
}

function pintarEstadisticas(juegos, zona) {
  // Conteos calculados a partir de los datos
  const generos = new Set(juegos.map(function (j) { return j.genero; }));
  const plataformas = new Set();
  juegos.forEach(function (j) {
    j.plataformas.forEach(function (p) { plataformas.add(p); });
  });
  const totalPublicaciones = juegos.reduce(function (suma, j) {
    return suma + obtenerPublicaciones(j).length;
  }, 0);

  const datos = [
    { numero: juegos.length, texto: "videojuegos" },
    { numero: generos.size, texto: "géneros" },
    { numero: plataformas.size, texto: "plataformas" },
    { numero: totalPublicaciones, texto: "publicaciones" }
  ];

  zona.innerHTML = datos.map(function (d) {
    return '<div class="stat"><span class="stat__numero">' + d.numero +
      '</span><span class="stat__texto">' + d.texto + "</span></div>";
  }).join("");
}

function pintarDestacados(top, zona) {
  zona.innerHTML = "";
  top.forEach(function (juego) {
    zona.appendChild(crearTarjetaJuego(juego, false));
  });

  // Delegación de eventos: entrar a la comunidad o marcar favorito
  zona.addEventListener("click", function (evento) {
    const fav = evento.target.closest("button[data-fav]");
    if (fav) {
      const id = Number(fav.dataset.fav);
      const ahora = alternarFavorito(id);
      pintarBotonFavorito(fav, ahora);
      mostrarToast(ahora ? "Agregado a favoritos." : "Quitado de favoritos.", ahora ? "exito" : "info");
      return;
    }
    const boton = evento.target.closest("button[data-id]");
    if (boton) entrarAComunidad(Number(boton.dataset.id), boton);
  });
}
