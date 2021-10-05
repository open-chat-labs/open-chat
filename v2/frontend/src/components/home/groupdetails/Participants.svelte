<script lang="ts">
    import Participant from "./Participant.svelte";
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import type { ActorRefFrom } from "xstate";
    import VirtualList from "../../VirtualList.svelte";
    import type { FullParticipant } from "../../../domain/chat/chat";
    import type { EditGroupMachine } from "../../../fsm/editgroup.machine";
    import { userStore } from "../../../stores/user";

    export let machine: ActorRefFrom<EditGroupMachine>;

    function close() {
        machine.send({ type: "HIDE_PARTICIPANTS" });
    }

    function addParticipants() {
        machine.send({ type: "ADD_PARTICIPANT" });
    }

    $: knownUsers =
        $machine.context.chatSummary.kind === "group_chat"
            ? $machine.context.chatSummary.participants.reduce<FullParticipant[]>((users, p) => {
                  const user = $userStore[p.userId];
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

    $: closeIcon = ($machine.context.history.length <= 1 ? "close" : "back") as "close" | "back";

    function dismissAsAdmin(ev: CustomEvent<string>): void {
        machine.send({ type: "DISMISS_AS_ADMIN", data: ev.detail });
    }

    function makeAdmin(ev: CustomEvent<string>): void {
        machine.send({ type: "MAKE_ADMIN", data: ev.detail });
    }

    function removeParticipant(ev: CustomEvent<string>): void {
        machine.send({ type: "REMOVE_PARTICIPANT", data: ev.detail });
    }
</script>

<ParticipantsHeader
    {closeIcon}
    {publicGroup}
    {me}
    on:close={close}
    on:addParticipants={addParticipants} />

{#if me !== undefined}
    <Participant me={true} participant={me} myRole={me.role} on:blockUser on:chatWith />
{/if}

<VirtualList keyFn={(user) => user.userId} items={others} let:item>
    <Participant
        me={false}
        participant={item}
        myRole={me?.role ?? "standard"}
        on:blockUser
        on:chatWith
        on:dismissAsAdmin={dismissAsAdmin}
        on:makeAdmin={makeAdmin}
        on:removeParticipant={removeParticipant}
        on:close={close} />
</VirtualList>
