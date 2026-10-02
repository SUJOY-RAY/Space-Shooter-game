import { Game } from "./game.js";
import { initInput } from "./input.js";
import { CONFIG } from "./types.js";
import { attachManagerBridge } from "./manager-bridge.js";

initInput();

const canvasEl = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvasEl) throw new Error("Canvas #game not found");
const canvas: HTMLCanvasElement = canvasEl;

const game = new Game(canvas);

// Make sure keyboard input goes to the game, not the page scroll.
canvas.tabIndex = 0;
canvas.style.outline = "none";
canvas.addEventListener("pointerdown", () => {
    canvas.focus();
    game.start();
});
if (new URLSearchParams(window.location.search).get("embed") === "1") {
    canvas.focus();
}

// Report progress to the Manager hub when embedded (no-op standalone).
attachManagerBridge(game);

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