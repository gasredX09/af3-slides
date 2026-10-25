// "Confidence Metrics" (slide 48): the generated picture (seeds, 25 candidates, the confidence module, pLDDT / PAE / PDE / pTM / ipTM, rank)
// redrawn as vector drawings, and played a click at a time. One toy complex (a chain A of 14 beads and a chain B of 10) is the example
// throughout; every number is made up, so no structure or score on the slide is an AF3 prediction.
//
//   1  sampling: 5 seeds, 5 diffusion samples each, 25 candidates (they differ mostly in where chain B sits against chain A)
//   2  one candidate goes through the confidence module (4 Pairformer blocks; reads the trunk's s and z and the candidate's structure)
//   3  pLDDT: one number per atom, local; coloured as in the AlphaFold database
//   4  PAE and PDE: one number per pair of tokens, pairwise; confident inside each chain, unsure how the chains sit against each other
//   5  pTM and ipTM: single numbers computed from the PAE; pTM from all pairs (whole structure), ipTM only from pairs in different chains
//   6  ranking: 0.8 ipTM + 0.2 pTM + 0.5 disorder - 100 clash for each of the 25; a clashing candidate drops to the bottom; the best is the output
//   7  training: diffusion training only practises single steps, so a short rollout (20 steps, larger than at inference, no gradients) makes a structure
//   8  the rollout structure is compared with the ground truth; the real errors (lDDT per atom, alignment error, distance error) are the targets
//
// Checked against the main text (Methods, Inference regime: 5 seeds of the same model with 5 diffusion samples per seed, 25 samples, the top
// confidence sample; "a larger step size than normal", Fig. 2c) and the supplement: Alg. 31 (ConfidenceHead, N_block = 4: the single and
// pair embeddings plus the binned distances of the representative atoms of the predicted structure go through a Pairformer stack; PAE and PDE
// from the pair embedding in 64 bins of 0.5 A, pLDDT per atom in 50 bins, and an "experimentally resolved" output that is not drawn);
// 4.3.2 (PAE, and pTM and ipTM from the PAE probabilities, Eq. 17; ipTM only over pairs from different chains), 4.3.3 (PDE = the error of
// the distance between representative atoms), 4.1 (the 20-step rollout from pure noise, no gradients), 4.2 (the rollout structure is used to
// permute the symmetric ground-truth chains), 5.9.3 Eq. 19 (the ranking score for the full complex; for a single chain, an interface or a
// modified residue another score is used) and the reference code (model/confidences.py, get_ranking_score: pTM alone when ipTM is undefined).
// "Disorder" in the ranking is the fraction of protein atoms with a relative solvent accessible area above 0.581 (a proxy for disorder).
// Left out: the experimentally-resolved output, the stop-gradient on the trunk embeddings, the per-chain ranking scores.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const SEED = 7;
const LINE = 'rgba(0,0,0,.3)', CI = '#e8590c', PINK = '#c2255c', GREY = '#8d96a0';
const SEEDC = ['#2f6fb5', '#2f9e44', '#c2255c', '#e8890c', '#7048e8'];                                  // one colour per seed
const PLC = [['#0053d6', 90], ['#65cbf3', 70], ['#ffdb13', 50], ['#ff7d45', 0]];                          // pLDDT colours of the AlphaFold database
const plColor = (v) => PLC.find(([, lo]) => v >= lo)[0];

const NA = 14, NB = 10, NT = NA + NB;                                                                    // chain A, chain B, tokens
const BASE_A = Array.from({ length: NA }, (_, i) => { const th = 0.25 * Math.PI + i * ((1.5 * Math.PI) / 13); return [40 + 30 * Math.cos(th), 50 + 30 * Math.sin(th)]; });   // the toy complex, in a 100 x 100 box: a ring that is open on the right,
const BASE_B = Array.from({ length: NB }, (_, j) => [80 + 4 * Math.sin(0.9 * j), 18 + 7 * j]);                                                                          // and a second chain against the opening
const PLDDT = [95, 96, 94, 92, 90, 82, 78, 76, 74, 52, 44, 66, 80, 84, 68, 72, 88, 92, 94, 93, 91, 90, 86, 70];   // per bead: A then B
const EX = 12;                                                                                            // the example candidate (seed 3, sample 3)

