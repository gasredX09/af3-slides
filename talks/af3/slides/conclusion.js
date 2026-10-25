// "Conclusion: Main ideas that made AlphaFold 3 a general biomolecular model" (slide 62): the three ideas of the original (Tokenization, The Pairformer,
// Diffusion instead of regression) as three cards that arrive left to right, in the order the data flows (the three stages of the Main idea section), each with a
// small drawing that plays, what AF2 did, and what AF3 does. A last click joins them: every kind of molecule in, atom coordinates out.
//
//   1  Tokenization: serine (7 heavy atoms) gets one token, ibuprofen (15) one token per atom, counted up
//   2  The Pairformer: a toy pair map that sharpens as the block counter runs to 48
//   3  Diffusion instead of regression: toy points that start as noise and settle into a structure
//   4  the cards dim; protein, DNA, RNA, ligands and modified residues -> AlphaFold 3 -> atom coordinates of the whole complex
//   5  (the conclusion only) the result in one line: more accurate than the methods built for one task each in all but one category tested
//
// The same drawing is the "three swaps" slide (slide 101, kind `swaps`) at the start of the Main idea section, after its outline: the three ideas as what AF3 changes
// from AF2, with the plan of AF2 kept. The conclusion then comes back to them with the evidence. Both are made by `make` below; `swaps` has four clicks, the conclusion five.
//
// Checked against the paper and the supplement. Tokenization (Supplementary Methods 2.6): "A standard amino acid residue is represented as a single token. A standard
// nucleotide residue is represented as a single token. A modified amino acid or nucleotide residue is tokenized per-atom (i.e. N tokens for an N-atom residue). All
// ligands are tokenized per-atom"; AF2's unit was the protein residue. The atom counts are the ones of the tokenization slide (slide 19), from RDKit on the SMILES
// (data/tokens.js): serine 7, ibuprofen 15. Pairformer (main text, Fig. 2a, Supplementary Methods 3.6, Alg. 17): "replaces the evoformer of AF2 as the dominant processing
// block. It operates only on the pair representation and the single representation; the MSA representation is not retained and all information passes through the pair
// representation. The pair processing and the number of blocks (48) is largely unchanged from AF2"; the MSA processing is cut to four blocks of an "inexpensive pair-weighted
// averaging" (MSA module, Alg. 8); "the pair representation is used to control information flow in the single representation by biasing the Attention logits" (3.6).
// "The overall structure of AF3 (Fig. 1d and Supplementary Methods 3) echoes that of AF2, with a large trunk evolving a pairwise representation of the chemical complex followed by a
// structure module that uses the pairwise representation to generate explicit atomic positions, but there are large differences in each major component" (main text, Network
// architecture and training): the line under the title of the swaps slide. The result line: "In all but one category, it achieves a substantially higher performance than strong methods
// that specialize in just the given task (Fig. 1c and Extended Data Table 1)" (main text, introduction); the one category is RNA structure on CASP15 (slide 52).
// Diffusion (main text, Fig. 2b, Methods 3.7): the system "directly predicts the raw atom coordinates with a diffusion module, replacing the AF2 structure module that operated
// on amino-acid-specific frames and side-chain torsion angles"; the module "operates directly on raw atom coordinates, and on a coarse abstract token representation, without
// rotational frames or any equivariant processing"; "At the inference time, random noise is sampled and then recurrently denoised to produce a final structure"; its blocks are
// 3 + 24 + 3 (atom encoder, token transformer, atom decoder; Algs. 20, 23, 25). The three stage names under the cards are the ones of the deck's own outline (Input preparation,
// Representation learning, Structure prediction). The two molecules are real drawings; the pair map and the points are a toy (made up, seed 5 and 3), and labelled so.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const W = 1000, CH = 362;
const CARD = { w: 308, h: 286 }, CX = [8, 346, 684];
const STAGE = ['Input preparation', 'Representation learning', 'Structure prediction'];
const BEFORE = ['AF2: one token per protein residue', 'AF2: the Evoformer, heavy MSA processing', 'AF2: residue frames and torsion angles'];
const NOW = [['One token per residue or base,', 'one per atom for anything else'], ['A light MSA step, then 48 blocks', 'that work on pairs of tokens'], ['Denoises raw atom coordinates:', 'no frames, no torsion angles']];
const CHIPS = [['Proteins', 102], ['DNA', 76], ['RNA', 76], ['Ligands', 96], ['Modified residues', 178]];
const CAPTIONS = [
  'Tokenization: a standard amino acid or nucleotide is one token, a modified residue or a ligand gets one token per heavy atom. Serine is 1 token, ibuprofen 15. Every molecule becomes the same kind of list.',
  'The Pairformer: after a light MSA step, 48 blocks work on a vector for every pair of tokens. All information passes through the pair representation, which steers the single representation.',
  'Diffusion instead of regression: the module starts from random noise and denoises raw atom coordinates (3 + 24 + 3 blocks). No residue frames or torsion angles, so the same module places the atoms of any molecule.',
  'One model: proteins, DNA, RNA, ligands and modified residues go in as tokens, and atom coordinates for the whole complex come out.',
  'Against methods built for one task each, AF3 was more accurate in all but one of the categories tested (main text, Fig. 1c).',
];

