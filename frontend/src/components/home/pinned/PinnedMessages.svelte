<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import type { GroupChatSummary } from "../../../domain/chat/chat";
    import { createEventDispatcher, onMount } from "svelte";
    import type { Readable } from "svelte/store";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { localPinned } from "../../../stores/pinned";
    import type { ServiceContainer } from "../../../services/serviceContainer";

    export let chatId: string;
    export let api: ServiceContainer;

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    onMount(() => {
        api.getMessages(chatId, $localPinned[chatId] ?? new Set());
    });
</script>

<SectionHeader>
    <h4>{$_("pinnedMessages")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<style type="text/scss">
    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
    }
    .close {
        flex: 0 0 30px;
    }
</style>
