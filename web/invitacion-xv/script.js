// =========================================================
// Invitación XV — interacciones
// =========================================================

// Scroll suave al tocar el indicador de la portada.
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".portada__scroll");
  if (btn) {
    btn.addEventListener("click", () => {
      const siguiente = document.querySelector(".portada")?.nextElementSibling;
      if (siguiente) {
        siguiente.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
      }
    });
  }

  initEditorMode();
});

// =========================================================
// Modo editor: 5 taps consecutivos → arrastrar elementos
// =========================================================

const STORAGE_PREFIX = "inv-xv:pos:";
const TAP_COUNT_TO_ENTER = 5;
const TAP_WINDOW_MS = 600;

function initEditorMode() {
  const editBar = document.querySelector(".edit-bar");
  const movibles = document.querySelectorAll(".movible");

  // Restaurar posiciones guardadas en cualquier modo (visitas previas)
  movibles.forEach(restorePosition);

  // Configurar arrastre para cada elemento
  movibles.forEach(setupDraggable);

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
    });
  }
}

function restorePosition(el) {
  const id = el.dataset.editable;
  if (!id) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + id) || "null");
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
      el.style.setProperty("--tx", saved.x + "px");
      el.style.setProperty("--ty", saved.y + "px");
    }
  } catch {
    // Ignorar errores de parseo
  }
}

function setupDraggable(el) {
  const id = el.dataset.editable;
  if (!id) return;

  const state = { x: 0, y: 0 };
  const saved = readSaved(id);
  if (saved) {
    state.x = saved.x;
    state.y = saved.y;
  }

  let drag = null;

  el.addEventListener("pointerdown", (e) => {
    if (!document.body.classList.contains("edit-mode")) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    drag = {
      pointerId: e.pointerId,
      offsetX: e.clientX - state.x,
      offsetY: e.clientY - state.y,
    };
    el.classList.add("movible--dragging");
  });

  el.addEventListener("pointermove", (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    state.x = e.clientX - drag.offsetX;
    state.y = e.clientY - drag.offsetY;
    el.style.setProperty("--tx", state.x + "px");
    el.style.setProperty("--ty", state.y + "px");
  });

  ["pointerup", "pointercancel"].forEach((evt) => {
    el.addEventListener(evt, (e) => {
      if (!drag || drag.pointerId !== e.pointerId) return;
      drag = null;
      el.classList.remove("movible--dragging");
      try {
        localStorage.setItem(
          STORAGE_PREFIX + id,
          JSON.stringify({ x: state.x, y: state.y })
        );
      } catch {
        // localStorage podría estar lleno o bloqueado
      }
    });
  });
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
