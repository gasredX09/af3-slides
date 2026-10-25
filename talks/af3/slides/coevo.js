// "Why? Coevolution!!" (slide 21): the picture of the original (contacts in proteins, a multiple sequence alignment, and the
// loop between them; the Institute for Protein Design's figure) redrawn natively and built up in four clicks, one per piece of
// the sentence it carried:
//
//   1  "Important contacts in proteins": the four kinds of contact, as small cartoons (within a chain, mediated by a ligand,
//      between chains, and one that forms when the shape changes), the two residues in contact marked i and j
//   2  "...are evolutionarily conserved and encoded in a multiple sequence alignment": the alignment appears (rows are species,
//      columns are positions), and an arrow carries the contacts to it
//   3  "...due to co-evolution": columns i and j change together, each big residue in one with a small one in the other
//   4  "By measuring coevolution, we can infer important contacts in proteins!": an arrow carries it back, and the contacts
//      light up
//
// The sequences are made up (the References slide says so); the cartoons are schematics, not structures. The claim itself is
// the original slide's, and matches what the AlphaFold 2 paper says of the evolutionary signal: "pairwise evolutionary
// correlations" constrain the structure (Jumper et al. 2021). The source is on the References slide.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const BIG = new Set('WFRYKH'), SMALL = new Set('GAS');   // the residue sizes the two coloured columns play on
const BIG_FILL = '#f4b26b', SMALL_FILL = '#8ebaf0', INK = '#1d2129';   // pastel fills with dark ink, in both themes
const MSA = [   // made-up, rows are species; columns 2 (i) and 5 (j) are the pair that changes together
  ['human', 'M', 'E', 'R', 'T', 'L', 'S', 'E'],
  ['fish', 'M', 'D', 'A', 'T', 'I', 'F', 'E'],
  ['starfish', 'M', 'E', 'W', 'S', 'L', 'G', 'D'],
  ['cat', 'M', 'E', 'G', 'T', 'V', 'R', 'E'],
  ['frog', 'M', 'D', 'F', 'T', 'L', 'A', 'E'],
];
const COL_I = 2, COL_J = 5, CELL_W = 48, CELL_H = 32, GX = 480, GY = 118;   // the grid's corner, in map units

const CAPTIONS = [
  'Important <b>contacts</b> in proteins',
  '…are evolutionarily conserved and encoded in a multiple sequence alignment',
  '…due to <b>co-evolution</b>',
  'By measuring coevolution, we can <b>infer</b> important contacts in proteins!',
];

