import { i18nKey, type MessageFormatter, type ResourceKey } from "@shared";

/** The message to show when `pinChat` (pin true) or `unpinChat` (pin false) fails. */
export function pinChatFailureMessage(pin: boolean): ResourceKey {
    return i18nKey(pin ? "pinChat.failed" : "pinChat.unpinFailed");
}

/**
 * The message to show when `toggleMuteNotifications` fails. Muting @everyone says "muted" too:
 * only one of `mute` and `muteAtEveryone` is set.
 */
export function muteNotificationsFailureMessage(
    mute: boolean | undefined,
    muteAtEveryone: boolean | undefined,
    formatter: MessageFormatter,
): ResourceKey {
    const operation = (mute ?? muteAtEveryone) ? "muted" : "unmuted";
    return i18nKey("toggleMuteNotificationsFailed", { operation: formatter(operation) });
}
