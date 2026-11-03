/* ==========================================================
   GameAssist Hub – Página de catálogo (solución interactiva)
   - Carga juegos.json con fetch() y pinta tarjetas dinámicamente
   - Búsqueda instantánea + filtros (género, plataforma, estado,
     favoritos) que funcionan juntos, y ordenamiento
   - Marcar / desmarcar favoritos (localStorage)
   - Guarda y recupera los filtros usados (localStorage)
   - Guarda el juego elegido y abre su comunidad
   ========================================================== */

const CLAVE_FILTROS = "gah_filtrosCatalogo";

let juegos = []; // datos cargados desde el JSON

// Referencias al DOM
const buscador = document.getElementById("buscador");
const filtroGenero = document.getElementById("filtro-genero");
const filtroPlataforma = document.getElementById("filtro-plataforma");
const filtroEstado = document.getElementById("filtro-estado");
const orden = document.getElementById("orden");
const soloFavoritos = document.getElementById("solo-favoritos");
const formFiltros = document.getElementById("form-filtros");
const listaJuegos = document.getElementById("lista-juegos");
const contador = document.getElementById("contador-resultados");
const numFavoritos = document.getElementById("num-favoritos");

document.addEventListener("DOMContentLoaded", iniciarCatalogo);

async function iniciarCatalogo() {
  try {
    juegos = await cargarJuegos();
    llenarFiltros();
    recuperarFiltros();
    registrarEventos();
    aplicarFiltros();
  } catch (error) {
    console.error(error);
    contador.textContent = "";
    listaJuegos.innerHTML =
      '<div class="vacio"><span class="vacio__icono" aria-hidden="true">!</span>' +
      "<h3>No se pudo cargar el catálogo</h3>" +
      "<p>Revisa tu conexión y recarga la página.</p></div>";
  }
}

/* Crea las opciones de los filtros a partir de los datos (sin repetir) */
function llenarFiltros() {
  const generos = [];
  const plataformas = [];
  const estados = [];

  juegos.forEach(function (juego) {
    if (!generos.includes(juego.genero)) generos.push(juego.genero);
    if (!estados.includes(juego.estado)) estados.push(juego.estado);
    juego.plataformas.forEach(function (p) {
      if (!plataformas.includes(p)) plataformas.push(p);
    });
  });

  generos.sort().forEach(function (g) { filtroGenero.appendChild(new Option(g, g)); });
  plataformas.sort().forEach(function (p) { filtroPlataforma.appendChild(new Option(p, p)); });
  estados.sort().forEach(function (e) { filtroEstado.appendChild(new Option(e, e)); });
}

/* ---------- Persistencia de filtros ---------- */
function guardarFiltros() {
  guardarStorage(CLAVE_FILTROS, {
    texto: buscador.value,
    genero: filtroGenero.value,
    plataforma: filtroPlataforma.value,
    estado: filtroEstado.value,
    orden: orden.value,
    soloFavoritos: soloFavoritos.checked
  });
}

function recuperarFiltros() {
  const f = leerStorage(CLAVE_FILTROS, null);
  if (!f) return;
  buscador.value = f.texto || "";
  // Solo se recupera un valor si todavía existe como opción
  asignarSiExiste(filtroGenero, f.genero);
  asignarSiExiste(filtroPlataforma, f.plataforma);
  asignarSiExiste(filtroEstado, f.estado);
  asignarSiExiste(orden, f.orden);
  soloFavoritos.checked = Boolean(f.soloFavoritos);
}

function asignarSiExiste(select, valor) {
  const existe = Array.from(select.options).some(function (o) { return o.value === valor; });
  if (existe) select.value = valor;
}

/* ---------- Eventos ---------- */
function registrarEventos() {
  // input: la búsqueda cambia mientras el usuario escribe
  buscador.addEventListener("input", aplicarFiltros);

  // change: al cambiar un filtro, el orden o el interruptor de favoritos
  [filtroGenero, filtroPlataforma, filtroEstado, orden, soloFavoritos].forEach(function (control) {
    control.addEventListener("change", aplicarFiltros);
  });

  // Evita que Enter recargue la página
  formFiltros.addEventListener("submit", function (e) {
    e.preventDefault();
  });

  // reset: el formulario limpia los campos y luego volvemos a pintar
  formFiltros.addEventListener("reset", function () {
    setTimeout(function () {
      aplicarFiltros();
      mostrarToast("Filtros limpiados. Mostrando todos los juegos.", "info");
      buscador.focus();
    }, 0);
  });

  // click: delegación de eventos en la lista de tarjetas
  listaJuegos.addEventListener("click", function (evento) {
    const boton = evento.target.closest("button");
    if (!boton) return;

    if (boton.dataset.fav) {
      marcarFavorito(Number(boton.dataset.fav), boton);
    } else if (boton.dataset.id) {
      entrarAComunidad(Number(boton.dataset.id), boton);
    } else if (boton.dataset.accion === "limpiar") {
      formFiltros.reset();
    }
  });
}

