// "Inside the Pairformer" (slide 37): the figure of the original (Main Fig. 2a: the pair representation on a lane above, the single
// representation on a lane below, 48 blocks) redrawn natively and played a click at a time. One block is drawn; a card opens up the
// one box that joins the two lanes:
//
//   1  two tensors go in: z, a vector for every pair of tokens, and s, a vector for every token
//   2  z goes through the pair stack: two triangle updates, two triangle attentions, a transition
//   3  attention with pair bias (z -> s): a card shows token i looking at the other tokens, with z_ij adding a bias to how much; s comes out changed
//   4  a transition on s, and the one-way rule: z steers s, s never writes back into z
//   5  the block runs 48 times; the final z and s leave
//
// Checked against the supplement, Alg. 17 (PairformerStack, N_block = 48): per block, z += TriangleMultiplicationOutgoing, Incoming,
// TriangleAttentionStartingNode, EndingNode, Transition(z), then s += AttentionPairBias(s, z) and s += Transition(s), the attention
// with the updated z. Methods 3.6: "the single representation does not influence the pair representation, the pair representation is
// used to control information flow in the single representation by biasing the Attention logits"; Alg. 1 lines 12-17: the final s and z
// go to SampleDiffusion, ConfidenceHead and DistogramHead (z), and back in for the next recycling cycle.
// Left out of the drawing: the residual "+" at each box (the figure's skip arcs), layer norms, gating, dropout and the 16 attention
// heads. The cell values, the bias and the weights are a toy (seed 4), the grids a schematic (6 tokens). The arcs in the card are the
// softmax of the bias alone: in the model, per head, the logit is q_i . k_j / sqrt(c) + b_ij with b_ij = LinearNoBias(LayerNorm(z_ij))
// (Alg. 24; its extra beta_ij is 0 in the Pairformer, Alg. 17 line 7), so the arcs show what the bias contributes, not the whole attention.
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
const SEED = 4;
const INK = '#1d2129', LINE = 'rgba(0,0,0,.3)';
const PINK = '#efc7c7', PEACH = '#f9e3c3', GREEN = '#d7ebd0';                      // the box colours of the original figure
const BLUE = '#a9d8f2', ORANGE_LIGHT = '#fde5c8', ORANGE_DEEP = '#e07a2a', TINT = '#f2a65a', NODE = '#e8c6f2', RED = '#c92a2a';
const NT = 6, I = 1;                                                              // six tokens; token i is the second

// geometry, in map units (1000 x 395)
const ZL = 122, SL = 300;                                                         // the pair lane and the single lane
const PB = [140, 236, 332, 428, 524], PW = 78, PY = 74, PH = 96;                  // the five pair boxes
const BR = 644;                                                                   // where z branches down to the attention
const SPB = { x: 596, w: 96, y: SL - 46, h: 92 }, STR = { x: 738, w: 78, y: SL - 34, h: 68 };
const S_GAP = (SPB.x + SPB.w + STR.x) / 2, S_TR = STR.x + STR.w / 2, S_REST = 868; // s between the two boxes, in the transition, after it
const IN_X = 58, OUT_X = 962, LANE_END = 934;
const LOOP_L = 124, LOOP_R = 904, ARC_Y = 54, LOOP_B = 372;
const K = 8;                                                                      // a cell of z (square) and the width of a cell of s
const PBOX = [
  { t: ['Triangle', 'update', 'outgoing'], c: PEACH }, { t: ['Triangle', 'update', 'incoming'], c: PEACH },
  { t: ['Triangle', 'attention', 'starting'], c: PINK }, { t: ['Triangle', 'attention', 'ending'], c: PINK }, { t: ['Tran-', 'sition'], c: GREEN },
];
const CARD = { x: 136, y: 182, w: 450, h: 100 };

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
  'Two tensors go in: the pair representation z, a vector for every pair of tokens, and the single representation s, a vector for every token.',
  'z is rewritten first, by five pair operations: two triangle updates, two triangle attentions and a transition. The next slides open up the triangle ones.',
  'Then s is rewritten by attention over the tokens. z biases that attention: z_ij adds a bias to how much token i looks at token j.',
  'A transition follows on s. Information flows one way: z steers s, but s never writes back into z.',
  'The block runs 48 times, each time on the result of the one before. The final z and s go on to the diffusion module and the confidence head.',
];

