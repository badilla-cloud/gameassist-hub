/* ==========================================================
   GameAssist Hub – Página de comunidad (registro y gestión)
   - Muestra los datos del juego elegido (desde JSON + localStorage)
   - Formulario con validación en tiempo real y al enviar
   - Publicar, responder, marcar como resuelta y eliminar
   - Filtro por tipo, búsqueda en publicaciones y resumen con conteos
   - Todo se guarda en localStorage
   ========================================================== */

// Reglas de validación de cada campo
const REGLAS = {
  alias: { min: 3, max: 20, patron: /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ _-]+$/ },
  titulo: { min: 5, max: 80 },
  descripcion: { min: 15, max: 500 },
  respuesta: { min: 3, max: 300 }
};

// Estado de la página
let juegos = [];
let juegoActual = null;
let publicaciones = [];
let filtroActual = "todos";
let textoBusqueda = ""; // búsqueda dentro de las publicaciones
let respondiendoId = null; // id de la publicación con el formulario de respuesta abierto
let ultimaNuevaId = null; // para resaltar la publicación recién creada

// Referencias al DOM
const zonaComunidad = document.getElementById("zona-comunidad");
const zonaSinJuego = document.getElementById("sin-juego");
const selectorInicial = document.getElementById("selector-inicial");
const detalleJuego = document.getElementById("detalle-juego");
const resumen = document.getElementById("resumen");
const formulario = document.getElementById("form-publicacion");
const mensajeForm = document.getElementById("mensaje-form");
const listaPublicaciones = document.getElementById("lista-publicaciones");

const campos = {
  alias: document.getElementById("campo-alias"),
  tipo: document.getElementById("campo-tipo"),
  titulo: document.getElementById("campo-titulo"),
  descripcion: document.getElementById("campo-descripcion")
};

document.addEventListener("DOMContentLoaded", iniciarComunidad);

/* ==========================================================
   Carga inicial
   ========================================================== */
async function iniciarComunidad() {
  try {
    juegos = await cargarJuegos();
  } catch (error) {
    console.error(error);
    zonaSinJuego.hidden = false;
    zonaSinJuego.querySelector(".sin-juego").innerHTML =
      '<p class="mensaje mensaje--error">No se pudieron cargar los juegos. Recarga la página.</p>';
    return;
  }

  llenarSelector(selectorInicial);
  registrarEventosFormulario();
  registrarEventosLista();

  // Recupera el alias usado la última vez
  campos.alias.value = leerStorage(CLAVE_ALIAS, "");
  actualizarContador("alias");

  const idGuardado = obtenerJuegoSeleccionado();
  const juego = juegos.find(function (j) { return j.id === idGuardado; });

  if (juego) {
    abrirComunidad(juego);
  } else {
    zonaSinJuego.hidden = false;
  }

  selectorInicial.addEventListener("change", function () {
    if (selectorInicial.value) cambiarDeJuego(Number(selectorInicial.value));
  });
}

function llenarSelector(select) {
  juegos.forEach(function (j) {
    select.appendChild(new Option(j.nombre, j.id));
  });
}

