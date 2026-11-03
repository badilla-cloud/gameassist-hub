/* ==========================================================
   GameAssist Hub – Funciones comunes a las tres páginas
   (menú responsivo, JSON, localStorage, tarjetas, favoritos,
   notificaciones y diálogo de confirmación)
   ========================================================== */

// Claves usadas en localStorage
const CLAVE_PUBLICACIONES = "gah_publicaciones"; // { idJuego: [publicaciones] }
const CLAVE_JUEGO_SELECCIONADO = "gah_juegoSeleccionado"; // id del juego elegido
const CLAVE_ALIAS = "gah_alias"; // último alias usado por el usuario
const CLAVE_FAVORITOS = "gah_favoritos"; // [ids de juegos favoritos]

// Etiquetas legibles para cada tipo de publicación
const TIPOS = {
  error: { nombre: "Error", plural: "Errores" },
  "easter-egg": { nombre: "Easter egg", plural: "Easter eggs" },
  pregunta: { nombre: "Pregunta", plural: "Preguntas" }
};

/* ---------- Carga del archivo JSON ---------- */
async function cargarJuegos() {
  const respuesta = await fetch("data/juegos.json");
  if (!respuesta.ok) {
    throw new Error("No se pudo cargar juegos.json (" + respuesta.status + ")");
  }
  return respuesta.json();
}

/* ---------- localStorage: lectura y escritura segura ---------- */
function leerStorage(clave, valorPorDefecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto === null ? valorPorDefecto : JSON.parse(texto);
  } catch (error) {
    console.warn("No se pudo leer " + clave, error);
    return valorPorDefecto;
  }
}

function guardarStorage(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    mostrarToast("No se pudo guardar en el navegador.", "error");
    return false;
  }
}

/* Devuelve las publicaciones de un juego.
   Si el usuario nunca ha entrado a esa comunidad, se usan las
   publicaciones de ejemplo que vienen en el JSON. */
function obtenerPublicaciones(juego) {
  const todas = leerStorage(CLAVE_PUBLICACIONES, {});
  if (Array.isArray(todas[juego.id])) {
    return todas[juego.id];
  }
  return (juego.publicaciones || []).map(function (p) {
    return Object.assign({}, p, { propia: false });
  });
}

function guardarPublicaciones(idJuego, publicaciones) {
  const todas = leerStorage(CLAVE_PUBLICACIONES, {});
  todas[idJuego] = publicaciones;
  return guardarStorage(CLAVE_PUBLICACIONES, todas);
}

function guardarJuegoSeleccionado(idJuego) {
  guardarStorage(CLAVE_JUEGO_SELECCIONADO, idJuego);
}

function obtenerJuegoSeleccionado() {
  return leerStorage(CLAVE_JUEGO_SELECCIONADO, null);
}

/* ---------- Favoritos (marcar / desmarcar juegos) ---------- */
function obtenerFavoritos() {
  const favoritos = leerStorage(CLAVE_FAVORITOS, []);
  return Array.isArray(favoritos) ? favoritos : [];
}

function esFavorito(idJuego) {
  return obtenerFavoritos().includes(idJuego);
}

// Agrega o quita un juego de favoritos y devuelve el nuevo estado
function alternarFavorito(idJuego) {
  let favoritos = obtenerFavoritos();
  const yaEsta = favoritos.includes(idJuego);

  if (yaEsta) {
    favoritos = favoritos.filter(function (id) { return id !== idJuego; });
  } else {
    favoritos.push(idJuego);
  }
  guardarStorage(CLAVE_FAVORITOS, favoritos);
  return !yaEsta;
}

/* ---------- Utilidades ---------- */

// Evita que el texto escrito por el usuario se interprete como HTML
function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}

