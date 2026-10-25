// "ReLU vs SwiGLU" (appendix, slide 68): the figure of the original (Simon, The Illustrated AlphaFold: the old ReLU transition above, "SwiGLU transition block" below) redrawn
// natively and played a click at a time on the same few numbers, so what each version does to them can be seen:
//
//   1  a Transition layer treats each token (or pair) on its own: its vector x is widened by a linear layer (3 numbers to 6 here)
//   2  the ReLU version: negative numbers become 0, then a second linear layer brings the vector back to its size
//   3  the SwiGLU version: two linear layers give a and b from the same x
//   4  swish(a) = a * sigmoid(a), a smooth ReLU (small negative numbers leak through), times b entry by entry: b gates each channel
//   5  a last linear layer brings the vector back; every Transition layer of AF3 uses SwiGLU
//
// Checked against the supplement, Alg. 11 (Transition, n = 4): x <- LayerNorm(x); a = LinearNoBias(x); b = LinearNoBias(x); x <- LinearNoBias(swish(a) * b), with a, b in R^(n.c);
// Alg. 25 (ConditionedTransitionBlock, n = 2): the same with AdaLN and a gate from the conditioning. "All Transition blocks use SwiGLU" (3.6) and "we replaced the ReLU
// activation in the model's transition blocks function by SwiGLU, which has been observed to yield better results [28]. ReLU is present in the atom attention (Algorithm 5)"
// (section 8, comparison with AlphaFold 2); [28] is Shazeer, GLU variants improve transformer. The numbers are real arithmetic on toy weights (seed 11): the cells show
// x W, ReLU of it, swish and the products as they come out, for 3 numbers widened to 6 (n = 2; AF3 uses n = 4 in the trunk and n = 2 in the diffusion module). The two
// curves are drawn from their formulas, relu(x) = max(0, x) and swish(x) = x / (1 + e^-x). Left out: the first LayerNorm and, in the conditioned block, the AdaLN and the gate.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => { const v = parseInt(hex.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const lerpColor = (a, b, t) => hex(rgb(a).map((x, i) => x + (rgb(b)[i] - x) * t));
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const SEED = 11;
const LINE = 'rgba(0,0,0,.3)';
const POS = '#e07a2a', NEG = '#4c6ef5', P_LIGHT = '#fff1e0', N_LIGHT = '#e3e9ff';
const D = 3, H = 6, CW = 38, CH = 30;
const relu = (x) => Math.max(0, x), sigmoid = (x) => 1 / (1 + Math.exp(-x)), swish = (x) => x * sigmoid(x);

// geometry, in map units (1000 x 345)
const TOP = { x: 20, y: 44 }, TOP_H = { x: 208, y: 44 }, TOP_R = { x: 528, y: 44 }, TOP_O = { x: 830, y: 44 };
const BOT_X = { x: 20, y: 235 }, BOT_A = { x: 208, y: 170 }, BOT_B = { x: 208, y: 300 }, BOT_S = { x: 528, y: 170 }, BOT_P = { x: 528, y: 300 }, BOT_O = { x: 830, y: 300 };

const CAPTIONS = [
  'A Transition layer treats each token (or pair) on its own. Its vector $x$ is widened by a linear layer, passed through a nonlinearity, and shrunk back by a second linear layer. Here 3 numbers are widened to 6.',
  'The ReLU version, as in AlphaFold 2: keep the positive numbers, set the negative ones to zero. A second linear layer then brings the vector back to its size.',
  'The SwiGLU version splits the widening in two: two linear layers give $a$ and $b$ from the same $x$.',
  '$\\mathrm{swish}(a) = a \\times \\mathrm{sigmoid}(a)$ is a smooth ReLU: small negative numbers leak through instead of being cut off. It is multiplied with $b$ entry by entry, so $b$ acts as a gate that opens or closes each channel.',
  'A last linear layer brings the vector back to its size. In AF3 every Transition layer uses SwiGLU (6 numbers here, 4 times the size in the trunk and 2 times in the diffusion module). ReLU remains in the atom attention.',
];

