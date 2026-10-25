// "Attention with Pair Bias at token level" (slide 41): the figure of the original (Simon, The Illustrated AlphaFold: a query, keys, values,
// a bias and a gate are projected; query against keys plus the bias, softmax, weighted sum of the values, times the gate; the heads joined
// and projected) redrawn natively and played a click at a time, for one token i first and then for all of them. It is the same recipe as
// the triangle attention on the slide before, with tokens in place of the edges of a row, and z giving the bias:
//
//   1  token i of s; row i of z holds a vector for each pair (i, j)
//   2  projections: s_i gives a query and a gate; every token j gives a key and a value; row i of z gives one number per j, a bias
//   3  scores: the query against every key, then the bias b_ij added
//   4  softmax over j: the weights
//   5  the weighted sum of the values, times the gate
//   6  sixteen heads side by side, joined, a linear layer: the update of token i
//   7  the same for every token i (row i of z as the bias each time); the update is added to s
//
// Checked against the supplement, Alg. 24 (AttentionPairBias): q^h_i = Linear(a_i); k^h_i, v^h_i = LinearNoBias(a_i); b^h_ij =
// LinearNoBias(LayerNorm(z_ij)) + beta_ij (beta = 0 here); g^h_i = sigmoid(LinearNoBias(a_i)); A^h_ij = softmax_j(q^h_i . k^h_j / sqrt(c) + b^h_ij);
// out_i = LinearNoBias(concat_h (g^h_i * sum_j A^h_ij v^h_j)); and Alg. 17 line 7: s += AttentionPairBias(s, none, z, beta = 0, N_head = 16).
// Left out of the drawing: the first LayerNorm and the size of the vectors (3 numbers stand in for c). One head is drawn in full and the others
// are filled in. Every number is a toy: the keys, the scores and the bias are chosen so that the bias moves the weight from token 0 to token 2.
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
const SEED = 7;
const LINE = 'rgba(0,0,0,.3)';
const BLUE = '#a9d8f2', VIOLET = '#e0bff0', CI = '#e8590c';                      // z cells; s cells; token i, as on the other slides
const A_BG = '#fff4e6', A_BAR = '#d9480f', V_BG = '#ebfbee', V_BAR = '#2f9e44', B_BG = '#edf2ff', B_BAR = '#3b5bdb', G_BG = '#fff0f6', G_BAR = '#c2255c';
const P_BAR = '#7048e8', SC_BG = '#f1f3f5', O_LIGHT = '#f3e5fb', O_DEEP = '#9c36b5';
const N = 5, I = 1, C = 3, CELL = 22;                                            // five tokens; token i is the second; three numbers stand in for a vector

// geometry, in map units (1000 x 395)
const S = { x: 62, y: 38 }, Z = { x: 62, y: 112 }, U_ = { x: 850, y: 130 };     // the strip s, the grid z, the update (a strip of vector cells)
const SH_S = 30;                                                                  // height of a cell of s and of the update
const SX = (k) => 400 + 52 * k, SW = 38, SH = 30, SB = 18, U = 28;              // the columns j, a vector cell, a one-number cell, the width of a bar of 1
const KEY_Y = 34, BIAS_Y = 76, SC_Y = 108, TOT_Y = 136, W_Y = 170, VAL_Y = 204;
const Q = [272, 34, SW, SH], G = [272, 268, SW, SH], ORAW = [485, 268, SW, SH], SLOT = [413, 268, SW, SH], RES = [557, 268, SW, SH];
const HEAD = (h) => [[607, 268, SW, SH], [649, 268, SW, SH], null, [733, 268, SW, SH]][h];   // heads 1, 2 and 16 (three dots stand for the rest)
const OUT = [[775, 283], [812, 283], [800, 145], [842, 145]];                    // the arrow from the heads to the update (a cubic)
const bez = (t) => { const u = 1 - t; return [0, 1].map((i) => u * u * u * OUT[0][i] + 3 * u * u * t * OUT[1][i] + 3 * u * t * t * OUT[2][i] + t * t * t * OUT[3][i]); };
const PATH = Array.from({ length: 11 }, (_, i) => bez(i / 10)).concat([[U_.x + I * CELL + CELL / 2, 145]]);

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
const HEADV = [ORESV, [0.6, 0.3, 0.8], null, [0.8, 0.6, 0.2]];

