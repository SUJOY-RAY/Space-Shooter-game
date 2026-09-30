import { Collidable, Drawable } from "../types";

export class Bullet implements Drawable, Collidable {
   public readonly enemy: boolean;

   constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public readonly color: string,
    public readonly r: number = 3,
    enemy = false
   ) {
    this.enemy = enemy;
   }

   update(): void {
    this.x += this.vx;
    this.y += this.vy;
   }

   offscreen(w: number, h: number): boolean {
    return this.y <-20 || this.y > h + 20 || this.x < -20 || this.x > w + 20;
   }

   draw(ctx: CanvasRenderingContext2D): void {
       ctx.fillStyle = this.color;
       ctx.beginPath();
       ctx.arc(this.x, this.y, this.r, 0,Math.PI * 2);
       ctx.strokeStyle = "#fff"
       ctx.lineWidth = 1;
       ctx.stroke();
   }  
}