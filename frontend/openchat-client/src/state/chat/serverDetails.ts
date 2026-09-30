import {
    emptyRules,
    type ChatIdentifier,
    type GrantedBotPermissions,
    type Member,
    type ReadonlyMap,
    type ReadonlySet,
    type VersionedRules,
    type WebhookDetails,
} from "@shared";
import { addLoadedMembers, type MembersPagePosition } from "../members";

export class ChatDetailsState {
    constructor(
        public chatId: ChatIdentifier,
        public timestamp: bigint,
        public members: ReadonlyMap<string, Member>,
        public lapsedMembers: ReadonlySet<string>,
        public blockedUsers: ReadonlySet<string>,
        public invitedUsers: ReadonlySet<string>,
        public pinnedMessages: ReadonlySet<number>,
        public bots: ReadonlyMap<string, GrantedBotPermissions>,
        public webhooks: ReadonlyMap<string, WebhookDetails>,
        public rules: VersionedRules = emptyRules(),
        // If not all of the members are held, the user id after which the next page of them starts
        public moreMembersAfter: string | undefined = undefined,
    ) {}

    // These details with members added who have been loaded since: a page of them, or some who
    // were looked up
    withMembers(loaded: Member[], page?: MembersPagePosition): ChatDetailsState {
        const { members, lapsedMembers, moreMembersAfter } = addLoadedMembers(this, loaded, page);
        return new ChatDetailsState(
            this.chatId,
            this.timestamp,
            members,
            lapsedMembers,
            this.blockedUsers,
            this.invitedUsers,
            this.pinnedMessages,
            this.bots,
            this.webhooks,
            this.rules,
            moreMembersAfter,
        );
    }
}
