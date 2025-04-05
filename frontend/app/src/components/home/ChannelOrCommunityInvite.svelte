<script lang="ts">
    import { type ChannelSummary, type CommunitySummary, type UserSummary } from "openchat-client";
    import ScopeToggle from "./communities/ScopeToggle.svelte";
    import InviteUsersHeader from "./groupdetails/InviteUsersHeader.svelte";
    import InviteUsersBody from "./groupdetails/InviteUsersBody.svelte";

    interface Props {
        channel: ChannelSummary;
        community: CommunitySummary;
        selectedTab?: "community" | "channel";
        memberLookup?:
            | ((searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>)
            | undefined;
        closeIcon: "close" | "back";
        busy?: boolean;
        userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;
        onInviteChannelUsers: (users: UserSummary[]) => void;
        onInviteCommunityUsers: (users: UserSummary[]) => void;
        onCancelInviteUsers: () => void;
    }

    let {
        channel,
        community,
        selectedTab = $bindable("channel"),
        memberLookup = undefined,
        closeIcon,
        busy = false,
        userLookup,
        onInviteChannelUsers,
        onInviteCommunityUsers,
        onCancelInviteUsers,
    }: Props = $props();
</script>

<ScopeToggle bind:selectedTab>
    {#snippet header()}
        <InviteUsersHeader
            {onCancelInviteUsers}
            {closeIcon}
            level={selectedTab}
            container={selectedTab === "channel" ? channel : community}
            isCommunityPublic={community.public} />
    {/snippet}

    {#snippet channelTab()}
        <InviteUsersBody
            onInviteUsers={onInviteChannelUsers}
            {busy}
            {userLookup}
            {memberLookup}
            level={selectedTab}
            container={selectedTab === "channel" ? channel : community}
            isCommunityPublic={community.public} />
    {/snippet}
    {#snippet communityTab()}
        <InviteUsersBody
            onInviteUsers={onInviteCommunityUsers}
            {busy}
            {userLookup}
            {memberLookup}
            level={selectedTab}
            container={selectedTab === "channel" ? channel : community}
            isCommunityPublic={community.public} />
    {/snippet}
</ScopeToggle>