/* ---------- Favoritos ---------- */
function marcarFavorito(idJuego, boton) {
  const juego = juegos.find(function (j) { return j.id === idJuego; });
  const ahora = alternarFavorito(idJuego);

  mostrarToast(
    ahora ? juego.nombre + " se agregó a tus favoritos." : juego.nombre + " se quitó de tus favoritos.",
    ahora ? "exito" : "info"
  );

  // Si está activo "Solo favoritos" y se quitó uno, la lista cambia
  if (soloFavoritos.checked && !ahora) {
    aplicarFiltros();
  } else {
    pintarBotonFavorito(boton, ahora);
    actualizarContador(juegosFiltrados().length);
  }
}

/* ---------- Búsqueda, filtros y orden funcionan juntos ---------- */
function juegosFiltrados() {
  const texto = normalizar(buscador.value);
  const genero = filtroGenero.value;
  const plataforma = filtroPlataforma.value;
  const estado = filtroEstado.value;
  const favoritos = obtenerFavoritos();

  return juegos.filter(function (juego) {
    const coincideTexto = texto === "" ||
      normalizar(juego.nombre).includes(texto) ||
      normalizar(juego.desarrollador).includes(texto);
    const coincideGenero = genero === "" || juego.genero === genero;
    const coincidePlataforma = plataforma === "" || juego.plataformas.includes(plataforma);
    const coincideEstado = estado === "" || juego.estado === estado;
    const coincideFavorito = !soloFavoritos.checked || favoritos.includes(juego.id);
    return coincideTexto && coincideGenero && coincidePlataforma && coincideEstado && coincideFavorito;
  });
}

function ordenarJuegos(lista) {
  const copia = lista.slice();
  switch (orden.value) {
    case "recientes":
      return copia.sort(function (a, b) { return b.anio - a.anio; });
    case "antiguos":
      return copia.sort(function (a, b) { return a.anio - b.anio; });
    case "activos":
      return copia.sort(function (a, b) {
        return obtenerPublicaciones(b).length - obtenerPublicaciones(a).length;
      });
    default:
      return copia.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); });
  }
}

function aplicarFiltros() {
  const resultado = ordenarJuegos(juegosFiltrados());
  pintarJuegos(resultado);
  actualizarContador(resultado.length);
  guardarFiltros();
}

function pintarJuegos(lista) {
  listaJuegos.innerHTML = "";

  if (lista.length === 0) {
    const porFavoritos = soloFavoritos.checked && obtenerFavoritos().length === 0;
    listaJuegos.innerHTML =
      '<div class="vacio"><span class="vacio__icono" aria-hidden="true">' + (porFavoritos ? "☆" : "∅") + "</span>" +
      "<h3>" + (porFavoritos ? "Aún no tienes favoritos" : "No se encontraron juegos") + "</h3>" +
      "<p>" + (porFavoritos
        ? "Marca un juego con la estrella para verlo aquí."
        : "Prueba con otro nombre o cambia los filtros.") + "</p>" +
      '<button class="btn btn--secundario btn--chico" type="button" data-accion="limpiar">Limpiar filtros</button></div>';
    return;
  }

  const idUltimo = obtenerJuegoSeleccionado();
  lista.forEach(function (juego, i) {
    const tarjeta = crearTarjetaJuego(juego, juego.id === idUltimo);
    tarjeta.style.animationDelay = Math.min(i * 30, 300) + "ms";
    listaJuegos.appendChild(tarjeta);
  });
}

/* Resumen calculado con JavaScript según los resultados visibles */
function actualizarContador(cantidad) {
  const visibles = juegosFiltrados();
  const enActualizacion = visibles.filter(function (j) { return j.estado === "En actualizaciones"; }).length;
  const publicaciones = visibles.reduce(function (suma, j) {
    return suma + obtenerPublicaciones(j).length;
  }, 0);

  const condiciones = [];
  if (buscador.value.trim()) condiciones.push("“" + escaparHTML(buscador.value.trim()) + "”");
  if (filtroGenero.value) condiciones.push(escaparHTML(filtroGenero.value));
  if (filtroPlataforma.value) condiciones.push(escaparHTML(filtroPlataforma.value));
  if (filtroEstado.value) condiciones.push(escaparHTML(filtroEstado.value));
  if (soloFavoritos.checked) condiciones.push("favoritos");

  let mensaje = "Mostrando <strong>" + cantidad + "</strong> de " + juegos.length + " juegos";
  if (cantidad > 0) {
    mensaje += " · " + plural(enActualizacion, "en actualizaciones", "en actualizaciones") +
      " · " + plural(publicaciones, "publicación", "publicaciones");
  }
  if (condiciones.length > 0) {
    mensaje += " · Filtro: " + condiciones.join(", ");
  }

  contador.innerHTML = mensaje;
  numFavoritos.textContent = "(" + obtenerFavoritos().length + ")";
}
