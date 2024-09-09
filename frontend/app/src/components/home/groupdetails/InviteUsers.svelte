<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CommunitySummary, Level, MultiUserChat, UserSummary } from "openchat-client";
    import InviteUsersHeader from "./InviteUsersHeader.svelte";
    import InviteUsersBody from "./InviteUsersBody.svelte";

    export let closeIcon: "close" | "back";
    export let busy = false;
    export let userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;
    export let memberLookup:
        | ((searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>)
        | undefined = undefined;
    export let level: Level;
    export let container: MultiUserChat | CommunitySummary;
    export let isCommunityPublic: boolean;
</script>

<InviteUsersHeader on:cancelInviteUsers {closeIcon} {level} {container} {isCommunityPublic} />

<InviteUsersBody
    on:inviteUsers
    {busy}
    {userLookup}
    {memberLookup}
    {level}
    {container}
    {isCommunityPublic} />
