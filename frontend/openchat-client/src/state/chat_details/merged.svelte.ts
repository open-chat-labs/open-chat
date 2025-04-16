import type DRange from "drange";
import type {
    ChatEvent,
    ChatIdentifier,
    EventWrapper,
    ExternalBotPermissions,
    Member,
    PublicApiKeyDetails,
    UserGroupDetails,
    VersionedRules,
} from "openchat-shared";

export class ChatDetailsMergedState {
    constructor(
        readonly chatId: ChatIdentifier | undefined,
        readonly expiredEventRanges: DRange,
        readonly expandedDeletedMessages: Set<number>,
        readonly serverEvents: EventWrapper<ChatEvent>[],
        readonly userIds: Set<string>,
        readonly userGroupKeys: Set<string>,
        readonly confirmedEventIndexesLoaded: DRange,
        readonly pinnedMessages: Set<number>,
        readonly userGroups: Map<number, UserGroupDetails>,
        readonly members: Map<string, Member>,
        readonly blockedUsers: Set<string>,
        readonly lapsedMembers: Set<string>,
        readonly invitedUsers: Set<string>,
        readonly referrals: Set<string>,
        readonly bots: Map<string, ExternalBotPermissions>,
        readonly apiKeys: Map<string, PublicApiKeyDetails>,
        readonly rules?: VersionedRules,
        readonly focusMessageIndex?: number,
        readonly focusThreadMessageIndex?: number,
    ) {}
}
