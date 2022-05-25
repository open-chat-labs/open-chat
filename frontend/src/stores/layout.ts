import { derived } from "svelte/store";
import { ScreenWidth, screenWidth } from "./screenDimensions";

export const oldLayout = localStorage.getItem("openchat_oldlayout") === "true";

export const numberOfColumns = derived(screenWidth, ($screenWidth) => {
    if (oldLayout) return 2;
    return $screenWidth === ScreenWidth.ExtraExtraLarge ? 3 : 2;
});
