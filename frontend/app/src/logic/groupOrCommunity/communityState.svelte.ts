import { i18nKey } from "@src/i18n/i18n";
import {
    OpenChat,
    ROLE_NONE,
    type CommunitySummary,
    type ResourceKey,
    type UserGroupDetails,
} from "@client";

export class CommunityState {
    #confirmingUserGroupDelete = $state(false);
    #userGroupToDelete = $state<UserGroupDetails>();
    #canManageUserGroups = false;

    constructor(
        private client: OpenChat,
        private community: CommunitySummary,
    ) {
        this.#canManageUserGroups = client.canManageUserGroups(community.id);
    }

    get canManageUserGroups() {
        return this.#canManageUserGroups;
    }

    get #accessible() {
        if (this.community.membership.role === ROLE_NONE) return false;
        if (this.client.isCommunityFrozen(this.community.id)) return false;
        return true;
    }

    get confirmingUserGroupDelete() {
        return this.#confirmingUserGroupDelete;
    }

    isMember() {
        return this.community?.membership.role !== ROLE_NONE;
    }

    isFrozen() {
        return this.client.isCommunityFrozen(this.community?.id);
    }

    canCreateChannel() {
        return this.#accessible && this.client.canCreateChannel(this.community.id);
    }

    canEditCommunity() {
        return this.#accessible && this.client.canEditCommunity(this.community.id);
    }

    bannerUrl() {
        const url = this.client.communityBannerUrl(this.community.banner);
        return url ? `url(${url})` : undefined;
    }

    avatarUrl() {
        return this.client.communityAvatarUrl(this.community.id.communityId, this.community.avatar);
    }

    muteAllChannels(muteAtEveryone: boolean) {
        return this.client.muteAllChannels(this.community.id, muteAtEveryone);
    }

    confirmDeleteUserGroup(userGroup: UserGroupDetails) {
        this.#userGroupToDelete = userGroup;
        this.#confirmingUserGroupDelete = true;
    }

    /** Answers the delete confirmation; resolves to the failure message if the delete fails. */
    async deleteUserGroup(yes: boolean = true): Promise<ResourceKey | undefined> {
        if (this.#confirmingUserGroupDelete && !yes) {
            this.#userGroupToDelete = undefined;
            this.#confirmingUserGroupDelete = false;
            return undefined;
        }
        if (this.#userGroupToDelete === undefined) {
            return undefined;
        }

        this.#confirmingUserGroupDelete = false;

        try {
            const success = await this.client.deleteUserGroup(
                this.community.id,
                this.#userGroupToDelete,
            );
            return success ? undefined : i18nKey("communities.errors.deleteUserGroupFailed");
        } finally {
            this.#userGroupToDelete = undefined;
        }
    }
}
