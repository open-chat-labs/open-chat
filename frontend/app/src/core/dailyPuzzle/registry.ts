import {
    bridges,
    chatRooms,
    dailyPuzzleStore,
    lightUp,
    loopy,
    slant,
    tents,
    todaysPuzzle,
    unruly,
    type DailyGame,
    type DailyPuzzleState,
    type OpenChat,
    type PublicDailyPuzzle,
} from "@client";
import type { Component } from "svelte";
import BridgesBoard from "./games/bridges/Board.svelte";
import bridgesDemo from "./games/bridges/demo";
import BridgesPictogram from "./games/bridges/Pictogram.svelte";
import ChatRoomsBoard from "./games/chat_rooms/Board.svelte";
import chatRoomsDemo from "./games/chat_rooms/demo";
import ChatRoomsPictogram from "./games/chat_rooms/Pictogram.svelte";
import LightUpBoard from "./games/light_up/Board.svelte";
import lightUpDemo from "./games/light_up/demo";
import LightUpPictogram from "./games/light_up/Pictogram.svelte";
import LoopyBoard from "./games/loopy/Board.svelte";
import loopyDemo from "./games/loopy/demo";
import LoopyPictogram from "./games/loopy/Pictogram.svelte";
import SlantBoard from "./games/slant/Board.svelte";
import slantDemo from "./games/slant/demo";
import SlantPictogram from "./games/slant/Pictogram.svelte";
import TentsBoard from "./games/tents/Board.svelte";
import tentsDemo from "./games/tents/demo";
import TentsPictogram from "./games/tents/Pictogram.svelte";
import type { BoardProps, DemoSpec, PictogramProps } from "./games/types";
import UnrulyBoard from "./games/unruly/Board.svelte";
import unrulyDemo from "./games/unruly/demo";
import UnrulyPalette from "./games/unruly/Palette.svelte";
import UnrulyPictogram from "./games/unruly/Pictogram.svelte";
import {
    DailyPuzzleGame,
    gameI18nPrefix,
    type PuzzleGameDef,
    type PuzzleHost,
} from "@src/logic/dailyPuzzle/dailyPuzzle.svelte";
import { bindBoard } from "@src/logic/dailyPuzzle/puzzleBoard.svelte";

// Everything the app needs to render one kind of daily puzzle. The weekday rota can name any
// game the backend generates; a game_id missing from this registry is one this build predates.
// See core/dailyPuzzle/games/README.md for what a new game must provide.
export type DailyPuzzleGameDef = PuzzleGameDef & {
    /** "How to play", shown in place of the inert board before the player starts. */
    demo?: DemoSpec;
    /** Per-device display options, shown beside the time, hints and streak. */
    Settings?: Component;
};

// The game's model and state types are in scope here and nowhere else: every board it makes
// keeps them, so the registry and everything that reads it never needs to name them.
function defineGame<M, S>(def: {
    game: DailyGame<M, S>;
    Board: Component<BoardProps<M, S>>;
    Pictogram: Component<PictogramProps<M>>;
    demo?: DemoSpec;
    Settings?: Component;
}): DailyPuzzleGameDef {
    return {
        id: def.game.id,
        i18nPrefix: gameI18nPrefix(def.game.id),
        demo: def.demo,
        Settings: def.Settings,
        newBoard: (description, filled) =>
            bindBoard(def.game, def.Board, def.Pictogram, description, filled),
    };
}

export const dailyPuzzleGames: Record<string, DailyPuzzleGameDef> = {
    [lightUp.id]: defineGame({
        game: lightUp,
        Board: LightUpBoard,
        Pictogram: LightUpPictogram,
        demo: lightUpDemo,
    }),
    [tents.id]: defineGame({
        game: tents,
        Board: TentsBoard,
        Pictogram: TentsPictogram,
        demo: tentsDemo,
    }),
    [slant.id]: defineGame({
        game: slant,
        Board: SlantBoard,
        Pictogram: SlantPictogram,
        demo: slantDemo,
    }),
    [bridges.id]: defineGame({
        game: bridges,
        Board: BridgesBoard,
        Pictogram: BridgesPictogram,
        demo: bridgesDemo,
    }),
    [loopy.id]: defineGame({
        game: loopy,
        Board: LoopyBoard,
        Pictogram: LoopyPictogram,
        demo: loopyDemo,
    }),
    [unruly.id]: defineGame({
        game: unruly,
        Board: UnrulyBoard,
        Pictogram: UnrulyPictogram,
        demo: unrulyDemo,
        Settings: UnrulyPalette,
    }),
    [chatRooms.id]: defineGame({
        game: chatRooms,
        Board: ChatRoomsBoard,
        Pictogram: ChatRoomsPictogram,
        demo: chatRoomsDemo,
    }),
};

export function dailyPuzzleGame(gameId: string): DailyPuzzleGameDef | undefined {
    return dailyPuzzleGames[gameId];
}

/**
 * Today's puzzle for `gameId` (with no id, the first enabled one), if it's on today: a link or an
 * old result message can name any game, and one that's off today isn't offered.
 */
export function openablePuzzle(
    state: DailyPuzzleState,
    gameId: string | undefined,
): PublicDailyPuzzle | undefined {
    const puzzle = todaysPuzzle(state, gameId);
    return puzzle?.enabled ? puzzle : undefined;
}

/**
 * Today's puzzle for `gameId` (with no id, the first enabled one) and a play session on it, told
 * by `host` how to say a step failed and how to translate. No puzzle when there is none on today
 * (openablePuzzle); no session when this build cannot render its game (`def` undefined).
 */
export function openDailyPuzzle(
    client: OpenChat,
    gameId: string | undefined,
    userId: string,
    host: PuzzleHost,
): { puzzle?: PublicDailyPuzzle; def?: DailyPuzzleGameDef; game?: DailyPuzzleGame } {
    const puzzle = openablePuzzle(dailyPuzzleStore.value, gameId);
    const def = puzzle !== undefined ? dailyPuzzleGame(puzzle.gameId) : undefined;
    if (puzzle === undefined || def === undefined) return { puzzle, def };
    return {
        puzzle,
        def,
        game: new DailyPuzzleGame(client, puzzle, userId, def, def.demo !== undefined, host),
    };
}
