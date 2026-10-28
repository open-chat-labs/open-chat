import {
    i18nKey,
    type BotActionResponse,
    type BotActionSuccess,
    type BotMessagePermission,
    type MessagePermission,
    type ResourceKey,
} from "@shared";

export type PressMiniAppButtonOutcome =
    | { kind: "success" }
    | { kind: "failed"; reason: ResourceKey };

/**
 * What to tell someone whose press of a MiniApp message's button didn't reach the bot, or which the
 * bot refused. What the bot said is logged, not shown: it's the bot's text, untranslated.
 */
export function miniAppButtonFailureMessage(
    response: Exclude<BotActionResponse, BotActionSuccess>,
): ResourceKey {
    switch (response.kind) {
        case "not_authorized":
            return i18nKey("bots.miniApp.notAuthorized");
        case "too_many_requests":
            return i18nKey("bots.miniApp.tooManyRequests");
        case "bad_request":
        case "internal_error":
            return i18nKey("bots.miniApp.failed");
    }
}

/**
 * The message permission of the user's own which a bot's permission needs, for a command the user
 * runs. A member who can post text can have a bot post a MiniApp message for them, as the backend
 * maps it.
 */
export function userMessagePermissionFor(
    permission: BotMessagePermission,
): MessagePermission | undefined {
    switch (permission) {
        case "miniApp":
            return "text";
        case "videoCall":
            return undefined;
        default:
            return permission;
    }
}
