// Tokenization (slide 19): the five molecules of the original slide, redrawn from SMILES (tools/prep_tokens.py:
// RDKit 2D layouts, heavy atoms only), and the rule played on them.
//
// The rule (Abramson et al., Supplementary Methods 2.6): a standard amino acid or nucleotide is one token; a modified
// residue or a ligand is one token per heavy atom. The atom counts are RDKit's, and match the numbers on the original
// slide (7, 23, 11, 24, 15).
//
// Steps: 1 the molecules and their heavy-atom counts · 2 standard residues: one outline around the whole residue,
// "1 token" · 3 modified residues and the ligand: a ring round every heavy atom, one token each.
{
AF3.kinds.tokens = (s) => ({
  steps: 3,
  notes: s.notes || '',
  mount(frame, { css, esc, palette: P }) {
    css(AF3.arch.miniCss + `
      .tk-row { position: absolute; left: 4.2%; right: 4.2%; top: 14.5%; display: flex; justify-content: space-between; }
      .tk-mol { width: 18%; text-align: center; transition: opacity .4s; }
      .tk-mol svg { display: block; width: 100%; height: auto; overflow: visible; }
      .tk-bond { stroke: var(--muted); stroke-width: 2.4; stroke-linecap: round; }
      .tk-hull { fill: color-mix(in srgb, var(--accent) 9%, transparent); stroke: var(--accent); stroke-width: 2.4;
        stroke-dasharray: 7 5; opacity: 0; transition: opacity .45s; }
      .tk-ring { fill: color-mix(in srgb, var(--accent) 12%, transparent); stroke: var(--accent); stroke-width: 2; opacity: 0;
        transition: opacity .35s; transition-delay: calc(var(--i, 0) * 60ms); }
      .tk-t { margin: .5em 0 0; font-size: var(--t-small); font-weight: 700; line-height: 1.2; }
      .tk-n { margin: .1em 0 0; font-size: var(--t-caption); color: var(--muted); }
      .tk-c { margin: .6em 0 0; font-size: var(--t-body); line-height: 1.25; font-variant-numeric: tabular-nums; }
      .tk-c .res { display: block; min-height: 1.25em; opacity: 0; transition: opacity .4s; color: var(--accent); font-weight: 700; }
      .tk-rules { position: absolute; left: 4.2%; right: 4.2%; top: 71%; margin: 0; padding: 0; list-style: none; font-size: var(--t-lead); }
      .tk-rules li { margin-bottom: .2em; }
      .tk-legend { position: absolute; left: 4.2%; top: 86%; margin: 0; font-size: var(--t-caption); color: var(--muted); display: flex; gap: 1.4em; }
      .tk-legend i { display: inline-block; width: .85em; height: .85em; border-radius: 50%; margin-right: .4em; vertical-align: -.08em; }
      [data-step="2"] .tk-mol.standard .tk-hull, [data-step="3"] .tk-mol.standard .tk-hull { opacity: 1; }
      [data-step="3"] .tk-mol.atoms .tk-ring { opacity: 1; }
      [data-step="2"] .tk-mol.atoms { opacity: .3; } [data-step="3"] .tk-mol.standard { opacity: .55; }
      [data-step="2"] .tk-mol.standard .res, [data-step="3"] .tk-mol.atoms .res, [data-step="3"] .tk-mol.standard .res { opacity: 1; }
      .deck-frame.instant .tk-hull, .deck-frame.instant .tk-ring, .deck-frame.instant .tk-mol, .deck-frame.instant .tk-c .res { transition: none; }
    `);
    const mols = window.DATA.tokens;
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const rules = AF3.texts(s).find((t) => t.paras.length === 2 && !t.ph);
    const EL = P.el;
    const molSvg = (m) => {
      const xs = m.atoms.map((a) => a.x), ys = m.atoms.map((a) => a.y);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      const k = Math.min(30, 160 / Math.max(w, h, 1));              // one bond length at most 30 units, so a big molecule still fits
      const at = (a) => [100 + a.x * k, 100 + a.y * k];
      const bonds = m.bonds.map((b) => {
        const [x1, y1] = at(m.atoms[b.a]), [x2, y2] = at(m.atoms[b.b]);
        if (b.order !== 2) return `<line class="tk-bond" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
        const dx = y2 - y1, dy = x1 - x2, len = Math.hypot(dx, dy) || 1, ox = (dx / len) * 2.6, oy = (dy / len) * 2.6;   // two parallel lines
        return [-1, 1].map((sg) => `<line class="tk-bond" x1="${(x1 + sg * ox).toFixed(1)}" y1="${(y1 + sg * oy).toFixed(1)}" x2="${(x2 + sg * ox).toFixed(1)}" y2="${(y2 + sg * oy).toFixed(1)}"/>`).join('');
      }).join('');
      const dots = m.atoms.map((a) => { const [x, y] = at(a); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.6" fill="${EL[a.el] || EL.other}"/>`; }).join('');
      const rings = m.kind === 'atoms'
        ? m.atoms.map((a, i) => { const [x, y] = at(a); return `<circle class="tk-ring" style="--i:${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"/>`; }).join('')
        : (() => {
          const px = m.atoms.map((a) => at(a)[0]), py = m.atoms.map((a) => at(a)[1]), pad = 16;
          return `<rect class="tk-hull" x="${(Math.min(...px) - pad).toFixed(1)}" y="${(Math.min(...py) - pad).toFixed(1)}" width="${(Math.max(...px) - Math.min(...px) + 2 * pad).toFixed(1)}" height="${(Math.max(...py) - Math.min(...py) + 2 * pad).toFixed(1)}" rx="22"/>`;
        })();
      return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(m.name)}">${rings}${bonds}${dots}</svg>`;
    };
    const cell = (m) => `<div class="tk-mol ${m.kind}">${molSvg(m)}
      <p class="tk-t">${esc(m.title)}</p><p class="tk-n">${esc(m.name)}</p>
      <p class="tk-c">${m.heavyAtoms} atoms<span class="res"> → ${m.tokens} token${m.tokens > 1 ? 's' : ''}</span></p></div>`;
    const seen = ['C', 'N', 'O', 'P'].filter((e) => mols.some((m) => m.atoms.some((a) => a.el === e)));
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="tk-row">${mols.map(cell).join('')}</div>
      <ul class="tk-rules">${rules.paras.map((p, i) => `<li class="reveal-in" data-from="${i + 2}">${AF3.paraHtml(p, esc, {})}</li>`).join('')}</ul>
      <p class="tk-legend">${seen.map((e) => `<span><i style="background:${EL[e]}"></i>${e}</span>`).join('')}<span>heavy atoms only, no hydrogens</span></p>      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;
    return {
      enter(step, animate) { frame.classList.toggle('instant', !animate); frame.dataset.step = step; Deck.show(frame, step, animate); },
    };
  },
});
}
