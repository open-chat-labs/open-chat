<script lang="ts">
    import type { ChatIdentifier } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ActiveCallParticipantsHeader from "./ActiveCallParticipantsHeader.svelte";
    import { createEventDispatcher } from "svelte";
    import { popRightPanelHistory } from "../../../stores/rightPanel";
    import { activeVideoCall } from "../../../stores/video";

    export let chatId: ChatIdentifier;
    export let messageIndex: number;

    const dispatch = createEventDispatcher();

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
