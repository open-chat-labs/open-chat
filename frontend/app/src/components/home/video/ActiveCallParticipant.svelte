<script lang="ts">
    import AccountCancel from "svelte-material-icons/AccountCancel.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import type { UserSummary, VideoCallPresence, VideoCallType } from "openchat-shared";
    import User from "../../home/groupdetails/User.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let participant: UserSummary;
    export let presence: VideoCallPresence;
    export let isOwner: boolean;
    export let callType: VideoCallType;

    $: showMenu = isOwner && presence === "default" && callType === "broadcast";

    function demote() {
        dispatch("demote", participant.userId);
    }
</script>

<User user={participant}>
    {#if showMenu}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div on:click|stopPropagation={demote}>
            <HoverIcon title={$_("videoCall.demoteToHidden")}>
                <AccountCancel size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
    {/if}
</User>
