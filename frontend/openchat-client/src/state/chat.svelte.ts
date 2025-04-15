import DRange from "drange";
import {
    emptyRules,
    type ChatEvent,
    type EventWrapper,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type VersionedRules,
} from "openchat-shared";
import { SvelteMap, SvelteSet } from "svelte/reactivity";

export class ChatState {
    constructor(
        public readonly lapsedMembers: SvelteSet<string>,
        public readonly members: Member[],
        public readonly membersMap: SvelteMap<string, Member>,
        public readonly blockedUsers: SvelteSet<string>,
        public readonly invitedUsers: SvelteSet<string>,
        public readonly pinnedMessages: SvelteSet<number>,
        public readonly userIds: SvelteSet<string>,
        public readonly confirmedEventIndexesLoaded: DRange,
        public readonly userGroupKeys: SvelteSet<string>,
        public readonly serverEvents: EventWrapper<ChatEvent>[],
        public readonly expandedDeletedMessages: SvelteSet<number>,
        public readonly expiredEventRanges: DRange,
        public readonly bots: SvelteMap<string, ExternalBotPermissions>,
        public readonly apiKeys: SvelteMap<string, PublicApiKeyDetails>,
        public readonly rules?: VersionedRules,
        public readonly focusMessageIndex?: number,
        public readonly focusThreadMessageIndex?: number,
    ) {}

    static empty(): ChatState {
        return new ChatState(
            new SvelteSet(),
            [],
            new SvelteMap(),
            new SvelteSet(),
            new SvelteSet(),
            new SvelteSet(),
            new SvelteSet(),
            new DRange(),
            new SvelteSet(),
            [],
            new SvelteSet(),
            new DRange(),
            new SvelteMap(),
            new SvelteMap(),
            emptyRules(),
        );
    }
}
