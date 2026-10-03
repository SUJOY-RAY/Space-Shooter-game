// Enemy brains: sklearn-style models trained (once, deterministically) per
// difficulty from physics-derived demonstrations — not hand-written rules.
// Every difficulty runs the SAME inference code path in enemies.ts; only the
// fitted brains differ:
//   easy   = zero/ablated heads + tiny dodge memory + heavy exploration noise
//   normal = fitted heads, moderate exploration
//   hard   = fitted heads on more data + full dodge memory, tiny exploration

import type { Difficulty } from "../difficulty";
import { StandardScaler } from "./scaler";
import { LinearRegression } from "./linear";
import { LogisticRegression } from "./logistic";
import { DecisionTreeClassifier } from "./tree";
import { KNeighborsClassifier } from "./knn";
import { mulberry32 } from "./rng";

export interface Brain {
  difficulty: Difficulty;
  lead: LinearRegression;
  leadScaler: StandardScaler;
  fire: LogisticRegression;
  fireScaler: StandardScaler;
  fireThreshold: number;
  burst: LogisticRegression;
  burstScaler: StandardScaler;
  burstThreshold: number;
  /** Orbit-vs-push gate (needs a band split — a job for the tree). */
  orbit: DecisionTreeClassifier;
  orbitDir: LogisticRegression;
  orbitDirScaler: StandardScaler;
  dive: LinearRegression;
  diveScaler: StandardScaler;
  dodge: KNeighborsClassifier;
  dodgeScaler: StandardScaler;
  /** Epsilon-greedy exploration noise applied to steering / firing. */
  epsilon: number;
}

// ---------- feature builders (shared by training + inference) ----------

export function leadFeatures(dist: number, closing: number, bulletSpeed: number): number[] {
  return [dist / 600, closing / 6, bulletSpeed / 6];
}

export function fireFeatures(dist: number, range: number, lateralSpeed: number): number[] {
  return [Math.min(dist / range, 1.5), Math.min(Math.abs(lateralSpeed) / 6, 1.5)];
}

export function burstFeatures(dist: number, range: number, speed: number): number[] {
  return [Math.min(dist / range, 1.5), Math.min(speed / 6, 1.5)];
}

export function orbitFeatures(distErr: number): number[] {
  return [distErr];
}

export function orbitDirFeatures(lateralVel: number, sideX: number): number[] {
  return [lateralVel / 6, Math.max(-1, Math.min(1, sideX / 400))];
}

export function diveFeatures(offsetX: number): number[] {
  return [offsetX / 400];
}

export function dodgeFeatures(bx: number, by: number, bvx: number, bvy: number): number[] {
  return [bx / 100, by / 100, bvx / 6, bvy / 6];
}

// ---------- inference (the only thing enemies.ts calls) ----------

export function predictLeadFrames(brain: Brain, dist: number, closing: number, bulletSpeed: number): number {
  const x = brain.leadScaler.transformOne(leadFeatures(dist, closing, bulletSpeed));
  const lead = brain.lead.predictOne(x);
  return Math.max(0, Math.min(30, lead));
}

export function fireProbability(brain: Brain, dist: number, range: number, lateralSpeed: number): number {
  return brain.fire.predictProbaOne(brain.fireScaler.transformOne(fireFeatures(dist, range, lateralSpeed)));
}

export function shouldFire(brain: Brain, dist: number, range: number, lateralSpeed: number): boolean {
  return fireProbability(brain, dist, range, lateralSpeed) >= brain.fireThreshold;
}

export function shouldBurst(brain: Brain, dist: number, range: number, speed: number): boolean {
  const p = brain.burst.predictProbaOne(brain.burstScaler.transformOne(burstFeatures(dist, range, speed)));
  return p >= brain.burstThreshold;
}

export function shouldOrbit(brain: Brain, distErr: number): boolean {
  return brain.orbit.predictOne(orbitFeatures(distErr)) === 1;
}

