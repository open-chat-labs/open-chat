<!-- CHIT (native plan 14, design notes §3.10), pushed from the Chats tab's header and the You
     tab's CHIT card: the hero (the balance, what's been earned in all, the streak's pill, the last
     seven days as bars, the 52px Claim, and along its foot the streak insurance and today's puzzle
     rows), the Streak milestones (the next with its progress), the latest achievements under how
     many are done (View all: the Achievements screen) and the claim history calendar
     (ClaimCalendar's "card" layout, Local / UTC). The gear opens CHIT's settings. Claiming is the
     calendar's (logic/chit/claimHistory, the web's): the balance, streak and the Chats header's dot
     follow from the client's store, today shows on the calendar at once, and a claim made bursts
     confetti inside the screen. An app store build has no insurance row: it's paid in CHAT. -->
<script lang="ts">
    import {
        achievementList,
        achievements,
        achievementsStore,
        chitStateStore,
        currentUserStore,
        dailyChitClaimable,
        dailyPuzzleStore,
        latestSuccessfulUpdatesLoop,
        streakInsuranceStore,
        type ExternalAchievement,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import { ACHIEVEMENT_GROUPS } from "@openchat/ui/src/features/components/AchievementsDialog.svelte";
    import ClaimCalendar from "@openchat/ui/src/features/components/ClaimCalendar.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Confetti from "@openchat/ui/src/lib/components/Confetti.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { haptic } from "@openchat/ui/src/native/haptics";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { playableDailyPuzzleRows } from "@src/core/dailyPuzzle/playable";
    import { interpolateNewUi } from "@src/i18n/i18n";
    import {
        achievementsCount,
        earnedAchievementGroup,
        latestAchievements,
    } from "@src/logic/chit/achievements";
    import { insuranceRow, streakMilestones, weekStrip } from "@src/logic/chit/chitScreen";
    import { calendarDay } from "@src/logic/chit/claimDays";
    import { ClaimHistory } from "@src/logic/chit/claimHistory.svelte";
    import { dailyClaim } from "@src/logic/chit/dailyClaim";
    import { loadExternalAchievements, type Loaded } from "@src/logic/chit/externalAchievements";
    import { gameNameKey } from "@src/logic/dailyPuzzle/dailyPuzzle.svelte";
    import { puzzleCardProps } from "@src/logic/dailyPuzzle/puzzleCard";
    import { disableChit, utcMode } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import { disableStreakInsuranceFeature } from "@src/utils/features";
    import { getContext, onMount } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "chit" }>> = $props();

    const client = getContext<OpenChat>("client");
    const tr = (key: ResourceKey) => interpolateNewUi($_, key);
    const num = (n: number) => n.toLocaleString($locale ?? "en");

    // today's claim, the streak and the balance (logic/chit/dailyClaim, as the You tab's card and
    // the web's CHIT dialog), known once the first sync is in
    const claim = $derived(
        dailyClaim({
            chit: $chitStateStore,
            lastSync: $latestSuccessfulUpdatesLoop,
            disabled: $disableChit,
            now: $now500,
        }),
    );
    const streak = $derived(claim?.streak ?? 0);
    const milestones = $derived(streakMilestones(streak));

    // every claim since the account was made, and the achievements earned, loaded as it opens
    const joinedMs = Number($currentUserStore.dateCreated);
    const history = new ClaimHistory(client, joinedMs);
    // the partners' achievements too, for how many there are (as the Achievements screen counts)
    let external = $state<Loaded<ExternalAchievement[]>>();
    async function loadExternal(): Promise<void> {
        external = await loadExternalAchievements(client);
    }
    onMount(() => {
        void history.load();
        void loadExternal();
        // today's puzzles, should the poll not have fetched them yet
        if ($dailyPuzzleStore.lastFetched === undefined) void client.dailyPuzzleFetch();
    });

    const today = $derived(calendarDay($now500));
    const joined = calendarDay(joinedMs);
    const strip = $derived(weekStrip(history.days, today, joined));
    const weekday = $derived(
        new Intl.DateTimeFormat($locale ?? "en", { weekday: "narrow", timeZone: "UTC" }),
    );
    const latest = $derived(latestAchievements(history.events, 4));
    const achievementCount = $derived(
        achievementsCount(
            achievementList(
                achievements,
                $achievementsStore,
                external?.value ?? [],
                external?.at ?? Date.now(),
            ),
        ),
    );
    const groupOf = (key: string) =>
        ACHIEVEMENT_GROUPS.find((g) => g.key === key) ?? ACHIEVEMENT_GROUPS[0];

    // the calendar's Claim on today, only while the last sync is recent, as the web's calendar
    const calendarClaimable = $derived(
        !$disableChit &&
            dailyChitClaimable(
                $chitStateStore.nextDailyChitClaim,
                $now500,
                $latestSuccessfulUpdatesLoop,
            ),
    );

    const insurance = $derived(insuranceRow($streakInsuranceStore, disableStreakInsuranceFeature));

    // today's puzzle (logic/dailyPuzzle/puzzleCard, the web's CHIT dialog's card): none while
    // today's are loading
    const puzzle = $derived(
        puzzleCardProps(playableDailyPuzzleRows($dailyPuzzleStore), $now500, tr),
    );
    // the row: "Daily puzzle · Bridges", with Play / Continue / Solved at its end
    const puzzleGame = $derived(
        puzzle.gameId === undefined ? undefined : $_(gameNameKey(puzzle.gameId)),
    );
    const puzzleAction = $derived(
        puzzle.gameId === undefined
            ? undefined
            : puzzle.puzzleState === "new"
              ? $_("dailyPuzzle.play")
              : puzzle.puzzleState === "progress"
                ? $_("dailyPuzzle.continue")
                : puzzle.puzzleState === "solved"
                  ? $_("dailyPuzzle.solved")
                  : undefined,
    );

    let claiming = $state(false);
    let burst = $state(0);

    // the calendar's claim (a claim already made elsewhere just moves the countdown on: the client
    // does it); a claim made bursts the confetti
    async function claimToday(): Promise<void> {
        if (claiming) return;
        claiming = true;
        try {
            if (await history.claim()) {
                burst++;
                haptic("light");
            }
        } catch (err) {
            console.warn("Unable to claim the daily CHIT", err);
            context.toast($_("dailyChit.failedToClaim"));
        } finally {
            claiming = false;
        }
    }

    function openPuzzle() {
        if (puzzle.gameId === undefined) return;
        context.push({ kind: "daily_puzzle", gameId: puzzle.gameId });
    }
