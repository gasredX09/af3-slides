// "Prepare atom-level conditioning tensors" (appendix, slide 74): the two pictures of the original (Simon, The Illustrated AlphaFold: step 2, "Create atom-level single conditioning
// input (c)" and "Create atom-level pair conditioning input (p)"; the slide's own title, "Token -> atom -> token level aggregation", belongs to slide 46 and was left over) redrawn
// natively and played a click at a time on a toy of 3 tokens and 9 atoms:
//
//   1  s and z live on tokens, the atom encoder works on atoms; every atom knows its token (the colour); c starts from each atom's reference conformer
//   2  single: each token's vector is copied to all of its atoms, a layer norm and a linear layer change its size (384 to 128), and it is added to c
//   3  pair: the vector of each pair of tokens is copied to every pair of their atoms, a layer norm and a linear layer (128 to 16) change its size, and it is added to p, which on its
//      own only links atoms of the same residue
//   4  c conditions every block of the atom transformer, p biases its attention, and q, which starts as the original c, gets the noisy positions added
//
// Checked against the supplement, Alg. 5 (AtomAttentionEncoder, c_atom = 128, c_atompair = 16, c_token = 768): c_l = LinearNoBias(concat(ref_pos, ref_charge, ref_mask, ref_element,
// ref_atom_name_chars)); d_lm = ref_pos_l - ref_pos_m, v_lm = (ref_space_uid_l == ref_space_uid_m), p_lm = LinearNoBias(d_lm) * v_lm, then += LinearNoBias(1 / (1 + |d_lm|^2)) * v_lm and
// += LinearNoBias(v_lm) * v_lm (lines 1-6); q_l = c_l (line 7); when the noisy positions r_l are given: c_l += LinearNoBias(LayerNorm(s_tok_idx(l))) (line 9), p_lm +=
// LinearNoBias(LayerNorm(z_tok_idx(l),tok_idx(m))) (line 10), q_l += LinearNoBias(r_l) (line 11); then p_lm += LinearNoBias(relu(c_l)) + LinearNoBias(relu(c_m)) and a small MLP (lines 13-14),
// and AtomTransformer(q, c, p, N_block = 3, N_head = 4) (line 15). In Alg. 20 the s and z handed to the encoder (named s_trunk and z there) are the outputs of DiffusionConditioning
// (previous slide). The reference conformer's mask v_lm is why p alone is block by block (one block per residue or ligand); the z term has no such mask, so it fills in the rest. The
// cells of the single lane are toy values; the p block uses the real formula 1 / (1 + d^2) on toy distances (1.5 A apart per step along a residue); in the model the attention is local
// (windows of nearby atoms), so only a band of the pair grid is used; the drawing keeps the full grid of 9 atoms. Left out: the extra terms of lines 13-14 and the exact widths.
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
const SEED = 13;
const LINE = 'rgba(0,0,0,.3)';
const TOK = ['#f2b8e6', '#a9d8f2', '#ffd8a8'], TOKD = ['#c2255c', '#1c7ed6', '#e8590c'];     // a colour for each token
const Q_LIGHT = '#ecd9f2', Q_DEEP = '#c27bc9', P_LIGHT = '#dbeafc', P_DEEP = '#1a8fd0', Z_BASE = '#a9d8f2';
const SPAN = [3, 4, 2], NT = 3, NA = 9, AH = 22, TOKEN_OF = [0, 0, 0, 1, 1, 1, 1, 2, 2];
const LET = ['N', 'C', 'C', 'N', 'C', 'C', 'O', 'N', 'C'];
const POS_IN = [0, 1, 2, 0, 1, 2, 3, 0, 1];                                              // the place of each atom along its residue's reference conformer (toy, 1.5 A apart)
const Y0 = 70, S_X = 56, COPY_X = 160, C_X = 270, CN_X = 380, CWID = 40;
const Z0 = { x: 486, y: 100, c: 28 }, CP0 = { x: 596, y: 100, c: 11 }, P0 = { x: 722, y: 100, c: 11 }, PN0 = { x: 846, y: 100, c: 11 };
const tokStart = [0, 3, 7];

