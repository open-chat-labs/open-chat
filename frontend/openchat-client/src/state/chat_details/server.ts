import {
    emptyRules,
    type ChatIdentifier,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type VersionedRules,
} from "openchat-shared";

export class ChatDetailsServerState {
    constructor(
        readonly chatId: ChatIdentifier | undefined,
        readonly members: Map<string, Member>,
        readonly lapsedMembers: Set<string>,
        readonly blockedUsers: Set<string>,
        readonly invitedUsers: Set<string>,
        readonly pinnedMessages: Set<number>,
        readonly rules: VersionedRules,
        readonly bots: Map<string, ExternalBotPermissions>,
        readonly apiKeys: Map<string, PublicApiKeyDetails>,
    ) {}

    get isEmpty() {
        return this.chatId === undefined;
    }

    static empty(chatId?: ChatIdentifier) {
        return new ChatDetailsServerState(
            chatId,
            new Map(),
            new Set(),
            new Set(),
            new Set(),
            new Set(),
            emptyRules(),
            new Map(),
            new Map(),
        );
    }
}
