import { Avatars } from "./avatars";
import type { Colours } from "./colour";
import { Shadows } from "./shadow";
import { BorderRadius, BorderWidth, IconSize, Pixel, Rem, Spacings } from "./sizes";
import { FontWeights, TypographicStyle, TypographicStyles } from "./typography";

export class Theme {
    public spacings: Spacings;
    public borderRadius: BorderRadius;
    public borderWidth: BorderWidth;
    public iconSize: IconSize;
    public typography: TypographicStyles;
    public fontWeights: FontWeights;
    public shadows: Shadows;
    public avatars: Avatars;

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

        this.typography = new TypographicStyles(
            new TypographicStyle(Rem.fromPixels(40), Rem.fromPixels(48)),
            new TypographicStyle(Rem.fromPixels(32), Rem.fromPixels(40)),
            new TypographicStyle(Rem.fromPixels(24), Rem.fromPixels(32)),
            new TypographicStyle(Rem.fromPixels(16), Rem.fromPixels(26)),
            new TypographicStyle(Rem.fromPixels(14), Rem.fromPixels(22)),
            new TypographicStyle(Rem.fromPixels(12), Rem.fromPixels(20)),
            new TypographicStyle(Rem.fromPixels(10), Rem.fromPixels(16)),
            new TypographicStyle(Rem.fromPixels(14), Rem.fromPixels(20)),
        );

        this.fontWeights = new FontWeights();

        this.shadows = new Shadows();

        this.avatars = new Avatars(new Pixel(32), new Pixel(40), new Pixel(48));
    }

    writeCssVariables() {
        const vars = [
            ...this.colours.cssVariables(),
            ...this.spacings.cssVariables(),
            ...this.borderRadius.cssVariables(),
            ...this.borderWidth.cssVariables(),
            ...this.iconSize.cssVariables(),
            ...this.typography.cssVariables(),
            ...this.fontWeights.cssVariables(),
            ...this.shadows.cssVariables(),
            ...this.avatars.cssVariables(),
        ];
        vars.forEach((cssVar) => {
            cssVar.write();
        });
    }
}
