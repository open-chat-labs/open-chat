import { readable, derived } from "svelte/store";

const width = readable(window.innerWidth, function start(set) {
    function resize() {
        set(window.innerWidth);
    }

    window.addEventListener("resize", resize);

    return function stop() {
        window.removeEventListener("resize", resize);
    };
});

export const enum ScreenWidth {
    ExtraSmall = "ExtraSmall",
    Small = "Small",
    Medium = "Medium",
    Large = "Large",
}

export const screenWidth = derived(width, ($width) => {
    if ($width < 576) {
        return ScreenWidth.ExtraSmall;
    } else if ($width < 768) {
        return ScreenWidth.Small;
    } else if ($width < 992) {
        return ScreenWidth.Medium;
    } else {
        return ScreenWidth.Large;
    }
});
