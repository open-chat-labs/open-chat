import { derived } from "svelte/store";
import { ScreenWidth, screenWidth } from "./screenDimensions";

export const newLayout = localStorage.getItem("openchat_newlayout") === "true";

export const numberOfColumns = derived(screenWidth, ($screenWidth) => {
    if (!newLayout) return 2;
    return $screenWidth === ScreenWidth.ExtraExtraLarge ? 3 : 2;
});
