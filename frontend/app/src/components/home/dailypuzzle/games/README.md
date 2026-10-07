# Daily puzzle games

The shell (`utils/dailyPuzzle.svelte.ts`) and both puzzle screens know nothing about any
particular game. Each game plugs in through `DailyGame<M, S>`
(`openchat-shared/src/utils/dailyGames/types.ts`) and a registry entry
(`utils/dailyPuzzleGames.ts`).

## What a new game must provide

1. `openchat-shared/src/utils/dailyGames/<game>.ts`: the wire-format parser and rule checker,
   plus an exported `DailyGame<M, S>` object (see `lightUp.ts`). Keep helper names short inside
   the module and export only the game object and its types from `dailyGames/index.ts`, so
   `parseDescription` in one game never clashes with another's.
2. `games/<game>/Board.svelte`: props are `BoardProps<M, S>` (`games/types.ts`). The model,
   state, marks and lit cells come on `board`, the board the component belongs to (see
   `utils/puzzleBoard.svelte.ts`). Draw from
   `game.elements(model)`, read marks from `marks`, paint `violations` by `kind` (the shell adds
   `"mistake"` for keys the server flagged), and call `onTap(key)`. Wrap the drawing in
   `GridSvg.svelte`; `gridSvg.ts` turns elements into rects, gives centres for marks and
   labels, `vertex()` for corner clues and `outside()` for row/column counts (reserve room with
   GridSvg's `margin`).
3. `games/<game>/Pictogram.svelte`: props `PictogramProps<M>` (the model on `board`), givens
   only, for result cards.
4. Strings in `i18n/en.json` under `dailyPuzzle.games.<game>`: `name`, `rules`, a
   `technique.<id>` for every technique id the backend can serve, and the demo captions
   (nested: `"technique": { "1": ... }`). en.json is the only copy; the translation editor and
   the locale files key off it.
5. A `defineGame({...})` entry in `utils/dailyPuzzleGames.ts`.

Puzzle colours are fixed (not theme tokens) so a board reads the same in every theme.
