// "Outer Product Mean" (appendix, slide 70): the figure of the original (Simon, The Illustrated AlphaFold: the MSA representation m is projected into a and b;
// for a pair of positions, the outer product of a and b is taken in each sequence and averaged over the sequences; the result is flattened and a linear layer
// turns it into the update of z_ij) redrawn natively and played a click at a time, for one pair (i, j) first and then for all of them:
//
//   1  m: a vector for every position in every sequence of the alignment; the pair we update is (i, j)
//   2  m is projected twice, into a and b; for (i, j) the vectors that matter are column i of a and column j of b, one of each per sequence
//   3  one sequence: every number of a at i times every number of b at j, a table of all the combinations (an outer product)
//   4  every sequence the same way, then the tables are averaged; a pair that does not change together (below) averages to a flatter table
//   5  the averaged table is flattened into one long vector, and a linear layer turns it into the update of z_ij
//   6  the same for every pair i, j; the update is added to z
//
// Checked against the supplement, Alg. 9 (OuterProductMean, c = 32, c_z = 128): m_si <- LayerNorm(m_si); a_si, b_si = LinearNoBias(m_si); o_ij =
// flatten(mean_s(a_si outer b_sj)) in R^(c.c); z_ij = Linear(o_ij); and Alg. 8 line 6: z += OuterProductMean(m), once per block of the MSA module (4 blocks).
// Left out of the drawing: the first LayerNorm and the size of the vectors (3 numbers stand in for c = 32, so the flattened vector has 9 numbers, not 1,024;
// 4 sequences and 5 positions stand in for the MSA). Every number is a toy (seed 2). The vectors of the two positions that matter are chosen so that position
// j's pattern depends on position i's in every sequence (the sequences are of two kinds, and each kind pairs up with one kind at j), and position k's does not;
// the table for (i, k) is computed from the same kind of numbers, not drawn by hand. That is the point of the average: what recurs across sequences survives.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => { const v = parseInt(hex.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const lerpColor = (a, b, t) => hex(rgb(a).map((x, i) => x + (rgb(b)[i] - x) * t));
const shade = (h, k) => hex(rgb(h).map((x) => (k > 0 ? x + (255 - x) * k : x * (1 + k))));
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const SEED = 2;
const LINE = 'rgba(0,0,0,.3)';
const BLUE = '#a9d8f2', CI = '#e8590c', CJ = '#3b5bdb', CK = '#868e96';              // z cells; positions i, j (as on the other slides) and k
const M_BG = '#fdebd3', M_BAR = '#e07a2a', A_LIGHT = '#fff1e0', A_DEEP = '#e07a2a', B_LIGHT = '#e3e9ff', B_DEEP = '#4c6ef5', A_BG = '#fff4e6', B_BG = '#edf2ff';
const O_LIGHT = '#f3f0ff', O_DEEP = '#7048e8', U_LIGHT = '#e5dbff', U_DEEP = '#7048e8';
const NS = 4, NP = 5, I = 1, J = 3, K = 4, C = 3, GC = 26, N = 5, CELL = 22;           // 4 sequences, 5 positions; the pair (1, 3); position 4 is the one that does not go with i; 3 numbers for a vector

// geometry, in map units (1000 x 395)
const M0 = { x: 44, y: 118 }, A0 = { x: 206, y: 34 }, B0 = { x: 206, y: 232 }, ZO = { x: 850, y: 105 };
const PX = 380, PY = (s) => 36 + s * 62, PC = 14;                                      // the panels: a vector, x, b vector, =, the table
const MEAN = { x: 590, y: 106, c: 24 }, ALT = { x: 590, y: 226, c: 24 }, FLAT = { x: 700, y: 130, c: 12 };
const OUT = [[FLAT.x + 9 * FLAT.c + 6, FLAT.y + 6], [830, 132], [820, 130], [842, 130]];   // from the flat vector to the update (a cubic)
const bez = (t) => { const u = 1 - t; return [0, 1].map((i) => u * u * u * OUT[0][i] + 3 * u * u * t * OUT[1][i] + 3 * u * t * t * OUT[2][i] + t * t * t * OUT[3][i]); };
const PATH = Array.from({ length: 11 }, (_, i) => bez(i / 10)).concat([[ZO.x + J * CELL + CELL / 2, ZO.y + I * CELL + CELL / 2]]);
const along = (pts, t) => {
  const sg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), tot = sg.reduce((x, y) => x + y, 0);
  let r = Math.max(0, Math.min(1, t)) * tot;
  for (let i = 0; i < sg.length; i++) {
    if (r <= sg[i] || i === sg.length - 1) { const f = sg[i] ? r / sg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }
    r -= sg[i];
  }
};

