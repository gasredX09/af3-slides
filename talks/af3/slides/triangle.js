// "Triangle Updates" (slide 38): the two pictures of the original ("outgoing edges", "incoming edges": three nodes i, j, k and the
// edges z_ij, z_ik, z_jk) redrawn as one triangle that is explained a click at a time, the way the talk goes: to update z_ij, reason
// through a third token k.
//
//   1  z_ij: the belief about tokens i and j (the edge we want to update)
//   2  a third token k: the two edges z_ik and z_jk leave from i and j ("outgoing edges")
//   3  the two edges are combined (multiplied) and the result updates z_ij; what is known about i and k, and j and k, constrains i and j
//   4  the same through every other token k, added up
//   5  "incoming edges": the mirror image, the two edges now arrive at i and j (z_ki, z_kj)
//   6  where it sits: in every Pairformer block, the outgoing update, the incoming update, then triangle attention (starting node,
//      ending node)
//
// Checked against the supplement: Alg. 12, z_ij <- g_ij * Linear(LayerNorm(sum over k of a_ik * b_jk)) and Alg. 13, the same with
// a_ki * b_kj (a and b are gated linear projections of z, * is element-wise); Alg. 17 lines 2-5: the order of the four triangle
// operations, with the result added to z, in each of the 48 blocks. The motivation (information about i relative to k and about j
// relative to k constrains i relative to j) is the talk's, and the supplement's: "direct communication between the edges that connect 3
// nodes ... detect inconsistencies in its current belief about the spatial relationship". The extra tokens and their edges are a schematic.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const NODE = '#e8c6f2', INK = '#1d2129', ORG = '#e0a03a';

