import type { Colours } from "./colour";
import { BorderRadius, BorderWidth, IconSize, Pixel, Rem, Spacings } from "./sizes";

export class Theme {
    public spacings: Spacings;
    public borderRadius: BorderRadius;
    public borderWidth: BorderWidth;
    public iconSize: IconSize;

    constructor(public colours: Colours) {
        // Colours are injected (as they are flexible), all other params are hard-coded for now
        // so that themes are consistent but they _could_ be injected easily instead later.
        this.spacings = new Spacings(
            Rem.fromPixels(0),
            Rem.fromPixels(2),
            Rem.fromPixels(4),
            Rem.fromPixels(8),
            Rem.fromPixels(12),
            Rem.fromPixels(16),
            Rem.fromPixels(24),
            Rem.fromPixels(32),
            Rem.fromPixels(48),
            Rem.fromPixels(64),
        );

        this.borderRadius = new BorderRadius(
            Rem.fromPixels(0),
            Rem.fromPixels(2),
            Rem.fromPixels(4),
            Rem.fromPixels(8),
            Rem.fromPixels(12),
            Rem.fromPixels(16),
            Rem.fromPixels(24),
            Rem.fromPixels(160),
        );

        this.borderWidth = new BorderWidth(new Pixel(0), new Pixel(1), new Pixel(2));

        this.iconSize = new IconSize(
            Rem.fromPixels(12),
            Rem.fromPixels(16),
            Rem.fromPixels(24),
            Rem.fromPixels(32),
        );
    }

    writeCssVariables() {
        const vars = [
            ...this.colours.cssVariables(),
            ...this.spacings.cssVariables(),
            ...this.borderRadius.cssVariables(),
            ...this.borderWidth.cssVariables(),
            ...this.iconSize.cssVariables(),
        ];
        vars.forEach((cssVar) => {
            cssVar.write();
        });
    }
}