// ---- the toy pair map of card 2 (7 x 7): noise at first, then a band along the diagonal and a few off-diagonal contacts
const NG = 7;
const PAIR = (() => {
  const r = rng(5), noise = [], target = [];
  for (let i = 0; i < NG; i++) { noise.push([]); target.push([]); }
  for (let i = 0; i < NG; i++) for (let j = i; j < NG; j++) {
    const n = 0.1 + 0.4 * r(), d = Math.abs(i - j);
    let t = d === 0 ? 0.95 : d === 1 ? 0.6 : d === 2 ? 0.28 : 0.06;
    if ((i === 1 && j === 5) || (i === 2 && j === 4)) t = 0.85;
    noise[i][j] = noise[j][i] = n; target[i][j] = target[j][i] = t;
  }
  return { noise, target };
})();

// ---- the toy points of card 3: ONE co-folded complex, not two things side by side: a protein helix of 20 points that curls into a cup
// (8 more points), and a ring of 6 with two substituents sitting in the cup, in contact with the chain. Each point has one fixed noise draw.
const PTS = (() => {
  const r = rng(3), gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const pts = [], bonds = [], contacts = [];
  for (let i = 0; i < 20; i++) pts.push({ x: 20 + i * 9.37, y: 134 + 16 * Math.sin((i - 19) * 0.9), type: 'p' });   // the helix, ending level with the cup
  const CUP = { x: 234, y: 134, r: 25 };
  for (let k = 0; k < 8; k++) {                                                           // the cup: from the left of the ligand, over its top, to the upper right
    const a = (Math.PI * (180 + k * 21.43)) / 180;
    pts.push({ x: CUP.x + CUP.r * Math.cos(a), y: CUP.y + CUP.r * Math.sin(a), type: 'p' });
  }
  const nProt = pts.length;
  for (let i = 0; i < nProt - 1; i++) bonds.push([i, i + 1]);
  const c0 = pts.length;
  for (let k = 0; k < 6; k++) pts.push({ x: CUP.x + 13 * Math.cos((k * Math.PI) / 3), y: CUP.y + 13 * Math.sin((k * Math.PI) / 3), type: 'l' });
  for (let k = 0; k < 6; k++) bonds.push([c0 + k, c0 + ((k + 1) % 6)]);
  pts.push({ x: CUP.x + 20, y: CUP.y + 25, type: 'l' }); bonds.push([c0 + 1, c0 + 6]);       // two substituents, pointing out of the cup's open side
  pts.push({ x: CUP.x - 20, y: CUP.y + 25, type: 'l' }); bonds.push([c0 + 2, c0 + 7]);
  for (let k = 0; k < 6; k++) {                                                           // contacts: each ring atom with the nearest chain point, if close
    let best = -1, bd = 1e9;
    for (let i = 0; i < nProt; i++) { const d = Math.hypot(pts[c0 + k].x - pts[i].x, pts[c0 + k].y - pts[i].y); if (d < bd) { bd = d; best = i; } }
    if (bd < 20) contacts.push([c0 + k, best]);
  }
  pts.forEach((q) => { q.ex = gauss(); q.ey = gauss(); });
  return { pts, bonds, contacts };
})();
const NOISE = 62;                                                                   // noise scale at sigma = 1, in map units
const bondsAt = (sigma) => 1 - ramp(sigma, 0.05, 0.45);