function cambiarDeJuego(id) {
  const juego = juegos.find(function (j) { return j.id === id; });
  if (!juego) return;
  guardarJuegoSeleccionado(id);
  abrirComunidad(juego);
  mostrarToast("Entraste a la comunidad de " + juego.nombre + ".", "info");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function abrirComunidad(juego) {
  juegoActual = juego;
  publicaciones = obtenerPublicaciones(juego);
  filtroActual = "todos";
  respondiendoId = null;
  limpiarBusqueda();

  zonaSinJuego.hidden = true;
  zonaComunidad.hidden = false;
  document.title = juego.nombre + " | Comunidad | GameAssist Hub";
  document.getElementById("titulo-comunidad").textContent = "Comunidad de " + juego.nombre;

  limpiarFormulario(false);
  pintarDetalleJuego();
  marcarFiltro("todos");
  actualizarVista();
}

/* ==========================================================
   Datos del juego y resumen
   ========================================================== */
function pintarDetalleJuego() {
  const j = juegoActual;
  detalleJuego.innerHTML =
    '<img class="juego-detalle__img" alt="Portada de ' + escaparHTML(j.nombre) + '" width="640" height="360">' +
    '<div class="juego-detalle__info">' +
      '<h2 id="titulo-juego">' + escaparHTML(j.nombre) + "</h2>" +
      '<div class="juego-detalle__datos">' +
        '<span class="chip chip--genero">' + escaparHTML(j.genero) + "</span>" +
        '<span class="chip">' + j.anio + "</span>" +
        '<span class="chip">' + escaparHTML(j.desarrollador) + "</span>" +
        '<span class="chip ' + claseEstado(j.estado) + '">' + escaparHTML(j.estado) + "</span>" +
      "</div>" +
      "<p>" + escaparHTML(j.descripcion) + "</p>" +
      '<p class="juego-card__plataformas">Plataformas: ' + escaparHTML(j.plataformas.join(", ")) + "</p>" +
      '<div class="cambiar-juego">' +
        '<div class="campo">' +
          '<label for="selector-juego">Cambiar de comunidad</label>' +
          '<select id="selector-juego"></select>' +
        "</div>" +
        '<a class="btn btn--secundario" href="catalogo.html">← Volver al catálogo</a>' +
      "</div>" +
    "</div>";

  prepararImagen(detalleJuego.querySelector("img"), j);

  const selector = document.getElementById("selector-juego");
  llenarSelector(selector);
  selector.value = j.id;
  selector.addEventListener("change", function () {
    cambiarDeJuego(Number(selector.value));
  });
}

/* Cuenta publicaciones por tipo, respuestas y resueltas */
function calcularResumen() {
  const conteo = { todos: publicaciones.length, error: 0, "easter-egg": 0, pregunta: 0, respuestas: 0, resueltas: 0 };
  publicaciones.forEach(function (p) {
    conteo[p.tipo]++;
    conteo.respuestas += p.respuestas.length;
    if (p.resuelta) conteo.resueltas++;
  });
  return conteo;
}

function pintarResumen(conteo) {
  resumen.innerHTML =
    '<div class="stat"><span class="stat__numero">' + conteo.todos + '</span><span class="stat__texto">publicaciones</span></div>' +
    '<div class="stat stat--error"><span class="stat__numero">' + conteo.error + '</span><span class="stat__texto">errores</span></div>' +
    '<div class="stat stat--egg"><span class="stat__numero">' + conteo["easter-egg"] + '</span><span class="stat__texto">easter eggs</span></div>' +
    '<div class="stat stat--pregunta"><span class="stat__numero">' + conteo.pregunta + '</span><span class="stat__texto">preguntas</span></div>';

  // Números de los botones de filtro
  ["todos", "error", "easter-egg", "pregunta"].forEach(function (tipo) {
    document.getElementById("num-" + tipo).textContent = conteo[tipo];
  });

  document.getElementById("subtitulo-comunidad").textContent =
    conteo.respuestas + (conteo.respuestas === 1 ? " respuesta" : " respuestas") +
    " de la comunidad · " + conteo.resueltas + (conteo.resueltas === 1 ? " publicación resuelta" : " publicaciones resueltas");
}

/* ==========================================================
   Validación del formulario
   ========================================================== */

// Devuelve un mensaje de error o "" si el campo es válido
function validarCampo(nombre) {
  const valor = campos[nombre].value.trim();

  if (nombre === "tipo") {
    return TIPOS[valor] ? "" : "Elige si es un error, un easter egg o una pregunta.";
  }

  const regla = REGLAS[nombre];
  if (valor === "") return "Este campo es obligatorio.";
  if (valor.length < regla.min) {
    return "Escribe al menos " + regla.min + " caracteres (faltan " + (regla.min - valor.length) + ").";
  }
  if (valor.length > regla.max) return "Máximo " + regla.max + " caracteres.";
  if (regla.patron && !regla.patron.test(valor)) {
    return "Usa solo letras, números, espacios, guiones o guion bajo.";
  }
  if (nombre === "titulo" && tituloRepetido(valor)) {
    return "Ya existe una publicación con ese título en esta comunidad.";
  }
  return "";
}

function tituloRepetido(titulo) {
  const buscado = normalizar(titulo);
  return publicaciones.some(function (p) {
    return normalizar(p.titulo) === buscado;
  });
}

// Muestra u oculta el error de un campo y cambia su color
function mostrarEstadoCampo(nombre, mensaje) {
  const contenedor = campos[nombre].closest(".campo");
  document.getElementById("error-" + nombre).textContent = mensaje;
  contenedor.classList.toggle("campo--invalido", mensaje !== "");
  contenedor.classList.toggle("campo--valido", mensaje === "");
  campos[nombre].setAttribute("aria-invalid", mensaje !== "");
}

function actualizarContador(nombre) {
  const contador = document.getElementById("contador-" + nombre);
  if (!contador) return;
  const largo = campos[nombre].value.length;
  const max = REGLAS[nombre].max;
  contador.textContent = largo + "/" + max;
  contador.classList.toggle("contador--limite", largo >= max * 0.9);
}

function registrarEventosFormulario() {
  Object.keys(campos).forEach(function (nombre) {
    const campo = campos[nombre];
    const evento = nombre === "tipo" ? "change" : "input";

    // Validación en tiempo real mientras escribe / elige
    campo.addEventListener(evento, function () {
      actualizarContador(nombre);
      mostrarEstadoCampo(nombre, validarCampo(nombre));
      ocultarMensajeForm();
    });

    // También al salir del campo, para avisar si lo dejó vacío
    campo.addEventListener("blur", function () {
      mostrarEstadoCampo(nombre, validarCampo(nombre));
    });
  });

  formulario.addEventListener("submit", publicar);

  document.getElementById("btn-limpiar-form").addEventListener("click", function () {
    limpiarFormulario(true);
  });
}

function limpiarFormulario(avisar) {
  const alias = campos.alias.value; // el alias se conserva
  formulario.reset();
  campos.alias.value = alias;

  Object.keys(campos).forEach(function (nombre) {
    const contenedor = campos[nombre].closest(".campo");
    contenedor.classList.remove("campo--invalido", "campo--valido");
    campos[nombre].removeAttribute("aria-invalid");
    document.getElementById("error-" + nombre).textContent = "";
    actualizarContador(nombre);
  });
  ocultarMensajeForm();

  if (avisar) mostrarToast("Formulario limpio.", "info");
}

function mostrarMensajeForm(texto, tipo) {
  mensajeForm.textContent = texto;
  mensajeForm.className = "mensaje mensaje--" + tipo;
  mensajeForm.hidden = false;
}

function ocultarMensajeForm() {
  mensajeForm.hidden = true;
}

/* ==========================================================
   Agregar publicación
   ========================================================== */
function publicar(evento) {
  evento.preventDefault();

  // Valida todos los campos y junta los que tienen error
  const etiquetas = { alias: "alias", tipo: "tipo", titulo: "título", descripcion: "descripción" };
  const conError = [];
  Object.keys(campos).forEach(function (nombre) {
    const mensaje = validarCampo(nombre);
    mostrarEstadoCampo(nombre, mensaje);
    if (mensaje) conError.push(nombre);
  });

  if (conError.length > 0) {
    mostrarMensajeForm(
      "Revisa estos campos: " + conError.map(function (n) { return etiquetas[n]; }).join(", ") + ".",
      "error"
    );
    campos[conError[0]].focus();
    return;
  }

  const nueva = {
    id: "p" + Date.now(),
    tipo: campos.tipo.value,
    titulo: campos.titulo.value.trim(),
    descripcion: campos.descripcion.value.trim(),
    autor: campos.alias.value.trim(),
    fecha: new Date().toISOString(),
    resuelta: false,
    respuestas: [],
    propia: true
  };

  publicaciones.unshift(nueva);
  if (!guardarPublicaciones(juegoActual.id, publicaciones)) return;
  guardarStorage(CLAVE_ALIAS, nueva.autor);

  ultimaNuevaId = nueva.id;
  limpiarFormulario(false);
  mostrarMensajeForm("¡Publicación creada! Ya aparece en la lista.", "exito");
  mostrarToast("Tu " + TIPOS[nueva.tipo].nombre.toLowerCase() + " se publicó correctamente.", "exito");

  // Si el filtro activo oculta la nueva publicación, se vuelve a "Todos"
  if (filtroActual !== "todos" && filtroActual !== nueva.tipo) marcarFiltro("todos");
  actualizarVista();
}

/* ==========================================================
   Lista de publicaciones
   ========================================================== */
function actualizarVista() {
  pintarResumen(calcularResumen());
  pintarPublicaciones();
}

function pintarPublicaciones() {
  const visibles = publicaciones
    .filter(function (p) {
      const coincideTipo = filtroActual === "todos" || p.tipo === filtroActual;
      const coincideTexto = textoBusqueda === "" ||
        normalizar(p.titulo + " " + p.descripcion + " " + p.autor).includes(textoBusqueda);
      return coincideTipo && coincideTexto;
    })
    .sort(function (a, b) {
      return new Date(b.fecha) - new Date(a.fecha);
    });

  if (visibles.length === 0) {
    listaPublicaciones.innerHTML = crearEstadoVacio();
    return;
  }

  listaPublicaciones.innerHTML = visibles.map(crearHTMLPublicacion).join("");

  if (ultimaNuevaId) {
    const nueva = listaPublicaciones.querySelector('[data-post="' + ultimaNuevaId + '"]');
    if (nueva) nueva.classList.add("post--nuevo");
    ultimaNuevaId = null;
  }
}

function crearEstadoVacio() {
  if (publicaciones.length === 0) {
    return '<div class="vacio"><span class="vacio__icono" aria-hidden="true">+</span>' +
      "<h3>Esta comunidad aún no tiene publicaciones</h3>" +
      "<p>¡Sé el primero en compartir un error, un easter egg o una pregunta!</p></div>";
  }
  if (textoBusqueda !== "") {
    return '<div class="vacio"><span class="vacio__icono" aria-hidden="true">∅</span>' +
      "<h3>Sin coincidencias</h3>" +
      "<p>Ninguna publicación coincide con “" + escaparHTML(document.getElementById("buscar-post").value.trim()) + "”.</p>" +
      '<button class="btn btn--secundario btn--chico" type="button" data-accion="ver-todos">Quitar búsqueda y filtros</button></div>';
  }
  const nombres = { error: "errores", "easter-egg": "easter eggs", pregunta: "preguntas" };
  return '<div class="vacio"><span class="vacio__icono" aria-hidden="true">∅</span>' +
    "<h3>No hay " + nombres[filtroActual] + " publicados</h3>" +
    "<p>Prueba con otro tipo o crea la primera publicación de este tipo.</p>" +
    '<button class="btn btn--secundario btn--chico" type="button" data-accion="ver-todos">Ver todas</button></div>';
}

function crearHTMLPublicacion(p) {
  const tipo = TIPOS[p.tipo];
  const puedeResolver = p.propia && p.tipo !== "easter-egg";

  let acciones = '<button class="btn btn--secundario btn--chico" type="button" data-accion="responder" data-id="' + p.id + '">' +
    (respondiendoId === p.id ? "Cancelar respuesta" : "Responder") + "</button>";
  if (puedeResolver) {
    acciones += '<button class="btn btn--secundario btn--chico" type="button" data-accion="resolver" data-id="' + p.id + '">' +
      (p.resuelta ? "Reabrir" : "Marcar como resuelta") + "</button>";
  }
  if (p.propia) {
    acciones += '<button class="btn btn--peligro btn--chico" type="button" data-accion="eliminar" data-id="' + p.id + '">Eliminar</button>';
  }

  const respuestas = p.respuestas.length === 0 ? "" :
    '<ul class="respuestas" aria-label="Respuestas">' +
      p.respuestas.map(function (r) {
        return '<li class="respuesta"><span class="respuesta__meta"><strong>' + escaparHTML(r.autor) + "</strong> · " +
          formatearFecha(r.fecha) + "</span><p>" + escaparHTML(r.texto) + "</p></li>";
      }).join("") +
    "</ul>";

  return '<article class="post post--' + p.tipo + (p.resuelta ? " post--resuelta" : "") + '" data-post="' + p.id + '">' +
    '<div class="post__cabecera">' +
      '<span class="chip chip--' + p.tipo + '"><span class="punto"></span>' + tipo.nombre + "</span>" +
      (p.resuelta ? '<span class="chip chip--resuelta">✓ Resuelta</span>' : "") +
      (p.propia ? '<span class="chip chip--propia">Tuya</span>' : "") +
    "</div>" +
    '<h3 class="post__titulo">' + escaparHTML(p.titulo) + "</h3>" +
    '<p class="post__meta">Por <strong>' + escaparHTML(p.autor) + "</strong> · " + formatearFecha(p.fecha) +
      " · " + p.respuestas.length + (p.respuestas.length === 1 ? " respuesta" : " respuestas") + "</p>" +
    '<p class="post__texto">' + escaparHTML(p.descripcion) + "</p>" +
    '<div class="post__acciones">' + acciones + "</div>" +
    respuestas +
    (respondiendoId === p.id ? crearFormRespuesta(p.id) : "") +
  "</article>";
}

function crearFormRespuesta(id) {
  const alias = escaparHTML(leerStorage(CLAVE_ALIAS, ""));
  return '<form class="form-respuesta" data-form-respuesta="' + id + '" novalidate>' +
    '<div class="form-respuesta__fila">' +
      '<div class="campo">' +
        '<label for="resp-alias-' + id + '">Tu alias</label>' +
        '<input type="text" id="resp-alias-' + id + '" name="alias" maxlength="20" value="' + alias + '">' +
        '<span class="campo__ayuda"><span class="campo__error" data-error="alias"></span></span>' +
      "</div>" +
      '<div class="campo">' +
        '<label for="resp-texto-' + id + '">Respuesta</label>' +
        '<textarea id="resp-texto-' + id + '" name="texto" maxlength="300" placeholder="Escribe tu respuesta"></textarea>' +
        '<span class="campo__ayuda"><span class="campo__error" data-error="texto"></span><span data-contador>0/300</span></span>' +
      "</div>" +
    "</div>" +
    '<button class="btn btn--primario btn--chico" type="submit">Enviar respuesta</button>' +
  "</form>";
}

/* ==========================================================
   Eventos de la lista (delegación)
   ========================================================== */
function registrarEventosLista() {
  // Botones de filtro por tipo
  document.querySelectorAll(".filtro-tipo").forEach(function (boton) {
    boton.addEventListener("click", function () {
      marcarFiltro(boton.dataset.filtro);
      pintarPublicaciones();
    });
  });

  // Responder, resolver, eliminar, ver todos
  listaPublicaciones.addEventListener("click", function (evento) {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) return;
    const id = boton.dataset.id;

    switch (boton.dataset.accion) {
      case "responder":
        alternarRespuesta(id);
        break;
      case "resolver":
        alternarResuelta(id);
        break;
      case "eliminar":
        eliminarPublicacion(id);
        break;
      case "ver-todos":
        marcarFiltro("todos");
        limpiarBusqueda();
        pintarPublicaciones();
        break;
    }
  });

  // Validación en tiempo real del formulario de respuesta
  listaPublicaciones.addEventListener("input", function (evento) {
    const form = evento.target.closest("[data-form-respuesta]");
    if (!form) return;
    const campo = evento.target;
    if (campo.name === "texto") {
      form.querySelector("[data-contador]").textContent = campo.value.length + "/300";
    }
    mostrarErrorRespuesta(form, campo.name, validarRespuesta(campo.name, campo.value));
  });

  // Envío de una respuesta
  listaPublicaciones.addEventListener("submit", function (evento) {
    const form = evento.target.closest("[data-form-respuesta]");
    if (!form) return;
    evento.preventDefault();
    enviarRespuesta(form);
  });

  // input: búsqueda instantánea dentro de las publicaciones
  document.getElementById("buscar-post").addEventListener("input", function (evento) {
    textoBusqueda = normalizar(evento.target.value);
    respondiendoId = null;
    pintarPublicaciones();
  });

  // Borrar todas mis publicaciones de este juego
  document.getElementById("btn-borrar-mias").addEventListener("click", borrarMisPublicaciones);
}

