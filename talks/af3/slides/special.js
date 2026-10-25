// Kinds for the few slides whose job is not "a heading and a figure": the section divider (Appendix), the closing
// slide (Thank you, Questions) and the For the Audience slide with the visualizer link and its QR code.
// Their text and pictures still come from the pptx data.
{
const fitPicture = (it, box) => {  // a picture placed by its own aspect ratio inside a box (fractions of the frame)
  const r = (it.g.w * 16) / (it.g.h * 9);
  let w = box.w, h = w * 16 / 9 / r;
  if (h > box.h) { h = box.h; w = h * 9 / 16 * r; }
  return { x: box.x + (box.w - w) / 2, y: box.y, w, h };
};

// a divider: the title alone, large and centred
AF3.kinds.divider = (s) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(`.deck-frame .dv-title { left: 0; width: 100%; top: 40%; text-align: center; color: var(--accent); }`);
    const t = AF3.texts(s).find((x) => x.ph === 'title');
    frame.innerHTML = `<h1 class="deck-title dv-title">${esc(AF3.plain(t.paras[0]))}</h1>`;
    return { enter() {} };
  },
});

// the closing slide: the title's lines, centred, with the picture below
AF3.kinds.closing = (s) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.picCss + `.deck-frame .cl-title { left: 0; width: 100%; top: 8%; text-align: center; color: var(--accent); }`);
    const t = AF3.texts(s).find((x) => x.ph === 'title');
    const pic = s.items.find((i) => i.kind === 'pic');
    frame.innerHTML = `<h1 class="deck-title cl-title">${t.paras.map((p) => esc(AF3.plain(p))).join('<br>')}</h1>`
      + (pic ? AF3.picHtml(pic, fitPicture(pic, { x: 0.3, y: 0.40, w: 0.4, h: 0.5 })) : '');
    return { enter() {} };
  },
});

// For the Audience: two statements (the link is live), the QR code beside them, the two memes in the corners
AF3.kinds.audience = (s) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.picCss + `
      .au-list { position: absolute; left: 6%; top: 20%; width: 56%; margin: 0; padding: 0; list-style: none; font-size: var(--t-lead); }
      .au-list li { position: relative; padding-left: 1.1em; margin-bottom: 1em; }
      .au-list li::before { content: '\\2022'; position: absolute; left: .1em; }
      .au-list a { color: var(--accent); }
    `);
    const title = AF3.texts(s).find((x) => x.ph === 'title');
    const body = AF3.texts(s).find((x) => !x.ph);
    const pics = s.items.filter((i) => i.kind === 'pic');
    const qr = pics.reduce((a, b) => (a.g.w * a.g.h > b.g.w * b.g.h ? b : a));   // the QR code is the pptx's middle one
    const run = (r) => {
      let t = esc(r.t);
      if (r.link) t = `<a href="${esc((s.links || {})[r.link] || '#')}">${t}</a>`;
      if (r.b) t = `<b>${t}</b>`;
      if (r.i) t = `<i>${t}</i>`;
      return t;
    };
    const memes = pics.filter((p) => p.g.y > 0.6);
    const qrPic = pics.find((p) => p.g.y > 0.3 && p.g.y < 0.4) || qr;
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <ul class="au-list">${body.paras.map((p) => `<li>${p.runs.map(run).join('')}</li>`).join('')}</ul>
      ${AF3.picHtml(qrPic, { x: 0.68, y: 0.2, w: 0.24, h: 0.24 * 16 / 9 * (qrPic.g.h * 9) / (qrPic.g.w * 16) })}
      ${memes.map((m) => AF3.picHtml(m, m.g)).join('')}`;
    return { enter() {} };
  },
});
}
