// =========================================================
// Invitación XV — interacciones
// =========================================================

// Scroll suave al tocar el indicador de la portada.
// Namespace dinamico para que dos plantillas (xv, xv-2, xv-3...)
// no pisen el localStorage entre si. La plantilla declara el id
// con `<body data-template-id="xv-2">`. Default: "xv" para
// preservar las claves originales de la primera invitacion.
const TEMPLATE_ID = document.body?.dataset.templateId || "xv";
const NS = `inv-${TEMPLATE_ID}`;

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".portada__scroll");
  if (btn) {
    btn.addEventListener("click", (e) => {
      // En modo editor lo estamos arrastrando, no hacer scroll
      if (document.body.classList.contains("edit-mode")) {
        e.preventDefault();
        return;
      }
      const siguiente = document.querySelector(".portada")?.nextElementSibling;
      if (siguiente) {
        siguiente.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
      }
    });
  }

  initEditorMode();
  initRevealOnScroll();
  initCountdown();
  initBrushes();
  initParticles();
  initPhotoSlots();
  initPolaroidTap();
  initBackgroundMusic();
  initCustomizer();
  initScrollPause();
  initNameRefit();
});

// Re-mide el ancho de las líneas del nombre cuando el viewport cambia
// (rotación, redimensionar ventana) o cuando termina de cargar la
// fuente Great Vibes, que es bastante más ancha que la genérica de
// fallback
function initNameRefit() {
  let timeout = null;
  function schedule() {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (typeof fitNameLines === "function") fitNameLines();
    }, 120);
  }
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (typeof fitNameLines === "function") fitNameLines();
    });
  }
}

// =========================================================
// Pausa las animaciones del canvas-fx mientras el usuario
// scrollea: agrega body.is-scrolling y la quita ~150ms después
// del último evento de scroll. Libera GPU y hace el scroll mucho
// más fluido en mobile sin que el usuario perciba el corte.
// =========================================================
function initScrollPause() {
  let timeout = null;
  let scrolling = false;
  const ANIM_RESUME_MS = 160;

  function onScroll() {
    if (!scrolling) {
      scrolling = true;
      document.body.classList.add("is-scrolling");
    }
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      scrolling = false;
      document.body.classList.remove("is-scrolling");
    }, ANIM_RESUME_MS);
  }

  // passive: true es crítico — sin él el browser no puede optimizar
  // el scroll porque sabría que podríamos llamar preventDefault
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("touchmove", onScroll, { passive: true });
}

// =========================================================
// Personalizar plantilla
// Drawer modal con formulario que reescribe en vivo los datos
// de la portada. Lo que el cliente teclea se persiste en
// localStorage para sobrevivir recargas.
// =========================================================
const CUST_KEY = `${NS}:cust`;
const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CUST_DEFAULTS = {
  kicker: "XV AÑOS",
  nombre1: "Valentina",
  nombre2: "Sofía",
  fecha: "2026-11-15",
  frase1: "Hay momentos",
  frase2: "que merecen ser",
  frase3: "recordados para siempre.",
  ceremonia_hora: "17:00",
  ceremonia_lugar: "Parroquia de San Francisco",
  ceremonia_dir1: "Av. Hidalgo 123, Centro",
  ceremonia_dir2: "Zapopan, Jalisco",
  ceremonia_maps: "",
};

const CUST_TOTAL_STEPS = 3;
let custCurrentStep = 1;

function initCustomizer() {
  const toggle = document.querySelector(".cust-toggle");
  const drawer = document.querySelector(".cust-drawer");
  const overlay = document.querySelector(".cust-overlay");
  const form = document.querySelector("#cust-form");
  const closeBtn = drawer?.querySelector(".cust-drawer__close");
  if (!toggle || !drawer || !overlay || !form) return;

  // Cargar valores guardados sobre los defaults del HTML
  const stored = readCustom();
  for (const key of Object.keys(CUST_DEFAULTS)) {
    const input = form.elements[key];
    if (!input) continue;
    if (stored[key] !== undefined) {
      input.value = stored[key];
    }
  }
  applyCustom(readCurrentValues(form));

  // Abrir / cerrar drawer
  toggle.addEventListener("click", () => openDrawer(drawer, overlay));
  closeBtn?.addEventListener("click", () => closeDrawer(drawer, overlay));
  overlay.addEventListener("click", () => closeDrawer(drawer, overlay));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.dataset.state === "open") {
      closeDrawer(drawer, overlay);
    }
  });

  // Cambios en vivo
  form.addEventListener("input", () => {
    const data = readCurrentValues(form);
    applyCustom(data);
    saveCustom(data);
  });

  // Botones de acción dentro del form
  form.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    e.preventDefault();
    if (action === "reset") {
      for (const key of Object.keys(CUST_DEFAULTS)) {
        const input = form.elements[key];
        if (input) input.value = CUST_DEFAULTS[key];
      }
      applyCustom(CUST_DEFAULTS);
      saveCustom(CUST_DEFAULTS);
    } else if (action === "next") {
      goToStep(drawer, form, Math.min(custCurrentStep + 1, CUST_TOTAL_STEPS));
    } else if (action === "back") {
      goToStep(drawer, form, Math.max(custCurrentStep - 1, 1));
    } else if (action === "close") {
      closeDrawer(drawer, overlay);
    }
  });

  // Arrancar siempre en el paso 1 cuando se abre por primera vez
  goToStep(drawer, form, 1);
}

