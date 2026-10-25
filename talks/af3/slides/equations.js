// "Background: Diffusion" (slide 11): the two equations of the original slide (pictures there), rendered as live
// math with KaTeX (vendor/katex, fetched by setup.sh, nothing from a CDN) and explained a click at a time, each part
// in its own colour. The equations are the slide's own: the forward process x_sigma = x_0 + sigma * eps, and the
// reverse-time SDE dx = -g(t)^2 grad_x log p_t(x | s, z) dt + g(t) dW_t.
//
// What the explanations rest on (checked against the sources, not added from memory):
//  - The forward process adds Gaussian noise of standard deviation sigma to the data, and the score
//    grad_x log p(x; sigma) "points towards higher density of data at a given noise level" (Karras et al. 2022, EDM,
//    Sec. 2). EDM is what AF3's diffusion training "largely follows" (Abramson et al., Suppl. 3.7.1, ref. [29]).
//  - The score comes from the denoiser: grad_x log p(x; sigma) = (D(x; sigma) - x) / sigma^2, for the ideal denoiser
//    D (EDM Eq. 2-3).
//  - AF3 draws the training noise level as sigma_data * exp(-1.2 + 1.5 N(0, 1)) with sigma_data = 16 (Suppl. 3.7.1),
//    conditions the denoiser on the trunk's single and pair representations (Suppl. Alg. 20), and samples with 200
//    denoising steps (Suppl. Eq. 7 and Alg. 18).
//
// Steps: 1 the forward equation · 2 its three parts, coloured and named · 3 the reverse equation · 4 its parts, coloured
// and named · 5 where the score comes from: the denoiser, and what AF3 runs (the reverse explanation makes room).
{
AF3.kinds.equations = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(`
      .eq-intro { position: absolute; left: 4.2%; right: 4.2%; top: 14.5%; margin: 0; font-size: var(--t-lead); }
      .eq-row { position: absolute; left: 4.2%; right: 4.2%; }
      .eq-tag { margin: 0 0 .15em; font-size: var(--t-small); font-weight: 700; color: var(--accent); }
      .eq-tag span { font-weight: 400; color: var(--muted); margin-left: .5em; }
      .eq-math { font-size: calc(var(--t-heading) * 1.1); line-height: 1.35; }
      .eq-math.rev { font-size: calc(var(--t-heading) * 1.04); }
      .eq-math .katex { font-size: 1em; }
      /* display mode never wraps; keep it left-aligned and flush */
      .eq-math .katex-display, .eq-bridge .math .katex-display { margin: 0; text-align: left; }
      .eq-math .katex-display > .katex, .eq-bridge .math .katex-display > .katex { text-align: left; }
      .eq-legend { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 1.8em; margin-top: .35em; }
      .eq-legend > div { font-size: var(--t-caption); line-height: 1.3; color: var(--muted); padding-left: .7em; border-left: .3em solid var(--c); }
      .eq-legend > div b { display: block; color: var(--fg); font-size: var(--t-small); font-weight: 700; margin-bottom: .1em; }
      .eq-legend .sub { display: block; margin-top: .15em; color: var(--detail); }
      /* parts of the equations: neutral until their step, then in their colour */
      .eq-math .k { transition: color .5s; }
      .st-2 .eq-fwd .ka { color: var(--plot-3); } .st-2 .eq-fwd .kb { color: var(--plot-5); } .st-2 .eq-fwd .kc { color: var(--plot-4); }
      .st-4 .eq-rev .ks { color: var(--plot-3); } .st-4 .eq-rev .kt { color: var(--plot-2); } .st-4 .eq-rev .kn { color: var(--plot-5); }
      .eq-bridge { position: absolute; left: 4.2%; right: 4.2%; top: 56%; display: grid; grid-template-columns: 1fr auto; gap: .4em 2.4em; align-items: center; }
      .eq-bridge p { margin: 0; font-size: var(--t-body); line-height: 1.3; }
      .eq-bridge p b { color: var(--fg); }
      .eq-bridge .af3 { grid-column: 1 / -1; font-size: var(--t-small); color: var(--muted); margin-top: .6em; }
      .eq-bridge .af3 b { color: var(--accent); }
      .eq-bridge .math { font-size: calc(var(--t-lead) * 1.05); }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const intro = AF3.texts(s).find((t) => t.ph === 'body');
    const fwd = String.raw`\htmlClass{k kc}{x_\sigma} \;=\; \htmlClass{k ka}{x_0} \;+\; \htmlClass{k kb}{\sigma\,\epsilon}`;
    const rev = String.raw`dx \;=\; \htmlClass{k kt}{-g(t)^{2}}\,\htmlClass{k ks}{\nabla_x \log p_t(x \mid s, z)}\,\htmlClass{k kt}{dt} \;+\; \htmlClass{k kn}{g(t)\,d\bar{W}_t}`;
    const bridge = String.raw`\nabla_x \log p(x;\sigma) \;=\; \dfrac{D(x;\sigma) - x}{\sigma^{2}}`;
    const tex = (src, opts = {}) => katex.renderToString(src, { displayMode: false, throwOnError: true, trust: true, strict: 'ignore', ...opts });
    const leg = (color, head, body, sub) => `<div style="--c:var(${color})"><b>${head}</b>${body}${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
    const m = (src) => tex(src);

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <p class="eq-intro">${AF3.paraHtml(intro.paras[0], esc, {})}</p>

      <div class="eq-row eq-fwd" style="top:21%">
        <p class="eq-tag">Forward<span>add noise to a real structure</span></p>
        <div class="eq-math">${tex(fwd, { displayMode: true })}</div>
        <div class="eq-legend reveal-in" data-show="2">
          ${leg('--plot-4', `${m('x_\\sigma')}`, 'the noisy structure: what the network is shown')}
          ${leg('--plot-3', `${m('x_0')}`, 'the real structure: x, y, z (in Å) of every heavy atom')}
          ${leg('--plot-5', `${m('\\sigma\\,\\epsilon')}`, 'random Gaussian noise; σ sets how loud it is',
            `AF3 draws σ at random in training: 16 Å · exp(−1.2 + 1.5 N(0,1))`)}
        </div>
      </div>

      <div class="eq-row eq-rev reveal-in" data-from="3" style="top:38%">
        <p class="eq-tag">Reverse<span>turn noise back into a structure, one small step at a time</span></p>
        <div class="eq-math rev">${tex(rev, { displayMode: true })}</div>
        <div class="eq-legend reveal-in" data-show="4">
          ${leg('--plot-3', `the score ${m('\\nabla_x \\log p_t(x \\mid s, z)')}`, 'the direction that makes the structure more likely, given what the trunk worked out (s, z)')}
          ${leg('--plot-2', `the step ${m('-g(t)^{2}\\,dt')}`, 'a small move in that direction: dt is a small slice of time')}
          ${leg('--plot-5', `the kick ${m('g(t)\\,d\\bar{W}_t')}`, 'a small random push, so repeated runs give different structures')}
        </div>
      </div>

      <div class="eq-bridge reveal-in" data-from="5">
        <p><b>Where the score comes from:</b> a network trained to remove the noise. For an ideal denoiser <i>D</i>, the score is how far it moves the structure, divided by the noise level squared.</p>
        <div class="math">${tex(bridge, { displayMode: true })}</div>
        <p class="af3"><b>In AF3</b> the denoiser predicts clean atom coordinates, conditioned on the trunk\u2019s s and z, and sampling takes 200 such steps from pure noise.</p>
      </div>`;

    return {
      enter(step, animate) {
        frame.classList.toggle('instant', !animate);
        for (let k = 1; k <= 5; k++) frame.classList.toggle(`st-${k}`, k <= step);
        Deck.show(frame, step, animate);
      },
    };
  },
});
}
