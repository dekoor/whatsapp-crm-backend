/* ============================================================
   EDITOR — modo secreto activado con 5 taps consecutivos.
   Modulo compartido entre plantillas: cualquier plantilla que
   cargue editor.css + editor.js obtiene el modo edicion.

   Para marcar elementos editables, agregale el atributo
   [data-editable] en el HTML:
       <h1 class="hero__name" data-editable>Valentina</h1>

   Opcional: si la plantilla define window.EditorConfig antes de
   cargar este script, puede sobrescribir parametros:
       window.EditorConfig = {
         taps: 5,            // taps requeridos
         tapWindowMs: 1500,  // ventana entre taps
         snapPx: 10,         // umbral de snap al centro
         scaleMin: 0.4,
         scaleMax: 3.0,
         scaleSpeed: 250,    // px de drag = +1.0x
         host: '.phone'      // contenedor donde montar la UI
       };
   ============================================================ */
(function () {
  'use strict';

  // Configuracion (con overrides opcionales via window.EditorConfig)
  var cfg = window.EditorConfig || {};
  var TAPS_REQUIRED  = cfg.taps        || 5;
  var TAP_WINDOW_MS  = cfg.tapWindowMs || 1500;
  var SNAP_PX        = cfg.snapPx      || 10;
  var SCALE_MIN      = cfg.scaleMin    || 0.4;
  var SCALE_MAX      = cfg.scaleMax    || 3.0;
  var SCALE_SPEED    = cfg.scaleSpeed  || 250;
  var HOST_SELECTOR  = cfg.host        || '.phone';

  // Estado
  var tapCount   = 0;
  var lastTapAt  = 0;
  var tapTimer   = null;
  var editorOn   = false;
  var tapsBar    = null;   // indicador visual de taps
  var phoneEl    = document.querySelector(HOST_SELECTOR) || document.body;

  // ----- INICIALIZACION -----
  // Los editables se descubren dinamicamente en cada activacion para
  // soportar plantillas que agreguen elementos despues de cargar.
  function collectEditables() {
    return Array.prototype.slice.call(
      document.querySelectorAll('[data-editable]')
    );
  }

  buildTapsIndicator();

  // ----- DETECCION DE 5 TAPS -----
  document.addEventListener('pointerdown', function (e) {
    if (editorOn) return;
    // Ignorar taps sobre elementos interactivos y dentro del editor mismo
    if (e.target.closest('a, button, input, textarea, select')) return;
    if (e.target.closest('.editor-ui, .editor-taps')) return;

    var now = Date.now();
    if (now - lastTapAt > TAP_WINDOW_MS) {
      tapCount = 1;
    } else {
      tapCount += 1;
    }
    lastTapAt = now;

    updateTapsIndicator(tapCount);

    if (tapCount >= TAPS_REQUIRED) {
      tapCount = 0;
      hideTapsIndicator();
      enableEditor();
      return;
    }

    // Auto-reset si pasa la ventana sin nuevo tap
    clearTimeout(tapTimer);
    tapTimer = setTimeout(function () {
      tapCount = 0;
      hideTapsIndicator();
    }, TAP_WINDOW_MS);
  }, true);

  // ESC para salir (desktop)
  document.addEventListener('keydown', function (e) {
    if (editorOn && (e.key === 'Escape' || e.key === 'Esc')) {
      disableEditor();
    }
  });

  // ----- INDICADOR VISUAL DE TAPS (progreso) -----
  function buildTapsIndicator() {
    tapsBar = document.createElement('div');
    tapsBar.className = 'editor-taps';
    tapsBar.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < TAPS_REQUIRED; i++) {
      var dot = document.createElement('span');
      dot.className = 'editor-taps__dot';
      tapsBar.appendChild(dot);
    }
    document.body.appendChild(tapsBar);
  }

  function updateTapsIndicator(count) {
    if (!tapsBar) return;
    tapsBar.classList.add('is-on');
    var dots = tapsBar.querySelectorAll('.editor-taps__dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('is-active', i < count);
    }
  }

  function hideTapsIndicator() {
    if (!tapsBar) return;
    tapsBar.classList.remove('is-on');
    var dots = tapsBar.querySelectorAll('.editor-taps__dot');
    dots.forEach(function (d) { d.classList.remove('is-active'); });
  }

  // ----- ENABLE / DISABLE -----
  var activeEditables = [];

  function enableEditor() {
    if (editorOn) return;
    editorOn = true;
    document.body.classList.add('is-editor');
    // La UI del editor (barra + linea guia) vive a nivel <body>, NO dentro
    // del phone: asi position:fixed no queda atrapado por transforms del
    // mockup y se mantiene anclada al viewport durante el scroll.
    document.body.appendChild(buildEditorUI());
    activeEditables = collectEditables();
    activeEditables.forEach(setupElement);

    // Bloquear navegacion de <a> mientras editor esta activo
    document.addEventListener('click', blockClickInEditor, true);
  }

  function disableEditor() {
    if (!editorOn) return;
    editorOn = false;
    document.body.classList.remove('is-editor');
    var ui = document.body.querySelector(':scope > .editor-ui');
    if (ui) ui.remove();
    activeEditables.forEach(teardownElement);
    activeEditables = [];
    document.removeEventListener('click', blockClickInEditor, true);
  }

  function blockClickInEditor(e) {
    if (e.target.closest('[data-editable]')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // ----- UI: barra + linea guia centro -----
  function buildEditorUI() {
    var ui = document.createElement('div');
    ui.className = 'editor-ui';

    var bar = document.createElement('div');
    bar.className = 'editor-bar';

    var label = document.createElement('span');
    label.className = 'editor-bar__label';
    label.textContent = 'Editor';

    var exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'editor-bar__exit';
    exit.setAttribute('aria-label', 'Salir del editor');
    exit.textContent = '×'; // ×
    exit.addEventListener('click', disableEditor);

    bar.appendChild(label);
    bar.appendChild(exit);

    var guide = document.createElement('div');
    guide.className = 'editor-guide editor-guide--v';
    guide.setAttribute('aria-hidden', 'true');

    ui.appendChild(bar);
    ui.appendChild(guide);
    return ui;
  }

  // ----- SETUP / TEARDOWN POR ELEMENTO -----
  function setupElement(el) {
    // Estado persistido en data-* para sobrevivir toggles del editor
    var state = {
      x:     parseFloat(el.dataset.editorX)     || 0,
      y:     parseFloat(el.dataset.editorY)     || 0,
      scale: parseFloat(el.dataset.editorScale) || 1
    };
    applyState(el, state);
    el._editorState = state;

    // Handle de resize
    var handle = document.createElement('span');
    handle.className = 'editor-handle';
    handle.setAttribute('aria-hidden', 'true');
    el.appendChild(handle);
    el._editorHandle = handle;

    // Listeners
    el._onDragStart   = function (e) { onDragStart(e, el); };
    el._onResizeStart = function (e) { onResizeStart(e, el); };
    el.addEventListener('pointerdown', el._onDragStart);
    handle.addEventListener('pointerdown', el._onResizeStart);
  }

  function teardownElement(el) {
    if (el._editorHandle) el._editorHandle.remove();
    if (el._onDragStart)  el.removeEventListener('pointerdown', el._onDragStart);
    el._editorHandle   = null;
    el._onDragStart    = null;
    el._onResizeStart  = null;
  }

  // ----- DRAG -----
  function onDragStart(e, el) {
    if (e.target === el._editorHandle) return;  // resize handle prioriza
    e.preventDefault();
    e.stopPropagation();

    var state  = el._editorState;
    var startX = e.clientX;
    var startY = e.clientY;
    var baseX  = state.x;
    var baseY  = state.y;
    var guide  = document.querySelector('.editor-guide--v');

    try { el.setPointerCapture(e.pointerId); } catch (err) {}

    function move(ev) {
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      state.x = baseX + dx;
      state.y = baseY + dy;
      applyState(el, state);

      // Snap a centro horizontal del phone
      var phoneRect = phoneEl.getBoundingClientRect();
      var phoneCx   = phoneRect.left + phoneRect.width / 2;
      var elRect    = el.getBoundingClientRect();
      var elCx      = elRect.left + elRect.width / 2;
      var diff      = phoneCx - elCx;

      if (Math.abs(diff) < SNAP_PX) {
        state.x += diff;
        applyState(el, state);
        if (guide) guide.classList.add('is-snap');
      } else {
        if (guide) guide.classList.remove('is-snap');
      }
    }

    function up() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      if (guide) guide.classList.remove('is-snap');
      persistState(el, state);
    }

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  // ----- RESIZE (escala) -----
  function onResizeStart(e, el) {
    e.preventDefault();
    e.stopPropagation();

    var state  = el._editorState;
    var startX = e.clientX;
    var baseScale = state.scale;

    function move(ev) {
      var dx = ev.clientX - startX;
      var next = baseScale + dx / SCALE_SPEED;
      if (next < SCALE_MIN) next = SCALE_MIN;
      if (next > SCALE_MAX) next = SCALE_MAX;
      state.scale = next;
      applyState(el, state);
    }

    function up() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      persistState(el, state);
    }

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  // ----- APLICAR ESTADO via CSS vars -----
  function applyState(el, state) {
    el.style.setProperty('--editor-x',     state.x + 'px');
    el.style.setProperty('--editor-y',     state.y + 'px');
    el.style.setProperty('--editor-scale', state.scale);
  }

  function persistState(el, state) {
    el.dataset.editorX     = state.x;
    el.dataset.editorY     = state.y;
    el.dataset.editorScale = state.scale;
  }
})();
