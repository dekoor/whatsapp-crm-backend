// =========================================================
// Invitación XV — interacciones
// =========================================================

// =========================================================
// CAMBIA AQUÍ LA FECHA DEL EVENTO
// Formato ISO 8601 con offset de zona horaria.
// Ej: "2026-08-08T19:00:00-06:00" = 8 Ago 2026, 7:00 PM (CDMX/Querétaro)
// =========================================================
const eventDate = new Date("2026-08-08T19:00:00-06:00");

// Scroll suave al tocar el indicador de la portada.
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".portada__heart");
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
});

// =========================================================
// Música de fondo (YouTube IFrame API)
// - El reproductor vive oculto fuera del viewport
// - Autoplay con sonido está bloqueado por los navegadores hasta que
//   haya un gesto del usuario, así que enganchamos el primer tap en
//   cualquier parte y arrancamos ahí
// - Botón flotante para silenciar/reanudar; la preferencia se guarda
// =========================================================
const MUSIC_VIDEO_ID = "6Yq_YFDL-jQ";
const MUSIC_PREF_KEY = "inv-xv:sound";

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
const PHOTO_PREFIX = "inv-xv:photo:";
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
const GLOBAL_BRUSH_COUNT = 14;
const GLOBAL_PARTICLE_COUNT = 38;

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
  if (!section || isNaN(eventDate)) return;

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
    let diff = eventDate.getTime() - Date.now();

    if (diff <= 0) {
      // Fecha ya pasó: todos a 00 (días sin padding extra).
      setNum(els.dias, "00");
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

    // Días: 2 o 3 dígitos (no pad si ≥ 10, sino 2 dígitos).
    setNum(els.dias, dias < 10 ? String(dias).padStart(2, "0") : String(dias));
    setNum(els.horas, String(horas).padStart(2, "0"));
    setNum(els.minutos, String(minutos).padStart(2, "0"));
    setNum(els.segundos, String(segundos).padStart(2, "0"));
  }

  tick();
  setInterval(tick, 1000);
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

const STORAGE_PREFIX = "inv-xv:pos:";
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
