<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CommunitySummary, Level, MultiUserChat, UserSummary } from "openchat-client";
    import InviteUsersHeader from "./InviteUsersHeader.svelte";
    import InviteUsersBody from "./InviteUsersBody.svelte";

    interface Props {
        closeIcon: "close" | "back";
        busy?: boolean;
        userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;
        memberLookup?:
            | ((searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>)
            | undefined;
        level: Level;
        container: MultiUserChat | CommunitySummary;
        isCommunityPublic: boolean;
        onCancelInviteUsers: () => void;
        onInviteUsers: (users: UserSummary[]) => void;
    }

    let {
        closeIcon,
        busy = false,
        userLookup,
        memberLookup = undefined,
        level,
        container,
        isCommunityPublic,
        onCancelInviteUsers,
        onInviteUsers,
    }: Props = $props();
</script>

<InviteUsersHeader {onCancelInviteUsers} {closeIcon} {level} {container} {isCommunityPublic} />

<InviteUsersBody
    {onInviteUsers}
    {busy}
    {userLookup}
    {memberLookup}
    {level}
    {container}
    {isCommunityPublic} />
