<script lang="ts">
    import { IconButton } from "component-lib";
    import type { UserSummary, VideoCallPresence, VideoCallType } from "openchat-shared";
    import AccountCancel from "svelte-material-icons/AccountCancel.svelte";
    import User from "../User.svelte";

    interface Props {
        participant: UserSummary;
        presence: VideoCallPresence;
        isOwner: boolean;
        callType: VideoCallType;
        onDemote?: (userId: string) => void;
    }

    let { participant, presence, isOwner, callType, onDemote }: Props = $props();

    let showMenu = $derived(isOwner && presence === "default" && callType === "broadcast");

    function demote(e?: Event) {
        e?.stopPropagation();
        onDemote?.(participant.userId);
    }
</script>

{#snippet action()}
    <IconButton onclick={demote}>
        {#snippet icon(color)}
            <AccountCancel {color} />
        {/snippet}
    </IconButton>
{/snippet}

<User action={showMenu ? action : undefined} user={participant}></User>
