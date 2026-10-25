// "The tensors passed around AF3" (appendix, slide 66): the table of the original (shape, what it holds, made by -> used by, for ten tensors) as a grid of ten cards,
// each with a small drawing of the tensor's shape, built up in the order a listener meets them:
//
//   1  the token level, the trunk's state: s (a vector for every token) and z (a vector for every pair of tokens)
//   2  the evidence that is folded into z and then dropped: m (the MSA) and t (the templates)
//   3  the atom level: q (a vector for every atom), c (its conditioning), p (a vector for every pair of nearby atoms)
//   4  inside the diffusion module: x (the coordinates) and a (the atoms pooled per token)
//   5  what comes out for ranking: conf (pLDDT per atom; PAE and PDE per pair of tokens)
//
// Checked against the supplement. Channel sizes: c_s = 384, c_z = 128, c_m = 64 (Alg. 8), c_atom = 128, c_atompair = 16, c_token = 768 (Alg. 5, Alg. 20); the
// template module works at c = 64 (Alg. 16); the MSA module's input per position is the 32-class one-hot msa feature plus has_deletion and deletion_value (Alg. 8
// line 1; Table 5). The original table said 32 channels for the raw MSA input; the card says only that the MSA module embeds it to 64. Data flow: z is built from
// s_i, s_j, the relative position encoding and the bonds (Alg. 2 and slide 27); the MSA module adds to z and "the MSA representation is not retained and all
// information passes through the pair representation" (main text, Methods 3.3); the template module adds to z (Alg. 1 line 9); c comes from the reference-conformer
// features of each atom (Alg. 5 line 1) and conditions every atom block (the atom transformer takes c as its conditioning); p holds reference offsets and a same-
// residue mask for atoms of nearby windows only (Alg. 5 lines 2-6, sequence-local attention); a_i is the mean over the atoms of token i of relu(Linear(q_l))
// (Alg. 5 line 16) and runs through the 24 blocks of the diffusion transformer (Alg. 20); x are the noisy atom coordinates, denoised step by step (Alg. 18); the
// confidence head gives pLDDT per atom and PAE and PDE per pair of tokens, as binned error predictions (Alg. 31). The colours are the original table's.
// The drawings are schematic: the cell counts are not the real ones (there are more atoms than tokens, which the drawings keep), only the shapes are meant.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const rgb = (hex) => { const v = parseInt(hex.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const mix = (h, k) => hex(rgb(h).map((x) => (k > 0 ? x + (255 - x) * k : x * (1 + k))));   // k > 0 towards white, k < 0 towards black
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const LINE = 'rgba(0,0,0,.3)';   // the fills are pastel in both themes, so the lines are dark in both

