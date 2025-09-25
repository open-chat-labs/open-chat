import type { Pixel } from "./sizes";
import { CssVariable } from "./variable";

export class Avatars {
    constructor(
        public xs: Pixel,
        public sm: Pixel,
        public md: Pixel,
        public lg: Pixel,
        public xl: Pixel,
        public huge: Pixel,
    ) {}
    cssVariables(): CssVariable[] {
        return [
            this.xs.cssVariable("avatar", "xs"),
            this.sm.cssVariable("avatar", "sm"),
            this.md.cssVariable("avatar", "md"),
            this.lg.cssVariable("avatar", "lg"),
            this.xl.cssVariable("avatar", "xl"),
            this.huge.cssVariable("avatar", "huge"),
        ];
    }
}
