// "Inside MSA Module" (slide 35): the figure of the original (Suppl. Fig. 2: the MSA is subsampled and embedded, then four blocks in which
// the MSA stream and the pair stream talk to each other) redrawn natively. The two lanes of the figure are kept (the MSA stream above,
// the pair stream below, one box per operation, one loop for the four blocks), and a card at the top right opens up the two boxes that
// carry information between the lanes:
//
//   1  the MSA, a random subset of it, is embedded together with the input features: one vector per token per sequence (m)
//   2  outer product mean (m -> z): for a pair of positions i and j, multiply the two entries in each sequence, average over the
//      sequences, and add the result to z_ij (this is where what changes together in the alignment reaches the pair representation)
//   3  pair-weighted averaging (z -> m), then a transition: the weights for position i come from row i of z alone, the same for every
//      sequence; each position takes a weighted average of the positions in its own row
//   4  the pair stream: two triangle updates, two triangle attentions, a transition (the same pair operations as the Pairformer)
//   5  the block runs 4 times; only z leaves, for the Pairformer, and the MSA is dropped
//
// Checked against the supplement, Alg. 8 (MsaModule): m = Linear(concat(msa features, has_deletion, deletion_value)) + Linear(s_inputs),
// c_m = 64, a new random subset of the MSA in every recycling cycle (Methods 3.3); per block, z += OuterProductMean(m) (Alg. 9: an outer
// product of two projections of m, averaged over the sequences, flattened, a linear layer), m += PairWeightedAveraging(m, z) (Alg. 10:
// w_ij = softmax_j(b_ij) with b from LayerNorm(z) only, the output gated), m += Transition(m), then z += TriangleMultiplicationOutgoing,
// Incoming, TriangleAttentionStartingNode, EndingNode, Transition(z); N_block = 4; only z is returned. "We do not combine information
// across different rows of the MSA directly ... all information has to flow via the pair representation" (Methods 3.3).
// Left out of the drawing: the residual "+" at each box (the figure's skip arcs), the layer norms, gating and dropout. The sequences, the
// cell values, the weights and the strength of each pair are a toy (seed 3), the grids a schematic; its two columns that change together are
// made up, the way the coevolution slide's are.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => { const v = parseInt(hex.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const lerpColor = (a, b, t) => hex(rgb(a).map((x, i) => x + (rgb(b)[i] - x) * t));
const shade = (h, k) => hex(rgb(h).map((x) => (k > 0 ? x + (255 - x) * k : x * (1 + k))));   // k > 0 lighter, k < 0 darker
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const SEED = 3;
const INK = '#1d2129', LINE = 'rgba(0,0,0,.3)';
const PINK = '#efc7c7', PEACH = '#f9e3c3', GREEN = '#d7ebd0', LAV = '#d8d2ee';   // the box colours of the original figure
const BLUE = '#a9d8f2', ORANGE_LIGHT = '#fde5c8', ORANGE_DEEP = '#e07a2a', TINT = '#f2a65a';
const CI = '#e8590c', CJ = '#3b5bdb';                                              // positions i and j, as on the coevolution slide

// the toy: 8 sequences of 6 positions, positions I and J change together (a big residue at one, a small one at the other)
const RAW = ['AKTWED', 'WSTAED', 'FRSGDE', 'GKTFED', 'REGVEE', 'SDTYDE', 'VRTYED', 'YKSADE'];
const KEPT = [1, 3, 4, 6];                      // the rows the subsample keeps
const NS = 4, NT = 6, I = 0, J = 3;
const AA = { A: '#cfe0f5', V: '#cfe0f5', L: '#cfe0f5', I: '#cfe0f5', M: '#cfe0f5', F: '#f4efb0', W: '#f4efb0', Y: '#f4efb0', S: '#cfeccb', T: '#cfeccb', N: '#cfeccb', Q: '#cfeccb', C: '#cfeccb', K: '#f6c9c9', R: '#f6c9c9', H: '#f6c9c9', D: '#f0d9a8', E: '#f0d9a8', G: '#e5cdf0', P: '#e5cdf0' };

