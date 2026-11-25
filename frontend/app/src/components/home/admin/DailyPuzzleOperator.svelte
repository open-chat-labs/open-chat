<script lang="ts">
    import type { OpenChat } from "@client";
    import { getContext, onMount } from "svelte";
    import {
        DailyPuzzleOperator,
        type DailyPuzzleOutcome,
    } from "../../../logic/admin/dailyPuzzleOperator.svelte";
    import { toastStore } from "../../../stores/toast";
    import { dailyPuzzleGames } from "@src/core/dailyPuzzle/registry";
    import { regenerateOptions } from "../../../utils/dailyPuzzleOperator";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Select from "../../Select.svelte";
    import Toggle from "../../Toggle.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    const puzzle = new DailyPuzzleOperator(client);
    const regenerate = regenerateOptions(Object.keys(dailyPuzzleGames));

    let config = $derived(puzzle.config);
    let busy = $derived(puzzle.busy);
    let error = $derived(puzzle.error);

    function report(outcome: DailyPuzzleOutcome | undefined) {
        if (outcome?.kind === "success") {
            toastStore.showSuccessToast(outcome.message);
        } else if (outcome?.kind === "failed") {
            toastStore.showFailureToast(outcome.message);
        }
    }

    onMount(async () => {
        report(await puzzle.refresh());
    });

    function saveEnabled() {
        void puzzle.saveEnabled(report);
    }

    function regenerateToday() {
        void puzzle.regenerateToday(report);
    }
</script>

<!-- Rendered inside Operator functions: the daily puzzle's levers are operator functions and
     get a section there, not a tab of their own (#9368). -->
<h3 class="group">Daily puzzle</h3>
{#if config !== undefined}
    <section class="operator-function">
        <div class="title">Enabled</div>
        <div class="hint">
            Currently {config.enabled ? "enabled" : "disabled"}. Saving pushes to every local user
            index at once; disabling is the kill switch.
        </div>
        <div class="name-value">
            <div class="label">Enabled:</div>
            <div class="value">
                <Toggle id="daily-puzzle-enabled" small bind:checked={puzzle.enabled} />
            </div>
        </div>
        <Button tiny disabled={busy.has("enabled")} loading={busy.has("enabled")} onClick={saveEnabled}
            >Save</Button>
    </section>

    <section class="operator-function">
        <div class="title">Regenerate today</div>
        <div class="hint">
            Drops today's puzzle and generates another. Anyone mid-game restarts the replacement
            from scratch; nobody is charged a second entry fee or paid a second reward, and streaks
            are untouched. For a bad puzzle, not routine use.
        </div>
        <div class="name-value">
            <div class="label">Game:</div>
            <div class="value schedule-row">
                <Select bind:value={puzzle.regenerateGameId}>
                    {#each regenerate as option (option.value)}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </Select>
            </div>
            <Button disabled={busy.has("regenerate")} loading={busy.has("regenerate")} onClick={regenerateToday}
                >Regenerate</Button>
        </div>
    </section>
{/if}

{#if error}
    <ErrorMessage>
        <Translatable resourceKey={error} />
    </ErrorMessage>
{/if}

<style lang="scss">
    .group {
        margin-bottom: $sp3;
    }

    .operator-function {
        padding: $sp3;
        border: var(--bw) solid var(--bd);
        border-radius: $sp2;
        margin-bottom: $sp5;
    }

    .name-value {
        width: 100%;
        display: flex;
        align-items: center;
        gap: $sp3;

        .label {
            flex: 0 0 150px;
            color: var(--txt-light);
            @include font(light, normal, fs-80);
        }

        .value {
            flex: auto;
        }

        .schedule-row {
            display: flex;
            gap: $sp3;
            align-items: center;
        }
    }

    .title {
        margin-bottom: $sp3;
        @include font(bold, normal, fs-100);
    }

    .hint {
        margin-bottom: $sp3;
        color: var(--txt-light);
        @include font(light, normal, fs-80);
        word-break: break-word;
    }
</style>
