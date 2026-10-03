import { Collidable, Drawable, rand } from "../types";
import { TUNING, difficultyTier, type Difficulty } from "../difficulty";
import { Bullet } from "./bullet";
import { Player } from "./player";

export interface EnemyContext {
    player: Player;
    enemyBullets: Bullet[];
    /** Live player bullets — read by Hard-tier dodge AI. */
    playerBullets: Bullet[];
    difficulty: Difficulty;
}

function cooldown(base: number, difficulty: Difficulty): number {
    return Math.max(12, Math.round(base * TUNING[difficulty].fireCooldownMult));
}

/** Frames of lead for predictive aiming, capped so it stays fair. */
function leadFrames(distPx: number, bulletSpeed: number): number {
    return Math.max(0, Math.min(30, distPx / Math.max(1, bulletSpeed)));
}

export abstract class Enemy implements Drawable, Collidable {
    public hp: number;
    public maxHp: number;
    protected shootCd: number

    constructor(
        public x: number,
        public y: number,
        hp: number,
        public readonly r: number,
        public readonly color: string,
        public score: number
    ) {
        this.hp = hp;
        this.maxHp = hp;
        this.shootCd = rand(30, 90);
    }

  abstract update(ctx: EnemyContext): void;

  /** Apply the difficulty HP bonus after spawning (keeps bar in sync). */
  applyDifficultyHp(bonus: number): void {
    if (bonus > 0) {
      this.hp += bonus;
      this.maxHp += bonus;
    }
  }

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

/* ------------- Chaser -------------
 * Easy:   dumb straight-line chase.
 * Normal: + predictive interception (leads the player's motion).
 * Hard:   + bullet-dodge sidestep with a weave, and faster. */
export class Chaser extends Enemy {
  private readonly baseSpeed = 2.2;
  private weaveT = rand(0, Math.PI * 2);

  constructor(x: number, y: number) {
    super(x, y, 2, 14, "#ff3c3c", 10);
  }

