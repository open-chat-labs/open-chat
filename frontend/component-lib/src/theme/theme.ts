import type { Colours } from "./colour";
import { Spacings, Unit } from "./spacing";

export class Theme {
    public spacings: Spacings;

    constructor(public colours: Colours) {
        this.spacings = new Spacings(
            Unit.fromPixels(2),
            Unit.fromPixels(4),
            Unit.fromPixels(8),
            Unit.fromPixels(12),
            Unit.fromPixels(16),
            Unit.fromPixels(24),
            Unit.fromPixels(32),
            Unit.fromPixels(48),
            Unit.fromPixels(64),
        );
    }

    writeCssVariables() {
        const vars = [...this.colours.cssVariables(), ...this.spacings.cssVariables()];
        vars.forEach((cssVar) => {
            cssVar.write();
        });
    }
}
