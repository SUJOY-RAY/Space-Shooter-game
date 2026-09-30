import { Collidable, Drawable, rand } from "../types";
import { Bullet } from "./bullet";
import { Player } from "./player";

export interface EnemyContext {
    player: Player;
    enemyBullets: Bullet[];
}

export abstract class Enemy implements Drawable, Collidable {
    public hp: number;
    public readonly maxHp: number;
    protected shootCd: number
    
    constructor(
        public x: number,
        public y: number,
        hp: number,
        public readonly r: number,
        public readonly color: string,
        public readonly score: number
    ) {
        this.hp = hp;
        this.maxHp = hp;
        this.shootCd = rand(30, 90);
    }

  abstract update(ctx: EnemyContext): void;

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    return this.hp <= 0;
  }

  get dead(): boolean {
    return this.hp <= 0;
  }

  drawHpBar(ctx: CanvasRenderingContext2D): void {
    const bw = this.r * 2;
    const bh = 4;
    const bx = this.x - this.r;
    const by = this.y - this.r - 10;
    ctx.fillStyle = "#ff3c3c";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#00ff64";
    ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), bh);
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;
}

export class Chaser extends Enemy {
  private readonly speed = 2.2;

  constructor(x: number, y: number) {
    super(x, y, 2, 14, "#ff3c3c", 10);
  }

  override update({ player }: EnemyContext): void {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.x += (dx / d) * this.speed;
    this.y += (dy / d) * this.speed;
  }

  override draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // eyes
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(this.x - 5, this.y - 3, 3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x + 5, this.y - 3, 3, 0, 7); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(this.x - 5, this.y - 3, 1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x + 5, this.y - 3, 1, 0, 7); ctx.fill();
  }
}

/* ------------- Shooter: distance + aimed shots ------------- */
export class Shooter extends Enemy {
  private readonly speed = 1.4;
  private readonly preferred = 220;
  private readonly fireRate = 70;

  constructor(x: number, y: number) {
    super(x, y, 3, 16, "#c850ff", 20);
  }

  override update({ player, enemyBullets }: EnemyContext): void {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;

    if (d > this.preferred + 20) {
      this.x += (dx / d) * this.speed;
      this.y += (dy / d) * this.speed;
    } else if (d < this.preferred - 20) {
      this.x -= (dx / d) * this.speed;
      this.y -= (dy / d) * this.speed;
    } else {
      this.x += -(dy / d) * this.speed * 0.7;
      this.y +=  (dx / d) * this.speed * 0.7;
    }

    this.shootCd--;
    if (this.shootCd <= 0 && d < 400) {
      enemyBullets.push(
        new Bullet(this.x, this.y, (dx / d) * 5, (dy / d) * 5, "#c850ff", 3, true)
      );
      this.shootCd = this.fireRate;
    }
  }

  override draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.r);
    ctx.lineTo(this.x + this.r, this.y);
    ctx.lineTo(this.x, this.y + this.r);
    ctx.lineTo(this.x - this.r, this.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------------- Zigzag: sine wave ---------------- */
export class Zigzag extends Enemy {
  private readonly baseX: number;
  private t: number;
  private readonly speed = 2.5;
  private readonly amp = 60;

  constructor(x: number, y: number) {
    super(x, y, 2, 12, "#00ff64", 15);
    this.baseX = x;
    this.t = rand(0, Math.PI * 2);
  }

  override update({ player, enemyBullets }: EnemyContext): void {
    this.t += 0.08;
    this.y += this.speed;
    this.x = this.baseX + Math.sin(this.t) * this.amp;

    this.shootCd--;
    if (this.shootCd <= 0) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      enemyBullets.push(
        new Bullet(this.x, this.y, (dx / d) * 4, (dy / d) * 4, "#00ff64", 3, true)
      );
      this.shootCd = Math.floor(rand(80, 150));
    }
  }

  override draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + this.r);
    ctx.lineTo(this.x - this.r, this.y - this.r);
    ctx.lineTo(this.x + this.r, this.y - this.r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }




}