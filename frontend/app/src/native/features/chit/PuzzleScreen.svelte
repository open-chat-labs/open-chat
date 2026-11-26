<!-- Today's daily puzzle as its own screen (native plan 14, design notes §3.10), pushed from CHIT's
     puzzle row and a result card's Play: the header (Back, the puzzle's number over its game and
     tier, or "How Bridges works" over the number while the tutorial shows, and "How to play")
     over a play session (PuzzlePlay). It waits for today's puzzles to load (a
     link can land before the first fetch), says so when there's none, and makes a new session for
     another game. Share to chat opens the chat sheet (PuzzleShareSheet) over it: the chat picked
     takes the result card into its draft (sharedToChatStore, as the web's share; the conversation
     takes it) and opens, asking first in place of a staged payment (shareStep); nothing is sent
     until the user sends it. The design's PuzzleDialog (layout="screen") plays Bridges only, so
     it isn't used, as on the web (GAPS.md, "Native CHIT"). -->
<script lang="ts">
    import {
        chatListScopeStore,
        currentUserIdStore,
        dailyPuzzleStore,
        localUpdates,
        routeForChatIdentifier,
        sharedToChatStore,
        type ChatIdentifier,
        type DailyResultContent,
        type OpenChat,
        type PublicDailyPuzzle,
        type ResourceKey,
    } from "@client";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import type { NativeHeaderAction } from "@openchat/ui/src/native/types";
    import { openablePuzzle } from "@src/core/dailyPuzzle/registry";
    import { interpolateNewUi } from "@src/i18n/i18n";
    import { draftAttachment } from "@src/logic/composer/composer";
    import { replaceQuestionText, type ReplaceQuestion } from "@src/logic/composer/replaceStaged";
    import { shareableResultCard } from "@src/logic/dailyPuzzle/dailyResultCard";
    import { puzzleHeading, shareItem } from "@src/logic/dailyPuzzle/puzzleCard";
    import { shareStep } from "@src/logic/dailyPuzzle/shareResult";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import PuzzlePlay from "./PuzzlePlay.svelte";
    import PuzzleShareSheet from "./PuzzleShareSheet.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "daily_puzzle" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    const tr = (key: ResourceKey) => interpolateNewUi($_, key);
    const overlays = untrack(() => context.overlays);

    // today's puzzles are known once a fetch has come back: the poll's, or this one's
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
    const available = $derived(
        ready && openablePuzzle($dailyPuzzleStore, screen.gameId) !== undefined,
    );

    // the puzzle the session plays, as it reports it, and its tutorial's toggle
    let playing = $state<PublicDailyPuzzle>();
    let howToPlay = $state<() => void>();
    let tutorial = $state(false);
    const heading = $derived(puzzleHeading(available ? playing : undefined, tutorial, tr));
    const actions = $derived<NativeHeaderAction[]>(
        howToPlay === undefined || tutorial
            ? []
            : [{ icon: "info", label: $_("dailyPuzzle.howToPlay"), onClick: () => howToPlay?.() }],
    );

    // ---- Share to chat

    let sharing = $state<{ gameId: string; card: DailyResultContent }>();
    let asking = $state<{
        question: ReplaceQuestion;
        chatId: ChatIdentifier;
        card: DailyResultContent;
    }>();
    useOverlay(
        overlays,
        () => sharing !== undefined,
        () => (sharing = undefined),
    );
    useOverlay(
        overlays,
        () => asking !== undefined,
        () => (asking = undefined),
    );

    function share(gameId: string) {
        const card = shareableResultCard($dailyPuzzleStore, gameId, $currentUserIdStore);
        if (card !== undefined) sharing = { gameId, card };
    }

    function pick(chatId: ChatIdentifier) {
        const chosen = sharing;
        if (chosen === undefined) return;
        sharing = undefined;
        const staged = draftAttachment(localUpdates.draftMessages.value.get({ chatId }));
        const step = shareStep(staged, { attachment: chosen.card });
        if (step.kind === "confirm") {
            asking = { question: step.question, chatId, card: chosen.card };
            return;
        }
        shareInto(chatId, chosen.card);
    }

    // the chosen chat's conversation takes it into the draft as it opens
    function shareInto(chatId: ChatIdentifier, card: DailyResultContent) {
        sharedToChatStore.set({ chatId, attachment: card, text: "" });
        go(chatId);
    }

    function go(chatId: ChatIdentifier) {
        navigate(routeForChatIdentifier($chatListScopeStore.kind, chatId));
    }

    const askingText = $derived(
        asking === undefined ? undefined : replaceQuestionText(asking.question),
    );
</script>

<div class="puzzle">
    <NativePageHeader title={heading.title} sub={heading.sub} onBack={context.back} {actions} />

    {#if available}
        {#key screen.gameId ?? ""}
            <PuzzlePlay
                gameId={screen.gameId}
                onFailure={(message) => context.toast(message)}
                onPuzzle={(puzzle, toggle, showingTutorial) => {
                    playing = puzzle;
                    howToPlay = toggle;
                    tutorial = showingTutorial;
                }}
                onShare={share}
                onDone={() => context.back?.()} />
        {/key}
    {:else if ready}
        <p class="text">{$_("dailyPuzzle.unavailable")}</p>
    {:else}
        <!-- till today's puzzles are known -->
        <div class="loading"><Spinner /></div>
    {/if}
</div>

<PuzzleShareSheet
    open={sharing !== undefined}
    item={sharing === undefined ? undefined : shareItem(sharing.card, tr)}
    onClose={() => (sharing = undefined)}
    onPick={pick} />

<!-- in place of a transfer, prize or swap offer staged in the chosen chat's draft: Replace shares,
     Cancel keeps it, and either way the chosen chat opens (the web's) -->
<NativeAlert
    open={asking !== undefined}
    title={askingText === undefined ? "" : tr(askingText.title)}
    message={askingText === undefined ? "" : tr(askingText.message)}
    confirmLabel={$_("builders.replace.confirm")}
    onConfirm={() => {
        const chosen = asking;
        asking = undefined;
        if (chosen !== undefined) shareInto(chosen.chatId, chosen.card);
    }}
    onClose={() => {
        const chosen = asking;
        asking = undefined;
        if (chosen !== undefined) go(chosen.chatId);
    }} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .puzzle {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .text {
        flex: 1;
        display: grid;
        place-items: center;
        margin: 0;
        padding: 0 var(--space-24);
        text-align: center;
        font: var(--weight-regular) text-size(14.5px) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .loading {
        flex: 1;
        display: grid;
        place-items: center;
    }
</style>
