import { CssVariable } from "./variable";

export class Spacings {
    constructor(
        public xxs: Unit,
        public xs: Unit,
        public sm: Unit,
        public md: Unit,
        public lg: Unit,
        public xl: Unit,
        public xxl: Unit,
        public xxxl: Unit,
        public huge: Unit,
    ) {}

    cssVariables(): CssVariable[] {
        return [
            this.xxs.cssVariable("xxs"),
            this.xs.cssVariable("xs"),
            this.sm.cssVariable("sm"),
            this.md.cssVariable("md"),
            this.lg.cssVariable("lg"),
            this.xl.cssVariable("xl"),
            this.xxl.cssVariable("xxl"),
            this.xxxl.cssVariable("xxxl"),
            this.huge.cssVariable("huge"),
        ];
    }
}

export class Unit {
    protected val: number;

    constructor(val: number) {
        this.val = val;
    }

    static fromPixels(px: number) {
        return new Unit(px / 16);
    }

    static fromRem(rem: number) {
        return new Unit(rem);
    }

    toString(): string {
        return `${this.val}rem`;
    }

    cssVariable(name: string): CssVariable {
        return new CssVariable(`sp-${name}`, this.toString());
    }
}
