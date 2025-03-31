<script lang="ts">
    import FindUser from "../FindUser.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UserPill from "../UserPill.svelte";
    import type { UserOrUserGroup, UserSummary } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    interface Props {
        mode: "add" | "edit";
        selectedUsers: UserSummary[];
        enabled?: boolean;
        userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;
        onDeleteUser: (user: UserOrUserGroup) => void;
    }

    let { mode, selectedUsers, enabled = true, userLookup, onDeleteUser }: Props = $props();

    let error: string | undefined = undefined;
</script>

{#if selectedUsers.length > 0}
    <div class="selected">
        {#each selectedUsers as user (user.userId)}
            <UserPill {onDeleteUser} userOrGroup={user} />
        {/each}
    </div>
{/if}
{#if error !== undefined}
    <ErrorMessage><Translatable resourceKey={i18nKey("errorSearchingForUser")} /></ErrorMessage>
{/if}

<div class="find-user">
    <FindUser {userLookup} {enabled} {mode} on:selectUser />
</div>

<style lang="scss">
    .selected {
        padding: 0 $sp4 $sp4 $sp4;
        display: flex;
        flex-wrap: wrap;
        gap: $sp3;
    }
</style>
