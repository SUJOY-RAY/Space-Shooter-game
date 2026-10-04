# Space Shooter

Canvas arcade shooter microservice (`space-shooter`, port `5101`). Fully
standalone, and embeddable in the Game Manager hub (iframe + postMessage).

## Quickstart

```sh
npm install
npm run dev        # vite --host --port 5101 --strictPort
```

Play at http://localhost:5101, or via the hub (`../Manager`, `npm run dev`).
`npm run build` / `npm run typecheck` work as usual.

## Controls

- **Move**: Arrows / WASD (touch: left D-pad)
- **Fire**: `X`/`Space` up · `Z`/`C` sides · `Z+X` / `X+C` diagonals
  (touch: right fire joystick — drag to aim, release to stop)
- **System**: `1/2/3` difficulty · `R` restart · `Q` quit to hub ·
  `M` mute · `Enter` start

## Difficulties

Easy / Normal / Hard scale spawn rate, enemy HP/speed/fire-rate and score
multiplier (`src/difficulty.ts`), and swap the enemy AI brains (below).
The hub passes `?difficulty=` in and the game echoes tier changes back.

## ML enemies (`src/ml/`)

Enemies are driven by fitted sklearn-style models, not hand-written rules —
same inference code path on every tier, only the brains differ:

- Toolkit: `scaler` (StandardScaler) · `linear` (ridge) · `logistic`
  (batch GD) · `tree` (CART/gini) · `knn` · `rng` (mulberry32).
- `enemyModels.ts` trains one `Brain` per difficulty at load from
  physics-derived demonstrations (seeded → identical brains every load):
  intercept lead, fire/burst gates, orbit band + direction, dive pursuit,
  k-NN dodge memory. Easy runs ablated (zero) heads + heavy exploration
  noise; hard gets more data, full dodge memory and tiny noise.

See `src/enties/enemies.ts` for the inference call sites
(`getBrain(difficulty)` + `predict*` / `should*` / `jitter`).

## Hub bridge (`src/manager-bridge.ts`)

Standalone it just plays. With `?embed=1&gameId&accountId&accountName&
difficulty` (or inside any parent frame) it posts
`GAME_READY` / `SCORE_TICK` (throttled) / `GAME_OVER` (once per run) /
`QUIT_TO_HUB` (`Q`) / `DIFFICULTY` (`1/2/3`) as
`{ source: "space-shooter", … }` so the hub can persist runs.

## Layout

- `src/game.ts` — game state, spawner, scoring
- `src/enties/` + `src/systems/` — enemies, bullets, collisions
- `src/ml/` — model toolkit + per-difficulty brains
- `src/input.ts` / `src/touch.ts` — keyboard + arcade touch pad
- `src/sfx.ts` — synthesized WebAudio SFX (`M` mutes, persisted)
