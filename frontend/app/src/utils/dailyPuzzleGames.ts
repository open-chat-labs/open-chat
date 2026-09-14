import { bridges, lightUp, loopy, slant, tents, unruly, type DailyGame } from "@client";
import type { Component } from "svelte";
import BridgesBoard from "../components/home/dailypuzzle/games/bridges/Board.svelte";
import bridgesStrings from "../components/home/dailypuzzle/games/bridges/i18n.en.json";
import BridgesPictogram from "../components/home/dailypuzzle/games/bridges/Pictogram.svelte";
import LoopyBoard from "../components/home/dailypuzzle/games/loopy/Board.svelte";
import loopyStrings from "../components/home/dailypuzzle/games/loopy/i18n.en.json";
import LoopyPictogram from "../components/home/dailypuzzle/games/loopy/Pictogram.svelte";
import SlantBoard from "../components/home/dailypuzzle/games/slant/Board.svelte";
import slantStrings from "../components/home/dailypuzzle/games/slant/i18n.en.json";
import SlantPictogram from "../components/home/dailypuzzle/games/slant/Pictogram.svelte";
import TentsBoard from "../components/home/dailypuzzle/games/tents/Board.svelte";
import tentsStrings from "../components/home/dailypuzzle/games/tents/i18n.en.json";
import TentsPictogram from "../components/home/dailypuzzle/games/tents/Pictogram.svelte";
import UnrulyBoard from "../components/home/dailypuzzle/games/unruly/Board.svelte";
import unrulyStrings from "../components/home/dailypuzzle/games/unruly/i18n.en.json";
import UnrulyPictogram from "../components/home/dailypuzzle/games/unruly/Pictogram.svelte";
import LightUpBoard from "../components/home/dailypuzzle/games/light_up/Board.svelte";
import lightUpStrings from "../components/home/dailypuzzle/games/light_up/i18n.en.json";
import LightUpPictogram from "../components/home/dailypuzzle/games/light_up/Pictogram.svelte";
import type {
    BoardProps,
    DemoSpec,
    PictogramProps,
} from "../components/home/dailypuzzle/games/types";
import loopyDemo from "../components/home/dailypuzzle/games/loopy/demo";
import bridgesDemo from "../components/home/dailypuzzle/games/bridges/demo";
import lightUpDemo from "../components/home/dailypuzzle/games/light_up/demo";
import slantDemo from "../components/home/dailypuzzle/games/slant/demo";
import tentsDemo from "../components/home/dailypuzzle/games/tents/demo";
import unrulyDemo from "../components/home/dailypuzzle/games/unruly/demo";

// Everything the app needs to render one kind of daily puzzle. The weekday rota can name any
// game the backend generates; a game_id missing from this registry is one this build predates.
// See components/home/dailypuzzle/games/README.md for what a new game must provide.
export type DailyPuzzleGameDef = {
    game: DailyGame<unknown, unknown>;
    Board: Component<BoardProps<unknown, unknown>>;
    Pictogram: Component<PictogramProps<unknown>>;
    /** en.json prefix for the game's strings: `${i18nPrefix}.name`, `.rules`, `.technique.<id>`. */
    i18nPrefix: string;
    /** The game's shipped strings; a spec checks they match en.json under `i18nPrefix`. */
    strings: Record<string, string>;
    /** "How to play", shown in place of the inert board before the player starts. */
    demo?: DemoSpec;
};

// Erases M and S once, at registration, so the screens can render any game through the same
// props. Board and Pictogram are only ever given the model/state of their own game.
function defineGame<M, S>(def: {
    game: DailyGame<M, S>;
    Board: Component<BoardProps<M, S>>;
    Pictogram: Component<PictogramProps<M>>;
    strings: Record<string, string>;
    demo?: DemoSpec;
}): DailyPuzzleGameDef {
    return {
        game: def.game as DailyGame<unknown, unknown>,
        Board: def.Board as unknown as Component<BoardProps<unknown, unknown>>,
        Pictogram: def.Pictogram as unknown as Component<PictogramProps<unknown>>,
        i18nPrefix: gameI18nPrefix(def.game.id),
        strings: def.strings,
        demo: def.demo,
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
        strings: lightUpStrings,
        demo: lightUpDemo,
    }),
    [tents.id]: defineGame({
        game: tents,
        Board: TentsBoard,
        Pictogram: TentsPictogram,
        strings: tentsStrings,
        demo: tentsDemo,
    }),
    [slant.id]: defineGame({
        game: slant,
        Board: SlantBoard,
        Pictogram: SlantPictogram,
        strings: slantStrings,
        demo: slantDemo,
    }),
    [bridges.id]: defineGame({
        game: bridges,
        Board: BridgesBoard,
        Pictogram: BridgesPictogram,
        strings: bridgesStrings,
        demo: bridgesDemo,
    }),
    [loopy.id]: defineGame({
        game: loopy,
        Board: LoopyBoard,
        Pictogram: LoopyPictogram,
        strings: loopyStrings,
        demo: loopyDemo,
    }),
    [unruly.id]: defineGame({
        game: unruly,
        Board: UnrulyBoard,
        Pictogram: UnrulyPictogram,
        strings: unrulyStrings,
        demo: unrulyDemo,
    }),
};

export function dailyPuzzleGame(gameId: string): DailyPuzzleGameDef | undefined {
    return dailyPuzzleGames[gameId];
}
