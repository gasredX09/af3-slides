// The AF3 architecture as a native, themed diagram: one map, used three ways.
//
//   arch   slide 13: the whole map, walked through one click at a time (an overview, then each stage and block lit
//          with its caption). It replaces the picture of the paper's Fig. 1d and the repeats of that picture that
//          only moved the highlight.
//   focus  slides 23, 34, 36, 44: the map with one block lit, and the list that slide carried (its items appear one
//          per click). These repeats held content of their own, so they stay.
//   mini   a small "you are here" strip in the corner of the detail slides (AF3.arch.mini), lit at the blocks the
//          slide is about.
//
// The block layout follows Fig. 1d of Abramson et al. (Nature 2024): the input embedder, then the template module,
// MSA module and Pairformer (the trunk, with recycling), then the diffusion module, with the confidence module
// scoring its output; block counts are the paper's (Fig. 1d, Supplementary Algorithms 1, 8, 16, 17, 18, 31). Colours
// match the tensors table (template green, MSA orange, pair light blue, atom purple). Captions come from the deck's
// own text: the "at a glance" slides (15, 30, 43) and the captions printed under the repeated pictures.
{
// x, w in map units (the map is 1000 wide); stage 1 input preparation, 2 representation learning, 3 structure prediction
const MAIN = [
  { id: 'inputs', name: 'Inputs', label: ['Sequences,', 'ligands,', 'bonds'], x: 0, w: 100, stage: 1, color: null },
  { id: 'embed', name: 'Input embedder', label: ['Input', 'embedder'], sub: '3 blocks', x: 125, w: 120, stage: 1, color: 'c27bc9' },
  { id: 'tmpl', name: 'Template module', label: ['Template', 'module'], sub: '2 blocks', x: 270, w: 120, stage: 2, color: '3e9b7a' },
  { id: 'msa', name: 'MSA module', label: ['MSA', 'module'], sub: '4 blocks', x: 415, w: 110, stage: 2, color: 'f7b97c' },
  { id: 'pair', name: 'Pairformer', label: ['Pairformer'], sub: '48 blocks', x: 550, w: 140, stage: 2, color: 'a9d8f2' },
  { id: 'diff', name: 'Diffusion module', label: ['Diffusion', 'module'], sub: '3 + 24 + 3 blocks', x: 715, w: 150, stage: 3, color: '5f6368' },
  { id: 'out', name: '3D structure', label: ['3D', 'structure'], x: 890, w: 110, stage: 3, color: null },
];
// the side tier: what the input stage prepares for the trunk, and the module that scores the structure
const SIDE = [
  { id: 'conf3d', name: 'Conformer generation', label: ['Conformer', 'generation'], x: 125, w: 120, stage: 1, color: 'c27bc9', to: 'embed' },
  { id: 'tsearch', name: 'Template search', label: ['Template', 'search'], x: 270, w: 120, stage: 1, color: '3e9b7a', to: 'tmpl' },
  { id: 'gsearch', name: 'Genetic search', label: ['Genetic', 'search'], x: 415, w: 110, stage: 1, color: 'f7b97c', to: 'msa' },
  { id: 'conf', name: 'Confidence module', label: ['Confidence module'], sub: '4 blocks', x: 740, w: 200, stage: 3, color: 'c00000', to: 'out' },
];
const STAGES = [
  { n: 1, name: 'Input preparation', x1: 0, x2: 245 },
  { n: 2, name: 'Representation learning', x1: 270, x2: 690 },
  { n: 3, name: 'Structure prediction', x1: 715, x2: 1000 },
];
const ALL = [...MAIN, ...SIDE];
const NAME = Object.fromEntries(ALL.map((b) => [b.id, b.name]));

// the five steps of input preparation, as printed under the paper's figure in the original slides
const AGENDA = [
  'Tokenize input sequences',
  'Retrieve similar sequences and structures to create MSA and templates',
  'Create atom-level representation of sequences',
  'Update atom-level representation (Atom Transformer)',
  'Aggregate atom-level representation to token-level',
];

const MAIN_Y = 100, MAIN_H = 100, SIDE_Y = 255, SIDE_H = 60;
const cx = (b) => b.x + b.w / 2;

const boxSvg = (b, row) => {
  const y = row === 'main' ? MAIN_Y : SIDE_Y, h = row === 'main' ? MAIN_H : SIDE_H;
  const lines = b.label.length + (b.sub ? 1 : 0);
  const lh = row === 'main' ? 23 : 21, sh = 18;
  let ty = y + h / 2 - (b.label.length * lh + (b.sub ? sh : 0)) / 2 + lh * 0.78;
  let text = '';
  for (const l of b.label) { text += `<text x="${cx(b)}" y="${ty.toFixed(1)}" class="ar-t">${l}</text>`; ty += lh; }
  if (b.sub) text += `<text x="${cx(b)}" y="${(ty - lh * 0.78 + sh * 0.85).toFixed(1)}" class="ar-s">${b.sub}</text>`;
  const c = b.color ? `#${b.color}` : 'var(--muted)';
  return `<g class="ar-box${row === 'side' ? ' side' : ''}${b.w < 105 && row === 'main' ? ' small' : ''}" data-id="${b.id}" data-stage="${b.stage}" style="--c:${c}">
    <rect x="${b.x}" y="${y}" width="${b.w}" height="${h}" rx="14"/>${text}</g>`;
};

// Arrows: GAP is the room left between a box and the arrow's start or tip; the head's tip sits TIP past the end of the
// shaft (the marker's refX), so the shaft's blunt end is hidden inside the head and the head is not detached from it.
const GAP = 4, TIP = 2;
const arrow = (x1, y1, x2, y2) => {   // from (x1, y1) to a tip at (x2, y2)
  const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
  return `<path class="ar-arrow" d="M${x1} ${y1} L${(x2 - ux * TIP).toFixed(1)} ${(y2 - uy * TIP).toFixed(1)}" marker-end="url(#ar-head)"/>`;
};
const bezierLength = (p0, p1, p2, p3) => {
  let len = 0, prev = p0;
  for (let i = 1; i <= 48; i++) {
    const t = i / 48, u = 1 - t;
    const pt = [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
    len += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
    prev = pt;
  }
  return len;
};
// a dashed loop from p0 down onto a box top at `tip`; the dash length is fitted so the last dash ends exactly where
// the head starts, instead of leaving a gap between the line and its head
const loop = (p0, c1, c2, tip) => {
  const end = [tip[0], tip[1] - TIP], len = bezierLength(p0, c1, c2, end);
  const n = Math.max(1, Math.round((len - 7) / 12)), gap = (len - 7) / n - 7;
  return `<path d="M${p0} C${c1} ${c2} ${end}" style="stroke-dasharray:7 ${gap.toFixed(2)}" marker-end="url(#ar-head)"/>`;
};

// The full map. Arrows and the two loops are drawn once; which blocks are lit is set from outside (setLit).
function mapSvg() {
  const arrows = [], midY = MAIN_Y + MAIN_H / 2, below = MAIN_Y + MAIN_H + GAP;
  for (let i = 0; i < MAIN.length - 1; i++) {
    const a = MAIN[i], b = MAIN[i + 1];
    arrows.push(arrow(a.x + a.w + GAP, midY, b.x - GAP, midY));
  }
  for (const s of SIDE) {
    if (s.id === 'conf') {   // the diffusion module's output goes down to the confidence module, whose scores go up to the structure
      const out = MAIN.find((m) => m.id === s.to), x = (out.x + s.x + s.w) / 2;   // the middle of where the structure box sits over it
      arrows.push(arrow(cx(MAIN[5]), below, cx(MAIN[5]), SIDE_Y - GAP));
      arrows.push(arrow(x, SIDE_Y - GAP, x, below));
    } else {
      arrows.push(arrow(cx(s), SIDE_Y - GAP, cx(s), below));
    }
  }
  const pair = MAIN[4], tmpl = MAIN[2], diff = MAIN[5], top = MAIN_Y - GAP;
  const loops = `
    <g class="ar-loop" data-id="recycle">${loop([pair.x + pair.w - 40, top], [pair.x + pair.w - 40, 36], [cx(tmpl), 36], [cx(tmpl), top])}
      <text x="${(cx(tmpl) + pair.x + pair.w - 40) / 2}" y="34" class="ar-s">Recycling</text></g>
    <g class="ar-loop" data-id="iter">${loop([diff.x + 30, top], [diff.x + 30, 50], [diff.x + diff.w - 30, 50], [diff.x + diff.w - 30, top])}
      <text x="${cx(diff)}" y="46" class="ar-s">~200 steps</text></g>`;
  const brackets = STAGES.map((s) => `<g class="ar-stage" data-n="${s.n}">
    <path d="M${s.x1} 338 L${s.x1} 346 L${s.x2} 346 L${s.x2} 338"/>
    <text x="${(s.x1 + s.x2) / 2}" y="374" class="ar-st">${s.n} ${s.name}</text></g>`).join('');
  return `<svg viewBox="0 0 1000 384" role="img" aria-label="AlphaFold 3 architecture">
    <defs>${['ar-head', 'ar-head-on'].map((id) => `<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="8" refX="${9 - TIP}" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8z" class="ar-headp"/></marker>`).join('')}</defs>
    <text x="0" y="276" class="ar-note">prepared in</text><text x="0" y="294" class="ar-note">stage 1</text>
    ${loops}${arrows.join('')}${MAIN.map((b) => boxSvg(b, 'main')).join('')}${SIDE.map((b) => boxSvg(b, 'side')).join('')}${brackets}</svg>`;
}

const MAP_CSS = `
  .ar svg { display: block; width: 100%; height: auto; font-family: Lato, "Helvetica Neue", Arial, sans-serif; overflow: visible; }
  .ar .ar-box rect { fill: color-mix(in srgb, var(--c) 26%, var(--bg)); stroke: var(--c); stroke-width: 2;
    transition: opacity .4s, stroke-width .3s, fill .4s; }
  .ar .ar-box.side rect { stroke-dasharray: 7 5; }
  .ar .ar-t { fill: var(--fg); font-size: 20px; font-weight: 700; text-anchor: middle; }
  .ar .ar-box.small .ar-t { font-size: 17px; }
  .ar .ar-s { fill: var(--muted); font-size: 15px; text-anchor: middle; }
  .ar .ar-note { fill: var(--detail); font-size: 14px; font-style: italic; }
  .ar .ar-box { transition: opacity .4s; }
  .ar .ar-arrow, .ar .ar-loop path { fill: none; stroke: var(--muted); stroke-width: 2; transition: opacity .4s; }
  .ar .ar-headp { fill: var(--muted); }
  .ar #ar-head-on .ar-headp { fill: var(--accent); }
  .ar .ar-stage path { fill: none; stroke: var(--muted); stroke-width: 2; }
  .ar .ar-st { fill: var(--muted); font-size: 20px; font-weight: 600; text-anchor: middle; }
  .ar.lit .ar-box:not(.on), .ar.lit .ar-loop:not(.on), .ar.lit .ar-stage:not(.on) { opacity: .3; }
  .ar.lit .ar-arrow { opacity: .3; }
  .ar .ar-box.on rect { stroke: var(--accent); stroke-width: 5; fill: color-mix(in srgb, var(--c) 52%, var(--bg)); }
  .ar .ar-loop.on path { stroke: var(--accent); stroke-width: 3; marker-end: url(#ar-head-on); } .ar .ar-loop.on text { fill: var(--accent); }
  .ar .ar-stage.on path { stroke: var(--accent); stroke-width: 3; } .ar .ar-stage.on text { fill: var(--accent); }
  .ar .ar-box, .ar .ar-loop, .ar .ar-stage, .ar .ar-arrow { transition: opacity .4s; }
`;

// light up blocks (and the stage brackets of lit blocks, and the loops) by id; an empty list lights nothing
function setLit(root, lit) {
  const set = new Set(lit);
  root.classList.toggle('lit', set.size > 0);
  const stages = new Set(ALL.filter((b) => set.has(b.id)).map((b) => String(b.stage)));
  root.querySelectorAll('.ar-box').forEach((el) => el.classList.toggle('on', set.has(el.dataset.id)));
  root.querySelectorAll('.ar-loop').forEach((el) => el.classList.toggle('on', set.has(el.dataset.id)));
  root.querySelectorAll('.ar-stage').forEach((el) => el.classList.toggle('on', stages.has(el.dataset.n)));
}

// ---- the minimap: the same blocks, without text, in the corner of a detail slide ----
const MINI_LIT = {   // pptx slide number -> the blocks it is about
  17: ['embed'], 18: ['inputs', 'embed', 'tsearch', 'gsearch', 'conf3d'], 19: ['inputs'], 21: ['gsearch', 'msa'], 22: ['conf3d'],
  24: ['embed'], 26: ['embed'], 27: ['embed'], 28: ['embed'],
  33: ['tmpl'], 35: ['msa'], 37: ['pair'], 38: ['pair'], 39: ['pair'], 40: ['pair'], 41: ['pair'],
  45: ['diff'], 46: ['diff'], 47: ['diff'], 48: ['conf', 'out'],
  66: ['embed', 'tmpl', 'msa', 'pair', 'diff', 'conf'], 67: ['embed', 'diff'], 68: ['msa', 'pair', 'diff'], 69: ['msa'], 70: ['msa'], 71: ['pair'], 72: ['pair'], 73: ['diff'], 74: ['diff'],
};
// a slide that lights most of a stage names the stage under the strip, not every block (five names ran over the figure)
const MINI_LABEL = { 18: 'Input preparation', 66: 'The whole model', 68: 'Every Transition layer' };
const MINI_CSS = `
  .ar-mini { position: absolute; right: 4.2%; width: 24%; pointer-events: none; }
  .ar-mini svg { display: block; width: 100%; height: auto; overflow: visible; }
  .ar-mini .mb rect { fill: color-mix(in srgb, var(--c) 40%, var(--bg)); stroke: var(--c); stroke-width: 1.5; opacity: .3; }
  .ar-mini .mb.side rect { stroke-dasharray: 3 2; }
  .ar-mini .mb.on rect { opacity: 1; stroke: var(--accent); stroke-width: 3; fill: color-mix(in srgb, var(--c) 65%, var(--bg)); }
  .ar-mini .ma { stroke: var(--muted); stroke-width: 1.2; opacity: .35; fill: none; }
  .ar-mini .ml { margin: .25em 0 0; text-align: right; font-size: var(--t-micro); color: var(--muted); }
  .ar-mini .ml b { color: var(--accent); font-weight: 600; }
`;
function miniSvg(lit) {
  const k = 0.3, set = new Set(lit);
  const rect = (b, y, h, side) => `<g class="mb${side ? ' side' : ''}${set.has(b.id) ? ' on' : ''}" style="--c:${b.color ? '#' + b.color : 'var(--muted)'}">`
    + `<rect x="${(b.x * k).toFixed(1)}" y="${y}" width="${(b.w * k).toFixed(1)}" height="${h}" rx="3"/></g>`;
  const arrows = MAIN.slice(0, -1).map((b, i) => `<path class="ma" d="M${((b.x + b.w) * k + 0.5).toFixed(1)} 20 L${(MAIN[i + 1].x * k - 0.5).toFixed(1)} 20"/>`).join('');
  return `<svg viewBox="0 0 300 62">${arrows}${MAIN.map((b) => rect(b, 6, 28, false)).join('')}${SIDE.map((b) => rect(b, 42, 14, true)).join('')}</svg>`;
}
// markup for the corner minimap of slide n, or '' (titleChars: how long its heading is, to keep clear of it)
function mini(n, titleChars, topOverride) {
  const lit = MINI_LIT[n];
  if (!lit) return '';
  const top = topOverride !== undefined ? topOverride : titleChars > 38 ? 11 : 3.2;
  const names = MINI_LABEL[n] ? `<b>${MINI_LABEL[n]}</b>` : lit.map((id) => `<b>${NAME[id]}</b>`).join(' · ');
  return `<div class="ar-mini" style="top:${top}%">${miniSvg(lit)}<p class="ml">${names}</p></div>`;
}

// text helpers over the deck's own slides
const stripNumber = (p) => ({ ...p, runs: p.runs.map((r, i) => (i === 0 ? { ...r, t: r.t.replace(/^\d+\.\s*/, '') } : r)) });
const middleCard = (n) => AF3.texts(AF3.slide(n)).find((t) => t.g.x > 0.37 && t.g.x < 0.4 && t.paras.length > 2).paras;

window.AF3.arch = { mini, miniCss: MINI_CSS, MINI_LIT };

// ---- the walkthrough (slide 13) ----
AF3.kinds.arch = (s) => {
  const trunk = middleCard(30).map(stripNumber);   // template module, MSA module, Pairformer, recycling
  const struct = middleCard(43).map(stripNumber);  // condition, atom encoder, diffusion transformer, atom decoder, confidence
  const roadmap = AF3.texts(AF3.slide(14)).find((t) => t.ph === 'body').paras.map((p) => AF3.plain(p).trim());
  // [blocks lit, stage heading, what to show: the agenda with item i current, or lines of the deck's own text]
  const STEPS = [
    { lit: [], head: 'AlphaFold 3 in three stages', lines: roadmap, plain: true },
    { lit: ['inputs'], stage: 1, agenda: 0 },
    { lit: ['tsearch', 'gsearch'], stage: 1, agenda: 1 },
    { lit: ['conf3d', 'embed'], stage: 1, agenda: 2 },
    { lit: ['embed'], stage: 1, agenda: 3 },
    { lit: ['embed'], stage: 1, agenda: 4 },
    { lit: ['tmpl'], stage: 2, paras: [trunk[0]] },
    { lit: ['msa'], stage: 2, paras: [trunk[1]] },
    { lit: ['pair', 'recycle'], stage: 2, paras: [trunk[2], trunk[3]] },
    { lit: ['diff', 'iter'], stage: 3, paras: struct.slice(0, 4) },
    { lit: ['conf', 'out'], stage: 3, paras: [struct[4]] },
  ];
  return {
    steps: STEPS.length,
    notes: s.notes || '',
    mount(frame, { css, esc }) {
      css(MAP_CSS + AF3.textCss + `
        .ar-wrap { position: absolute; left: 10%; top: 14%; width: 80%; }
        .ar-cap { position: absolute; left: 4.2%; right: 4.2%; top: 71.5%; }
        .ar-cap h3 { margin: 0 0 .3em; font-size: var(--t-small); font-weight: 700; color: var(--accent); }
        .ar-cap .one { margin: 0; font-size: var(--t-lead); font-weight: 600; line-height: 1.25; }
        .ar-cap ol, .ar-cap ul { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(var(--cols, 1), 1fr);
          column-gap: 2.2em; font-size: var(--t-small); line-height: 1.3; }
        .ar-cap li { margin: 0 0 .25em; color: var(--muted); }
        .ar-cap li.cur { color: var(--fg); font-weight: 700; }
        .ar-cap li .n { color: var(--accent); font-weight: 700; margin-right: .5em; }
        .ar-cap.plainlines li { color: var(--fg); }
        .ar-cap > * { animation: ar-fade .35s ease-out; }
        @keyframes ar-fade { from { opacity: 0; } to { opacity: 1; } }
        .deck-frame.instant .ar-cap > * { animation: none; }
      `);
      frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(AF3.texts(s).find((t) => t.ph === 'title').paras[0]))}</h2>
        <div class="ar ar-wrap">${mapSvg()}</div><div class="ar-cap"></div>`;
      const root = frame.querySelector('.ar'), cap = frame.querySelector('.ar-cap');
      const para = (p) => AF3.paraHtml(p, esc, {});
      const render = (st) => {
        let html;
        if (st.agenda !== undefined) {   // input preparation: which of its five steps this is, and the step
          html = `<h3>Input preparation \u00b7 step ${st.agenda + 1} of ${AGENDA.length}</h3><p class="one">${esc(AGENDA[st.agenda])}</p>`;
        } else if (st.plain) {           // the overview: the three stages
          html = `<h3>${esc(st.head)}</h3><ul class="plainlines" style="--cols:3">${st.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
        } else {                         // a module of the trunk or the structure stage, in the deck's own words
          html = `<ul class="plainlines" style="--cols:${st.paras.length > 2 ? 2 : 1}">${st.paras.map((p) => `<li>${para(p)}</li>`).join('')}</ul>`;
        }
        cap.innerHTML = html;
      };
      return {
        enter(step, animate) {
          frame.classList.toggle('instant', !animate);
          const st = STEPS[step - 1];
          setLit(root, st.lit);
          render(st);
        },
      };
    },
  };
};

// ---- the roadmap of the Main idea section (slides 14, 29, 42): the map with the stage that is starting lit, and a card per stage ----
// The stage names are the slides' own text (the paragraph the pptx colours red is the stage starting); the line under each is the
// topic blurb plan.js gives the footer. Stages before the lit one are marked done, those after it wait. The stage lights up on
// arrival, from the one before it.
const STAGE_BLOCKS = {
  1: ['inputs', 'embed', 'conf3d', 'tsearch', 'gsearch'],
  2: ['tmpl', 'msa', 'pair', 'recycle'],
  3: ['diff', 'iter', 'conf', 'out'],
};
STAGE_BLOCKS[4] = [...STAGE_BLOCKS[1], ...STAGE_BLOCKS[2], ...STAGE_BLOCKS[3]];

// opts.stage: 1, 2 or 3 to start that stage (the default is the stage the slide's own text colours red); 4 for the recap that closes the section, every stage done and
// the map all lit (plan.js slide 102, kind `recap`). opts.heading replaces the section title.
AF3.kinds.roadmap = (s, opts = {}) => {
  const body = AF3.texts(s).find((t) => t.ph === 'body');
  const stage = opts.stage || body.paras.findIndex((p) => p.runs.some((r) => AF3.isRed(r.c))) + 1;   // 1, 2 or 3
  const names = body.paras.map((p) => AF3.plain(p).trim().replace(/^\d\)\s*/, ''));
  return {
    steps: 1,
    notes: s.notes || '',
    mount(frame, { css, esc }) {
      css(MAP_CSS + `
        .rm-map { position: absolute; left: 11%; top: 13.5%; width: 78%; }
        .rm .ar-st { display: none; }   /* the cards below name the stages */
        .rm-cards { position: absolute; left: 4.2%; right: 4.2%; top: 63.5%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.4%; align-items: stretch; }
        .rm-card { position: relative; box-sizing: border-box; padding: 1.1em 1.3em 1.2em; border-radius: 1.1em; font-size: var(--u);
          border: 2px solid color-mix(in srgb, var(--muted) 35%, transparent); background: color-mix(in srgb, var(--fg) 3%, transparent); }
        .rm-card.next { opacity: .5; }
        .rm-card.now { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, transparent); }
        .rm-card.done { border-color: color-mix(in srgb, var(--done) 55%, transparent); }
        .rm-head { display: flex; align-items: center; gap: .6em; margin-bottom: .45em; }
        .rm-num { flex: none; font-size: var(--t-display); font-weight: 700; line-height: 1; color: var(--accent); }
        .rm-card.done .rm-num { color: var(--done); }
        .rm-head h3 { margin: 0; font-size: var(--t-lead); font-weight: 700; line-height: 1.15; }
        .rm-card.done::after { content: '\u2713'; position: absolute; bottom: .3em; right: .75em; font-size: var(--t-heading); font-weight: 700; color: var(--done); }
        .rm-card p { margin: 0; font-size: var(--t-small); line-height: 1.3; color: var(--muted); }
        .rm-card.now p, .rm-recap .rm-card p { color: var(--fg); }
        .rm-recap .rm-card.done::after { font-size: var(--t-lead); bottom: .2em; right: .6em; }   /* smaller, so the tick clears the idea lines */
      `);
      const topics = Deck.topicsOf('3');
      frame.innerHTML = `<h2 class="deck-heading">${esc(opts.heading || 'Main idea/approach')}</h2>
        <div class="ar rm rm-map">${mapSvg()}</div>
        <div class="rm-cards${stage > 3 ? ' rm-recap' : ''}">${names.map((n, i) => `<div class="rm-card reveal-in ${i + 1 < stage ? 'done' : i + 1 === stage ? 'now' : 'next'}" data-from="1" style="transition-delay:${(i * 0.12).toFixed(2)}s">
          <div class="rm-head"><span class="rm-num">${i + 1}</span><h3>${esc(n)}</h3></div>${topics[i] && topics[i][2] ? `<p>${esc(topics[i][2])}</p>` : ''}</div>`).join('')}</div>`;
      const root = frame.querySelector('.ar');
      root.querySelector('svg').setAttribute('viewBox', '0 0 1000 352');   // without the stage labels there is nothing below the brackets
      return {
        enter(step, animate) {
          Deck.show(frame, step, animate);
          if (!animate) { setLit(root, STAGE_BLOCKS[stage]); return; }
          setLit(root, stage > 1 ? STAGE_BLOCKS[stage - 1] : []);      // from the stage before, so the light moves on
          requestAnimationFrame(() => requestAnimationFrame(() => setLit(root, STAGE_BLOCKS[stage])));
        },
      };
    },
  };
};

// ---- a repeat that carries its own list: the map with one block lit, the list one item per click ----
const FOCUS = {
  23: { small: true, lit: ['embed'], lead: `Input preparation, step 4 of 5: ${AGENDA[3]}`, head: 'AtomTransformer introduces building blocks used elsewhere',
    items: ['Adaptive LayerNorm', 'Attention with Pair Bias', 'Sequence-local atom attention', 'Conditioned Gating', 'Conditioned Transition blocks'] },
  34: { lit: ['msa'], items: ['Outer product mean', 'Row-wise gated attention using only pair bias'] },
  36: { lit: ['pair'], items: ['Triangle Updates', 'Triangle Attention', 'Attention with Pair Bias (token-level)'] },
  44: { lit: ['diff'], numbered: true,
    items: ['Prepare token-level conditioning tensors', 'Create atom-level conditioning tensors',
      'Token-level attention biased by conditioning tensors', 'Apply attention at atom-level to predict atom-level noise updates'] },
};

// the recap that closes the Main idea section: the same cards, every stage done, each with its idea (slide 102)
AF3.kinds.recap = (s) => AF3.kinds.roadmap(s, { stage: 4, heading: 'Main idea/approach: three stages, three ideas' });

AF3.kinds.focus = (s) => {
  const f = FOCUS[s.n], wide = !f.lead && !f.head && f.items.length <= 3;
  return {
    steps: 1 + f.items.length,
    notes: s.notes || '',
    mount(frame, { css, esc }) {
      css(MAP_CSS + `
        .fo-map { position: absolute; left: 13%; top: 13.5%; width: 74%; }
        .fo-side { position: absolute; left: 4.2%; right: 4.2%; top: 65.5%; display: grid; grid-template-columns: 1fr; column-gap: 4%; align-items: start; }
        .fo-side.two { grid-template-columns: 36% 1fr; }
        .fo-map.wide { left: 8%; width: 84%; } .fo-side.wide { top: 73%; }   /* a short list leaves room for a bigger map */
        .fo-lead { margin: 0 0 .7em; font-size: var(--t-caption); color: var(--muted); line-height: 1.3; }
        .fo-head { margin: 0; font-size: var(--t-small); font-weight: 700; color: var(--accent); line-height: 1.25; }
        .fo-list { margin: 0; padding: 0; list-style: none; font-size: var(--t-body); line-height: 1.25; }
        .fo-list li { margin-bottom: .45em; }
        .fo-list li .n { color: var(--accent); font-weight: 700; margin-right: .45em; }
        .fo-side.small .fo-list { font-size: var(--t-small); } .fo-side.small .fo-list li { margin-bottom: .3em; }
        .fo-list li.b::before { content: '\\2022'; color: var(--accent); margin-right: .5em; }
      `);
      const title = AF3.texts(s).find((t) => t.ph === 'title');
      frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
        <div class="ar fo-map${wide ? ' wide' : ''}">${mapSvg()}</div>
        <div class="fo-side${f.small ? ' small' : ''}${f.lead || f.head ? ' two' : ''}${wide ? ' wide' : ''}">
          ${f.lead || f.head ? `<div>${f.lead ? `<p class="fo-lead">${esc(f.lead)}</p>` : ''}${f.head ? `<p class="fo-head">${esc(f.head)}</p>` : ''}</div>` : ''}
          <ul class="fo-list">${f.items.map((it, i) => `<li class="${f.numbered ? '' : 'b'} reveal-in" data-from="${i + 2}">${f.numbered ? `<span class="n">${i + 1}.</span>` : ''}${esc(it)}</li>`).join('')}</ul>
        </div>`;
      const root = frame.querySelector('.ar');
      setLit(root, f.lit);
      return { enter(step, animate) { Deck.show(frame, step, animate); } };
    },
  };
};
}
