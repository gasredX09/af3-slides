// "The Trunk" (slide 31): the figure of the original (the paper's picture of the trunk: the pair and single streams through the
// template module, the MSA module and the Pairformer, with recycling) redrawn natively, and played by a pair tensor z and a single
// tensor s that travel through it, changing as they go:
//
//   1  the two streams start: the pair z (one vector per pair of tokens) and the single s (one per token), made from the inputs
//   2  template module (2 blocks): the templates arrive and are added to z (z takes a green tint)
//   3  MSA module (4 blocks): the MSA and the inputs arrive; what co-evolves is written into z (orange); the MSA is then dropped
//   4  Pairformer (48 blocks): z and s go in; s skipped the first two modules; both come out refined
//   5  they come out, and are fed back to the start: the dashed loops (recycling), to run the trunk again, 4 cycles
//
// Checked against the supplement, Alg. 1 lines 7-14: each cycle z = z_init + Linear(LayerNorm(z_hat)), z += TemplateEmbedder(z),
// z += MsaModule(msa, z, s_inputs), s = s_init + Linear(LayerNorm(s_hat)), (s, z) = PairformerStack(s, z), then (s_hat, z_hat) = (s, z);
// N_cycle = 4 (its default). The single stream skips the template and MSA modules. In the Pairformer, triangle updates refine z and z
// biases the attention that refines s (Methods 3.6: s does not influence z). The original figure drew a second arrow from the inputs
// into the Pairformer; Alg. 1 gives the Pairformer only s and z, so the inputs are drawn going into the MSA module, which uses s_inputs.
// The cells of the two tensors, and their tints, are a schematic.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
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
const SEED = 7;
const BLUE = '#a9d8f2', PINK = '#f2b8e6', GREEN = '#3e9b7a', ORANGE = '#f7b97c', INPUT = '#8fd9a0';
const LINE = 'rgba(0,0,0,.3)';

// geometry, in map units (1000 x 380)
const Y_IN = 48, Y_Z = 178, Y_S = 292;
const MOD = { tmpl: { x: 190, w: 130 }, msa: { x: 360, w: 130 }, pair: { x: 560, w: 240 } };
const BOX_Y = 98, BOX_H = 130, PF_H = 240;
const X_PLUS_Z = 122, X_PLUS_S = 150, X_START = 95, X_OUT = 905;

const CAPTIONS = [
  'Two streams start from the input embeddings: a pair representation z, one vector for every pair of tokens, and a single representation s, one for every token.',
  'Template module (2 blocks): similar solved structures are embedded with z, averaged, and added to z.',
  'MSA module (4 blocks): related sequences write what co-evolves into z. The MSA is then dropped.',
  'Pairformer (48 blocks): triangle updates refine z, and z biases the attention that refines s. The single stream skipped the first two modules.',
  'z and s come out. They are also fed back to the start, and the trunk runs again: 4 cycles in all.',
];

