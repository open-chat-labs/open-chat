<!-- Streak insurance (native plan 14, design notes §3.10), pushed from CHIT's hero: the cover held
     as seven slots, a stepper for the days to add, the price ladder (each day of cover costs twice
     the one before it, priced on its place in the cover), and the pinned "Buy N days · X CHAT". Paid
     in CHAT as the web's StreakInsuranceDialog (logic/chit/streakInsurance: the prices, the
     spendable balance and what's sent, worked out from the cover bought, never the screen's
     figure). Never in an app store build (screens.ts): no purchase in tokens. A user with a PIN is
     told it comes with the wallet's PIN sheet (N10b), which the client's prompt needs. -->
<script lang="ts">
    import {
        cryptoBalanceStore,
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
        insuranceQuote(streakInsuranceDialogPrices($streakInsuranceStore), $streakInsuranceStore, picked, balance),
    );

    // seven slots of cover held; more than seven shows as "+N" on the last
    const SLOTS = 7;
    const slots = $derived(Array.from({ length: SLOTS }, (_, i) => i < quote.held));
    const overflow = $derived(Math.max(quote.held - SLOTS, 0));

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
        <p class="intro">{$_("native.chit.insuranceIntro")}</p>

        <SettingsGroup
            label={$_("native.chit.insuranceHolding")}
            note={quote.used > 0
                ? $_("native.chit.insuranceUsed", { values: { count: quote.used } })
                : ""}>
            <div class="settings-row holding">
                <div class="slots" role="img" aria-label={$_("native.chit.insuranceHeld", { values: { count: quote.held } })}>
                    {#each slots as held, i (i)}
                        <span class="slot" class:held class:adding={!held && i < quote.held + quote.days}>
                            {#if i === SLOTS - 1 && overflow > 0}
                                <span class="more">+{overflow}</span>
                            {:else}
                                <span class="slot-icon"></span>
                            {/if}
                        </span>
                    {/each}
                </div>
                <span class="holding-text">
                    {$_("native.chit.insuranceHeld", { values: { count: quote.held } })}
                </span>
            </div>
        </SettingsGroup>

        {#if quote.room > 0}
            <SettingsGroup label={$_("native.chit.insuranceAdd")}>
                <div class="settings-row stepper">
                    <button
                        type="button"
                        class="step"
                        aria-label={$_("native.chit.insuranceFewer")}
                        disabled={quote.days <= 1}
                        onclick={() => (picked = Math.max(quote.days - 1, 1))}>
                        <span class="step-icon minus"></span>
                    </button>
                    <span class="count" aria-live="polite">
                        {$_("native.you.chit.streak", { values: { count: quote.days } })}
                    </span>
                    <button
                        type="button"
                        class="step"
                        aria-label={$_("native.chit.insuranceMore")}
                        disabled={quote.days >= quote.room}
                        onclick={() => (picked = Math.min(quote.days + 1, quote.room))}>
                        <span class="step-icon plus"></span>
                    </button>
                </div>
            </SettingsGroup>

            <SettingsGroup label={$_("native.chit.insuranceLadder")} note={$_("native.chit.insuranceLadderNote")}>
                {#each quote.ladder as rung (rung.position)}
                    <div class="settings-row rung" class:adding={rung.adding}>
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
        {#if quote.room > 0 && !quote.affordable}
            <p class="short">
                {$_("native.chit.insuranceShort", { values: { amount: num(balance) } })}
            </p>
        {/if}
        <Button
            size="lg"
            fullWidth
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
        gap: 22px;
        padding: 8px var(--space-16) var(--space-16);
    }

    .intro {
        margin: 0;
        padding: 0 4px;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .holding {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
    }

    .slots {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 6px;
    }

    .slot {
        aspect-ratio: 1;
        @include flex-center;
        border-radius: 12px;
        background: var(--overlay-2);

        &.held {
            background: var(--status-chit);
        }

        &.adding {
            box-shadow: inset 0 0 0 2px var(--status-chit);
            background: color-mix(in oklch, var(--status-chit) 16%, transparent);
        }
    }

    .slot-icon {
        @include icon(shield, 16px, var(--ink-4));

        .held & {
            background: var(--on-accent);
        }

        .adding & {
            background: var(--status-chit);
        }
    }

    .more {
        font: 800 text-size(12px) / 1 var(--font-mono);
        color: var(--on-accent);
    }

    .holding-text {
        font: var(--weight-semibold) text-size(14px) / 1.2 var(--font-sans);
    }

    .stepper {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px;
    }

    .step {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: var(--overlay-2);
        cursor: pointer;

        &:disabled {
            opacity: 0.4;
            cursor: default;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .step-icon {
        &.minus {
            @include icon(minus, 18px, var(--ink));
        }

        &.plus {
            @include icon(plus, 18px, var(--ink));
        }
    }

    .count {
        font: 800 text-size(18px) / 1 var(--font-mono);
    }

    .rung {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 48px;
        padding: 8px 16px;
        box-sizing: border-box;
        font: var(--weight-medium) text-size(14px) / 1.2 var(--font-sans);
        color: var(--ink-3);

        &.adding {
            color: var(--ink);
            background: color-mix(in oklch, var(--status-chit) 12%, transparent);
        }
    }

    .rung-price {
        font: var(--weight-semibold) text-size(13.5px) / 1 var(--font-mono);

        .adding & {
            color: var(--status-chit);
        }
    }

    .footer {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px var(--space-16) var(--bar-end);
    }

    .short {
        margin: 0;
        text-align: center;
        font: var(--weight-medium) text-size(12.5px) / 1.3 var(--font-sans);
        color: var(--status-danger);
    }
</style>
