# @freebiostore/sdk

FreeBioStore SDK -- SMILES parser, molecular property calculator, and drug-likeness analysis.

## Installation

```bash
npm install @freebiostore/sdk
```

## Molecule Analyzer

Parse SMILES strings and compute molecular properties with zero dependencies.

```typescript
import { Molecule } from '@freebiostore/sdk';

// Caffeine
const mol = new Molecule('Cn1cnc2c1c(=O)n(c(=O)n2C)C');

console.log(mol.formula);          // "C8H10N4O2"
console.log(mol.molecularWeight);  // 194.19
console.log(mol.logP);             // Wildman-Crippen estimate
console.log(mol.hBondDonors);      // 0
console.log(mol.hBondAcceptors);   // 6
console.log(mol.tpsa);             // topological polar surface area
console.log(mol.ringCount);        // 2
```

### Drug-Likeness (Lipinski Rule of Five)

```typescript
const lipinski = mol.lipinskiRule;
console.log(lipinski.pass);        // true
console.log(lipinski.violations);  // []

// A large molecule might fail:
const big = new Molecule('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC');
console.log(big.lipinskiRule);
// { pass: false, violations: ['logP > 5'] }
```

### Structure Access

```typescript
// Atom positions (2D layout)
for (const atom of mol.atoms) {
  console.log(`${atom.element} at (${atom.x}, ${atom.y})`);
}

// Bond connectivity
for (const bond of mol.bonds) {
  console.log(`${bond.from} -> ${bond.to} (order ${bond.order})`);
}
```

### Export

```typescript
// Full JSON with all properties
const data = mol.toJSON();

// SVG rendering
const svg = mol.toSVG(400, 300);
document.getElementById('viewer')!.innerHTML = svg;
```

### All Properties

| Property | Type | Description |
|----------|------|-------------|
| `molecularWeight` | `number` | Sum of atomic masses including implicit H |
| `formula` | `string` | Hill-order molecular formula (e.g. "C8H10N4O2") |
| `logP` | `number` | Wildman-Crippen partition coefficient estimate |
| `hBondDonors` | `number` | N-H and O-H count |
| `hBondAcceptors` | `number` | N, O, F count |
| `rotatableBonds` | `number` | Non-terminal, non-ring single bonds |
| `tpsa` | `number` | Topological polar surface area (Ertl) |
| `ringCount` | `number` | Smallest set of smallest rings |
| `lipinskiRule` | `object` | `{ pass: boolean, violations: string[] }` |
| `atoms` | `array` | `{ element, x, y }[]` -- 2D coordinates |
| `bonds` | `array` | `{ from, to, order }[]` -- connectivity |

## License

MIT
