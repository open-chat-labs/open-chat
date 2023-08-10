import { readable, derived, get } from "svelte/store";

export const dimensions = readable(
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
    ExtraExtraLarge = "ExtraExtraLarge",
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
    } else if ($dimensions.width < 1792) {
        return ScreenWidth.ExtraLarge; // this is the default width on 15' macbook
    } else {
        return ScreenWidth.ExtraExtraLarge;
    }
});

export const mobileWidth = derived(dimensions, ($dimensions) => {
    return $dimensions.width < 768;
});

export const ipadWidth = derived(dimensions, ($dimensions) => {
    return $dimensions.width < 992;
});

export const availableHeight = derived(dimensions, ($dimensions) => {
    return $dimensions.height - pixelsFromRems(5, $dimensions.width);
});

export function toPixel(rem: number): number {
    const dim = get(dimensions);
    return pixelsFromRems(rem, dim.width);
}

function pixelsFromRems(rem: number, width: number): number {
    if (width < 768) {
        return rem * 14;
    } else {
        return rem * 16;
    }
}

export const screenHeight = derived(dimensions, ($dimensions) => {
    if ($dimensions.height < 768) {
        return ScreenHeight.Small;
    } else {
        return ScreenHeight.Large;
    }
});
