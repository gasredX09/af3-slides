// "How was AF3 evaluated?" (slide 51): the table (task, dataset, baselines, success metric) rebuilt as a rig that is the same for every task and
// played a click at a time: a test set (a field with one dot for each test case), an opponent (badges), and a ruler (a small animated drawing of the metric).
// The six tasks are the table's rows; the row of tiles at the top is the map.
//
//   1  six tasks; for each, a test set, an opponent and a ruler; the scores are from the top-ranked of 25 samples (5 seeds x 5 samples)
//   2  protein-ligand: PoseBusters V1, 428; AutoDock Vina (told the pocket) and RoseTTAFold All-Atom (published score); pocket-aligned ligand RMSD < 2 A
//   3  protein-nucleic acid: recent PDB, 25 protein-RNA and 38 protein-dsDNA; RF2NA on the same MSAs; interface LDDT
//   4  RNA tertiary structure: CASP15, 8 targets; RF2NA, AIchemy_RNA, AIchemy_RNA2 (the top entrant, with human help); LDDT
//   5  protein-protein and antibody-antigen: recent PDB, 1,064 and 65 (antibody interface clusters); AlphaFold-Multimer v2.3; DockQ > 0.23
//   6  protein monomers: recent PDB, 338; AlphaFold-Multimer v2.3; LDDT
//   7  covalent modifications: bonded ligands 66, glycosylation 28, modified residues (40 protein, 91 DNA, 23 RNA); no baseline; pocket-aligned RMSD < 2 A
//   8  three rulers: pose error, the LDDT family, DockQ
//
// Checked against the main text (Fig. 1c, its caption and the n under each bar; Results, the PoseBusters passage, "docking is often performed with knowledge
// of the protein pocket residues"; Methods, Inference regime, Metrics, Nucleic acid prediction baseline, PoseBusters; the antibody filtering, 71 complexes, 166
// interfaces, 65 interface clusters, and "ranked across 1,000 model seeds for both models") and the supplement (6.1: the recent PDB set, entries released 2022-05-01 to
// 2023-01-12, after the training data; the RF2NA subset, under 1,000 residues and nucleotides, one nucleic-acid type; the baseline numbers for ligands are published
// ones; Alg. 27: LDDT with the tolerances 0.5, 1, 2 and 4 A, and the inclusion radius, 15 A for proteins and 30 A for nucleotides). The pocket-aligned RMSD is as in
// Methods: align on the backbone atoms of the pocket (within 10 A of the ligand), then measure the ligand atoms. What DockQ is made of is not in the paper, so it is not drawn.
// All the toy drawings (poses, neighbours, docking) and the "share that pass" dots are made up and say so; no score here is an AF3 result (those are on the next slide).
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const BL = '#4f86c6', OR = '#f08c00', GR = '#2f9e44', MG = '#c2255c', PU = '#7048e8', GREY = '#8d96a0';
const FAM = { pose: '#e8590c', lddt: '#3b5bdb', dockq: '#7048e8' };
const hexPts = (cx, cy, r, rot = 0) => Array.from({ length: 6 }, (_, i) => [cx + r * Math.cos(rot + (i * Math.PI) / 3), cy + r * Math.sin(rot + (i * Math.PI) / 3)]);
const pts = (a) => a.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');

