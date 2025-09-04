import type { Pixel } from "./sizes";
import { CssVariable } from "./variable";

export class Avatars {
    constructor(
        public sm: Pixel,
        public md: Pixel,
        public lg: Pixel,
    ) {}
    cssVariables(): CssVariable[] {
        return [
            this.sm.cssVariable("avatar", "sm"),
            this.md.cssVariable("avatar", "md"),
            this.lg.cssVariable("avatar", "lg"),
        ];
    }
}