const I = [100, 290], J = [420, 290], K = [260, 118], R = 36;                  // the three tokens
const EXTRA = [[40, 200], [90, 70], [430, 70], [480, 200]];                      // other tokens k, smaller; placed so that no dashed edge runs alongside the two arrows to k
const CENTER = (a, b, c) => [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const toward = (a, b, d) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [a[0] + ((b[0] - a[0]) * d) / L, a[1] + ((b[1] - a[1]) * d) / L]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const STEPS = [
  { head: 'z', sub: 'ij', text: 'The model’s current belief about how tokens i and j relate. This is the edge we want to update.' },
  { head: 'outgoing edges', text: 'Bring in a third token, k. Its two edges with i and j leave from i and j: z_ik and z_jk.' },
  { head: 'combine the two edges', text: 'If i relates to k in one way and j relates to k in another, that constrains how i relates to j. The two are multiplied, and the result updates z_ij.' },
  { head: 'every other token k', text: 'The same is done through every other token k, and the results are added up.', dims: 'Σ<sub>k</sub> a<sub>ik</sub> ⊙ b<sub>jk</sub>' },
  { head: 'incoming edges', text: 'The mirror image: the two edges now arrive at i and j, z_ki and z_kj. They are combined in the same way.', dims: 'Σ<sub>k</sub> a<sub>ki</sub> ⊙ b<sub>kj</sub>' },
  { head: 'in every Pairformer block', list: ['Triangle update, outgoing', 'Triangle update, incoming', 'Triangle attention, starting node', 'Triangle attention, ending node'], text: 'All 48 blocks repeat these, and the result is added to z each time.' },
];

AF3.kinds.triangle = (s) => ({
  steps: STEPS.length,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .tg-wrap { position: absolute; left: 4.2%; top: 15%; width: 62%; }
      .tg-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .tg-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .tg-side { position: absolute; left: 69%; right: 4.2%; top: 26%; }
      .tg-step { position: absolute; left: 0; right: 0; top: 0; }
      .tg-step h3 { margin: 0 0 .35em; font-size: var(--t-lead); font-weight: 700; color: var(--accent); line-height: 1.15; }
      .tg-step h3 sub { font-size: .7em; }
      .tg-step .dims { margin: 0 0 .5em; font-size: var(--t-body); font-weight: 700; line-height: 1.2; color: var(--fg); }
      .tg-step .dims sub { font-size: .7em; }
      .tg-step p { margin: 0; font-size: var(--t-small); line-height: 1.35; color: var(--muted); }
      .tg-step ol { margin: 0 0 .6em; padding: 0; list-style: none; font-size: var(--t-small); font-weight: 600; }
      .tg-step li { margin-bottom: .35em; padding: .3em .7em; border-radius: .7em; border: 1.5px solid color-mix(in srgb, var(--muted) 35%, transparent); color: var(--muted); }
      .tg-step li.on { color: #fff; background: var(--accent); border-color: var(--accent); }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="tg-wrap"><svg viewBox="0 0 520 380" role="img" aria-label="Three tokens i, j and k: the edges z_ik and z_jk are combined to update z_ij, through every k, with outgoing and then incoming edges"></svg></div>
      <div class="tg-side">${STEPS.map((st, i) => `<div class="tg-step reveal-in" data-show="${i + 1}"><h3>${st.sub ? `${esc(st.head)}<sub>${esc(st.sub)}</sub>` : esc(st.head)}</h3>${st.dims ? `<p class="dims">${st.dims}</p>` : ''}${st.list ? `<ol>${st.list.map((l, n) => `<li class="${n < 2 ? 'on' : ''}">${esc(l)}</li>`).join('')}</ol>` : ''}<p>${esc(st.text).replace(/z_([a-z]{2})/g, 'z<sub>$1</sub>')}</p></div>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;
    const svg = frame.querySelector('svg');
    const sub = (a, b) => `${a}<tspan dy="5" font-size="75%">${b}</tspan>`;

    const draw = (st) => {
      const a = ramp(st.a, 0, 0.4), b = ramp(st.b, 0, 0.35), flip = ramp(st.e, 0, 0.4);
      const pulse3 = st.c, pulse4 = st.d, pulse5 = ramp(st.e, 0.45, 1);
      const upd = Math.max(ramp(st.c, 0.75, 1), 0);   // z_ij has been updated: the edge stays thick
      let h = '';
      const EDGE = 'color-mix(in srgb, var(--accent) 38%, var(--bg))';
      // an arrow between two nodes' rims. `fwd` is how much of the head is at q (1) rather than at p (0), so the head can swap ends.
      // The shaft stops where the head begins, and the head grows with the shaft, so the tip stays a clean point.
      const arrow = (p, q, fwd, op, c = EDGE, w = 4) => {
        if (op < 0.01) return '';
        const f = toward(p, q, R + 4), t = toward(q, p, R + 4), L = Math.hypot(t[0] - f[0], t[1] - f[1]), ux = (t[0] - f[0]) / L, uy = (t[1] - f[1]) / L;
        const hl = 8 + 2.5 * w, hw = 4 + 1.3 * w, cut = hl - 1.5;                // head length and half-width; the shaft tucks 1.5 under the head
        const a = [f[0] + ux * (1 - fwd) * cut, f[1] + uy * (1 - fwd) * cut], b = [t[0] - ux * fwd * cut, t[1] - uy * fwd * cut];
        const tip = (pt, dx, dy, o) => {   // a head with its tip at pt, pointing along (dx, dy)
          const bx = pt[0] - dx * hl, by = pt[1] - dy * hl;
          return o < 0.01 ? '' : `<polygon points="${pt[0].toFixed(1)},${pt[1].toFixed(1)} ${(bx - dy * hw).toFixed(1)},${(by + dx * hw).toFixed(1)} ${(bx + dy * hw).toFixed(1)},${(by - dx * hw).toFixed(1)}" fill="${c}" opacity="${o.toFixed(2)}"/>`;
        };
        return `<g opacity="${op.toFixed(2)}"><path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>${tip(t, ux, uy, fwd)}${tip(f, -ux, -uy, 1 - fwd)}</g>`;
      };

      // the other tokens k, and their edges: thin and faint
      const ex = ramp(st.d, 0, 0.3) * (1 - 0 * flip);
      EXTRA.forEach(([x, y]) => {
        h += `<g opacity="${(ex * 0.9).toFixed(2)}"><path d="M${I[0]} ${I[1]} L${x} ${y} M${J[0]} ${J[1]} L${x} ${y}" stroke="${EDGE}" stroke-width="2" stroke-dasharray="5 5" opacity=".7"/></g>`;
      });
      // the main triangle's two edges: outgoing (heads at k), then incoming (heads at i and j)
      h += arrow(I, K, 1 - flip, b) + arrow(J, K, 1 - flip, b);
      // the edge to update: i to j, accent, thicker once updated
      h += arrow(I, J, 1, a, 'var(--accent)', 5 + 3 * upd);
      // the tokens
      const node = (p, label, r, op = 1) => `<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${NODE}" opacity="${op.toFixed(2)}"/><text x="${p[0]}" y="${p[1] + 1}" font-size="${(r * 0.8).toFixed(0)}" text-anchor="middle" class="tg-t" style="fill:${INK}" opacity="${op.toFixed(2)}">${label}</text>`;
      h += node(I, 'i', R, a) + node(J, 'j', R, a) + node(K, 'k', R, b);
      EXTRA.forEach((p) => { h += node(p, 'k', 22, ex); });
      // the labels of the edges
      const lab = (p, text, op, dx = 0, dy = 0) => `<text x="${p[0] + dx}" y="${p[1] + dy}" font-size="21" text-anchor="middle" class="tg-t" opacity="${op.toFixed(2)}">${text}</text>`;
      h += lab(mid(I, J), sub('z', 'i,j'), a, 0, 28)
        + lab(mid(I, K), sub('z', 'i,k'), b * (1 - flip), -34, -4) + lab(mid(J, K), sub('z', 'j,k'), b * (1 - flip), 36, -4)
        + lab(mid(I, K), sub('z', 'k,i'), b * flip, -34, -4) + lab(mid(J, K), sub('z', 'k,j'), b * flip, 36, -4);
      h += `<text x="260" y="352" font-size="22" font-weight="700" text-anchor="middle" class="tg-t" style="fill:var(--accent)" opacity="${(b * (1 - flip) * (1 - ramp(st.f, 0, 0.3))).toFixed(2)}">outgoing edges</text>`
        + `<text x="260" y="352" font-size="22" font-weight="700" text-anchor="middle" class="tg-t" style="fill:var(--accent)" opacity="${(flip * (1 - ramp(st.f, 0, 0.3))).toFixed(2)}">incoming edges</text>`;

      // the combine animation for one token k: the two edges' features meet at a x, and the result goes down into z_ij
      const combine = (k, t, op, r = 8.5) => {
        let g = '';
        const mik = mid(I, k), mjk = mid(J, k), x = CENTER(I, J, k), mij = mid(I, J);
        const ph1 = ramp(t, 0.05, 0.4), ph2 = ramp(t, 0.5, 0.85);
        // the two edge pulses move to the x
        const p1 = lerp(mik, x, ph1), p2 = lerp(mjk, x, ph1), cOp = op * Math.sin(Math.PI * Math.min(1, ph1)) ;
        if (ph1 > 0 && ph1 < 1) g += `<circle cx="${p1[0].toFixed(1)}" cy="${p1[1].toFixed(1)}" r="${r}" fill="${ORG}" opacity="${op}"/><circle cx="${p2[0].toFixed(1)}" cy="${p2[1].toFixed(1)}" r="${r}" fill="${ORG}" opacity="${op}"/>`;
        // the x pops
        const pop = ramp(t, 0.35, 0.5) * (1 - ramp(t, 0.85, 1));
        if (pop > 0.02) g += `<g opacity="${(op * pop).toFixed(2)}"><circle cx="${x[0].toFixed(1)}" cy="${x[1].toFixed(1)}" r="${(r * 2.1).toFixed(1)}" fill="var(--bg)" stroke="${ORG}" stroke-width="2.5"/><path d="M${x[0] - r * 0.9} ${x[1] - r * 0.9} L${x[0] + r * 0.9} ${x[1] + r * 0.9} M${x[0] + r * 0.9} ${x[1] - r * 0.9} L${x[0] - r * 0.9} ${x[1] + r * 0.9}" stroke="${ORG}" stroke-width="2.5" stroke-linecap="round"/></g>`;
        // the result goes down to z_ij
        const p3 = lerp(x, mij, ph2);
        if (ph2 > 0 && ph2 < 1) g += `<circle cx="${p3[0].toFixed(1)}" cy="${p3[1].toFixed(1)}" r="${r + 1}" fill="var(--accent)" opacity="${op}"/>`;
        return g;
      };
      h += combine(K, pulse3, 1);
      // through every other k, one after the other
      EXTRA.forEach((p, m) => { h += combine(p, Math.max(0, Math.min(1, (pulse4 - 0.05 - m * 0.15) / 0.4)), 0.9, 6); });
      h += combine(K, pulse5, 1);
      // the sum
      h += `<text x="${mid(I, J)[0] + 90}" y="${mid(I, J)[1] + 30}" font-size="30" font-weight="700" text-anchor="middle" class="tg-t" style="fill:var(--accent)" opacity="${(ramp(st.d, 0.55, 0.8) * (1 - ramp(st.e, 0, 0.3))).toFixed(2)}">Σ</text>`;
      svg.innerHTML = h;
    };

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
        const ms = [0, 1800, 2200, 3600, 5200, 4200, 1500][step], t0 = performance.now();
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