const CAPTIONS = [
  'The atom encoder works on atoms, but s and z live on tokens. Each atom knows its token (the colour). c starts from the reference conformer of each atom: its element, charge and position.',
  'Single: each token’s vector is copied to all of its atoms. A layer norm and a linear layer change it to the atom size (384 to 128 numbers), and it is added to c.',
  'Pair: each pair of tokens’ vector is copied to every pair of their atoms, changed by a layer norm and a linear layer (128 to 16 numbers) and added to p, which by itself links only atoms of the same residue.',
  'c conditions every block of the atom transformer, p biases its attention, and q, which starts as the original c, gets the noisy positions added.',
];

AF3.kinds.condatom = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .ca-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 16%; }
      .ca-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ca-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .ca-t.muted { fill: var(--muted); }
      .ca-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .ca-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const heading = AF3.apTitle(s);

    // ---- the toy data ----
    const rand = rng(SEED);
    const vec = () => Array.from({ length: 3 }, () => 0.2 + 0.75 * rand());
    const SV = Array.from({ length: NT }, vec);                                         // the vector of each token
    const SLIN = Array.from({ length: NT }, vec);                                       // after the linear layer
    const CV = Array.from({ length: NA }, vec);                                         // c before: from the reference conformer
    const CNV = CV.map((v, a) => v.map((x, k) => Math.min(0.95, 0.5 * x + 0.6 * SLIN[TOKEN_OF[a]][k])));   // c after: the sum
    const ZV = Array.from({ length: NT }, () => Array.from({ length: NT }, () => rand()));
    const P0V = Array.from({ length: NA }, (_, l) => Array.from({ length: NA }, (_, m) => {
      if (TOKEN_OF[l] !== TOKEN_OF[m]) return 0;                                         // the mask v_lm: the same residue only
      const d = (POS_IN[l] - POS_IN[m]) * 1.5;
      return Math.sqrt(1 / (1 + d * d));                                                // 1 / (1 + d^2), square-rooted to be visible
    }));

    // ---- helpers ----
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : `<text x="${x}" y="${y}" font-size="${size}" class="ca-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''} opacity="${op.toFixed(2)}">${str}</text>`;
    const rect = (x, y, w, h, fill, stroke, sw, op = 1, rx = 0) => op < 0.01 ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op.toFixed(2)}"/>`;
    const bars = (x, y, w, h, vals, col) => {
      const bh = 4, gap = 1.8, y0 = y + (h - (3 * bh + 2 * gap)) / 2;
      return vals.map((v, i) => `<rect x="${(x + 3).toFixed(1)}" y="${(y0 + i * (bh + gap)).toFixed(1)}" width="${Math.max(1.5, v * (w - 6)).toFixed(1)}" height="${bh}" rx="1.2" fill="${col}"/>`).join('');
    };
    const arrow = (x1, y1, x2, y2, op) => {
      if (op < 0.01) return '';
      const a = Math.atan2(y2 - y1, x2 - x1);
      return `<g opacity="${op.toFixed(2)}"><line x1="${x1}" y1="${y1}" x2="${(x2 - Math.cos(a) * 8).toFixed(1)}" y2="${(y2 - Math.sin(a) * 8).toFixed(1)}" stroke="var(--accent)" stroke-width="2.5"/>`
        + `<polygon points="${x2},${y2} ${(x2 - Math.cos(a) * 10 - Math.sin(a) * 5.5).toFixed(1)},${(y2 - Math.sin(a) * 10 + Math.cos(a) * 5.5).toFixed(1)} ${(x2 - Math.cos(a) * 10 + Math.sin(a) * 5.5).toFixed(1)},${(y2 - Math.sin(a) * 10 - Math.cos(a) * 5.5).toFixed(1)}" fill="var(--accent)"/></g>`;
    };
    const atomY = (a) => Y0 + a * AH;
    const tokY = (t) => Y0 + tokStart[t] * AH, tokH = (t) => SPAN[t] * AH;
    // a column of atom cells; `fill(a)` gives the colour, `vals(a)` the bars, the left stripe is the colour of the atom's token
    const atomCol = (x, fill, vals, barCol, op, letters = false, stripe = true) => {
      if (op < 0.01) return '';
      let h = '';
      for (let a = 0; a < NA; a++) {
        h += `<rect x="${x}" y="${atomY(a)}" width="${CWID}" height="${AH}" fill="${fill(a)}" stroke="${LINE}" stroke-width="1"/>`;
        if (stripe) h += `<rect x="${x}" y="${atomY(a)}" width="5" height="${AH}" fill="${TOKD[TOKEN_OF[a]]}"/>`;
        if (vals) h += bars(x + 4, atomY(a), CWID - 4, AH, vals(a), barCol);
        if (letters) h += `<text x="${x + CWID / 2 + 2}" y="${atomY(a) + AH / 2}" font-size="13" font-weight="700" class="ca-t" text-anchor="middle" style="fill:#1d2129">${LET[a]}</text>`;
      }
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const pgrid = (g0, colFn, op) => {
      if (op < 0.01) return '';
      let h = '';
      for (let l = 0; l < NA; l++) for (let m = 0; m < NA; m++) h += `<rect x="${g0.x + m * g0.c}" y="${g0.y + l * g0.c}" width="${g0.c}" height="${g0.c}" fill="${colFn(l, m)}" stroke="${LINE}" stroke-width=".6"/>`;
      return `<g opacity="${op.toFixed(2)}">${h}</g>`;
    };
    const zcol = (t, u) => shade(Z_BASE, (ZV[t][u] - 0.5) * 0.45);

    const draw = (st) => {
      let h = '';
      const a = st.a, b = st.b, c = st.c, d = st.d;

      // ---- step 1: tokens, atoms, c from the reference conformer ----
      const o1 = ramp(a, 0, 0.35), o2 = ramp(a, 0.25, 0.65);
      for (let t = 0; t < NT; t++) {
        h += rect(S_X, tokY(t) + 1, CWID, tokH(t) - 2, TOK[t], LINE, 1, o1) + (o1 > 0.01 ? `<g opacity="${o1.toFixed(2)}">${bars(S_X, tokY(t) + 1 + (tokH(t) - 2) / 2 - 12, CWID, 24, SV[t], TOKD[t])}</g>` : '');
        h += txt(S_X - 8, tokY(t) + tokH(t) / 2, 12.5, `token ${t}`, o1, { anchor: 'end', muted: true });
      }
      h += txt(S_X + CWID / 2, Y0 + NA * AH + 14, 13, 's', o1, { bold: true }) + txt(S_X + CWID / 2, Y0 + NA * AH + 29, 12, 'one vector per token', o1, { muted: true });
      h += atomCol(C_X, (aa) => Q_LIGHT, (aa) => CV[aa], Q_DEEP, o2, true);
      h += txt(C_X + CWID / 2, Y0 + NA * AH + 14, 13, 'c', o2, { bold: true }) + txt(C_X + CWID / 2, Y0 + NA * AH + 29, 12, 'from the reference', o2, { muted: true }) + txt(C_X + CWID / 2, Y0 + NA * AH + 43, 12, 'conformer', o2, { muted: true });
      h += txt(C_X + CWID / 2, Y0 - 12, 12, 'atoms', o2, { muted: true });

      // ---- step 2: the single vectors are copied to the atoms, changed, added to c ----
      const copy = ramp(b, 0.05, 0.4), lin = ramp(b, 0.4, 0.62), add = ramp(b, 0.65, 0.95);
      for (let aa = 0; aa < NA; aa++) {
        const t = TOKEN_OF[aa], ty = tokY(t) + tokH(t) / 2 - AH / 2, x = lerp(S_X, COPY_X, copy);
        if (copy < 0.01) continue;
        const y = lerp(ty, atomY(aa), copy), fillc = lerpColor(TOK[t], Q_LIGHT, lin);
        h += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${CWID}" height="${AH}" fill="${fillc}" stroke="${LINE}" stroke-width="1" opacity="${ramp(b, 0.05, 0.2).toFixed(2)}"/>`
          + `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="5" height="${AH}" fill="${TOKD[t]}" opacity="${ramp(b, 0.05, 0.2).toFixed(2)}"/>`
          + `<g opacity="${ramp(b, 0.05, 0.2).toFixed(2)}">${bars(x + 4, y, CWID - 4, AH, lerp(0, 1, lin) > 0.5 ? SLIN[t] : SV[t], lin > 0.5 ? Q_DEEP : TOKD[t])}</g>`;
      }
      h += txt(COPY_X + CWID / 2, Y0 + NA * AH + 14, 13, 'copied to atoms', ramp(b, 0.3, 0.55), { bold: true }) + txt(COPY_X + CWID / 2, Y0 + NA * AH + 29, 12, 'layer norm, linear', lin, { muted: true });
      h += arrow(S_X + CWID + 8, Y0 + 100, COPY_X - 8, Y0 + 100, ramp(b, 0, 0.2) * (1 - ramp(b, 0.3, 0.45)));
      h += txt(238, Y0 + 94, 20, '+', add, { bold: true }) + txt(354, Y0 + 94, 20, '=', add, { bold: true });
      h += atomCol(CN_X, () => Q_LIGHT, (aa) => CNV[aa], Q_DEEP, add, false);
      h += txt(CN_X + CWID / 2, Y0 + NA * AH + 14, 13, 'c', add, { bold: true }) + txt(CN_X + CWID / 2, Y0 + NA * AH + 29, 12, 'conditioned', add, { muted: true });

      // ---- step 3: the pair vectors are copied to the atom pairs, changed, added to p ----
      const zt = ramp(c, 0, 0.25);
      h += pgrid({ x: Z0.x, y: Z0.y, c: Z0.c }, () => 'none', 0);
      if (zt > 0.01) {
        let zg = '';
        for (let t = 0; t < NT; t++) for (let u = 0; u < NT; u++) zg += `<rect x="${Z0.x + u * Z0.c}" y="${Z0.y + t * Z0.c}" width="${Z0.c}" height="${Z0.c}" fill="${zcol(t, u)}" stroke="${LINE}" stroke-width="1"/>`;
        for (let t = 0; t < NT; t++) zg += `<rect x="${Z0.x - 7}" y="${Z0.y + t * Z0.c + 2}" width="4" height="${Z0.c - 4}" fill="${TOKD[t]}"/><rect x="${Z0.x + t * Z0.c + 2}" y="${Z0.y - 8}" width="${Z0.c - 4}" height="4" fill="${TOKD[t]}"/>`;
        h += `<g opacity="${zt.toFixed(2)}">${zg}</g>` + txt(Z0.x + (NT * Z0.c) / 2, Z0.y + NT * Z0.c + 18, 13, 'z', zt, { bold: true }) + txt(Z0.x + (NT * Z0.c) / 2, Z0.y + NT * Z0.c + 33, 12, 'one vector per', zt, { muted: true }) + txt(Z0.x + (NT * Z0.c) / 2, Z0.y + NT * Z0.c + 47, 12, 'token pair', zt, { muted: true });
      }
      const cp = ramp(c, 0.25, 0.55), linp = ramp(c, 0.55, 0.75);
      h += arrow(Z0.x + NT * Z0.c + 8, Z0.y + 42, CP0.x - 8, Z0.y + 42, ramp(c, 0.2, 0.4) * (1 - ramp(c, 0.5, 0.6)));
      h += pgrid(CP0, (l, m) => lerpColor(zcol(TOKEN_OF[l], TOKEN_OF[m]), shade(P_LIGHT, 0), linp * 0.7), cp);
      h += txt(CP0.x + (NA * CP0.c) / 2, CP0.y + NA * CP0.c + 18, 13, 'copied to atom pairs', cp, { bold: true }) + txt(CP0.x + (NA * CP0.c) / 2, CP0.y + NA * CP0.c + 33, 12, 'layer norm, linear', linp, { muted: true });
      const p0 = ramp(c, 0.5, 0.8), add3 = ramp(c, 0.78, 1);
      h += pgrid(P0, (l, m) => (P0V[l][m] < 0.01 ? 'var(--bg)' : lerpColor(P_LIGHT, P_DEEP, P0V[l][m])), p0);
      h += txt(P0.x + (NA * P0.c) / 2, P0.y + NA * P0.c + 18, 13, 'p', p0, { bold: true }) + txt(P0.x + (NA * P0.c) / 2, P0.y + NA * P0.c + 33, 12, 'reference conformer,', p0, { muted: true }) + txt(P0.x + (NA * P0.c) / 2, P0.y + NA * P0.c + 47, 12, 'same residue only', p0, { muted: true });
      h += txt(708, Z0.y + 50, 20, '+', add3, { bold: true }) + txt(832, Z0.y + 50, 20, '=', add3, { bold: true });
      h += pgrid(PN0, (l, m) => lerpColor(lerpColor(P_LIGHT, P_DEEP, P0V[l][m]), shade(zcol(TOKEN_OF[l], TOKEN_OF[m]), -0.1), P0V[l][m] > 0.01 ? 0.35 : 0.8), add3);
      h += txt(PN0.x + (NA * PN0.c) / 2, PN0.y + NA * PN0.c + 18, 13, 'p', add3, { bold: true }) + txt(PN0.x + (NA * PN0.c) / 2, PN0.y + NA * PN0.c + 33, 12, 'conditioned', add3, { muted: true });

      // ---- step 4: where c and p go ----
      const by = 322, bo = ramp(d, 0, 0.35);
      const chip = (x, w, head, sub, op) => rect(x, by, w, 46, 'var(--bg)', 'var(--muted)', 1.6, op, 10) + txt(x + w / 2, by + 16, 14, head, op, { bold: true }) + txt(x + w / 2, by + 34, 12, sub, op, { muted: true });
      h += chip(30, 250, 'c: conditions every block', 'of the atom transformer', ramp(d, 0, 0.3));
      h += chip(296, 250, 'p: biases the attention', 'between nearby atoms', ramp(d, 0.15, 0.45));
      h += chip(562, 250, 'q: starts as the original c', 'plus the noisy positions r', ramp(d, 0.3, 0.6));
      h += arrow(818, by + 23, 842, by + 23, ramp(d, 0.55, 0.75));
      const tb = ramp(d, 0.65, 0.95);
      h += rect(848, by, 142, 46, 'color-mix(in srgb, var(--accent) 9%, var(--bg))', 'var(--accent)', 2, tb, 10) + txt(919, by + 16, 14, 'Atom transformer', tb, { bold: true }) + txt(919, by + 34, 12, '3 blocks, 4 heads', tb, { muted: true });
      h += txt(990, 292, 12, 'toy sizes: 3 tokens, 9 atoms', 1, { anchor: 'end', muted: true });
      svg.innerHTML = h;
    };

    frame.innerHTML = `<h2 class="deck-heading">${esc(heading)}</h2>
      <div class="ca-wrap"><svg viewBox="0 0 1000 380" role="img" aria-label="How token-level conditioning reaches the atoms: the vector of each token is copied to its atoms, changed by a layer norm and a linear layer and added to c; the vector of each pair of tokens is copied to every pair of their atoms, changed and added to p, which from the reference conformer alone only links atoms of the same residue; c, p and q go into the atom transformer"></svg></div>
      <div class="ca-caps">${CAPTIONS.map((t, i) => `<p class="ca-cap reveal-in" data-show="${i + 1}">${esc(t)}</p>`).join('')}</div>
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
        const ms = [0, 4000, 7500, 8500, 5000][step], t0 = performance.now();
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