// geometry, in map units (1000 x 395)
const GX = 66, GY = 54, GC = 46;                                                                          // the grid of candidates
const BOX = [346, 42, 340, 52], PX = [338, 455, 572], PW = 104, PY = 136;                                 // the confidence module and its three panels
const RX = 730, RY = 80, RP = 7.6, RW = 190;                                                                // the ranking bars

const CAPTIONS = [
  'AF3 runs the model with 5 random seeds, and each seed draws 5 diffusion samples. That gives 25 candidate structures to choose from.',
  "Each candidate goes through the confidence module: 4 Pairformer blocks that read the trunk's s and z and the candidate's structure. It predicts how wrong the candidate probably is, in three ways.",
  'pLDDT: one number for each atom, a prediction of how well its local surroundings are right. It is local. Blue is high, orange is low.',
  'PAE and PDE are pairwise. PAE: if the structure is aligned on token i, how far off is token j? PDE: how far off is the distance between i and j. Here the module is sure inside each chain, not sure how they sit together.',
  'pTM and ipTM are single numbers computed from the PAE. pTM uses all pairs: the whole structure. ipTM uses only pairs from different chains: the interfaces.',
  'Each candidate gets one ranking score: mostly ipTM and pTM, a small disorder term and a large penalty for clashes. The candidate with the best score is the output.',
  'Training only practises single denoising steps, so there is no full structure to judge. AF3 therefore runs a short rollout from noise: 20 steps, larger than at inference, no gradients.',
  'The rollout structure is compared with the ground truth and the real errors are measured: accuracy per atom, alignment error and distance error per pair. The confidence module learns to predict them.',
];

