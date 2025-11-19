import { OpenChat, ROLE_NONE, type CommunitySummary } from "openchat-client";

export class CommunityState {
    constructor(
        private client: OpenChat,
        private community: CommunitySummary,
    ) {}

    get #accessible() {
        if (this.community.membership.role === ROLE_NONE) return false;
        if (this.client.isCommunityFrozen(this.community.id)) return false;
        return true;
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
}