AF3.kinds.pairformer = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .pf-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .pf-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .pf-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .pf-t.muted { fill: var(--muted); }
      .pf-t.ink { fill: ${INK}; }
      .pf-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .pf-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .pf-cap sub { font-size: .7em; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // ---- the toy data ----
    const rand = rng(SEED);
    const ZV = Array.from({ length: NT }, () => Array.from({ length: NT }, () => rand()));
    const S0 = [0.65, -0.4, 0.2, -0.7, 0.45, -0.1];                          // s, one number per token (a stand-in for its vector)
    const BM = Array.from({ length: NT }, (_, i) => Array.from({ length: NT }, (_, j) => (i === j ? 0.5 : 0.1 + rand() * 0.3)));   // the bias z gives each pair
    [[1, 4, 1], [1, 2, 0.7], [0, 3, 0.9], [2, 5, 0.8]].forEach(([i, j, v]) => { BM[i][j] = v; BM[j][i] = v; });
    const WM = BM.map((row) => { const e = row.map((v) => Math.exp(3 * v)), t = e.reduce((a, b) => a + b, 0); return e.map((v) => v / t); });   // softmax over the tokens
    const SA = WM.map((row) => row.reduce((t, w, j) => t + w * S0[j], 0));    // after the attention: each token a weighted average of all
    const ST = SA.map((v) => Math.max(-1, Math.min(1, v * 1.6)));             // after the transition (a stand-in: it sharpens)

    // ---- helpers ----
    const mcol = (v) => lerpColor(ORANGE_LIGHT, ORANGE_DEEP, Math.max(0, Math.min(1, (v + 1) / 2)));
    const zcol = (i, j, con) => shade(shade(BLUE, (ZV[i][j] - 0.5) * 0.3), (ZV[i][j] - 0.5) * 0.7 * con);
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="pf-t${o.muted ? ' muted' : ''}${o.ink ? ' ink' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const head = (x, y, dir, c = 'var(--accent)') => {
      const p = { right: [[0, 0], [-10, -5.5], [-10, 5.5]], left: [[0, 0], [10, -5.5], [10, 5.5]], up: [[0, 0], [-5.5, 10], [5.5, 10]], down: [[0, 0], [-5.5, -10], [5.5, -10]] }[dir];
      return `<polygon points="${p.map(([a, b]) => `${(x + a).toFixed(1)},${(y + b).toFixed(1)}`).join(' ')}" fill="${c}"/>`;
    };
    const path = (d, op, c = 'var(--accent)', w = 2.5, dash = '') => op < 0.01 ? '' : `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${op.toFixed(2)}"/>`;
    // an arrow whose shaft stops where its head begins
    const seg = (x1, y1, x2, y2, op, dir, c = 'var(--accent)') => {
      if (op < 0.01) return '';
      const sx = { right: 10, left: -10, up: 0, down: 0 }[dir], sy = { up: -10, down: 10, right: 0, left: 0 }[dir];
      return `<g opacity="${op.toFixed(2)}">${path(`M${x1} ${y1} L${x2 - sx + Math.sign(sx)} ${y2 - sy + Math.sign(sy)}`, 1, c)}${head(x2, y2, dir, c)}</g>`;
    };
    const cells = (x0, y0, cw, ch, nr, nc, col, op = 1, stroke = LINE) => {
      let g = '';
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) g += `<rect x="${(x0 + c * cw).toFixed(1)}" y="${(y0 + r * ch).toFixed(1)}" width="${cw}" height="${ch}" fill="${col(r, c)}" stroke="${stroke}" stroke-width="1"/>`;
      return op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${g}</g>`;
    };
    const zIcon = (cx, cy, k, con, op) => cells(cx - NT * k / 2, cy - NT * k / 2, k, k, NT, NT, (r, c) => zcol(r, c, con), op);
    const sIcon = (cx, cy, k, vals, op) => cells(cx - NT * k / 2, cy - k * 0.7, k, k * 1.4, 1, NT, (r, c) => mcol(vals[c]), op);
    const box = (x, y, w, h, lines, fill, act, size = 13.5) => {
      let g = act > 0.02 ? `<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="12" fill="var(--accent)" opacity="${(0.22 * act).toFixed(2)}"/>` : '';
      g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="var(--bg)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${act > 0.5 ? 'var(--accent)' : 'rgba(0,0,0,.4)'}" stroke-width="${act > 0.5 ? 3.5 : 1.5}"/>`;
      const lh = size + 3.5, y0 = y + h / 2 - ((lines.length - 1) * lh) / 2;
      return g + lines.map((l, i) => `<text x="${x + w / 2}" y="${(y0 + i * lh).toFixed(1)}" font-size="${size}" text-anchor="middle" class="pf-t ink">${l}</text>`).join('');
    };

    // ---- the card (step 3): token i looks at the other tokens, and z row i says how much ----
    const biasCard = (c, op) => {
      if (op < 0.01) return '';
      const CX = (j) => 160 + 40 * j, ZY = 190, DY = 236, R = 9;
      const o = (p) => (op * p).toFixed(2);
      const rowOn = ramp(c, 0.34, 0.46), tintOn = ramp(c, 0.42, 0.54), arcsOn = ramp(c, 0.52, 0.72), txtOn = ramp(c, 0.48, 0.6);
      let g = `<g opacity="${o(1)}"><rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="12" fill="var(--bg)" stroke="var(--accent)" stroke-width="2.5"/></g>`;
      // the arcs from token i, under the dots
      for (let j = 0; j < NT; j++) {
        if (j === I) continue;
        const x1 = CX(I), x2 = CX(j), yb = DY + R, off = 8 + 6.5 * Math.abs(j - I);
        g += `<g opacity="${o(arcsOn)}">${path(`M${x1} ${yb} Q${(x1 + x2) / 2} ${yb + off} ${x2} ${yb}`, 1, 'var(--accent)', 1.2 + 9 * WM[I][j] * arcsOn)}</g>`;
      }
      // z row i: one cell per token, tinted by the bias, with a tick down to its token
      for (let j = 0; j < NT; j++) {
        g += `<g opacity="${o(rowOn)}"><rect x="${CX(j) - 16}" y="${ZY}" width="32" height="14" fill="${lerpColor(BLUE, TINT, BM[I][j] * tintOn)}" stroke="${LINE}"/>${path(`M${CX(j)} ${ZY + 14} L${CX(j)} ${DY - R}`, 1, 'var(--muted)', 1.5)}</g>`;
      }
      // the tokens
      for (let j = 0; j < NT; j++) {
        g += `<g opacity="${o(1)}"><circle cx="${CX(j)}" cy="${DY}" r="${R}" fill="${NODE}" stroke="${j === I ? 'var(--accent)' : LINE}" stroke-width="${j === I ? 3 : 1}"/></g>`;
      }
      g += txt(CX(I), DY + 1, 12, 'i', op, { ink: true, bold: true });
      g += txt(394, 197, 14, 'row i of z', op * rowOn, { muted: true, anchor: 'start' });
      g += `<text x="394" y="226" font-size="14.5" class="pf-t" opacity="${o(txtOn)}">z<tspan dy="4" font-size="75%">ij</tspan><tspan dy="-4"> biases how much</tspan></text>`;
      g += txt(394, 246, 14.5, 'token i looks at token j', op * txtOn, { anchor: 'start' });
      g += txt(394, 266, 14, 'thicker arc: more attention', op * ramp(c, 0.6, 0.72), { muted: true, anchor: 'start' });
      return g;
    };

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d, e = st.e;
      const inOp = ramp(a, 0, 0.5);

      // ---- the frame of the block, the lanes and the loops ----
      h += `<rect x="108" y="10" width="812" height="378" rx="18" fill="none" stroke="var(--muted)" stroke-opacity=".4" stroke-width="2"/>`;
      h += seg(90, ZL, PB[0] - 2, ZL, 0.75, 'right');
      for (let k = 0; k < 4; k++) h += seg(PB[k] + PW, ZL, PB[k + 1] - 2, ZL, 0.75, 'right');
      h += seg(PB[4] + PW, ZL, LANE_END, ZL, 0.75, 'right') + seg(BR, ZL, BR, SPB.y - 2, 0.75, 'down');
      h += seg(90, SL, SPB.x - 2, SL, 0.75, 'right') + seg(SPB.x + SPB.w, SL, STR.x - 2, SL, 0.75, 'right') + seg(STR.x + STR.w, SL, LANE_END, SL, 0.75, 'right');
      const lap = (k) => ramp(e, 0.04 + 0.26 * k, 0.3 + 0.26 * k);
      const lit = ramp(e, 0.04, 0.12) * (1 - ramp(e, 0.85, 1)) * 0.5;
      h += path(`M${LOOP_R} ${ZL} V${ARC_Y} H${LOOP_L} V${ZL - 4}`, 0.5 + lit, 'var(--accent)', 2.5, '7 6') + head(LOOP_L, ZL - 3, 'down').replace('<polygon', `<polygon opacity="${(0.5 + lit).toFixed(2)}"`);
      h += path(`M${LOOP_R} ${SL} V${LOOP_B} H${LOOP_L} V${SL + 4}`, 0.5 + lit, 'var(--accent)', 2.5, '7 6') + head(LOOP_L, SL + 3, 'up').replace('<polygon', `<polygon opacity="${(0.5 + lit).toFixed(2)}"`);

      // ---- where the tensors are ----
      const zx = lerp(lerp(IN_X, BR, ramp(b, 0.04, 0.96)), OUT_X, ramp(e, 0.86, 1));
      const sx = IN_X + (BR - IN_X) * ramp(c, 0, 0.32) + (S_GAP - BR) * ramp(c, 0.82, 1) + (S_TR - S_GAP) * ramp(d, 0, 0.3) + (S_REST - S_TR) * ramp(d, 0.62, 0.92) + (OUT_X - S_REST) * ramp(e, 0.86, 1);
      const zCon = ramp(b, 0.05, 0.95);
      const sVals = S0.map((v, i) => lerp(lerp(lerp(v, SA[i], ramp(c, 0.6, 0.8)), ST[i], ramp(d, 0.3, 0.55)), ST[i], 1));
      // the pair boxes light while z is passing through them
      const under = (k) => (b > 0 && b < 1 ? Math.max(0, 1 - Math.abs(zx - (PB[k] + PW / 2)) / 44) : 0);

      // ---- the tensors (drawn under the boxes, so they pass behind them) ----
      h += `<circle cx="${BR}" cy="${ZL}" r="4.5" fill="var(--accent)"/>`;   // the branch: z rests on it, then moves on
      h += zIcon(zx, ZL, K, zCon, inOp);
      h += sIcon(sx, SL, K, sVals, inOp);
      // z's copy down to the attention
      const zc = ramp(c, 0.1, 0.4);
      if (c > 0.1 && c < 0.42) h += zIcon(BR, lerp(ZL + 26, SPB.y + 18, zc), 4, 1, 0.95);

      // ---- the boxes over them ----
      PBOX.forEach((p, k) => { h += box(PB[k], PY, PW, PH, p.t, p.c, under(k), 13); });
      h += box(SPB.x, SPB.y, SPB.w, SPB.h, ['Attention', 'with', 'pair bias'], PINK, ramp(c, 0.34, 0.44) * (1 - ramp(c, 0.8, 0.9)), 13.5);
      h += box(STR.x, STR.y, STR.w, STR.h, ['Tran-', 'sition'], GREEN, ramp(d, 0.12, 0.22) * (1 - ramp(d, 0.5, 0.6)), 13);

      // ---- labels ----
      h += txt(IN_X, 78, 21, 'z', inOp, { bold: true }) + txt(IN_X, 156, 13, 'a vector for', inOp, { muted: true }) + txt(IN_X, 172, 13, 'each pair', inOp, { muted: true }) + txt(IN_X, 188, 13, 'of tokens', inOp, { muted: true });
      h += txt(IN_X, 266, 21, 's', inOp, { bold: true }) + txt(IN_X, 328, 13, 'a vector for', inOp, { muted: true }) + txt(IN_X, 344, 13, 'each token', inOp, { muted: true });
      h += txt(OUT_X, 78, 21, 'z', ramp(e, 0.92, 1), { bold: true }) + txt(OUT_X, 266, 21, 's', ramp(e, 0.92, 1), { bold: true });

      // ---- the laps of the loop (step 5): copies of z and s go round again ----
      for (let k = 0; k < 3; k++) {
        const u = lap(k);
        if (u > 0 && u < 1) {
          const [qx, qy] = along([[LOOP_R, ZL], [LOOP_R, ARC_Y], [LOOP_L, ARC_Y], [LOOP_L, ZL]], u), [rx, ry] = along([[LOOP_R, SL], [LOOP_R, LOOP_B], [LOOP_L, LOOP_B], [LOOP_L, SL]], u);
          h += zIcon(qx, qy, 4, 1, 0.95) + sIcon(rx, ry, 4, ST, 0.95);
        }
      }
      h += `<rect x="${(LOOP_L + LOOP_R) / 2 - 50}" y="0" width="100" height="22" fill="var(--bg)"/>` + txt((LOOP_L + LOOP_R) / 2, 11, 16, '48 blocks', 1, { bold: true });
      // 48 ticks, one lit per finished block
      const done = ramp(d, 0.9, 1) + 47 * ramp(e, 0.04, 0.84);
      for (let i = 0; i < 48; i++) h += `<rect x="${(514 - 124.8 + i * 5.2).toFixed(1)}" y="26" width="3.6" height="8" rx="1" fill="${i < done ? 'var(--accent)' : 'color-mix(in srgb, var(--muted) 30%, transparent)'}"/>`;

      // ---- the card (step 3) and the one-way rule (step 4) ----
      h += biasCard(c, ramp(c, 0.28, 0.38) * (1 - ramp(d, 0, 0.12)));
      const one = ramp(d, 0.45, 0.62);
      if (one > 0.01) {
        h += `<g opacity="${one.toFixed(2)}">${path(`M380 292 L380 192`, 1, 'var(--muted)', 2.5, '6 5')}${head(380, 178, 'up', 'var(--muted)')}`
          + `<circle cx="380" cy="236" r="12" fill="var(--bg)" stroke="${RED}" stroke-width="2.5"/><path d="M374 230 L386 242 M386 230 L374 242" stroke="${RED}" stroke-width="2.5" stroke-linecap="round"/></g>`
          + txt(404, 236, 15.5, 's never writes back into z', one, { anchor: 'start' });
      }
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="pf-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Inside the Pairformer: the pair representation goes through two triangle updates, two triangle attentions and a transition; it then biases an attention over the single representation, which is followed by a transition; the block runs 48 times; the single representation never writes back into the pair representation"></svg></div>
      <div class="pf-caps">${CAPTIONS.map((t, i) => `<p class="pf-cap reveal-in" data-show="${i + 1}">${esc(t).replace(/z_([a-z]{2})/g, 'z<sub>$1</sub>')}</p>`).join('')}</div>
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
        const ms = [0, 3800, 7000, 8000, 5500, 7500][step], t0 = performance.now();
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
