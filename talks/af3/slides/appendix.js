// The appendix (slides 65-74 of the pptx): backup slides for questions, put in the order of the model, behind a menu.
//
//   AF3.kinds.appendix   the menu (it replaces the pptx's bare "Appendix" divider): nine cards, one per backup slide, each with the question it
//                        answers and the corner minimap of the architecture with the block it is about lit; a click on a card opens that slide
//   AF3.withBack(def)    wraps a kind so its slide carries a small "Appendix menu" link back to the menu
//   AF3.jump(name)       goes to a slide by its name ('s66' is slide 66 of the pptx), which is how a click on a card or the link finds it
//   AF3.apTitle(s)       the heading of an appendix slide: the pptx's own, except where the original was wrong (slide 74's said "Token -> atom ->
//                        token level aggregation" over the two pictures that prepare the atom-level conditioning, c and p)
//
// plan.js decides the order (APPENDIX there). The cards are links, which the deck's click-to-advance leaves alone (web/deck.js, CONTROLS).
{
const TITLES = { 74: 'Prepare atom-level conditioning tensors' };
AF3.apTitle = (s) => TITLES[s.n] || AF3.plain(AF3.texts(s).slice().sort((a, b) => a.g.y - b.g.y)[0].paras[0]);

AF3.jump = (name) => {
  const i = Reveal.getSlides().findIndex((el) => el.dataset.slide === name);
  if (i >= 0) Reveal.slide(i);
};

const BACK_CSS = `
  .ap-back { position: absolute; left: 4.2%; top: 94.2%; font: 600 var(--t-micro) / 1 Lato, "Helvetica Neue", Arial, sans-serif; color: var(--muted);
    text-decoration: none; cursor: pointer; padding: .35em .8em; border: 1.5px solid color-mix(in srgb, var(--muted) 45%, transparent); border-radius: 2em;
    background: var(--bg); z-index: 5; transition: color .2s, border-color .2s; }
  .ap-back:hover { color: var(--accent); border-color: var(--accent); }
`;
const backLink = (frame, css, text, to) => {
  css(BACK_CSS);
  const a = Object.assign(document.createElement('a'), { className: 'ap-back', textContent: text });
  a.addEventListener('click', (e) => { e.stopPropagation(); AF3.jump(to); });
  frame.append(a);
};
AF3.withBack = (def) => ({
  ...def,
  mount(frame, ctx) {
    const ctrl = def.mount(frame, ctx);
    backLink(frame, ctx.css, '← Appendix menu', 's65');
    return ctrl;
  },
});

// the cards, in the order of the model; `short` is the name on the card, `ask` the question the slide answers
const ITEMS = [
  { n: 66, tag: 'Reference', short: 'The tensors', ask: 'What are q, c, p, s, z, m, t, x and a, and how big is each?' },
  { n: 70, tag: 'MSA module', short: 'Outer Product Mean', ask: 'How does the MSA tell the pair map what changes together?' },
  { n: 69, tag: 'MSA module', short: 'Pair-Weighted Averaging', ask: 'How does the pair map talk back to the MSA?' },
  { n: 71, tag: 'Pair stack', short: 'Incoming Update', ask: 'How is the incoming triangle update different from the outgoing one?' },
  { n: 72, tag: 'Pair stack', short: 'Triangular Attention (Incoming)', ask: 'Which edges does the incoming attention look at?' },
  { n: 68, tag: 'Transition layers', short: 'ReLU vs SwiGLU', ask: 'What is a Transition layer, and what does its gate do?' },
  { n: 73, tag: 'Diffusion module', short: 'Token-level conditioning', ask: 'How does the diffusion module get the trunk output and the noise level?' },
  { n: 74, tag: 'Diffusion module', short: 'Atom-level conditioning', ask: 'How do token-level features reach single atoms?' },
  { n: 67, tag: 'Diffusion module', short: 'Conditioned Gating', ask: 'What does "conditioned" mean inside the diffusion blocks?' },
];

AF3.kinds.appendix = (s) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.arch.miniCss + `
      .ap-sub { position: absolute; left: 4.2%; right: 4.2%; top: 14%; margin: 0; font-size: var(--t-body); line-height: 1.25; color: var(--muted); }
      .ap-grid { position: absolute; left: 4.2%; right: 4.2%; top: 24%; display: grid; grid-template-columns: repeat(3, 1fr); gap: calc(1.1 * var(--u)); }
      .ap-card { position: relative; display: block; box-sizing: border-box; padding: calc(.9 * var(--u)) calc(1.2 * var(--u)); text-align: left; text-decoration: none; cursor: pointer;
        color: var(--fg); background: var(--bg); border: 1.5px solid color-mix(in srgb, var(--muted) 50%, transparent); border-radius: calc(.9 * var(--u));
        opacity: 0; transform: translateY(1em); transition: opacity .5s, transform .5s, border-color .2s, background .2s; transition-delay: calc(var(--i) * 70ms), calc(var(--i) * 70ms), 0s, 0s; }
      .ap-card.in { opacity: 1; transform: none; }
      .ap-card:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--bg)); transition-delay: 0s; }
      .ap-top { display: flex; align-items: center; justify-content: space-between; gap: .8em; min-height: calc(3 * var(--u)); }
      .ap-who { display: flex; align-items: center; gap: .6em; font-size: var(--t-micro); color: var(--muted); font-weight: 600; }
      .ap-n { display: inline-block; width: 1.7em; height: 1.7em; line-height: 1.7em; text-align: center; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; }
      .ap-mini { width: 44%; flex: none; }
      .ap-mini svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ap-mini .mb rect { fill: color-mix(in srgb, var(--c) 40%, var(--bg)); stroke: var(--c); stroke-width: 1.5; opacity: .3; }
      .ap-mini .mb.side rect { stroke-dasharray: 3 2; }
      .ap-mini .mb.on rect { opacity: 1; stroke: var(--accent); stroke-width: 3; fill: color-mix(in srgb, var(--c) 65%, var(--bg)); }
      .ap-mini .ma { stroke: var(--muted); stroke-width: 1.2; opacity: .35; fill: none; }
      .ap-t { display: block; margin-top: .3em; font-size: calc(1.75 * var(--u)); line-height: 1.15; }
      .ap-q { display: block; margin-top: .3em; font-size: calc(1.3 * var(--u)); line-height: 1.25; color: var(--muted); }
    `);
    const stripOf = (n) => (AF3.arch.mini(n, 0, 0).match(/<svg[\s\S]*<\/svg>/) || [''])[0];
    frame.innerHTML = `<h2 class="deck-heading">Appendix</h2>
      <p class="ap-sub">Backup slides for questions, in the order of the model. Click a card to open it.</p>
      <div class="ap-grid">${ITEMS.map((it, i) => `<a class="ap-card" data-to="s${it.n}" style="--i:${i}">
        <span class="ap-top"><span class="ap-who"><span class="ap-n">${i + 1}</span>${esc(it.tag)}</span><span class="ap-mini">${stripOf(it.n)}</span></span>
        <b class="ap-t">${esc(it.short)}</b><span class="ap-q">${esc(it.ask)}</span></a>`).join('')}</div>`;
    frame.querySelectorAll('.ap-card').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); AF3.jump(a.dataset.to); }));
    backLink(frame, css, '← Back to Questions', 's64');
    const cards = [...frame.querySelectorAll('.ap-card')];
    return {
      enter(step, animate) {
        if (!animate) { cards.forEach((c) => { c.style.transition = 'none'; c.classList.add('in'); }); void frame.offsetWidth; cards.forEach((c) => { c.style.transition = ''; }); return; }
        cards.forEach((c) => c.classList.remove('in'));
        void frame.offsetWidth;
        requestAnimationFrame(() => cards.forEach((c) => c.classList.add('in')));
        return new Promise((done) => setTimeout(done, 1100));
      },
      leave() { cards.forEach((c) => c.classList.remove('in')); },
    };
  },
});
}