AF3.kinds.confidence = (s) => ({
  steps: 8,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .cf-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .cf-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .cf-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .cf-t.muted { fill: var(--muted); }
      .cf-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .cf-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .cf-img { image-rendering: pixelated; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // ---- the toy data ----
    const rand = rng(SEED);
    const CAND = Array.from({ length: 25 }, () => {                                                       // 25 candidates: B sits a little differently each time
      const bx = (rand() - 0.5) * 12, by = (rand() - 0.5) * 14;
      return {
        A: BASE_A.map(([x, y]) => [x + (rand() - 0.5) * 2.4, y + (rand() - 0.5) * 2.4]),
        B: BASE_B.map(([x, y]) => [x + bx + (rand() - 0.5) * 2.4, y + by + (rand() - 0.5) * 2.4]),
      };
    });
    const PTM = Array.from({ length: 25 }, () => 0.7 + 0.2 * rand()), IPTM = Array.from({ length: 25 }, () => 0.5 + 0.35 * rand());
    const DIS = Array.from({ length: 25 }, () => 0.06 * rand());
    const CLASH = 7;                                                                                      // one candidate with a clash, and the best ipTM
    IPTM[CLASH] = 0.93; PTM[CLASH] = 0.91;
    PTM[EX] = 0.86; IPTM[EX] = 0.58;                                                                      // the example: a good chain, an uncertain interface
    const RAW = PTM.map((p, c) => 0.8 * IPTM[c] + 0.2 * p + 0.5 * DIS[c]);                               // the score before the clash penalty
    const FINAL = RAW.map((v, c) => (c === CLASH ? -100 + v : v));
    const ORDER = Array.from({ length: 25 }, (_, c) => c).sort((a, b) => FINAL[b] - FINAL[a]);            // best first
    const RANK = []; ORDER.forEach((c, r) => { RANK[c] = r; });
    const TOP = ORDER[0];
    const RC = Array.from({ length: NT }, () => [rand() * 100, rand() * 100]);                           // pure noise, for the rollout
    const PRED = [...CAND[EX].A, ...CAND[EX].B];                                                           // the structure the rollout ends in
    const TRUTH = PRED.map(([x, y], k) => [x + (k >= NA ? -4.5 : 0) + (rand() - 0.5) * 3.2, y + (k >= NA ? 3.5 : 0) + (rand() - 0.5) * 3.2]);
    const isLoop = (k) => k === 9 || k === 10;
    const paeAt = (i, j, noise) => {                                                                       // alignment error in angstrom: row i aligned, column j scored
      const ca = i < NA, cb = j < NA;
      let v = ca === cb ? Math.min(8, 1.2 + 0.28 * Math.abs(i - j)) : ((ca ? i >= 11 && j - NA <= 3 : j >= 11 && i - NA <= 3) ? 9 : 15 + 3 * Math.sin(i * 1.3 + j * 0.7));
      if ((i < NA && isLoop(i)) || (j < NA && isLoop(j))) v += 12;
      return Math.max(0.5, Math.min(30, v + noise * (rand() - 0.5) * 3));
    };
    const PAEM = Array.from({ length: NT }, (_, i) => Array.from({ length: NT }, (_, j) => paeAt(i, j, 1)));
    const PDEM = PAEM.map((row, i) => row.map((v, j) => Math.max(0.3, 0.55 * 0.5 * (v + PAEM[j][i]))));
    const TPAE = Array.from({ length: NT }, (_, i) => Array.from({ length: NT }, (_, j) => Math.min(30, paeAt(i, j, 2) * 0.9 + 1)));
    const TPDE = TPAE.map((row, i) => row.map((v, j) => Math.max(0.3, 0.55 * 0.5 * (v + TPAE[j][i]))));
    const TLDDT = PLDDT.map((v) => Math.max(20, Math.min(99, v + (rand() - 0.5) * 18)));                  // the true local accuracy, near the predicted one

    // a 24 x 24 matrix as a small picture, drawn once (dark green is a small error, light a large one, as in the AlphaFold database)
    const matrixUrl = (M) => {
      const cv = document.createElement('canvas'); cv.width = NT; cv.height = NT;
      const c2 = cv.getContext('2d'), im = c2.createImageData(NT, NT);
      for (let i = 0; i < NT; i++) for (let j = 0; j < NT; j++) {
        const v = Math.min(1, M[i][j] / 30), p = (i * NT + j) * 4;
        im.data[p] = lerp(31, 242, v); im.data[p + 1] = lerp(122, 250, v); im.data[p + 2] = lerp(70, 240, v); im.data[p + 3] = 255;
      }
      c2.putImageData(im, 0, 0);
      return cv.toDataURL();
    };
    const URL = { pae: matrixUrl(PAEM), pde: matrixUrl(PDEM), tpae: matrixUrl(TPAE), tpde: matrixUrl(TPDE) };

    // ---- helpers ----
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="cf-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0, dash = '') => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${op.toFixed(2)}"/>`;
    const arrow = (pts, op, o = {}) => {                                                                       // a polyline with a head; the shaft stops under the head
      if (op < 0.01) return '';
      const c = o.col || 'var(--accent)', w = o.w || 2.2, hl = o.hl || 9, hw = o.hw || 5, n = pts.length;
      const [x1, y1] = pts[n - 2], [x2, y2] = pts[n - 1], len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const bx = x2 - ux * hl, by = y2 - uy * hl;
      const d = pts.slice(0, n - 1).concat([[bx, by]]).map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
      return `<g opacity="${op.toFixed(2)}"><path d="M${d}" fill="none" stroke="${c}" stroke-width="${w}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linejoin="round"/><polygon points="${x2},${y2} ${(bx - uy * hw).toFixed(1)},${(by + ux * hw).toFixed(1)} ${(bx + uy * hw).toFixed(1)},${(by - ux * hw).toFixed(1)}" fill="${c}"/></g>`;
    };
    const poly = (P, x, y, k, col, w, op, dash = '') => `<polyline points="${P.map(([px, py]) => `${(x + px * k).toFixed(1)},${(y + py * k).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${op.toFixed(2)}"/>`;
    const dots = (P, x, y, k, colFn, r, op) => P.map(([px, py], i) => `<circle cx="${(x + px * k).toFixed(1)}" cy="${(y + py * k).toFixed(1)}" r="${r}" fill="${colFn(i)}" stroke="var(--bg)" stroke-width="0.8" opacity="${op.toFixed(2)}"/>`).join('');
    const chains = (P) => [P.slice(0, NA), P.slice(NA)];
    const glyph = (P, x, y, size, col, colB, w, op) => op < 0.01 ? '' : chains(P).map((C, i) => poly(C, x, y, size / 100, i ? colB : col, w, op)).join('');   // two chains
    const matrixPanel = (url, x, y, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><image class="cf-img" href="${url}" x="${x}" y="${y}" width="${PW}" height="${PW}" preserveAspectRatio="none"/>`
      + `<line x1="${x + (PW * NA) / NT}" y1="${y}" x2="${x + (PW * NA) / NT}" y2="${y + PW}" stroke="var(--fg)" stroke-width="1" opacity=".55"/><line x1="${x}" y1="${y + (PW * NA) / NT}" x2="${x + PW}" y2="${y + (PW * NA) / NT}" stroke="var(--fg)" stroke-width="1" opacity=".55"/>`
      + `<rect x="${x}" y="${y}" width="${PW}" height="${PW}" fill="none" stroke="var(--muted)" stroke-width="1.2"/></g>`;
    const bead = (v) => plColor(v);
    const LEG = () => PLC.map(([c], i) => `<rect x="${0 + i * 14}" y="0" width="12" height="8" fill="${c}"/>`).join('');

    const draw = (st) => {
      const { a, b, c, d, e, f, g, h: hh } = st;
      let h = '';
      const inf = 1 - ramp(g, 0, 0.25), tr = ramp(g, 0.15, 0.4);

      // ---- the three phases, along the top: the one in play is underlined ----
      const r1 = ramp(b, 0, 0.1), r2 = ramp(f, 0, 0.1);
      [['1  Sampling', 24, 300, 1 - r1], ['2  Confidence estimation', 330, 690, r1 - r2], ['3  Ranking', 720, 980, r2]].forEach(([lab, x1, x2, cur], i) => {
        const reach = [1, r1, r2][i], op = ramp(a, 0, 0.3) * inf * (0.4 + 0.6 * reach);
        h += txt((x1 + x2) / 2, 14, 15, lab, op, { bold: cur > 0.5 });
        h += rect(x1, 25, x2 - x1, 1.5, 'var(--muted)', 'none', 0, op * 0.8) + rect(x1, 24, x2 - x1, 3.5, 'var(--accent)', 'none', 0, cur * inf);
      });
      h += txt(500, 14, 15, '4  How the confidence module is trained', tr, { bold: true }) + rect(24, 24, 956, 3.5, 'var(--accent)', 'none', 0, tr);

      // ---- step 1: seeds, samples, candidates ----
      const hl = ramp(b, 0.05, 0.25) * (1 - ramp(f, 0.35, 0.5)), dim = 1 - 0.55 * ramp(b, 0.1, 0.3) * (1 - ramp(f, 0.35, 0.5));
      for (let sd = 0; sd < 5; sd++) {
        const t = ramp(a, 0.1 + 0.15 * sd, 0.3 + 0.15 * sd);
        h += txt(GX - 8, GY + sd * GC + GC / 2, 12.5, `seed ${sd + 1}`, t * inf, { anchor: 'end', muted: true });
        for (let sp = 0; sp < 5; sp++) {
          const cd = sd * 5 + sp, cellOp = ramp(a, 0.12 + 0.15 * sd + 0.025 * sp, 0.3 + 0.15 * sd + 0.025 * sp) * inf * (cd === EX || cd === TOP ? 1 : dim);
          h += glyph([...CAND[cd].A, ...CAND[cd].B], GX + sp * GC + 3, GY + sd * GC + 3, GC - 6, SEEDC[sd], SEEDC[sd] + '99', 1.7, cellOp);
        }
      }
      h += txt(GX + (5 * GC) / 2, GY + 5 * GC + 14, 13, '5 seeds × 5 samples', ramp(a, 0.7, 0.9) * inf, { muted: true }) + txt(GX + (5 * GC) / 2, GY + 5 * GC + 34, 15, '= 25 candidates', ramp(a, 0.75, 0.95) * inf, { bold: true });

      const hKeep = h; h = '';                                                                        // the module and its panels go into one group, so they can be dimmed while the ranking is shown
      // ---- step 2: the example goes into the module ----
      const ex = [GX + 2 * GC, GY + 2 * GC];
      h += rect(ex[0] - 1, ex[1] - 1, GC + 2, GC + 2, 'none', CI, 3, hl * inf, 4);
      h += arrow([[GX + 5 * GC + 4, ex[1] + GC / 2], [322, ex[1] + GC / 2], [322, BOX[1] + BOX[3] / 2], [BOX[0] - 3, BOX[1] + BOX[3] / 2]], ramp(b, 0.15, 0.4) * inf * (1 - ramp(f, 0.35, 0.5)), {});
      const mOp = ramp(b, 0.1, 0.35) * inf;
      h += rect(BOX[0], BOX[1], BOX[2], BOX[3], 'var(--bg)', 'var(--muted)', 1.6, mOp, 8) + txt(BOX[0] + BOX[2] / 2, BOX[1] + 17, 15, 'confidence module (4 blocks)', mOp, { bold: true }) + txt(BOX[0] + BOX[2] / 2, BOX[1] + 37, 12.5, "reads the trunk's s and z and the candidate", mOp, { muted: true });
      const titles = [['pLDDT', 'local, per atom'], ['PAE', 'pairwise'], ['PDE', 'pairwise']];
      PX.forEach((x, i) => {
        const op = ramp(b, 0.3 + 0.08 * i, 0.55 + 0.08 * i) * inf;
        h += arrow([[x + PW / 2, BOX[1] + BOX[3] + 2], [x + PW / 2, PY - 26]], op, { w: 1.8, hl: 7, hw: 4 });
        h += txt(x + PW / 2, PY - 12, 14, titles[i][0], op, { bold: true });
        h += rect(x, PY, PW, PW, 'none', 'var(--muted)', 1.2, op * (1 - ramp(i === 0 ? c : d, 0.1, 0.3)), 0, '4 3');
        h += txt(x + PW / 2, PY + PW + 16, 12.5, titles[i][1], ramp(i === 0 ? c : d, 0.2, 0.4) * inf, { muted: true });
      });

      // ---- step 3: pLDDT on the structure ----
      const pc = ramp(c, 0.1, 0.4) * inf, P0 = PX[0], P_ = CAND[EX];
      if (pc > 0.01) {
        h += poly(P_.A, P0 + 4, PY + 2, 0.96, GREY, 1.4, pc * 0.8) + poly(P_.B, P0 + 4, PY + 2, 0.96, GREY, 1.4, pc * 0.8);
        h += dots([...P_.A, ...P_.B].map(([x, y]) => [x * 0.96 / 1, y * 0.96 / 1]), P0 + 4, PY + 2, 1, (i) => bead(PLDDT[i]), 3.6, pc);
        h += `<g transform="translate(${P0 + PW / 2 - 28} ${PY + PW + 30})" opacity="${(pc * ramp(c, 0.4, 0.6)).toFixed(2)}">${LEG()}</g>`;
      }

      // ---- step 4: PAE and PDE ----
      h += matrixPanel(URL.pae, PX[1], PY, ramp(d, 0.1, 0.4) * inf) + matrixPanel(URL.pde, PX[2], PY, ramp(d, 0.2, 0.5) * inf);
      [1, 2].forEach((i) => { h += txt(PX[i] + PW / 2, PY + PW + 30, 11.5, 'dark = small error', ramp(d, 0.4, 0.6) * inf * (1 - ramp(e, 0.05, 0.25)), { muted: true }); });

      // ---- step 5: pTM and ipTM, from the PAE ----
      const bx = 392, bw = 228, ex5 = ramp(e, 0.05, 0.3) * inf, pT = ramp(e, 0.25, 0.55), iT = ramp(e, 0.55, 0.85);
      const x2 = PX[1], blk = (PW * NA) / NT;
      h += arrow([[PX[1] + PW / 2, PY + PW + 36], [PX[1] + PW / 2, 294]], ex5, { w: 1.8, hl: 7, hw: 4 }) + txt(PX[1] + PW / 2 + 10, 286, 12, 'from the PAE', ex5, { anchor: 'start', muted: true });
      h += rect(x2 - 2, PY - 2, PW + 4, PW + 4, 'none', 'var(--accent)', 3, pT * (1 - ramp(e, 0.5, 0.6)) * inf);
      h += rect(x2 + blk, PY, PW - blk, blk, 'var(--accent)', 'var(--accent)', 2, 0.35 * iT * inf) + rect(x2, PY + blk, blk, PW - blk, 'var(--accent)', 'var(--accent)', 2, 0.35 * iT * inf);
      [['pTM', 'whole structure', 302, PTM[EX], pT], ['ipTM', 'interfaces only', 336, IPTM[EX], iT]].forEach(([lab, sub, y, v, t]) => {
        h += txt(bx - 8, y + 6, 14, lab, ex5, { anchor: 'end', bold: true }) + txt(bx - 8, y + 22, 12, sub, ex5, { anchor: 'end', muted: true });
        h += rect(bx, y, bw, 13, 'none', 'var(--muted)', 1.2, ex5, 3) + rect(bx, y, bw * v * t, 13, 'var(--accent)', 'none', 0, ex5, 3);
        h += txt(bx + bw + 8, y + 7, 14, (v * t).toFixed(2), ex5 * ramp(t, 0.5, 0.9), { anchor: 'start', bold: true });
      });

      const mD = 1 - 0.55 * ramp(f, 0.05, 0.3);
      h = hKeep + `<g opacity="${mD.toFixed(2)}">${h}</g>`;
      // ---- step 6: the ranking score of each candidate; the penalty; the order; the output ----
      const R = ramp(f, 0.05, 0.25) * inf, pen = ramp(f, 0.35, 0.5), srt = ramp(f, 0.5, 0.8), out = ramp(f, 0.8, 1);
      h += txt(RX - 4, 46, 12.5, 'ranking score = 0.8 ipTM + 0.2 pTM', R, { anchor: 'start', muted: true }) + txt(RX - 4, 62, 12.5, '+ 0.5 disorder − 100 clash', R, { anchor: 'start', muted: true });
      for (let cd = 0; cd < 25; cd++) {
        const v = cd === CLASH ? lerp(RAW[cd], 0, pen) : RAW[cd], y = lerp(RY + cd * RP, RY + RANK[cd] * RP, srt), isTop = cd === TOP;
        h += rect(RX, y, RW * Math.max(0.01, v), RP - 2.5, SEEDC[Math.floor(cd / 5)], isTop && out > 0.5 ? 'var(--accent)' : 'none', 2, R * (1 - ramp(g, 0, 0.25)), 1);
        if (cd === CLASH) {
          h += rect(RX, y, RW * RAW[cd], RP - 2.5, 'none', PINK, 1.2, R * pen * 0.9 * (1 - ramp(f, 0.5, 0.7)), 1, '3 2') + txt(RX + RW * Math.max(RAW[cd] * (1 - pen), 0.02) + 6, y + (RP - 2.5) / 2, 11.5, 'clash: −100', R * ramp(f, 0.3, 0.4), { anchor: 'start', fill: PINK });
        }
      }
      const oy = RY + 25 * RP + 10;
      h += rect(RX - 6, oy, 90, 90, 'none', 'var(--accent)', 2.5, out * inf, 6) + glyph([...CAND[TOP].A, ...CAND[TOP].B], RX - 2, oy + 4, 82, SEEDC[Math.floor(TOP / 5)], SEEDC[Math.floor(TOP / 5)] + '99', 2.4, out * inf);
      h += txt(RX + 92, oy + 30, 13.5, 'the top-ranked', out * inf, { anchor: 'start', bold: true }) + txt(RX + 92, oy + 48, 13.5, 'candidate is the', out * inf, { anchor: 'start', bold: true }) + txt(RX + 92, oy + 66, 13.5, 'output', out * inf, { anchor: 'start', bold: true });
      const tp = [GX + (TOP % 5) * GC, GY + Math.floor(TOP / 5) * GC];
      h += rect(tp[0] - 1, tp[1] - 1, GC + 2, GC + 2, 'none', 'var(--accent)', 3, out * inf, 4);

      // ---- step 7: the rollout, a few frames from noise to a structure ----
      for (let k = 0; k < 5; k++) {
        const q = [0, 0.4, 0.75, 0.93, 1][k], x0 = 50 + k * 190, y0 = 78, t = ramp(g, 0.25 + 0.08 * k, 0.5 + 0.08 * k);
        const P = PRED.map(([px, py], i) => [lerp(RC[i][0], px, q), lerp(RC[i][1], py, q)]);
        h += rect(x0 - 8, y0 - 6, 118, 112, 'var(--bg)', 'var(--muted)', 1.2, t * tr, 8);
        h += glyph(P, x0, y0, 100, GREY, GREY, 1.6, t * tr * ramp(q, 0.6, 1)) + dots(P, x0, y0, 1, () => (k === 4 ? CI : GREY), 2.8, t * tr);
        if (k < 4) h += arrow([[x0 + 114, y0 + 50], [x0 + 176, y0 + 50]], t * tr, { w: 2, hl: 8, hw: 4.5, col: GREY });
        h += txt(x0 + 51, y0 + 118, 12.5, ['noise', '', '', '', 'full structure'][k], t * tr, { muted: true });
      }
      const brk = ramp(g, 0.7, 0.9) * tr;
      h += brk < 0.01 ? '' : `<path d="M50 206 v6 H890 v-6" fill="none" stroke="var(--muted)" stroke-width="1.5" opacity="${brk.toFixed(2)}"/>`;
      h += txt(470, 224, 13.5, '20 denoising steps, larger than at inference, no gradients', brk, { muted: true });

      // ---- step 8: compared with the truth; the real errors are the targets ----
      const hOp = ramp(hh, 0.05, 0.3) * tr, err = ramp(hh, 0.25, 0.5);
      const ox = 44, oy2 = 246, os = 120;
      h += glyph(TRUTH, ox, oy2, os, GREY, GREY, 1.8, hOp * 0.9) + glyph(PRED, ox, oy2, os, CI, CI, 1.8, hOp);
      if (hOp > 0.01) for (let k = 0; k < NT; k++) h += `<line x1="${(ox + PRED[k][0] * os / 100).toFixed(1)}" y1="${(oy2 + PRED[k][1] * os / 100).toFixed(1)}" x2="${(ox + TRUTH[k][0] * os / 100).toFixed(1)}" y2="${(oy2 + TRUTH[k][1] * os / 100).toFixed(1)}" stroke="${PINK}" stroke-width="1.6" opacity="${(err * hOp).toFixed(2)}"/>`;
      h += txt(ox + os / 2, oy2 + os + 12, 12.5, 'predicted (orange) and true (grey)', hOp, { muted: true });
      h += arrow([[ox + os + 18, oy2 + 56], [262, oy2 + 56]], ramp(hh, 0.3, 0.5) * tr, { w: 2, hl: 8, hw: 4.5 }) + txt((ox + os + 18 + 262) / 2, oy2 + 40, 12.5, 'measure', ramp(hh, 0.3, 0.5) * tr, { muted: true });
      const tx = [268, 382, 496], ty = oy2 + 6, tw = PW;
      const tg = ramp(hh, 0.4, 0.7) * tr;
      h += rect(tx[0], ty, tw, tw, 'var(--bg)', 'var(--muted)', 1.2, tg) + poly(PRED.slice(0, NA), tx[0] + 4, ty + 2, 0.96, GREY, 1.4, tg * 0.8) + poly(PRED.slice(NA), tx[0] + 4, ty + 2, 0.96, GREY, 1.4, tg * 0.8);
      h += dots(PRED.map(([x, y]) => [x * 0.96, y * 0.96]), tx[0] + 4, ty + 2, 1, (i) => bead(TLDDT[i]), 3.6, tg);
      h += matrixPanel(URL.tpae, tx[1], ty, tg) + matrixPanel(URL.tpde, tx[2], ty, tg);
      [['true local', 'accuracy'], ['true alignment', 'error'], ['true distance', 'error']].forEach(([l1, l2], i) => { h += txt(tx[i] + tw / 2, ty + tw + 14, 12.5, l1, tg, { muted: true }) + txt(tx[i] + tw / 2, ty + tw + 29, 12.5, l2, tg, { muted: true }); });
      const mb = ramp(hh, 0.7, 0.95) * tr;
      h += arrow([[tx[2] + tw + 10, ty + 54], [764, ty + 54]], mb, { w: 2, hl: 8, hw: 4.5 }) + txt((tx[2] + tw + 10 + 764) / 2, ty + 38, 12.5, 'learns to predict', mb, { muted: true });
      h += rect(768, ty + 28, 192, 52, 'var(--bg)', 'var(--muted)', 1.6, mb, 8) + txt(864, ty + 46, 14.5, 'confidence module', mb, { bold: true }) + txt(864, ty + 66, 12.5, 'pLDDT, PAE, PDE', mb, { muted: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="cf-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Confidence metrics: 5 seeds with 5 samples each give 25 candidate structures; each goes through the confidence module, which predicts pLDDT per atom, PAE and PDE per pair of tokens, and pTM and ipTM from the PAE; the candidates are ranked and the best is the output; the module is trained on a short rollout compared with the ground truth"></svg></div>
      <div class="cf-caps">${CAPTIONS.map((t, i) => `<p class="cf-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;
    const svg = frame.querySelector('svg');

    const KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 4500, 3500, 3500, 4500, 4500, 8500, 5500, 6500][step], t0 = performance.now();
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
