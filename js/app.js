// Generic renderer + editor for the templates defined in templates.js.
// Builds the stage from a template config, wires up editable fields, and exports a PNG.
(function () {
  'use strict';

  const PIXEL_RATIO = 2; // export at 2x → e.g. 2160×2160 for a 1080 frame

  const stageEl = document.getElementById('stage');
  const scalerEl = document.getElementById('scaler');
  const controlsEl = document.getElementById('controls');
  const downloadBtn = document.getElementById('download');
  const statusEl = document.getElementById('status');

  // --- font-face: inline the Figtree woff2 data URIs (no network) ---
  function injectFonts() {
    const css = `
      @font-face { font-family: 'Figtree'; font-style: normal; font-weight: 400;
        src: url(${window.ASSETS.figtree400}) format('woff2'); font-display: block; }
      @font-face { font-family: 'Figtree'; font-style: normal; font-weight: 700;
        src: url(${window.ASSETS.figtree700}) format('woff2'); font-display: block; }`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function applyFont(el, font, color, titleCase) {
    if (font) {
      if (font.weight) el.style.fontWeight = font.weight;
      if (font.size) el.style.fontSize = font.size + 'px';
      if (font.lineHeight) el.style.lineHeight = font.lineHeight + 'px';
      if (font.letterSpacing != null) el.style.letterSpacing = font.letterSpacing + 'px';
    }
    if (color) el.style.color = color;
    // Figma's TITLE case styling.
    if (titleCase) el.style.textTransform = 'capitalize';
  }

  // Collects editable field nodes so inputs can update them live.
  const fields = []; // {field, label, default, el}

  // Optional layers that can be shown/hidden via a checkbox.
  const optionalLayers = []; // {label, el, on, fields:Set, inputs:[], collapseShift}
  // Layers (flagged shiftOnCollapse) that slide down when an optional layer is hidden.
  const shiftEls = [];

  function applyOptional(opt) {
    opt.el.style.display = opt.on ? '' : 'none';
    for (const input of opt.inputs) input.disabled = !opt.on;
    if (opt.collapseShift) {
      const ty = opt.on ? '' : `translateY(${opt.collapseShift}px)`;
      for (const el of shiftEls) el.style.transform = ty;
    }
  }
  const optionalLayerForField = (field) => optionalLayers.find((o) => o.fields.has(field));

  // Image layers driven by a dropdown (e.g. the project logo).
  const selectLayers = []; // {field, label, options, el}

  // One date picker can drive multiple text fields (see datePart in templates.js).
  let datePicker = null; // {label, default}

  // Parse a YYYY-MM-DD value as a LOCAL date (avoids UTC-shift to the previous day).
  function parseLocalDate(value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const DATE_PARTS = {
    weekday: (dt) => dt.toLocaleDateString('en-US', { weekday: 'long' }) + ',',
    monthday: (dt) => dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
  };
  function formatDatePart(value, part) {
    const fn = DATE_PARTS[part];
    return fn ? fn(parseLocalDate(value)) : value;
  }

  function makeImage(layer) {
    const img = document.createElement('img');
    img.className = 'layer-image';
    if (layer.select) {
      const sel = layer.select;
      const opt = sel.options.find((o) => o.value === sel.default) || sel.options[0];
      img.src = opt.src;
      selectLayers.push({ field: sel.field, label: sel.label, options: sel.options, el: img });
    } else {
      img.src = layer.src;
    }
    if (layer.w) img.style.width = layer.w + 'px';
    if (layer.h) img.style.height = layer.h + 'px';
    if (layer.cover) img.style.objectFit = 'cover';
    return img;
  }

  function makeTextSpan(child, parentFont, parentColor, parentTitleCase) {
    const span = document.createElement('span');
    span.className = 'seg';
    span.textContent = child.editable ? child.default : child.text;
    // child.font overrides individual properties (e.g. bold Date) on top of the row font.
    applyFont(span, Object.assign({}, parentFont, child.font), parentColor, parentTitleCase);
    if (child.editable) {
      span.dataset.field = child.field;
      fields.push({ field: child.field, label: child.label, default: child.default, el: span, datePart: child.datePart });
    }
    return span;
  }

  function buildLayer(layer) {
    if (layer.kind === 'image') {
      const img = makeImage(layer);
      img.style.left = layer.x + 'px';
      img.style.top = layer.y + 'px';
      return img;
    }

    if (layer.kind === 'text') {
      const el = document.createElement('div');
      el.className = 'layer-text';
      el.style.left = layer.x + 'px';
      el.style.top = layer.y + 'px';
      if (layer.w) el.style.width = layer.w + 'px';
      el.textContent = layer.text;
      applyFont(el, layer.font, layer.color, layer.titleCase);
      return el;
    }

    if (layer.kind === 'row') {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.style.left = layer.x + 'px';
      row.style.top = layer.y + 'px';
      row.style.gap = (layer.gap || 0) + 'px';
      if (layer.align) row.style.alignItems = layer.align;
      if (layer.padding != null) row.style.padding = layer.padding + 'px';
      if (layer.radius != null) row.style.borderRadius = layer.radius + 'px';
      if (layer.background) row.style.background = layer.background;

      for (const child of layer.children) {
        if (child.kind === 'image') {
          row.appendChild(makeImage(child));
        } else {
          row.appendChild(makeTextSpan(child, layer.font, layer.color, layer.titleCase));
        }
      }
      return row;
    }

    return document.createDocumentFragment();
  }

  function buildStage(tpl) {
    stageEl.style.width = tpl.width + 'px';
    stageEl.style.height = tpl.height + 'px';
    stageEl.innerHTML = '';
    fields.length = 0;
    optionalLayers.length = 0;
    shiftEls.length = 0;
    selectLayers.length = 0;
    datePicker = null;
    for (const layer of tpl.layers) {
      if (layer.datePicker) datePicker = layer.datePicker;
      const el = buildLayer(layer);
      if (layer.shiftOnCollapse) shiftEls.push(el);
      if (layer.optional) {
        const opt = {
          label: layer.optionLabel || 'Show layer',
          el,
          on: layer.defaultOn !== false,
          fields: new Set((layer.children || []).filter((c) => c.editable).map((c) => c.field)),
          inputs: [],
          collapseShift: layer.collapseShift || 0,
        };
        optionalLayers.push(opt);
        el.style.display = opt.on ? '' : 'none';
      }
      stageEl.appendChild(el);
    }
    // Apply initial collapse state (e.g. if a layer defaults to off).
    for (const opt of optionalLayers) applyOptional(opt);
  }

  function makeCheckbox(checked, labelText, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'toggle';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    box.addEventListener('change', () => onChange(box.checked));
    const span = document.createElement('span');
    span.textContent = labelText;
    wrap.appendChild(box);
    wrap.appendChild(span);
    return wrap;
  }

  function makeSelect(sel) {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const span = document.createElement('span');
    span.className = 'field-label';
    span.textContent = sel.label;
    const select = document.createElement('select');
    for (const o of sel.options) {
      const optEl = document.createElement('option');
      optEl.value = o.value;
      optEl.textContent = o.label;
      select.appendChild(optEl);
    }
    select.addEventListener('change', () => {
      const o = sel.options.find((x) => x.value === select.value);
      if (o) sel.el.src = o.src;
    });
    wrap.appendChild(span);
    wrap.appendChild(select);
    return wrap;
  }

  function makeDatePicker(spec, dateFields) {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const span = document.createElement('span');
    span.className = 'field-label';
    span.textContent = spec.label;
    const input = document.createElement('input');
    input.type = 'date';
    input.value = spec.default || '';
    const apply = () => {
      if (!input.value) return;
      for (const f of dateFields) f.el.textContent = formatDatePart(input.value, f.datePart);
    };
    input.addEventListener('input', apply);
    apply(); // sync spans to the initial date
    wrap.appendChild(span);
    wrap.appendChild(input);
    return wrap;
  }

  function buildControls() {
    controlsEl.innerHTML = '';
    // Dropdowns first (e.g. project logo).
    for (const sel of selectLayers) controlsEl.appendChild(makeSelect(sel));

    // One date picker drives all date-derived fields (Weekday + Date).
    const dateFields = fields.filter((f) => f.datePart);
    if (datePicker && dateFields.length) {
      controlsEl.appendChild(makeDatePicker(datePicker, dateFields));
    }

    const emittedToggles = new Set();
    for (const f of fields) {
      if (f.datePart) continue; // handled by the date picker
      const opt = optionalLayerForField(f.field);
      if (opt && !emittedToggles.has(opt)) {
        emittedToggles.add(opt);
        controlsEl.appendChild(
          makeCheckbox(opt.on, opt.label, (on) => { opt.on = on; applyOptional(opt); })
        );
      }
      const wrap = document.createElement('label');
      wrap.className = 'field';
      const span = document.createElement('span');
      span.className = 'field-label';
      span.textContent = f.label;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = f.default;
      input.addEventListener('input', () => {
        // Keep a space so an empty field doesn't collapse the line height.
        f.el.textContent = input.value || ' ';
      });
      wrap.appendChild(span);
      wrap.appendChild(input);
      controlsEl.appendChild(wrap);

      // Register the input so its optional layer's checkbox can disable it.
      if (opt) { opt.inputs.push(input); input.disabled = !opt.on; }
    }
  }

  // Fit the (full-size) stage into its preview column via CSS transform.
  const PREVIEW_SCALE = 0.5; // show the preview at half the column-fit size
  function fitPreview(tpl) {
    // Measure the parent's inner width (the scaler's own width is mutated below).
    const parent = scalerEl.parentElement;
    const cs = getComputedStyle(parent);
    const avail = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const scale = Math.min(1, avail / tpl.width) * PREVIEW_SCALE;
    stageEl.style.transform = `scale(${scale})`;
    // Reserve the scaled-down footprint so layout doesn't overflow.
    scalerEl.style.width = tpl.width * scale + 'px';
    scalerEl.style.height = tpl.height * scale + 'px';
  }

  async function exportPng(tpl) {
    statusEl.textContent = 'Rendering…';
    downloadBtn.disabled = true;
    try {
      await document.fonts.ready;
      // Capture at native size regardless of the on-screen preview transform.
      // pixelRatio scales the output canvas: width*pixelRatio = 2160 for a 1080 frame.
      // Do NOT also set canvasWidth/Height — html-to-image multiplies them by pixelRatio.
      const dataUrl = await window.htmlToImage.toPng(stageEl, {
        pixelRatio: PIXEL_RATIO,
        width: tpl.width,
        height: tpl.height,
        style: { transform: 'none', transformOrigin: 'top left' },
      });
      const city = (fields.find((f) => f.field === 'city') || {}).el;
      const slug = (city ? city.textContent : tpl.id)
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || tpl.id;
      const link = document.createElement('a');
      link.download = `${tpl.id}_${slug}.png`;
      link.href = dataUrl;
      link.click();
      statusEl.textContent = 'Downloaded ✓';
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Export failed — see console.';
    } finally {
      downloadBtn.disabled = false;
    }
  }

  function init() {
    injectFonts();
    const tpl = window.TEMPLATES[0]; // single template for now
    buildStage(tpl);
    buildControls();
    fitPreview(tpl);
    window.addEventListener('resize', () => fitPreview(tpl));
    downloadBtn.addEventListener('click', () => exportPng(tpl));
    document.fonts.ready.then(() => fitPreview(tpl));
  }

  init();
})();