// geometry, in map units (1000 x 395)
const TL = 78, BL = 300;                                                  // the MSA lane and the pair lane
const M_X = 300, BRANCH = 420, UP_X = 491, LOOP_R = 666, LOOP_L = 372, ARC_Y = 20, LOOP_B = 372, LZ_R = 903, LZ_L = 395;
const Z_START = 48, Z_AFTER = 455, Z_OUT = 946;
const EMB = { x: 112, w: 74 }, OPM = { x: 387, y: 150, w: 66, h: 62 }, PWA = { x: 452, w: 78 }, TRA = { x: 560, w: 64 }, TB = { y: 46, h: 64 };
const PB = [520, 598, 676, 754, 832], PW = 62, PY = 252, PH = 96;
const PBOX = [
  { t: ['Triangle', 'update', 'outgoing'], c: PEACH }, { t: ['Triangle', 'update', 'incoming'], c: PEACH },
  { t: ['Triangle', 'attention', 'starting'], c: PINK }, { t: ['Triangle', 'attention', 'ending'], c: PINK }, { t: ['Tran-', 'sition'], c: GREEN },
];
const PANEL = { x: 676, y: 8, w: 316, h: 238 };

// the point a fraction t of the way along a polyline
const along = (pts, t) => {
  const sg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), tot = sg.reduce((x, y) => x + y, 0);
  let r = Math.max(0, Math.min(1, t)) * tot;
  for (let i = 0; i < sg.length; i++) {
    if (r <= sg[i] || i === sg.length - 1) { const f = sg[i] ? r / sg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }
    r -= sg[i];
  }
};

const CAPTIONS = [
  'A random subset of the MSA, new in every recycling cycle, is embedded with the input features: one vector for every token of every sequence. z arrives from the template module.',
  'Outer product mean: for a pair of positions, multiply their two entries in each sequence and average over the sequences. What changes together in the alignment is added to z.',
  'Pair-weighted averaging: z says where each sequence looks. The weights for a position come from z alone, the same in every sequence, and then a transition layer follows.',
  'Then z is refined by two triangle updates, two triangle attentions and a transition, the same pair operations as in the Pairformer.',
  'This block runs 4 times. Only z moves on to the Pairformer. The sequences never talk to each other directly: whatever they share goes through z.',
];

