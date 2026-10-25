// "Can one model predict any biomolecular complex?" (slide 4): the bullets as on the original slide, and the strip
// "Input: sequences and chemistry -> AF3 -> Output: every atom's 3D position, jointly" (a picture there) as an animation.
//
// The inputs are made-up examples of the kinds of input the paper lists (polymer sequences, residue modifications and ligand
// SMILES; Abramson et al., Results): a protein, a DNA and an RNA sequence, and a ligand as SMILES. The output is a made-up
// 2D point cloud, coloured by input type, that assembles from noise into ONE complex, because that is what "jointly" means: a
// protein chain arching over a DNA double strand (left) and an RNA strand (right), with the ligand ring in a dent on top of the
// arch, every molecule in contact with the chain (dashed lines). It is an illustration, not an AF3 prediction, and the slide says so.
//
// Steps: 1 the bullets and the empty strip (Input, AF3, Output) · 2 the four inputs type in · 3 AF3 lights up and the output
// assembles, every atom at once.
{
const SEED = 11;           // mulberry32 seed for the noise cloud; logged so the picture can be reproduced
const NOISE = 62;          // noise scale at sigma = 1, in map units (the map is 400 x 190)
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const INPUTS = [
  { type: 'protein', label: 'protein', text: 'MKTAYIAKQRQISFVKSHFSRQ', color: '--plot-3' },
  { type: 'dna', label: 'DNA', text: 'ACGTTAGCCGATAGCTAGGCTA', color: '--plot-5' },
  { type: 'rna', label: 'RNA', text: 'GGCUAAGCUUCGGCAUAGCC', color: '--plot-4' },
  { type: 'ligand', label: 'ligand', text: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', color: '--plot-2' },
];

// a smooth curve through waypoints (Catmull-Rom), cut into n points of equal spacing, each moved sideways by a small wave (the
// projection of a helix). Returns [x, y] pairs. (The same helper as in diffusion.js.)
function trace(way, n, amp, period) {
  const dense = [];
  for (let i = 0; i < way.length - 1; i++) {
    const p0 = way[Math.max(0, i - 1)], p1 = way[i], p2 = way[i + 1], p3 = way[Math.min(way.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const u = k / 24, u2 = u * u, u3 = u2 * u;
      dense.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  dense.push(way[way.length - 1]);
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = (len[len.length - 1] * k) / (n - 1);
    let i = 1;
    while (i < len.length - 1 && len[i] < target) i++;
    const f = (target - len[i - 1]) / (len[i] - len[i - 1] || 1);
    const x = dense[i - 1][0] + (dense[i][0] - dense[i - 1][0]) * f, y = dense[i - 1][1] + (dense[i][1] - dense[i - 1][1]) * f;
    const tx = dense[i][0] - dense[i - 1][0], ty = dense[i][1] - dense[i - 1][1], tn = Math.hypot(tx, ty) || 1;
    const off = amp * Math.sin((2 * Math.PI * k) / period);
    out.push([x - (ty / tn) * off, y + (tx / tn) * off]);
  }
  return out;
}

// the made-up complex, in map units (400 x 190): points with a type, the chains that are drawn as lines, the DNA base pairs and the contacts
function complex() {
  const pts = [], rungs = [], contacts = [];
  const P = (type, x, y) => { pts.push({ type, x, y }); return pts.length - 1; };
  const dnaA = [], dnaB = [], rna = [];
  for (let j = 0; j < 22; j++) dnaA.push(P('dna', 12 + j * 9.2, 156 + 11 * Math.sin(j * 0.72)));
  for (let j = 0; j < 22; j++) dnaB.push(P('dna', 12 + j * 9.2, 156 + 11 * Math.sin(j * 0.72 + Math.PI)));
  for (let j = 0; j < 14; j++) rna.push(P('rna', 232 + j * 9.8, 156 + 11 * Math.sin(j * 0.9)));
  // the protein: one chain, lying along the DNA at its left end and along the RNA at its right end, arching over between them,
  // with a dent on top of the arch
  const WAY = [[12, 134], [60, 136], [85, 124], [100, 92], [112, 60], [135, 38], [165, 30], [182, 40], [200, 46], [218, 40], [235, 30], [265, 38], [288, 60], [300, 92], [315, 124],
    [340, 136], [385, 136]];
  const prot = trace(WAY, 72, 3.5, 3.7).map(([x, y]) => P('protein', x, y));
  // the ligand: a six-ring in the dent, two substituents pointing up
  const ring = [];
  for (let k = 0; k < 6; k++) ring.push(P('ligand', 200 + 12 * Math.cos((k * Math.PI) / 3), 30 + 12 * Math.sin((k * Math.PI) / 3)));
  const s1 = P('ligand', 189, 8), s2 = P('ligand', 211, 8);
  const chains = [
    { type: 'dna', idx: dnaA }, { type: 'dna', idx: dnaB }, { type: 'rna', idx: rna }, { type: 'protein', idx: prot },
    { type: 'ligand', idx: [...ring, ring[0]] }, { type: 'ligand', idx: [ring[4], s1] }, { type: 'ligand', idx: [ring[5], s2] },
  ];
  for (let j = 1; j < 22; j += 3) rungs.push([dnaA[j], dnaB[j]]);   // base pairs, every third point (not where the strands cross)
  // contacts, read off the clean complex: protein with DNA and RNA where they lie close (every second such point), ligand with its nearest chain point
  const d = (a, b) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
  const nearest = (i, set) => set.reduce((best, j) => (best < 0 || d(i, j) < d(i, best) ? j : best), -1);
  prot.forEach((i, n) => {
    if (n % 2) return;
    const j = nearest(i, [...dnaA, ...dnaB, ...rna]);
    if (d(i, j) < 20) contacts.push([i, j]);
  });
  ring.forEach((i) => { const j = nearest(i, prot); if (d(i, j) < 17) contacts.push([i, j]); });
  return { pts, chains, rungs, contacts };
}

AF3.kinds.iodiagram = (s) => ({
  steps: 3,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.tagCss + `
      .io-list { position: absolute; left: 5%; top: 16.5%; width: 90%; margin: 0; padding: 0; list-style: none; font-size: var(--t-lead); }
      .io-list li { position: relative; padding-left: 1.1em; margin-bottom: .35em; line-height: 1.28; }
      .io-list li::before { content: '\\2022'; position: absolute; left: .1em; }
      .io-strip { position: absolute; left: 4.2%; right: 4.2%; top: 54%; height: 36%; display: grid;
        grid-template-columns: 36fr 3fr 9fr 3fr 38fr; align-items: stretch; }
      .io-panel { position: relative; box-sizing: border-box; padding: .7em 1.1em; border-radius: 1em;
        border: 1.5px solid color-mix(in srgb, var(--muted) 38%, transparent); background: color-mix(in srgb, var(--fg) 3%, transparent);
        font-size: var(--u); display: flex; flex-direction: column; min-width: 0; }
      .io-head { margin: 0 0 .5em; font-size: var(--t-small); font-weight: 700; color: var(--accent); line-height: 1.2; }
      .io-head span { font-weight: 400; font-size: var(--t-caption); color: var(--muted); margin-left: .5em; }
      .io-in { display: flex; flex-direction: column; justify-content: space-around; flex: 1; }
      .io-row { display: flex; align-items: baseline; gap: .8em; white-space: nowrap; border-left: .3em solid var(--c); padding-left: .6em; }
      .io-row b { flex: none; width: 4.1em; font-size: var(--t-caption); font-weight: 700; color: var(--fg); }
      .io-row code { font: 500 calc(var(--t-caption) * .9)/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--fg); }
      .io-arrow { align-self: center; justify-self: center; font-size: calc(var(--t-lead) * 1.2); color: var(--muted); transition: color .5s; }
      .io-af3 { justify-content: center; align-items: center; text-align: center; transition: border-color .5s, background .5s; }
      .io-af3 .big { font-size: calc(var(--t-heading) * 1.15); font-weight: 700; line-height: 1; transition: color .5s; }
      .io-af3 .sub { margin-top: .35em; font-size: var(--t-caption); color: var(--muted); }
      /* the map fills the space the panel has, rather than setting the panel's height by its own aspect ratio */
      .io-map { position: relative; flex: 1; min-height: 0; }
      .io-map svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      .io-pt { transition: none; }
      .io-line { fill: none; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
      .io-cap { margin: .35em 0 0; font-size: var(--t-caption); color: var(--muted); }
      .lit .io-arrow { color: var(--accent); }
      .lit .io-af3 { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
      .lit .io-af3 .big { color: var(--accent); }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const body = AF3.texts(s).find((t) => t.ph === 'body');
    const { pts, chains, rungs: rungPairs, contacts } = complex();
    const rand = rng(SEED);
    const gauss = () => { const u = Math.max(rand(), 1e-9), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const eps = pts.map(() => [gauss(), gauss()]);   // one fixed noise draw per point
    const col = { protein: '--plot-3', dna: '--plot-5', rna: '--plot-4', ligand: '--plot-2' };

    const circles = pts.map((p, i) => `<circle class="io-pt" data-i="${i}" r="3.4" style="fill:var(${col[p.type]})" opacity="0"/>`).join('');
    const lines = chains.map((c, k) => `<polyline class="io-line" data-chain="${k}" style="stroke:var(${col[c.type]})" opacity="0"/>`).join('')
      + rungPairs.map((_, r) => `<line class="io-line io-rung" data-rung="${r}" style="stroke:var(--plot-5)" opacity="0"/>`).join('')
      + contacts.map((_, c) => `<line class="io-line io-contact" data-contact="${c}" style="stroke:var(--muted);stroke-width:1.1;stroke-dasharray:3 3" opacity="0"/>`).join('');
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <ul class="io-list">${body.paras.map((p) => `<li>${AF3.paraHtml(p, esc, {})}</li>`).join('')}</ul>
      <div class="io-strip">
        <div class="io-panel"><p class="io-head">Input<span>sequences and chemistry</span></p>
          <div class="io-in">${INPUTS.map((r) => `<div class="io-row" style="--c:var(${r.color})"><b>${r.label}</b><code></code></div>`).join('')}</div></div>
        <span class="io-arrow">→</span>
        <div class="io-panel io-af3"><span class="big">AF3</span><span class="sub">one model</span></div>
        <span class="io-arrow">→</span>
        <div class="io-panel io-out"><p class="io-head">Output<span>every atom’s 3D position, jointly</span></p>
          <div class="io-map"><svg viewBox="0 0 400 190" preserveAspectRatio="xMidYMid meet" role="img" aria-label="a point cloud assembling into a complex">${lines}${circles}</svg></div></div>
      </div>
      ${AF3.tagHtml('illustration: made-up inputs and points, not an AF3 prediction', esc)}`;

    const strip = frame.querySelector('.io-strip');
    const codes = [...frame.querySelectorAll('.io-row code')];
    const svg = frame.querySelector('svg');
    const dots = [...svg.querySelectorAll('.io-pt')], polys = [...svg.querySelectorAll('polyline')], rungs = [...svg.querySelectorAll('.io-rung')], contactEls = [...svg.querySelectorAll('.io-contact')];
    const at = (i, sigma) => [pts[i].x + NOISE * sigma * eps[i][0], pts[i].y + NOISE * sigma * eps[i][1]];

    // typed: 0..1 over all four rows (staggered); flow: AF3 and arrows lit; vis: the cloud's opacity; sigma: its noise; bonds: its lines
    const draw = ({ typed, flow, vis, sigma, bonds }) => {
      INPUTS.forEach((r, k) => {
        const u = Math.max(0, Math.min(1, (typed - k * 0.14) / 0.58));
        codes[k].textContent = r.text.slice(0, Math.round(u * r.text.length));
      });
      strip.classList.toggle('lit', flow > 0.5);
      dots.forEach((el, i) => {
        const [x, y] = at(i, sigma);
        el.setAttribute('cx', x.toFixed(1)); el.setAttribute('cy', y.toFixed(1)); el.setAttribute('opacity', vis.toFixed(2));
      });
      polys.forEach((pl, k) => {
        pl.setAttribute('points', chains[k].idx.map((i) => at(i, sigma).map((v) => v.toFixed(1)).join(',')).join(' '));
        pl.setAttribute('opacity', (bonds * 0.85).toFixed(2));
      });
      rungs.forEach((ln, r) => {   // base pairs: strand A point j to strand B point j
        const a = at(rungPairs[r][0], sigma), b = at(rungPairs[r][1], sigma);
        ln.setAttribute('x1', a[0].toFixed(1)); ln.setAttribute('y1', a[1].toFixed(1));
        ln.setAttribute('x2', b[0].toFixed(1)); ln.setAttribute('y2', b[1].toFixed(1));
        ln.setAttribute('opacity', (bonds * 0.7).toFixed(2));
      });
      contactEls.forEach((ln, c) => {   // contacts between the molecules: the joint arrangement, dashed
        const a = at(contacts[c][0], sigma), b = at(contacts[c][1], sigma);
        ln.setAttribute('x1', a[0].toFixed(1)); ln.setAttribute('y1', a[1].toFixed(1));
        ln.setAttribute('x2', b[0].toFixed(1)); ln.setAttribute('y2', b[1].toFixed(1));
        ln.setAttribute('opacity', (bonds * 0.8).toFixed(2));
      });
    };
    const stateOf = (step) => ({ typed: step >= 2 ? 1 : 0, flow: step >= 3 ? 1 : 0, vis: step >= 3 ? 1 : 0, sigma: step >= 3 ? 0 : 1, bonds: step >= 3 ? 1 : 0 });
    let cur = stateOf(1), raf = 0;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const mix = (a, b, e) => a + (b - a) * e;
    draw(cur);

    return {
      enter(step, animate) {
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = step === 2 ? 1600 : step === 3 ? 2000 : 600, t0 = performance.now();
        return new Promise((done) => {
          const tick = (now) => {
            const u = Math.min(1, (now - t0) / ms), e = ease(u);
            cur = {
              typed: mix(from.typed, to.typed, u),                                   // typing runs at constant speed
              flow: u > 0.12 ? to.flow : from.flow,                                  // AF3 lights as the cloud starts to form
              vis: mix(from.vis, to.vis, Math.min(1, e * 5)),                        // the cloud appears quickly, then settles
              sigma: mix(from.sigma, to.sigma, e),
              bonds: mix(from.bonds, to.bonds, Math.max(0, (e - 0.55) / 0.45)),     // bonds join once the atoms are close
            };
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
