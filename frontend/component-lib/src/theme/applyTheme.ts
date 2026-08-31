import { builtinThemes, colourHexMapToColours } from "./presets";
import { Theme } from "./theme";

export function applyTheme(themeId: string): void {
    const colours = builtinThemes[themeId]?.colours ?? builtinThemes["neon"].colours;
    const theme = new Theme(colourHexMapToColours(colours));
    theme.writeCssVariables();
}
