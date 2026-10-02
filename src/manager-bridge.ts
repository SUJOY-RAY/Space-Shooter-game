// Bridge between the Space Shooter microservice and the Manager hub.
// The game stays fully standalone: when opened directly it just plays.
// When embedded/launched by the Manager (?embed=1&accountId=…), it streams
// progress events so the hub can persist them in IndexedDB.
//
// Protocol (postMessage to parent window):
//   { source: "space-shooter", type: "GAME_READY", gameId, accountId }
//   { source: "space-shooter", type: "SCORE_TICK", gameId, accountId, score }
//   { source: "space-shooter", type: "GAME_OVER",  gameId, accountId, score }
//   { source: "space-shooter", type: "QUIT_TO_HUB", gameId, accountId, score }

export interface BridgeGame {
  readonly score: number;
  readonly isGameOver: boolean;
  onQuit: (() => void) | null;
}

export interface BridgeInfo {
  embedded: boolean;
  gameId: string;
  accountId: string | null;
  accountName: string | null;
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

  const banner = document.getElementById("manager-banner");
  if (banner) {
    if (info.accountName) {
      banner.textContent = `🕹️ Managed session — ${info.accountName} · progress auto-saves to the hub (IndexedDB)`;
      banner.style.display = "block";
    } else if (info.embedded) {
      banner.textContent = "🕹️ Embedded by Game Manager — select an account in the hub to save progress";
      banner.style.display = "block";
    } else {
      banner.style.display = "none";
    }
  }

  postToHub({
    type: "GAME_READY",
    gameId: info.gameId,
    accountId: info.accountId,
  });

  // Q / Quit button inside the game quits back to the hub dashboard.
  game.onQuit = () => {
    postToHub({
      type: "QUIT_TO_HUB",
      gameId: info.gameId,
      accountId: info.accountId,
      score: game.score,
    });
  };

  let lastTick = 0;
  let lastScore = -1;
  let gameOverSentFor = -1;

  setInterval(() => {
    const score = game.score;
    const now = performance.now();

    // Throttled live ticks so the hub can show "playing… score N".
    if (score !== lastScore && now - lastTick > 1000) {
      lastTick = now;
      lastScore = score;
      postToHub({
        type: "SCORE_TICK",
        gameId: info.gameId,
        accountId: info.accountId,
        score,
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
      });
    }
    if (!game.isGameOver && gameOverSentFor !== -1 && score === 0) {
      gameOverSentFor = -1;
      lastScore = -1;
    }
  }, 500);

  return info;
}
