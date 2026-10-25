// "Single and Pair Representations" (slide 17): the picture of the original (four tensors: s, z, q, p) redrawn natively and
// built up a click at a time, so each tensor is seen forming.
//
//   token level  s  the single representation: one vector of c_token numbers for each of N_tokens tokens
//                z  the pair representation: one vector of c_z numbers for each pair of tokens (i, j)
//   atom level   q  the same for atoms: one vector of c_atom numbers for each of N_atoms atoms
//                p  one vector of c_atompair numbers for each pair of atoms (l, m)
//
// The channel sizes are the ones the supplement gives for the input embedder (Suppl. Alg. 1 and Alg. 2/5: c_token = 384,
// c_z = 128, c_atom = 128, c_atompair = 16). The cell counts are not: the grids are a schematic, drawn with more atoms than
// tokens, and not to scale. Colours match the architecture map and the tensors table (s pink, z light blue, q purple, p blue).
//
// Steps: 1 s · 2 z · 3 q · 4 p. Each tensor builds in (columns one at a time, or the pair grid filling from the corner, then
// its depth), gets its dimension labels, then one vector is highlighted with a short caption.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const mix = (hex, k) => {   // k > 0 towards white, k < 0 towards black
  const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255];
  return `#${c.map((x) => Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k)).toString(16).padStart(2, '0')).join('')}`;
};
const LINE = 'rgba(0,0,0,.3)';   // grid lines: the fills are pastel in both themes, so the lines are dark in both

// geometry of the four tensors, in map units (the map is 1000 x 470)
const S = { comp: 's', letter: 's', color: '#f2b8e6', x0: 240, y0: 62, cols: 5, rows: 7, cw: 22, ch: 22, hi: 2,
  across: 'N_{\\mathrm{tokens}}', down: 'c_{\\mathrm{token}} = 384', note: ['one vector', 'per token'] };
const Z = { comp: 'z', letter: 'z', color: '#a9d8f2', x0: 650, y0: 100, cols: 4, rows: 4, cw: 26, ch: 26, dx: 26, dy: -26, hi: [1, 2],
  across: 'N_{\\mathrm{tokens}}', down: 'N_{\\mathrm{tokens}}', depth: 'c_z = 128', note: ['one vector', 'per pair $(i, j)$'] };
const Q = { comp: 'q', letter: 'q', color: '#c27bc9', x0: 210, y0: 306, cols: 9, rows: 5, cw: 20, ch: 20, hi: 4,
  across: 'N_{\\mathrm{atoms}}', down: 'c_{\\mathrm{atom}} = 128', note: ['one vector', 'per atom'] };
const P = { comp: 'p', letter: 'p', color: '#1a8fd0', x0: 636, y0: 314, cols: 9, rows: 9, cw: 14, ch: 14, dx: 10, dy: -10, hi: [3, 5],
  across: 'N_{\\mathrm{atoms}}', down: 'N_{\\mathrm{atoms}}', depth: 'c_{\\mathrm{atompair}} = 16', note: ['one vector', 'per pair of atoms'] };

