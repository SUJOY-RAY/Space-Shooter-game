// KNeighborsClassifier: memorizes dodge demonstrations and replays the
// majority dodge side of the k nearest bullet patterns. Deterministic
// tie-breaking (smallest label wins) keeps brains reproducible.

export class KNeighborsClassifier {
  private readonly k: number;
  private xs: number[][] = [];
  private ys: number[] = [];

  constructor(k = 7) {
    this.k = k;
  }

  fit(X: number[][], y: number[]): this {
    this.xs = X.map((r) => [...r]);
    this.ys = [...y];
    return this;
  }

  get size(): number {
    return this.xs.length;
  }

  predictOne(x: number[]): number {
    const n = this.xs.length;
    if (n === 0) return 0;
    const order = this.xs.map((row, i) => {
      let s = 0;
      for (let j = 0; j < row.length; j++) {
        const delta = (row[j] ?? 0) - (x[j] ?? 0);
        s += delta * delta;
      }
      return { d: s, y: this.ys[i] ?? 0, i };
    });
    order.sort((a, b) => a.d - b.d || a.y - b.y || a.i - b.i);
    const votes = new Map<number, number>();
    const take = Math.min(this.k, n);
    for (let r = 0; r < take; r++) {
      const v = order[r] as { d: number; y: number; i: number };
      votes.set(v.y, (votes.get(v.y) ?? 0) + 1);
    }
    let best = 0;
    let bestCount = -1;
    for (const [label, count] of votes) {
      if (count > bestCount || (count === bestCount && label < best)) {
        best = label;
        bestCount = count;
      }
    }
    return best;
  }
}
