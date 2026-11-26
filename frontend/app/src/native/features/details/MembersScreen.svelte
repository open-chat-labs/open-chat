<!-- A group's or channel's members (native plan 10), pushed from its details: Members for the
     selected chat, held while the screen slides out. -->
<script lang="ts">
    import { chatIdentifiersEqual, selectedChatSummaryStore, type MultiUserChat } from "@client";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import { HeldWhileLeaving } from "../conversation/heldWhileLeaving";
    import Members from "./Members.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "chat_members" }>> =
        $props();

    // the chat is the selected one (the details' and the conversation's), held while it slides out
    const selected = $derived(
        $selectedChatSummaryStore !== undefined &&
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

<Members target={chat} {context} />
