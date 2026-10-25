<!-- The CHIT leaderboard (?hof), LeaderboardDialog over the page (8d, #10130): this month's, last
     month's and all time's top 10, as the old hall of fame shows them, the user's own place where
     they're on a board, and its Invaders game (core/invaders) behind the joystick, where this
     device can play it (8f). Opened from the CHIT dialog, its back arrow returns to it in its place
     over the same backdrop. -->
<script lang="ts">
    import {
        currentUserIdStore,
        currentUserStore,
        toMonthString,
        type ChitLeaderboardResponse,
        type OpenChat,
    } from "@client";
    import LeaderboardDialog from "@openchat/ui/src/features/components/LeaderboardDialog.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Invaders from "@src/core/invaders/Invaders.svelte";
    import { invadersSupported } from "@src/core/invaders/support";
    import { getContext, onMount } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { canGoBack, goBack } from "../app/linkedDialogs.svelte";
    import { leaderboardBoards } from "./chit.adapter";

    let { onClose }: DialogProps<Extract<LinkedDialog, { kind: "leaderboard" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the boards show, empty, until it loads
    let result = $state<ChitLeaderboardResponse>();
    onMount(async () => {
        try {
            result = await client.chitLeaderboard();
        } catch (err) {
            console.warn("Unable to load the CHIT leaderboard", err);
        }
    });

    const boards = $derived(
        leaderboardBoards(
            result,
            $currentUserIdStore,
            Date.now(),
            (date) => toMonthString(date, $locale ?? "en"),
            $_("halloffame.allTime"),
        ),
    );
</script>

<LeaderboardDialog
    {boards}
    handle={$currentUserStore.username}
    onBack={canGoBack() ? goBack : undefined}
    {onClose}
    game={invadersSupported() ? invaders : undefined} />

{#snippet invaders()}
    <Invaders fill>
        {#snippet start(play, again)}
            <!-- the library translates only its own ui.* keys and shows anything else as given -->
            <Button label={$_(again ? "halloffame.tryAgain" : "halloffame.start")} onClick={play} />
        {/snippet}
    </Invaders>
{/snippet}
