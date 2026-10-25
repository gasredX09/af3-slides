// "Prepare token-level conditioning tensors" (appendix, slide 73): the figure of the original (Simon, The Illustrated AlphaFold: step 1, "Create token-level single conditioning
// input (s)" and "Create token-level pair conditioning input (z)") redrawn natively and played a click at a time. The diffusion module is conditioned on what the trunk
// produced, and on how noisy its input is:
//
//   1  what goes in: s_trunk and z_trunk from the trunk, s_inputs and the relative position encoding from the input features, and the noise level
//   2  single conditioning: s_trunk and s_inputs are joined side by side; a layer norm and a linear layer bring them back to one vector per token
//   3  the noise level becomes a Fourier embedding (cosines of fixed random frequencies), a linear layer, and is added to the vector of every token
//   4  two Transition layers refine s, each added back
//   5  pair conditioning: z_trunk and the relative position encoding are joined; a layer norm and a linear layer bring them back to 128 numbers per pair; two Transition layers
//   6  s and z go on: to the atom encoder (which broadcasts them to the atoms, next slide) and to the 24 blocks of the diffusion transformer
//
// Checked against the supplement, Alg. 21 (DiffusionConditioning, c_z = 128, c_s = 384): z_ij = concat([z_trunk_ij, RelativePositionEncoding(f*)]); z_ij <- LinearNoBias(LayerNorm(z_ij));
// twice z_ij += Transition(z_ij, n = 2); s_i = concat([s_trunk_i, s_inputs_i]); s_i <- LinearNoBias(LayerNorm(s_i)); n = FourierEmbedding(1/4 log(t/sigma_data), 256);
// s_i += LinearNoBias(LayerNorm(n)); twice s_i += Transition(s_i, n = 2). Alg. 22 (FourierEmbedding): weights w and bias b "randomly generated once before training" (they are
// not trained), output cos(2 pi (t w + b)). Alg. 3: the relative position encoding p_ij is in R^(c_z), c_z = 128, so z_trunk and the encoding join to 256 numbers. Alg. 20: s and z
// from DiffusionConditioning go to AtomAttentionEncoder (line 3) and DiffusionTransformer (line 5). s_inputs is the input embedder's output (Alg. 2: the atom-encoder output, restype,
// profile and deletion_mean), wider than s_trunk, so the drawing does not give the width of the joined single input. Left out: the exact widths and the Transition layers' insides
// (slide 68). The sizes (5 tokens, 3 numbers for a vector), the numbers in the cells and the weights of the layers are a toy (seed 12); the Fourier bars are real cosines of
// seeded frequencies at a noise level that sweeps from high to low, as it does during denoising.
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
const SEED = 12;
const LINE = 'rgba(0,0,0,.3)';
const S_BG = '#fbe3f5', S_BAR = '#c2255c', I_BG = '#ece6fb', I_BAR = '#7048e8', Z_BASE = '#a9d8f2', R_BASE = '#ffd8a8', F_BAR = '#e0a82e', N_BG = '#fff3bf', N_BAR = '#b08900';
const N = 5, C = 3, CW = 26, CH = 18, G = 14;

// geometry, in map units (1000 x 395)
const S_TR = { x: 30, y: 78 }, S_IN = { x: 84, y: 78 }, S_CAT = { x: 206, y: 78 }, S_ONE = { x: 352, y: 78 }, S_FIN = { x: 712, y: 78 };
const Z_TR = { x: 30, y: 246 }, Z_RP = { x: 128, y: 246 }, Z_CAT = { x: 236, y: 254 }, Z_ONE = { x: 410, y: 246 }, Z_FIN = { x: 712, y: 246 };
const TR_S = { x: 590, y: 103, w: 96, h: 40 }, TR_Z = { x: 590, y: 266, w: 96, h: 40 };
const NS = { x: 30, y: 4 };                                                            // the noise level, along the top
const BUS = 802, OUT_X = 826, OUT_W = 164;

