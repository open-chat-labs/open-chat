import { ScreenWidth } from "./screenDimensions";

class ScreenDimensionState {
    #getDimensions = () => {
        return { width: window.innerWidth, height: window.innerHeight };
    };
    #resize = () => {
        this.#dimensions = this.#getDimensions();
    };
    #dimensions = $state<{ width: number; height: number }>(this.#getDimensions());
    #breakpoint = $derived.by(() => {
        if (this.#dimensions.width < 354) {
            return ScreenWidth.ExtraExtraSmall;
        } else if (this.#dimensions.width < 576) {
            return ScreenWidth.ExtraSmall;
        } else if (this.#dimensions.width < 768) {
            return ScreenWidth.Small;
        } else if (this.#dimensions.width < 992) {
            return ScreenWidth.Medium;
        } else if (this.#dimensions.width < 1200) {
            return ScreenWidth.Large;
        } else if (this.#dimensions.width < 1792) {
            return ScreenWidth.ExtraLarge; // this is the default width on 15' macbook
        } else {
            return ScreenWidth.ExtraExtraLarge;
        }
    });

    #mobileWidth = $derived(this.#dimensions.width < 768);

    constructor() {
        window.addEventListener("resize", this.#resize);
    }

    public get dimensions() {
        return this.#dimensions;
    }

    public get breakpoint() {
        return this.#breakpoint;
    }

    public get mobileWidth() {
        return this.#mobileWidth;
    }
}

class AllState {
    screenDimensions = new ScreenDimensionState();
}

export const allState = new AllState();
