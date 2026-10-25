// "Triangular Attention (Outgoing)" (slide 40) and, with the same drawing turned round, "Triangular Attention (Incoming)" (appendix, slide 72): the figure of the original (Simon, The Illustrated AlphaFold: q, k, v, b and g are projected
// from z; attention along row i, with a bias from row j; the weighted sum of the values, times a gate; the heads joined and projected back
// to z) redrawn natively and played a click at a time, for one entry z_ij first and then for all of them:
//
//   1  z_ij is the edge i-j; row i holds the edges that leave i, row j the edges that leave j
//   2  projections: z_ij gives a query and a gate; row i gives a key and a value for every token k; row j gives one number per k, a bias
//   3  scores: the query against every key, then the bias b_jk added (the third edge of the triangle, z_jk, comes in here)
//   4  softmax over k: the weights
//   5  the weighted sum of the values, times the gate
//   6  four heads side by side, joined, a linear layer: the update of z_ij
//   7  the same for every pair i, j (row i for keys and values, row j for the bias); the update is added to z
//
// Checked against the supplement, Alg. 14 (TriangleAttentionStartingNode, c = 32, N_head = 4): z <- LayerNorm(z); q, k, v^h_ij = Linear(z_ij);
// b^h_ij = Linear(z_ij) (one number per head); g^h_ij = sigmoid(Linear(z_ij)); a^h_ijk = softmax_k(q^h_ij . k^h_ik / sqrt(c) + b^h_jk);
// o^h_ij = g^h_ij * sum_k a^h_ijk v^h_ik; update_ij = Linear(concat_h o^h_ij); and Alg. 17 line 4: z += DropoutRowwise(update).
// The incoming version (Alg. 15, the ending node) differs where Alg. 15 highlights it: a^h_ijk = softmax_k(q^h_ij . k^h_kj / sqrt(c) + b^h_ki) and o^h_ij = g^h_ij *
// sum_k a^h_ijk v^h_kj, so the keys and the values come from column j of z (z_kj) and the bias from column i (z_ki), instead of row i and row j; and in Alg. 11 of the
// MSA module and Alg. 17 the update is added with the dropout along the columns. The drawing is the same with the rows swapped for columns.
// Left out of the drawing: the first LayerNorm, the dropout, and the size of the vectors (3 numbers stand in for c = 32). One head is drawn
// in full and the other three are filled in. Every number is a toy: the keys, the scores and the bias are chosen so that the bias moves the
// weight from token 0 to token 2, which is what it is there to show.
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
const SEED = 6;
const LINE = 'rgba(0,0,0,.3)';
const BLUE = '#a9d8f2', CI = '#e8590c', CJ = '#3b5bdb';                          // z cells; position i and position j, as on the other slides
const A_BG = '#fff4e6', A_BAR = '#d9480f', V_BG = '#ebfbee', V_BAR = '#2f9e44', B_BG = '#edf2ff', B_BAR = '#3b5bdb', G_BG = '#fff0f6', G_BAR = '#c2255c';
const P_BAR = '#7048e8', SC_BG = '#f1f3f5', O_LIGHT = '#e5dbff', O_DEEP = '#7048e8';
const N = 5, I = 1, J = 3, C = 3, CELL = 22;                                     // five tokens; the entry z_13; three numbers stand in for a vector

// geometry, in map units (1000 x 395)
const Z = { x: 62, y: 100 }, O = { x: 850, y: 105 };
const SX = (k) => 400 + 52 * k, SW = 38, SH = 30, SB = 18, U = 28;              // the columns k, a vector cell, a one-number cell, the width of a bar of 1
const KEY_Y = 34, BIAS_Y = 76, SC_Y = 108, TOT_Y = 136, W_Y = 170, VAL_Y = 204;
const Q = [272, 34, SW, SH], G = [272, 268, SW, SH], ORAW = [485, 268, SW, SH], SLOT = [413, 268, SW, SH], RES = [557, 268, SW, SH];
const HEAD = (h) => [607 + 42 * h, 268, SW, SH];
const OUT = [[775, 283], [812, 283], [800, 138], [842, 138]];                    // the arrow from the heads to the update (a cubic)
const bez = (t) => { const u = 1 - t; return [0, 1].map((i) => u * u * u * OUT[0][i] + 3 * u * u * t * OUT[1][i] + 3 * u * t * t * OUT[2][i] + t * t * t * OUT[3][i]); };
const PATH = Array.from({ length: 11 }, (_, i) => bez(i / 10)).concat([[O.x + J * CELL + CELL / 2, 138]]);

