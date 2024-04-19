<script lang="ts">
    import type { MultiUserChatIdentifier, OpenChat, VideoCallParticipants } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ActiveCallParticipantsHeader from "./ActiveCallParticipantsHeader.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { popRightPanelHistory } from "../../../stores/rightPanel";
    import { activeVideoCall } from "../../../stores/video";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let chatId: MultiUserChatIdentifier;
    export let messageId: bigint;

    let updatesSince = 0n;
    let videoParticipants: VideoCallParticipants = {
        participants: [],
        hidden: [],
        lastUpdated: 0n,
    };

    onMount(refresh);

    function refresh() {
        client.videoCallParticipants(chatId, messageId, updatesSince).then((res) => {
            videoParticipants = res;
            updatesSince = BigInt(Date.now());
            console.log("VideoParticants: ", videoParticipants);
        });
    }

    function close() {
        dispatch("close");
        activeVideoCall.participantsOpen(false);
        popRightPanelHistory();
    }
</script>

<ActiveCallParticipantsHeader on:close={close} />

<!-- <VirtualList bind:this={membersList} keyFn={(user) => user.userId} items={fullMembers} let:item>
        <Member
            me={false}
            member={item}
            canPromoteToOwner={client.canPromote(collection.id, item.role, "owner")}
            canPromoteToAdmin={client.canPromote(collection.id, item.role, "admin")}
            canDemoteToAdmin={client.canDemote(collection.id, item.role, "admin")}
            canPromoteToModerator={client.canPromote(collection.id, item.role, "moderator")}
            canDemoteToModerator={client.canDemote(collection.id, item.role, "moderator")}
            canDemoteToMember={client.canDemote(collection.id, item.role, "member")}
            canBlockUser={client.canBlockUsers(collection.id)}
            canRemoveMember={client.canRemoveMembers(collection.id)}
            {searchTerm}
            on:blockUser
            on:chatWith
            on:changeRole
            on:removeMember />
    </VirtualList> -->

<style lang="scss">
</style>
