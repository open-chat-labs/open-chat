import { BotState } from "./bots.svelte";
import { LayoutState } from "./layout.svelte";
import { PathState } from "./path.svelte";
import { ScreenDimensionState } from "./screenDimensions.svelte";

class GlobalState {
    #screenDimensions = new ScreenDimensionState();
    #path = new PathState();
    #layout = new LayoutState(this.#screenDimensions, this.#path);
    #bots = new BotState();

    public get screenDimensions(): ScreenDimensionState {
        return this.#screenDimensions;
    }

    public get layout(): LayoutState {
        return this.#layout;
    }

    public get path(): PathState {
        return this.#path;
    }

    public get bots(): BotState {
        return this.#bots;
    }
}

export const globalState = new GlobalState();