AF3.kinds.msamodule = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .ms-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .ms-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ms-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .ms-t.muted { fill: var(--muted); }
      .ms-t.ink { fill: ${INK}; }
      .ms-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .ms-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // ---- the toy data ----
    const rand = rng(SEED);
    const A = [0.9, -0.85, 0.75, -0.9];                                    // the entry at position I in each kept sequence
    const X = A.map((a) => Array.from({ length: NT }, (_, c) => (c === I ? a : c === J ? -0.9 * a + (rand() - 0.5) * 0.15 : (rand() - 0.5) * 0.7)));
    const STR = Array.from({ length: NT }, (_, i) => Array.from({ length: NT }, (_, j) => Math.abs(X.reduce((t, row) => t + row[i] * row[j], 0) / NS)));
    const SMAX = Math.max(...STR.flat());
    const STRN = STR.map((r) => r.map((v) => v / SMAX));                  // how strongly each pair of positions changes together, 0 to 1
    const E = STRN[I].map((v) => Math.exp(2.2 * v));
    const W = E.map((v) => v / E.reduce((a, b) => a + b, 0));              // the weights of position I, from row I of z
    const XNEW = X.map((row) => row.map((v, c) => (c === I ? row.reduce((t, x, j) => t + W[j] * x, 0) : v)));
    const SMOOTH = X.map((row) => row.map((_, c) => (row[Math.max(0, c - 1)] + row[c] + row[Math.min(NT - 1, c + 1)]) / 3));
    const ZV = Array.from({ length: NT }, () => Array.from({ length: NT }, () => rand()));
    const PROD = A.map((_, r) => Math.abs(X[r][I] * X[r][J]));

    // ---- helpers ----
    const mcol = (v) => lerpColor(ORANGE_LIGHT, ORANGE_DEEP, Math.max(0, Math.min(1, (v + 1) / 2)));
    const zcol = (i, j, tint, con = 0) => {
      const c = lerpColor(shade(BLUE, (ZV[i][j] - 0.5) * 0.3), TINT, tint * STRN[i][j]);
      return con ? shade(c, (ZV[i][j] - 0.5) * 0.7 * con) : c;
    };
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="ms-t${o.muted ? ' muted' : ''}${o.ink ? ' ink' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const head = (x, y, dir, c = 'var(--accent)') => {
      const p = { right: [[0, 0], [-10, -5.5], [-10, 5.5]], left: [[0, 0], [10, -5.5], [10, 5.5]], up: [[0, 0], [-5.5, 10], [5.5, 10]], down: [[0, 0], [-5.5, -10], [5.5, -10]] }[dir];
      return `<polygon points="${p.map(([a, b]) => `${(x + a).toFixed(1)},${(y + b).toFixed(1)}`).join(' ')}" fill="${c}"/>`;
    };
    const path = (d, op, c = 'var(--accent)', w = 2.5, dash = '') => op < 0.01 ? '' : `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${op.toFixed(2)}"/>`;
    const seg = (x1, y1, x2, y2, op, dir, c = 'var(--accent)') => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${path(`M${x1} ${y1} L${x2} ${y2}`, 1, c)}${head(x2, y2, dir, c)}</g>`;
    const cells = (x0, y0, cw, ch, nr, nc, col, op = 1, stroke = LINE) => {
      let g = '';
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) g += `<rect x="${(x0 + c * cw).toFixed(1)}" y="${(y0 + r * ch).toFixed(1)}" width="${cw}" height="${ch}" fill="${col(r, c)}" stroke="${stroke}" stroke-width="1"/>`;
      return op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${g}</g>`;
    };
    // the MSA representation as a small grid, and the pair representation as a square one
    const mIcon = (cx, cy, k, upd, op) => cells(cx - NT * k / 2, cy - NS * k / 2, k, k, NS, NT, (r, c) => mcol(lerp(X[r][c], SMOOTH[r][c], upd)), op);
    const zIcon = (cx, cy, k, tint, con, op) => cells(cx - NT * k / 2, cy - NT * k / 2, k, k, NT, NT, (r, c) => zcol(r, c, tint, con), op);
    const box = (x, y, w, h, lines, fill, act, size = 13.5) => {
      let g = act > 0.02 ? `<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="12" fill="var(--accent)" opacity="${(0.22 * act).toFixed(2)}"/>` : '';
      g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="var(--bg)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${act > 0.5 ? 'var(--accent)' : 'rgba(0,0,0,.4)'}" stroke-width="${act > 0.5 ? 3.5 : 1.5}"/>`;
      const lh = size + 3.5, y0 = y + h / 2 - ((lines.length - 1) * lh) / 2;
      return g + lines.map((l, i) => `<text x="${x + w / 2}" y="${(y0 + i * lh).toFixed(1)}" font-size="${size}" text-anchor="middle" class="ms-t ink">${l}</text>`).join('');
    };

    // ---- the card at the top right: what happens inside the outer product mean (step 2) and the pair-weighted averaging (step 3) ----
    const card = (op, title) => `<g opacity="${op.toFixed(2)}"><rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="12" fill="var(--bg)" stroke="var(--accent)" stroke-width="2.5"/>`
      + `<text x="${PANEL.x + PANEL.w / 2}" y="${PANEL.y + 22}" font-size="18" font-weight="700" text-anchor="middle" class="ms-t">${title}</text></g>`;

    const opmCard = (b, op) => {
      if (op < 0.01) return '';
      const mx = 692, my = 58, k = 17, zx = 868, zy = 58;
      let g = card(op, 'Outer product mean');
      const sub = (p) => `opacity="${(op * p).toFixed(2)}"`;
      // m: columns i and j
      g += `<g ${sub(1)}>${cells(mx, my, k, k, NS, NT, (r, c) => mcol(X[r][c]))}</g>`;
      const cols = ramp(b, 0.1, 0.2);
      g += `<g ${sub(cols)}><rect x="${mx + I * k - 1}" y="${my - 2}" width="${k + 2}" height="${NS * k + 4}" fill="none" stroke="${CI}" stroke-width="3"/><rect x="${mx + J * k - 1}" y="${my - 2}" width="${k + 2}" height="${NS * k + 4}" fill="none" stroke="${CJ}" stroke-width="3"/>`
        + `<text x="${mx + I * k + k / 2}" y="${my - 11}" font-size="15" font-weight="700" text-anchor="middle" class="ms-t" style="fill:${CI}">i</text><text x="${mx + J * k + k / 2}" y="${my - 11}" font-size="15" font-weight="700" text-anchor="middle" class="ms-t" style="fill:${CJ}">j</text></g>`;
      g += `<g ${sub(1)}>${txt(mx + (NT * k) / 2, my + NS * k + 16, 16, 'm', 1, { bold: true })}</g>`;
      // the row scan: each sequence's two entries pulse, and a dot (their product) appears to the right
      for (let r = 0; r < NS; r++) {
        const t0 = 0.2 + 0.07 * r, pulse = ramp(b, t0, t0 + 0.05) * (1 - ramp(b, t0 + 0.05, t0 + 0.12)), dot = ramp(b, t0 + 0.03, t0 + 0.09);
        const y = my + r * k;
        g += `<g ${sub(pulse)}><rect x="${mx + I * k}" y="${y}" width="${k}" height="${k}" fill="none" stroke="var(--fg)" stroke-width="3"/><rect x="${mx + J * k}" y="${y}" width="${k}" height="${k}" fill="none" stroke="var(--fg)" stroke-width="3"/></g>`;
        g += `<g ${sub(dot)}><circle cx="${mx + NT * k + 14}" cy="${y + k / 2}" r="${(2.5 + 6 * PROD[r]).toFixed(1)}" fill="${TINT}" stroke="${LINE}"/></g>`;
      }
      // the average: the dots run together and into z_ij
      const mergeX = 826, mergeY = my + (NS * k) / 2, merge = ramp(b, 0.5, 0.6), toZ = ramp(b, 0.56, 0.68);
      for (let r = 0; r < NS; r++) g += `<g ${sub(merge)}>${path(`M${mx + NT * k + 22} ${my + r * k + k / 2} L${mergeX} ${mergeY}`, 1, 'var(--muted)', 1.5)}</g>`;
      const tx = zx + J * k + k / 2, ty = zy + I * k;
      g += `<g ${sub(toZ)}>${path(`M${mergeX} ${mergeY} C ${mergeX + 6} ${my - 14}, ${tx} ${zy - 14}, ${tx} ${ty - 8}`, 1, 'var(--accent)', 2.5)}${head(tx, ty - 3, 'down')}</g>`;
      // z: the cell (i, j) fills first, then every cell by how strongly its two positions change together
      const one = ramp(b, 0.6, 0.7), all = ramp(b, 0.72, 0.92);
      g += `<g ${sub(1)}>${cells(zx, zy, k, k, NT, NT, (r, c) => zcol(r, c, r === I && c === J ? Math.max(one, all) : all))}</g>`;
      g += `<g ${sub(ramp(b, 0.55, 0.62))}><rect x="${zx + J * k - 1}" y="${zy + I * k - 1}" width="${k + 2}" height="${k + 2}" fill="none" stroke="var(--accent)" stroke-width="3"/></g>`;
      g += `<g ${sub(1)}>${txt(zx + (NT * k) / 2, zy + NT * k + 16, 16, 'z', 1, { bold: true })}</g>`;
      g += txt(PANEL.x + PANEL.w / 2, 192, 14.5, 'Per sequence: multiply the two entries', op * ramp(b, 0.2, 0.3))
        + txt(PANEL.x + PANEL.w / 2, 210, 14.5, 'Then average over the sequences', op * ramp(b, 0.5, 0.6))
        + txt(PANEL.x + PANEL.w / 2, 228, 14.5, 'The same for every pair of positions', op * ramp(b, 0.72, 0.85));
      return g;
    };

    const pwaCard = (c, op) => {
      if (op < 0.01) return '';
      const zx = 692, zy = 62, kz = 17, mx = 830, my = 112, kw = 20, kh = 16, base = 106;
      let g = card(op, 'Pair-weighted averaging');
      const sub = (p) => `opacity="${(op * p).toFixed(2)}"`;
      // z, with its row i marked: the weights
      g += `<g ${sub(1)}>${cells(zx, zy, kz, kz, NT, NT, (r, cc) => zcol(r, cc, 1))}</g>`;
      const rowOn = ramp(c, 0.1, 0.2);
      g += `<g ${sub(rowOn)}><rect x="${zx - 1}" y="${zy + I * kz - 1}" width="${NT * kz + 2}" height="${kz + 2}" fill="none" stroke="var(--accent)" stroke-width="3"/></g>`;
      g += `<g ${sub(1)}>${txt(zx + (NT * kz) / 2, zy + NT * kz + 16, 16, 'z', 1, { bold: true })}</g>`;
      g += `${seg(zx + NT * kz + 4, zy + kz / 2, mx - 10, zy + kz / 2, op * ramp(c, 0.14, 0.24), 'right')}`;
      // the weights as bars over the columns of m
      const grow = ramp(c, 0.18, 0.32);
      g += txt(mx + (NT * kw) / 2, 50, 14.5, 'weights from row i of z', op * ramp(c, 0.14, 0.24), { muted: true });
      for (let j = 0; j < NT; j++) {
        const hgt = W[j] * 110 * grow;
        g += `<g ${sub(grow)}><rect x="${mx + j * kw + 4}" y="${(base - hgt).toFixed(1)}" width="${kw - 8}" height="${hgt.toFixed(1)}" rx="2" fill="var(--accent)"/></g>`;
      }
      // m: the bottom sequence is the example; its six cells flow into the new value at position i, in proportion to the weights
      const done = ramp(c, 0.48, 0.6), others = ramp(c, 0.72, 0.86);
      g += `<g ${sub(1)}>${cells(mx, my, kw, kh, NS, NT, (r, cc) => mcol(cc === I ? (r === NS - 1 ? lerp(X[r][cc], XNEW[r][cc], done) : lerp(X[r][cc], XNEW[r][cc], others)) : X[r][cc]))}</g>`;
      const fun = ramp(c, 0.32, 0.46), ry = my + NS * kh + 22;
      for (let j = 0; j < NT; j++) g += `<g ${sub(fun)}>${path(`M${mx + j * kw + kw / 2} ${my + NS * kh} L${mx + I * kw + kw / 2} ${ry}`, 1, 'var(--accent)', 1 + W[j] * 9)}</g>`;
      g += `<g ${sub(fun)}>${cells(mx + I * kw, ry, kw, kh, 1, 1, () => mcol(lerp(X[NS - 1][I], XNEW[NS - 1][I], done)))}</g>`;
      g += txt(mx + I * kw + kw + 8, ry + kh / 2, 14, 'updated position i', op * ramp(c, 0.4, 0.5), { muted: true, anchor: 'start' });
      // the same weights for every sequence: the whole column i updates
      const col = ramp(c, 0.62, 0.72) * (1 - ramp(c, 0.9, 1));
      g += `<g ${sub(col)}><rect x="${mx + I * kw - 1}" y="${my - 1}" width="${kw + 2}" height="${NS * kh + 2}" fill="none" stroke="var(--accent)" stroke-width="3"/></g>`;
      g += txt(PANEL.x + PANEL.w / 2, 228, 14.5, 'The same weights for every sequence', op * ramp(c, 0.6, 0.72));
      return g;
    };

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d, e = st.e;
      // ---- the frame of the block, and the lanes ----
      h += `<rect x="346" y="10" width="566" height="382" rx="18" fill="none" stroke="var(--muted)" stroke-opacity=".4" stroke-width="2"/>`;
      h += seg(76, BL, BRANCH - 14, BL, 0.75, 'right') + seg(BRANCH + 14, BL, PB[0] - 2, BL, 0.75, 'right');
      h += seg(227, TL, PWA.x - 2, TL, 0.75, 'right') + seg(PWA.x + PWA.w, TL, TRA.x - 2, TL, 0.75, 'right')
        + seg(BRANCH, TL, BRANCH, OPM.y - 2, 0.75, 'down') + seg(BRANCH, OPM.y + OPM.h, BRANCH, BL - 14, 0.75, 'down')
        + seg(UP_X, BL, UP_X, TL + 34, 0.75, 'up');
      for (let k = 0; k < 4; k++) h += seg(PB[k] + PW, BL, PB[k + 1] - 2, BL, 0.75, 'right');
      h += seg(PB[4] + PW, BL, Z_OUT - 28, BL, 0.75, 'right');
      // the loop of the four blocks: the MSA stream along the top, the pair stream along the bottom
      const lap = (k) => ramp(e, 0.05 + 0.25 * k, 0.3 + 0.25 * k);
      const lit = Math.max(ramp(e, 0.04, 0.12), 0) * (1 - ramp(e, 0.85, 1)) * 0.5;
      h += path(`M${TRA.x + TRA.w} ${TL} H${LOOP_R} V${ARC_Y} H${LOOP_L} V${TL - 4}`, 0.5 + lit, 'var(--accent)', 2.5, '7 6') + head(LOOP_L, TL - 3, 'down', 'var(--accent)').replace('<polygon', `<polygon opacity="${(0.5 + lit).toFixed(2)}"`);
      h += path(`M${LZ_R} ${BL} V${LOOP_B} H${LZ_L} V${BL + 4}`, 0.5 + lit, 'var(--accent)', 2.5, '7 6') + head(LZ_L, BL + 3, 'up', 'var(--accent)').replace('<polygon', `<polygon opacity="${(0.5 + lit).toFixed(2)}"`);
      // ---- step 1: the MSA in, a subset of it, embedded, and the inputs added ----
      const rawIn = ramp(a, 0, 0.18), sub = ramp(a, 0.2, 0.38), embA = ramp(a, 0.4, 0.5) * (1 - ramp(a, 0.62, 0.72)), embD = ramp(a, 0.7, 0.8);
      for (let r = 0; r < 8; r++) {
        const kept = KEPT.includes(r), op = rawIn * (kept ? 1 : 1 - 0.8 * sub);
        h += cells(8, TL - 44 + r * 11, 12, 11, 1, 6, (rr, cc) => AA[RAW[r][cc]], op, 'rgba(0,0,0,.18)');
        h += [...RAW[r]].map((ch, cc) => txt(8 + cc * 12 + 6, TL - 44 + r * 11 + 5.5, 8.5, ch, op, { ink: true })).join('');
      }
      h += txt(44, 140, 16, 'MSA', rawIn, { bold: true }) + txt(44, 158, 14, 'a random subset', sub, { muted: true });
      h += seg(84, TL, EMB.x - 3, TL, rawIn * 0.75, 'right');
      h += box(EMB.x, TL - 34, EMB.w, 68, ['Subsample', 'and embed'], PINK, embA, 13.5);
      h += seg(EMB.x + EMB.w, TL, 204, TL, ramp(a, 0.5, 0.62) * 0.75, 'right');
      const inp = ramp(a, 0.58, 0.72);
      h += `<g opacity="${inp.toFixed(2)}"><rect x="190" y="6" width="52" height="22" rx="4" fill="#b9e6bc" stroke="${LINE}"/><text x="216" y="17" font-size="14" text-anchor="middle" class="ms-t ink">inputs</text></g>`
        + seg(216, 28, 216, TL - 13, inp * 0.75, 'down');
      h += `<g opacity="${inp.toFixed(2)}"><circle cx="216" cy="${TL}" r="11" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/><path d="M210 ${TL} H222 M216 ${TL - 6} V${TL + 6}" stroke="var(--fg)" stroke-width="2"/></g>`;

      // ---- the boxes ----
      const actE = embA, actO = ramp(b, 0.25, 0.35) * (1 - ramp(b, 0.62, 0.72)), actP = ramp(c, 0.15, 0.25) * (1 - ramp(c, 0.45, 0.55)), actT = ramp(c, 0.55, 0.65) * (1 - ramp(c, 0.8, 0.9));
      // the pair-stream boxes light while z is passing through them
      const zx = lerp(lerp(Z_START, Z_AFTER, ramp(b, 0.35, 0.72)), Z_OUT, ramp(d, 0.05, 0.95));
      const under = (k) => (d > 0 && d < 1 ? Math.max(0, 1 - Math.abs(zx - (PB[k] + PW / 2)) / 44) : 0);

      // ---- the tensors that travel (drawn under the boxes, so that they pass behind them) ----
      // z: from the template module, through the outer product mean, then the five boxes
      const zTint = ramp(b, 0.68, 0.88), zCon = ramp(d, 0.1, 0.9);
      h += zIcon(zx, BL, 8, zTint, zCon, ramp(a, 0, 0.15));
      // m: from the embedding, behind the pair-weighted averaging and the transition, to the end of the lane
      const mxp = lerp(lerp(lerp(M_X, UP_X, ramp(c, 0.2, 0.42)), 592, ramp(c, 0.55, 0.76)), 646, ramp(c, 0.82, 1));
      const mScale = lerp(1, 0.6, ramp(c, 0.82, 1)), mUpd = ramp(c, 0.45, 0.9);
      h += mIcon(mxp, TL, 10 * mScale, mUpd, ramp(a, 0.72, 0.95) * (1 - ramp(e, 0.82, 0.96)));
      // m's copy for the outer product mean: along the lane, down behind the box, down to z
      const q = ramp(b, 0.1, 0.62);
      if (q > 0 && q < 1) { const [px, py] = along([[M_X + 30, TL], [BRANCH, TL], [BRANCH, BL - 20]], q); h += mIcon(px, py, 5, 0, 0.95); }
      // z's copy up to the pair-weighted averaging, which it gives its weights
      const zc = ramp(c, 0.08, 0.28);
      if (c > 0.08 && c < 0.3) h += zIcon(UP_X, lerp(BL - 10, TL + 40, zc), 4, 1, 0, 0.95);

      // ---- the boxes over them ----
      h += box(OPM.x, OPM.y, OPM.w, OPM.h, ['Outer', 'product', 'mean'], LAV, actO);
      h += box(PWA.x, TB.y, PWA.w, TB.h, ['Pair-', 'weighted', 'averaging'], PINK, actP);
      h += box(TRA.x, TB.y, TRA.w, TB.h, ['Tran-', 'sition'], GREEN, actT);
      PBOX.forEach((p, k) => { h += box(PB[k], PY, PW, PH, p.t, p.c, under(k), 13); });
      // the "+" where the outer product mean is added to z
      h += `<circle cx="${BRANCH}" cy="${BL}" r="11" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/><path d="M${BRANCH - 6} ${BL} H${BRANCH + 6} M${BRANCH} ${BL - 6} V${BL + 6}" stroke="var(--fg)" stroke-width="2"/>`;

      // ---- labels ----
      h += txt(M_X, TL + 40, 15, 'MSA rep. m', ramp(a, 0.76, 0.95) * (1 - ramp(c, 0.2, 0.32)), { bold: true });
      h += txt(8, 346, 17, 'pair representation z', ramp(a, 0, 0.15), { anchor: 'start', bold: true }) + txt(8, 365, 14, 'from the template module', ramp(a, 0, 0.15), { anchor: 'start', muted: true });
      h += txt(650, TL + 46, 14, 'dropped', ramp(e, 0.82, 0.96), { muted: true });
      h += txt(Z_OUT, 346, 17, 'z', ramp(d, 0.9, 1), { bold: true }) + txt(Z_OUT, 262, 14, 'to Pairformer', ramp(e, 0.84, 0.98), { muted: true });

      // ---- the laps of the loop (step 5): copies of m and z go round again, three more times ----
      for (let k = 0; k < 3; k++) {
        const u = lap(k);
        if (u > 0 && u < 1) {
          const [qx, qy] = along([[LOOP_R, TL], [LOOP_R, ARC_Y], [LOOP_L, ARC_Y], [LOOP_L, TL]], u), [rx, ry] = along([[LZ_R, BL], [LZ_R, LOOP_B], [LZ_L, LOOP_B], [LZ_L, BL]], u);
          h += mIcon(qx, qy, 5, 1, 0.95) + zIcon(rx, ry, 4, 1, 1, 0.95);
        }
      }

      h += `<rect x="${(LOOP_L + LOOP_R) / 2 - 42}" y="${ARC_Y - 11}" width="84" height="22" fill="var(--bg)"/>` + txt((LOOP_L + LOOP_R) / 2, ARC_Y, 16, '4 blocks', 1, { bold: true });
      const ticks = [ramp(d, 0.9, 1), lap(0), lap(1), lap(2)];
      h += ticks.map((t, i) => `<rect x="${(LOOP_L + LOOP_R) / 2 - 38 + i * 20}" y="34" width="16" height="7" rx="2" fill="${t > 0.5 ? 'var(--accent)' : 'color-mix(in srgb, var(--muted) 30%, transparent)'}"/>`).join('');

      // ---- the cards ----
      h += opmCard(b, ramp(b, 0, 0.1) * (1 - ramp(c, 0, 0.1))) + pwaCard(c, ramp(c, 0.05, 0.15) * (1 - ramp(d, 0, 0.1)));
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="ms-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Inside the MSA module: the MSA is subsampled and embedded; in each of four blocks the outer product mean writes it into the pair representation, the pair-weighted averaging lets the pair representation update the MSA, and the pair representation goes through triangle updates, triangle attentions and a transition; only the pair representation leaves"></svg></div>
      <div class="ms-caps">${CAPTIONS.map((t, i) => `<p class="ms-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;
    const svg = frame.querySelector('svg');

    const KEYS = ['a', 'b', 'c', 'd', 'e'];
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 5200, 7500, 7500, 5600, 6800][step], t0 = performance.now();
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
