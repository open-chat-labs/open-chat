<!-- Sharing today's daily puzzle result into a chat (?chit=share:<gameId>, #10236): ChatPicker in the
     puzzle dialog's place over the same backdrop, its back arrow returning to the puzzle, listing
     the chats the user can send text in (SharePicker), the open one included (the user's decision
     of 2026-11-23, as the old desktop picker offered it). Picking one opens it, and its
     conversation takes the result card into its draft with the message written here as its text
     (sharedToChatStore, MessageArea): asking first in place of a staged transfer, prize or swap
     offer, and starting its composer again from the text, so it lands the same in the chat open
     already. Nothing is sent until the user sends it, as the old trees' share
     (SlidingModals.shareDailyResultToChat). The card is made from what the store holds for the
     game (shareableResultCard): a link to it with no result to share (not solved, solved too
     quickly to share, another day's) opens the puzzle in its place. -->
<script lang="ts">
    import {
        chatListScopeStore,
        currentUserIdStore,
        dailyPuzzleStore,
        routeForChatIdentifier,
        sharedToChatStore,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import ChatPicker from "@openchat/ui/src/lib/components/ChatPicker.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { interpolateNewUi } from "@src/i18n/i18n";
    import { shareableResultCard } from "@src/logic/dailyPuzzle/dailyResultCard";
    import { navigate, replaceQuery } from "@src/utils/navigation";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { openLinkedDialog, type DialogProps, type LinkedDialog } from "../app/dialogs";
    import { canGoBack, goBack } from "../app/linkedDialogs.svelte";
    import { SharePicker } from "../share/sharePicker.svelte";
    import { shareItem } from "./puzzle.adapter";

    let { dialog, onClose }: DialogProps<Extract<LinkedDialog, { kind: "puzzle_share" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    // every chat the user can send in, the open one too
    // svelte-ignore state_referenced_locally
    const picker = new SharePicker(client, $_, () => undefined);

    // today's puzzles are known once a fetch has come back (a reload or a link lands before the
    // poll's first), as the puzzle dialog waits for them
    let fetched = $state(false);
    onMount(async () => {
        if ($dailyPuzzleStore.lastFetched !== undefined) return;
        try {
            await client.dailyPuzzleFetch();
        } finally {
            fetched = true;
        }
    });
    const ready = $derived(fetched || $dailyPuzzleStore.lastFetched !== undefined);
    const card = $derived(shareableResultCard($dailyPuzzleStore, dialog.gameId, $currentUserIdStore));

    // nothing to share: the puzzle instead, in this dialog's place
    $effect(() => {
        if (!ready || card !== undefined) return;
        const query = openLinkedDialog(new URLSearchParams(window.location.search), {
            kind: "puzzle",
            gameId: dialog.gameId,
        });
        if (query !== undefined) replaceQuery(`${window.location.pathname}${query}`);
    });

    const item = $derived(
        card === undefined
            ? null
            : shareItem(card, (key: ResourceKey) => interpolateNewUi($_, key)),
    );

    // opened from the puzzle: its back arrow returns to it in its place
    const back = $derived(canGoBack() ? goBack : undefined);

    function pick({ chatId, message }: { chatId: string; message: string }) {
        const id = picker.chatId(chatId);
        if (id === undefined || card === undefined) return;
        sharedToChatStore.set({ chatId: id, attachment: card, text: message });
        navigate(routeForChatIdentifier($chatListScopeStore.kind, id));
    }
</script>

{#if card !== undefined}
    <ChatPicker
        title={$_("dailyPuzzle.share")}
        {item}
        chats={picker.chats()}
        filter={(query) => picker.search(query)}
        sendLabel="ui.common.continue"
        onSend={pick}
        onBack={back}
        {onClose} />
{:else}
    <!-- till today's puzzles are known, then the puzzle in its place -->
    <DialogShell title={$_("dailyPuzzle.share")} width={460} height="auto" onBack={back} {onClose}>
        <div class="loading"><Spinner /></div>
    </DialogShell>
{/if}

<style lang="scss">
    .loading {
        display: grid;
        place-items: center;
        min-height: 200px;
    }
</style>
