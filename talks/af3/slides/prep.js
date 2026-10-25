// "Input Preparation Overview" (slide 18, and slide 24 with the input embedder lit and a longer title): the flow diagram of the
// original (one picture) redrawn natively and built up a
// click at a time, with the five notes that sat on its arrows now a caption under it, one per click (they were too small to
// read, and ran over the figure).
//
//   1  the starting sequence(s) -> "search protein, RNA, DNA databases for similar sequences" -> the similar sequences
//   2  "align sequences and combine MSAs for both molecules" -> the MSA (m)
//   3  "find structures for similar sequences and convert into distograms" -> the template distograms (t)
//   4  "concatenate sequences into single sequence, create atom-level embeddings of the single sequence and of local
//      pairwise distance constraints" -> the single and pair representations at atom level (q, p)
//   5  "convert atom-level embeddings to token-level embeddings and append evolutionary information from MSA" -> the
//      single and pair representations at token level (s, z); the MSA joins this arrow
//
// The captions and labels are the original figure's own words (after Simon, The Illustrated AlphaFold; the sources are on the
// References slide). Checked against the supplement: the MSA feeds the token-level single representation through its profile
// and deletion-mean features (Suppl. Alg. 2). Two things in the figure do not match the supplement, and are kept as the
// slide had them: genetic search has databases for protein and RNA chains only (Suppl. 2.2), not DNA, so the DNA-looking
// molecule 2 would have no similar sequences; and template search is for protein chains only (Suppl. 2.4). The cell counts of
// the tensors are a schematic, not to scale; their names and colours match slide 17 and the architecture map.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lum = (hex) => { const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => x / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ink = (hex) => (lum(hex) > 0.55 ? '#1d2129' : '#ffffff');
const mix = (hex, k) => {   // k > 0 towards white, k < 0 towards black
  const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255];
  return `#${c.map((x) => Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k)).toString(16).padStart(2, '0')).join('')}`;
};
const LINE = 'rgba(0,0,0,.3)';   // grid lines: the fills are pastel or mid-tone in both themes, so the lines are dark in both
const COLOR = { m: '#f7b97c', t: '#3e9b7a', q: '#c27bc9', p: '#1a8fd0', s: '#f2b8e6', z: '#a9d8f2' };

const CAPTIONS = [
  'Search protein, RNA, DNA databases for similar sequences',
  'Align sequences and combine MSAs for both molecules',
  'Find structures for similar sequences and convert into distograms',
  'Concatenate sequences into single sequence, create atom-level embeddings of the single sequence and of local pairwise distance constraints',
  'Convert atom-level embeddings to token-level embeddings and append evolutionary information from MSA',
];