const CAPTIONS = [
  'We update token i in s. Row i of z holds a vector for each pair of token i with a token j.',
  's_i gives a query and a gate. Every token j gives a key and a value. Row i of z gives one number for every j, a bias.',
  'Compare the query with every key to get a score for each token j. Then add the bias b_ij from z_ij: this is where z steers s.',
  'A softmax turns the scores into weights that add up to 1: how much token i looks at each token j.',
  'Take the weighted sum of the values, then multiply by the gate.',
  'This runs in 16 heads side by side. Their results are joined and passed through a linear layer, which gives the update for token i.',
  'The same is done for every token i, each time with row i of z as the bias. The result is added to s.',
];

AF3.kinds.pairbias = (s) => ({
  steps: 7,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .pb-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .pb-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .pb-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .pb-t.muted { fill: var(--muted); }
      .pb-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .pb-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .pb-cap sub { font-size: .7em; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // ---- the toy data that is not chosen by hand ----
    const rand = rng(SEED);
    const ZV = Array.from({ length: N }, () => Array.from({ length: N }, () => rand()));
    const SV = Array.from({ length: N }, () => rand());

    // ---- helpers ----
    const zcol = (r, c) => shade(BLUE, (ZV[r][c] - 0.5) * 0.35);
    const scol = (k) => shade(VIOLET, (SV[k] - 0.5) * 0.35);
    const ocol = (v) => lerpColor(O_LIGHT, O_DEEP, v);
    const sub2 = (str) => str.replace(/([zqkbvgs])_([a-z]{1,2})/g, '$1<tspan dy="4" font-size="75%">$2</tspan><tspan dy="-4"></tspan>');
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="pb-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const grid = (g0, col, op) => {
      let h = '';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) h += `<rect x="${g0.x + c * CELL}" y="${g0.y + r * CELL}" width="${CELL}" height="${CELL}" fill="${col(r, c)}" stroke="${LINE}" stroke-width="1"/>`;
      return op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const strip = (g0, col, op) => {
      let h = '';
      for (let c = 0; c < N; c++) h += `<rect x="${g0.x + c * CELL}" y="${g0.y}" width="${CELL}" height="${SH_S}" fill="${col(c)}" stroke="${LINE}" stroke-width="1"/>`;
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
    // a copy of a cell of s or z that flies to its place and turns into a projection of it
    const fly = (from, to, t, fromCol, bg, inner) => {
      if (t < 0.001) return '';
      const r = lerpRect(from, to, t), done = ramp(t, 0.75, 1);
      return rect(r[0], r[1], r[2], r[3], lerpColor(fromCol, bg, ramp(t, 0.4, 1)), LINE, 1) + (done > 0.01 ? `<g opacity="${done.toFixed(2)}">${inner(r)}</g>` : '');
    };
    const sRect = (k) => [S.x + k * CELL, S.y, CELL, SH_S];
    const zRect = (r, c) => [Z.x + c * CELL, Z.y + r * CELL, CELL, CELL];
    const rowLabel = (y, html, op) => txt(642, y, 14, html, op, { anchor: 'start' });
    const RI = `<tspan style="fill:${CI}" font-weight="700">row i</tspan>`;

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d, e = st.e, f = st.f, g = st.g;
      const sweep = ramp(g, 0.05, 0.9), nn = Math.min(N - 1, Math.floor(N * sweep));
      const ti = g > 0.02 ? nn : I;                                                                    // which token is i
      const rowOp = ramp(a, 0.5, 0.75) * (1 - ramp(g, 0.93, 1));

      // ---- s and z, with token i and row i ----
      h += strip(S, scol, ramp(a, 0, 0.3)) + grid(Z, (r, cc) => zcol(r, cc), ramp(a, 0, 0.3));
      h += rect(S.x + ti * CELL - 1.5, S.y - 1.5, CELL + 3, SH_S + 3, 'none', CI, 3, rowOp);
      h += rect(Z.x - 1.5, Z.y + ti * CELL - 1.5, N * CELL + 3, CELL + 3, 'none', CI, 3, rowOp);
      h += txt(S.x - 8, S.y + SH_S / 2, 14, 'token i', rowOp, { anchor: 'end', bold: true, fill: CI }) + txt(Z.x - 8, Z.y + ti * CELL + CELL / 2, 14, 'row i', rowOp, { anchor: 'end', bold: true, fill: CI });
      h += txt(Z.x + N * CELL + 8, Z.y + ti * CELL + CELL / 2, 15, sub2('z_ij'), ramp(a, 0.4, 0.65) * (1 - ramp(b, 0.3, 0.5) * (1 - ramp(g, 0, 0.05))), { anchor: 'start', bold: true, fill: 'var(--accent)' });
      h += txt(S.x + (N * CELL) / 2, 20, 20, 's', ramp(a, 0, 0.3), { bold: true }) + txt(S.x + (N * CELL) / 2, 84, 13, 'a vector per token', ramp(a, 0, 0.3), { muted: true });
      h += txt(Z.x + (N * CELL) / 2, 240, 20, 'z', ramp(a, 0, 0.3), { bold: true }) + txt(Z.x + (N * CELL) / 2, 259, 13, 'a vector for', ramp(a, 0, 0.3), { muted: true }) + txt(Z.x + (N * CELL) / 2, 275, 13, 'each pair', ramp(a, 0, 0.3), { muted: true });

      // ---- step 2: the projections (copies of cells fly to their place and become a key, a value, a bias, a query, a gate) ----
      let p = '';
      const gt = ramp(e, 0.45, 0.65);                                                                    // later, the gate moves to the front of the sum
      p += fly(sRect(I), Q, ramp(b, 0.05, 0.35), scol(I), A_BG, (r) => vbars(r[0], r[1], r[2], r[3], QV, A_BAR));
      p += gt > 0 ? vcell(lerpRect(G, SLOT, gt), G_BG, GV, G_BAR, 1) : fly(sRect(I), G, ramp(b, 0.05, 0.35), scol(I), G_BG, (r) => vbars(r[0], r[1], r[2], r[3], GV, G_BAR));
      for (let k = 0; k < N; k++) {
        p += fly(sRect(k), [SX(k) - SW / 2, KEY_Y, SW, SH], ramp(b, 0.1 + 0.06 * k, 0.4 + 0.06 * k), scol(k), A_BG, (r) => vbars(r[0], r[1], r[2], r[3], KV[k], A_BAR));
        p += fly(sRect(k), [SX(k) - SW / 2, VAL_Y, SW, SH], ramp(b, 0.25 + 0.06 * k, 0.55 + 0.06 * k), scol(k), V_BG, (r) => vbars(r[0], r[1], r[2], r[3], VV[k], V_BAR));
        p += fly(zRect(I, k), [SX(k) - SW / 2, BIAS_Y, SW, SB], ramp(b, 0.4 + 0.05 * k, 0.7 + 0.05 * k), zcol(I, k), SC_BG, (r) => sbar(r[0] + 3, r[1], BIAS[k], B_BAR));
        p += txt(SX(k), 20, 13, String(k), ramp(b, 0.1, 0.3), { muted: true });
      }
      p += txt(380, 20, 13, 'j', ramp(b, 0.1, 0.3), { muted: true, anchor: 'end' });
      p += txt(266, Q[1] + SH / 2, 15, sub2('q_i'), ramp(b, 0.3, 0.5), { anchor: 'end', bold: true }) + txt(Q[0] + SW / 2, 76, 13, 'query', ramp(b, 0.35, 0.55), { muted: true });
      p += txt(266, G[1] + SH / 2, 15, sub2('g_i'), ramp(b, 0.3, 0.5) * (1 - ramp(e, 0.45, 0.55)), { anchor: 'end', bold: true }) + txt(G[0] + SW / 2, 310, 13, 'gate', ramp(b, 0.35, 0.55) * (1 - ramp(e, 0.45, 0.55)), { muted: true });
      p += rowLabel(KEY_Y + SH / 2, 'keys, from s', ramp(b, 0.15, 0.35)) + rowLabel(BIAS_Y + SB / 2, `bias, from ${RI} of z`, ramp(b, 0.45, 0.65)) + rowLabel(VAL_Y + SH / 2, 'values, from s', ramp(b, 0.3, 0.5));

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
      p += txt(468, 283, 22, '×', ramp(e, 0.55, 0.65)) + txt(540, 283, 22, '=', ramp(e, 0.7, 0.8));
      const headMove = ramp(f, 0, 0.2);
      p += vcell(lerpRect(RES, HEAD(0), headMove), V_BG, ORESV, V_BAR, ramp(e, 0.72, 0.9), 1) + txt(RES[0] + SW / 2, 310, 13, 'one head', ramp(e, 0.78, 0.9) * (1 - ramp(f, 0, 0.1)), { muted: true });

      // ---- step 6: sixteen heads (three are drawn), joined, a linear layer ----
      for (const hh of [1, 3]) p += vcell(HEAD(hh), V_BG, HEADV[hh], V_BAR, ramp(f, 0.12 + 0.06 * hh, 0.3 + 0.06 * hh));
      p += txt(710, 283, 20, '···', ramp(f, 0.2, 0.35), { muted: true });
      for (const [hh, lab] of [[0, '1'], [1, '2'], [3, '16']]) p += txt(HEAD(hh)[0] + SW / 2, 310, 13, lab, ramp(f, 0.25, 0.4), { muted: true });
      p += txt(689, 327, 13, 'the 16 heads', ramp(f, 0.25, 0.4), { muted: true });
      p += arrowTo(`M${OUT[0][0]} ${OUT[0][1]} C ${OUT[1][0]} ${OUT[1][1]}, ${OUT[2][0]} ${OUT[2][1]}, ${OUT[3][0]} ${OUT[3][1]}`, U_.x - 2, 145, ramp(f, 0.3, 0.45));
      p += txt(826, 318, 13.5, 'join the heads,', ramp(f, 0.35, 0.5), { muted: true }) + txt(826, 334, 13.5, 'then a linear layer', ramp(f, 0.4, 0.55), { muted: true });
      h += `<g opacity="${(1 - 0.7 * ramp(g, 0, 0.1)).toFixed(2)}">${p}</g>`;

      // ---- the update: empty, then token i, then every token in turn ----
      const ou = ramp(f, 0.3, 0.45);
      h += strip(U_, (cc) => {
        const fill = cc === I ? ramp(f, 0.78, 0.9) : ramp(g, 0.08 + (0.7 * cc) / N, 0.2 + (0.7 * cc) / N);
        return fill < 0.02 ? 'var(--bg)' : lerpColor('#ffffff', ocol(0.3 + 0.7 * ((cc * 0.37 + 0.2) % 1)), fill);
      }, ou);
      h += rect(U_.x + I * CELL, U_.y, CELL, SH_S, 'none', 'var(--accent)', 3, ramp(f, 0.45, 0.55) * (1 - ramp(g, 0.04, 0.1)));
      if (g > 0.04 && g < 0.97) h += rect(U_.x + ti * CELL, U_.y, CELL, SH_S, 'none', 'var(--accent)', 3, 1);
      h += txt(U_.x + (N * CELL) / 2, 182, 16, 'the update', ou, { bold: true }) + txt(U_.x + (N * CELL) / 2, 201, 13, 'added to s', ramp(g, 0.9, 1), { muted: true });
      const tr = ramp(f, 0.5, 0.78);
      if (tr > 0 && tr < 1) { const [qx, qy] = along(PATH, tr); h += rect(qx - CELL / 2, qy - SH_S / 2, CELL, SH_S, ocol(0.3 + 0.7 * ((I * 0.37 + 0.2) % 1)), LINE, 1); }
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="pb-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Attention with pair bias: for token i, a query from s_i is compared with a key for every token j, a bias from row i of z is added, a softmax gives weights, the values are summed with those weights and multiplied by a gate; sixteen heads are joined and projected to the update of token i; the same is done for every token i"></svg></div>
      <div class="pb-caps">${CAPTIONS.map((t, i) => `<p class="pb-cap reveal-in" data-show="${i + 1}">${esc(t).replace(/([zqkbvgs])_([a-z]{1,2})/g, '$1<sub>$2</sub>')}</p>`).join('')}</div>
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
        const ms = [0, 2600, 6500, 7500, 5500, 6500, 7000, 7500][step], t0 = performance.now();
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
