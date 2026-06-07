/**
 * FreeBioStore Molecule SDK
 * SMILES parser + molecular property calculator
 */

// Periodic table subset: symbol -> { atomicWeight, valence, hBondDonor, hBondAcceptor }
const ELEMENTS: Record<string, { weight: number; valence: number; donor: boolean; acceptor: boolean }> = {
  C:  { weight: 12.011, valence: 4, donor: false, acceptor: false },
  N:  { weight: 14.007, valence: 3, donor: true,  acceptor: true  },
  O:  { weight: 15.999, valence: 2, donor: true,  acceptor: true  },
  S:  { weight: 32.065, valence: 2, donor: false, acceptor: false },
  P:  { weight: 30.974, valence: 3, donor: false, acceptor: true  },
  F:  { weight: 18.998, valence: 1, donor: false, acceptor: true  },
  Cl: { weight: 35.453, valence: 1, donor: false, acceptor: false },
  Br: { weight: 79.904, valence: 1, donor: false, acceptor: false },
  I:  { weight: 126.90, valence: 1, donor: false, acceptor: false },
  H:  { weight: 1.008,  valence: 1, donor: false, acceptor: false },
};

// Wildman-Crippen logP atom contributions (simplified)
const LOGP_CONTRIBUTIONS: Record<string, number> = {
  C: 0.1441, N: -0.7567, O: -0.2893, S: 0.6237, P: 0.2980,
  F: 0.4118, Cl: 0.6895, Br: 0.8813, I: 1.0500, H: 0.1230,
};

// TPSA contributions per polar atom (Ertl 2000 simplified)
const TPSA_CONTRIBUTIONS: Record<string, number> = {
  N_amine: 26.02, N_amide: 29.10, N_aromatic: 12.89,
  O_hydroxyl: 20.23, O_ether: 9.23, O_carbonyl: 17.07,
  S: 25.30, P: 34.14,
};

interface ParsedAtom {
  element: string;
  aromatic: boolean;
  charge: number;
  hydrogens: number;
  ringClosures: number[];
  branchDepth: number;
}

interface Bond {
  from: number;
  to: number;
  order: number;
}

interface AtomPosition {
  element: string;
  x: number;
  y: number;
}

export class Molecule {
  private _atoms: ParsedAtom[] = [];
  private _bonds: Bond[] = [];
  private _smiles: string;
  private _positions: AtomPosition[] | null = null;

  constructor(smiles: string) {
    this._smiles = smiles;
    this.parse(smiles);
    this.addImplicitHydrogens();
  }

  // --- SMILES Parser ---

  private parse(smiles: string): void {
    const stack: number[] = [];
    const ringMap = new Map<number, number>();
    let current = -1;
    let nextBondOrder = 1;
    let i = 0;

    while (i < smiles.length) {
      const ch = smiles[i];

      // Branch open/close
      if (ch === '(') { stack.push(current); i++; continue; }
      if (ch === ')') { current = stack.pop()!; i++; continue; }

      // Bond order
      if (ch === '=') { nextBondOrder = 2; i++; continue; }
      if (ch === '#') { nextBondOrder = 3; i++; continue; }
      if (ch === '-') { nextBondOrder = 1; i++; continue; }
      if (ch === ':') { nextBondOrder = 1; i++; continue; } // aromatic bond

      // Ring closure digit
      if (ch >= '0' && ch <= '9') {
        const ring = parseInt(ch);
        if (ringMap.has(ring)) {
          const other = ringMap.get(ring)!;
          this._bonds.push({ from: other, to: current, order: nextBondOrder });
          ringMap.delete(ring);
        } else {
          ringMap.set(ring, current);
        }
        nextBondOrder = 1;
        i++;
        continue;
      }

      // Bracket atom [...]
      if (ch === '[') {
        const end = smiles.indexOf(']', i);
        if (end === -1) throw new Error('Unclosed bracket in SMILES');
        const bracket = smiles.slice(i + 1, end);
        const atom = this.parseBracketAtom(bracket);
        const idx = this._atoms.length;
        this._atoms.push(atom);
        if (current >= 0) this._bonds.push({ from: current, to: idx, order: nextBondOrder });
        current = idx;
        nextBondOrder = 1;
        i = end + 1;
        continue;
      }

      // Organic subset atoms
      const aromatic = ch === ch.toLowerCase() && 'cnops'.includes(ch);
      let element = '';

      // Two-letter elements
      if (i + 1 < smiles.length) {
        const two = smiles.slice(i, i + 2);
        if (['Cl', 'Br'].includes(two)) {
          element = two;
          i += 2;
        }
      }
      if (!element) {
        const upper = ch.toUpperCase();
        if (ELEMENTS[upper]) {
          element = upper;
          i++;
        } else {
          i++; continue; // skip unknown
        }
      }

      const atom: ParsedAtom = {
        element, aromatic, charge: 0, hydrogens: -1,
        ringClosures: [], branchDepth: stack.length,
      };
      const idx = this._atoms.length;
      this._atoms.push(atom);
      if (current >= 0) {
        const order = (aromatic && this._atoms[current]?.aromatic) ? 1 : nextBondOrder;
        this._bonds.push({ from: current, to: idx, order });
      }
      current = idx;
      nextBondOrder = 1;
    }
  }

