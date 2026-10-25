// "AF3 and Nucleic Acid Prediction" (slide 56), as the paper's Extended Data Fig. 5 kept as the real figure, cut into its four panels and played a click at a time
// around the two tests, the two accuracy panels, and one example with its confidence. The title says what the panels show (it was only the topic, "AF3 and Nucleic
// Acid Prediction"): higher LDDT than RoseTTAFold2NA on both tests. Nothing on this
// slide is made up: the four pictures are the paper's, and the p-values are from its legend. The data behind the box plot and the bars is not published with the paper, so they
// stay the paper's pictures and no value is read off them.
//
//   1  the two tests, both scored by LDDT: the ten public CASP15 RNA targets, and recent PDB structures that hold only RNA (29) or only DNA (63); the baseline is RoseTTAFold2NA
//   2  Extended Data Fig. 5b: the RNA-only and DNA-only structures, AF3 against RoseTTAFold2NA, with the paper's significance marks
//   3  Extended Data Fig. 5a: the CASP15 RNA targets one by one, AF3 against AIchemy_RNA and RoseTTAFold2NA
//   4  Extended Data Fig. 5c: an example prediction, a protein bound to double-stranded DNA (PDB 7R6R), coloured by pLDDT and by chain
//   5  Extended Data Fig. 5d: its predicted aligned error
//
// Checked against the main text and Extended Data Fig. 5's legend. Main text: "We also evaluated AF3 performance on the ten publicly available Critical Assessment of Structure
// Prediction 15 (CASP15) RNA targets: we achieve a higher average performance than RoseTTAFold2NA and AIchemy_RNA (the best AI-based submission in CASP15) on the respective common
// subsets of our and their predictions (detailed results are shown in Extended Data Fig. 5a). We did not reach the performance of the best human-expert-aided CASP15 submission
// AIchemy_RNA2 (Fig. 1c (centre left))." Legend: "a, CASP15 RNA prediction accuracy from AIChemy_RNA (the top AI-based submission), RoseTTAFold2NA (the AI-based method capable of
// predicting protein-RNA complexes), and AlphaFold 3. Ten of the 13 targets are available in the PDB or via the CASP website for evaluation. ... b, Accuracy on structures containing
// low homology RNA-only or DNA-only complexes from the recent PDB evaluation set. Comparison between AlphaFold 3 and RoseTTAFold2NA (RNA: N = 29 structures, paired Wilcoxon
// signed-rank test, p = 1.6e-7; DNA: N = 63 structures, paired two-sided Wilcoxon signed-rank test, p = 5.2e-12). ... c, Predicted structure of a mycobacteriophage immunity repressor
// protein bound to double stranded DNA (PDB ID 7R6R), coloured by pLDDT (left; orange: 0-50, yellow: 50-70, cyan 70-90, and blue 90-100) and chain id (right). Note the disordered
// N-terminus not entirely shown. d, Predicted aligned error (PAE) per token-pair for the prediction in c with rows and columns labelled by chain id and green gradient indicating PAE."
// The pictures are figures/image65.png (b), image66 (a), image58 (c) and image52 (d), cut by the boxes below; the legend is set again as captions.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const TITLE = 'AF3 beats RoseTTAFold2NA on nucleic acids';
// the pieces: file, size of the picture, the cut (x, y, w, h in pixels, panel letters left out)
const PIC = {
  b: { file: 'image65.png', size: [688, 632], cut: [30, 40, 658, 592] },
  a: { file: 'image66.png', size: [1140, 384], cut: [40, 0, 1100, 384] },
  c: { file: 'image58.png', size: [706, 556], cut: [10, 22, 680, 532] },
  d: { file: 'image52.png', size: [660, 594], cut: [10, 0, 645, 594] },
};
const ASP = Object.fromEntries(Object.entries(PIC).map(([k, v]) => [k, v.cut[2] / v.cut[3]]));
const PH = 322;                                                                                                 // height of a panel in the 1000 x 395 drawing
const BOX = { b: [24, 40, ASP.b * PH, PH], a: [452, 40 + (PH - 540 / ASP.a) / 2, 540, 540 / ASP.a], c: [30, 40, ASP.c * PH, PH], d: [520, 40, ASP.d * PH, PH] };
const CHIPS = [
  ['Test 1', 'CASP15 RNA', '10 public targets', 'AF3 against RoseTTAFold2NA and AIchemy_RNA'],
  ['Test 2', 'Recent PDB structures', 'RNA only (29) or DNA only (63)', 'AF3 against RoseTTAFold2NA'],
];
const CAPTIONS = [
  'Two tests, both scored by LDDT (higher is better): the ten public CASP15 RNA targets, and recent PDB structures that hold only RNA or only DNA. The baseline is RoseTTAFold2NA.',
  'RNA-only and DNA-only structures from the recent PDB. AF3 has the higher LDDT on both, with a paired Wilcoxon test of $p = 1.6 \\times 10^{-7}$ for RNA (29 structures) and $p = 5.2 \\times 10^{-12}$ for DNA (63).',
  'CASP15 RNA, target by target. On the targets they share, AF3 has a higher average than RoseTTAFold2NA and AIchemy_RNA, the best AI-based entry. It did not reach the best entry that had human help.',
  'An example from the paper: a mycobacteriophage immunity repressor bound to double-stranded DNA (PDB 7R6R). Left: coloured by pLDDT, high (blue) except a low-confidence tail (orange). Right: coloured by chain.',
  'The predicted aligned error of that prediction (dark green is low error): low across the protein and the DNA chains, and high only for the first residues, the disordered tail.',
];

