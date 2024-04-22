<script lang="ts">
    import MicrophoneOff from "svelte-material-icons/MicrophoneOff.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import type { UserSummary, VideoCallPresence } from "openchat-shared";
    import User from "../../home/groupdetails/User.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let participant: UserSummary;
    export let presence: VideoCallPresence;
    export let isOwner: boolean;

    $: showMenu = isOwner && presence === "default";

    function demote() {
        dispatch("demote", participant.userId);
    }
</script>

<User user={participant}>
    {#if showMenu}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div on:click|stopPropagation={demote}>
            <HoverIcon>
                <MicrophoneOff size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
    {/if}
</User>
