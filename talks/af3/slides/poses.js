// "AF3 accurately predicts protein-ligand poses" (slide 54): the paper's Extended Data Fig. 3 (three PoseBusters examples) kept as the real figure,
// cut into its three panels, and played a click at a time around the setup and the numbers. Nothing on this slide is made up: the pictures are the paper's
// (predicted protein blue, predicted ligand orange, experiment grey), and the three RMSD values are from its caption. A rotating 3D view is not possible
// because the predictions are not available (AF3's weights and code are not public), so the pictures stay flat and the motion is in the story.
//
//   1  the test: protein sequence + ligand in, the joint 3D complex out; success is a ligand RMSD under 2 A; PoseBusters V1, 428 complexes, a model trained on data up to Sept. 2019
//   2  three examples from Extended Data Fig. 3, picked as cases where the docking tools Vina and Gold were inaccurate; what the colours are
//   3  panel a: human Notum bound to the inhibitor ARUK3004556 (PDB 8BTI), ligand RMSD 0.65 A, against a 2 A ruler
//   4  panel b: Pseudomonas sp. PDC86 Aapf bound to HEHEAA (PDB 7KZ9), 1.3 A
//   5  panel c: human Galectin-3 carbohydrate-recognition domain with compound 22 (PDB 7XFA), 0.44 A
//   6  the three rulers together; these are hand-picked, and over all 428 complexes it is 76.4% under 2 A (Fig. 1c, the chart before)
//
// Checked against the main text and Extended Data Fig. 3's caption: "AlphaFold 3 predictions of PoseBusters examples for which Vina and Gold were
// inaccurate. Predicted protein chains are shown in blue, predicted ligands in orange, and ground truth in grey. a, Human Notum bound to inhibitor ARUK3004556
// (PDB ID 8BTI, ligand RMSD: 0.65 A). b, Pseudomonas sp. PDC86 Aapf bound to HEHEAA (PDB ID 7KZ9, ligand RMSD: 1.3 A). c, Human Galectin-3 carbohydrate-recognition
// domain in complex with compound 22 (PDB ID 7XFA, ligand RMSD: 0.44 A)." Results: PoseBusters is 428 protein-ligand structures released to the PDB in 2021 or later,
// so a separate AF3 with a 30 September 2019 cutoff was trained; success is a pocket-aligned ligand RMSD under 2 A; 76.4% over all 428 (Extended Data Table 1).
// The image is figures/image82.png (the figure with its caption, 1860 x 520 px, converted from the pptx); the panels are cut out of it by the boxes below, and the
// caption is set again as text.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const GR = '#2f9e44', MG = '#c2255c';
const SW = { blue: '#6aa1cf', orange: '#f0a53a', grey: '#bcbcbc' };                                      // the colours of the figure
const NAT = { a: [50, 30, 556, 318], b: [672, 30, 583, 318], c: [1326, 30, 516, 318] };                // the three panels in the image (x, y, w, h in pixels)
const ASP = { a: NAT.a[2] / NAT.a[3], b: NAT.b[2] / NAT.b[3], c: NAT.c[2] / NAT.c[3] };
const KEYS = ['a', 'b', 'c'];
const INFO = {
  a: { id: '8BTI', lines: ['Human Notum', 'bound to the inhibitor', 'ARUK3004556'], short: ['Human Notum', 'inhibitor ARUK3004556'], rmsd: 0.65 },
  b: { id: '7KZ9', lines: ['Aapf from Pseudomonas', 'sp. PDC86, bound', 'to HEHEAA'], short: ['Pseudomonas Aapf', 'bound to HEHEAA'], rmsd: 1.3 },
  c: { id: '7XFA', lines: ['Human Galectin-3,', 'carbohydrate-recognition', 'domain, with compound 22'], short: ['Human Galectin-3 domain', 'with compound 22'], rmsd: 0.44 },
};
const H_ROW = 150, H_FOC = 300, Y_ROW = 62, Y_FOC = 52;
const ROWX = { a: 55, b: 372, c: 702 };
const rowRect = (k, op) => [ROWX[k], Y_ROW, ASP[k] * H_ROW, H_ROW, op];
const focRect = (k) => [14, Y_FOC, ASP[k] * H_FOC, H_FOC, 1];
// where each panel is at the end of each step (x, y, w, h, opacity); the tween moves it from the step before
const FRAMES = {
  a: [rowRect('a', 0), rowRect('a', 1), focRect('a'), rowRect('a', 0), rowRect('a', 0), rowRect('a', 1)],
  b: [rowRect('b', 0), rowRect('b', 1), rowRect('b', 0), focRect('b'), rowRect('b', 0), rowRect('b', 1)],
  c: [rowRect('c', 0), rowRect('c', 1), rowRect('c', 0), rowRect('c', 0), focRect('c'), rowRect('c', 1)],
};
const CHIPS = [['Input', 'protein sequence + ligand', ''], ['Model', 'AF3', 'trained on data up to Sept. 2019'], ['Output', 'the joint 3D complex', ''], ['Success', 'ligand RMSD < 2 Å', 'against the experimental structure']];