AF3.kinds.nucleic = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(`
      .nu-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .nu-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .nu-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .nu-t.muted { fill: var(--muted); }
      .nu-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .nu-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" class="nu-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    // a panel: the real picture, cut out of the figure, with its heading above; it slides in by `dx`
    const panel = (k, op, dx, head, sub) => {
      if (op < 0.01) return '';
      const [x0, y, w, h] = BOX[k], x = x0 + dx, [nx, ny, nw, nh] = PIC[k].cut, [iw, ih] = PIC[k].size;
      return `<g opacity="${op.toFixed(2)}"><svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${nx} ${ny} ${nw} ${nh}" preserveAspectRatio="none" style="overflow:hidden"><image href="${AF3.fig(PIC[k].file)}" x="0" y="0" width="${iw}" height="${ih}"/></svg>`
        + `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="none" stroke="var(--muted)" stroke-width="1.6"/></g>`
        + txt(x + w / 2, 14, 16, head, op, { bold: true }) + txt(x + w / 2, 30, 12.5, sub, op, { muted: true });
    };

    const draw = (st) => {
      const K = [0, st.k1, st.k2, st.k3, st.k4, st.k5];
      let h = '';

      // ---- the two tests ----
      const chipOut = 1 - ramp(K[2], 0, 0.4);
      CHIPS.forEach(([tag, main, sub, base], i) => {
        const op = ramp(K[1], 0.08 + 0.22 * i, 0.4 + 0.22 * i) * chipOut, x = 20 + i * 490;
        h += rect(x, 110, 470, 156, 'var(--bg)', 'var(--muted)', 1.6, op, 12);
        h += txt(x + 20, 132, 14, tag, op, { anchor: 'start', muted: true }) + txt(x + 20, 168, 26, main, op, { anchor: 'start', bold: true });
        h += txt(x + 20, 204, 18, sub, op, { anchor: 'start' }) + txt(x + 20, 238, 15, base, op, { anchor: 'start', muted: true });
      });
      h += txt(500, 316, 20, '<tspan font-weight="700">LDDT</tspan>, higher is better', ramp(K[1], 0.5, 0.85) * chipOut);

      // ---- the accuracy panels, then the example ----
      const gone = 1 - ramp(K[4], 0, 0.45);
      // b and c arrive alone in the middle, then make room for the panel that comes next
      const bdx = (500 - BOX.b[2] / 2 - BOX.b[0]) * (1 - ramp(K[3], 0, 0.6)), cdx = (500 - BOX.c[2] / 2 - BOX.c[0]) * (1 - ramp(K[5], 0, 0.6));
      h += panel('b', ramp(K[2], 0.15, 0.6) * gone, bdx + (1 - ramp(K[2], 0, 0.6)) * -24 + (1 - gone) * -24, 'RNA-only and DNA-only structures', 'recent PDB, LDDT');
      h += panel('a', ramp(K[3], 0.15, 0.6) * gone, (1 - ramp(K[3], 0, 0.6)) * 24 + (1 - gone) * 24, 'CASP15 RNA targets, one by one', 'LDDT of each prediction');
      h += panel('c', ramp(K[4], 0.4, 0.85), cdx + (1 - ramp(K[4], 0.3, 0.85)) * -24, 'Example: protein and DNA, PDB 7R6R', 'predicted by AF3');
      h += panel('d', ramp(K[5], 0.15, 0.6), (1 - ramp(K[5], 0, 0.6)) * 24, 'Predicted aligned error', 'the same prediction');
      const lab = ramp(K[4], 0.6, 0.95);
      h += txt(BOX.c[0] + cdx + BOX.c[2] * 0.27, 40 + PH + 17, 14, 'coloured by pLDDT', lab, { muted: true }) + txt(BOX.c[0] + cdx + BOX.c[2] * 0.76, 40 + PH + 17, 14, 'coloured by chain', lab, { muted: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(TITLE)}</h2>
      <div class="nu-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="The paper's Extended Data Fig. 5: AlphaFold 3 against RoseTTAFold2NA on RNA-only and DNA-only structures, the CASP15 RNA targets, and an example of a protein bound to DNA with its predicted aligned error"></svg></div>
      <div class="nu-caps">${CAPTIONS.map((t, i) => `<p class="nu-cap reveal-in" data-show="${i + 1}">${AF3.rich(t, esc)}</p>`).join('')}</div>`;
    const svg = frame.querySelector('svg');

    const SK = ['k1', 'k2', 'k3', 'k4', 'k5'];
    const stateOf = (step) => Object.fromEntries(SK.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 4500, 4500, 4500, 4500, 4500][step], t0 = performance.now();
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
