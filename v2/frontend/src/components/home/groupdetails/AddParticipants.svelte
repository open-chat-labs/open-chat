<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import SectionHeader from "../../SectionHeader.svelte";
    import Loading from "../../Loading.svelte";
    import Button from "../../Button.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import type { EditGroupMachine } from "../../../fsm/editgroup.machine";
    export let machine: ActorRefFrom<EditGroupMachine>;
    import { _ } from "svelte-i18n";
    import SelectUsers from "../SelectUsers.svelte";
    import type { UserSummary } from "../../../domain/user/user";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";

    $: busy = $machine.matches({ add_participants: "saving_participants" });

    $: closeIcon = $machine.context.history.length <= 1 ? "close" : "back";

    function cancelAddParticipant() {
        machine.send({ type: "CANCEL_ADD_PARTICIPANT" });
    }

    function complete() {
        machine.send({ type: "SAVE_PARTICIPANTS" });
    }

    function deleteUser(ev: CustomEvent<UserSummary>) {
        machine.send({ type: "UNSELECT_PARTICIPANT", data: ev.detail });
    }

    function selectUser(ev: CustomEvent<UserSummary>) {
        machine.send({ type: "SELECT_PARTICIPANT", data: ev.detail });
    }
</script>

<SectionHeader>
    <h4>{$_("addParticipants")}</h4>
    <span title={$_("close")} class="close" on:click={cancelAddParticipant}>
        <HoverIcon>
            {#if closeIcon === "close"}
                <Close size={"1.2em"} color={"#aaa"} />
            {:else}
                <ArrowLeft size={"1.2em"} color={"#aaa"} />
            {/if}
        </HoverIcon>
    </span>
</SectionHeader>

{#if $machine.matches({ add_participants: "choosing_participants" })}
    <div class="find-user">
        <SelectUsers
            api={$machine.context.serviceContainer}
            on:selectUser={selectUser}
            on:deleteUser={deleteUser}
            selectedUsers={$machine.context.usersToAdd} />
    </div>
{/if}

{#if $machine.matches({ add_participants: "saving_participants" })}
    <Loading />
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
