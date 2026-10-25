// "Inside Template Module" (slide 33): the figure of the original (templates t, each projected, z added to each, a Pairformer on each,
// an average over the templates, a linear projection to u) redrawn natively and played with three template maps that travel through it:
//
//   1  templates: known structures of similar proteins (up to 4), each as a pair map (a distance for every pair of residues)
//   2  z, the model's current belief about every pair, is projected and added to every template
//   3  each template goes through a small Pairformer (2 blocks) on its own
//   4  the three are averaged into one map, then ReLU and a linear layer give u, the same shape as z
//   5  u is added to z; this runs in each of the 4 recycling cycles
//
// Checked against the supplement, Alg. 16: per template v = Linear(LayerNorm(z)) + Linear(a_t), PairformerStack(v, N_block = 2),
// u += LayerNorm(v); then u / N_templates, Linear(ReLU(u)); Alg. 1 line 9, z += TemplateEmbedder(f, z), in each of the N_cycle = 4
// cycles; Methods 2.4: at most 4 templates (N_templ <= 4), protein chains only; Table 5: the template features are a distogram of
// C-beta distances, a unit vector (the direction between residues, in each residue's frame), masks and the residue types. The last
// layer maps to c_z channels, as in the reference code (template_modules.py, output_linear has query_num_channels outputs), so u can
// be added to z; Alg. 16's own comment says u is in R^c, which is the width inside the module (c = 64), not what it leaves with. The
// LayerNorms are left out of the drawing. The maps are a toy (a five-residue hairpin, seed 5), the cells and depths a schematic.
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
const SEED = 5;
const LINE = 'rgba(0,0,0,.3)';
const FAR = '#d3ecdf', NEAR = '#2f8a69', BLUE = '#a9d8f2', TEAL = '#4fb3c4';

// geometry, in map units (1000 x 385)
const N = 5, SIDE = 80, DX = 16, DY = 13;                  // cells per side, a sheet's side, the offset between stacked sheets
const CY = 125, CX = [100, 340, 640], U_CX = 915;           // the row of tensors: templates, with z added, after the Pairformer, u
const BOX = { x: 430, w: 110, y: 62, h: 126 };              // the Pairformer
const ROW2 = 312;                                            // the row of z
const EQ = { z: 615, u: 770, n: 925 };                      // z + u = new z, centres of the front faces (a cube reaches 35 left and 55 right of it)

const CAPTIONS = [
  'Each template, a known structure of a similar protein (up to 4 are used), becomes a pair map: for every pair of residues, how far apart they are and which way one points from the other.',
  'z, the model’s current belief about every pair, is projected and added to each template. That lets the network attend to the regions of a template that matter for what it believes so far.',
  'Each template goes through a small Pairformer (2 blocks) on its own, so the templates do not mix yet.',
  'Now they mix: the templates are averaged into one pair map, and a ReLU and a linear layer turn it into u, with the same shape as z.',
  'u is added to z. This runs in each recycling cycle (4 in all), so from the second cycle on the templates are read in light of the last cycle’s z.',
];

