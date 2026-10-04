import { Game } from "./game.js";
import { initInput } from "./input.js";
import { initTouchControls } from "./touch.js";
import { CONFIG } from "./types.js";
import { attachManagerBridge } from "./manager-bridge.js";

initInput();
initTouchControls();

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
// Embedded in the Manager hub iframe: use fill-width canvas sizing instead of
// the full-viewport 300px pad offset (the iframe viewport is short).
try {
    const embedded =
        new URLSearchParams(window.location.search).get("embed") === "1" ||
        window.parent !== window;
    if (embedded) document.body.classList.add("embedded");
} catch {
    /* standalone — ignore */
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