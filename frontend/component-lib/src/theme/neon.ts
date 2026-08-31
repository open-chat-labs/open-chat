import { colourHexMapToColours, neonDark } from "./presets";
import { Theme } from "./theme";

export const theme = new Theme(colourHexMapToColours(neonDark));
