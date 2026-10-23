import {
    applyTranslation,
    BRIDGE_PLATFORM_NAMES,
    bridgedAuthorName,
    bridgedFrom,
    bridgedUserKey,
    formatDuration,
    latestMessageExpired,
    linkedAuthor,
    messageFlagsRestricted,
    ROLE_NONE,
    type BridgedUserSummary,
    type ChatSummary,
    type MessageContent,
    type MessageFormatter,
    type UserLookup,
} from "@client";

export type PreviewText = {
    /** The app's translator ($_). */
    formatter: MessageFormatter;
    /** The signed-in user's id: their own messages are "You". */
    me: string;
    /** A sender's name as the row shows it (buildDisplayName, unbolded). */
    displayName: (userId: string, kind: "user" | "me" | "webhook") => string;
    /** Messages the reader has had translated (translationsStore). */
    translations: { get(messageId: bigint): string | undefined };
    /** A message's content as text (client.getContentAsText with the formatter). */
    contentText: (content: MessageContent) => string;
    /** The profiles of the accounts bridge bots relay messages from (bridgedUsersStore). */
    bridgedUsers: ReadonlyMap<string, BridgedUserSummary>;
    /** The users the app knows (allUsersStore), to find who has linked an account. */
    users: UserLookup;
};

/**
 * A chat's latest message as its row shows it, the same in every tree: in a group or channel,
 * after its sender (you, a webhook, or the user, or for a message a bridge bot relayed, the
 * OpenChat user who linked the account, else the account and its platform, eg. "Nelly (Telegram)");
 * a change to disappearing messages as a notice;
 * restricted content as such; a translation if the reader has one; nothing for an external
 * channel, or for a message that has disappeared.
 */
export function latestMessagePreview(
    chat: ChatSummary,
    { formatter, me, displayName, translations, contentText, bridgedUsers, users }: PreviewText,
    now = Date.now(),
): string {
    const external = chat.kind === "channel" && chat.externalUrl !== undefined;
    if (chat.latestMessageIndex === undefined || external) return "";

    if (
        (chat.latestMessage !== undefined &&
            chat.eventsTtlLastUpdated > chat.latestMessage.timestamp) ||
        (chat.latestMessage === undefined &&
            chat.eventsTTL !== undefined &&
            chat.membership.role !== ROLE_NONE)
    ) {
        return chat.eventsTTL !== undefined
            ? formatter("disappearingMessages.timeUpdated", {
                  values: { duration: formatDuration(Number(chat.eventsTTL)) },
              })
            : formatter("disappearingMessages.disabled");
    }

    if (chat.latestMessage === undefined || latestMessageExpired(chat, now)) return "";

    const { messageId, content, moderationFlags, sender, senderContext } = chat.latestMessage.event;
    const translation = translations.get(messageId);
    const text = contentText(
        messageFlagsRestricted(moderationFlags)
            ? { kind: "restricted_content" }
            : translation !== undefined
              ? applyTranslation(content, translation)
              : content,
    );

    if (chat.kind === "direct_chat") return text;

    const from = bridgedFrom(senderContext);
    if (from !== undefined) {
        const summary = bridgedUsers.get(bridgedUserKey(from)!);
        const linked = linkedAuthor(summary, users);
        if (linked !== undefined) {
            return `${displayName(linked.userId, linked.userId === me ? "me" : "user")}: ${text}`;
        }
        const platform = BRIDGE_PLATFORM_NAMES[from.kind];
        const name = bridgedAuthorName(summary);
        const author =
            name !== undefined
                ? formatter("bridgedUserWithPlatform", { values: { name, platform } })
                : formatter("bridgedUserUnknown", { values: { platform } });
        return `${author}: ${text}`;
    }

    const userType = senderContext?.kind === "webhook" ? "webhook" : sender === me ? "me" : "user";
    return `${displayName(sender, userType)}: ${text}`;
}