function limpiarBusqueda() {
  textoBusqueda = "";
  document.getElementById("buscar-post").value = "";
}

function marcarFiltro(filtro) {
  filtroActual = filtro;
  document.querySelectorAll(".filtro-tipo").forEach(function (b) {
    b.setAttribute("aria-pressed", b.dataset.filtro === filtro);
  });
}

function buscarPublicacion(id) {
  return publicaciones.find(function (p) { return p.id === id; });
}

/* ---------- Responder ---------- */
function alternarRespuesta(id) {
  respondiendoId = respondiendoId === id ? null : id;
  pintarPublicaciones();
  if (respondiendoId) {
    const textarea = document.getElementById("resp-texto-" + id);
    if (textarea) textarea.focus();
  }
}

function validarRespuesta(nombre, valor) {
  const regla = nombre === "alias" ? REGLAS.alias : REGLAS.respuesta;
  const limpio = valor.trim();
  if (limpio === "") return "Obligatorio.";
  if (limpio.length < regla.min) return "Mínimo " + regla.min + " caracteres.";
  if (regla.patron && !regla.patron.test(limpio)) return "Solo letras, números, espacios, - o _.";
  return "";
}

function mostrarErrorRespuesta(form, nombre, mensaje) {
  const campo = form.elements[nombre];
  form.querySelector('[data-error="' + nombre + '"]').textContent = mensaje;
  campo.closest(".campo").classList.toggle("campo--invalido", mensaje !== "");
  campo.closest(".campo").classList.toggle("campo--valido", mensaje === "");
}

