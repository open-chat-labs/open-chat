import { readable, derived } from "svelte/store";

const dimensions = readable(
    { width: window.innerWidth, height: window.innerHeight },
    function start(set) {
        function resize() {
            set({ width: window.innerWidth, height: window.innerHeight });
        }

        window.addEventListener("resize", resize);

        return function stop() {
            window.removeEventListener("resize", resize);
        };
    }
);

export const enum ScreenWidth {
    ExtraExtraSmall = "ExtraExtraSmall",
    ExtraSmall = "ExtraSmall",
    Small = "Small",
    Medium = "Medium",
    Large = "Large",
    ExtraLarge = "ExtraLarge",
}

export const enum ScreenHeight {
    Small = "Small",
    Large = "Large",
}

export const screenWidth = derived(dimensions, ($dimensions) => {
    if ($dimensions.width < 354) {
        return ScreenWidth.ExtraExtraSmall;
    } else if ($dimensions.width < 576) {
        return ScreenWidth.ExtraSmall;
    } else if ($dimensions.width < 768) {
        return ScreenWidth.Small;
    } else if ($dimensions.width < 992) {
        return ScreenWidth.Medium;
    } else if ($dimensions.width < 1200) {
        return ScreenWidth.Large;
    } else {
        return ScreenWidth.ExtraLarge;
    }
});

export const mobileWidth = derived(dimensions, ($dimensions) => {
    return $dimensions.width < 768;
});

export const screenHeight = derived(dimensions, ($dimensions) => {
    if ($dimensions.height < 768) {
        return ScreenHeight.Small;
    } else {
        return ScreenHeight.Large;
    }
});
