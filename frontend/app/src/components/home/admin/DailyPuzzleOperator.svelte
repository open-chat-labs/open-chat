<script lang="ts">
    import type { GameConfig, OCError, OpenChat, ResourceKey, Success } from "@client";
    import {
        WEEKDAYS,
        configToForm,
        formToConfig,
        formToGameConfig,
        formToSchedule,
        gameConfigToForm,
        regenerateOptions,
        type DailyPuzzleConfigForm,
        type GameConfigForm,
        type PuzzleParamsForm,
    } from "@utils/dailyPuzzleOperator";
    import { getContext, onMount } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Input from "../../Input.svelte";
    import Select from "../../Select.svelte";
    import Toggle from "../../Toggle.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    // The canister has no schedule query, so the rows start at its built-in default (Mon..Sun)
    // rather than at what is currently set. Everything else is read back after every action.
    const defaultSchedule: PuzzleParamsForm[] = [
        { gameId: "light_up", width: "7", height: "7", tier: "0", blackPct: "20" },
        { gameId: "tents", width: "8", height: "8", tier: "0", blackPct: "20" },
        { gameId: "slant", width: "6", height: "6", tier: "0", blackPct: "20" },
        { gameId: "bridges", width: "7", height: "7", tier: "0", blackPct: "20" },
        { gameId: "unruly", width: "8", height: "8", tier: "0", blackPct: "20" },
        { gameId: "tents", width: "10", height: "10", tier: "1", blackPct: "20" },
        { gameId: "light_up", width: "10", height: "10", tier: "1", blackPct: "20" },
    ];

    let error: ResourceKey | undefined = $state(undefined);
    let busy = $state(new SvelteSet<number>());
    let configForm: DailyPuzzleConfigForm | undefined = $state(undefined);
    let currentConfig = $state("");
    let gameConfigs: [string, GameConfig][] = $state([]);
    let selectedGameId = $state("");
    let gameForm: GameConfigForm = $state({ hintPrices: "", maxHints: "" });
    let schedule: PuzzleParamsForm[] = $state(defaultSchedule);
    let regenerateGameId = $state("");

    let gameIds = $derived(gameConfigs.map(([id]) => id));
    let selectedGameConfig = $derived(gameConfigs.find(([id]) => id === selectedGameId)?.[1]);
    let currentGameConfig = $derived(
        selectedGameConfig === undefined
            ? ""
            : `hint prices ${selectedGameConfig.hintPrices.join(", ")}; max hints ${selectedGameConfig.maxHints}`,
    );
    let regenerate = $derived(regenerateOptions(gameConfigs));

    function fail(what: string, resp: OCError | unknown) {
        const detail =
            typeof resp === "object" && resp !== null && "kind" in resp && resp.kind === "error"
                ? ((resp as OCError).message ?? `code ${(resp as OCError).code}`)
                : String(resp);
        error = i18nKey(`${what}: ${detail}`);
        toastStore.showFailureToast(error);
    }

    // Every form is filled from what the canister holds now, never from what was just sent.
    async function refresh(): Promise<void> {
        const [config, games] = await Promise.all([
            client.dailyPuzzleConfig(),
            client.dailyPuzzleGameConfigs(),
        ]);
        if ("kind" in config) {
            fail("Failed to read the daily puzzle config", config);
        } else {
            configForm = configToForm(config);
            currentConfig = `${config.enabled ? "Enabled" : "Disabled"}; fee ${config.entryFee}${
                config.firstPlayFree ? " (first play free)" : ""
            }; rewards ${config.rewardByStreak.join(", ")}; hint penalty ${config.hintPenalty}; min carded solve ${config.minCardedSolveMs}ms; max submits ${config.maxSubmits}; max free checks ${config.maxFreeChecks}`;
        }
        if (Array.isArray(games)) {
            gameConfigs = games;
            if (!games.some(([id]) => id === selectedGameId)) {
                selectedGameId = games[0]?.[0] ?? "";
            }
            selectGame();
        } else {
            fail("Failed to read the game configs", games);
        }
    }

    function selectGame() {
        const found = gameConfigs.find(([id]) => id === selectedGameId)?.[1];
        gameForm = found === undefined ? { hintPrices: "", maxHints: "" } : gameConfigToForm(found);
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

    function saveConfig() {
        if (configForm === undefined) return;
        const config = formToConfig(configForm);
        run(
            0,
            "Failed to set the daily puzzle config",
            () => client.dailyPuzzleSetConfig(config),
            "Daily puzzle config set",
        );
    }

    function saveGameConfig() {
        const gameId = selectedGameId;
        const config = formToGameConfig(gameForm);
        run(
            1,
            `Failed to set the ${gameId} config`,
            () => client.dailyPuzzleSetGameConfig(gameId, config),
            `${gameId} config set`,
        );
    }

    function saveSchedule() {
        const params = formToSchedule(schedule);
        run(
            2,
            "Failed to set the schedule",
            () => client.dailyPuzzleSetSchedule(params),
            "Schedule set",
        );
    }

    function pushNow() {
        run(
            3,
            "Push failed",
            () => client.dailyPuzzlePushNow(),
            "Pushed to every local user index",
        );
    }

    function regenerateToday() {
        const gameId = regenerateGameId === "" ? undefined : regenerateGameId;
        run(
            4,
            "Regenerate failed",
            () => client.dailyPuzzleRegenerateToday(gameId),
            `Today's puzzle regenerated${gameId === undefined ? " as scheduled" : ` as ${gameId}`}`,
        );
    }
</script>

<div class="operator">
    {#if configForm !== undefined}
        <section class="operator-function">
            <div class="title">Series config</div>
            <div class="hint">Current: {currentConfig}</div>
            <div class="name-value">
                <div class="label">Enabled:</div>
                <div class="value">
                    <Toggle small id="daily-puzzle-enabled" bind:checked={configForm.enabled} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Entry fee (CHIT):</div>
                <div class="value">
                    <Input bind:value={configForm.entryFee} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">First play free:</div>
                <div class="value">
                    <Toggle
                        small
                        id="daily-puzzle-first-play-free"
                        bind:checked={configForm.firstPlayFree}
                    />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Rewards by streak:</div>
                <div class="value">
                    <Input
                        bind:value={configForm.rewardByStreak}
                        placeholder={i18nKey("Comma separated CHIT, index = streak before today")}
                    />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Hint penalty (CHIT):</div>
                <div class="value">
                    <Input bind:value={configForm.hintPenalty} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Min carded solve (ms):</div>
                <div class="value">
                    <Input bind:value={configForm.minCardedSolveMs} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Max submits:</div>
                <div class="value">
                    <Input bind:value={configForm.maxSubmits} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Max free checks:</div>
                <div class="value">
                    <Input bind:value={configForm.maxFreeChecks} />
                </div>
            </div>
            <Button tiny disabled={busy.has(0)} loading={busy.has(0)} onClick={saveConfig}
                >Save</Button>
        </section>
    {/if}

    {#if gameIds.length > 0}
        <section class="operator-function">
            <div class="title">Per-game config</div>
            <div class="name-value">
                <div class="label">Game:</div>
                <div class="value">
                    <Select bind:value={selectedGameId} onchange={selectGame}>
                        {#each gameIds as id (id)}
                            <option value={id}>{id}</option>
                        {/each}
                    </Select>
                </div>
            </div>
            <div class="hint">Current: {currentGameConfig}</div>
            <div class="name-value">
                <div class="label">Hint prices (CHIT):</div>
                <div class="value">
                    <Input
                        bind:value={gameForm.hintPrices}
                        placeholder={i18nKey("Comma separated, one per level, increasing")}
                    />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Max hints:</div>
                <div class="value">
                    <Input bind:value={gameForm.maxHints} />
                </div>
            </div>
            <Button tiny disabled={busy.has(1)} loading={busy.has(1)} onClick={saveGameConfig}
                >Save</Button>
        </section>

        <section class="operator-function">
            <div class="title">Schedule</div>
            <div class="hint">
                The canister does not report its current schedule; these rows start at its built-in
                default. Saving replaces all seven days. Width and height 5-14, tier 0 easy / 1
                tricky, black pct only applies to light_up (10-60).
            </div>
            {#each schedule as day, i (i)}
                <div class="name-value">
                    <div class="label">{WEEKDAYS[i]}:</div>
                    <div class="value schedule-row">
                        <Select bind:value={day.gameId}>
                            {#each gameIds as id (id)}
                                <option value={id}>{id}</option>
                            {/each}
                        </Select>
                        <Input bind:value={day.width} placeholder={i18nKey("Width")} />
                        <Input bind:value={day.height} placeholder={i18nKey("Height")} />
                        <Input bind:value={day.tier} placeholder={i18nKey("Tier")} />
                        <Input bind:value={day.blackPct} placeholder={i18nKey("Black %")} />
                    </div>
                </div>
            {/each}
            <Button tiny disabled={busy.has(2)} loading={busy.has(2)} onClick={saveSchedule}
                >Save</Button>
        </section>

        <section class="operator-function">
            <div class="title">Actions</div>
            <div class="hint">
                Push now sends today's puzzles and config to every local user index without waiting
                for the timer. Regenerate today drops today's puzzle and makes a new one, as
                scheduled or forcing a game.
            </div>
            <div class="name-value">
                <div class="label">Push now:</div>
                <div class="value">
                    <Button tiny disabled={busy.has(3)} loading={busy.has(3)} onClick={pushNow}
                        >Push now</Button>
                </div>
            </div>
            <div class="name-value">
                <div class="label">Regenerate today:</div>
                <div class="value schedule-row">
                    <Select bind:value={regenerateGameId}>
                        {#each regenerate as option (option.value)}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </Select>
                    <Button
                        tiny
                        disabled={busy.has(4)}
                        loading={busy.has(4)}
                        onClick={regenerateToday}>Regenerate</Button>
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
