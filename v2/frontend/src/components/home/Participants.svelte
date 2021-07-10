<script lang="ts">
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import Participant from "./Participant.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import type { UserSummary } from "../../domain/user/user";
    import { elasticOut } from "svelte/easing";
    // import VirtualList from "../VirtualList.svelte";

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
    <!-- <VirtualList items={knownUsers} let:item height="100vh">
        <Participant {machine} participant={item} on:blockUser on:selectParticipant />
    </VirtualList> -->
    {#each knownUsers as user, i (user)}
        <div animate:flip={{ duration: 600, easing: elasticOut }} out:fade={{ duration: 150 }}>
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
