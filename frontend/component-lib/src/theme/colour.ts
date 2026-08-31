import { CssVariable } from "./variable";

export const defaultBackgroundGradient =
    "linear-gradient(90deg, var(--validation-warning) 0%, var(--primary) 30%, var(--primary) 70%, var(--tertiary) 100%)";

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

    rgbComponentCssVariable(name: string): CssVariable {
        return new CssVariable(`${name}-rgb-cmp`, `${this.#r} ${this.#g} ${this.#b}`);
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
    | "warning"
    | "accent"
    | "primary"
    | "secondary"
    | "placeholder"
    | "on-primary";

export class Colours {
    public gradient: Gradient;
    public gradientInverted: Gradient;

    constructor(
        // Theme static colours
        public surface0: Colour,
        public surface1: Colour,
        public surface2: Colour,
        public surfaceDisabled: Colour,
        public textOnDisabledSurface: Colour,
        public inputBackground: Colour,
        public inputPlaceholder: Colour,
        public backdrop: Colour,
        public mainNavBackground: Colour,
        public draftAttachmentSurface: Colour,
        public draftReplySurface: Colour,
        public chatBubbleReceived: Colour,
        public chatBubbleReplyReceived: Colour,
        public chatInputBackground: Colour,
        public chatInputPlaceholder: Colour,
        // Feedback colours
        public validationSuccess: Colour,
        public validationWarning: Colour,
        public validationError: Colour,
        public successSurface: Colour,
        public warningSurface: Colour,
        public errorSurface: Colour,
        public textOnFeedbackSurface: Colour,
        // Theme specific colours
        public primary: Colour,
        public primaryAccent: Colour,
        public primarySurface: Colour,
        public secondary: Colour,
        public secondaryAccent: Colour,
        public secondarySurface: Colour,
        public tertiary: Colour,
        public tertiaryAccent: Colour,
        public tertiarySurface: Colour,
        public textPrimary: Colour,
        public textSecondary: Colour,
        public textOnPrimary: Colour,
        public gradientPrimary: Colour,
        public gradientSecondary: Colour,
        // Optional colours
        public chatBackground?: Colour,
        public chatHeaderSeparator?: Colour,
        public chatDecorations?: Colour,
        public chatBubbleSent?: Colour,
        public chatTextSent?: Colour,
        public chatMetadataSent?: Colour,
        public chatMetadataFill?: Colour,
        public chatBubbleDeleted?: Colour,
        public chatBubbleFocusOutline?: Colour,
        public chatReactionBackground?: Colour,
        // Static across all themes
        public transparent: Colour = Colour.fromRGBA(0, 0, 0, 0),
    ) {
        this.gradient = new Gradient(gradientPrimary, gradientSecondary);
        this.gradientInverted = new Gradient(gradientSecondary, gradientPrimary);
    }

    cssVariables(): CssVariable[] {
        return [
            // Theme static colours
            this.surface0.cssVariable("surface-0"),
            this.surface1.cssVariable("surface-1"),
            this.surface2.cssVariable("surface-2"),
            this.surface0.rgbComponentCssVariable("surface-0"),
            this.surface1.rgbComponentCssVariable("surface-1"),
            this.surface2.rgbComponentCssVariable("surface-2"),
            this.surfaceDisabled.cssVariable("surface-disabled"),
            this.textOnDisabledSurface.cssVariable("text-on-disabled-surface"),
            this.inputBackground.cssVariable("input-background"),
            this.inputPlaceholder.cssVariable("input-placeholder"),
            this.backdrop.cssVariable("backdrop"),
            this.mainNavBackground.cssVariable("main-nav-background"),
            this.draftAttachmentSurface.cssVariable("draft-attachment-surface"),
            this.draftReplySurface.cssVariable("draft-reply-surface"),
            this.chatBubbleReceived.cssVariable("chat-bubble-received"),
            this.chatBubbleReplyReceived.cssVariable("chat-bubble-reply-received"),
            this.chatInputBackground.cssVariable("chat-input-background"),
            this.chatInputPlaceholder.cssVariable("chat-input-placeholder"),
            // Feedback colours
            this.validationSuccess.cssVariable("validation-success"),
            this.validationWarning.cssVariable("validation-warning"),
            this.validationError.cssVariable("validation-error"),
            this.successSurface.cssVariable("success-surface"),
            this.warningSurface.cssVariable("warning-surface"),
            this.errorSurface.cssVariable("error-surface"),
            this.textOnFeedbackSurface.cssVariable("text-on-feedback-surface"),
            // Theme specific colours
            this.primary.cssVariable("primary"),
            this.primaryAccent.cssVariable("primary-accent"),
            this.primarySurface.cssVariable("primary-surface"),
            this.secondary.cssVariable("secondary"),
            this.secondaryAccent.cssVariable("secondary-accent"),
            this.secondarySurface.cssVariable("secondary-surface"),
            this.tertiary.cssVariable("tertiary"),
            this.tertiaryAccent.cssVariable("tertiary-accent"),
            this.tertiarySurface.cssVariable("tertiary-surface"),
            this.textPrimary.cssVariable("text-primary"),
            this.textSecondary.cssVariable("text-secondary"),
            this.textOnPrimary.cssVariable("text-on-primary"),
            this.gradientPrimary.cssVariable("gradient-primary"),
            this.gradientSecondary.cssVariable("gradient-secondary"),
            this.gradient.cssVariable("gradient"),
            this.gradientInverted.cssVariable("gradient-inverted"),
            // Optional colours
            (this.chatBackground ?? this.surface0).cssVariable("chat-background"),
            (this.chatHeaderSeparator ?? this.surface1).cssVariable("chat-header-separator"),
            (this.chatDecorations ?? this.surface1).cssVariable("chat-decorations"),
            (this.chatBubbleSent ?? this.primarySurface).cssVariable("chat-bubble-sent"),
            (this.chatTextSent ?? this.textOnPrimary).cssVariable("chat-text-sent"),
            (this.chatMetadataSent ?? this.primaryAccent).cssVariable("chat-metadata-sent"),
            // TODO is this a special case, static across dark and light themes?
            (this.chatMetadataFill ?? Colour.fromHex("#FFFFFF")).cssVariable("chat-metadata-fill"),
            (this.chatBubbleDeleted ?? this.surfaceDisabled).cssVariable("chat-bubble-deleted"),
            (this.chatBubbleFocusOutline ?? this.secondary).cssVariable(
                "chat-bubble-focus-outline",
            ),
            (this.chatReactionBackground ?? this.surface1).cssVariable("chat-reaction-background"),
            // Static across all themes
            this.transparent.cssVariable("transparent"),
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
