<script lang="ts">
    import { iconSize } from "openchat-client";
    import type { UserSummary, VideoCallPresence, VideoCallType } from "openchat-shared";
    import { _ } from "svelte-i18n";
    import AccountCancel from "svelte-material-icons/AccountCancel.svelte";
    import User from "../../home/groupdetails/User.svelte";
    import HoverIcon from "../../HoverIcon.svelte";

    interface Props {
        participant: UserSummary;
        presence: VideoCallPresence;
        isOwner: boolean;
        callType: VideoCallType;
        onDemote?: (userId: string) => void;
    }

    let { participant, presence, isOwner, callType, onDemote }: Props = $props();

    let showMenu = $derived(isOwner && presence === "default" && callType === "broadcast");

    function demote(e: Event) {
        e.stopPropagation();
        onDemote?.(participant.userId);
    }
</script>

<User user={participant}>
    {#if showMenu}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={demote}>
            <HoverIcon title={$_("videoCall.demoteToHidden")}>
                <AccountCancel size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
    {/if}
</User>
