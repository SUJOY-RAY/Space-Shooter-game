import { Game } from "./game.js";
import { initInput, isTouchDevice } from "./input.js";
import { initTouchControls } from "./touch.js";
import { CONFIG } from "./types.js";
import { attachManagerBridge } from "./manager-bridge.js";
import { initSfx } from "./sfx.js";

initInput();
initTouchControls();
initSfx();

// Embedded in the Manager hub iframe: use fill-width canvas sizing instead of
// the full-viewport 300px pad offset (the iframe viewport is short).
// Runs before measuring so the fit below sees the real embedded layout.
try {
    const embedded =
        new URLSearchParams(window.location.search).get("embed") === "1" ||
        window.parent !== window;
    if (embedded) document.body.classList.add("embedded");
} catch {
    /* standalone — ignore */
}

// Portrait phones get a taller arena so the game viewport stretches down
// to the input pad instead of leaving a void under a small 4:3 screen.
// Sized from live measurements (frame height minus pad + chrome), so the
// canvas + pad land exactly on the frame. Everything downstream reads
// CONFIG live + the player spawns relative to the bounds.
function fitPortraitArena(canvas: HTMLCanvasElement): void {
    try {
        if (!isTouchDevice()) return;
        if (!window.matchMedia("(orientation: portrait)").matches) return;
        const pad = document.getElementById("pad");
        const cabinet = document.getElementById("cabinet");
        const bezel = document.getElementById("screen-bezel");
        if (!pad || !cabinet) return;
        const frameH = window.innerHeight;
        const canvasW = canvas.clientWidth || cabinet.clientWidth;
        if (!frameH || !canvasW) return;
        const num = (v: string): number => Number.parseFloat(v) || 0;
        const cabCs = getComputedStyle(cabinet);
        let chrome =
            num(cabCs.paddingTop) +
            num(cabCs.paddingBottom) +
            num(cabCs.getPropertyValue("row-gap") || cabCs.getPropertyValue("gap"));
        if (bezel) {
            const bezCs = getComputedStyle(bezel);
            chrome +=
                num(bezCs.paddingTop) +
                num(bezCs.paddingBottom) +
                num(bezCs.borderTopWidth) +
                num(bezCs.borderBottomWidth);
        }
        const padH = pad.hidden ? 0 : pad.offsetHeight;
        const targetH = frameH - padH - chrome - 14; // 10px pad lift + slack
        if (targetH <= 0) return;
        CONFIG.height = Math.round(
            Math.min(1400, Math.max(800, (targetH / canvasW) * 800))
        );
    } catch {
        /* keep the classic arena */
    }
}

const canvasEl = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvasEl) throw new Error("Canvas #game not found");
const canvas: HTMLCanvasElement = canvasEl;
fitPortraitArena(canvas);
canvas.height = CONFIG.height;

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