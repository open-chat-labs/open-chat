<script lang="ts">
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import Participant from "./Participant.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import type { UserSummary } from "../../domain/user/user";
    import { elasticOut } from "svelte/easing";
    export let machine: ActorRefFrom<ChatMachine>;

    function close() {
        machine.send({ type: "HIDE_PARTICIPANTS" });
    }

    $: knownUsers =
        $machine.context.chatSummary.kind === "group_chat"
            ? $machine.context.chatSummary.participants.reduce<UserSummary[]>((users, p) => {
                  const user = $machine.context.userLookup[p];
                  if (user) {
                      users.push(user);
                  }
                  return users;
              }, [])
            : [];

    $: busy = $machine.matches({ showing_participants: "removing_participant" });
</script>

<ParticipantsHeader on:close={close} on:addParticipant />

<div class="wrapper" class:busy>
    {#if $machine.context.user !== undefined}
        <Participant
            {machine}
            participant={$machine.context.user}
            on:blockUser
            on:selectParticipant />
    {/if}
    {#each knownUsers as user, i (user)}
        <div animate:flip={{ duration: 500, easing: elasticOut }} out:fade>
            <Participant {machine} participant={user} on:blockUser on:selectParticipant />
        </div>
    {/each}
</div>

<style type="text/scss">
    .wrapper {
        position: relative;
    }

    .busy {
    }
</style>
