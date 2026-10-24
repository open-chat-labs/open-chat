<!-- The CHIT leaderboard (?hof), LeaderboardDialog over the page (8d, #10130): this month's, last
     month's and all time's top 10, as the old hall of fame shows them (its Invaders game isn't
     carried over), the user's own place where they're on a board. Back returns to the CHIT dialog
     in its place over the same backdrop when it opened this one, else closes. -->
<script lang="ts">
    import {
        currentUserIdStore,
        currentUserStore,
        toMonthString,
        type ChitLeaderboardResponse,
        type OpenChat,
    } from "@client";
    import LeaderboardDialog from "@openchat/ui/src/features/components/LeaderboardDialog.svelte";
    import { getContext, onMount } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { backToLinked, openedFrom } from "../app/linkedDialogs";
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
    onBack={() => (openedFrom({ kind: "chit" }) ? backToLinked({ kind: "chit" }) : onClose())}
    {onClose} />
