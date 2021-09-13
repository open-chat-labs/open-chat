<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import SectionHeader from "../SectionHeader.svelte";
    import Loading from "../Loading.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import FindUser from "../FindUser.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    export let machine: ActorRefFrom<ParticipantsMachine>;
    import { _ } from "svelte-i18n";
    import type { UserSearchMachine } from "../../fsm/userSearch.machine";
    import type { ParticipantsMachine } from "../../fsm/participants.machine";
    import SelectUsers from "./SelectUsers.svelte";

    $: userSearchMachine = $machine.children.userSearchMachine as ActorRefFrom<UserSearchMachine>;

    $: selectedUsers = [];

    function cancelAddParticipant() {
        machine.send({ type: "CANCEL_ADD_PARTICIPANT" });
    }

    $: console.log("part machine: ", $machine.value);
</script>

<SectionHeader>
    <span title={$_("close")} class="close" on:click={cancelAddParticipant}>
        <HoverIcon>
            <Close size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <h4>{$_("addParticipant")}</h4>
</SectionHeader>

{#if userSearchMachine !== undefined}
    <SelectUsers error={$machine.context.error} {selectedUsers} {userSearchMachine} />
{:else}
    <p>user search machine is undefined</p>
{/if}

{#if $machine.matches({ adding_participant: "saving_participant" })}
    <Loading />
{/if}

{#if $machine.matches({ adding_participant: "unexpected_error" })}
    <ErrorMessage>{$_("errorSearchingForUser")}</ErrorMessage>
{/if}

{#if userSearchMachine !== undefined && !$userSearchMachine.matches("unexpected_error")}
    <div class="find-user">
        <FindUser machine={userSearchMachine} />
    </div>
{/if}

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
