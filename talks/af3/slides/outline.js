// The talk's sections, the outline slides (one per section, that section lit) and the three-part roadmap of
// the Main idea section. The lists come from the pptx text: the lit row is the paragraph the pptx colours red.
//
// OUTLINE is the single list of sections: the outline slides show it and Deck.sections() puts it in the footer
// (FOOTER gives shorter names). Section 3 is dense, so it has topics, and its footer takes the whole bar while
// you are in it (Deck.expand). plan.js names the slides each topic covers.
const OUTLINE = [
  ['1', 'Problem definition and motivation'],
  ['2', 'Background'],
  ['3', 'Main idea/approach', [['3.1', 'Input preparation'], ['3.2', 'Representation learning'], ['3.3', 'Structure prediction']]],
  ['4', 'Experiments'],
  ['5', 'Analysis of cases'],
  ['6', 'Conclusions/Discussion/Future work'],
];
const FOOTER = { 1: 'Problem', 2: 'Background', 3: 'Main idea', 4: 'Experiments', 5: 'Cases', 6: 'Conclusions' };
Deck.sections(OUTLINE.map(([num, heading]) => [num, FOOTER[num] || heading]));

{
// one list slide: a heading, rows (number, text, sub-rows), one row lit and the rest dimmed
const listSlide = (s, { heading, rows, lit }) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(`
      .o-list { position: absolute; left: 6.5%; top: 20%; }
      .o-group { margin-bottom: 1.25em; }
      .o-group.dim { opacity: .3; }
      .o-row { display: flex; align-items: baseline; font-size: var(--t-lead); }
      .o-num { width: 1.45em; font-weight: 700; color: var(--accent); }
      .o-sub { display: flex; align-items: baseline; font-size: var(--t-small); color: var(--muted); margin: .2em 0 0 2em; }
      .o-sub .o-num { width: 2em; font-weight: 400; color: var(--muted); }
    `);
    frame.innerHTML = `<h2 class="deck-heading">${esc(heading)}</h2>
      <div class="o-list">${rows.map(([num, text, subs = []], i) => `
        <div class="o-group${i === lit ? '' : ' dim'}">
          <div class="o-row"><span class="o-num">${esc(num)}</span>${esc(text)}</div>
          ${i === lit ? subs.map(([n, h]) => `<div class="o-sub"><span class="o-num">${esc(n)}</span>${esc(h)}</div>`).join('') : ''}
        </div>`).join('')}</div>`;
    return { enter() {} };
  },
});

const litIndex = (body) => body.paras.findIndex((p) => p.runs.some((r) => AF3.isRed(r.c)));
const bodyOf = (s) => AF3.texts(s).find((t) => t.ph === 'body');

// the section outline: the six sections, the one this slide opens lit
AF3.kinds.outline = (s) => listSlide(s, {
  heading: 'Outline',
  rows: OUTLINE,
  lit: litIndex(bodyOf(s)),
});

// (the three-part roadmap of the Main idea section is in arch.js: it is drawn on the architecture map)
}
