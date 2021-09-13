<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import FindUser from "../FindUser.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UserPill from "../UserPill.svelte";
    import { fade } from "svelte/transition";
    import { _ } from "svelte-i18n";
    import type { UserSummary } from "../../domain/user/user";
    import type { UserSearchMachine } from "../../fsm/userSearch.machine";
    import { pop } from "../../utils/transition";
    import type { CandidateParticipant } from "../../domain/chat/chat";

    export let userSearchMachine: ActorRefFrom<UserSearchMachine>;
    export let selectedUsers: UserSummary[];
    export let error: Error | undefined;

    function deleteParticipant(ev: CustomEvent<CandidateParticipant>): void {
        selectedUsers = selectedUsers.filter((u) => u.userId !== ev.detail.user.userId);
    }
</script>

<div class="selected">
    {#each selectedUsers as user, _ui (user.userId)}
        <div
            class="pill"
            in:pop={{ duration: 500 }}
            out:fade={{ duration: 200 }}
            title={user.username}>
            <UserPill on:deleteParticipant={deleteParticipant} {user} />
        </div>
    {/each}
</div>
{#if error !== undefined}
    <ErrorMessage>{$_("errorSearchingForUser")}</ErrorMessage>
{/if}

<div class="find-user">
    <FindUser machine={userSearchMachine} />
</div>

<style type="text/scss">
    .pill {
        display: inline-block;
    }
</style>
