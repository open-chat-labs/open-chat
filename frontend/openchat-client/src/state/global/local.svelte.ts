import {
    type ChatIdentifier,
    type ChatListScope,
    type CommunityIdentifier,
    type CommunitySummary,
    type ExternalBotPermissions,
    type Member,
    type UserGroupDetails,
    type VersionedRules,
    type WalletConfig,
} from "openchat-shared";
import { chatDetailsLocalUpdates } from "../chat_details";
import { communityLocalUpdates } from "../community_details";
import { LocalCommunityMap, LocalMap, ReactiveCommunityMap } from "../map";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

// global local updates don't need the manager because they are not specific to a keyed entity (community, chat, message etc)
export class GlobalLocalState {
    // communities may be added or removed locally or they may be previewed. They are all handled by this.
    readonly communities = new LocalCommunityMap<CommunitySummary>();
    readonly previewCommunities = new ReactiveCommunityMap<CommunitySummary>();
    readonly directChatBots = new LocalMap<string, ExternalBotPermissions>();

    #walletConfig = $state<WalletConfig | undefined>();

    isPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.has(id);
    }

    getPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.get(id);
    }

    addCommunityPreview(val: CommunitySummary) {
        return this.previewCommunities.set(val.id, val);
    }

    removeCommunityPreview(id: CommunityIdentifier) {
        return this.previewCommunities.delete(id);
    }

    addCommunity(val: CommunitySummary) {
        return this.communities.addOrUpdate(val.id, val);
    }

    get walletConfig() {
        return this.#walletConfig;
    }

    updateWalletConfig(val: WalletConfig) {
        const prev = this.#walletConfig;
        this.#walletConfig = val;
        return scheduleUndo(() => {
            this.#walletConfig = prev;
        });
    }

    updateRulesAccepted(id: CommunityIdentifier, accepted: boolean) {
        return communityLocalUpdates.updateRulesAccepted(id, accepted);
    }

    updateCommunityDisplayName(id: CommunityIdentifier, name?: string) {
        return communityLocalUpdates.updateDisplayName(id, name);
    }

    updateCommunityMember(id: CommunityIdentifier, userId: string, member: Member) {
        return communityLocalUpdates.updateMember(id, userId, member);
    }

    blockCommunityUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return communityLocalUpdates.blockUser(id, userId);
    }

    unblockCommunityUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return communityLocalUpdates.unblockUser(id, userId);
    }

    removeCommunityMember(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return communityLocalUpdates.removeMember(id, userId);
    }

    inviteCommunityUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return communityLocalUpdates.inviteUsers(id, userIds);
    }

    uninviteCommunityUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return communityLocalUpdates.uninviteUsers(id, userIds);
    }

    updateCommunityRules(id: CommunityIdentifier, rules: VersionedRules): UndoLocalUpdate {
        return communityLocalUpdates.updateRules(id, rules);
    }

    updateCommunityRulesAccepted(id: CommunityIdentifier, accepted: boolean): UndoLocalUpdate {
        return communityLocalUpdates.updateRulesAccepted(id, accepted);
    }

    deleteUserGroup(id: CommunityIdentifier, userGroupId: number): UndoLocalUpdate {
        return communityLocalUpdates.deleteUserGroup(id, userGroupId);
    }

    addOrUpdateUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): UndoLocalUpdate {
        return communityLocalUpdates.addOrUpdateUserGroup(id, userGroup);
    }

    removeBotFromCommunity(id: CommunityIdentifier, botId: string): UndoLocalUpdate {
        return communityLocalUpdates.removeBot(id, botId);
    }

    installBotInCommunity(
        id: CommunityIdentifier,
        botId: string,
        perm: ExternalBotPermissions,
    ): UndoLocalUpdate {
        return communityLocalUpdates.installBot(id, botId, perm);
    }

    removeCommunity(id: CommunityIdentifier) {
        if (!this.removeCommunityPreview(id)) {
            return this.communities.remove(id);
        }
    }

    updateCommunityIndex(id: CommunityIdentifier, index: number): UndoLocalUpdate {
        return communityLocalUpdates.updateIndex(id, index);
    }

    // Chat stuff
    updateChatMember(
        id: ChatIdentifier,
        userId: string,
        existing: Member | undefined,
        updater: (m: Member) => Member,
    ) {
        return chatDetailsLocalUpdates.updateMember(id, userId, existing, updater);
    }

    blockChatUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return chatDetailsLocalUpdates.blockUser(id, userId);
    }

    unblockChatUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return chatDetailsLocalUpdates.unblockUser(id, userId);
    }

    removeChatMember(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return chatDetailsLocalUpdates.removeMember(id, userId);
    }

    addChatMember(id: ChatIdentifier, member: Member): UndoLocalUpdate {
        return chatDetailsLocalUpdates.addMember(id, member);
    }

    pinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return chatDetailsLocalUpdates.pinMessage(id, messageIndex);
    }

    unpinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return chatDetailsLocalUpdates.unpinMessage(id, messageIndex);
    }

    inviteChatUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        return chatDetailsLocalUpdates.inviteUsers(id, userIds);
    }

    uninviteChatUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        return chatDetailsLocalUpdates.uninviteUsers(id, userIds);
    }

    updateChatRules(id: ChatIdentifier, rules: VersionedRules): UndoLocalUpdate {
        return chatDetailsLocalUpdates.updateRules(id, rules);
    }

    removeBotFromChat(id: ChatIdentifier, botId: string): UndoLocalUpdate {
        return chatDetailsLocalUpdates.removeBot(id, botId);
    }

    installBotInChat(
        id: ChatIdentifier,
        botId: string,
        perm: ExternalBotPermissions,
    ): UndoLocalUpdate {
        return chatDetailsLocalUpdates.installBot(id, botId, perm);
    }

    pinToScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return chatDetailsLocalUpdates.pinToScope(id, scope);
    }

    unpinFromScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return chatDetailsLocalUpdates.unpinFromScope(id, scope);
    }

    removeDirectChatBot(botId: string): UndoLocalUpdate {
        return this.directChatBots.remove(botId);
    }

    installDirectChatBot(botId: string, perm: ExternalBotPermissions): UndoLocalUpdate {
        return this.directChatBots.addOrUpdate(botId, perm);
    }
}

export const localUpdates = new GlobalLocalState();