// Muestra el fieldset n, oculta los demás y actualiza la barra
// de botones (Atrás visible desde el paso 2, Siguiente hasta el
// penúltimo, Listo sólo en el último). También repinta el stepper.
function goToStep(drawer, form, n) {
  custCurrentStep = n;

  form.querySelectorAll(".cust-step").forEach((fs) => {
    const step = parseInt(fs.dataset.step, 10);
    fs.hidden = step !== n;
  });

  const backBtn = form.querySelector('[data-action="back"]');
  const nextBtn = form.querySelector('[data-action="next"]');
  const closeBtn = form.querySelector('[data-action="close"]');
  if (backBtn) backBtn.hidden = n === 1;
  if (nextBtn) nextBtn.hidden = n >= CUST_TOTAL_STEPS;
  if (closeBtn) closeBtn.hidden = n < CUST_TOTAL_STEPS;

  form.querySelectorAll(".cust-stepper__dot").forEach((dot) => {
    const step = parseInt(dot.dataset.step, 10);
    dot.classList.toggle("is-active", step === n);
    dot.classList.toggle("is-done", step < n);
  });

  // Sube el scroll al inicio del drawer al cambiar de paso
  if (drawer) drawer.scrollTop = 0;
}

function openDrawer(drawer, overlay) {
  drawer.hidden = false;
  overlay.hidden = false;
  // Permite que el browser registre el display: block antes de transicionar
  requestAnimationFrame(() => {
    drawer.dataset.state = "open";
    overlay.dataset.state = "open";
    document.body.classList.add("cust-open");
  });
}

function closeDrawer(drawer, overlay) {
  drawer.dataset.state = "closed";
  overlay.dataset.state = "closed";
  document.body.classList.remove("cust-open");
  // Esperar a que termine la animación antes de aria-hide
  setTimeout(() => {
    if (drawer.dataset.state === "closed") {
      drawer.hidden = true;
      overlay.hidden = true;
    }
  }, 450);
}

function readCurrentValues(form) {
  const out = {};
  for (const key of Object.keys(CUST_DEFAULTS)) {
    out[key] = form.elements[key]?.value ?? CUST_DEFAULTS[key];
  }
  return out;
}