const CAPTIONS = [
  'AF3 gets a protein sequence and a ligand and predicts the whole 3D complex. A pose is right if the ligand lies within 2 Å RMSD of the experimental one. Test set: PoseBusters V1, 428 complexes.',
  'Three examples from the paper (Extended Data Fig. 3), chosen as cases where the docking tools Vina and Gold were inaccurate. Blue: predicted protein. Orange: predicted ligand. Grey: the experimental structure.',
  'a. Human Notum bound to the inhibitor ARUK3004556 (PDB 8BTI). The predicted ligand lies on the true one: RMSD 0.65 Å, well inside the 2 Å limit.',
  'b. Aapf from Pseudomonas sp. PDC86 bound to HEHEAA (PDB 7KZ9). RMSD 1.3 Å: inside the limit, and the closest of the three to it.',
  'c. The carbohydrate-recognition domain of human Galectin-3 with compound 22 (PDB 7XFA). RMSD 0.44 Å, the best of the three.',
  'All three are under 2 Å. They are hand-picked examples, though. Over all 428 complexes, 76.4% of the poses are under 2 Å, as in the chart before.',
];

AF3.kinds.poses = (s) => ({
  steps: 6,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(`
      .po-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .po-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .po-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .po-t.muted { fill: var(--muted); }
      .po-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .po-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const pic = s.items.find((it) => it.kind === 'pic');
    const IMG = AF3.fig(pic.file);

    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" class="po-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const line = (x1, y1, x2, y2, col, w, op) => op < 0.01 ? '' : `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op.toFixed(2)}"/>`;
    const arrow = (x1, y, x2, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" stroke="var(--muted)" stroke-width="2"/><polygon points="${x2},${y} ${x2 - 8},${y - 5} ${x2 - 8},${y + 5}" fill="var(--muted)"/></g>`;
    const check = (x, y, ok, op) => op < 0.01 ? '' : (ok
      ? `<g opacity="${op.toFixed(2)}"><circle cx="${x}" cy="${y}" r="11" fill="${GR}"/><path d="M${x - 5.5} ${y} l4 4.5 l7 -9" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`
      : '');
    const chain = (frames, ts) => frames.slice(1).reduce((acc, fr, i) => acc.map((v, j) => lerp(v, fr[j], ts[i])), frames[0]);   // frames[0], then toward each next frame by its own progress
    // a panel: the real picture, cut out of the figure
    const panel = (k, r, letterOp) => {
      const [x, y, w, h, op] = r;
      if (op < 0.01) return '';
      const [nx, ny, nw, nh] = NAT[k];
      return `<g opacity="${op.toFixed(2)}"><svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${nx} ${ny} ${nw} ${nh}" preserveAspectRatio="none" style="overflow:hidden"><image href="${IMG}" width="1860" height="520"/></svg>`
        + `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="none" stroke="var(--muted)" stroke-width="1.6"/>`
        + `<circle cx="${(x + 17).toFixed(1)}" cy="${(y + 17).toFixed(1)}" r="12" fill="var(--bg)" stroke="var(--muted)" stroke-width="1.4"/><text x="${(x + 17).toFixed(1)}" y="${(y + 17).toFixed(1)}" font-size="15" font-weight="700" class="po-t" text-anchor="middle">${k}</text></g>`;
    };
    // a ruler from 0 to 3 A with the limit at 2 A; the dot slides to the value
    const ruler = (x0, y, sc, v, p, op, big) => {
      if (op < 0.01) return '';
      let g = rect(x0, y - 8, 2 * sc, 16, GR, 'none', 0, op * 0.22, 4) + rect(x0 + 2 * sc, y - 8, sc, 16, MG, 'none', 0, op * 0.22, 4) + rect(x0, y - 8, 3 * sc, 16, 'none', 'var(--muted)', 1.4, op, 4);
      for (let t = 0; t <= 3; t++) g += line(x0 + t * sc, y + 8, x0 + t * sc, y + 14, 'var(--muted)', 1.4, op) + txt(x0 + t * sc, y + 26, big ? 14 : 12, String(t), op, { muted: true });
      g += txt(x0 + 3 * sc + (big ? 12 : 8), y + 26, big ? 14 : 12, 'Å', op, { anchor: 'start', muted: true });
      g += line(x0 + 2 * sc, y - 16, x0 + 2 * sc, y + 10, 'var(--fg)', 2.4, op) + txt(x0 + 2 * sc, y - 26, big ? 14 : 12, 'limit 2 Å', op, { bold: true });
      const dx = x0 + v * sc * p, ok = v < 2;
      g += `<circle cx="${dx.toFixed(1)}" cy="${y}" r="${big ? 10 : 8}" fill="${ok ? GR : MG}" stroke="var(--bg)" stroke-width="2.4" opacity="${(op * (p > 0.01 ? 1 : 0)).toFixed(2)}"/>`;
      g += txt(dx, y - (big ? 46 : 38), big ? 26 : 16, `${(v * p).toFixed(v < 1 ? 2 : 1)} Å`, op * ramp(p, 0.05, 0.3), { bold: true, fill: ok ? GR : MG });
      return g;
    };

    const draw = (st) => {
      const K = [0, st.k1, st.k2, st.k3, st.k4, st.k5, st.k6];
      let h = '';

      // ---- the setup: four chips, big at the start, then a strip along the top ----
      const t2 = ramp(K[2], 0, 0.5);
      CHIPS.forEach(([head, main, sub], i) => {
        const x = 14 + i * 248, op = ramp(K[1], 0.08 + 0.18 * i, 0.4 + 0.18 * i), y = lerp(142, 2, t2), hh = lerp(96, 34, t2), cy = y + hh / 2;
        h += rect(x, y, 226, hh, 'var(--bg)', 'var(--muted)', 1.6, op, lerp(12, 8, t2));
        h += txt(x + 113, cy, lerp(17, 14, t2), main, op, { bold: true }) + txt(x + 113, cy - 30, 12.5, head, op * (1 - ramp(K[2], 0, 0.25)), { muted: true }) + txt(x + 113, cy + 30, 12, sub, op * (1 - ramp(K[2], 0, 0.25)), { muted: true });
        if (i < 3) h += arrow(x + 228, lerp(190, 19, t2), x + 246, op * ramp(K[1], 0.2 + 0.18 * i, 0.5 + 0.18 * i));
      });
      const facts = ramp(K[1], 0.62, 0.9) * (1 - ramp(K[2], 0, 0.3));
      h += txt(500, 280, 18, '<tspan font-weight="700">PoseBusters V1:</tspan> 428 protein–ligand complexes, released in 2021 or later', facts);
      h += txt(500, 312, 15, 'A separate AF3, trained only on structures from before Sept. 2019, so it had seen none of them', facts, { muted: true });

      // ---- the panels: a row, then one at a time, then the row again ----
      const rects = {};
      KEYS.forEach((k) => { rects[k] = chain(FRAMES[k], [2, 3, 4, 5, 6].map((s) => ramp(K[s], 0, 0.5))); });
      KEYS.forEach((k) => { h += panel(k, rects[k]); });

      // ---- the names under the row ----
      const rowLab = ramp(K[2], 0.4, 0.8) * (1 - ramp(K[3], 0, 0.3) * (1 - ramp(K[6], 0.3, 0.6)));
      KEYS.forEach((k) => {
        const cx = ROWX[k] + (ASP[k] * H_ROW) / 2;
        h += txt(cx, Y_ROW + H_ROW + 18, 14, `<tspan font-weight="700">${INFO[k].id}</tspan> ${INFO[k].short[0]}`, rowLab) + txt(cx, Y_ROW + H_ROW + 36, 12, INFO[k].short[1], rowLab, { muted: true });
      });

      // ---- the legend ----
      const leg = ramp(K[2], 0.4, 0.8) * (1 - ramp(K[6], 0.5, 0.7));
      [['predicted protein', SW.blue, 250], ['predicted ligand', SW.orange, 480], ['experimental structure', SW.grey, 690]].forEach(([lab, col, x]) => {
        h += rect(x, 366, 22, 10, col, 'var(--muted)', 1, leg, 2) + txt(x + 30, 371, 14, lab, leg, { anchor: 'start', muted: true });
      });
      const real = ramp(K[6], 0.62, 0.9);
      h += txt(500, 371, 16, 'Hand-picked. Over all 428 complexes: <tspan font-weight="700">76.4%</tspan> of the poses are under 2 Å.', real);

      // ---- one at a time: the name, and the ruler ----
      const focus = { a: ramp(K[3], 0.3, 0.6) * (1 - ramp(K[4], 0, 0.3)), b: ramp(K[4], 0.3, 0.6) * (1 - ramp(K[5], 0, 0.3)), c: ramp(K[5], 0.3, 0.6) * (1 - ramp(K[6], 0, 0.3)) };
      const stepOf = { a: 3, b: 4, c: 5 };
      KEYS.forEach((k) => {
        const o = focus[k];
        if (o < 0.01) return;
        const x0 = 620;
        h += txt(x0, 84, 14, 'PDB', o, { anchor: 'start', muted: true }) + txt(x0 + 34, 82, 30, INFO[k].id, o, { anchor: 'start', bold: true });
        INFO[k].lines.forEach((ln, i) => { h += txt(x0, 124 + i * 22, 16, ln, o, { anchor: 'start', muted: i > 0 }); });
        h += txt(x0, 206, 14, 'ligand RMSD, predicted against experiment', o, { anchor: 'start', muted: true });
        const p = ramp(K[stepOf[k]], 0.5, 0.95);
        h += ruler(x0 + 8, 282, 112, INFO[k].rmsd, p, o, true);
        h += check(x0 + 19, 330, INFO[k].rmsd < 2, o * ramp(p, 0.85, 1)) + txt(x0 + 38, 330, 16, 'inside the 2 \u00c5 limit', o * ramp(p, 0.85, 1), { anchor: 'start', bold: true, fill: GR });
      });

      // ---- the three rulers together ----
      const all = ramp(K[6], 0.45, 0.75), pd = ramp(K[6], 0.55, 0.95);
      KEYS.forEach((k) => {
        const w = ASP[k] * H_ROW, cx = ROWX[k] + w / 2, sc = 70;
        h += ruler(cx - 1.5 * sc, 318, sc, INFO[k].rmsd, pd, all, false);
      });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="po-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Three examples from the paper: the predicted protein and ligand overlaid on the experimental structure for human Notum with an inhibitor (RMSD 0.65 angstrom), Aapf from Pseudomonas with HEHEAA (1.3 angstrom) and human Galectin-3 with compound 22 (0.44 angstrom), each against the 2 angstrom limit"></svg></div>
      <div class="po-caps">${CAPTIONS.map((t, i) => `<p class="po-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>`;
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
        const ms = [0, 5000, 3500, 6500, 6500, 6500, 7500][step], t0 = performance.now();
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
