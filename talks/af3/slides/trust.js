// "AF3's confidence scores track its accuracy": the paper's Fig. 4a, kept as the real figure (CC BY 4.0) and cut into its two rows, played a click at a time.
// Not drawn by us, so nothing here is made up. The paper's words (main text, "Predicted confidences track accuracy"): "As with AF2, AF3 confidence measures are well
// calibrated with accuracy." The analysis is on the recent PDB evaluation set (no homology filtering, peptides included; the ligand category only high-quality
// experimental structures and non-bonded ligands), cluster-weighted, top-ranked prediction only. Fig. 4a, top: "The accuracy of protein-containing interfaces as a
// function of chain pair ipTM"; bottom: "the LDDT-to-polymer accuracy was evaluated for various chain types as a function of chain-averaged pLDDT". Box plots: 25-75%
// (box), median (line), 5-95% (whiskers); n is the number of clusters in each band.
//
//   1  the test, and the top row: chain pair ipTM (how sure AF3 is of an interface) against DockQ, interface LDDT and ligand pose error
//   2  an arrow under it: more confident, more accurate (the top band: median DockQ above 0.9, about 9 in 10 ligands within 2 A, read off the figure)
//   3  one band marked: protein-protein ipTM 0.4 to 0.6 spans DockQ from near 0 to about 0.9, so a score is a guide, not a guarantee
//   4  the bottom row: chain pLDDT against LDDT to the polymer, for protein, nucleic acid and ligand
//   5  what to take from it: ipTM for how the chains sit together, pLDDT for how well each chain is built, a low score is a warning
//
// The pictures are in assets/ (cut from the paper's PDF at 400 dpi: tracked, small, copied by tools/build_site.py).
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const FIG = [
  { file: 'assets/fig4a-iptm.png', size: [2846, 860] },
  { file: 'assets/fig4a-plddt.png', size: [2780, 856] },
];
const FX = 30, FY = 6, FW = 940;
const CHIPS = [['ipTM', 'is the interface right?'], ['pLDDT', 'is each chain right?'], ['A low score', 'is a warning']];
const CAPTIONS = [
  "The test: take AF3's top-ranked predictions for recent PDB complexes, sort them by AF3's own confidence, and measure how accurate they really were. Top row: interfaces.",
  'Each step up in confidence goes with a more accurate interface. In the top band the median DockQ is above 0.9, and about 9 in 10 ligands are within 2 Å.',
  'But a band is a range. At ipTM 0.4 to 0.6, DockQ runs from near zero to about 0.9: a confidence score is a guide, not a guarantee.',
  'The same test for each chain: pLDDT against how well the chain, nucleic acid or ligand was built. Again every band beats the one below it.',
  "So AF3's own scores say where to trust a model: ipTM for how chains sit together, pLDDT for how well each is built. A low score is a warning.",
];

AF3.kinds.trust = () => ({
  steps: 5,
  notes: '',
  mount(frame, { css, esc }) {
    css(`
      .tr-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .tr-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .tr-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .tr-t.muted { fill: var(--muted); }
      .tr-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .tr-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const ACC = 'var(--accent)';
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" class="tr-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0, dash = '') => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${op.toFixed(2)}"/>`;
    const fig = (i, op) => {   // the real picture on a white card (the pictures are drawn for a white page)
      if (op < 0.01) return '';
      const [iw, ih] = FIG[i].size, h = FW * ih / iw;
      return `<g opacity="${op.toFixed(2)}"><rect x="${FX - 8}" y="${FY - 4}" width="${FW + 16}" height="${(h + 8).toFixed(1)}" rx="10" fill="#fff" stroke="var(--muted)" stroke-opacity=".4" stroke-width="1.4"/><image href="${FIG[i].file}" x="${FX}" y="${FY}" width="${FW}" height="${h.toFixed(1)}"/></g>`;
    };

    const draw = (st) => {
      const K = [0, st.k1, st.k2, st.k3, st.k4, st.k5];
      const toBottom = ramp(K[4], 0, 0.4);
      let h = fig(0, ramp(K[1], 0, 0.45) * (1 - toBottom)) + fig(1, ramp(K[4], 0.25, 0.7) * (1 - 0.7 * ramp(K[5], 0, 0.4)));

      // step 2: an arrow under the top row
      const a = ramp(K[2], 0.05, 0.4) * (1 - toBottom), grow = ramp(K[2], 0.1, 0.75), ay = 316;
      if (a > 0.01) {
        const x2 = 130 + (860 - 130) * grow;
        h += `<g opacity="${a.toFixed(2)}"><line x1="130" y1="${ay}" x2="${(x2 - 8).toFixed(1)}" y2="${ay}" stroke="${ACC}" stroke-width="3.5"/><polygon points="${x2.toFixed(1)},${ay} ${(x2 - 15).toFixed(1)},${ay - 8} ${(x2 - 15).toFixed(1)},${ay + 8}" fill="${ACC}"/></g>`;
        h += txt(130, ay + 26, 17, 'lower ipTM', a, { anchor: 'start', muted: true }) + txt(860, ay + 26, 17, 'higher ipTM', a, { anchor: 'end', muted: true });
        h += txt(495, ay + 26, 19, 'more accurate', a * ramp(K[2], 0.5, 0.85), { bold: true, fill: ACC });
      }
      // step 3: one band marked on the protein-protein panel
      const m = ramp(K[3], 0, 0.4) * (1 - toBottom);
      h += rect(124, 42, 54, 200, 'none', ACC, 3, m, 7, '7 5');

      // what the axes are: under the figure until the arrow (top row) or the chips (bottom row) take its place
      h += txt(500, 322, 18, 'across: how sure AF3 is of the interface · up: how accurate it really was', ramp(K[1], 0.35, 0.75) * (1 - ramp(K[2], 0, 0.3)), { muted: true });
      h += txt(500, 322, 18, 'across: how sure AF3 is of the chain · up: how accurate the chain really was', ramp(K[4], 0.45, 0.85) * (1 - ramp(K[5], 0, 0.3)), { muted: true });

      // step 5: what to take from it
      CHIPS.forEach(([head, body], i) => {
        const o = ramp(K[5], 0.05 + 0.2 * i, 0.4 + 0.2 * i), x = 30 + i * 322, w = 300;
        h += rect(x, 313, w, 62, 'color-mix(in srgb, var(--accent) 9%, var(--bg))', ACC, 1.6, o, 14)
          + txt(x + w / 2, 333, 19, head, o, { bold: true }) + txt(x + w / 2, 358, 17, body, o);
      });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">AF3's confidence scores track its accuracy</h2>
      <div class="tr-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Fig. 4a of the paper: the accuracy of AF3's top-ranked predictions in bands of its own confidence. Top row, chain pair ipTM against DockQ, interface LDDT and ligand pose error. Bottom row, chain pLDDT against LDDT to the polymer for protein, nucleic acid and ligand. Accuracy rises with every band."></svg></div>
      <div class="tr-caps">${CAPTIONS.map((t, i) => `<p class="tr-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>`;
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
        const ms = [0, 3500, 3500, 3500, 3500, 4500][step], t0 = performance.now();
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
