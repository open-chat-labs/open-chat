import { ScreenDimensionState } from "./screenDimensions.svelte";

class GlobalState {
    #screenDimensions = new ScreenDimensionState();
    public get screenDimensions(): ScreenDimensionState {
        return this.#screenDimensions;
    }
}

export const globalState = new GlobalState();
