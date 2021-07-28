<script lang="ts">
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import Participant from "./Participant.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { PartialUserSummary } from "../../domain/user/user";
    import type { ParticipantsMachine } from "../../fsm/participants.machine";
    import VirtualList from "../VirtualList.svelte";

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

    function dismissAsAdmin(ev: CustomEvent<string>): void {
        machine.send({ type: "DISMISS_AS_ADMIN", data: ev.detail });
    }

    function removeParticipant(ev: CustomEvent<string>): void {
        machine.send({ type: "REMOVE_PARTICIPANT", data: ev.detail });
    }
</script>

<ParticipantsHeader on:close={close} on:addParticipant={addParticipant} />

{#if $machine.context.user !== undefined}
    <Participant
        me={true}
        userLookup={$machine.context.userLookup}
        participant={$machine.context.user}
        on:blockUser
        on:chatWith />
{/if}

<VirtualList keyFn={(user) => user.userId} items={knownUsers} let:item>
    <Participant
        me={$machine.context.user?.userId === item.userId}
        userLookup={$machine.context.userLookup}
        participant={item}
        on:blockUser
        on:chatWith
        on:dismissAsAdmin={dismissAsAdmin}
        on:removeParticipant={removeParticipant}
        on:close={close} />
</VirtualList>
