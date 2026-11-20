import type { AcceptedRules, RulesToAccept, VersionedRules } from "@shared";

// Agreeing to the rules of a group, channel or community as it's joined (the new UIs' "Agree and
// join"). The backend has no way to accept rules with a join, only with a message, so the client
// keeps what the user agreed to (the text they read) and their first message carries it: the
// version of those rules, sent as the pre-send prompt's acceptance is. Rules that changed in
// between are asked about before that message as ever.

/**
 * The rules to agree to before joining, from the text of each set that's enabled and not yet
 * accepted (`undefined` for one that isn't, or couldn't be read). None if there are none.
 */
export function rulesToAccept(
    chat: string | undefined,
    community: string | undefined,
): RulesToAccept | undefined {
    if (chat !== undefined) return { chat, community };
    if (community !== undefined) return { chat: undefined, community };
    return undefined;
}

/** One set of rules as a send finds them, and the text the user agreed to as they joined. */
export type RulesAtSend = {
    rules: VersionedRules | undefined;
    accepted: boolean;
    agreedOnJoining: string | undefined;
};

/**
 * What a send accepts because the user agreed to the rules as they joined: the version of each
 * set that's enabled, as the pre-send prompt's acceptance has, if every set still to be accepted
 * is one the user agreed to as they joined and its text is still what they read. Otherwise none,
 * and the user is asked before the send, as ever.
 */
export function rulesAgreedOnJoining(
    chat: RulesAtSend,
    community: RulesAtSend,
): AcceptedRules | undefined {
    const toAccept = [chat, community].filter((r) => (r.rules?.enabled ?? false) && !r.accepted);
    if (toAccept.length === 0) return undefined;
    if (
        toAccept.some((r) => r.agreedOnJoining === undefined || r.agreedOnJoining !== r.rules?.text)
    ) {
        return undefined;
    }
    return {
        chat: chat.rules?.enabled ? chat.rules.version : undefined,
        community: community.rules?.enabled ? community.rules.version : undefined,
    };
}
