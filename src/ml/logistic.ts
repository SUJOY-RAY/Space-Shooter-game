// Binary LogisticRegression via full-batch gradient descent (deterministic:
// no shuffling, fixed init). Used for fire / burst / orbit-direction calls.

export interface LogisticOptions {
  epochs?: number;
  lr?: number;
  l2?: number;
}

export class LogisticRegression {
  weights: number[] = [];
  bias = 0;

  fit(X: number[][], y: number[], opts: LogisticOptions = {}): this {
    const first = X[0];
    const d = first ? first.length : 0;
    this.weights = new Array<number>(d).fill(0);
    this.bias = 0;
    const n = X.length;
    if (n === 0 || d === 0) return this;
    const epochs = opts.epochs ?? 400;
    const lr = opts.lr ?? 0.5;
    const l2 = opts.l2 ?? 1e-4;
    for (let e = 0; e < epochs; e++) {
      const gw = new Array<number>(d).fill(0);
      let gb = 0;
      for (let i = 0; i < n; i++) {
        const row = X[i] as number[];
        const target = y[i] ?? 0;
        let z = this.bias;
        for (let j = 0; j < d; j++) z += (this.weights[j] ?? 0) * (row[j] ?? 0);
        const p = 1 / (1 + Math.exp(-z));
        const err = p - target;
        gb += err;
        for (let j = 0; j < d; j++) gw[j] = (gw[j] ?? 0) + err * (row[j] ?? 0);
      }
      for (let j = 0; j < d; j++) {
        this.weights[j] = (this.weights[j] ?? 0) - lr * ((gw[j] ?? 0) / n + l2 * (this.weights[j] ?? 0));
      }
      this.bias -= (lr * gb) / n;
    }
    return this;
  }

  predictProbaOne(x: number[]): number {
    let z = this.bias;
    for (let j = 0; j < this.weights.length; j++) {
      z += (this.weights[j] ?? 0) * (x[j] ?? 0);
    }
    return 1 / (1 + Math.exp(-z));
  }

  predictOne(x: number[], threshold = 0.5): 0 | 1 {
    if (this.predictProbaOne(x) >= threshold) return 1;
    return 0;
  }
}
