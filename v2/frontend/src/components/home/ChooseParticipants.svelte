<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import FindUser from "../FindUser.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import ParticipantPill from "../ParticipantPill.svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import type { UserSearchMachine } from "../../fsm/userSearch.machine";
    import type { GroupMachine } from "../../fsm/group.machine";

    export let machine: ActorRefFrom<GroupMachine>;

    $: userSearchMachine = $machine.children.userSearchMachine as ActorRefFrom<UserSearchMachine>;

    function cancel() {
        machine.send({ type: "CANCEL_CHOOSE_PARTICIPANTS" });
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
    <div class="selected">
        {#each $machine.context.candidateGroup.participants as participant, pi (participant.user.userId)}
            <ParticipantPill {participant} />
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

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }
    .participants {
        flex: 1;
        padding: $sp4;
        background-color: var(--section-bg);
        color: var(--section-txt);

        @include size-below(xs) {
            padding: $sp3;
        }
    }
</style>
