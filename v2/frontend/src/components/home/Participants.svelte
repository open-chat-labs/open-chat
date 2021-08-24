<script lang="ts">
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import Participant from "./Participant.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { ParticipantsMachine } from "../../fsm/participants.machine";
    import VirtualList from "../VirtualList.svelte";
    import type { FullParticipant } from "../../domain/chat/chat";

    export let machine: ActorRefFrom<ParticipantsMachine>;

    function close() {
        machine.send({ type: "HIDE_PARTICIPANTS" });
    }

    function addParticipant() {
        machine.send({ type: "ADD_PARTICIPANT" });
    }

    $: knownUsers =
        $machine.context.chatSummary.kind === "group_chat"
            ? $machine.context.chatSummary.participants.reduce<FullParticipant[]>((users, p) => {
                  const user = $machine.context.userLookup[p.userId];
                  if (user) {
                      users.push({
                          ...user,
                          ...p,
                      });
                  }
                  return users;
              }, [])
            : [];

    $: me = knownUsers.find((u) => u.userId === $machine.context.user!.userId);

    $: others = knownUsers.filter((u) => u.userId !== $machine.context.user!.userId);

    $: publicGroup =
        $machine.context.chatSummary.kind === "group_chat" && $machine.context.chatSummary.public;

    function dismissAsAdmin(ev: CustomEvent<string>): void {
        machine.send({ type: "DISMISS_AS_ADMIN", data: ev.detail });
    }

    function removeParticipant(ev: CustomEvent<string>): void {
        machine.send({ type: "REMOVE_PARTICIPANT", data: ev.detail });
    }
</script>

<ParticipantsHeader {publicGroup} {me} on:close={close} on:addParticipant={addParticipant} />

{#if me !== undefined}
    <Participant
        me={true}
        userLookup={$machine.context.userLookup}
        participant={me}
        myRole={me.role}
        on:blockUser
        on:chatWith />
{/if}

<VirtualList keyFn={(user) => user.userId} items={others} let:item>
    <Participant
        me={false}
        userLookup={$machine.context.userLookup}
        participant={item}
        myRole={me?.role ?? "standard"}
        on:blockUser
        on:chatWith
        on:dismissAsAdmin={dismissAsAdmin}
        on:removeParticipant={removeParticipant}
        on:close={close} />
</VirtualList>