const make = (swaps) => (s) => ({
  steps: swaps ? 4 : 5,
  notes: s.notes || '',
  mount(frame, { css, esc, palette: P }) {
    css(`
      .cl-sub { position: absolute; left: 4.2%; right: 4.2%; top: 13.5%; margin: 0; font-size: var(--t-lead); line-height: 1.2; }
      .cl-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 22.5%; }
      .cl-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .cl-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .cl-t.muted { fill: var(--muted); }
      .cl-caps { position: absolute; left: 4.2%; right: 4.2%; top: 85%; height: 10%; }
      .cl-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).slice().sort((a, b) => a.g.y - b.g.y)[0];
    const sub = AF3.texts(s).find((t) => t.paras.length === 1 && t.g.y > 0.1);   // the line under the title
    const head = swaps ? 'From AF2 to AF3: three swaps' : AF3.plain(title.paras[0]);
    const line = swaps ? 'The plan stays: a trunk builds a pair map, then atoms are placed.' : AF3.plain(sub.paras[0]);
    const ideas = AF3.texts(s).find((t) => t.paras.length === 3).paras.map((p) => AF3.plain(p));
    const mols = { serine: window.DATA.tokens.find((m) => m.id === 'serine' || m.name === 'serine'), ibuprofen: window.DATA.tokens.find((m) => m.id === 'ibuprofen' || m.name === 'ibuprofen') };
    const ACC = 'var(--accent)';
    const BLUE = P.series[2], GREEN = P.ligand;

    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" class="cl-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0, extra = '') => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} style="fill:${fill};stroke:${stroke};stroke-width:${sw}" opacity="${op.toFixed(2)}" ${extra}/>`;
    const arrow = (x1, y, x2, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" stroke="var(--muted)" stroke-width="2.2"/><polygon points="${x2},${y} ${x2 - 9},${y - 5.5} ${x2 - 9},${y + 5.5}" fill="var(--muted)"/></g>`;
    const wrap2 = (str) => {
      if (str.length <= 18) return [str];
      const mid = str.length / 2, spaces = [...str].map((c, i) => (c === ' ' ? i : -1)).filter((i) => i >= 0);
      const at = spaces.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
      return [str.slice(0, at), str.slice(at + 1)];
    };

    // a molecule laid out in a box (x, y, w, h): atom positions, bond lines and the box the whole thing fills
    const layout = (m, bx, by, bw, bh) => {
      const xs = m.atoms.map((a) => a.x), ys = m.atoms.map((a) => a.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const k = Math.min(20, (bw - 22) / Math.max(x1 - x0, 1), (bh - 22) / Math.max(y1 - y0, 1));
      const cx = bx + bw / 2 - ((x0 + x1) / 2) * k, cy = by + bh / 2 - ((y0 + y1) / 2) * k;
      const at = m.atoms.map((a) => [cx + a.x * k, cy + a.y * k]);
      return { at, k, hull: [cx + x0 * k - 11, cy + y0 * k - 11, (x1 - x0) * k + 22, (y1 - y0) * k + 22] };
    };
    const drawMol = (m, L, op, ringsAt) => {
      if (op < 0.01) return '';
      let g = `<g opacity="${op.toFixed(2)}">`;
      m.bonds.forEach((b) => {
        const [x1, y1] = L.at[b.a], [x2, y2] = L.at[b.b];
        if (b.order !== 2) { g += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round"/>`; return; }
        const dx = y2 - y1, dy = x1 - x2, len = Math.hypot(dx, dy) || 1, ox = (dx / len) * 1.8, oy = (dy / len) * 1.8;
        [-1, 1].forEach((sg) => { g += `<line x1="${(x1 + sg * ox).toFixed(1)}" y1="${(y1 + sg * oy).toFixed(1)}" x2="${(x2 + sg * ox).toFixed(1)}" y2="${(y2 + sg * oy).toFixed(1)}" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round"/>`; });
      });
      m.atoms.forEach((a, i) => { g += `<circle cx="${L.at[i][0].toFixed(1)}" cy="${L.at[i][1].toFixed(1)}" r="${Math.max(3, Math.min(5, L.k * 0.26)).toFixed(1)}" fill="${P.el[a.el] || P.el.other}"/>`; });
      return g + '</g>';
    };
    const LAY = { serine: layout(mols.serine, 14, 84, 128, 100), ibuprofen: layout(mols.ibuprofen, 158, 84, 138, 100) };   // in card coordinates

    // one card: the frame, the header, the drawing and the two lines of text; `p` is how far its own clicks have got
    const card = (i, p, dim, content) => {
      const ca = ramp(p, 0, 0.2) * dim;
      if (ca < 0.01) return '';
      const cx = CX[i], lines = wrap2(ideas[i]);
      let g = `<g transform="translate(${cx},${((1 - ramp(p, 0, 0.2)) * 14).toFixed(1)})" opacity="${ca.toFixed(2)}">`;
      g += rect(0, 0, CARD.w, CARD.h, 'var(--bg)', 'var(--muted)', 1.6, 1, 12);
      g += txt(16, 15, 13, STAGE[i], 1, { anchor: 'start', muted: true });
      g += `<circle cx="29" cy="${lines.length === 1 ? 46 : 49}" r="13" style="fill:${ACC}"/>` + txt(29, lines.length === 1 ? 46 : 49, 15, String(i + 1), 1, { fill: '#fff', bold: true });
      lines.forEach((ln, j) => { g += txt(52, (lines.length === 1 ? 46 : 38 + j * 24), 22, esc(ln), 1, { anchor: 'start', bold: true }); });
      g += content;
      g += txt(16, 223, 14, BEFORE[i], ramp(p, 0.6, 0.8), { anchor: 'start', muted: true });
      NOW[i].forEach((ln, j) => { g += txt(16, 247 + j * 23, 17, ln, ramp(p, 0.75 + 0.08 * j, 0.95 + 0.05 * j), { anchor: 'start', bold: true }); });
      return g + '</g>';
    };

    const draw = (st) => {
      const K = [0, st.k1, st.k2, st.k3, st.k4];
      const dim = 1 - 0.42 * ramp(K[4], 0, 0.4);
      let h = '';

      // ---- card 1: serine is one token, ibuprofen one per atom ----
      {
        const p = K[1], mo = ramp(p, 0.15, 0.4), L1 = LAY.serine, L2 = LAY.ibuprofen;
        let c = txt(78, 78, 13, 'serine, 7 atoms', mo, { muted: true }) + txt(227, 78, 13, 'ibuprofen, 15 atoms', mo, { muted: true });
        const hullOp = ramp(p, 0.38, 0.55);
        c += rect(L1.hull[0], L1.hull[1], L1.hull[2], L1.hull[3], 'color-mix(in srgb, var(--accent) 10%, transparent)', ACC, 2, hullOp, 8, 'stroke-dasharray="6 4"');
        c += drawMol(mols.serine, L1, mo) + drawMol(mols.ibuprofen, L2, mo);
        let n = 0;
        mols.ibuprofen.atoms.forEach((a, i) => {
          const o = ramp(p, 0.5 + 0.028 * i, 0.5 + 0.028 * i + 0.07);
          if (o > 0.5) n += 1;
          if (o > 0.01) c += `<circle cx="${L2.at[i][0].toFixed(1)}" cy="${L2.at[i][1].toFixed(1)}" r="${(L2.k * 0.4).toFixed(1)}" style="fill:color-mix(in srgb, var(--accent) 14%, transparent);stroke:${ACC};stroke-width:1.8" opacity="${o.toFixed(2)}"/>`;
        });
        c += txt(78, 200, 17, '1 token', ramp(p, 0.5, 0.62), { bold: true, fill: ACC }) + txt(227, 200, 17, `${n} token${n === 1 ? '' : 's'}`, ramp(p, 0.52, 0.64), { bold: true, fill: ACC });
        h += card(0, p, dim, c);
      }

      // ---- card 2: a toy pair map that sharpens while the block counter runs to 48 ----
      {
        const p = K[2], q = ramp(p, 0.25, 0.8), blocks = 1 + Math.floor(47 * q + 0.0001), gx = 22, gy = 84, cs = 14;
        let c = '';
        for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) {
          const v = lerp(PAIR.noise[i][j], PAIR.target[i][j], q), ga = ramp(p, 0.1 + 0.01 * (i + j), 0.3 + 0.01 * (i + j));
          c += rect(gx + j * cs, gy + i * cs, cs - 1.5, cs - 1.5, `color-mix(in srgb, var(--accent) ${(v * 100).toFixed(0)}%, var(--bg))`, 'none', 0, ga, 2);
        }
        c += txt(gx + (NG * cs) / 2, 200, 13, 'toy pair map', ramp(p, 0.2, 0.4), { muted: true });
        const x0 = 154, ro = ramp(p, 0.2, 0.4);
        c += txt(x0, 100, 14, 'block', ro, { anchor: 'start', muted: true });
        c += txt(x0, 138, 46, String(blocks), ro, { anchor: 'start', bold: true, fill: ACC });
        c += txt(x0 + 64, 148, 16, 'of 48', ro, { anchor: 'start', muted: true });
        c += rect(x0, 174, 136, 8, 'color-mix(in srgb, var(--muted) 22%, transparent)', 'none', 0, ro, 4) + rect(x0, 174, 136 * (blocks / 48), 8, ACC, 'none', 0, ro, 4);
        h += card(1, p, dim, c);
      }

      // ---- card 3: noise settles into a structure ----
      {
        const p = K[3], sigma = 1 - ramp(p, 0.22, 0.85), bo = bondsAt(sigma), po = ramp(p, 0.1, 0.3);
        const bx0 = 12, bx1 = 296, by0 = 84, by1 = 186;
        const pos = PTS.pts.map((q) => [Math.max(bx0, Math.min(bx1, q.x + sigma * NOISE * q.ex)), Math.max(by0, Math.min(by1, q.y + sigma * NOISE * q.ey * 0.7))]);
        let c = '';
        const co = (1 - ramp(sigma, 0.1, 0.55)) * po;   // the contacts come in with the arrangement, a little before the bonds
        if (co > 0.01) PTS.contacts.forEach(([a, b]) => { c += `<line x1="${pos[a][0].toFixed(1)}" y1="${pos[a][1].toFixed(1)}" x2="${pos[b][0].toFixed(1)}" y2="${pos[b][1].toFixed(1)}" stroke="var(--muted)" stroke-width="1.3" stroke-dasharray="3 3" opacity="${(0.9 * co).toFixed(2)}"/>`; });
        if (bo > 0.01) PTS.bonds.forEach(([a, b]) => { c += `<line x1="${pos[a][0].toFixed(1)}" y1="${pos[a][1].toFixed(1)}" x2="${pos[b][0].toFixed(1)}" y2="${pos[b][1].toFixed(1)}" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" opacity="${(bo * po).toFixed(2)}"/>`; });
        PTS.pts.forEach((q, i) => { c += `<circle cx="${pos[i][0].toFixed(1)}" cy="${pos[i][1].toFixed(1)}" r="3.6" fill="${q.type === 'p' ? BLUE : GREEN}" opacity="${po.toFixed(2)}"/>`; });
        c += txt(16, 200, 13, 'toy points, not a prediction', ramp(p, 0.2, 0.4), { anchor: 'start', muted: true });
        c += txt(292, 200, 13.5, sigma > 0.5 ? 'noise' : sigma > 0.03 ? 'less noise' : 'structure', ramp(p, 0.3, 0.45), { anchor: 'end', bold: true, fill: ACC });
        h += card(2, p, dim, c);
      }

      // ---- the arrows between the cards ----
      h += arrow(CX[0] + CARD.w + 4, 144, CX[1] - 4, ramp(K[2], 0, 0.25) * dim) + arrow(CX[1] + CARD.w + 4, 144, CX[2] - 4, ramp(K[3], 0, 0.25) * dim);

      // ---- one model: every kind of molecule in, atom coordinates out ----
      {
        const p = K[4], y = 304, hh = 52, cy = y + hh / 2;
        let x = 8;
        CHIPS.forEach(([lab, w], i) => {
          const o = ramp(p, 0.1 + 0.07 * i, 0.3 + 0.07 * i);
          h += rect(x, y + 8, w, hh - 16, 'var(--bg)', 'var(--muted)', 1.6, o, 18) + `<circle cx="${x + 14}" cy="${cy}" r="4.5" style="fill:${P.rainbow[i]}" opacity="${o.toFixed(2)}"/>` + txt(x + 24 + (w - 24) / 2, cy, 16, lab, o, { bold: true });
          x += w + 10;
        });
        h += arrow(x + 2, cy, x + 40, ramp(p, 0.5, 0.7));
        const bo = ramp(p, 0.55, 0.8);
        h += rect(x + 48, y, 150, hh, 'color-mix(in srgb, var(--accent) 10%, var(--bg))', ACC, 2, bo, 10) + txt(x + 48 + 75, cy - 8, 19, 'AlphaFold 3', bo, { bold: true }) + txt(x + 48 + 75, cy + 14, 12.5, 'one model', bo, { muted: true });
        h += arrow(x + 202, cy, x + 244, ramp(p, 0.72, 0.9));
        const oo = ramp(p, 0.78, 1), ox = x + 252;
        h += rect(ox, y, W - 8 - ox, hh, 'var(--bg)', 'var(--muted)', 1.6, oo, 10) + txt(ox + (W - 8 - ox) / 2, cy - 8, 16.5, 'atom coordinates', oo, { bold: true }) + txt(ox + (W - 8 - ox) / 2, cy + 14, 12.5, 'for the whole complex', oo, { muted: true });
      }
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(head)}</h2>
      <p class="cl-sub">${esc(line)}</p>
      <div class="cl-wrap"><svg viewBox="0 0 ${W} ${CH}" role="img" aria-label="The three main ideas of AlphaFold 3, each against what AlphaFold 2 did: tokenization, the Pairformer and diffusion instead of regression, then every kind of molecule going into one model and atom coordinates coming out"></svg></div>
      <div class="cl-caps">${CAPTIONS.slice(0, swaps ? 4 : 5).map((t, i) => `<p class="cl-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>`;
    const svg = frame.querySelector('svg');

    const SK = ['k1', 'k2', 'k3', 'k4'];
    const stateOf = (step) => Object.fromEntries(SK.map((k, i) => [k, step >= i + 1 ? 1 : 0]));   // step 5 changes nothing in the drawing
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 6500, 6500, 7000, 3800, 600][step], t0 = performance.now();
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
AF3.kinds.conclusion = make(false);
AF3.kinds.swaps = make(true);
}
