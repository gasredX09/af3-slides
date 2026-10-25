// "Why diffusion is a natural fit" (slide 10): the slide's three statements, each played on a toy point cloud.
//
// The cloud is a made-up 2D "complex" of about 120 points, not an AF3 prediction: ONE co-folded assembly, a protein chain that
// clamps over a DNA double helix like an arch, with a small ligand cradled in a dent on top of the arch. That is the point of
// co-folding: AF3 denoises the atoms of every molecule together, so how the parts fit is learned as one thing. Its noisy versions
// follow the forward process of the next slide, x_sigma = x_0 + sigma * eps, for ONE fixed eps per point (drawn once from a seeded
// generator, so the picture is the same every time), shown from high sigma down to 0, which is the direction a denoiser walks.
// (A noisy point that would leave the picture is folded back in at the edge, so the cloud stays in view; the fold is continuous in sigma.)
//
// Steps: 1 "models a distribution over 3D atomic structures": pure noise (sigma = 1) · 2 "operates directly on atomic
// coordinates across molecular types": the same noise, points coloured by molecule type · 3 "high-noise denoising
// learns global arrangement": sigma 1 -> 0.35, the contacts between the molecules start to show · 4 "low-noise denoising
// refines local geometry": sigma 0.35 -> 0, the bonds and base pairs appear.
//
// The noise slider is a real range input: drag it, click the bar or scroll over the picture to set sigma yourself
// (right = more noise). The contacts and the bonds follow sigma, not the step (contacts show below about 0.6 and are full by 0.1,
// bonds show below about 0.45 and are full by 0.05), so the picture at any sigma is the picture the steps pass through. A click
// on a step puts sigma back where the step has it. The sigma readout is set in KaTeX.
{
const SEED = 7;            // mulberry32 seed for the noise; logged here so the picture can be reproduced
const NOISE = 100;         // noise scale at sigma = 1, in map units (the structure spans about 450 x 290 of them)
const SIGMA = [1, 1, 0.35, 0];   // sigma shown at each step
const WHEEL = 0.0015;            // sigma per pixel of scroll
const BOX = { x0: -22, x1: 502, y0: 40, y1: 388 };   // where the points stay, inside the picture
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bondsAt = (sigma) => 1 - smooth(0.05, 0.45, sigma);      // 0.16 at sigma = 0.35, 1 at 0
const contactsAt = (sigma) => 1 - smooth(0.1, 0.6, sigma);     // 0.54 at sigma = 0.35, 1 at 0.1 and below
const fold = (v, lo, hi) => { const w = hi - lo; let u = (v - lo) % (2 * w); if (u < 0) u += 2 * w; return lo + (u > w ? 2 * w - u : u); };

const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// a smooth curve through waypoints (Catmull-Rom), cut into n points of equal spacing along it, each moved sideways by a small
// wave: the projection of a helix. Returns [x, y] pairs.
function trace(way, n, amp, period) {
  const dense = [];
  for (let i = 0; i < way.length - 1; i++) {
    const p0 = way[Math.max(0, i - 1)], p1 = way[i], p2 = way[i + 1], p3 = way[Math.min(way.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const u = k / 24, u2 = u * u, u3 = u2 * u;
      dense.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  dense.push(way[way.length - 1]);
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = (len[len.length - 1] * k) / (n - 1);
    let i = 1;
    while (i < len.length - 1 && len[i] < target) i++;
    const f = (target - len[i - 1]) / (len[i] - len[i - 1] || 1);
    const x = dense[i - 1][0] + (dense[i][0] - dense[i - 1][0]) * f, y = dense[i - 1][1] + (dense[i][1] - dense[i - 1][1]) * f;
    const tx = dense[i][0] - dense[i - 1][0], ty = dense[i][1] - dense[i - 1][1], tn = Math.hypot(tx, ty) || 1;
    const off = amp * Math.sin((2 * Math.PI * k) / period);
    out.push([x - (ty / tn) * off, y + (tx / tn) * off]);
  }
  return out;
}

// the toy complex: points with a type, in map units, the lines that join them, and the contacts between the molecules
function complex() {
  const pts = [], bonds = [];
  const add = (type, x, y) => { pts.push({ type, x, y }); return pts.length - 1; };
  // DNA: two strands, 28 points each, running along the bottom
  const dnaA = [], dnaB = [];
  for (let j = 0; j < 28; j++) dnaA.push(add('dna', 20 + (j * 450) / 27, 318 + 20 * Math.sin(j * 0.62)));
  for (let j = 0; j < 28; j++) dnaB.push(add('dna', 20 + (j * 450) / 27, 318 + 20 * Math.sin(j * 0.62 + Math.PI)));
  // protein: one chain, lying along the DNA at both ends, rising on each side, with a dent on top of the arch
  const WAY = [[20, 270], [95, 272], [135, 256], [160, 205], [172, 150], [195, 110], [232, 92], [250, 118], [270, 130], [290, 118], [308, 92],
    [345, 108], [368, 150], [380, 205], [405, 256], [440, 272], [470, 272]];
  const prot = trace(WAY, 64, 6, 3.7).map(([x, y]) => add('protein', x, y));
  // ligand: a six-ring in the dent, with two substituents pointing up and out
  const ring = [];
  for (let k = 0; k < 6; k++) ring.push(add('ligand', 270 + 18 * Math.cos((k * Math.PI) / 3), 92 + 18 * Math.sin((k * Math.PI) / 3)));
  const sub1 = add('ligand', 255, 58), sub2 = add('ligand', 285, 58);
  bonds.push({ cls: 'protein', idx: prot }, { cls: 'dna', idx: dnaA }, { cls: 'dna', idx: dnaB }, { cls: 'ligand', idx: [...ring, ring[0]] },
    { cls: 'ligand', idx: [ring[4], sub1] }, { cls: 'ligand', idx: [ring[5], sub2] });
  // base pairs: strand A point j to strand B point j, every third point (not where the strands cross)
  const rungs = [];
  for (let j = 1; j < 28; j += 3) rungs.push([dnaA[j], dnaB[j]]);
  // contacts, read off the clean complex: protein with DNA where they lie close (every second such point), ligand with its nearest protein point
  const d = (a, b) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
  const contacts = [];
  prot.forEach((i, n) => {
    if (n % 2) return;
    let best = -1;
    [...dnaA, ...dnaB].forEach((j) => { if (best < 0 || d(i, j) < d(i, best)) best = j; });
    if (d(i, best) < 36) contacts.push([i, best]);
  });
  ring.forEach((i) => {
    let best = -1;
    prot.forEach((j) => { if (best < 0 || d(i, j) < d(i, best)) best = j; });
    if (d(i, best) < 26) contacts.push([i, best]);
  });
  return { pts, bonds, rungs, contacts };
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
      .df-map { position: absolute; left: 52%; top: 11%; width: 42%; }
      .df-map svg { display: block; width: 100%; height: auto; }
      .df-pt { fill: var(--detail); }
      .df-col.protein { fill: var(--plot-3); } .df-col.dna { fill: var(--plot-5); } .df-col.ligand { fill: var(--plot-2); }
      .df-line { fill: none; stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; }
      .df-line.protein { stroke: var(--plot-3); } .df-line.dna { stroke: var(--plot-5); } .df-line.ligand { stroke: var(--plot-2); }
      .df-line.rung { stroke: var(--plot-5); stroke-width: 1; }
      .df-line.contact { stroke: var(--muted); stroke-width: 1.3; stroke-dasharray: 4 4; }
      .df-sig { position: absolute; left: 52%; width: 42%; top: 69%; }
      .df-sig .lab { display: flex; justify-content: space-between; align-items: baseline; font-size: var(--t-small); }
      .df-sig .lab b { font-weight: 400; color: var(--accent); }
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
      .df-key { position: absolute; left: 52%; width: 42%; top: 63.5%; display: flex; gap: 1.6em; justify-content: center; white-space: nowrap; font-size: var(--t-caption); color: var(--muted); }
      .df-key i { display: inline-block; width: .9em; height: .9em; border-radius: 50%; margin-right: .45em; vertical-align: -.1em; }
      .df-key i.dash { width: 1.4em; height: 0; border-radius: 0; border-top: 2px dashed var(--muted); vertical-align: .3em; }
      .df-sig .note { margin: .3em 0 0; font-size: var(--t-caption); line-height: 1.3; }
    `);
    const texts = AF3.texts(s);
    const title = texts.find((t) => t.g.y < 0.1);
    const bullets = texts.find((t) => t.paras.length === 3);
    const { pts, bonds, rungs, contacts } = complex();
    const rand = rng(SEED);
    const gauss = () => { const u = Math.max(rand(), 1e-9), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const eps = pts.map(() => [gauss(), gauss()]);   // one fixed noise draw per point
    const at = (i, sigma) => [fold(pts[i].x + NOISE * sigma * eps[i][0], BOX.x0, BOX.x1), fold(pts[i].y + NOISE * sigma * eps[i][1], BOX.y0, BOX.y1)];

    const circles = pts.map((p, i) => `<circle class="df-pt" data-i="${i}" r="4.2"/><circle class="df-col ${p.type}" data-i="${i}" r="4.2" opacity="0"/>`).join('');
    const lines = contacts.map((_, c) => `<line class="df-line contact" data-contact="${c}" opacity="0"/>`).join('')
      + rungs.map((_, r) => `<line class="df-line rung" data-rung="${r}" opacity="0"/>`).join('')
      + bonds.map((b, k) => `<polyline class="df-line ${b.cls}" data-bond="${k}" opacity="0"/>`).join('');
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <ul class="df-list">${bullets.paras.map((p, i) => `<li class="reveal-in" data-from="${i + 1}">${AF3.paraHtml(p, esc, {})}</li>`).join('')}</ul>
      <div class="df-map"><svg viewBox="-30 32 544 364" role="img" aria-label="a toy point cloud being denoised">${lines}${circles}</svg></div>
      <div class="df-key reveal-in" data-from="2"><span><i style="background:var(--plot-3)"></i>protein</span><span><i style="background:var(--plot-5)"></i>nucleic acid</span><span><i style="background:var(--plot-2)"></i>ligand</span><span class="reveal-in" data-from="3"><i class="dash"></i>contact</span></div>
      <div class="df-sig"><div class="lab"><span>noise level</span><b></b></div>
        <input type="range" min="0" max="1" step="0.01" value="1" aria-label="noise level sigma"><p class="what"></p>
        <p class="note deck-detail reveal-in" data-from="3">One model denoises all the molecules together, so how they fit is learned as one thing.</p></div>
      ${AF3.tagHtml('illustration: made-up points, not an AF3 prediction', esc)}`;

    const svg = frame.querySelector('svg');
    const grey = [...svg.querySelectorAll('.df-pt')], col = [...svg.querySelectorAll('.df-col')];
    const polys = [...svg.querySelectorAll('polyline')], rungEls = [...svg.querySelectorAll('.rung')], contactEls = [...svg.querySelectorAll('.contact')];
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
      const bondOp = bondsAt(sigma), contactOp = contactsAt(sigma);
      const P = pts.map((_, i) => at(i, sigma));
      pts.forEach((_, i) => {
        const [x, y] = P[i];
        grey[i].setAttribute('cx', x.toFixed(1)); grey[i].setAttribute('cy', y.toFixed(1));
        col[i].setAttribute('cx', x.toFixed(1)); col[i].setAttribute('cy', y.toFixed(1));
        col[i].setAttribute('opacity', color.toFixed(2));
      });
      polys.forEach((pl, k) => {
        pl.setAttribute('points', bonds[k].idx.map((i) => P[i].map((v) => v.toFixed(1)).join(',')).join(' '));
        pl.setAttribute('opacity', bondOp.toFixed(2));
      });
      rungEls.forEach((ln, r) => {   // base pairs: strand A point j to strand B point j
        const a = P[rungs[r][0]], b = P[rungs[r][1]];
        ln.setAttribute('x1', a[0].toFixed(1)); ln.setAttribute('y1', a[1].toFixed(1));
        ln.setAttribute('x2', b[0].toFixed(1)); ln.setAttribute('y2', b[1].toFixed(1));
        ln.setAttribute('opacity', (bondOp * 0.9).toFixed(2));
      });
      contactEls.forEach((ln, c) => {   // contacts between the molecules: they come in with the global arrangement
        const a = P[contacts[c][0]], b = P[contacts[c][1]];
        ln.setAttribute('x1', a[0].toFixed(1)); ln.setAttribute('y1', a[1].toFixed(1));
        ln.setAttribute('x2', b[0].toFixed(1)); ln.setAttribute('y2', b[1].toFixed(1));
        ln.setAttribute('opacity', (contactOp * 0.9).toFixed(2));
      });
      readout.innerHTML = AF3.tex(`\\sigma = ${sigma.toFixed(2)}`);
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