function readCustom() {
  try {
    const raw = localStorage.getItem(CUST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCustom(data) {
  try {
    localStorage.setItem(CUST_KEY, JSON.stringify(data));
  } catch {
    /* cuota llena, ignorar */
  }
}

function applyCustom(data) {
  renderKicker(data.kicker);
  renderNombres(data.nombre1, data.nombre2);
  renderFecha(data.fecha);
  renderDespedidaFecha(data.fecha);
  renderRsvpDeadline(data.fecha);
  renderCountdownDate(data.fecha);
  renderFirma(data.nombre1, data.nombre2);
  renderHashtag(data.nombre1, data.nombre2);
  renderAlts(data.nombre1, data.nombre2);
  renderWhatsApp(data.nombre1, data.nombre2);
  renderFrase(data.frase1, data.frase2, data.frase3);
  renderEvento("ceremonia", {
    hora: data.ceremonia_hora,
    lugar: data.ceremonia_lugar,
    dir1: data.ceremonia_dir1,
    dir2: data.ceremonia_dir2,
    maps: data.ceremonia_maps,
  });
  updateTitle(data.nombre1, data.nombre2);
}

// Render compartido para ceremonia y recepción. La tarjeta de cada
// evento tiene la misma estructura interna (.evento__hora, __lugar,
// __direccion, __mapa), así que cambia sólo el selector base.
function renderEvento(tipo, { hora, lugar, dir1, dir2, maps }) {
  const evento = document.querySelector(`.evento--${tipo}`);
  if (!evento) return;

  const horaEl = evento.querySelector(".evento__hora");
  if (horaEl) {
    const { time, period } = formatHora12(hora);
    horaEl.innerHTML = `${escapeHtml(time)} <span>${escapeHtml(period)}</span>`;
  }

  const lugarEl = evento.querySelector(".evento__lugar");
  if (lugarEl) lugarEl.textContent = lugar || "";

  const dirEl = evento.querySelector(".evento__direccion");
  if (dirEl) {
    const html = [dir1, dir2]
      .filter((s) => s && s.trim())
      .map(escapeHtml)
      .join("<br />");
    dirEl.innerHTML = html;
  }

  // Si el cliente proporciono un link de Maps lo usamos tal cual;
  // si no, armamos uno con el nombre del lugar + direccion como
  // search query (fallback razonable, no siempre apunta al pin exacto)
  const mapaLink = evento.querySelector(".evento__mapa");
  if (mapaLink) {
    const custom = (maps || "").trim();
    if (custom) {
      mapaLink.href = custom;
    } else {
      const query = [lugar, dir1, dir2]
        .filter((s) => s && s.trim())
        .join(", ");
      if (query) {
        mapaLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
      }
    }
  }
}

// Convierte "HH:MM" 24h en partes 12h para el formato del template
// (ej. "17:00" -> { time: "5:00", period: "PM" })
function formatHora12(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!m) return { time: "", period: "" };
  let h = parseInt(m[1], 10);
  const min = m[2];
  if (isNaN(h)) return { time: "", period: "" };
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return { time: `${hour12}:${min}`, period };
}

function renderFrase(f1, f2, f3) {
  const lineas = document.querySelectorAll(".bienvenida__cita-linea");
  if (lineas[0]) lineas[0].textContent = f1 ?? "";
  if (lineas[1]) lineas[1].textContent = f2 ?? "";
  if (lineas[2]) lineas[2].textContent = f3 ?? "";
}

function renderKicker(text) {
  const el = document.querySelector(".portada__kicker");
  if (!el) return;
  const chars = (text || "").trim().toUpperCase().split("");
  el.innerHTML = chars
    .map((ch, i) => {
      const isSep = ch === " " || ch === "·";
      const display = isSep ? "·" : ch;
      const cls = isSep ? "sep" : "";
      // Reasignamos animation-delay para que cualquier número de letras
      // entre con cascada bonita (las reglas nth-child del CSS asumen 7).
      const delay = (0.2 + i * 0.08).toFixed(2);
      return `<span class="${cls}" style="animation-delay:${delay}s">${escapeHtml(
        display
      )}</span>`;
    })
    .join("");
}

function renderNombres(linea1, linea2) {
  const elV = document.querySelector(
    '[data-editable="nombre-valentina"] .linea'
  );
  const elS = document.querySelector(
    '[data-editable="nombre-sofia"] .linea'
  );
  if (elV) elV.textContent = linea1 || "";
  if (elS) elS.textContent = linea2 || "";

  // Si la segunda línea está vacía, ocultamos su wrapper para que no
  // deje un hueco con margen
  const wrapS = document.querySelector('[data-editable="nombre-sofia"]');
  if (wrapS) {
    wrapS.style.display = linea2 && linea2.trim() ? "" : "none";
  }

  fitNameLines();
}

// Mide el ancho real de las líneas del nombre y baja el font-size
// proporcionalmente si una de ellas excede el contenedor. Aplica el
// mismo factor a las dos para que mantengan la jerarquía visual.
function fitNameLines() {
  const elV = document.querySelector(
    '[data-editable="nombre-valentina"] .linea'
  );
  const elS = document.querySelector(
    '[data-editable="nombre-sofia"] .linea'
  );
  const wrapS = document.querySelector('[data-editable="nombre-sofia"]');
  if (!elV) return;

  const hasSecond =
    wrapS && wrapS.style.display !== "none" && elS && elS.textContent.trim();

  // Quitamos cualquier override anterior para volver a medir desde
  // el tamaño base del clamp() del CSS
  elV.style.fontSize = "";
  if (elS) elS.style.fontSize = "";

  // Una vez que el browser aplicó el reset, medimos
  requestAnimationFrame(() => {
    const container =
      document.querySelector(".portada__contenido") || elV.parentElement;
    if (!container) return;

    // clientWidth incluye el padding del contenedor, pero el texto
    // sólo dispone del content-box. Restamos padding y dejamos
    // margen extra porque el text-shadow del nombre extiende el
    // halo unos 22 px a cada lado, además del letter-spacing
    const cs = getComputedStyle(container);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const usable = container.clientWidth - padL - padR;
    const maxWidth = usable * 0.9; // 10% extra para el glow del shadow

    const wV = elV.scrollWidth;
    const wS = hasSecond ? elS.scrollWidth : 0;
    const widest = Math.max(wV, wS);

    if (widest <= maxWidth) return;

    const computed = parseFloat(getComputedStyle(elV).fontSize);
    const factor = maxWidth / widest;
    const newSize = (computed * factor).toFixed(1) + "px";

    elV.style.fontSize = newSize;
    if (hasSecond) elS.style.fontSize = newSize;
  });
}

function renderFecha(iso) {
  const el = document.querySelector(".portada__fecha");
  if (!el || !iso) return;
  const parts = parseFechaISO(iso);
  if (!parts) return;
  const { year, mesNombre, dia } = parts;
  el.innerHTML =
    `<span>${dia}</span>` +
    `<span class="punto">·</span>` +
    `<span>${escapeHtml(mesNombre)}</span>` +
    `<span class="punto">·</span>` +
    `<span>${year}</span>`;
}

function renderDespedidaFecha(iso) {
  const el = document.querySelector(".despedida__fecha");
  if (!el) return;
  const parts = parseFechaISO(iso);
  if (!parts) return;
  el.textContent = `${parts.dia} · ${parts.mesNombre}`;
}

function renderRsvpDeadline(iso) {
  // Fecha límite para confirmar = fecha del evento - 14 días
  const el = document.querySelector(".rsvp__fecha-fuerte");
  if (!el) return;
  const parts = parseFechaISO(iso);
  if (!parts) return;
  const eventDate = new Date(
    Date.UTC(parseInt(parts.year, 10), parts.mesIdx, parseInt(parts.dia, 10))
  );
  eventDate.setUTCDate(eventDate.getUTCDate() - 14);
  const dia = eventDate.getUTCDate();
  const mesNombre = MESES_ES[eventDate.getUTCMonth()] || "";
  el.textContent = `${dia} de ${mesNombre}`;
}

function renderCountdownDate(iso) {
  // El countdown mira section.dataset.evento. Conservamos la
  // hora/zona originales y solo reemplazamos la parte de fecha.
  const section = document.querySelector(".countdown");
  if (!section || !iso) return;
  const parts = parseFechaISO(iso);
  if (!parts) return;

  const current = section.dataset.evento || "";
  // current esperado: "YYYY-MM-DDTHH:MM:SS±HH:MM"
  const timePart = current.includes("T") ? current.slice(current.indexOf("T")) : "T20:00:00-06:00";
  section.dataset.evento = `${parts.year}-${parts.month}-${parts.dia}${timePart}`;

  // Forzar el siguiente tick a usar el nuevo target sin esperar 1 s
  if (typeof window.__refreshCountdown === "function") {
    window.__refreshCountdown();
  }
}

// Helper compartido: parsea "YYYY-MM-DD" en sus partes con
// formato consistente para todos los renderers
function parseFechaISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return null;
  const [, year, month, day] = m;
  const mesIdx = parseInt(month, 10) - 1;
  return {
    year,
    month,
    mesIdx,
    mesNombre: MESES_ES[mesIdx] || "",
    dia: String(parseInt(day, 10)).padStart(2, "0"),
  };
}

function updateTitle(n1, n2) {
  const partes = [n1, n2].filter((s) => s && s.trim());
  if (partes.length) {
    document.title = `${partes.join(" ")} · Mis XV Años`;
  }
}

function renderFirma(n1, n2) {
  const el = document.querySelector(".despedida__firma");
  if (!el) return;
  el.textContent = fullName(n1, n2);
}

function renderHashtag(n1, n2) {
  // El hashtag usa los nombres sin espacios ni acentos + sufijo "XV"
  const base = [n1, n2]
    .filter((s) => s && s.trim())
    .map(toAscii)
    .join("");
  const tag = base ? `${base}XV` : "XV";

  const textoEl = document.querySelector(".hashtag__texto");
  if (textoEl) textoEl.textContent = tag;

  const cta = document.querySelector(".hashtag__cta");
  if (cta) {
    cta.href = `https://www.instagram.com/explore/tags/${tag.toLowerCase()}/`;
  }
}

function renderAlts(n1, n2) {
  const full = fullName(n1, n2);
  const first = (n1 || "").trim() || full;
  const setAlt = (sel, value) => {
    const el = document.querySelector(sel);
    if (el && value) el.setAttribute("alt", value);
  };
  setAlt(".portada__foto", `Foto de ${full}`);
  setAlt(".regalos__retrato-img", `Retrato de ${first}`);
  setAlt(".despedida__foto", `${first} al atardecer`);
}

function renderWhatsApp(n1, n2) {
  // Reescribe el href de cada botón de RSVP conservando su número de
  // teléfono pero reemplazando el nombre que va dentro del mensaje.
  const full = fullName(n1, n2);
  const msg = `Hola, confirmo mi asistencia a los XV de ${full}.`;
  const encoded = encodeURIComponent(msg);

  document.querySelectorAll(".rsvp__boton").forEach((a) => {
    try {
      const url = new URL(a.href);
      url.searchParams.set("text", msg);
      // wa.me espera el query encoded con %20 en espacios (lo que URL hace)
      a.href = `${url.origin}${url.pathname}?text=${encoded}`;
    } catch {
      /* href inválido, lo dejamos */
    }
  });
}

function fullName(n1, n2) {
  return [n1, n2]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ");
}

function toAscii(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =========================================================
// Música de fondo (YouTube IFrame API)
// - El reproductor vive oculto fuera del viewport
// - Autoplay con sonido está bloqueado por los navegadores hasta que
//   haya un gesto del usuario, así que enganchamos el primer tap en
//   cualquier parte y arrancamos ahí
// - Botón flotante para silenciar/reanudar; la preferencia se guarda
// =========================================================
const MUSIC_VIDEO_ID = "6Yq_YFDL-jQ";
const MUSIC_PREF_KEY = `${NS}:sound`;

let ytPlayer = null;
let ytReady = false;
let musicPlaying = false;
let firstTapBound = false;

function initBackgroundMusic() {
  const btn = document.querySelector(".music-toggle");
  if (!btn) return;

  // Cargar YouTube IFrame API una sola vez
  if (!window.YT) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }

  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player("yt-player", {
      height: "0",
      width: "0",
      videoId: MUSIC_VIDEO_ID,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        loop: 1,
        playlist: MUSIC_VIDEO_ID,
      },
      events: {
        onReady: () => {
          ytReady = true;
          bindFirstTap();
        },
        onStateChange: onYTStateChange,
      },
    });
  };

  // Click del usuario en el botón
  btn.addEventListener("click", () => {
    toggleMusic();
  });
}