const CAPTIONS = [
  'The diffusion module starts from what the trunk produced, $s_{\\mathrm{trunk}}$ and $z_{\\mathrm{trunk}}$, plus the input features $s_{\\mathrm{inputs}}$ and a relative position encoding, and it is told how noisy its input is.',
  'Single conditioning: $s_{\\mathrm{trunk}}$ and $s_{\\mathrm{inputs}}$ are joined side by side. A layer norm and a linear layer bring them back to one vector of 384 numbers per token.',
  'The noise level becomes 256 numbers (a Fourier embedding: cosines of fixed random frequencies). A linear layer turns them into one vector, which is added to every token.',
  'Two Transition layers refine $s$. Each one is added back to $s$.',
  'Pair conditioning: $z_{\\mathrm{trunk}}$ and the relative position encoding are joined, then a layer norm and a linear layer bring them back to 128 numbers per pair, and two Transition layers follow.',
  'The new $s$ and $z$ go on to the atom encoder, which hands them to the atoms (next slide), and to the 24 blocks of the diffusion transformer.',
];

AF3.kinds.condtoken = (s) => ({
  steps: 6,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .ct-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .ct-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ct-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .ct-t.muted { fill: var(--muted); }
      .ct-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .ct-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const heading = AF3.apTitle(s);

    // ---- the toy data ----
    const rand = rng(SEED), gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    const vec = (lo, hi) => Array.from({ length: C }, () => lo + (hi - lo) * rand());
    const STR = Array.from({ length: N }, () => vec(0.2, 0.95)), SIN = Array.from({ length: N }, () => vec(0.2, 0.95));
    const SONE = Array.from({ length: N }, () => vec(0.2, 0.9));
    const FW = Array.from({ length: 8 }, () => gauss() * 1.4), FB = Array.from({ length: 8 }, () => rand());     // the Fourier frequencies and offsets: fixed, drawn once
    const LW = Array.from({ length: 8 }, () => vec(-0.6, 0.6));                                                  // the linear layer from 8 cosines to one vector
    const T0 = 1.2, T1 = -0.5;                                                                                    // the noise level (1/4 log(t / sigma_data)) at the start and the end of the sweep
    const four = (t) => FW.map((w, k) => Math.cos(2 * Math.PI * (t * w + FB[k])));
    const nvec = (t) => { const f = four(t); return [0, 1, 2].map((c) => Math.min(0.95, Math.max(0.05, 0.5 + 0.5 * f.reduce((a, x, k) => a + x * LW[k][c], 0)))); };
    const SAFTER = SONE.map((v) => v.map((x, c) => Math.min(0.95, Math.max(0.05, x + (nvec(T1)[c] - 0.5) * 0.8))));
    const SFIN = SAFTER.map((v) => v.map((x) => Math.min(0.95, Math.max(0.05, x + (rand() - 0.5) * 0.35))));
    const ZV = Array.from({ length: N }, () => Array.from({ length: N }, () => rand())), RV = Array.from({ length: N }, () => Array.from({ length: N }, () => rand()));
    const ZONE = Array.from({ length: N }, () => Array.from({ length: N }, () => rand())), ZFIN = Array.from({ length: N }, () => Array.from({ length: N }, () => rand()));

    // ---- helpers ----
    const mtxt = (x, y, size, str, op, o = {}) => AF3.svgRich(x, y, size, str, { ...o, op });   // a label with math: KaTeX between dollar signs
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : String(str).includes('$') ? mtxt(x, y, size, str, op, { ...o, color: o.fill || o.color }) : `<text x="${x}" y="${y}" font-size="${size}" class="ct-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const bars = (x, y, w, h, vals, col) => {
      const bh = 4, gap = 1.5, y0 = y + (h - (C * bh + (C - 1) * gap)) / 2;
      return vals.map((v, i) => `<rect x="${(x + 3).toFixed(1)}" y="${(y0 + i * (bh + gap)).toFixed(1)}" width="${Math.max(1.5, v * (w - 6)).toFixed(1)}" height="${bh}" rx="1.2" fill="${col}"/>`).join('');
    };
    const column = (g0, V, bg, col, op) => {   // one vector per token
      if (op < 0.01) return '';
      let h = '';
      for (let r = 0; r < N; r++) h += `<rect x="${g0.x}" y="${g0.y + r * CH}" width="${CW}" height="${CH}" fill="${bg}" stroke="${LINE}" stroke-width="1"/>` + bars(g0.x, g0.y + r * CH, CW, CH, V[r], col);
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const zgrid = (g0, colFn, op, gx = 0, gy = 0) => {
      if (op < 0.01) return '';
      let h = '';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) h += `<rect x="${g0.x + gx + c * G}" y="${g0.y + gy + r * G}" width="${G}" height="${G}" fill="${colFn(r, c)}" stroke="${LINE}" stroke-width="1"/>`;
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const arrow = (x1, y1, x2, y2, op) => {
      if (op < 0.01) return '';
      const a = Math.atan2(y2 - y1, x2 - x1);
      return `<g opacity="${op.toFixed(2)}"><line x1="${x1}" y1="${y1}" x2="${(x2 - Math.cos(a) * 8).toFixed(1)}" y2="${(y2 - Math.sin(a) * 8).toFixed(1)}" stroke="var(--accent)" stroke-width="2.5"/>`
        + `<polygon points="${x2},${y2} ${(x2 - Math.cos(a) * 10 - Math.sin(a) * 5.5).toFixed(1)},${(y2 - Math.sin(a) * 10 + Math.cos(a) * 5.5).toFixed(1)} ${(x2 - Math.cos(a) * 10 + Math.sin(a) * 5.5).toFixed(1)},${(y2 - Math.sin(a) * 10 - Math.cos(a) * 5.5).toFixed(1)}" fill="var(--accent)"/></g>`;
    };
    const zc = (V, base) => (r, c) => shade(base, (V[r][c] - 0.5) * 0.4);
    const box = (b, label, sub, op) => op < 0.01 ? '' : rect(b.x, b.y, b.w, b.h, 'color-mix(in srgb, var(--accent) 9%, var(--bg))', 'var(--accent)', 2, op, 8) + txt(b.x + b.w / 2, b.y + b.h / 2 - (sub ? 7 : 0), 14.5, label, op, { bold: true }) + (sub ? txt(b.x + b.w / 2, b.y + b.h / 2 + 11, 12, sub, op, { muted: true }) : '');

    const AY = 123;   // the row the arrows of the single lane run along
    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d, e = st.e, f = st.f;

      // ---- step 1: the inputs (the noise level is a gauge along the top) ----
      const i1 = ramp(a, 0, 0.35);
      h += column(S_TR, STR, S_BG, S_BAR, i1) + txt(S_TR.x + CW / 2, 182, 14.5, '$s_{\\mathrm{trunk}}$', i1 * (1 - ramp(b, 0.1, 0.3)));
      h += column(S_IN, SIN, I_BG, I_BAR, ramp(a, 0.1, 0.4)) + txt(S_IN.x + CW / 2, 182, 14.5, '$s_{\\mathrm{inputs}}$', ramp(a, 0.1, 0.4) * (1 - ramp(b, 0.1, 0.3)));
      h += zgrid(Z_TR, zc(ZV, Z_BASE), ramp(a, 0.3, 0.65)) + txt(Z_TR.x + (N * G) / 2, Z_TR.y + N * G + 17, 14.5, '$z_{\\mathrm{trunk}}$', ramp(a, 0.3, 0.65));
      h += zgrid(Z_RP, zc(RV, R_BASE), ramp(a, 0.4, 0.75)) + txt(Z_RP.x + (N * G) / 2, Z_RP.y + N * G + 17, 12.5, 'relative position', ramp(a, 0.4, 0.75), { bold: true }) + txt(Z_RP.x + (N * G) / 2, Z_RP.y + N * G + 32, 12.5, 'encoding', ramp(a, 0.4, 0.75), { bold: true });
      const gauge = ramp(a, 0.55, 0.9);
      const tNow = lerp(T0, T1, ramp(c, 0.05, 0.85)), tMark = 1 - (tNow - T1) / (T0 - T1);                          // the marker moves from high noise to low
      h += txt(NS.x, NS.y + 8, 14, 'noise level', gauge, { anchor: 'start', bold: true });
      h += rect(NS.x, NS.y + 20, 110, 7, 'color-mix(in srgb, var(--muted) 25%, transparent)', 'none', 0, gauge, 3.5);
      h += rect(NS.x + 110 * tMark - 5, NS.y + 16, 10, 15, 'var(--accent)', 'var(--bg)', 2, gauge, 4);
      h += txt(NS.x, NS.y + 42, 12, 'high', gauge, { anchor: 'start', muted: true }) + txt(NS.x + 110, NS.y + 42, 12, 'low', gauge, { anchor: 'end', muted: true });

      // ---- step 2: single conditioning ----
      const j2 = ramp(b, 0, 0.35), merge = ramp(b, 0.15, 0.55), lin = ramp(b, 0.6, 0.95);
      h += arrow(S_IN.x + CW + 12, AY, S_CAT.x - 12, AY, j2) + txt((S_IN.x + CW + S_CAT.x) / 2, AY - 18, 12, 'join', ramp(b, 0.1, 0.35), { muted: true });
      h += column({ x: lerp(S_TR.x, S_CAT.x, merge), y: S_TR.y }, STR, S_BG, S_BAR, merge) + column({ x: lerp(S_IN.x, S_CAT.x + CW, merge), y: S_IN.y }, SIN, I_BG, I_BAR, merge);
      h += rect(S_CAT.x - 4, S_TR.y - 4, 2 * CW + 8, N * CH + 8, 'none', 'var(--muted)', 1.5, ramp(b, 0.5, 0.7), 6) + txt(S_CAT.x + CW, 182, 12.5, 'joined', ramp(b, 0.5, 0.75), { bold: true });
      h += arrow(S_CAT.x + 2 * CW + 12, AY, S_ONE.x - 12, AY, lin) + txt((S_CAT.x + 2 * CW + S_ONE.x) / 2, AY - 26, 12, 'layer norm,', lin, { muted: true }) + txt((S_CAT.x + 2 * CW + S_ONE.x) / 2, AY - 12, 12, 'linear', lin, { muted: true });
      const sOp = ramp(b, 0.75, 1);
      const sNow = SONE.map((v, i) => v.map((x, k) => lerp(x, SAFTER[i][k], ramp(c, 0.6, 0.95))));                // after the noise level has been added
      const sNow2 = sNow.map((v, i) => v.map((x, k) => lerp(x, SFIN[i][k], ramp(d, 0.5, 0.9))));                   // after the Transition layers
      h += column(S_ONE, sNow, S_BG, S_BAR, sOp) + txt(S_ONE.x + CW / 2, 182, 15, '$s$', sOp) + txt(S_ONE.x + CW / 2, 197, 12, '384 numbers', sOp, { muted: true });

      // ---- step 3: the noise level, a Fourier embedding, a linear layer, added to every token ----
      const f3 = ramp(c, 0.05, 0.3), f4 = ramp(c, 0.3, 0.55);
      h += arrow(NS.x + 124, NS.y + 24, NS.x + 158, NS.y + 24, f3);
      const fo = four(tNow), FX = NS.x + 166, FM = NS.y + 30;
      for (let k = 0; k < 8; k++) {
        const x = FX + k * 15, hh = fo[k] * 17;
        h += rect(x, hh > 0 ? FM - hh : FM, 11, Math.abs(hh), F_BAR, 'none', 0, f3, 2);
      }
      h += `<g opacity="${(f3 * 0.6).toFixed(2)}"><path d="M${FX - 3} ${FM} H${FX + 8 * 15 - 2}" stroke="var(--muted)" stroke-width="1"/></g>`;
      h += txt(FX + 58, NS.y + 58, 12.5, 'Fourier embedding: 256 numbers', f3, { bold: true });
      h += arrow(FX + 8 * 15 + 2, NS.y + 28, FX + 8 * 15 + 28, NS.y + 28, f4) + txt(FX + 8 * 15 + 15, NS.y + 14, 12, 'linear', f4, { muted: true });
      const NX = FX + 8 * 15 + 34, nv = nvec(tNow);
      h += rect(NX, NS.y + 14, 52, 26, N_BG, LINE, 1, f4) + (f4 > 0.01 ? `<g opacity="${f4.toFixed(2)}">${bars(NX, NS.y + 14, 52, 26, nv, N_BAR)}</g>` : '');
      h += txt(NX + 26 + 66, NS.y + 28, 12.5, 'one vector, added', f4, { bold: true, anchor: 'start' }) + txt(NX + 26 + 66, NS.y + 44, 12.5, 'to every token', f4, { bold: true, anchor: 'start' });
      // the vector is added to every token: a copy drops onto each cell of s
      for (let r = 0; r < N; r++) {
        const t = ramp(c, 0.55 + 0.05 * r, 0.8 + 0.05 * r);
        if (t > 0.01 && t < 0.99) h += rect(lerp(NX + 6, S_ONE.x + 6, t), lerp(NS.y + 16, S_ONE.y + r * CH + 3, t), lerp(40, 14, t), lerp(22, 11, t), N_BG, N_BAR, 1.2, 1 - 0.5 * t, 2);
      }
      h += arrow(NX + 26, NS.y + 42, S_ONE.x + CW / 2 + 20, S_ONE.y - 4, ramp(c, 0.5, 0.65) * (1 - ramp(c, 0.95, 1)));

      // ---- step 4: two Transition layers on s ----
      const tr = ramp(d, 0, 0.35);
      h += arrow(S_ONE.x + CW + 14, AY, TR_S.x - 8, AY, tr) + box(TR_S, 'Transition', '$\\times 2$, added back', tr);
      h += arrow(TR_S.x + TR_S.w + 8, AY, S_FIN.x - 10, AY, ramp(d, 0.45, 0.7));
      const sf = ramp(d, 0.6, 0.95);
      h += column(S_FIN, sNow2, S_BG, S_BAR, sf) + txt(S_FIN.x + CW / 2, 182, 15, '$s$', sf) + txt(S_FIN.x + CW / 2, 197, 12, 'for diffusion', sf, { muted: true });

      // ---- step 5: pair conditioning ----
      const j5 = ramp(e, 0, 0.3), m5 = ramp(e, 0.15, 0.5), l5 = ramp(e, 0.5, 0.8);
      const gx = lerp(0, Z_CAT.x - Z_TR.x, m5), gx2 = lerp(Z_RP.x - Z_TR.x, Z_CAT.x - Z_TR.x + 12, m5);
      h += arrow(Z_RP.x + N * G + 14, Z_TR.y + 44, Z_CAT.x - 12, Z_TR.y + 44, j5) + txt((Z_RP.x + N * G + Z_CAT.x) / 2 + 2, Z_TR.y + 28, 12, 'join', ramp(e, 0.1, 0.3), { muted: true });
      h += m5 > 0.01 ? zgrid(Z_TR, zc(ZV, Z_BASE), m5, gx, 0) + zgrid(Z_TR, zc(RV, R_BASE), m5, gx2, -8) : '';
      h += txt(Z_CAT.x + 44, Z_TR.y + N * G + 17, 12.5, 'joined', ramp(e, 0.45, 0.7), { bold: true });
      h += arrow(Z_CAT.x + N * G + 28, Z_TR.y + 40, Z_ONE.x - 10, Z_TR.y + 40, l5) + txt((Z_CAT.x + N * G + 28 + Z_ONE.x) / 2, Z_TR.y + 14, 12, 'layer norm,', l5, { muted: true }) + txt((Z_CAT.x + N * G + 28 + Z_ONE.x) / 2, Z_TR.y + 28, 12, 'linear', l5, { muted: true });
      const zOp = ramp(e, 0.7, 0.95);
      h += zgrid(Z_ONE, (r, cc) => zc(ZONE, Z_BASE)(r, cc), zOp) + txt(Z_ONE.x + (N * G) / 2, Z_ONE.y + N * G + 17, 15, '$z$', zOp) + txt(Z_ONE.x + (N * G) / 2, Z_ONE.y + N * G + 32, 12, '128 numbers', zOp, { muted: true });
      const trz = ramp(e, 0.85, 1);
      h += arrow(Z_ONE.x + N * G + 14, Z_TR.y + 40, TR_Z.x - 8, Z_TR.y + 40, trz) + box(TR_Z, 'Transition', '$\\times 2$, added back', trz);

      // ---- step 6: both go on ----
      const z6 = ramp(f, 0, 0.35);
      h += arrow(TR_Z.x + TR_Z.w + 8, Z_TR.y + 40, Z_FIN.x - 10, Z_TR.y + 40, z6);
      h += zgrid(Z_FIN, (r, cc) => zc(ZFIN, Z_BASE)(r, cc), ramp(f, 0.15, 0.5)) + txt(Z_FIN.x + (N * G) / 2, Z_FIN.y + N * G + 17, 15, '$z$', ramp(f, 0.15, 0.5)) + txt(Z_FIN.x + (N * G) / 2, Z_FIN.y + N * G + 32, 12, 'for diffusion', ramp(f, 0.15, 0.5), { muted: true });
      const bus = ramp(f, 0.4, 0.7);
      h += `<g opacity="${bus.toFixed(2)}"><path d="M${S_FIN.x + CW + 10} ${AY} H${BUS} V${Z_TR.y + 40} H${Z_FIN.x + N * G + 12}" fill="none" stroke="var(--accent)" stroke-width="2.5"/></g>`;
      const bx = ramp(f, 0.6, 0.95);
      h += arrow(BUS, AY, OUT_X - 6, AY, bx) + arrow(BUS, Z_TR.y + 40, OUT_X - 6, Z_TR.y + 40, bx);
      h += box({ x: OUT_X, y: AY - 30, w: OUT_W, h: 60 }, 'Atom encoder', 'hands $s$ and $z$ to the atoms', bx) + box({ x: OUT_X, y: Z_TR.y + 10, w: OUT_W, h: 60 }, 'Diffusion transformer', '24 blocks', bx);
      h += txt(990, 372, 12, 'toy sizes: 5 tokens, 3 numbers for a vector', 1, { anchor: 'end', muted: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(heading)}</h2>
      <div class="ct-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="How the diffusion module is conditioned at the token level: s_trunk and s_inputs are joined and passed through a layer norm and a linear layer; the noise level becomes a Fourier embedding, a linear layer, and is added to every token; two Transition layers follow; z_trunk and the relative position encoding are joined and passed through a layer norm, a linear layer and two Transition layers; s and z go to the atom encoder and the diffusion transformer"></svg></div>
      <div class="ct-caps">${CAPTIONS.map((t, i) => `<p class="ct-cap reveal-in" data-show="${i + 1}">${AF3.rich(t, esc)}</p>`).join('')}</div>
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
        const ms = [0, 3500, 5500, 8500, 5500, 6500, 6000][step], t0 = performance.now();
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
