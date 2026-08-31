import { Colour, Colours } from "./colour";
import type {
    FeedbackColourArgs,
    OptionalThemeColourArgs,
    RequiredThemeColourArgs,
    StaticColourArgs,
    ThemeColourHexMap,
    ThemeMode,
} from "./types";

export type BuiltinThemeDefinition = {
    mode: ThemeMode;
    colours: ThemeColourHexMap;
};

// Light and dark backgrounds are const between themes!
const baseDarkTheme: Record<StaticColourArgs, string> = {
    surface0: "#13151B",
    surface1: "#1C1D26",
    surface2: "#282B34",
    surfaceDisabled: "#7c7e85",
    textOnDisabledSurface: "#50535d",
    inputBackground: "#50535d",
    inputPlaceholder: "#a7a9ae",
    backdrop: "rgba(19, 21, 27, 0.75)",
    mainNavBackground: "#1C1D26",
    draftAttachmentSurface: "#000000",
    draftReplySurface: "#282B34",
    chatBubbleReceived: "#282B34",
    chatBubbleReplyReceived: "#13151B",
    chatInputBackground: "#50535d",
    chatInputPlaceholder: "#9c9ea4",
};

const baseLightTheme: Record<StaticColourArgs, string> = {
    surface0: "#ffffff",
    surface1: "#f8f8f8",
    surface2: "#f0f0f0",
    surfaceDisabled: "#c0c0c0",
    textOnDisabledSurface: "#4e5253",
    inputBackground: "#f2f2f2",
    inputPlaceholder: "#949599",
    backdrop: "rgba(29, 39, 54, 0.45)",
    mainNavBackground: "#f8f8f8",
    draftAttachmentSurface: "#000000",
    draftReplySurface: "#eeeeee",
    chatBubbleReceived: "#ffffff",
    chatBubbleReplyReceived: "#f4f4f4",
    chatInputBackground: "#ffffff",
    chatInputPlaceholder: "#4f4f4f",
};

const baseFeedbackColours: Record<FeedbackColourArgs, string> = {
    validationSuccess: "#4dc164",
    validationWarning: "#f36d28",
    validationError: "#ff2448",
    successSurface: "#4dc164",
    warningSurface: "#f36d28",
    errorSurface: "#ff2448",
    textOnFeedbackSurface: "#ffffff",
};

function composeDarkTheme(
    theme: Record<RequiredThemeColourArgs, string>,
    overrides: Partial<Record<FeedbackColourArgs | OptionalThemeColourArgs, string>>,
): ThemeColourHexMap {
    return {
        ...baseDarkTheme, // We're using base DARK theme
        ...baseFeedbackColours,
        ...theme,
        ...overrides,
    };
}

function composeLightTheme(
    theme: Record<RequiredThemeColourArgs, string>,
    overrides: Partial<Record<FeedbackColourArgs | OptionalThemeColourArgs, string>>,
): ThemeColourHexMap {
    return {
        ...baseLightTheme, // We're using base LIGHT theme
        ...baseFeedbackColours,
        ...theme,
        ...overrides,
    };
}

// =============================================================================
// NEON Theme
// =============================================================================
export const neonDark: ThemeColourHexMap = composeDarkTheme(
    // required colours
    {
        primary: "#FF5672",
        primaryAccent: "#feb3bf",
        primarySurface: "#AA2E43",
        secondary: "#23A2EE",
        secondaryAccent: "#b2e2ff",
        secondarySurface: "#004e7d",
        tertiary: "#e41e79",
        tertiaryAccent: "#f4a5c9",
        tertiarySurface: "#4c1f42",
        textPrimary: "#ffffff",
        textSecondary: "#9c9ea4",
        textOnPrimary: "#242834",
        gradientPrimary: "#e41e79",
        gradientSecondary: "#FF5672",
    },
    // optional colours, fine tuning
    {
        chatBubbleSent: "#dc3954",
        chatTextSent: "#ffffff",
        chatBubbleDeleted: "#282B34",
        chatReactionBackground: "#282B34",
    },
);

// A starting point only — the light variant hasn't had a design pass yet.
export const neonLight: ThemeColourHexMap = composeLightTheme(
    // required colours
    {
        primary: "#FF5672",
        primaryAccent: "#dc3954",
        primarySurface: "#ffdbe2",
        secondary: "#23A2EE",
        secondaryAccent: "#0c76b9",
        secondarySurface: "#c9e9ff",
        tertiary: "#e41e79",
        tertiaryAccent: "#c01362",
        tertiarySurface: "#f7cee2",
        textPrimary: "#24192d",
        textSecondary: "#65566d",
        textOnPrimary: "#ffffff",
        gradientPrimary: "#e41e79",
        gradientSecondary: "#FF5672",
    },
    // optional colours, fine tuning
    {
        chatBubbleSent: "#ffc3e0",
        chatTextSent: "#24192d",
    },
);

export const builtinThemes: Record<string, BuiltinThemeDefinition> = {
    neon: { mode: "dark", colours: neonDark },
    "neon-light": { mode: "light", colours: neonLight },
};

export function getBuiltinThemeNames(mode?: ThemeMode): string[] {
    return Object.entries(builtinThemes)
        .filter(([, t]) => mode === undefined || t.mode === mode)
        .map(([id]) => id);
}

function parseColour(value: string): Colour {
    if (value.startsWith("rgba(")) {
        const parts = value
            .slice(5, -1)
            .split(",")
            .map((p) => parseFloat(p.trim()));
        return Colour.fromRGBA(parts[0], parts[1], parts[2], parts[3] ?? 1);
    }
    return Colour.fromHex(value);
}

export function colourHexMapToColours(hexMap: ThemeColourHexMap): Colours {
    const c = (key: StaticColourArgs | FeedbackColourArgs | RequiredThemeColourArgs) =>
        parseColour(hexMap[key]);

    const oc = (key: OptionalThemeColourArgs) =>
        hexMap[key] ? parseColour(hexMap[key]) : undefined;

    return new Colours(
        c("surface0"),
        c("surface1"),
        c("surface2"),
        c("surfaceDisabled"),
        c("textOnDisabledSurface"),
        c("inputBackground"),
        c("inputPlaceholder"),
        c("backdrop"),
        c("mainNavBackground"),
        c("draftAttachmentSurface"),
        c("draftReplySurface"),
        c("chatBubbleReceived"),
        c("chatBubbleReplyReceived"),
        c("chatInputBackground"),
        c("chatInputPlaceholder"),
        // ...
        c("validationSuccess"),
        c("validationWarning"),
        c("validationError"),
        c("successSurface"),
        c("warningSurface"),
        c("errorSurface"),
        c("textOnFeedbackSurface"),
        // ...
        c("primary"),
        c("primaryAccent"),
        c("primarySurface"),
        c("secondary"),
        c("secondaryAccent"),
        c("secondarySurface"),
        c("tertiary"),
        c("tertiaryAccent"),
        c("tertiarySurface"),
        c("textPrimary"),
        c("textSecondary"),
        c("textOnPrimary"),
        c("gradientPrimary"),
        c("gradientSecondary"),
        // ...
        oc("chatBackground"),
        oc("chatHeaderSeparator"),
        oc("chatDecorations"),
        oc("chatBubbleSent"),
        oc("chatTextSent"),
        oc("chatMetadataSent"),
        oc("chatMetadataFill"),
        oc("chatBubbleDeleted"),
        oc("chatBubbleFocusOutline"),
        oc("chatReactionBackground"),
    );
}
