import { derived } from "svelte/store";
import { configKeys } from "../utils/config";
import { ScreenWidth, screenWidth } from "./screenDimensions";

export const oldLayout = localStorage.getItem(configKeys.oldLayout) === "true";

export const numberOfColumns = derived(screenWidth, ($screenWidth) => {
    if (oldLayout) return 2;
    return $screenWidth === ScreenWidth.ExtraExtraLarge ? 3 : 2;
});
