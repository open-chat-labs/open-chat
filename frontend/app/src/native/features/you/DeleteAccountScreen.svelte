<!-- Delete account (You → Account), pushed: the design's steps before an account goes (the export's
     profile has them; the native prototype only says it's "a separate confirm screen in the real
     app"): what goes with it, the chats, the wallet and the CHIT, each offering to stay, then the
     last step, which takes the @username typed out before it asks for a sign-in again and deletes
     (DeleteAccountSheet: logic/auth's ReAuthentication, then deleteAccount). Staying at any step
     goes back to Account. Back goes a step back, and from the first, to Account. -->
<script lang="ts">
    import { chitStateStore, currentStreak, currentUserProfileStore } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { now500 } from "@src/stores/time";
    import { untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import {
        DELETE_STEPS,
        emphasised,
        marked,
        neverEarnedChit,
        nextMilestone,
        usernameTyped,
    } from "./deleteAccount.adapter";
    import DeleteAccountSheet from "./settings/DeleteAccountSheet.svelte";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "delete_account" }>> = $props();
    const overlays = untrack(() => context.overlays);

    let index = $state(0);
    const step = $derived(DELETE_STEPS[index]);
    const final = $derived(step === "final");

    const username = $derived($currentUserProfileStore.username);
    let typed = $state("");
    const confirmed = $derived(usernameTyped(typed, username));

    // ---- what's lost in CHIT

    const balance = $derived($chitStateStore.chitBalance);
    const earned = $derived($chitStateStore.totalChitEarned);
    const streak = $derived(currentStreak($chitStateStore, $now500));
    const noChit = $derived(neverEarnedChit(balance, earned));
    const number = (n: number) => n.toLocaleString($locale ?? "en");
    const milestone = $derived.by(() => {
        const next = nextMilestone(streak);
        return next.kind === "all"
            ? $_("native.you.deleteAccount.allMilestones")
            : $_("native.you.deleteAccount.nextMilestone", {
                  values: { days: next.days, milestone: next.milestone },
              });
    });

    // ---- each step's words: its icon, title, what it says (with its emphasis), and its buttons

    type Copy = {
        icon: string | undefined;
        title: string;
        body: string;
        stay: string;
        stayIcon: string;
        next: string;
    };

    const k = (key: string) => `native.you.deleteAccount.${key}`;
    const t = (key: string, values?: Record<string, string | number>) => $_(k(key), { values });

    const copy: Copy = $derived.by(() => {
        switch (step) {
            case "chats":
                return {
                    icon: "chat",
                    title: t("step1Title"),
                    body: t("step1Body", { gone: marked(t("step1Gone")) }),
                    stay: t("step1Stay"),
                    stayIcon: "heart",
                    next: t("step1Next"),
                };
            case "wallet":
                return {
                    icon: "wallet",
                    title: t("step2Title"),
                    body: t("step2Body", { moveOut: marked(t("step2MoveOut")) }),
                    stay: t("step2Stay"),
                    stayIcon: "wallet",
                    next: t("step2Next"),
                };
            case "chit":
                return noChit
                    ? {
                          icon: "zap",
                          title: t("step3NoChitTitle"),
                          body: t("step3NoChitBody"),
                          stay: t("step3NoChitStay"),
                          stayIcon: "zap",
                          next: t("step3Next"),
                      }
                    : {
                          icon: undefined,
                          title: t("step3Title"),
                          body: t("step3Body", {
                              balance: marked(t("chitAmount", { amount: number(balance) })),
                              streak: marked(t("streak", { count: streak })),
                          }),
                          stay: t("step3Stay"),
                          stayIcon: "zap",
                          next: t("step3Next"),
                      };
            case "final":
                return {
                    icon: "trash",
                    title: t("step4Title"),
                    body: t("step4Body", { gone: marked(t("step4Gone")) }),
                    stay: t("step4Stay"),
                    stayIcon: "heart",
                    next: t("reauthenticate"),
                };
        }
    });

    // ---- moving through it

    // the sheet that signs in again and deletes, mounted again each time it opens. Android's back
    // closes it as its own close does: that stops an emailed link's sign-in, and does nothing while
    // the account's being deleted.
    let signingIn = $state(false);
    let sheetKey = $state(0);
    let sheet: ReturnType<typeof DeleteAccountSheet> | undefined = $state();
    useOverlay(
        overlays,
        () => signingIn,
        () => (sheet !== undefined ? sheet.close() : (signingIn = false)),
        () => sheet?.isDeleting() ?? false,
    );
    // Android's back goes a step back, as the header's does
    useOverlay(
        overlays,
        () => index > 0 && !signingIn,
        () => (index = Math.max(0, index - 1)),
    );

    function back() {
        if (index > 0) index--;
        else context.back?.();
    }

    function stay() {
        context.back?.();
    }

    function onward() {
        if (!final) {
            index++;
            return;
        }
        if (!confirmed) return;
        sheetKey++;
        signingIn = true;
    }
</script>

<div class="delete">
    <NativePageHeader title={$_("danger.deleteAccount")} onBack={back}>
        <span class="step-of">
            {t("stepOf", { step: index + 1, total: DELETE_STEPS.length })}
        </span>
    </NativePageHeader>

    <div class="dots" aria-hidden="true">
        {#each DELETE_STEPS as s, i (s)}
            <span class="dot" class:passed={i <= index} class:final={s === "final"}></span>
        {/each}
    </div>

    <div class="body" {@attach aboveKeyboard()}>
        {#key step}
            <div class="step">
                {#if copy.icon !== undefined}
                    <span class="tile" class:final>
                        <span class="tile-icon" style:mask="var(--icon-{copy.icon}) center/contain no-repeat"
                        ></span>
                    </span>
                {/if}
                <h2 class="title">{copy.title}</h2>
                <p class="text">
                    {#each emphasised(copy.body) as part, i (i)}
                        {#if part.strong}<strong>{part.text}</strong>{:else}{part.text}{/if}
                    {/each}
                </p>

                {#if step === "chit" && !noChit}
                    <div class="chit">
                        <div class="chit-pair">
                            <span class="chit-cell">
                                <span class="chit-label">
                                    <span class="flame"></span>{t("dayStreak")}
                                </span>
                                <span class="chit-figure">{number(streak)}</span>
                            </span>
                            <span class="chit-cell ruled">
                                <span class="chit-label">{t("chitBalance")}</span>
                                <span class="chit-figure">{number(balance)}</span>
                            </span>
                        </div>
                        <div class="chit-foot">
                            <span>{milestone}</span>
                            <span>{t("earnedTotal", { amount: number(earned) })}</span>
                        </div>
                    </div>
                {/if}

                {#if final}
                    <label class="confirm">
                        <span class="confirm-label">{t("typeToConfirm", { username: `@${username}` })}</span>
                        <input
                            class:match={confirmed}
                            value={typed}
                            oninput={(e) => (typed = e.currentTarget.value)}
                            placeholder={`@${username}`}
                            autocomplete="off"
                            autocapitalize="none"
                            spellcheck="false" />
                    </label>
                {/if}
            </div>
        {/key}
    </div>

    <div class="footer">
        {#if final}
            <Button
                label={copy.next}
                variant="danger"
                icon="trash"
                size="lg"
                fullWidth
                disabled={!confirmed}
                onClick={onward} />
            <button type="button" class="secondary" onclick={stay}>
                {copy.stay}<span class="secondary-icon heart"></span>
            </button>
        {:else}
            <Button label={copy.stay} icon={copy.stayIcon} size="lg" fullWidth onClick={stay} />
            <button type="button" class="secondary" onclick={onward}>
                {copy.next}<span class="secondary-icon chevron"></span>
            </button>
        {/if}
    </div>
</div>

{#key sheetKey}
    {#if sheetKey > 0}
        <DeleteAccountSheet bind:this={sheet} open={signingIn} onClose={() => (signingIn = false)} />
    {/if}
{/key}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .delete {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .step-of {
        padding-inline-end: 12px;
        font: var(--weight-semibold) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-3);
        white-space: nowrap;
    }

    .dots {
        flex: none;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        padding: 4px var(--space-16) 0;
    }

    .dot {
        height: 3px;
        border-radius: var(--radius-pill);
        background: var(--overlay-2);
        transition: background 0.2s;

        &.passed {
            background: var(--ink);
        }

        &.passed.final {
            background: var(--status-danger);
        }

        @media (prefers-reduced-motion: reduce) {
            transition: none;
        }
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        padding: 28px var(--space-16) var(--space-16);
    }

    .step {
        display: flex;
        flex-direction: column;
        gap: 14px;
        animation: oc-step-in 0.24s var(--ease-out) both;

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    .tile {
        width: 64px;
        height: 64px;
        @include flex-center;
        border-radius: 20px;
        background: var(--overlay-2);

        &.final {
            background: var(--btn-danger-bg);
        }
    }

    .tile-icon {
        width: 30px;
        height: 30px;
        background: var(--ink);

        .final & {
            background: var(--status-danger);
        }
    }

    .title {
        margin: 6px 0 0;
        font: 800 text-size(24px) / 1.2 var(--font-sans);
        letter-spacing: -0.015em;
        text-wrap: balance;
    }

    .text {
        margin: 0;
        font: var(--weight-regular) text-size(15px) / 1.55 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;

        strong {
            font-weight: var(--weight-semibold);
            color: var(--ink);
        }
    }

    // the streak and the balance that would go, on an accent hero (native design notes §1)
    .chit {
        margin-top: 6px;
        border-radius: 20px;
        overflow: hidden;
        background: linear-gradient(
            150deg,
            color-mix(in oklch, var(--accent) 26%, var(--hero-base)) 0%,
            var(--hero-base) 75%
        );
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
    }

    .chit-pair {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .chit-cell {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 18px;

        &.ruled {
            border-inline-start: 1px solid var(--line-1);
        }
    }

    .chit-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    .flame {
        @include icon(flame, 13px, var(--status-chit));
    }

    .chit-figure {
        font: 800 text-size(28px) / 1 var(--font-mono);
        letter-spacing: -0.02em;
    }

    .chit-foot {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 18px 14px;
        background: var(--tint-row);
        font: var(--weight-medium) text-size(12.5px) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }

    .confirm {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
    }

    .confirm-label {
        padding: 0 4px;
        font: var(--weight-medium) text-size(13px) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }

    input {
        height: 52px;
        padding: 0 var(--space-16);
        border: 0;
        outline: 0;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink);
        font: var(--weight-semibold) text-size(16px) / 1 var(--font-mono);

        &::placeholder {
            color: var(--ink-4);
        }

        &:focus {
            box-shadow: inset 0 0 0 1.5px var(--line-2);
        }

        &.match {
            box-shadow: inset 0 0 0 1.5px var(--status-danger);
        }
    }

    .footer {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px var(--space-16) var(--bar-end);
    }

    .secondary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: var(--touch-target);
        padding: 0 12px;
        border: 0;
        background: none;
        color: var(--ink-3);
        font: var(--weight-semibold) text-size(14.5px) / 1.2 var(--font-sans);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .secondary-icon {
        &.chevron {
            @include icon(chevron-right, 14px);
        }

        &.heart {
            @include icon(heart, 14px);
        }

        :global([dir="rtl"]) &.chevron {
            transform: scaleX(-1);
        }
    }
</style>
