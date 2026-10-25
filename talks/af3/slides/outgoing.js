// "Outgoing Update" (slide 39) and, with the same drawing turned round, "Incoming Update" (appendix, slide 71): the figure of the original (Simon, The Illustrated AlphaFold: z is projected into a and b, row i of a and
// row j of b are multiplied entry by entry and summed over k, and the result becomes z_ij) redrawn natively and played a click at a time,
// for one entry z_ij first and then for all of them:
//
//   1  z: a vector for every pair of tokens; the entry we update is z_ij
//   2  z is projected twice, into a and b: a linear layer times a sigmoid gate
//   3  for z_ij, row i of a and row j of b (entry k of each comes from the edge to token k: z_ik and z_jk)
//   4  multiply the two rows entry by entry: one product for every token k
//   5  add up over k; a layer norm, a linear layer and a gate from z_ij turn the sum into the update of z_ij
//   6  the same for every pair i, j (row i of a with row j of b each time); the update is added to z
//
// Checked against the supplement, Alg. 12 (TriangleMultiplicationOutgoing): z <- LayerNorm(z); a_ij, b_ij = sigmoid(Linear(z_ij)) * Linear(z_ij)
// (c = 128); g_ij = sigmoid(Linear(z_ij)); update_ij = g_ij * Linear(LayerNorm(sum_k a_ik * b_jk)); and Alg. 17 line 2: z += Dropout(update).
// The incoming update (Alg. 13) differs in one place, highlighted there: update_ij = g_ij * Linear(LayerNorm(sum_k a_ki * b_kj)), so column i of a and column j of b
// are multiplied instead of row i and row j; the drawing is the same with the rows swapped for columns, and the edges that give a_ki and b_kj are z_ki and z_kj.
// Left out of the drawing: the first LayerNorm, the dropout and the size of the vectors (3 numbers stand in for c = 128, 5 tokens for N).
// Every number is a toy (seed 5); the bars of the sum are scaled to fit the cell.
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
const SEED = 5;
const INK = '#1d2129', LINE = 'rgba(0,0,0,.3)';
const BLUE = '#a9d8f2', CI = '#e8590c', CJ = '#3b5bdb';                          // z cells; position i and position j, as on the other slides
const A_LIGHT = '#fff1e0', A_DEEP = '#e07a2a', B_LIGHT = '#e3e9ff', B_DEEP = '#4c6ef5', O_LIGHT = '#e5dbff', O_DEEP = '#7048e8';
const A_BG = '#fff4e6', B_BG = '#edf2ff', P_BG = '#f3f0ff', S_BG = '#e5dbff';   // the cells that hold a vector
const A_BAR = '#d9480f', B_BAR = '#3b5bdb', P_BAR = '#7048e8', S_BAR = '#5f3dc4';
const N = 5, I = 1, J = 3, C = 3, CELL = 22;                                     // five tokens; the entry z_13; three numbers stand in for a vector

// geometry, in map units (1000 x 395)
const Z = { x: 30, y: 105 }, GA = { x: 215, y: 30 }, GB = { x: 215, y: 240 }, O = { x: 850, y: 105 };
const SX = (k) => 520 + 46 * k, SW = 38, SH = 30;                               // the columns of the strips, and a cell in them
const A_Y = 34, B_Y = 76, RULE_Y = 114, P_Y = 122, S_CX = 618, S_Y = 200;
const OUT = [[S_CX + SW / 2 + 4, S_Y + SH / 2], [740, S_Y + SH / 2], [770, 138], [O.x - 8, 138]];   // the arrow from the sum to the update (a cubic)
const bez = (t) => { const u = 1 - t; return [0, 1].map((i) => u * u * u * OUT[0][i] + 3 * u * u * t * OUT[1][i] + 3 * u * t * t * OUT[2][i] + t * t * t * OUT[3][i]); };
const PATH = Array.from({ length: 11 }, (_, i) => bez(i / 10)).concat([[O.x + J * CELL + CELL / 2, 138]]);   // and on into the cell z_ij of the update

const along = (pts, t) => {
  const sg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), tot = sg.reduce((x, y) => x + y, 0);
  let r = Math.max(0, Math.min(1, t)) * tot;
  for (let i = 0; i < sg.length; i++) {
    if (r <= sg[i] || i === sg.length - 1) { const f = sg[i] ? r / sg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }
    r -= sg[i];
  }
};

