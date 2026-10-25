// "Resulting Input Embeddings" (slide 28): the picture of the original (seven tensors in a grid of three columns, with their
// shapes) redrawn natively and built up a group at a time, with the shape of each tensor under it:
//
//   1  information about related sequences and their structures: the MSA, m, and the structure templates, t
//   2  information about all the atoms ("single"): the original atom-level single representation c, and the updated one q
//   3  information about all the pairs of atoms ("pair"): the atom-level pair representation p
//   4  the same two kinds of information at the level of tokens: the token-level single representation s and pair representation z
//
// Colours and names match slide 17 and the architecture map (m orange, t green, q and c purple, p blue, s pink, z light blue). The
// shapes are the original figure's, with one change: the templates are N_templates x N_tokens x N_tokens x c_t, because the
// supplement's template embedder (Alg. 16) loops over the templates, where the original figure had them stacked into the channels
// (c_t * N_templates). The cell counts are a schematic, not to scale.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const rgb = (hex) => { const v = parseInt(hex.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const shade = (h, k) => hex(rgb(h).map((x) => (k > 0 ? x + (255 - x) * k : x * (1 + k))));   // k > 0 lighter, k < 0 darker
const lum = (h) => { const [r, g, b] = rgb(h).map((x) => x / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ink = (h) => (lum(h) > 0.55 ? '#1d2129' : '#ffffff');
const LINE = 'rgba(0,0,0,.3)';
const COLOR = { m: '#f7b97c', t: '#3e9b7a', c: '#d9a6de', q: '#c27bc9', p: '#1a8fd0', s: '#f2b8e6', z: '#a9d8f2' };

AF3.kinds.embeddings = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .em-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .em-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .em-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .em-t.muted { fill: var(--muted); }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // every drawn thing is registered with the step it belongs to (a-d) and the span of that step's progress over which it fades in
    const meta = [];
    const reg = (tag, attrs, comp, a, b, inner = '') => {
      meta.push({ comp, a, b });
      return `<${tag} data-k="${meta.length - 1}" ${attrs} opacity="0">${inner}</${tag}>`;
    };
    const text = (x, y, size, str, comp, a, b, o = {}) =>
      reg('text', `x="${x}" y="${y}" font-size="${size}" class="em-t${o.cls ? ' ' + o.cls : ''}" text-anchor="middle"${o.bold ? ' font-weight="700"' : ''}`, comp, a, b, str);
    // a formula in KaTeX, registered like the other pieces (it fades in with them)
    const mathBox = (x, y, size, src, o, comp, a, b) => reg('foreignObject', AF3.foAttrs(x, y, size, o), comp, a, b, AF3.foInner(AF3.tex(src), size, o));
    const letter = (k, x, y, comp, a, b) => mathBox(x, y + 1, 29, k, { color: ink(COLOR[k]), w: 60 }, comp, a, b);
    // a flat tensor (c, q, s) and a cube (m, t, p, z): x0, y0 the front face's corner
    const flat = (k, x0, y0, w, h, cols, rows, comp, a) => {
      let g = '';
      for (let i = 1; i < cols; i++) g += `M${x0 + (i * w) / cols} ${y0} V${y0 + h} `;
      for (let j = 1; j < rows; j++) g += `M${x0} ${y0 + (j * h) / rows} H${x0 + w} `;
      return reg('rect', `x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${COLOR[k]}" stroke="${LINE}" stroke-width="1"`, comp, a, a + 0.2)
        + reg('path', `d="${g}" stroke="${LINE}" stroke-width="1" fill="none"`, comp, a, a + 0.2) + letter(k, x0 + w / 2, y0 + h / 2, comp, a + 0.16, a + 0.3);
    };
    const cube = (k, x0, y0, w, h, n, dx, dy, comp, a) => {
      let g = '';
      for (let i = 1; i < n; i++) g += `M${x0 + (i * w) / n} ${y0} V${y0 + h} M${x0} ${y0 + (i * h) / n} H${x0 + w} `;
      return reg('rect', `x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${COLOR[k]}" stroke="${LINE}" stroke-width="1"`, comp, a, a + 0.18)
        + reg('path', `d="${g}" stroke="${LINE}" stroke-width="1" fill="none"`, comp, a, a + 0.18)
        + reg('polygon', `points="${x0},${y0} ${x0 + dx},${y0 + dy} ${x0 + w + dx},${y0 + dy} ${x0 + w},${y0}" fill="${shade(COLOR[k], 0.3)}" stroke="${LINE}" stroke-width="1"`, comp, a + 0.16, a + 0.34)
        + reg('polygon', `points="${x0 + w},${y0} ${x0 + w + dx},${y0 + dy} ${x0 + w + dx},${y0 + h + dy} ${x0 + w},${y0 + h}" fill="${shade(COLOR[k], -0.14)}" stroke="${LINE}" stroke-width="1"`, comp, a + 0.16, a + 0.34)
        + letter(k, x0 + w / 2, y0 + h / 2, comp, a + 0.2, a + 0.34);
    };
    const head = (lines, x, comp, a) => lines.map((l, i) => text(x, 16 + i * 25, 20, l, comp, a, a + 0.15, { bold: true })).join('');
    const label = (lines, x, y, comp, a) => lines.map((l, i) => text(x, y + i * 21, 17.5, l, comp, a, a + 0.15)).join('');
    const dims = (src, x, y, comp, a) => mathBox(x, y, 17.5, src, { muted: true, w: 300 }, comp, a, a + 0.15);

    let g = '';
    // ---- step a: related sequences and their structures ----
    g += head(['Information about related', 'sequences and their structures'], 150, 'a', 0);
    g += label(['Multiple Sequence Alignment'], 150, 92, 'a', 0.12);
    g += cube('m', 92, 132, 96, 74, 4, 22, -18, 'a', 0.2);
    g += dims('N_{\\mathrm{MSA}} \\times N_{\\mathrm{tokens}} \\times c_m', 150, 250, 'a', 0.55);
    g += label(['Structure Templates'], 150, 300, 'a', 0.5);
    g += cube('t', 100, 346, 84, 84, 4, 22, -18, 'a', 0.58);
    g += dims('N_{\\mathrm{templates}} \\times N_{\\mathrm{tokens}} \\times N_{\\mathrm{tokens}} \\times c_t', 150, 462, 'a', 0.85);
    // ---- step b: all the atoms, single ----
    g += head(['Information about all the', 'atoms (“single”)'], 505, 'b', 0);
    g += label(['Original Atom-Level', 'Single Representation'], 390, 82, 'b', 0.1);
    g += flat('c', 320, 126, 140, 100, 6, 4, 'b', 0.18);
    g += dims('N_{\\mathrm{atoms}} \\times c_{\\mathrm{atom}}', 390, 252, 'b', 0.42);
    g += reg('path', 'd="M470 176 L520 176" stroke="var(--muted)" stroke-width="3" stroke-linecap="round" fill="none"', 'b', 0.5, 0.62)
      + reg('polygon', 'points="532,176 519,169 519,183" fill="var(--muted)"', 'b', 0.58, 0.68) + text(501, 156, 15.5, 'updated', 'b', 0.55, 0.7, { cls: 'muted' });
    g += label(['Updated Atom-Level', 'Single Representation'], 620, 82, 'b', 0.55);
    g += flat('q', 550, 126, 140, 100, 6, 4, 'b', 0.62);
    g += dims('N_{\\mathrm{atoms}} \\times c_{\\mathrm{atom}}', 620, 252, 'b', 0.85);
    // ---- step c: all the pairs of atoms ----
    g += head(['Information about all the', 'pairs of atoms (“pair”)'], 855, 'c', 0);
    g += label(['Atom-Level Pair Representation'], 855, 92, 'c', 0.15);
    g += cube('p', 790, 124, 110, 100, 7, 18, -16, 'c', 0.25);
    g += dims('N_{\\mathrm{atoms}} \\times N_{\\mathrm{atoms}} \\times c_{\\mathrm{atompair}}', 855, 252, 'c', 0.7);
    // ---- step d: the same at the level of tokens ----
    g += label(['Token-Level Single Representation'], 505, 300, 'd', 0);
    g += flat('s', 470, 330, 70, 100, 3, 6, 'd', 0.1);
    g += dims('N_{\\mathrm{tokens}} \\times c_{\\mathrm{token}}', 505, 462, 'd', 0.4);
    g += label(['Token-Level Pair Representation'], 855, 300, 'd', 0.35);
    g += cube('z', 812, 346, 84, 84, 4, 22, -18, 'd', 0.45);
    g += dims('N_{\\mathrm{tokens}} \\times N_{\\mathrm{tokens}} \\times c_z', 855, 462, 'd', 0.8);

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="em-wrap"><svg viewBox="0 0 1000 476" role="img" aria-label="The tensors the input embedder produces: the MSA and templates, the atom-level single and pair representations, and the token-level single and pair representations, shown a group at a time">${g}</svg></div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;

    const els = [...frame.querySelectorAll('[data-k]')];
    const draw = (st) => els.forEach((el) => { const m = meta[+el.dataset.k]; el.setAttribute('opacity', ramp(st[m.comp], m.a, m.b).toFixed(3)); });
    const KEYS = ['a', 'b', 'c', 'd'];
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 3600, 3600, 2800, 3200][step], t0 = performance.now();
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