AF3.kinds.trunk = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + `
      .tr-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 14.5%; }
      .tr-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .tr-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .tr-t.muted { fill: var(--muted); }
      .tr-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .tr-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const rand = rng(SEED);
    const zv = Array.from({ length: 16 }, () => rand());                 // the shade of each cell of z
    const sv = Array.from({ length: 5 }, () => rand());                  // and of s
    const tmplCells = new Set([1, 4, 6, 9, 11, 14]), msaCells = new Set([2, 3, 7, 8, 12, 13]);   // the cells the template and the MSA modules write into

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="tr-wrap"><svg viewBox="0 0 1000 400" role="img" aria-label="The trunk: a pair tensor and a single tensor travel through the template module, the MSA module and the Pairformer, and are fed back to the start"></svg></div>
      <div class="tr-caps">${CAPTIONS.map((c, i) => `<p class="tr-cap reveal-in" data-show="${i + 1}">${esc(c)}</p>`).join('')}</div>`;
    const svg = frame.querySelector('svg');

    // a polyline, and the point a fraction t of the way along it
    const along = (pts, t) => {
      const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), total = seg.reduce((a, b) => a + b, 0);
      let d = Math.max(0, Math.min(1, t)) * total;
      for (let i = 0; i < seg.length; i++) {
        if (d <= seg[i] || i === seg.length - 1) { const u = seg[i] ? d / seg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; }
        d -= seg[i];
      }
    };
    const d = (pts) => `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')}`;
    const head = (x, y, dir, c = 'var(--accent)') => {   // an arrowhead at (x, y) pointing right, down or up
      const p = { right: [[0, 0], [-11, -6], [-11, 6]], down: [[0, 0], [-6, -11], [6, -11]], up: [[0, 0], [-6, 11], [6, 11]] }[dir];
      return `<polygon points="${p.map(([a, b]) => `${(x + a).toFixed(1)},${(y + b).toFixed(1)}`).join(' ')}" fill="${c}"/>`;
    };
    const stream = 'var(--accent)', ORG = '#e0a03a';

    // the pair tensor as a 4 x 4 grid at (cx, cy): tinted by what the modules have written into it, and sharper once refined
    const zIcon = (cx, cy, aT, aM, aP, size = 40, op = 1) => {
      let g = '';
      for (let k = 0; k < 16; k++) {
        const i = k % 4, j = Math.floor(k / 4), cell = size / 4;
        let c = shade(BLUE, (zv[k] - 0.5) * 0.4);
        if (tmplCells.has(k)) c = lerpColor(c, GREEN, 0.7 * aT);
        if (msaCells.has(k)) c = lerpColor(c, ORANGE, 0.85 * aM);
        c = shade(c, (zv[k] - 0.5) * 0.5 * aP);   // refined: more contrast
        g += `<rect x="${(cx - size / 2 + i * cell).toFixed(1)}" y="${(cy - size / 2 + j * cell).toFixed(1)}" width="${cell}" height="${cell}" fill="${c}" stroke="${LINE}" stroke-width="1"/>`;
      }
      return `<g opacity="${op}">${g}</g>`;
    };
    const sIcon = (cx, cy, aP, w = 40, op = 1) => `<g opacity="${op}">${sv.map((v, i) => `<rect x="${(cx - w / 2 + (i * w) / 5).toFixed(1)}" y="${cy - 8}" width="${w / 5}" height="16" fill="${shade(PINK, (v - 0.5) * 0.5 * (0.5 + aP))}" stroke="${LINE}" stroke-width="1"/>`).join('')}</g>`;
    const cubeIcon = (x, y, c, op) => `<g opacity="${op.toFixed(2)}"><polygon points="${x},${y + 8} ${x + 8},${y} ${x + 36},${y} ${x + 28},${y + 8}" fill="${shade(c, 0.3)}" stroke="${LINE}"/><polygon points="${x + 28},${y + 8} ${x + 36},${y} ${x + 36},${y + 26} ${x + 28},${y + 34}" fill="${shade(c, -0.14)}" stroke="${LINE}"/><rect x="${x}" y="${y + 8}" width="28" height="26" fill="${c}" stroke="${LINE}"/></g>`;

    const draw = (st) => {
      const rb = ramp(st.b, 0.05, 0.55), rc = ramp(st.c, 0.05, 0.55), rd = ramp(st.d, 0.05, 0.5), re = ramp(st.e, 0.05, 0.45);
      const aT = ramp(st.b, 0.45, 0.9), aM = ramp(st.c, 0.45, 0.9), aP = ramp(st.d, 0.5, 0.95);
      const zx = X_START + 155 * rb + 190 * rc + 240 * rd + 225 * re, sx = X_START + 585 * ramp(st.d, 0.05, 0.55) + 225 * re;
      const act = { tmpl: ramp(st.b, 0.05, 0.25) * (1 - ramp(st.c, 0, 0.1)), msa: ramp(st.c, 0.05, 0.25) * (1 - ramp(st.d, 0, 0.1)), pair: ramp(st.d, 0.05, 0.25) * (1 - ramp(st.e, 0, 0.1)) };
      const on = ramp(st.a, 0, 0.3);
      let h = '';
      // ---- the lines: the pair stream, the single stream (which skips the first two modules), the inputs ----
      h += `<g opacity="${on.toFixed(2)}" fill="none" stroke="${stream}" stroke-width="3">`
        + `<path d="${d([[70, Y_IN], [450, Y_IN], [450, BOX_Y - 12]])}"/>`
        + `<path d="${d([[70, Y_Z], [X_PLUS_Z - 12, Y_Z]])}"/><path d="${d([[X_PLUS_Z + 12, Y_Z], [MOD.tmpl.x - 12, Y_Z]])}"/>`
        + `<path d="${d([[MOD.tmpl.x + MOD.tmpl.w, Y_Z], [MOD.msa.x - 12, Y_Z]])}"/><path d="${d([[MOD.msa.x + MOD.msa.w, Y_Z], [MOD.pair.x - 12, Y_Z]])}"/>`
        + `<path d="${d([[MOD.pair.x + MOD.pair.w, Y_Z], [880, Y_Z]])}"/>`
        + `<path d="${d([[70, Y_S], [X_PLUS_S - 12, Y_S]])}"/><path d="${d([[X_PLUS_S + 12, Y_S], [MOD.pair.x - 12, Y_S]])}"/><path d="${d([[MOD.pair.x + MOD.pair.w, Y_S], [880, Y_S]])}"/></g>`
        + `<g opacity="${on.toFixed(2)}">${head(450, BOX_Y - 2, 'down', stream)}${head(MOD.tmpl.x - 2, Y_Z, 'right', stream)}${head(MOD.msa.x - 2, Y_Z, 'right', stream)}${head(MOD.pair.x - 2, Y_Z, 'right', stream)}${head(MOD.pair.x - 2, Y_S, 'right', stream)}</g>`;
      // ---- the modules ----
      const box = (x, y, w, hh, label, a, k) => `<g opacity="${on.toFixed(2)}"><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="8" fill="${a > 0.01 ? `color-mix(in srgb, var(--accent) ${(a * 22).toFixed(0)}%, var(--bg))` : 'color-mix(in srgb, var(--fg) 4%, var(--bg))'}" stroke="${a > 0.5 ? 'var(--accent)' : 'color-mix(in srgb, var(--muted) 55%, transparent)'}" stroke-width="${a > 0.5 ? 3.5 : 2}"/>`
        + label.slice(0, -1).map((l, i) => `<text x="${x + w / 2}" y="${y + 24 + i * 23}" font-size="19" text-anchor="middle" font-weight="700" class="tr-t">${l}</text>`).join('')
        + `<text x="${x + w / 2}" y="${k === 'pair' ? y + 50 : y + hh - 16}" font-size="16" text-anchor="middle" class="tr-t muted">${label[label.length - 1]}</text></g>`;
      h += box(MOD.tmpl.x, BOX_Y, MOD.tmpl.w, BOX_H, ['Template', 'module', '2 blocks'], act.tmpl, 'tmpl')
        + box(MOD.msa.x, BOX_Y, MOD.msa.w, BOX_H, ['MSA', 'module', '4 blocks'], act.msa, 'msa')
        + box(MOD.pair.x, BOX_Y, MOD.pair.w, PF_H, ['Pairformer', '48 blocks'], act.pair, 'pair');
      // the blocks of the Pairformer fill as the tensors go through (48 ticks)
      const fill = ramp(st.d, 0.2, 0.85), ticks = 24;
      h += `<g opacity="${(on * 0.9).toFixed(2)}">` + Array.from({ length: ticks }, (_, i) => `<rect x="${MOD.pair.x + 14 + i * ((MOD.pair.w - 28) / ticks)}" y="${BOX_Y + PF_H - 26}" width="${(MOD.pair.w - 28) / ticks - 2}" height="10" rx="2" fill="${i / ticks < fill ? 'var(--accent)' : 'color-mix(in srgb, var(--muted) 30%, transparent)'}"/>`).join('') + '</g>';
      // ---- the "+" nodes where the recycled tensors are added ----
      const plus = (x, y) => `<g opacity="${on.toFixed(2)}"><circle cx="${x}" cy="${y}" r="12" fill="var(--bg)" stroke="${stream}" stroke-width="2"/><path d="M${x - 6} ${y} H${x + 6} M${x} ${y - 6} V${y + 6}" stroke="var(--fg)" stroke-width="2"/></g>`;
      h += plus(X_PLUS_Z, Y_Z) + plus(X_PLUS_S, Y_S);
      // ---- the labels and icons at the left, and where the inputs go ----
      h += `<g opacity="${on.toFixed(2)}"><rect x="8" y="${Y_IN - 9}" width="52" height="16" fill="${INPUT}" stroke="${LINE}"/><text x="34" y="${Y_IN + 28}" font-size="18" text-anchor="middle" class="tr-t">Inputs</text>`
        + `${zIcon(34, Y_Z - 6, 0, 0, 0, 40)}<text x="34" y="${Y_Z + 32}" font-size="18" text-anchor="middle" class="tr-t">Pair</text>`
        + `${sIcon(34, Y_S - 6, 0, 44)}<text x="34" y="${Y_S + 28}" font-size="18" text-anchor="middle" class="tr-t">Single</text></g>`;
      // ---- the templates and the MSA arriving from above ----
      const tIn = ramp(st.b, 0, 0.25), mIn = ramp(st.c, 0, 0.25) * (1 - ramp(st.c, 0.8, 1));
      h += cubeIcon(MOD.tmpl.x + MOD.tmpl.w / 2 - 18, -8 + 14 * (1 - tIn), GREEN, tIn) + `<text x="${MOD.tmpl.x + MOD.tmpl.w / 2}" y="${Y_IN - 14}" font-size="15" text-anchor="middle" class="tr-t muted" opacity="${tIn.toFixed(2)}">templates</text>`
        + `<g opacity="${tIn.toFixed(2)}"><path d="M${MOD.tmpl.x + MOD.tmpl.w / 2} ${Y_IN - 4} V${BOX_Y - 14}" stroke="${ORG}" stroke-width="3"/>${head(MOD.tmpl.x + MOD.tmpl.w / 2, BOX_Y - 2, 'down', ORG)}</g>`
        + cubeIcon(MOD.msa.x + 40 - 18, -8 + 14 * (1 - ramp(st.c, 0, 0.25)), ORANGE, mIn) + `<text x="${MOD.msa.x + 40}" y="${Y_IN - 14}" font-size="15" text-anchor="middle" class="tr-t muted" opacity="${mIn.toFixed(2)}">MSA</text>`
        + `<g opacity="${mIn.toFixed(2)}"><path d="M${MOD.msa.x + 40} ${Y_IN - 4} V${BOX_Y - 14}" stroke="${ORG}" stroke-width="3"/>${head(MOD.msa.x + 40, BOX_Y - 2, 'down', ORG)}</g>`;
      // ---- the outputs, and the loops back (recycling) ----
      const outOp = ramp(st.e, 0.3, 0.55);
      h += `<g opacity="${outOp.toFixed(2)}"><text x="${X_OUT + 38}" y="${Y_Z + 38}" font-size="15" text-anchor="middle" class="tr-t muted">z trunk</text><text x="${X_OUT + 38}" y="${Y_S + 22}" font-size="15" text-anchor="middle" class="tr-t muted">s trunk</text></g>`;
      const zLoop = [[840, Y_Z], [840, 376], [X_PLUS_Z, 376], [X_PLUS_Z, Y_Z + 14]], sLoop = [[830, Y_S], [830, 358], [X_PLUS_S, 358], [X_PLUS_S, Y_S + 14]];
      const loopT = ramp(st.e, 0.45, 0.9);
      h += `<g fill="none" stroke="${stream}" stroke-width="2.5" stroke-dasharray="7 6" opacity="${ramp(st.e, 0.3, 0.45).toFixed(2)}"><path d="${d(zLoop)}"/><path d="${d(sLoop)}"/></g>`
        + `<g opacity="${ramp(st.e, 0.8, 1).toFixed(2)}">${head(X_PLUS_Z, Y_Z + 12, 'up', stream)}${head(X_PLUS_S, Y_S + 12, 'up', stream)}</g>`
        + `<text x="${(X_PLUS_Z + 840) / 2}" y="394" font-size="19" text-anchor="middle" class="tr-t" style="fill:${st.e > 0.4 ? 'var(--accent)' : 'var(--muted)'}" opacity="${ramp(st.e, 0.3, 0.5).toFixed(2)}">Recycling · 4 cycles</text>`;
      // ---- the two tensors that travel ----
      if (st.a > 0.2) {
        const back = ramp(st.e, 0.5, 0.95);   // after the outputs, copies run back along the loops
        h += zIcon(zx, Y_Z, aT, aM, aP, 40, ramp(st.a, 0.2, 0.5)) + sIcon(sx, Y_S, aP, 40, ramp(st.a, 0.2, 0.5));
        if (back > 0 && back < 1) {
          const [px, py] = along(zLoop, back), [qx, qy] = along(sLoop, back);
          h += zIcon(px, py, aT, aM, aP, 22, 0.9 * Math.sin(Math.PI * back)) + sIcon(qx, qy, aP, 22, 0.9 * Math.sin(Math.PI * back));
        }
      }
      svg.innerHTML = h;
    };

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
        const ms = [0, 3000, 3400, 3400, 4200, 4800][step], t0 = performance.now();
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