AF3.kinds.templates = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .tp-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .tp-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .tp-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .tp-t.muted { fill: var(--muted); }
      .tp-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .tp-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // ---- the toy data: three templates of one six-residue hairpin, as distance maps (1 = close), and their mean ----
    const rand = rng(SEED);
    const HAIRPIN = [[0, 0], [1, 0.15], [2, 0], [2.1, 1.1], [1.05, 1.3]];
    const V = [0, 1, 2].map(() => {
      const P = HAIRPIN.map(([x, y]) => [x + (rand() - 0.5) * 0.5, y + (rand() - 0.5) * 0.5]);
      return P.map((a) => P.map((b) => 1 - Math.min(1, Math.hypot(a[0] - b[0], a[1] - b[1]) / 2.4)));
    });
    const MEAN = V[0].map((row, i) => row.map((_, j) => (V[0][i][j] + V[1][i][j] + V[2][i][j]) / 3));
    const ZV = Array.from({ length: N }, () => Array.from({ length: N }, () => rand()));   // the shade of each cell of z
    const ZP = Array.from({ length: N }, () => Array.from({ length: N }, () => 0.3 + 0.5 * rand()));   // how much of z each cell of a template takes

    // ---- drawing helpers ----
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="tp-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const head = (x, y, dir, c) => {
      const p = { right: [[0, 0], [-11, -6], [-11, 6]], up: [[0, 0], [-6, 11], [6, 11]] }[dir];
      return `<polygon points="${p.map(([a, b]) => `${(x + a).toFixed(1)},${(y + b).toFixed(1)}`).join(' ')}" fill="${c}"/>`;
    };
    const arrow = (x1, y1, x2, y2, op, c = 'var(--accent)') => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="3" fill="none"/>${head(x2, y2, y1 === y2 ? 'right' : 'up', c)}</g>`;
    const plus = (x, y, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><circle cx="${x}" cy="${y}" r="13" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/><path d="M${x - 6} ${y} H${x + 6} M${x} ${y - 6} V${y + 6}" stroke="var(--fg)" stroke-width="2"/></g>`;
    const equals = (x, y, op) => op < 0.01 ? '' : `<g opacity="${op.toFixed(2)}"><path d="M${x - 8} ${y - 4} H${x + 8} M${x - 8} ${y + 4} H${x + 8}" stroke="var(--fg)" stroke-width="2.5"/></g>`;

    // a pair map: n x n cells with its front face at (x0, y0), a depth (the channels) drawn as a top and a right face
    const map = (x0, y0, side, depth, col, edge, op) => {
      if (op < 0.01) return '';
      const c = side / N, dx = depth, dy = -depth * 0.8;
      let g = '';
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) g += `<rect x="${(x0 + i * c).toFixed(1)}" y="${(y0 + j * c).toFixed(1)}" width="${c.toFixed(1)}" height="${c.toFixed(1)}" fill="${col(i, j)}" stroke="${LINE}" stroke-width="1"/>`;
      g += `<polygon points="${x0},${y0} ${x0 + dx},${y0 + dy} ${x0 + side + dx},${y0 + dy} ${x0 + side},${y0}" fill="${shade(edge, 0.3)}" stroke="${LINE}" stroke-width="1"/>`
        + `<polygon points="${x0 + side},${y0} ${x0 + side + dx},${y0 + dy} ${x0 + side + dx},${y0 + side + dy} ${x0 + side},${y0 + side}" fill="${shade(edge, -0.14)}" stroke="${LINE}" stroke-width="1"/>`;
      return `<g opacity="${op.toFixed(2)}">${g}</g>`;
    };
    // the colour of cell (i, j) of template k: its distance (dark = close), tinted by z, sharper after the Pairformer, shifted for u
    const tcol = (k, L) => (i, j) => {
      const v = lerp(V[k][i][j], MEAN[i][j], L.mean || 0);
      let c = lerpColor(FAR, NEAR, v);
      if (L.tint) c = lerpColor(c, BLUE, L.tint * ZP[i][j]);
      if (L.con) c = shade(c, -(v - 0.5) * 0.7 * L.con);
      if (L.proj) c = lerpColor(c, TEAL, 0.35 * L.proj);
      return c;
    };
    const zcol = (tintFrom) => (i, j) => {
      const c = shade(BLUE, (ZV[i][j] - 0.5) * 0.4);
      return tintFrom ? lerpColor(c, NEAR, tintFrom * 0.6 * MEAN[i][j]) : c;
    };
    // the top-left of sheet k of the stack centred at cx (sheet 0 in front)
    const at = (cx, k) => [cx - 62 + DX * k, CY - 21.5 - DY * k];
    const U_XY = [U_CX - 50, CY - 26];   // where u's front face sits

    const draw = (st) => {
      let h = '';
      // ---- the arrows and the labels of the steps ----
      h += arrow(168, CY, 270, CY, ramp(st.b, 0.25, 0.4))
        + arrow(CX[1] + 66, CY, BOX.x - 2, CY, ramp(st.c, 0, 0.1)) + arrow(BOX.x + BOX.w, CY, CX[2] - 66, CY, ramp(st.c, 0, 0.1))
        + arrow(CX[2] + 70, CY, U_CX - 56, CY, ramp(st.d, 0.45, 0.6));
      h += txt(220, 104, 16, 'linear', ramp(st.b, 0.78, 0.92), { muted: true })
        + txt(CX[2], 205, 16, 'average', ramp(st.d, 0.05, 0.2), { muted: true })
        + txt(790, 104, 16, 'ReLU + linear', ramp(st.d, 0.8, 0.95), { muted: true });

      // ---- the row of z: z, its projection, and the arrow that adds it to every template ----
      const zIn = ramp(st.b, 0, 0.2), zpIn = ramp(st.b, 0.3, 0.5), upA = ramp(st.b, 0.5, 0.65);
      h += map(65, ROW2 - 35, 70, 20, zcol(0), BLUE, zIn) + txt(100, 372, 19, 'z', zIn, { bold: true })
        + arrow(168, ROW2, 296, ROW2, ramp(st.b, 0.15, 0.3)) + txt(232, ROW2 - 14, 16, 'linear', ramp(st.b, 0.2, 0.35), { muted: true })
        + map(305, ROW2 - 35, 70, 14, zcol(0), BLUE, zpIn) + txt(340, 372, 19, 'projected z', zpIn, { bold: true })
        + arrow(CX[1], ROW2 - 52, CX[1], CY + 66, upA) + txt(CX[1] + 14, 232, 16, 'added to', upA, { muted: true, anchor: 'start' }) + txt(CX[1] + 14, 250, 16, 'every template', upA, { muted: true, anchor: 'start' });

      // ---- the stacks of template maps ----
      const dimB = 1 - 0.3 * ramp(st.c, 0.08, 0.3), dimA = 1 - 0.3 * ramp(st.b, 0.3, 0.6), dimC = 1 - 0.3 * ramp(st.d, 0.06, 0.3);
      // A: the templates as they come in
      for (let k = 2; k >= 0; k--) {
        const r = ramp(st.a, 0.08 + 0.22 * k, 0.45 + 0.22 * k), [x, y] = at(CX[0], k);
        h += map(x - 34 * (1 - r), y, SIDE, 8, tcol(k, {}), NEAR, r * dimA);
      }
      // B: z added to each (the sheets slide over from A, then take z's tint)
      if (st.b > 0.2) {
        for (let k = 2; k >= 0; k--) {
          const m = ramp(st.b, 0.28 + 0.06 * k, 0.68 + 0.06 * k), [x0, y0] = at(CX[0], k), [x1, y1] = at(CX[1], k);
          h += map(lerp(x0, x1, m), lerp(y0, y1, m), SIDE, lerp(8, 14, m), tcol(k, { tint: ramp(st.b, 0.7, 1) }), NEAR, ramp(st.b, 0.22, 0.3) * dimB);
        }
      }
      // C: each through the Pairformer on its own, front sheet first (the box is drawn over them, so they pass behind it)
      if (st.c > 0) {
        for (let k = 2; k >= 0; k--) {
          const m = ramp(st.c, 0.06 + 0.14 * k, 0.56 + 0.14 * k), [x0, y0] = at(CX[1], k), [x1, y1] = at(CX[2], k);
          h += map(lerp(x0, x1, m), lerp(y0, y1, m), SIDE, 14, tcol(k, { tint: 1, con: ramp(m, 0.4, 0.7) }), NEAR, dimC);
        }
      }
      // D: the three converge into their average, which travels on to u
      if (st.d > 0) {
        const p1 = ramp(st.d, 0.05, 0.4), mean = ramp(st.d, 0.2, 0.4), p2 = ramp(st.d, 0.5, 0.92);
        for (let k = 2; k >= 0; k--) {
          const [x0, y0] = at(CX[2], k), [fx, fy] = at(CX[2], 0);
          let x = lerp(x0, fx, p1), y = lerp(y0, fy, p1), dep = 14;
          if (k > 0 && p1 > 0.98) continue;   // the three are one map now
          if (k === 0) { x = lerp(x, U_XY[0], p2); y = lerp(y, U_XY[1], p2); dep = lerp(14, 20, p2); }
          h += map(x, y, SIDE, dep, tcol(k, { tint: 1, con: 1, mean, proj: ramp(p2, 0.3, 1) }), lerpColor(NEAR, TEAL, 0.35 * ramp(p2, 0.3, 1)), 1);
        }
      }

      // ---- the Pairformer, drawn over the sheets that pass through it ----
      const act = ramp(st.c, 0.02, 0.15) * (1 - ramp(st.c, 0.85, 1)), fill = ramp(st.c, 0.3, 0.9) * 2;
      h += `<g opacity="${ramp(st.c, 0, 0.1).toFixed(2)}"><rect x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}" rx="8" fill="color-mix(in srgb, var(--accent) ${(10 + act * 14).toFixed(0)}%, var(--bg))" stroke="var(--accent)" stroke-width="${act > 0.5 ? 3.5 : 2.5}"/>`
        + `<text x="${BOX.x + BOX.w / 2}" y="${BOX.y + 36}" font-size="21" text-anchor="middle" font-weight="700" class="tp-t">Pairformer</text>`
        + `<text x="${BOX.x + BOX.w / 2}" y="${BOX.y + 62}" font-size="16" text-anchor="middle" class="tp-t muted">2 blocks</text>`
        + [0, 1].map((i) => `<rect x="${BOX.x + 14 + i * 44}" y="${BOX.y + BOX.h - 30}" width="38" height="10" rx="2" fill="${i < fill ? 'var(--accent)' : 'color-mix(in srgb, var(--muted) 30%, transparent)'}"/>`).join('') + '</g>';

      // ---- the names of the stacks ----
      const nm = (x, letter, word, op) => txt(x, 22, 21, `<tspan font-weight="700">${letter}</tspan>  ${word}`, op);
      h += nm(CX[0] + 5, 't', 'templates', ramp(st.a, 0.1, 0.3)) + txt(CX[0] + 5, 44, 15, 'up to 4', ramp(st.a, 0.1, 0.3), { muted: true })
        + nm(CX[1] + 5, 'v', 'templates + z', ramp(st.b, 0.65, 0.85)) + nm(CX[2] + 5, 'v', 'after the Pairformer', ramp(st.c, 0.75, 0.95))
        + nm(U_CX, 'u', 'one map', ramp(st.d, 0.85, 1)) + txt(U_CX, 44, 15, 'same shape as z', ramp(st.d, 0.85, 1), { muted: true });
      // what the grids are
      h += ['Each grid: one cell', 'for every pair of tokens.', 'The depth is the channels.'].map((l, i) => txt(30, 214 + i * 18, 15, l, ramp(st.a, 0.5 + 0.1 * i, 0.8 + 0.1 * i), { muted: true, anchor: 'start' })).join('');

      // ---- step 5: u is added to z ----
      const e1 = ramp(st.e, 0, 0.2), eu = ramp(st.e, 0.15, 0.6), e2 = ramp(st.e, 0.6, 0.8), e3 = ramp(st.e, 0.7, 1);
      if (st.e > 0) {
        const ux = lerp(U_XY[0] + 50, EQ.u, eu), uy = lerp(U_XY[1] + 26, ROW2, eu);   // u's copy comes down from above
        h += map(EQ.z - 35, ROW2 - 35, 70, 20, zcol(0), BLUE, e1) + txt(EQ.z, 372, 19, 'z', e1, { bold: true })
          + plus((EQ.z + EQ.u) / 2 + 10, ROW2, e1)
          + map(ux - 35, uy - 35, 70, 20, tcol(0, { tint: 1, con: 1, mean: 1, proj: 1 }), lerpColor(NEAR, TEAL, 0.35), ramp(st.e, 0.1, 0.25)) + txt(EQ.u, 372, 19, 'u', eu, { bold: true })
          + equals((EQ.u + EQ.n) / 2 + 10, ROW2, e2)
          + map(EQ.n - 35, ROW2 - 35, 70, 20, zcol(e3), BLUE, e2) + txt(EQ.n, 372, 19, 'z + u', e2, { bold: true });
      }
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="tp-wrap"><svg viewBox="0 0 1000 385" role="img" aria-label="Inside the template module: template pair maps get z added, go through a small Pairformer one at a time, are averaged into u, and u is added to z"></svg></div>
      <div class="tp-caps">${CAPTIONS.map((c, i) => `<p class="tp-cap reveal-in" data-show="${i + 1}">${esc(c)}</p>`).join('')}</div>
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
        const ms = [0, 3400, 4600, 4800, 5000, 4200][step], t0 = performance.now();
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
