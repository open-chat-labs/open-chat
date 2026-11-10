<!-- A chat's details (native plan 10, Design Notes §3.6), pushed over its conversation from the
     header's title and the menu's details item, without a URL of its own (as the web opens its
     right panel): a DM's (DmDetails) or a group's or channel's (GroupDetails). The chat is the
     selected one, held while the screen slides out once it isn't (leaving it, deleting it). -->
<script lang="ts">
    import {
        chatIdentifiersEqual,
        selectedChatSummaryStore,
        type ChatSummary,
    } from "@client";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import { HeldWhileLeaving } from "../conversation/heldWhileLeaving";
    import DmDetails from "./DmDetails.svelte";
    import GroupDetails from "./GroupDetails.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "chat_details" }>> =
        $props();

    const selected = $derived(
        $selectedChatSummaryStore !== undefined &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, screen.chatId),
    );
    const held = new HeldWhileLeaving<ChatSummary | undefined>(undefined);
    const chat = $derived(held.of(selected, $selectedChatSummaryStore));
</script>

<div class="details">
    {#if chat?.kind === "direct_chat"}
        <DmDetails {chat} {context} />
    {:else if chat !== undefined}
        <GroupDetails {chat} {context} />
    {:else}
        <!-- the chat isn't in yet (a moment after a cold start): Back stays -->
        <NativePageHeader title="" onBack={context.back} />
    {/if}
</div>

<style lang="scss">
    .details {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }
</style>
