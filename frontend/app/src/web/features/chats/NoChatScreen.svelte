<!-- The middle with nothing selected (region "empty"): beside a chat list with no chat to open yet
     (the router opens its default chat once it has one, ROUTES.md decision 7), the activity feed
     (/notifications) or the threads. Its words are the old desktop's (`noChatSelectedText`), by the
     list's scope, and only beside a chat list with chats (`middleWithoutChatText`); otherwise it's
     blank. The toolbar keeps Back and the panel toggle, which no header gives here.
     TODO(design): ROUTES.md names an `EmptyState` here; the design doesn't say which words, icon or
     action, nor what shows beside the activity feed. -->
<script lang="ts">
    import { chatSummariesListStore } from "@client";
    import { interpolate } from "@i18n/i18n";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import { middleWithoutChatText } from "@src/logic/chats/noChatSelected";
    import { _ } from "svelte-i18n";
    import MiddleToolbar from "../app/MiddleToolbar.svelte";
    import type { MiddleRegion, ScreenProps } from "../app/screens";

    let { region, context }: ScreenProps<Extract<MiddleRegion, { kind: "empty" }>> = $props();

    const text = $derived(
        middleWithoutChatText(region.chatList, $chatSummariesListStore.length > 0),
    );
</script>

<div class="no-chat">
    <MiddleToolbar {context} />
    {#if text !== undefined}
        <EmptyState
            title={interpolate($_, text.title)}
            body={interpolate($_, text.body)}
            actionLabel="" />
    {/if}
</div>

<style lang="scss">
    .no-chat {
        position: relative;
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>
