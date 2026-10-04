import { Collidable, Drawable, rand } from "../types";
import { TUNING, type Difficulty } from "../difficulty";
import {
  getBrain,
  jitter,
  orbitDirection,
  predictDive,
  predictDodgeSide,
  predictLeadFrames,
  shouldBurst,
  shouldFire,
  shouldOrbit,
} from "../ml/enemyModels";
import { Bullet } from "./bullet";
import { Player } from "./player";
import { sfx } from "../sfx";

export interface EnemyContext {
    player: Player;
    enemyBullets: Bullet[];
    /** Live player bullets — read by the dodge model. */
    playerBullets: Bullet[];
    difficulty: Difficulty;
}

function cooldown(base: number, difficulty: Difficulty): number {
    return Math.max(12, Math.round(base * TUNING[difficulty].fireCooldownMult));
}

/** Closing speed of the player toward the enemy (px/frame, + = approaching). */
function closingSpeed(ex: number, ey: number, player: Player): number {
    const dx = player.x - ex;
    const dy = player.y - ey;
    const d = Math.hypot(dx, dy) || 1;
    return -((dx * player.vx + dy * player.vy) / d);
}

function nearestBullet(bullets: Bullet[], x: number, y: number, maxDist: number): Bullet | null {
    let best: Bullet | null = null;
    let bestD = maxDist;
    for (const b of bullets) {
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < bestD) {
            bestD = d;
            best = b;
        }
    }
    return best;
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
 * Brain: linear intercept-lead + k-NN bullet dodge. Same inference path on
 * every difficulty — easy just runs ablated heads (zero lead, tiny dodge
 * memory) with heavy exploration noise. */
export class Chaser extends Enemy {
  private readonly baseSpeed = 2.2;

  constructor(x: number, y: number) {
    super(x, y, 2, 14, "#ff3c3c", 10);
  }

  override update({ player, playerBullets, difficulty }: EnemyContext): void {
    const brain = getBrain(difficulty);
    const speed = this.baseSpeed * TUNING[difficulty].speedMult;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;

    // ML intercept: steer at the predicted future player position.
    const lead = predictLeadFrames(brain, d, closingSpeed(this.x, this.y, player), speed);
    let tx = player.x + player.vx * lead;
    let ty = player.y + player.vy * lead;
    if (jitter(brain)) {
      tx += (Math.random() - 0.5) * 70;
      ty += (Math.random() - 0.5) * 70;
    }
    const mx = tx - this.x;
    const my = ty - this.y;
    const md = Math.hypot(mx, my) || 1;
    this.x += (mx / md) * speed;
    this.y += (my / md) * speed;

    // ML dodge: k-NN replays the dodge side of similar bullet patterns.
    const threat = nearestBullet(playerBullets, this.x, this.y, 110);
    if (threat) {
      const side = predictDodgeSide(
        brain,
        threat.x - this.x,
        threat.y - this.y,
        threat.vx,
        threat.vy
      );
      if (side !== 0) {
        const bl = Math.hypot(threat.vx, threat.vy) || 1;
        const w = (110 - Math.hypot(threat.x - this.x, threat.y - this.y)) / 110;
        this.x += ((side * -threat.vy) / bl) * speed * 0.9 * w;
        this.y += ((side * threat.vx) / bl) * speed * 0.45 * w;
      }
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

/* ------------- Shooter -------------
 * Brain: decision-tree orbit gate + logistic orbit direction, fire and burst
 * calls + linear aim lead. Radial approach/backoff is just the low-level
 * controller; every tactical call is model inference. */
export class Shooter extends Enemy {
  private readonly baseSpeed = 1.4;
  private readonly preferred = 220;
  private readonly baseFireRate = 70;

  constructor(x: number, y: number) {
    super(x, y, 3, 16, "#c850ff", 20);
  }

  override update({ player, enemyBullets, difficulty }: EnemyContext): void {
    const brain = getBrain(difficulty);
    const speed = this.baseSpeed * TUNING[difficulty].speedMult;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;

    if (!shouldOrbit(brain, d - this.preferred)) {
      // Push in or back off along the line of sight.
      const s = d > this.preferred ? 1 : -1;
      this.x += (dx / d) * speed * s;
      this.y += (dy / d) * speed * s;
    } else {
      // Circle the player; the model picks the orbit direction.
      const lateral = (-dy * player.vx + dx * player.vy) / d;
      let dir = orbitDirection(brain, lateral, this.x - player.x);
      if (jitter(brain)) dir = dir === 1 ? -1 : 1;
      this.x += (-(dy / d) * speed * 0.8 * dir);
      this.y += ((dx / d) * speed * 0.8 * dir);
    }

    this.shootCd--;
    if (this.shootCd <= 0 && d < 400) {
      const targetSpeed = Math.hypot(player.vx, player.vy);
      const firing = shouldFire(brain, d, 400, targetSpeed) || jitter(brain);
      if (firing) {
        const lead = predictLeadFrames(brain, d, closingSpeed(this.x, this.y, player), 5);
        const ax = player.x + player.vx * lead - this.x;
        const ay = player.y + player.vy * lead - this.y;
        const ad = Math.hypot(ax, ay) || 1;
        enemyBullets.push(
          new Bullet(this.x, this.y, (ax / ad) * 5, (ay / ad) * 5, "#c850ff", 3, true)
        );
        if (shouldBurst(brain, d, 400, targetSpeed)) {
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
        sfx.zap();
        this.shootCd = cooldown(this.baseFireRate, difficulty);
      } else {
        // Ask the fire model again soon.
        this.shootCd = 8;
      }
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

/* ---------------- Zigzag ----------------
 * Brain: linear dive correction + logistic fire / burst calls over a sine
 * patrol. The sine is the enemy's movement signature; dive, fire timing and
 * aim lead are all model inference. */
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
    const brain = getBrain(difficulty);
    const speed = this.baseSpeed * TUNING[difficulty].speedMult;
    this.t += 0.08;
    this.y += speed;
    // ML dive: slide the sine centre toward the player.
    const correction = predictDive(brain, player.x - this.baseX) * 1.6;
    this.baseX += Math.max(-1.6, Math.min(1.6, correction));
    this.x = this.baseX + Math.sin(this.t) * this.amp;

    this.shootCd--;
    if (this.shootCd <= 0) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const targetSpeed = Math.hypot(player.vx, player.vy);
      const firing = shouldFire(brain, d, 420, targetSpeed) || jitter(brain);
      if (firing) {
        enemyBullets.push(
          new Bullet(this.x, this.y, (dx / d) * 4, (dy / d) * 4, "#00ff64", 3, true)
        );
        if (shouldBurst(brain, d, 420, targetSpeed)) {
          const lead = predictLeadFrames(brain, d, closingSpeed(this.x, this.y, player), 4.6);
          const ax = player.x + player.vx * lead - this.x;
          const ay = player.y + player.vy * lead - this.y;
          const ad = Math.hypot(ax, ay) || 1;
          enemyBullets.push(
            new Bullet(this.x, this.y, (ax / ad) * 4.6, (ay / ad) * 4.6, "#00ff64", 3, true)
          );
        }
        sfx.zap();
        this.shootCd = cooldown(95, difficulty);
      } else {
        this.shootCd = 10;
      }
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