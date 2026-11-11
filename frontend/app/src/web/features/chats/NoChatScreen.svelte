<!-- The middle with nothing selected (region "empty"): a chat list with no chat to open yet (the
     router opens its default chat once it has one, ROUTES.md decision 7), or the notifications.
     The words are the old desktop's (`noChatSelectedText`), by the list's scope.
     TODO(design): ROUTES.md names an `EmptyState` here; the design doesn't say which words, icon or
     action. -->
<script lang="ts">
    import { chatListScopeStore } from "@client";
    import { interpolate } from "@i18n/i18n";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import { noChatSelectedText } from "@src/logic/chats/noChatSelected";
    import { _ } from "svelte-i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";

    // what every screen is given (screens.ts types it so); this one needs neither
    const props: ScreenProps<Extract<MiddleRegion, { kind: "empty" }>> = $props();
    void props;

    const text = $derived(noChatSelectedText($chatListScopeStore.kind));
</script>

<div class="no-chat">
    <EmptyState
        title={interpolate($_, text.title)}
        body={interpolate($_, text.body)}
        actionLabel="" />
</div>

<style lang="scss">
    .no-chat {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>
