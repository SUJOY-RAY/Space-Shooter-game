import { CONFIG, dist, type Collidable } from "./types";
import { DIFFICULTIES, TUNING, difficultyLabel, parseDifficulty, type Difficulty } from "./difficulty";
import { isTouchDevice, wasPressed } from "./input";
import { StarField } from "./systems/stars";
import { Spawner } from "./enties/Spawner";
import { Player } from "./enties/player";
import { Bullet } from "./enties/bullet";
import { Enemy } from "./enties/enemies";
import { Particle } from "./enties/particle";

function readDifficultyFromUrl(): Difficulty {
  try {
    return parseDifficulty(new URLSearchParams(window.location.search).get("difficulty"));
  } catch {
    return "normal";
  }
}

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
  private started = false;
  private difficulty: Difficulty;
  /** Fired once when the player quits a live run (Q key or Quit button). */
  onQuit: (() => void) | null = null;
  /** Fired when the title-screen difficulty changes (hub can mirror it). */
  onDifficultyChange: ((d: Difficulty) => void) | null = null;


  get score(): number {
    return this.player.score;
  }

  get isGameOver(): boolean {
    return this.gameOver;
  }

  get currentDifficulty(): Difficulty {
    return this.difficulty;
  }

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    this.difficulty = readDifficultyFromUrl();
    this.stars = new StarField(CONFIG.width, CONFIG.height);
    this.spawner = new Spawner(CONFIG.width, this.difficulty);
    this.reset();
  }

  /** Switch difficulty. On the title screen it applies immediately; mid-run it takes effect on reset. */
  setDifficulty(d: Difficulty): void {
    if (this.difficulty === d) return;
    this.difficulty = d;
    this.spawner.setDifficulty(d);
    if (!this.started) this.reset();
    this.onDifficultyChange?.(d);
  }

  cycleDifficulty(dir: 1 | -1 = 1): void {
    const i = DIFFICULTIES.indexOf(this.difficulty);
    const next = DIFFICULTIES[(i + dir + DIFFICULTIES.length) % DIFFICULTIES.length]!;
    this.setDifficulty(next);
  }

  reset(): void {
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.player = new Player(CONFIG.playerMaxHp, CONFIG, this.bullets);
    this.spawner.reset();
    this.gameOver = false;
  }

  /** Enter (or re-enter) a run. Idempotent — safe to call on clicks. */
  start(): void {
    if (this.started) return;
    this.reset();
    this.started = true;
  }

  /** Quit the current run back to the title screen. */
  quitToTitle(): void {
    const wasPlaying = this.started;
    this.reset();
    this.started = false;
    if (wasPlaying) this.onQuit?.();
  }

  update(): void {
    // Q quits the current run from anywhere (playing or game over).
    if (wasPressed("q")) {
      this.quitToTitle();
      return;
    }
    if (!this.started) {
      this.stars.update();
      // Title-screen difficulty select: 1/2/3 jump, arrows cycle.
      if (wasPressed("1")) this.setDifficulty("easy");
      else if (wasPressed("2")) this.setDifficulty("normal");
      else if (wasPressed("3")) this.setDifficulty("hard");
      if (wasPressed("enter")) this.start();
      return;
    }
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
      e.update({
        player: this.player,
        enemyBullets: this.enemyBullets,
        playerBullets: this.bullets,
        difficulty: this.difficulty,
      });

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
            this.player.score += Math.round(e.score * TUNING[this.difficulty].scoreMult);
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
    ctx.fillStyle = "#9a9ac0";
    ctx.font = "14px monospace";
    ctx.fillText(`${difficultyLabel(this.difficulty).toUpperCase()}`, 10, 67);
    ctx.textAlign = "left";

    if (!this.started) this.drawTitle();
    else if (this.gameOver) this.drawGameOver();
  }

  private drawTitle(): void {
    const { ctx } = this;
    const cx = CONFIG.width / 2;
    const cy = CONFIG.height / 2;

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#00dcff";
    ctx.font = "bold 56px monospace";
    ctx.fillText("SPACE SHOOTER", cx, cy - 90);

    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.fillText(
      isTouchDevice() ? "Tap the screen or START to launch" : "Click or press ENTER to launch",
      cx,
      cy - 40
    );

    // Difficulty select: selected tier is highlighted.
    ctx.font = "16px monospace";
    const labels = DIFFICULTIES.map((d, i) => {
      const marker = d === this.difficulty ? "▶" : " ";
      return `${marker} ${i + 1}:${difficultyLabel(d)}`;
    }).join("   ");
    ctx.fillStyle = "#ffee00";
    ctx.fillText(labels, cx, cy - 8);

    ctx.fillStyle = "#9a9ac0";
    ctx.font = "14px monospace";
    ctx.fillText("Press 1 / 2 / 3 to pick difficulty", cx, cy + 18);
    if (isTouchDevice()) {
      ctx.fillText("D-PAD — move · A — fire up · B — wing guns", cx, cy + 42);
      ctx.fillText("A+B — diagonals · START — launch · RST — restart", cx, cy + 64);
    } else {
      ctx.fillText("Arrows / WASD — move · X/Space — fire up · Z/C — fire sides", cx, cy + 42);
      ctx.fillText("Z+X — up-left · X+C — up-right · R — restart · Q — quit", cx, cy + 64);
    }
    ctx.textAlign = "left";
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
    ctx.fillText(`Final Score: ${this.player.score}  [${difficultyLabel(this.difficulty)}]`, cx, cy + 10);

    ctx.fillStyle = "#ffee00";
    ctx.fillText("Press R to restart", cx, cy + 40);
    ctx.textAlign = "left";
  }
}