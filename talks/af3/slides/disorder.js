// "AF3 models disordered regions better" (slide 55; the title is now "Cross-distillation curbs AF3's hallucinations", see below): the paper's Extended Data Fig. 1 kept as the real figure (its three structures and its ROC plot are
// the paper's own pictures), played a click at a time around the problem, the fix and the numbers. The AUC values in the last chart are the ones printed in
// the legend of Extended Data Fig. 1b, plotted with the template's chart helper (Deck.groupedBars). Nothing on this slide is made up, and the curves are not
// redrawn (the data behind them is not published with the paper), so the ROC plot stays the paper's picture.
//
//   1  the risk and the fix: a diffusion model can invent structure where there is none (hallucination); cross-distillation trains AF3 also on
//      AlphaFold-Multimer v2.3 predictions, where loose regions are long extended loops; the test is CAID 2 (151 proteins, 46,093 residues)
//   2  Extended Data Fig. 1a: one CAID 2 protein (DP02376) predicted three ways, coloured by pLDDT
//   3  AlphaFold-Multimer v2.3: long, thin loops around the folded core      4  AF3: the same look
//   5  AF3 trained without cross-distillation: the loose parts curl into a compact tangle
//   6  Extended Data Fig. 1b: how well RASA (solid) and pLDDT (dashed) pick out the disordered residues, as ROC curves; the AUC
//   7  the AUCs of AlphaFold-Multimer v2.3 and AF3     8  and of AF3 without cross-distillation
//
// Checked against the main text and Extended Data Fig. 1's caption: "Disordered region prediction. a, Example prediction for a disordered protein from
// AlphaFoldMultimer v2.3, AlphaFold 3, and AlphaFold 3 trained without the disordered protein PDB cross distillation set. Protein is DP02376 from the CAID 2
// (Critical Assessment of protein Intrinsic Disorder prediction) set. Predictions coloured by pLDDT (orange: pLDDT <= 50, yellow: 50 < pLDDT <= 70, light blue:
// 70 < pLDDT <= 90, and dark blue: 90 <= pLDDT < 100). b, Predictions of disorder across residues in proteins in the CAID 2 set, which are also low homology to the
// AF3 training set. Prediction methods include RASA (relative accessible surface area) and pLDDT (N = 151 proteins; 46,093 residues)." Main text: "generative models
// are prone to hallucination, whereby the model may invent plausible-looking structure even in unstructured regions. To counteract this effect, we use a
// cross-distillation method in which we enrich the training data with structures predicted by AlphaFold-Multimer (v.2.3). In these structures, unstructured regions
// are typically represented by long extended loops instead of compact structures, and training on them 'teaches' AF3 to mimic this behaviour." And in the
// discussion: hallucinated regions "are typically marked as very low confidence" but "can lack the distinctive ribbon-like appearance that AF2 produces in disordered
// regions. To encourage ribbon-like predictions in AF3, we use distillation training from AF2 predictions, and we add a ranking term to encourage results with more
// solvent accessible surface area". Supplement: the disordered protein PDB distillation set is AlphaFold-Multimer v2.3 predictions of PDB proteins from the
// training set, filtered to at least 40 unresolved residues, N about 25,000 (section 2.5.2, list item 3); the ranking score is 0.8 ipTM + 0.2 pTM + 0.5 disorder
// - 100 has_clash, with disorder the fraction of protein atoms whose RASA is above 0.581 (Eq. 19, 5.9.3). The AUCs (legend of panel b): AF-M 2.3 RASA 0.94, pLDDT 0.93;
// AF3 RASA 0.95, pLDDT 0.91; AF3 without cross-distillation RASA 0.67, pLDDT 0.89. They say AF3 matches AF-Multimer here (RASA 0.95 against 0.94, pLDDT 0.91 against 0.93)
// and that the fix matters a lot for RASA; the old title's "better" held only against AF3 without the fix, so the title now names the fix. The paper's own words are that cross-distillation "greatly reduced the hallucination behaviour of AF3" (Extended Data Fig. 1). The picture is figures/image86.png (1290 x 1130 px); the pieces are cut
// out of it by the boxes below, and the caption is set again as text. The structures are drawn at the figure's own scale in the row; each is fitted to the box when zoomed.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const GR = '#2f9e44', MG = '#c2255c';
const PL = ['#ff7d45', '#ffdb13', '#65cbf3', '#0053d6'];                                                          // the pLDDT colours of the figure
const NAT = { a: [68, 60, 410, 354], b: [518, 62, 398, 358], c: [956, 150, 236, 168], roc: [60, 440, 1002, 684] };  // the pieces in the image (x, y, w, h in pixels)
const ASP = Object.fromEntries(Object.entries(NAT).map(([k, v]) => [k, v[2] / v[3]]));
const KEYS = ['a', 'b', 'c'];
const INFO = {
  a: { name: ['AlphaFold-Multimer v2.3'], sub: 'AlphaFold 2 family, not a diffusion model', row: ['AlphaFold-Multimer v2.3', 'the predictions AF3 learns from'],
       obs: ['Loose regions are long, thin', 'loops around the folded core', '(orange: low confidence)'], ok: true, verdict: 'the look AF3 is taught to copy' },
  b: { name: ['AF3'], sub: 'trained with cross-distillation', row: ['AF3', 'trained with cross-distillation'],
       obs: ['The same look: long loose', 'loops around a folded core'], ok: true, verdict: 'matches AlphaFold-Multimer' },
  c: { name: ['AF3 without', 'cross-distillation'], sub: 'trained without the extra set', row: ['AF3 without cross-distillation', 'trained without the extra set'],
       obs: ['The loose parts curl into', 'a compact tangle that', 'looks like structure'], ok: false, verdict: 'spurious order: a hallucination' },
};
const S_ROW = 0.6, Y_MID = 172, GAP = 40;
const ROW_W = KEYS.reduce((n, k) => n + NAT[k][2] * S_ROW, 0) + 2 * GAP;
const ROWX = {}; { let x = (1000 - ROW_W) / 2; KEYS.forEach((k) => { ROWX[k] = x; x += NAT[k][2] * S_ROW + GAP; }); }
const rowRect = (k, op) => [ROWX[k], Y_MID - (NAT[k][3] * S_ROW) / 2, NAT[k][2] * S_ROW, NAT[k][3] * S_ROW, op];
const H_FOC = 290, X_FOC = 294, Y_FOC = 50;
const focRect = (k) => [X_FOC - (ASP[k] * H_FOC) / 2, Y_FOC, ASP[k] * H_FOC, H_FOC, 1];
const OFF = (k) => rowRect(k, 0);
// where each panel is at the end of each step (x, y, w, h, opacity); the tween moves it from the step before
const FRAMES = {
  a: [OFF('a'), rowRect('a', 1), focRect('a'), OFF('a'), OFF('a'), OFF('a')],
  b: [OFF('b'), rowRect('b', 1), OFF('b'), focRect('b'), OFF('b'), OFF('b')],
  c: [OFF('c'), rowRect('c', 1), OFF('c'), OFF('c'), focRect('c'), OFF('c')],
};
const CHIPS = [
  ['The risk', 'Hallucination', ['a diffusion model draws structure', 'where the protein has none']],
  ['The fix', 'Cross-distillation', ['extra training set predicted by', 'AlphaFold-Multimer v2.3']],
  ['The test', 'CAID 2 proteins', ['151 proteins, 46,093 residues', 'low similarity to the training set']],
];