function bindFirstTap() {
  if (firstTapBound) return;
  if (localStorage.getItem(MUSIC_PREF_KEY) === "off") {
    // Usuario ya pidió silencio antes → no arrancamos solos
    return;
  }
  firstTapBound = true;
  const onFirstTap = () => {
    if (!ytReady || musicPlaying) return;
    try {
      ytPlayer.playVideo();
    } catch {
      /* ignore */
    }
  };
  // click se dispara sólo en taps completos (no en drags), así que
  // arrancar la música aquí no interfiere con el modo editor.
  document.addEventListener("click", onFirstTap, { once: true });
}

function toggleMusic() {
  if (!ytReady || !ytPlayer) return;
  if (musicPlaying) {
    ytPlayer.pauseVideo();
    localStorage.setItem(MUSIC_PREF_KEY, "off");
  } else {
    ytPlayer.playVideo();
    localStorage.setItem(MUSIC_PREF_KEY, "on");
  }
}

function onYTStateChange(event) {
  const btn = document.querySelector(".music-toggle");
  if (!btn) return;

  // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  if (event.data === 1) {
    musicPlaying = true;
    btn.dataset.state = "on";
    btn.setAttribute("aria-label", "Pausar música");
  } else if (event.data === 2 || event.data === 0) {
    musicPlaying = false;
    btn.dataset.state = "off";
    btn.setAttribute("aria-label", "Reproducir música");
    // YouTube a veces no respeta el loop=1; lo forzamos
    if (event.data === 0) {
      try {
        ytPlayer.seekTo(0);
        ytPlayer.playVideo();
      } catch {
        /* ignore */
      }
    }
  }
}

