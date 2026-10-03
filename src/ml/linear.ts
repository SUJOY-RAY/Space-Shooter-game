// LinearRegression via ridge normal equations (closed form, deterministic).
// Used for continuous predictions: intercept lead time, dive correction.

export class LinearRegression {
  weights: number[] = [];
  bias = 0;

  fit(X: number[][], y: number[], l2 = 1e-6): this {
    const first = X[0];
    const d = first ? first.length : 0;
    this.weights = new Array<number>(d).fill(0);
    this.bias = 0;
    if (X.length === 0 || d === 0) return this;
    const m = d + 1;
    const A: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    const b: number[] = new Array<number>(m).fill(0);
    for (let i = 0; i < X.length; i++) {
      const row = X[i] as number[];
      const target = y[i] ?? 0;
      for (let a = 0; a < m; a++) {
        const va = a < d ? (row[a] ?? 0) : 1;
        b[a] = (b[a] ?? 0) + va * target;
        const rowA = A[a] as number[];
        for (let c = 0; c < m; c++) {
          const vc = c < d ? (row[c] ?? 0) : 1;
          rowA[c] = (rowA[c] ?? 0) + va * vc;
        }
      }
    }
    for (let j = 0; j < d; j++) {
      const rowA = A[j] as number[];
      rowA[j] = (rowA[j] ?? 0) + l2;
    }
    const sol = solve(A, b);
    this.weights = sol.slice(0, d);
    this.bias = sol[d] ?? 0;
    return this;
  }

  predictOne(x: number[]): number {
    let s = this.bias;
    for (let j = 0; j < this.weights.length; j++) {
      s += (this.weights[j] ?? 0) * (x[j] ?? 0);
    }
    return s;
  }
}

// Gaussian elimination with partial pivoting (tiny systems only).
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M: number[][] = A.map((row, i) => [...row, b[i] ?? 0]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      const a = M[r] as number[];
      const p = M[pivot] as number[];
      if (Math.abs(a[col] ?? 0) > Math.abs(p[col] ?? 0)) pivot = r;
    }
    const tmp = M[col] as number[];
    M[col] = M[pivot] as number[];
    M[pivot] = tmp;
    const pivRow = M[col] as number[];
    const piv = pivRow[col] ?? 0;
    const safe = Math.abs(piv) < 1e-12 ? 1e-12 : piv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const row = M[r] as number[];
      const factor = (row[col] ?? 0) / safe;
      for (let c = col; c <= n; c++) {
        row[c] = (row[c] ?? 0) - factor * (pivRow[c] ?? 0);
      }
    }
  }
  return M.map((row, i) => (row[n] ?? 0) / (((M[i] as number[])[i] ?? 1) || 1e-12));
}