export function orbitDirection(brain: Brain, lateralVel: number, sideX: number): 1 | -1 {
  const p = brain.orbitDir.predictProbaOne(
    brain.orbitDirScaler.transformOne(orbitDirFeatures(lateralVel, sideX))
  );
  return p >= 0.5 ? 1 : -1;
}

/** Lateral dive correction, normalized to [-1, 1] (caller scales to px). */
export function predictDive(brain: Brain, offsetX: number): number {
  const x = brain.diveScaler.transformOne(diveFeatures(offsetX));
  return Math.max(-1, Math.min(1, brain.dive.predictOne(x)));
}

/**
 * Dodge side for an incoming bullet. Convention (shared with training):
 * +1 moves along +perp(bulletVel), -1 the opposite way; the fitted memory
 * picks the side that grows the bullet's miss distance. Returns 0 when the
 * brain has no dodge memory worth trusting.
 */
export function predictDodgeSide(
  brain: Brain,
  bx: number,
  by: number,
  bvx: number,
  bvy: number
): -1 | 0 | 1 {
  if (brain.dodge.size === 0) return 0;
  const s = brain.dodge.predictOne(brain.dodgeScaler.transformOne(dodgeFeatures(bx, by, bvx, bvy)));
  if (s > 0) return 1;
  if (s < 0) return -1;
  return 0;
}

/** Epsilon-greedy exploration: true with probability brain.epsilon. */
export function jitter(brain: Brain): boolean {
  return Math.random() < brain.epsilon;
}

// ---------- training ----------

const brains = new Map<Difficulty, Brain>();

export function getBrain(difficulty: Difficulty): Brain {
  const cached = brains.get(difficulty);
  if (cached) return cached;
  const brain = trainBrain(difficulty);
  brains.set(difficulty, brain);
  return brain;
}