// =========================================================
// Tap en polaroid: la trae al frente y la agranda un poco.
// Vuelve sola a su sitio después de 2 s.
// Tap de nuevo (o en otra, o fuera) también la cierra.
// Ignorado en modo editor — ahí gana el drag.
// =========================================================
const POLAROID_AUTO_CLOSE_MS = 2000;

function initPolaroidTap() {
  const polaroids = document.querySelectorAll(".polaroid");
  if (!polaroids.length) return;

  let autoCloseTimer = null;

  function closeAll() {
    polaroids.forEach((other) => other.classList.remove("polaroid--active"));
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }

  polaroids.forEach((p) => {
    p.addEventListener("click", (e) => {
      if (document.body.classList.contains("edit-mode")) return;
      if (e.target.closest(".polaroid__cambiar")) return;

      const wasActive = p.classList.contains("polaroid--active");
      closeAll();
      if (!wasActive) {
        p.classList.add("polaroid--active");
        autoCloseTimer = setTimeout(() => {
          p.classList.remove("polaroid--active");
          autoCloseTimer = null;
        }, POLAROID_AUTO_CLOSE_MS);
      }
    });
  });

  // Tap fuera para cerrar
  document.addEventListener("click", (e) => {
    if (document.body.classList.contains("edit-mode")) return;
    if (e.target.closest(".polaroid")) return;
    closeAll();
  });
}

// =========================================================
// Slots de foto editables (galería polaroid)
// Botón cámara → file picker → resize + compress a WebP → localStorage
// =========================================================
const PHOTO_PREFIX = `${NS}:photo:`;
const PHOTO_MAX_SIDE = 900;
const PHOTO_QUALITY = 0.82;

function initPhotoSlots() {
  document.querySelectorAll("[data-photo-slot]").forEach((slot) => {
    const slotId = slot.dataset.photoSlot;
    const img = slot.querySelector(".polaroid__foto");
    const btn = slot.querySelector(".polaroid__cambiar");
    if (!img || !btn) return;

    // Restaurar imagen guardada en sesiones previas
    try {
      const saved = localStorage.getItem(PHOTO_PREFIX + slotId);
      if (saved) img.src = saved;
    } catch {
      // localStorage bloqueado, ignorar
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const dataUrl = await compressImageToWebP(
            file,
            PHOTO_MAX_SIDE,
            PHOTO_QUALITY
          );
          img.src = dataUrl;
          try {
            localStorage.setItem(PHOTO_PREFIX + slotId, dataUrl);
          } catch (err) {
            showToast("Imagen demasiado grande para guardar");
          }
        } catch (err) {
          console.error("No se pudo procesar la imagen", err);
          showToast("No se pudo cargar la imagen");
        }
      });
      document.body.appendChild(input);
      input.click();
      setTimeout(() => input.remove(), 0);
    });
  });
}

