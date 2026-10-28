import type { BotMessagePermission, MessagePermission } from "@shared";

/**
 * The message permission of the user's own which a bot's permission needs, for a command the user
 * runs. A member who can post text can have a bot post a MiniApp message for them, as the backend
 * maps it. Members have no message permission for video calls.
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
