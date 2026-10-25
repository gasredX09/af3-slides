// The three "at a glance" slides (15 Input preparation, 30 Representation learning, 43 Structure prediction), simplified. The pptx
// had a summary paragraph and three cards of small text (takes in, what it does, outputs); here each stage is one picture that
// plays: its inputs as little tensor icons, a machine whose steps light up one per click with a one-sentence caption, and the outputs.
//
//   click 1      the summary line, and what the stage takes in
//   clicks 2..n  the machine's steps, one at a time; the inputs a step uses stay lit, and a loop arrow shows the repeat
//                (recycling on slide 30, the ~200 denoising steps on slide 43)
//   last click   the outputs
//
// All the content is the pptx slides' own, shortened: the sentences are the "what it does" lines of the cards with the tensor
// shapes (N_tok x 384 ...) left out; the symbols in the sentences are KaTeX ($...$, AF3.rich), and the summary is the first paragraph in one line. The shapes are on slides 17, 26 and 27.
// To get the cards back, set the slide's kind to 'glance' in plan.js.
{
const COLOR = { s: '#f2b8e6', z: '#a9d8f2', m: '#f7b97c', t: '#3e9b7a', c: '#c27bc9', x: '#5f6368', conf: '#c00000', seq: '#dadce0', db: '#dadce0', '3d': '#dadce0' };
const lum = (hex) => { const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => x / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ink = (hex) => (lum(hex) > 0.55 ? '#1d2129' : '#ffffff');
const LINE = 'rgba(0,0,0,.3)';

// a small picture for each kind of tensor (56 x 44)
const icon = (kind, letter) => {
  const c = COLOR[kind] || COLOR.s, t = (x, y) => (letter ? AF3.svgMath(x, y - 5, 19, letter, { color: ink(c), w: 40 }) : '');
  let g;
  if (kind === 's') g = `<rect x="18" y="2" width="20" height="40" rx="3" fill="${c}" stroke="${LINE}"/><path d="M28 2V42M18 14H38M18 28H38" stroke="${LINE}" fill="none"/>${t(28, 27)}`;
  else if (kind === 'z' || kind === 'm' || kind === 't') g = `<polygon points="8,12 18,3 50,3 40,12" fill="${c}" fill-opacity=".7" stroke="${LINE}"/><polygon points="40,12 50,3 50,31 40,40" fill="${c}" fill-opacity=".55" stroke="${LINE}"/><rect x="8" y="12" width="32" height="28" fill="${c}" stroke="${LINE}"/>${t(24, 31)}`;
  else if (kind === 'c') g = `<rect x="4" y="8" width="48" height="28" rx="3" fill="${c}" stroke="${LINE}"/><path d="M16 8V36M28 8V36M40 8V36M4 22H52" stroke="${LINE}" fill="none"/>${t(28, 28)}`;
  else if (kind === 'x') g = [[10, 30], [22, 12], [30, 34], [40, 16], [48, 28]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${c}"/>`).join('') + `<path d="M10 30L22 12L40 16L48 28L30 34Z" stroke="${c}" stroke-width="1.5" fill="none" stroke-dasharray="3 3"/>`;
  else if (kind === 'conf') g = `<rect x="4" y="8" width="48" height="28" rx="14" fill="${c}" fill-opacity=".18" stroke="${c}" stroke-width="2"/><path d="M18 22L25 29L39 15" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  else if (kind === 'seq') g = ['A', 'C', 'G', 'T'].map((l, i) => `<rect x="${4 + i * 13}" y="12" width="12" height="20" rx="2" fill="${['#98a6bc', '#dfaa3e', '#2f55d4', '#cf3434'][i]}" fill-opacity=".8"/><text x="${10 + i * 13}" y="27" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" style="font-family:Lato,sans-serif">${l}</text>`).join('');
  else if (kind === 'db') g = `<ellipse cx="28" cy="10" rx="18" ry="6" fill="${c}" stroke="${LINE}"/><path d="M10 10V32C10 36 18 40 28 40S46 36 46 32V10" fill="${c}" stroke="${LINE}"/><ellipse cx="28" cy="10" rx="18" ry="6" fill="${c}" stroke="${LINE}"/><path d="M10 21C10 25 18 28 28 28S46 25 46 21" stroke="${LINE}" fill="none"/>`;
  else g = `<path d="M12 30L26 14L44 26" stroke="var(--muted)" stroke-width="3" fill="none"/>` + [[12, 30, 'N'], [26, 14, 'C'], [44, 26, 'O']].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${['#3a5bd9', '#7d848f', '#cf3434'][[12, 26, 44].indexOf(x)]}"/>`).join('');   // 3d: a little molecule
  return `<svg viewBox="0 0 56 44" aria-hidden="true">${g}</svg>`;
};

const DATA = {
  15: {
    sum: 'Every molecule becomes tokens in one shared grid.',
    inn: [['seq', '', 'Chains and ligands', 'plus covalent bonds'], ['db', '', 'Database hits', 'similar sequences and structures'], ['3d', '', 'Reference conformers', 'a 3D shape per residue or ligand']],
    machine: 'Input preparation',
    steps: [
      ['Tokenize', 'A standard residue is one token. A modified residue or a ligand gets one token per atom.'],
      ['Build $m$ and $t$', 'Aligned similar sequences become $m$. Template distograms from similar structures become $t$.'],
      ['Embed atoms', 'Conformer features become the atom tensors $q$, $c$ and $p$.'],
      ['Update atoms', 'The Atom Transformer (3 blocks) refines $q$.'],
      ['Pool to tokens', 'Average the atoms of each token into $s$. Build the pair tensor $z$ from $s_i + s_j$, relative position and bonds.'],
    ],
    out: [['s', 's', 'Token features', 'one vector per token'], ['z', 'z', 'Pair features', 'one per pair of tokens'], ['m', 'm', 'MSA', 'to the MSA module'], ['t', 't', 'Templates', 'to the template module']],
    outCap: 'Every molecule type now sits on one token grid that the trunk can process.',
  },
  30: {
    sum: 'Evolution and templates become a picture of which tokens interact.',
    inn: [['s', 's', 'Token features', 'one per token'], ['z', 'z', 'Pair features', 'one per token pair'], ['m', 'm', 'MSA', 'related sequences'], ['t', 't', 'Templates', 'similar structures']],
    machine: 'Representation learning',
    steps: [
      ['Template module', 'Each template is embedded with $z$, averaged, and added to $z$.', '2 blocks', [1, 3]],
      ['MSA module', 'Related sequences show which positions co-evolve. That is written into $z$, and then $m$ is dropped.', '4 blocks', [1, 2]],
      ['Pairformer', 'Triangle updates refine $z$. Attention biased by $z$ refines $s$.', '48 blocks', [0, 1]],
      ['Recycling', 'Feed $s$ and $z$ back in and run the trunk again.', '', [0, 1]],
    ],
    loop: { from: 0, to: 2, at: 4, label: 'again' },
    out: [['s', 's', '$s_{\\mathrm{trunk}}$', 'context for each token'], ['z', 'z', '$z_{\\mathrm{trunk}}$', 'which tokens interact']],
    outCap: 'The pair picture $z_{\\mathrm{trunk}}$ is the main input to structure prediction.',
  },
  43: {
    sum: 'From noise to a 3D structure, with confidence scores.',
    inn: [['s', 's', 'Token features', 'from the trunk'], ['z', 'z', 'Pair features', 'from the trunk'], ['c', 'c', 'Atom features', 'from the conformers'], ['x', '', 'Noisy coordinates', 'pure random noise']],
    machine: 'Structure prediction',
    steps: [
      ['Condition', 'Combine $s_{\\mathrm{trunk}}$, $z_{\\mathrm{trunk}}$, $s_{\\mathrm{inputs}}$ and the noise level into conditioning tensors.', '', [0, 1]],
      ['Atom encoder', 'Atoms to tokens: the noisy coordinates become atom tensors, pooled into token features $a$.', '3 blocks', [2, 3]],
      ['Diffusion transformer', 'Most of the reasoning: it refines $a$, using pair bias from $z$.', '24 blocks', [1]],
      ['Atom decoder', 'Back to atoms: a denoised $x$. This whole loop repeats for about 200 steps.', '3 blocks', [3]],
      ['Confidence module', 'Scores each final structure.', '4 blocks', []],
    ],
    loop: { from: 1, to: 3, at: 4, label: '× 200' },
    out: [['x', '', '3D coordinates', 'all atoms'], ['conf', '', 'pLDDT', 'accuracy per atom'], ['conf', '', 'PAE and PDE', 'error per token pair'], ['conf', '', 'pTM and ipTM', 'to rank the samples']],
    outCap: 'The structure, and scores that let the model rank its own samples.',
  },
};

AF3.kinds.glance2 = (s) => {
  const d = DATA[s.n], n = d.steps.length;
  return {
    steps: n + 2,
    notes: s.notes || '',
    mount(frame, { css, esc }) {
      css(AF3.textCss + `
        .g2-sum { position: absolute; left: 4.2%; right: 4.2%; top: 14%; margin: 0; font-size: var(--t-lead); font-weight: 600; line-height: 1.25; }
        .g2-row { position: absolute; left: 4.2%; right: 4.2%; top: 24%; display: grid; grid-template-columns: 28fr 3fr 38fr 3fr 25fr; align-items: center; }
        .g2-col h4 { margin: 0 0 .6em; font-size: var(--t-small); font-weight: 700; color: var(--accent); }
        .g2-chip { display: flex; align-items: center; gap: .8em; margin-bottom: .9em; transition: opacity .5s; }
        .g2-chip.dim { opacity: .35; }
        .g2-chip svg { flex: none; width: 4.8em; height: auto; font-size: var(--u); }
        .g2-chip b { display: block; font-size: var(--t-small); line-height: 1.15; }
        .g2-chip .sub { display: block; font-size: var(--t-caption); color: var(--muted); line-height: 1.2; margin-top: .15em; }
        .g2-link { text-align: center; font-size: var(--t-lead); color: var(--muted); }
        .g2-machine { position: relative; box-sizing: border-box; padding: 1.2em 4.6em 1.2em 1.2em; border-radius: 1.2em; font-size: var(--u);
          border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 6%, transparent); }
        .g2-machine h4 { margin: 0 0 .55em; font-size: var(--t-body); font-weight: 700; color: var(--accent); }
        .g2-pills { position: relative; margin: 0; padding: 0; list-style: none; }
        .g2-pill { display: flex; align-items: center; gap: .7em; margin-bottom: .4em; padding: .34em .9em; border-radius: .8em; font-size: var(--t-small); font-weight: 600; white-space: nowrap;
          border: 1.5px solid color-mix(in srgb, var(--muted) 40%, transparent); background: var(--bg); color: var(--muted); transition: background .4s, color .4s, border-color .4s, transform .4s; }
        .g2-pill i { flex: none; width: 1.55em; height: 1.55em; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-size: .85em; font-weight: 700;
          background: color-mix(in srgb, var(--muted) 25%, transparent); color: var(--fg); }
        .g2-pill small { margin-left: auto; font-size: .78em; font-weight: 400; opacity: .85; }
        .g2-pill.on { background: var(--accent); color: #fff; border-color: var(--accent); transform: scale(1.04); }
        .g2-pill.on i { background: #fff; color: var(--accent); }
        .g2-pill.done { color: var(--fg); border-color: color-mix(in srgb, var(--done) 60%, transparent); }
        .g2-pill.done i { background: var(--done); color: #fff; }
        .g2-loop { position: absolute; right: 1.1em; width: 2.5em; border: 3px dashed var(--accent); border-left: 0; border-radius: 0 1.1em 1.1em 0; opacity: 0; transition: opacity .5s; pointer-events: none; }
        .g2-loop::before { content: ''; position: absolute; left: -.2em; top: -.62em; border-right: .75em solid var(--accent); border-top: .55em solid transparent; border-bottom: .55em solid transparent; }
        .g2-loop.on { opacity: 1; }
        .g2-loop span { position: absolute; left: .3em; top: 50%; transform: translateY(-50%); writing-mode: vertical-rl; line-height: 1; font-size: var(--t-caption); font-weight: 700; color: var(--accent); white-space: nowrap; }
        .g2-cap { position: absolute; left: 4.2%; right: 4.2%; top: 80%; height: 12%; }
        .g2-cap p { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-body); line-height: 1.3; font-weight: 600; }
        .g2-cap p b { color: var(--accent); }
      `);
      const texts = AF3.texts(s);
      const title = texts.find((t) => t.ph === 'title' || t.ph === 'ctrTitle') || texts.filter((t) => t.g && t.g.y < 0.2).sort((a, b) => a.g.y - b.g.y)[0];
      const chip = ([k, letter, label, sub]) => `<div class="g2-chip">${icon(k, letter)}<div><b>${AF3.rich(label, esc)}</b><span class="sub">${AF3.rich(sub, esc)}</span></div></div>`;
      frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
        <p class="g2-sum reveal-in" data-from="1">${esc(d.sum)}</p>
        <div class="g2-row">
          <div class="g2-col"><h4 class="reveal-in" data-from="1">Takes in</h4>${d.inn.map((c, i) => `<div class="reveal-in g2-chip-wrap" data-from="1" style="transition-delay:${(0.15 + i * 0.12).toFixed(2)}s">${chip(c)}</div>`).join('')}</div>
          <div class="g2-link reveal-in" data-from="1">→</div>
          <div class="g2-machine reveal-in" data-from="1"><h4>${esc(d.machine)}</h4>
            <ol class="g2-pills">${d.steps.map(([name, , meta], i) => `<li class="g2-pill"><i>${i + 1}</i><span>${AF3.rich(name, esc)}</span>${meta ? `<small>${esc(meta)}</small>` : ''}</li>`).join('')}</ol>
            ${d.loop ? `<div class="g2-loop"><span>${esc(d.loop.label)}</span></div>` : ''}</div>
          <div class="g2-link reveal-in" data-from="${n + 2}">→</div>
          <div class="g2-col"><h4 class="reveal-in" data-from="${n + 2}">Outputs</h4>${d.out.map((c, i) => `<div class="reveal-in" data-from="${n + 2}" style="transition-delay:${(0.1 + i * 0.12).toFixed(2)}s">${chip(c)}</div>`).join('')}</div>
        </div>
        <div class="g2-cap">${d.steps.map(([name, text], i) => `<p class="reveal-in" data-show="${i + 2}"><b>${AF3.rich(name, esc)}.</b> ${AF3.rich(text, esc)}</p>`).join('')}
          ${d.outCap ? `<p class="reveal-in" data-show="${n + 2}">${AF3.rich(d.outCap, esc)}</p>` : ''}</div>`;

      const pills = [...frame.querySelectorAll('.g2-pill')], chips = [...frame.querySelectorAll('.g2-col:first-child .g2-chip')];
      const loop = frame.querySelector('.g2-loop'), list = frame.querySelector('.g2-pills'), machine = frame.querySelector('.g2-machine');
      const place = () => {   // the loop arrow runs along the right of the pills it repeats
        if (!loop) return;
        const a = pills[d.loop.from].getBoundingClientRect(), b = pills[d.loop.to].getBoundingClientRect(), m = machine.getBoundingClientRect(), l = list.getBoundingClientRect();
        const k = m.width / machine.offsetWidth || 1;   // the frame is scaled
        loop.style.top = `${(a.top + a.height / 2 - m.top) / k}px`;
        loop.style.height = `${(b.top + b.height / 2 - a.top - a.height / 2) / k}px`;
      };
      return {
        enter(step, animate) {
          Deck.show(frame, step, animate);
          const k = step - 1;   // the machine step that is lit: 1..n
          pills.forEach((p, i) => { p.className = `g2-pill${k - 1 === i ? ' on' : k - 1 > i && step < n + 2 ? ' done' : step >= n + 2 ? ' done' : ''}`; });
          // the inputs the lit step uses stay bright, the others dim; once the outputs are in, all are bright again
          const uses = k >= 1 && k <= n ? d.steps[k - 1][3] : null;
          chips.forEach((c, i) => c.classList.toggle('dim', Array.isArray(uses) && uses.length > 0 && !uses.includes(i)));
          if (loop) { place(); loop.classList.toggle('on', step >= d.loop.at + 1); }
        },
      };
    },
  };
};
}
