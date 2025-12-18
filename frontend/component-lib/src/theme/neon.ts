import { Colour, Colours } from "./colour";
import { Theme } from "./theme";

const primary = Colour.fromHex("#FF5672");
const secondary = Colour.fromHex("#23A2EE");
const tertiary = Colour.fromHex("#e41e79");
const myChatBubble = Colour.fromHex("#DC3954");

const primaryMuted = Colour.fromHex("#AA2E43");
const secondaryMuted = Colour.fromHex("#004e7d");
const tertiaryMuted = Colour.fromHex("#4c1f42");

const primaryLight = Colour.fromHex("#feb3bf");
const secondaryLight = Colour.fromHex("#b2e2ff");
const tertiaryLight = Colour.fromHex("#f4a5c9");

const success = Colour.fromHex("#4dc164");
const warn = Colour.fromHex("#f36d28");
const error = Colour.fromHex("#ea2929");

const background0 = Colour.fromHex("#13151B");
// const background1 = Colour.fromHex("#272934");
const background1 = Colour.fromHex("#1C1D26");
const background2 = Colour.fromHex("#282B34");
const disabledButton = Colour.fromHex("#7c7e85");
const myChatBubble = Colour.fromHex("#dc3954");

const textPrimary = Colour.fromHex("#ffffff");
const textSecondary = Colour.fromHex("#9c9ea4");
const textTertiary = Colour.fromHex("#50535d");
const textPlaceholder = Colour.fromHex("#a7a9ae");
const textOnPrimary = Colour.fromHex("#242834");
const textAccent = primary;

const gradientPrimary = tertiary;
const gradientSecondary = primary;

export const theme = new Theme(
    new Colours(
        primary,
        secondary,
        tertiary,
        success,
        warn,
        error,
        primaryMuted,
        secondaryMuted,
        tertiaryMuted,
        primaryLight,
        secondaryLight,
        tertiaryLight,
        background0,
        background1,
        background2,
        disabledButton,
        myChatBubble,
        textPrimary,
        textSecondary,
        textTertiary,
        textPlaceholder,
        textOnPrimary,
        textAccent,
        gradientPrimary,
        gradientSecondary,
        myChatBubble,
    ),
);
