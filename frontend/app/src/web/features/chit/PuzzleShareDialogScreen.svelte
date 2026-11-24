<!-- Sharing today's daily puzzle result into a chat (?chit=share:<gameId>, #10236): ChatPicker in the
     puzzle dialog's place over the same backdrop, its back arrow returning to the puzzle, listing
     the chats the user can send text in (SharePicker), the open one included (the user's decision
     of 2026-11-23, as the old desktop picker offered it). Picking one opens it, and its
     conversation takes the result card into its draft with the message written here as its text
     (sharedToChatStore, MessageArea), starting its composer again from the text, so it lands the
     same in the chat open already. In place of a transfer, prize or swap offer staged in that
     chat's draft, the composer's replace confirm (ReplaceStagedDialogScreen) takes the picker's
     place first, over the same backdrop: Replace shares, Cancel, × and the backdrop share
     nothing, and either way the chosen chat opens. Nothing is sent until the user sends it, as the old trees' share
     (SlidingModals.shareDailyResultToChat). The card is made from what the store holds for the
     game (shareableResultCard): a link to it with no result to share (not solved, solved too
     quickly to share, another day's) opens the puzzle in its place. -->
<script lang="ts">
    import {
        chatListScopeStore,
        currentUserIdStore,
        dailyPuzzleStore,
        routeForChatIdentifier,
        localUpdates,
        sharedToChatStore,
        type ChatIdentifier,
        type DailyResultContent,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import ChatPicker from "@openchat/ui/src/lib/components/ChatPicker.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { interpolateNewUi } from "@src/i18n/i18n";
    import { draftAttachment } from "@src/logic/composer/composer";
    import type { ReplaceQuestion } from "@src/logic/composer/replaceStaged";
    import { shareableResultCard } from "@src/logic/dailyPuzzle/dailyResultCard";
    import { shareStep } from "@src/logic/dailyPuzzle/shareResult";
    import { navigate, replaceQuery } from "@src/utils/navigation";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { openLinkedDialog, type DialogProps, type LinkedDialog } from "../app/dialogs";
    import { canGoBack, goBack } from "../app/linkedDialogs.svelte";
    import ReplaceStagedDialogScreen from "../conversation/ReplaceStagedDialogScreen.svelte";
    import { SharePicker } from "../share/sharePicker.svelte";
    import { shareItem } from "@src/logic/dailyPuzzle/puzzleCard";

    let {
        dialog,
        onClose,
        dialogs,
    }: DialogProps<Extract<LinkedDialog, { kind: "puzzle_share" }>> = $props();

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

    // in place of a transfer, prize or swap offer staged in the chosen chat's draft, the composer's
    // replace confirm (shareStep), in the picker's place over the same backdrop
    // (the card kept with it: Replace shares it once this screen has gone, its props with it)
    let asking = $state<{
        question: ReplaceQuestion;
        chatId: ChatIdentifier;
        card: DailyResultContent;
        text: string;
    }>();

    function pick({ chatId, message }: { chatId: string; message: string }) {
        const id = picker.chatId(chatId);
        if (id === undefined || card === undefined) return;
        const staged = draftAttachment(localUpdates.draftMessages.value.get({ chatId: id }));
        const step = shareStep(staged, { attachment: card });
        if (step.kind === "confirm") {
            asking = { question: step.question, chatId: id, card, text: message };
            return;
        }
        share(id, card, message);
        go(id);
    }

    // the chosen chat's conversation takes it into the draft (MessageArea), as it opens or at once
    function share(chatId: ChatIdentifier, attachment: DailyResultContent, text: string) {
        sharedToChatStore.set({ chatId, attachment, text });
    }

    // the chosen chat, the dialogs closed
    function go(chatId: ChatIdentifier) {
        navigate(routeForChatIdentifier($chatListScopeStore.kind, chatId));
    }
</script>

{#if asking !== undefined}
    {@const chosen = asking}
    <!-- Replace takes the share there; Cancel, × and the backdrop keep the payment and take
         nothing, and either way the chosen chat opens (the user's decision of 2026-11-23) -->
    <ReplaceStagedDialogScreen
        dialog={{
            kind: "replace_staged",
            question: chosen.question,
            next: { kind: "attach", attach: () => share(chosen.chatId, chosen.card, chosen.text) },
        }}
        onClose={() => go(chosen.chatId)}
        {dialogs} />
{:else if card !== undefined}
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
