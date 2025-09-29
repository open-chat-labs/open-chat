import { CssVariable, type Rem } from ".";

export type TypographicStyleName = Exclude<keyof TypographicStyles, keyof object | "cssVariables">;

export type FontWeight = "light" | "normal" | "semi-bold" | "bold";

export class FontWeights {
    cssVariables(): CssVariable[] {
        return [
            new CssVariable("font-weight-light", "300"),
            new CssVariable("font-weight-normal", "400"),
            new CssVariable("font-weight-semi-bold", "700"),
            new CssVariable("font-weight-bold", "900"),
        ];
    }
}

export class TypographicStyle {
    constructor(
        public fontSize: Rem,
        public lineHeight: Rem,
    ) {}

    cssVariables(name: TypographicStyleName): CssVariable[] {
        return [
            this.fontSize.cssVariable(`typo-${name}`, "sz"),
            this.lineHeight.cssVariable(`typo-${name}`, "lh"),
        ];
    }
}

export class TypographicStyles {
    constructor(
        public overview: TypographicStyle,
        public h1: TypographicStyle,
        public h2: TypographicStyle,
        public title: TypographicStyle,
        public subtitle: TypographicStyle,
        public body: TypographicStyle,
        public bodySmall: TypographicStyle,
        public caption: TypographicStyle,
        public label: TypographicStyle,
    ) {}

    cssVariables(): CssVariable[] {
        return [
            ...this.overview.cssVariables("overview"),
            ...this.h1.cssVariables("h1"),
            ...this.h2.cssVariables("h2"),
            ...this.title.cssVariables("title"),
            ...this.subtitle.cssVariables("subtitle"),
            ...this.body.cssVariables("body"),
            ...this.bodySmall.cssVariables("bodySmall"),
            ...this.caption.cssVariables("caption"),
            ...this.label.cssVariables("label"),
        ];
    }
}