const TASKS = [
  { tile: ['Protein–', 'ligand'], icon: 'lig', fam: 'pose', ruler: 'rmsd', metric: 'pocket-aligned RMSD $< 2$ Å', msub: 'line up the pocket, then measure the ligand', pass: 7,
    groups: [{ n: 428, label: 'protein–ligand structures', color: OR }], data: ['PoseBusters V1, released in 2021 or later.', 'AF3 retrained with a 30 Sep 2019 cutoff,', 'so it had seen none of them.'],
    foes: [{ name: 'AutoDock Vina', sub: 'is told where the pocket is' }, { name: 'RoseTTAFold All-Atom', sub: 'blind like AF3, published score' }] },
  { tile: ['Protein–', 'nucleic acid'], icon: 'nuc', fam: 'lddt', ruler: 'lddt', iface: true, rad: '15 Å', metric: 'interface LDDT', msub: 'distances between atoms of the two chains', pass: 8,
    groups: [{ n: 25, label: 'protein–RNA', color: MG }, { n: 38, label: 'protein–dsDNA', color: GR }], data: ['Recent PDB entries, released after', 'the training data. One nucleic-acid type,', 'under 1,000 residues and nucleotides.'],
    foes: [{ name: 'RF2NA', sub: 'run with the same MSAs as AF3' }] },
  { tile: ['RNA', 'tertiary'], icon: 'rna', fam: 'lddt', ruler: 'lddt', iface: false, rad: '30 Å', col: MG, metric: 'LDDT', msub: 'neighbours within 30 Å for nucleic acids', pass: 6,
    groups: [{ n: 8, label: 'CASP15 RNA targets', color: MG }], data: ['The CASP15 RNA targets that were', 'public by 1 December 2023.'],
    foes: [{ name: 'RF2NA', sub: 'a representative ML system' }, { name: 'AIchemy_RNA', sub: 'top machine-learning entrant' }, { name: 'AIchemy_RNA2', sub: 'top entrant, with human help' }] },
  { tile: ['Protein–protein', '& antibody'], icon: 'ppi', fam: 'dockq', ruler: 'dockq', metric: 'DockQ $> 0.23$', msub: 'a docking counts as a success above 0.23', pass: 7,
    groups: [{ n: 1064, label: 'protein–protein', color: BL, w: 1.5 }, { n: 65, label: 'antibody–antigen', color: PU, w: 0.75 }], data: ['Recent PDB entries, low homology to', 'the training set. Antibody: 65 interface', 'clusters, best of 1,000 seeds.'],
    foes: [{ name: 'AlphaFold-Multimer v2.3', sub: 'unrelaxed predictions' }] },
  { tile: ['Protein', 'monomers'], icon: 'mono', fam: 'lddt', ruler: 'lddt', iface: false, rad: '15 Å', col: BL, metric: 'LDDT', msub: 'neighbours within 15 Å for proteins', pass: 8,
    groups: [{ n: 338, label: 'protein chains', color: BL }], data: ['Recent PDB entries, low homology to', 'the training set.'],
    foes: [{ name: 'AlphaFold-Multimer v2.3', sub: 'unrelaxed predictions' }] },
  { tile: ['Covalent', 'modifications'], icon: 'cov', fam: 'pose', ruler: 'rmsd', bond: true, metric: 'pocket-aligned RMSD $< 2$ Å', msub: 'the same ruler as for ligands', pass: 6,
    groups: [{ n: 66, label: ['bonded', 'ligands'], color: OR }, { n: 28, label: ['glyco-', 'sylation'], color: MG }, { n: 154, label: ['modified', 'residues'], parts: [[40, BL], [91, GR], [23, MG]], w: 1.5 }], data: ['Sets from the PDB. Modified residues:', '40 protein, 91 DNA and 23 RNA.'],
    foes: [] },
];
const CAPTIONS = [
  'AF3 was tested on six kinds of task. Each has a test set, an opponent and a ruler. Scores come from the top-ranked of 25 samples: 5 seeds with 5 samples each.',
  'Protein–ligand: 428 PoseBusters structures from 2021 or later. AF3 was retrained with a 30 Sep 2019 cutoff, so it had seen none. A ligand counts as right if its pose is within 2 Å once the pocket is lined up.',
  'Protein–nucleic acid, against RF2NA on the same MSAs. The score is interface LDDT: for atom pairs across the two chains, how many of the tolerances 0.5, 1, 2 and 4 Å does the predicted distance meet?',
  'RNA tertiary structure: eight CASP15 targets, against RF2NA and two CASP entrants, one of them with human help. The score is LDDT, with neighbours counted within 30 Å for nucleic acids.',
  'Protein–protein and antibody–antigen: recent PDB complexes against AlphaFold-Multimer v2.3. The score is the share of docking with a DockQ above 0.23. For antibodies, both models take the best of 1,000 seeds.',
  'Protein monomers: recent PDB chains against AlphaFold-Multimer v2.3. The score is plain LDDT, with neighbours counted within 15 Å.',
  'Covalent modifications: bonded ligands, glycosylation and modified residues from the PDB. No baseline is shown, and the ruler is the same 2 Å pocket-aligned pose error.',
  'Three rulers: a pose error for ligands and modifications, the LDDT family for how well distances are kept, and DockQ for how well protein chains dock.',
];

