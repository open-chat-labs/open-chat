<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import FindUser from "../FindUser.svelte";
    import Button from "../Button.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import ParticipantPill from "../ParticipantPill.svelte";
    import { fade } from "svelte/transition";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import type { UserSearchMachine } from "../../fsm/userSearch.machine";
    import type { CandidateParticipant, GroupMachine } from "../../fsm/group.machine";
    import { pop } from "../../utils/transition";

    export let machine: ActorRefFrom<GroupMachine>;

    $: userSearchMachine = $machine.children.userSearchMachine as ActorRefFrom<UserSearchMachine>;

    $: numParticipants = $machine.context.candidateGroup.participants.length;

    function cancel() {
        machine.send({ type: "CANCEL_CHOOSE_PARTICIPANTS" });
    }

    function complete() {
        machine.send({ type: "COMPLETE" });
    }

    function deleteParticipant(ev: CustomEvent<CandidateParticipant>): void {
        console.log("removing participant: ", ev.detail.user.userId);
        machine.send({ type: "REMOVE_PARTICIPANT", data: ev.detail.user.userId });
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
        <div class="selected">
            {#each $machine.context.candidateGroup.participants as participant, pi (participant.user.userId)}
                <div
                    class="pill"
                    in:pop={{ duration: 500 }}
                    out:fade={{ duration: 200 }}
                    title={participant.user.username}>
                    <ParticipantPill on:deleteParticipant={deleteParticipant} {participant} />
                </div>
            {/each}
        </div>
        {#if $machine.matches({ showing_participants: { adding_participant: "unexpected_error" } })}
            <ErrorMessage>{$_("errorSearchingForUser")}</ErrorMessage>
        {/if}

        {#if userSearchMachine !== undefined && !$userSearchMachine.matches("unexpected_error")}
            <div class="find-user">
                <FindUser machine={userSearchMachine} />
            </div>
        {/if}
    </div>

    <div class="cta">
        <Button
            disabled={$machine.matches({ canister_creation: "creating" })}
            loading={$machine.matches({ canister_creation: "creating" })}
            on:click={complete}
            fill={true}>{$_(numParticipants === 0 ? "skip" : "confirmParticipants")}</Button>
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
        flex: 0 0 45px;
    }

    .pill {
        display: inline-block;
    }

    .participants {
        flex: 1;
        background-color: var(--section-bg);
        color: var(--section-txt);
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        overflow: auto;
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