function compressImageToWebP(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSide) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else if (height >= width && height > maxSide) {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("encode failed"));
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = () => reject(fr.error);
            fr.readAsDataURL(blob);
          },
          "image/webp",
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// =========================================================
// Pinceladas oro rosa de fondo
// =========================================================
// Una sola capa global de pinceladas dentro de .canvas-fx. Como vive
// en un contenedor fixed, las pinceladas son las mismas para todas las
// secciones y el lienzo se siente continuo sin franjas vacías al
// pasar de una sección a otra.
const GLOBAL_BRUSH_COUNT = 10;
const GLOBAL_PARTICLE_COUNT = 24;

function initBrushes() {
  const canvas = document.querySelector(".canvas-fx");
  if (!canvas) return;

  const wrap = document.createElement("div");
  wrap.className = "brushes brushes--global";
  wrap.setAttribute("aria-hidden", "true");

  const variants = ["", "brush--bright", "brush--soft"];

  for (let i = 0; i < GLOBAL_BRUSH_COUNT; i += 1) {
    const b = document.createElement("span");
    b.className = "brush";
    const variant = variants[Math.floor(Math.random() * variants.length)];
    if (variant) b.classList.add(variant);

    const top = Math.random() * 100;
    const left = Math.random() * 100;
    const width = 280 + Math.random() * 360;
    const height = 70 + Math.random() * 110;
    const rot = -55 + Math.random() * 110;
    const opFrom = (0.18 + Math.random() * 0.16).toFixed(2);
    const opTo = (parseFloat(opFrom) + 0.1 + Math.random() * 0.15).toFixed(2);
    const breathe = (14 + Math.random() * 12).toFixed(1);
    const breatheDelay = (-Math.random() * 14).toFixed(1);

    b.style.top = top + "%";
    b.style.left = left + "%";
    b.style.width = width + "px";
    b.style.height = height + "px";
    const baseTransform = `translate(-50%, -50%) rotate(${rot.toFixed(0)}deg)`;
    b.style.setProperty("--base-transform", baseTransform);
    b.style.transform = baseTransform;
    b.style.setProperty("--op-from", opFrom);
    b.style.setProperty("--op-to", opTo);
    b.style.setProperty("--breathe", breathe + "s");
    b.style.setProperty("--breathe-delay", breatheDelay + "s");
    b.style.opacity = opFrom;

    wrap.appendChild(b);
  }

  canvas.appendChild(wrap);
}

// =========================================================
// Partículas decorativas (destellos champagne) — global
// =========================================================
function initParticles() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const canvas = document.querySelector(".canvas-fx");
  if (!canvas) return;

  const wrap = document.createElement("div");
  wrap.className = "particles particles--global";
  wrap.setAttribute("aria-hidden", "true");

  for (let i = 0; i < GLOBAL_PARTICLE_COUNT; i += 1) {
    const p = document.createElement("span");
    p.className = "particles__p";
    if (Math.random() < 0.2) p.classList.add("particles__p--bright");

    const size = (1.2 + Math.random() * 4).toFixed(1);
    const duration = (16 + Math.random() * 22).toFixed(1);
    const delay = (-Math.random() * 30).toFixed(1);
    const drift = ((Math.random() - 0.5) * 80).toFixed(0);
    const opacity = (0.35 + Math.random() * 0.5).toFixed(2);

    p.style.left = (Math.random() * 100).toFixed(2) + "%";
    p.style.setProperty("--size", size + "px");
    p.style.setProperty("--duration", duration + "s");
    p.style.setProperty("--delay", delay + "s");
    p.style.setProperty("--drift", drift + "px");
    p.style.setProperty("--opacity", opacity);

    wrap.appendChild(p);
  }

  canvas.appendChild(wrap);
}