AF3.kinds.evalrig = (s) => ({
  steps: 8,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + `
      .ev-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 15%; }
      .ev-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ev-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .ev-t.muted { fill: var(--muted); }
      .ev-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .ev-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).slice().sort((a, b) => a.g.y - b.g.y)[0];   // the heading is the topmost text (this slide's title is not a placeholder)

    // ---- helpers ----
    // a label with math: the whole string in one <span>, so the spaces next to a formula survive (AF3.svgRich's flex box drops them)
    const mathTxt = (x, y, size, str, o) => `<foreignObject ${AF3.foAttrs(x, y, size, o)} opacity="${o.op.toFixed(2)}">${AF3.foInner(`<span>${AF3.rich(str, esc)}</span>`, size, o)}</foreignObject>`;
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : str.includes('$') ? mathTxt(x, y, size, o.bold ? str.replace(/\$([^$]+)\$/g, '$\\boldsymbol{$1}$') : str, { anchor: o.anchor, op, muted: o.muted, bold: o.bold, color: o.fill }) : `<text x="${x}" y="${y}" font-size="${size}" class="ev-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0, dash = '') => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${op.toFixed(2)}"/>`;
    const circ = (x, y, r, fill, stroke, sw, op = 1) => op < 0.01 ? '' : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const line = (x1, y1, x2, y2, col, w, op, dash = '') => op < 0.01 ? '' : `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" opacity="${op.toFixed(2)}"/>`;
    const arrow = (x1, y, x2, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" stroke="var(--muted)" stroke-width="2"/><polygon points="${x2},${y} ${x2 - 8},${y - 5} ${x2 - 8},${y + 5}" fill="var(--muted)"/></g>`;
    const check = (x, y, ok, op) => op < 0.01 ? '' : (ok
      ? `<g opacity="${op.toFixed(2)}"><circle cx="${x}" cy="${y}" r="10" fill="${GR}"/><path d="M${x - 5} ${y} l3.5 4 l6.5 -8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`
      : `<g opacity="${op.toFixed(2)}"><circle cx="${x}" cy="${y}" r="10" fill="${MG}"/><path d="M${x - 4.5} ${y - 4.5} l9 9 M${x + 4.5} ${y - 4.5} l-9 9" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`);

    // the little pictures of the six tasks
    const icon = (kind, x, y, op) => {
      let g = '';
      if (kind === 'lig') g = `<path d="M9 8 C-2 22 6 40 24 40" stroke="${BL}" stroke-width="7" fill="none" stroke-linecap="round"/><polygon points="${pts(hexPts(31, 22, 9))}" fill="${OR}"/>`;
      if (kind === 'nuc') g = `<circle cx="13" cy="25" r="10" fill="${BL}"/><circle cx="21" cy="14" r="7" fill="${BL}"/><path d="M30 6 C42 12 30 18 42 24 C30 30 42 36 30 42 M42 6 C30 12 42 18 30 24 C42 30 30 36 42 42" stroke="${GR}" stroke-width="2.6" fill="none"/>`;
      if (kind === 'rna') g = `<path d="M14 42 V17 Q14 5 24 5 Q34 5 34 17 V42" stroke="${MG}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M14 20 H34 M14 27 H34 M14 34 H34" stroke="${MG}" stroke-width="2" opacity=".6"/>`;
      if (kind === 'ppi') g = `<circle cx="14" cy="28" r="12" fill="${BL}"/><path d="M30 8 L37 24 M44 8 L37 24 M37 24 V42" stroke="${PU}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (kind === 'mono') g = `<path d="M5 32 C12 6 20 44 27 20 S40 30 42 10" stroke="${BL}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      if (kind === 'cov') g = `<path d="M5 34 C10 18 16 40 22 26" stroke="${BL}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M22 26 L32 16" stroke="${GREY}" stroke-width="2.4"/><polygon points="${pts(hexPts(36, 12, 7))}" fill="${OR}"/><polygon points="${pts(hexPts(40, 30, 6))}" fill="${MG}"/><path d="M33 17 L38 25" stroke="${GREY}" stroke-width="2"/>`;
      return `<g transform="translate(${x} ${y})" opacity="${op.toFixed(2)}">${g}</g>`;
    };

    // ---- the fields of dots (one dot for each test case), drawn once and revealed by a sweeping clip ----
    const FX = 14, FY = 120, FW = 222, FH = 124;
    const fieldOf = (groups) => {
      const gap = 14, tw = groups.reduce((t, g) => t + (g.w || 1), 0), avail = FW - gap * (groups.length - 1);
      let x = FX, dots = '';
      const labels = [];
      groups.forEach((g) => {
        const w = (avail * (g.w || 1)) / tw;
        let pitch = 22, cols = 1;
        for (; pitch > 2; pitch -= 0.25) { cols = Math.max(1, Math.floor(w / pitch)); if (Math.ceil(g.n / cols) * pitch <= FH) break; }
        const r = pitch * 0.33;
        const colours = g.parts ? g.parts.flatMap(([n, c]) => Array(n).fill(c)) : null;
        for (let i = 0; i < g.n; i++) dots += `<circle cx="${(x + (i % cols) * pitch + pitch / 2).toFixed(1)}" cy="${(FY + Math.floor(i / cols) * pitch + pitch / 2).toFixed(1)}" r="${r.toFixed(2)}" fill="${colours ? colours[i] : g.color}"/>`;
        labels.push({ x: x + w / 2, w, n: g.parts ? g.parts.map((p) => p[0]).join(' · ') : g.n.toLocaleString('en-US'), label: g.label });
        x += w + gap;
      });
      return { dots, labels };
    };
    const FIELDS = TASKS.map((t) => fieldOf(t.groups));

    // ---- the rulers: small drawings, each a made-up example ----
    const SC = 20;                                                                                            // pixels for 1 angstrom in the pose drawing
    const PC = [750, 212], LC = [750, 204];
    const POCKET = Array.from({ length: 9 }, (_, k) => { const th = ((12 + k * 19.5) * Math.PI) / 180; return [PC[0] + 116 * Math.cos(th), PC[1] + 12 + 68 * Math.sin(th)]; });
    const LIG = hexPts(LC[0], LC[1], 30, 0.26);
    const rotAbout = (p, c, a) => [c[0] + (p[0] - c[0]) * Math.cos(a) - (p[1] - c[1]) * Math.sin(a), c[1] + (p[0] - c[0]) * Math.sin(a) + (p[1] - c[1]) * Math.cos(a)];
    const GOOD = LIG.map((p) => { const q = rotAbout(p, LC, 0.16); return [q[0] + 13, q[1] - 11]; }), BAD = LIG.map((p) => [p[0] + 76, p[1] + 20]);
    const rmsd = (a, b) => Math.sqrt(a.reduce((t, p, i) => t + (p[0] - b[i][0]) ** 2 + (p[1] - b[i][1]) ** 2, 0) / a.length) / SC;
    const R_GOOD = rmsd(GOOD, LIG), R_BAD = rmsd(BAD, LIG);

    const rmsdScene = (p, o, bond) => {
      let h = '';
      const t = ramp(p, 0.05, 0.35), err = ramp(p, 0.4, 0.55), miss = ramp(p, 0.68, 0.82), pre = (q) => { const r = rotAbout(q, [750, 232], 0.42 * (1 - t)); return [r[0] + 56 * (1 - t), r[1] - 34 * (1 - t)]; };
      const lig = GOOD.map((q, i) => [lerp(q[0], BAD[i][0], miss), lerp(q[1], BAD[i][1], miss)]);
      const now = rmsd(lig, LIG), ok = now < 2;
      POCKET.forEach((q) => { h += circ(q[0], q[1], 6, 'none', GREY, 2.2, o); });                                  // the true pocket and ligand
      h += `<polygon points="${pts(LIG)}" fill="none" stroke="${GREY}" stroke-width="2" opacity="${o.toFixed(2)}"/>`;
      if (bond) h += line(LIG[3][0], LIG[3][1], POCKET[5][0], POCKET[5][1] - 5, GREY, 2, o);
      h += POCKET.map((q) => { const r = pre(q); return circ(r[0], r[1], 6, BL, 'none', 0, o); }).join('');       // AF3's pocket, which slides onto the true one
      const pl = lig.map(pre);
      h += `<polygon points="${pts(pl)}" fill="${OR}" fill-opacity=".25" stroke="${OR}" stroke-width="2.4" opacity="${o.toFixed(2)}"/>` + pl.map((q) => circ(q[0], q[1], 5, OR, 'none', 0, o)).join('');
      if (bond) h += line(pl[3][0], pl[3][1], pre(POCKET[5])[0], pre(POCKET[5])[1] - 5, OR, 2, o);
      LIG.forEach((q, i) => { h += line(q[0], q[1], lig[i][0], lig[i][1], MG, 2.2, o * err); });                 // the error of each ligand atom
      h += txt(748, 150, 13.5, '1  line up the pocket', o * ramp(p, 0.02, 0.1) * (1 - ramp(p, 0.4, 0.48)), { bold: true });
      h += txt(748, 150, 13.5, '2  then measure each ligand atom', o * ramp(p, 0.42, 0.5) * (1 - ramp(p, 0.62, 0.7)), { bold: true });
      h += txt(748, 150, 13.5, 'a pose that misses', o * ramp(p, 0.7, 0.8), { bold: true });
      const bx = 560, by = 318, bo = o * ramp(p, 0.45, 0.58);                                                     // the ruler: the error against the 2 A limit
      h += rect(bx, by, 4.5 * 45, 12, 'none', GREY, 1.2, bo, 3) + rect(bx, by, Math.min(now, 4.5) * 45 * ramp(p, 0.45, 0.6), 12, ok ? GR : MG, 'none', 0, bo, 3);
      h += line(bx + 90, by - 6, bx + 90, by + 18, 'var(--fg)', 2, bo) + txt(bx + 90, by + 28, 12, 'limit: 2 Å', bo, { muted: true });
      h += txt(bx - 8, by + 6, 13, 'error', bo, { anchor: 'end', muted: true }) + txt(bx + 4.5 * 45 + 14, by + 6, 14, `${now.toFixed(1)} Å`, bo, { anchor: 'start', bold: true });
      h += check(bx + 4.5 * 45 + 66, by + 6, ok, bo * ramp(p, 0.55, 0.62));
      return h;
    };

    const NB = [[-155, 1, 0.3, 0], [-100, 1, 3.0, 1], [-35, 1, 0.8, 0], [15, 1, 5.5, 1], [65, 1, 1.5, 1], [135, 1, 0.6, 0]];                                              // angle, (unused), error in angstrom, other chain
    const lddtScene = (p, o, task) => {
      let h = '';
      const F = [750, 238], iface = !!task.iface, col = task.col || BL, other = task.iface ? GR : col;
      const place = (k, extra) => { const a = (NB[k][0] * Math.PI) / 180; return [F[0] + Math.cos(a) * (128 + extra * 1.4), F[1] + Math.sin(a) * (50 + extra * 0.55)]; };
      const grow = ramp(p, 0.08, 0.3), shift = ramp(p, 0.4, 0.6), pip = ramp(p, 0.6, 0.78), fade = iface ? ramp(p, 0.3, 0.42) : 0;
      NB.forEach(([, , d, oc], k) => {
        const cross = iface ? (k === 0 || k === 2 || k === 5) : true, dim = iface && !cross ? 1 - 0.75 * fade : 1, tp = place(k, 0), pp = place(k, d * 6 * shift), c = iface && cross ? other : col;
        h += line(F[0], F[1], tp[0], tp[1], GREY, 1.6, o * grow * dim, '4 3') + circ(tp[0], tp[1], 7, 'none', GREY, 2.2, o * grow * dim);
        h += line(F[0], F[1], pp[0], pp[1], c, 2, o * shift * dim) + circ(pp[0], pp[1], 5.4, c, 'none', 0, o * shift * dim);
        const px = place(k, d * 6 + 20);
        [0.5, 1, 2, 4].forEach((th, i) => { h += rect(px[0] - 20 + i * 10, px[1] - 4, 8, 8, d < th ? GR : 'none', d < th ? GR : GREY, 1.4, o * pip * dim, 1.5); });
      });
      h += circ(F[0], F[1], 8, col, 'var(--bg)', 2, o * grow);
      h += txt(750, 156, 13.5, iface ? 'only pairs across the two chains count' : `each neighbour within ${task.rad}: is its distance kept?`, o * ramp(p, 0.02, 0.1), { bold: true });
      const lit = NB.reduce((t, [, , d, oc], k) => t + (!iface || k === 0 || k === 2 || k === 5 ? [0.5, 1, 2, 4].filter((th) => d < th).length : 0), 0), tot = NB.reduce((t, _, k) => t + (!iface || k === 0 || k === 2 || k === 5 ? 4 : 0), 0);
      h += txt(750, 330, 14, `tolerances 0.5 · 1 · 2 · 4 Å: ${lit} of ${tot} met (toy)`, o * ramp(p, 0.8, 0.92), { bold: true });
      return h;
    };

    const dockScene = (p, o) => {
      let h = '';
      const A = [610, 244], Y = (x, y, a, col, w, op) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)})" opacity="${op.toFixed(2)}"><path d="M-14 -26 L0 -2 M14 -26 L0 -2 M0 -2 V28" stroke="${col}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
      h += circ(A[0], A[1], 58, BL, 'none', 0, o * 0.9) + circ(A[0] - 24, A[1] + 22, 30, BL, 'none', 0, o * 0.9) + circ(A[0] + 10, A[1] - 34, 28, BL, 'none', 0, o * 0.9);
      const T = [676, 206, 28], g1 = ramp(p, 0.12, 0.3), g2 = ramp(p, 0.4, 0.55), bad = ramp(p, 0.55, 0.75);
      h += Y(T[0], T[1], T[2], GREY, 1, o).replace('stroke-width="7"', 'stroke-width="3" stroke-dasharray="4 3"');
      const gx = lerp(T[0] + 5, 650, bad), gy = lerp(T[1] - 3, 318, bad), ga = lerp(T[2] + 4, 118, bad);
      h += Y(gx, gy, ga, PU, 1, o * g1);
      h += txt(700, 150, 13.5, bad < 0.5 ? 'AF3 puts the second chain here' : 'and here, far from the truth', o * ramp(p, 0.02, 0.1), { bold: true });
      // the ladder: a score for each prediction, and the line at 0.23
      const lx = 880, top = 156, bot = 322, thr = 292;
      h += line(lx, top, lx, bot, 'var(--muted)', 3, o) + txt(lx, top - 12, 13, 'DockQ', o, { bold: true }) + txt(lx + 8, top + 14, 11.5, 'better', o, { anchor: 'start', muted: true });
      h += line(lx - 30, thr, lx + 60, thr, 'var(--fg)', 2.4, o) + txt(lx + 66, thr, 13.5, '0.23', o, { anchor: 'start', bold: true });
      const my = lerp(thr - 96, thr + 18, bad);
      h += circ(lx, my, 9, PU, 'var(--bg)', 2.5, o * g1) + check(lx + 30, my, bad < 0.5, o * ramp(p, 0.3, 0.45) * (1 - bad * 0) );
      h += txt(lx - 16, thr + 40, 11.5, 'success only above the line', o * ramp(p, 0.78, 0.9), { anchor: 'middle', muted: true });
      return h;
    };

    // ---- the whole drawing ----
    const draw = (st) => {
      let h = '';
      const K = (i) => st[`k${i}`], visible = (i) => ramp(K(i), 0, 0.12) * (i < 8 ? 1 - ramp(K(i + 1), 0, 0.12) : 1);
      const a = ramp(K(1), 0, 0.3), sum = ramp(K(8), 0, 0.3);
      // the tiles, along the top: the task in play is outlined; at the end they take the colour of their ruler
      TASKS.forEach((t, j) => {
        const i = j + 2, x = 10 + j * 165, cur = visible(i), reached = ramp(K(i), 0, 0.1), op = a * (0.5 + 0.5 * reached);
        h += rect(x, 6, 160, 64, 'var(--bg)', 'var(--muted)', 1.4, op, 9) + rect(x, 6, 160, 64, 'none', 'var(--accent)', 3.5, cur * a, 9);
        h += rect(x, 6, 160, 5, FAM[t.fam], 'none', 0, sum * a, 3);
        h += icon(t.icon, x + 6, 16, op) + txt(x + 58, 28, 12.5, t.tile[0], op, { anchor: 'start', bold: cur > 0.5 }) + txt(x + 58, 46, 12.5, t.tile[1], op, { anchor: 'start', bold: cur > 0.5 });
      });

      // ---- step 1: the rig, as three empty stations ----
      const intro = a * (1 - ramp(K(2), 0, 0.15));
      const stations = [['tested on', 'a test set', 'one dot for each test case'], ['against', 'an opponent', 'what AF3 has to beat'], ['judged by', 'a ruler', 'how a prediction is scored']];
      stations.forEach(([head, big, sub], i) => {
        const x = 40 + i * 320;
        h += rect(x, 120, 270, 170, 'var(--bg)', 'var(--muted)', 1.6, intro * ramp(K(1), 0.1 + 0.15 * i, 0.4 + 0.15 * i), 14, '6 4');
        h += txt(x + 135, 160, 14, head, intro * ramp(K(1), 0.15 + 0.15 * i, 0.4 + 0.15 * i), { muted: true }) + txt(x + 135, 205, 24, big, intro * ramp(K(1), 0.2 + 0.15 * i, 0.45 + 0.15 * i), { bold: true }) + txt(x + 135, 240, 13, sub, intro * ramp(K(1), 0.25 + 0.15 * i, 0.5 + 0.15 * i), { muted: true });
        if (i < 2) h += arrow(x + 276, 205, x + 314, intro * ramp(K(1), 0.3 + 0.15 * i, 0.55 + 0.15 * i));
      });
      h += txt(500, 322, 14, 'Scores: the top-ranked of 25 samples (5 seeds × 5 samples), by the model’s own confidence.', intro * ramp(K(1), 0.6, 0.85), { muted: true });

      // ---- steps 2 to 7: one task each ----
      TASKS.forEach((t, j) => {
        const i = j + 2, o = visible(i), p = K(i);
        if (o < 0.01) return;
        // the three headers and the arrows between the stations
        h += txt(14, 86, 13, 'tested on', o, { anchor: 'start', muted: true }) + txt(268, 86, 13, 'against', o, { anchor: 'start', muted: true }) + txt(510, 86, 13, 'judged by', o, { anchor: 'start', muted: true });
        h += arrow(240, 176, 262, o * ramp(p, 0.1, 0.3)) + arrow(488, 176, 506, o * ramp(p, 0.3, 0.5));
        // a test set: its field of dots, with the numbers
        const F = FIELDS[j];
        F.labels.forEach((l) => {
          const big = l.w > 150;
          h += txt(l.x, 262, big ? 28 : 15, l.n, o * ramp(p, 0.15, 0.3), { bold: true });
          (Array.isArray(l.label) ? l.label : [l.label]).forEach((ln, k) => { h += txt(l.x, (big ? 288 : 280) + k * 13, 12, ln, o * ramp(p, 0.15, 0.3), { muted: true }); });
        });
        t.data.forEach((ln, k) => { h += txt(14, 316 + k * 17, 12, ln, o * ramp(p, 0.2 + 0.05 * k, 0.4 + 0.05 * k), { anchor: 'start', muted: true }); });
        // the opponents
        if (t.foes.length) t.foes.forEach((f, k) => {
          const op = o * ramp(p, 0.3 + 0.1 * k, 0.5 + 0.1 * k), y = 112 + k * 62;
          h += rect(268, y, 214, 54, 'var(--bg)', 'var(--muted)', 1.6, op, 9) + txt(280, y + 18, 14.5, f.name, op, { anchor: 'start', bold: true }) + txt(280, y + 38, 11.5, f.sub, op, { anchor: 'start', muted: true });
        });
        else h += rect(268, 112, 214, 54, 'none', 'var(--muted)', 1.6, o * ramp(p, 0.3, 0.5), 9, '5 4') + txt(375, 139, 14, 'no baseline shown', o * ramp(p, 0.3, 0.5), { muted: true });
        // the ruler: its name, then the drawing
        const mo = o * ramp(p, 0.4, 0.55);
        h += rect(510, 98, 470, 34, 'none', FAM[t.fam], 2.4, mo, 8) + txt(526, 115, 15, t.metric, mo, { anchor: 'start', bold: true }) + txt(970, 115, 11.5, t.msub, mo, { anchor: 'end', muted: true });
        const pr = ramp(p, 0.45, 1);
        h += t.ruler === 'rmsd' ? rmsdScene(pr, o * ramp(p, 0.45, 0.55), t.bond) : t.ruler === 'lddt' ? lddtScene(pr, o * ramp(p, 0.45, 0.55), t) : dockScene(pr, o * ramp(p, 0.45, 0.55));
        // the share that pass: ten dots, toy
        const sh = o * ramp(p, 0.9, 1);
        for (let d = 0; d < 10; d++) h += circ(580 + d * 20, 366, 6.5, d < t.pass ? FAM[t.fam] : 'none', d < t.pass ? 'none' : GREY, 1.8, sh);
        h += txt(560, 366, 12, 'toy: how many pass', sh, { anchor: 'end', muted: true }) + txt(796, 366, 12, 'the score is the share that pass', sh, { anchor: 'start', muted: true });
      });

      // ---- step 8: three rulers ----
      const groups = [['pose', 'pose error', 'ligands and modifications', [0, 5]], ['lddt', 'LDDT family', 'nucleic acids, RNA and monomers', [1, 2, 4]], ['dockq', 'DockQ', 'protein–protein and antibody', [3]]];
      groups.forEach(([fam, name, sub, members], g) => {
        const x = 20 + g * 328, op = sum * ramp(K(8), 0.1 + 0.2 * g, 0.4 + 0.2 * g);
        h += rect(x, 100, 310, 250, 'var(--bg)', FAM[fam], 2.4, op, 14);
        h += txt(x + 155, 128, 18, name, op, { bold: true, fill: FAM[fam] }) + txt(x + 155, 150, 12.5, sub, op, { muted: true });
        const by = 322;
        if (fam === 'pose') h += `<polygon points="${pts(hexPts(x + 110, by, 16, 0.26))}" fill="none" stroke="${GREY}" stroke-width="2" opacity="${op.toFixed(2)}"/><polygon points="${pts(hexPts(x + 118, by - 5, 16, 0.4))}" fill="${OR}" fill-opacity=".3" stroke="${OR}" stroke-width="2.4" opacity="${op.toFixed(2)}"/>` + txt(x + 190, by, 14, '$< 2$ \u00c5', op, { bold: true });
        if (fam === 'lddt') h += [0, 1, 2, 3].map((i) => rect(x + 88 + i * 22, by - 9, 18, 18, i < 3 ? GR : 'none', i < 3 ? GR : GREY, 1.6, op, 3)).join('') + txt(x + 220, by, 13, 'tolerances', op, { anchor: 'start', muted: true });
        if (fam === 'dockq') h += line(x + 110, by - 22, x + 110, by + 22, 'var(--muted)', 3, op) + line(x + 92, by + 8, x + 150, by + 8, 'var(--fg)', 2.4, op) + circ(x + 110, by - 12, 6.5, PU, 'var(--bg)', 2, op) + txt(x + 160, by + 8, 14, '0.23', op, { anchor: 'start', bold: true });
        members.forEach((m, k) => {
          const y = 176 + k * 38;
          h += icon(TASKS[m].icon, x + 20, y - 4, op * 0.8) + txt(x + 76, y + 8, 13.5, TASKS[m].tile[0].endsWith('–') ? TASKS[m].tile.join('') : TASKS[m].tile.join(' '), op, { anchor: 'start', bold: true }) + txt(x + 76, y + 25, 11.5, TASKS[m].metric, op, { anchor: 'start', muted: true });
        });
      });
      svg.innerHTML = h;
      const fo = (j) => { const i = j + 2, o = visible(i), sweep = ramp(K(i), 0.08, 0.4); return [o, sweep]; };
      TASKS.forEach((_, j) => { const [o, sweep] = fo(j), g = fields.querySelector(`#ev-f${j}`), c = fields.querySelector(`#ev-c${j} rect`); g.setAttribute('opacity', o.toFixed(2)); c.setAttribute('width', (FW + 20) * sweep); });
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="ev-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="How AF3 was evaluated: six tasks, each with a test set (one dot for each test case), an opponent and a ruler: pocket-aligned RMSD for protein-ligand and covalent modifications, interface LDDT for protein-nucleic acid, LDDT for RNA and protein monomers, and DockQ for protein-protein and antibody-antigen"><g id="ev-fields"></g><g id="ev-dyn"></g></svg></div>
      <div class="ev-caps">${CAPTIONS.map((t, i) => `<p class="ev-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>`;
    const svgRoot = frame.querySelector('svg'), fields = frame.querySelector('#ev-fields'), dyn = frame.querySelector('#ev-dyn');
    fields.innerHTML = FIELDS.map((f, j) => `<clipPath id="ev-c${j}"><rect x="${FX - 4}" y="${FY - 6}" width="0" height="${FH + 12}"/></clipPath><g id="ev-f${j}" clip-path="url(#ev-c${j})" opacity="0">${f.dots}</g>`).join('');
    const svg = { set innerHTML(v) { dyn.innerHTML = v; } };

    const KEYS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `k${i}`);
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 3500, 9000, 8500, 8500, 9000, 8000, 8000, 3500][step], t0 = performance.now();
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
