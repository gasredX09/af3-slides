// "Inside the Diffusion Module" (slide 45): the figure of the original (Simon, The Illustrated AlphaFold: 1a-1b the conditioning, 2a-2f the atom
// level, 3a the token level, 4a-4c back to atoms) redrawn as the one idea it carries, atoms first, then tokens, then atoms again, and played a
// click at a time. Slides 46 and 47 zoom into the two halves, so this one stays at the level of the flow:
//
//   1  noisy positions x of the atoms and s, z from the trunk go in; positions a little less noisy come out
//   2  atoms first: each atom takes the conditioning of its token, and its (rescaled) noisy position is added
//   3  local attention among the atoms (only atoms close by in the sequence), 3 blocks
//   4  the atoms of each token are averaged into one vector for the token (far fewer tokens than atoms)
//   5  global attention among the tokens, 24 blocks, z as the attention bias and s as the conditioning
//   6  each token's vector is passed back to its atoms and added to the atoms' earlier state (the skip link); local attention again
//   7  each atom's vector becomes an update for that atom's own position; the new positions go into the next, lower-noise step
//
// Checked against the supplement: Alg. 20 (DiffusionModule): the conditioning (Alg. 21), r = x / sqrt(t^2 + sigma_data^2), AtomAttentionEncoder,
// then a_i += LinearNoBias(LayerNorm(s_i)), DiffusionTransformer(N_block = 24, N_head = 16, z as the bias), AtomAttentionDecoder, and x_out as a
// mix of x_noisy and the update. Alg. 5 (encoder): c_l and p_lm take the trunk's s and z of the atom's token, q_l = c_l + LinearNoBias(r_l), an
// AtomTransformer with N_block = 3 and N_head = 4, then a_i = mean over the atoms of token i of relu(LinearNoBias(q_l)). Alg. 7: the atom
// attention is sequence-local (blocks of 32 queries and 128 keys along the diagonal). Alg. 6 (decoder): q_l = LinearNoBias(a_tok(l)) + q_skip_l,
// the same AtomTransformer, then r_update_l = LinearNoBias(LayerNorm(q_l)). Alg. 18: the sampler repeats this over the noise schedule.
// Left out of the drawing: the first layer norms, the size of the vectors, the noise level that is added to s, and that the sampler moves the
// noisy positions only part of the way toward the module's output. The numbers are a toy: 12 atoms in 5 tokens, and every cell value, attention
// weight and position is made up (seeded, listed on the References slide).
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => { const v = parseInt(hex.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const shade = (h, k) => hex(rgb(h).map((x) => (k > 0 ? x + (255 - x) * k : x * (1 + k))));
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const SEED = 7;
const LINE = 'rgba(0,0,0,.3)';
const ZBLUE = '#a9d8f2', SVIO = '#e0bff0', CI = '#e8590c';                  // z cells, s cells, the token or atom in focus (as on the other slides)
const YEL = '#fff3bf', YEL_BAR = '#d19a00';                                  // positions x and r
const QCOL = ['#c27bc9', '#d8a6de'], ACOL = ['#e0bff0', '#ecd5f7'];       // atom cells and token cells, tinted by token so the groups show

const N = 12, T = 5, GROUP = [3, 2, 3, 2, 2];                               // twelve atoms in five tokens
const START = GROUP.map((_, i) => GROUP.slice(0, i).reduce((x, y) => x + y, 0));
const TOK = Array.from({ length: N }, (_, k) => START.findIndex((s0, i) => k >= s0 && k < s0 + GROUP[i]));
const C = 3;                                                                 // numbers per position
const WIN = 2;                                                               // local attention: two atoms either side (toy)

// geometry, in map units (1000 x 395)
const A0 = 90, C0 = 706, CW = 22, QY = 262, QH = 22, XY = 318;              // atom strips: left (encoder) and right (decoder), q row and x row
const B0 = 396, BW = 50, BY = 122, BH = 46;                                  // the token strip
const ZG = { x: 44, y: 14, cell: 14 }, SG = { x: 126, y: 14, w: 18, h: 14 };  // the conditioning: z grid and s strip
const PANEL = { x: 745, y: 6, w: 240, h: 170 };                               // the toy positions, right of the token band
const cx = (x0, k) => x0 + k * CW + CW / 2;
const tcx = (k) => B0 + k * BW + BW / 2;

const CAPTIONS = [
  'The diffusion module takes the noisy positions of all atoms, plus $s$ and $z$ from the trunk, and returns positions that are a little less noisy.',
  'Atoms come first. Each atom picks up the conditioning ($s$ and $z$) of its own token, and its noisy position is added.',
  'The atoms attend to each other, but only to atoms close by in the sequence, in 3 blocks. Attention between all atoms would be far too expensive.',
  'Then the atoms of each token are averaged into one vector for the token. There are far fewer tokens than atoms.',
  'Now every token can attend to every token, in 24 blocks. $z$ biases the attention and $s$ conditions it. With so few tokens, this is affordable.',
  "Each token's vector is passed back to its atoms and added to the atoms' earlier state (the skip link). Local attention runs again.",
  "Each atom's vector becomes an update for that atom's own position. Applying it gives positions that are a little less noisy, and those go into the next step.",
];

AF3.kinds.diffmodule = (s) => ({
  steps: 7,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .dm-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .dm-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .dm-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .dm-t.muted { fill: var(--muted); }
      .dm-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .dm-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // ---- the toy data ----
    const rand = rng(SEED);
    const ZV = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => rand()));
    const SV = Array.from({ length: 5 }, () => rand());
    const XIN = Array.from({ length: N }, () => Array.from({ length: C }, () => 0.2 + 0.8 * rand()));          // noisy positions
    const XOUT = XIN.map((v) => v.map((x) => 0.2 + 0.8 * (0.5 + (x - 0.6) * 0.55)));                           // the same, a little less noisy
    const WL = Array.from({ length: N }, () => Array.from({ length: 2 * WIN + 1 }, () => 0.15 + 0.85 * rand())); // local attention weights
    const WG = Array.from({ length: T }, () => Array.from({ length: T }, () => 0.1 + 0.9 * rand()));            // global attention weights
    const BASE = Array.from({ length: N }, (_, k) => [PANEL.x + 16 + k * 19.4, PANEL.y + 98 + 16 * Math.sin(k * 0.55 + 0.4)]);
    const NOISY = BASE.map(([x, y]) => [x + (rand() - 0.5) * 12, y + (rand() - 0.5) * 64]);                    // the noisy positions, as points
    const NEW = BASE.map(([x, y], k) => [lerp(x, NOISY[k][0], 0.35), lerp(y, NOISY[k][1], 0.35)]);              // a little less noisy

    // ---- helpers ----
    const zcol = (r, c) => shade(ZBLUE, (ZV[r][c] - 0.5) * 0.35);
    const mtxt = (x, y, size, str, op, o = {}) => AF3.svgRich(x, y, size, str, { ...o, op });   // a label with math: KaTeX between dollar signs
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : String(str).includes('$') ? mtxt(x, y, size, str, op, { ...o, color: o.fill || o.color }) : `<text x="${x}" y="${y}" font-size="${size}" class="dm-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0, dash = '') => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${op.toFixed(2)}"/>`;
    const rot = (str, x, y, op) => op < 0.01 ? '' : `<text transform="rotate(-90 ${x} ${y})" x="${x}" y="${y}" font-size="15" class="dm-t muted" text-anchor="middle" font-weight="700" opacity="${op.toFixed(2)}">${str}</text>`;
    const arrow = (pts, op, o = {}) => {                                                  // a polyline with a head; the shaft stops under the head
      if (op < 0.01) return '';
      const col = o.col || 'var(--accent)', w = o.w || 2.5, hl = o.hl || 10, hw = o.hw || 5.5, n = pts.length;
      const [x1, y1] = pts[n - 2], [x2, y2] = pts[n - 1], len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const bx = x2 - ux * hl, by = y2 - uy * hl;
      const d = pts.slice(0, n - 1).concat([[bx, by]]).map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
      return `<g opacity="${op.toFixed(2)}"><path d="M${d}" fill="none" stroke="${col}" stroke-width="${w}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linejoin="round"/><polygon points="${x2},${y2} ${(bx - uy * hw).toFixed(1)},${(by + ux * hw).toFixed(1)} ${(bx + uy * hw).toFixed(1)},${(by - ux * hw).toFixed(1)}" fill="${col}"/></g>`;
    };
    const arc = (x1, x2, y, h, w, op) => op < 0.01 ? '' : `<path d="M${x1} ${y} Q ${(x1 + x2) / 2} ${y - 2 * h} ${x2} ${y}" fill="none" stroke="var(--accent)" stroke-width="${w.toFixed(1)}" stroke-linecap="round" opacity="${op.toFixed(2)}"/>`;
    const vbars = (x, y, w, hh, vals, col) => {                                           // a cell that holds a position: three bars
      const bh = 4, gap = 2, y0 = y + (hh - (C * bh + (C - 1) * gap)) / 2;
      return vals.map((v, i) => `<rect x="${(x + 3).toFixed(1)}" y="${(y0 + i * (bh + gap)).toFixed(1)}" width="${Math.max(1.5, v * (w - 6)).toFixed(1)}" height="${bh}" rx="1" fill="${col}"/>`).join('');
    };
    const xcell = (x0, k, vals, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}">${rect(x0 + k * CW, XY, CW, QH, YEL, LINE, 1)}${vbars(x0 + k * CW, XY, CW, QH, vals, YEL_BAR)}</g>`;

    // atoms close by in the sequence, for the atom k: arcs above the strip, the window, the atom in focus
    const localAttn = (x0, p, op) => {
      if (op < 0.01) return '';
      const k = Math.min(N - 1, Math.floor(p * N)), lo = Math.max(0, k - WIN), hi = Math.min(N - 1, k + WIN);
      let o = '';
      for (let j = lo; j <= hi; j++) if (j !== k) o += arc(cx(x0, k), cx(x0, j), QY, 8 + 4 * Math.abs(j - k), 1 + 4.5 * WL[k][j - k + WIN], op);
      o += rect(x0 + lo * CW - 2, QY - 2, (hi - lo + 1) * CW + 4, QH + 4, 'none', 'var(--accent)', 2.5, op, 4);
      o += rect(x0 + k * CW - 1.5, QY - 1.5, CW + 3, QH + 3, 'none', CI, 3, op);
      return o;
    };
    // every token with every token, for the token k
    const globalAttn = (p, op) => {
      if (op < 0.01) return '';
      const k = Math.min(T - 1, Math.floor(p * T));
      let o = '';
      for (let j = 0; j < T; j++) if (j !== k) o += arc(tcx(k), tcx(j), BY, 10 + 0.22 * Math.abs(j - k) * BW, 1 + 4.5 * WG[k][j], op);
      return o + rect(B0 + k * BW - 2, BY - 2, BW + 4, BH + 4, 'none', CI, 3, op, 3);
    };
    // the group of atoms of token i and its token cell, joined: grows from the atoms up to the token, or from the token down to the atoms
    const funnel = (i, x0, t, up, op) => {
      if (op < 0.01 || t < 0.001) return '';
      const a1 = x0 + START[i] * CW, a2 = x0 + (START[i] + GROUP[i]) * CW, t1 = B0 + i * BW + 2, t2 = B0 + (i + 1) * BW - 2, ty = BY + BH;
      const p0 = up ? [[a1, QY], [a2, QY]] : [[t1, ty], [t2, ty]], p1 = up ? [[t1, ty], [t2, ty]] : [[a1, QY], [a2, QY]];
      const m = p0.map((p, j) => [lerp(p[0], p1[j][0], t), lerp(p[1], p1[j][1], t)]);
      return `<polygon points="${p0[0]} ${p0[1]} ${m[1]} ${m[0]}" fill="${ACOL[i % 2]}" stroke="${LINE}" stroke-width="1" opacity="${(0.65 * op).toFixed(2)}"/>`;
    };

    const draw = (st) => {
      const { a, b, c, d, e, f, g } = st;
      let h = '';

      // ---- the two tiers: atoms always, tokens once they appear ----
      const tk = ramp(d, 0, 0.25), at = ramp(a, 0, 0.3);
      h += rect(30, 226, 955, 136, 'var(--fg)', 'none', 0, 0.045 * at, 8) + rect(30, 112, 700, 66, 'var(--fg)', 'none', 0, 0.045 * tk, 8);
      h += rot('atoms', 16, 294, at) + rot('tokens', 16, 145, tk);

      // ---- the conditioning from the trunk: z (a vector for each pair of tokens) and s (a vector for each token) ----
      let cond = '';
      for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) cond += rect(ZG.x + q * ZG.cell, ZG.y + r * ZG.cell, ZG.cell, ZG.cell, zcol(r, q), LINE, 1);
      for (let r = 0; r < 5; r++) cond += rect(SG.x, SG.y + r * SG.h, SG.w, SG.h, shade(SVIO, (SV[r] - 0.5) * 0.35), LINE, 1);
      h += `<g opacity="${at.toFixed(2)}">${cond}</g>` + txt(ZG.x + 35, 5, 16, '$z$', at) + txt(SG.x + SG.w / 2, 5, 16, '$s$', at) + txt(ZG.x, 100, 13, 'from the trunk', at, { anchor: 'start', muted: true });

      // ---- step 1: the module as one box, positions in, positions out ----
      const bb = ramp(a, 0.15, 0.4) * (1 - ramp(b, 0, 0.35));
      h += arrow([[A0 + N * CW + 4, XY + QH / 2], [434, XY + QH / 2]], bb, { col: 'var(--muted)', w: 2 }) + arrow([[626, XY + QH / 2], [C0 - 4, XY + QH / 2]], bb, { col: 'var(--muted)', w: 2 });
      h += rect(438, XY - 6, 184, QH + 12, 'var(--bg)', 'var(--muted)', 1.5, bb, 8) + txt(530, XY + QH / 2, 15, 'the diffusion module', bb, { bold: true });
      let ghost = '';
      for (let k = 0; k < N; k++) ghost += rect(C0 + k * CW, XY, CW, QH, 'none', 'var(--muted)', 1, 1, 0, '3 2');
      h += `<g opacity="${(ramp(a, 0.2, 0.45) * (1 - ramp(g, 0.2, 0.5))).toFixed(2)}">${ghost}</g>`;
      for (let k = 0; k < N; k++) h += xcell(A0, k, XIN[k], ramp(a, 0, 0.3));
      h += txt(A0 + (N * CW) / 2, 354, 13, '$x$: noisy positions', at, { muted: true }) + txt(C0 + (N * CW) / 2, 354, 13, '$x$: a little less noisy', ramp(a, 0.3, 0.5), { muted: true });

      // ---- step 2: the atoms take the conditioning of their token, and their position ----
      const cOp = 1 - ramp(c, 0, 0.25);                                                     // the conditioning arrows are done once the attention starts
      const bus = QY - 14, busOp = ramp(b, 0.1, 0.4) * cOp;
      h += arrow([[cx(A0, 0), 108], [cx(A0, 0), bus - 1]], ramp(b, 0, 0.3) * cOp, {});
      h += busOp < 0.01 ? '' : `<line x1="${cx(A0, 0)}" y1="${bus}" x2="${cx(A0, N - 1)}" y2="${bus}" stroke="var(--accent)" stroke-width="2.5" opacity="${busOp.toFixed(2)}"/>`;
      h += txt(108, 196, 13, 'each atom takes the', ramp(b, 0.05, 0.3) * (1 - ramp(c, 0, 0.15)), { anchor: 'start', muted: true }) + txt(108, 212, 13, '$s$ and $z$ of its token', ramp(b, 0.05, 0.3) * (1 - ramp(c, 0, 0.15)), { anchor: 'start', muted: true });
      for (let k = 0; k < N; k++) {
        h += rect(A0 + k * CW, QY, CW, QH, QCOL[TOK[k] % 2], LINE, 1, ramp(b, 0.3 + 0.035 * k, 0.5 + 0.035 * k));
        h += arrow([[cx(A0, k), bus], [cx(A0, k), QY - 3]], ramp(b, 0.2 + 0.03 * k, 0.4 + 0.03 * k) * cOp, { w: 1.6, hl: 6, hw: 3.5 });
        h += arrow([[cx(A0, k), XY - 1], [cx(A0, k), QY + QH + 5]], ramp(b, 0.5 + 0.02 * k, 0.7 + 0.02 * k) * (1 - 0.75 * ramp(c, 0, 0.2)), { w: 1.6, hl: 6, hw: 3.5 });
      }
      h += txt(A0 + N * CW + 10, XY - 22, 13, "positions added", ramp(b, 0.65, 0.85) * (1 - ramp(c, 0, 0.15)), { anchor: 'start', muted: true });

      // ---- step 3: local attention, atom by atom ----
      const aLab = ramp(c, 0, 0.1) * (1 - ramp(d, 0, 0.15));
      h += txt(A0 + 40, 234, 13, 'local attention, 3 blocks', aLab, { anchor: 'start', muted: true });
      h += localAttn(A0, ramp(c, 0.05, 0.95), ramp(c, 0, 0.05) * (1 - ramp(d, 0, 0.15)));

      // ---- step 4: the atoms of each token are averaged into the token ----
      const fnA = 1 - ramp(e, 0, 0.2);
      for (let i = 0; i < T; i++) h += funnel(i, A0, ramp(d, 0.06 * i, 0.55 + 0.06 * i), true, fnA);
      for (let i = 0; i < T; i++) h += rect(B0 + i * BW, BY, BW, BH, ACOL[i % 2], LINE, 1, ramp(d, 0.45 + 0.06 * i, 0.8 + 0.06 * i));
      h += txt(B0 + (T * BW) / 2, 102, 13, 'one vector per token', ramp(d, 0.7, 0.9) * (1 - ramp(e, 0, 0.1)), { muted: true });

      // ---- step 5: global attention, token by token; z and s come in ----
      h += arrow([[150, 50], [300, 50], [300, BY + BH / 2], [B0 - 4, BY + BH / 2]], ramp(e, 0, 0.25) * (1 - 0.6 * ramp(f, 0, 0.2)), {});
      h += txt(152, 36, 13, '$z$ biases, $s$ conditions', ramp(e, 0.05, 0.25) * (1 - ramp(f, 0, 0.15)), { anchor: 'start', muted: true });
      h += txt(B0 + T * BW + 10, BY + BH / 2, 13, '24 blocks', ramp(e, 0.2, 0.4), { anchor: 'start', muted: true });
      h += globalAttn(ramp(e, 0.15, 0.95), ramp(e, 0, 0.05) * (1 - ramp(f, 0, 0.15)));

      // ---- step 6: back to the atoms; the skip link; local attention again ----
      for (let i = 0; i < T; i++) h += funnel(i, C0, ramp(f, 0.04 * i, 0.4 + 0.04 * i), false, 1 - ramp(f, 0.5, 0.65));
      for (let k = 0; k < N; k++) h += rect(C0 + k * CW, QY, CW, QH, QCOL[TOK[k] % 2], LINE, 1, ramp(f, 0.3 + 0.025 * k, 0.5 + 0.025 * k));
      const sk = ramp(f, 0.1, 0.4) * (1 - 0.5 * ramp(g, 0, 0.2));
      h += arrow([[A0 + N * CW + 4, QY + QH / 2], [C0 - 4, QY + QH / 2]], sk, { dash: '6 4', col: 'var(--muted)', w: 2 });
      h += txt((A0 + N * CW + C0) / 2, QY + QH / 2 + 14, 13, 'skip link: the atoms’ earlier state', sk * (1 - ramp(g, 0, 0.15)), { muted: true });
      h += txt(C0 + 40, 234, 13, 'local attention, 3 blocks', ramp(f, 0.6, 0.72) * (1 - ramp(g, 0, 0.15)), { anchor: 'start', muted: true });
      h += localAttn(C0, ramp(f, 0.62, 0.97), ramp(f, 0.6, 0.65) * (1 - ramp(g, 0, 0.15)));

      // ---- step 7: an update for each atom; the new positions; the next step ----
      for (let k = 0; k < N; k++) {
        h += arrow([[cx(C0, k), QY + QH + 3], [cx(C0, k), XY - 5]], ramp(g, 0.02 + 0.02 * k, 0.22 + 0.02 * k), { w: 1.6, hl: 6, hw: 3.5 });
        h += xcell(C0, k, XOUT[k], ramp(g, 0.25 + 0.02 * k, 0.45 + 0.02 * k));
      }
      h += txt(C0 - 10, XY - 22, 13, "an update for each atom's own position", ramp(g, 0.1, 0.3), { anchor: 'end', muted: true });
      const loopOp = ramp(g, 0.7, 0.95);
      h += arrow([[C0 + N * CW + 2, XY + QH / 2], [990, XY + QH / 2], [990, 382], [50, 382], [50, XY + QH / 2], [A0 - 4, XY + QH / 2]], loopOp, { dash: '6 4', w: 2 });
      h += txt(520, 372, 13, 'repeat at the next, lower noise level', loopOp, { muted: true });

      // the same move, drawn on a toy picture of the positions
      const pn = ramp(g, 0.3, 0.45), mv = ramp(g, 0.55, 0.85);
      h += rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 'var(--bg)', 'var(--muted)', 1.5, pn, 8);
      h += txt(PANEL.x + 10, PANEL.y + 15, 13, 'toy picture of the positions', pn, { anchor: 'start', muted: true });
      let pts = '';
      const chain = (P, col, dash, op) => `<polyline points="${P.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="1.6"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${op.toFixed(2)}"/>`;
      const cur = NOISY.map((p, k) => [lerp(p[0], NEW[k][0], mv), lerp(p[1], NEW[k][1], mv)]);
      const on = ramp(mv, 0, 0.15);                                                           // the moved points show once they start to move
      pts += chain(NOISY, 'var(--muted)', '3 3', 0.7 - 0.3 * mv) + chain(cur, 'var(--accent)', '', on);
      for (let k = 0; k < N; k++) {
        if (mv > 0.02) pts += `<line x1="${NOISY[k][0].toFixed(1)}" y1="${NOISY[k][1].toFixed(1)}" x2="${cur[k][0].toFixed(1)}" y2="${cur[k][1].toFixed(1)}" stroke="var(--accent)" stroke-width="1.5" opacity="${(0.6 * on).toFixed(2)}"/>`;
        pts += `<circle cx="${NOISY[k][0].toFixed(1)}" cy="${NOISY[k][1].toFixed(1)}" r="4" fill="none" stroke="var(--muted)" stroke-width="1.5"/>`;
        pts += `<circle cx="${cur[k][0].toFixed(1)}" cy="${cur[k][1].toFixed(1)}" r="4" fill="var(--accent)" opacity="${on.toFixed(2)}"/>`;
      }
      h += `<g opacity="${pn.toFixed(2)}">${pts}</g>`;
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="dm-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Inside the diffusion module: noisy atom positions and the trunk's s and z go in; the atoms take the conditioning of their token and attend to atoms close by; the atoms of each token are averaged into one vector; the tokens attend to every token with z as the bias; the token vectors are passed back to the atoms, which attend again and each get an update for their own position; the new positions go into the next step"></svg></div>
      <div class="dm-caps">${CAPTIONS.map((t, i) => `<p class="dm-cap reveal-in" data-show="${i + 1}">${AF3.rich(t, esc)}</p>`).join('')}</div>
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
        const ms = [0, 2400, 5500, 7000, 5500, 7000, 8500, 8500][step], t0 = performance.now();
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
