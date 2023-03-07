<script lang="ts">
    import FindUser from "../FindUser.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UserPill from "../UserPill.svelte";
    import { _ } from "svelte-i18n";
    import type { UserSummary } from "openchat-client";

    export let mode: "add" | "edit";
    export let selectedUsers: UserSummary[];
    export let enabled = true;

    let error: string | undefined = undefined;
</script>

<div class="selected">
    {#each selectedUsers as user, _ui (user.userId)}
        <UserPill on:deleteUser {user} />
    {/each}
</div>
{#if error !== undefined}
    <ErrorMessage>{$_("errorSearchingForUser")}</ErrorMessage>
{/if}

<div class="find-user">
    <FindUser {enabled} {mode} on:selectUser />
</div>

<style type="text/scss">
    .selected {
        padding: 0 $sp4 $sp4 $sp4;
        display: flex;
        flex-wrap: wrap;
        gap: $sp3;
    }
</style>
