import { Colour, Colours } from "./colour";
import { Theme } from "./theme";

const primary = Colour.fromHex("#FF5672");
const tertiary = Colour.fromHex("#e41e79");
const gradientPrimary = tertiary;
const gradientSecondary = primary;

export const theme = new Theme(
    new Colours(
        primary,
        Colour.fromHex("#23A2EE"),
        tertiary,
        Colour.fromHex("#4dc164"),
        Colour.fromHex("#f36d28"),
        Colour.fromHex("#ea2929"),
        Colour.fromHex("#242834"),
        Colour.fromHex("#2f333e"),
        Colour.fromHex("#3a3e48"),
        Colour.fromHex("#7c7e85"),
        Colour.fromHex("#4a2642"),
        Colour.fromHex("#f4a5c9"),
        Colour.fromHex("#004e7d"),
        Colour.fromHex("#7e2b00"),
        Colour.fromHex("#ffffff"),
        Colour.fromHex("#9c9ea4"),
        Colour.fromHex("#50535d"),
        Colour.fromHex("#a7a9ae"),
        Colour.fromHex("#242834"),
        Colour.fromHex("#e41e79"),
        gradientPrimary,
        gradientSecondary,
    ),
);
