// =========================================================
// Invitación XV — interacciones
// =========================================================

// Scroll suave al tocar el indicador de la portada.
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
});

// =========================================================
// Cuenta regresiva al evento
// =========================================================
function initCountdown() {
  const section = document.querySelector(".countdown");
  if (!section) return;

  const target = new Date(section.dataset.evento);
  if (isNaN(target)) return;

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
    { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
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
