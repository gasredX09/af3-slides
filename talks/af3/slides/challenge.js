// "Why is it challenging?" (slide 7): the three pictures of the original (a peptide backbone, ibuprofen, DNA) redrawn
// natively and built up one at a time, to show what the closing line says: different molecules do not share one
// convenient representation.
//
//   Protein  a repeating backbone (N, C-alpha, C) joined by peptide bonds, the same unit three times, then a different
//            side chain R on each C-alpha (20 standard ones).
//   Ligand   ibuprofen, drawn from SMILES (tools/prep_tokens.py): a few atoms, no repeating unit.
//   DNA      two repeating sugar-phosphate backbones, with a base on every sugar and the bases pairing across (A-T, G-C).
//
// These are schematics of the molecules on the original slide (labels kept: peptide bond, sugar, phosphate, bases), not
// structures from the paper. The closing line is the original slide's own.
//
// Under each molecule, once it is drawn, the way it would be written down is typed out: the protein as a string over 20 letters (the 20 standard amino acids), ibuprofen as the SMILES graph of its atoms (from
// data/tokens.js), DNA as two complementary strings over 4 letters. The protein and DNA strings are the made-up examples of slide 4. The closing line has a line under it: one
// network needs one shared format.
//
// Steps: 1 protein · 2 ligand · 3 DNA · 4 the closing line.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lum = (hex) => { const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => x / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ink = (hex) => (lum(hex) > 0.55 ? '#1d2129' : '#ffffff');

