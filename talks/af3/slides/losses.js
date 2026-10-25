// "Losses" (slide 49): the generated picture (the total loss, the diffusion loss, the confidence losses, the distogram loss) rebuilt as live
// math with KaTeX (as on slide 11) and explained a click at a time, one group of terms in its own colour, with two small drawings for the ideas that a
// formula hides: the weighted error after a rigid alignment, and a cross-entropy over bins.
//
//   1  the total loss, one sum of three kinds of term
//   2  the three groups in colour, with their weights: alpha_diff = 4, alpha_dist = 3e-2, alpha_conf = 1e-4, and alpha_pae = 0 until the last stage
//   3  the diffusion loss, the core: the truth is rigidly aligned onto the denoised structure, then a weighted mean squared error per atom
//   4  the rest of the diffusion loss: the noise-level factor, the bond loss (fine-tuning only), the smooth LDDT, and no clash or violation losses
//   5  the confidence losses: a cross-entropy over bins for pLDDT (50 bins), PAE and PDE (64 bins, 0-32 A) and resolved (2 bins)
//   6  the distogram loss: the same cross-entropy on the distance between the representative atoms of two tokens, from z
//   7  the four training stages: which terms are on
//
// Checked against the supplement, 5.3 Eq. 15 (L = a_conf (L_plddt + L_pde + L_resolved + a_pae L_pae) + a_diff L_diffusion + a_dist L_distogram; a_conf = 1e-4,
// a_diff = 4, a_dist = 3e-2, a_pae = 0 except 1 in the final stage); 3.7.1 Eqs. 2-6 (weighted rigid alignment of the truth onto the denoised structure;
// L_MSE = 1/3 mean_l w_l |x_l - x_l^GT-aligned|^2; w_l = 1 + 5 f_dna + 5 f_rna + 10 f_ligand; L_bond with a_bond = 0 for regular training and 1 for both
// fine-tuning stages; L_diffusion = (t^2 + s_data^2)/(t + s_data)^2 (L_MSE + a_bond L_bond) + L_smooth_lddt, s_data = 16) and Alg. 27 (smooth LDDT, 1 - lddt);
// 4.3 Eqs. 9, 10, 12, 14 (the cross-entropies; pLDDT 50 bins, PAE and PDE 64 bins from 0 to 32 A, resolved 2 bins; the confidence losses only on the PDB
// training set, at resolution 0.1-4; the stop-gradient on the single and pair embeddings and the predicted structure, 4.3.5; the targets come from the
// 20-step mini-rollout, 4.1); 4.4 (the distogram head and loss are identical to AlphaFold 2, on the representative atoms: C-beta, C-alpha for glycine, C4 for
// purines, C2 for pyrimidines) and the reference code (model/network/distogram_head.py: 64 bins from 2.3125 to 21.6875 A); Table 6 (the stages: structure and
// distogram losses on, on, on, off; the PAE head off, off, off, on; the polymer-ligand bond loss weight 0, 1, 1, 1; crop sizes 384, 640, 768, 768); the
// Differences to AlphaFold 2 section ("no violation or clash losses are applied"). The smooth LDDT is left out of the stage table: the text says it was turned off
// in the first fine-tuning stage and does not say what it does in the others.
// The two drawings are toys: made-up points and a made-up distribution over 12 bins (seeded where random), so nothing on them is an AF3 result.
{
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const lerp = (a, b, t) => a + (b - a) * t;
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const SEED = 7;
const PINK = '#c2255c', GREY = '#8d96a0';

const CAPTIONS = [
  "AF3 is trained on one sum of three kinds of loss: one for the atom coordinates, one for the model's own confidence, and one for a map of distances.",
  'Each kind has a weight: 4 for the coordinates, 0.03 for the distance map and $10^{-4}$ for the confidence heads. The PAE term has weight 0 until the last training stage.',
  "Diffusion loss: the denoised structure is compared with the true one. The truth is first rigidly aligned onto it, then each atom's squared error is averaged. DNA, RNA and ligand atoms count more.",
  'Around that error: a factor that depends on the noise level, a bond-length loss for bonded ligands (fine-tuning only) and a smooth LDDT term for local distances. There are no clash or violation losses.',
  'The confidence losses are a classification. Each head gives a probability for every bin of the error, and the loss is minus the log of the probability of the true bin. Training makes that probability grow.',
  'The distogram loss is the same cross-entropy on distances: the pair representation $z$ must say in which of 64 bins the distance between two tokens falls.',
  'Training runs in four stages. The PAE term is zero until the last one, where the diffusion and distogram losses are switched off. The bond loss is on from the first fine-tuning stage.',
];

AF3.kinds.losses = (s) => ({
  steps: 7,
  notes: s.notes || '',
  mount(frame, { css, esc }) {
    css(AF3.textCss + `
      .ls-total { position: absolute; left: 4.2%; right: 4.2%; top: 13.5%; font-size: calc(var(--t-heading) * .5); line-height: 1.3; }
      .ls-total .katex-display { margin: 0; text-align: left; }
      .ls-total .katex-display > .katex { text-align: left; }
      .ls-total .k { transition: color .5s, opacity .5s; }
      .k.kd { color: var(--plot-3); } .k.kc { color: var(--plot-4); } .k.kg { color: var(--plot-2); }
      .f-d .k.kc, .f-d .k.kg, .f-c .k.kd, .f-c .k.kg, .f-g .k.kd, .f-g .k.kc { opacity: .3; }
      .ls-cards { position: absolute; left: 4.2%; right: 4.2%; top: 29%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.2em; }
      .st-3 .ls-cards { display: none; }
      .ls-cards > div { border-top: .35em solid var(--c); padding: .55em .1em 0; }
      .ls-cards h3 { margin: 0 0 .3em; font-size: var(--t-lead); color: var(--c); font-weight: 700; }
      .ls-cards .q { margin: 0 0 .3em; font-size: var(--t-body); font-weight: 700; line-height: 1.25; }
      .ls-cards .sub { margin: 0; font-size: var(--t-small); color: var(--muted); line-height: 1.3; }
      .ls-cards .w { margin: .9em 0 0; font-size: var(--t-lead); }
      .ls-cards .w small { display: block; font-size: var(--t-caption); color: var(--muted); }
      .ls-panel { position: absolute; left: 4.2%; right: 4.2%; top: 26%; height: 54%; }
      .ls-cols { display: grid; grid-template-columns: 43% 1fr; gap: 2.2em; align-items: start; height: 100%; }
      .ls-cols svg { display: block; width: 100%; height: auto; overflow: visible; }
      .ls-math { font-size: calc(var(--t-lead) * .82); line-height: 1.35; margin: 0 0 .5em; }
      .ls-math .katex-display { margin: 0; text-align: left; } .ls-math .katex-display > .katex { text-align: left; }
      .ls-math.big { font-size: calc(var(--t-lead) * .98); }
      .ls-pts { margin: 0; padding: 0; list-style: none; font-size: var(--t-small); line-height: 1.32; }
      .ls-pts li { margin: 0 0 .5em; padding-left: .7em; border-left: .28em solid var(--c, var(--muted)); }
      .ls-pts b { color: var(--fg); }
      .ls-legend { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 1.8em; margin-top: .6em; }
      .ls-legend > div { font-size: var(--t-caption); line-height: 1.3; color: var(--muted); padding-left: .7em; border-left: .3em solid var(--c); }
      .ls-legend > div b { display: block; color: var(--fg); font-size: var(--t-small); margin-bottom: .1em; }
      .ls-note { margin: .8em 0 0; font-size: var(--t-small); font-weight: 700; color: var(--plot-5); }
      .ls-stages { display: grid; grid-template-columns: 1.7fr repeat(4, 1fr); gap: .35em .5em; font-size: var(--t-small); align-items: center; }
      .ls-stages > div { padding: .35em .5em; border-radius: .4em; text-align: center; }
      .ls-stages .h { font-weight: 700; color: var(--fg); background: color-mix(in srgb, var(--muted) 12%, var(--bg)); }
      .ls-stages .h small { display: block; font-weight: 400; color: var(--muted); font-size: .82em; }
      .ls-stages .r { text-align: left; color: var(--fg); }
      .ls-stages .r small { display: block; color: var(--muted); font-size: .82em; }
      .ls-stages .on { background: color-mix(in srgb, var(--done) 22%, var(--bg)); font-weight: 700; }
      .ls-stages .off { color: var(--muted); border: 1.5px dashed color-mix(in srgb, var(--muted) 45%, transparent); }
      .ls-stages .last { outline: 2.5px solid var(--accent); outline-offset: -1px; }
      .ls-caps { position: absolute; left: 4.2%; right: 4.2%; top: 82.5%; height: 10.5%; }
      .ls-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
      .ls-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .ls-t.muted { fill: var(--muted); }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const tex = (src, opts = {}) => AF3.tex(src, !!opts.displayMode);   // the shared KaTeX (cached; inline math sized like the math in the captions)
    const m = (src) => AF3.tex(src);
    const L = (sub) => String.raw`\mathcal{L}_{\text{${sub}}}`;
    const total = String.raw`\mathcal{L} \;=\; \htmlClass{k kc}{\alpha_{\text{conf}}\Big(${L('plddt')} + ${L('pde')} + ${L('resolved')} + \alpha_{\text{pae}}\,${L('pae')}\Big)} \;+\; \htmlClass{k kd}{\alpha_{\text{diff}}\,${L('diffusion')}} \;+\; \htmlClass{k kg}{\alpha_{\text{dist}}\,${L('distogram')}}`;
    const mse = String.raw`${L('MSE')} = \tfrac{1}{3}\,\operatorname{mean}_l\; w_l\,\big\lVert \vec x_l - \vec x_l^{\,\text{GT-aligned}}\big\rVert^{2}`;
    const wl = String.raw`w_l = 1 + 5\,f_l^{\text{dna}} + 5\,f_l^{\text{rna}} + 10\,f_l^{\text{ligand}}`;
    const diff = String.raw`${L('diffusion')} = \dfrac{\hat t^{2}+\sigma_{\text{data}}^{2}}{(\hat t+\sigma_{\text{data}})^{2}}\,\big(${L('MSE')} + \alpha_{\text{bond}}\,${L('bond')}\big) + ${L('smooth lddt')}`;
    const plddt = String.raw`${L('plddt')} = -\dfrac{1}{N_{\text{atom}}}\sum_{l}\sum_{b=1}^{50} \text{lddt}_l^{\,b}\,\log p_l^{\,b}`;
    const dist = String.raw`${L('distogram')} = -\dfrac{1}{N_{\text{tok}}^{2}}\sum_{i,j}\sum_{b=1}^{64} y_{ij}^{\,b}\,\log p_{ij}^{\,b}`;
    const leg = (color, head, body) => `<div style="--c:var(${color})"><b>${head}</b>${body}</div>`;
    const stage = (v) => (v === true ? '<div class="on">on</div>' : v === false ? '<div class="off">off</div>' : `<div class="on">${v}</div>`);

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="ls-total">${tex(total, { displayMode: true })}</div>
      <div class="ls-cards reveal-in" data-from="1">
        <div style="--c:var(--plot-3)"><h3>Diffusion loss</h3><p class="q">Are the atom coordinates right?</p><p class="sub">The denoised structure against the true one.</p>
          <p class="w reveal-in" data-from="2">${m(String.raw`\alpha_{\text{diff}} = 4`)}</p></div>
        <div style="--c:var(--plot-4)"><h3>Confidence losses</h3><p class="q">Does the model know how wrong it is?</p><p class="sub">Four heads: pLDDT, PAE, PDE and resolved.</p>
          <p class="w reveal-in" data-from="2">${m(String.raw`\alpha_{\text{conf}} = 10^{-4}`)}<small>and ${m(String.raw`\alpha_{\text{pae}} = 0`)} until the last stage, where it is 1</small></p></div>
        <div style="--c:var(--plot-2)"><h3>Distogram loss</h3><p class="q">Are the distances between tokens right?</p><p class="sub">Read from the pair representation ${m('z')}.</p>
          <p class="w reveal-in" data-from="2">${m(String.raw`\alpha_{\text{dist}} = 3\cdot 10^{-2}`)}</p></div>
      </div>

      <div class="ls-panel reveal-in" data-show="3"><div class="ls-cols">
        <svg viewBox="0 0 420 260" id="ls-svg3" role="img" aria-label="The true structure is rigidly aligned onto the predicted one, then the error of each atom is measured; nucleic acid and ligand atoms count more"></svg>
        <div>
          <div class="ls-math">${tex(mse, { displayMode: true })}</div>
          <div class="ls-math">${tex(wl, { displayMode: true })}</div>
          <ul class="ls-pts" style="--c:var(--plot-3)"><li><b>1.</b> Rigidly align the true structure onto the denoised one, so only a real difference is counted.</li>
            <li><b>2.</b> Average the squared distance of each atom. A DNA or RNA atom counts 6 times, a ligand atom 11 times, a protein atom once.</li></ul>
        </div>
      </div></div>

      <div class="ls-panel reveal-in" data-show="4">
        <div class="ls-math big">${tex(diff, { displayMode: true })}</div>
        <div class="ls-legend">
          ${leg('--plot-3', `the noise-level factor`, `${m(String.raw`(\hat t^{2}+\sigma_{\text{data}}^{2})/(\hat t+\sigma_{\text{data}})^{2}`)} rescales the loss by how noisy the input was; ${m(String.raw`\hat t`)} is the noise level and ${m(String.raw`\sigma_{\text{data}} = 16`)}.`)}
          ${leg('--plot-5', `the bond loss ${m(String.raw`${L('bond')}`)}`, `For a ligand bonded to a chain: the bond must have its true length. ${m(String.raw`\alpha_{\text{bond}}`)} is 0 at first and 1 in the two fine-tuning stages.`)}
          ${leg('--plot-4', `the smooth LDDT ${m(String.raw`${L('smooth lddt')}`)}`, 'A smooth version of 1 minus LDDT: are the distances between nearby atoms right?')}
        </div>
        <p class="ls-note">No clash loss and no violation loss: the structure is trained by the error above, the bond length and the smooth LDDT.</p>
      </div>

      <div class="ls-panel reveal-in" data-show="5"><div class="ls-cols">
        <svg viewBox="0 0 420 260" id="ls-svg5" role="img" aria-label="A head gives a probability for each bin of the error; the loss is minus the log of the probability of the true bin, and it falls as that probability grows"></svg>
        <div>
          <div class="ls-math">${tex(plddt, { displayMode: true })}</div>
          <ul class="ls-pts" style="--c:var(--plot-4)">
            <li><b>Same loss for each head.</b> pLDDT: 50 bins between 0 and 1. PAE and PDE: 64 bins from 0 to 32 Å. Resolved: 2 bins.</li>
            <li><b>The targets are real errors</b> of the rollout structure from the previous slide, measured against the truth.</li>
            <li><b>Gradients stop before the trunk.</b> Only PDB structures are used.</li></ul>
        </div>
      </div></div>

      <div class="ls-panel reveal-in" data-show="6"><div class="ls-cols">
        <svg viewBox="0 0 420 260" id="ls-svg6" role="img" aria-label="The distance between two tokens falls in one of 64 bins; the distogram head must put its probability on that bin"></svg>
        <div>
          <div class="ls-math">${tex(dist, { displayMode: true })}</div>
          <ul class="ls-pts" style="--c:var(--plot-2)">
            <li><b>One representative atom per token:</b> Cβ (Cα for glycine) for protein, C4 for purines, C2 for pyrimidines; a ligand atom is its own token.</li>
            <li><b>The same loss as in AlphaFold 2.</b> It reads ${m('z')}, so it gives the pair representation a direct signal about distances.</li></ul>
        </div>
      </div></div>

      <div class="ls-panel reveal-in" data-show="7">
        <div class="ls-stages">
          <div></div><div class="h">Initial<small>crop 384</small></div><div class="h">Fine tuning 1<small>crop 640</small></div><div class="h">Fine tuning 2<small>crop 768</small></div><div class="h">Fine tuning 3<small>crop 768</small></div>
          <div class="r">Diffusion and distogram losses</div>${stage(true)}${stage(true)}${stage(true)}${stage(false).replace('class="off"', 'class="off last"')}
          <div class="r">Bond loss ${m(String.raw`\alpha_{\text{bond}}`)}</div>${stage('0').replace('class="on"', 'class="off"')}${stage('1')}${stage('1')}${stage('1').replace('class="on"', 'class="on last"')}
          <div class="r">PAE term ${m(String.raw`\alpha_{\text{pae}}`)}</div>${stage('0').replace('class="on"', 'class="off"')}${stage('0').replace('class="on"', 'class="off"')}${stage('0').replace('class="on"', 'class="off"')}${stage('1').replace('class="on"', 'class="on last"')}
        </div>
      </div>

      <div class="ls-caps">${CAPTIONS.map((t, i) => `<p class="ls-cap reveal-in" data-show="${i + 1}">${AF3.rich(t, esc)}</p>`).join('')}</div>`;

    // ---- the two small drawings ----
    const rand = rng(SEED);
    const sv3 = frame.querySelector('#ls-svg3'), sv5 = frame.querySelector('#ls-svg5'), sv6 = frame.querySelector('#ls-svg6');
    const txt = (x, y, size, str, op, o = {}) => op < 0.01 ? '' : String(str).includes('$') ? AF3.svgRich(x, y, size, str, { ...o, op }) : `<text x="${x}" y="${y}" font-size="${size}" class="ls-t${o.muted ? ' muted' : ''}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="700"' : ''} opacity="${op.toFixed(2)}">${str}</text>`;

    // 3: the truth is rigidly moved onto the prediction (one rotation and one shift for all atoms), then the error of each atom is measured
    const KINDS = [1, 1, 1, 1, 1, 1, 1, 1, 6, 6, 11, 11], RAD = { 1: 4.5, 6: 7, 11: 9 };
    const PRED = KINDS.map((_, i) => (i < 8 ? [30 + i * 28, 130 + 40 * Math.sin(i * 0.8 + 0.3)] : i < 10 ? [270 + (i - 8) * 30, 70 + (i - 8) * 26] : [330 + (i - 10) * 32, 172 - (i - 10) * 20]));
    const ALIGNED = PRED.map(([x, y]) => [x + (rand() - 0.5) * 22, y + (rand() - 0.5) * 22]);                  // the truth, once aligned: close but not equal
    const C0 = [210, 120], ANG = 0.34, SHIFT = [30, 26];
    const place = (p, t) => {                                                                                  // the truth before alignment, and while it moves
      const a = ANG * (1 - t), c = Math.cos(a), sn = Math.sin(a), dx = p[0] - C0[0], dy = p[1] - C0[1];
      return [C0[0] + dx * c - dy * sn + SHIFT[0] * (1 - t), C0[1] + dx * sn + dy * c + SHIFT[1] * (1 - t)];
    };
    const draw3 = (p) => {
      const t = ramp(p, 0.1, 0.55), er = ramp(p, 0.6, 0.9);
      let h = txt(210, 16, 14, '1  rigidly align the truth onto the prediction', ramp(p, 0.02, 0.12) * (1 - ramp(p, 0.55, 0.65)), { muted: true }) + txt(210, 16, 14, "2  measure each atom's error, weighted", ramp(p, 0.6, 0.75), { muted: true });
      PRED.forEach((q, i) => {
        const tr = place(ALIGNED[i], t);
        h += `<line x1="${q[0].toFixed(1)}" y1="${q[1].toFixed(1)}" x2="${tr[0].toFixed(1)}" y2="${tr[1].toFixed(1)}" stroke="${PINK}" stroke-width="${(1.3 + 0.28 * KINDS[i]).toFixed(1)}" opacity="${(er * 0.9).toFixed(2)}"/>`;
      });
      PRED.forEach((q, i) => { h += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${RAD[KINDS[i]]}" fill="var(--accent)" opacity="0.9"/>`; });
      PRED.forEach((_, i) => { const tr = place(ALIGNED[i], t); h += `<circle cx="${tr[0].toFixed(1)}" cy="${tr[1].toFixed(1)}" r="${RAD[KINDS[i]]}" fill="none" stroke="${GREY}" stroke-width="2.4"/>`; });
      [['protein', 1, 30], ['DNA or RNA', 6, 135], ['ligand', 11, 270]].forEach(([lab, w, x]) => { h += `<circle cx="${x}" cy="236" r="${RAD[w]}" fill="var(--accent)"/>` + txt(x + 15, 236, 12.5, `${lab} $\\times ${w}$`, 1, { anchor: 'start', muted: true }); });
      h += txt(18, 258, 11.5, 'filled: predicted · ring: true · toy points', 1, { anchor: 'start', muted: true });
      sv3.innerHTML = h;
    };

    // 5 and 6: a distribution over 12 bins, with the true bin; training makes the true bin's probability grow, and the loss, minus its log, fall
    const P0 = [0.03, 0.05, 0.08, 0.11, 0.14, 0.15, 0.14, 0.1, 0.08, 0.06, 0.04, 0.02], P1 = [0.01, 0.01, 0.02, 0.03, 0.05, 0.08, 0.13, 0.52, 0.09, 0.03, 0.02, 0.01];
    const norm = (a) => { const t = a.reduce((x, y) => x + y, 0); return a.map((v) => v / t); };
    const D0 = norm(P0), D1 = norm(P1), TRUE = 7;
    const draw5 = (p, svg, axis, cartoon) => {
      const k = ramp(p, 0.4, 0.95), grow = ramp(p, 0.02, 0.3), x0 = cartoon ? 150 : 40, bw = cartoon ? 18 : 26, gap = cartoon ? 4 : 5, base = 200, hmax = 150;
      const dist = D0.map((v, i) => lerp(v, D1[i], k));
      let h = '';
      dist.forEach((v, i) => {
        const x = x0 + i * (bw + gap), ht = v * hmax * 1.3 * grow, isT = i === TRUE;
        h += `<rect x="${x}" y="${(base - ht).toFixed(1)}" width="${bw}" height="${ht.toFixed(1)}" rx="2" fill="${isT ? 'var(--plot-4)' : 'var(--plot-1)'}" opacity="${isT ? 1 : 0.8}"/>`;
      });
      const tx = x0 + TRUE * (bw + gap) + bw / 2, op = ramp(p, 0.1, 0.3);
      h += `<line x1="${x0 - 6}" y1="${base}" x2="${x0 + 12 * (bw + gap)}" y2="${base}" stroke="var(--muted)" stroke-width="1.5"/>`;
      h += `<polygon points="${tx},${base + 6} ${tx - 7},${base + 18} ${tx + 7},${base + 18}" fill="var(--plot-4)" opacity="${op.toFixed(2)}"/>` + txt(tx, base + 32, 13, 'the true bin', op, { bold: true });
      h += txt(x0 + 6 * (bw + gap), base + 56, 12.5, axis, 1, { muted: true });
      h += txt(x0 - 8, 22, 12.5, 'probability the head gives to each bin', 1, { anchor: 'start', muted: true });
      const pt = dist[TRUE], ls = -Math.log(pt), lop = ramp(p, 0.12, 0.3);
      h += txt(x0 - 8, 46, 17, `$\\text{loss} = -\\log p(\\text{true bin}) = \\textcolor{${PINK}}{\\mathbf{${ls.toFixed(1)}}}$`, lop, { anchor: 'start' });
      h += txt(x0 - 8, 70, 12.5, 'toy numbers: training makes the loss fall', lop * ramp(p, 0.4, 0.6), { anchor: 'start', muted: true });
      if (cartoon) {                                                                                           // the distogram: two tokens and the distance between them
        h += `<circle cx="38" cy="120" r="9" fill="var(--plot-2)"/><circle cx="112" cy="160" r="9" fill="var(--plot-2)"/><line x1="46" y1="124" x2="104" y2="156" stroke="var(--fg)" stroke-width="1.6" stroke-dasharray="4 3"/>`;
        h += txt(38, 100, 13, 'token $i$', 1, { muted: true }) + txt(112, 184, 13, 'token $j$', 1, { muted: true }) + txt(88, 132, 14, '$d$', 1, { muted: true });
      }
      svg.innerHTML = h;
    };

    // ---- state: one progress number for each drawing ----
    const KEYS = ['p3', 'p5', 'p6'], STEP_OF = { p3: 3, p5: 5, p6: 6 };
    const stateOf = (step) => Object.fromEntries(KEYS.map((k) => [k, step >= STEP_OF[k] ? 1 : 0]));
    const drawAll = (st) => { draw3(st.p3); draw5(st.p5, sv5, 'bins of the error', false); draw5(st.p6, sv6, 'bins of the distance (about 2 to 22 Å)', true); };
    let cur = stateOf(0), raf = 0;
    drawAll(cur);

    return {
      enter(step, animate) {
        frame.classList.toggle('instant', !animate);
        for (let k = 1; k <= 7; k++) frame.classList.toggle(`st-${k}`, k >= 2 && k <= 7 && k <= step);
        frame.classList.toggle('f-d', step === 3 || step === 4);
        frame.classList.toggle('f-c', step === 5);
        frame.classList.toggle('f-g', step === 6);
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; drawAll(cur); return; }
        const ms = [0, 300, 600, 6500, 600, 6500, 4500, 600][step], t0 = performance.now();
        return new Promise((done) => {
          const tick = (now) => {
            const u = Math.min(1, (now - t0) / ms);
            cur = Object.fromEntries(KEYS.map((k) => [k, from[k] + (to[k] - from[k]) * u]));
            drawAll(cur);
            if (u < 1) raf = requestAnimationFrame(tick); else done();
          };
          raf = requestAnimationFrame(tick);
        });
      },
      leave() { cancelAnimationFrame(raf); },
      destroy() { cancelAnimationFrame(raf); },
    };
  },
});
}
