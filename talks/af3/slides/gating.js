// "Conditioned Gating" (appendix, slide 67): the figure of the original (Simon, The Illustrated AlphaFold: "Gate q based on c": c is projected by a linear layer and a sigmoid into a gate;
// q is multiplied by the gate entry by entry) redrawn natively and played a click at a time on a toy of 4 atoms and 5 channels:
//
//   1  q, what a block has just computed for each atom, and c, the conditioning of each atom (one vector per atom)
//   2  c goes through a linear layer and a sigmoid: every number of the gate is between 0 and 1
//   3  q is multiplied by the gate entry by entry: where the gate is near 0 the channel is switched off, near 1 it passes
//   4  in AF3 this closes the output of every attention block and Transition block of the diffusion module; the gate's bias starts at -2
//
// Checked against the supplement, Alg. 24 (DiffusionAttention with pair bias and mask, "Output projection (from adaLN-Zero)"): if s is given, a_i <- sigmoid(Linear(s_i, biasinit = -2.0)) * a_i;
// Alg. 25 (ConditionedTransitionBlock): a <- sigmoid(Linear(s, biasinit = -2.0)) * LinearNoBias(b), the last step of a SwiGLU transition with adaptive layer norm (Alg. 26, AdaLN). In the atom
// transformer (Alg. 5 line 15, Alg. 7) the conditioning s is the atom conditioning c and the activations a are q; in the diffusion transformer (Alg. 23) they are s and the token activations a.
// sigmoid(-2) = 0.119: the gate of zero input once the bias is -2. The supplement does not say more about the choice than "from adaLN-Zero" [27]. The cells are real arithmetic on toy weights
// (seed 14): the gate is sigmoid(c W) for a random matrix W, and the last matrix is q times the gate. Left out: the layer norm, the attention or SwiGLU computation that makes q, the bias of
// the linear layer in the cells (it is 0 here, so the gate of an average c is about 0.5), and the sizes (4 atoms and 5 channels stand in for N_atoms and c_atom = 128).
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
const SEED = 14;
const LINE = 'rgba(0,0,0,.3)';
const Q_LIGHT = '#f1e3f5', Q_DEEP = '#a855b5', G_LIGHT = '#fff0f6', G_DEEP = '#c2255c', C_POS = '#e07a2a', C_NEG = '#4c6ef5', C_LIGHT = '#fff7ee';
const NA = 4, NC = 5, CW = 42, CH = 28;
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

// geometry, in map units (1000 x 385)
const C0 = { x: 56, y: 44 }, G0 = { x: 364, y: 44 }, Q0 = { x: 56, y: 224 }, R0 = { x: 364, y: 224 };
const PX = 654;   // the panel of the last step

const CAPTIONS = [
  'q is what a block has just computed for each atom: one vector per atom. c is the conditioning of each atom, also one vector per atom. We let c decide how much of q to let through.',
  'c goes through a linear layer and a sigmoid. A sigmoid squeezes every number into the range from 0 to 1, so each number of the gate says how much to let through.',
  'q is multiplied by the gate entry by entry. Where the gate is close to 0 a channel is switched off, where it is close to 1 the channel passes.',
  'In AF3 this closes the output of every attention block and Transition block of the diffusion module: a ← sigmoid(Linear(s)) × a. The bias of the linear layer starts at −2, which alone gives a gate of 0.12.',
];

