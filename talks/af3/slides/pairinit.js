// "Token Level Pair Representation" (slide 27): the picture of the original (the pair representation z built from s, from the
// relative positional encoding and from the bonds, in a tangle of arrows) redrawn as ONE pair representation that is built up in
// place, a click at a time:
//
//   1  z_ij = s_i + s_j: each token's vector is projected twice (two different linear layers) to c_z = 128 numbers, once as token i
//      (across the top) and once as token j (down the side), and the two are added for every pair (i, j)
//   2  add the relative positional encoding: where token j sits relative to token i, projected to c_z and added (a pattern along
//      the diagonal: tokens near each other on the chain look alike)
//   3  add the bond information: the bonds the user gives between tokens (a yes or no for each pair), projected to c_z and added
//
// Checked against the supplement: Alg. 1 lines 3-5: z_init_ij = Linear(s_inputs_i) + Linear(s_inputs_j), += RelativePositionEncoding,
// += Linear(token_bonds_ij). The input is the supplement's s_inputs (the input embedding, c_token + 65 numbers), not s_init, which
// is what the original figure labelled it. Alg. 3: the encoding is made of the relative position along the chain (clipped at 32), the
// relative token index within a residue, whether the two tokens are in the same entity, and the chain offset (clipped at 2), as
// one-hot vectors of 66, 66, 1 and 6 numbers, so c_rpe = 139, projected to c_z = 128. Methods 2.8: token_bonds is a 2D matrix of
// bonds between tokens. The tokens (6), the shades and the bonded pairs are a schematic.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
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
const SEED = 7;   // the made-up shades of the token vectors

const N = 6, CELL = 36, X0 = 214, Y0 = 106, W = N * CELL, DX = 24, DY = -24;
const BLUE = '#a9d8f2', PINK = '#f2b8e6', PURPLE = '#b08be8', YELLOW = '#f3d46b';
const BONDS = [[1, 4], [4, 1], [3, 5], [5, 3]];   // (i, j) pairs of tokens with a bond between them, symmetric
const LINE = 'rgba(0,0,0,.28)';
// how strongly the relative positional encoding shows in cell (i, j): near the diagonal, a little different on the two sides of it
const rpeW = (i, j) => { const d = i - j, a = Math.abs(d); return Math.min(0.9, ([0.62, 0.42, 0.26, 0.14][a] ?? 0.06) * (d > 0 ? 1.12 : 0.92)); };

const STEPS = [
  { head: 'linear projection of s, twice, then add', dims: 'z<sub>ij</sub> = s<sub>i</sub> + s<sub>j</sub>', text: 'Each token’s input embedding is projected to c_z = 128 numbers by two different linear layers, one for the token as i and one as j. For every pair (i, j) the two are added.' },
  { head: 'add relative positional encoding (r.p.e)', dims: '[c_rpe → c_z]', text: 'Where token j sits relative to token i: distance along the chain, position within a residue, same entity or not, which chain. Projected to c_z and added.' },
  { head: 'add bond information', dims: '[1 → c_z]', text: 'Bonds the user provides between tokens, a yes or no for each pair, are projected to c_z and added. The result is the initial pair representation z.' },
];

