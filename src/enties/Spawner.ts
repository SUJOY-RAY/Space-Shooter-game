import { rand } from "../types";
import { Chaser, Enemy, Shooter, Zigzag } from "./enemies";

type EnemyFactory = (x: number, y: number) => Enemy

const FACTORIES: ReadonlyArray<readonly [number, EnemyFactory]> = [
    [0.5, (x, y) => new Chaser(x, y)],
    [0.3, (x, y) => new Zigzag(x, y)],
    [0.2, (x, y) => new Shooter(x, y)],
]

export class Spawner {
    private timer = 0;
    private difficulty = 0;
    private interval = 60;

    constructor(public width: number) { }

    update(enemies: Enemy[]): void {
        this.difficulty++;
        if (this.difficulty > 600 && this.interval > 20) {
            this.difficulty = 0;
            this.interval -= 5;
        }

        this.timer++;
        if (this.timer < this.interval) return;
        this.timer = 0;

        const x = rand(60, Math.max(61, this.width - 60));
        const y = rand(-80, -30);

        let roll = Math.random();
        for (const [chance, factory] of FACTORIES) {
            if (roll < chance) {
                enemies.push(factory(x, y));
                return;
            }
            roll -= chance;
        }
    }
}
