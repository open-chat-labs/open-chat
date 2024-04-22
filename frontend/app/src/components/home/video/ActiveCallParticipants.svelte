<script lang="ts">
    import type { MultiUserChatIdentifier, OpenChat, UserSummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ActiveCallParticipantsHeader from "./ActiveCallParticipantsHeader.svelte";
    import ActiveCallParticipant from "./ActiveCallParticipant.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { popRightPanelHistory } from "../../../stores/rightPanel";
    import { activeVideoCall } from "../../../stores/video";
    import VirtualList from "../../VirtualList.svelte";

    type MappedParticipants = {
        participants: UserSummary[];
        hidden: UserSummary[];
        lastUpdated: bigint;
    };

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let chatId: MultiUserChatIdentifier;
    export let messageId: bigint;
    export let isOwner: boolean;

    let updatesSince = 0n;
    let videoParticipants: MappedParticipants = {
        participants: [],
        hidden: [],
        lastUpdated: 0n,
    };

    onMount(refresh);

    // TODO figure out how to get this to react and get called at the right interval. Probably the best way would be to use the Daily
    // participant updated event but that might cause some sort of race condition and not be 100% reliable
    function refresh() {
        client.videoCallParticipants(chatId, messageId, updatesSince).then((res) => {
            videoParticipants = res;
            console.log("VideoCallParticipants: ", videoParticipants);
            updatesSince = BigInt(Date.now());
        });
    }

    function close() {
        dispatch("close");
        activeVideoCall.participantsOpen(false);
        popRightPanelHistory();
    }
</script>

<ActiveCallParticipantsHeader on:close={close} />

{#each videoParticipants.participants as participant}
    <ActiveCallParticipant {isOwner} presence={"default"} {participant} />
{/each}

<VirtualList keyFn={(user) => user.userId} items={videoParticipants.hidden} let:item>
    <ActiveCallParticipant isOwner={false} presence={"hidden"} participant={item} />
</VirtualList>

<style lang="scss">
</style>
