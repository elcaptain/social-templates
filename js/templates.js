// Template definitions. Each entry fully describes one Figma frame as a stack of
// positioned layers. The renderer (app.js) is generic — adding a new template is a
// data change here, not a code change.
//
// Coordinate system: pixels, origin at the frame's top-left, matching Figma.
// Asset references (a.gradient, a.illustration, ...) come from window.ASSETS (assets.js).
//
// Layer kinds:
//   'image'       — absolutely positioned <img> at {x,y,w,h}. h omitted = auto.
//   'text'        — absolutely positioned static text block.
//   'row'         — horizontal flex row (Figma auto-layout) at {x,y} that hugs its
//                   content; used for the by-line and the editable date-time pill.
//                   Children are 'text' (with optional `editable`+`field`+`default`)
//                   or 'image' segments.
// Editable fields are collected by the renderer to build the control panel.

const a = window.ASSETS;

// Shared text colours from the Figma design.
const INK = '#1D2126';
const BYLINE_INK = '#09202E';

window.TEMPLATES = [
  {
    id: 'community-meetup',
    name: 'Community Meetup',
    width: 1080,
    height: 1080,
    // Backdrop is the gradient (cover) with the icon illustration on top, clipped by
    // the stage. The illustration sits at a negative offset, exactly as in Figma.
    layers: [
      { kind: 'image', src: a.gradient, x: 0, y: 0, w: 1080, h: 1080, cover: true },
      { kind: 'image', src: a.illustration, x: -444, y: -179, w: 2361, h: 1272 },

      // Project logo — a dropdown picks one of the "project-logo" component variants.
      // Left-anchored at x=69; height fixed, width follows each logo's aspect ratio.
      {
        kind: 'image',
        x: 69, y: 483, h: 73,
        shiftOnCollapse: true,
        select: {
          field: 'logo',
          label: 'Project logo',
          default: 'ha',
          options: [
            { value: 'ha', label: 'Home Assistant', src: a.logoHa },
            { value: 'esphome', label: 'ESPHome', src: a.logoEsphome },
            { value: 'ma', label: 'Music Assistant', src: a.logoMa },
          ],
        },
      },

      {
        kind: 'text',
        text: 'Community Meetup',
        x: 58, y: 587, w: 972,
        font: { weight: 700, size: 120, lineHeight: 105.6, letterSpacing: -1.2 },
        color: INK,
        titleCase: true,
        shiftOnCollapse: true,
      },

      // Editable date-time pill — horizontal auto-layout that grows on one line.
      {
        kind: 'row',
        shiftOnCollapse: true,
        x: 68, y: 842,
        gap: 10,
        padding: 16,
        radius: 8,
        background: '#16F3BE',
        align: 'center',
        font: { weight: 400, size: 38, lineHeight: 33.44, letterSpacing: -0.38 },
        color: INK,
        titleCase: true,
        // Weekday + Date are driven by one date picker (see datePart below).
        datePicker: { label: 'Event date', default: '2026-05-27' },
        children: [
          { kind: 'text', editable: true, field: 'weekday', label: 'Weekday', default: 'Wednesday,', datePart: 'weekday' },
          { kind: 'text', editable: true, field: 'date', label: 'Date', default: 'May 27', font: { weight: 700 }, datePart: 'monthday' },
          { kind: 'text', text: '|' },
          { kind: 'text', editable: true, field: 'city', label: 'City', default: 'Rome' },
        ],
      },

      // By-line: static text + editable bold organizer name. Optional — toggled by a checkbox.
      {
        kind: 'row',
        optional: true,
        optionLabel: 'Show "organized by" line',
        defaultOn: true,
        // When hidden, slide the layers flagged shiftOnCollapse down by this many px so
        // the content stays bottom-anchored (date-time bottom lands where the by-line was).
        collapseShift: 104,
        x: 68, y: 982,
        gap: 8,
        align: 'center',
        font: { weight: 400, size: 30, lineHeight: 28.8, letterSpacing: -0.3 },
        color: BYLINE_INK,
        children: [
          { kind: 'text', text: 'An event organized by ' },
          { kind: 'text', editable: true, field: 'organizer', label: 'Organizer', default: 'Organizer', font: { weight: 700 } },
        ],
      },
    ],
  },
];
