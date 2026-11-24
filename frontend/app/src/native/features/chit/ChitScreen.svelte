<!-- CHIT (native plan 14, design notes §3.10), pushed from the Chats tab's header and the You
     tab's CHIT card: the hero (the balance, what's been earned in all, the streak with its ring, the
     last seven days, the 52px Claim, the streak insurance row and today's puzzle), the Streak
     milestones, the latest achievements (View all: the Achievements screen) and the claim history
     calendar (ClaimCalendar, Local / UTC). The gear opens CHIT's settings. Claiming is the
     calendar's (logic/chit/claimHistory, the web's): the balance, streak and the Chats header's dot
     follow from the client's store, today shows on the calendar at once, and a claim made bursts
     confetti inside the screen. An app store build has no insurance row: it's paid in CHAT. -->
<script lang="ts">
    import {
        chitStateStore,
        currentUserStore,
        dailyChitClaimable,
        dailyPuzzleStore,
        latestSuccessfulUpdatesLoop,
        streakInsuranceStore,
        streakRingProgress,
        type OpenChat,
        type ResourceKey,
    } from "@client";
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
    import { latestAchievements } from "@src/logic/chit/achievements";
    import { insuranceRow, streakMilestones, weekStrip } from "@src/logic/chit/chitScreen";
    import { calendarDay } from "@src/logic/chit/claimDays";
    import { ClaimHistory } from "@src/logic/chit/claimHistory.svelte";
    import { dailyClaim } from "@src/logic/chit/dailyClaim";
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
    const ring = $derived(streakRingProgress(streak, claim?.claimedToday ?? false));
    const milestones = $derived(streakMilestones(streak));
    const nextMilestone = $derived(milestones.find((m) => m.next));

    // every claim since the account was made, and the achievements earned, loaded as it opens
    const joinedMs = Number($currentUserStore.dateCreated);
    const history = new ClaimHistory(client, joinedMs);
    onMount(() => {
        void history.load();
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
    // the solved card has no title of its own (the web's card names it): the game's, as before
    const puzzleLabel = $derived(
        puzzle.puzzleTitle ??
            (puzzle.gameId === undefined
                ? $_("dailyPuzzle.todaysPuzzle")
                : `${$_("dailyPuzzle.todaysPuzzle")} · ${$_(gameNameKey(puzzle.gameId))}`),
    );
    const puzzleSub = $derived(
        puzzle.puzzleState === "new"
            ? $_("dailyPuzzle.play")
            : puzzle.puzzleState === "progress"
              ? $_("dailyPuzzle.continue")
              : puzzle.puzzleState === "solved"
                ? [puzzle.puzzleSub, $_("native.you.chit.next", { values: { time: puzzle.puzzleCountdown } })]
                      .filter((s) => s !== undefined && s !== "")
                      .join(" · ")
                : $_("dailyPuzzle.unavailable"),
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
            <div class="top">
                <span class="tile"><span class="tile-icon"></span></span>
                <span class="balance">
                    <span class="amount">
                        {num($chitStateStore.chitBalance)}<span class="unit">CHIT</span>
                    </span>
                    <span class="lifetime">
                        {$_("native.chit.lifetime", {
                            values: { amount: num($chitStateStore.totalChitEarned) },
                        })}
                    </span>
                </span>
                <!-- the streak in its ring, filling towards the next milestone -->
                <span
                    class="ring"
                    style:--fill={ring}
                    role="img"
                    aria-label={$_("native.you.chit.streak", { values: { count: streak } })}>
                    <span class="ring-inner">
                        <span class="streak-icon"></span>
                        <span class="streak-count">{streak}</span>
                    </span>
                </span>
            </div>

            <p class="milestone-line">
                {nextMilestone === undefined
                    ? $_("native.chit.topMilestone")
                    : $_("native.chit.nextMilestone", {
                          values: { count: nextMilestone.left, days: nextMilestone.days },
                      })}
            </p>

            <ol class="strip" aria-label={$_("native.chit.lastSevenDays")}>
                {#each strip as d (d.day)}
                    <li
                        class="strip-day"
                        data-state={d.state}
                        class:today={d.today}
                        aria-label={`${weekday.format(d.day)}: ${$_(`native.chit.strip.${d.state}`)}`}>
                        <span class="strip-mark"></span>
                        <span class="strip-name">{weekday.format(d.day)}</span>
                    </li>
                {/each}
            </ol>

            <div class="claim">
                {#if claim === undefined}
                    <!-- till the first sync: today's claim isn't known yet -->
                    <div class="claim-wait"><Spinner size={20} /></div>
                {:else}
                    <Button
                        size="lg"
                        fullWidth
                        icon="zap"
                        busy={claiming}
                        disabled={!claim.claimable}
                        label={claim.claimable
                            ? $_("native.chit.claimAmount", { values: { amount: num(claim.daily) } })
                            : $_("native.chit.claimedNext", { values: { time: claim.countdown } })}
                        onClick={claimToday} />
                {/if}
                <span class="confetti" aria-hidden="true">
                    <Confetti fire={burst} within="[data-confetti-within]" />
                </span>
            </div>

            {#if insurance !== undefined}
                <button
                    type="button"
                    class="hero-row"
                    onclick={() => context.push({ kind: "streak_insurance" })}>
                    <span class="row-icon shield"></span>
                    <span class="row-text">
                        <span class="row-label">{$_("native.chit.insurance")}</span>
                        <span class="row-sub">
                            {$_("native.chit.insuranceHeld", { values: { count: insurance.held } })}
                        </span>
                    </span>
                    <span class="chevron"></span>
                </button>
            {/if}

            {#if puzzle.puzzleState !== "off"}
                <button
                    type="button"
                    class="hero-row"
                    disabled={puzzle.gameId === undefined}
                    onclick={openPuzzle}>
                    <span class="row-icon joystick"></span>
                    <span class="row-text">
                        <span class="row-label">{puzzleLabel}</span>
                        <span class="row-sub">{puzzleSub}</span>
                    </span>
                    {#if puzzle.gameId !== undefined}<span class="chevron"></span>{/if}
                </button>
            {/if}
        </section>

        <SettingsGroup label={$_("native.chit.milestones")}>
            {#each milestones as m (m.days)}
                <div class="settings-row milestone" class:reached={m.reached} class:next={m.next}>
                    <span class="milestone-icon"></span>
                    <span class="row-text">
                        <span class="row-label">
                            {$_("native.chit.milestoneDay", { values: { days: m.days } })}
                        </span>
                        <span class="row-sub">
                            {$_("native.chit.milestonePays", { values: { amount: num(m.pays) } })}
                        </span>
                    </span>
                    <span class="milestone-state">
                        {m.reached
                            ? $_("native.chit.milestoneReached")
                            : $_("native.chit.milestoneLeft", { values: { count: m.left } })}
                    </span>
                </div>
            {/each}
        </SettingsGroup>

        <section class="achievements">
            <div class="section-head">
                <ListSectionLabel label={$_("native.chit.achievements")} />
                <button
                    type="button"
                    class="view-all"
                    onclick={() => context.push({ kind: "achievements" })}>
                    {$_("native.chit.viewAll")}
                </button>
            </div>
            <div class="card">
                {#each latest as a (a.kind === "internal" ? a.id : a.name)}
                    <div class="settings-row achievement">
                        <span class="trophy"></span>
                        <span class="row-text">
                            <span class="row-label">
                                {a.kind === "internal" ? $_(`learnToEarn.${a.id}`) : a.name}
                            </span>
                        </span>
                        <span class="reward">
                            {$_("native.you.chit.pays", { values: { amount: num(a.amount) } })}
                        </span>
                    </div>
                {:else}
                    <p class="settings-row none">{$_("native.chit.noAchievements")}</p>
                {/each}
            </div>
        </section>

        <SettingsGroup label={$_("native.chit.claimHistory")}>
            <div class="calendar">
                <ClaimCalendar
                    claimHistory={history.days}
                    {today}
                    {joined}
                    claimable={calendarClaimable}
                    utc={$utcMode}
                    onUtcChange={(utc) => utcMode.set(utc)}
                    onClaim={claimToday} />
            </div>
        </SettingsGroup>
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
        gap: 22px;
        padding: 8px var(--space-16) var(--scroll-end);
    }

    // ---- the hero: an accent hero (native design notes §1 Surfaces), as the You tab's CHIT card

    .hero {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px;
        border-radius: 20px;
        background: linear-gradient(
            150deg,
            color-mix(in oklch, var(--accent) 26%, var(--hero-base)) 0%,
            var(--hero-base) 75%
        );
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
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
        gap: 5px;
    }

    .amount {
        font: 800 text-size(28px) / 1 var(--font-mono);
        letter-spacing: -0.02em;
    }

    .unit {
        margin-inline-start: 6px;
        font: var(--weight-semibold) text-size(12px) / 1 var(--font-mono);
        letter-spacing: 0.09em;
        color: var(--ink-3);
    }

    .lifetime {
        font: var(--weight-medium) text-size(12.5px) / 1.2 var(--font-sans);
        color: var(--ink-3);
    }

    // the streak in a ring that fills towards the next milestone
    .ring {
        flex: none;
        width: 56px;
        height: 56px;
        border-radius: var(--radius-circle);
        @include flex-center;
        background: conic-gradient(
            var(--status-chit) calc(var(--fill) * 360deg),
            var(--tint-pill) 0
        );
    }

    .ring-inner {
        width: 46px;
        height: 46px;
        border-radius: var(--radius-circle);
        @include flex-center;
        gap: 2px;
        background: var(--hero-base);
    }

    .streak-icon {
        @include icon(flame, 14px, var(--status-chit));
    }

    .streak-count {
        font: 800 text-size(15px) / 1 var(--font-mono);
    }

    .milestone-line {
        margin: 0;
        font: var(--weight-medium) text-size(13px) / 1.3 var(--font-sans);
        color: var(--ink-2);
    }

    // the last seven days, today last
    .strip {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .strip-day {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    .strip-mark {
        width: 30px;
        height: 30px;
        box-sizing: border-box;
        border-radius: var(--radius-circle);
        background: var(--tint-pill);
        position: relative;

        &::after {
            content: "";
            position: absolute;
            inset: 0;
            margin: auto;
            width: 14px;
            height: 14px;
        }

        [data-state="claimed"] & {
            background: var(--status-chit);

            &::after {
                mask: var(--icon-check) center/contain no-repeat;
                background: var(--on-accent);
            }
        }

        [data-state="insured"] & {
            background: color-mix(in oklch, var(--status-chit) 30%, transparent);

            &::after {
                mask: var(--icon-shield) center/contain no-repeat;
                background: var(--status-chit);
            }
        }

        [data-state="missed"] & {
            &::after {
                mask: var(--icon-close) center/contain no-repeat;
                background: var(--ink-4);
            }
        }

        [data-state="open"] & {
            border: 2px dashed var(--status-chit);
            background: none;
        }

        [data-state="none"] & {
            opacity: 0.4;
        }
    }

    .strip-name {
        font: var(--weight-semibold) text-size(11px) / 1 var(--font-sans);
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
        gap: 12px;
        min-height: var(--touch-target);
        padding: 12px 14px;
        border: 0;
        border-radius: 14px;
        background: var(--tint-row);
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:disabled {
            cursor: default;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .row-icon {
        flex: none;

        &.shield {
            @include icon(shield, 18px, var(--status-chit));
        }

        &.joystick {
            @include icon(joystick, 18px, var(--accent-bright));
        }
    }

    .row-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .row-label {
        font: var(--weight-semibold) text-size(14.5px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .row-sub {
        font: var(--weight-medium) text-size(12.5px) / 1.3 var(--font-sans);
        color: var(--ink-3);
        @include truncate;
    }

    .chevron {
        flex: none;
        @include icon(chevron-right, 16px, var(--ink-4));
    }

    // ---- Streak milestones

    .milestone {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 56px;
        padding: 8px 16px;
        box-sizing: border-box;
    }

    .milestone-icon {
        flex: none;
        @include icon(flame, 18px, var(--ink-4));

        .reached & {
            background: var(--status-chit);
        }
    }

    .milestone-state {
        flex: none;
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-4);

        .reached & {
            color: var(--status-chit);
        }

        .next & {
            color: var(--accent-bright);
        }
    }

    // ---- the latest achievements, under a heading with View all

    .achievements {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-inline-start: 4px;
    }

    .view-all {
        min-height: var(--touch-target);
        padding: 0 4px;
        border: 0;
        background: none;
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        color: var(--accent-bright);
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
        gap: 12px;
        min-height: 52px;
        padding: 8px 16px;
        box-sizing: border-box;
    }

    .trophy {
        flex: none;
        @include icon(trophy, 18px, var(--status-chit));
    }

    .reward {
        flex: none;
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-mono);
        color: var(--status-chit);
    }

    .none {
        margin: 0;
        padding: 14px 16px;
        font: var(--weight-regular) text-size(13.5px) / 1.45 var(--font-sans);
        color: var(--ink-3);
    }

    .calendar {
        padding: 12px;
    }
</style>