const CAPTIONS = { outgoing: [
  '$z$ holds a vector for every pair of tokens. Here we update one entry, $z_{ij}$.',
  'First $z$ is projected twice, into $a$ and $b$. Each projection is a linear layer multiplied by a gate: numbers between 0 and 1 that can switch parts of it off.',
  'For $z_{ij}$, take row $i$ of $a$ and row $j$ of $b$. Entry $k$ in each comes from the edge to token $k$: $z_{ik}$ gives $a_{ik}$, and $z_{jk}$ gives $b_{jk}$.',
  'Multiply the two rows entry by entry, number by number: one product for every token $k$.',
  'Add up the products over all $k$. A layer norm, a linear layer and a gate computed from $z_{ij}$ turn the sum into the update for $z_{ij}$.',
  'The same is done for every pair $i, j$, each time with row $i$ of $a$ and row $j$ of $b$. The result is added to $z$.',
], incoming: [
  '$z$ holds a vector for every pair of tokens. Here we update one entry, $z_{ij}$. This time we use the edges that come in to $i$ and to $j$.',
  'First $z$ is projected twice, into $a$ and $b$. Each projection is a linear layer multiplied by a gate: numbers between 0 and 1 that can switch parts of it off.',
  'For $z_{ij}$, take column $i$ of $a$ and column $j$ of $b$. Entry $k$ in each comes from the edge from token $k$: $z_{ki}$ gives $a_{ki}$, and $z_{kj}$ gives $b_{kj}$.',
  'Multiply the two columns entry by entry, number by number: one product for every token $k$.',
  'Add up the products over all $k$. A layer norm, a linear layer and a gate computed from $z_{ij}$ turn the sum into the update for $z_{ij}$.',
  'The same is done for every pair $i, j$, each time with column $i$ of $a$ and column $j$ of $b$. The result is added to $z$.',
] };

