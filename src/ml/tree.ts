// CART DecisionTreeClassifier for binary labels (gini impurity, deterministic
// tie-breaking: first feature, smallest threshold wins). Used for the
// orbit-vs-push gate, which is a *band* around the preferred distance —
// something a single logistic unit cannot represent, so tree depth directly
// controls enemy smarts.

export type TreeLabel = 0 | 1;

interface TreeNode {
  label: TreeLabel;
  feature: number;
  threshold: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

export class DecisionTreeClassifier {
  private readonly maxDepth: number;
  private readonly minSamplesSplit: number;
  private root: TreeNode = { label: 0, feature: -1, threshold: 0, left: null, right: null };

  constructor(maxDepth = 3, minSamplesSplit = 4) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
  }

  fit(X: number[][], y: number[]): this {
    const idx = X.map((_, i) => i);
    this.root = this.build(X, y, idx, 0);
    return this;
  }

  predictOne(x: number[]): TreeLabel {
    let node = this.root;
    while (node.left && node.right) {
      node = (x[node.feature] ?? 0) <= node.threshold ? node.left : node.right;
    }
    return node.label;
  }

  depth(): number {
    const walk = (n: TreeNode): number =>
      n.left && n.right ? 1 + Math.max(walk(n.left), walk(n.right)) : 0;
    return walk(this.root);
  }

  private build(X: number[][], y: number[], idx: number[], depth: number): TreeNode {
    let ones = 0;
    for (const i of idx) ones += (y[i] ?? 0) as number;
    const majority: TreeLabel = ones * 2 >= idx.length ? 1 : 0;
    if (depth >= this.maxDepth || idx.length < this.minSamplesSplit || ones === 0 || ones === idx.length) {
      return { label: majority, feature: -1, threshold: 0, left: null, right: null };
    }
    const d = (X[0] as number[]).length;
    let bestGain = 1e-12;
    let bestF = -1;
    let bestT = 0;
    const parent = gini(ones, idx.length - ones);
    for (let f = 0; f < d; f++) {
      const vals = idx.map((i) => (X[i] as number[])[f] ?? 0).sort((a, b) => a - b);
      for (let k = 1; k < vals.length; k++) {
        const a = vals[k - 1] as number;
        const c = vals[k] as number;
        if (c === a) continue;
        const t = (a + c) / 2;
        let l1 = 0;
        let ln = 0;
        for (const i of idx) {
          if (((X[i] as number[])[f] ?? 0) <= t) {
            ln++;
            l1 += (y[i] ?? 0) as number;
          }
        }
        if (ln === 0 || ln === idx.length) continue;
        const r1 = ones - l1;
        const rn = idx.length - ln;
        const gain = parent - (ln / idx.length) * gini(l1, ln - l1) - (rn / idx.length) * gini(r1, rn - r1);
        if (gain > bestGain) {
          bestGain = gain;
          bestF = f;
          bestT = t;
        }
      }
    }
    if (bestF < 0) {
      return { label: majority, feature: -1, threshold: 0, left: null, right: null };
    }
    const left: number[] = [];
    const right: number[] = [];
    for (const i of idx) {
      if (((X[i] as number[])[bestF] ?? 0) <= bestT) left.push(i);
      else right.push(i);
    }
    return {
      label: majority,
      feature: bestF,
      threshold: bestT,
      left: this.build(X, y, left, depth + 1),
      right: this.build(X, y, right, depth + 1),
    };
  }
}

function gini(ones: number, zeros: number): number {
  const n = ones + zeros;
  if (n === 0) return 0;
  const p = ones / n;
  return 1 - p * p - (1 - p) * (1 - p);
}
