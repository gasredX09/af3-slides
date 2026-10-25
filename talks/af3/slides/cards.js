// The "at a glance" slides (Input preparation, Representation learning, Structure prediction): a summary
// sentence, then three cards, Takes in, What it does, Outputs, joined by arrows. Each click brings in one card.
//
// The content is read from the pptx text by position: the three card headings sit on one row, everything below
// belongs to the card whose heading is above it; in the side cards a coloured chip (the tensor's letter) pairs
// with the text to its right, in the middle card the text is the numbered steps. Chip colours are the pptx's.
//
// Steps: 1 heading and summary · 2 Takes in · 3 What it does · 4 Outputs.
{
const luminance = (hex) => {
  const v = parseInt(hex, 16), c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => x / 255);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

AF3.kinds.glance = (s) => ({
  steps: 4,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + `
      .gl-intro { position: absolute; left: 4.2%; right: 4.2%; top: 15%; margin: 0; font-size: var(--t-body); line-height: 1.3; }
      .gl-cards { --k: 1; position: absolute; left: 4.2%; right: 4.2%; top: 32%; display: grid;
        grid-template-columns: 1fr 1.7em 1.15fr 1.7em 1fr; align-items: stretch; font-size: var(--u); }
      .gl-card { padding: 1.3em 1.4em; border-radius: 1.1em; box-sizing: border-box;
        border: 1.5px solid color-mix(in srgb, var(--muted) 35%, transparent);
        background: color-mix(in srgb, var(--fg) 3%, transparent); }
      .gl-card.mid { border-color: color-mix(in srgb, var(--accent) 55%, transparent);
        background: color-mix(in srgb, var(--accent) 7%, transparent); }
      .gl-card h3 { margin: 0 0 .9em; font-size: calc(var(--t-small) * var(--k)); font-weight: 700; color: var(--accent); }
      .gl-arrow { align-self: center; justify-self: center; font-size: calc(var(--t-lead) * var(--k)); color: var(--muted); }
      .gl-entry { display: flex; gap: .9em; align-items: flex-start; margin-bottom: 1em; }
      .gl-chip { flex: none; width: 3.1em; padding: .35em 0; border-radius: .5em; text-align: center; font-weight: 700;
        font-size: calc(var(--t-caption) * var(--k)); }
      .gl-chip.long { font-size: calc(var(--t-micro) * var(--k)); }
      .gl-t { font-size: calc(var(--t-small) * var(--k)); font-weight: 700; line-height: 1.25; }
      .gl-s { font-size: calc(var(--t-caption) * var(--k)); color: var(--muted); line-height: 1.3; margin-top: .15em; }
      .gl-step { font-size: calc(var(--t-small) * var(--k)); line-height: 1.3; margin: 0 0 .75em; }
    `);
    const texts = AF3.texts(s);
    const title = texts.slice().sort((a, b) => a.g.y - b.g.y)[0];
    const heads = texts.filter((t) => t !== title && !t.fill && t.g.y > 0.32 && t.g.y < 0.345).sort((a, b) => a.g.x - b.g.x);
    const intro = texts.find((t) => t !== title && t.g.y < 0.3 && t.g.w > 0.8);
    const body = texts.filter((t) => t !== title && t !== intro && !heads.includes(t));
    const colOf = (t) => { let c = 0; heads.forEach((h, i) => { if (t.g.x + 0.01 >= h.g.x) c = i; }); return c; };
    const para = (p) => AF3.paraHtml(p, esc, s.links);

    const cards = heads.map((h, i) => {
      const items = body.filter((t) => colOf(t) === i).sort((a, b) => a.g.y - b.g.y);
      const chips = items.filter((t) => t.fill);
      const rest = items.filter((t) => !t.fill);
      let inner;
      if (chips.length) {   // chip + the text to its right, paired by height
        inner = chips.map((c) => {
          const d = rest.reduce((best, t) => (Math.abs(t.g.y - c.g.y) < Math.abs(best.g.y - c.g.y) ? t : best));
          const label = AF3.plain(c.paras[0]);
          const dark = luminance(c.fill) < 0.5;
          return `<div class="gl-entry"><span class="gl-chip${label.length > 2 ? ' long' : ''}" style="background:#${c.fill};color:${dark ? '#fff' : '#1d2129'}">${esc(label)}</span>
            <div><div class="gl-t">${para(d.paras[0])}</div>${d.paras.slice(1).map((p) => `<div class="gl-s">${para(p)}</div>`).join('')}</div></div>`;
        }).join('');
      } else {              // the numbered steps
        inner = rest.flatMap((t) => t.paras).map((p) => `<p class="gl-step">${para(p)}</p>`).join('');
      }
      return `<div class="gl-card${chips.length ? '' : ' mid'} reveal-in" data-from="${i + 2}"><h3>${esc(AF3.plain(h.paras[0]))}</h3>${inner}</div>`;
    });
    const arrow = (from) => `<span class="gl-arrow reveal-in" data-from="${from}">→</span>`;

    frame.innerHTML = `<h2 class="deck-heading reveal-in in">${AF3.paraHtml(title.paras[0], esc, s.links)}</h2>
      <p class="gl-intro reveal-in in">${para(intro.paras[0])}</p>
      <div class="gl-cards">${cards[0]}${arrow(3)}${cards[1]}${arrow(4)}${cards[2]}</div>`;
    const grid = frame.querySelector('.gl-cards');
    const fit = () => {   // scale the cards down until they end above the footer
      const box = frame.getBoundingClientRect();
      if (!box.height) return;
      let k = 1;
      grid.style.setProperty('--k', 1);
      while (k > 0.55 && grid.getBoundingClientRect().bottom > box.top + box.height * 0.935) { k *= 0.95; grid.style.setProperty('--k', k.toFixed(3)); }
    };
    return {
      enter(step, animate) { Deck.show(frame, step, animate); requestAnimationFrame(fit); },
    };
  },
});
}
