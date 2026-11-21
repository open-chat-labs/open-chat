import type {
    AcceptedRules,
    AgreedRules,
    RulesAgreedOnJoining,
    RulesToAccept,
    VersionedRules,
} from "@shared";

// Agreeing to the rules of a group, channel or community as it's joined (the new UIs' "Agree and
// join"). The backend has no way to accept rules with a join, only with a message, so the client
// keeps what the user agreed to (the text they read), in the user's cache on the device, and their
// first message carries it: the version of those rules, sent as the pre-send prompt's acceptance
// is. Rules that changed in between are asked about before that message as ever.

/** How long an agreement waits for its first message before it's dropped (30 days). */
export const RULES_AGREED_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function noRulesAgreed(): RulesAgreedOnJoining {
    return { chats: new Map(), communities: new Map() };
}

/**
 * With the rules agreed to as a chat (`chatKey`, `chatIdentifierToString`) and its community
 * (`communityId`) were joined, at `now`; each only where there's text.
 */
export function withRulesAgreed(
    agreed: RulesAgreedOnJoining,
    chat: { key: string; text: string | undefined } | undefined,
    community: { id: string; text: string | undefined } | undefined,
    now: number,
): RulesAgreedOnJoining {
    const chats = new Map(agreed.chats);
    const communities = new Map(agreed.communities);
    if (chat?.text !== undefined) chats.set(chat.key, { text: chat.text, agreedAt: now });
    if (community?.text !== undefined) {
        communities.set(community.id, { text: community.text, agreedAt: now });
    }
    return { chats, communities };
}

/**
 * Without what was agreed to for the chat and the community (a message accepted it, or the user
 * left). The same value if there was nothing to forget, so the caller knows not to write it.
 */
export function withoutRulesAgreed(
    agreed: RulesAgreedOnJoining,
    chatKey: string | undefined,
    communityId: string | undefined,
): RulesAgreedOnJoining {
    const hasChat = chatKey !== undefined && agreed.chats.has(chatKey);
    const hasCommunity = communityId !== undefined && agreed.communities.has(communityId);
    if (!hasChat && !hasCommunity) return agreed;
    const chats = new Map(agreed.chats);
    const communities = new Map(agreed.communities);
    if (chatKey !== undefined) chats.delete(chatKey);
    if (communityId !== undefined) communities.delete(communityId);
    return { chats, communities };
}

/**
 * Without what was agreed to for a community and every channel of it (`chatIdentifierToString`
 * keys a channel `<communityId>_<channelId>`): the user left it. The same value if there was
 * nothing to forget.
 */
export function withoutCommunityRulesAgreed(
    agreed: RulesAgreedOnJoining,
    communityId: string,
): RulesAgreedOnJoining {
    const prefix = `${communityId}_`;
    const chats = [...agreed.chats].filter(([key]) => !key.startsWith(prefix));
    if (chats.length === agreed.chats.size && !agreed.communities.has(communityId)) return agreed;
    const communities = new Map(agreed.communities);
    communities.delete(communityId);
    return { chats: new Map(chats), communities };
}

/**
 * What's still waiting for a first message at `now`: an agreement older than
 * `RULES_AGREED_MAX_AGE_MS` is dropped (its first message is asked to accept the rules, as ever).
 * The same value if none was.
 */
export function unexpiredRulesAgreed(
    agreed: RulesAgreedOnJoining,
    now: number,
): RulesAgreedOnJoining {
    const fresh = ([, rules]: [string, AgreedRules]) =>
        now - rules.agreedAt < RULES_AGREED_MAX_AGE_MS;
    const chats = [...agreed.chats].filter(fresh);
    const communities = [...agreed.communities].filter(fresh);
    if (chats.length === agreed.chats.size && communities.length === agreed.communities.size) {
        return agreed;
    }
    return { chats: new Map(chats), communities: new Map(communities) };
}

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
