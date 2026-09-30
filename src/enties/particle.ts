import { Drawable, rand } from "../types";

export class Particle implements Drawable {
    public x: number;
    public y: number;
    public vx: number;
    public vy: number;
    public life: number;
    public readonly maxLife: number;

    constructor(x: number, y: number, public readonly color: string) {
        this.x = x;
        this.y = y;
        const angle = rand(0, Math.PI * 2);
        const speed = rand(1, 5);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = Math.floor(rand(20, 40));
        this.maxLife = this.life;
    }

    update(): void {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.life--;
    }

    get dead(): boolean {
        return this.life <= 0;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(1, 3 * alpha), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}