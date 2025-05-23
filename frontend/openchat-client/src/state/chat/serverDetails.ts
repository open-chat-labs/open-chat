import {
    emptyRules,
    type ChatIdentifier,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type ReadonlyMap,
    type ReadonlySet,
    type VersionedRules,
    type WebhookDetails,
} from "openchat-shared";

export class ChatDetailsState {
    constructor(
        public chatId: ChatIdentifier,
        public members: ReadonlyMap<string, Member>,
        public lapsedMembers: ReadonlySet<string>,
        public blockedUsers: ReadonlySet<string>,
        public invitedUsers: ReadonlySet<string>,
        public pinnedMessages: ReadonlySet<number>,
        public bots: ReadonlyMap<string, ExternalBotPermissions>,
        public apiKeys: ReadonlyMap<string, PublicApiKeyDetails>,
        public webhooks: ReadonlyMap<string, WebhookDetails>,
        public rules: VersionedRules = emptyRules(),
    ) {}
}
