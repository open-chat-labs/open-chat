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

        this.borderWidth = new BorderWidth(new Pixel(0), new Pixel(1), new Pixel(2), new Pixel(4));

        this.iconSize = new IconSize(
            Rem.fromPixels(12),
            Rem.fromPixels(16),
            Rem.fromPixels(24),
            Rem.fromPixels(32),
        );

        this.typography = new TypographicStyles(
            new TypographicStyle(Rem.fromPixels(40), Rem.fromPixels(48)), // overview
            new TypographicStyle(Rem.fromPixels(32), Rem.fromPixels(40)), // h1
            new TypographicStyle(Rem.fromPixels(24), Rem.fromPixels(32)), // h2
            new TypographicStyle(Rem.fromPixels(20), Rem.fromPixels(28)), // h3
            new TypographicStyle(Rem.fromPixels(18), Rem.fromPixels(24)), // title
            new TypographicStyle(Rem.fromPixels(16), Rem.fromPixels(26)), // subtitle
            new TypographicStyle(Rem.fromPixels(14), Rem.fromPixels(22)), // body
            new TypographicStyle(Rem.fromPixels(12), Rem.fromPixels(20)), // bodySmall
            new TypographicStyle(Rem.fromPixels(10), Rem.fromPixels(16)), // caption
            new TypographicStyle(Rem.fromPixels(14), Rem.fromPixels(20)), // label
            new TypographicStyle(Rem.fromPixels(12), Rem.fromPixels(12)), // chatLabel
            new TypographicStyle(Rem.fromPixels(14), Rem.fromPixels(20)), // chatText
            new TypographicStyle(Rem.fromPixels(10), Rem.fromPixels(12)), // chatFootnote
            new TypographicStyle(Rem.fromPixels(12), Rem.fromPixels(16)), // chatCaption
            new TypographicStyle(Rem.fromPixels(12), Rem.fromPixels(12)), // buttonSmall
        );

        this.fontWeights = new FontWeights();

        this.shadows = new Shadows();

        this.avatars = new Avatars(
            Rem.fromPixels(20),
            Rem.fromPixels(32),
            Rem.fromPixels(40),
            Rem.fromPixels(48),
            Rem.fromPixels(56),
            Rem.fromPixels(80),
            Rem.fromPixels(128),
        );
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