const along = (pts, t) => {
  const sg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), tot = sg.reduce((x, y) => x + y, 0);
  let r = Math.max(0, Math.min(1, t)) * tot;
  for (let i = 0; i < sg.length; i++) {
    if (r <= sg[i] || i === sg.length - 1) { const f = sg[i] ? r / sg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }
    r -= sg[i];
  }
};

// the toy: a query, five keys, five values, a gate; the bias raises token 2 over token 0
const QV = [0.9, 0.3, 0.8], GV = [0.9, 0.5, 0.7];
const KV = [[0.9, 0.2, 0.9], [0.5, 0.6, 0.4], [0.4, 0.5, 0.5], [0.6, 0.4, 0.6], [0.3, 0.9, 0.3]];
const VV = [[0.8, 0.3, 0.5], [0.3, 0.8, 0.4], [0.5, 0.5, 0.9], [0.7, 0.4, 0.3], [0.4, 0.7, 0.6]];
const BIAS = [0.05, 0.10, 0.60, 0.10, 0.20];
const DOT = KV.map((k) => k.reduce((t, x, i) => t + x * QV[i], 0)), DM = Math.max(...DOT);
const SCORE = DOT.map((v) => (v / DM) * 0.7);                                    // query . key, scaled
const TOTAL = SCORE.map((s, k) => s + BIAS[k]);
const EXP = TOTAL.map((t) => Math.exp(3.2 * t)), W = EXP.map((v) => v / EXP.reduce((a, b) => a + b, 0)), WM = Math.max(...W);
const ORAWV = [0, 1, 2].map((ch) => VV.reduce((t, v, k) => t + W[k] * v[ch], 0));
const ORESV = ORAWV.map((v, i) => v * GV[i]);
const HEADV = [ORESV, [0.6, 0.3, 0.8], [0.3, 0.7, 0.5], [0.8, 0.6, 0.2]];

const CAPTIONS = { outgoing: [
  'We update z_ij, the edge from token i to token j. Row i of z holds the edges that leave from i, row j the edges that leave from j.',
  'z_ij gives a query and a gate. Row i gives a key and a value for every token k. Row j gives one number for every k, a bias.',
  'Compare the query with every key to get a score for each token k. Then add the bias b_jk, which brings in the third edge of the triangle, z_jk.',
  'A softmax turns the scores into weights that add up to 1: how much z_ij listens to each edge z_ik.',
  'Take the weighted sum of the values, then multiply by the gate.',
  'This runs in 4 heads side by side. Their results are joined and passed through a linear layer, which gives the update for z_ij.',
  'The same is done for every pair i, j: row i gives the keys and values, row j the bias. The result is added to z.',
], incoming: [
  'We update z_ij, the edge from token i to token j. Column j of z holds the edges that come in to j, column i the edges that come in to i.',
  'z_ij gives a query and a gate. Column j gives a key and a value for every token k. Column i gives one number for every k, a bias.',
  'Compare the query with every key to get a score for each token k. Then add the bias b_ki, which brings in the third edge of the triangle, z_ki.',
  'A softmax turns the scores into weights that add up to 1: how much z_ij listens to each edge z_kj.',
  'Take the weighted sum of the values, then multiply by the gate.',
  'This runs in 4 heads side by side. Their results are joined and passed through a linear layer, which gives the update for z_ij.',
  'The same is done for every pair i, j: column j gives the keys and values, column i the bias. The result is added to z.',
] };

