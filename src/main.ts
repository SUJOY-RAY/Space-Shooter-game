import { Game } from "./game.js";
import { initInput } from "./input.js";
import { CONFIG } from "./types.js";

initInput();

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Canvas #game not found");

const game = new Game(canvas);

const step = 1000 / CONFIG.fps;
let last = performance.now();

function loop(now:number): void {
    if (now - last >= step) {
        game.update();
        last = now;
    }
    game.draw();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);