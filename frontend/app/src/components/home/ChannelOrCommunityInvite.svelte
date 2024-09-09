<script lang="ts">
    import { type ChannelSummary, type CommunitySummary, type UserSummary } from "openchat-client";
    import ScopeToggle from "./communities/ScopeToggle.svelte";
    import InviteUsersHeader from "./groupdetails/InviteUsersHeader.svelte";
    import InviteUsersBody from "./groupdetails/InviteUsersBody.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let channel: ChannelSummary;
    export let community: CommunitySummary;
    export let selectedTab: "community" | "channel" = "channel";
    export let memberLookup:
        | ((searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>)
        | undefined = undefined;
    export let closeIcon: "close" | "back";
    export let busy = false;
    export let userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;

    function inviteChannelUsers(ev: CustomEvent<UserSummary[]>) {
        dispatch("inviteChannelUsers", ev.detail);
    }
    function inviteCommunityUsers(ev: CustomEvent<UserSummary[]>) {
        dispatch("inviteCommunityUsers", ev.detail);
    }
</script>

<ScopeToggle bind:selectedTab>
    <InviteUsersHeader
        slot="header"
        on:cancelInviteUsers
        {closeIcon}
        level={selectedTab}
        container={selectedTab === "channel" ? channel : community}
        isCommunityPublic={community.public} />

    <div slot="channel">
        <InviteUsersBody
            on:inviteUsers={inviteChannelUsers}
            {busy}
            {userLookup}
            {memberLookup}
            level={selectedTab}
            container={selectedTab === "channel" ? channel : community}
            isCommunityPublic={community.public} />
    </div>
    <div slot="community">
        <InviteUsersBody
            on:inviteUsers={inviteCommunityUsers}
            {busy}
            {userLookup}
            {memberLookup}
            level={selectedTab}
            container={selectedTab === "channel" ? channel : community}
            isCommunityPublic={community.public} />
    </div>
</ScopeToggle>
