// "AF3 outperforms specialized methods across most tested interaction classes" (slide 52): Fig. 1c of the paper, plotted from the numbers in
// Extended Data Table 1 with the template's own chart helper (Deck.groupedBars, web/plots.js; the template's guide: charts go through it, in the
// theme colours, and are not hand-built). One chart for each panel of the figure, built up a click at a time: AF3 first, then the baselines,
// so the gap is the thing that arrives. The 95% confidence intervals of the figure are drawn as whiskers on the helper's bars, and a last chart
// shows the lead of AF3 over the strongest baseline that had no human input.
//
//   1  protein-ligand (PoseBusters V1): AF3 76.4%                      2  AutoDock Vina 52.3%, RoseTTAFold All-Atom 42.0%
//   3  protein-nucleic acid and RNA: AF3 (iLDDT, iLDDT, LDDT)           4  RoseTTAFold2NA
//   5  CASP15 RNA: AIchemy_RNA2, an entry with human input, is higher   6  covalent modifications (no baseline)
//   7  proteins: AF3 (DockQ > 0.23, DockQ > 0.23, LDDT)                 8  AlphaFold-Multimer v2.3
//   9  the lead of AF3 over the strongest baseline without human input
//
// Every number is read from Extended Data Table 1 (page 21 of the paper): mean, 95% CI and N of each bar of Fig. 1c. The caption of Fig. 1c gives the
// rest: bars are means; the error bars are exact binomial 95% confidence intervals for PoseBusters and 10,000 bootstrap resamples for the others; the
// stars come from two-sided Fisher's exact tests (PoseBusters) and Wilcoxon signed-rank tests (the rest), exact P values from left to right 2.27e-13,
// 2.57e-3, 2.78e-3, 7.28e-12, 1.81e-18, 6.54e-5, 1.74e-34 (the first is AF3 against Vina, as in the main text; the last two as in the main text);
// "n" is a number of structures for ligands and nucleic acids and of clusters for modifications and proteins. The metrics: % of pocket-aligned RMSD < 2 A
// (ligands, covalent modifications), iLDDT (protein-RNA, protein-DNA), LDDT (CASP15 RNA, monomers), % DockQ > 0.23 (protein-protein, antibody). They share
// one 0 to 100 axis in the figure, and here. The glycosylation bar is the high-quality, single-residue set (n = 28); on all-quality sets AF3 gets about 46%
// (single-residue, n = 167) and 42% (multi-residue, n = 131), main text and table. Bonded ligands and glycosylation are not filtered by homology to the
// training set; modified residues are (main text). The lead in the last chart is the difference of two bars (a difference of means, not a test); the
// baseline for each task is the strongest one that Fig. 1c shows without human input: Vina for ligands, RoseTTAFold2NA for nucleic acids and CASP15, AlphaFold-Multimer for
// proteins. Extended Data Table 1 lists more methods than the figure (for example Uni-Mol Docking V2 with pocket residues specified, 77.6, against AF3's 76.4 without them; and on
// CASP15 RNA, Kiharalab 40.9 and UltraFold 37.8 besides RoseTTAFold2NA); they are not plotted, and the slide says "in the figure" wherever it names a strongest baseline.
{
const ACC = 'var(--plot-3)', GREY = 'var(--plot-1)', AMB = 'var(--plot-2)';
const FORMAT = (v) => (v === undefined ? '' : [0, 25, 50, 75, 100].includes(v) ? String(v) : v.toFixed(1));
const FORMAT_LEAD = (v) => (v === undefined ? '' : v === 0 ? '0' : [10, 20, 30, 40].includes(v) ? `+${v}` : `+${v.toFixed(1)}`);
const SRC = 'Source: Abramson et al. 2024, Fig. 1c and Extended Data Table 1.';

const SPECS = {
  lig: {
    max: 100, strong: 'v', series: [{ key: 'v', label: '' }],
    groups: [
      { label: ['AF3', '2019 cut-off', '$n = 428$'], step: 1, highlight: true, values: { v: 76.4 }, ci: { v: [72.1, 80.3] }, colors: { v: ACC } },
      { label: ['AutoDock', 'Vina', '$n = 428$'], step: 2, values: { v: 52.3 }, ci: { v: [47.5, 57.2] } },
      { label: ['RoseTTAFold', 'All-Atom', '$n = 427$'], step: 2, values: { v: 42.0 }, ci: { v: [37.2, 46.8] } },
    ],
    footnote: ['% of ligands within 2 Å (pocket-aligned RMSD). Bars: mean; whiskers: exact binomial 95% confidence intervals. ' + SRC],
  },
  nuc: {
    max: 100, strong: 'af3',
    series: [{ key: 'af3', label: 'AF3', step: 1, color: ACC }, { key: 'rf', label: 'RoseTTAFold2NA', step: 2, color: GREY }, { key: 'al', label: 'AIchemy_RNA2 (has human input)', step: 3, color: AMB }],
    groups: [
      { label: ['Protein–RNA', '$n = 25$', '**'], values: { af3: 39.4, rf: 19.0 }, ci: { af3: [28.5, 51.9], rf: [15.6, 23.2] } },
      { label: ['Protein–dsDNA', '$n = 38$', '***'], values: { af3: 64.8, rf: 28.3 }, ci: { af3: [56.4, 71.7], rf: [20.7, 37.5] } },
      { label: ['CASP15 RNA', '$n = 8$'], values: { af3: 47.3, rf: 35.5, al: 54.5 }, ci: { af3: [41.7, 55.2], rf: [28.3, 43.8], al: [45.3, 62.4] } },
    ],
    footnote: ['iLDDT (protein–RNA, protein–DNA) and LDDT (CASP15 RNA), 0 to 100. Whiskers: bootstrap 95% intervals. ** $P < 0.01$, *** $P < 0.001$. ' + SRC],
  },
  cov: {
    max: 100, strong: 'af3', series: [{ key: 'af3', label: 'AF3' }],
    groups: [
      { label: ['Bonded', 'ligands', '$n = 66$'], step: 1, values: { af3: 78.5 }, ci: { af3: [68.3, 86.2] }, colors: { af3: ACC } },
      { label: ['Glycosylation', '$n = 28$'], step: 1, values: { af3: 72.1 }, ci: { af3: [53.1, 85.7] }, colors: { af3: ACC } },
      { label: ['Modified', 'protein', '$n = 40$'], step: 1, values: { af3: 51.0 }, ci: { af3: [36.0, 65.6] }, colors: { af3: ACC } },
      { label: ['Modified', 'DNA', '$n = 91$'], step: 1, values: { af3: 68.6 }, ci: { af3: [59.0, 76.9] }, colors: { af3: ACC } },
      { label: ['Modified', 'RNA', '$n = 23$'], step: 1, values: { af3: 40.9 }, ci: { af3: [23.4, 59.9] }, colors: { af3: ACC } },
    ],
    footnote: ['% of modifications within 2 Å. Glycosylation: high-quality single-residue sets (all-quality sets: about 46% and 42%). ' + SRC],
  },
  prot: {
    max: 100, strong: 'af3',
    series: [{ key: 'af3', label: 'AF3', step: 1, color: ACC }, { key: 'am', label: 'AlphaFold-Multimer v2.3', step: 2, color: GREY }],
    groups: [
      { label: ['All protein–protein', '$n = 1{,}064$', '***'], values: { af3: 76.6, am: 67.5 }, ci: { af3: [74.0, 78.9], am: [64.7, 70.1] } },
      { label: ['Protein–antibody', '$n = 65$', '***'], values: { af3: 62.9, am: 29.6 }, ci: { af3: [51.4, 73.5], am: [19.6, 40.4] } },
      { label: ['Protein monomers', '$n = 338$', '***'], values: { af3: 86.9, am: 85.5 }, ci: { af3: [86.2, 87.6], am: [84.7, 86.1] } },
    ],
    footnote: ['% DockQ $> 0.23$ (protein–protein, antibody) and LDDT (monomers). Whiskers: bootstrap 95% intervals. *** $P < 0.001$. ' + SRC],
  },
  lead: {
    max: 40, format: FORMAT_LEAD, strong: 'd', series: [{ key: 'd', label: '' }],
    groups: [
      { label: ['Protein–', 'ligand', 'vs Vina'], step: 1, values: { d: 24.1 }, colors: { d: ACC } },
      { label: ['Protein–', 'RNA', 'vs RF2NA'], step: 1, values: { d: 20.4 }, colors: { d: ACC } },
      { label: ['Protein–', 'DNA', 'vs RF2NA'], step: 1, values: { d: 36.5 }, colors: { d: ACC } },
      { label: ['CASP15', 'RNA', 'vs RF2NA *'], step: 1, highlight: true, values: { d: 11.8 }, colors: { d: ACC } },
      { label: ['Protein–', 'protein', 'vs AF-M'], step: 1, values: { d: 9.1 }, colors: { d: ACC } },
      { label: ['Protein–', 'antibody', 'vs AF-M'], step: 1, values: { d: 33.3 }, colors: { d: ACC } },
      { label: ['Protein', 'monomers', 'vs AF-M'], step: 1, values: { d: 1.4 }, colors: { d: ACC } },
    ],
    footnote: ['Lead = AF3 minus the strongest baseline in Fig. 1c without human input, in points of each task’s score: a difference of two bars, not a test.',
      '* On CASP15 RNA, AIchemy_RNA2 (human input) scored 54.5, 7.2 points above AF3 (47.3). ' + SRC],
  },
};
const ORDER = ['lig', 'nuc', 'cov', 'prot', 'lead'];
const FINAL = { lig: 2, nuc: 3, cov: 1, prot: 2, lead: 1 };
const MAP = [['lig', 1], ['lig', 2], ['nuc', 1], ['nuc', 2], ['nuc', 3], ['cov', 1], ['prot', 1], ['prot', 2], ['lead', 1]];
const CAPTIONS = [
  'Protein–ligand on PoseBusters V1 (428 structures): AF3 puts 76.4% of ligands within 2 Å of the true pose. Bars are means, whiskers are 95% confidence intervals.',
  'AutoDock Vina, which is told where the pocket is, gets 52.3%, and RoseTTAFold All-Atom 42.0%. AF3 against Vina: $P = 2.27 \\times 10^{-13}$ (Fisher’s exact test).',
  'Protein–nucleic acid and RNA: AF3 scores 39.4 on protein–RNA (25 structures), 64.8 on protein–DNA (38) and 47.3 on CASP15 RNA (8 targets).',
  'RoseTTAFold2NA scores 19.0, 28.3 and 35.5, so AF3 is ahead on all three. The stars: $P < 0.01$ for protein–RNA and $P < 0.001$ for protein–DNA.',
  'But on CASP15 RNA, AIchemy_RNA2, an entry with human input, scores 54.5, above AF3’s 47.3. With 8 targets the intervals are wide, and they overlap.',
  'Covalent modifications, as the share of poses within 2 Å: bonded ligands 78.5%, glycosylation 72.1%, modified residues 51.0% for protein, 68.6% for DNA and 40.9% for RNA. No baseline is shown.',
  'Proteins: AF3 gets a DockQ above 0.23 for 76.6% of protein–protein interface clusters and 62.9% of antibody–antigen ones, and an LDDT of 86.9 on monomers.',
  'AlphaFold-Multimer v2.3 gets 67.5%, 29.6% and 85.5. The gain is large for antibodies (both models take the best of 1,000 seeds) and small for monomers.',
  'How far ahead: from 1.4 points on monomers to 36.5 on protein–DNA, against the strongest baseline in the figure that had no human input. On CASP15 RNA, one entry with human input was 7.2 points above AF3.',
];

AF3.kinds.evalbars = (s) => ({
  steps: 9,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(`
      .eb-caps { position: absolute; left: 4.2%; right: 4.2%; top: 86%; height: 9%; }
      .eb-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .deck-plot { transition: opacity .45s; }
      .deck-plot .eb-ci { position: absolute; left: 50%; width: 0; border-left: 2px solid var(--fg); opacity: 0; transition: opacity .4s .7s; }
      .deck-plot .eb-ci::before, .deck-plot .eb-ci::after { content: ''; position: absolute; left: -.5em; width: 1em; border-top: 2px solid var(--fg); }
      .deck-plot .eb-ci::before { bottom: 0; } .deck-plot .eb-ci::after { top: 0; }
      .deck-plot-group.in .eb-ci { opacity: .8; }
      .deck-plot.by-series .deck-plot-group.in .eb-ci { opacity: 0; }
      .deck-plot.by-series .deck-plot-bar.in .eb-ci { opacity: .8; }
      .deck-plot.instant .eb-ci { transition: none; }
    `);
    const title = AF3.texts(s).slice().sort((a, b) => a.g.y - b.g.y)[0];
    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="eb-caps">${CAPTIONS.map((t, i) => `<p class="eb-cap reveal-in" data-show="${i + 1}">${AF3.rich(t, esc)}</p>`).join('')}</div>`;

    // each chart is the helper's own; its bars get the theme colours we want, a whisker for the confidence interval, and the label above the whisker
    const build = (spec) => {
      const plot = Deck.groupedBars(frame, {
        series: spec.series.map((x) => ({ key: x.key, label: x.label, ...(x.step ? { step: x.step } : {}) })),
        groups: spec.groups.map((g) => ({ label: g.label, ...(g.step ? { step: g.step } : {}), highlight: !!g.highlight, values: g.values })),
        strong: spec.strong, footnote: spec.footnote, captioned: true, max: spec.max, format: spec.format || FORMAT,
      });
      [...plot.root.querySelectorAll('.deck-plot-group')].forEach((ge, gi) => {
        const g = spec.groups[gi];
        [...ge.querySelectorAll('.deck-plot-bar')].forEach((be, si) => {
          const sp = spec.series[si], v = g.values[sp.key];
          if (v === undefined) { be.style.display = 'none'; return; }
          const color = (g.colors && g.colors[sp.key]) || sp.color;
          if (color) be.querySelector('.deck-plot-fill').style.background = color;
          const ci = g.ci && g.ci[sp.key];
          if (ci) {
            const w = document.createElement('div');
            w.className = 'eb-ci'; w.style.bottom = `${(100 * ci[0]) / spec.max}%`; w.style.height = `${(100 * (ci[1] - ci[0])) / spec.max}%`;
            be.append(w);
            be.querySelector('.deck-plot-val').style.bottom = `${(100 * ci[1]) / spec.max}%`;
          }
        });
      });
      plot.root.querySelectorAll('.deck-plot-key i').forEach((i, k) => { if (spec.series[k].color) i.style.background = spec.series[k].color; });
      // the runtime escapes labels and footnotes as text: write them again with the math (the $n = 428$ and $P < 0.01$ of the specs) set in KaTeX
      [...plot.root.querySelectorAll('.deck-plot-label')].forEach((el, gi) => { el.innerHTML = [].concat(spec.groups[gi].label).map((l) => AF3.rich(l, esc)).join('<br>'); });
      const foot = plot.root.querySelector('.deck-plot-foot');
      if (foot) foot.innerHTML = spec.footnote.map((l) => AF3.rich(l, esc)).join('<br>');
      return plot;
    };
    const plots = ORDER.map((k) => build(SPECS[k]));
    plots.forEach((p) => { p.root.style.opacity = 0; p.show(0, false); });

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        const [name, local] = MAP[step - 1], at = ORDER.indexOf(name);
        plots.forEach((p, i) => {
          if (i === at) { p.root.style.opacity = 1; p.show(local, animate); }
          else { p.root.style.opacity = 0; p.show(i < at ? FINAL[ORDER[i]] : 0, false); }   // the others sit at their last state (earlier) or empty (later), out of sight
        });
      },
    };
  },
});
}
