// "Reference conformers provide local chemical geometry" (slide 22): how a reference conformer is made, shown on one molecule
// that is transformed in front of you (no flow diagram), then where it goes. The molecule is L-phosphoserine, the modified amino
// acid of the tokenization slide; its three states are RDKit's (data/conformer.js, written by tools/prep_conformer.py):
//
//   1  the chemical component: the flat drawing a SMILES string gives (atoms and bonds, no 3D coordinates)
//   2  distance geometry: the atoms are placed in 3D to fit the bond lengths, angles and distances; a rough shape
//   3  ETKDGv3: the torsion angles are pulled towards the values seen in experiments; this is the reference conformer. A live
//      readout follows one torsion (N-CA-CB-OG) as it goes from the rough value to the final one
//   4  a random rotation and translation, x'_l = R x_l + t (one draw, seed 7): its orientation carries no information
//   5  where it goes: the atom attention encoder of the input embedder, with its positions, elements, charges and atom names
//
// Checked against the supplement (Methods 2.8: given a CCD code or SMILES string the conformer is typically generated with RDKit
// ETKDGv3, falling back to the CCD ideal coordinates; ref_pos has a random rotation and translation applied. Alg. 5 and Methods
// 3.1.1: the reference conformer is embedded by the atom attention encoder, from ref_pos, ref_element, ref_charge and
// ref_atom_name_chars for each atom and the offsets and inverse squared distances between atoms for each pair). ETKDGv3 is
// "distance geometry and experimental torsional-angle preferences" (the supplement's reference [26]). The three states are
// RDKit's; the frames between them are interpolated positions, not RDKit's path. The charges are RDKit's formal charges of the
// neutral molecule (all 0).
{
const D = window.DATA.conformer;
const ramp = (p, a, b) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };   // smoothstep
const mix = (hex, k) => {   // k > 0 towards white, k < 0 towards black
  const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255];
  return `#${c.map((x) => Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k)).toString(16).padStart(2, '0')).join('')}`;
};
const rng = (seed) => () => {   // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const SEED = 7;   // the random rotation and translation of step 4

// ---- a little 3D: rotations as matrices, interpolated through quaternions ([x, y, z, w]) ----
const matOf = ([x, y, z, w]) => [
  [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
const quatAxis = ([ax, ay, az], t) => { const n = Math.hypot(ax, ay, az), s = Math.sin(t / 2) / n; return [ax * s, ay * s, az * s, Math.cos(t / 2)]; };
const qmul = ([x1, y1, z1, w1], [x2, y2, z2, w2]) => [w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2, w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2];
const slerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map((v) => -v); d = -d; }
  if (d > 0.9995) return a.map((v, i) => v + (b[i] - v) * t);
  const th = Math.acos(d), s = Math.sin(th), k0 = Math.sin((1 - t) * th) / s, k1 = Math.sin(t * th) / s;
  return a.map((v, i) => v * k0 + b[i] * k1);
};
const QI = [0, 0, 0, 1];
const Q0 = qmul(quatAxis([1, 0, 0], -0.55), quatAxis([0, 1, 0], 0.5));   // the tilt the molecule is shown in once it is 3D
const rand = rng(SEED);
let Q1;   // one uniformly random rotation (Shoemake), far enough from the first that the change shows
for (;;) {
  const u = [rand(), rand(), rand()];
  Q1 = [Math.sqrt(1 - u[0]) * Math.sin(2 * Math.PI * u[1]), Math.sqrt(1 - u[0]) * Math.cos(2 * Math.PI * u[1]), Math.sqrt(u[0]) * Math.sin(2 * Math.PI * u[2]), Math.sqrt(u[0]) * Math.cos(2 * Math.PI * u[2])];
  if (Math.abs(Q0[0] * Q1[0] + Q0[1] * Q1[1] + Q0[2] * Q1[2] + Q0[3] * Q1[3]) < 0.6) break;
}
const TXY = [-(90 + 40 * rand()), (rand() < 0.5 ? -1 : 1) * (10 + 25 * rand())];   // the random translation, drawn big, in map units (to the left, clear of the equation)

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dihedral = (p0, p1, p2, p3) => {   // degrees, the usual sign
  const b0 = sub(p0, p1), b1 = sub(p2, p1), b2 = sub(p3, p2), n = Math.hypot(...b1), u1 = b1.map((v) => v / n);
  const v = sub(b0, u1.map((c) => c * dot(b0, u1))), w = sub(b2, u1.map((c) => c * dot(b2, u1)));
  return (Math.atan2(dot(cross(u1, v), w), dot(v, w)) * 180) / Math.PI;
};
const signed = (deg) => `${deg < 0 ? '−' : ''}${Math.abs(Math.round(deg))}°`;
const TOR = D.torsions[0];   // N-CA-CB-OG, the torsion that changes most from the rough shape to the final one

const CAPTIONS = [
  'A chemical component comes as a CCD code or a SMILES string: atoms and bonds, with no 3D coordinates.',
  'RDKit first places the atoms in 3D so that bond lengths, angles and distances fit. This distance-geometry shape is rough.',
  'Then the torsion angles are pushed towards the values seen in experimental structures (ETKDGv3). That is the reference conformer.',
  'Finally it gets a random rotation and translation, so no particular orientation means anything.',
  'Its atom positions, elements, charges and names go to the atom attention encoder, in the input embedder.',
];

AF3.kinds.conformer = (s) => ({
  steps: 5,
  notes: s.notes || '',
  mount(frame, { css, esc, palette: P }) {
    css(AF3.textCss + AF3.arch.miniCss + `
      .cf-wrap { position: absolute; left: 4.2%; right: 4.2%; top: 14.5%; }
      .cf-wrap svg { display: block; width: 100%; height: auto; overflow: visible; }
      .cf-t { font-family: Lato, "Helvetica Neue", Arial, sans-serif; dominant-baseline: central; fill: var(--fg); }
      .cf-t.muted { fill: var(--muted); }
      .cf-t.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
      .cf-caps { position: absolute; left: 4.2%; right: 31%; top: 77.5%; height: 15%; }
      .cf-cap { position: absolute; left: 0; right: 0; top: 0; margin: 0; font-size: var(--t-small); line-height: 1.3; font-weight: 600; }
    `);
    const title = AF3.texts(s).find((t) => t.ph === 'title');
    const EL = P.el, color = (el) => EL[el] || EL.other;
    const uid = `cf${Math.floor(Math.random() * 1e6)}`;

    // every drawn thing in the side widgets is registered with the step it belongs to (a-e), the span of that step's progress over
    // which it fades in, and optionally the span over which it fades out again (a later step)
    const meta = [];
    const reg = (tag, attrs, comp, a, b, inner = '', out = null) => {
      meta.push({ comp, a, b, out });
      return `<${tag} data-k="${meta.length - 1}" ${attrs} opacity="0">${inner}</${tag}>`;
    };
    const text = (x, y, size, str, comp, a, b, o = {}) =>
      reg('text', `x="${x}" y="${y}" font-size="${size}" class="cf-t${o.cls ? ' ' + o.cls : ''}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.bold ? ' font-weight="700"' : ''}${o.fill ? ` style="fill:${o.fill}"` : ''}${o.id ? ` id="${uid}-${o.id}"` : ''}`, comp, a, b, str, o.out);
    const PILL = 'fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="color-mix(in srgb, var(--accent) 55%, transparent)" stroke-width="1.5"';

    const CX = 470, CY = 182, SC = 50;   // where the molecule sits, and its size in map units per angstrom
    let g = '';
    // ---- step a: what the component is ----
    const gone = { comp: 'b', a: 0.05, b: 0.3 };
    g += text(715, 64, 18, 'chemical component', 'a', 0.3, 0.5, { cls: 'muted', out: gone });
    g += text(715, 96, 26, 'phosphoserine (SEP)', 'a', 0.34, 0.54, { bold: true, out: gone });
    g += text(715, 128, 17, 'a CCD code or a SMILES string:', 'a', 0.42, 0.62, { cls: 'muted', out: gone });
    g += text(715, 160, 17, 'N[C@@H](COP(=O)(O)O)C(=O)O', 'a', 0.48, 0.68, { cls: 'mono', out: gone });
    g += text(715, 200, 18, 'atoms and bonds only', 'a', 0.6, 0.8, { bold: true, fill: 'var(--accent)', out: gone });
    // ---- step c: the torsion readout, and the fallback ----
    const gone3 = { comp: 'd', a: 0.05, b: 0.3 };
    const tn = TOR.atoms.map((i) => D.atoms[i].name).join('–');
    g += text(715, 88, 18, 'torsion angle', 'c', 0.15, 0.35, { cls: 'muted', out: gone3 });
    g += text(715, 118, 22, tn, 'c', 0.15, 0.35, { bold: true, out: gone3 });
    g += text(715, 176, 54, signed(TOR.dg), 'c', 0.15, 0.35, { bold: true, fill: 'var(--accent)', id: 'tor', out: gone3 });
    g += text(715, 222, 17, `from ${signed(TOR.dg)} to ${signed(TOR.et)}`, 'c', 0.5, 0.7, { cls: 'muted', out: gone3 });
    g += text(CX, 352, 16, 'if RDKit fails, AF3 uses the CCD’s ideal coordinates', 'c', 0.6, 0.85, { anchor: 'middle', cls: 'muted', out: { comp: 'd', a: 0, b: 0.2 } });
    // ---- step d: R and t ----
    const gone4 = { comp: 'e', a: 0, b: 0.25 };
    const mathBox = (x, y, size, str, o, comp, a, b, out) => reg('foreignObject', AF3.foAttrs(x, y, size, o), comp, a, b, AF3.foInner(AF3.rich(str, esc), size, o), out);
    g += mathBox(800, 96, 34, "$x' = R\\,x + t$", {}, 'd', 0.55, 0.8, gone4);
    g += mathBox(800, 136, 17, '$R$: a random rotation', { muted: true }, 'd', 0.62, 0.86, gone4);
    g += mathBox(800, 160, 17, '$t$: a random translation', { muted: true }, 'd', 0.66, 0.9, gone4);
    // ---- step e: where it goes ----
    const BX = 500, BY = 64, BW = 470, BH = 258;
    g += reg('path', `d="M352 ${CY} L${BX - 18} ${CY}" fill="none" stroke="var(--muted)" stroke-width="3" stroke-linecap="round"`, 'e', 0.35, 0.55);
    g += reg('polygon', `points="${BX - 6},${CY} ${BX - 17},${CY - 7} ${BX - 17},${CY + 7}" fill="var(--muted)"`, 'e', 0.5, 0.62);
    g += reg('rect', `x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="14" fill="color-mix(in srgb, var(--fg) 3%, transparent)" stroke="color-mix(in srgb, var(--muted) 38%, transparent)" stroke-width="1.5"`, 'e', 0.3, 0.5);
    g += text(BX + BW / 2, BY + 34, 26, 'Atom attention encoder', 'e', 0.4, 0.6, { anchor: 'middle', bold: true });
    g += text(BX + BW / 2, BY + 64, 18, 'in the input embedder', 'e', 0.44, 0.64, { anchor: 'middle', cls: 'muted' });
    [['atom positions', 0, 0], ['element', 1, 0], ['charge', 0, 1], ['atom name', 1, 1]].forEach(([label, col, row], i) => {
      const a0 = 0.55 + i * 0.07, x = BX + 30 + col * 215, y = BY + 100 + row * 52;
      g += reg('rect', `x="${x}" y="${y}" width="195" height="38" rx="19" ${PILL}`, 'e', a0, a0 + 0.12) + text(x + 97.5, y + 20, 18, label, 'e', a0 + 0.02, a0 + 0.14, { anchor: 'middle' });
    });
    g += text(BX + BW / 2, BY + 224, 17, 'and the offsets and distances between atoms', 'e', 0.85, 1, { anchor: 'middle', cls: 'muted' });

    const defs = ['C', 'N', 'O', 'P'].map((el) => `<radialGradient id="${uid}-${el}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${mix(color(el), 0.55)}"/><stop offset=".55" stop-color="${color(el)}"/><stop offset="1" stop-color="${mix(color(el), -0.3)}"/></radialGradient>`).join('');

    frame.innerHTML = `<h2 class="deck-heading">${esc(AF3.plain(title.paras[0]))}</h2>
      <div class="cf-wrap"><svg viewBox="0 0 1000 370" role="img" aria-label="A molecule drawn flat, placed in 3D by distance geometry, refined into a reference conformer, randomly rotated and moved, and passed to the atom attention encoder"><defs>${defs}</defs><g id="${uid}-mol"></g>${g}</svg></div>
      <div class="cf-caps">${CAPTIONS.map((c, i) => `<p class="cf-cap reveal-in" data-show="${i + 1}">${esc(c)}</p>`).join('')}</div>
      ${AF3.arch.mini(s.n, AF3.plain(title.paras[0]).length, 77.5)}`;

    const els = [...frame.querySelectorAll('[data-k]')];
    const gMol = frame.querySelector(`#${uid}-mol`), tor = frame.querySelector(`#${uid}-tor`);
    const A = D.atoms, B = D.bonds;

    // the molecule, ball and stick, drawn far to near. pts: positions in angstroms; R: rotation; (cx, cy): where it sits; sc: map units
    // per angstrom; letters: 0-1, how visible the element letters are (they are only on the flat drawing); ghost: hollow, for where it was
    const molSvg = (pts, R, cx, cy, sc, { letters = 0, ghost = false } = {}) => {
      const q = pts.map((p, i) => ({
        X: cx + sc * (R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2]), Y: cy - sc * (R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2]),
        Z: R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2], el: A[i].el, i,
      }));
      const items = [...B.map((b) => ({ z: (q[b.a].Z + q[b.b].Z) / 2 - 0.2, bond: b })), ...q.map((p) => ({ z: p.Z, atom: p }))].sort((a, b) => a.z - b.z);
      return items.map((it) => {
        if (it.bond) {
          const p = q[it.bond.a], r = q[it.bond.b], d = Math.hypot(r.X - p.X, r.Y - p.Y) || 1, nx = -(r.Y - p.Y) / d * 0.06 * sc, ny = (r.X - p.X) / d * 0.06 * sc;
          const ln = (dx, dy, w) => `<path d="M${(p.X + dx).toFixed(1)} ${(p.Y + dy).toFixed(1)} L${(r.X + dx).toFixed(1)} ${(r.Y + dy).toFixed(1)}" stroke="var(--muted)" stroke-width="${w.toFixed(1)}" stroke-linecap="round" fill="none"/>`;
          return it.bond.order === 2 ? ln(nx, ny, 0.06 * sc) + ln(-nx, -ny, 0.06 * sc) : ln(0, 0, (ghost ? 0.05 : 0.09) * sc);
        }
        const p = it.atom, r = (p.el === 'P' ? 0.24 : 0.19) * sc * (1 + p.Z * 0.04);
        if (ghost) return `<circle cx="${p.X.toFixed(1)}" cy="${p.Y.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="var(--muted)" stroke-width="1.5"/>`;
        return `<circle cx="${p.X.toFixed(1)}" cy="${p.Y.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#${uid}-${p.el})"/>`
          + (letters > 0.02 ? `<text x="${p.X.toFixed(1)}" y="${(p.Y + 1).toFixed(1)}" font-size="${(0.32 * sc).toFixed(1)}" text-anchor="middle" font-weight="700" class="cf-t" style="fill:#fff" opacity="${letters.toFixed(2)}">${p.el}</text>` : '');
      }).join('');
    };

    const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const screen = (R, p, cx, cy, sc) => [cx + sc * (R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2]), cy - sc * (R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2])];
    const draw = (st) => {
      els.forEach((el) => {
        const m = meta[+el.dataset.k];
        el.setAttribute('opacity', (ramp(st[m.comp], m.a, m.b) * (m.out ? 1 - ramp(st[m.out.comp], m.out.a, m.out.b) : 1)).toFixed(3));
      });
      const lift = ramp(st.b, 0.1, 0.85), refine = ramp(st.c, 0.1, 0.8), turn = ramp(st.d, 0.15, 0.8), go = ramp(st.e, 0, 0.6);
      // the positions: the flat drawing, then the rough 3D shape, then the final conformer
      const pts = A.map((a) => lerp3(lerp3([a.xy[0], a.xy[1], 0], a.dg, lift), a.et, refine));
      const R = matOf(slerp(slerp(QI, Q0, lift), Q1, turn)), R0 = matOf(Q0);
      const cx = CX + TXY[0] * turn + (210 - CX - TXY[0]) * go, cy = CY + TXY[1] * turn + (190 - CY - TXY[1]) * go, sc = SC * (1 - 0.36 * go);
      let html = '';
      const ghost = 0.45 * ramp(st.d, 0.05, 0.2) * (1 - ramp(st.e, 0, 0.3));
      if (ghost > 0.01) html += `<g opacity="${ghost.toFixed(2)}">${molSvg(pts, R0, CX, CY, SC, { ghost: true })}</g>`;
      html += `<g opacity="${ramp(st.a, 0, 0.3).toFixed(3)}">${molSvg(pts, R, cx, cy, sc, { letters: 1 - ramp(lift, 0, 0.4) })}</g>`;
      // the four atoms of the torsion, ringed while it is being read
      const ring = ramp(st.c, 0, 0.15) * (1 - ramp(st.d, 0, 0.2));
      if (ring > 0.01) {
        html += TOR.atoms.map((i) => { const [X, Y] = screen(R, pts[i], cx, cy, sc);
          return `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${(0.34 * sc).toFixed(1)}" fill="none" stroke="var(--accent)" stroke-width="3" opacity="${ring.toFixed(2)}"/>`; }).join('');
      }
      // the molecule's own axes, turning with it while R is applied
      const axes = ramp(st.d, 0, 0.15) * (1 - ramp(st.e, 0, 0.2));
      if (axes > 0.01) {
        html += [[[1, 0, 0], P.rainbow[5]], [[0, 1, 0], P.rainbow[2]], [[0, 0, 1], P.rainbow[0]]].map(([v, c]) => {
          const [x, y] = screen(R, v.map((k) => k * 2.2), 0, 0, sc);
          return `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)} L${(cx + x).toFixed(1)} ${(cy + y).toFixed(1)}" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity="${(0.9 * axes).toFixed(2)}"/>`;
        }).join('');
      }
      gMol.innerHTML = html;
      tor.textContent = signed(dihedral(...TOR.atoms.map((i) => pts[i])));
    };
    const KEYS = ['a', 'b', 'c', 'd', 'e'];
    const stateOf = (step) => Object.fromEntries(KEYS.map((k, i) => [k, step >= i + 1 ? 1 : 0]));
    let cur = stateOf(0), raf = 0;
    draw(cur);

    return {
      enter(step, animate) {
        Deck.show(frame, step, animate);
        cancelAnimationFrame(raf);
        const from = { ...cur }, to = stateOf(step);
        if (!animate) { cur = to; draw(cur); return; }
        const ms = [0, 4200, 4600, 4800, 4800, 4200][step], t0 = performance.now();
        return new Promise((done) => {
          const tick = (now) => {
            const uu = Math.min(1, (now - t0) / ms);
            cur = Object.fromEntries(KEYS.map((k) => [k, from[k] + (to[k] - from[k]) * uu]));
            draw(cur);
            if (uu < 1) raf = requestAnimationFrame(tick); else done();
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
