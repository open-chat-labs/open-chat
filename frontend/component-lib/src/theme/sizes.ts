import { CssVariable } from "./variable";

export class IconSize {
    constructor(
        public xs: Rem,
        public sm: Rem,
        public md: Rem,
        public lg: Rem,
    ) {}

    cssVariables(): CssVariable[] {
        return [
            this.xs.cssVariable("icon", "xs"),
            this.sm.cssVariable("icon", "sm"),
            this.md.cssVariable("icon", "md"),
            this.lg.cssVariable("icon", "lg"),
        ];
    }
}

export class BorderWidth {
    constructor(
        public zero: Pixel,
        public thin: Pixel,
        public thick: Pixel,
    ) {}

    cssVariables(): CssVariable[] {
        return [
            this.zero.cssVariable("bw", "zero"),
            this.thin.cssVariable("bw", "thin"),
            this.thick.cssVariable("bw", "thick"),
        ];
    }
}

export type BorderWidthSize = Exclude<keyof BorderWidth, keyof object | "cssVariables">;

export function getBorderWidthCss(bw: BorderWidthSize): string {
    return bw === "zero" ? "" : `border-width: var(--bw-${bw})`;
}

export function getBorderStyleCss(
    bw: BorderWidthSize,
    borderStyle: string,
    borderColour: string,
): string {
    return bw === "zero" ? "" : `border-style: ${borderStyle}; border-color: ${borderColour}`;
}

export function getPaddingCss(padding: Padding): string {
    return `padding: ${padding.map((p) => `var(--sp-${p})`).join(" ")}`;
}

export function getGapCss(sz: SpacingSize): string {
    return sz === "zero" ? "" : `gap: var(--sp-${sz})`;
}

export class BorderRadius {
    constructor(
        public zero: Rem,
        public xs: Rem,
        public sm: Rem,
        public md: Rem,
        public lg: Rem,
        public xl: Rem,
        public xxl: Rem,
        public circle: Rem,
    ) {}

    cssVariables(): CssVariable[] {
        return [
            this.zero.cssVariable("rad", "zero"),
            this.xs.cssVariable("rad", "xxs"),
            this.sm.cssVariable("rad", "sm"),
            this.md.cssVariable("rad", "md"),
            this.lg.cssVariable("rad", "lg"),
            this.xl.cssVariable("rad", "xl"),
            this.xxl.cssVariable("rad", "xxl"),
            this.circle.cssVariable("rad", "circle"),
        ];
    }
}

export function getBorderRadiusCss(rad: BorderRadiusSize): string {
    return rad === "zero" ? "" : `border-radius: var(--rad-${rad})`;
}

export type BorderRadiusSize = Exclude<keyof BorderRadius, keyof object | "cssVariables">;

export class Spacings {
    constructor(
        public zero: Rem,
        public xxs: Rem,
        public xs: Rem,
        public sm: Rem,
        public md: Rem,
        public lg: Rem,
        public xl: Rem,
        public xxl: Rem,
        public xxxl: Rem,
        public huge: Rem,
    ) {}

    cssVariables(): CssVariable[] {
        return [
            this.zero.cssVariable("sp", "zero"),
            this.xxs.cssVariable("sp", "xxs"),
            this.xs.cssVariable("sp", "xs"),
            this.sm.cssVariable("sp", "sm"),
            this.md.cssVariable("sp", "md"),
            this.lg.cssVariable("sp", "lg"),
            this.xl.cssVariable("sp", "xl"),
            this.xxl.cssVariable("sp", "xxl"),
            this.xxxl.cssVariable("sp", "xxxl"),
            this.huge.cssVariable("sp", "huge"),
        ];
    }
}

export type SizeMode = { kind: "hug" } | { kind: "fill" } | { kind: "fixed"; size: string };

export type MainAxisAlignment = "start" | "center" | "end" | "spaceBetween" | "spaceAround";

export type CrossAxisAlignment = "start" | "center" | "end" | "stretch";

export type Direction = "horizontal" | "vertical" | "unknown";

const mainAxisToCss = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    spaceBetween: "space-between",
    spaceAround: "space-around",
};

const crossAxisToCss = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    stretch: "stretch",
};

export function getAlignmentCss(
    mainAxisAlignment: MainAxisAlignment,
    crossAxisAlignment: CrossAxisAlignment,
) {
    return `justify-content: ${mainAxisToCss[mainAxisAlignment]}; align-items: ${crossAxisToCss[crossAxisAlignment]}`;
}

export function getFlexStyle(
    axis: "width" | "height",
    mode: SizeMode,
    parentDirection: Direction,
): string {
    const isMainAxis =
        (axis === "width" && parentDirection === "horizontal") ||
        (axis === "height" && parentDirection === "vertical");

    if (isMainAxis) {
        if (mode.kind === "fixed") return `flex: 0 0 ${mode.size ?? "auto"}`;
        if (mode.kind === "hug") return `flex: 0 0 auto`;
        // if (mode.kind === "fill") return `flex: 1 1 auto`;
        if (mode.kind === "fill") return `flex: 1 1 0`;
    }

    if (!isMainAxis) {
        if (mode.kind === "fixed") return `${axis}: ${mode.size ?? "auto"}`;
        if (mode.kind === "hug") return `${axis}: fit-content`;
        if (mode.kind === "fill") return `align-self: stretch`;
    }

    // Fallback for unknown or non-flex parent
    if (parentDirection === "unknown") {
        if (mode.kind === "fixed") return `${axis}: ${mode.size ?? "auto"}`;
        if (mode.kind === "hug") return `${axis}: fit-content`;
        if (mode.kind === "fill") return `${axis}: 100%`;
    }

    return "";
}

export type SpacingSize = "zero" | Exclude<keyof Spacings, keyof object | "cssVariables">;

export type Padding =
    | [SpacingSize]
    | [SpacingSize, SpacingSize]
    | [SpacingSize, SpacingSize, SpacingSize]
    | [SpacingSize, SpacingSize, SpacingSize, SpacingSize];

abstract class Unit {
    protected val: number;

    constructor(val: number) {
        this.val = val;
    }

    abstract toString(): string;

    cssVariable(prefix: string, name: string): CssVariable {
        return new CssVariable(`${prefix}-${name}`, this.toString());
    }
}

export class Pixel extends Unit {
    static fromRem(rem: number) {
        return new Pixel(rem * 16);
    }

    toString(): string {
        return `${this.val}px`;
    }
}

export class Rem extends Unit {
    static fromPixels(px: number) {
        return new Rem(px / 16);
    }

    toString(): string {
        return `${this.val}rem`;
    }
}
