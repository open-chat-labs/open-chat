<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import SectionHeader from "../../SectionHeader.svelte";
    import Loading from "../../Loading.svelte";
    import Button from "../../Button.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import type { EditGroupMachine } from "../../../fsm/editgroup.machine";
    export let machine: ActorRefFrom<EditGroupMachine>;
    import { _ } from "svelte-i18n";
    import type { UserSearchMachine } from "../../../fsm/userSearch.machine";
    import SelectUsers from "../SelectUsers.svelte";
    import type { UserSummary } from "../../../domain/user/user";

    $: userSearchMachine = $machine.children.userSearchMachine as ActorRefFrom<UserSearchMachine>;

    $: busy = $machine.matches({ adding_participants: "saving_participants" });

    function cancelAddParticipant() {
        machine.send({ type: "CANCEL_ADD_PARTICIPANT" });
    }

    function complete() {
        machine.send({ type: "SAVE_PARTICIPANTS" });
    }

    function deleteUser(ev: CustomEvent<UserSummary>) {
        machine.send({ type: "UNSELECT_PARTICIPANT", data: ev.detail });
    }
</script>

<SectionHeader>
    <span title={$_("close")} class="close" on:click={cancelAddParticipant}>
        <HoverIcon>
            <Close size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <h4>{$_("addParticipants")}</h4>
</SectionHeader>

{#if userSearchMachine !== undefined}
    <div class="find-user">
        <SelectUsers
            error={$machine.context.error}
            on:deleteUser={deleteUser}
            selectedUsers={$machine.context.usersToAdd}
            {userSearchMachine} />
    </div>
{/if}

{#if $machine.matches({ adding_participants: "saving_participants" })}
    <Loading />
{/if}

{#if $machine.matches({ adding_participants: "unexpected_error" })}
    <ErrorMessage>{$_("errorSearchingForUser")}</ErrorMessage>
{/if}

<div class="cta">
    <Button
        disabled={busy || $machine.context.usersToAdd.length === 0}
        loading={busy}
        on:click={complete}
        fill={true}>{$_("addParticipants")}</Button>
</div>

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }
    .find-user {
        margin: 0 $sp3;
        flex: 1;
        display: flex;
        flex-direction: column;
    }
</style>
