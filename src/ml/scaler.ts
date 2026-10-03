// StandardScaler, sklearn-style: zero-mean / unit-variance features so
// gradient models and k-NN treat every game-state feature fairly.

export class StandardScaler {
  private mean: number[] = [];
  private inv: number[] = [];

  fit(X: number[][]): this {
    const first = X[0];
    const d = first ? first.length : 0;
    this.mean = [];
    this.inv = [];
    if (X.length === 0 || d === 0) return this;
    const mean = new Array<number>(d).fill(0);
    for (const row of X) {
      for (let j = 0; j < d; j++) mean[j] = (mean[j] ?? 0) + (row[j] ?? 0);
    }
    for (let j = 0; j < d; j++) mean[j] = (mean[j] ?? 0) / X.length;
    const inv = new Array<number>(d).fill(0);
    for (const row of X) {
      for (let j = 0; j < d; j++) {
        const delta = (row[j] ?? 0) - (mean[j] ?? 0);
        inv[j] = (inv[j] ?? 0) + delta * delta;
      }
    }
    for (let j = 0; j < d; j++) {
      const sd = Math.sqrt((inv[j] ?? 0) / X.length);
      inv[j] = sd > 1e-9 ? 1 / sd : 0;
    }
    this.mean = mean;
    this.inv = inv;
    return this;
  }

  transformOne(x: number[]): number[] {
    return x.map((v, j) => (v - (this.mean[j] ?? 0)) * (this.inv[j] ?? 0));
  }

  featureCount(): number {
    return this.mean.length;
  }
}
