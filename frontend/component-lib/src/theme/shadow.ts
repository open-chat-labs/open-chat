import { CssVariable } from "./variable";

export class Shadows {
    cssVariables(): CssVariable[] {
        return [
            new CssVariable("shadow-menu", "0 4px 6px rgba(0,0,0,0.3)"),
            new CssVariable("shadow-modal", "0 4px 6px rgba(0,0,0,0.3)"),
        ];
    }
}
