import { derived } from "svelte/store";
import { ScreenWidth, screenWidth } from "./screenDimensions";

export const numberOfColumns = derived(screenWidth, ($screenWidth) => {
    return $screenWidth === ScreenWidth.ExtraExtraLarge ? 3 : 2;
});
