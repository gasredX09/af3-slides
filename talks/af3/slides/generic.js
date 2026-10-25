// The generic kind: a slide rebuilt natively from its pptx data, plus the page-image fallback.
//
//   generic  a heading (the deck's own, top left), bulleted text as a list, other text boxes where they sat,
//            pictures where they sat (crops applied). Text takes the deck's type scale, not the pptx's point sizes;
//            colours come from the theme, with the pptx's reds kept as accent. The credit line the pptx carried
//            along the bottom is not drawn: references.js lists the sources on one slide.
//   page     the slide as the original looked (figures/page-NN.jpg), for slides not rebuilt natively yet.
//
// A slide's geometry is fractions of the slide, so it is placed with percentages of the 16:9 frame. Anything that
// would run into the footer is shrunk, keeping its shape, to stay above it.
{
const TOP_LIMIT = 0.935;     // nothing below this: the section footer starts there

AF3.kinds.generic = (s) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.picCss + AF3.textCss + AF3.arch.miniCss + `
      .pp-body { position: absolute; margin: 0; padding: 0; list-style: none; --t: var(--t-lead); font-size: calc(var(--t) * var(--k, 1)); }
      .pp-body.c-body { --t: var(--t-body); } .pp-body.c-small { --t: var(--t-small); } .pp-body.c-caption { --t: var(--t-caption); }
      .pp-body li { position: relative; padding-left: 1.1em; margin-bottom: .45em; line-height: 1.25; }
      .pp-body li::before { content: '\\2022'; position: absolute; left: .1em; color: var(--fg); }
      .pp-body li.nobullet { padding-left: 0; } .pp-body li.nobullet::before { content: none; }
      .pp-text { position: absolute; margin: 0; }
      .pp-text { --t: var(--t-lead); font-size: calc(var(--t) * var(--k, 1)); }
      .pp-text.c-body { --t: var(--t-body); } .pp-text.c-small { --t: var(--t-small); }
      .pp-text.c-caption { --t: var(--t-caption); } .pp-text.c-micro { --t: var(--t-micro); }
      .pp-text .pp-line { display: block; }
      .pp-sub { font-size: .55em; font-weight: 400; color: var(--muted); margin-left: .4em; }
      .pp-arrow { position: absolute; height: 0; border-top: 2px solid var(--muted); }
      .pp-arrow::after { content: ''; position: absolute; right: -1px; top: -6px; border-left: 9px solid var(--muted);
        border-top: 5px solid transparent; border-bottom: 5px solid transparent; }
      .pp-link { color: var(--accent); }
    `);
    const { pct } = AF3;
    const texts = AF3.texts(s);
    const sizeClass = (pt) => (pt >= 20 ? 'c-lead' : pt >= 16 ? 'c-body' : pt >= 13 ? 'c-small' : pt >= 10 ? 'c-caption' : 'c-micro');

    const para = (p, inTitle) => AF3.paraHtml(p, esc, s.links, inTitle);

    // roles: the title, credit lines along the bottom (left out, see above), everything else
    let title = texts.find((t) => t.ph === 'title' || t.ph === 'ctrTitle');
    if (!title) title = texts.filter((t) => t.g && t.g.y < 0.2).sort((a, b) => a.g.y - b.g.y)[0];
    const rest = texts.filter((t) => t !== title);
    const credits = rest.filter((t) => t.g && t.g.y > 0.9 && AF3.maxSize(t) <= 12);
    const body = rest.filter((t) => !credits.includes(t));
    const limit = TOP_LIMIT;

    const fit = (g) => {  // shrink a box, keeping its shape and its centre, to end above the limit
      const k = Math.min(1, Math.max(0.05, (limit - g.y) / g.h));
      return k >= 1 ? g : { x: g.x + g.w * (1 - k) / 2, y: g.y, w: g.w * k, h: g.h * k };
    };

    let html = '';
    // a small picture at the top left (an icon beside the title) pushes the heading to its right; a figure that
    // merely starts near the top does not
    const corner = s.items.filter((i) => i.kind === 'pic' && i.g && i.g.y < 0.16 && i.g.x < 0.3 && i.g.w < 0.3 && i.g.h < 0.3);
    const headLeft = corner.length ? `style="left:${pct(Math.max(...corner.map((i) => i.g.x + i.g.w)) + 0.02)}"` : '';
    if (title) html += `<h2 class="deck-heading" ${headLeft}>${title.paras.map((p) => para(p, true)).join(' ')}</h2>`;
    for (const it of s.items) {
      if (it.kind === 'pic' && it.file && it.g) html += AF3.picHtml(it, fit(it.g));
      else if (it.kind === 'line' && it.g && it.g.h < 0.01) {
        html += `<div class="pp-arrow" style="left:${pct(it.g.x)};top:${pct(it.g.y)};width:${pct(it.g.w)}"></div>`;
      }
    }
    for (const t of body) {
      if (!t.g) continue;
      const listy = t.ph === 'body' || t.paras.some((p) => p.bullet === 'char' || p.bullet === 'num');
      if (listy) {
        const cls = t.ph === 'body' ? '' : ` ${sizeClass(AF3.maxSize(t) || 24)}`;
        html += `<ul class="pp-body${cls}" style="left:${pct(t.g.x)};top:${pct(t.g.y)};width:${pct(t.g.w)}">${
          t.paras.map((p) => `<li${p.bullet === 'none' ? ' class="nobullet"' : ''}>${para(p)}</li>`).join('')}</ul>`;
      } else {
        const pt = AF3.maxSize(t) || 24;
        const algn = t.paras[0].algn === 'ctr' ? 'center' : t.paras[0].algn === 'r' ? 'right' : 'left';
        html += `<p class="pp-text ${sizeClass(pt)}" style="left:${pct(t.g.x)};top:${pct(t.g.y)};width:${pct(t.g.w)};text-align:${algn}">${
          t.paras.map((p) => `<span class="pp-line">${para(p)}</span>`).join('')}</p>`;
      }
    }
    // detail slides of the architecture get a "you are here" strip in the corner (arch.js)
    html += AF3.arch.mini(s.n, title ? title.paras.map((p) => AF3.plain(p)).join(' ').length : 0);
    frame.innerHTML = html;
    // Text is set in the deck's type scale, but a long list can still run into the footer: once the slide is on
    // screen, scale each such block down (--k) until it ends above the limit.
    const fitText = () => {
      const box = frame.getBoundingClientRect();
      if (!box.height) return;
      const floor = box.top + box.height * limit;
      const groups = new Map();   // blocks of one size class shrink together, so a slide's text stays in proportion
      for (const el of frame.querySelectorAll('.pp-body, .pp-text')) {
        let k = 1;
        el.style.removeProperty('--k');
        while (k > 0.5 && el.getBoundingClientRect().bottom > floor) { k *= 0.94; el.style.setProperty('--k', k.toFixed(3)); }
        const key = el.className.replace(/pp-(body|text)\s*/, '');
        groups.set(key, Math.min(groups.get(key) || 1, k));
      }
      for (const el of frame.querySelectorAll('.pp-body, .pp-text')) {
        el.style.setProperty('--k', groups.get(el.className.replace(/pp-(body|text)\s*/, '')).toFixed(3));
      }
    };
    return { enter() { requestAnimationFrame(fitText); } };
  },
});

AF3.kinds.page = (s) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { css }) {
    css(`.pp-page { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
      .pp-badge { position: absolute; right: 4.2%; top: 1.2%; margin: 0; font-size: var(--t-micro); }`);
    const nn = String(s.n).padStart(2, '0');
    frame.innerHTML = `<img class="pp-page" src="figures/page-${nn}.jpg" alt="slide ${s.n}, as in the original deck">
      <p class="pp-badge deck-detail">original slide, not rebuilt yet</p>`;
    return { enter() {} };
  },
});
}
