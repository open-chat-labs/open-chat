<script lang="ts">
    import { _ } from "svelte-i18n";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import type { ChatIdentifier } from "openchat-client";
    import { popRightPanelHistory, rightPanelHistory } from "../../../stores/rightPanel";
    import { activeVideoCall } from "../../../stores/video";
    import { iconSize } from "../../../stores/iconSize";

    export let chatId: ChatIdentifier;
    export let messageIndex: number;

    $: participantsOpen = $activeVideoCall?.participantsOpen ?? false;

    function toggleParticipants() {
        if (participantsOpen) {
            popRightPanelHistory();
        } else {
            rightPanelHistory.set([
                {
                    kind: "call_participants_panel",
                    chatId,
                    messageIndex,
                },
            ]);
        }
        activeVideoCall.participantsOpen(!participantsOpen);
    }
</script>

<HoverIcon title={$_("videoCall.showParticipants")} on:click={toggleParticipants}>
    <AccountMultiple
        size={$iconSize}
        color={participantsOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
</HoverIcon>
