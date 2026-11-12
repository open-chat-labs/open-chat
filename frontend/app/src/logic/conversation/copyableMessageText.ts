import {
    getContentAsFormattedText,
    type CryptocurrencyDetails,
    type MessageContent,
    type MessageFormatter,
    type ReadonlyMap,
} from "@client";
import { typedMentions, type MentionLookups } from "./typedMentions";

/** What a message's text is made with: its content as text, and the names its mentions take. */
export type CopyableTextLookups = MentionLookups & {
    formatter: MessageFormatter;
    /** The tokens a transfer's text names (cryptoLookup). */
    cryptoLookup: ReadonlyMap<string, CryptocurrencyDetails>;
};

/**
 * A message's text as it's copied (its menu's Copy, in every tree): the content as text, as the
 * client gives it (`getContentAsText`), with each mention as the `@username` / `@groupname` it was
 * typed as rather than the stored `@UserId(…)` / `@UserGroup(…)`. A mention whose user or group
 * isn't loaded stays as it's stored.
 */
export function copyableMessageText(
    content: MessageContent,
    { formatter, cryptoLookup, users, userGroups }: CopyableTextLookups,
): string {
    return typedMentions({ users, userGroups })(
        getContentAsFormattedText(formatter, content, cryptoLookup),
    );
}
