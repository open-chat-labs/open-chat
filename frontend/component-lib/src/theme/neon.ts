import { Colour, Colours, Gradient } from "./colour";
import { Theme } from "./type";

export const theme = new Theme(
    new Colours(
        Colour.fromHex("#e41e79"),
        Colour.fromHex("#23A2EE"),
        Colour.fromHex("#4dc164"),
        Colour.fromHex("#f36d28"),
        Colour.fromHex("#ea2929"),
        Colour.fromHex("#242834"),
        Colour.fromHex("#2f333e"),
        Colour.fromHex("#3a3e48"),
        Colour.fromHex("#7c7e85"),
        Colour.fromHex("#4a2642"),
        Colour.fromHex("#ffffff"),
        Colour.fromHex("#9c9ea4"),
        Colour.fromHex("#50535d"),
        Colour.fromHex("#a7a9ae"),
        Colour.fromHex("#242834"),
        new Gradient(Colour.fromHex("#8d2380"), Colour.fromHex("#e81e79")),
        new Gradient(Colour.fromHex("#e81e79"), Colour.fromHex("#8d2380")),
    ),
);
