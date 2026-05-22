/* ============================================================
   CUSTOMIZER — formulario de personalizacion in-app
   Modulo compartido entre plantillas: cualquier plantilla que
   cargue customizer.css + customizer.js + declare un
   window.CustomizerConfig obtiene el FAB + bottom-sheet con
   campos editables que se aplican al DOM en vivo y se
   persisten en localStorage.

   Forma de la config:
     window.CustomizerConfig = [
       {
         label: 'Datos principales',
         fields: [
           {
             key:         'hero.name',     // identificador unico
             label:       'Nombre',        // texto que ve el usuario
             type:        'text',          // text | textarea | tel | url | datetime-local
             selector:    '.portada__nombre',  // opcional, default: [data-field="<key>"]
             attribute:   'href',          // opcional, default: textContent
             placeholder: 'Valentina',
             hint:        'Aparece como titulo principal de la portada',
             apply:       function (value) { ... }  // opcional, custom apply
           },
           ...
         ]
       }
     ];

   Para texto multilinea (textarea) en elementos con <br>, define
   apply: function(v) { el.innerHTML = v.replace(/\n/g, '<br/>'); }.
   ============================================================ */
(function () {
  'use strict';

  var config = window.CustomizerConfig || [];
  if (!config.length) return;

  // -----------------------------------------------------------
  // PERSISTENCIA EN LOCALSTORAGE
  // -----------------------------------------------------------
  var STORE_KEY = 'customizer:data:' + location.pathname;

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeStore(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { /* sin localStorage, modo privado, etc. */ }
  }

  var data = readStore();

  // Indice plano de campos por key (para lookup rapido)
  var fieldIndex = {};
  config.forEach(function (section) {
    (section.fields || []).forEach(function (field) {
      fieldIndex[field.key] = field;
    });
  });

  // -----------------------------------------------------------
  // APLICAR UN VALOR AL DOM
  // -----------------------------------------------------------
  function applyField(field, value) {
    if (typeof field.apply === 'function') {
      field.apply(value);
      return;
    }
    var sel = field.selector || '[data-field="' + field.key + '"]';
    var els = document.querySelectorAll(sel);
    els.forEach(function (el) {
      if (field.attribute) {
        el.setAttribute(field.attribute, value);
      } else {
        el.textContent = value;
      }
    });
  }

  // Hidratacion: aplica todos los valores guardados al DOM al cargar
  function hydrate() {
    Object.keys(data).forEach(function (key) {
      var field = fieldIndex[key];
      if (!field) return;
      var value = data[key];
      if (value == null || value === '') return;
      applyField(field, value);
    });
  }
  hydrate();

  // -----------------------------------------------------------
  // CAPTURA VALORES INICIALES (para usar como placeholder/default
  // en los inputs si el usuario no ha guardado nada para ese campo)
  // -----------------------------------------------------------
  function readCurrent(field) {
    if (data[field.key] != null && data[field.key] !== '') return data[field.key];
    if (typeof field.read === 'function') return field.read();
    var sel = field.selector || '[data-field="' + field.key + '"]';
    var el = document.querySelector(sel);
    if (!el) return '';
    if (field.attribute) return el.getAttribute(field.attribute) || '';
    return (el.textContent || '').trim();
  }

  // -----------------------------------------------------------
  // BUILD: FAB
  // -----------------------------------------------------------
  function buildFab() {
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'customizer-fab';
    fab.setAttribute('aria-label', 'Personalizar mi invitacion');
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 20h9"/>' +
        '<path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
      '</svg>' +
      '<span>Personalizar mi invitaci&oacute;n</span>';
    fab.addEventListener('click', openPanel);
    document.body.appendChild(fab);
    return fab;
  }

  // -----------------------------------------------------------
  // BUILD: PANEL (bottom-sheet)
  // -----------------------------------------------------------
  var panelEl = null;
  var backdropEl = null;
  var statusEl = null;
  var statusTimer = null;

  function buildPanel() {
    var backdrop = document.createElement('div');
    backdrop.className = 'customizer-backdrop';
    backdrop.addEventListener('click', closePanel);

    var panel = document.createElement('div');
    panel.className = 'customizer-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Personalizar invitacion');

    // Header
    var header = document.createElement('div');
    header.className = 'customizer-panel__header';
    var title = document.createElement('h2');
    title.className = 'customizer-panel__title';
    title.textContent = 'Personalizar';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'customizer-panel__close';
    close.setAttribute('aria-label', 'Cerrar');
    close.textContent = '×';
    close.addEventListener('click', closePanel);
    header.appendChild(title);
    header.appendChild(close);
    panel.appendChild(header);

    // Body con secciones
    var body = document.createElement('div');
    body.className = 'customizer-panel__body';

    config.forEach(function (section, sectionIndex) {
      var sec = document.createElement('details');
      sec.className = 'customizer-section';
      if (sectionIndex === 0) sec.setAttribute('open', '');

      var summary = document.createElement('summary');
      summary.className = 'customizer-section__title';
      summary.textContent = section.label;
      sec.appendChild(summary);

      var fields = document.createElement('div');
      fields.className = 'customizer-section__fields';
      (section.fields || []).forEach(function (field) {
        fields.appendChild(buildFieldRow(field));
      });
      sec.appendChild(fields);

      body.appendChild(sec);
    });

    panel.appendChild(body);

    // Footer con status + reset
    var footer = document.createElement('div');
    footer.className = 'customizer-panel__footer';

    statusEl = document.createElement('span');
    statusEl.className = 'customizer-panel__status';
    statusEl.textContent = 'Los cambios se guardan automaticamente';

    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'customizer-panel__reset';
    reset.setAttribute('aria-label', 'Restablecer datos');
    reset.textContent = 'Restablecer';
    reset.addEventListener('click', function () {
      if (!confirm('Restablecer todos los datos personalizados de esta invitacion?')) return;
      resetAll();
    });

    footer.appendChild(statusEl);
    footer.appendChild(reset);
    panel.appendChild(footer);

    return { panel: panel, backdrop: backdrop };
  }

  function buildFieldRow(field) {
    var wrap = document.createElement('label');
    wrap.className = 'customizer-field';

    var label = document.createElement('span');
    label.className = 'customizer-field__label';
    label.textContent = field.label;
    wrap.appendChild(label);

    var input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
    }
    input.className = 'customizer-field__input';
    input.value = readCurrent(field) || '';
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.type === 'tel') input.inputMode = 'tel';
    if (field.type === 'url') input.inputMode = 'url';

    // Live update: cada keystroke aplica y guarda
    input.addEventListener('input', function () {
      var value = input.value;
      data[field.key] = value;
      try { applyField(field, value); } catch (e) {}
      writeStore(data);
      flashSaved();
    });

    wrap.appendChild(input);

    if (field.hint) {
      var hint = document.createElement('span');
      hint.className = 'customizer-field__hint';
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }

    return wrap;
  }

  function flashSaved() {
    if (!statusEl) return;
    statusEl.textContent = 'Guardado';
    statusEl.classList.add('is-saved');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      statusEl.textContent = 'Los cambios se guardan automaticamente';
      statusEl.classList.remove('is-saved');
    }, 1400);
  }

  // -----------------------------------------------------------
  // OPEN / CLOSE
  // -----------------------------------------------------------
  function openPanel() {
    if (panelEl) return;
    var built = buildPanel();
    panelEl = built.panel;
    backdropEl = built.backdrop;
    document.body.appendChild(backdropEl);
    document.body.appendChild(panelEl);
    document.body.classList.add('customizer-open');
    requestAnimationFrame(function () {
      backdropEl.classList.add('is-open');
      panelEl.classList.add('is-open');
    });
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('is-open');
    backdropEl.classList.remove('is-open');
    document.body.classList.remove('customizer-open');
    setTimeout(function () {
      if (panelEl) { panelEl.remove(); panelEl = null; }
      if (backdropEl) { backdropEl.remove(); backdropEl = null; }
      statusEl = null;
    }, 320);
  }

  // ESC cierra el panel
  document.addEventListener('keydown', function (e) {
    if (panelEl && (e.key === 'Escape' || e.key === 'Esc')) closePanel();
  });

  // -----------------------------------------------------------
  // RESET
  // -----------------------------------------------------------
  function resetAll() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    // Recarga la pagina para volver a los valores originales del HTML
    location.reload();
  }

  // -----------------------------------------------------------
  // MOUNT
  // -----------------------------------------------------------
  buildFab();
})();
