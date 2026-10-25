// Shared by the AF3 slide kinds (title, outline, generic, page): the converted pptx data and small helpers.
// Slide numbers (n) are the position in the final pptx, 1-based; the data is window.DATA.deck, written by
// tools/pptx_to_deck.py. A "kind" is a function (slideData, options) -> the def Deck.slide takes; plan.js
// registers one per slide, in order.
window.AF3 = {
  kinds: {},
  deck: window.DATA.deck,
  slide: (n) => window.DATA.deck.slides[n - 1],
  fig: (file) => `figures/${file}`,
  pct: (v) => `${(v * 100).toFixed(3)}%`,
  // all the text of a paragraph, no markup
  plain: (p) => p.runs.map((r) => r.t).join(''),
  texts: (s) => s.items.filter((i) => i.kind === 'text'),
  // the largest explicit font size (pt) in a text item, 0 when it inherits one from the layout
  maxSize: (t) => Math.max(0, ...t.paras.flatMap((p) => p.runs.map((r) => r.sz || 0))),
  // the pptx marks emphasis in red (c00000); the theme's accent takes its place
  isRed(hex) {
    if (!hex) return false;
    const v = parseInt(hex, 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255;
    return r > 150 && g < 90 && b < 90;
  },
  // One run of text as HTML: sub- and superscripts, links (links: the slide's rId -> url), bold, italics, the pptx's
  // red as the accent colour. A run that is only a line break becomes <br>. inTitle: small runs in a title (a
  // remark after the title proper) become .pp-sub.
  runHtml(r, esc, links = {}, inTitle = false) {
    if (r.br) return '<br>';
    let t = esc(r.t);
    if (r.sub) t = `<sub>${t}</sub>`;
    else if (r.sup) t = `<sup>${t}</sup>`;
    if (r.link) { const href = links[r.link]; t = href ? `<a class="pp-link" href="${esc(href)}">${t}</a>` : t; }
    if (r.b) t = `<b>${t}</b>`;
    if (r.i) t = `<i>${t}</i>`;
    if (AF3.isRed(r.c)) t = `<span class="deck-accent">${t}</span>`;
    if (inTitle && r.sz && r.sz <= 14) t = `<span class="pp-sub">${t}</span>`;
    return t;
  },
  paraHtml: (p, esc, links, inTitle) => p.runs.map((r) => AF3.runHtml(r, esc, links, inTitle)).join(''),
  // sub/superscripts must not stretch the line they sit in
  textCss: `.deck-frame sub, .deck-frame sup { line-height: 0; font-size: .72em; }`,
  // A small tag in the top right corner of a slide drawn from made-up data, so a toy never reads as a result.
  // (Sources are not on the slides: references.js lists them all on one slide.)
  tagCss: `.deck-tag { position: absolute; right: 4.2%; top: 1%; margin: 0; font-size: var(--t-micro); }`,
  tagHtml: (text, esc) => `<p class="deck-tag deck-detail">${esc(text)}</p>`,
  // A picture in a box (g: fractions of the frame), with the pptx's crop applied. Dark theme: a white card behind
  // it, since the pictures are drawn for a white page (see .pp-img in generic.js).
  picHtml(it, g) {
    const box = `left:${AF3.pct(g.x)};top:${AF3.pct(g.y)};width:${AF3.pct(g.w)};height:${AF3.pct(g.h)}`;
    const c = it.crop;
    if (!c) return `<div class="pp-img plain" style="${box}"><img src="${AF3.fig(it.file)}" alt=""></div>`;
    const kw = 1 - c.l - c.r, kh = 1 - c.t - c.b;  // the visible share of the picture, across and down
    return `<div class="pp-img" style="${box}"><img src="${AF3.fig(it.file)}" alt="" style="width:${AF3.pct(1 / kw)};`
      + `height:${AF3.pct(1 / kh)};left:${AF3.pct(-c.l / kw)};top:${AF3.pct(-c.t / kh)}"></div>`;
  },
  // CSS for pictures, shared by every kind that shows one
  picCss: `
    .pp-img { position: absolute; overflow: hidden; }
    .pp-img img { position: absolute; display: block; }
    .pp-img.plain img { width: 100%; height: 100%; }
    :root[data-theme="dark"] .pp-img { background: #fff; border-radius: .5em; }`,
  // ---- Math: every symbol, subscript, dimension and formula on a slide is set in KaTeX (vendor/katex, from disk), so it looks the
  // same everywhere ($z_{ij}$ in a caption, a label in a drawing, the equation slides). Words, numbers on their own and the names of
  // metrics (pLDDT, PAE, DockQ) stay plain text.
  //   AF3.tex(src, display)        KaTeX HTML for one formula, cached (inline sets .af3-tex so it matches the surrounding text)
  //   AF3.rich(str, esc)           HTML for a string with math between dollar signs: the rest is escaped with esc ("the $z_{ij}$ edge")
  //   AF3.svgMath(x, y, size, src, o)  a formula at (x, y) inside an SVG, centred on y; AF3.svgRich(...) the same for a string with $...$
  //       o: anchor 'middle' (default) | 'start' | 'end', op (opacity, nothing drawn below .01), muted, accent, color, bold, w (box width)
  //   AF3.foAttrs(x, y, size, o) + AF3.foInner(html, size, o): the same pieces apart, for a helper that builds its own element
  //       (conformer.js: reg('foreignObject', AF3.foAttrs(...), comp, a, b, AF3.foInner(...)))
  _tex: new Map(),
  tex(src, display = false) {
    const key = (display ? 'D' : 'I') + src;
    let h = AF3._tex.get(key);
    if (h === undefined) {
      h = katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', trust: true, output: 'html' });
      if (!display) h = `<span class="af3-tex">${h}</span>`;
      AF3._tex.set(key, h);
    }
    return h;
  },
  rich(str, esc) {
    return String(str).split('$').map((part, i, all) => (i % 2 === 1 && i < all.length - 1 ? AF3.tex(part) : esc(i % 2 === 1 ? '$' + part : part))).join('');
  },
  foAttrs(x, y, size, o = {}) {
    const w = o.w || 420, h = Math.ceil(size * 3), a = o.anchor || 'middle';
    const x0 = a === 'start' ? x : a === 'end' ? x - w : x - w / 2;
    return `x="${x0.toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w}" height="${h}" style="overflow:visible;pointer-events:none"`;
  },
  foInner(html, size, o = {}) {
    const a = o.anchor || 'middle', jc = a === 'start' ? 'flex-start' : a === 'end' ? 'flex-end' : 'center';
    const color = o.color || (o.muted ? 'var(--muted)' : o.accent ? 'var(--accent)' : 'var(--fg)');
    return `<div class="af3-m" style="font-size:${size}px;justify-content:${jc};color:${color}${o.bold ? ';font-weight:700' : ''}"><span>${html}</span></div>`;   // the span keeps the spaces next to a formula (flex items lose edge whitespace)
  },
  svgRich(x, y, size, str, o = {}) {
    const op = o.op === undefined ? 1 : o.op;
    if (op < 0.01) return '';
    return `<foreignObject ${AF3.foAttrs(x, y, size, o)} opacity="${op.toFixed(2)}">${AF3.foInner(AF3.rich(str, (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')), size, o)}</foreignObject>`;
  },
  svgMath(x, y, size, src, o = {}) {
    const op = o.op === undefined ? 1 : o.op;
    if (op < 0.01) return '';
    return `<foreignObject ${AF3.foAttrs(x, y, size, o)} opacity="${op.toFixed(2)}">${AF3.foInner(AF3.tex(o.bold ? `\\boldsymbol{${src}}` : src), size, o)}</foreignObject>`;
  },
  mathCss: `
    .af3-tex .katex, .af3-m .katex { font-size: 1.1em; }
    .af3-tex { white-space: nowrap; }   /* a formula in a caption never breaks across two lines */
    .af3-m { display: flex; align-items: center; height: 100%; white-space: nowrap; line-height: 1; font-family: Lato, "Helvetica Neue", Arial, sans-serif; }`,
};
document.head.append(Object.assign(document.createElement('style'), { textContent: AF3.mathCss }));
