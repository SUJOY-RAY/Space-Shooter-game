// Per-game difficulty tiers. Higher tiers don't just scale numbers —
// each step unlocks one extra AI behaviour *per enemy type* (see enemies.ts).

export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

export function parseDifficulty(value: unknown): Difficulty {
  if (typeof value === "string") {
    const v = value.toLowerCase();
    if (v === "easy" || v === "normal" || v === "hard") return v;
    // Numeric shortcuts used by the title screen (1/2/3).
    if (v === "1") return "easy";
    if (v === "2") return "normal";
    if (v === "3") return "hard";
  }
  return "normal";
}

export function difficultyLabel(d: Difficulty): string {
  return d === "easy" ? "Easy" : d === "hard" ? "Hard" : "Normal";
}

/** Numeric tuning applied on top of the per-enemy AI tiers. */
export interface DifficultyTuning {
  /** First spawn interval (frames). Lower = more enemies sooner. */
  spawnInterval: number;
  /** Fastest the spawner ramps to. */
  minInterval: number;
  /** How much the interval shrinks each ramp step. */
  spawnStep: number;
  /** Flat bonus HP added to every spawned enemy. */
  hpBonus: number;
  /** Multiplier for enemy move speed. */
  speedMult: number;
  /** Multiplier for enemy fire cooldown (lower = shoots more often). */
  fireCooldownMult: number;
  /** Score multiplier for kills (rewards harder runs). */
  scoreMult: number;
}

export const TUNING: Record<Difficulty, DifficultyTuning> = {
  easy: {
    spawnInterval: 80,
    minInterval: 30,
    spawnStep: 4,
    hpBonus: 0,
    speedMult: 0.85,
    fireCooldownMult: 1.5,
    scoreMult: 1,
  },
  normal: {
    spawnInterval: 60,
    minInterval: 20,
    spawnStep: 5,
    hpBonus: 0,
    speedMult: 1,
    fireCooldownMult: 1,
    scoreMult: 1,
  },
  hard: {
    spawnInterval: 42,
    minInterval: 14,
    spawnStep: 5,
    hpBonus: 1,
    speedMult: 1.25,
    fireCooldownMult: 0.62,
    scoreMult: 1.5,
  },
};

/** 0/1/2 tier index used to gate AI behaviours. */
export function difficultyTier(d: Difficulty): number {
  return d === "easy" ? 0 : d === "hard" ? 2 : 1;
}
