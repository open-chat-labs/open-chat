<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Loading from "../Loading.svelte";
    import Button from "../Button.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import type { UserSummary } from "../../domain/user/user";
    import type { UserSearchMachine } from "../../fsm/userSearch.machine";
    import type { AddGroupMachine } from "../../fsm/addgroup.machine";
    import SelectUsers from "./SelectUsers.svelte";

    export let machine: ActorRefFrom<AddGroupMachine>;

    $: userSearchMachine = $machine.children.userSearchMachine as ActorRefFrom<UserSearchMachine>;

    $: numParticipants = $machine.context.candidateGroup.participants.length;

    $: selectedUsers = $machine.context.candidateGroup.participants.map((p) => p.user);

    $: busy =
        $machine.matches({ canister_creation: "creating" }) ||
        $machine.matches({ data_collection: "adding_participants" }) ||
        $machine.matches({ canister_creation: "unexpected_error" });

    function cancel() {
        machine.send({ type: "CANCEL_CHOOSE_PARTICIPANTS" });
    }

    function complete() {
        machine.send({ type: "COMPLETE" });
    }

    function deleteParticipant(ev: CustomEvent<UserSummary>): void {
        machine.send({ type: "REMOVE_PARTICIPANT", data: ev.detail.userId });
    }
</script>

<SectionHeader>
    <span title={$_("close")} class="close" on:click={cancel}>
        <HoverIcon>
            <Close size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <h4>{$_("chooseParticipants")}</h4>
    <Avatar url={"assets/group.svg"} status={UserStatus.None} size={AvatarSize.Tiny} />
</SectionHeader>

<div class="participants">
    <div class="form-fields">
        {#if userSearchMachine !== undefined}
            <SelectUsers
                on:deleteUser={deleteParticipant}
                error={$machine.context.error}
                {selectedUsers}
                {userSearchMachine} />
        {:else}
            <Loading />
        {/if}
    </div>

    <div class="cta">
        <Button disabled={busy} loading={busy} on:click={complete} fill={true}
            >{$_(numParticipants === 0 ? "skip" : "confirmParticipants")}</Button>
    </div>
</div>

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }

    .cta {
        flex: 0 0 57px;
    }

    .participants {
        flex: 1;
        background-color: var(--section-bg);
        color: var(--section-txt);
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        overflow: auto;
        @include size-below(xs) {
            background-color: transparent;
        }
    }

    .form-fields {
        padding: $sp4;
        flex: auto;
        overflow: auto;
        @include size-below(xs) {
            padding: $sp3;
        }
    }
</style>