// =========================================================
// Cuenta regresiva al evento
// =========================================================
function initCountdown() {
  const section = document.querySelector(".countdown");
  if (!section) return;

  // Lee el target en cada tick: si el customizer cambia data-evento,
  // el siguiente segundo el countdown ya apunta a la fecha nueva
  function readTarget() {
    const t = new Date(section.dataset.evento);
    return isNaN(t) ? null : t;
  }

  let target = readTarget();
  if (!target) return;

  const els = {
    dias: section.querySelector('[data-cd="dias"]'),
    horas: section.querySelector('[data-cd="horas"]'),
    minutos: section.querySelector('[data-cd="minutos"]'),
    segundos: section.querySelector('[data-cd="segundos"]'),
  };
  if (!els.dias) return;

  function setNum(el, value) {
    if (el.textContent === value) return;
    el.classList.add("countdown__num--changing");
    setTimeout(() => {
      el.textContent = value;
      el.classList.remove("countdown__num--changing");
    }, 120);
  }

  function tick() {
    target = readTarget() || target;
    let diff = target.getTime() - Date.now();

    if (diff <= 0) {
      setNum(els.dias, "000");
      setNum(els.horas, "00");
      setNum(els.minutos, "00");
      setNum(els.segundos, "00");
      return;
    }

    const dias = Math.floor(diff / 86400000);
    diff -= dias * 86400000;
    const horas = Math.floor(diff / 3600000);
    diff -= horas * 3600000;
    const minutos = Math.floor(diff / 60000);
    diff -= minutos * 60000;
    const segundos = Math.floor(diff / 1000);

    setNum(els.dias, String(dias).padStart(3, "0"));
    setNum(els.horas, String(horas).padStart(2, "0"));
    setNum(els.minutos, String(minutos).padStart(2, "0"));
    setNum(els.segundos, String(segundos).padStart(2, "0"));
  }

  tick();
  setInterval(tick, 1000);

  // Expone tick() para que el customizer fuerce un refresh
  // inmediato cuando cambie la fecha del evento
  window.__refreshCountdown = tick;
}

// =========================================================
// Reveal de elementos al entrar al viewport
// =========================================================
function initRevealOnScroll() {
  const targets = document.querySelectorAll("[data-reveal]");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -5% 0px" }
  );

  targets.forEach((el) => io.observe(el));
}

// =========================================================
// Modo editor: 5 taps consecutivos → arrastrar elementos
// =========================================================

const STORAGE_PREFIX = `${NS}:pos:`;
const TAP_COUNT_TO_ENTER = 5;
const TAP_WINDOW_MS = 600;
const SNAP_THRESHOLD = 10; // px de tolerancia para encajar al centro
const MIN_SCALE = 0.4;
const MAX_SCALE = 3.0;
const SCALE_SNAP = 0.05; // tolerancia para encajar a escala 1.0

function initEditorMode() {
  const editBar = document.querySelector(".edit-bar");
  const movibles = document.querySelectorAll(".movible");

  // Configurar cada elemento editable (restaura + arrastrar + escalar)
  movibles.forEach(setupEditable);

  // Detección de 5 taps
  let tapCount = 0;
  let tapTimer = null;

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (document.body.classList.contains("edit-mode")) return;
      // Ignorar clicks en botones o links
      if (e.target.closest("button, a")) return;

      tapCount += 1;
      clearTimeout(tapTimer);

      if (tapCount >= TAP_COUNT_TO_ENTER) {
        tapCount = 0;
        enterEditMode();
        return;
      }

      tapTimer = setTimeout(() => {
        tapCount = 0;
      }, TAP_WINDOW_MS);
    },
    { passive: true }
  );

  // Botones de la barra
  editBar?.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "exit") exitEditMode();
    if (action === "reset") resetPositions();
  });

  function enterEditMode() {
    document.body.classList.add("edit-mode");
    editBar?.removeAttribute("hidden");
    hapticFeedback([30, 60, 30]);
    showToast("Modo editor activado");
  }

  function exitEditMode() {
    document.body.classList.remove("edit-mode");
    editBar?.setAttribute("hidden", "");
    hapticFeedback(20);
    showToast("Modo editor desactivado");
  }

  function resetPositions() {
    movibles.forEach((el) => {
      const id = el.dataset.editable;
      localStorage.removeItem(STORAGE_PREFIX + id);
      el.style.setProperty("--tx", "0px");
      el.style.setProperty("--ty", "0px");
      el.style.setProperty("--scale", "1");
    });
  }
}