function enviarRespuesta(form) {
  const alias = form.elements.alias.value;
  const texto = form.elements.texto.value;
  const errorAlias = validarRespuesta("alias", alias);
  const errorTexto = validarRespuesta("texto", texto);
  mostrarErrorRespuesta(form, "alias", errorAlias);
  mostrarErrorRespuesta(form, "texto", errorTexto);

  if (errorAlias || errorTexto) {
    mostrarToast("Completa tu alias y la respuesta antes de enviar.", "error");
    (errorAlias ? form.elements.alias : form.elements.texto).focus();
    return;
  }

  const publicacion = buscarPublicacion(form.dataset.formRespuesta);
  publicacion.respuestas.push({
    autor: alias.trim(),
    texto: texto.trim(),
    fecha: new Date().toISOString()
  });

  guardarPublicaciones(juegoActual.id, publicaciones);
  guardarStorage(CLAVE_ALIAS, alias.trim());
  campos.alias.value = alias.trim();
  actualizarContador("alias");

  respondiendoId = null;
  actualizarVista();
  mostrarToast("Respuesta enviada. ¡Gracias por ayudar!", "exito");
}

/* ---------- Marcar como resuelta (actualizar registro) ---------- */
function alternarResuelta(id) {
  const publicacion = buscarPublicacion(id);
  if (!publicacion || !publicacion.propia) return;

  publicacion.resuelta = !publicacion.resuelta;
  guardarPublicaciones(juegoActual.id, publicaciones);
  actualizarVista();
  mostrarToast(publicacion.resuelta ? "Marcada como resuelta." : "La publicación se reabrió.", "exito");
}

