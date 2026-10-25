// "Apply attention at the token-level" (slide 47): the figure of the original (Simon, The Illustrated AlphaFold: Overview of Diffusion
// Transformer; 1 adaptive layer norm, 2 single attention with pair bias, 3 conditioned gating, 4 conditioned transition) redrawn on
// tensors and played a click at a time. s sits above a, one column per token, so what it does to each token can be seen:
//
//   1  a (a vector per token, 768 numbers), s (a vector per token, 384 numbers, with the noise level in it) and z (a vector per pair)
//   2  adaptive layer norm: a is normalised, then scaled and shifted by two vectors that linear layers compute from s, token by token
//   3  attention with pair bias: every token attends to every token, z adds a bias for each pair; the result is an update for each token
//   4  a gate from s scales the update, then it is added back to a
//   5  the transition: the same recipe with an MLP in place of the attention; each token goes through it alone
//   6  four steps make a block; 24 blocks; the final a goes to the atom decoder
//
// Checked against the reference code (codebases/alphafold3, model/network/diffusion_transformer.py) and the supplement. adaptive_layernorm
// (Alg. 26): x = LayerNorm(x, no scale, no offset); s = LayerNorm(s); x = sigmoid(Linear(s)) * x + LinearNoBias(s). adaptive_zero_init (the
// adaLN-Zero output gate, Algs. 24 line 13 and 25 line 3): output = sigmoid(Linear(s, bias init -2)) * Linear(x). self_attention: adaptive
// layer norm, then q, k, v, logits = q.k / sqrt(d) + the pair logits from z (LayerNorm, then Linear to one number per head), softmax, a
// weighted average of the values times the usual gate from x, then the output gate from s. transition_block: adaptive layer norm, a SwiGLU
// MLP with twice as many hidden numbers (n = 2), then the output gate from s. Transformer: for each of 24 blocks, act += self_attention(act);
// act += transition_block(act) (16 heads). Alg. 20 lines 4-7: a += LinearNoBias(LayerNorm(s)); the transformer; LayerNorm(a); the atom decoder.
// Alg. 21 lines 8-9: the noise level is embedded and added to s. c_token = 768 (Alg. 20), c_s = 384 (Alg. 21).
// The code adds the attention output to a and then the transition output to the updated a; Alg. 23 line 3 is written differently
// (b + Transition(a)), and the drawing follows the code. Left out: the 16 heads (one block is drawn as if it had one), the per-head gate
// inside the attention, and the layer norm on s. The rows are a schematic (10 stand for 768, 5 for 384), every cell value, weight and gate is made
// up (seeded, listed on the References slide).
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v) => Math.max(0, Math.min(1, v));
const rgb = (hex) => { const v = parseInt(hex.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const shade = (h, k) => hex(rgb(h).map((x) => (k > 0 ? x + (255 - x) * k : x * (1 + k))));   // k > 0 lighter, k < 0 darker
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const SEED = 7;
const LINE = 'rgba(0,0,0,.28)', CI = '#e8590c';
const SV = '#d4a8e8', AV = '#e8c3f4', ZB = '#a9d8f2';                          // s, a, z (as on slides 41 and 46)
const AMB = '#f59f00', GRN = '#2f9e44', PNK = '#c2255c';                       // scale, shift, gate (the gate is pink on slides 40 and 41)
const INK = { s: '#9c36b5', a: '#a050c0', z: '#2b7bb9' };                      // letters, darker so they read on both themes

const N = 5, AR = 10, SR = 5, RH = 12, CWID = 46, PITCH = 76;                  // five tokens; 10 rows stand for 768 numbers, 5 for 384
const X0 = 70, XU = 540, S_Y = 24, A_Y = 166;                                   // a and s on the left, the update on the right
const ZX = 500, ZY = 14, ZC = 26;                                               // z, top middle
const colX = (x0, i) => x0 + i * PITCH + 16;                                    // the cells of token i; a scale bar sits left of them, a shift bar right
const BAR_L = (x0, i) => x0 + i * PITCH + 4, BAR_R = (x0, i) => x0 + i * PITCH + 66, BW = 8;
const GATE = [0.9, 0.35, 0.7, 0.2, 0.55], GATE2 = [0.3, 0.8, 0.5, 0.9, 0.25];   // the gates, one per token (toy; really one per number)

const CAPTIONS = [
  'The token-level transformer works on $a$, one vector for each token. It is conditioned by $s$, a vector for each token that carries the noise level, and by $z$, a vector for each pair of tokens.',
  "Step 1, adaptive layer norm: each token's vector is normalised, then scaled and shifted by numbers that linear layers compute from that token's $s$. This is how $s$, and the noise level in it, steers every block.",
  'Step 2, attention with pair bias: every token attends to every token, and $z$ adds a bias for each pair, as in the Pairformer. The result is an update for each token.',
  'Step 3, a gate: numbers computed from $s$ scale the update, token by token, before it is added back to $a$. So $s$ decides how much of the attention gets through.',
  'Step 4, the transition: the same recipe again, with an MLP in place of the attention. Each token goes through the MLP on its own, so the tokens do not talk to each other here.',
  'These four steps make one block, and the transformer stacks 24 of them. The final $a$ goes to the atom decoder, which turns it back into an update for each atom.',
];
const CHIPS = [['1', 'Adaptive layer norm', 40, 232], ['2', 'Attention with pair bias', 290, 282], ['3', 'Gate', 590, 118], ['4', 'Transition', 726, 130]];   // number, name, x, width

AF3.kinds.ditblock = (s) => ({
  steps: 6,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .dt-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .dt-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .dt-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .dt-t.muted { fill: var(--muted); }
      .dt-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .dt-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // ---- the toy data: every cell is a made-up value in [0, 1], drawn as a shade ----
    const rand = rng(SEED);
    const mat = (rows, cols) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => rand()));
    const VA0 = mat(AR, N), BS = mat(AR, N), BH = mat(AR, N), BS2 = mat(AR, N), BH2 = mat(AR, N), BG = mat(AR, N), BG2 = mat(AR, N);
    const VU = mat(AR, N), VU2 = mat(AR, N), VH = mat(2 * AR, N), VAF = mat(AR, N), ZV = mat(N, N), SVV = mat(SR, N);
    const WG = Array.from({ length: N }, () => Array.from({ length: N }, () => 0.1 + 0.9 * rand()));
    const mean = (i) => VA0.reduce((t, row) => t + row[i], 0) / AR;
    const VN = VA0.map((row) => row.map((v, i) => clamp(0.5 + (v - mean(i)) * 0.8)));                              // after the layer norm
    const VA1 = VN.map((row, j) => row.map((v, i) => clamp(0.5 + (v - 0.5) * (0.5 + BS[j][i]) + (BH[j][i] - 0.5) * 0.4)));   // scaled and shifted
    const VA2 = VA1.map((row, j) => row.map((v, i) => clamp(v + (VU[j][i] - 0.5) * 0.9 * GATE[i])));               // plus the gated attention
    const VA3 = VA2.map((row, j) => row.map((v, i) => clamp(0.5 + (v - 0.5) * (0.6 + 0.8 * BS2[j][i]) + (BH2[j][i] - 0.5) * 0.3)));
    const VA4 = VA3.map((row, j) => row.map((v, i) => clamp(v + (VU2[j][i] - 0.5) * 0.9 * GATE2[i])));              // plus the gated MLP

    // ---- helpers ----
    const col = (base, v) => shade(base, (v - 0.5) * 0.5);
    const tag = (l) => `$\\textcolor{${INK[l]}}{${l}}$`;                                                              // the letter of a tensor, in the colour of its cells
    const mtxt = (x, y, size, str, op, o = {}) => AF3.svgRich(x, y, size, str, { ...o, op });   // a label with math: KaTeX between dollar signs
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : String(str).includes('$') ? mtxt(x, y, size, str, op, o) : `<text x="${x}" y="${y}" font-size="${size}" class="dt-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const cell = (x, y, w, h, fill, op = 1) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${LINE}" stroke-width="0.8" opacity="${op.toFixed(2)}"/>`;
    const arrow = (pts, op, o = {}) => {                                                                             // a polyline with a head; the shaft stops under the head
      if (op < 0.01) return '';
      const c = o.col || 'var(--accent)', w = o.w || 2.5, hl = o.hl || 10, hw = o.hw || 5.5, n = pts.length;
      const [x1, y1] = pts[n - 2], [x2, y2] = pts[n - 1], len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const bx = x2 - ux * hl, by = y2 - uy * hl;
      const d = pts.slice(0, n - 1).concat(o.noHead ? [[x2, y2]] : [[bx, by]]).map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
      const head = o.noHead ? '' : `<polygon points="${x2},${y2} ${(bx - uy * hw).toFixed(1)},${(by + ux * hw).toFixed(1)} ${(bx + uy * hw).toFixed(1)},${(by - ux * hw).toFixed(1)}" fill="${c}"/>`;
      return `<g opacity="${op.toFixed(2)}"><path d="M${d}" fill="none" stroke="${c}" stroke-width="${w}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linejoin="round"/>${head}</g>`;
    };
    const arc = (x1, x2, y, h, w, op) => op < 0.01 ? '' : `<path d="M${x1} ${y} Q ${(x1 + x2) / 2} ${y - 2 * h} ${x2} ${y}" fill="none" stroke="var(--accent)" stroke-width="${w.toFixed(1)}" stroke-linecap="round" opacity="${op.toFixed(2)}"/>`;
    // the columns of a matrix: one per token, values from valFn(row, token), at the x given by xFn(token)
    const columns = (y0, rows, rh, valFn, base, opFn, xFn) => {
      let g = '';
      for (let i = 0; i < N; i++) {
        const op = opFn(i);
        if (op < 0.01) continue;
        for (let j = 0; j < rows; j++) g += cell(xFn(i), y0 + j * rh, CWID, rh, col(base, valFn(j, i)), op);
      }
      return g;
    };
    const bars = (x0, side, vals, base, op) => {                                                                   // a thin vector beside each column
      if (op < 0.01) return '';
      let g = '';
      for (let i = 0; i < N; i++) for (let j = 0; j < AR; j++) g += cell(side(x0, i), A_Y + j * RH, BW, RH, col(base, vals[j][i]), op);
      return g;
    };
    const fan = (op, o = {}) => {                                                                                  // from the column of s to its scale bar and shift bar
      let g = '';
      for (let i = 0; i < N; i++) {
        const sx = colX(X0, i) + CWID / 2, sy = S_Y + SR * RH + 4;
        g += arrow([[sx, sy], [BAR_L(X0, i) + BW / 2, A_Y - 6]], op, { w: 1.6, hl: 6, hw: 3.5, col: AMB }) + arrow([[sx, sy], [BAR_R(X0, i) + BW / 2, A_Y - 6]], op, { w: 1.6, hl: 6, hw: 3.5, col: GRN });
      }
      return g;
    };
    const bus = (op) => {                                                                                          // s to the gate of each token's update
      if (op < 0.01) return '';
      let g = arrow([[X0 + N * PITCH + 2, S_Y + 30], [480, S_Y + 30], [480, 120], [XU + N * PITCH - 6, 120]], op, { w: 2, noHead: true });
      for (let i = 0; i < N; i++) g += arrow([[BAR_L(XU, i) + BW / 2, 120], [BAR_L(XU, i) + BW / 2, A_Y - 6]], op, { w: 1.6, hl: 6, hw: 3.5, col: PNK });
      return g + txt(XU + (N * PITCH) / 2, 106, 13, 'gate, from $s$', op, { muted: true });
    };

    const draw = (st) => {
      const { a, b, c, d, e, f } = st;
      let h = '';
      const at = ramp(a, 0, 0.3);

      // ---- a: the values it has after each step (the chain only ever moves forward, so a jump to any step is exact) ----
      const sw = ramp(c, 0.1, 0.95), k0 = Math.min(N - 1, Math.floor(sw * N));
      const addD = ramp(d, 0.75, 1), addE = ramp(e, 0.8, 1), fin = ramp(f, 0.1, 0.7);
      const aVal = (j, i) => {
        let v = lerp(VA0[j][i], VN[j][i], ramp(b, 0.1, 0.35));
        v = lerp(v, VA1[j][i], ramp(b, 0.5, 0.8));
        v = lerp(v, VA2[j][i], ramp(addD, 0.4, 1));
        v = lerp(v, VA3[j][i], ramp(e, 0.1, 0.25));
        v = lerp(v, VA4[j][i], ramp(addE, 0.4, 1));
        return lerp(v, VAF[j][i], fin);
      };
      h += columns(A_Y, AR, RH, aVal, AV, () => at, (i) => colX(X0, i));
      h += columns(S_Y, SR, RH, (j, i) => SVV[j][i], SV, () => at, (i) => colX(X0, i));
      h += txt(62, S_Y + 20, 19, tag('s'), at, { anchor: 'end' }) + txt(62, S_Y + 38, 12, '384 each', at, { anchor: 'end', muted: true });
      h += txt(62, A_Y + 52, 19, tag('a'), at, { anchor: 'end' }) + txt(62, A_Y + 70, 12, '768 each', at, { anchor: 'end', muted: true });

      // ---- z: the pair conditioning, up to the attention ----
      const zOp = at * (1 - ramp(d, 0, 0.2));
      if (zOp > 0.01) {
        let g = '';
        for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) g += cell(ZX + q * ZC, ZY + r * ZC, ZC, ZC, col(ZB, ZV[r][q]), 1);
        h += `<g opacity="${zOp.toFixed(2)}">${g}</g>` + txt(ZX + (N * ZC) / 2, ZY + N * ZC + 16, 13, `${tag('z')}: a vector for each pair`, zOp);
      }

      // ---- step 2: s gives each token a scale and a shift ----
      const f1 = ramp(b, 0.05, 0.3) * (1 - ramp(b, 0.85, 1)), bOp = ramp(b, 0.2, 0.45) * (1 - ramp(b, 0.85, 1));
      h += fan(f1) + bars(X0, BAR_L, BS, AMB, bOp) + bars(X0, BAR_R, BH, GRN, bOp);
      // the same again before the MLP (step 5), quickly
      const e1 = ramp(e, 0, 0.12) * (1 - ramp(e, 0.16, 0.26));
      h += fan(e1 * 0.9) + bars(X0, BAR_L, BS2, AMB, e1) + bars(X0, BAR_R, BH2, GRN, e1);
      const leg = Math.max(bOp, e1);
      h += rect(150, 305, 10, 10, AMB, LINE, 1, leg) + txt(166, 310, 13, 'scale', leg, { anchor: 'start', muted: true }) + rect(216, 305, 10, 10, GRN, LINE, 1, leg) + txt(232, 310, 13, 'shift, both computed from $s$', leg, { anchor: 'start', muted: true });

      // ---- step 3: the attention; the update fills in token by token ----
      const cOp = ramp(c, 0, 0.05) * (1 - ramp(d, 0, 0.1));
      if (cOp > 0.01) {
        const x1 = colX(X0, k0) + CWID / 2, ay = A_Y - 2;
        for (let j = 0; j < N; j++) if (j !== k0) h += arc(x1, colX(X0, j) + CWID / 2, ay, 8 + 0.09 * Math.abs(j - k0) * PITCH, 1 + 5 * WG[k0][j], cOp);
        h += rect(colX(X0, k0) - 2, A_Y - 2, CWID + 4, AR * RH + 4, 'none', CI, 3, cOp, 3);
        h += rect(ZX - 2, ZY + k0 * ZC - 2, N * ZC + 4, ZC + 4, 'none', CI, 3, cOp * zOp, 2);
        h += arrow([[ZX - 6, ZY + k0 * ZC + ZC / 2], [462, 150]], cOp * zOp, { w: 2 });
      }
      h += arrow([[456, A_Y + (AR * RH) / 2], [XU - 8, A_Y + (AR * RH) / 2]], ramp(c, 0.05, 0.2) * (1 - ramp(d, 0.7, 0.9)), { w: 2 });
      h += txt((456 + XU - 8) / 2, A_Y + (AR * RH) / 2 - 16, 13, 'attention', ramp(c, 0.05, 0.2) * (1 - ramp(d, 0.7, 0.9)), { muted: true });
      const uOp = (i) => ramp(sw * N, i + 0.3, i + 1);

      // ---- step 4: the gate scales the update; it is added to a ----
      const gT = ramp(d, 0.5, 0.7), gBar = ramp(d, 0.3, 0.5) * (1 - ramp(d, 0.72, 0.82));
      h += bus(ramp(d, 0.2, 0.4) * (1 - ramp(d, 0.82, 0.92)));
      h += bars(XU, BAR_L, BG, PNK, gBar);
      h += columns(A_Y, AR, RH, (j, i) => VU[j][i], AV, (i) => uOp(i) * lerp(1, GATE[i], gT) * (1 - ramp(addD, 0.55, 1)), (i) => lerp(colX(XU, i), colX(X0, i), addD));

      // ---- step 5: the MLP; each token alone, wider inside; the gate; added ----
      const t1 = ramp(e, 0.28, 0.6), eg = ramp(e, 0.6, 0.72), eOp = ramp(e, 0.26, 0.34) * (1 - ramp(e, 0.84, 0.92));
      h += arrow([[456, A_Y + (AR * RH) / 2], [XU - 8, A_Y + (AR * RH) / 2]], ramp(e, 0.2, 0.3) * (1 - ramp(e, 0.84, 0.94)), { w: 2 });
      h += txt((456 + XU - 8) / 2, A_Y + (AR * RH) / 2 - 16, 13, 'MLP', ramp(e, 0.2, 0.3) * (1 - ramp(e, 0.84, 0.94)), { muted: true });
      const small = (1 - ramp(t1, 0.15, 0.4)) + ramp(t1, 0.6, 0.85), big = ramp(t1, 0.15, 0.4) * (1 - ramp(t1, 0.6, 0.85));
      const eMove = (i) => lerp(colX(XU, i), colX(X0, i), addE), eFade = (i) => eOp * lerp(1, GATE2[i], eg) * (1 - ramp(addE, 0.55, 1));
      h += columns(A_Y, AR, RH, (j, i) => lerp(VA3[j][i], VU2[j][i], ramp(t1, 0.5, 0.8)), AV, (i) => eFade(i) * Math.min(1, small), eMove);
      h += columns(A_Y - 18, 2 * AR, RH * 0.65, (j, i) => VH[j][i], AV, (i) => eFade(i) * big, eMove);
      h += bus(ramp(e, 0.58, 0.68) * (1 - ramp(e, 0.84, 0.92)));
      h += bars(XU, BAR_L, BG2, PNK, ramp(e, 0.62, 0.72) * (1 - ramp(e, 0.84, 0.92)));
      h += txt(XU + (N * PITCH) / 2, A_Y + 152, 13, 'twice as many numbers inside', big * ramp(e, 0.3, 0.4), { muted: true });

      // ---- step 6: 24 blocks, then the atom decoder ----
      const n = 1 + Math.floor(23.99 * ramp(f, 0.08, 0.7)), cn = ramp(f, 0.03, 0.12);
      h += txt(XU + (N * PITCH) / 2, A_Y + 44, 22, `block ${n} of 24`, cn, { bold: true }) + txt(XU + (N * PITCH) / 2, A_Y + 70, 13, 'the same four steps in every block', cn, { muted: true });
      h += arrow([[456, A_Y + (AR * RH) / 2 + 50], [880, A_Y + (AR * RH) / 2 + 50]], ramp(f, 0.75, 0.95), {});
      h += txt(668, A_Y + (AR * RH) / 2 + 70, 13, 'to the atom decoder', ramp(f, 0.8, 1), { muted: true });

      // ---- the four steps, as a row of chips: the one in play is outlined ----
      const reach = [b, c, d, e].map((k) => ramp(k, 0, 0.1));
      CHIPS.forEach(([num, name, x, w], i) => {
        const lit = reach[i], cur = lit - (i < 3 ? reach[i + 1] : ramp(f, 0, 0.1)), op = ramp(a, 0.2, 0.5) * (0.45 + 0.55 * lit);
        h += rect(x, 346, w, 34, 'var(--bg)', 'var(--muted)', 1.5, op, 8);
        h += cur > 0.02 ? `<rect x="${x}" y="346" width="${w}" height="34" rx="8" style="fill:color-mix(in srgb, var(--accent) 14%, var(--bg))" stroke="var(--accent)" stroke-width="3" opacity="${cur.toFixed(2)}"/>` : '';
        h += txt(x + 14, 363, 14, `<tspan font-weight="700">${num}</tspan>  ${name}`, op, { anchor: 'start' });
      });
      h += txt(992, 363, 16, '$\\times 24$ blocks', ramp(f, 0.03, 0.12), { anchor: 'end', bold: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="dt-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="One block of the diffusion transformer at token level: an adaptive layer norm that scales and shifts each token's vector using numbers computed from s; attention between all tokens with a bias from z, giving an update; a gate computed from s that scales the update before it is added to a; a transition with an MLP, the same recipe without attention; 24 such blocks; the result goes to the atom decoder"></svg></div>
      <div class="dt-caps">${CAPTIONS.map((t, i) => `<p class="dt-cap reveal-in" data-show="${i + 1}">${AF3.rich(t, esc)}</p>`).join('')}</div>
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
        const ms = [0, 2400, 6500, 7500, 6500, 9000, 7500][step], t0 = performance.now();
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
