<!-- Swap (native design notes §3.9 Flows; the plan's 13): You pay (the amount, the token pill: the
     held tokens an exchange swaps, its sheet opening by itself when Swap starts from the wallet;
     the balance and quick picks) over You get (the quoted amount, the token pill: what an exchange
     has a pool for with it, searched), Max slippage, then Get quote: every supported exchange is
     asked and the best shown, named, with how many were checked, the rate and the least that will
     arrive. Swap asks for the PIN (the client's prompt, the shell's PIN sheet), then shows the
     three steps, Deposit → Swap → Withdraw, and Done lands on the bought token's page. It's the web's
     swap: SwapForm (shared with both old trees) drives it, with the web's rules (6c: no quote where
     swapping is restricted, the minimum output from the slippage chosen, a value warning confirmed
     first, exact amounts). A dismissed PIN goes back to the quote; a failure says why. -->
<script lang="ts">
    import {
        dexName,
        enhancedCryptoLookup,
        formatTokens,
        pinNumberResolverStore,
        swapMinimumOut,
        swappableTokensStore,
        type EnhancedTokenDetails,
        type OpenChat,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import TokenAvatar from "@openchat/ui/src/lib/components/TokenAvatar.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { interpolateNewUi } from "@src/i18n/i18n";
    import { canPayWith, SwapForm } from "@src/logic/wallet/swapForm.svelte";
    import { dexesChecked, swapAnswer, swapStepIndex } from "@src/logic/wallet/swapQuote";
    import { amountUnits } from "@src/logic/wallet/walletSend";
    import { TokenState } from "@src/logic/wallet/walletState.svelte";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import { useOverlay } from "../../shell/overlays.svelte";
    import { pinAction } from "../../shell/pinAction.svelte";
    import type { ScreenContext } from "../app/screens";
    import FlowResult from "./FlowResult.svelte";
    import {
        cleanAmount,
        DEFAULT_SLIPPAGE_INDEX,
        displayValue,
        quickAmount,
        SLIPPAGES,
        swapCheck,
        swapRate,
        tokenFace,
        type QuickPick,
    } from "./flows.adapter";
    import QuickPicks from "./QuickPicks.svelte";
    import SummaryRows, { type SummaryRow } from "./SummaryRows.svelte";
    import SupportedTokensSheet from "./SupportedTokensSheet.svelte";
    import { tokenUrl, type WalletFigures } from "./wallet.adapter";

    type Props = { ledger: string | undefined; context: ScreenContext; figures: WalletFigures };

    let { ledger, context, figures }: Props = $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);

    // ---- the form: made for the token paid with, once there's one

    function formFor(token: EnhancedTokenDetails): SwapForm {
        return new SwapForm(client, new TokenState(token, "usd"));
    }
    const first = untrack(() => (ledger === undefined ? undefined : $enhancedCryptoLookup.get(ledger)));
    let form = $state<SwapForm | undefined>(first === undefined ? undefined : formFor(first));
    let amountText = $state("");
    let slippage = $state<number>(DEFAULT_SLIPPAGE_INDEX);

    const payId = $derived(form?.inToken.ledger);
    const getId = $derived(form?.outToken?.ledger);
    const pay = $derived(payId === undefined ? undefined : $enhancedCryptoLookup.get(payId));
    const get = $derived(getId === undefined ? undefined : $enhancedCryptoLookup.get(getId));
    const payFace = $derived(tokenFace(figures, payId));
    const getFace = $derived(tokenFace(figures, getId));

    // what can be paid with (held and swappable), and bought with it (null while that's loading)
    const payable = $derived(
        new Set(
            [...$enhancedCryptoLookup.values()]
                .filter((t) => canPayWith(t, $swappableTokensStore, undefined))
                .map((t) => t.ledger),
        ),
    );
    const targets = $derived.by((): Set<string> | null => {
        if (form === undefined || form.swapsFor !== form.inToken.ledger) return null;
        const inLedger = form.inToken.ledger;
        return new Set(Object.keys(form.swaps).filter((l) => l !== inLedger));
    });

    const quote = $derived(form?.stage === "confirm" ? form.quote : undefined);
    const check = $derived(
        swapCheck({
            from:
                pay === undefined
                    ? undefined
                    : {
                          symbol: pay.symbol,
                          decimals: pay.decimals,
                          transferFee: pay.transferFee,
                          balance: pay.balance,
                      },
            toChosen: get !== undefined,
            amountText,
            restricted: form?.restricted,
            quoting: form?.busy === true && form.stage !== "swapping",
            quoted: quote !== undefined,
            warning: quote?.valueWarning !== undefined,
            warningConfirmed: form?.warningConfirmed === true,
        }),
    );

    const amountOf = (units: bigint, token: EnhancedTokenDetails | undefined) =>
        token === undefined ? "" : `${formatTokens(units, token.decimals)} ${token.symbol}`;

    // a changed amount drops the quote
    function typed(e: Event & { currentTarget: HTMLInputElement }) {
        const clean = cleanAmount(e.currentTarget.value, pay?.decimals ?? 8);
        if (e.currentTarget.value !== clean) e.currentTarget.value = clean;
        setAmount(clean);
    }

    function setAmount(text: string) {
        amountText = text;
        if (form !== undefined && form.stage !== "quote") form.backToQuote();
    }

    // Max is the whole balance: the swap's fees come out of it
    function quick(pick: QuickPick) {
        if (pay === undefined) return;
        setAmount(quickAmount(pay.balance, pick, pay.decimals));
    }

    // ---- the sheets

    let sheet = $state<"pay" | "get" | undefined>();
    useOverlay(
        overlays,
        () => sheet !== undefined,
        () => (sheet = undefined),
    );
    let asking: ReturnType<typeof setTimeout> | undefined;
    onMount(() => {
        if (form === undefined) asking = setTimeout(() => (sheet = "pay"), 380);
    });
    onDestroy(() => clearTimeout(asking));

    function pickPay(id: string) {
        sheet = undefined;
        const token = $enhancedCryptoLookup.get(id);
        if (token === undefined || id === payId) return;
        if (form === undefined) form = formFor(token);
        else form.selectIn(token);
        amountText = "";
    }

    function pickGet(id: string) {
        sheet = undefined;
        const token = $enhancedCryptoLookup.get(id);
        if (token === undefined || form === undefined || id === getId) return;
        form.selectOut(token);
    }

    // ---- the quote: every exchange asked, the best shown

    async function getQuote() {
        const f = form;
        if (f === undefined || pay === undefined) return;
        // none is asked for until the location check is in (6c invariant 1)
        if (await f.whenChecked()) return;
        f.backToQuote();
        f.inToken.draftAmount = amountUnits(amountText, pay.decimals);
        f.validAmount = f.inToken.draftAmount > 0n;
        await f.getQuote();
        if (f.quote === undefined && f.error !== undefined) {
            context.toast(interpolateNewUi($_, f.error));
        }
    }

    const quoteRows = $derived.by((): SummaryRow[] => {
        if (quote === undefined || pay === undefined || get === undefined || form === undefined) return [];
        const rate = swapRate(quote.amountIn, pay.decimals, quote.amountOut, get.decimals);
        const checked = dexesChecked(form.quotes);
        const dex = dexName(quote.dex);
        return [
            {
                label: $_("native.walletFlows.rate"),
                value: `1 ${pay.symbol} = ${rate.toLocaleString(figures.locale, { maximumFractionDigits: 6 })} ${get.symbol}`,
            },
            {
                label: $_("native.walletFlows.bestRate"),
                value: checked > 1 ? $_("native.walletFlows.bestOf", { values: { dex, count: checked } }) : dex,
            },
            {
                label: $_("native.walletFlows.minimumReceived"),
                value: amountOf(swapMinimumOut(quote.amountOut, SLIPPAGES[slippage]), get),
            },
        ];
    });

    const warning = $derived.by((): string | undefined => {
        if (quote?.valueWarning === undefined) return undefined;
        const values = Object.fromEntries(Object.entries(quote.values).map(([k, v]) => [k, String(v)]));
        return $_(
            quote.valueWarning === "dropped" ? "tokenSwap.warningValueDropped" : "tokenSwap.warningValueUnknown",
            { values },
        );
    });

    // ---- the swap

    type Progress = { kind: "form" } | { kind: "swapping"; step: number } | { kind: "swapped"; out: string };
    let progress = $state<Progress>({ kind: "form" });
    // what the steps name, as the swap started
    let swapping = $state<{ pay: string; get: string; payToken: string; getToken: string; dex: string; out: string; outLedger: string }>();

    async function swap() {
        const f = form;
        const q = quote;
        if (f === undefined || q === undefined || pay === undefined || get === undefined || payFace === undefined) return;
        const payAmount = amountOf(f.inToken.draftAmount, pay);
        swapping = {
            pay: payAmount,
            get: amountOf(q.amountOut, get),
            payToken: pay.symbol,
            getToken: get.symbol,
            dex: dexName(q.dex),
            out: amountOf(q.amountOut, get),
            outLedger: get.ledger,
        };
        const decimalsOut = get.decimals;
        progress = { kind: "swapping", step: 0 };
        const chip = {
            text: $_("native.walletFlows.pinSwap", { values: { amount: payAmount, symbol: get.symbol } }),
            amount: payAmount,
            token: { symbol: payFace.symbol, mark: payFace.mark, grad: payFace.grad, logo: payFace.logo },
        };
        await pinAction.during(chip, () =>
            f.swap(SLIPPAGES[slippage], (step) => {
                progress = { kind: "swapping", step: swapStepIndex(step) };
            }),
        );
        // the PIN prompt dismissed: back to the quote
        if (f.stage === "confirm") {
            progress = { kind: "form" };
            return;
        }
        const answer = swapAnswer(f.outcome, decimalsOut);
        switch (answer.kind) {
            case "swapped":
                progress = {
                    kind: "swapped",
                    out: `${answer.out.toLocaleString(figures.locale, { maximumFractionDigits: decimalsOut })} ${swapping.getToken}`,
                };
                return;
            case "not_sent":
                progress = { kind: "form" };
                return;
            case "failed":
                progress = { kind: "form" };
                f.backToQuote();
                context.toast(
                    answer.message === undefined
                        ? $_("native.walletFlows.swapFailed")
                        : interpolateNewUi($_, answer.message),
                );
                return;
        }
    }

    // the steps show once the PIN's in (while the PIN sheet is up, the form stays under it)
    const showProgress = $derived(
        progress.kind === "swapped" || (progress.kind === "swapping" && $pinNumberResolverStore === undefined),
    );
    const doneSteps = $derived(progress.kind === "swapped" ? 3 : progress.kind === "swapping" ? progress.step : 0);
    const steps = $derived(
        swapping === undefined
            ? []
            : [
                  $_("native.walletFlows.stepDeposit", { values: { amount: swapping.pay, dex: swapping.dex } }),
                  $_("native.walletFlows.stepSwap", { values: { from: swapping.payToken, to: swapping.getToken } }),
                  $_("native.walletFlows.stepWithdraw", { values: { amount: swapping.get } }),
              ],
    );

    function done() {
        if (swapping !== undefined) navigate(tokenUrl(swapping.outLedger));
    }

    const cta = $derived.by((): string => {
        switch (check.kind) {
            case "restricted":
                return $_("native.walletFlows.swapUnavailable");
            case "choose_tokens":
                return $_("native.walletFlows.chooseTokens");
            case "enter_amount":
                return $_("native.walletFlows.enterAmount");
            case "over_balance":
                return $_("native.walletFlows.notEnough", { values: { symbol: pay?.symbol ?? "" } });
            case "too_small":
                return $_("native.walletFlows.moreThan", { values: { amount: amountOf(check.minimum, pay) } });
            case "getting_quote":
                return $_("native.walletFlows.gettingQuote");
            case "get_quote":
                return $_("native.walletFlows.getQuote");
            case "confirm_warning":
            case "swap":
                return $_("native.walletFlows.swapFor", {
                    values: {
                        amount: amountOf(amountUnits(amountText, pay?.decimals ?? 8), pay),
                        out: quote === undefined ? "" : amountOf(quote.amountOut, get),
                    },
                });
        }
    });

    const payNote = $derived.by((): { text: string; warn: boolean } => {
        if (pay === undefined || payFace === undefined) {
            return { text: $_("native.walletFlows.choosePay"), warn: false };
        }
        if (check.kind === "over_balance") return { text: $_("native.walletFlows.overBalance"), warn: true };
        if (check.kind === "too_small") {
            return {
                text: $_("native.walletFlows.moreThan", { values: { amount: amountOf(check.minimum, pay) } }),
                warn: true,
            };
        }
        const units = amountUnits(amountText, pay.decimals);
        return { text: `≈ ${displayValue(figures, (Number(units) / 10 ** pay.decimals) * payFace.price)}`, warn: false };
    });

    const getNote = $derived.by((): string => {
        if (form?.busy === true && form.stage === "quote") return $_("native.walletFlows.comparing");
        if (quote !== undefined && get !== undefined && getFace !== undefined) {
            return `≈ ${displayValue(figures, (Number(quote.amountOut) / 10 ** get.decimals) * getFace.price)}`;
        }
        return get === undefined ? $_("native.walletFlows.chooseGet") : $_("native.walletFlows.quoteToSee");
    });