const CAPTIONS = [
  'A diffusion model can invent plausible-looking structure where a protein has none. The fix is cross-distillation: also training on AlphaFold-Multimer v2.3 predictions, where loose regions are long loops.',
  'One protein from CAID 2 (DP02376), predicted three ways (Extended Data Fig. 1a). Colour is pLDDT: orange up to 50, yellow 50 to 70, light blue 70 to 90, dark blue above 90.',
  'AlphaFold-Multimer v2.3: loose regions are long extended loops, the ribbon-like look AlphaFold 2 gives disordered parts. Training on these predictions teaches AF3 to do the same.',
  'AF3 after cross-distillation: the same look, long loose loops around a folded core.',
  'AF3 trained without cross-distillation: the loose parts curl into a compact tangle that looks like structure. That is the hallucination.',
  'Extended Data Fig. 1b: how well each score picks out the truly disordered residues, over 151 proteins. Solid curves use RASA, dashed ones pLDDT. Closer to the top left is better.',
  'The area under each curve (AUC) sums it up: 1 is perfect, 0.5 a coin flip. With RASA, AF3 scores 0.95 and AlphaFold-Multimer v2.3 0.94. With pLDDT, AF3 scores 0.91 and AlphaFold-Multimer 0.93.',
  'Without cross-distillation, AF3 falls to 0.67 with RASA (0.89 with pLDDT). The fix is what brings AF3 level with AlphaFold-Multimer v2.3 on this test.',
];