AF3.kinds.swiglu = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.arch.miniCss + `
      .sg-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .sg-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .sg-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .sg-t.muted { fill: var(--muted); }
      .sg-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .sg-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .sg-cap .af3-tex { white-space: nowrap; }   /* a formula never breaks across two lines */
    `);
    const heading = AF3.apTitle(s);

    // ---- the arithmetic, on toy weights ----
    const rand = rng(SEED);
    const mat = (r, c) => Array.from({ length: r }, () => Array.from({ length: c }, () => rand() * 2 - 1));
    const mul = (v, M) => M[0].map((_, j) => v.reduce((t, x, i) => t + x * M[i][j], 0));
    const X = [0.9, -0.5, 0.6];
    const W1 = mat(D, H), W2 = mat(H, D), WA = mat(D, H), WB = mat(D, H), W3 = mat(H, D);
    const HV = mul(X, W1), RV = HV.map(relu), OUT_R = mul(RV, W2);
    const AV = mul(X, WA), BV = mul(X, WB), SV = AV.map(swish), PV = SV.map((v, i) => v * BV[i]), OUT_S = mul(PV, W3);

    // ---- helpers ----
    const col = (v) => (v >= 0 ? lerpColor(P_LIGHT, POS, Math.min(1, v / 1.0)) : lerpColor(N_LIGHT, NEG, Math.min(1, -v / 1.0)));
    const fmt = (v) => (Math.abs(v) < 0.05 ? '0' : v.toFixed(1));
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="sg-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const M = (x, y, size, src, op, o = {}) => AF3.svgMath(x, y, size, src, { ...o, op });      // a symbol or formula, set in KaTeX
    const R = (x, y, size, str, op, o = {}) => AF3.svgRich(x, y, size, str, { ...o, op });      // words with $math$ in them
    const cells = (g0, vals, op, cw = CW) => {   // a vector as a row of cells with the numbers in them
      if (op < 0.01) return '';
      let h = '';
      vals.forEach((v, i) => { h += `<rect x="${g0.x + i * cw}" y="${g0.y}" width="${cw}" height="${CH}" fill="${col(v)}" stroke="${LINE}" stroke-width="1"/><text x="${g0.x + i * cw + cw / 2}" y="${g0.y + CH / 2}" font-size="13" class="sg-t" text-anchor="middle" style="fill:#1d2129">${fmt(v)}</text>`; });
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const arrow = (x1, y1, x2, y2, op) => {
      if (op < 0.01) return '';
      const a = Math.atan2(y2 - y1, x2 - x1), hx = 8;
      return `<g opacity="${op.toFixed(2)}"><line x1="${x1}" y1="${y1}" x2="${(x2 - Math.cos(a) * hx).toFixed(1)}" y2="${(y2 - Math.sin(a) * hx).toFixed(1)}" stroke="var(--accent)" stroke-width="2.5"/>`
        + `<polygon points="${x2},${y2} ${(x2 - Math.cos(a) * 10 - Math.sin(a) * 5.5).toFixed(1)},${(y2 - Math.sin(a) * 10 + Math.cos(a) * 5.5).toFixed(1)} ${(x2 - Math.cos(a) * 10 + Math.sin(a) * 5.5).toFixed(1)},${(y2 - Math.sin(a) * 10 - Math.cos(a) * 5.5).toFixed(1)}" fill="var(--accent)"/></g>`;
    };
    // a small plot of a function: the axes, and the curve drawn left to right as far as `t`
    const plot = (cx, cy, f, t, op) => {
      if (op < 0.01) return '';
      const w = 64, hh = 44, x0 = cx - w / 2, ymin = -0.6, ymax = 2, X0 = -2, X1 = 2;
      const px = (x) => x0 + ((x - X0) / (X1 - X0)) * w, py = (y) => cy + hh / 2 - ((y - ymin) / (ymax - ymin)) * hh;
      let d = '';
      for (let i = 0; i <= 40 * t; i++) { const x = X0 + (i / 40) * (X1 - X0); d += `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${py(f(x)).toFixed(1)}`; }
      return `<g opacity="${op.toFixed(2)}"><rect x="${x0 - 4}" y="${cy - hh / 2 - 4}" width="${w + 8}" height="${hh + 8}" rx="4" fill="var(--bg)" stroke="var(--muted)" stroke-width="1" opacity=".9"/>`
        + `<line x1="${x0}" y1="${py(0).toFixed(1)}" x2="${x0 + w}" y2="${py(0).toFixed(1)}" stroke="var(--muted)" stroke-width="1"/><line x1="${px(0).toFixed(1)}" y1="${cy - hh / 2}" x2="${px(0).toFixed(1)}" y2="${cy + hh / 2}" stroke="var(--muted)" stroke-width="1"/>`
        + `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/></g>`;
    };
    const morph = (from, to, t) => from.map((v, i) => lerp(v, to[i], t));

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d, e = st.e;

      // ---- the ReLU version ----
      h += txt(TOP.x, 22, 15, 'ReLU: the transition of AlphaFold 2', ramp(a, 0, 0.2), { anchor: 'start', bold: true });
      h += cells(TOP, X, ramp(a, 0, 0.25)) + M(TOP.x + (D * CW) / 2, TOP.y + CH + 17, 13, 'x', ramp(a, 0, 0.25), { muted: true });
      h += arrow(TOP.x + D * CW + 8, TOP.y + CH / 2, TOP_H.x - 8, TOP.y + CH / 2, ramp(a, 0.25, 0.5)) + txt((TOP.x + D * CW + TOP_H.x) / 2, TOP.y - 4, 13, 'linear', ramp(a, 0.35, 0.55), { muted: true });
      h += cells(TOP_H, HV, ramp(a, 0.5, 0.8)) + txt(TOP_H.x + (H * CW) / 2, TOP.y + CH + 17, 13, 'widened: 6 numbers', ramp(a, 0.6, 0.85), { muted: true });
      h += arrow(TOP_H.x + H * CW + 8, TOP.y + CH / 2, TOP_R.x - 8, TOP.y + CH / 2, ramp(b, 0, 0.25));
      h += plot((TOP_H.x + H * CW + TOP_R.x) / 2, TOP.y - 14, relu, ramp(b, 0.1, 0.5), ramp(b, 0, 0.2)) + txt((TOP_H.x + H * CW + TOP_R.x) / 2, TOP.y + CH / 2 + 20, 13, 'ReLU', ramp(b, 0.2, 0.4), { muted: true, bold: true });
      const rt = ramp(b, 0.45, 0.8);
      h += cells(TOP_R, morph(HV, RV, rt), ramp(b, 0.3, 0.5)) + txt(TOP_R.x + (H * CW) / 2, TOP.y + CH + 17, 13, 'negatives set to 0', ramp(b, 0.6, 0.85), { muted: true });
      h += arrow(TOP_R.x + H * CW + 8, TOP.y + CH / 2, TOP_O.x - 8, TOP.y + CH / 2, ramp(b, 0.75, 0.95)) + txt((TOP_R.x + H * CW + TOP_O.x) / 2, TOP.y - 4, 13, 'linear', ramp(b, 0.8, 1), { muted: true });
      h += cells(TOP_O, OUT_R, ramp(b, 0.85, 1)) + txt(TOP_O.x + (D * CW) / 2, TOP.y + CH + 17, 13, 'back to 3', ramp(b, 0.9, 1), { muted: true });

      // ---- the SwiGLU version ----
      h += txt(BOT_X.x, 138, 15, 'SwiGLU: the transition of AlphaFold 3', ramp(c, 0, 0.2), { anchor: 'start', bold: true });
      h += cells(BOT_X, X, ramp(c, 0, 0.25)) + M(BOT_X.x + (D * CW) / 2, BOT_X.y + CH + 17, 13, 'x', ramp(c, 0, 0.25), { muted: true });
      const ax = BOT_X.x + D * CW + 8, ay = BOT_X.y + CH / 2;
      h += arrow(ax, ay - 6, BOT_A.x - 8, BOT_A.y + CH / 2, ramp(c, 0.25, 0.5)) + arrow(ax, ay + 6, BOT_B.x - 8, BOT_B.y + CH / 2, ramp(c, 0.25, 0.5));
      h += txt(150, 188, 13, 'linear', ramp(c, 0.35, 0.55), { muted: true }) + txt(150, 316, 13, 'linear', ramp(c, 0.35, 0.55), { muted: true });
      h += cells(BOT_A, AV, ramp(c, 0.5, 0.8)) + M(BOT_A.x + (H * CW) / 2, BOT_A.y - 10, 14, 'a', ramp(c, 0.55, 0.8), { bold: true });
      h += cells(BOT_B, BV, ramp(c, 0.55, 0.85)) + M(BOT_B.x + (H * CW) / 2, BOT_B.y - 10, 14, 'b', ramp(c, 0.6, 0.85), { bold: true });
      // swish of a
      h += arrow(BOT_A.x + H * CW + 8, BOT_A.y + CH / 2, BOT_S.x - 8, BOT_S.y + CH / 2, ramp(d, 0, 0.25));
      h += plot((BOT_A.x + H * CW + BOT_S.x) / 2, BOT_A.y - 8, swish, ramp(d, 0.1, 0.5), ramp(d, 0, 0.2)) + txt((BOT_A.x + H * CW + BOT_S.x) / 2, BOT_A.y + CH / 2 + 20, 13, 'swish', ramp(d, 0.2, 0.4), { muted: true, bold: true });
      const st4 = ramp(d, 0.45, 0.8);
      h += cells(BOT_S, morph(AV, SV, st4), ramp(d, 0.3, 0.5)) + M(BOT_S.x + (H * CW) / 2, BOT_S.y - 10, 14, '\\mathbf{swish}(\\boldsymbol{a})', ramp(d, 0.5, 0.8));
      // times b
      h += arrow(BOT_B.x + H * CW + 8, BOT_B.y + CH / 2, BOT_P.x - 8, BOT_P.y + CH / 2, ramp(d, 0.55, 0.75)) + M((BOT_B.x + H * CW + BOT_P.x) / 2, BOT_B.y + CH / 2 - 14, 18, '\\times', ramp(d, 0.65, 0.8));
      h += arrow(BOT_S.x + (H * CW) / 2, BOT_S.y + CH + 6, BOT_P.x + (H * CW) / 2, BOT_P.y - 8, ramp(d, 0.6, 0.8));
      h += cells(BOT_P, PV, ramp(d, 0.75, 0.95)) + R(BOT_P.x + (H * CW) / 2, BOT_P.y + CH + 17, 13, '$\\mathrm{swish}(a) \\times b$, entry by entry', ramp(d, 0.85, 1), { muted: true });
      // back to the size of x
      h += arrow(BOT_P.x + H * CW + 8, BOT_P.y + CH / 2, BOT_O.x - 8, BOT_O.y + CH / 2, ramp(e, 0, 0.25)) + txt((BOT_P.x + H * CW + BOT_O.x) / 2, BOT_P.y + CH / 2 - 14, 13, 'linear', ramp(e, 0.1, 0.35), { muted: true });
      h += cells(BOT_O, OUT_S, ramp(e, 0.3, 0.6)) + txt(BOT_O.x + (D * CW) / 2, BOT_O.y + CH + 17, 13, 'back to 3', ramp(e, 0.5, 0.75), { muted: true });
      h += txt(980, 22, 12, 'toy numbers (real arithmetic)', 1, { anchor: 'end', muted: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(heading)}</h2>
      <div class="sg-wrap"><svg viewBox="0 0 1000 345" role="img" aria-label="Two transition layers on the same numbers: the ReLU version widens x, sets the negative numbers to zero and shrinks the vector back; the SwiGLU version makes a and b from x with two linear layers, multiplies swish of a with b entry by entry and shrinks the vector back"></svg></div>
      <div class="sg-caps">${CAPTIONS.map((t, i) => `<p class="sg-cap reveal-in" data-show="${i + 1}">${AF3.rich(t, esc)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, heading.length)}`;
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
        const ms = [0, 4500, 5500, 4500, 6500, 4500][step], t0 = performance.now();
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