AF3.kinds.pairinit = (s) => ({
  steps: 3,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .pi-wrap { position: absolute; left: 4.2%; top: 15%; width: 62%; }
      .pi-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .pi-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .pi-t.muted { fill: var(--muted); }
      .pi-side { position: absolute; left: 69%; right: 4.2%; top: 30%; }
      .pi-step { position: absolute; left: 0; right: 0; top: 0; }
      .pi-step h3 { margin: 0 0 .3em; font-size: var(--t-body); font-weight: 700; color: var(--accent); line-height: 1.2; }
      .pi-step .dims { margin: 0 0 .5em; font-size: var(--t-body); font-weight: 700; line-height: 1.2; color: var(--fg); }
      .pi-step .dims sub { font-size: .7em; }
      .pi-step p { margin: 0; font-size: var(--t-small); line-height: 1.35; color: var(--muted); }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const rand = rng(SEED);
    const a = Array.from({ length: N }, () => rand()), b = Array.from({ length: N }, () => rand());   // the shade of each token's two projected vectors

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="pi-wrap"><svg viewBox="70 0 520 372" role="img" aria-label="The pair representation built up in place: the sum of two projections of each token, then the relative positional encoding, then the bonds"></svg></div>
      <div class="pi-side">${STEPS.map((st, i) => `<div class="pi-step reveal-in" data-show="${i + 1}"><h3>${esc(st.head)}</h3><p class="dims">${st.dims}</p><p>${esc(st.text)}</p></div>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;
    const svg = frame.querySelector('svg');
    const sub = (x, y, z = '') => `${x}<tspan dy="5" font-size="75%">${y}</tspan>${z ? `<tspan dy="-5">${z}</tspan>` : ''}`;
    const cx = (i) => X0 + i * CELL, cy = (j) => Y0 + j * CELL;

    const draw = (st) => {
      const p1 = st.a, p2 = st.b, p3 = st.c;
      const tintRpe = ramp(p2, 0.5, 1), tintBond = ramp(p3, 0.5, 1);
      let h = '';
      // the two projected token vectors: across the top (token i) and down the side (token j)
      const sIn = ramp(p1, 0, 0.22) * (1 - 0.6 * ramp(p2, 0, 0.3));
      h += `<g opacity="${sIn.toFixed(2)}">`;
      for (let i = 0; i < N; i++) {
        h += `<rect x="${cx(i)}" y="30" width="${CELL}" height="30" fill="${shade(PINK, (a[i] - 0.5) * 0.5)}" stroke="${LINE}" stroke-width="1"/>`;
        h += `<rect x="164" y="${cy(i)}" width="32" height="${CELL}" fill="${shade(PINK, (b[i] - 0.5) * 0.5)}" stroke="${LINE}" stroke-width="1"/>`;
      }
      h += `<text x="${X0 - 10}" y="46" font-size="18" text-anchor="end" class="pi-t" style="fill:var(--fg)">${sub('s', 'i')}</text>`
        + `<text x="180" y="90" font-size="18" text-anchor="middle" class="pi-t">${sub('s', 'j')}</text></g>`;
      // the pair representation: the cube's depth (c_z), then the cells
      const faces = ramp(p1, 0.1, 0.35);
      h += `<g opacity="${faces.toFixed(2)}"><polygon points="${X0},${Y0} ${X0 + DX},${Y0 + DY} ${X0 + W + DX},${Y0 + DY} ${X0 + W},${Y0}" fill="${shade(BLUE, 0.3)}" stroke="${LINE}"/>`
        + `<polygon points="${X0 + W},${Y0} ${X0 + W + DX},${Y0 + DY} ${X0 + W + DX},${Y0 + W + DY} ${X0 + W},${Y0 + W}" fill="${shade(BLUE, -0.14)}" stroke="${LINE}"/>`
        + [1, 2].map((k) => `<path d="M${X0 + (DX * k) / 3} ${Y0 + (DY * k) / 3} H${X0 + W + (DX * k) / 3} V${Y0 + W + (DY * k) / 3}" stroke="${LINE}" fill="none"/>`).join('') + '</g>';
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const d = (i + j) / (2 * N - 2), op = ramp(p1, 0.2 + 0.5 * d, 0.4 + 0.5 * d);
        let c = shade(BLUE, ((a[i] + b[j]) / 2 - 0.5) * 0.55);
        c = lerpColor(c, PURPLE, rpeW(i, j) * tintRpe);
        if (BONDS.some(([bi, bj]) => bi === i && bj === j)) c = lerpColor(c, YELLOW, 0.9 * tintBond);
        h += `<rect x="${cx(i)}" y="${cy(j)}" width="${CELL}" height="${CELL}" fill="${c}" stroke="${LINE}" stroke-width="1" opacity="${op.toFixed(2)}"/>`;
      }
      // the sheet that is being added: the relative positional encoding drops in over the cells, then is absorbed into them
      const rOff = -24 * (1 - ramp(p2, 0, 0.45)), rOp = ramp(p2, 0, 0.2) * (1 - ramp(p2, 0.55, 0.9));
      if (rOp > 0.01) {
        h += `<g transform="translate(${rOff.toFixed(1)} ${rOff.toFixed(1)})" opacity="${rOp.toFixed(2)}"><rect x="${X0}" y="${Y0}" width="${W}" height="${W}" fill="none" stroke="${PURPLE}" stroke-width="3"/>`;
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) h += `<rect x="${cx(i)}" y="${cy(j)}" width="${CELL}" height="${CELL}" fill="${PURPLE}" fill-opacity="${rpeW(i, j).toFixed(2)}" stroke="${LINE}" stroke-width="1"/>`;
        h += '</g>';
      }
      // and the bonds: a sheet that is empty but for the bonded pairs
      const bOff = -24 * (1 - ramp(p3, 0, 0.45)), bOp = ramp(p3, 0, 0.2) * (1 - ramp(p3, 0.55, 0.9));
      if (bOp > 0.01) {
        h += `<g transform="translate(0 ${bOff.toFixed(1)})" opacity="${bOp.toFixed(2)}"><rect x="${X0}" y="${Y0}" width="${W}" height="${W}" fill="rgba(255,255,255,.55)" stroke="${YELLOW}" stroke-width="3"/>`;
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
          const on = BONDS.some(([bi, bj]) => bi === i && bj === j);
          h += `<rect x="${cx(i)}" y="${cy(j)}" width="${CELL}" height="${CELL}" fill="${on ? YELLOW : 'none'}" stroke="${LINE}" stroke-width="1"/>`;
        }
        h += '</g>';
      }
      // z_ij = s_i + s_j: guides from the two vectors to one cell
      const hl = ramp(p1, 0.8, 1) * (1 - ramp(p2, 0, 0.3)), gi = 3, gj = 2;
      if (hl > 0.01) {
        h += `<g opacity="${hl.toFixed(2)}"><path d="M${cx(gi) + CELL / 2} 60 V${cy(gj)}" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="5 4" fill="none"/>`
          + `<path d="M196 ${cy(gj) + CELL / 2} H${cx(gi)}" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="5 4" fill="none"/>`
          + `<rect x="${cx(gi)}" y="${cy(gj)}" width="${CELL}" height="${CELL}" fill="none" stroke="var(--accent)" stroke-width="4"/></g>`;
      }
      // the name and the sizes
      const lab = ramp(p1, 0.85, 1);
      h += `<text x="${X0 + W / 2}" y="12" font-size="32" font-weight="700" text-anchor="middle" class="pi-t" opacity="${lab.toFixed(2)}">z</text>`
        + `<text x="${X0 + W / 2}" y="${Y0 + W + 26}" font-size="19" text-anchor="middle" class="pi-t" opacity="${faces.toFixed(2)}">${sub('N', 'tokens')}</text>`
        + `<text x="0" y="0" font-size="19" text-anchor="middle" class="pi-t" transform="translate(140 ${Y0 + W / 2}) rotate(-90)" opacity="${faces.toFixed(2)}">${sub('N', 'tokens')}</text>`
        + `<path d="M${X0 + W + 8} ${Y0 + W + 8} L${X0 + W + 8 + DX} ${Y0 + W + 8 + DY}" stroke="var(--muted)" stroke-width="1.5" opacity="${faces.toFixed(2)}"/>`
        + `<text x="${X0 + W + DX + 16}" y="${Y0 + W + DY + 6}" font-size="18" class="pi-t muted" opacity="${faces.toFixed(2)}">${sub('c', 'z', ' = 128')}</text>`;
      svg.innerHTML = h;
    };

    const KEYS = ['a', 'b', 'c'];
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 4800, 3800, 3800][step], t0 = performance.now();
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
