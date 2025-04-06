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

type Dimensions = {
    width: number;
    height: number;
};

export class ScreenDimensionState {
    #getDimensions = () => {
        return { width: window.innerWidth, height: window.innerHeight };
    };
    #resize = () => {
        this.#dimensions = this.#getDimensions();
    };
    #dimensions = $state<Dimensions>(this.#getDimensions());
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

    #pixelsFromRems(rem: number, width: number): number {
        if (width < 768) {
            return rem * 14;
        } else {
            return rem * 16;
        }
    }

    // this probably does not belong here
    toPixel(rem: number): number {
        return this.#pixelsFromRems(rem, this.#dimensions.width);
    }

    #fullWidth = $derived(this.#breakpoint === ScreenWidth.ExtraExtraLarge);
    #mobileWidth = $derived(this.#dimensions.width < 768);
    #ipadWidth = $derived(this.#dimensions.width < 992);
    #availableHeight = $derived(
        this.#dimensions.height - this.#pixelsFromRems(5, this.#dimensions.width),
    );

    constructor() {
        window.addEventListener("resize", this.#resize);
    }

    public get dimensions(): Readonly<Dimensions> {
        return this.#dimensions;
    }

    public get breakpoint() {
        return this.#breakpoint;
    }

    public get mobileWidth() {
        return this.#mobileWidth;
    }

    public get fullWidth() {
        return this.#fullWidth;
    }

    public get ipadWidth() {
        return this.#ipadWidth;
    }

    public get availableHeight() {
        return this.#availableHeight;
    }
}