// the toy vectors that matter: a at position i, b at position j (paired up with a), b at position k (not)
const AI = [[0.9, 0.15, 0.2], [0.85, 0.2, 0.1], [0.15, 0.9, 0.2], [0.2, 0.85, 0.15]];
const BJ = [[0.15, 0.2, 0.9], [0.2, 0.1, 0.85], [0.9, 0.15, 0.2], [0.85, 0.2, 0.1]];
const BK = [[0.9, 0.2, 0.1], [0.1, 0.2, 0.9], [0.85, 0.15, 0.2], [0.2, 0.1, 0.85]];
const outer = (a, b) => a.map((x) => b.map((y) => x * y));
const mean4 = (A, B) => { const ms = A.map((a, s) => outer(a, B[s])); return [0, 1, 2].map((r) => [0, 1, 2].map((c) => ms.reduce((t, m) => t + m[r][c], 0) / NS)); };
const TAB = AI.map((a, s) => outer(a, BJ[s]));              // the table of each sequence for (i, j)
const MJ = mean4(AI, BJ), MK = mean4(AI, BK);               // the averages for (i, j) and for (i, k)
const VMAX = 0.8;

const CAPTIONS = [
  '$m$ holds a vector for every position in every sequence of the alignment: sequences down, positions across. We update the pair $(i, j)$.',
  '$m$ is projected twice, into $a$ and $b$ (32 numbers per cell in AF3, 3 here). For the pair $(i, j)$ we need column $i$ of $a$ and column $j$ of $b$: one vector of each for every sequence.',
  'In one sequence, multiply every number of $a$ at position $i$ by every number of $b$ at position $j$: an outer product, a table of all the combinations.',
  'Do the same in every sequence and average the tables. A combination that keeps coming back stays bright. For a pair that does not change together (below), the average is flatter.',
  'The averaged table is flattened into one long vector ($32 \\times 32 = 1{,}024$ numbers in AF3) and a linear layer turns it into the update for $z_{ij}$.',
  'The same is done for every pair $i, j$. The result is added to the pair representation $z$.',
];

