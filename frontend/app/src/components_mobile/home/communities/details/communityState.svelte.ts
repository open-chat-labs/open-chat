import { i18nKey } from "@src/i18n/i18n";
import { toastStore } from "@src/stores/toast";
import { OpenChat, ROLE_NONE, type CommunitySummary, type UserGroupDetails } from "openchat-client";

export class CommunityState {
    #confirmingUserGroupDelete = $state(false);
    #userGroupToDelete = $state<UserGroupDetails>();

    constructor(
        private client: OpenChat,
        private community: CommunitySummary,
    ) {}

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

    muteAllChannels() {
        return this.client.muteAllChannels(this.community.id, false);
    }

    share() {
        console.log("Not sure what this does yet");
    }

    confirmDeleteUserGroup(userGroup: UserGroupDetails) {
        this.#userGroupToDelete = userGroup;
        this.#confirmingUserGroupDelete = true;
    }

    deleteUserGroup(yes: boolean = true): Promise<void> {
        if (this.#confirmingUserGroupDelete && !yes) {
            this.#userGroupToDelete = undefined;
            this.#confirmingUserGroupDelete = false;
            return Promise.resolve();
        }
        if (this.#userGroupToDelete === undefined) {
            return Promise.resolve();
        }

        this.#confirmingUserGroupDelete = false;

        return this.client
            .deleteUserGroup(this.community.id, this.#userGroupToDelete)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(
                        i18nKey("communities.errors.deleteUserGroupFailed"),
                    );
                }
            })
            .finally(() => (this.#userGroupToDelete = undefined));
    }
}
