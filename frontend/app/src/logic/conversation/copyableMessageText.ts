import {
    getContentAsFormattedText,
    type CryptocurrencyDetails,
    type MessageContent,
    type MessageFormatter,
    type ReadonlyMap,
} from "@client";
import { quoteText } from "./messageRow";
import { typedMentions, type MentionLookups } from "./typedMentions";

/** What a message's text is made with: its content as text, and the names its mentions take. */
export type CopyableTextLookups = MentionLookups & {
    formatter: MessageFormatter;
    /** The tokens a transfer's text names (cryptoLookup). */
    cryptoLookup: ReadonlyMap<string, CryptocurrencyDetails>;
};

/**
 * A message's text as it's copied (its menu's Copy, in every tree): the text a quote of it shows
 * (`quoteText`, one implementation for both), with each mention as the `@username` / `@groupname`
 * it was typed as rather than the stored `@UserId(…)` / `@UserGroup(…)`. A mention whose user or
 * group isn't loaded stays as it's stored. It takes the lookups themselves, not a
 * ConversationContext, so the old trees, which don't build one, copy the same text.
 */
export function copyableMessageText(
    content: MessageContent,
    { formatter, cryptoLookup, users, userGroups }: CopyableTextLookups,
): string {
    return quoteText(content, {
        contentText: (c) => getContentAsFormattedText(formatter, c, cryptoLookup),
        mentionsAsTyped: typedMentions({ users, userGroups }),
    });
}
