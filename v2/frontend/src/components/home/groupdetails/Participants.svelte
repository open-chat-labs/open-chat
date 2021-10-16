<script lang="ts">
    import Participant from "./Participant.svelte";
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import type { FullParticipant, GroupChatSummary } from "../../../domain/chat/chat";
    import { userStore } from "../../../stores/user";
    import { createEventDispatcher } from "svelte";

    export let chat: GroupChatSummary;
    export let userId: string;
    export let closeIcon: "close" | "back";

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    function addParticipants() {
        dispatch("addParticipants");
    }

    $: knownUsers = chat.participants.reduce<FullParticipant[]>((users, p) => {
        const user = $userStore[p.userId];
        if (user) {
            users.push({
                ...user,
                ...p,
            });
        }
        return users;
    }, []);

    $: me = knownUsers.find((u) => u.userId === userId);

    $: others = knownUsers.filter((u) => u.userId !== userId);

    $: publicGroup = chat.public;
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
        on:dismissAsAdmin
        on:makeAdmin
        on:removeParticipant
        on:close={close} />
</VirtualList>
