// "AlphaFold 2 reasons through residues and residue pairs" (slide 9): the slide's three pictures (the MSA representation, the pair
// representation, and the structure module of AF2's Fig. 3d) redrawn natively and built up one at a time. The slide's own captions
// stay under them: "Evolutionary Information", "Relationship between residues i and j", "Residue frames + torsions".
//
// What each part shows (checked against Jumper et al. 2021, Evoformer and End-to-end structure prediction; Fig. 3d, e):
//   MSA     columns are the residues of the input sequence, rows are the sequences in which those residues appear (related proteins
//           from other species). The first row is the query. One column that never changes, and two columns that change together:
//           the paper names "pairwise evolutionary correlations" as a source of constraints on structure.
//   Pair    one cell for every pair of residues; the cell for residues i and j holds what the network knows about how they relate.
//   Module  one rigid frame per residue (the N-C-alpha-C backbone atoms), all starting at the identity and the origin; invariant
//           point attention reads the single representation (a copy of the MSA's first row), the pair representation and the frames;
//           the frames are rotated and translated, 8 blocks with shared weights; chi angles then place the side chains.
//
// The sequences, the shading and the frame positions are made up (a seeded, fixed picture) to show the shapes: an illustration, not data
// and not an AF2 prediction, and the slide says so.
//
// Steps: 1 the MSA · 2 the pair map · 3 the structure module: the frames leave the origin over 8 blocks · 4 the chi angles and side chains.
{
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ramp = (p, a, b) => { const t = clamp01((p - a) / (b - a)); return t * t * (3 - 2 * t); };   // smoothstep
const ease = (x) => 1 - Math.pow(1 - x, 2.2);
const mix = (c1, c2, t) => {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const ch = (sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
};
const SEED = 5;            // mulberry32 seed for the pair map's shading; logged so the picture can be reproduced
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// pastel fills that read the same in the light and dark themes, so the text on them is always dark
const INK = '#1d2129';
const MSA = ['#fde6cc', '#ef9a4c'];     // the MSA's orange (as on the architecture map)
const PAIR = ['#e3f0fa', '#6fb0dd'];    // the pair representation's blue
const IPA = { fill: '#ecc9c9', stroke: '#b9787a' }, UPD = { fill: '#d9d4ee', stroke: '#8f87c6' }, CHI = { fill: '#cfe8c4', stroke: '#6fa95f' };
const FRAME = { fill: '#c9c4ea', stroke: '#7a72bf' };

// the MSA: five rows of nine residues. Column 2 never changes; columns 4 and 8 change together (K with E, R with D)
const ROWS = [['query', 'MWLKTGAEV'], ['fish', 'MWIRSGVDL'], ['rabbit', 'MWIKTNVEL'], ['chicken', 'LWLRTGADI'], ['…', 'MWIKSGVEL']];
const SHADE = { M: .35, W: .95, L: .55, I: .45, K: .75, R: .25, T: .6, S: .3, G: .5, N: .15, A: .7, V: .4, E: .8, D: .2 };
const COVARY = [3, 7], CONSERVED = 1;   // column indices (residues 4 and 8, and 2)
const SEL = { i: 3, j: 7 };             // the pair cell that is picked out (residues 4 and 8)

// the nine frames: where they end up (made-up positions along a gentle wave, and tilts), and where they all start
const N = 9, ORIGIN = [44, 284];
const FINAL = Array.from({ length: N }, (_, k) => [76 + 45 * k, 272 + 13 * Math.sin(0.8 * k + 0.4)]);
const TILT = [-25, 15, -10, 30, -35, 10, 25, -20, 5];
const BLOCKS = 8;
const T0 = 0.42;   // the module's progress at which the frames start to move; before it they sit stacked at the origin

AF3.kinds.af2reason = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + AF3.tagCss + `
      .af-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 19%; }
      .af-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .af-bg { fill: color-mix(in srgb, var(--fg) 3%, transparent); stroke: color-mix(in srgb, var(--muted) 38%, transparent); stroke-width: 1.5;
        transition: opacity .5s, stroke .5s; opacity: .45; }
      .af-bg.act { opacity: 1; stroke: color-mix(in srgb, var(--accent) 55%, transparent); }
      .af-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .af-line { fill: none; stroke: var(--muted); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .af-caps { display: grid; grid-template-columns: 250fr 220fr 500fr; column-gap: 1.5%; margin-top: 1.1em; font-size: var(--u); }
      .af-caps p { margin: 0; padding-left: calc(1.4 * var(--u)); font-size: var(--t-small); line-height: 1.25; opacity: 0; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const captions = AF3.texts(s).filter((t) => !t.ph && AF3.maxSize(t) === 22).sort((a, b) => a.g.x - b.g.x);

    // Every drawn thing is registered with the part it belongs to (msa / pair / mod / chi) and the span of that part's progress over
    // which it fades in; `max` is the opacity it fades up to.
    const meta = [];
    const reg = (tag, attrs, comp, a, b, o = {}) => {
      meta.push({ comp, a, b, max: o.max === undefined ? 1 : o.max });
      return `<${tag} data-k="${meta.length - 1}" ${attrs} opacity="0">${o.inner || ''}</${tag}>`;
    };
    const txt = (x, y, str, comp, a, b, o = {}) => reg('text',
      `x="${x}" y="${y}" class="af-t" font-size="${o.size || 15}" text-anchor="${o.anchor || 'start'}"${o.weight ? ` font-weight="${o.weight}"` : ''}`
      + `${o.fill ? ` style="fill:${o.fill}"` : ''}${o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : ''}`, comp, a, b, { inner: o.html !== undefined ? o.html : esc(str) });
    const rect = (x, y, w, h, fill, stroke, comp, a, b, o = {}) => reg('rect',
      `x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx === undefined ? 3 : o.rx}" fill="${fill}" stroke="${stroke || 'none'}" stroke-width="${o.sw || 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}`, comp, a, b, { max: o.max });
    const path = (d, comp, a, b, o = {}) => reg('path', `d="${d}" class="af-line"${o.stroke ? ` style="stroke:${o.stroke}"` : ''}${o.arrow ? ' marker-end="url(#af-head)"' : ''}${o.sw ? ` stroke-width="${o.sw}"` : ''}`, comp, a, b);
    const em = (str) => `<tspan font-style="italic">${str}</tspan>`;

    // ---------------- panel 1: the MSA ----------------
    const GX = 86, GY = 84, CW = 16, CH = 28;
    const msa = (() => {
      let g = txt(16, 24, 'MSA representation', 'msa', 0, 0.06, { weight: 700 }) + txt(16, 44, '(s, r, c)', 'msa', 0, 0.06, { fill: 'var(--muted)' });
      g += txt(14, 68, 'sequences', 'msa', 0.02, 0.1, { size: 14, fill: 'var(--muted)' }) + txt(GX + 4.5 * CW, 68, 'residues', 'msa', 0.02, 0.1, { size: 14, anchor: 'middle', fill: 'var(--muted)' });
      ROWS.forEach(([name, seq], i) => {
        const a = 0.05 + 0.085 * i, b = a + 0.1, cy = GY + CH * i + CH / 2;
        g += txt(14, cy, name, 'msa', a, b, { weight: i === 0 ? 700 : 400 });
        [...seq].forEach((ch, j) => {
          g += rect(GX + CW * j + 0.5, GY + CH * i + 0.5, CW - 1, CH - 1, mix(MSA[0], MSA[1], SHADE[ch]), null, 'msa', a, b);
          g += txt(GX + CW * j + CW / 2, cy + 1, ch, 'msa', a, b, { size: 14, anchor: 'middle', fill: INK });
        });
      });
      const gh = CH * ROWS.length, bot = GY + gh, cx = (j) => GX + CW * j + CW / 2;
      // one column that never changes
      g += rect(GX + CW * CONSERVED - 1, GY - 1, CW + 2, gh + 2, 'none', 'var(--done)', 'msa', 0.52, 0.62, { sw: 2.5 });
      g += path(`M${cx(CONSERVED)} ${bot + 2} V${bot + 20}`, 'msa', 0.54, 0.64, { stroke: 'var(--done)' });
      g += txt(cx(CONSERVED), bot + 34, 'conserved', 'msa', 0.56, 0.66, { anchor: 'middle', weight: 700, fill: 'var(--done)' });
      // two columns that change together
      COVARY.forEach((j) => { g += rect(GX + CW * j - 1, GY - 1, CW + 2, gh + 2, 'none', 'var(--accent)', 'msa', 0.72, 0.8, { sw: 2.5 }); });
      const mid = (cx(COVARY[0]) + cx(COVARY[1])) / 2;
      g += path(`M${cx(COVARY[0])} ${bot + 2} V${bot + 14} H${cx(COVARY[1])} V${bot + 2}`, 'msa', 0.78, 0.88, { stroke: 'var(--accent)' });
      g += path(`M${mid} ${bot + 14} V${bot + 38}`, 'msa', 0.8, 0.9, { stroke: 'var(--accent)' });
      g += txt(mid, bot + 52, 'change together', 'msa', 0.82, 0.95, { anchor: 'middle', weight: 700, fill: 'var(--accent)' });
      return g;
    })();

    // ---------------- panel 2: the pair map ----------------
    const PX = 44, PY = 84, PC = 16;
    const pair = (() => {
      const r = rng(SEED);
      let g = txt(16, 24, 'Pair representation', 'pair', 0, 0.06, { weight: 700 }) + txt(16, 44, '(r, r, c)', 'pair', 0, 0.06, { fill: 'var(--muted)' });
      g += txt(PX + 4.5 * PC, 62, 'residue i', 'pair', 0.02, 0.12, { size: 14, anchor: 'middle', fill: 'var(--muted)', html: `residue ${em('i')}` });
      g += txt(14, PY + 4.5 * PC, 'residue j', 'pair', 0.02, 0.12, { size: 14, anchor: 'middle', fill: 'var(--muted)', rot: -90, html: `residue ${em('j')}` });
      // a dot per residue along the top (i) and the left (j); residues 4 and 8 are picked out in the accent
      const dot = (cx, cy, sel) => reg('circle', `cx="${cx}" cy="${cy}" r="${sel ? 5 : 3}" fill="${sel ? 'var(--accent)' : 'var(--muted)'}"`, 'pair', sel ? 0.7 : 0.04, sel ? 0.82 : 0.14);
      for (let k = 0; k < N; k++) g += dot(PX + PC * k + PC / 2, 75, false) + dot(29, PY + PC * k + PC / 2, false);
      g += dot(PX + PC * SEL.i + PC / 2, 75, true) + dot(29, PY + PC * SEL.j + PC / 2, true);
      for (let row = 0; row < N; row++) {
        for (let c = 0; c < N; c++) {
          const d = Math.abs(row - c), pick = (row === SEL.j && c === SEL.i) || (row === SEL.i && c === SEL.j);
          const v = pick ? 1 : clamp01(0.1 + 0.55 * Math.exp(-d / 2.5) * r() + 0.3 * r());
          const a = 0.1 + 0.055 * d + 0.01 * r();
          g += rect(PX + PC * c + 0.5, PY + PC * row + 0.5, PC - 1, PC - 1, mix(PAIR[0], PAIR[1], v), null, 'pair', a, a + 0.14);
        }
      }
      // residues 4 and 8: the column and row, then the cell where they meet
      g += rect(PX + PC * SEL.i, PY, PC, PC * N, 'var(--accent)', null, 'pair', 0.7, 0.82, { max: 0.14, rx: 0 });
      g += rect(PX, PY + PC * SEL.j, PC * N, PC, 'var(--accent)', null, 'pair', 0.7, 0.82, { max: 0.14, rx: 0 });
      g += rect(PX + PC * SEL.i - 1, PY + PC * SEL.j - 1, PC + 2, PC + 2, 'none', 'var(--accent)', 'pair', 0.8, 0.92, { sw: 3 });
      g += txt(PX + 4.5 * PC, PY + PC * N + 26, '', 'pair', 0.86, 1, { anchor: 'middle', size: 16, weight: 700, fill: 'var(--accent)', html: `${em('i')} = 4, ${em('j')} = 8` });
      return g;
    })();

    // ---------------- panel 3: the structure module ----------------
    const struct = (() => {
      const r = rng(SEED + 1);
      let g = txt(16, 24, 'Structure module', 'mod', 0, 0.06, { weight: 700 });
      // the inputs: the pair map and the single representation (a copy of the MSA's first row)
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) g += rect(16 + 12 * b + 0.5, 48 + 12 * a + 0.5, 11, 11, mix(PAIR[0], PAIR[1], r()), null, 'mod', 0, 0.1, { rx: 1.5 });
      g += txt(40, 112, 'pair', 'mod', 0, 0.1, { anchor: 'middle', size: 14 });
      [...'MWLKT'].forEach((ch, k) => { g += rect(16 + 16 * k + 0.5, 138, 15, 18, mix(MSA[0], MSA[1], SHADE[ch]), null, 'mod', 0, 0.1, { rx: 2 }); });
      g += txt(56, 172, 'single', 'mod', 0, 0.1, { anchor: 'middle', size: 14 }) + txt(56, 188, '(MSA row 1)', 'mod', 0, 0.1, { anchor: 'middle', size: 13, fill: 'var(--muted)' });
      // the 8 blocks: a loop with the IPA module and the frame update, and a dot for each block
      g += rect(132, 40, 252, 150, 'none', 'var(--muted)', 'mod', 0.06, 0.16, { rx: 16, sw: 2 });
      g += txt(258, 28, '8 blocks (shared weights)', 'mod', 0.06, 0.16, { anchor: 'middle', fill: 'var(--muted)' });
      for (let k = 0; k < BLOCKS; k++) g += `<circle data-blk="${k}" cx="${164 + 28 * k}" cy="54" r="5" fill="none" stroke="var(--muted)" stroke-width="1.5" opacity="0"/>`;
      g += rect(150, 68, 86, 70, IPA.fill, IPA.stroke, 'mod', 0.12, 0.22, { rx: 10, sw: 2 });
      g += txt(193, 92, 'IPA', 'mod', 0.12, 0.22, { anchor: 'middle', weight: 700, fill: INK }) + txt(193, 112, 'module', 'mod', 0.12, 0.22, { anchor: 'middle', fill: INK });
      g += txt(150, 158, 'invariant point', 'mod', 0.14, 0.24, { size: 13, fill: 'var(--muted)' }) + txt(150, 174, 'attention', 'mod', 0.14, 0.24, { size: 13, fill: 'var(--muted)' });
      g += path('M64 76 C104 76 120 90 150 94', 'mod', 0.12, 0.22, { arrow: true }) + path('M96 147 C122 147 132 124 150 120', 'mod', 0.12, 0.22, { arrow: true });
      g += rect(256, 68, 110, 70, UPD.fill, UPD.stroke, 'mod', 0.2, 0.3, { rx: 10, sw: 2 });
      g += txt(311, 85, 'Move frames', 'mod', 0.2, 0.3, { anchor: 'middle', weight: 700, fill: INK }) + txt(311, 104, 'rotate +', 'mod', 0.2, 0.3, { anchor: 'middle', fill: INK })
        + txt(311, 122, 'translate', 'mod', 0.2, 0.3, { anchor: 'middle', fill: INK });
      g += path('M238 103 L254 103', 'mod', 0.2, 0.3, { arrow: true }) + path('M338 140 V210', 'mod', 0.26, 0.34, { arrow: true });
      // the frames: one triangle (the N, C-alpha and C of a residue) per residue, all starting at the origin
      g += rect(12, 200, 476, 122, 'none', 'var(--muted)', 'mod', 0.24, 0.34, { rx: 12, dash: '5 4' });
      g += txt(24, 218, 'frames: the N–Cα–C of each residue', 'mod', 0.26, 0.36, { size: 13, fill: 'var(--muted)' });
      g += `<g data-origin opacity="0" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"><path d="M${ORIGIN[0] - 6} ${ORIGIN[1]} H${ORIGIN[0] + 6} M${ORIGIN[0]} ${ORIGIN[1] - 6} V${ORIGIN[1] + 6}"/></g>`;
      g += `<text data-start x="30" y="306" class="af-t" font-size="13" style="fill:var(--muted)" opacity="0">all frames start at the origin</text>`;
      g += FINAL.map((_, k) => `<g data-tri="${k}" opacity="0"><g data-chi="${k}" opacity="0"><line x1="0" y1="-10" x2="0" y2="-22" stroke="${CHI.stroke}" stroke-width="2"/>`
        + `<circle cx="0" cy="-27" r="5.5" fill="${CHI.fill}" stroke="${CHI.stroke}" stroke-width="2"/></g>`
        + `<polygon points="-9,7 9,7 0,-10" fill="${FRAME.fill}" stroke="${FRAME.stroke}" stroke-width="2" stroke-linejoin="round"/></g>`).join('');
      // after the 8 blocks: the chi angles
      g += path('M386 103 L416 103', 'chi', 0, 0.2, { arrow: true });
      g += rect(418, 68, 72, 70, CHI.fill, CHI.stroke, 'chi', 0, 0.2, { rx: 10, sw: 2 });
      g += txt(454, 92, 'Predict', 'chi', 0, 0.2, { anchor: 'middle', weight: 700, fill: INK }) + txt(454, 112, 'χ angles', 'chi', 0, 0.2, { anchor: 'middle', fill: INK });
      g += path('M454 140 V210', 'chi', 0.1, 0.25, { arrow: true });
      return g;
    })();

    const bgs = [[0, 250, 'msa'], [265, 220, 'pair'], [500, 500, 'mod']];
    const svg = `<svg viewBox="0 0 1000 330" role="img" aria-label="The MSA representation, the pair representation and the structure module, built up one at a time">
      <defs><marker id="af-head" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8z" fill="var(--muted)"/></marker></defs>
      ${bgs.map(([x, w, c]) => `<rect class="af-bg" data-bg="${c}" x="${x}" y="0" width="${w}" height="330" rx="16"/>`).join('')}
      <g transform="translate(0 0)">${msa}</g><g transform="translate(265 0)">${pair}</g><g transform="translate(500 0)">${struct}</g></svg>`;
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="af-wrap">${svg}
        <div class="af-caps">${['msa', 'pair', 'mod'].map((c, i) => `<p data-cap="${c}">${AF3.paraHtml(captions[i].paras[0], esc, {})}</p>`).join('')}</div>
      </div>
      ${AF3.tagHtml('illustration: made-up sequences and positions', esc)}`;

    const els = [...frame.querySelectorAll('[data-k]')];
    const bgEl = Object.fromEntries([...frame.querySelectorAll('[data-bg]')].map((e) => [e.dataset.bg, e]));
    const capEl = Object.fromEntries([...frame.querySelectorAll('[data-cap]')].map((e) => [e.dataset.cap, e]));
    const tris = [...frame.querySelectorAll('[data-tri]')], chis = [...frame.querySelectorAll('[data-chi]')], blks = [...frame.querySelectorAll('[data-blk]')];
    const originMark = frame.querySelector('[data-origin]'), startNote = frame.querySelector('[data-start]');

    const draw = (st) => {
      els.forEach((el) => { const m = meta[+el.dataset.k]; el.setAttribute('opacity', (ramp(st[m.comp], m.a, m.b) * m.max).toFixed(3)); });
      for (const c of ['msa', 'pair', 'mod']) {
        bgEl[c].classList.toggle('act', st[c] > 0);
        capEl[c].style.opacity = ramp(st[c], 0.02, 0.15).toFixed(2);
      }
      // the module: the frames leave the origin, a little later each, and the blocks light up as they go
      const m = st.mod, u = clamp01((m - T0) / (1 - T0)), shown = ramp(m, 0.26, 0.34).toFixed(2);
      tris.forEach((g, k) => {
        const e = ease(clamp01((u - 0.035 * k) / (1 - 0.035 * (N - 1)))), x = ORIGIN[0] + (FINAL[k][0] - ORIGIN[0]) * e, y = ORIGIN[1] + (FINAL[k][1] - ORIGIN[1]) * e;
        g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(TILT[k] * e).toFixed(1)})`);
        g.setAttribute('opacity', shown);
      });
      chis.forEach((g, k) => g.setAttribute('opacity', ramp(st.chi, 0.12 + 0.07 * k, 0.47 + 0.07 * k).toFixed(2)));
      const lit = u > 0 ? Math.ceil(u * BLOCKS - 1e-9) : 0, dotsOn = ramp(m, 0.06, 0.16);
      blks.forEach((c, k) => {
        c.setAttribute('opacity', dotsOn.toFixed(2));
        c.setAttribute('fill', k < lit ? 'var(--accent)' : 'none');
        c.setAttribute('stroke', k < lit ? 'var(--accent)' : 'var(--muted)');
      });
      originMark.setAttribute('opacity', shown);
      startNote.setAttribute('opacity', (ramp(m, 0.28, 0.36) * (1 - ramp(u, 0, 0.15))).toFixed(2));
    };
    const stateOf = (step) => ({ msa: step >= 1 ? 1 : 0, pair: step >= 2 ? 1 : 0, mod: step >= 3 ? 1 : 0, chi: step >= 4 ? 1 : 0 });
    let cur = { msa: 0, pair: 0, mod: 0, chi: 0 }, raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const back = Object.keys(to).some((k) => to[k] < from[k]);
        const ms = back ? 700 : [0, 5200, 4200, 8000, 3200][step], t0 = performance.now();
        return new Promise((done) => {
          const tick = (now) => {
            const u = Math.min(1, (now - t0) / ms);
            cur = Object.fromEntries(Object.keys(to).map((k) => [k, from[k] + (to[k] - from[k]) * u]));
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
