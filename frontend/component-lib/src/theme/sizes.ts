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

export type SpacingSize = "zero" | Exclude<keyof Spacings, keyof object | "cssVariables">;

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
