<script lang="ts">
    import FindUser from "../FindUser.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UserPill from "../UserPill.svelte";
    import { fade } from "svelte/transition";
    import { _ } from "svelte-i18n";
    import type { UserSummary } from "openchat-client";
    import { pop } from "../../utils/transition";

    export let mode: "add" | "edit";
    export let selectedUsers: UserSummary[];
    export let enabled = true;

    let error: string | undefined = undefined;
</script>

<div class="selected">
    {#each selectedUsers as user, _ui (user.userId)}
        <div
            class="pill"
            in:pop={{ duration: 500 }}
            out:fade={{ duration: 200 }}
            title={user.username}>
            <UserPill {mode} on:deleteUser {user} />
        </div>
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
        padding: 0 $sp4;
    }
    .pill {
        display: inline-block;
    }
</style>
