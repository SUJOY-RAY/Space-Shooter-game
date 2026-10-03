// Bridge between the Space Shooter microservice and the Manager hub.
// The game stays fully standalone: when opened directly it just plays.
// When embedded/launched by the Manager (?embed=1&accountId=…), it streams
// progress events so the hub can persist them in IndexedDB.
//
// Protocol (postMessage to parent window):
//   { source: "space-shooter", type: "GAME_READY", gameId, accountId, difficulty }
//   { source: "space-shooter", type: "SCORE_TICK", gameId, accountId, score, difficulty }
//   { source: "space-shooter", type: "GAME_OVER",  gameId, accountId, score, difficulty }
//   { source: "space-shooter", type: "QUIT_TO_HUB", gameId, accountId, score, difficulty }
//   { source: "space-shooter", type: "DIFFICULTY", gameId, accountId, difficulty }

import type { Difficulty } from "./difficulty";
import { parseDifficulty } from "./difficulty";

export interface BridgeGame {
  readonly score: number;
  readonly isGameOver: boolean;
  readonly currentDifficulty: Difficulty;
  onQuit: (() => void) | null;
  onDifficultyChange: ((d: Difficulty) => void) | null;
}

export interface BridgeInfo {
  embedded: boolean;
  gameId: string;
  accountId: string | null;
  accountName: string | null;
  difficulty: Difficulty;
}

export function readBridgeInfo(): BridgeInfo {
  const params = new URLSearchParams(window.location.search);
  return {
    embedded:
      params.get("embed") === "1" ||
      window.parent !== window,
    gameId: params.get("gameId") ?? "space-shooter",
    accountId: params.get("accountId"),
    accountName: params.get("accountName"),
    difficulty: parseDifficulty(params.get("difficulty")),
  };
}

function postToHub(message: Record<string, unknown>): void {
  if (window.parent === window) return;
  try {
    window.parent.postMessage({ source: "space-shooter", ...message }, "*");
  } catch {
    // Hub not listening (standalone tab) — safe to ignore.
  }
}

/** Show who is playing when launched from the hub + stream score events. */
export function attachManagerBridge(game: BridgeGame): BridgeInfo {
  const info = readBridgeInfo();
  // Hub URL wins on boot so the embedded run matches the hub's picker.
  if (info.difficulty !== game.currentDifficulty) {
    try {
      const g = game as { setDifficulty?: (d: Difficulty) => void };
      g.setDifficulty?.(info.difficulty);
    } catch {
      /* standalone — ignore */
    }
  }
  postToHub({
    type: "GAME_READY",
    gameId: info.gameId,
    accountId: info.accountId,
    difficulty: game.currentDifficulty,
  });

  // Q / Quit button inside the game quits back to the hub dashboard.
  game.onQuit = () => {
    postToHub({
      type: "QUIT_TO_HUB",
      gameId: info.gameId,
      accountId: info.accountId,
      score: game.score,
      difficulty: game.currentDifficulty,
    });
  };

  game.onDifficultyChange = (difficulty) => {
    postToHub({
      type: "DIFFICULTY",
      gameId: info.gameId,
      accountId: info.accountId,
      difficulty,
    });
  };

  let lastTick = 0;
  let lastScore = -1;
  let lastDifficulty: Difficulty = game.currentDifficulty;
  let gameOverSentFor = -1;

  setInterval(() => {
    const score = game.score;
    const difficulty = game.currentDifficulty;
    const now = performance.now();

    // Throttled live ticks so the hub can show "playing… score N".
    if ((score !== lastScore || difficulty !== lastDifficulty) && now - lastTick > 1000) {
      lastTick = now;
      lastScore = score;
      lastDifficulty = difficulty;
      postToHub({
        type: "SCORE_TICK",
        gameId: info.gameId,
        accountId: info.accountId,
        score,
        difficulty,
      });
    }

    // Exactly one GAME_OVER per run; rearms when a new run starts (R restart).
    if (game.isGameOver && gameOverSentFor !== score) {
      gameOverSentFor = score;
      postToHub({
        type: "GAME_OVER",
        gameId: info.gameId,
        accountId: info.accountId,
        score,
        difficulty,
      });
    }
    if (!game.isGameOver && gameOverSentFor !== -1 && score === 0) {
      gameOverSentFor = -1;
      lastScore = -1;
    }
  }, 500);

  return info;
}
