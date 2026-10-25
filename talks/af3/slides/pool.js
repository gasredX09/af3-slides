// "Atom Level to Token Level" (slide 26): the picture of the original (five tensors in a row, joined by arrows) redrawn as ONE
// tensor that is transformed in place, a click at a time:
//
//   1  q, the atom-level single representation: one vector of c_atom = 128 numbers per atom, the atoms grouped into tokens
//      (AA: a standard residue is one token; atom: a ligand or modified-residue atom is a token of its own)
//   2  linear projection [c_atom -> c_token]: each vector grows from 128 to 384 numbers (then a ReLU)
//   3  average all atoms within each token: the columns of a token merge into one; the result is a, N_tokens x c_token
//   4  add token-level features from the MSA where applicable: residue type, profile and deletion mean, 32 + 32 + 1 = 65 more
//      numbers per token, giving s_inputs (c_token + 65 = 449)
//   5  linear projection [c_token + 65 -> c_token]: s_init, back to 384 numbers per token
//
// Checked against the supplement: Alg. 5 line 16, a_i = mean over the atoms of token i of ReLU(Linear(q_l)), with c_atom = 128 and
// c_token = 384 (Alg. 2 line 1); Alg. 2 line 2, s_i = concat(a_i, restype, profile, deletion_mean), with shapes 32, 32 and 1
// (Methods 2.8); Alg. 1 line 2, s_init = Linear(s_inputs), c_s = 384; Methods 2.6 for the tokens (a standard residue is one token,
// a modified residue or ligand one token per atom). The heights are to scale (128 : 384 : 449); the number of atoms and tokens, and
// the numbers in the cells (made-up shades), are a schematic: four tokens of 3, 4, 1 and 1 atoms.
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
const SEED = 7;   // the made-up shades of the cells

const TOK = [[0, 1, 2], [3, 4, 5, 6], [7], [8]];   // atoms of each token: two residues, then two single-atom tokens
const KIND = ['AA', 'AA', 'atom', 'atom'];
const N_ATOMS = 9, PITCH = 34, CX = 310, YC = 176;   // the drawing is centred on the line y = YC, so it grows from the middle
const X0A = CX - (N_ATOMS * PITCH) / 2, W_T = 50, GAP = 8, X0T = CX - (4 * W_T + 3 * GAP) / 2;
const H1 = 80, H2 = 240, HX = (65 / 384) * H2;   // c_atom 128, c_token 384, and the 65 extra rows, to scale
const PURPLE = '#c27bc9', PINK = '#f2b8e6', ORANGE = '#f7b97c';

const STEPS = [
  { head: '$q$: one vector per atom', dims: '', text: '128 numbers for each atom. Atoms belong to tokens: a standard residue is one token (AA), a ligand atom is a token of its own (atom).' },
  { head: 'linear projection', dims: '$[c_{\\mathrm{atom}} \\to c_{\\mathrm{token}}]$', text: 'Each atom’s vector goes from 128 to 384 numbers (followed by a ReLU).' },
  { head: 'average all atoms within each token', dims: '', text: 'One vector per token: the mean over its atoms. A token with one atom keeps its own. From here on the trunk works on tokens, not atoms.' },
  { head: 'add token-level features from the MSA where applicable', dims: '', text: 'Residue type, MSA properties at position $i$, etc.: 65 more numbers per token (restype 32, profile 32, deletion mean 1).' },
  { head: 'linear projection', dims: '$[c_{\\mathrm{token}} + 65 \\to c_{\\mathrm{token}}]$', text: 'Back to 384 numbers per token: the initial single representation.' },
];

