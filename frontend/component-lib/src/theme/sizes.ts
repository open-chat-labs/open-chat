import { CssVariable } from "./variable";

export type Pos = {
    top?: SpacingSize;
    bottom?: SpacingSize;
    left?: SpacingSize;
    right?: SpacingSize;
};

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
        public extraThick: Pixel,
    ) {}

    cssVariables(): CssVariable[] {
        return [
            this.zero.cssVariable("bw", "zero"),
            this.thin.cssVariable("bw", "thin"),
            this.thick.cssVariable("bw", "thick"),
            this.extraThick.cssVariable("bw", "extra-thick"),
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

function isSingularSize<T>(size: StyleSize<T>): size is T {
    return !Array.isArray(size);
}

export function getPaddingCss(padding: Padding, prefix: boolean = true): string {
    if (isSingularSize(padding)) {
        return `${prefix ? "padding: " : ""}var(--sp-${padding})`;
    }
    return `padding: ${padding.map((p) => getPaddingCss(p, false)).join(" ")}`;
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
            this.xs.cssVariable("rad", "xs"),
            this.sm.cssVariable("rad", "sm"),
            this.md.cssVariable("rad", "md"),
            this.lg.cssVariable("rad", "lg"),
            this.xl.cssVariable("rad", "xl"),
            this.xxl.cssVariable("rad", "xxl"),
            this.circle.cssVariable("rad", "circle"),
        ];
    }
}

export function getBorderRadiusCss(radius: Radius, prefix: boolean = true): string {
    if (isSingularSize(radius)) {
        return `${prefix ? "border-radius: " : ""}var(--rad-${radius})`;
    }
    return `border-radius: ${radius.map((r) => getBorderRadiusCss(r, false)).join(" ")}`;
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

export type SizeMode = "hug" | "fill" | { size: string } | { share: number };

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
    mainAxisSelfAlignment?: MainAxisAlignment,
    crossAxisSelfAlignment?: CrossAxisAlignment,
) {
    let css = `justify-content: ${mainAxisToCss[mainAxisAlignment]}; align-items: ${crossAxisToCss[crossAxisAlignment]};`;
    if (mainAxisSelfAlignment !== undefined) {
        css += ` justify-self: ${mainAxisToCss[mainAxisSelfAlignment]};`;
    }
    if (crossAxisSelfAlignment !== undefined) {
        css += ` align-self: ${crossAxisToCss[crossAxisSelfAlignment]};`;
    }
    return css;
}

export function getFlexStyle(
    axis: "width" | "height",
    mode: SizeMode,
    parentDirection: Direction,
): string {
    // Fallback for unknown or non-flex parent
    if (parentDirection === "unknown" || parentDirection === undefined) {
        if (mode === "hug") return `${axis}: fit-content`;
        if (mode === "fill") return `${axis}: 100%`;
        if ("size" in mode) return `${axis}: ${mode.size ?? "auto"}`;
    }

    const isMainAxis =
        (axis === "width" && parentDirection === "horizontal") ||
        (axis === "height" && parentDirection === "vertical");

    if (isMainAxis) {
        if (mode === "hug") return `flex: 0 0 auto`;
        if (mode === "fill") return `flex: 1 1 0`;
        if ("size" in mode) return `flex: 0 0 ${mode.size ?? "auto"}`;
        // if (mode.kind === "fill") return `flex: 1 1 auto`;
        if ("share" in mode) return `flex: ${mode.share}`;
    }

    if (!isMainAxis) {
        if (mode === "hug") return `${axis}: fit-content`;
        if (mode === "fill") return `align-self: stretch`;
        if ("size" in mode) return `${axis}: ${mode.size ?? "auto"}`;
        if ("share" in mode) {
            console.warn(
                "share SizeMode does not make sense for the cross-axis - you are probably making a mistake",
            );
        }
    }

    return "";
}

export type SpacingSize = "zero" | Exclude<keyof Spacings, keyof object | "cssVariables">;

type StyleSize<T> = T | [T, T] | [T, T, T] | [T, T, T, T];

export function sizeToCssVar(sz: SpacingSize): string {
    return `var(--sp-${sz})`;
}

export type Padding = StyleSize<SpacingSize>;

export type Radius = StyleSize<BorderRadiusSize>;

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

export function posToStyle(pos?: Pos) {
    if (pos === undefined) return "";
    const keys: (keyof Pos)[] = ["top", "right", "bottom", "left"];
    return (
        keys
            .reduce(
                (res, key) => {
                    const val = pos[key];
                    if (val !== undefined) {
                        res.push(`${key}: ${sizeToCssVar(val)}`);
                    }
                    return res;
                },
                ["position: absolute"] as string[],
            )
            .join("; ") + ";"
    );
}