  private parseBracketAtom(s: string): ParsedAtom {
    let element = '';
    let i = 0;
    if (s[i] >= 'A' && s[i] <= 'Z') {
      element = s[i]; i++;
      if (i < s.length && s[i] >= 'a' && s[i] <= 'z') { element += s[i]; i++; }
    } else if (s[i] >= 'a' && s[i] <= 'z') {
      element = s[i].toUpperCase(); i++;
    }
    let charge = 0; let hydrogens = 0;
    while (i < s.length) {
      if (s[i] === 'H') {
        i++;
        hydrogens = (i < s.length && s[i] >= '0' && s[i] <= '9') ? parseInt(s[i++]) : 1;
      } else if (s[i] === '+') { charge++; i++; }
      else if (s[i] === '-') { charge--; i++; }
      else i++;
    }
    return { element, aromatic: false, charge, hydrogens, ringClosures: [], branchDepth: 0 };
  }

  private addImplicitHydrogens(): void {
    const bondCounts = new Array(this._atoms.length).fill(0);
    for (const b of this._bonds) {
      bondCounts[b.from] += b.order;
      bondCounts[b.to] += b.order;
    }
    for (let i = 0; i < this._atoms.length; i++) {
      const atom = this._atoms[i];
      if (atom.hydrogens >= 0) continue; // explicit H count from bracket
      const el = ELEMENTS[atom.element];
      if (!el) { atom.hydrogens = 0; continue; }
      const needed = el.valence - bondCounts[i] + atom.charge;
      atom.hydrogens = Math.max(0, needed);
    }
  }

  // --- Computed Properties ---

  get molecularWeight(): number {
    let mw = 0;
    for (const a of this._atoms) {
      const el = ELEMENTS[a.element];
      if (el) mw += el.weight + (a.hydrogens > 0 ? a.hydrogens * ELEMENTS.H.weight : 0);
    }
    return Math.round(mw * 1000) / 1000;
  }

  get formula(): string {
    const counts: Record<string, number> = {};
    for (const a of this._atoms) {
      counts[a.element] = (counts[a.element] || 0) + 1;
      if (a.hydrogens > 0) counts['H'] = (counts['H'] || 0) + a.hydrogens;
    }
    // Hill order: C first, H second, then alphabetical
    const parts: string[] = [];
    const order = ['C', 'H', ...Object.keys(counts).filter(e => e !== 'C' && e !== 'H').sort()];
    for (const el of order) {
      if (!counts[el]) continue;
      parts.push(counts[el] === 1 ? el : `${el}${counts[el]}`);
    }
    return parts.join('');
  }

  get logP(): number {
    let lp = 0;
    for (const a of this._atoms) {
      lp += LOGP_CONTRIBUTIONS[a.element] || 0;
      if (a.hydrogens > 0) lp += a.hydrogens * LOGP_CONTRIBUTIONS.H;
    }
    return Math.round(lp * 100) / 100;
  }

  get hBondDonors(): number {
    let count = 0;
    for (const a of this._atoms) {
      if ((a.element === 'N' || a.element === 'O') && a.hydrogens > 0) count += a.hydrogens;
    }
    return count;
  }

  get hBondAcceptors(): number {
    let count = 0;
    for (const a of this._atoms) {
      if (ELEMENTS[a.element]?.acceptor) count++;
    }
    return count;
  }

  get rotatableBonds(): number {
    let count = 0;
    for (const b of this._bonds) {
      if (b.order !== 1) continue;
      const a1 = this._atoms[b.from], a2 = this._atoms[b.to];
      // Non-terminal, non-ring single bonds
      const deg1 = this._bonds.filter(x => x.from === b.from || x.to === b.from).length;
      const deg2 = this._bonds.filter(x => x.from === b.to || x.to === b.to).length;
      if (deg1 > 1 && deg2 > 1 && !a1.aromatic && !a2.aromatic) count++;
    }
    return count;
  }

  get tpsa(): number {
    let area = 0;
    for (const a of this._atoms) {
      if (a.element === 'N') {
        area += a.hydrogens > 0 ? TPSA_CONTRIBUTIONS.N_amine : (a.aromatic ? TPSA_CONTRIBUTIONS.N_aromatic : TPSA_CONTRIBUTIONS.N_amide);
      } else if (a.element === 'O') {
        area += a.hydrogens > 0 ? TPSA_CONTRIBUTIONS.O_hydroxyl : TPSA_CONTRIBUTIONS.O_ether;
      } else if (a.element === 'S') {
        area += TPSA_CONTRIBUTIONS.S;
      } else if (a.element === 'P') {
        area += TPSA_CONTRIBUTIONS.P;
      }
    }
    return Math.round(area * 100) / 100;
  }