AF3.kinds.opm = (s) => ({
  steps: 6,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .om-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .om-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .om-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .om-t.muted { fill: var(--muted); }
      .om-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .om-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const heading = AF3.apTitle(s);

    // ---- the toy data that is not chosen by hand ----
    const rand = rng(SEED);
    const vec = () => Array.from({ length: C }, () => 0.15 + 0.8 * rand());
    const MV = Array.from({ length: NS }, () => Array.from({ length: NP }, vec));
    const AV = Array.from({ length: NS }, (_, r) => Array.from({ length: NP }, (_, c) => (c === I ? AI[r] : vec())));
    const BV = Array.from({ length: NS }, (_, r) => Array.from({ length: NP }, (_, c) => (c === J ? BJ[r] : c === K ? BK[r] : vec())));
    const ZV = Array.from({ length: N }, () => Array.from({ length: N }, () => rand()));
    const OV = Array.from({ length: N }, () => Array.from({ length: N }, () => 0.2 + 0.8 * rand()));

    // ---- helpers ----
    const zcol = (r, c) => shade(BLUE, (ZV[r][c] - 0.5) * 0.35);
    const ocol = (v) => lerpColor(U_LIGHT, U_DEEP, v);
    const tcol = (v) => lerpColor(O_LIGHT, O_DEEP, Math.min(1, v / VMAX));
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : String(str).includes('$') ? AF3.svgRich(x, y, size, str, { ...o, color: o.fill, op }) : `<text x="${x}" y="${y}" font-size="${size}" class="om-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const bars = (x, y, w, h, vals, col) => {
      const bh = 5.5, gap = 2.5, y0 = y + (h - (C * bh + (C - 1) * gap)) / 2;
      return vals.map((v, i) => `<rect x="${(x + 3).toFixed(1)}" y="${(y0 + i * (bh + gap)).toFixed(1)}" width="${Math.max(1.5, v * (w - 6)).toFixed(1)}" height="${bh}" rx="1.5" fill="${col}"/>`).join('');
    };
    // a grid of vectors (sequences down, positions across)
    const vgrid = (g0, V, bg, col, op) => {
      if (op < 0.01) return '';
      let h = '';
      for (let r = 0; r < NS; r++) for (let c = 0; c < NP; c++) h += `<rect x="${g0.x + c * GC}" y="${g0.y + r * GC}" width="${GC}" height="${GC}" fill="${bg}" stroke="${LINE}" stroke-width="1"/>` + bars(g0.x + c * GC, g0.y + r * GC, GC, GC, V[r][c], col);
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const colBox = (g0, c, color, op) => rect(g0.x + c * GC - 1.5, g0.y - 1.5, GC + 3, NS * GC + 3, 'none', color, 3, op);
    const sqgrid = (g0, rows, cols, size, col, op) => {   // a table of numbers as coloured cells
      if (op < 0.01) return '';
      let h = '';
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) h += `<rect x="${(g0.x + c * size).toFixed(1)}" y="${(g0.y + r * size).toFixed(1)}" width="${size}" height="${size}" fill="${col(r, c)}" stroke="${LINE}" stroke-width="1"/>`;
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const zgrid = (g0, col, op) => sqgrid(g0, N, N, CELL, col, op);
    const arrowTo = (d, x, y, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5"/><polygon points="${x},${y} ${x - 10},${y - 5.5} ${x - 10},${y + 5.5}" fill="var(--accent)"/></g>`;
    const pulse = (a, b, e) => ramp(a, b, b + 0.04) * (1 - ramp(a, e, e + 0.04));

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d, e = st.e, f = st.f;
      const sweep = ramp(f, 0.05, 0.9), nn = Math.min(N * N - 1, Math.floor(N * N * sweep));
      const sw = f > 0.02 ? [Math.floor(nn / N), nn % N] : [I, J];                          // which position is i and which is j while every pair is done
      const ci = Math.min(sw[0], NP - 1), cj = Math.min(sw[1], NP - 1);

      // ---- step 1: m, the sequences and the positions ----
      h += vgrid(M0, MV, M_BG, M_BAR, ramp(a, 0, 0.3));
      const mo = ramp(a, 0, 0.3);
      for (let r = 0; r < NS; r++) h += txt(M0.x - 8, M0.y + r * GC + GC / 2, 13, String(r), mo, { anchor: 'end', muted: true });
      h += txt(M0.x - 8, M0.y - 9, 13, 'seq', mo, { anchor: 'end', muted: true });
      for (let p = 0; p < NP; p++) h += txt(M0.x + p * GC + GC / 2, M0.y - 9, 13, p === I ? '$i$' : p === J ? '$j$' : String(p), mo, { bold: p === I || p === J, fill: p === I ? CI : p === J ? CJ : 'var(--muted)' });
      h += colBox(M0, I, CI, ramp(a, 0.4, 0.65) * (1 - ramp(f, 0.04, 0.1))) + colBox(M0, J, CJ, ramp(a, 0.5, 0.75) * (1 - ramp(f, 0.04, 0.1)));
      h += txt(M0.x + (NP * GC) / 2, M0.y + NS * GC + 24, 20, '$m$', mo, { bold: true }) + txt(M0.x + (NP * GC) / 2, M0.y + NS * GC + 42, 13, 'a vector in every cell', mo, { muted: true });

      // ---- step 2: a and b ----
      const arr = ramp(b, 0, 0.25), grow = ramp(b, 0.15, 0.4);
      h += arrowTo(`M${M0.x + NP * GC + 6} ${M0.y + 20} C 190 ${M0.y + 20}, 175 82, ${A0.x - 12} 82`, A0.x - 4, 82, arr);
      h += arrowTo(`M${M0.x + NP * GC + 6} ${M0.y + 84} C 190 ${M0.y + 84}, 175 284, ${B0.x - 12} 284`, B0.x - 4, 284, arr);
      h += vgrid(A0, AV, A_BG, A_DEEP, grow) + vgrid(B0, BV, B_BG, B_DEEP, grow);
      h += txt(A0.x + (NP * GC) / 2, A0.y - 12, 19, '$a$', grow, { bold: true }) + txt(B0.x + (NP * GC) / 2, B0.y + NS * GC + 18, 19, '$b$', grow, { bold: true });
      const side = 1 - ramp(c, 0.1, 0.3);
      h += txt(A0.x + NP * GC + 10, A0.y + 10, 13, 'linear', ramp(b, 0.3, 0.5) * side, { muted: true, anchor: 'start' }) + txt(B0.x + NP * GC + 10, B0.y + 86, 13, 'linear', ramp(b, 0.3, 0.5) * side, { muted: true, anchor: 'start' });
      const cols = ramp(b, 0.55, 0.8) * (1 - ramp(f, 0.04, 0.1));
      h += colBox(A0, I, CI, cols) + colBox(B0, J, CJ, cols);
      const cols2 = ramp(f, 0.04, 0.1) * (1 - ramp(f, 0.93, 1));
      h += colBox(A0, ci, CI, cols2) + colBox(B0, cj, CJ, cols2);
      h += colBox(B0, K, CK, ramp(d, 0.55, 0.8) * (1 - ramp(e, 0, 0.2)));

      // ---- step 3 and 4: the tables, one for each sequence, and their average ----
      let p = '';
      for (let sq = 0; sq < NS; sq++) {
        const t = sq === 0 ? ramp(c, 0.1, 0.7) : ramp(d, 0.05 + 0.15 * (sq - 1), 0.35 + 0.15 * (sq - 1));
        if (t < 0.01) continue;
        const y = PY(sq);
        p += `<g opacity="${t.toFixed(2)}">`;
        for (let r = 0; r < C; r++) p += `<rect x="${PX}" y="${y + r * PC}" width="${PC}" height="${PC}" fill="${lerpColor(A_LIGHT, A_DEEP, AI[sq][r])}" stroke="${LINE}" stroke-width="1"/>`;
        for (let q = 0; q < C; q++) p += `<rect x="${PX + 54 + q * PC}" y="${y + PC}" width="${PC}" height="${PC}" fill="${lerpColor(B_LIGHT, B_DEEP, BJ[sq][q])}" stroke="${LINE}" stroke-width="1"/>`;
        for (let r = 0; r < C; r++) for (let q = 0; q < C; q++) p += `<rect x="${PX + 116 + q * PC}" y="${y + r * PC}" width="${PC}" height="${PC}" fill="${tcol(TAB[sq][r][q])}" stroke="${LINE}" stroke-width="1"/>`;
        p += AF3.svgMath(PX + 32, y + 21, 16, String.raw`\times`) + AF3.svgMath(PX + 105, y + 21, 15, '=');
        p += `<text x="${PX - 10}" y="${y + 21}" font-size="13" class="om-t muted" text-anchor="end">${sq}</text></g>`;
      }
      // a pulse on the source cells while a sequence is taken
      for (let sq = 0; sq < NS; sq++) {
        const t0 = sq === 0 ? [0.05, 0.4] : [0.05 + 0.15 * (sq - 1), 0.2 + 0.15 * (sq - 1)];
        const pu = sq === 0 ? pulse(c, 0.05, 0.4) : pulse(d, t0[0], t0[1] + 0.1);
        p += rect(A0.x + I * GC, A0.y + sq * GC, GC, GC, 'none', 'var(--accent)', 3, pu * (1 - ramp(f, 0.02, 0.06))) + rect(B0.x + J * GC, B0.y + sq * GC, GC, GC, 'none', 'var(--accent)', 3, pu * (1 - ramp(f, 0.02, 0.06)));
      }
      p += txt(PX + 137, 20, 14, 'one table', ramp(c, 0.5, 0.8), { bold: true }) + txt(PX + 90, 286, 14, 'a table per sequence', ramp(d, 0.3, 0.6), { bold: true });
      p += txt(PX + 7, 20, 13, '$a$ at $i$', ramp(c, 0.2, 0.5), { muted: true }) + txt(PX + 70, 20, 13, '$b$ at $j$', ramp(c, 0.2, 0.5), { muted: true });

      // the average: the four tables flow into one
      const mo4 = ramp(d, 0.55, 0.85);
      for (let sq = 0; sq < NS; sq++) p += `<g opacity="${(ramp(d, 0.5, 0.7) * 0.7).toFixed(2)}"><path d="M${PX + 160} ${PY(sq) + 21} L${MEAN.x - 6} ${MEAN.y + 36}" stroke="var(--muted)" stroke-width="1.4"/></g>`;
      const flatT = ramp(e, 0.05, 0.5);                                                       // the average turns into the flat vector
      const meanOp = mo4 * (1 - ramp(e, 0.4, 0.6));
      p += sqgrid(MEAN, 3, 3, MEAN.c, (r, q) => tcol(MJ[r][q] * 1.5), meanOp);
      p += txt(MEAN.x + 36, MEAN.y - 14, 14, 'mean over sequences', mo4 * (1 - ramp(e, 0.2, 0.4)), { bold: true });
      p += txt(MEAN.x + 36, MEAN.y - 30, 13, 'pair $(i, j)$', mo4 * (1 - ramp(e, 0.2, 0.4)), { muted: true });
      const alt = ramp(d, 0.78, 1) * (1 - ramp(e, 0.1, 0.35));
      p += sqgrid(ALT, 3, 3, ALT.c, (r, q) => tcol(MK[r][q] * 1.5), alt);
      p += txt(ALT.x + 36, ALT.y - 14, 14, 'does not change together', alt, { bold: true });
      p += txt(ALT.x + 36, ALT.y - 30, 13, 'pair $(i, k)$', alt, { muted: true });

      // ---- step 5: flatten, then a linear layer ----
      const fo = ramp(e, 0.3, 0.6);
      if (fo > 0.01) {
        let fl = '';
        for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
          const idx = r * 3 + q, tx = FLAT.x + idx * FLAT.c, ty = FLAT.y, sx = MEAN.x + q * MEAN.c, sy = MEAN.y + r * MEAN.c, m = ramp(e, 0.2, 0.55);
          fl += `<rect x="${lerp(sx, tx, m).toFixed(1)}" y="${lerp(sy, ty, m).toFixed(1)}" width="${lerp(MEAN.c, FLAT.c, m).toFixed(1)}" height="${lerp(MEAN.c, FLAT.c, m).toFixed(1)}" fill="${tcol(MJ[r][q] * 1.5)}" stroke="${LINE}" stroke-width="1"/>`;
        }
        p += `<g opacity="${(0.4 + 0.6 * fo).toFixed(2)}">${fl}</g>`;
      }
      p += txt(FLAT.x + 54, FLAT.y - 16, 14, 'flattened', ramp(e, 0.45, 0.65), { bold: true }) + txt(FLAT.x + 54, FLAT.y + 36, 13, '9 numbers (1,024 in AF3)', ramp(e, 0.5, 0.7), { muted: true });
      const oa = ramp(e, 0.55, 0.7);
      p += arrowTo(`M${OUT[0][0]} ${OUT[0][1]} C ${OUT[1][0]} ${OUT[1][1]}, ${OUT[2][0]} ${OUT[2][1]}, ${OUT[3][0]} ${OUT[3][1]}`, ZO.x - 2, 130, oa);
      p += txt(812, 150, 13, 'linear layer', ramp(e, 0.6, 0.75), { muted: true });
      h += `<g opacity="${(1 - 0.7 * ramp(f, 0, 0.1)).toFixed(2)}">${p}</g>`;

      // ---- the update: empty, then z_ij, then every pair in turn ----
      const ou = ramp(e, 0.5, 0.65);
      h += zgrid(ZO, (r, q) => {
        const fill = r === I && q === J ? ramp(e, 0.88, 0.98) : ramp(f, 0.08 + (0.7 * (r * N + q)) / (N * N), 0.15 + (0.7 * (r * N + q)) / (N * N));
        return fill < 0.02 ? 'var(--bg)' : lerpColor('#ffffff', ocol(OV[r][q]), fill);
      }, ou);
      h += rect(ZO.x + J * CELL, ZO.y + I * CELL, CELL, CELL, 'none', 'var(--accent)', 3, ramp(e, 0.65, 0.75) * (1 - ramp(f, 0.04, 0.1)));
      if (f > 0.04 && f < 0.97) h += rect(ZO.x + sw[1] * CELL, ZO.y + sw[0] * CELL, CELL, CELL, 'none', 'var(--accent)', 3, 1);
      h += txt(ZO.x + (N * CELL) / 2, 238, 16, 'the update', ou, { bold: true }) + txt(ZO.x + (N * CELL) / 2, 257, 13, 'added to $z$', ramp(f, 0.9, 1), { muted: true });
      const tr = ramp(e, 0.72, 0.95);
      if (tr > 0 && tr < 1) { const [qx, qy] = along(PATH, tr); h += rect(qx - CELL / 2, qy - CELL / 2, CELL, CELL, ocol(OV[I][J]), LINE, 1); }
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(heading)}</h2>
      <div class="om-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="The outer product mean: the MSA representation m is projected into a and b; for the pair of positions i and j, an outer product of a and b is taken in each sequence and the tables are averaged over the sequences; the average is flattened and a linear layer turns it into the update of z_ij; the same is done for every pair"></svg></div>
      <div class="om-caps">${CAPTIONS.map((t, i) => `<p class="om-cap reveal-in" data-show="${i + 1}">${AF3.rich(t, esc)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, heading.length)}`;
    const svg = frame.querySelector('svg');

    const KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 2600, 5500, 6000, 9000, 7500, 7500][step], t0 = performance.now();
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
