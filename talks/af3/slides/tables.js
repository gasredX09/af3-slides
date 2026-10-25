// Table slides (How was AF3 evaluated?, The tensors passed around AF3): the pptx has them as a grid of text
// boxes, read back here by position. Columns are the distinct x positions of the cells; rows are anchored on the
// leftmost column; a header row is whatever sits above the first row; text below 90% of the slide is a footnote.
// A coloured chip in the leftmost column (the tensors table) keeps the pptx's colour.
{
const luminance = (hex) => {
  const v = parseInt(hex, 16), c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => x / 255);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

AF3.kinds.table = (s, { small = false } = {}) => ({
  steps: 1,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + `
      .tb { --k: 1; position: absolute; left: 4.2%; right: 4.2%; top: 15.5%; font-size: var(--u); }
      .tb-row { display: grid; grid-template-columns: var(--cols); column-gap: 1.4em; align-items: start;
        padding: .55em 0; border-bottom: 1px solid color-mix(in srgb, var(--muted) 28%, transparent); }
      .tb-row.head { border-bottom-width: 2px; padding-bottom: .4em; }
      .tb-cell { font-size: calc(var(--t-small) * var(--k)); line-height: 1.28; }
      .tb.dense .tb-cell { font-size: calc(var(--t-caption) * var(--k)); }
      .tb-row.head .tb-cell { font-size: calc(var(--t-caption) * var(--k)); font-weight: 700; color: var(--muted); }
      .tb-cell.first { font-weight: 700; }
      .tb-cell.metric { color: var(--accent); font-weight: 600; }
      .tb-chip { display: inline-block; min-width: 2.6em; padding: .3em .2em; border-radius: .45em; text-align: center;
        font-weight: 700; font-size: .92em; }
      .tb-foot { margin: .9em 0 0; font-size: calc(var(--t-micro) * var(--k)); color: var(--detail); }
    `);
    const texts = AF3.texts(s);
    const title = texts.slice().sort((a, b) => a.g.y - b.g.y)[0];
    // a footnote sits at the very bottom, outside the grid (and would otherwise read as one more row)
    const foot = texts.filter((t) => t !== title && !t.fill && t.g.y > 0.9);
    const cells = texts.filter((t) => t !== title && !foot.includes(t));
    // the table's columns: x positions, merged when within 1% of each other
    const xs = [...new Set(cells.map((t) => t.g.x))].sort((a, b) => a - b).reduce((acc, x) => {
      if (!acc.length || x - acc[acc.length - 1] > 0.01) acc.push(x);
      return acc;
    }, []);
    const colOf = (t) => xs.reduce((best, x, i) => (Math.abs(t.g.x - x) < Math.abs(t.g.x - xs[best]) ? i : best), 0);
    const first = cells.filter((t) => colOf(t) === 0).sort((a, b) => a.g.y - b.g.y);
    // header: the cells above the first body row's anchor (the top-most cell row); the first column may have none
    const top = Math.min(...cells.map((t) => t.g.y));
    const headCells = cells.filter((t) => t.g.y < top + 0.02);
    const anchors = first.filter((t) => !headCells.includes(t));
    const body = cells.filter((t) => !headCells.includes(t));
    const rowsOf = body;
    const rowIdx = (t) => anchors.reduce((best, a, i) => (Math.abs(t.g.y - a.g.y) < Math.abs(t.g.y - anchors[best].g.y) ? i : best), 0);

    const widths = xs.map((x, i) => (i < xs.length - 1 ? xs[i + 1] - x : 0.96 - x));   // grid column widths from the pptx
    const cols = widths.map((w, i) => `${(w / widths.reduce((a, b) => a + b, 0)).toFixed(3)}fr`).join(' ');
    const lastCol = xs.length - 1;
    const cellHtml = (t, c, head) => {
      if (!t) return '<div class="tb-cell"></div>';
      if (t.fill) {
        const dark = luminance(t.fill) < 0.5;
        return `<div class="tb-cell"><span class="tb-chip" style="background:#${t.fill};color:${dark ? '#fff' : '#1d2129'}">${esc(AF3.plain(t.paras[0]))}</span></div>`;
      }
      const cls = c === 0 && !head ? ' first' : '';
      return `<div class="tb-cell${cls}">${t.paras.map((p) => AF3.paraHtml(p, esc, s.links)).join('<br>')}</div>`;
    };
    const row = (items, head) => `<div class="tb-row${head ? ' head' : ''}">${xs.map((_, c) => cellHtml(items.find((t) => colOf(t) === c), c, head)).join('')}</div>`;

    const rows = anchors.map((_, i) => row(rowsOf.filter((t) => rowIdx(t) === i), false));
    const hasHeader = headCells.some((t) => !t.fill);
    frame.innerHTML = `<h2 class="deck-heading">${AF3.paraHtml(title.paras[0], esc, s.links)}</h2>
      <div class="tb${small ? ' dense' : ''}" style="--cols:${cols}">${hasHeader ? row(headCells, true) : ''}${rows.join('')}
        ${foot.length ? `<p class="tb-foot">${foot.map((t) => t.paras.map((p) => AF3.paraHtml(p, esc, s.links)).join(' ')).join(' ')}</p>` : ''}</div>`;
    const box = frame.querySelector('.tb');
    const fit = () => {   // scale the text down until the table ends above the footer
      const f = frame.getBoundingClientRect();
      if (!f.height) return;
      let k = 1;
      box.style.setProperty('--k', 1);
      while (k > 0.5 && box.getBoundingClientRect().bottom > f.top + f.height * 0.935) { k *= 0.95; box.style.setProperty('--k', k.toFixed(3)); }
    };
    return { enter() { requestAnimationFrame(fit); } };
  },
});
}
