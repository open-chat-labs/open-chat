import { ScreenDimensionState } from "./screenDimensions.svelte";

class GlobalState {
    screenDimensions = new ScreenDimensionState();
}

export const globalState = new GlobalState();
