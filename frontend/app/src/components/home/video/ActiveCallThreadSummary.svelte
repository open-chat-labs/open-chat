<script lang="ts">
    import { _ } from "svelte-i18n";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import type { ChatIdentifier, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { popRightPanelHistory } from "../../../stores/rightPanel";
    import { removeQueryStringParam } from "../../../utils/urls";
    import { activeVideoCall } from "../../../stores/video";
    import { iconSize } from "../../../stores/iconSize";
    import { pageReplace } from "../../../routes";

    export let chatId: ChatIdentifier;
    export let messageIndex: number;

    const client = getContext<OpenChat>("client");

    $: threadOpen = $activeVideoCall?.threadOpen ?? false;

    function toggleThread() {
        if (threadOpen) {
            popRightPanelHistory();
            pageReplace(removeQueryStringParam("open"));
        } else {
            client.openThreadFromMessageIndex(chatId, messageIndex);
        }
        activeVideoCall.threadOpen(!threadOpen);
    }
</script>

<HoverIcon title={$_("videoCall.chat")} on:click={toggleThread}>
    <MessageOutline
        size={$iconSize}
        color={threadOpen ? "var(--icon-selected)" : "var(--icon-txt)"} />
</HoverIcon>
