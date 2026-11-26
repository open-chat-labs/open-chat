<!-- Invite people for a group or channel (native plan 10), pushed from its details (its Invite tile)
     and its Members screen: InvitePeople for the selected chat, held while the screen slides out. -->
<script lang="ts">
    import { chatIdentifiersEqual, selectedChatSummaryStore, type MultiUserChat } from "@client";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import { HeldWhileLeaving } from "../conversation/heldWhileLeaving";
    import InvitePeople from "./InvitePeople.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "invite_people" }>> =
        $props();

    // the chat is the selected one (the details'), held while the screen slides out
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

<InvitePeople target={chat} {context} />
