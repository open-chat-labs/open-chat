<!-- Streak insurance (native plan 14, design notes §3.10), pushed from CHIT's hero: the cover held
     (insured for N days, or none and the streak at risk) over a bar a day of cover, Add cover with
     its stepper and what each day added costs (each day of cover costs twice the one before it,
     priced on its place in the cover), and pinned under it the CHAT balance and "Buy N days · X
     CHAT". Paid
     in CHAT as the web's StreakInsuranceDialog (logic/chit/streakInsurance: the prices, the
     spendable balance and what's sent, worked out from the cover bought, never the screen's
     figure). Never in an app store build (screens.ts): no purchase in tokens. A user with a PIN is
     told it comes with the wallet's PIN sheet (N10b), which the client's prompt needs. -->
<script lang="ts">
    import {
        chitStateStore,
        cryptoBalanceStore,
        currentStreak,
        enhancedCryptoLookup,
        LEDGER_CANISTER_CHAT,
        pinNumberRequiredStore,
        streakInsuranceStore,
        type OpenChat,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import {
        insuranceQuote,
        streakInsuranceBalance,
        streakInsuranceDialogPrices,
        streakInsurancePurchase,
    } from "@src/logic/chit/streakInsurance";
    import { now500 } from "@src/stores/time";
    import { getContext, onMount, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "streak_insurance" }>> = $props();

    const client = getContext<OpenChat>("client");
    const num = (n: number) => n.toLocaleString($locale ?? "en");

    // the CHAT that can be spent: the balance less the approval's fee, as it is now (a wallet not
    // loaded yet, or CHAT moved since, would offer what can't be paid)
    onMount(() => {
        client.refreshAccountBalance(LEDGER_CANISTER_CHAT);
    });
    const balance = $derived(
        streakInsuranceBalance(
            $cryptoBalanceStore.get(LEDGER_CANISTER_CHAT) ?? 0n,
            $enhancedCryptoLookup.get(LEDGER_CANISTER_CHAT)?.transferFee,
        ),
    );

    let picked = $state(1);
    const quote = $derived(
        insuranceQuote(
            streakInsuranceDialogPrices($streakInsuranceStore),
            $streakInsuranceStore,
            picked,
            balance,
        ),
    );

    // a bar a day of cover: held, being added, or still open; seven at least, a row of seven each
    const SLOTS = 7;
    const slots = $derived(
        Array.from({ length: Math.max(SLOTS, quote.held + quote.days) }, (_, i) =>
            i < quote.held ? "held" : i < quote.held + quote.days ? "adding" : "open",
        ),
    );
    const covered = $derived(quote.held > 0);
    const streak = $derived(currentStreak($chitStateStore, $now500));
    // the cheapest day to add, for "Cover starts at …"
    const firstPrice = $derived(quote.ladder[0]?.price);

    let buying = $state(false);
    let pinNotice = $state(false);
    useOverlay(
        untrack(() => context.overlays),
        () => pinNotice,
        () => (pinNotice = false),
    );

    async function buy() {
        if (!quote.canBuy || buying) return;
        // the client asks for the PIN through a prompt the native tree doesn't show yet (N10b)
        if ($pinNumberRequiredStore) {
            pinNotice = true;
            return;
        }
        const { days, price } = streakInsurancePurchase($streakInsuranceStore, quote.days);
        if (days === 0) return;
        buying = true;
        try {
            const resp = await client.payForStreakInsurance(days, price);
            if (resp.kind === "success") {
                context.toast($_("native.chit.insuranceBought", { values: { count: days } }));
                picked = 1;
                context.back?.();
            } else {
                context.toast($_("ui.streakInsuranceDialog.buyFailed"));
            }
        } catch (err) {
            // the PIN prompt given up is nothing bought, by choice
            if (err !== "cancelled") {
                console.warn("Unable to buy streak insurance", err);
                context.toast($_("ui.streakInsuranceDialog.buyFailed"));
            }
        } finally {
            buying = false;
        }
    }
</script>

<div class="insurance">
    <NativePageHeader title={$_("native.chit.insurance")} onBack={context.back} />

    <div class="body">
        <section class="hero" class:covered>
            <span class="hero-tile"><span class="hero-icon"></span></span>
            <span class="hero-text">
                <span class="hero-title">
                    {covered
                        ? $_("native.chit.insuredFor", { values: { count: quote.held } })
                        : $_("native.chit.noInsurance")}
                </span>
                <span class="hero-hint">
                    {covered
                        ? $_("native.chit.insuranceHintOn", { values: { streak } })
                        : $_("native.chit.insuranceHintOff", {
                              values: { streak, price: num(firstPrice ?? 0) },
                          })}
                </span>
            </span>
            <ol
                class="slots"
                aria-label={covered
                    ? $_("native.chit.insuredFor", { values: { count: quote.held } })
                    : $_("native.chit.noInsurance")}>
                {#each slots as state, i (i)}
                    <li class="slot" data-state={state} aria-hidden="true">
                        <span class="slot-bar"></span>
                        <span class="slot-n">{i + 1}</span>
                    </li>
                {/each}
            </ol>
            {#if quote.used > 0}
                <span class="used">
                    {$_("native.chit.insuranceUsed", { values: { count: quote.used } })}
                </span>
            {/if}
        </section>

        {#if quote.room > 0}
            <SettingsGroup
                label={$_("native.chit.insuranceAdd")}
                note={$_("native.chit.insuranceLadderNote")}>
                <div class="settings-row stepper">
                    <span class="stepper-text">
                        <span class="stepper-days" aria-live="polite">
                            {$_("native.you.chit.streak", { values: { count: quote.days } })}
                        </span>
                        <span class="stepper-room">
                            {$_("native.chit.insuranceUpTo", { values: { count: quote.room } })}
                        </span>
                    </span>
                    <button
                        type="button"
                        class="step"
                        aria-label={$_("native.chit.insuranceFewer")}
                        disabled={quote.days <= 1}
                        onclick={() => (picked = Math.max(quote.days - 1, 1))}>
                        <span class="step-icon minus"></span>
                    </button>
                    <span class="count">{num(quote.days)}</span>
                    <button
                        type="button"
                        class="step"
                        aria-label={$_("native.chit.insuranceMore")}
                        disabled={quote.days >= quote.room}
                        onclick={() => (picked = Math.min(quote.days + 1, quote.room))}>
                        <span class="step-icon plus"></span>
                    </button>
                </div>
                {#each quote.ladder.filter((r) => r.adding) as rung (rung.position)}
                    <div class="settings-row rung">
                        <span class="rung-day">
                            {$_("native.chit.insuranceDay", { values: { n: rung.position + 1 } })}
                        </span>
                        <span class="rung-price">{num(rung.price)} CHAT</span>
                    </div>
                {/each}
            </SettingsGroup>
        {/if}
    </div>

    <div class="footer">
        <span class="balance" class:short={quote.room > 0 && !quote.affordable}>
            {$_("native.chit.insuranceBalance")}
            <span class="balance-amount">{num(balance)} CHAT</span>
        </span>
        <Button
            size="lg"
            fullWidth
            icon="shield"
            busy={buying}
            disabled={!quote.canBuy}
            label={quote.room === 0
                ? $_("native.chit.insuranceFull")
                : $_("native.chit.insuranceBuy", {
                      values: { count: quote.days, amount: num(quote.total) },
                  })}
            onClick={buy} />
    </div>
</div>

<NativeAlert
    open={pinNotice}
    title={$_("native.chit.insurance")}
    message={$_("native.chit.insurancePinSoon")}
    cancelLabel={$_("close")}
    onClose={() => (pinNotice = false)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .insurance {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 12px var(--space-16) var(--space-16);
    }

    // ---- the cover held: a warning tint with none, the online colour once there's some

    .hero {
        --hero-ink: var(--status-warning);
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        padding: 24px 18px 20px;
        border-radius: 20px;
        background: color-mix(in oklch, var(--status-warning) 10%, transparent);
        text-align: center;

        &.covered {
            --hero-ink: var(--status-online);
            background: var(--overlay-1);
        }
    }

    .hero-tile {
        width: 64px;
        height: 64px;
        @include flex-center;
        border-radius: 20px;
        background: color-mix(in oklch, var(--hero-ink) 18%, transparent);

        .covered & {
            background: color-mix(in oklch, var(--hero-ink) 14%, transparent);
        }
    }

    .hero-icon {
        @include icon(shield, 30px, var(--hero-ink));
    }

    .hero-text {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .hero-title {
        font: 800 text-size(22px) / 1.15 var(--font-sans);
    }

    .hero-hint {
        font: var(--weight-medium) text-size(13.5px) / 1.45 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .slots {
        align-self: stretch;
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 10px 6px;
        margin: 0;
        padding: 4px 0 0;
        list-style: none;
    }

    .slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    .slot-bar {
        width: 100%;
        height: 8px;
        border-radius: 4px;
        background: var(--overlay-2);

        [data-state="held"] & {
            background: var(--status-online);
        }

        [data-state="adding"] & {
            background: color-mix(in oklch, var(--accent) 45%, transparent);
            box-shadow: inset 0 0 0 1px var(--accent);
        }
    }

    .slot-n {
        font: var(--weight-semibold) text-size(10px) / 1 var(--font-mono);
        color: var(--ink-4);

        [data-state="held"] & {
            color: var(--status-online);
        }

        [data-state="adding"] & {
            color: var(--accent-bright);
        }
    }

    .used {
        font: var(--weight-medium) text-size(12px) / 1.3 var(--font-sans);
        color: var(--ink-4);
    }

    // ---- Add cover: the stepper, then a line a day added with its price

    .stepper {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 64px;
        padding: 10px 10px 10px 16px;
        box-sizing: border-box;
    }

    .stepper-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .stepper-days {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
    }

    .stepper-room {
        font: var(--weight-regular) text-size(12.5px) / 1.3 var(--font-sans);
        color: var(--ink-3);
    }

    .step {
        flex: none;
        width: 44px;
        height: 44px;
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: 12px;
        background: var(--overlay-2);
        cursor: pointer;

        &:disabled {
            opacity: 0.35;
            cursor: default;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .step-icon {
        &.minus {
            @include icon(minus, 16px, var(--ink));
        }

        &.plus {
            @include icon(plus, 16px, var(--ink));
        }
    }

    .count {
        min-width: 28px;
        text-align: center;
        font: var(--weight-bold) text-size(17px) / 1 var(--font-mono);
    }

    .rung {
        display: flex;
        align-items: center;
        min-height: 44px;
        padding: 0 16px;
        box-sizing: border-box;
    }

    .rung-day {
        flex: 1;
        font: var(--weight-medium) text-size(13.5px) / 1 var(--font-sans);
        color: var(--ink-2);
    }

    .rung-price {
        font: var(--weight-semibold) text-size(13.5px) / 1 var(--font-mono);
    }

    // ---- pinned: the balance, then Buy

    .footer {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px var(--space-16) var(--bar-end);
    }

    .balance {
        display: flex;
        justify-content: center;
        gap: 6px;
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .balance-amount {
        font-family: var(--font-mono);
        font-weight: var(--weight-semibold);
        color: var(--ink-2);

        // too little for the days picked
        .short & {
            color: var(--status-danger);
        }
    }
</style>