AF3.kinds.gating = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .gt-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .gt-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .gt-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .gt-t.muted { fill: var(--muted); }
      .gt-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .gt-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const heading = AF3.apTitle(s);

    // ---- the arithmetic, on toy weights ----
    const rand = rng(SEED);
    const CV = Array.from({ length: NA }, () => Array.from({ length: NC }, () => rand() * 2 - 1));
    const W = Array.from({ length: NC }, () => Array.from({ length: NC }, () => (rand() * 2 - 1) * 1.6));
    const GV = CV.map((row) => W[0].map((_, j) => sigmoid(row.reduce((t, x, i) => t + x * W[i][j], 0))));
    const QV = Array.from({ length: NA }, () => Array.from({ length: NC }, () => 0.35 + 0.6 * rand()));
    const RV = QV.map((row, a) => row.map((x, j) => x * GV[a][j]));

    // ---- helpers ----
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="gt-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const matrix = (g0, V, colFn, fmt, op, grow = 1) => {
      if (op < 0.01) return '';
      let h = '';
      V.forEach((row, a) => row.forEach((v, j) => {
        h += `<rect x="${g0.x + j * CW}" y="${g0.y + a * CH}" width="${CW}" height="${CH}" fill="${colFn(v, a, j)}" stroke="${LINE}" stroke-width="1"/>`
          + `<text x="${g0.x + j * CW + CW / 2}" y="${g0.y + a * CH + CH / 2}" font-size="12.5" class="gt-t" text-anchor="middle" style="fill:#1d2129">${fmt(v, a, j)}</text>`;
      }));
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const arrow = (x1, y1, x2, y2, op) => {
      if (op < 0.01) return '';
      const a = Math.atan2(y2 - y1, x2 - x1);
      return `<g opacity="${op.toFixed(2)}"><line x1="${x1}" y1="${y1}" x2="${(x2 - Math.cos(a) * 8).toFixed(1)}" y2="${(y2 - Math.sin(a) * 8).toFixed(1)}" stroke="var(--accent)" stroke-width="2.5"/>`
        + `<polygon points="${x2},${y2} ${(x2 - Math.cos(a) * 10 - Math.sin(a) * 5.5).toFixed(1)},${(y2 - Math.sin(a) * 10 + Math.cos(a) * 5.5).toFixed(1)} ${(x2 - Math.cos(a) * 10 + Math.sin(a) * 5.5).toFixed(1)},${(y2 - Math.sin(a) * 10 - Math.cos(a) * 5.5).toFixed(1)}" fill="var(--accent)"/></g>`;
    };
    const sigPlot = (x0, y0, w, hh, t, op, marker) => {   // the sigmoid, drawn left to right as far as t, over x in [-5, 5]; marker = the x of a dot
      if (op < 0.01) return '';
      const px = (x) => x0 + ((x + 5) / 10) * w, py = (y) => y0 + hh - y * hh;
      let d = '';
      for (let i = 0; i <= 60 * t; i++) { const x = -5 + (i / 60) * 10; d += `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${py(sigmoid(x)).toFixed(1)}`; }
      let g = `<g opacity="${op.toFixed(2)}"><rect x="${x0 - 6}" y="${y0 - 6}" width="${w + 12}" height="${hh + 12}" rx="4" fill="var(--bg)" stroke="var(--muted)" stroke-width="1" opacity=".9"/>`
        + `<line x1="${x0}" y1="${py(0).toFixed(1)}" x2="${x0 + w}" y2="${py(0).toFixed(1)}" stroke="var(--muted)" stroke-width="1"/><line x1="${px(0).toFixed(1)}" y1="${y0}" x2="${px(0).toFixed(1)}" y2="${y0 + hh}" stroke="var(--muted)" stroke-width="1"/>`
        + `<line x1="${x0}" y1="${py(1).toFixed(1)}" x2="${x0 + w}" y2="${py(1).toFixed(1)}" stroke="var(--muted)" stroke-width=".8" stroke-dasharray="3 3"/>`
        + `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/>`;
      if (marker !== undefined) g += `<line x1="${px(marker).toFixed(1)}" y1="${py(sigmoid(marker)).toFixed(1)}" x2="${px(marker).toFixed(1)}" y2="${py(0).toFixed(1)}" stroke="${G_DEEP}" stroke-width="1.6" stroke-dasharray="4 3"/><line x1="${x0}" y1="${py(sigmoid(marker)).toFixed(1)}" x2="${px(marker).toFixed(1)}" y2="${py(sigmoid(marker)).toFixed(1)}" stroke="${G_DEEP}" stroke-width="1.6" stroke-dasharray="4 3"/><circle cx="${px(marker).toFixed(1)}" cy="${py(sigmoid(marker)).toFixed(1)}" r="5" fill="${G_DEEP}"/>`;
      return g + '</g>';
    };
    const cCol = (v) => (v >= 0 ? lerpColor(C_LIGHT, C_POS, Math.min(1, v)) : lerpColor('#eef2ff', C_NEG, Math.min(1, -v)));
    const rowLabels = (g0, op) => NA && Array.from({ length: NA }, (_, a) => txt(g0.x - 8, g0.y + a * CH + CH / 2, 12.5, `atom ${a}`, op, { anchor: 'end', muted: true })).join('');

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d;

      // ---- step 1: q and c ----
      const o1 = ramp(a, 0, 0.35), o2 = ramp(a, 0.2, 0.55);
      h += matrix(C0, CV, (v) => cCol(v), (v) => v.toFixed(1), o1) + rowLabels(C0, o1) + txt(C0.x + (NC * CW) / 2, C0.y - 14, 17, 'c', o1, { bold: true }) + txt(C0.x + (NC * CW) / 2, C0.y + NA * CH + 16, 12.5, 'the conditioning: one vector per atom', o1, { muted: true });
      h += matrix(Q0, QV, (v) => lerpColor(Q_LIGHT, Q_DEEP, v), (v) => v.toFixed(2), o2) + rowLabels(Q0, o2) + txt(Q0.x + (NC * CW) / 2, Q0.y - 14, 17, 'q', o2, { bold: true }) + txt(Q0.x + (NC * CW) / 2, Q0.y + NA * CH + 16, 12.5, 'what the block computed: one vector per atom', o2, { muted: true });
      h += txt(Q0.x - 40, Q0.y - 14, 12.5, '', 0);

      // ---- step 2: the gate ----
      const arr = ramp(b, 0, 0.3), gp = ramp(b, 0.25, 0.7), gm = ramp(b, 0.45, 0.9);
      h += arrow(C0.x + NC * CW + 12, C0.y + (NA * CH) / 2, G0.x - 14, G0.y + (NA * CH) / 2, arr);
      h += txt((C0.x + NC * CW + G0.x) / 2, C0.y + (NA * CH) / 2 + 20, 13, 'linear,', ramp(b, 0.2, 0.4), { muted: true }) + txt((C0.x + NC * CW + G0.x) / 2, C0.y + (NA * CH) / 2 + 35, 13, 'sigmoid', ramp(b, 0.25, 0.45), { muted: true });
      h += sigPlot((C0.x + NC * CW + G0.x) / 2 - 32, C0.y - 8, 64, 40, gp, ramp(b, 0.15, 0.35));
      h += matrix(G0, GV, (v) => lerpColor(G_LIGHT, G_DEEP, v), (v) => v.toFixed(2), gm);
      h += txt(G0.x + (NC * CW) / 2, G0.y - 14, 17, 'gate', gm, { bold: true }) + txt(G0.x + (NC * CW) / 2, G0.y + NA * CH + 16, 12.5, 'every number between 0 and 1', gm, { muted: true });

      // ---- step 3: q times the gate ----
      const mu = ramp(c, 0, 0.3), rs = ramp(c, 0.3, 0.85);
      h += arrow(Q0.x + NC * CW + 12, Q0.y + (NA * CH) / 2, R0.x - 14, R0.y + (NA * CH) / 2, mu) + txt((Q0.x + NC * CW + R0.x) / 2, Q0.y + (NA * CH) / 2 - 12, 18, '×', ramp(c, 0.1, 0.3), { bold: true }) + txt((Q0.x + NC * CW + R0.x) / 2, Q0.y + (NA * CH) / 2 + 22, 13, 'the gate,', ramp(c, 0.15, 0.35), { muted: true }) + txt((Q0.x + NC * CW + R0.x) / 2, Q0.y + (NA * CH) / 2 + 37, 13, 'entry by entry', ramp(c, 0.2, 0.4), { muted: true });
      h += arrow(G0.x + (NC * CW) / 2 + 60, G0.y + NA * CH + 30, R0.x + (NC * CW) / 2 + 60, R0.y - 22, ramp(c, 0.05, 0.3));
      h += matrix(R0, RV, (v, aa, j) => lerpColor(Q_LIGHT, Q_DEEP, lerp(QV[aa][j], v, rs)), (v, aa, j) => lerp(QV[aa][j], v, rs).toFixed(2), ramp(c, 0.25, 0.5));
      h += txt(R0.x + (NC * CW) / 2, R0.y - 14, 17, 'q × gate', ramp(c, 0.3, 0.55), { bold: true }) + txt(R0.x + (NC * CW) / 2, R0.y + NA * CH + 16, 12.5, 'switched off where the gate is near 0', ramp(c, 0.7, 0.95), { muted: true });

      // ---- step 4: where it is used, and the bias ----
      const p4 = ramp(d, 0, 0.35), pl = ramp(d, 0.1, 0.7);
      h += rect(PX - 16, 28, 346, 330, 'var(--bg)', 'var(--muted)', 1.5, p4, 12);
      h += txt(PX + 157, 52, 15, 'In every block of the diffusion module', p4, { bold: true });
      h += sigPlot(PX + 24, 78, 266, 120, pl, p4, ramp(d, 0.55, 0.85) > 0.5 ? -2 : undefined);
      h += txt(PX + 157, 224, 17, 'a ← sigmoid(Linear(s)) × a', ramp(d, 0.3, 0.6), { bold: true });
      h += txt(PX + 157, 252, 14, 'the bias of the linear layer starts at −2', ramp(d, 0.55, 0.85), { muted: true });
      h += txt(PX + 157, 272, 14, 'a gate of sigmoid(−2) = 0.12 for zero input', ramp(d, 0.6, 0.9), { muted: true, fill: G_DEEP });
      h += txt(PX + 157, 304, 13.5, 'after every attention and Transition block;', ramp(d, 0.7, 1), { muted: true });
      h += txt(PX + 157, 322, 13.5, 's is c in the atom blocks, s in the token blocks', ramp(d, 0.75, 1), { muted: true });
      h += txt(PX - 16, 376, 12, 'toy numbers (real arithmetic)', 1, { anchor: 'start', muted: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(heading)}</h2>
      <div class="gt-wrap"><svg viewBox="0 0 1000 385" role="img" aria-label="Conditioned gating: the conditioning c goes through a linear layer and a sigmoid and becomes a gate with every number between 0 and 1; q is multiplied by the gate entry by entry, so channels where the gate is near zero are switched off; in AF3 the gate closes the output of every attention and Transition block of the diffusion module, and its bias starts at minus two"></svg></div>
      <div class="gt-caps">${CAPTIONS.map((t, i) => `<p class="gt-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, heading.length)}`;
    const svg = frame.querySelector('svg');

    const KEYS = ['a', 'b', 'c', 'd'];
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 3500, 6000, 6000, 6500][step], t0 = performance.now();
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
