import { rand } from "../types";
import { TUNING, type Difficulty } from "../difficulty";
import { Chaser, Enemy, Shooter, Zigzag } from "./enemies";

type EnemyFactory = (x: number, y: number) => Enemy

const FACTORIES: ReadonlyArray<readonly [number, EnemyFactory]> = [
    [0.5, (x, y) => new Chaser(x, y)],
    [0.3, (x, y) => new Zigzag(x, y)],
    [0.2, (x, y) => new Shooter(x, y)],
]

export class Spawner {
    private timer = 0;
    private ramp = 0;
    private interval: number;

    constructor(public width: number, private gameDifficulty: Difficulty = "normal") {
        this.interval = TUNING[this.gameDifficulty].spawnInterval;
    }

    setDifficulty(d: Difficulty): void {
        this.gameDifficulty = d;
        this.reset();
    }

    reset(): void {
        this.timer = 0;
        this.ramp = 0;
        this.interval = TUNING[this.gameDifficulty].spawnInterval;
    }

    update(enemies: Enemy[]): void {
        const tuning = TUNING[this.gameDifficulty];
        this.ramp++;
        if (this.ramp > 600 && this.interval > tuning.minInterval) {
            this.ramp = 0;
            this.interval = Math.max(tuning.minInterval, this.interval - tuning.spawnStep);
        }

        this.timer++;
        if (this.timer < this.interval) return;
        this.timer = 0;

        const x = rand(60, Math.max(61, this.width - 60));
        const y = rand(-80, -30);

        let roll = Math.random();
        for (const [chance, factory] of FACTORIES) {
            if (roll < chance) {
                const e = factory(x, y);
                e.applyDifficultyHp(TUNING[this.gameDifficulty].hpBonus);
                enemies.push(e);
                return;
            }
            roll -= chance;
        }
    }
}
