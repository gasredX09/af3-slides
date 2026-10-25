// The order of the talk: every slide of the final pptx, in its order, with the kind that draws it and the
// footer section it belongs to. Loaded last; it registers the slides and starts the deck.
//
// kinds:  title, outline, roadmap, generic (rebuilt natively from the pptx), glance2 (glance: the old cards), table, audience, closing,
//         divider, and page (the original slide as a picture, for any slide not rebuilt). To rebuild a slide, give
//         it a kind of its own and change its entry here.
// names:  s01 .. s74 are the pptx slide numbers, so a topic can list them. `refs` is the References slide, after s64;
//         it is not in the pptx. s101 and s102 are slides made for the live talk (NEW below), numbered past the pptx's.
{
const nn = (n) => `s${String(n).padStart(2, '0')}`;

// pptx slide number -> kind; anything not listed is generic
const KIND = {
  1: 'title',
  2: 'outline', 8: 'outline', 12: 'outline', 50: 'outline', 53: 'outline', 57: 'outline',
  14: 'roadmap', 29: 'roadmap', 42: 'roadmap',
  15: 'glance2', 30: 'glance2', 43: 'glance2',   // each stage as inputs, a machine whose steps light up one per click, outputs (was three cards of text: set to 'glance' to restore)
  51: 'evalrig',                               // the evaluation table as a rig: a field of dots for each test set, the opponents, and an animated ruler for each metric (was a table: set to 'table' to restore)
  52: 'evalbars',                              // Fig. 1c plotted with the template's chart helper from Extended Data Table 1: AF3 first, then the baselines, with the confidence intervals, then the lead (was the figure as a picture)
  54: 'poses',                                 // the paper's three pose examples kept as the real figure, cut into panels, with the setup and an RMSD ruler for each (was the figure and bullets)
  55: 'disorder',                              // the paper's disorder figure kept as the real picture, cut into the three structures and the ROC plot, with the AUCs plotted (was the figure)
  56: 'nucleic',                               // the paper's nucleic acid figure kept as the real picture, cut into its four panels: the two tests, RNA-only and DNA-only structures, CASP15 RNA, an example with its confidence (was the four pictures in a collage)
  58: 'limits',                                // the four limitations of the paper, one per click, each with the next step of the future-work slide (was a collage of pictures; slide 60 is folded into it)
  62: 'conclusion',                            // the three main ideas as three cards that arrive in data-flow order, each with a small drawing, then every molecule type in and atom coordinates out, then the result in one line (was three pictures and three bullets)
  101: 'swaps',                                // the same three cards at the start of the Main idea section: what AF3 changes from AF2 (replaces slide 5, an AI-made picture of AF2 against AF3)
  102: 'recap',                                // the roadmap again after the last stage, every stage done, each with its idea
  66: 'tensorzoo',                              // the tensors table as ten cards with a drawing of each shape, built up in groups (was a table of text)
  70: 'opm',                                   // the outer product mean on tensors: m into a and b, a table per sequence, the average, flatten, a linear layer into z (was two pictures)
  69: 'pwa',                                   // pair-weighted averaging on tensors: row i of z gives the weights, the values of each sequence are added up with them, times a gate, eight heads, the update of m (was two pictures)
  71: 'incoming',                              // the incoming triangle update: the outgoing one turned round, columns where it takes rows (was a picture)
  68: 'swiglu',                                // the ReLU and SwiGLU transitions played on the same few numbers, with the two curves (was a picture)
  73: 'condtoken',                             // the token-level conditioning of the diffusion module: s and z built from the trunk, the noise level added to every token, Transition layers (was two pictures)
  74: 'condatom',                              // the atom-level conditioning: the token vectors copied to the atoms and added to c, the pair vectors copied to atom pairs and added to p (was two pictures, under a title that belonged to slide 46)
  67: 'gating',                                // conditioned gating on a toy: c through a linear layer and a sigmoid, q times the gate, the -2 bias of the gate in AF3 (was a picture)
  72: 'trattnin',                              // the incoming triangular attention: the outgoing one turned round, the keys and values from column j and the bias from column i (was a picture)
  63: 'audience', 64: 'closing', 65: 'appendix',   // the appendix menu: a card for each backup slide (was the bare divider: set to 'divider' to restore)
  3: 'recallaf2',                              // AF2 recalled: the sequence, the MSA, the Evoformer and the structure drawn natively, one bullet per click (was an AI-made card and an AI-made flow)
  6: 'matters',                                // why it matters, a click at a time: three examples from the paper's Fig. 3, the four kinds of interaction, what it is for, then from a protein to a biomolecular system (was bullets and three pictures)
  4: 'iodiagram',                              // the bullets, and input -> AF3 -> output as an animation (was a picture)
  7: 'challenge',                              // protein, ligand and DNA redrawn and built up (was three pictures)
  9: 'af2reason',                              // MSA, pair map and structure module redrawn and built up (was three pictures)
  11: 'equations',                             // the two equations as live math, explained part by part (was two pictures)
  10: 'diffusion',                             // the three statements played on a toy point cloud (was the gif: set to generic to restore)
  17: 'representations',                      // s, z, q and p redrawn and built up (was a picture: set to generic to restore)
  18: 'inputprep',                             // the input-preparation flow redrawn and built up, its notes as captions (was a picture)
  21: 'coevolution',                           // contacts, the alignment and the loop between them redrawn and built up (was a picture)
  24: 'inputprep',                             // the same figure as slide 18, with the input embedder lit: the same animation
  19: 'tokens',                                // the five molecules redrawn, with the tokenization rule played on them (was a picture)
  13: 'arch',                                  // the interactive architecture map (was the picture: set to generic to restore)
  22: 'conformer',                             // a real conformer of phosphoserine, from the five boxes of the generated picture (was a picture)
  26: 'atom2token',                            // one tensor, projected, averaged per token, joined by MSA features, projected (was a picture)
  27: 'pairinit',                              // the pair representation built up in place: s_i + s_j, the relative position encoding, the bonds (was a picture)
  28: 'embeddings',                            // the seven tensors the input embedder leaves, shown a group at a time (was a picture)
  31: 'trunk',                                 // the trunk figure redrawn: a pair and a single tensor travel through it, then recycle (was a picture)
  33: 'templates',                            // the template module: three template maps through z, the Pairformer and the average (was a picture)
  35: 'msamodule',                            // the MSA module: the MSA lane, the pair lane, and what the outer product mean and the pair-weighted averaging do between them (was a picture)
  37: 'pairformer',                            // the Pairformer block: z through the pair stack, z biasing the attention over s, the one-way rule, 48 blocks (was a picture)
  41: 'pairbias',                              // attention with pair bias on tensors: the same recipe over tokens, with z giving the bias, sixteen heads, then every token (was a picture)
  40: 'trattn',                                // triangular attention on tensors: query and keys, the bias from row j, softmax, the weighted sum, four heads, then every entry (was a picture)
  39: 'outgoing',                             // the outgoing triangle update on tensors: z into a and b, row i with row j, the sum over k, then every entry (was a picture)
  38: 'triangle',                            // the two triangle pictures as one triangle explained a click at a time (was a picture)
  45: 'diffmodule',                            // the diffusion module as one flow: atoms, then tokens, then atoms, played a click at a time (was a picture)
  46: 'atomenc',                               // the first half of the diffusion module as matrices: r lifted to 128 and added to q, the atom attention with p, the atoms of each token averaged into a (was a picture)
  47: 'ditblock',                              // one block of the token-level transformer on tensors: adaptive layer norm, attention with pair bias, gate, transition, 24 blocks (was a picture)
  48: 'confidence',                            // confidence metrics: 25 candidates, the confidence module's pLDDT, PAE, PDE, pTM and ipTM, the ranking, and how it is trained (was a generated picture)
  49: 'losses',                                // the total loss and its three groups as live math, with the weighted aligned error and the binned cross-entropy drawn, and the four training stages (was a generated picture)
  23: 'focus', 34: 'focus', 36: 'focus', 44: 'focus',   // repeats of the figure that carried a list of their own
};

// Slides left out of the live talk, not deleted: the map on slide 13 and the corner strip on the detail slides do
// their job. Take a number out of this list to bring the slide back.
//   16, 20, 25: the figure repeated with one of the five input-preparation steps lit (all five are now clicks on slide 13)
//   32: the figure with the template module lit (a click on slide 13)
//   5: "Building on AF2", an AI-made picture of AF2 against AF3 with the line "Magic sauce: Diffusion + architectural tricks"; slide 101 says the same with the real changes
//   60: the Future Work slide, four lines of text; they are the next steps under the four limits on slide 58
//   61: the first Conclusion, two sentences of text; its two points are in the conclusion cards and their last line (slide 62)
const HIDE = [5, 16, 20, 25, 32, 60, 61];

// footer section -> the slides in it; the title and the appendix are in none
const SECTION_OF = (n) => (n === 101 || n === 102 ? '3' : n === 1 ? null : n <= 7 ? '1' : n <= 11 ? '2' : n <= 49 ? '3' : n <= 52 ? '4' : n <= 56 ? '5' : n <= 64 ? '6' : null);

Deck.topics({
  3: [
    ['Input preparation', Array.from({ length: 16 }, (_, i) => nn(13 + i)), 'Idea 1, tokenization: every molecule becomes tokens on one shared grid'],
    ['Representation learning', Array.from({ length: 13 }, (_, i) => nn(29 + i)), 'Idea 2, the Pairformer: a light MSA step, then 48 blocks that work on pairs of tokens'],
    ['Structure prediction', [...Array.from({ length: 8 }, (_, i) => nn(42 + i)), nn(102)], 'Idea 3, diffusion: atoms are denoised from noise to coordinates, then scored'],
  ],
});
Deck.expand('3');

// The appendix is put in the order of the model (the pptx has it in the order it was made): the menu, the tensors, the MSA module's two operations,
// the pair stack's incoming update and attention, the Transition layer, then the diffusion module's conditioning and its gate. Slide 74 stays, retitled.
const APPENDIX = [65, 66, 70, 69, 71, 72, 68, 73, 74, 67];

// The talk is put in a better order than the pptx's (see DECISIONS.md, 2026-10-24, "The story of the whole talk"), and has two slides the pptx did not:
//   101  "From AF2 to AF3: three swaps", the first slide of the Main idea section after its outline (the conclusion's three cards, shown first here)
//   102  the recap that closes the Main idea section (the roadmap, every stage done)
// Slide 6 (why it is important) opens the talk, then AF2 recalled (3), the question (4) and why it is hard (7). The cases end on the disorder slide (55), which leads into the limitations.
const NEW = { 101: { ...AF3.slide(62), n: 101 }, 102: { ...AF3.slide(14), n: 102 } };
const MAIN = [1, 2, 6, 3, 4, 5, 7, 8, 9, 10, 11, 12, 101, ...Array.from({ length: 37 }, (_, i) => 13 + i), 102, 50, 51, 52, 53, 54, 56, 55, 57, 58, 59, 60, 61, 62, 63, 64];
const ORDER = MAIN.concat(APPENDIX).map((n) => NEW[n] || AF3.slide(n));

for (const s of ORDER) {
  Deck.section(SECTION_OF(s.n));
  const name = KIND[s.n] || 'generic';
  let def = name === 'tablesmall' ? AF3.kinds.table(s, { small: true }) : AF3.kinds[name](s);
  if (s.n !== 65 && APPENDIX.includes(s.n)) def = AF3.withBack(def);   // the backup slides carry a link back to the menu
  Deck.slide(nn(s.n), def);
  if (s.n === 64) { Deck.section(null); Deck.slide('refs', AF3.kinds.references()); }   // the sources, after the closing slide
}
Deck.section(null);
for (const s of AF3.deck.slides) if (s.hidden) Deck.hide(nn(s.n));   // slides hidden in the pptx stay hidden
for (const n of HIDE) Deck.hide(nn(n));

Deck.start({ title: 'AlphaFold 3: accurate structure prediction of biomolecular interactions' });
}
