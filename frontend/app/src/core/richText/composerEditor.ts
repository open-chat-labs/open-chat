import { mentionCandidateKey, type User, type UserLookup, type UserOrUserGroup } from "@client";
import type { ComposerMention } from "@openchat/ui/src/lib/types";
import { isPrincipalValid, userIdMentionRegex } from "@shared";

// What the new trees' composers need around the rich-text editor in MessageComposer's text box
// (its `editor` seam): who a mention picked from the composer's list is, and who a message mentions

/**
 * The user, group or everyone a mention picked from the composer's list stands for, among those
 * the list was made from (`candidates`, as `composerMention` made the mention from each).
 */
export function pickedMention(
    candidates: readonly UserOrUserGroup[],
    mention: Pick<ComposerMention, "key">,
): UserOrUserGroup | undefined {
    return candidates.find((c) => mentionCandidateKey(c) === mention.key);
}

/**
 * The users a message's markdown mentions by id (`@UserId(…)`, as the editor writes a mention
 * picked from the list), each once: the "picked" mentions the client sends with the message, as
 * the old trees' `getMentionedUsers` collects them from the editor. Hydrated from `users`; one it
 * doesn't hold goes as "unknown", as the old editor's do.
 */
export function mentionedUsers(markdown: string, users: UserLookup): User[] {
    const mentioned = new Map<string, User>();
    for (const [, userId] of markdown.matchAll(new RegExp(userIdMentionRegex.source, "g"))) {
        if (mentioned.has(userId) || !isPrincipalValid(userId)) continue;
        const user = users.get(userId);
        mentioned.set(userId, {
            userId,
            username: user?.username ?? "unknown",
            displayName: user?.displayName,
        });
    }
    return [...mentioned.values()];
}
