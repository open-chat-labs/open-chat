<script lang="ts">
    import {
        type DailyPuzzleConfig,
        type GameConfig,
        type OCError,
        type OpenChat,
        type ResourceKey,
        type Success,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import { regenerateOptions, withEnabled } from "../../../utils/dailyPuzzleOperator";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Select from "../../Select.svelte";
    import Toggle from "../../Toggle.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    // Two levers, deliberately (2026-09-13): the kill switch, and regenerating a bad puzzle.
    // Prices, rewards, caps and the rota are code, so changing them gets a review.
    let error: ResourceKey | undefined = $state(undefined);
    let busy = $state(new SvelteSet<number>());
    let config: DailyPuzzleConfig | undefined = $state(undefined);
    let enabled = $state(false);
    let gameConfigs: [string, GameConfig][] = $state([]);
    let regenerateGameId = $state("");
    let regenerate = $derived(regenerateOptions(gameConfigs));

    function fail(what: string, resp: OCError | unknown) {
        const detail =
            typeof resp === "object" && resp !== null && "kind" in resp && resp.kind === "error"
                ? ((resp as OCError).message ?? `code ${(resp as OCError).code}`)
                : String(resp);
        error = i18nKey(`${what}: ${detail}`);
        toastStore.showFailureToast(error);
    }

    // Shown state is what the canister holds now, never what was just sent
    async function refresh(): Promise<void> {
        const [current, games] = await Promise.all([
            client.dailyPuzzleConfig(),
            client.dailyPuzzleGameConfigs(),
        ]);
        if ("kind" in current) {
            fail("Failed to read the daily puzzle config", current);
        } else {
            config = current;
            enabled = current.enabled;
        }
        if (Array.isArray(games)) {
            gameConfigs = games;
        } else {
            fail("Failed to read the game configs", games);
        }
    }

    onMount(() => {
        refresh();
    });

    function run(
        index: number,
        what: string,
        action: () => Promise<Success | OCError>,
        successMessage: string,
    ): void {
        error = undefined;
        busy.add(index);
        action()
            .then(async (resp) => {
                if (resp.kind === "success") {
                    toastStore.showSuccessToast(i18nKey(successMessage));
                    await refresh();
                } else {
                    fail(what, resp);
                }
            })
            .catch((err) => fail(what, err))
            .finally(() => busy.delete(index));
    }

    function saveEnabled() {
        if (config === undefined) return;
        const next = withEnabled(config, enabled);
        run(
            0,
            "Failed to set the daily puzzle enabled flag",
            () => client.dailyPuzzleSetConfig(next),
            `Daily puzzle ${enabled ? "enabled" : "disabled"}; pushed to every local user index`,
        );
    }

    function regenerateToday() {
        const gameId = regenerateGameId === "" ? undefined : regenerateGameId;
        run(
            1,
            "Regenerate failed",
            () => client.dailyPuzzleRegenerateToday(gameId),
            `Today's puzzle regenerated${gameId === undefined ? " as scheduled" : ` as ${gameId}`}`,
        );
    }
</script>

<div class="operator">
    {#if config !== undefined}
        <section class="operator-function">
            <div class="title">Daily puzzle</div>
            <div class="hint">
                Currently {config.enabled ? "enabled" : "disabled"}. Saving pushes to every local
                user index at once; disabling is the kill switch.
            </div>
            <div class="name-value">
                <div class="label">Enabled:</div>
                <div class="value">
                    <Toggle id="daily-puzzle-enabled" small bind:checked={enabled} />
                </div>
            </div>
            <Button tiny disabled={busy.has(0)} loading={busy.has(0)} onClick={saveEnabled}
                >Save</Button
            >
        </section>

        <section class="operator-function">
            <div class="title">Regenerate today</div>
            <div class="hint">
                Drops today's puzzle and generates another. Anyone mid-game restarts the replacement
                from scratch; nobody is charged a second entry fee or paid a second reward, and
                streaks are untouched. For a bad puzzle, not routine use.
            </div>
            <div class="name-value">
                <div class="label">Game:</div>
                <div class="value schedule-row">
                    <Select bind:value={regenerateGameId}>
                        {#each regenerate as option (option.value)}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </Select>
                    <Button
                        tiny
                        disabled={busy.has(1)}
                        loading={busy.has(1)}
                        onClick={regenerateToday}>Regenerate</Button
                    >
                </div>
            </div>
        </section>
    {/if}

    {#if error}
        <ErrorMessage>
            <Translatable resourceKey={error} />
        </ErrorMessage>
    {/if}
</div>

<style lang="scss">
    .operator {
        flex: auto;
        @include nice-scrollbar();
        padding: $sp4;
        max-width: 700px;
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
