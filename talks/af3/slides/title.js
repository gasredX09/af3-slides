// The title slide: the paper's title as live text (the pptx has it as a screenshot of the Nature header), the
// course logo and the Nature wordmark from the pptx, the citation line and the presenters' names from its text.
// No section, so no footer.
AF3.kinds.title = (s) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.picCss + `
      .deck-frame .ti-title { top: 24%; }
      .deck-frame .ti-cite { top: 58%; font-size: var(--t-body); }
      .deck-frame .ti-by { top: 72%; }
    `);
    const pics = s.items.filter((i) => i.kind === 'pic');
    const logo = pics.find((p) => p.g.y < 0.05 && !p.crop);   // the course logo: at the top, uncropped
    const nature = pics.find((p) => p.crop);                  // the Nature wordmark: the cropped one
    // a picture at (x, y) of a given width, both as fractions of the frame, with the height its own aspect gives
    const sized = (p, x, y, w) => ({ x, y, w, h: w * (p.g.h * 9) / (p.g.w * 16) });
    const texts = AF3.texts(s);
    const cite = texts.find((t) => !t.ph);
    const names = texts.find((t) => t.ph === 'subTitle');
    frame.innerHTML = `
      ${logo ? AF3.picHtml(logo, sized(logo, 0.042, 0.035, 0.16)) : ''}
      ${nature ? AF3.picHtml(nature, sized(nature, 0.788, 0.045, 0.17)) : ''}
      <h1 class="deck-title ti-title">Accurate structure prediction of biomolecular interactions with AlphaFold&nbsp;3</h1>
      ${cite ? `<p class="deck-subtitle ti-cite">${cite.paras.map((p) => esc(AF3.plain(p))).join(' ')}</p>` : ''}
      ${names ? `<div class="deck-byline ti-by">${names.paras.map((p) => `<div>${esc(AF3.plain(p))}</div>`).join('')}</div>` : ''}`;
    return { enter() {} };
  },
});
