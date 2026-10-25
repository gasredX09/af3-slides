// "References": one slide after the closing one, with the sources of everything the talk shows. The slides carry no
// credit lines of their own (the pptx had one along the bottom of most), so this is where they all went.
//
// Each entry was checked against the paper's own first page (title, volume, pages, doi) or, for Karras et al., against
// the AF3 supplement's reference list ([29]). What each source was used for comes from the credit lines it replaces.
// "Simon" is as the deck always had it; the post is at the URL given.
{
const REFS = [
  {
    cite: '<b>Abramson et al.</b> Accurate structure prediction of biomolecular interactions with AlphaFold 3. <i>Nature</i> 630, 493-500 (2024). '
      + '<a href="https://doi.org/10.1038/s41586-024-07487-w">doi:10.1038/s41586-024-07487-w</a>',
    use: 'The paper this talk is about: results and figures (the examples of complexes, Fig. 3; Fig. 1c from Extended Data Table 1; poses, Extended Data Fig. 3; disorder, Extended Data Fig. 1; nucleic acids, Extended Data Fig. 5; limitations, Fig. 5; confidence against accuracy, Fig. 4a), the architecture schematic (Fig. 1d), and the Supplementary Information '
      + '(tokenization, Methods 2.6; the MSA module, Suppl. Fig. 2 and Algs. 8-10; the Pairformer, Fig. 2a and Algs. 17 and 24; the triangle updates and attentions, Algs. 12-15; the Transition layer, Algs. 11 and 25; the diffusion module, 3.7 with Eq. 7 and Algs. 5-7 and 18-26; the confidence head, losses and ranking, Algs. 30-31 and 4.3, 5.3 and 5.9; the disorder distillation set, 2.5.2; the test sets and metrics, Methods and 6.1), and its Code availability statement. Its figures are reused under CC BY 4.0.',
  },
  {
    cite: '<b>Jumper et al.</b> Highly accurate protein structure prediction with AlphaFold. <i>Nature</i> 596, 583-589 (2021). '
      + '<a href="https://doi.org/10.1038/s41586-021-03819-2">doi:10.1038/s41586-021-03819-2</a>',
    use: 'AlphaFold 2: the MSA, pair representation and structure module, redrawn for the Background section.',
  },
  {
    cite: '<b>Simon.</b> The Illustrated AlphaFold (2024). '
      + '<a href="https://elanapearl.github.io/blog/2024/the-illustrated-alphafold/">elanapearl.github.io/blog/2024/the-illustrated-alphafold</a>',
    use: 'The architecture, input-preparation, triangle-update, attention and diffusion diagrams of the Main idea section and the appendix, adapted.',
  },
  {
    cite: '<b>Institute for Protein Design, University of Washington.</b> The coevolution figure, redrawn here.',
    use: 'Contacts are encoded in an alignment of related sequences; measuring their coevolution infers them.',
  },
  {
    cite: '<b>Karras, Aittala, Aila and Laine.</b> Elucidating the design space of diffusion-based generative models. '
      + '<i>Advances in Neural Information Processing Systems</i> 35, 26565-26577 (2022).',
    use: 'The diffusion equations (Eq. 2-3). AF3 trains its diffusion module largely as this paper does (Suppl. 3.7.1).',
  },
  {
    cite: '<b>Hettiarachchi (ramithuh).</b> Live slides template. '
      + '<a href="https://github.com/ramithuh/protein-design-interactive-slides">github.com/ramithuh/protein-design-interactive-slides</a>',
    use: 'The browser runtime these slides run on (reveal.js and KaTeX inside). MIT licence, Copyright (c) 2026 Ramith Hettiarachchi.',
  },
  {
    cite: '<b>Carnegie Mellon University.</b> Stacked wordmark, from <a href="https://www.cmu.edu">cmu.edu</a>.',
    use: 'The logo on the title slide.',
  },
  {
    cite: '<b>Google DeepMind.</b> AlphaFold 3 source code. <a href="https://github.com/google-deepmind/alphafold3">github.com/google-deepmind/alphafold3</a>',
    use: 'The terms on the Using AF3 slide: the server, the Apache 2.0 code licence and the terms of use of the model parameters (README, LICENSE, WEIGHTS_TERMS_OF_USE).',
  },
  {
    cite: '<b>RDKit:</b> open-source cheminformatics. <a href="https://www.rdkit.org">rdkit.org</a>',
    use: 'Molecule drawings from SMILES (tokenization, three-swaps and conclusion slides) and the phosphoserine conformer (ETKDGv3, seed 7).',
  },
];

AF3.kinds.references = () => ({
  steps: 1,
  notes: '',
  mount(frame, { css, esc }) {
    css(`
      .rf-list { position: absolute; left: 4.2%; right: 4.2%; top: 14%; margin: 0; padding: 0; list-style: none; font-size: calc(var(--t-caption) * .68); }
      .rf-list li { margin: 0 0 .32em; line-height: 1.22; }
      .rf-list p { margin: 0; }
      .rf-use { margin-top: .08em !important; color: var(--muted); }
      .rf-list a { color: var(--accent); text-decoration: none; white-space: nowrap; }
      .rf-made { margin-top: .8em; padding-top: .6em; border-top: 1.5px solid color-mix(in srgb, var(--muted) 35%, transparent); }
      .rf-made b { color: var(--fg); }
    `);
    frame.innerHTML = `<h2 class="deck-heading">References</h2>
      <ul class="rf-list">${REFS.map((r) => `<li><p class="rf-cite">${r.cite}</p><p class="rf-use">${r.use}</p></li>`).join('')}
        <li class="rf-made"><p class="rf-cite"><b>Made-up data, not AF3 predictions:</b></p>
          <p class="rf-use">${esc('Input-to-output animation, AlphaFold 2 recall and diagram, coevolution alignment, template pair maps, MSA module sequences and cell values, and the numbers, cells, arcs, gates, positions, structures, maps, scores, bins, poses and dockings of the Pairformer, diffusion, confidence, loss, evaluation, three-swaps, conclusion and appendix slides, denoising points (random seeds 7 and 3).')}</p></li>
      </ul>`;
    return { enter() {} };
  },
});
}