AF3.kinds.coevolution = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc, palette: P }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .co-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 14.5%; }
      .co-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .co-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .co-t.muted { fill: var(--muted); }
      .co-caps { position: absolute; left: 4.2%; right: 4.2%; top: 80%; height: 12%; }
      .co-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-body); line-height: 1.25; font-weight: 600; }
      .co-cap b { color: var(--accent); }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const I = P.rainbow[4], J = 'var(--accent)';   // the two residues of a contact, and their two columns

    // every drawn thing is registered with the step it belongs to (a-d) and the span of that step's progress over which it
    // appears; mode 'fade' fades in, 'dash' draws a line from its start
    const meta = [];
    const reg = (tag, attrs, comp, a, b, mode = 'fade', inner = '') => {
      meta.push({ comp, a, b, mode });
      const extra = mode === 'dash' ? ' pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"' : '';
      return `<${tag} data-k="${meta.length - 1}" ${attrs}${extra} opacity="0">${inner}</${tag}>`;
    };
    const text = (x, y, size, str, comp, a, b, o = {}) =>
      reg('text', `x="${x}" y="${y}" font-size="${size}" class="co-t${o.cls ? ' ' + o.cls : ''}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''}`, comp, a, b, 'fade', str);
    // an arrow along a polyline: the shaft is drawn on, then the head fades in at the tip
    const arrow = (pts, comp, a, b, color = 'var(--muted)', w = 3) => {
      const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[pts.length - 2], d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
      const base = [x2 - ux * 12, y2 - uy * 12], path = pts.slice(0, -1).concat([base]);
      const head = [[x2, y2], [base[0] - uy * 7, base[1] + ux * 7], [base[0] + uy * 7, base[1] - ux * 7]], mid = a + (b - a) * 0.8;
      return reg('path', `d="M${path.map((p) => p.join(' ')).join(' L')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round"`, comp, a, mid, 'dash')
        + reg('polygon', `points="${head.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${color}"`, comp, mid, b);
    };
    const chain = (d, a, b) => reg('path', `d="${d}" fill="none" stroke="var(--muted)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`, 'a', a, b);
    const dot = (x, y, a, b) => reg('circle', `cx="${x}" cy="${y}" r="4" fill="var(--muted)"`, 'a', a, b);
    const residue = (x, y, name, color, a, b) => reg('circle', `cx="${x}" cy="${y}" r="10" fill="${color}"`, 'a', a, b)
      + text(x, y + 1, 13, name, 'a', a, b, { anchor: 'middle', bold: true, fill: '#ffffff' });
    // a contact: dashed and grey while it is the subject (step a), solid and green once it is inferred (step d)
    const contact = (x1, y1, x2, y2, a, b) => reg('path', `d="M${x1} ${y1} L${x2} ${y2}" stroke="var(--muted)" stroke-width="2.5" stroke-dasharray="5 4" fill="none"`, 'a', a, b)
      + reg('path', `d="M${x1} ${y1} L${x2} ${y2}" stroke="var(--done)" stroke-width="5" stroke-linecap="round" fill="none"`, 'd', 0.1, 0.45);

    let g = '';
    // ---- step a: the left panel, four kinds of contact ----
    g += reg('rect', 'x="0" y="40" width="400" height="300" rx="14" fill="color-mix(in srgb, var(--done) 9%, transparent)" stroke="color-mix(in srgb, var(--done) 55%, transparent)" stroke-width="2"', 'a', 0, 0.12);
    const U = (ox, oy) => `M${ox + 55} ${oy + 14} L${ox + 55} ${oy + 66} Q${ox + 55} ${oy + 98} ${ox + 100} ${oy + 98} Q${ox + 145} ${oy + 98} ${ox + 145} ${oy + 66} L${ox + 145} ${oy + 14}`;
    const caption = (str, ox, oy, a, b) => text(ox + 100, oy + 133, 16, str, 'a', a, b, { anchor: 'middle' });
    // within a chain
    let a = 0.1, b = 0.3, ox = 0, oy = 40;
    g += chain(U(ox, oy), a, b);
    [[55, 22], [55, 68], [100, 98], [145, 68], [145, 22]].forEach(([x, y]) => { g += dot(ox + x, oy + y, a, b); });
    g += contact(ox + 65, oy + 44, ox + 135, oy + 44, a + 0.05, b) + residue(ox + 55, oy + 44, 'i', I, a, b) + residue(ox + 145, oy + 44, 'j', J, a, b) + caption('within', ox, oy, a, b);
    // mediated by a ligand
    a = 0.3; b = 0.5; ox = 200;
    g += chain(U(ox, oy), a, b);
    [[55, 22], [55, 68], [100, 98], [145, 68], [145, 22]].forEach(([x, y]) => { g += dot(ox + x, oy + y, a, b); });
    g += reg('ellipse', `cx="${ox + 100}" cy="${oy + 44}" rx="17" ry="14" fill="${P.series[1]}"`, 'a', a, b);
    g += contact(ox + 65, oy + 44, ox + 83, oy + 44, a + 0.05, b) + contact(ox + 117, oy + 44, ox + 135, oy + 44, a + 0.05, b);
    g += residue(ox + 55, oy + 44, 'i', I, a, b) + residue(ox + 145, oy + 44, 'j', J, a, b) + caption('mediated by ligand', ox, oy, a, b);
    // between two chains
    a = 0.5; b = 0.7; ox = 0; oy = 190;
    g += chain(`M${ox + 52} ${oy + 12} L${ox + 44} ${oy + 34} L${ox + 60} ${oy + 56} L${ox + 44} ${oy + 78} L${ox + 52} ${oy + 100}`, a, b);
    g += chain(`M${ox + 148} ${oy + 12} L${ox + 156} ${oy + 34} L${ox + 140} ${oy + 56} L${ox + 156} ${oy + 78} L${ox + 148} ${oy + 100}`, a, b);
    g += contact(ox + 70, oy + 56, ox + 130, oy + 56, a + 0.05, b) + residue(ox + 60, oy + 56, 'i', I, a, b) + residue(ox + 140, oy + 56, 'j', J, a, b) + caption('between', ox, oy, a, b);
    // a contact that forms when the shape changes: open, an arrow, closed
    a = 0.7; b = 0.9; ox = 200;
    g += chain(`M${ox + 2} ${oy + 14} L${ox + 46} ${oy + 98} L${ox + 90} ${oy + 14}`, a, b);
    g += chain(`M${ox + 143} ${oy + 14} L${ox + 143} ${oy + 66} Q${ox + 143} ${oy + 98} ${ox + 158} ${oy + 98} Q${ox + 173} ${oy + 98} ${ox + 173} ${oy + 66} L${ox + 173} ${oy + 14}`, a, b);
    g += reg('path', `d="M${ox + 100} ${oy + 52} L${ox + 110} ${oy + 52}" stroke="var(--fg)" stroke-width="3" fill="none"`, 'a', a, b)
      + reg('polygon', `points="${ox + 120},${oy + 52} ${ox + 111},${oy + 46} ${ox + 111},${oy + 58}" fill="var(--fg)"`, 'a', a, b);
    g += contact(ox + 153, oy + 44, ox + 163, oy + 44, a + 0.05, b);
    g += residue(ox + 14, oy + 38, 'i', I, a, b) + residue(ox + 78, oy + 38, 'j', J, a, b) + residue(ox + 143, oy + 44, 'i', I, a, b) + residue(ox + 173, oy + 44, 'j', J, a, b);
    g += caption('conformational change', ox, oy, a, b);

    // ---- step b: the alignment, and the arrow that carries the contacts to it ----
    g += arrow([[200, 40], [200, 8], [735, 8], [735, 40]], 'b', 0, 0.35);
    g += text(735, 58, 22, 'Multiple Sequence Alignment', 'b', 0.3, 0.45, { anchor: 'middle', bold: true });
    MSA.forEach((row, r) => {
      const a0 = 0.4 + r * 0.11, b0 = a0 + 0.14, y = GY + r * CELL_H;
      g += text(GX + 7 * CELL_W + 14, y + CELL_H / 2, 18, row[0], 'b', a0, b0, { cls: 'muted' });
      for (let c = 0; c < 7; c++) {
        g += reg('rect', `x="${GX + c * CELL_W + 2}" y="${y + 2}" width="${CELL_W - 4}" height="${CELL_H - 4}" rx="4" fill="color-mix(in srgb, var(--fg) 7%, transparent)" stroke="color-mix(in srgb, var(--muted) 30%, transparent)" stroke-width="1"`, 'b', a0, b0);
        g += text(GX + c * CELL_W + CELL_W / 2, y + CELL_H / 2 + 1, 20, row[c + 1], 'b', a0, b0, { anchor: 'middle', bold: true });
      }
    });

    // ---- step c: columns i and j change together ----
    const colX = (c) => GX + c * CELL_W;
    [[COL_I, I, 'i'], [COL_J, J, 'j']].forEach(([c, color, name]) => {
      g += reg('rect', `x="${colX(c) - 1}" y="${GY - 3}" width="${CELL_W + 2}" height="${5 * CELL_H + 6}" rx="8" fill="none" stroke="${color}" stroke-width="3"`, 'c', 0, 0.15);
      g += text(colX(c) + CELL_W / 2, GY + 5 * CELL_H + 22, 20, name, 'c', 0.05, 0.2, { anchor: 'middle', bold: true, fill: color });
      MSA.forEach((row, r) => {
        const ch = row[c + 1], a0 = 0.18 + r * 0.1, b0 = a0 + 0.14, y = GY + r * CELL_H, fill = BIG.has(ch) ? BIG_FILL : SMALL_FILL;
        g += reg('rect', `x="${colX(c) + 2}" y="${y + 2}" width="${CELL_W - 4}" height="${CELL_H - 4}" rx="4" fill="${fill}" stroke="${color}" stroke-width="1.5"`, 'c', a0, b0);
        g += text(colX(c) + CELL_W / 2, y + CELL_H / 2 + 1, 20, ch, 'c', a0, b0, { anchor: 'middle', bold: true, fill: INK });
      });
    });
    const xi = colX(COL_I) + CELL_W / 2, xj = colX(COL_J) + CELL_W / 2;
    g += reg('path', `d="M${xi} ${GY - 6} L${xi} ${GY - 24} L${xj} ${GY - 24} L${xj} ${GY - 6}" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linejoin="round"`, 'c', 0.6, 0.8);
    g += text((xi + xj) / 2, GY - 36, 17, 'change together', 'c', 0.7, 0.9, { anchor: 'middle', bold: true, fill: 'var(--accent)' });
    const ly = GY + 5 * CELL_H + 54;
    g += reg('rect', `x="${GX}" y="${ly - 9}" width="18" height="18" rx="4" fill="${BIG_FILL}"`, 'c', 0.7, 0.9) + text(GX + 26, ly + 1, 17, 'big residue', 'c', 0.7, 0.9, { cls: 'muted' });
    g += reg('rect', `x="${GX + 150}" y="${ly - 9}" width="18" height="18" rx="4" fill="${SMALL_FILL}"`, 'c', 0.7, 0.9) + text(GX + 176, ly + 1, 17, 'small residue', 'c', 0.7, 0.9, { cls: 'muted' });

    // ---- step d: the arrow back, and the contacts light up (the green lines are in step a's cartoons) ----
    g += arrow([[735, ly + 22], [735, 376], [200, 376], [200, 346]], 'd', 0, 0.5, 'var(--done)', 4);

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="co-wrap"><svg viewBox="0 0 1000 384" role="img" aria-label="Contacts in proteins are encoded in an alignment of related sequences through co-evolution, and measuring the co-evolution lets us infer the contacts">${g}</svg></div>
      <div class="co-caps">${CAPTIONS.map((c, i) => `<p class="co-cap reveal-in" data-show="${i + 1}">${c}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;

    const els = [...frame.querySelectorAll('[data-k]')];
    const draw = (st) => els.forEach((el) => {
      const m = meta[+el.dataset.k], r = ramp(st[m.comp], m.a, m.b);
      if (m.mode === 'dash') { el.setAttribute('stroke-dashoffset', (1 - r).toFixed(3)); el.setAttribute('opacity', r > 0 ? '1' : '0'); }
      else el.setAttribute('opacity', r.toFixed(3));
    });
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
        const ms = [0, 4200, 4200, 3800, 3000][step], t0 = performance.now();
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
