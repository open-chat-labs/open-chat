<!-- Daily puzzle (#9368): the kill switch on its card's title line, saved as it's flipped (pushed to
     every local user index at once), and regenerating today's puzzle as scheduled or as a game
     this build can draw. Shown once the config is read. -->
<script lang="ts">
    import type { ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import SelectInput from "@openchat/ui/src/lib/components/SelectInput.svelte";
    import SettingsCard from "@openchat/ui/src/lib/components/SettingsCard.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import { dailyPuzzleGames } from "@src/core/dailyPuzzle/registry";
    import { regenerateOptions } from "@src/utils/dailyPuzzleOperator";
    import { onMount } from "svelte";
    import type { AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
        translate: (key: ResourceKey) => string;
    }

    let { admin, translate }: Props = $props();

    const puzzle = $derived(admin.puzzle);
    onMount(async () => admin.outcomes.record("puzzleEnabled", await puzzle.refresh()));

    // "Game: as scheduled", as there's no label over it
    const options = regenerateOptions(Object.keys(dailyPuzzleGames)).map((o) => ({
        value: o.value,
        label: `Game: ${o.value === "" ? "as scheduled" : o.label}`,
    }));

    // The switch applies as it's flipped, so it shows what's set: a save that failed puts it back
    // to the config (a success has read the config again already)
    async function setEnabled(on: boolean): Promise<void> {
        puzzle.enabled = on;
        await puzzle.saveEnabled((o) => admin.outcomes.record("puzzleEnabled", o));
        if (puzzle.config !== undefined) puzzle.enabled = puzzle.config.enabled;
    }
</script>

{#if puzzle.config === undefined}
    {#if admin.outcomes.of("puzzleEnabled") === undefined}
        <p class="loading">Reading the daily puzzle’s config…</p>
    {:else}
        <SettingsCard
            title="Daily puzzle"
            icon="joystick"
            outcome={admin.cardOutcome("puzzleEnabled", false, translate)} />
    {/if}
{:else}
    <SettingsCard
        title="Daily puzzle enabled"
        help="Saving pushes to every local user index at once; off is the kill switch."
        icon="joystick"
        tag={puzzle.config.enabled ? "On" : "Off"}
        tagTone={puzzle.config.enabled ? "success" : "neutral"}
        outcome={admin.cardOutcome(
            "puzzleEnabled",
            puzzle.busy.has("enabled"),
            translate,
            "Saving…",
        )}>
        {#snippet aside()}
            <Toggle
                on={puzzle.enabled}
                ariaLabel="Daily puzzle enabled"
                disabled={puzzle.busy.has("enabled")}
                onChange={(on) => void setEnabled(on)} />
        {/snippet}
    </SettingsCard>

    <SettingsCard
        title="Regenerate today"
        help="Drops today’s puzzle and generates another. Anyone mid-game restarts the replacement from scratch; nobody is charged a second entry fee or paid a second reward, and streaks are untouched. For a bad puzzle, not routine use."
        icon="refresh"
        outcome={admin.cardOutcome(
            "regenerate",
            puzzle.busy.has("regenerate"),
            translate,
            "Regenerating…",
        )}>
        <SelectInput
            value={puzzle.regenerateGameId}
            {options}
            ariaLabel="Game"
            onChange={(v) => (puzzle.regenerateGameId = v)} />
        {#snippet actions()}
            <Button
                label="Regenerate"
                variant="danger"
                busy={puzzle.busy.has("regenerate")}
                disabled={puzzle.busy.has("regenerate")}
                onClick={() =>
                    void puzzle.regenerateToday((o) => admin.outcomes.record("regenerate", o))} />
        {/snippet}
    </SettingsCard>
{/if}

<style lang="scss">
    .loading {
        margin: 0;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }
</style>
