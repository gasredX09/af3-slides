// "Pair-Weighted Averaging" (appendix, slide 69): the figure of the original (Simon, The Illustrated AlphaFold: "MSA row-wise gated self-attention using only pair
// bias": row i of z gives the attention weights, m gives values and gates, every sequence of m is averaged with the same weights, the heads are joined and a linear
// layer gives the update of m) redrawn natively and played a click at a time, for one position i first and then for all of them:
//
//   1  z and m; position i is the one we update: row i of z, and position i in every sequence of m
//   2  row i of z gives one number for every position j (per head); a softmax turns them into weights that add up to 1; nothing from m is used for the weights
//   3  m is projected into values v (a vector per position per sequence) and into gates g (numbers between 0 and 1)
//   4  in every sequence the values are added up with the same weights, then multiplied by the gate
//   5  eight heads, each with its own weights from z, are joined and a linear layer gives the update for position i in every sequence
//   6  the same for every position i (row i of z each time); the update is added to m
//
// Checked against the supplement, Alg. 10 (MSAPairWeightedAveraging, c = 32, N_head = 8; the MSA module calls it with c = 8): m_si <- LayerNorm(m_si);
// v^h_si = LinearNoBias(m_si); b^h_ij = LinearNoBias(LayerNorm(z_ij)); g^h_si = sigmoid(LinearNoBias(m_si)); w^h_ij = softmax_j(b^h_ij); o^h_si = g^h_si *
// sum_j w^h_ij v^h_sj; m~_si = LinearNoBias(concat_h(o^h_si)); and Alg. 8 line 7: m += DropoutRowwise(PairWeightedAveraging(m, z)), once per block (4 blocks).
// Methods 3.3: "we do not combine information across different rows of the MSA directly ... all information has to flow via the pair representation": the
// weights do not depend on m, and each sequence is averaged along its own row only. Left out of the drawing: the first LayerNorms, the dropout and the size of the
// vectors (3 numbers stand in for c; 4 sequences and 5 positions for the MSA). One head is drawn in full and the other seven are filled in. Every number is a toy
// (seed 9); the scores of row i are chosen so that position 3 gets the most weight, which is what the softmax is there to show.
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
const SEED = 9;
const LINE = 'rgba(0,0,0,.3)';
const BLUE = '#a9d8f2', CI = '#e8590c', CJ = '#3b5bdb';
const M_BG = '#fdebd3', M_BAR = '#e07a2a', V_BG = '#ebfbee', V_BAR = '#2f9e44', G_BG = '#fff0f6', G_BAR = '#c2255c', P_BAR = '#7048e8', S_BG = '#f3f0ff', S_BAR = '#5f3dc4';
const U_LIGHT = '#fde5c8', U_DEEP = '#e07a2a';
const NS = 4, NP = 5, I = 1, C = 3, N = 5, CELL = 22, VC = 34, NH = 8;               // 4 sequences, 5 positions; position 1 is the one we update; 3 numbers for a vector; 8 heads

// geometry, in map units (1000 x 395)
const Z0 = { x: 24, y: 40 }, M0 = { x: 24, y: 222 }, V0 = { x: 232, y: 178 }, OUT0 = { x: 800, y: 178 };
const XJ = (j) => V0.x + VC * j + VC / 2, YS = (s) => V0.y + VC * s;                   // the column of position j, the row of sequence s
const WB = 146, WS = 120;                                                              // the baseline of the weight bars, and how tall a weight of 1 would be
const SX = 432, GX = 484, OX = 536, CW = 28, HX = (h) => 536 + h * 17, UX = 748;      // the sum, the gate, the head, the update columns
const BSC = [-0.2, 0.9, 0.1, 1.6, -0.5];                                               // the scores of row i, one for each position j
const EXPS = BSC.map(Math.exp), WSUM = EXPS.reduce((a, b) => a + b, 0), W = EXPS.map((v) => v / WSUM);

