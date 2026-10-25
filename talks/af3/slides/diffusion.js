// "Why diffusion is a natural fit" (slide 10): the slide's three statements, each played on a toy point cloud.
//
// The cloud is a made-up 2D "complex" of 96 points (a protein helix, two DNA strands, a ligand ring), not an AF3
// prediction. Its noisy versions follow the forward process of the next slide, x_sigma = x_0 + sigma * eps, for ONE
// fixed eps per point (drawn once from a seeded generator, so the picture is the same every time), shown from high
// sigma down to 0, which is the direction a denoiser walks.
//
// Steps: 1 "models a distribution over 3D atomic structures": pure noise (sigma = 1) · 2 "operates directly on atomic
// coordinates across molecular types": the same noise, points coloured by molecule type · 3 "high-noise denoising
// learns global arrangement": sigma 1 -> 0.35 · 4 "low-noise denoising refines local geometry": sigma 0.35 -> 0, the
// bonds and base pairs appear.
//
// The noise slider is a real range input: drag it, click the bar or scroll over the picture to set sigma yourself
// (right = more noise). The bonds follow sigma, not the step (they show below about 0.45 and are full by 0.05), so
// the picture at any sigma is the picture the steps pass through. A click on a step puts sigma back where the step
// has it.
{
const SEED = 7;            // mulberry32 seed for the noise; logged here so the picture can be reproduced
const NOISE = 70;          // noise scale at sigma = 1, in map units (the structure spans about 385 x 230 of them)
const SIGMA = [1, 1, 0.35, 0];   // sigma shown at each step
const WHEEL = 0.0015;            // sigma per pixel of scroll
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bondsAt = (sigma) => 1 - smooth(0.05, 0.45, sigma);   // 0.16 at sigma = 0.35, 1 at 0

const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// the toy complex: points with a type and a chain, in map units
function complex() {
  const pts = [], chains = [];
  const add = (type, x, y, chain) => { pts.push({ type, x, y }); chains[chain].push(pts.length - 1); };
  chains.push([], [], [], []);   // 0 protein, 1 DNA strand A, 2 DNA strand B, 3 ligand ring
  for (let i = 0; i < 40; i++) add('protein', 40 + i * 6.4, 105 + 30 * Math.sin(i * 0.95), 0);
  for (let j = 0; j < 24; j++) add('dna', 60 + j * 8.6, 285 + 24 * Math.sin(j * 0.72), 1);
  for (let j = 0; j < 24; j++) add('dna', 60 + j * 8.6, 285 + 24 * Math.sin(j * 0.72 + Math.PI), 2);
  for (let k = 0; k < 6; k++) add('ligand', 385 + 19 * Math.cos(k * Math.PI / 3), 170 + 19 * Math.sin(k * Math.PI / 3), 3);
  add('ligand', 418, 160, 3); add('ligand', 418, 182, 3);   // two substituents
  return { pts, chains };
}

AF3.kinds.diffusion = (s) => ({
  steps: 4,
  notes: s.notes || '',
  interactive: true,   // the slider takes drags, so no swipe-to-navigate on touch screens
  mount(frame, { css, esc }) {
    css(AF3.tagCss + `
      .df-list { position: absolute; left: 4.2%; top: 22%; width: 42%; margin: 0; padding: 0; list-style: none; font-size: var(--t-lead); }
      .df-list li { position: relative; padding-left: 1.1em; margin-bottom: 1.1em; line-height: 1.3; }
      .df-list li::before { content: '\\2022'; position: absolute; left: .1em; }
      .df-map { position: absolute; left: 52%; top: 12%; width: 42%; }
      .df-map svg { display: block; width: 100%; height: auto; }
      .df-pt { fill: var(--detail); }
      .df-col.protein { fill: var(--plot-3); } .df-col.dna { fill: var(--plot-5); } .df-col.ligand { fill: var(--plot-2); }
      .df-line { fill: none; stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; }
      .df-line.protein { stroke: var(--plot-3); } .df-line.dna { stroke: var(--plot-5); } .df-line.ligand { stroke: var(--plot-2); }
      .df-line.rung { stroke: var(--plot-5); stroke-width: 1; }
      .df-sig { position: absolute; left: 52%; width: 42%; top: 77%; }
      .df-sig .lab { display: flex; justify-content: space-between; align-items: baseline; font-size: var(--t-small); }
      .df-sig .lab b { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--accent); }
      .df-sig input { display: block; box-sizing: border-box; width: 100%; height: 1.4em; margin: .15em 0 0; padding: 0; background: none;
        cursor: pointer; touch-action: none; -webkit-appearance: none; appearance: none; }
      .df-sig input:focus { outline: none; }
      .df-sig input::-webkit-slider-runnable-track { height: .7em; border-radius: .35em;
        background: linear-gradient(to right, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--muted) 45%, transparent)); }
      .df-sig input::-moz-range-track { height: .7em; border-radius: .35em;
        background: linear-gradient(to right, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--muted) 45%, transparent)); }
      .df-sig input::-webkit-slider-thumb { -webkit-appearance: none; width: .5em; height: 1.2em; margin-top: -.25em; border: 0; border-radius: .2em; background: var(--accent); }
      .df-sig input::-moz-range-thumb { width: .5em; height: 1.2em; border: 0; border-radius: .2em; background: var(--accent); }
      .df-sig input:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 .2em color-mix(in srgb, var(--accent) 35%, transparent); }
      .df-sig .what { margin: .35em 0 0; font-size: var(--t-small); font-weight: 600; min-height: 1.4em; }
      .df-key { position: absolute; left: 52%; width: 42%; top: 71.5%; display: flex; gap: 2em; justify-content: center; font-size: var(--t-caption); color: var(--muted); }
      .df-key i { display: inline-block; width: .9em; height: .9em; border-radius: 50%; margin-right: .45em; vertical-align: -.1em; }
    `);
    const texts = AF3.texts(s);
    const title = texts.find((t) => t.g.y < 0.1);
    const bullets = texts.find((t) => t.paras.length === 3);
    const { pts, chains } = complex();
    const rand = rng(SEED);
    const gauss = () => { const u = Math.max(rand(), 1e-9), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const eps = pts.map(() => [gauss(), gauss()]);   // one fixed noise draw per point
    const at = (i, sigma) => [pts[i].x + NOISE * sigma * eps[i][0], pts[i].y + NOISE * sigma * eps[i][1]];

    const circles = pts.map((p, i) => `<circle class="df-pt" data-i="${i}" r="4.2"/><circle class="df-col ${p.type}" data-i="${i}" r="4.2" opacity="0"/>`).join('');
    const lines = chains.map((c, k) => `<polyline class="df-line ${['protein', 'dna', 'dna', 'ligand'][k]}" data-chain="${k}" opacity="0"/>`).join('')
      + Array.from({ length: 8 }, (_, r) => `<line class="df-line rung" data-rung="${r * 3}" opacity="0"/>`).join('');
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <ul class="df-list">${bullets.paras.map((p, i) => `<li class="reveal-in" data-from="${i + 1}">${AF3.paraHtml(p, esc, {})}</li>`).join('')}</ul>
      <div class="df-map"><svg viewBox="-40 -30 560 440" role="img" aria-label="a toy point cloud being denoised">${lines}${circles}</svg></div>
      <div class="df-key reveal-in" data-from="2"><span><i style="background:var(--plot-3)"></i>protein</span><span><i style="background:var(--plot-5)"></i>nucleic acid</span><span><i style="background:var(--plot-2)"></i>ligand</span></div>
      <div class="df-sig"><div class="lab"><span>noise level σ</span><b></b></div>
        <input type="range" min="0" max="1" step="0.01" value="1" aria-label="noise level sigma"><p class="what"></p></div>
      ${AF3.tagHtml('illustration: made-up points, not an AF3 prediction', esc)}`;

    const svg = frame.querySelector('svg');
    const grey = [...svg.querySelectorAll('.df-pt')], col = [...svg.querySelectorAll('.df-col')];
    const polys = [...svg.querySelectorAll('polyline')], rungs = [...svg.querySelectorAll('.rung')];
    const readout = frame.querySelector('.df-sig b'), slider = frame.querySelector('.df-sig input'), what = frame.querySelector('.what');
    const WHAT = [
      'pure noise: a distribution over positions',
      'every atom is a 3D point, any molecule',
      'high noise: global arrangement',
      'low noise: local geometry',
    ];
    const whatAt = (sigma) => (sigma > 0.85 ? WHAT[0] : sigma > 0.2 ? WHAT[2] : WHAT[3]);   // the caption once sigma is set by hand

    // one frame of the picture: sigma, and how far the colours are in; the bonds follow sigma
    const draw = ({ sigma, color }) => {
      const bonds = bondsAt(sigma);
      pts.forEach((_, i) => {
        const [x, y] = at(i, sigma);
        grey[i].setAttribute('cx', x.toFixed(1)); grey[i].setAttribute('cy', y.toFixed(1));
        col[i].setAttribute('cx', x.toFixed(1)); col[i].setAttribute('cy', y.toFixed(1));
        col[i].setAttribute('opacity', color.toFixed(2));
      });
      polys.forEach((pl, k) => {
        pl.setAttribute('points', chains[k].map((i) => at(i, sigma).map((v) => v.toFixed(1)).join(',')).join(' '));
        pl.setAttribute('opacity', bonds.toFixed(2));
      });
      rungs.forEach((ln) => {   // base pairs: strand A point j to strand B point j
        const j = +ln.dataset.rung, a = at(chains[1][j], sigma), b = at(chains[2][j], sigma);
        ln.setAttribute('x1', a[0].toFixed(1)); ln.setAttribute('y1', a[1].toFixed(1));
        ln.setAttribute('x2', b[0].toFixed(1)); ln.setAttribute('y2', b[1].toFixed(1));
        ln.setAttribute('opacity', (bonds * 0.9).toFixed(2));
      });
      readout.textContent = sigma.toFixed(2);
      slider.value = sigma.toFixed(2);
    };
    const stateOf = (step) => ({ sigma: SIGMA[step - 1], color: step >= 2 ? 1 : 0 });
    let cur = stateOf(1), raf = 0, settle = null;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    // stop a running step (a hand on the slider, or the next click) and let whoever waits on it go on
    const stop = () => { cancelAnimationFrame(raf); if (settle) { settle(); settle = null; } };
    draw(cur);

    // sigma set by hand: drag the slider, click its bar, or scroll over the picture or the slider
    const setByHand = (sigma) => {
      stop();
      cur = { ...cur, sigma: Math.min(1, Math.max(0, sigma)) };
      draw(cur);
      what.textContent = whatAt(cur.sigma);
    };
    slider.addEventListener('input', () => setByHand(+slider.value));
    slider.addEventListener('pointerup', () => slider.blur());   // a focused slider would keep the arrow keys from turning the slide
    for (const el of [frame.querySelector('.df-map'), frame.querySelector('.df-sig')]) {
      el.addEventListener('wheel', (e) => {
        if (e.ctrlKey || !e.deltaY) return;
        e.preventDefault();
        setByHand(cur.sigma - e.deltaY * WHEEL);   // scroll up, more noise
      }, { passive: false });
    }

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        stop();
        what.textContent = WHAT[step - 1];
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const t0 = performance.now(), ms = 1500;
        return new Promise((done) => {
          settle = done;
          const tick = (now) => {
            const u = Math.min(1, (now - t0) / ms), e = ease(u);
            cur = { sigma: from.sigma + (to.sigma - from.sigma) * e, color: from.color + (to.color - from.color) * e };
            draw(cur);
            if (u < 1) raf = requestAnimationFrame(tick); else { settle = null; done(); }
          };
          raf = requestAnimationFrame(tick);
        });
      },
      leave() { stop(); },
      destroy() { stop(); },
    };
  },
});
}