const CW = 188, CH = 170, GX = 15, GY = 12;
// symbol, name, shape (n = number of tokens as N_tok etc.), what it holds, made -> used, colour, ink on the badge, glyph, step, place in the grid
const T = [
  { id: 's', name: 'Token single', shape: 'N_tok × 384', hold: ['what each token is,', 'plus its context'], flow: 'embedder → trunk → diffusion', color: '#f2b8e6', ink: '#1d2129', glyph: 'vec', step: 1, col: 0, row: 0 },
  { id: 'z', name: 'Token pair', shape: 'N_tok × N_tok × 128', hold: ['how each token relates', 'to each other token'], flow: 'built once → the whole trunk', color: '#a9d8f2', ink: '#1d2129', glyph: 'pair', step: 1, col: 1, row: 0 },
  { id: 'm', name: 'MSA', shape: 'N_msa × N_tok × 64', hold: ['related sequences: what', 'changes together'], flow: 'MSA module → into z, dropped', color: '#f7b97c', ink: '#1d2129', glyph: 'msa', step: 2, col: 2, row: 0 },
  { id: 't', name: 'Templates', shape: 'N_templ × N_tok × N_tok × C', hold: ['distances from similar', 'solved structures'], flow: 'template module → into z', color: '#3e9b7a', ink: '#ffffff', glyph: 'templ', step: 2, col: 3, row: 0 },
  { id: 'a', name: 'Token activations', shape: 'N_tok × 768', hold: ['the atoms pooled per', 'token, inside the blocks'], flow: 'encoder → 24 blocks → atoms', color: '#e9c46a', ink: '#1d2129', glyph: 'wide', step: 4, col: 4, row: 0 },
  { id: 'q', name: 'Atom single', shape: 'N_atoms × 128', hold: ['a learned vector for', 'every atom'], flow: 'embedder, diffusion → tokens', color: '#c27bc9', ink: '#ffffff', glyph: 'atomvec', step: 3, col: 0, row: 1 },
  { id: 'c', name: 'Atom conditioning', shape: 'N_atoms × 128', hold: ['from the reference', 'conformer of each atom'], flow: 'made once → every atom block', color: '#c27bc9', ink: '#ffffff', glyph: 'atomvec', step: 3, col: 1, row: 1 },
  { id: 'p', name: 'Atom pair', shape: 'N_atoms × N_atoms × 16', hold: ['nearby atoms only: the', 'local blocks are used'], flow: 'biases the atom attention', color: '#1a8fd0', ink: '#ffffff', glyph: 'atompair', step: 3, col: 2, row: 1 },
  { id: 'x', name: 'Coordinates', shape: 'N_atoms × 3', hold: ['pure noise at first,', 'then the 3D structure'], flow: 'diffusion module, iterated', color: '#5f6368', ink: '#ffffff', glyph: 'xyz', step: 4, col: 3, row: 1 },
  { id: 'conf', name: 'Confidence', shape: 'per atom · per token pair', hold: ['binned error predictions', 'that rank the samples'], flow: 'confidence module → ranking', color: '#c00000', ink: '#ffffff', glyph: 'conf', step: 5, col: 4, row: 1 },
];
const CAPTIONS = [
  'The trunk works on tokens: a residue or a base is one token. s holds a vector for every token, z a vector for every pair of tokens. Everything below is built around these two.',
  'Evidence goes into z and is then dropped: the MSA m (what changes together across related sequences) and the templates t (distances in similar solved structures).',
  'The atom level, used by the input embedder and the diffusion module: q is a vector for every atom, c is its conditioning (from the reference conformer), p relates nearby atoms and biases the atom attention.',
  'Inside the diffusion module: x, the atom coordinates, start as pure noise and are denoised into the structure. a holds the atoms pooled per token while the 24 transformer blocks run.',
  'What comes out for ranking: pLDDT for every atom, and PAE and PDE for every pair of tokens, all as binned error predictions.',
];
const SEED = 8;