  get ringCount(): number {
    // SSSR = bonds - atoms + connected components (for single component, +1)
    return Math.max(0, this._bonds.length - this._atoms.length + 1);
  }

  get lipinskiRule(): { pass: boolean; violations: string[] } {
    const violations: string[] = [];
    if (this.molecularWeight > 500) violations.push('MW > 500');
    if (this.logP > 5) violations.push('logP > 5');
    if (this.hBondDonors > 5) violations.push('HBD > 5');
    if (this.hBondAcceptors > 10) violations.push('HBA > 10');
    return { pass: violations.length === 0, violations };
  }

  // --- Atom/Bond Access ---

  get atoms(): AtomPosition[] {
    if (!this._positions) this._positions = this.layout();
    return this._positions;
  }

  get bonds(): { from: number; to: number; order: number }[] {
    return this._bonds.map(b => ({ ...b }));
  }

  // --- 2D Layout (force-directed, simplified) ---

  private layout(): AtomPosition[] {
    const n = this._atoms.length;
    if (n === 0) return [];
    const pos = this._atoms.map((_, i) => ({
      x: Math.cos((2 * Math.PI * i) / n) * n * 15,
      y: Math.sin((2 * Math.PI * i) / n) * n * 15,
    }));

    const idealLen = 40;
    for (let iter = 0; iter < 100; iter++) {
      const fx = new Array(n).fill(0);
      const fy = new Array(n).fill(0);

      // Repulsion between all pairs
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = pos[i].x - pos[j].x;
          const dy = pos[i].y - pos[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const force = 500 / (dist * dist);
          fx[i] += (dx / dist) * force;
          fy[i] += (dy / dist) * force;
          fx[j] -= (dx / dist) * force;
          fy[j] -= (dy / dist) * force;
        }
      }

      // Attraction along bonds
      for (const b of this._bonds) {
        const dx = pos[b.to].x - pos[b.from].x;
        const dy = pos[b.to].y - pos[b.from].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const force = (dist - idealLen) * 0.1;
        fx[b.from] += (dx / dist) * force;
        fy[b.from] += (dy / dist) * force;
        fx[b.to] -= (dx / dist) * force;
        fy[b.to] -= (dy / dist) * force;
      }

      const damping = 0.85;
      for (let i = 0; i < n; i++) {
        pos[i].x += fx[i] * damping;
        pos[i].y += fy[i] * damping;
      }
    }

    return this._atoms.map((a, i) => ({
      element: a.element,
      x: Math.round(pos[i].x * 100) / 100,
      y: Math.round(pos[i].y * 100) / 100,
    }));
  }

  // --- Export ---

  toJSON(): object {
    return {
      smiles: this._smiles,
      formula: this.formula,
      molecularWeight: this.molecularWeight,
      logP: this.logP,
      hBondDonors: this.hBondDonors,
      hBondAcceptors: this.hBondAcceptors,
      rotatableBonds: this.rotatableBonds,
      tpsa: this.tpsa,
      ringCount: this.ringCount,
      lipinski: this.lipinskiRule,
      atoms: this.atoms,
      bonds: this.bonds,
    };
  }

  toSVG(width: number, height: number): string {
    const positions = this.atoms;
    if (positions.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`;

    // Compute bounding box and scale
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of positions) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const pad = 30;
    const sx = (x: number) => pad + ((x - minX) / rangeX) * (width - 2 * pad);
    const sy = (y: number) => pad + ((y - minY) / rangeY) * (height - 2 * pad);

    const COLORS: Record<string, string> = {
      C: '#333', N: '#3050F8', O: '#FF0D0D', S: '#FFFF30',
      P: '#FF8000', F: '#90E050', Cl: '#1FF01F', Br: '#A62929', I: '#940094', H: '#999',
    };

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#fff">`;

    // Bonds
    for (const b of this._bonds) {
      const x1 = sx(positions[b.from].x), y1 = sy(positions[b.from].y);
      const x2 = sx(positions[b.to].x), y2 = sy(positions[b.to].y);
      if (b.order === 1) {
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#666" stroke-width="2"/>`;
      } else {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ox = (-dy / len) * 3, oy = (dx / len) * 3;
        svg += `<line x1="${x1 + ox}" y1="${y1 + oy}" x2="${x2 + ox}" y2="${y2 + oy}" stroke="#666" stroke-width="2"/>`;
        svg += `<line x1="${x1 - ox}" y1="${y1 - oy}" x2="${x2 - ox}" y2="${y2 - oy}" stroke="#666" stroke-width="2"/>`;
        if (b.order === 3) {
          svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#666" stroke-width="2"/>`;
        }
      }
    }

    // Atoms
    for (const p of positions) {
      const x = sx(p.x), y = sy(p.y);
      const color = COLORS[p.element] || '#333';
      if (p.element !== 'C') {
        svg += `<circle cx="${x}" cy="${y}" r="12" fill="#fff"/>`;
        svg += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="14" font-weight="bold" fill="${color}">${p.element}</text>`;
      }
    }

    svg += '</svg>';
    return svg;
  }
}