AF3.kinds.challenge = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc, palette: P }) {
    css(AF3.textCss + `
      .ch-row { position: absolute; left: 4.2%; right: 4.2%; top: 14.5%; height: 51%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.8em; font-size: var(--u); }
      .ch-panel { box-sizing: border-box; display: flex; flex-direction: column; padding: .7em 1.1em .9em; border-radius: 1em; min-width: 0;
        border: 1.5px solid color-mix(in srgb, var(--muted) 38%, transparent); background: color-mix(in srgb, var(--fg) 3%, transparent);
        transition: opacity .5s, border-color .5s; opacity: .45; }
      .ch-panel.act { opacity: 1; border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
      .ch-title { margin: 0; font-size: var(--t-small); font-weight: 700; color: var(--accent); }
      .ch-map { position: relative; flex: 1; min-height: 0; }
      .ch-map svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
      .ch-cap { margin: 0; min-height: 2.7em; font-size: var(--t-caption); line-height: 1.3; color: var(--muted); }
      .ch-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; text-anchor: middle; dominant-baseline: central; font-weight: 700; }
      .ch-concl { position: absolute; left: 4.2%; right: 4.2%; top: 81.5%; margin: 0; font-size: calc(var(--t-heading) * .85); font-weight: 700; color: var(--accent); line-height: 1.2; }
      .ch-concl2 { position: absolute; left: 4.2%; right: 4.2%; top: 89%; margin: 0; font-size: var(--t-body); color: var(--muted); line-height: 1.2; }
      .ch-notes { position: absolute; left: 4.2%; right: 4.2%; top: 67%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.8em; font-size: var(--u); }
      .ch-note { margin: 0; padding: .4em .8em .5em; border-radius: .7em; opacity: 0; min-width: 0; background: color-mix(in srgb, var(--accent) 8%, transparent); border-top: 2px solid var(--accent); }
      .ch-note-h { display: block; font-size: calc(var(--t-caption) * .9); color: var(--muted); line-height: 1.3; margin-bottom: .15em; }
      .ch-note code { display: block; min-height: 1.3em; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: calc(var(--t-caption) * .95); letter-spacing: .02em; color: var(--fg); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.35; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const closing = AF3.texts(s).find((t) => !t.ph);
    const EL = P.el, R = [P.rainbow[1], EL.other, P.rainbow[3]];

    // every drawn thing is registered with the part of the animation it belongs to (comp: prot / lig / dna) and the span of that
    // part's progress (a to b) over which it appears; mode 'fade' fades in, 'dash' draws a line from its start
    const meta = [];
    const reg = (tag, attrs, comp, a, b, mode = 'fade', inner = '') => {
      meta.push({ comp, a, b, mode });
      const extra = mode === 'dash' ? ' pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"' : '';
      return `<${tag} data-k="${meta.length - 1}" ${attrs}${extra} opacity="0">${inner}</${tag}>`;
    };
    const line = (x1, y1, x2, y2, w, comp, a, b, stroke = 'var(--muted)') =>
      reg('path', `d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"`, comp, a, b, 'dash');
    const disc = (x, y, r, fill, label, comp, a, b, fs = 14) =>
      reg('circle', `cx="${x}" cy="${y}" r="${r}" fill="${fill}"`, comp, a, b)
      + (label ? reg('text', `x="${x}" y="${y + 1}" class="ch-t" font-size="${fs}" fill="${ink(fill)}"`, comp, a, b, 'fade', esc(label)) : '');

    // ---- protein: N, C-alpha, C three times; O on each C, R on each C-alpha, boxes round the repeating unit ----
    const protein = (() => {
      const atoms = ['N', 'Cα', 'C', 'N', 'Cα', 'C', 'N', 'Cα', 'C'];
      const X = (i) => 27 + 27 * i, Y = (i) => (i % 2 === 0 ? 120 : 92);   // zigzag: even atoms down, odd up
      const off = (i) => (i % 2 === 0 ? 38 : -38);                          // O and R point away from the zigzag
      let g = '';
      for (let i = 0; i < 8; i++) g += line(X(i), Y(i), X(i + 1), Y(i + 1), 4, 'prot', i * 0.05 + 0.02, i * 0.05 + 0.08);
      [2, 5, 8].forEach((i, k) => {                                          // carbonyl O: a double bond up or down
        const a = 0.42 + k * 0.03;
        g += line(X(i) - 3, Y(i), X(i) - 3, Y(i) + off(i), 2.5, 'prot', a, a + 0.06) + line(X(i) + 3, Y(i), X(i) + 3, Y(i) + off(i), 2.5, 'prot', a, a + 0.06);
      });
      [1, 4, 7].forEach((i, k) => { const a = 0.84 + k * 0.04; g += line(X(i), Y(i), X(i), Y(i) + off(i), 3, 'prot', a, a + 0.06); });
      for (let u = 0; u < 3; u++) {                                          // the repeating unit, boxed three times
        const a = 0.62 + u * 0.06;
        g += reg('rect', `x="${X(3 * u) - 15}" y="72" width="${X(3 * u + 2) - X(3 * u) + 30}" height="62" rx="14" fill="var(--accent)" fill-opacity=".09" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4"`, 'prot', a, a + 0.08);
      }
      atoms.forEach((t, i) => { g += disc(X(i), Y(i), 12, t === 'N' ? EL.N : EL.C, t, 'prot', i * 0.05, i * 0.05 + 0.06, t === 'Cα' ? 12 : 14); });
      [2, 5, 8].forEach((i, k) => { g += disc(X(i), Y(i) + off(i), 10, EL.O, 'O', 'prot', 0.45 + k * 0.03, 0.51 + k * 0.03); });
      [1, 4, 7].forEach((i, k) => { g += disc(X(i), Y(i) + off(i), 12, R[k], 'R', 'prot', 0.86 + k * 0.04, 0.92 + k * 0.04); });
      // peptide bond: a label and a leader down to the bond between the first C and the next N
      const mx = (X(2) + X(3)) / 2;
      g += reg('text', `x="${mx}" y="22" class="ch-t" font-size="17" fill="var(--fg)"`, 'prot', 0.5, 0.58, 'fade', 'peptide bond');
      g += line(mx, 34, mx, 98, 2, 'prot', 0.5, 0.58, 'var(--fg)');
      g += reg('text', `x="135" y="190" class="ch-t" font-size="17" fill="var(--accent)"`, 'prot', 0.74, 0.82, 'fade', 'same unit, repeated');
      return g;
    })();

    // ---- ligand: ibuprofen from the tokenization slide's data, traced bond by bond ----
    const ligand = (() => {
      const m = window.DATA.tokens.find((t) => t.id === 'ibuprofen');
      const xs = m.atoms.map((a) => a.x), ys = m.atoms.map((a) => a.y);
      const k = Math.min(228 / (Math.max(...xs) - Math.min(...xs)), 120 / (Math.max(...ys) - Math.min(...ys)));
      const pos = (a) => [135 + a.x * k, 104 + a.y * k];
      let g = '';
      m.bonds.forEach((b, i) => {
        const [x1, y1] = pos(m.atoms[b.a]), [x2, y2] = pos(m.atoms[b.b]), a0 = i * 0.05 + 0.02;
        if (b.order === 2) {
          const dx = y2 - y1, dy = x1 - x2, n = Math.hypot(dx, dy) || 1, ox = (dx / n) * 3, oy = (dy / n) * 3;
          g += line(x1 + ox, y1 + oy, x2 + ox, y2 + oy, 2.5, 'lig', a0, a0 + 0.07) + line(x1 - ox, y1 - oy, x2 - ox, y2 - oy, 2.5, 'lig', a0, a0 + 0.07);
        } else g += line(x1, y1, x2, y2, 3.5, 'lig', a0, a0 + 0.07);
      });
      m.atoms.forEach((a, i) => { const [x, y] = pos(a); g += a.el === 'C' ? disc(x, y, 5, EL.C, '', 'lig', i * 0.05, i * 0.05 + 0.06) : disc(x, y, 10, EL[a.el] || EL.other, a.el, 'lig', i * 0.05, i * 0.05 + 0.06); });
      return g;
    })();

    // ---- DNA: two sugar-phosphate backbones and four base pairs ----
    const dna = (() => {
      const XL = 52, XR = 218, Y = (j) => 34 + j * 45;
      const baseFill = { A: P.series[3], T: P.series[4], C: P.series[2], G: P.fg };
      const left = ['A', 'G', 'T', 'C'], right = ['T', 'C', 'A', 'G'];
      let g = line(XL, Y(0), XL, Y(3), 3, 'dna', 0, 0.5) + line(XR, Y(0), XR, Y(3), 3, 'dna', 0, 0.5);
      const pent = (x, y, r) => Array.from({ length: 5 }, (_, i) => `${(x + r * Math.sin((i * 2 * Math.PI) / 5)).toFixed(1)},${(y - r * Math.cos((i * 2 * Math.PI) / 5)).toFixed(1)}`).join(' ');
      for (let j = 0; j < 4; j++) {
        const a = j * 0.16;
        [XL, XR].forEach((x) => {
          g += reg('polygon', `points="${pent(x, Y(j), 12.5)}" fill="${P.series[1]}" fill-opacity=".45" stroke="${P.series[1]}" stroke-width="2"`, 'dna', a, a + 0.08);
          g += reg('text', `x="${x}" y="${Y(j) + 1}" class="ch-t" font-size="12" fill="var(--fg)"`, 'dna', a, a + 0.08, 'fade', 'S');
          if (j < 3) g += disc(x, Y(j) + 22.5, 8, EL.P, 'P', 'dna', a + 0.08, a + 0.16, 11);
        });
      }
      for (let j = 0; j < 4; j++) {
        const a = 0.52 + j * 0.11;
        g += line(XL + 12.5, Y(j), 88, Y(j), 3, 'dna', a, a + 0.08) + line(XR - 12.5, Y(j), 182, Y(j), 3, 'dna', a, a + 0.08);
        g += reg('path', `d="M114 ${Y(j)} L156 ${Y(j)}" fill="none" stroke="var(--muted)" stroke-width="3" stroke-dasharray="4 4"`, 'dna', a + 0.04, a + 0.12);
        [[100, left[j]], [170, right[j]]].forEach(([x, t]) => {
          g += reg('rect', `x="${x - 14}" y="${Y(j) - 14}" width="28" height="28" rx="5" fill="${baseFill[t]}"`, 'dna', a, a + 0.08);
          g += reg('text', `x="${x}" y="${Y(j) + 1}" class="ch-t" font-size="17" fill="${ink(baseFill[t].startsWith('#') ? baseFill[t] : '#000000')}"`, 'dna', a, a + 0.08, 'fade', t);
        });
      }
      return g;
    })();

    const svg = (inner) => `<svg viewBox="0 0 270 205" preserveAspectRatio="xMidYMid meet" role="img">${inner}</svg>`;
    // (not a <section>: Reveal takes a section inside a slide for a vertical slide, which broke the steps and the layout of this slide)
    const panel = (comp, head, cap, inner) => `<div class="ch-panel" data-comp="${comp}"><p class="ch-title">${esc(head)}</p>
      <div class="ch-map">${svg(inner)}</div><p class="ch-cap" data-cap="${comp}" style="opacity:0">${esc(cap)}</p>
</div>`;
    const noteOf = (comp, note) => `<p class="ch-note" data-note="${comp}"><span class="ch-note-h">${esc(note[0])}</span><code data-full="${esc(note[1])}"></code></p>`;
    const NOTES = {
      prot: ['Written as a string of 20 letters', 'MKTAYIAKQRQISFVKSHFSRQ'],
      lig: ['Written as a graph of atoms (SMILES)', window.DATA.tokens.find((t) => t.id === 'ibuprofen').smiles],
      dna: ['Written as strings of 4 letters', 'ACGTTAGCCGATAGC\nTGCAATCGGCTATCG'],
    };
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="ch-row">
        ${panel('prot', 'Protein', 'Repeating backbone (N, Cα, C), with one of 20 standard side chains (R) on each Cα', protein)}
        ${panel('lig', 'Small molecule (ligand)', 'Ibuprofen: no repeating backbone, any arrangement of atoms', ligand)}
        ${panel('dna', 'DNA', 'Repeating sugar–phosphate backbone, with one of 4 bases (A, T, C, G) on each sugar', dna)}
      </div>
      <div class="ch-notes">${Object.entries(NOTES).map(([c, n]) => noteOf(c, n)).join('')}</div>
      <p class="ch-concl reveal-in" data-from="4">${AF3.paraHtml(closing.paras[0], esc, {}).replace(/<span class="deck-accent">|<\/span>/g, '')}</p>
      <p class="ch-concl2 reveal-in" data-from="4">One network needs one shared format.</p>`;

    const els = [...frame.querySelectorAll('[data-k]')];
    const panels = Object.fromEntries([...frame.querySelectorAll('.ch-panel')].map((e) => [e.dataset.comp, e]));
    const caps = Object.fromEntries([...frame.querySelectorAll('[data-cap]')].map((e) => [e.dataset.cap, e]));
    const notes = Object.fromEntries([...frame.querySelectorAll('[data-note]')].map((e) => [e.dataset.note, e]));
    const draw = (st) => {
      els.forEach((el) => {
        const m = meta[+el.dataset.k], r = ramp(st[m.comp], m.a, m.b);
        el.setAttribute('opacity', r > 0 ? '1' : '0');
        if (m.mode === 'dash') el.setAttribute('stroke-dashoffset', (1 - r).toFixed(3));
        else el.setAttribute('opacity', r.toFixed(3));
      });
      for (const c of Object.keys(panels)) {
        panels[c].classList.toggle('act', st[c] > 0);
        caps[c].style.opacity = ramp(st[c], 0.04, 0.2).toFixed(2);
        notes[c].style.opacity = ramp(st[c], 0.5, 0.62).toFixed(2);   // written out letter by letter once the molecule is drawn
        const code = notes[c].querySelector('code'), full = code.dataset.full;
        code.textContent = full.slice(0, Math.ceil(full.length * ramp(st[c], 0.58, 0.98)));
      }
    };
    const stateOf = (step) => ({ prot: step >= 1 ? 1 : 0, lig: step >= 2 ? 1 : 0, dna: step >= 3 ? 1 : 0 });
    let cur = { prot: 0, lig: 0, dna: 0 }, raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 3800, 2900, 3600, 300][step], t0 = performance.now();
        return new Promise((done) => {
          const tick = (now) => {
            const u = Math.min(1, (now - t0) / ms);
            cur = { prot: from.prot + (to.prot - from.prot) * u, lig: from.lig + (to.lig - from.lig) * u, dna: from.dna + (to.dna - from.dna) * u };
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