/** Train (or ablate, for easy) a brain. Exported for tests; game uses getBrain. */
export function trainBrain(difficulty: Difficulty): Brain {
  const tier = difficulty === "easy" ? 0 : difficulty === "hard" ? 2 : 1;
  const seed = 0x5eed + tier * 7919;
  const rnd = mulberry32(seed);
  const n = tier === 0 ? 150 : tier === 1 ? 400 : 600;
  const noise = 0.06;

  const brain: Brain = {
    difficulty,
    lead: new LinearRegression(),
    leadScaler: new StandardScaler(),
    fire: new LogisticRegression(),
    fireScaler: new StandardScaler(),
    fireThreshold: tier === 0 ? 0.8 : tier === 1 ? 0.5 : 0.35,
    burst: new LogisticRegression(),
    burstScaler: new StandardScaler(),
    burstThreshold: tier === 0 ? 0.95 : tier === 1 ? 0.7 : 0.45,
    orbit: new DecisionTreeClassifier(tier === 0 ? 1 : tier === 1 ? 3 : 4, 4),
    orbitDir: new LogisticRegression(),
    orbitDirScaler: new StandardScaler(),
    dive: new LinearRegression(),
    diveScaler: new StandardScaler(),
    dodge: new KNeighborsClassifier(7),
    dodgeScaler: new StandardScaler(),
    epsilon: tier === 0 ? 0.35 : tier === 1 ? 0.12 : 0.03,
  };

  // -- intercept lead: one fixed-point iteration of pursuer physics --
  {
    const X: number[][] = [];
    const y: number[] = [];
    const speeds = [2.2, 3, 4, 5, 6];
    for (let i = 0; i < n; i++) {
      const dist = 40 + rnd() * 560;
      const closing = (rnd() * 2 - 1) * 6;
      const bs = speeds[Math.floor(rnd() * speeds.length)] as number;
      const t0 = dist / bs;
      // Expert target: re-measure distance after the target drifts for t0.
      const drift = closing * t0;
      const target = Math.max(0, Math.min(30, (dist - drift * 0.5) / bs));
      X.push(leadFeatures(dist, closing, bs));
      y.push(target);
    }
    brain.leadScaler.fit(X);
    if (tier > 0) brain.lead.fit(X.map((r) => brain.leadScaler.transformOne(r)), y);
  }

  // -- fire gate: shoot slow, in-range targets --
  {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const dist = rnd() * 600;
      const lateral = (rnd() * 2 - 1) * 6;
      let label = dist < 400 && Math.abs(lateral) < 5 ? 1 : 0;
      if (rnd() < noise) label = 1 - label;
      X.push(fireFeatures(dist, 400, lateral));
      y.push(label);
    }
    brain.fireScaler.fit(X);
    // Easy runs an ablated (zero) fire head: no learned gate, so its shots
    // come only from exploration noise — wild, badly-timed fire.
    if (tier > 0) {
      brain.fire.fit(
        X.map((r) => brain.fireScaler.transformOne(r)),
        y,
        { epochs: 1000, lr: 0.5 }
      );
    }
  }

  // -- burst: double-tap close targets --
  {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const dist = rnd() * 500;
      const speed = rnd() * 6;
      let label = dist < 240 ? 1 : 0;
      if (rnd() < noise) label = 1 - label;
      X.push(burstFeatures(dist, 400, speed));
      y.push(label);
    }
    brain.burstScaler.fit(X);
    if (tier > 0) {
      brain.burst.fit(
        X.map((r) => brain.burstScaler.transformOne(r)),
        y,
        { epochs: 1000, lr: 0.5 }
      );
    }
  }

  // -- orbit gate: hold the preferred-distance band (needs 2 splits) --
  {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const err = (rnd() * 2 - 1) * 300;
      let label = Math.abs(err) < 70 ? 1 : 0;
      if (rnd() < noise) label = 1 - label;
      X.push(orbitFeatures(err));
      y.push(label);
    }
    brain.orbit.fit(X, y);
  }

  // -- orbit direction: circle with the target's lateral drift --
  {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const lateral = (rnd() * 2 - 1) * 6;
      const side = (rnd() * 2 - 1) * 400;
      let label = lateral > 0 ? 1 : 0;
      if (rnd() < noise) label = 1 - label;
      X.push(orbitDirFeatures(lateral, side));
      y.push(label);
    }
    brain.orbitDirScaler.fit(X);
    if (tier > 0) {
      brain.orbitDir.fit(
        X.map((r) => brain.orbitDirScaler.transformOne(r)),
        y,
        { epochs: 1000, lr: 0.5 }
      );
    }
  }

  // -- dive: proportional pursuit of the player's x --
  {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const offset = (rnd() * 2 - 1) * 400;
      X.push(diveFeatures(offset));
      y.push(Math.max(-1.6, Math.min(1.6, offset * 0.03)) / 1.6);
    }
    brain.diveScaler.fit(X);
    if (tier > 0) brain.dive.fit(X.map((r) => brain.diveScaler.transformOne(r)), y);
  }

  // -- dodge memory: (bullet pattern) -> side that grows miss distance --
  {
    const mem = tier === 0 ? 12 : tier === 1 ? 150 : 500;
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < mem; i++) {
      const ang = rnd() * Math.PI * 2;
      const r = 30 + rnd() * 80;
      const bx = Math.cos(ang) * r;
      const by = Math.sin(ang) * r;
      const bs = 4 + rnd() * 6;
      // Bullet heading roughly at the enemy, plus spread.
      const base = Math.atan2(-by, -bx) + (rnd() * 2 - 1) * 0.6;
      const bvx = Math.cos(base) * bs;
      const bvy = Math.sin(base) * bs;
      const cross = bvx * by - bvy * bx;
      const side = cross > 0 ? -1 : 1;
      X.push(dodgeFeatures(bx, by, bvx, bvy));
      y.push(side);
    }
    brain.dodgeScaler.fit(X.length > 0 ? X : [[0, 0, 0, 0]]);
    if (X.length > 0) {
      brain.dodge.fit(
        X.map((r) => brain.dodgeScaler.transformOne(r)),
        y
      );
    }
  }

  return brain;
}
