// The title slide: the paper's title as live text (the pptx has it as a screenshot of the Nature header), the
// Carnegie Mellon wordmark (assets/: the official stacked wordmark from cmu.edu, transparent, one file for each theme), the Nature
// wordmark from the pptx (not in the published copy), the citation line and the presenters' names from its text. The course logo of the
// pptx is no longer drawn.
// A quiet row of the keys at the bottom (the published copy has no readme in front of it). No section, so no footer.
AF3.kinds.title = (s) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { theme, css, esc }) {
    css(AF3.picCss + `
      .deck-frame .ti-title { top: 24%; }
      .deck-frame .ti-cmu { position: absolute; left: 4.2%; top: 4.2%; width: 11.5%; height: auto; }
      :root[data-theme="dark"] .ti-cmu.ink, :root:not([data-theme="dark"]) .ti-cmu.white { display: none; }
      .deck-frame .ti-cite { top: 58%; font-size: var(--t-body); }
      .deck-frame .ti-by { top: 72%; }
      .deck-frame .ti-keys { position: absolute; left: 8%; right: 4.2%; top: 86%; margin: 0; display: flex; flex-wrap: wrap; gap: .4em 1.3em; font-size: var(--t-caption); }
      .deck-frame .ti-keys kbd { margin-right: .45em; }
    `);
    const KEYS = [['→', 'next (or click)'], ['←', 'back'], ['F', 'full screen'], ['L', 'laser'], ['O', 'overview'], ['T', theme === 'dark' ? 'light mode' : 'dark mode']];
    const pics = s.items.filter((i) => i.kind === 'pic');
    const nature = pics.find((p) => p.crop);                  // the Nature wordmark: the cropped one
    // a picture at (x, y) of a given width, both as fractions of the frame, with the height its own aspect gives
    const sized = (p, x, y, w) => ({ x, y, w, h: w * (p.g.h * 9) / (p.g.w * 16) });
    const texts = AF3.texts(s);
    const cite = texts.find((t) => !t.ph);
    const names = texts.find((t) => t.ph === 'subTitle');
    frame.innerHTML = `
      <img class="ti-cmu ink" src="assets/cmu-wordmark-ink.png" alt="Carnegie Mellon University"><img class="ti-cmu white" src="assets/cmu-wordmark-white.png" alt="">
      ${nature ? AF3.picHtml(nature, sized(nature, 0.788, 0.045, 0.17)) : ''}
      <h1 class="deck-title ti-title">Accurate structure prediction of biomolecular interactions with AlphaFold&nbsp;3</h1>
      ${cite ? `<p class="deck-subtitle ti-cite">${cite.paras.map((p) => esc(AF3.plain(p))).join(' ')}</p>` : ''}
      ${names ? `<div class="deck-byline ti-by">${names.paras.map((p) => `<div>${esc(AF3.plain(p))}</div>`).join('')}</div>` : ''}
      <p class="ti-keys deck-detail">${KEYS.map(([k, what]) => `<span><kbd>${esc(k)}</kbd>${esc(what)}</span>`).join('')}</p>`;
    return { enter() {} };
  },
});
