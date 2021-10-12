<script lang="ts">
    import FindUser from "../FindUser.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UserPill from "../UserPill.svelte";
    import { fade } from "svelte/transition";
    import { _ } from "svelte-i18n";
    import type { UserSummary } from "../../domain/user/user";
    import { pop } from "../../utils/transition";
    import type { ServiceContainer } from "../../services/serviceContainer";

    export let api: ServiceContainer;
    export let selectedUsers: UserSummary[];

    let error: string | undefined = undefined;
</script>

<div class="selected">
    {#each selectedUsers as user, _ui (user.userId)}
        <div
            class="pill"
            in:pop={{ duration: 500 }}
            out:fade={{ duration: 200 }}
            title={user.username}>
            <UserPill on:deleteUser {user} />
        </div>
    {/each}
</div>
{#if error !== undefined}
    <ErrorMessage>{$_("errorSearchingForUser")}</ErrorMessage>
{/if}

<div class="find-user">
    <FindUser on:selectUser {api} />
</div>

<style type="text/scss">
    .pill {
        display: inline-block;
    }
</style>
