import { isDown } from "../input";
import { Collidable, Drawable, GameConfig } from "../types";
import { Bullet } from "./bullet";

export class Player implements Drawable, Collidable {
    public x: number;
    public y: number;
    public readonly r = 16;
    public cooldown = 0;
    /** Own cooldown so up-fire and side-fire don't starve each other. */
    public sideCooldown = 0;
    public invuln = 0;
    public score = 0;
    /** Per-frame velocity (px/frame) — read by enemy lead-prediction AI. */
    public vx = 0;
    public vy = 0;

    private bw: number;
    private bh: number;

    constructor(
        public hp: number,
        public readonly cfg: GameConfig,
        private readonly bullets: Bullet[]
    ) {
        this.bw = cfg.width;
        this.bh = cfg.height;
        this.x = this.bw / 2;
        this.y = this.bh - 70;
        this.clampToBounds();
    }

    /** Single choke point: the ship can never leave the playable bounds. */
    private clampToBounds(): void {
        // Generous bottom clearance: hull + engine flame + a visible gap,
        // so the ship clearly rests *inside* the bottom edge, never on it.
        const bottomClearance = this.r + 24;
        this.x = Math.max(this.r, Math.min(this.bw - this.r, this.x));
        this.y = Math.max(this.r, Math.min(this.bh - bottomClearance, this.y));
    }

    /** Track the live arena size (called on resize, never resets progress). */
    setBounds(w: number, h: number): void {
        this.bw = Math.max(this.r * 2 + 1, w);
        this.bh = Math.max(this.r * 2 + 1, h);
        this.clampToBounds();
    }

    update(): void {
        const px = this.x;
        const py = this.y;
        if(isDown("arrowleft", "a")) this.x -= this.cfg.playerSpeed;
        if(isDown("arrowright", "d")) this.x += this.cfg.playerSpeed;
        if(isDown("arrowup", "w")) this.y -= this.cfg.playerSpeed;
        if(isDown("arrowdown", "s")) this.y += this.cfg.playerSpeed;

        this.clampToBounds();
        this.vx = this.x - px;
        this.vy = this.y - py;

        if (this.cooldown > 0) this.cooldown--;
        if (this.sideCooldown > 0) this.sideCooldown--;
        if (this.invuln > 0) this.invuln--;

        if (isDown(" ") && this.cooldown === 0) {
            this.bullets.push(
                new Bullet(this.x, this.y - this.r, 0, -10, "#ffee00")
            );
            this.cooldown = this.cfg.playerFireRate;
        }

        // Horizontal fire: Z shoots left, X shoots right (wing guns).
        if (this.sideCooldown === 0) {
            const left = isDown("z");
            const right = isDown("x");
            if (left) {
                this.bullets.push(
                    new Bullet(this.x - this.r, this.y + 2, -10, 0, "#ffee00")
                );
            }
            if (right) {
                this.bullets.push(
                    new Bullet(this.x + this.r, this.y + 2, 10, 0, "#ffee00")
                );
            }
            if (left || right) this.sideCooldown = this.cfg.playerFireRate;
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

        // Wing gun barrels (telegraph Z/X side fire).
        ctx.fillStyle = "#ffee00";
        ctx.fillRect(this.x - this.r - 3, this.y - 1, 4, 4);
        ctx.fillRect(this.x + this.r - 1, this.y - 1, 4, 4);

        const flame = 4 + Math.random() * 6;
        ctx.fillStyle = "#ff8c00";
        ctx.beginPath();
        ctx.moveTo(this.x - 6, this.y + this.r);
        ctx.lineTo(this.x + 6, this.y + this.r);
        ctx.lineTo(this.x, this.y + this.r + flame);
        ctx.fill();
    }
}