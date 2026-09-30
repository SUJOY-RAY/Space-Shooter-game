import { Drawable, rand } from "../types";

export interface Star {
  x: number;
  y: number;
  s: number;
  r: number;
}

export class StarField implements Drawable {
    private readonly stars: Star[];

    constructor(
        private readonly w: number,
        private readonly h: number, 
        count = 120
    ) {
        this.stars = Array.from({ length: count }, () => ({
            x: rand(0, w),
            y: rand(0, h),
            s: rand(0.3, 1.5),
            r: Math.floor(rand(1, 3)),
        }));
    }

    update(): void {
        for (const st of this.stars) {
            st.y += st.s;
            if (st.y > this.h) {
                st.y = 0;
                st.x = rand(0, this.w);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        for (const st of this.stars) {
            const b = Math.min(255, 100 + st.s * 100) | 0;
            ctx.fillStyle = `rgb(${b}, ${b}, ${b})`;
            ctx.beginPath();
            ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}