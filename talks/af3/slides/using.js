// "Using AF3 yourself": the three ways in, one per click, for the question the audience will ask. Everything is from two sources, read for this slide, not from memory:
//  - the paper, "Code availability": "AlphaFold 3 will be available as a non-commercial usage only server at alphafoldserver.com, with restrictions on allowed ligands
//    and covalent modifications ... Code is not provided."
//  - the code repository google-deepmind/alphafold3 (pinned in codebases/, README, LICENSE, WEIGHTS_TERMS_OF_USE.md): the server "for non-commercial use, though with a more
//    limited set of ligands and covalent modifications"; the source code under the Apache License 2.0; the model parameters only from Google, by a request form, "at Google
//    DeepMind's sole discretion", under terms that allow them only for non-commercial use by or on behalf of non-commercial organizations (universities, non-profit
//    organizations and research institutes, educational, journalism and government bodies); and "Any publication that discloses findings arising from using this source code,
//    the model parameters or outputs ... should cite" the paper.
{
const ROWS = [
  ['AlphaFold Server', 'A web server for non-commercial use, with a more limited set of ligands and covalent modifications.'],
  ['Source code', 'The paper says code is not provided. The GitHub repository google-deepmind/alphafold3 has the inference pipeline, under the Apache 2.0 licence.'],
  ['Model parameters', 'Not in the repository. Request them from Google DeepMind: access is at their discretion, for non-commercial use by universities, non-profits and other non-commercial organisations.'],
];
const nb = (html) => html.replace(/google-deepmind\/alphafold3|non-commercial|non-profits/g, (m) => `<span class="nb">${m}</span>`);   // no line break inside these
AF3.kinds.using = () => ({
  steps: 3,
  notes: '',
  mount(frame, { css, esc }) {
    css(`
      .us-row { position: absolute; left: 6%; right: 6%; height: 17%; display: grid; grid-template-columns: 22% 1fr; gap: 1.4em; align-items: center; padding: 0 1.2em;
        border-radius: 14px; border: 1.5px solid color-mix(in srgb, var(--muted) 45%, transparent); background: color-mix(in srgb, var(--fg) 3%, transparent); }
      .us-row b { font-size: var(--t-lead); color: var(--accent); }
      .us-row span { font-size: var(--t-small); line-height: 1.35; }
      .us-row .nb { white-space: nowrap; }
      .us-note { position: absolute; left: 6%; right: 6%; top: 87%; margin: 0; font-size: var(--t-small); }
    `);
    frame.innerHTML = `<h2 class="deck-heading">Using AF3 yourself</h2>
      ${ROWS.map(([head, body], i) => `<div class="us-row reveal-in" data-from="${i + 1}" style="top:${20 + i * 21.5}%"><b>${esc(head)}</b><span>${nb(esc(body))}</span></div>`).join('')}
      <p class="us-note deck-detail reveal-in" data-from="3">Work that uses the code, the parameters or their outputs should cite the paper.</p>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
}