</script>

<div class="chit" data-confetti-within>
    <NativePageHeader
        title={$_("native.you.chit.title")}
        onBack={context.back}
        actions={[
            {
                icon: "gear",
                label: $_("native.chit.settings"),
                onClick: () => context.push({ kind: "settings", page: "chit" }),
            },
        ]} />

    <div class="body">
        <section class="hero" aria-label="CHIT">
            <div class="hero-main">
                <div class="top">
                    <span class="tile"><span class="tile-icon"></span></span>
                    <span class="balance">
                        <span class="amount-line">
                            <span class="amount">{num($chitStateStore.chitBalance)}</span>
                            <span class="unit">CHIT</span>
                        </span>
                        <span class="lifetime">
                            {$_("native.chit.lifetime", {
                                values: { amount: num($chitStateStore.totalChitEarned) },
                            })}
                        </span>
                    </span>
                    <span class="streak-pill">
                        <span class="streak-icon"></span>
                        {$_("native.you.chit.streak", { values: { count: streak } })}
                    </span>
                </div>

                <ol class="strip" aria-label={$_("native.chit.lastSevenDays")}>
                    {#each strip as d (d.day)}
                        <li
                            class="strip-day"
                            data-state={d.state}
                            class:today={d.today}
                            aria-label={`${weekday.format(d.day)}: ${$_(`native.chit.strip.${d.state}`)}`}>
                            <span class="strip-bar"></span>
                            <span class="strip-name">{weekday.format(d.day)}</span>
                        </li>
                    {/each}
                </ol>

                <div class="claim">
                    {#if claim === undefined}
                        <!-- till the first sync: today's claim isn't known yet -->
                        <div class="claim-wait"><Spinner size={20} /></div>
                    {:else if claim.claimable}
                        <Button
                            size="lg"
                            fullWidth
                            icon="zap"
                            busy={claiming}
                            label={$_("native.chit.claimAmount", {
                                values: { amount: num(claim.daily) },
                            })}
                            onClick={claimToday} />
                    {:else}
                        <!-- claimed: no button, the countdown to the next -->
                        <div class="claimed">
                            <span class="claimed-icon"></span>
                            {$_("native.chit.claimedNext", { values: { time: claim.countdown } })}
                        </div>
                    {/if}
                    <span class="confetti" aria-hidden="true">
                        <Confetti fire={burst} within="[data-confetti-within]" />
                    </span>
                </div>
            </div>

            {#if insurance !== undefined}
                <button
                    type="button"
                    class="hero-row insurance"
                    class:at-risk={insurance.held === 0}
                    onclick={() => context.push({ kind: "streak_insurance" })}>
                    <span class="row-icon shield"></span>
                    <span class="row-line">
                        {insurance.held === 0
                            ? $_("native.chit.noInsurance")
                            : $_("native.chit.insuredFor", { values: { count: insurance.held } })}
                        <span class="row-sub">
                            · {insurance.held === 0
                                ? $_("native.chit.streakAtRisk")
                                : $_("native.chit.streakCovered")}
                        </span>
                    </span>
                    {#if insurance.held > 0}
                        <span class="pips" aria-hidden="true">
                            {#each { length: Math.min(insurance.held, 7) } as _pip, i (i)}
                                <span class="pip"></span>
                            {/each}
                        </span>
                    {/if}
                    <span class="chevron"></span>
                </button>
            {/if}

            {#if puzzle.puzzleState !== "off"}
                <button
                    type="button"
                    class="hero-row puzzle"
                    disabled={puzzle.gameId === undefined}
                    onclick={openPuzzle}>
                    <span class="row-icon joystick"></span>
                    <span class="row-line">
                        {$_("native.chit.dailyPuzzle")}
                        {#if puzzleGame !== undefined}<span class="row-sub">· {puzzleGame}</span
                            >{/if}
                    </span>
                    {#if puzzleAction !== undefined}
                        <span class="row-action" class:solved={puzzle.puzzleState === "solved"}>
                            {puzzleAction}
                        </span>
                    {/if}
                </button>
            {/if}
        </section>

        <SettingsGroup label={$_("native.chit.milestones")}>
            {#each milestones as m (m.days)}
                <div class="settings-row milestone" class:reached={m.reached}>
                    <span class="milestone-tile"><span class="milestone-icon"></span></span>
                    <span class="milestone-text">
                        <span class="milestone-head">
                            <span class="row-label">
                                {$_("native.chit.milestoneDay", { values: { days: m.days } })}
                            </span>
                            <span class="milestone-pays">
                                {$_("native.chit.milestoneRate", {
                                    values: { amount: num(m.pays) },
                                })}
                            </span>
                        </span>
                        {#if m.next}
                            <span class="progress">
                                <span class="progress-track">
                                    <span
                                        class="progress-fill"
                                        style:width={`${Math.min(streak / m.days, 1) * 100}%`}
                                    ></span>
                                </span>
                                <span class="progress-count">{num(streak)} / {num(m.days)}</span>
                            </span>
                        {/if}
                    </span>
                </div>
            {/each}
        </SettingsGroup>

        <section class="achievements">
            <div class="section-head">
                <span class="section-label">
                    <ListSectionLabel
                        label={$_("native.chit.achievementsOf", {
                            values: {
                                done: num(achievementCount.total - achievementCount.left),
                                total: num(achievementCount.total),
                            },
                        })} />
                </span>
                <button
                    type="button"
                    class="view-all"
                    onclick={() => context.push({ kind: "achievements" })}>
                    {$_("native.chit.viewAll")}
                </button>
            </div>
            <div class="card">
                {#each latest as a (a.kind === "internal" ? a.id : a.name)}
                    {@const group = groupOf(earnedAchievementGroup(a))}
                    <div class="settings-row achievement">
                        <span class="achievement-tile">
                            <span
                                class="achievement-icon"
                                style:--achievement-icon={`var(--icon-${group.icon})`}></span>
                        </span>
                        <span class="row-text">
                            <span class="row-label">
                                {a.kind === "internal" ? $_(`learnToEarn.${a.id}`) : a.name}
                            </span>
                            <span class="achievement-sub">
                                {$_("native.chit.unlocked", { values: { group: $_(group.label) } })}
                            </span>
                        </span>
                        <span class="reward">{num(a.amount)}</span>
                    </div>
                {:else}
                    <p class="settings-row none">{$_("native.chit.noAchievements")}</p>
                {/each}
            </div>
        </section>

        <ClaimCalendar
            layout="card"
            label={$_("native.chit.claimHistory")}
            claimHistory={history.days}
            {today}
            {joined}
            claimable={calendarClaimable}
            utc={$utcMode}
            onUtcChange={(utc) => utcMode.set(utc)}
            onClaim={claimToday} />
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .chit {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        position: relative;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 8px var(--space-16) var(--scroll-end);
    }

    // ---- the hero: an accent hero (native design notes §1 Surfaces), as the You tab's CHIT card,
    // its insurance and puzzle rows along its foot, edge to edge

    .hero {
        flex: none;
        display: flex;
        flex-direction: column;
        border-radius: 20px;
        overflow: hidden;
        background: linear-gradient(
            150deg,
            color-mix(in oklch, var(--accent) 26%, var(--hero-base)) 0%,
            var(--hero-base) 75%
        );
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
    }

    .hero-main {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 20px 18px 18px;
    }

    .top {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    .tile {
        flex: none;
        width: 44px;
        height: 44px;
        @include flex-center;
        border-radius: 14px;
        background: var(--accent);
        box-shadow: 0 6px 18px color-mix(in oklch, var(--accent) 45%, transparent);
    }

    .tile-icon {
        @include icon(zap, 22px, var(--on-accent));
    }

    .balance {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .amount-line {
        display: flex;
        align-items: baseline;
        gap: 6px;
    }

    .amount {
        font: 800 text-size(28px) / 1 var(--font-mono);
        letter-spacing: -0.02em;
    }

    .unit {
        font: var(--weight-semibold) text-size(12px) / 1 var(--font-mono);
        letter-spacing: 0.09em;
        color: var(--ink-3);
    }

    .lifetime {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    // the streak, as a pill beside the balance
    .streak-pill {
        flex: none;
        display: flex;
        align-items: center;
        gap: 5px;
        height: 28px;
        padding: 0 10px;
        border-radius: 14px;
        background: var(--tint-pill);
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-2);
    }

    .streak-icon {
        @include icon(flame, 14px, var(--status-chit));
    }

    // the last seven days, today last: a bar each, its day under it
    .strip {
        display: flex;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .strip-day {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 7px;
    }

    .strip-bar {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: var(--tint-pill);

        [data-state="claimed"] & {
            background: var(--accent);
        }

        [data-state="insured"] & {
            background: var(--status-online);
        }

        [data-state="open"] & {
            background: color-mix(in oklch, var(--accent) 30%, transparent);
        }
    }

    .strip-name {
        font: var(--weight-semibold) text-size(10.5px) / 1 var(--font-mono);
        color: var(--ink-4);

        .today & {
            color: var(--ink);
        }
    }

    .claim {
        position: relative;
    }

    .claim-wait {
        height: 52px;
        @include flex-center;
    }

    .claimed {
        height: 52px;
        @include flex-center;
        gap: 8px;
        border-radius: 14px;
        background: var(--tint-pill);
        font: var(--weight-bold) text-size(15px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .claimed-icon {
        @include icon(check, 16px, currentColor);
    }

    // the burst comes from the button's middle
    .confetti {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 0;
        height: 0;
        pointer-events: none;
    }

    .hero-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: var(--touch-target);
        padding: 16px 18px;
        border: 0;
        background: var(--tint-row);
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        & + & {
            box-shadow: inset 0 1px 0 var(--line-1);
        }

        &:disabled {
            cursor: default;
        }

        &:focus-visible {
            @include focus-ring;
        }

        // no cover: the streak is at risk
        &.at-risk {
            background: color-mix(in oklch, var(--status-warning) 14%, var(--tint-row));
        }
    }

    .row-icon {
        flex: none;

        &.shield {
            @include icon(shield, 18px, var(--status-online));

            .at-risk & {
                background: var(--status-warning);
            }
        }

        &.joystick {
            @include icon(joystick, 18px, var(--ink-2));
        }
    }

    .row-line {
        flex: 1;
        min-width: 0;
        font: var(--weight-semibold) text-size(13.5px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .row-sub {
        font-weight: var(--weight-medium);
        color: var(--ink-3);
    }

    .pips {
        flex: none;
        display: flex;
        gap: 3px;
    }

    .pip {
        width: 6px;
        height: 6px;
        border-radius: var(--radius-circle);
        background: var(--status-online);
    }

    .chevron {
        flex: none;
        @include icon(chevron-right, 14px, var(--ink-4));
    }

    .row-action {
        flex: none;
        font: var(--weight-bold) text-size(13px) / 1 var(--font-sans);
        color: var(--accent-bright);

        &.solved {
            color: var(--status-online);
        }
    }

    // ---- Streak milestones

    .milestone {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 64px;
        padding: 12px 16px;
        box-sizing: border-box;
    }

    .milestone-tile {
        flex: none;
        width: 36px;
        height: 36px;
        @include flex-center;
        border-radius: 12px;
        background: var(--overlay-2);

        .reached & {
            background: color-mix(in oklch, var(--status-online) 14%, transparent);
        }
    }

    .milestone-icon {
        @include icon(flame, 17px, var(--ink-3));

        .reached & {
            mask-image: var(--icon-check);
            background: var(--status-online);
        }
    }

    .milestone-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .milestone-head {
        display: flex;
        align-items: center;
        gap: 8px;

        .row-label {
            flex: 1;
        }
    }

    .milestone-pays {
        flex: none;
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-mono);
        color: var(--accent-bright);

        .reached & {
            color: var(--ink-4);
        }
    }

    .progress {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .progress-track {
        flex: 1;
        height: 4px;
        border-radius: 2px;
        background: var(--overlay-2);
        overflow: hidden;
    }

    .progress-fill {
        display: block;
        height: 100%;
        border-radius: 2px;
        background: var(--accent);
    }

    .progress-count {
        flex: none;
        font: var(--weight-medium) text-size(11.5px) / 1 var(--font-mono);
        color: var(--ink-4);
    }

    .row-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .row-label {
        min-width: 0;
        font: var(--weight-semibold) text-size(14.5px) / 1.2 var(--font-sans);
        @include truncate;
    }

    // ---- the latest achievements, under how many are done, with View all

    .achievements {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .section-head {
        display: flex;
        align-items: center;
        padding-inline-start: 4px;
    }

    .section-label {
        flex: 1;
        min-width: 0;
    }

    .view-all {
        flex: none;
        min-height: var(--touch-target);
        padding: 0 4px;
        border: 0;
        background: none;
        font: var(--weight-semibold) text-size(13.5px) / 1 var(--font-sans);
        color: var(--accent);
        cursor: pointer;

        &:focus-visible {
            @include focus-ring;
        }
    }

    // the settings kit's card (SettingsGroup's), its rows divided
    .card {
        display: flex;
        flex-direction: column;
        border-radius: 16px;
        background: var(--overlay-1);
        overflow: hidden;

        :global(.settings-row ~ .settings-row) {
            box-shadow: inset 0 1px 0 var(--line-1);
        }
    }

    .achievement {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 60px;
        padding: 10px 16px;
        box-sizing: border-box;
    }

    // every one here is earned: the accent's tile, the group's icon
    .achievement-tile {
        flex: none;
        width: 36px;
        height: 36px;
        @include flex-center;
        border-radius: var(--radius-circle);
        background: var(--accent-soft);
    }

    .achievement-icon {
        width: 17px;
        height: 17px;
        background: var(--accent);
        mask: var(--achievement-icon) center / contain no-repeat;
    }

    .achievement-sub {
        font: var(--weight-regular) text-size(12.5px) / 1.3 var(--font-sans);
        color: var(--ink-4);
        @include truncate;
    }

    .reward {
        flex: none;
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-mono);
        color: var(--ink-4);
    }

    .none {
        margin: 0;
        padding: 14px 16px;
        font: var(--weight-regular) text-size(13.5px) / 1.45 var(--font-sans);
        color: var(--ink-3);
    }
</style>
