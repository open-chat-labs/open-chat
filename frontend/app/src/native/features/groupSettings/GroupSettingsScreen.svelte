<!-- A group's or channel's settings page (native plan 11), pushed from its details without a URL:
     Edit group from the cover, and Manage's Access gates, Rules and Permissions (Bots and webhooks
     and Stats aren't built: GAPS.md). The chat is the selected one, held while the screen slides
     out once it isn't; its page is GroupSettingsEditor's, mounted once the chat is in. -->
<script lang="ts">
    import {
        chatIdentifiersEqual,
        selectedChatSummaryStore,
        type MultiUserChat,
    } from "@client";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import Placeholder from "../app/Placeholder.svelte";
    import { HeldWhileLeaving } from "../conversation/heldWhileLeaving";
    import GroupSettingsEditor from "./GroupSettingsEditor.svelte";
    import { pageTitle } from "./settings.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "group_settings" }>> =
        $props();

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    const selected = $derived(
        $selectedChatSummaryStore !== undefined &&
            $selectedChatSummaryStore.kind !== "direct_chat" &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, screen.chatId),
    );
    const held = new HeldWhileLeaving<MultiUserChat | undefined>(undefined);
    const chat = $derived(
        held.of(
            selected,
            $selectedChatSummaryStore?.kind === "direct_chat" ? undefined : $selectedChatSummaryStore,
        ),
    );
</script>

<div class="group-settings">
    {#if screen.page === "bots" || screen.page === "stats"}
        <!-- not built yet (GAPS.md, "Native group settings") -->
        <Placeholder
            title={pageTitle(screen.page, false, t)}
            detail="N7 left this page for later (GAPS.md)"
            root={false}
            back={context.back}
            links={[]} />
    {:else if chat !== undefined}
        <GroupSettingsEditor {chat} page={screen.page} {context} />
    {:else}
        <!-- the chat isn't in yet (a moment after a cold start): Back stays -->
        <NativePageHeader title="" onBack={context.back} />
    {/if}
</div>

<style lang="scss">
    .group-settings {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }
</style>
