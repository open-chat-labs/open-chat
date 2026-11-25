<!-- The daily puzzle's levers, inside Operator functions as in the old console (#9368): the kill
     switch, and regenerating today's puzzle as scheduled or as a game this build can draw (the old
     `DailyPuzzleOperator`). Shown once the config is read. TODO(design): no design. -->
<script lang="ts">
    import type { ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import type { DailyPuzzleOperator } from "@src/logic/admin/dailyPuzzleOperator.svelte";
    import type { RegenerateOption } from "@src/utils/dailyPuzzleOperator";
    import { onMount } from "svelte";
    import type { ConsoleReport } from "./console";

    interface Props {
        puzzle: DailyPuzzleOperator;
        regenerateOptions: RegenerateOption[];
        translate: (key: ResourceKey) => string;
        onReport: ConsoleReport;
    }

    let { puzzle, regenerateOptions, translate, onReport }: Props = $props();

    onMount(async () => {
        onReport(await puzzle.refresh());
    });
</script>

<h2 class="group">Daily puzzle</h2>
{#if puzzle.config !== undefined}
    <section class="admin-card">
        <h3 class="admin-card-title">Enabled</h3>
        <p class="admin-hint">
            Currently {puzzle.config.enabled ? "enabled" : "disabled"}. Saving pushes to every local
            user index at once; disabling is the kill switch.
        </p>
        <Toggle on={puzzle.enabled} label="Enabled" onChange={(on) => (puzzle.enabled = on)} />
        <div class="actions">
            <Button
                label="Save"
                busy={puzzle.busy.has("enabled")}
                disabled={puzzle.busy.has("enabled")}
                onClick={() => void puzzle.saveEnabled(onReport)} />
        </div>
    </section>

    <section class="admin-card">
        <h3 class="admin-card-title">Regenerate today</h3>
        <p class="admin-hint">
            Drops today's puzzle and generates another. Anyone mid-game restarts the replacement from
            scratch; nobody is charged a second entry fee or paid a second reward, and streaks are
            untouched. For a bad puzzle, not routine use.
        </p>
        <div class="admin-row">
            <span class="admin-label">Game</span>
            <select
                class="admin-input"
                value={puzzle.regenerateGameId}
                onchange={(e) => (puzzle.regenerateGameId = e.currentTarget.value)}>
                {#each regenerateOptions as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
            <Button
                label="Regenerate"
                busy={puzzle.busy.has("regenerate")}
                disabled={puzzle.busy.has("regenerate")}
                onClick={() => void puzzle.regenerateToday(onReport)} />
        </div>
    </section>
{/if}

{#if puzzle.error}
    <p class="admin-error" role="alert">{translate(puzzle.error)}</p>
{/if}

<style lang="scss">
    .group {
        margin: var(--space-8) 0 0;
        font: var(--weight-bold) var(--text-lg) / 1.3 var(--font-sans);
        color: var(--ink);
    }

    .actions {
        display: flex;
    }
</style>