</script>

{#snippet pill(face: ReturnType<typeof tokenFace>, placeholder: string, onClick: () => void, label: string)}
    <button type="button" class="pill" aria-label={label} onclick={onClick}>
        {#if face !== undefined}
            <TokenAvatar size={32} symbol={face.symbol} mark={face.mark} gradient={face.grad} logo={face.logo} />
            <span class="pill-symbol">{face.symbol}</span>
        {:else}
            <span class="pill-choose">{placeholder}</span>
        {/if}
        <span class="pill-chevron" aria-hidden="true"></span>
    </button>
{/snippet}

<div class="flow">
    <NativePageHeader title={$_("native.wallet.swap")} onBack={context.back}>
        {#if !showProgress}
            <span class="step">
                {$_("native.walletFlows.stepOf", { values: { step: quote !== undefined ? 2 : 1, steps: 2 } })}
            </span>
        {/if}
    </NativePageHeader>

    {#if !showProgress}
        <div class="scroll" {@attach aboveKeyboard()}>
            {#if form?.restricted === true}
                <div class="notice">{$_("restricted.swap")}</div>
            {/if}

            <div class="cards">
                <div class="card">
                    <span class="card-head">
                        <span>{$_("native.walletFlows.youPay")}</span>
                        {#if pay !== undefined}
                            <span class="card-balance">
                                {$_("native.walletFlows.balance", { values: { amount: formatTokens(pay.balance, pay.decimals) } })}
                            </span>
                        {/if}
                    </span>
                    <div class="card-line">
                        <input
                            class="amount"
                            value={amountText}
                            oninput={typed}
                            inputmode="decimal"
                            autocomplete="off"
                            placeholder="0"
                            aria-label={$_("native.walletFlows.amountToPay")}
                            disabled={pay === undefined} />
                        {@render pill(payFace, $_("native.walletFlows.choose"), () => (sheet = "pay"), $_("native.walletFlows.youPay"))}
                    </div>
                    <span class="note" class:warn={payNote.warn}>{payNote.text}</span>
                    <QuickPicks onPick={quick} disabled={pay === undefined} />
                </div>
                <div class="arrow" aria-hidden="true"><span class="arrow-icon"></span></div>
                <div class="card">
                    <span class="card-head"><span>{$_("native.walletFlows.youGet")}</span></span>
                    <div class="card-line">
                        <span class="out" class:quoted={quote !== undefined}>
                            {quote !== undefined && get !== undefined ? formatTokens(quote.amountOut, get.decimals) : "0"}
                        </span>
                        {#if form?.busy && form.stage === "quote"}<Spinner size={18} label={getNote} />{/if}
                        {@render pill(getFace, $_("native.walletFlows.choose"), () => (sheet = "get"), $_("native.walletFlows.youGet"))}
                    </div>
                    <span class="note">{getNote}</span>
                </div>
            </div>

            <section>
                <div class="label"><ListSectionLabel label={$_("native.walletFlows.maxSlippage")} /></div>
                <SegmentedTabs
                    size="sm"
                    labels={SLIPPAGES.map((s) => `${s.toLocaleString(figures.locale)}%`)}
                    selectedIndex={slippage}
                    dotOnLast={false}
                    onSelect={(i) => (slippage = i)} />
            </section>

            {#if quote !== undefined}
                <SummaryRows rows={quoteRows} />
                {#if warning !== undefined}
                    <label class="warning">
                        <span class="warning-text">{warning}</span>
                        <span class="confirm">
                            <input
                                type="checkbox"
                                checked={form?.warningConfirmed === true}
                                onchange={(e) => form !== undefined && (form.warningConfirmed = e.currentTarget.checked)} />
                            {$_("native.walletFlows.understand")}
                        </span>
                    </label>
                {/if}
                <span class="hint">{$_("native.walletFlows.quoteHint")}</span>
            {/if}
        </div>
        <div class="foot">
            <Button
                label={cta}
                icon={check.kind === "swap" || check.kind === "confirm_warning" ? "swap" : "refresh"}
                size="lg"
                fullWidth
                busy={check.kind === "getting_quote" || progress.kind === "swapping"}
                disabled={!(check.kind === "get_quote" || check.kind === "swap")}
                onClick={() => (check.kind === "swap" ? swap() : getQuote())} />
        </div>
    {:else if swapping !== undefined}
        <div class="progress">
            <FlowResult
                done={progress.kind === "swapped"}
                title={$_(progress.kind === "swapped" ? "native.walletFlows.swapComplete" : "native.walletFlows.swapping")}
                sub={`${swapping.pay} → ${progress.kind === "swapped" ? progress.out : swapping.get}`}
                busyLabel={$_("native.walletFlows.swapping")} />
            <div class="steps">
                {#each steps as label, i (i)}
                    <div class="step-row">
                        <span class="step-dot" class:done={doneSteps > i} class:active={doneSteps === i}>
                            {#if doneSteps > i}
                                <span class="tick"></span>
                            {:else if doneSteps === i}
                                <Spinner size={14} label={label} />
                            {:else}
                                {i + 1}
                            {/if}
                        </span>
                        <span class="step-label" class:pending={doneSteps < i}>{label}</span>
                    </div>
                {/each}
            </div>
            {#if progress.kind === "swapped"}
                <span class="foot-note">{$_("native.walletFlows.swapDoneNote")}</span>
            {/if}
        </div>
        <div class="foot done-foot" class:shown={progress.kind === "swapped"} inert={progress.kind !== "swapped"}>
            <Button label={$_("native.walletFlows.done")} size="lg" fullWidth onClick={done} />
        </div>
    {/if}
</div>

<SupportedTokensSheet
    open={sheet === "pay"}
    {figures}
    title={$_("native.walletFlows.youPay")}
    searchable={false}
    offered={(id) => payable.has(id) && id !== getId}
    selected={payId}
    onClose={() => (sheet = undefined)}
    onPick={pickPay} />

<SupportedTokensSheet
    open={sheet === "get"}
    {figures}
    title={$_("native.walletFlows.youGet")}
    offered={(id) => targets?.has(id) === true}
    selected={getId}
    onClose={() => (sheet = undefined)}
    onPick={pickGet} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .flow {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .step {
        padding-inline-end: 10px;
        font: var(--weight-semibold) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-3);
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: var(--space-8) var(--space-16) var(--space-16);
    }

    .notice {
        padding: var(--space-12) 14px;
        border-radius: 14px;
        background: color-mix(in oklch, var(--status-warning) 10%, transparent);
        font: var(--weight-medium) text-size(13px) / 1.45 var(--font-sans);
        color: var(--ink-2);
    }

    .cards {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
    }

    .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: 14px;
        border-radius: var(--radius-lg);
        background: var(--overlay-1);
    }

    .card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font: var(--weight-semibold) text-size(11px) / 1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    .card-balance {
        font-size: text-size(12px);
        font-weight: var(--weight-medium);
        letter-spacing: 0;
        text-transform: none;
    }

    .card-line {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    // 16px or more, or iOS zooms in on focus
    .amount,
    .out {
        flex: 1;
        min-width: 0;
        font: 800 text-size(30px) / 1.1 var(--font-sans);
        letter-spacing: -0.02em;
    }

    .amount {
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ink);

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .out {
        color: var(--ink-4);
        @include truncate;

        &.quoted {
            color: var(--ink);
        }
    }

    .pill {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        height: 44px;
        padding: 0 10px 0 var(--space-6);
        border: 0;
        border-radius: 22px;
        background: var(--tint-pill);
        color: var(--ink);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .pill-symbol {
        font: var(--weight-bold) text-size(15px) / 1 var(--font-sans);
    }

    .pill-choose {
        padding-inline-start: var(--space-8);
        font: var(--weight-bold) text-size(14px) / 1 var(--font-sans);
        color: var(--accent-bright);
    }

    .pill-chevron {
        width: 12px;
        height: 12px;
        background: var(--ink-3);
        mask: var(--icon-chevron-down) center / contain no-repeat;
    }

    .note {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-mono);
        color: var(--ink-3);

        &.warn {
            color: var(--status-warning);
        }
    }

    // the arrow between the cards, cut out of them
    .arrow {
        position: relative;
        z-index: 1;
        height: 0;
        display: flex;
        justify-content: center;
    }

    .arrow-icon {
        position: absolute;
        top: -20px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--surface-0);

        &::after {
            content: "";
            position: absolute;
            inset: 9px;
            background: var(--ink-3);
            mask: var(--icon-arrow-down) center / contain no-repeat;
        }
    }

    section {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .label {
        padding-inline-start: var(--space-4);
    }

    .warning {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: var(--space-12) 14px;
        border-radius: 14px;
        background: color-mix(in oklch, var(--status-warning) 10%, transparent);
        font: var(--weight-medium) text-size(13px) / 1.45 var(--font-sans);
        color: var(--ink-2);
    }

    .confirm {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        font-weight: var(--weight-semibold);
        color: var(--ink);

        input {
            width: 18px;
            height: 18px;
            accent-color: var(--accent);
        }
    }

    .hint {
        padding: 0 var(--space-4);
        font: var(--weight-regular) text-size(12.5px) / 1.45 var(--font-sans);
        color: var(--ink-4);
    }

    .foot {
        flex: none;
        padding: var(--space-12) var(--space-16) calc(var(--safe-bottom) + var(--space-16));
    }

    .progress {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: var(--space-22);
        padding: var(--space-8) var(--space-16);
    }

    .steps {
        display: flex;
        flex-direction: column;
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: var(--overlay-1);
    }

    .step-row {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 56px;
        padding: 0 var(--space-16);

        & + & {
            box-shadow: inset 0 1px 0 var(--line-1);
        }
    }

    .step-dot {
        flex: none;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: var(--overlay-2);
        @include flex-center;
        font: var(--weight-semibold) text-size(11px) / 1 var(--font-mono);
        color: var(--ink-4);

        &.active {
            background: var(--accent-soft);
        }

        &.done {
            background: color-mix(in oklch, var(--status-online) 14%, transparent);
        }
    }

    .tick {
        width: 13px;
        height: 13px;
        background: var(--status-online);
        mask: var(--icon-check) center / contain no-repeat;
    }

    .step-label {
        flex: 1;
        min-width: 0;
        font: var(--weight-semibold) text-size(14px) / 1.3 var(--font-sans);
        color: var(--ink);

        &.pending {
            color: var(--ink-3);
        }
    }

    .foot-note {
        text-align: center;
        font: var(--weight-regular) text-size(12.5px) / 1.45 var(--font-sans);
        color: var(--ink-4);
    }

    .done-foot {
        opacity: 0;
        transition: opacity 0.2s;

        &.shown {
            opacity: 1;
        }
    }

    @include reduced-motion {
        .done-foot {
            transition: none;
        }
    }
</style>
