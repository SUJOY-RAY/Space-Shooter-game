import { isDown } from "../input";
import { Collidable, Drawable, GameConfig } from "../types";
import { Bullet } from "./bullet";

export class Player implements Drawable, Collidable {
    public x: number;
    public y: number;
    public readonly r = 16;
    public cooldown = 0;
    public invuln = 0;
    public score = 0;

    constructor(
        public hp: number,
        public readonly cfg: GameConfig,
        private readonly bullets: Bullet[]
    ) {
        this.x = cfg.width / 2;
        this.y = cfg.height - 70;
    }
    
    update(): void {
        if(isDown("arrowleft", "a")) this.x -= this.cfg.playerSpeed;
        if(isDown("arrowright", "d")) this.x += this.cfg.playerSpeed;
        if(isDown("arrowup", "w")) this.y -= this.cfg.playerSpeed;
        if(isDown("arrowdown", "s")) this.y += this.cfg.playerSpeed;

        this.x = Math.max(this.r, Math.min(this.cfg.width - this.r, this.x));
        this.y = Math.max(this.r, Math.min(this.cfg.height - this.r, this.y));

        if (this.cooldown > 0) this.cooldown--;
        if (this.invuln > 0) this.invuln--;

        if (isDown(" ") && this.cooldown === 0) {
            this.bullets.push(
                new Bullet(this.x, this.y - this.r, 0, -10, "#ffee00")
            );
            this.cooldown = this.cfg.playerFireRate;
        }
    }

    takeHit(): boolean {
        if(this.invuln > 0) return false;
        this.hp--;;
        this.invuln = this.cfg.invulnFrames;

        return true;
    }

    get dead(): boolean {
        return this.hp <= 0;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if(this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0) return;

        ctx.fillStyle = "#00dcff"
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.r)
        ctx.lineTo(this.x - this.r, this.y + this.r);
        ctx.lineTo(this.x + this.r, this.y + this.r);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        const flame = 4 + Math.random() * 6;
        ctx.fillStyle = "#ff8c00";
        ctx.beginPath();
        ctx.moveTo(this.x - 6, this.y + this.r);
        ctx.lineTo(this.x + 6, this.y + this.r);
        ctx.lineTo(this.x, this.y + this.r + flame);
        ctx.fill();
    }
}