# AlphaFold 3: accurate structure prediction of biomolecular interactions

Live browser slides for a paper presentation in Generative AI for Biomedicine (Fall 2026, Carnegie Mellon University), on
Abramson et al., *Nature* 630, 493-500 (2024), by Julia Liu and Aryan Sharan Guda.

Open the slides and click or press the right arrow to step; the left arrow goes back. `T` switches between the light and the dark theme,
`O` shows an overview, `F` goes full screen and `L` turns on a laser pointer. The appendix is behind the menu slide after the References.

This repository holds only the built site, which is static: open `index.html` from a local web server (`python3 -m http.server`) or from
any static host. The slides are written in a private working repository.

## What is real and what is not

The slides show no AlphaFold 3 predictions made by us and no model weights. The pictures of structures and the plots of results are the
paper's own, cut from its figures (CC BY 4.0). Animations drawn on made-up numbers, sequences and points are labelled on the slide, and the
References slide lists them under "Made-up data".

## Credits

- Abramson et al., *Accurate structure prediction of biomolecular interactions with AlphaFold 3*, Nature 630 (2024), doi:10.1038/s41586-024-07487-w. Figures reused under CC BY 4.0.
- Jumper et al., *Highly accurate protein structure prediction with AlphaFold*, Nature 596 (2021).
- Simon, *The Illustrated AlphaFold* (2024), elanapearl.github.io/blog/2024/the-illustrated-alphafold: the diagrams of the Main idea section are redrawn from it.
- Karras, Aittala, Aila and Laine, *Elucidating the design space of diffusion-based generative models* (2022).
- RDKit, for the molecule drawings.
- The slide runtime in `web/` is the live slides template by Ramith Hettiarachchi, github.com/ramithuh/protein-design-interactive-slides (MIT, Copyright (c) 2026 Ramith Hettiarachchi; the licence text is `web/LICENSE`).
- Libraries in `vendor/`, each with its licence: reveal.js (MIT), KaTeX (MIT), manim-web (MIT), Lato (SIL OFL).