AF3.kinds.atom2token = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .at-wrap { position: absolute; left: 4.2%; top: 15%; width: 62%; }
      .at-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .at-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .at-t.muted { fill: var(--muted); }
      .at-side { position: absolute; left: 69%; right: 4.2%; top: 30%; }
      .at-step { position: absolute; left: 0; right: 0; top: 0; }
      .at-step h3 { margin: 0 0 .3em; font-size: var(--t-body); font-weight: 700; color: var(--accent); line-height: 1.2; }
      .at-step .dims { margin: 0 0 .5em; font-size: var(--t-body); font-weight: 700; line-height: 1.2; }
      .at-step p { margin: 0; font-size: var(--t-small); line-height: 1.35; color: var(--muted); }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const prand = rng(SEED);
    const v = Array.from({ length: N_ATOMS }, () => prand());                      // a shade for each atom's vector
    const vTok = TOK.map((g) => g.reduce((a, i) => a + v[i], 0) / g.length);        // the mean of a token's atoms
    const xv = Array.from({ length: 4 }, () => prand());                           // a shade for each token's appended features
    const tokOf = (i) => TOK.findIndex((g) => g.includes(i));

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="at-wrap"><svg viewBox="70 0 520 390" role="img" aria-label="One tensor of atom vectors: projected, averaged into token vectors, joined by MSA features, and projected again"></svg></div>
      <div class="at-side">${STEPS.map((st, i) => `<div class="at-step reveal-in" data-show="${i + 1}"><h3>${AF3.rich(st.head, esc)}</h3>${st.dims ? `<p class="dims" style="color:var(--fg)">${AF3.rich(st.dims, esc)}</p>` : ''}<p>${AF3.rich(st.text, esc)}</p></div>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;
    const svg = frame.querySelector('svg');

    const LINE = 'rgba(0,0,0,.28)';

    const draw = (st) => {
      const p2 = ramp(st.b, 0.1, 0.9), p3 = ramp(st.c, 0.1, 0.9), p4 = ramp(st.d, 0.1, 0.9), p5 = ramp(st.e, 0.1, 0.9);
      const hBase = H1 + (H2 - H1) * p2, hApp = HX * p4 * (1 - p5), Y0 = YC - (hBase + hApp) / 2, bottom = Y0 + hBase + hApp;
      const base = lerpColor(PURPLE, PINK, p5);
      const colorOf = (val) => shade(base, (val - 0.5) * 0.55);
      const left = X0A + (X0T - X0A) * p3, right = X0A + N_ATOMS * PITCH + (X0T + 4 * W_T + 3 * GAP - (X0A + N_ATOMS * PITCH)) * p3;
      let h = '';
      // the name of the tensor
      const name = st.e > 0.5 ? 's_{\\mathrm{init}}' : st.d > 0.5 ? 's_{\\mathrm{inputs}}' : st.c > 0.5 ? 'a' : 'q';
      h += AF3.svgMath(CX, Y0 - 26, 35, name, { op: ramp(st.a, 0, 0.3), w: 160 });
      // the columns: atoms moving together into their token, their shades blending into the token's mean
      const geom = (i) => {
        const j = tokOf(i), g = TOK[j], k = g.indexOf(i), n = g.length;
        const sx = X0A + i * PITCH, ex = X0T + j * (W_T + GAP) + k * (W_T / n);
        return { x: sx + (ex - sx) * p3, w: PITCH + (W_T / n - PITCH) * p3 };
      };
      const col = (x, w, val, hh, stroke) => {
        let lines = '';
        for (let y = 20; y < hh - 1; y += 20) lines += `M${x.toFixed(1)} ${Y0 + y} H${(x + w).toFixed(1)} `;
        return `<rect x="${x.toFixed(1)}" y="${Y0}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" fill="${colorOf(val)}" stroke="${stroke ? LINE : 'none'}" stroke-width="1"/>`
          + `<path d="${lines}" stroke="rgba(0,0,0,.14)" stroke-width="1" fill="none"/>`;
      };
      for (let i = 0; i < N_ATOMS; i++) {
        const { x, w } = geom(i), val = v[i] + (vTok[tokOf(i)] - v[i]) * p3;
        h += col(x, w, val, hBase, p3 < 0.98);
      }
      // the token columns, drawn over the merged atoms once they are one (no seams)
      if (p3 > 0.9) TOK.forEach((g, j) => { h += col(X0T + j * (W_T + GAP), W_T, vTok[j], hBase, true); });
      // the appended MSA features
      if (hApp > 0.5) {
        TOK.forEach((g, j) => {
          const x = p3 > 0.9 ? X0T + j * (W_T + GAP) : geom(g[0]).x, w = p3 > 0.9 ? W_T : g.reduce((a, i) => a + geom(i).w, 0);
          h += `<rect x="${x.toFixed(1)}" y="${(Y0 + hBase).toFixed(1)}" width="${w.toFixed(1)}" height="${hApp.toFixed(1)}" fill="${shade(ORANGE, (xv[j] - 0.5) * 0.4)}" stroke="${LINE}" stroke-width="1"/>`;
        });
        const bx = right + 10, bo = ramp(p4, 0.5, 0.9) * (1 - ramp(p5, 0, 0.4));
        h += `<g opacity="${bo.toFixed(2)}"><path d="M${bx} ${Y0 + hBase} L${bx + 6} ${Y0 + hBase} L${bx + 6} ${Y0 + hBase + hApp} L${bx} ${Y0 + hBase + hApp}" stroke="var(--muted)" stroke-width="1.5" fill="none"/>`
          + ['residue type,', 'MSA profile,', 'deletion mean'].map((t, i) => `<text x="${bx + 16}" y="${(Y0 + hBase + hApp / 2 + (i - 1) * 19).toFixed(1)}" font-size="16" class="at-t muted">${t}</text>`).join('') + '</g>';
      }
      // under the columns: a bracket and a label for each token (AA or atom), then the width
      TOK.forEach((g, j) => {
        const xs = g.map((i) => geom(i)), x1 = Math.min(...xs.map((q) => q.x)), x2 = Math.max(...xs.map((q) => q.x + q.w)), y = bottom + 8;
        h += `<path d="M${x1 + 2} ${y} L${x1 + 2} ${y + 6} L${x2 - 2} ${y + 6} L${x2 - 2} ${y}" stroke="var(--muted)" stroke-width="1.5" fill="none" opacity="${ramp(st.a, 0.2, 0.5).toFixed(2)}"/>`
          + `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${(bottom + 26).toFixed(1)}" font-size="${KIND[j] === 'atom' ? 13.5 : 17}" text-anchor="middle" class="at-t muted" opacity="${ramp(st.a, 0.2, 0.5).toFixed(2)}">${KIND[j]}</text>`;
      });
      const wo = ramp(p3, 0.35, 0.65);
      h += AF3.svgMath(CX, bottom + 46, 21, 'N_{\\mathrm{atoms}}', { op: ramp(st.a, 0.3, 0.6) * (1 - wo), w: 160 })
        + AF3.svgMath(CX, bottom + 46, 21, 'N_{\\mathrm{tokens}}', { op: ramp(st.a, 0.3, 0.6) * wo, w: 160 });
      // the height: c_atom, c_token, c_token + 65, c_token
      const cLabel = st.e > 0.5 ? 'c_{\\mathrm{token}} = 384' : st.d > 0.5 ? 'c_{\\mathrm{token}} + 65 = 449' : st.b > 0.5 ? 'c_{\\mathrm{token}} = 384' : 'c_{\\mathrm{atom}} = 128';
      const bx = left - 12;
      h += `<path d="M${bx + 6} ${Y0} L${bx} ${Y0} L${bx} ${bottom.toFixed(1)} L${bx + 6} ${bottom.toFixed(1)}" stroke="var(--muted)" stroke-width="1.5" fill="none" opacity="${ramp(st.a, 0.3, 0.6).toFixed(2)}"/>`
        + `<g transform="translate(${bx - 14} ${((Y0 + bottom) / 2).toFixed(1)}) rotate(-90)">${AF3.svgMath(0, 0, 20, cLabel, { op: ramp(st.a, 0.3, 0.6), w: 260 })}</g>`;
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
        const ms = [0, 3000, 3200, 3600, 3400, 3200][step], t0 = performance.now();
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