  override update({ player, playerBullets, difficulty }: EnemyContext): void {
    const tier = difficultyTier(difficulty);
    const speed = this.baseSpeed * TUNING[difficulty].speedMult;
    // Normal+: aim where the player is heading, not where they are.
    const lead = tier >= 1 ? leadFrames(Math.hypot(player.x - this.x, player.y - this.y), 6) : 0;
    const tx = player.x + player.vx * lead;
    const ty = player.y + player.vy * lead;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.x += (dx / d) * speed;
    this.y += (dy / d) * speed;

    // Hard: sidestep incoming player bullets + weave so it is harder to hit.
    if (tier >= 2) {
      this.weaveT += 0.12;
      let dodgeX = 0;
      let dodgeY = 0;
      for (const b of playerBullets) {
        const bx = b.x - this.x;
        const by = b.y - this.y;
        const bd = Math.hypot(bx, by);
        if (bd < 95 && bd > 0.01) {
          // Perpendicular push away from the bullet's travel line.
          const px = -by / bd;
          const py = bx / bd;
          const w = (95 - bd) / 95;
          dodgeX += px * w;
          dodgeY += py * w;
        }
      }
      const dl = Math.hypot(dodgeX, dodgeY);
      if (dl > 0.01) {
        this.x += (dodgeX / dl) * speed * 0.9;
        this.y += (dodgeY / dl) * speed * 0.45;
      }
      this.x += Math.cos(this.weaveT) * 0.7;
    }
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

/* ------------- Shooter: distance + aimed shots -------------
 * Easy:   slow approach, single aimed shot, long cooldown.
 * Normal: + keeps a preferred distance and strafes sideways (orbit AI).
 * Hard:   + predictive lead aiming and 2-round burst fire. */
export class Shooter extends Enemy {
  private readonly baseSpeed = 1.4;
  private readonly preferred = 220;
  private readonly baseFireRate = 70;

  constructor(x: number, y: number) {
    super(x, y, 3, 16, "#c850ff", 20);
  }

  override update({ player, enemyBullets, difficulty }: EnemyContext): void {
    const tier = difficultyTier(difficulty);
    const speed = this.baseSpeed * TUNING[difficulty].speedMult;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;

    if (tier <= 0) {
      // Easy: just drift toward the player, no clever spacing.
      this.x += (dx / d) * speed;
      this.y += (dy / d) * speed;
    } else if (d > this.preferred + 20) {
      this.x += (dx / d) * speed;
      this.y += (dy / d) * speed;
    } else if (d < this.preferred - 20) {
      this.x -= (dx / d) * speed;
      this.y -= (dy / d) * speed;
    } else {
      // Orbit strafe; Hard strafes noticeably faster.
      const strafe = tier >= 2 ? 1.1 : 0.7;
      this.x += -(dy / d) * speed * strafe;
      this.y +=  (dx / d) * speed * strafe;
    }

    this.shootCd--;
    if (this.shootCd <= 0 && d < 400) {
      // Hard leads the player's motion; lower tiers shoot at the hull.
      const lf = tier >= 2 ? leadFrames(d, 5) : 0;
      const ax = player.x + player.vx * lf - this.x;
      const ay = player.y + player.vy * lf - this.y;
      const ad = Math.hypot(ax, ay) || 1;
      enemyBullets.push(
        new Bullet(this.x, this.y, (ax / ad) * 5, (ay / ad) * 5, "#c850ff", 3, true)
      );
      if (tier >= 2) {
        // Second round of the burst, slightly fanned.
        const spread = 0.14;
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const bx = ax / ad;
        const by = ay / ad;
        enemyBullets.push(
          new Bullet(this.x, this.y, (bx * cos - by * sin) * 5, (bx * sin + by * cos) * 5, "#c850ff", 3, true)
        );
      }
      this.shootCd = cooldown(this.baseFireRate, difficulty);
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

/* ---------------- Zigzag: sine wave ----------------
 * Easy:   harmless sine drift, never shoots.
 * Normal: + aimed single shots while drifting.
 * Hard:   + dives toward the player's x and fires twin shots faster. */
export class Zigzag extends Enemy {
  private baseX: number;
  private t: number;
  private readonly baseSpeed = 2.5;
  private readonly amp = 60;

  constructor(x: number, y: number) {
    super(x, y, 2, 12, "#00ff64", 15);
    this.baseX = x;
    this.t = rand(0, Math.PI * 2);
  }

  override update({ player, enemyBullets, difficulty }: EnemyContext): void {
    const tier = difficultyTier(difficulty);
    const speed = this.baseSpeed * TUNING[difficulty].speedMult;
    this.t += 0.08;
    this.y += speed;
    if (tier >= 2) {
      // Dive AI: slide the sine centre toward the player.
      this.baseX += Math.max(-1.6, Math.min(1.6, (player.x - this.baseX) * 0.03));
    }
    this.x = this.baseX + Math.sin(this.t) * this.amp;

    // Easy zigzags are harmless; Normal+ open fire.
    if (tier <= 0) return;
    this.shootCd--;
    if (this.shootCd <= 0) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      enemyBullets.push(
        new Bullet(this.x, this.y, (dx / d) * 4, (dy / d) * 4, "#00ff64", 3, true)
      );
      if (tier >= 2) {
        const lf = leadFrames(d, 4);
        const ax = player.x + player.vx * lf - this.x;
        const ay = player.y + player.vy * lf - this.y;
        const ad = Math.hypot(ax, ay) || 1;
        enemyBullets.push(
          new Bullet(this.x, this.y, (ax / ad) * 4.6, (ay / ad) * 4.6, "#00ff64", 3, true)
        );
      }
      this.shootCd = tier >= 2
        ? cooldown(70, difficulty)
        : Math.floor(rand(80, 150) * TUNING[difficulty].fireCooldownMult);
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