const CAPTIONS = [
  'm keeps one vector for every position in every sequence. Position i in every sequence will be replaced by a weighted average of the positions in its own sequence, and z decides the weights.',
  'Row i of z gives one number for every position j (for each head): how much position i should listen to position j. A softmax turns them into weights that add up to 1. Nothing from m is used here.',
  'm is projected into values v, a vector for every position in every sequence, and into gates g: numbers between 0 and 1 that can switch parts of a vector off.',
  'In each sequence, add up the values along its row with these weights. The weights are the same for every sequence. Then multiply by the gate.',
  'This runs in 8 heads, each with its own weights from z. The heads are joined and a linear layer gives the update for position i in every sequence.',
  'The same is done for every position i, each time with row i of z giving the weights. The result is added to m.',
];

AF3.kinds.pwa = (s) => ({
  steps: 6,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .pw-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .pw-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .pw-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .pw-t.muted { fill: var(--muted); }
      .pw-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .pw-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .pw-cap sub { font-size: .7em; }
    `);
    const heading = AF3.apTitle(s);

    // ---- the toy data ----
    const rand = rng(SEED);
    const vec = (lo, hi) => Array.from({ length: C }, () => lo + (hi - lo) * rand());
    const MV = Array.from({ length: NS }, () => Array.from({ length: NP }, () => vec(0.15, 0.95)));
    const VV = Array.from({ length: NS }, () => Array.from({ length: NP }, () => vec(0.15, 0.95)));
    const GV = Array.from({ length: NS }, () => vec(0.25, 1));
    const SUMV = Array.from({ length: NS }, (_, sq) => Array.from({ length: C }, (_, ch) => VV[sq].reduce((t, v, j) => t + W[j] * v[ch], 0)));
    const OV1 = SUMV.map((v, sq) => v.map((x, ch) => x * GV[sq][ch]));
    const HEADS = [OV1].concat(Array.from({ length: NH - 1 }, () => Array.from({ length: NS }, () => vec(0.2, 0.95))));
    const UPD = Array.from({ length: NS }, () => 0.3 + 0.7 * rand());
    const ZV = Array.from({ length: N }, () => Array.from({ length: N }, () => rand()));
    const OV = Array.from({ length: NS }, () => Array.from({ length: NP }, () => 0.2 + 0.8 * rand()));

    // ---- helpers ----
    const zcol = (r, c) => shade(BLUE, (ZV[r][c] - 0.5) * 0.35);
    const ucol = (v) => lerpColor(U_LIGHT, U_DEEP, v);
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="pw-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const bars = (x, y, w, h, vals, col, grow = 1) => {
      const bh = Math.min(6, (h - 4) / C - 1.5), gap = 2, y0 = y + (h - (C * bh + (C - 1) * gap)) / 2;
      return vals.map((v, i) => `<rect x="${(x + 3).toFixed(1)}" y="${(y0 + i * (bh + gap)).toFixed(1)}" width="${Math.max(1.5, v * (w - 6) * grow).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" fill="${col}"/>`).join('');
    };
    const vcell = (x, y, w, h, bg, vals, col, op, grow = 1) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${rect(x, y, w, h, bg, LINE, 1)}${bars(x, y, w, h, vals, col, grow)}</g>`;
    const grid = (g0, rows, cols, size, col, op) => {
      if (op < 0.01) return '';
      let h = '';
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) h += `<rect x="${g0.x + c * size}" y="${g0.y + r * size}" width="${size}" height="${size}" fill="${col(r, c)}" stroke="${LINE}" stroke-width="1"/>`;
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const mgrid = (g0, op) => {   // m: a vector in every cell
      if (op < 0.01) return '';
      let h = '';
      for (let r = 0; r < NS; r++) for (let c = 0; c < NP; c++) h += `<rect x="${g0.x + c * CELL}" y="${g0.y + r * CELL}" width="${CELL}" height="${CELL}" fill="${M_BG}" stroke="${LINE}" stroke-width="1"/>` + bars(g0.x + c * CELL, g0.y + r * CELL, CELL, CELL, MV[r][c], M_BAR);
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const arrowTo = (d, x, y, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5"/><polygon points="${x},${y} ${x - 10},${y - 5.5} ${x - 10},${y + 5.5}" fill="var(--accent)"/></g>`;
    const pulse = (a, b, e) => ramp(a, b, b + 0.04) * (1 - ramp(a, e, e + 0.04));

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d, e = st.e, f = st.f;
      const sweep = ramp(f, 0.05, 0.9), nn = Math.min(NP - 1, Math.floor(NP * sweep));
      const pi = f > 0.02 ? nn : I;                                                         // the position being updated while every position is done
      const dimmed = 1 - 0.7 * ramp(f, 0, 0.1);

      // ---- step 1: z and m, position i ----
      h += grid(Z0, N, N, CELL, (r, cc) => zcol(r, cc), ramp(a, 0, 0.3));
      h += rect(Z0.x - 1.5, Z0.y + pi * CELL - 1.5, N * CELL + 3, CELL + 3, 'none', CI, 3, ramp(a, 0.4, 0.65));
      h += txt(Z0.x + (N * CELL) / 2, Z0.y + N * CELL + 18, 20, 'z', ramp(a, 0, 0.3), { bold: true });
      h += txt(Z0.x - 6, Z0.y + pi * CELL + CELL / 2, 14, 'row i', ramp(a, 0.45, 0.7), { anchor: 'end', bold: true, fill: CI });
      h += mgrid(M0, ramp(a, 0, 0.3));
      h += rect(M0.x + pi * CELL - 1.5, M0.y - 1.5, CELL + 3, NS * CELL + 3, 'none', CI, 3, ramp(a, 0.5, 0.75));
      h += txt(M0.x + (NP * CELL) / 2, M0.y + NS * CELL + 18, 20, 'm', ramp(a, 0, 0.3), { bold: true }) + txt(M0.x + (NP * CELL) / 2, M0.y + NS * CELL + 36, 13, 'a vector in every cell', ramp(a, 0, 0.3), { muted: true });
      h += txt(M0.x + pi * CELL + CELL / 2, M0.y - 9, 13, 'i', ramp(a, 0.5, 0.75), { bold: true, fill: CI });

      // ---- step 2: the scores from row i, then the weights ----
      let p = '';
      const z2 = ramp(b, 0, 0.3);
      p += arrowTo(`M${Z0.x + N * CELL + 6} ${Z0.y + I * CELL + CELL / 2} C 170 ${Z0.y + I * CELL + CELL / 2}, 170 100, ${V0.x - 14} 100`, V0.x - 6, 100, z2);
      const sc = ramp(b, 0.25, 0.5) * (1 - ramp(b, 0.62, 0.78));                            // the raw scores, before the softmax
      for (let j = 0; j < NP; j++) p += txt(XJ(j), 86, 13, BSC[j].toFixed(1), sc, { bold: true });
      p += txt(V0.x - 10, 86, 13, 'scores', sc, { anchor: 'end', muted: true });
      const sm = ramp(b, 0.6, 0.95);                                                        // the softmax: the bars grow, the numbers follow
      for (let j = 0; j < NP; j++) {
        const bh = W[j] * WS * sm;
        p += rect(XJ(j) - 10, WB - bh, 20, bh, P_BAR, 'none', 0, ramp(b, 0.6, 0.75), 2) + txt(XJ(j), WB - bh - 9, 13, W[j].toFixed(2), ramp(b, 0.8, 1), { bold: true });
      }
      p += `<g opacity="${ramp(b, 0.6, 0.8).toFixed(2)}"><path d="M${V0.x} ${WB + 2} H${V0.x + NP * VC}" stroke="var(--muted)" stroke-width="1.4"/></g>`;
      p += txt(V0.x + NP * VC + 12, WB - 38, 13, 'softmax: the', ramp(b, 0.7, 0.9), { anchor: 'start', muted: true }) + txt(V0.x + NP * VC + 12, WB - 22, 13, 'weights of row i', ramp(b, 0.7, 0.9), { anchor: 'start', muted: true });
      for (let j = 0; j < NP; j++) p += txt(XJ(j), V0.y - 6, 13, String(j), ramp(b, 0.5, 0.8), { muted: true });
      p += txt(V0.x - 10, V0.y - 6, 13, 'j', ramp(b, 0.5, 0.8), { anchor: 'end', muted: true });

      // ---- step 3: values and a gate from m ----
      const arr = ramp(c, 0, 0.25), grow = ramp(c, 0.15, 0.4);
      p += arrowTo(`M${M0.x + NP * CELL + 6} ${M0.y + 44} L ${V0.x - 34} ${M0.y + 44}`, V0.x - 26, M0.y + 44, arr);
      p += txt(V0.x - 80, M0.y + 28, 13, 'linear', ramp(c, 0.3, 0.5), { muted: true, anchor: 'middle' });
      for (let sq = 0; sq < NS; sq++) for (let j = 0; j < NP; j++) p += vcell(V0.x + j * VC, YS(sq), VC, VC, V_BG, VV[sq][j], V_BAR, grow);
      for (let sq = 0; sq < NS; sq++) p += txt(V0.x - 10, YS(sq) + VC / 2, 13, String(sq), ramp(c, 0.2, 0.5), { anchor: 'end', muted: true });
      p += txt(V0.x + (NP * VC) / 2, V0.y + NS * VC + 18, 17, 'v', grow, { bold: true }) + txt(V0.x + (NP * VC) / 2 + 20, V0.y + NS * VC + 18, 13, 'values', grow, { muted: true, anchor: 'start' });
      const gOp = ramp(c, 0.55, 0.85) * (1 - 0 * d);
      for (let sq = 0; sq < NS; sq++) p += vcell(GX, YS(sq) + 3, CW, CW, G_BG, GV[sq], G_BAR, gOp);
      p += txt(GX + CW / 2, V0.y + NS * VC + 18, 17, 'g', gOp, { bold: true }) + txt(GX + CW / 2, V0.y - 15, 13, 'gate', gOp, { muted: true });

      // ---- step 4: the weighted sum along each row, times the gate ----
      for (let sq = 0; sq < NS; sq++) {
        const t0 = 0.05 + 0.14 * sq, lt = ramp(d, t0, t0 + 0.18), cellOp = ramp(d, t0 + 0.1, t0 + 0.3);
        for (let j = 0; j < NP; j++) p += `<g opacity="${lt.toFixed(2)}"><path d="M${V0.x + (j + 1) * VC - 2} ${YS(sq) + VC / 2} L${SX} ${YS(sq) + VC / 2}" stroke="var(--accent)" stroke-width="${(1 + 9 * W[j] / Math.max(...W)).toFixed(1)}" stroke-linecap="round" opacity=".45"/></g>`;
        p += vcell(SX, YS(sq) + 3, CW, CW, S_BG, SUMV[sq], S_BAR, cellOp);
        p += rect(V0.x + 0 * VC - 1.5, YS(sq) - 1.5, NP * VC + 3, VC + 3, 'none', 'var(--accent)', 2.5, pulse(d, t0, t0 + 0.2));
      }
      p += txt(SX + CW / 2, V0.y - 30, 13, 'weighted', ramp(d, 0.2, 0.45), { muted: true }) + txt(SX + CW / 2, V0.y - 15, 13, 'sum', ramp(d, 0.2, 0.45), { muted: true }) + txt(SX + CW / 2, V0.y + NS * VC + 18, 13, 'row by row', ramp(d, 0.3, 0.5), { muted: true });
      p += txt(SX + CW + 24, YS(1) + VC, 22, '×', ramp(d, 0.55, 0.7)) + txt(GX + CW + 22, YS(1) + VC, 22, '=', ramp(d, 0.7, 0.85));
      const headMove = ramp(e, 0, 0.25);
      for (let sq = 0; sq < NS; sq++) {
        const ox = lerp(OX, HX(0), headMove), ow = lerp(CW, 14, headMove);
        p += vcell(ox, YS(sq) + 3, ow, CW, S_BG, OV1[sq], S_BAR, ramp(d, 0.7 + 0.04 * sq, 0.9 + 0.04 * sq), 1);
      }
      p += txt(OX + CW / 2, V0.y - 15, 13, 'one head', ramp(d, 0.8, 1) * (1 - ramp(e, 0, 0.2)), { muted: true });

      // ---- step 5: eight heads, joined, a linear layer ----
      for (let hh = 1; hh < NH; hh++) for (let sq = 0; sq < NS; sq++) p += vcell(HX(hh), YS(sq) + 3, 14, CW, S_BG, HEADS[hh][sq], S_BAR, ramp(e, 0.1 + 0.05 * hh, 0.3 + 0.05 * hh));
      p += txt(HX(3.5) + 7, V0.y - 15, 13, 'the 8 heads', ramp(e, 0.3, 0.5), { muted: true });
      p += arrowTo(`M${HX(NH - 1) + 22} ${YS(1) + VC} L ${UX - 10} ${YS(1) + VC}`, UX - 4, YS(1) + VC, ramp(e, 0.5, 0.65));
      p += txt(HX(NH - 1) + 18, YS(1) + VC - 18, 13, 'join, then', ramp(e, 0.55, 0.7), { muted: true, anchor: 'start' }) + txt(HX(NH - 1) + 18, YS(1) + VC + 28, 13, 'a linear layer', ramp(e, 0.6, 0.75), { muted: true, anchor: 'start' });
      const ucol1 = ramp(e, 0.6, 0.8) * (1 - ramp(e, 0.88, 1));
      for (let sq = 0; sq < NS; sq++) p += rect(UX, YS(sq) + 3, CW, CW, ucol(UPD[sq]), LINE, 1, ucol1);
      h += `<g opacity="${dimmed.toFixed(2)}">${p}</g>`;

      // ---- the update of m: empty, then position i, then every position in turn ----
      const ou = ramp(e, 0.55, 0.7);
      h += grid(OUT0, NS, NP, VC, (r, cc) => {
        const fill = cc === I ? ramp(e, 0.86, 0.98) : ramp(f, 0.08 + (0.7 * cc) / NP, 0.2 + (0.7 * cc) / NP);
        return fill < 0.02 ? 'var(--bg)' : lerpColor('#ffffff', ucol(OV[r][cc]), fill);
      }, ou);
      h += rect(OUT0.x + I * VC - 1.5, OUT0.y - 1.5, VC + 3, NS * VC + 3, 'none', CI, 3, ramp(e, 0.7, 0.8) * (1 - ramp(f, 0.04, 0.1)));
      if (f > 0.04 && f < 0.97) h += rect(OUT0.x + pi * VC - 1.5, OUT0.y - 1.5, VC + 3, NS * VC + 3, 'none', CI, 3, 1);
      h += txt(OUT0.x + (NP * VC) / 2, OUT0.y + NS * VC + 18, 16, 'the update', ou, { bold: true }) + txt(OUT0.x + (NP * VC) / 2, OUT0.y + NS * VC + 36, 13, 'added to m', ramp(f, 0.9, 1), { muted: true });
      const tr = ramp(e, 0.78, 0.98);
      if (tr > 0 && tr < 1) for (let sq = 0; sq < NS; sq++) h += rect(lerp(UX, OUT0.x + I * VC + 3, tr), lerp(YS(sq) + 3, OUT0.y + sq * VC + 3, tr), CW, CW, ucol(UPD[sq]), LINE, 1, 1);
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(heading)}</h2>
      <div class="pw-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Pair-weighted averaging: row i of z gives the weights of a softmax; the values from m are added up along each sequence with those weights and multiplied by a gate; eight heads are joined and a linear layer gives the update of position i in every sequence; the same is done for every position"></svg></div>
      <div class="pw-caps">${CAPTIONS.map((t, i) => `<p class="pw-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>
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
        const ms = [0, 2600, 6500, 5000, 7500, 7500, 7500][step], t0 = performance.now();
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
