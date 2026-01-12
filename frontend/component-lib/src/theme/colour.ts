import { CssVariable } from "./variable";

export class Colour {
    #r: number;
    #g: number;
    #b: number;
    #a: number;

    private constructor(r: number, g: number, b: number, a: number = 1) {
        this.#r = r;
        this.#g = g;
        this.#b = b;
        this.#a = a;
    }

    cssVariable(name: string): CssVariable {
        return new CssVariable(name, this.toString());
    }

    toString(): string {
        return this.#a < 1 ? this.toRgbaCss() : this.toHex();
    }

    static fromRGBA(r: number, g: number, b: number, a: number = 1) {
        return new Colour(r, g, b, a);
    }

    static fromHex(hex: string): Colour {
        const clean = hex.replace(/^#/, "");
        const bigint = parseInt(clean, 16);
        if (clean.length === 6) {
            return new Colour((bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255);
        }
        throw new Error("Unsupported hex format");
    }

    toHex(): string {
        return (
            "#" + [this.#r, this.#g, this.#b].map((x) => x.toString(16).padStart(2, "0")).join("")
        );
    }

    toRgbCss(): string {
        return `rgb(${this.#r}, ${this.#g}, ${this.#b})`;
    }

    toRgbaCss(): string {
        return `rgba(${this.#r}, ${this.#g}, ${this.#b}, ${this.#a})`;
    }

    toHsl(): { h: number; s: number; l: number } {
        // Convert RGB to HSL
        const r = this.#r / 255,
            g = this.#g / 255,
            b = this.#b / 255;
        const max = Math.max(r, g, b),
            min = Math.min(r, g, b);
        let h = 0,
            s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    lighten(percent: number): Colour {
        const { h, s, l } = this.toHsl();
        return Colour.fromHsl(h, s, Math.min(100, l + percent));
    }

    darken(percent: number): Colour {
        const { h, s, l } = this.toHsl();
        return Colour.fromHsl(h, s, Math.max(0, l - percent));
    }

    mix(other: Colour, ratio = 0.5): Colour {
        // ratio = 0 => this, ratio = 1 => other
        const r = Math.round(this.#r + (other.#r - this.#r) * ratio);
        const g = Math.round(this.#g + (other.#g - this.#g) * ratio);
        const b = Math.round(this.#b + (other.#b - this.#b) * ratio);
        const a = this.#a + (other.#a - this.#a) * ratio;
        return new Colour(r, g, b, a);
    }

    #generateGradient(to: Colour, steps: number): Colour[] {
        if (steps < 2) throw new Error("Gradient needs at least 2 steps");

        const colours: Colour[] = [];
        for (let i = 0; i < steps; i++) {
            const ratio = i / (steps - 1);
            colours.push(this.mix(to, ratio));
        }
        return colours;
    }

    toLinearGradient(to: Colour, steps = 2, direction = "to right"): string {
        const colours = this.#generateGradient(to, steps);
        const stops = colours.map((c) => c.toHex()).join(", ");
        return `linear-gradient(${direction}, ${stops})`;
    }

    static fromHsl(h: number, s: number, l: number): Colour {
        s /= 100;
        l /= 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r = 0,
            g = 0,
            b = 0;
        if (h < 60) [r, g, b] = [c, x, 0];
        else if (h < 120) [r, g, b] = [x, c, 0];
        else if (h < 180) [r, g, b] = [0, c, x];
        else if (h < 240) [r, g, b] = [0, x, c];
        else if (h < 300) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];

        return new Colour(
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255),
        );
    }
}

export class Gradient {
    #from: Colour;
    #to: Colour;

    constructor(from: Colour, to: Colour) {
        this.#from = from;
        this.#to = to;
    }

    cssVariable(name: string): CssVariable {
        return new CssVariable(name, this.toString());
    }

    toString(): string {
        return this.#from.toLinearGradient(this.#to);
    }

    summarise(): string {
        return `${this.#from.toString()} / ${this.#to.toString()}`;
    }
}

export type TypographyColour =
    | "error"
    | "accent"
    | "primary"
    | "secondary"
    | "tertiary"
    | "placeholder"
    | "on-primary";

export class Colours {
    public gradient: Gradient;
    public gradientInverted: Gradient;

    constructor(
        public primary: Colour,
        public secondary: Colour,
        public tertiary: Colour,
        public success: Colour,
        public warning: Colour,
        public error: Colour,
        public primaryMuted: Colour,
        public secondaryMuted: Colour,
        public tertiaryMuted: Colour,
        public primaryLight: Colour,
        public secondaryLight: Colour,
        public tertiaryLight: Colour,
        public background0: Colour,
        public background1: Colour,
        public background2: Colour,
        public disabledButton: Colour,
        public textPrimary: Colour,
        public textSecondary: Colour,
        public textTertiary: Colour,
        public textPlaceholder: Colour,
        public textOnPrimary: Colour,
        public textAccent: Colour,
        public gradientPrimary: Colour,
        public gradientSecondary: Colour,
    ) {
        this.gradient = new Gradient(gradientPrimary, gradientSecondary);
        this.gradientInverted = new Gradient(gradientSecondary, gradientPrimary);
    }

    cssVariables(): CssVariable[] {
        return [
            this.primary.cssVariable("primary"),
            this.secondary.cssVariable("secondary"),
            this.tertiary.cssVariable("tertiary"),
            this.success.cssVariable("success"),
            this.warning.cssVariable("warning"),
            this.error.cssVariable("error"),
            this.primaryMuted.cssVariable("primary-muted"),
            this.secondaryMuted.cssVariable("secondary-muted"),
            this.tertiaryMuted.cssVariable("tertiary-muted"),
            this.primaryLight.cssVariable("primary-light"),
            this.secondaryLight.cssVariable("secondary-light"),
            this.tertiaryLight.cssVariable("tertiary-light"),
            this.background0.cssVariable("background-0"),
            this.background1.cssVariable("background-1"),
            this.background2.cssVariable("background-2"),
            this.disabledButton.cssVariable("disabled-button"),
            this.textPrimary.cssVariable("text-primary"),
            this.textSecondary.cssVariable("text-secondary"),
            this.textTertiary.cssVariable("text-tertiary"),
            this.textPlaceholder.cssVariable("text-placeholder"),
            this.textOnPrimary.cssVariable("text-on-primary"),
            this.textAccent.cssVariable("text-accent"),
            this.gradient.cssVariable("gradient"),
            this.gradientInverted.cssVariable("gradient-inverted"),
            this.gradientPrimary.cssVariable("gradient-primary"),
            this.gradientSecondary.cssVariable("gradient-secondary"),
        ];
    }
}

function toKebabCase(key: string) {
    return key
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
        .toLowerCase();
}

export type ColourVarKeys = Exclude<keyof Colours, keyof object | "cssVariables">;
type ColourVarsType = Record<ColourVarKeys, string>;

const dummyColour = Colour.fromHex("#000000");

// this is a little bit of a hack but ...
export const ColourVars: ColourVarsType = Object.fromEntries(
    Object.keys(
        new Colours(
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
            dummyColour,
        ),
    ).map((k) => [k, `var(--${toKebabCase(k)})`]),
) as ColourVarsType;
