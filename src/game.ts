import { CONFIG, dist, type Collidable } from "./types";
import { wasPressed } from "./input";
import { StarField } from "./systems/stars";
import { Spawner } from "./enties/Spawner";
import { Player } from "./enties/player";
import { Bullet } from "./enties/bullet";
import { Enemy } from "./enties/enemies";
import { Particle } from "./enties/particle";

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stars: StarField;
  private readonly spawner: Spawner;
  private player!: Player;
  private bullets!: Bullet[];
  private enemyBullets!: Bullet[];
  private enemies!: Enemy[];
  private particles!: Particle[];
  private gameOver = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    this.stars = new StarField(CONFIG.width, CONFIG.height);
    this.spawner = new Spawner(CONFIG.width);
    this.reset();
  }

  reset(): void {
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.player = new Player(CONFIG.playerMaxHp, CONFIG, this.bullets);
    this.gameOver = false;
  }

  update(): void {
    if (this.gameOver) {
      if (wasPressed("r")) this.reset();
      return;
    }

    this.stars.update();
    this.player.update();
    this.spawner.update(this.enemies);

    // Player bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]!;
      b.update();
      if (b.offscreen(CONFIG.width, CONFIG.height)) this.bullets.splice(i, 1);
    }

    // Enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i]!;
      b.update();
      if (b.offscreen(CONFIG.width, CONFIG.height)) {
        this.enemyBullets.splice(i, 1);
        continue;
      }
      if (dist(b, this.player) < this.player.r + b.r) {
        this.enemyBullets.splice(i, 1);
        this.hitPlayer();
      }
    }

    // Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!;
      e.update({ player: this.player, enemyBullets: this.enemyBullets });

      if (e.y > CONFIG.height + 100 || e.y < -300) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (dist(e, this.player) < e.r + this.player.r) {
        this.enemies.splice(i, 1);
        this.hitPlayer();
        continue;
      }

      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j]!;
        if (dist(e, b as Collidable) < e.r + b.r) {
          this.bullets.splice(j, 1);
          if (e.takeDamage(1)) {
            this.enemies.splice(i, 1);
            this.player.score += e.score;
            this.boom(e.x, e.y, e.color, 15);
          }
          break;
        }
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.update();
      if (p.dead) this.particles.splice(i, 1);
    }
  }

  private hitPlayer(): void {
    if (!this.player.takeHit()) return;
    this.boom(this.player.x, this.player.y, "#ff8c00", 18);
    if (this.player.dead) this.gameOver = true;
  }

  private boom(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  draw(): void {
    const { ctx } = this;

    ctx.fillStyle = "#0a0a19";
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    this.stars.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    for (const b of this.enemyBullets) b.draw(ctx);
    for (const e of this.enemies) {
      e.draw(ctx);
      e.drawHpBar(ctx);
    }

    if (!this.gameOver || Math.floor(performance.now() / 300) % 2 === 0) {
      this.player.draw(ctx);
    }

    // HUD
    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${this.player.score}`, 10, 25);
    ctx.fillStyle = "#ff3c3c";
    ctx.fillText(`HP: ${"♥".repeat(Math.max(0, this.player.hp))}`, 10, 47);

    if (this.gameOver) this.drawGameOver();
  }

  private drawGameOver(): void {
    const { ctx } = this;
    const cx = CONFIG.width / 2;
    const cy = CONFIG.height / 2;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ff3c3c";
    ctx.font = "bold 48px monospace";
    ctx.fillText("GAME OVER", cx, cy - 30);

    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.fillText(`Final Score: ${this.player.score}`, cx, cy + 10);

    ctx.fillStyle = "#ffee00";
    ctx.fillText("Press R to restart", cx, cy + 40);
    ctx.textAlign = "left";
  }
}