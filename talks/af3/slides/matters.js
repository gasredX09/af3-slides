// "Why is it important?" (slide 6), the first slide with content, played a click at a time. The slide had three bullets, the paper's three example pictures in a
// column and a stray "For that: Protein Structure -> Biomolecular System". Its words are kept; the title is now the first bullet (it was the template's question).
//
//   1  the three pictures arrive, one after another: the paper's Fig. 3a, 3b and 3c, each with what it shows
//   2  the four kinds of interaction of the bullets: protein with protein, DNA, RNA, ligand
//   3  what it is for, from the bullets: mechanism, drug discovery, therapeutic design
//   4  the bridge: from the structure of a protein to the structure of the whole biomolecular system (the slide's last line)
//
// Nothing here is made up: the pictures are the paper's own, cut out of the pictures the pptx had, and the labels are from the legend of Fig. 3: "Selected structure predictions
// from AF3. Predicted protein chains are shown in blue (predicted antibody in green), predicted ligands and glycans in orange, predicted RNA in purple and the ground truth is
// shown in grey. a, Human 40S small ribosomal subunit (7,663 residues) including 18S ribosomal RNA and Met-tRNAiMet (opaque purple) in a complex with translation initiation
// factors eIF1A and eIF5B (opaque blue; PDB 7TQL; full-complex LDDT, 87.7; GDT, 86.9). b, The glycosylated globular portion of an EXTL3 homodimer (PDB 7AU2; mean pocket-aligned
// r.m.s.d., 1.10 A). c, Mesothelin C-terminal peptide bound to the monoclonal antibody 15B6 (PDB 7U8C; DockQ, 0.85)." The pictures are figures/image43.png (a), image19 (b) and
// image7 (c), cut by the boxes below so the panel letters are left out.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const PIC = [
  { file: 'image43.png', size: [770, 682], cut: [20, 46, 741, 628], name: 'Human ribosomal subunit', sub: 'with RNA and initiation factors, 7TQL' },
  { file: 'image19.png', size: [706, 702], cut: [0, 62, 706, 640], name: 'Glycosylated EXTL3', sub: 'homodimer, 7AU2' },
  { file: 'image7.png', size: [556, 684], cut: [40, 0, 442, 684], name: 'Antibody 15B6', sub: 'bound to a peptide, 7U8C' },
];
const CW = 290, CX = [25, 355, 685], CH = 262, ZY = 10, ZH = 208;
const KINDS = ['Protein – protein', 'Protein – DNA', 'Protein – RNA', 'Protein – ligand'];
const USES = ['Mechanism', 'Drug discovery', 'Therapeutic design'];
const CAPTIONS = [
  'Three examples from the paper (Fig. 3), AF3 predictions laid over the experimental structure (grey): a ribosomal subunit with RNA, a glycosylated protein, and an antibody on a peptide.',
  'The interactions that matter: a protein with another protein, with DNA, with RNA, or with a ligand.',
  'Knowing them is how we explain a mechanism, find a drug or design a therapeutic.',
  'For that, we need to go from the structure of a protein to the structure of the whole biomolecular system.',
];

AF3.kinds.matters = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(`
      .ma-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .ma-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ma-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .ma-t.muted { fill: var(--muted); }
      .ma-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .ma-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const ACC = 'var(--accent)';
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" class="ma-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const pic = (p, bx, by, bw, bh, op) => {   // the real picture, cut out and fitted into a box, centred
      const [nx, ny, nw, nh] = p.cut, [iw, ih] = p.size, r = Math.min(bw / nw, bh / nh), w = nw * r, h = nh * r, x = bx + (bw - w) / 2, y = by + (bh - h) / 2;
      return `<g opacity="${op.toFixed(2)}"><svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${nx} ${ny} ${nw} ${nh}" preserveAspectRatio="none" style="overflow:hidden"><image href="${AF3.fig(p.file)}" x="0" y="0" width="${iw}" height="${ih}"/></svg></g>`;
    };
    const arrow = (x1, y, x2, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><line x1="${x1}" y1="${y}" x2="${x2 - 8}" y2="${y}" stroke="var(--muted)" stroke-width="3"/><polygon points="${x2},${y} ${x2 - 14},${y - 8} ${x2 - 14},${y + 8}" fill="var(--muted)"/></g>`;

    const draw = (st) => {
      const K = [0, st.k1, st.k2, st.k3, st.k4];
      const dim = 1 - 0.82 * ramp(K[4], 0, 0.45);
      let h = '';
      PIC.forEach((p, i) => {
        const o = ramp(K[1], 0.1 + 0.25 * i, 0.4 + 0.25 * i) * dim, x = CX[i];
        h += rect(x, 0, CW, CH, 'var(--bg)', 'var(--muted)', 1.6, o, 12) + pic(p, x + 10, ZY, CW - 20, ZH, o);
        h += txt(x + CW / 2, 232, 16, p.name, o, { bold: true }) + txt(x + CW / 2, 251, 12.5, p.sub, o, { muted: true });
      });
      KINDS.forEach((k, i) => {
        const o = ramp(K[2], 0.08 + 0.16 * i, 0.38 + 0.16 * i) * dim, w = 228, x = 25 + i * 243;
        h += rect(x, 286, w, 36, 'color-mix(in srgb, var(--accent) 9%, var(--bg))', ACC, 1.6, o, 18) + txt(x + w / 2, 304, 17, k, o, { bold: true });
      });
      h += txt(25, 356, 14, 'Used for', ramp(K[3], 0, 0.3) * dim, { anchor: 'start', muted: true });
      USES.forEach((u, i) => {
        const o = ramp(K[3], 0.1 + 0.2 * i, 0.4 + 0.2 * i) * dim, w = 228, x = 120 + i * 243;
        h += rect(x, 338, w, 36, 'var(--bg)', 'var(--muted)', 1.6, o, 18) + txt(x + w / 2, 356, 17, u, o, { bold: true });
      });

      // ---- the bridge ----
      const b = ramp(K[4], 0.3, 0.8), by = 138, bh = 118;
      h += rect(60, by, 360, bh, 'var(--bg)', 'var(--muted)', 1.8, b, 14) + txt(240, by + 44, 30, 'Protein structure', b, { bold: true }) + txt(240, by + 84, 15, 'one protein or protein complex', b, { muted: true });
      h += arrow(436, by + bh / 2, 560, ramp(K[4], 0.5, 0.9));
      const b2 = ramp(K[4], 0.6, 1);
      h += rect(580, by, 360, bh, 'color-mix(in srgb, var(--accent) 10%, var(--bg))', ACC, 2.2, b2, 14) + txt(760, by + 44, 30, 'Biomolecular system', b2, { bold: true }) + txt(760, by + 84, 15, 'proteins, DNA, RNA, ligands, together', b2, { muted: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">Molecular function depends on interactions</h2>
      <div class="ma-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Three example complexes predicted by AlphaFold 3 (a ribosomal subunit with RNA, a glycosylated protein, an antibody bound to a peptide), the four kinds of interaction, what knowing them is used for, and the step from the structure of a protein to the structure of a whole biomolecular system"></svg></div>
      <div class="ma-caps">${CAPTIONS.map((t, i) => `<p class="ma-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>`;
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
        const ms = [0, 5000, 3500, 3500, 4500][step], t0 = performance.now();
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
