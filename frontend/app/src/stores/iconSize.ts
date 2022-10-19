import { derived } from "svelte/store";
import { mobileWidth } from "./screenDimensions";

export const iconSize = derived(mobileWidth, ($mobileWidth) => {
    return $mobileWidth ? "1.4em" : "1.5em";
});