AF3.kinds.tensorzoo = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.arch.miniCss + `
      .tz-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .tz-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .tz-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .tz-t.muted { fill: var(--muted); }
      .tz-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .tz-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const heading = AF3.apTitle(s);
    const rand = rng(SEED);
    const NOISE = Array.from({ length: 120 }, () => rand());

    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="tz-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} style="fill:${fill};stroke:${stroke};stroke-width:${sw}" opacity="${op.toFixed(2)}"/>`;
    // the shape as text: N_tok and the like get a subscript
    const sub = (str) => esc(str).replace(/N_([a-z]+)/g, 'N<tspan baseline-shift="sub" font-size="72%">$1</tspan>');

    // ---- the drawings: a list of cells, built in order, with a block behind to hint at the channels ----
    const cellsOf = (g, color) => {
      const cs = [];
      const add = (x, y, w, h, strong) => cs.push({ x, y, w, h, k: strong });
      let back = null;
      if (g === 'vec') { for (let i = 0; i < 6; i++) add(-11, -31.5 + i * 10.5, 22, 10, NOISE[i]); back = [-11, -31.5, 22, 63]; }
      else if (g === 'wide') { for (let i = 0; i < 6; i++) add(-22, -31.5 + i * 10.5, 44, 10, NOISE[10 + i]); back = [-22, -31.5, 44, 63]; }
      else if (g === 'pair') { for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) add(-31.5 + c * 10.5, -31.5 + r * 10.5, 10, 10, NOISE[(r * 6 + c) % 100]); back = [-31.5, -31.5, 63, 63]; }
      else if (g === 'msa') { for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) add(-42 + c * 10.5, -20 + r * 10.5, 10, 10, NOISE[(r * 8 + c) % 100]); back = [-42, -20, 84, 42]; }
      else if (g === 'templ') { [[-14, 9], [0, 0], [14, -9]].forEach(([ox, oy], t) => { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) add(ox - 17 + c * 8.5, oy - 17 + r * 8.5, 8, 8, NOISE[(t * 16 + r * 4 + c) % 100]); }); }
      else if (g === 'atomvec') { for (let i = 0; i < 9; i++) add(-11, -33.75 + i * 7.5, 22, 7, NOISE[20 + i]); back = [-11, -33.75, 22, 67.5]; }
      else if (g === 'atompair') { for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) add(-31.5 + c * 7, -31.5 + r * 7, 6.5, 6.5, Math.abs(r - c) <= 2 ? 0.55 + 0.45 * NOISE[(r * 9 + c) % 100] : 0.04); back = [-31.5, -31.5, 63, 63]; }
      else if (g === 'xyz') { for (let r = 0; r < 9; r++) for (let c = 0; c < 3; c++) add(-12 + c * 8.5, -33.75 + r * 7.5, 8, 7, NOISE[(r * 3 + c + 30) % 100]); back = [-12, -33.75, 25, 67.5]; }
      else if (g === 'conf') {
        for (let i = 0; i < 9; i++) add(-40, -33.75 + i * 7.5, 14, 7, NOISE[60 + i]);
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) add(-12 + c * 9, -22.5 + r * 9, 8.5, 8.5, NOISE[(r * 5 + c + 70) % 100]);
      }
      return { cells: cs, back };
    };
    const SHAPES = Object.fromEntries(T.map((t) => [t.id, cellsOf(t.glyph, t.color)]));

    const glyph = (t, cx, cy, p) => {
      const { cells, back } = SHAPES[t.id];
      let g = '';
      if (back) {
        const o = ramp(p, 0.1, 0.5);
        g += rect(cx + back[0] + 5, cy + back[1] - 5, back[2], back[3], mix(t.color, 0.6), LINE, 1, o);
      }
      cells.forEach((c, i) => {
        const o = ramp(p, 0.05 + (0.5 * i) / cells.length, 0.2 + (0.5 * i) / cells.length);
        g += rect(cx + c.x, cy + c.y, c.w, c.h, mix(t.color, 0.55 - 0.45 * c.k), LINE, 1, o);
      });
      return g;
    };

    // ---- the grid ----
    const draw = (st) => {
      const K = [0, st.k1, st.k2, st.k3, st.k4, st.k5];
      let h = '';
      const inStep = (t) => T.filter((u) => u.step === t.step);
      T.forEach((t) => {
        const group = inStep(t), gi = group.indexOf(t), n = group.length;
        const p = Math.max(0, Math.min(1, (K[t.step] - 0.18 * gi) / (1 - 0.18 * (n - 1))));
        if (p < 0.01) return;
        const x = t.col * (CW + GX), y = t.row * (CH + GY), fa = ramp(p, 0, 0.2);
        let c = rect(0, 0, CW, CH, 'var(--bg)', 'var(--muted)', 1.5, 1, 10);
        const bw = t.id.length > 2 ? 46 : 30;   // the badge is wider for 'conf'
        c += rect(10, 9, bw, 24, t.color, 'none', 0, 1, 6) + `<text x="${10 + bw / 2}" y="21.5" font-size="${t.id.length > 2 ? 14 : 16}" font-weight="700" class="tz-t" text-anchor="middle" style="fill:${t.ink}">${t.id}</text>`;
        c += txt(18 + bw, 21, 14.5, esc(t.name), 1, { anchor: 'start', bold: true });
        c += glyph(t, 94, 70, p);
        c += txt(94, 113, 13.5, sub(t.shape), ramp(p, 0.4, 0.6), { bold: true });
        c += txt(94, 131, 12, esc(t.hold[0]), ramp(p, 0.55, 0.75), { muted: true }) + txt(94, 145, 12, esc(t.hold[1]), ramp(p, 0.6, 0.8), { muted: true });
        c += txt(94, 160, 11.5, esc(t.flow), ramp(p, 0.75, 0.95), { fill: 'var(--accent)', bold: true });
        h += `<g transform="translate(${x},${(y + (1 - fa) * 10).toFixed(1)})" opacity="${fa.toFixed(2)}">${c}</g>`;
      });
      // the footnote of the original, always there
      h += txt(0, 372, 13, sub('N_tok = number of tokens. N_atoms = number of heavy atoms. The last number is the number of channels. The 48-block trunk sees tokens only.'), 1, { anchor: 'start', muted: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(heading)}</h2>
      <div class="tz-wrap"><svg viewBox="0 0 1000 385" role="img" aria-label="The ten tensors passed around AlphaFold 3, each with its shape, what it holds and where it is made and used: s and z at the token level; m and t, the evidence folded into z; q, c and p at the atom level; x and a inside the diffusion module; and the confidence outputs"></svg></div>
      <div class="tz-caps">${CAPTIONS.map((t, i) => `<p class="tz-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, heading.length)}`;
    const svg = frame.querySelector('svg');

    const SK = ['k1', 'k2', 'k3', 'k4', 'k5'];
    const stateOf = (step) => Object.fromEntries(SK.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 4500, 4500, 5500, 4500, 3800][step], t0 = performance.now();
        return new Promise((done) => {
          const tick = (now) => {
            const u = Math.min(1, (now - t0) / ms);
            cur = Object.fromEntries(SK.map((k) => [k, from[k] + (to[k] - from[k]) * u]));
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