const make = (mode) => (s) => ({
  steps: 7,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .ta-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .ta-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ta-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .ta-t.muted { fill: var(--muted); }
      .ta-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .ta-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .ta-cap sub { font-size: .7em; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title') || AF3.texts(s).slice().sort((a, b) => a.g.y - b.g.y)[0];
    const inc = mode === 'incoming';   // the incoming version takes columns where the outgoing one takes rows

    // ---- the toy data that is not chosen by hand ----
    const rand = rng(SEED);
    const ZV = Array.from({ length: N }, () => Array.from({ length: N }, () => rand()));
    const OV = Array.from({ length: N }, () => Array.from({ length: N }, () => 0.2 + 0.8 * rand()));

    // ---- helpers ----
    const zcol = (r, c) => shade(BLUE, (ZV[r][c] - 0.5) * 0.35);
    const ocol = (v) => lerpColor(O_LIGHT, O_DEEP, v);
    const sub2 = (str) => str.replace(/([zqkbvg])_([a-z]{2})/g, '$1<tspan dy="4" font-size="75%">$2</tspan><tspan dy="-4"></tspan>');
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="ta-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const grid = (g0, col, op) => {
      let h = '';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) h += `<rect x="${g0.x + c * CELL}" y="${g0.y + r * CELL}" width="${CELL}" height="${CELL}" fill="${col(r, c)}" stroke="${LINE}" stroke-width="1"/>`;
      return op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const arrowTo = (d, x, y, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5"/><polygon points="${x},${y} ${x - 10},${y - 5.5} ${x - 10},${y + 5.5}" fill="var(--accent)"/></g>`;
    // a cell that holds a vector (C bars), and one that holds a single number (one bar)
    const vbars = (x, y, w, h, vals, col, grow = 1) => {
      const bh = 6, gap = 2.5, y0 = y + (h - (C * bh + (C - 1) * gap)) / 2;
      return vals.map((v, i) => `<rect x="${(x + 3).toFixed(1)}" y="${(y0 + i * (bh + gap)).toFixed(1)}" width="${Math.max(1.5, v * (w - 6) * grow).toFixed(1)}" height="${bh}" rx="1.5" fill="${col}"/>`).join('');
    };
    const vcell = (r, bg, vals, col, op, grow = 1) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${rect(r[0], r[1], r[2], r[3], bg, LINE, 1)}${vbars(r[0], r[1], r[2], r[3], vals, col, grow)}</g>`;
    const sbar = (x, y, v, col, grow = 1) => `<rect x="${x.toFixed(1)}" y="${(y + (SB - 8) / 2).toFixed(1)}" width="${Math.max(1.5, v * U * grow).toFixed(1)}" height="8" rx="1.5" fill="${col}"/>`;
    const scell = (x, y, v, col, op, grow = 1) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${rect(x, y, SW, SB, SC_BG, LINE, 1)}${sbar(x + 3, y, v, col, grow)}</g>`;
    const lerpRect = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
    // a copy of a cell of z that flies to its place and turns into a projection of it
    const fly = (from, to, t, fromCol, bg, inner) => {
      if (t < 0.001) return '';
      const r = lerpRect(from, to, t), done = ramp(t, 0.75, 1);
      return rect(r[0], r[1], r[2], r[3], lerpColor(fromCol, bg, ramp(t, 0.4, 1)), LINE, 1) + (done > 0.01 ? `<g opacity="${done.toFixed(2)}">${inner(r)}</g>` : '');
    };
    const zRect = (r, c) => [Z.x + c * CELL, Z.y + r * CELL, CELL, CELL];
    const rowLabel = (y, html, op) => txt(642, y, 14, html, op, { anchor: 'start' });
    const RI = `<tspan style="fill:${CI}" font-weight="700">row i</tspan>`, RJ = `<tspan style="fill:${CJ}" font-weight="700">row j</tspan>`;
    const CLI = `<tspan style="fill:${CI}" font-weight="700">column i</tspan>`, CLJ = `<tspan style="fill:${CJ}" font-weight="700">column j</tspan>`;
    const KSRC = inc ? CLJ : RI, BSRC = inc ? CLI : RJ;                                                  // where the keys and values, and the bias, come from

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d, e = st.e, f = st.f, g = st.g;
      const sweep = ramp(g, 0.05, 0.9), nn = Math.min(N * N - 1, Math.floor(N * N * sweep));
      const sw = g > 0.02 ? [Math.floor(nn / N), nn % N] : [I, J];                                    // which row is i and which is j
      const rowOp = ramp(a, 0.5, 0.75) * (1 - ramp(g, 0.93, 1));

      // ---- z, with the entry z_ij, row i and row j ----
      h += grid(Z, (r, cc) => zcol(r, cc), ramp(a, 0, 0.3));
      const ly = (r) => Z.y + r * CELL + CELL / 2, lx = (cc) => Z.x + cc * CELL + CELL / 2;
      if (inc) {
        h += rect(Z.x + sw[0] * CELL - 1.5, Z.y - 1.5, CELL + 3, N * CELL + 3, 'none', CI, 3, rowOp);
        h += rect(Z.x + sw[1] * CELL - 1.5, Z.y - 1.5, CELL + 3, N * CELL + 3, 'none', CJ, 3, rowOp);
        h += rect(Z.x + sw[1] * CELL, Z.y + sw[0] * CELL, CELL, CELL, 'none', 'var(--accent)', 3, ramp(a, 0.3, 0.55));
        if (sw[0] === sw[1]) h += txt(lx(sw[0]), Z.y - 10, 14, 'i, j', rowOp, { bold: true });
        else h += txt(lx(sw[0]), Z.y - 10, 14, 'i', rowOp, { bold: true, fill: CI }) + txt(lx(sw[1]), Z.y - 10, 14, 'j', rowOp, { bold: true, fill: CJ });
      } else {
        h += rect(Z.x - 1.5, Z.y + sw[0] * CELL - 1.5, N * CELL + 3, CELL + 3, 'none', CI, 3, rowOp);
        h += rect(Z.x - 1.5, Z.y + sw[1] * CELL - 1.5, N * CELL + 3, CELL + 3, 'none', CJ, 3, rowOp);
        h += rect(Z.x + sw[1] * CELL, Z.y + sw[0] * CELL, CELL, CELL, 'none', 'var(--accent)', 3, ramp(a, 0.3, 0.55));
        if (sw[0] === sw[1]) h += txt(Z.x - 8, ly(sw[0]), 14, 'rows i, j', rowOp, { anchor: 'end', bold: true });
        else h += txt(Z.x - 8, ly(sw[0]), 14, 'row i', rowOp, { anchor: 'end', bold: true, fill: CI }) + txt(Z.x - 8, ly(sw[1]), 14, 'row j', rowOp, { anchor: 'end', bold: true, fill: CJ });
      }
      h += txt(Z.x + N * CELL + 8, ly(sw[0]), 15, sub2('z_ij'), ramp(a, 0.4, 0.65) * (1 - ramp(b, 0.3, 0.5) * (1 - ramp(g, 0, 0.05))), { anchor: 'start', bold: true, fill: 'var(--accent)' });
      h += txt(Z.x + (N * CELL) / 2, 226, 20, 'z', ramp(a, 0, 0.3), { bold: true }) + txt(Z.x + (N * CELL) / 2, 245, 13, 'a vector in', ramp(a, 0, 0.3), { muted: true }) + txt(Z.x + (N * CELL) / 2, 261, 13, 'every cell', ramp(a, 0, 0.3), { muted: true });

      // ---- step 2: the projections (copies of cells of z fly to their place and become a key, a value, a bias, a query, a gate) ----
      let p = '';
      const zij = zRect(I, J);
      p += fly(zij, Q, ramp(b, 0.05, 0.35), zcol(I, J), A_BG, (r) => vbars(r[0], r[1], r[2], r[3], QV, A_BAR));
      const gt = ramp(e, 0.45, 0.65);                                                                    // later, the gate moves to the front of the sum
      p += gt > 0 ? vcell(lerpRect(G, SLOT, gt), G_BG, GV, G_BAR, 1) : fly(zij, G, ramp(b, 0.05, 0.35), zcol(I, J), G_BG, (r) => vbars(r[0], r[1], r[2], r[3], GV, G_BAR));
      for (let k = 0; k < N; k++) {
        const kv = inc ? [k, J] : [I, k], bs = inc ? [k, I] : [J, k];                                       // where the keys and values, and the bias, come from in z
        p += fly(zRect(kv[0], kv[1]), [SX(k) - SW / 2, KEY_Y, SW, SH], ramp(b, 0.1 + 0.06 * k, 0.4 + 0.06 * k), zcol(kv[0], kv[1]), A_BG, (r) => vbars(r[0], r[1], r[2], r[3], KV[k], A_BAR));
        p += fly(zRect(kv[0], kv[1]), [SX(k) - SW / 2, VAL_Y, SW, SH], ramp(b, 0.25 + 0.06 * k, 0.55 + 0.06 * k), zcol(kv[0], kv[1]), V_BG, (r) => vbars(r[0], r[1], r[2], r[3], VV[k], V_BAR));
        p += fly(zRect(bs[0], bs[1]), [SX(k) - SW / 2, BIAS_Y, SW, SB], ramp(b, 0.4 + 0.05 * k, 0.7 + 0.05 * k), zcol(bs[0], bs[1]), SC_BG, (r) => sbar(r[0] + 3, r[1], BIAS[k], B_BAR));
        p += txt(SX(k), 20, 13, String(k), ramp(b, 0.1, 0.3), { muted: true });
      }
      p += txt(380, 20, 13, 'k', ramp(b, 0.1, 0.3), { muted: true, anchor: 'end' });
      p += txt(266, Q[1] + SH / 2, 15, sub2('q_ij'), ramp(b, 0.3, 0.5), { anchor: 'end', bold: true }) + txt(Q[0] + SW / 2, 76, 13, 'query', ramp(b, 0.35, 0.55), { muted: true });
      p += txt(266, G[1] + SH / 2, 15, sub2('g_ij'), ramp(b, 0.3, 0.5) * (1 - ramp(e, 0.45, 0.55)), { anchor: 'end', bold: true }) + txt(G[0] + SW / 2, 310, 13, 'gate', ramp(b, 0.35, 0.55) * (1 - ramp(e, 0.45, 0.55)), { muted: true });
      p += rowLabel(KEY_Y + SH / 2, `keys, from ${KSRC}`, ramp(b, 0.15, 0.35)) + rowLabel(BIAS_Y + SB / 2, `bias, from ${BSRC}`, ramp(b, 0.45, 0.65)) + rowLabel(VAL_Y + SH / 2, `values, from ${KSRC}`, ramp(b, 0.3, 0.5));

      // ---- step 3: the scores, then the bias is added ----
      for (let k = 0; k < N; k++) {
        const t0 = 0.05 + 0.1 * k, pulse = ramp(c, t0, t0 + 0.04) * (1 - ramp(c, t0 + 0.07, t0 + 0.11));
        p += rect(Q[0] - 2, Q[1] - 2, SW + 4, SH + 4, 'none', 'var(--accent)', 3, pulse) + rect(SX(k) - SW / 2 - 2, KEY_Y - 2, SW + 4, SH + 4, 'none', 'var(--accent)', 3, pulse);
        p += scell(SX(k) - SW / 2, SC_Y, SCORE[k], A_BAR, ramp(c, t0, t0 + 0.06), ramp(c, t0, t0 + 0.12));
      }
      const totOp = ramp(c, 0.56, 0.64);
      for (let k = 0; k < N; k++) {
        const x0 = SX(k) - SW / 2, tb = ramp(c, 0.62 + 0.04 * k, 0.8 + 0.04 * k);
        p += scell(x0, TOT_Y, SCORE[k], A_BAR, totOp);
        if (tb > 0.001) p += `<rect x="${lerp(x0 + 3, x0 + 3 + SCORE[k] * U, tb).toFixed(1)}" y="${(lerp(BIAS_Y, TOT_Y, tb) + (SB - 8) / 2).toFixed(1)}" width="${(BIAS[k] * U).toFixed(1)}" height="8" rx="1.5" fill="${B_BAR}"/>`;
      }
      p += rowLabel(SC_Y + SB / 2, 'query · key', ramp(c, 0.05, 0.2)) + rowLabel(TOT_Y + SB / 2, 'score + bias', ramp(c, 0.62, 0.78));
      p += txt(380, TOT_Y + SB / 2, 18, '+', totOp, { anchor: 'end' });

      // ---- step 4: softmax ----
      for (let k = 0; k < N; k++) p += scell(SX(k) - SW / 2, W_Y, W[k] / WM, P_BAR, ramp(d, 0.05 + 0.1 * k, 0.15 + 0.1 * k), ramp(d, 0.05 + 0.1 * k, 0.25 + 0.1 * k));
      p += rowLabel(W_Y + SB / 2, 'softmax: weights', ramp(d, 0.05, 0.25));

      // ---- step 5: the weighted sum of the values, times the gate ----
      for (let k = 0; k < N; k++) {
        const wid = 1 + 8 * (W[k] / WM);
        p += `<g opacity="${ramp(e, 0.05, 0.25).toFixed(2)}"><path d="M${SX(k)} ${VAL_Y + SH + 1} L${ORAW[0] + SW / 2} ${ORAW[1] - 2}" stroke="var(--accent)" stroke-width="${wid.toFixed(1)}" stroke-linecap="round"/></g>`;
      }
      p += vcell(ORAW, V_BG, ORAWV, V_BAR, ramp(e, 0.25, 0.4), ramp(e, 0.3, 0.45)) + txt(ORAW[0] + SW / 2, 310, 13, 'weighted sum', ramp(e, 0.3, 0.45), { muted: true });
      // the product of the sum and the gate is the result for this head
      p += txt(468, 283, 22, '×', ramp(e, 0.55, 0.65)) + txt(540, 283, 22, '=', ramp(e, 0.7, 0.8));
      const headMove = ramp(f, 0, 0.2);
      p += vcell(lerpRect(RES, HEAD(0), headMove), V_BG, ORESV, V_BAR, ramp(e, 0.72, 0.9), 1) + txt(RES[0] + SW / 2, 310, 13, 'one head', ramp(e, 0.78, 0.9) * (1 - ramp(f, 0, 0.1)), { muted: true });

      // ---- step 6: four heads, joined, a linear layer ----
      for (let hh = 1; hh < 4; hh++) p += vcell(HEAD(hh), V_BG, HEADV[hh], V_BAR, ramp(f, 0.12 + 0.06 * hh, 0.3 + 0.06 * hh));
      for (let hh = 0; hh < 4; hh++) p += txt(HEAD(hh)[0] + SW / 2, 310, 13, String(hh + 1), ramp(f, 0.25, 0.4), { muted: true });
      p += txt(HEAD(1)[0] + SW + 4, 327, 13, 'the 4 heads', ramp(f, 0.25, 0.4), { muted: true });
      p += arrowTo(`M${OUT[0][0]} ${OUT[0][1]} C ${OUT[1][0]} ${OUT[1][1]}, ${OUT[2][0]} ${OUT[2][1]}, ${OUT[3][0]} ${OUT[3][1]}`, O.x - 2, 138, ramp(f, 0.3, 0.45));
      p += txt(826, 318, 13.5, 'join the heads,', ramp(f, 0.35, 0.5), { muted: true }) + txt(826, 334, 13.5, 'then a linear layer', ramp(f, 0.4, 0.55), { muted: true });
      h += `<g opacity="${(1 - 0.7 * ramp(g, 0, 0.1)).toFixed(2)}">${p}</g>`;

      // ---- the update: empty, then z_ij, then every entry in turn ----
      const ou = ramp(f, 0.3, 0.45);
      h += grid(O, (r, cc) => {
        const fill = r === I && cc === J ? ramp(f, 0.78, 0.9) : ramp(g, 0.08 + (0.7 * (r * N + cc)) / (N * N), 0.15 + (0.7 * (r * N + cc)) / (N * N));
        return fill < 0.02 ? 'var(--bg)' : lerpColor('#ffffff', ocol(OV[r][cc]), fill);
      }, ou);
      h += rect(O.x + J * CELL, O.y + I * CELL, CELL, CELL, 'none', 'var(--accent)', 3, ramp(f, 0.45, 0.55) * (1 - ramp(g, 0.04, 0.1)));
      if (g > 0.04 && g < 0.97) h += rect(O.x + sw[1] * CELL, O.y + sw[0] * CELL, CELL, CELL, 'none', 'var(--accent)', 3, 1);
      h += txt(O.x + (N * CELL) / 2, 228, 16, 'the update', ou, { bold: true }) + txt(O.x + (N * CELL) / 2, 247, 13, 'added to z', ramp(g, 0.9, 1), { muted: true });
      const tr = ramp(f, 0.5, 0.78);
      if (tr > 0 && tr < 1) { const [qx, qy] = along(PATH, tr); h += rect(qx - CELL / 2, qy - CELL / 2, CELL, CELL, ocol(OV[I][J]), LINE, 1); }
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="ta-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Triangular attention around the ${inc ? 'ending' : 'starting'} node: for the entry z_ij, a query from z_ij is compared with a key for every token k from ${inc ? 'column j' : 'row i'}, a bias from ${inc ? 'column i' : 'row j'} is added, a softmax gives weights, the values from ${inc ? 'column j' : 'row i'} are summed with those weights and multiplied by a gate; four heads are joined and projected to the update of z_ij; the same is done for every pair i, j"></svg></div>
      <div class="ta-caps">${CAPTIONS[mode].map((t, i) => `<p class="ta-cap reveal-in" data-show="${i + 1}">${esc(t).replace(/([zqkbvg])_([a-z]{2})/g, '$1<sub>$2</sub>')}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;
    const svg = frame.querySelector('svg');

    const KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 2600, 6500, 7500, 5500, 6500, 7000, 9500][step], t0 = performance.now();
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
AF3.kinds.trattn = make('outgoing');
AF3.kinds.trattnin = make('incoming');
}
