// "Limitations" (slide 58) with the future-work slide (60) folded into it: the paper's four kinds of limits one per click, each with its picture from Fig. 5 and the facts
// in the paper's own numbers, then the next step for each, which are the four points of the deck's Future Work slide. Slide 60 is left out of the talk (plan.js HIDE),
// not deleted. Nothing here is made up: the pictures are the paper's Fig. 5, the numbers are from its text and legend, and the pairing of a limit with a next step is
// the slide's (the paper itself only points to MSA-resampling methods for several conformations).
//
//   1  the four limits, as the paper lists them: stereochemistry, hallucinations, dynamics, accuracy for certain targets
//   2  stereochemistry: Fig. 5b (the wrong chiral centre) and 5e (overlapping chains)
//   3  hallucination: Fig. 5d, a nuclear pore complex with unresolved residues
//   4  dynamics: Fig. 5c, cereblon open and closed
//   5  hard targets: antibody-antigen interfaces keep improving with more seeds (Fig. 5a, which is a plot of data not published, so it is said in words)
//   6  the four next steps, each under its limit
//
// Checked against the main text, "Model limitations": "We note model limitations of AF3 with respect to stereochemistry, hallucinations, dynamics and accuracy for certain targets.
// On stereochemistry, we note two main classes of violations. The first is that the model outputs do not always respect chirality (Fig. 5b), despite the model receiving reference
// structures with correct chirality as input features. To address this in the PoseBusters benchmark, we included a penalty for chirality violation in our ranking formula for model
// predictions. Despite this, we still observe a chirality violation rate of 4.4% in the benchmark. The second class of stereochemical violations is a tendency of the model to
// occasionally produce overlapping (clashing) atoms in the predictions. This sometimes manifests as extreme violations in homomers in which entire chains have been observed to
// overlap (Fig. 5e). ... Almost all remaining clashes occur for protein-nucleic complexes with both greater than 100 nucleotides and greater than 2,000 residues in total. We note
// that the switch from the non-generative AF2 model to the diffusion-based AF3 model introduces the challenge of spurious structural order (hallucinations) in disordered regions
// (Fig. 5d and Extended Data Fig. 1). Although hallucinated regions are typically marked as very low confidence, they can lack the distinctive ribbon-like appearance that AF2
// produces in disordered regions." Dynamics: "In some cases, the modelled conformational state may not be correct ... E3 ubiquitin ligases natively adopt an open conformation in an
// apo state and have been observed only in a closed state when bound to ligands, but AF3 exclusively predicts the closed state for both holo and apo systems (Fig. 5c)." Hard targets:
// "To obtain the highest accuracy, it may be necessary to generate a large number of predictions and rank them, which incurs an extra computational cost. A class of targets in which
// we observe this effect strongly is antibody-antigen complexes ... top-ranked predictions keep improving with more model seeds, even at as many as 1,000." Legend of Fig. 5: "b,
// Prediction (coloured) and ground-truth (grey) structures of Thermotoga maritima alpha-glucuronidase and beta-D-glucuronic acid, a target from the PoseBusters set (PDB: 7CTM). AF3
// predicts alpha-D-glucuronic acid; the differing chiral centre is indicated by an asterisk. c, Conformation coverage is limited. Ground-truth structures (grey) of cereblon in open
// (apo, PDB: 8CVP; left) and closed (holo, mezigdomide-bound, PDB: 8D7U; right) conformations. Predictions (blue) of both apo (with 10 overlaid samples) and holo structures are in the
// closed conformation. d, A nuclear pore complex with 1,854 unresolved residues (PDB: 7F60). The ground truth (left) and predictions from AlphaFold-Multimer v.2.3 (middle) and AF3
// (right) are shown. e, Prediction of a trinucleosome with overlapping DNA (pink) and protein (blue) chains (PDB: 7PEU)." The next steps are the four points of the Future Work slide
// (60), kept in its words. The pictures are figures/image54.png (5b), image55 (5e), image64 (5d) and image83 (5c).
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const CW = 226, CX = [4, 260, 516, 772], CH = 250, ZY = 38, ZH = 132;                                           // cards: width, left edges, height; the picture zone
const PIC = {
  chir: { file: 'image54.png', size: [618, 358], cut: [47, 31, 536, 307] },
  clash: { file: 'image55.png', size: [502, 350], cut: [7, 60, 484, 284] },
  pore: { file: 'image64.png', size: [696, 490], cut: [4, 2, 690, 486] },
  cere: { file: 'image83.png', size: [1208, 554], cut: [31, 0, 1177, 554] },
};
const HEAD = ['Stereochemistry', 'Hallucination', 'Dynamics', 'Hard targets'];
const FACTS = [
  ['Chirality is wrong in 4.4% of', 'PoseBusters, even with a', 'ranking penalty. Atoms can clash.'],
  ['Invents order in disordered', 'regions. Usually flagged very', 'low confidence, yet can look folded.'],
  ['One conformation only:', 'cereblon is predicted closed', 'with or without its ligand.'],
  ['Antibody-antigen keeps getting', 'better with more seeds, even', 'at 1,000. That costs compute.'],
];
const NEXT = [
  ['Add physical or chemical', 'constraints back in, without', 'losing the generality that', 'atom-level coordinates gave AF3'],
  ['Better uncertainty estimates,', 'so a confident wrong answer', 'and an honestly low-confidence', 'one are easier to tell apart'],
  ['Model multiple', 'conformational states'],
  ['Cheaper or smarter search that', 'finds the good structure', 'without brute-force', 'resampling'],
];
const CAPTIONS = [
  'Limitations. The paper names four kinds: stereochemistry, hallucinations, dynamics, and accuracy for certain targets.',
  'Stereochemistry. Chirality is not always respected: 4.4% of PoseBusters, even with a ranking penalty (left: AF3 gives alpha-D-glucuronic acid, the truth is beta-D). Atoms can also overlap (right).',
  'Hallucination. A nuclear pore complex with 1,854 unresolved residues: AlphaFold-Multimer leaves loose loops, AF3 packs some into structure. Usually marked very low confidence.',
  'Dynamics. The modelled conformation can be the wrong one. Cereblon is open without its ligand and closed with it, but AF3 predicts closed both times (grey: experiment, blue: AF3).',
  'Hard targets. For some targets the best accuracy needs many predictions to rank from. Antibody-antigen interfaces kept improving with more model seeds, even at 1,000.',
  'Future work. Each limit has a next step: constraints for stereochemistry, better uncertainty for hallucination, several conformations for dynamics, a cheaper search for hard targets.',
];