AF3.kinds.representations = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .rp-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 15%; }
      .rp-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .rp-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .rp-t.muted { fill: var(--muted); }
      .rp-t.acc { fill: var(--accent); font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // every drawn thing is registered with the tensor it belongs to (s / z / q / p) and the span of that tensor's progress over
    // which it fades in
    const meta = [];
    const reg = (tag, attrs, comp, a, b, inner = '') => {
      meta.push({ comp, a, b });
      return `<${tag} data-k="${meta.length - 1}" ${attrs} opacity="0">${inner}</${tag}>`;
    };
    // a formula (the tensor's letter, a size) in KaTeX, registered like the other pieces; rot: turned a quarter, to run up a bracket
    const mathBox = (x, y, size, src, o, comp, a, b, rot = '') => reg('foreignObject', AF3.foAttrs(rot ? 0 : x, rot ? 0 : y, size, o) + rot, comp, a, b, AF3.foInner(AF3.tex(src), size, o));
    const text = (x, y, size, cls, comp, a, b, str, extra = '') =>
      reg('text', `x="${x}" y="${y}" font-size="${size}" class="rp-t ${cls}" ${extra}`, comp, a, b, str);
    const poly = (pts, fill, comp, a, b) => reg('polygon', `points="${pts.map((p) => p.join(',')).join(' ')}" fill="${fill}" stroke="${LINE}" stroke-width="1"`, comp, a, b);
    const seg = (x1, y1, x2, y2, comp, a, b, stroke = LINE, w = 1) => reg('path', `d="M${x1} ${y1} L${x2} ${y2}" stroke="${stroke}" stroke-width="${w}" fill="none"`, comp, a, b);
    const brace = (pts, comp, a, b) => reg('path', `d="M${pts.map((p) => p.join(' ')).join(' L')}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`, comp, a, b);
    const note = (T, x, y, a, b) => {   // two lines, the first centred on y (the second may hold a symbol: $(i, j)$)
      const html = `<div style="line-height:24px;text-align:left">${T.note.map((l) => AF3.rich(l, esc)).join('<br>')}</div>`;
      return reg('foreignObject', AF3.foAttrs(x, y + 12, 20, { anchor: 'start', w: 260 }), T.comp, a, b, AF3.foInner(html, 20, { anchor: 'start', accent: true, bold: true }));
    };
    const bracketsAndLabels = (T, W, H, a, b) => {
      const { x0, y0 } = T, yb = y0 + H + 8, xl = x0 - 8;
      let g = brace([[x0, yb - 4], [x0, yb], [x0 + W, yb], [x0 + W, yb - 4]], T.comp, a, b)
        + mathBox(x0 + W / 2, yb + 17, 19, T.across, {}, T.comp, a, b)
        + brace([[xl + 4, y0], [xl, y0], [xl, y0 + H], [xl + 4, y0 + H]], T.comp, a, b)
        + mathBox(0, 0, 19, T.down, {}, T.comp, a, b, ` transform="translate(${xl - 14} ${y0 + H / 2}) rotate(-90)"`);
      return g;
    };

    // a flat tensor (s, q): one column per token or atom, rows for the channels
    const flat = (T) => {
      const { x0, y0, cols, rows, cw, ch, color } = T, W = cols * cw, H = rows * ch;
      let g = mathBox(x0 + W / 2, y0 - 24, 35, T.letter, { color: `color-mix(in srgb, ${color} 55%, var(--fg))`, w: 80 }, T.comp, 0, 0.1);
      for (let c = 0; c < cols; c++) {
        const a = 0.08 + 0.4 * (c / (cols - 1)), b = a + 0.12;
        g += reg('rect', `x="${x0 + c * cw}" y="${y0}" width="${cw}" height="${H}" fill="${color}" stroke="${LINE}" stroke-width="1"`, T.comp, a, b);
        for (let r = 1; r < rows; r++) g += seg(x0 + c * cw, y0 + r * ch, x0 + (c + 1) * cw, y0 + r * ch, T.comp, a, b);
      }
      g += bracketsAndLabels(T, W, H, 0.6, 0.74);
      g += reg('rect', `x="${x0 + T.hi * cw}" y="${y0}" width="${cw}" height="${H}" fill="var(--accent)" fill-opacity=".3" stroke="var(--accent)" stroke-width="3"`, T.comp, 0.76, 0.86);
      g += note(T, x0 + W + 22, y0 + H / 2 - 12, 0.86, 0.98);
      return g;
    };

    // a pair tensor (z, p): a grid over pairs, with the channels as depth behind it
    const cube = (T) => {
      const { x0, y0, cols, rows, cw, ch, color, dx, dy } = T, W = cols * cw, H = rows * ch, layers = 3;
      let g = mathBox(x0 + (W + dx) / 2, y0 + dy - 24, 35, T.letter, { color: `color-mix(in srgb, ${color} 55%, var(--fg))`, w: 80 }, T.comp, 0, 0.1);
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        const a = 0.08 + 0.36 * ((c + r) / (cols + rows - 2)), b = a + 0.14;
        g += reg('rect', `x="${x0 + c * cw}" y="${y0 + r * ch}" width="${cw}" height="${ch}" fill="${color}" stroke="${LINE}" stroke-width="1"`, T.comp, a, b);
      }
      // the depth: the top and right faces, with a line for each channel layer
      g += poly([[x0, y0], [x0 + dx, y0 + dy], [x0 + W + dx, y0 + dy], [x0 + W, y0]], mix(color, 0.3), T.comp, 0.5, 0.64);
      g += poly([[x0 + W, y0], [x0 + W + dx, y0 + dy], [x0 + W + dx, y0 + H + dy], [x0 + W, y0 + H]], mix(color, -0.14), T.comp, 0.5, 0.64);
      for (let k = 1; k < layers; k++) {
        const ox = (dx * k) / layers, oy = (dy * k) / layers;
        g += seg(x0 + ox, y0 + oy, x0 + W + ox, y0 + oy, T.comp, 0.52, 0.66)
          + seg(x0 + W + ox, y0 + oy, x0 + W + ox, y0 + H + oy, T.comp, 0.52, 0.66);
      }
      g += bracketsAndLabels(T, W, H, 0.64, 0.76);
      // the depth label, along the depth edge at the bottom right
      const bx = x0 + W + 8, by = y0 + H + 8;
      g += brace([[bx, by], [bx + dx, by + dy]], T.comp, 0.64, 0.76)
        + mathBox(bx + dx + 10, by + dy + 2, 19, T.depth, { anchor: 'start' }, T.comp, 0.64, 0.76);
      const [hc, hr] = T.hi;
      g += reg('rect', `x="${x0 + hc * cw}" y="${y0 + hr * ch}" width="${cw}" height="${ch}" fill="var(--accent)" fill-opacity=".35" stroke="var(--accent)" stroke-width="3"`, T.comp, 0.78, 0.88);
      g += note(T, x0 + W + dx + 34, y0 + H / 2 - 28 + dy / 2, 0.86, 0.98);
      return g;
    };

    const rowLabel = (str, y, comp) => text(0, y, 24, '', comp, 0, 0.12, str, 'font-weight="700"');
    const head = (str, x, comp) => text(x, 14, 26, 'muted', comp, 0, 0.12, str, 'text-anchor="middle" font-weight="700"');
    const svg = `<svg viewBox="0 0 1000 470" role="img" aria-label="The single and pair representations at token level and at atom level, built up one at a time">
      ${head('single representation', S.x0 + (S.cols * S.cw) / 2, 's')}${head('pair representation', Z.x0 + (Z.cols * Z.cw + Z.dx) / 2, 'z')}
      ${rowLabel('token-level', 140, 's')}${rowLabel('atom-level', 366, 'q')}
      ${flat(S)}${cube(Z)}${flat(Q)}${cube(P)}</svg>`;
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="rp-wrap">${svg}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;

    const els = [...frame.querySelectorAll('[data-k]')];
    const draw = (st) => els.forEach((el) => { const m = meta[+el.dataset.k]; el.setAttribute('opacity', ramp(st[m.comp], m.a, m.b).toFixed(3)); });
    const stateOf = (step) => ({ s: step >= 1 ? 1 : 0, z: step >= 2 ? 1 : 0, q: step >= 3 ? 1 : 0, p: step >= 4 ? 1 : 0 });
    const KEYS = ['s', 'z', 'q', 'p'];
    let cur = { s: 0, z: 0, q: 0, p: 0 }, raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 3200, 3600, 3200, 3600][step], t0 = performance.now();
        return new Promise((done) => {
          const tick = (now) => {
            const u = Math.min(1, (now - t0) / ms);
            cur = Object.fromEntries(KEYS.map((k) => [k, from[k] + (to[k] - from[k]) * u]));
            draw(cur);
            if (u < 1) raf = requestAnimationFrame(tick); else done();
          };
          raf = requestAnimationFrame(tick);
        });
      },
      leave() { cancelAnimationFrame(raf); },
      destroy() { cancelAnimationFrame(raf); },
    };
  },
});
}
