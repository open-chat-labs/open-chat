// These don't change between respective dark or light themes!
export type StaticColourArgs =
    | "surface0"
    | "surface1"
    | "surface2"
    | "surfaceDisabled"
    | "textOnDisabledSurface"
    | "inputBackground"
    | "inputPlaceholder"
    | "backdrop"
    | "mainNavBackground"
    | "draftAttachmentSurface"
    | "draftReplySurface"
    | "chatBubbleReceived" // Colour of other participant's message bubbles bg
    | "chatBubbleReplyReceived" // Colour of the reply bg within a chat bubble
    | "chatInputBackground" // Message entry input background colour
    | "chatInputPlaceholder"; // Message entry input placeholder colour

// These are relevant for feedback and can rely on default values shared between
// different theme, or be a completely new set.
export type FeedbackColourArgs =
    | "validationSuccess"
    | "validationWarning"
    | "validationError"
    | "successSurface"
    | "warningSurface"
    | "errorSurface"
    | "textOnFeedbackSurface";

// These determine a theme, and are mostly accents and tints that provide
// specific feel to that theme.
export type RequiredThemeColourArgs =
    | "primary"
    | "primaryAccent"
    | "primarySurface"
    | "secondary"
    | "secondaryAccent"
    | "secondarySurface"
    | "tertiary"
    | "tertiaryAccent"
    | "tertiarySurface"
    | "textPrimary"
    | "textSecondary"
    | "textOnPrimary"
    | "gradientPrimary"
    | "gradientSecondary";

// For fine tuning, mostly of the chat screen, and are all optional. These
// will by default pick up one of the values from the other colour groups.
export type OptionalThemeColourArgs =
    | "chatBackground" // Chat specific background
    | "chatHeaderSeparator" // Header bottom border
    | "chatDecorations" // Colour of the background doodads
    | "chatBubbleSent" // Colour of my message bubble
    | "chatTextSent" // Colour of text in my message bubbles
    | "chatMetadataSent" // Colour of my message bubble metadata
    | "chatMetadataFill" // Colour of metadata when message contains only media without caption
    | "chatBubbleDeleted" // Colour of deleted message bubble
    | "chatBubbleFocusOutline" // Colour of outline when message bubble is focused
    | "chatReactionBackground"; // Background colour for reactions

// Union of all colour themes
export type ThemeColourArgs =
    | StaticColourArgs
    | FeedbackColourArgs
    | RequiredThemeColourArgs
    | OptionalThemeColourArgs;

// Map of all colours to a string value, with optional args.
export type ThemeColourHexMap = Record<StaticColourArgs, string> &
    Record<FeedbackColourArgs, string> &
    Record<RequiredThemeColourArgs, string> &
    Partial<Record<OptionalThemeColourArgs, string>>;
