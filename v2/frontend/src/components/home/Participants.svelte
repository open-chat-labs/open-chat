<script lang="ts">
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import Participant from "./Participant.svelte";
    import type { ActorRefFrom } from "xstate";
    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import type { PartialUserSummary } from "../../domain/user/user";
    import { elasticOut } from "svelte/easing";
    import type { ParticipantsMachine } from "../../fsm/participants.machine";
    // import VirtualList from "../VirtualList.svelte";

    export let machine: ActorRefFrom<ParticipantsMachine>;

    function close() {
        machine.send({ type: "HIDE_PARTICIPANTS" });
    }

    function addParticipant() {
        machine.send({ type: "ADD_PARTICIPANT" });
    }

    $: knownUsers =
        $machine.context.chatSummary.kind === "group_chat"
            ? $machine.context.chatSummary.participants.reduce<PartialUserSummary[]>((users, p) => {
                  const user = $machine.context.userLookup[p.userId];
                  if (user) {
                      users.push(user);
                  }
                  return users;
              }, [])
            : [];

    $: busy = $machine.matches({ showing_participants: "removing_participant" });
</script>

<ParticipantsHeader on:close={close} on:addParticipant={addParticipant} />

{#if $machine.context.user !== undefined}
    <Participant {machine} participant={$machine.context.user} on:blockUser on:chatWith />
{/if}

<div class="wrapper" class:busy>
    <!-- <VirtualList items={knownUsers} let:item height="100vh">
        <Participant {machine} participant={item} on:blockUser on:selectParticipant />
    </VirtualList> -->
    {#each knownUsers as user, i (user.userId)}
        <div
            animate:flip={{ duration: 600, easing: elasticOut }}
            out:fade|local={{ duration: 150 }}>
            <Participant {machine} participant={user} on:blockUser on:chatWith on:close={close} />
        </div>
    {/each}
</div>

<style type="text/scss">
    .wrapper {
        position: relative;
        overflow: auto;
    }

    .busy {
    }
</style>
