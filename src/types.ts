export interface Vec2 {
    x: number;
    y: number;
}

export interface Drawable {
    draw(ctx: CanvasRenderingContext2D): void;   
}

export interface Updatable {
    update(): void;
}

export interface Collidable {
    x: number;
    y: number;
    r: number;
}

export type BulletColor = string;

export interface GameConfig {
    width: number;
    height: number;
    fps: number;
    playerSpeed: number;
    playerFireRate: number;
    playerMaxHp: number;
    invulnFrames: number;
}

export const CONFIG: GameConfig = {
    width: 800,
    height: 600,
    fps: 60,
    playerSpeed: 6,
    playerFireRate: 10,
    playerMaxHp: 5,
    invulnFrame: 60,
}

export const rand = (a: number, b: number): number => 
    a + Math.random() * (b - a);

export const dist = (a: Vec2, b: Vec2): number => 
    Math.hypot(a.x - b.x, a.y - b.y);