// =========================================================
// Por cada elemento editable: drag, pinch (2 dedos) y handle
// =========================================================
function setupEditable(el) {
  const id = el.dataset.editable;
  if (!id) return;

  const state = { x: 0, y: 0, scale: 1 };
  const saved = readSaved(id);
  if (saved) {
    if (typeof saved.x === "number") state.x = saved.x;
    if (typeof saved.y === "number") state.y = saved.y;
    if (typeof saved.scale === "number") state.scale = saved.scale;
  }
  apply();

  // Inyectar handle de resize y badge de escala
  const handle = document.createElement("span");
  handle.className = "movible__handle";
  handle.setAttribute("aria-hidden", "true");
  el.appendChild(handle);

  const badge = document.createElement("span");
  badge.className = "movible__scale-badge";
  badge.setAttribute("aria-hidden", "true");
  el.appendChild(badge);

  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let resize = null;
  let lastSnap = { x: false, y: false };

  function apply() {
    el.style.setProperty("--tx", state.x + "px");
    el.style.setProperty("--ty", state.y + "px");
    el.style.setProperty("--scale", state.scale.toString());
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_PREFIX + id,
        JSON.stringify({ x: state.x, y: state.y, scale: state.scale })
      );
    } catch {
      // ignorar
    }
  }

  function flashBadge() {
    badge.textContent = Math.round(state.scale * 100) + "%";
    badge.classList.add("movible__scale-badge--visible");
    clearTimeout(badge._timer);
    badge._timer = setTimeout(() => {
      badge.classList.remove("movible__scale-badge--visible");
    }, 700);
  }

  // -------- drag + pinch en el elemento --------
  el.addEventListener("pointerdown", (e) => {
    if (!document.body.classList.contains("edit-mode")) return;
    if (e.target === handle) return; // handle tiene su propio flujo
    // Permitir interacción con controles internos (ej. botón cámara de polaroid)
    if (e.target.closest("button, [data-no-drag]")) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      drag = {
        pointerId: e.pointerId,
        offsetX: e.clientX - state.x,
        offsetY: e.clientY - state.y,
      };
      lastSnap = { x: false, y: false };
      el.classList.add("movible--dragging");
    } else if (pointers.size === 2) {
      // Segundo dedo → iniciar pinch, cancelar drag
      const [a, b] = [...pointers.values()];
      pinch = {
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startScale: state.scale,
      };
      drag = null;
      document.body.classList.remove("snap-vcenter", "snap-hcenter");
      el.classList.remove("movible--dragging");
    }
  });

  el.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      let next = clamp(
        pinch.startScale * (dist / pinch.startDist),
        MIN_SCALE,
        MAX_SCALE
      );
      if (Math.abs(next - 1) < SCALE_SNAP) next = 1;
      const wasOne = Math.abs(state.scale - 1) < 0.001;
      state.scale = next;
      apply();
      flashBadge();
      const isOne = Math.abs(next - 1) < 0.001;
      if (isOne && !wasOne) hapticFeedback(10);
      return;
    }

    if (drag && drag.pointerId === e.pointerId) {
      let newX = e.clientX - drag.offsetX;
      let newY = e.clientY - drag.offsetY;

      let snapX = false;
      let snapY = false;

      if (Math.abs(newX) < SNAP_THRESHOLD) {
        newX = 0;
        snapX = true;
      }

      const rect = el.getBoundingClientRect();
      const naturalCenterY = rect.top + rect.height / 2 - state.y;
      const desiredY = window.innerHeight / 2 - naturalCenterY;
      if (Math.abs(newY - desiredY) < SNAP_THRESHOLD) {
        newY = desiredY;
        snapY = true;
      }

      state.x = newX;
      state.y = newY;
      apply();

      document.body.classList.toggle("snap-vcenter", snapX);
      document.body.classList.toggle("snap-hcenter", snapY);
      if (snapX && !lastSnap.x) hapticFeedback(10);
      if (snapY && !lastSnap.y) hapticFeedback(10);
      lastSnap = { x: snapX, y: snapY };
    }
  });

  ["pointerup", "pointercancel"].forEach((evt) => {
    el.addEventListener(evt, (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);

      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        drag = null;
        el.classList.remove("movible--dragging");
        document.body.classList.remove("snap-vcenter", "snap-hcenter");
        lastSnap = { x: false, y: false };
        save();
      }
    });
  });

  // -------- handle de resize --------
  handle.addEventListener("pointerdown", (e) => {
    if (!document.body.classList.contains("edit-mode")) return;
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    resize = {
      pointerId: e.pointerId,
      cx,
      cy,
      startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
      startScale: state.scale,
    };
    el.classList.add("movible--resizing");
  });

  handle.addEventListener("pointermove", (e) => {
    if (!resize || resize.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - resize.cx, e.clientY - resize.cy);
    let next = clamp(
      resize.startScale * (dist / resize.startDist),
      MIN_SCALE,
      MAX_SCALE
    );
    if (Math.abs(next - 1) < SCALE_SNAP) next = 1;
    const wasOne = Math.abs(state.scale - 1) < 0.001;
    state.scale = next;
    apply();
    flashBadge();
    const isOne = Math.abs(next - 1) < 0.001;
    if (isOne && !wasOne) hapticFeedback(10);
  });

  ["pointerup", "pointercancel"].forEach((evt) => {
    handle.addEventListener(evt, (e) => {
      if (!resize || resize.pointerId !== e.pointerId) return;
      resize = null;
      el.classList.remove("movible--resizing");
      save();
    });
  });
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function readSaved(id) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + id) || "null");
  } catch {
    return null;
  }
}

// Aviso central temporal
let toastTimer = null;
function showToast(message) {
  const toast = document.querySelector(".edit-toast");
  if (!toast) return;
  const text = toast.querySelector(".edit-toast__text");
  if (text) text.textContent = message;

  toast.removeAttribute("hidden");
  // Forzar reflow para que la transición se aplique
  // eslint-disable-next-line no-unused-expressions
  toast.offsetHeight;
  toast.classList.add("edit-toast--visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("edit-toast--visible");
    setTimeout(() => toast.setAttribute("hidden", ""), 350);
  }, 1600);
}

// Vibración si el dispositivo lo soporta (Android Chrome, etc.)
function hapticFeedback(pattern) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignorar si no se permite
    }
  }
}