AF3.kinds.limits = (s) => ({
  steps: 6,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(`
      .li-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .li-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .li-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .li-t.muted { fill: var(--muted); }
      .li-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .li-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const ACC = 'var(--accent)';
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" class="li-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    // the real picture, cut out of the figure and fitted into a box (x, y, w, h), centred
    const pic = (k, bx, by, bw, bh, op) => {
      if (op < 0.01) return '';
      const [nx, ny, nw, nh] = PIC[k].cut, [iw, ih] = PIC[k].size, r = Math.min(bw / nw, bh / nh), w = nw * r, h = nh * r, x = bx + (bw - w) / 2, y = by + (bh - h) / 2;
      return `<g opacity="${op.toFixed(2)}"><svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${nx} ${ny} ${nw} ${nh}" preserveAspectRatio="none" style="overflow:hidden"><image href="${AF3.fig(PIC[k].file)}" x="0" y="0" width="${iw}" height="${ih}"/></svg>`
        + `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="none" stroke="var(--muted)" stroke-width="1.2"/></g>`;
    };
    const arrow = (x, y1, y2, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 6}" stroke="var(--muted)" stroke-width="2"/><polygon points="${x},${y2} ${x - 5.5},${y2 - 9} ${x + 5.5},${y2 - 9}" fill="var(--muted)"/></g>`;

    const draw = (st) => {
      const K = [0, st.k1, st.k2, st.k3, st.k4, st.k5, st.k6];
      let h = '';
      const off = 44 * (1 - ramp(K[6], 0, 0.4));   // the cards sit lower while there is nothing under them, and move up when the next steps arrive
      h += `<g transform="translate(0 ${off.toFixed(1)})">`;
      for (let i = 0; i < 4; i++) {
        const x = CX[i], fo = ramp(K[i + 2], 0.25, 0.7), co = ramp(K[1], 0.05 + 0.15 * i, 0.4 + 0.15 * i);
        h += rect(x, 0, CW, CH, 'var(--bg)', 'var(--muted)', 1.6, co, 12) + txt(x + 14, 16, 17, HEAD[i], co, { anchor: 'start', bold: true });
        if (i === 0) {
          h += pic('chir', x + 10, ZY, 112, 60, fo) + pic('clash', x + 10, ZY + 66, 112, 60, fo);
          h += txt(x + 130, ZY + 30, 12.5, 'wrong chiral', fo, { anchor: 'start', muted: true }) + txt(x + 130, ZY + 45, 12.5, 'centre', fo, { anchor: 'start', muted: true });
          h += txt(x + 130, ZY + 96, 12.5, 'overlapping', fo, { anchor: 'start', muted: true }) + txt(x + 130, ZY + 111, 12.5, 'chains', fo, { anchor: 'start', muted: true });
        } else if (i === 1) {
          h += pic('pore', x + 12, ZY, CW - 24, ZH, fo);
        } else if (i === 2) {
          h += pic('cere', x + 10, ZY + 4, CW - 20, 90, fo);
          h += txt(x + CW * 0.27, ZY + 112, 12.5, 'without ligand', fo, { muted: true }) + txt(x + CW * 0.74, ZY + 112, 12.5, 'with ligand', fo, { muted: true });
        } else {
          h += txt(x + 38, ZY + 52, 30, '5', fo, { bold: true, fill: ACC }) + txt(x + 38, ZY + 82, 12.5, 'seeds', fo, { muted: true });
          h += `<g opacity="${fo.toFixed(2)}"><line x1="${x + 66}" y1="${ZY + 56}" x2="${x + 104}" y2="${ZY + 56}" stroke="var(--muted)" stroke-width="2.2"/><polygon points="${x + 112},${ZY + 56} ${x + 103},${ZY + 50.5} ${x + 103},${ZY + 61.5}" fill="var(--muted)"/></g>`;
          h += txt(x + 168, ZY + 52, 30, '1,000', fo, { bold: true, fill: ACC }) + txt(x + 168, ZY + 82, 12.5, 'seeds', fo, { muted: true });
          h += txt(x + CW / 2, ZY + 108, 12.5, 'antibody-antigen interfaces', fo, { muted: true });
        }
        FACTS[i].forEach((ln, j) => { h += txt(x + 14, 190 + j * 20, 13, ln, fo, { anchor: 'start' }); });
      }
      h += '</g>';

      // ---- the next steps ----
      h += txt(4, 266, 13, 'Future work', ramp(K[6], 0.4, 0.65), { anchor: 'start', bold: true, fill: ACC });
      for (let i = 0; i < 4; i++) {
        const x = CX[i], no = ramp(K[6], 0.4 + 0.12 * i, 0.7 + 0.12 * i);
        h += arrow(x + CW / 2, CH + 2, 282, no);
        h += rect(x, 284, CW, 90, 'color-mix(in srgb, var(--accent) 9%, var(--bg))', ACC, 1.8, no, 10);
        NEXT[i].forEach((ln, j) => { h += txt(x + 12, 301 + j * 16.5, 12.5, ln, no, { anchor: 'start', bold: j === 0 && NEXT[i].length < 4 }); });
      }
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">Limitations: where AF3 goes wrong, and what could help</h2>
      <div class="li-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="The four limitations of AlphaFold 3 named in the paper, with the picture from its Fig. 5 for each, and the next step for each: stereochemistry, hallucination in disordered regions, a single conformation, and the many seeds that hard targets need"></svg></div>
      <div class="li-caps">${CAPTIONS.map((t, i) => `<p class="li-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>`;
    const svg = frame.querySelector('svg');

    const SK = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'];
    const stateOf = (step) => Object.fromEntries(SK.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 3500, 3800, 3800, 3800, 3500, 5200][step], t0 = performance.now();
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
