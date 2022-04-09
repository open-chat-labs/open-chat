import { derived } from "svelte/store";
import { mobileWidth } from "./screenDimensions";

export const iconSize = derived(mobileWidth, ($mobileWidth) => {
    return $mobileWidth ? "1.4rem" : "1.5rem";
});
