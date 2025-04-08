import { LayoutState } from "./layout.svelte";
import { PathState } from "./path.svelte";
import { ScreenDimensionState } from "./screenDimensions.svelte";

class GlobalState {
    #screenDimensions = new ScreenDimensionState();
    #path = new PathState();
    #layout = new LayoutState(this.#screenDimensions, this.#path);

    public get screenDimensions(): ScreenDimensionState {
        return this.#screenDimensions;
    }

    public get layout(): LayoutState {
        return this.#layout;
    }

    public get path(): PathState {
        return this.#path;
    }
}

export const globalState = new GlobalState();
