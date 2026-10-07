import { bridges, chatRooms, lightUp, loopy, slant, tents, unruly, type DailyGame } from "@client";
import type { Component } from "svelte";
import BridgesBoard from "../components/home/dailypuzzle/games/bridges/Board.svelte";
import bridgesDemo from "../components/home/dailypuzzle/games/bridges/demo";
import BridgesPictogram from "../components/home/dailypuzzle/games/bridges/Pictogram.svelte";
import ChatRoomsBoard from "../components/home/dailypuzzle/games/chat_rooms/Board.svelte";
import chatRoomsDemo from "../components/home/dailypuzzle/games/chat_rooms/demo";
import ChatRoomsPictogram from "../components/home/dailypuzzle/games/chat_rooms/Pictogram.svelte";
import LightUpBoard from "../components/home/dailypuzzle/games/light_up/Board.svelte";
import lightUpDemo from "../components/home/dailypuzzle/games/light_up/demo";
import LightUpPictogram from "../components/home/dailypuzzle/games/light_up/Pictogram.svelte";
import LoopyBoard from "../components/home/dailypuzzle/games/loopy/Board.svelte";
import loopyDemo from "../components/home/dailypuzzle/games/loopy/demo";
import LoopyPictogram from "../components/home/dailypuzzle/games/loopy/Pictogram.svelte";
import SlantBoard from "../components/home/dailypuzzle/games/slant/Board.svelte";
import slantDemo from "../components/home/dailypuzzle/games/slant/demo";
import SlantPictogram from "../components/home/dailypuzzle/games/slant/Pictogram.svelte";
import TentsBoard from "../components/home/dailypuzzle/games/tents/Board.svelte";
import tentsDemo from "../components/home/dailypuzzle/games/tents/demo";
import TentsPictogram from "../components/home/dailypuzzle/games/tents/Pictogram.svelte";
import type {
    BoardProps,
    DemoSpec,
    PictogramProps,
} from "../components/home/dailypuzzle/games/types";
import UnrulyBoard from "../components/home/dailypuzzle/games/unruly/Board.svelte";
import unrulyDemo from "../components/home/dailypuzzle/games/unruly/demo";
import UnrulyPictogram from "../components/home/dailypuzzle/games/unruly/Pictogram.svelte";
import { bindBoard, type PuzzleBoard } from "./puzzleBoard.svelte";

// Everything the app needs to render one kind of daily puzzle. The weekday rota can name any
// game the backend generates; a game_id missing from this registry is one this build predates.
// See components/home/dailypuzzle/games/README.md for what a new game must provide.
export type DailyPuzzleGameDef = {
    /** GameId as the backend names it, e.g. "light_up". */
    id: string;
    /** en.json prefix for the game's strings: `${i18nPrefix}.name`, `.rules`, `.technique.<id>`. */
    i18nPrefix: string;
    /** "How to play", shown in place of the inert board before the player starts. */
    demo?: DemoSpec;
    /** A board on `description`, with `filled` already marked. Throws on bad bytes. */
    newBoard(description: Uint8Array, filled?: [number, number][]): PuzzleBoard;
};

// The game's model and state types are in scope here and nowhere else: every board it makes
// keeps them, so the registry and everything that reads it never needs to name them.
function defineGame<M, S>(def: {
    game: DailyGame<M, S>;
    Board: Component<BoardProps<M, S>>;
    Pictogram: Component<PictogramProps<M>>;
    demo?: DemoSpec;
}): DailyPuzzleGameDef {
    return {
        id: def.game.id,
        i18nPrefix: gameI18nPrefix(def.game.id),
        demo: def.demo,
        newBoard: (description, filled) =>
            bindBoard(def.game, def.Board, def.Pictogram, description, filled),
    };
}

export function gameI18nPrefix(gameId: string): string {
    return `dailyPuzzle.games.${gameId}`;
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
