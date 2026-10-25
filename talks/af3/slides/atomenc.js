// "Token -> atom -> token level aggregation" (slide 46): the first half of the diffusion module (Simon, The Illustrated AlphaFold: 2c noisy
// positions to r, 2d add r to q, 2e atom attention, 2f aggregate to tokens) redrawn with the tensors as matrices, atoms along x, numbers per
// atom along y, and played a click at a time. Slide 45 shows the whole flow; this one shows what happens to the shapes:
//
//   1  q (a vector per atom), p (a vector per pair of atoms) and r (the noisy positions, rescaled: 3 numbers per atom)
//   2  a linear layer takes r from 3 to 128 numbers per atom, the size of q
//   3  r is added to q, number by number: q now carries the noisy position of each atom
//   4  attention among atoms close by in the sequence, 3 blocks, with a bias for each pair from p
//   5  each atom's vector is projected to 768 numbers, then the vectors of the atoms of a token are averaged: a, one vector per token
//   6  a goes on to the token-level transformer (next slide); q and p are kept for the decoder (the skip link)
//
// Checked against the supplement: Alg. 20 line 2, r = x / sqrt(t^2 + sigma_data^2), "dimensionless vectors with approximately unit variance",
// and its signature, c_atom = 128, c_atompair = 16, c_token = 768. Alg. 5 (AtomAttentionEncoder): line 11, q_l += LinearNoBias(r_l); line 15,
// AtomTransformer with N_block = 3 and N_head = 4; line 16, a_i = mean over the atoms of token i of relu(LinearNoBias(q_l)); line 17, q, c and p are
// kept as the skip values. Alg. 7: the atom attention is sequence-local; it runs the pair-bias attention of Alg. 24 with p as the pair tensor
// (b_lm = LinearNoBias(LayerNorm(p_lm)) + beta_lm). Left out of the drawing: the atom conditioning c (it enters the attention as the adaptive
// layer norm), the layer norms, and the 16 numbers in each cell of p. Twelve atoms in five tokens (as on slide 45) and the rows are a schematic:
// 3 rows for r is real, 8 rows stand for the 128 numbers of q, 14 rows for the 768 of a, and every cell value is made up (seeded, listed on the
// References slide).
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
const SEED = 7;
const LINE = 'rgba(0,0,0,.28)', EDGE = 'rgba(0,0,0,.6)';
const YEL = '#f5e48c', PUR = '#c27bc9', BLU = '#5aa0d3', VIO = '#e8c3f4', CI = '#e8590c';   // r, q, p, a (as on slides 17 and 26); the atom in focus
const INK = { r: '#a98a00', q: '#9c36b5', p: '#2b7bb9', a: '#a050c0' };                      // the letters, darker so they read on both themes

const N = 12, T = 5, GROUP = [3, 2, 3, 2, 2];                                                // twelve atoms in five tokens (as on slide 45)
const START = GROUP.map((_, i) => GROUP.slice(0, i).reduce((x, y) => x + y, 0));
const WIN = 2;                                                                                // local attention: two atoms either side (toy)
const R_ROWS = 3, Q_ROWS = 8, A_ROWS = 14;                                                    // 3 numbers (real), 128 and 768 (stand-ins)

// geometry, in map units (1000 x 395)
const CW = 22, RH = 11, PH = 9;                                                               // a column per atom; a row per number; a row of p
const X0 = 210, R_Y = 34, Q_Y = 150, P_Y = 268;
const AX = 640, AW = 30, AP = 34, A_Y = Q_Y + (Q_ROWS * RH) / 2 - (A_ROWS * RH) / 2;         // the token columns, centred on q
const ARH = (A_ROWS * RH) / Q_ROWS;                                                           // height of a q row once it has become a row of a
const cx = (k) => X0 + k * CW + CW / 2;