/* ---------- Eliminar ---------- */
async function eliminarPublicacion(id) {
  const publicacion = buscarPublicacion(id);
  if (!publicacion) return;

  if (!publicacion.propia) {
    mostrarToast("Solo puedes eliminar tus propias publicaciones.", "aviso");
    return;
  }

  const confirmado = await confirmar(
    "¿Eliminar publicación?",
    "“" + publicacion.titulo + "” se eliminará de forma permanente.",
    "Eliminar"
  );
  if (!confirmado) return;

  publicaciones = publicaciones.filter(function (p) { return p.id !== id; });
  guardarPublicaciones(juegoActual.id, publicaciones);
  if (respondiendoId === id) respondiendoId = null;
  actualizarVista();
  mostrarToast("Publicación eliminada.", "exito");
}

/* ---------- Limpieza controlada ---------- */
async function borrarMisPublicaciones() {
  const propias = publicaciones.filter(function (p) { return p.propia; });

  if (propias.length === 0) {
    mostrarToast("No tienes publicaciones en esta comunidad.", "aviso");
    return;
  }

  const confirmado = await confirmar(
    "¿Borrar tus publicaciones?",
    "Se eliminarán " + plural(propias.length, "publicación tuya", "publicaciones tuyas") +
      " de " + juegoActual.nombre + ". Esta acción no se puede deshacer.",
    "Borrar todo"
  );
  if (!confirmado) return;

  publicaciones = publicaciones.filter(function (p) { return !p.propia; });
  guardarPublicaciones(juegoActual.id, publicaciones);
  respondiendoId = null;
  actualizarVista();
  mostrarToast("Se eliminaron " + plural(propias.length, "publicación tuya", "publicaciones tuyas") + ".", "exito");
}