const make = (mode) => (s) => ({
  steps: 6,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .og-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .og-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .og-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .og-t.muted { fill: var(--muted); }
      .og-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .og-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .og-cap .af3-tex { white-space: nowrap; }   /* a formula never breaks across two lines */
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title') || AF3.texts(s).slice().sort((a, b) => a.g.y - b.g.y)[0];
    const inc = mode === 'incoming';   // the incoming update takes columns where the outgoing one takes rows

    // ---- the toy data ----
    const rand = rng(SEED);
    const vec = (lo, hi) => Array.from({ length: C }, () => lo + (hi - lo) * rand());
    const ZV = Array.from({ length: N }, () => Array.from({ length: N }, () => rand()));
    const AR = Array.from({ length: N }, () => Array.from({ length: N }, () => vec(0.4, 1)));          // a and b before the gate
    const BRW = Array.from({ length: N }, () => Array.from({ length: N }, () => vec(0.4, 1)));
    const GAT = (n) => Array.from({ length: N }, () => Array.from({ length: N }, () => vec(0.25, 1)));  // the gates, between 0 and 1
    const GAa = GAT(), GBb = GAT();
    const gated = (raw, gate, r, c, p) => raw[r][c].map((v, i) => v * (1 - p * (1 - gate[r][c][i])));
    const AV = Array.from({ length: N }, (_, k) => (inc ? gated(AR, GAa, k, I, 1) : gated(AR, GAa, I, k, 1)));   // row i of a, row j of b (column i, column j when incoming), after the gate
    const BV = Array.from({ length: N }, (_, k) => (inc ? gated(BRW, GBb, k, J, 1) : gated(BRW, GBb, J, k, 1)));
    const PV = AV.map((v, k) => v.map((x, i) => x * BV[k][i]));                                        // the products
    const SV = Array.from({ length: C }, (_, i) => PV.reduce((t, p) => t + p[i], 0));
    const SM = Math.max(...SV), SN = SV.map((v) => (v / SM) * 0.95);                                   // the sum, scaled to fit
    const OV = Array.from({ length: N }, () => Array.from({ length: N }, () => 0.2 + 0.8 * rand()));

    // ---- helpers ----
    const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    const zcol = (r, c) => shade(BLUE, (ZV[r][c] - 0.5) * 0.35);
    const acol = (v) => lerpColor(A_LIGHT, A_DEEP, mean(v)), bcol = (v) => lerpColor(B_LIGHT, B_DEEP, mean(v)), ocol = (v) => lerpColor(O_LIGHT, O_DEEP, v);
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="og-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const M = (x, y, size, src, op, o = {}) => AF3.svgMath(x, y, size, src, { ...o, op });      // a symbol or formula, set in KaTeX
    const R = (x, y, size, str, op, o = {}) => AF3.svgRich(x, y, size, str, { ...o, op });      // words with $math$ in them
    const rect = (x, y, w, h, fill, stroke, sw, op = 1) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const grid = (g0, col, op) => {
      let h = '';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) h += `<rect x="${g0.x + c * CELL}" y="${g0.y + r * CELL}" width="${CELL}" height="${CELL}" fill="${col(r, c)}" stroke="${LINE}" stroke-width="1"/>`;
      return op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const arrowTo = (d, x, y, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5"/><polygon points="${x},${y} ${x - 10},${y - 5.5} ${x - 10},${y + 5.5}" fill="var(--accent)"/></g>`;
    // a cell that holds a vector: C bars, one per number
    const bars = (x, y, w, h, vals, col, grow) => {
      const bh = 6, gap = 2.5, y0 = y + (h - (C * bh + (C - 1) * gap)) / 2;
      return vals.map((v, i) => `<rect x="${(x + 3).toFixed(1)}" y="${(y0 + i * (bh + gap)).toFixed(1)}" width="${Math.max(1.5, v * (w - 6) * grow).toFixed(1)}" height="${bh}" rx="1.5" fill="${col}"/>`).join('');
    };
    const cell = (x, y, bg, vals, col, op, grow = 1) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${rect(x, y, SW, SH, bg, LINE, 1)}${bars(x, y, SW, SH, vals, col, grow)}</g>`;

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d, e = st.e, f = st.f;
      const sweep = ramp(f, 0.05, 0.9), nn = Math.min(N * N - 1, Math.floor(N * N * sweep));
      const sw = f > 0.02 ? [Math.floor(nn / N), nn % N] : [I, J];                                    // which row of a and of b are in use
      const rowOp = ramp(c, 0, 0.15) * (1 - ramp(f, 0.93, 1));

      // ---- z, with the entry z_ij ----
      h += grid(Z, (r, cc) => zcol(r, cc), ramp(a, 0, 0.3));
      h += rect(Z.x + J * CELL, Z.y + I * CELL, CELL, CELL, 'none', 'var(--accent)', 3, ramp(a, 0.35, 0.6));
      h += M(150, Z.y + I * CELL + CELL / 2, 15, 'z_{ij}', ramp(a, 0.4, 0.65), { anchor: 'start', accent: true, bold: true });
      h += M(85, 228, 20, 'z', ramp(a, 0, 0.3), { bold: true }) + txt(85, 247, 13, 'a vector in', ramp(a, 0, 0.3), { muted: true }) + txt(85, 263, 13, 'every cell', ramp(a, 0, 0.3), { muted: true });

      // ---- step 2: a and b ----
      const arr = ramp(b, 0, 0.25), grow = ramp(b, 0.15, 0.4), gp = ramp(b, 0.55, 0.85);
      h += arrowTo(`M${Z.x + N * CELL + 6} 120 C 185 120, 180 85, ${GA.x - 12} 85`, GA.x - 4, 85, arr);
      h += arrowTo(`M${Z.x + N * CELL + 6} 200 C 185 200, 180 295, ${GB.x - 12} 295`, GB.x - 4, 295, arr);
      h += grid(GA, (r, cc) => acol(gated(AR, GAa, r, cc, gp)), grow);
      h += grid(GB, (r, cc) => bcol(gated(BRW, GBb, r, cc, gp)), grow);
      h += M(GA.x + (N * CELL) / 2, 18, 19, 'a', grow, { bold: true }) + M(GB.x + (N * CELL) / 2, 364, 19, 'b', grow, { bold: true });
      const side = (1 - ramp(c, 0.1, 0.3));
      h += txt(335, 66, 13, 'linear projection', ramp(b, 0.3, 0.5) * side, { muted: true, anchor: 'start' }) + txt(335, 84, 13, 'times a gate', ramp(b, 0.5, 0.7) * side, { muted: true, anchor: 'start' });
      h += txt(335, 276, 13, 'linear projection', ramp(b, 0.3, 0.5) * side, { muted: true, anchor: 'start' }) + txt(335, 294, 13, 'times a gate', ramp(b, 0.5, 0.7) * side, { muted: true, anchor: 'start' });

      // ---- step 3: row i of a and row j of b ----
      if (inc) {
        h += rect(GA.x + sw[0] * CELL - 1.5, GA.y - 1.5, CELL + 3, N * CELL + 3, 'none', CI, 3, rowOp);
        h += rect(GB.x + sw[1] * CELL - 1.5, GB.y - 1.5, CELL + 3, N * CELL + 3, 'none', CJ, 3, rowOp);
      } else {
        h += rect(GA.x - 1.5, GA.y + sw[0] * CELL - 1.5, N * CELL + 3, CELL + 3, 'none', CI, 3, rowOp);
        h += rect(GB.x - 1.5, GB.y + sw[1] * CELL - 1.5, N * CELL + 3, CELL + 3, 'none', CJ, 3, rowOp);
      }

      // ---- the recipe for one entry: the two rows, their product, the sum (the panel dims while every entry is done in turn) ----
      let p = '';
      for (let k = 0; k < N; k++) {
        const t = ramp(c, 0.2 + 0.07 * k, 0.5 + 0.07 * k);
        if (c > 0) {
          const ax = lerp(inc ? GA.x + I * CELL : GA.x + k * CELL, SX(k) - SW / 2, t), ay = lerp(inc ? GA.y + k * CELL : GA.y + I * CELL, A_Y, t), aw = lerp(CELL, SW, t), ah = lerp(CELL, SH, t);
          const bx = lerp(inc ? GB.x + J * CELL : GB.x + k * CELL, SX(k) - SW / 2, t), by = lerp(inc ? GB.y + k * CELL : GB.y + J * CELL, B_Y, t), bw = lerp(CELL, SW, t), bh = lerp(CELL, SH, t);
          p += rect(ax, ay, aw, ah, lerpColor(acol(AV[k]), A_BG, t), LINE, 1) + `<g opacity="${ramp(t, 0.75, 1).toFixed(2)}">${bars(SX(k) - SW / 2, A_Y, SW, SH, AV[k], A_BAR, 1)}</g>`;
          p += rect(bx, by, bw, bh, lerpColor(bcol(BV[k]), B_BG, t), LINE, 1) + `<g opacity="${ramp(t, 0.75, 1).toFixed(2)}">${bars(SX(k) - SW / 2, B_Y, SW, SH, BV[k], B_BAR, 1)}</g>`;
        }
        p += txt(SX(k), 20, 13, String(k), ramp(c, 0.5, 0.7), { muted: true });
      }
      p += M(488, 20, 13, 'k', ramp(c, 0.5, 0.7), { muted: true, anchor: 'end' });
      p += R(738, A_Y + SH / 2, 14, `${inc ? 'column' : 'row'} $i$ of $a$`, ramp(c, 0.6, 0.8), { anchor: 'start' })
        + R(738, B_Y + SH / 2, 14, `${inc ? 'column' : 'row'} $j$ of $b$`, ramp(c, 0.6, 0.8), { anchor: 'start' });

      // ---- step 4: multiply, entry by entry ----
      const rule = ramp(d, 0, 0.1);
      p += M(488, (A_Y + B_Y + SH) / 2, 22, '\\times', rule) + `<g opacity="${rule.toFixed(2)}"><path d="M496 ${RULE_Y} H${SX(N - 1) + SW / 2 + 4}" stroke="var(--fg)" stroke-width="2"/></g>`;
      for (let k = 0; k < N; k++) {
        const t0 = 0.12 + 0.15 * k, pt = ramp(d, t0, t0 + 0.15), pulse = ramp(d, t0 - 0.02, t0 + 0.03) * (1 - ramp(d, t0 + 0.12, t0 + 0.17));
        p += rect(SX(k) - SW / 2 - 2, A_Y - 2, SW + 4, SH + 4, 'none', 'var(--accent)', 3, pulse) + rect(SX(k) - SW / 2 - 2, B_Y - 2, SW + 4, SH + 4, 'none', 'var(--accent)', 3, pulse);
        p += cell(SX(k) - SW / 2, P_Y, P_BG, PV[k], P_BAR, pt, pt);
      }
      p += M(738, P_Y + SH / 2, 14, inc ? 'a_{ki} \\times b_{kj}' : 'a_{ik} \\times b_{jk}', ramp(d, 0.1, 0.25), { anchor: 'start' });

      // ---- step 5: the sum over k, and then the update of z_ij ----
      const lines = ramp(e, 0, 0.15), sum = ramp(e, 0.1, 0.25), sumGrow = ramp(e, 0.2, 0.45);
      for (let k = 0; k < N; k++) p += `<g opacity="${lines.toFixed(2)}"><path d="M${SX(k)} ${P_Y + SH + 3} L${S_CX} ${S_Y - 3}" stroke="var(--muted)" stroke-width="1.5"/></g>`;
      p += cell(S_CX - SW / 2, S_Y, S_BG, SN, S_BAR, sum, sumGrow) + R(S_CX - SW / 2 - 8, S_Y + SH / 2, 14, 'sum over $k$', sum, { anchor: 'end' });
      const o = ramp(e, 0.45, 0.6);
      h += `<g opacity="${(1 - 0.7 * ramp(f, 0, 0.1)).toFixed(2)}">${p}`
        + `${arrowTo(`M${OUT[0][0]} ${OUT[0][1]} C ${OUT[1][0]} ${OUT[1][1]}, ${OUT[2][0]} ${OUT[2][1]}, ${OUT[3][0]} ${OUT[3][1]}`, O.x - 2, 138, o)}`
        + txt(745, 247, 13.5, 'layer norm, linear,', ramp(e, 0.5, 0.65), { muted: true }) + R(745, 263, 13.5, 'then $\\times$ a gate from $z_{ij}$', ramp(e, 0.55, 0.7), { muted: true }) + `</g>`;

      // ---- the update: empty at first, then z_ij, then every entry in turn ----
      const ou = ramp(e, 0.3, 0.45);
      h += grid(O, (r, cc) => {
        const fill = r === I && cc === J ? ramp(e, 0.85, 0.97) : ramp(f, 0.08 + (0.7 * (r * N + cc)) / (N * N), 0.15 + (0.7 * (r * N + cc)) / (N * N));
        return fill < 0.02 ? 'var(--bg)' : lerpColor('#ffffff', ocol(OV[r][cc]), fill);
      }, ou);
      h += rect(O.x + J * CELL, O.y + I * CELL, CELL, CELL, 'none', 'var(--accent)', 3, ramp(e, 0.5, 0.6) * (1 - ramp(f, 0.04, 0.1)));
      if (f > 0.04 && f < 0.97) h += rect(O.x + sw[1] * CELL, O.y + sw[0] * CELL, CELL, CELL, 'none', 'var(--accent)', 3, 1);
      h += txt(O.x + (N * CELL) / 2, 228, 16, 'the update', ou, { bold: true }) + R(O.x + (N * CELL) / 2, 247, 13, 'added to $z$', ramp(f, 0.9, 1), { muted: true });
      // the sum travels into z_ij
      const tr = ramp(e, 0.6, 0.85);
      if (tr > 0 && tr < 1) { const [qx, qy] = along(PATH, tr); h += rect(qx - CELL / 2, qy - CELL / 2, CELL, CELL, ocol(OV[I][J]), LINE, 1); }
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="og-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="The ${inc ? 'incoming' : 'outgoing'} triangle update: z is projected into a and b; for the entry z_ij, ${inc ? 'column i of a and column j of b' : 'row i of a and row j of b'} are multiplied entry by entry and summed over k; the result becomes the update of z_ij; the same is done for every pair i, j"></svg></div>
      <div class="og-caps">${CAPTIONS[mode].map((t, i) => `<p class="og-cap reveal-in" data-show="${i + 1}">${AF3.rich(t, esc)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;
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
        const ms = [0, 2400, 6500, 6500, 6500, 7000, 7500][step], t0 = performance.now();
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
AF3.kinds.outgoing = make('outgoing');
AF3.kinds.incoming = make('incoming');
}