const CAPTIONS = [
  'The atom level has three tensors: q, a vector for each atom; p, a vector for each pair of atoms; and r, the noisy positions rescaled to about unit variance.',
  "r has only 3 numbers per atom, so a linear layer turns them into 128, the size of q's vectors.",
  "Then r is added to q, number by number. Now each atom's vector carries its noisy position.",
  'The atoms attend to atoms close by in the sequence, in 3 blocks. p supplies a bias for each pair of atoms, the way z did for tokens.',
  "Then each atom's vector is projected to 768 numbers, and the vectors of the atoms of a token are averaged. The result is a, one vector for each token.",
  'a goes on to the token-level transformer, on the next slide. q and p are kept for the decoder at the end: the skip link.',
];

AF3.kinds.atomenc = (s) => ({
  steps: 6,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .ae-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .ae-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ae-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .ae-t.muted { fill: var(--muted); }
      .ae-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .ae-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');

    // ---- the toy data: every cell is a made-up value in [0, 1], drawn as a shade ----
    const rand = rng(SEED);
    const mat = (rows, cols) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => rand()));
    const VR = mat(R_ROWS, N), VR2 = mat(Q_ROWS, N), VQ = mat(Q_ROWS, N), VP = mat(N, N), VA = mat(A_ROWS, T);
    const WL = Array.from({ length: N }, () => Array.from({ length: 2 * WIN + 1 }, () => 0.15 + 0.85 * rand()));   // local attention weights
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const VQ2 = VQ.map((row, j) => row.map((v, k) => clamp(v * 0.55 + VR2[j][k] * 0.6 - 0.05)));                    // q + r
    const VQ3 = VQ2.map((row, j) => row.map((v, k) => {                                                              // after the attention: mixed with the window
      let sum = 0, n = 0;
      for (let m = Math.max(0, k - WIN); m <= Math.min(N - 1, k + WIN); m++) { sum += row[m]; n++; }
      return 0.45 * v + 0.55 * (sum / n);
    }));

    // ---- helpers ----
    const col = (base, v) => shade(base, (v - 0.5) * 0.5);
    const tag = (l) => `<tspan font-weight="700" style="fill:${INK[l]}">${l}</tspan>`;
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="ae-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const cell = (x, y, w, h, fill, op = 1) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${LINE}" stroke-width="0.8" opacity="${op.toFixed(2)}"/>`;
    const seps = (x0, y0, hh, op) => {                                                                               // the token boundaries
      if (op < 0.01) return '';
      let o = '';
      for (let i = 1; i < T; i++) o += `<line x1="${x0 + START[i] * CW}" y1="${y0}" x2="${x0 + START[i] * CW}" y2="${y0 + hh}" stroke="${EDGE}" stroke-width="1.6"/>`;
      return `<g opacity="${op.toFixed(2)}">${o}</g>`;
    };
    const arrow = (pts, op, o = {}) => {                                                                             // a polyline with a head; the shaft stops under the head
      if (op < 0.01) return '';
      const c = o.col || 'var(--accent)', w = o.w || 2.5, hl = o.hl || 10, hw = o.hw || 5.5, n = pts.length;
      const [x1, y1] = pts[n - 2], [x2, y2] = pts[n - 1], len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const bx = x2 - ux * hl, by = y2 - uy * hl;
      const d = pts.slice(0, n - 1).concat(o.noHead ? [[x2, y2]] : [[bx, by]]).map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
      const head = o.noHead ? '' : `<polygon points="${x2},${y2} ${(bx - uy * hw).toFixed(1)},${(by + ux * hw).toFixed(1)} ${(bx + uy * hw).toFixed(1)},${(by - ux * hw).toFixed(1)}" fill="${c}"/>`;
      return `<g opacity="${op.toFixed(2)}"><path d="M${d}" fill="none" stroke="${c}" stroke-width="${w}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linejoin="round"/>${head}</g>`;
    };
    const arc = (x1, x2, y, h, w, op) => op < 0.01 ? '' : `<path d="M${x1} ${y} Q ${(x1 + x2) / 2} ${y - 2 * h} ${x2} ${y}" fill="none" stroke="var(--accent)" stroke-width="${w.toFixed(1)}" stroke-linecap="round" opacity="${op.toFixed(2)}"/>`;

    const draw = (st) => {
      const { a, b, c, d, e, f } = st;
      let h = '';
      const at = ramp(a, 0, 0.3);

      // ---- r: three numbers per atom; a linear layer makes it 128 (b); it drops onto q and is added (c) ----
      const grow = ramp(b, 0.15, 0.7), drop = ramp(c, 0.05, 0.55), rOp = at * (1 - ramp(c, 0.65, 0.9)), ry = R_Y + (Q_Y - R_Y) * drop;
      if (rOp > 0.01) {
        let g = '';
        for (let j = 0; j < Q_ROWS; j++) {
          const rowOp = j < R_ROWS ? 1 : ramp(b, 0.3 + 0.06 * (j - R_ROWS), 0.55 + 0.06 * (j - R_ROWS));
          for (let k = 0; k < N; k++) g += cell(X0 + k * CW, ry + j * RH, CW, RH, col(YEL, lerp(VR[j % R_ROWS][k], VR2[j][k], grow)), rowOp);
        }
        h += `<g opacity="${rOp.toFixed(2)}">${g}${seps(X0, ry, grow > 0.5 ? Q_ROWS * RH : R_ROWS * RH, 1)}</g>`;
      }
      const lab = (y, l1, l2, op, l2b = '', outOp = 0, inOp = 0) => txt(196, y, 13.5, l1, op, { anchor: 'end' }) + txt(196, y + 17, 13, l2, op * (1 - outOp), { anchor: 'end', muted: true }) + (l2b ? txt(196, y + 17, 13, l2b, op * inOp, { anchor: 'end', muted: true }) : '');   // the second line is swapped in two moves, so the two never overlap
      const rLab = at * (1 - ramp(c, 0.4, 0.6));
      h += lab(R_Y + 8, `${tag('r')}: noisy positions,`, 'rescaled; 3 numbers each', rLab, 'rescaled; 128 numbers each', ramp(b, 0.2, 0.4), ramp(b, 0.5, 0.7));
      h += arrow([[X0 + N * CW + 14, R_Y + 17], [X0 + N * CW + 14 + 56, R_Y + 17]], ramp(b, 0, 0.25) * (1 - ramp(c, 0, 0.15)), { w: 2, hl: 8, hw: 4.5 });
      h += txt(X0 + N * CW + 80, R_Y + 17, 13, 'linear layer', ramp(b, 0.05, 0.3) * (1 - ramp(c, 0, 0.15)), { anchor: 'start', muted: true }) + txt(X0 + N * CW + 80, R_Y + 34, 13, '3 → 128 numbers', ramp(b, 0.1, 0.35) * (1 - ramp(c, 0, 0.15)), { anchor: 'start', muted: true });

      // ---- q: one vector per atom; r is added (c); the attention updates it as the window passes (d) ----
      const sw = ramp(d, 0.05, 0.95), k0 = Math.min(N - 1, Math.floor(sw * N));
      let qg = '';
      for (let j = 0; j < Q_ROWS; j++) for (let k = 0; k < N; k++) {
        const v2 = lerp(VQ[j][k], VQ2[j][k], ramp(c, 0.5, 0.85)), upd = ramp(sw * N, k, k + 1.5);
        qg += cell(X0 + k * CW, Q_Y + j * RH, CW, RH, col(PUR, lerp(v2, VQ3[j][k], upd)));
      }
      h += `<g opacity="${at.toFixed(2)}">${qg}${seps(X0, Q_Y, Q_ROWS * RH, 1)}</g>`;
      h += lab(Q_Y + 36, `${tag('q')}: a vector for each`, 'atom, 128 numbers', at);
      h += txt(X0 + N * CW + 14, Q_Y + (Q_ROWS * RH) / 2, 13, '+ r, number by number', ramp(c, 0.05, 0.3) * (1 - ramp(c, 0.75, 0.95)), { anchor: 'start', muted: true });

      // ---- p: one vector per pair of atoms (drawn as one number each) ----
      let pg = '';
      for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) pg += cell(X0 + k * CW, P_Y + j * PH, CW, PH, col(BLU, VP[j][k]));
      h += `<g opacity="${at.toFixed(2)}">${pg}</g>`;
      h += lab(P_Y + 38, `${tag('p')}: a vector for each`, 'pair of atoms', at);

      // ---- step 4: the window moves along q; p gives the bias for each pair in it ----
      const dOp = ramp(d, 0, 0.05) * (1 - ramp(e, 0, 0.15));
      if (dOp > 0.01) {
        const lo = Math.max(0, k0 - WIN), hi = Math.min(N - 1, k0 + WIN);
        for (let j = lo; j <= hi; j++) if (j !== k0) h += arc(cx(k0), cx(j), Q_Y, 8 + 4 * Math.abs(j - k0), 1 + 4.5 * WL[k0][j - k0 + WIN], dOp);
        h += rect(X0 + lo * CW - 2, Q_Y - 2, (hi - lo + 1) * CW + 4, Q_ROWS * RH + 4, 'none', 'var(--accent)', 2.5, dOp, 4);
        h += rect(X0 + k0 * CW - 1.5, Q_Y - 1.5, CW + 3, Q_ROWS * RH + 3, 'none', CI, 3, dOp);
        h += rect(X0 + lo * CW - 1, P_Y + k0 * PH - 1, (hi - lo + 1) * CW + 2, PH + 2, 'none', 'var(--accent)', 2.5, dOp, 2);
        h += rect(X0 + k0 * CW - 1, P_Y + k0 * PH - 1, CW + 2, PH + 2, 'none', CI, 2.5, dOp);
      }
      h += txt(X0, 118, 13, 'local attention, 3 blocks', ramp(d, 0, 0.1) * (1 - ramp(e, 0, 0.15)), { anchor: 'start', muted: true });
      h += txt(X0 + N * CW + 14, P_Y + 4.5 * PH, 13, 'a bias for each pair, from p', ramp(d, 0.05, 0.2) * (1 - ramp(e, 0, 0.15)), { anchor: 'start', muted: true });

      // ---- step 5: the atoms of each token are projected up and averaged ----
      for (let i = 0; i < T; i++) {
        const x1 = X0 + START[i] * CW + 2, x2 = X0 + (START[i] + GROUP[i]) * CW - 2, bo = ramp(e, 0, 0.2);
        h += `<g opacity="${bo.toFixed(2)}"><path d="M${x1} ${Q_Y + Q_ROWS * RH + 5} v5 H${x2} v-5" fill="none" stroke="var(--muted)" stroke-width="1.5"/></g>`;
        h += txt((x1 + x2) / 2, Q_Y + Q_ROWS * RH + 23, 12, String(i + 1), bo, { muted: true });
      }
      h += txt(555, 100, 13, '128 → 768 numbers,', ramp(e, 0.05, 0.25) * (1 - ramp(f, 0, 0.2)), { muted: true }) + txt(555, 116, 13, 'then the mean per token', ramp(e, 0.1, 0.3) * (1 - ramp(f, 0, 0.2)), { muted: true });
      let fl = '', ag = '';
      for (let i = 0; i < T; i++) {
        const t = ramp(e, 0.05 * i, 0.6 + 0.05 * i), flyOp = (1 - ramp(t, 0.9, 1)) * (t > 0.001 ? 1 : 0);
        for (let k = START[i]; k < START[i] + GROUP[i]; k++) for (let j = 0; j < Q_ROWS; j++) {
          const x = lerp(X0 + k * CW, AX + i * AP, t), w = lerp(CW, AW, t), y = lerp(Q_Y + j * RH, A_Y + j * ARH, t), hh = lerp(RH, ARH, t);
          fl += cell(x, y, w, hh, lerpColor(col(PUR, VQ3[j][k]), col(VIO, VA[Math.min(A_ROWS - 1, Math.round((j / (Q_ROWS - 1)) * (A_ROWS - 1)))][i]), ramp(t, 0.4, 1)), flyOp);
        }
        const aOp = ramp(t, 0.85, 1);
        for (let j = 0; j < A_ROWS; j++) ag += cell(AX + i * AP, A_Y + j * RH, AW, RH, col(VIO, VA[j][i]), aOp);
      }
      h += fl + ag;
      const ghost = at * (1 - ramp(e, 0.2, 0.55));                                                        // where a will be: shown from the start, so the picture has a goal
      h += ghost < 0.01 ? '' : `<rect x="${AX - 2}" y="${A_Y - 2}" width="${T * AP - 4 + 4}" height="${A_ROWS * RH + 4}" rx="4" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3" opacity="${(0.8 * ghost).toFixed(2)}"/>`;
      h += txt(AX + (T * AP - 4) / 2, A_Y + A_ROWS * RH + 18, 13, 'where this ends: a', ghost, { muted: true });
      const aLab = ramp(e, 0.5, 0.8);
      h += txt(AX + (T * AP - 4) / 2, A_Y - 28, 13.5, `${tag('a')}: a vector for each token`, aLab) + txt(AX + (T * AP - 4) / 2, A_Y - 12, 13, '768 numbers each', aLab, { muted: true });

      // ---- step 6: a goes on to the token-level transformer; q and p are kept for the decoder ----
      h += arrow([[AX + T * AP + 8, Q_Y + (Q_ROWS * RH) / 2], [955, Q_Y + (Q_ROWS * RH) / 2]], ramp(f, 0, 0.35), {});
      h += txt(AX + T * AP + 22, Q_Y + (Q_ROWS * RH) / 2 + 18, 13, 'to the token-level', ramp(f, 0.1, 0.4), { anchor: 'start', muted: true }) + txt(AX + T * AP + 22, Q_Y + (Q_ROWS * RH) / 2 + 34, 13, 'transformer (next slide)', ramp(f, 0.15, 0.45), { anchor: 'start', muted: true });
      const sk = ramp(f, 0.35, 0.8), sy = P_Y + 6 * PH + 4;
      h += arrow([[X0 + N * CW + 4, sy], [965, sy]], sk, { dash: '6 4', col: 'var(--muted)', w: 2 });
      h += arrow([[X0 + N * CW + 4, Q_Y + Q_ROWS * RH - 8], [X0 + N * CW + 24, Q_Y + Q_ROWS * RH - 8], [X0 + N * CW + 24, sy]], sk, { dash: '6 4', col: 'var(--muted)', w: 2, noHead: true });
      h += txt(730, sy - 16, 13, 'q and p are kept for the atom decoder (skip link)', ramp(f, 0.55, 0.85), { muted: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="ae-wrap"><svg viewBox="0 0 1000 395" role="img" aria-label="Atoms to tokens in the diffusion module: the noisy positions r, three numbers per atom, are lifted to 128 numbers by a linear layer and added to q; the atoms attend to atoms close by in the sequence with a bias for each pair from p; each atom's vector is projected to 768 numbers and the vectors of the atoms of a token are averaged into a, one vector per token; a goes to the token-level transformer, and q and p are kept for the decoder"></svg></div>
      <div class="ae-caps">${CAPTIONS.map((t, i) => `<p class="ae-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length)}`;
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
        const ms = [0, 2400, 4500, 4500, 7500, 7500, 5500][step], t0 = performance.now();
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