AF3.kinds.inputprep = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .ip-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 14.5%; }
      .ip-long .ip-wrap { top: 20%; }   /* a heading of two lines pushes the drawing down, and the corner strip moves to the bottom right, beside the caption */
      .ip-long .ip-caps { top: 78.5%; right: 31%; height: 14%; }
      .ip-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ip-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .ip-t.muted { fill: var(--muted); }
      .ip-seq { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
      .ip-caps { position: absolute; left: 4.2%; right: 4.2%; top: 76%; height: 16%; }
      .ip-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // every drawn thing is registered with the step it belongs to (a-e) and the span of that step's progress over which it
    // appears; mode 'fade' fades in, 'dash' draws a line from its start
    const meta = [];
    const reg = (tag, attrs, comp, a, b, mode = 'fade', inner = '') => {
      meta.push({ comp, a, b, mode });
      const extra = mode === 'dash' ? ' pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"' : '';
      return `<${tag} data-k="${meta.length - 1}" ${attrs}${extra} opacity="0">${inner}</${tag}>`;
    };
    const text = (x, y, size, str, comp, a, b, o = {}) =>
      reg('text', `x="${x}" y="${y}" font-size="${size}" class="ip-t${o.cls ? ' ' + o.cls : ''}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''}`, comp, a, b, 'fade', str);
    // an arrow along a polyline: the shaft is drawn on, then the head fades in at the tip
    const arrow = (pts, comp, a, b) => {
      const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[pts.length - 2], d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
      const base = [x2 - ux * 8, y2 - uy * 8], path = pts.slice(0, -1).concat([base]);
      const head = [[x2, y2], [base[0] - uy * 4.5, base[1] + ux * 4.5], [base[0] + uy * 4.5, base[1] - ux * 4.5]];
      const mid = a + (b - a) * 0.8;
      return reg('path', `d="M${path.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linejoin="round"`, comp, a, mid, 'dash')
        + reg('polygon', `points="${head.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="var(--muted)"`, comp, mid, b);
    };
    // a symbol in KaTeX, registered like the other pieces (it fades in with them)
    const mathBox = (x, y, size, src, o, comp, a, b) => reg('foreignObject', AF3.foAttrs(x, y, size, o), comp, a, b, 'fade', AF3.foInner(AF3.tex(src), size, o));
    const letter = (k, x, y, comp, a, b) => mathBox(x, y + 1, 29, k, { color: ink(COLOR[k]), w: 60 }, comp, a, b);
    const label = (lines, x, y, comp, a, b, size = 18) => lines.map((l, i) => text(x, y + i * 22, size, l, comp, a, b, { anchor: 'middle', bold: true })).join('');

    // a flat tensor (q, s): cols x rows of cells, a letter in it
    const flat = (k, x0, y0, cols, rows, cell, comp, a) => {
      const W = cols * cell, H = rows * cell;
      let g = '';
      for (let i = 1; i < cols; i++) g += `M${x0 + i * cell} ${y0} V${y0 + H} `;
      for (let j = 1; j < rows; j++) g += `M${x0} ${y0 + j * cell} H${x0 + W} `;
      return reg('rect', `x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${COLOR[k]}" stroke="${LINE}" stroke-width="1"`, comp, a, a + 0.18)
        + reg('path', `d="${g}" stroke="${LINE}" stroke-width="1" fill="none"`, comp, a, a + 0.18)
        + letter(k, x0 + W / 2, y0 + H / 2, comp, a + 0.14, a + 0.26);
    };
    // a cube (m, t, z, p): a square front face of n x n cells, with its depth behind it
    const cube = (k, x0, y0, w, n, dx, dy, comp, a) => {
      const cell = w / n;
      let g = '';
      for (let i = 1; i < n; i++) g += `M${x0 + i * cell} ${y0} V${y0 + w} M${x0} ${y0 + i * cell} H${x0 + w} `;
      return reg('rect', `x="${x0}" y="${y0}" width="${w}" height="${w}" fill="${COLOR[k]}" stroke="${LINE}" stroke-width="1"`, comp, a, a + 0.16)
        + reg('path', `d="${g}" stroke="${LINE}" stroke-width="1" fill="none"`, comp, a, a + 0.16)
        + reg('polygon', `points="${x0},${y0} ${x0 + dx},${y0 + dy} ${x0 + w + dx},${y0 + dy} ${x0 + w},${y0}" fill="${mix(COLOR[k], 0.3)}" stroke="${LINE}" stroke-width="1"`, comp, a + 0.14, a + 0.3)
        + reg('polygon', `points="${x0 + w},${y0} ${x0 + w + dx},${y0 + dy} ${x0 + w + dx},${y0 + w + dy} ${x0 + w},${y0 + w}" fill="${mix(COLOR[k], -0.14)}" stroke="${LINE}" stroke-width="1"`, comp, a + 0.14, a + 0.3)
        + letter(k, x0 + w / 2, y0 + w / 2, comp, a + 0.18, a + 0.3);
    };

    // ---- the drawing, in map units (1000 x 350) ----
    const SEQ = 'font-size="17" class="ip-t ip-seq"';
    let g = '';
    // step a: the starting sequences, and the similar sequences found for them
    g += text(0, 140, 20, 'starting', 'a', 0, 0.12, { bold: true }) + text(0, 162, 20, 'sequence(s)', 'a', 0, 0.12, { bold: true });
    g += reg('text', `x="0" y="192" ${SEQ}`, 'a', 0.04, 0.14, 'fade', 'GQKFLADLR') + reg('text', `x="0" y="214" ${SEQ}`, 'a', 0.04, 0.14, 'fade', 'CGTACT');
    g += arrow([[138, 177], [158, 177], [158, 86], [196, 86]], 'a', 0.14, 0.4);
    g += reg('rect', 'x="200" y="6" width="230" height="168" rx="12" fill="color-mix(in srgb, var(--fg) 3%, transparent)" stroke="color-mix(in srgb, var(--muted) 38%, transparent)" stroke-width="1.5"', 'a', 0.38, 0.5);
    g += text(214, 30, 20, 'similar sequences', 'a', 0.46, 0.58, { bold: true });
    g += text(214, 58, 16, 'molecule 1', 'a', 0.54, 0.64, { cls: 'muted' }) + text(214, 76, 16, '(protein)', 'a', 0.54, 0.64, { cls: 'muted' });
    g += text(338, 58, 16, 'molecule 2', 'a', 0.54, 0.64, { cls: 'muted' });
    [['GQKFLAELR', 'CGTACT'], ['GQKFLVDLR', 'CCTACT'], ['GNKFLADLR', 'GGTGCT']].forEach(([p, n], i) => {
      const a = 0.62 + i * 0.1;
      g += reg('text', `x="214" y="${104 + i * 20}" ${SEQ}`, 'a', a, a + 0.1, 'fade', p) + reg('text', `x="338" y="${104 + i * 20}" ${SEQ}`, 'a', a, a + 0.1, 'fade', n);
    });
    g += reg('text', 'x="218" y="161" font-size="17" class="ip-t muted"', 'a', 0.92, 1, 'fade', '⋮') + reg('text', 'x="342" y="161" font-size="17" class="ip-t muted"', 'a', 0.92, 1, 'fade', '⋮');
    // step b: the MSA
    g += arrow([[438, 86], [512, 86]], 'b', 0, 0.3);
    g += cube('m', 520, 52, 70, 4, 18, -18, 'b', 0.3);
    g += label(['MSA'], 564, 146, 'b', 0.6, 0.8, 20);
    // step c: the template distograms, by an arrow that leaves the one into the MSA, over the top
    g += arrow([[462, 86], [462, 4], [748, 4], [748, 28]], 'c', 0, 0.5);
    g += cube('t', 700, 52, 70, 4, 18, -18, 'c', 0.5);
    g += label(['template', 'distograms'], 744, 142, 'c', 0.8, 0.95, 20);
    // step d: the atom-level single and pair representations
    g += arrow([[158, 177], [158, 240], [211, 240]], 'd', 0, 0.28);
    g += flat('q', 219, 206, 6, 4, 17, 'd', 0.26);
    g += cube('p', 420, 200, 80, 6, 18, -18, 'd', 0.5);
    g += label(['single representation', '(atom-level)'], 270, 312, 'd', 0.5, 0.65, 17);
    g += label(['pair representation', '(atom-level)'], 469, 312, 'd', 0.8, 0.95, 17);
    // step e: the conversion to token level, with the MSA joining it
    g += arrow([[532, 240], [626, 240]], 'e', 0, 0.3);
    g += arrow([[564, 158], [564, 236]], 'e', 0, 0.3);
    g += flat('s', 634, 189, 3, 6, 17, 'e', 0.3);
    g += cube('z', 814, 205, 70, 4, 18, -18, 'e', 0.52);
    g += label(['single representation', '(token-level)'], 660, 312, 'e', 0.62, 0.78, 17);
    g += label(['pair representation', '(token-level)'], 858, 312, 'e', 0.84, 1, 17);

    const long = AF3.plain(title.paras[0]).length > 48;   // two lines at the heading size
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="ip-wrap"><svg viewBox="0 0 1000 350" role="img" aria-label="Input preparation: sequences become an MSA, templates, and atom- then token-level single and pair representations, built up one stage at a time">${g}</svg></div>
      <div class="ip-caps">${CAPTIONS.map((c, i) => `<p class="ip-cap reveal-in" data-show="${i + 1}">${esc(c)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length, long ? 77.5 : undefined)}`;
    if (long) frame.classList.add('ip-long');

    const els = [...frame.querySelectorAll('[data-k]')];
    const draw = (st) => els.forEach((el) => {
      const m = meta[+el.dataset.k], r = ramp(st[m.comp], m.a, m.b);
      if (m.mode === 'dash') { el.setAttribute('stroke-dashoffset', (1 - r).toFixed(3)); el.setAttribute('opacity', r > 0 ? '1' : '0'); }
      else el.setAttribute('opacity', r.toFixed(3));
    });
    const KEYS = ['a', 'b', 'c', 'd', 'e'];
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 4200, 3000, 3600, 4200, 4200][step], t0 = performance.now();
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
