import { writable } from "../utils/stores";

/**
 * The rules the user agreed to as they joined a group, channel or community (the new UIs' "Agree
 * and join"): the text they read, by chat (`chatIdentifierToString`) and by community id. The
 * backend can't take an acceptance with a join, so the first message there carries it
 * (`rulesAgreedOnJoining`), after which the entry goes. Kept for the session only: after a reload
 * the user is asked before that first message, as ever.
 */
export type RulesAgreedOnJoining = {
    chats: ReadonlyMap<string, string>;
    communities: ReadonlyMap<string, string>;
};

export const rulesAgreedOnJoiningStore = writable<RulesAgreedOnJoining>({
    chats: new Map(),
    communities: new Map(),
});

/** Records the rules agreed to as a chat (`chatKey`) or community (`communityId`) was joined. */
export function recordRulesAgreedOnJoining(
    chatKey: string | undefined,
    chatText: string | undefined,
    communityId: string | undefined,
    communityText: string | undefined,
): void {
    rulesAgreedOnJoiningStore.update(({ chats, communities }) => {
        const nextChats = new Map(chats);
        const nextCommunities = new Map(communities);
        if (chatKey !== undefined && chatText !== undefined) nextChats.set(chatKey, chatText);
        if (communityId !== undefined && communityText !== undefined) {
            nextCommunities.set(communityId, communityText);
        }
        return { chats: nextChats, communities: nextCommunities };
    });
}

/** Forgets what was agreed to as the chat and its community were joined, once a send carried it. */
export function forgetRulesAgreedOnJoining(chatKey: string, communityId: string | undefined): void {
    const { chats, communities } = rulesAgreedOnJoiningStore.value;
    if (!chats.has(chatKey) && (communityId === undefined || !communities.has(communityId))) {
        return;
    }
    const nextChats = new Map(chats);
    const nextCommunities = new Map(communities);
    nextChats.delete(chatKey);
    if (communityId !== undefined) nextCommunities.delete(communityId);
    rulesAgreedOnJoiningStore.set({ chats: nextChats, communities: nextCommunities });
}
