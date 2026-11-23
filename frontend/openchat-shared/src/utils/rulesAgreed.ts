import type { AgreedRules, RulesAgreedChange, RulesAgreedOnJoining } from "../domain/access";

// The rules the user agreed to as they joined a group, channel or community (the new UIs' "Agree
// and join"), kept in the user's cache on the device until their first message there accepts them.
// The agent applies each change to what's cached in one transaction (`applyRulesAgreedChange`), so
// two tabs don't write over each other's agreements.

/** How long an agreement waits for its first message before it's dropped (30 days). */
export const RULES_AGREED_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function noRulesAgreed(): RulesAgreedOnJoining {
    return { chats: new Map(), communities: new Map() };
}

/**
 * The cached agreements with `change` made at `now`, less those older than
 * `RULES_AGREED_MAX_AGE_MS`. The same value if nothing changed, so the caller knows not to write.
 */
export function applyRulesAgreedChange(
    agreed: RulesAgreedOnJoining,
    change: RulesAgreedChange,
    now: number,
): RulesAgreedOnJoining {
    let next = agreed;
    switch (change.kind) {
        case "read":
            break;
        case "agreed":
            next = withRulesAgreed(next, change.chat, change.community, now);
            break;
        case "forget":
            next = withoutRulesAgreed(next, change.chatKey, change.communityId);
            break;
        case "forget_community":
            next = withoutCommunityRulesAgreed(next, change.communityId);
            break;
    }
    return unexpiredRulesAgreed(next, now);
}

/**
 * With the rules agreed to as a chat (`key`, `chatIdentifierToString`) and its community (`id`)
 * were joined, at `now`.
 */
export function withRulesAgreed(
    agreed: RulesAgreedOnJoining,
    chat: { key: string; text: string } | undefined,
    community: { id: string; text: string } | undefined,
    now: number,
): RulesAgreedOnJoining {
    if (chat === undefined && community === undefined) return agreed;
    const chats = new Map(agreed.chats);
    const communities = new Map(agreed.communities);
    if (chat !== undefined) chats.set(chat.key, { text: chat.text, agreedAt: now });
    if (community !== undefined) {
        communities.set(community.id, { text: community.text, agreedAt: now });
    }
    return { chats, communities };
}

/**
 * Without what was agreed to for the chat and its community (a message accepted it, or the user
 * left the chat). The same value if there was nothing to forget.
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