// Quita tildes y pasa a minúsculas para comparar búsquedas
function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function formatearFecha(iso) {
  const fecha = new Date(iso);
  return fecha.toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function claseEstado(estado) {
  return estado === "En actualizaciones" ? "chip--estado-activo" : "chip--estado-completo";
}

function plural(cantidad, singular, varios) {
  return cantidad + " " + (cantidad === 1 ? singular : varios);
}

/* Si la portada real (img/portadas/*.jpg) no existe,
   se muestra la imagen de respaldo en SVG. */
function prepararImagen(img, juego) {
  img.addEventListener("error", function alFallar() {
    img.removeEventListener("error", alFallar);
    if (juego.imagenRespaldo) img.src = juego.imagenRespaldo;
  });
  img.src = juego.imagen;
}

/* ---------- Tarjeta de juego (usada en inicio y catálogo) ---------- */
function crearTarjetaJuego(juego, esUltimaVisitada) {
  const total = obtenerPublicaciones(juego).length;
  const favorito = esFavorito(juego.id);

  const tarjeta = document.createElement("article");
  tarjeta.className = "juego-card" + (esUltimaVisitada ? " juego-card--ultima" : "");
  tarjeta.innerHTML =
    '<div class="juego-card__img">' +
      '<img alt="Portada de ' + escaparHTML(juego.nombre) + '" loading="lazy" width="640" height="360">' +
      (esUltimaVisitada ? '<span class="juego-card__marca">Última visitada</span>' : "") +
      '<button class="btn-fav" type="button" data-fav="' + juego.id + '" aria-pressed="' + favorito + '" ' +
        'aria-label="' + (favorito ? "Quitar de favoritos" : "Agregar a favoritos") + '" title="' +
        (favorito ? "Quitar de favoritos" : "Agregar a favoritos") + '">' + (favorito ? "★" : "☆") + "</button>" +
    "</div>" +
    '<div class="juego-card__cuerpo">' +
      '<h3 class="juego-card__titulo">' + escaparHTML(juego.nombre) + "</h3>" +
      '<p class="juego-card__meta">' + escaparHTML(juego.genero) + " · " + juego.anio + " · " + escaparHTML(juego.desarrollador) + "</p>" +
      '<p class="juego-card__plataformas">' + escaparHTML(juego.plataformas.join(", ")) + "</p>" +
      '<div class="juego-card__pie">' +
        '<div class="juego-card__fila">' +
          '<span class="chip ' + claseEstado(juego.estado) + '">' + escaparHTML(juego.estado) + "</span>" +
          '<span class="juego-card__contador">' + plural(total, "publicación", "publicaciones") + "</span>" +
        "</div>" +
        '<button class="btn btn--secundario btn--bloque" type="button" data-id="' + juego.id + '">Entrar a la comunidad</button>' +
      "</div>" +
    "</div>";

  prepararImagen(tarjeta.querySelector("img"), juego);
  return tarjeta;
}

/* Actualiza el botón de favorito sin volver a pintar toda la tarjeta */
function pintarBotonFavorito(boton, favorito) {
  boton.setAttribute("aria-pressed", favorito);
  boton.textContent = favorito ? "★" : "☆";
  const texto = favorito ? "Quitar de favoritos" : "Agregar a favoritos";
  boton.setAttribute("aria-label", texto);
  boton.title = texto;
  boton.classList.remove("btn-fav--pulso");
  void boton.offsetWidth; // reinicia la animación
  boton.classList.add("btn-fav--pulso");
}

/* Guarda el juego elegido y abre su comunidad */
function entrarAComunidad(idJuego, boton) {
  guardarJuegoSeleccionado(idJuego);
  if (boton) {
    boton.textContent = "Entrando…";
    boton.disabled = true;
  }
  setTimeout(function () {
    location.href = "comunidad.html";
  }, 200);
}

/* ---------- Notificaciones visuales (toast) ---------- */
function mostrarToast(mensaje, tipo) {
  let zona = document.querySelector(".toast-zona");
  if (!zona) {
    zona = document.createElement("div");
    zona.className = "toast-zona";
    zona.setAttribute("role", "status");
    zona.setAttribute("aria-live", "polite");
    document.body.appendChild(zona);
  }

  const toast = document.createElement("div");
  toast.className = "toast toast--" + (tipo || "info");
  toast.textContent = mensaje;
  zona.appendChild(toast);

  setTimeout(function () {
    toast.classList.add("toast--saliendo");
    setTimeout(function () {
      toast.remove();
    }, 300);
  }, 3200);
}

/* ---------- Diálogo de confirmación ----------
   Reemplaza al confirm() del navegador. Devuelve una promesa
   que se resuelve en true (confirmar) o false (cancelar). */
function confirmar(titulo, mensaje, textoBoton) {
  return new Promise(function (resolver) {
    const dialogo = document.createElement("dialog");
    dialogo.className = "dialogo";
    dialogo.setAttribute("aria-labelledby", "dialogo-titulo");
    dialogo.innerHTML =
      '<h2 id="dialogo-titulo" class="h3">' + escaparHTML(titulo) + "</h2>" +
      "<p>" + escaparHTML(mensaje) + "</p>" +
      '<div class="dialogo__acciones">' +
        '<button class="btn btn--secundario" type="button" value="no">Cancelar</button>' +
        '<button class="btn btn--peligro-solido" type="button" value="si">' + escaparHTML(textoBoton || "Confirmar") + "</button>" +
      "</div>";
    document.body.appendChild(dialogo);

    function cerrar(respuesta) {
      dialogo.close();
      dialogo.remove();
      resolver(respuesta);
    }

    dialogo.addEventListener("click", function (evento) {
      const boton = evento.target.closest("button");
      if (boton) cerrar(boton.value === "si");
      else if (evento.target === dialogo) cerrar(false); // clic fuera del cuadro
    });
    dialogo.addEventListener("cancel", function (evento) {
      evento.preventDefault(); // tecla Escape
      cerrar(false);
    });

    dialogo.showModal();
    dialogo.querySelector('button[value="no"]').focus();
  });
}

/* ---------- Menú de navegación ---------- */
function iniciarMenu() {
  const boton = document.querySelector(".nav__toggle");
  const nav = document.querySelector(".nav");
  if (!boton || !nav) return;

  boton.addEventListener("click", function () {
    const abierto = nav.classList.toggle("nav--abierto");
    boton.setAttribute("aria-expanded", abierto);
    boton.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
  });

  // Marca la página activa comparando el nombre del archivo
  const paginaActual = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__enlace").forEach(function (enlace) {
    if (enlace.getAttribute("href") === paginaActual) {
      enlace.classList.add("nav__enlace--activo");
      enlace.setAttribute("aria-current", "page");
    }
  });

  // Año actual en el pie de página
  const anio = document.getElementById("anio-actual");
  if (anio) anio.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", iniciarMenu);
