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
import { addLookedUpMembers } from "../members";

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
        // Set if not all of the members are held, to the user id after which those not in the
        // first page start
        public moreMembersAfter: string | undefined = undefined,
    ) {}

    // These details with members added who have been looked up, or undefined if there are none to
    // add (see `addLookedUpMembers`)
    withLookedUpMembers(found: Member[], asOf: bigint): ChatDetailsState | undefined {
        const added = addLookedUpMembers(this, found, asOf);
        if (added === undefined) {
            return undefined;
        }
        return new ChatDetailsState(
            this.chatId,
            this.timestamp,
            added.members,
            added.lapsedMembers,
            this.blockedUsers,
            this.invitedUsers,
            this.pinnedMessages,
            this.bots,
            this.webhooks,
            this.rules,
            this.moreMembersAfter,
        );
    }
}