const ACC = 'var(--plot-3)', GREY = 'var(--plot-1)', PALE = 'color-mix(in srgb, var(--plot-3) 50%, var(--bg))';
const FORMAT = (v) => (v === undefined ? '' : v === 0 ? '0' : v === 1 ? '1' : v.toFixed(2));
const SPEC = {
  max: 1, strong: 'af3',
  series: [{ key: 'am', label: 'AlphaFold-Multimer v2.3', step: 1, color: GREY }, { key: 'af3', label: 'AF3', step: 1, color: ACC }, { key: 'nd', label: 'AF3 without cross-distillation', step: 2, color: PALE }],
  groups: [
    { label: ['RASA', 'surface exposure'], values: { am: 0.94, af3: 0.95, nd: 0.67 } },
    { label: ['pLDDT', 'model confidence'], values: { am: 0.93, af3: 0.91, nd: 0.89 } },
  ],
  footnote: ['AUC for picking out disordered residues, CAID 2: 151 proteins, 46,093 residues. 1 is perfect, 0.5 a coin flip. Source: Abramson et al. 2024, Extended Data Fig. 1b.'],
};

AF3.kinds.disorder = (s) => ({
  steps: 8,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(`
      .dz-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .dz-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .dz-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .dz-t.muted { fill: var(--muted); }
      .dz-caps { position: absolute; left: 4.2%; right: 4.2%; top: 86%; height: 10%; }
      .dz-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .deck-plot { transition: opacity .45s; }
    `);
    const pic = s.items.find((it) => it.kind === 'pic');
    const IMG = AF3.fig(pic.file);

    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" class="dz-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const arrow = (x1, y, x2, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2 - 6}" y2="${y.toFixed(1)}" stroke="var(--muted)" stroke-width="2"/><polygon points="${x2},${y.toFixed(1)} ${x2 - 8},${(y - 5).toFixed(1)} ${x2 - 8},${(y + 5).toFixed(1)}" fill="var(--muted)"/></g>`;
    const mark = (x, y, ok, op) => op < 0.01 ? '' : (ok
      ? `<g opacity="${op.toFixed(2)}"><circle cx="${x}" cy="${y}" r="11" fill="${GR}"/><path d="M${x - 5.5} ${y} l4 4.5 l7 -9" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`
      : `<g opacity="${op.toFixed(2)}"><circle cx="${x}" cy="${y}" r="11" fill="${MG}"/><path d="M${x - 5} ${y - 5} l10 10 M${x + 5} ${y - 5} l-10 10" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`);
    const chain = (frames, ts) => frames.slice(1).reduce((acc, fr, i) => acc.map((v, j) => lerp(v, fr[j], ts[i])), frames[0]);   // frames[0], then toward each next frame by its own progress
    // a piece of the figure, cut out of the picture
    const piece = (k, x, y, w, h, op, frame) => {
      if (op < 0.01) return '';
      const [nx, ny, nw, nh] = NAT[k];
      return `<g opacity="${op.toFixed(2)}"><svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${nx} ${ny} ${nw} ${nh}" preserveAspectRatio="none" style="overflow:hidden"><image href="${IMG}" width="1290" height="1130"/></svg>`
        + (frame ? `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="none" stroke="var(--muted)" stroke-width="1.6"/>` : '') + '</g>';
    };
    const sample = (x, y, dashed, op) => op < 0.01 ? '' : `<line x1="${x}" y1="${y}" x2="${x + 40}" y2="${y}" stroke="var(--fg)" stroke-width="4" stroke-linecap="round"${dashed ? ' stroke-dasharray="9 7"' : ''} opacity="${op.toFixed(2)}"/>`;

    const draw = (st) => {
      const K = [0, st.k1, st.k2, st.k3, st.k4, st.k5, st.k6, st.k7];
      const scene = 1 - ramp(K[7], 0, 0.7);
      if (scene < 0.01) { svg.innerHTML = ''; return; }
      const inn = (s, a, b) => ramp(K[s], a, b) * (1 - ramp(K[s + 1], 0, 0.3));   // fades in during step s, out when the next step starts
      let h = '';

      // ---- the risk, the fix and the test: three chips, big at the start, then a strip along the top ----
      const t2 = ramp(K[2], 0, 0.5);
      CHIPS.forEach(([head, main, subs], i) => {
        const x = 30 + i * 340, op = ramp(K[1], 0.08 + 0.2 * i, 0.4 + 0.2 * i), y = lerp(60, 2, t2), hh = lerp(136, 34, t2), cy = y + hh / 2;
        const fade = op * (1 - ramp(K[2], 0, 0.25));
        h += rect(x, y, 280, hh, 'var(--bg)', 'var(--muted)', 1.6, op, lerp(12, 8, t2));
        h += txt(x + 140, cy + lerp(-10, 0, t2), lerp(22, 14.5, t2), main, op, { bold: true }) + txt(x + 140, cy - 42, 13, head, fade, { muted: true });
        subs.forEach((ln, j) => { h += txt(x + 140, cy + 26 + j * 21, 13.5, ln, fade, { muted: true }); });
        if (i < 2) h += arrow(x + 286, lerp(60 + 68, 19, t2), x + 334, op * ramp(K[1], 0.2 + 0.2 * i, 0.5 + 0.2 * i));
      });
      const facts = ramp(K[1], 0.62, 0.9) * (1 - ramp(K[2], 0, 0.3));
      h += txt(500, 244, 18, '<tspan font-weight="700">Extra training set:</tspan> about 25,000 PDB proteins, re-predicted by AlphaFold-Multimer v2.3', facts);
      h += txt(500, 276, 15, 'Each has at least 40 unresolved residues (not seen in the experiment).', facts, { muted: true });
      h += txt(500, 300, 15, 'In the predictions, loose regions come out as long extended loops. Training on them teaches AF3 to do the same.', facts, { muted: true });
      h += txt(500, 338, 15, 'A second nudge: when AF3 ranks its samples, more exposed (disordered) residues earn a small bonus.', facts, { muted: true });

      // ---- the structures: a row, then one at a time ----
      KEYS.forEach((k) => {
        const [x, y, w, hh, op] = chain(FRAMES[k], [2, 3, 4, 5, 6].map((s) => (s === 2 ? ramp(K[s], 0.35, 0.8) : s === 6 ? ramp(K[s], 0, 0.25) : ramp(K[s], 0, 0.5))));   // the row waits for the chips to settle; the last zoom lets go quickly
        h += piece(k, x, y, w, hh, op, true);
      });
      const rowLab = ramp(K[2], 0.4, 0.8) * (1 - ramp(K[3], 0, 0.3));
      KEYS.forEach((k) => {
        const cx = ROWX[k] + (NAT[k][2] * S_ROW) / 2;
        h += txt(cx, 296, 15, `<tspan font-weight="700">${INFO[k].row[0]}</tspan>`, rowLab) + txt(cx, 316, 12.5, INFO[k].row[1], rowLab, { muted: true });
      });

      // ---- the colour key, while the structures are on screen ----
      const leg = ramp(K[2], 0.4, 0.8) * (1 - ramp(K[6], 0, 0.3));
      h += txt(150, 372, 14, 'Colour is pLDDT, the model’s confidence in each residue:', leg, { anchor: 'start', muted: true });
      [['≤ 50', 0], ['50–70', 1], ['70–90', 2], ['> 90', 3]].forEach(([lab, i]) => {
        const x = 560 + i * 110;
        h += rect(x, 366, 22, 12, PL[i], 'var(--muted)', 1, leg, 2) + txt(x + 29, 372, 14, lab, leg, { anchor: 'start', muted: true });
      });

      // ---- one at a time: the name, what to look at, and the verdict ----
      const stepOf = { a: 3, b: 4, c: 5 };
      KEYS.forEach((k) => {
        const st3 = stepOf[k], o = inn(st3, 0.3, 0.6);
        if (o < 0.01) return;
        const I = INFO[k], x0 = 610;
        I.name.forEach((ln, i) => { h += txt(x0, 76 + i * 28, 24, ln, o, { anchor: 'start', bold: true }); });
        const y1 = 76 + (I.name.length - 1) * 28;
        h += txt(x0, y1 + 26, 14.5, I.sub, o, { anchor: 'start', muted: true });
        const ob = inn(st3, 0.45, 0.72);
        I.obs.forEach((ln, i) => { h += txt(x0, 190 + i * 28, 19, ln, ob, { anchor: 'start', bold: true }); });
        const vb = inn(st3, 0.72, 0.95);
        h += mark(x0 + 11, 322, I.ok, vb) + txt(x0 + 32, 322, 16.5, I.verdict, vb, { anchor: 'start', bold: true, fill: I.ok ? GR : MG });
      });

      // ---- the ROC plot of Extended Data Fig. 1b, and how to read it ----
      const roc = ramp(K[6], 0.25, 0.6), hr = 312;
      h += piece('roc', 14, 46, ASP.roc * hr, hr, roc, true);
      const x1 = 520;
      h += txt(x1, 66, 20, 'CAID 2: 151 proteins', ramp(K[6], 0.4, 0.6), { anchor: 'start', bold: true }) + txt(x1, 92, 15, '46,093 residues in all', ramp(K[6], 0.4, 0.6), { anchor: 'start', muted: true });
      const r2 = ramp(K[6], 0.5, 0.7), r3 = ramp(K[6], 0.62, 0.82), r4 = ramp(K[6], 0.76, 0.93), r5 = ramp(K[6], 0.88, 1);
      h += sample(x1, 144, false, r2) + txt(x1 + 54, 144, 19, 'Solid: RASA', r2, { anchor: 'start', bold: true }) + txt(x1, 172, 15, 'how exposed each residue is in the predicted structure', r2, { anchor: 'start', muted: true });
      h += sample(x1, 214, true, r3) + txt(x1 + 54, 214, 19, 'Dashed: pLDDT', r3, { anchor: 'start', bold: true }) + txt(x1, 242, 15, 'the model’s own confidence in each residue', r3, { anchor: 'start', muted: true });
      h += txt(x1, 290, 19, 'Closer to the top left is better', r4, { anchor: 'start', bold: true }) + txt(x1, 316, 15, 'more of the disordered residues found, fewer false alarms', r4, { anchor: 'start', muted: true });
      h += txt(x1, 356, 15.5, '<tspan font-weight="700">AUC</tspan>, the area under a curve: 1 is perfect, 0.5 is a coin flip', r5, { anchor: 'start' });

      svg.innerHTML = `<g opacity="${scene.toFixed(2)}">${h}</g>`;
    };

    frame.innerHTML = `<h2 class="deck-heading">Cross-distillation curbs AF3's hallucinations</h2>
      <div class="dz-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Extended Data Fig. 1 of the paper: one disordered protein predicted by AlphaFold-Multimer v2.3, AF3 and AF3 trained without cross-distillation, and the ROC curves for picking out disordered residues with RASA and pLDDT, then the areas under the curves as bars"></svg></div>
      <div class="dz-caps">${CAPTIONS.map((t, i) => `<p class="dz-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>`;
    const svg = frame.querySelector('svg');

    // the chart is the helper's own, in the theme colours; its bars come in a series at a time
    const plot = Deck.groupedBars(frame, {
      series: SPEC.series.map((x) => ({ key: x.key, label: x.label, step: x.step })),
      groups: SPEC.groups.map((g) => ({ label: g.label, values: g.values })),
      strong: SPEC.strong, footnote: SPEC.footnote, captioned: true, max: SPEC.max, format: FORMAT,
    });
    [...plot.root.querySelectorAll('.deck-plot-group')].forEach((ge) => {
      [...ge.querySelectorAll('.deck-plot-bar')].forEach((be, si) => { be.querySelector('.deck-plot-fill').style.background = SPEC.series[si].color; });
    });
    plot.root.querySelectorAll('.deck-plot-key i').forEach((i, k) => { i.style.background = SPEC.series[k].color; });
    plot.root.style.opacity = 0; plot.show(0, false);

    const SK = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'];
    const stateOf = (step) => Object.fromEntries(SK.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        const chart = step >= 7;
        plot.root.style.opacity = chart ? 1 : 0;
        plot.show(step >= 8 ? 2 : chart ? 1 : 0, animate && chart);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate || step === 8) { cur = to; draw(cur); return; }
        const ms = [0, 5500, 3500, 6000, 5500, 6000, 7500, 1200][step], t0 = performance.now();
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
