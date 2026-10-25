// "Recall AF2: Thank you Fareeda and Shiv" (slide 3): the slide's two AI-generated pictures (a card of four bullets, and a flow of protein sequence, MSA, Evoformer, predicted structure)
// redrawn natively and built up a click at a time, each click saying one of the four bullets. The title, its thanks and the doodle in the corner are kept.
//
//   1  the input: a protein sequence of amino acids ("Predicts a 3D protein structure from a protein sequence or protein complex. Input: protein sequence (amino acids)")
//   2  the MSA: related sequences from other species lined up, with two columns that change together
//   3  the key mechanism: the Evoformer, which uses the evolutionary information of the MSA (48 blocks, counted up)
//   4  the output: the predicted 3D structure, a chain that is drawn from its N end (blue) to its C end (red)
//
// What is drawn is the same MSA as slide 9 (the same nine residues and shading, a made-up example) so the two slides agree. The Evoformer has 48 blocks (Jumper et al. 2021, the
// Evoformer stack; the AF3 paper says the Pairformer's 48 blocks are "largely unchanged from AF2"). The sequences, the shading and the chain are made up, a fixed picture to show the shapes:
// an illustration, not data and not an AF2 prediction, and the slide says so.
{
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ramp = (p, a, b) => { const t = clamp01((p - a) / (b - a)); return t * t * (3 - 2 * t); };   // smoothstep
const mix = (c1, c2, t) => {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const ch = (sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
};
const INK = '#1d2129';                                      // pastel fills read the same in both themes, so the text on them is dark
const SEQC = ['#e3f0fa', '#6fb0dd'], MSAC = ['#fde6cc', '#ef9a4c'], EVO = { fill: '#d9d4ee', stroke: '#8f87c6' };
const ROWS = ['MWLKTGAEV', 'MWIRSGVDL', 'MWIKTNVEL', 'LWLRTGADI', 'MWIKSGVEL'];   // as on slide 9; the first is the query
const SHADE = { M: .35, W: .95, L: .55, I: .45, K: .75, R: .25, T: .6, S: .3, G: .5, N: .15, A: .7, V: .4, E: .8, D: .2, Q: .4, F: .85 };
const CHAIN_B = 'GQKFLADLR';                           // a second chain, for "or a protein complex"
const COVARY = [3, 7];                                      // the columns that change together
const W = 1000, H = 330, CW = 205, CX = [8, 265, 522, 779], CH = 300;
const HEAD = [['Protein sequence', 'amino acids'], ['MSA', 'evolutionary information'], ['Evoformer', 'AF2 model'], ['Predicted 3D', 'structure']];
const CAPTIONS = [
  'AF2 predicts a 3D protein structure from a protein sequence or a protein complex. Input: the protein sequence, a string of amino acids.',
  'A multiple sequence alignment (MSA) lines up related sequences from other species. It carries evolutionary information: some positions change together.',
  'Key mechanism: the Evoformer, which uses the evolutionary information from the MSA. It is a stack of 48 blocks.',
  'Output: the predicted 3D structure.',
];

// the chain of card 4: a folded path of 240 points from N to C, coiled (like a helix) along two stretches and loose between
const NCH = 240;
const CHAIN = (() => {
  const base = (t) => { const u = t * 4 * Math.PI; return [102 + 62 * Math.sin(u + 0.5) + 22 * Math.sin(3.1 * u), 172 + 66 * Math.cos(1.3 * u) + 20 * Math.cos(2.7 * u)]; };
  const coil = (t) => ramp(t, 0.1, 0.16) * (1 - ramp(t, 0.42, 0.48)) + ramp(t, 0.58, 0.64) * (1 - ramp(t, 0.88, 0.94));
  return Array.from({ length: NCH + 1 }, (_, k) => {
    const t = k / NCH, [x, y] = base(t), [x2, y2] = base(Math.min(1, t + 0.002)), [x1, y1] = base(Math.max(0, t - 0.002));
    const dx = x2 - x1, dy = y2 - y1, n = Math.hypot(dx, dy) || 1, a = 9 * coil(t) * Math.sin(t * 2 * Math.PI * 17);
    return [x - (dy / n) * a, y + (dx / n) * a];
  });
})();

AF3.kinds.recallaf2 = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.picCss + AF3.textCss + AF3.tagCss + `
      .pp-sub { font-size: .55em; font-weight: 400; color: var(--muted); margin-left: .4em; }
      .rc-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 21%; }
      .rc-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .rc-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .rc-t.muted { fill: var(--muted); }
      .rc-t.ink { fill: ${INK}; }
      .rc-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .rc-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const ACC = 'var(--accent)';
    const title = AF3.texts(s).slice().sort((a, b) => a.g.y - b.g.y)[0];
    const doodle = s.items.filter((i) => i.kind === 'pic' && i.g.y < 0.16 && i.g.x > 0.6);
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" class="rc-t${o.muted ? ' muted' : ''}${o.ink ? ' ink' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const arrow = (x1, y, x2, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><line x1="${x1}" y1="${y}" x2="${x2 - 8}" y2="${y}" stroke="var(--muted)" stroke-width="2.6"/><polygon points="${x2},${y} ${x2 - 12},${y - 7} ${x2 - 12},${y + 7}" fill="var(--muted)"/></g>`;
    const cell = (x, y, w, h, ch, pal, op, ring) => rect(x, y, w - 1.5, h - 1.5, mix(pal[0], pal[1], SHADE[ch]), ring ? ACC : 'none', ring ? 2.6 : 0, op, 3) + txt(x + (w - 1.5) / 2, y + (h - 1.5) / 2 + 1, 13.5, ch, op, { ink: true, bold: true });

    const draw = (st) => {
      const K = [0, st.k1, st.k2, st.k3, st.k4];
      let h = '';
      // ---- the four cards: frame and heading ----
      for (let i = 0; i < 4; i++) {
        const o = ramp(K[i + 1], 0, 0.25), x = CX[i];
        h += rect(x, 0, CW, CH, 'var(--bg)', 'var(--muted)', 1.6, o, 12);
        h += txt(x + CW / 2, 24, 18, HEAD[i][0], o, { bold: true });
        h += txt(x + CW / 2, 47, 13.5, HEAD[i][1], o, { muted: true });
        if (i > 0) h += arrow(CX[i - 1] + CW + 4, 150, x - 4, ramp(K[i + 1], 0, 0.3));
      }

      // ---- 1 the sequence: one chain of nine residues, and a second for a complex ----
      {
        const p = K[1], cs = 20, x0 = CX[0] + (CW - 9 * cs) / 2;
        [[ROWS[0], 100, 'chain A', 0.12], [CHAIN_B, 176, 'chain B', 0.42]].forEach(([row, y, lab, a]) => {
          h += txt(x0, y - 13, 13, lab, ramp(p, a, a + 0.2), { anchor: 'start', muted: true });
          for (let j = 0; j < 9; j++) h += cell(x0 + j * cs, y, cs, 28, row[j], SEQC, ramp(p, a + 0.04 + 0.04 * j, a + 0.2 + 0.04 * j));
          h += txt(x0 + 4, y + 42, 12.5, 'N', ramp(p, a + 0.3, a + 0.45), { muted: true }) + txt(x0 + 9 * cs - 4, y + 42, 12.5, 'C', ramp(p, a + 0.3, a + 0.45), { muted: true });
        });
        h += txt(CX[0] + CW / 2, 262, 13, 'one chain, or several in a complex', ramp(p, 0.7, 0.95), { muted: true });
      }

      // ---- 2 the MSA: five related sequences; two columns change together ----
      {
        const p = K[2], cw = 20, rh = 25, x0 = CX[1] + (CW - 9 * cw) / 2, y0 = 78;
        ROWS.forEach((row, r) => { for (let j = 0; j < 9; j++) h += cell(x0 + j * cw, y0 + r * rh, cw, rh, row[j], MSAC, ramp(p, 0.06 + 0.1 * r, 0.26 + 0.1 * r)); });
        const ro = ramp(p, 0.72, 0.95);
        COVARY.forEach((c) => { h += rect(x0 + c * cw - 1, y0 - 3, cw + 1, 5 * rh + 4, 'none', ACC, 2.6, ro, 4); });
        h += txt(CX[1] + CW / 2, y0 + 5 * rh + 24, 13, 'related sequences, one per row', ramp(p, 0.4, 0.6), { muted: true });
        h += txt(CX[1] + CW / 2, y0 + 5 * rh + 46, 14, 'change together', ro, { bold: true, fill: ACC });
      }

      // ---- 3 the Evoformer: a stack of blocks, counted up to 48 ----
      {
        const p = K[3], x0 = CX[2] + 36, bw = 134, bh = 92, y0 = 92, blocks = 1 + Math.floor(47 * ramp(p, 0.25, 0.85) + 0.0001), o = ramp(p, 0.1, 0.35);
        [2, 1, 0].forEach((k) => { h += rect(x0 + k * 7, y0 - k * 7, bw, bh, EVO.fill, EVO.stroke, 2, o, 12); });
        h += txt(x0 + bw / 2, y0 + bh / 2, 20, 'Evoformer', o, { ink: true, bold: true });
        const bo = ramp(p, 0.25, 0.45);
        h += txt(CX[2] + 36, 218, 14, 'block', bo, { anchor: 'start', muted: true }) + txt(CX[2] + 80, 218, 26, String(blocks), bo, { anchor: 'start', bold: true, fill: ACC }) + txt(CX[2] + 122, 220, 14, 'of 48', bo, { anchor: 'start', muted: true });
        h += rect(CX[2] + 36, 240, 134, 8, 'color-mix(in srgb, var(--muted) 22%, transparent)', 'none', 0, bo, 4) + rect(CX[2] + 36, 240, 134 * (blocks / 48), 8, ACC, 'none', 0, bo, 4);
      }

      // ---- 4 the structure: a chain drawn from N (blue) to C (red) ----
      {
        const p = K[4], n = Math.floor(NCH * ramp(p, 0.15, 0.9)), x0 = CX[3];
        let back = '', front = '';
        for (let k = 0; k < n; k++) {
          const a = CHAIN[k], b = CHAIN[k + 1], seg = `x1="${(x0 + a[0] + 1).toFixed(1)}" y1="${(a[1] - 14).toFixed(1)}" x2="${(x0 + b[0] + 1).toFixed(1)}" y2="${(b[1] - 14).toFixed(1)}"`;
          back += `<line ${seg} stroke="rgba(0,0,0,.28)" stroke-width="9" stroke-linecap="round"/>`;
          front += `<line ${seg} stroke="hsl(${(240 - 240 * (k / NCH)).toFixed(0)} 72% 54%)" stroke-width="6" stroke-linecap="round"/>`;
        }
        h += back + front;
        h += txt(x0 + 14, 282, 13, 'N', ramp(p, 0.5, 0.7), { anchor: 'start', bold: true, fill: 'hsl(240 70% 52%)' }) + txt(x0 + CW - 14, 282, 13, 'C', ramp(p, 0.8, 0.95), { anchor: 'end', bold: true, fill: 'hsl(0 70% 52%)' });
      }
      svg.innerHTML = h;
    };

    // the doodle is drawn a little smaller and higher than in the pptx, so the cards can start above where it ended
    frame.innerHTML = `<h2 class="deck-heading">${title.paras.map((p) => AF3.paraHtml(p, esc, s.links, true)).join(' ')}</h2>
      ${doodle.map((it) => AF3.picHtml(it, { x: 0.872, y: 0.05, w: 0.084, h: 0.149 })).join('')}
      ${AF3.tagHtml('illustration: made-up sequences and chain, not an AF2 prediction', esc)}
      <div class="rc-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="AlphaFold 2 in four steps: a protein sequence, a multiple sequence alignment of related sequences, the Evoformer with 48 blocks, and the predicted 3D structure"></svg></div>
      <div class="rc-caps">${CAPTIONS.map((t, i) => `<p class="rc-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>`;
    const svg = frame.querySelector('svg');

    const SK = ['k1', 'k2', 'k3', 'k4'];
    const stateOf = (step) => Object.fromEntries(SK.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 3500, 4500, 5000, 4500][step], t0 = performance.now();
        return new Promise((done) => {
          const tick = (now) => {
            const u = Math.min(1, (now - t0) / ms);
            cur = Object.fromEntries(SK.map((k) => [k, from[k] + (to[k] - from[k]) * u]));
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
