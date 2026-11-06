<script lang="ts" module>
    type Duration = "oneHour" | "oneDay" | "oneWeek";
</script>

<script lang="ts">
    import type { ChatSummary, MessageContext, OpenChat, SignerWallet } from "@client";
    import {
        chitBands,
        cryptoBalanceStore,
        cryptoLookup,
        mobileWidth,
        ONE_DAY,
        ONE_HOUR,
        ONE_WEEK,
        prizeCosts,
        prizeMaximum,
        walletApprovalFee,
    } from "@client";
    import { PrizeForm } from "@src/logic/prize/prizeForm.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Checkbox from "../Checkbox.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import EqualDistribution from "../icons/EqualDistribution.svelte";
    import RandomDistribution from "../icons/RandomDistribution.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import NumberInput from "../NumberInput.svelte";
    import Overlay from "../Overlay.svelte";
    import Radio from "../Radio.svelte";
    import Range from "../Range.svelte";
    import Select from "../Select.svelte";
    import TextArea from "../TextArea.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import ExternalWalletApproval from "./ExternalWalletApproval.svelte";
    import SourceWalletSelector from "./SourceWalletSelector.svelte";
    import TokenInput from "./TokenInput.svelte";

    const DURATION_MS: Record<Duration, number> = {
        oneHour: ONE_HOUR,
        oneDay: ONE_DAY,
        oneWeek: ONE_WEEK,
    };
    const client = getContext<OpenChat>("client");
    const streaks = [3, 7, 14, 30, 100, 365];

    interface Props {
        draftAmount: bigint;
        ledger: string;
        chat: ChatSummary;
        context: MessageContext;
        onClose: () => void;
    }

    let {
        draftAmount = $bindable(),
        ledger = $bindable(),
        chat,
        context,
        onClose,
    }: Props = $props();

    // the split, duration and restrictions (the prize builders' shared state), which this
    // builder's controls change in place: they start from the last prize's
    const form = new PrizeForm();

    let numberOfWinners = $state(20);
    const durations: Duration[] = ["oneHour", "oneDay", "oneWeek"];
    // a duration this builder doesn't offer (from another tree's) starts it at a day
    if (!durations.some((d) => DURATION_MS[d] === form.durationMs)) {
        form.durationMs = DURATION_MS.oneDay;
    }
    let diamondOnly = $derived(form.diamond !== "none");
    // Unique-person ("verified user") gating is suspended: always off (the restriction control is
    // removed)
    const uniquePersonOnly = false;
    let streakOnly = $derived(form.minStreak > 0);
    let chitOnly = $derived(form.minChitEarned > 0);
    const refreshing = false;
    let error: string | undefined = $state(undefined);
    let message = $state("");
    let toppingUp = $state(false);
    let tokenChanging = $state(true);
    let balanceWithRefresh: BalanceWithRefresh;
    let tokenInputState: "ok" | "zero" | "too_low" | "too_high" = $state("ok");
    let sending = $state(false);
    // The external wallet the prize fund will come from, or undefined for the user's own OpenChat
    // account. Paying from an external wallet spends that wallet's balance rather than the user's
    // OpenChat one, so none of the limits derived from the latter apply while one is selected.
    let sourceWallet = $state<SignerWallet | undefined>();
    let payFromWallet = $derived(sourceWallet !== undefined);
    let approval: ExternalWalletApproval | undefined = $state();
    let anyUser = $derived(!diamondOnly && !uniquePersonOnly && !streakOnly && !chitOnly);
    let cryptoBalance = $derived($cryptoBalanceStore.get(ledger) ?? 0n);
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let symbol = $derived(tokenDetails.symbol);
    let transferFee = $derived(tokenDetails.transferFee);
    // what the prize costs on top of its fund (prizeCosts): a transfer fee per winner and
    // OpenChat's 5%, and the fund's own transfer, which includes the approval the wallet makes
    // before the fund is pulled from it
    let costs = $derived(prizeCosts(draftAmount, numberOfWinners ?? 0, transferFee));
    let prizeFees = $derived(costs.prizeFees);
    let fundFees = $derived(transferFee + walletApprovalFee(transferFee));
    let totalFees = $derived(costs.totalFees);
    let multiUserChat = $derived(chat.kind === "group_chat" || chat.kind === "channel");
    let remainingBalance = $state(0n);
    $effect(() => {
        remainingBalance =
            draftAmount > 0n && !payFromWallet
                ? cryptoBalance - draftAmount - totalFees
                : cryptoBalance;
    });
    let minAmount = $derived(costs.minAmount);
    // What the user is able to spend, or undefined when that is the external wallet's business
    // rather than ours
    let maxAmount = $derived(
        payFromWallet
            ? undefined
            : prizeMaximum(cryptoBalance, draftAmount, numberOfWinners ?? 0, transferFee),
    );
    let valid = $derived(error === undefined && tokenInputState === "ok" && !tokenChanging);
    // An empty OpenChat account is only a dead end while the user is paying from it
    let zero = $derived(cryptoBalance <= fundFees && !tokenChanging && !payFromWallet);
    let errorMessage = $derived(error !== undefined ? i18nKey(error) : $pinNumberErrorMessageStore);

    $effect(() => {
        if (tokenInputState === "too_low") {
            error = $_("minimumAmount", {
                values: {
                    amount: client.formatTokens(minAmount, tokenDetails.decimals),
                    symbol,
                },
            });
        } else {
            error = undefined;
        }
    });

    function reset() {
        balanceWithRefresh?.refresh();
    }

    function onDiamondChanged() {
        form.diamond = diamondOnly ? "standard" : "none";
    }

    function send() {
        sending = true;
        error = undefined;

        if (approval != null) {
            // The wallet has to approve us taking the prize fund before we take it. Nothing may
            // be awaited before this call - the wallet opens in a popup, which the browser only
            // allows while it is still handling the click
            approval.approve().then((fromAccount) => {
                if (fromAccount === undefined) {
                    sending = false;
                } else {
                    sendPrize(fromAccount);
                }
            });
        } else {
            sendPrize();
        }
    }

    // `fromAccount` is an external wallet which has just approved the transfer. Without it the
    // prize is funded from the user's own OpenChat account, as it always has been.
    function sendPrize(fromAccount?: string) {
        form.winners = numberOfWinners;
        const prize = form.content(
            context.chatId,
            { ledger, symbol, decimals: tokenDetails.decimals, transferFee },
            draftAmount,
            { fromAccount },
        );
        if (prize === undefined) {
            sending = false;
            return;
        }
        const content = { ...prize, caption: message === "" ? undefined : message };
        form.remember();

        client
            .sendMessageWithContent(context, content, false)
            .then((resp) => {
                if (resp.kind === "success" || resp.kind === "transfer_success") {
                    onClose();
                } else if ($pinNumberErrorMessageStore === undefined) {
                    error = "errorSendingMessage";
                }
            })
            .finally(() => (sending = false));
    }

    function cancel() {
        toppingUp = false;
        onClose();
    }

    function onBalanceRefreshed() {
        onBalanceRefreshFinished();
        error = undefined;
    }

    function onBalanceRefreshError(err: string) {
        onBalanceRefreshFinished();
        error = err;
    }

    function onBalanceRefreshFinished() {
        toppingUp = false;
        tokenChanging = false;
        if (remainingBalance < 0 && !payFromWallet) {
            remainingBalance = BigInt(0);
            draftAmount = cryptoBalance - fundFees;
            if (draftAmount < 0) {
                draftAmount = BigInt(0);
            }
        }
    }

    function onAnyUserChecked() {
        form.diamond = "none";
        form.minStreak = 0;
        form.minChitEarned = 0;
    }

    function onStreakChanged() {
        form.minStreak = streakOnly ? 3 : 0;
    }

    function onChitChanged() {
        form.minChitEarned = chitOnly ? 10_000 : 0;
    }
</script>

<Overlay dismissible>
    <ModalContent>
        {#snippet header()}
            <span class="header">
                <div class="left">
                    <div class="main-title">
                        <div><Translatable resourceKey={i18nKey("prizes.title")} /></div>
                        <div>
                            <CryptoSelector bind:ledger />
                        </div>
                    </div>
                </div>
                <SourceWalletSelector bind:wallet={sourceWallet} {ledger} />
                <!-- The balance is the external wallet's business while one is selected, so only
                     show OpenChat's own - but keep its space so the selector does not move -->
                <div class="oc-balance" class:hidden={payFromWallet}>
                    <BalanceWithRefresh
                        bind:toppingUp
                        bind:this={balanceWithRefresh}
                        {ledger}
                        value={remainingBalance}
                        label={i18nKey("cryptoAccount.shortBalanceLabel")}
                        bold
                        showTopUp
                        onRefreshed={onBalanceRefreshed}
                        onError={onBalanceRefreshError} />
                </div>
            </span>
        {/snippet}
        {#snippet body()}
            <form>
                <div class="body" class:zero={zero || toppingUp}>
                    {#if zero || toppingUp}
                        <AccountInfo {ledger} />
                        {#if zero}
                            <p>
                                <Translatable
                                    resourceKey={i18nKey("tokenTransfer.zeroBalance", {
                                        token: symbol,
                                    })} />
                            </p>
                        {/if}
                        <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                    {:else}
                        <div class="transfer">
                            <TokenInput
                                {ledger}
                                label={"prizes.totalAmount"}
                                autofocus={!multiUserChat}
                                bind:status={tokenInputState}
                                transferFees={totalFees}
                                {minAmount}
                                {maxAmount}
                                bind:amount={draftAmount} />
                        </div>
                        <div class="message">
                            <Legend label={i18nKey("tokenTransfer.message")} />
                            <TextArea
                                maxlength={200}
                                rows={3}
                                autofocus={false}
                                placeholder={i18nKey("tokenTransfer.messagePlaceholder")}
                                bind:value={message} />
                        </div>
                        <div class="winners">
                            <Legend
                                label={i18nKey("prizes.numberOfWinners")}
                                rules={i18nKey(numberOfWinners?.toString())} />
                            <div class="pickers">
                                <Range fat min={1} max={1000} bind:value={numberOfWinners} />
                                <div class="num-picker">
                                    <NumberInput
                                        align={"right"}
                                        defaultValue={20}
                                        min={1}
                                        max={1000}
                                        bind:value={numberOfWinners} />
                                </div>
                            </div>
                        </div>
                        <Legend label={i18nKey("prizes.distribution")} />
                        <div class="distributions">
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <div
                                role="button"
                                tabindex="0"
                                onclick={() => (form.distribution = "random")}
                                class="distribution">
                                <div class:selected={form.distribution === "random"} class="dist-icon">
                                    <RandomDistribution size={"100%"} color={"var(--icon-txt)"} />
                                </div>
                                <div class="dist-label">
                                    <Translatable
                                        resourceKey={i18nKey("prizes.randomDistribution")} />
                                </div>
                            </div>
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <div
                                role="button"
                                tabindex="0"
                                onclick={() => (form.distribution = "equal")}
                                class="distribution">
                                <div class:selected={form.distribution === "equal"} class="dist-icon">
                                    <EqualDistribution size={"100%"} color={"var(--icon-txt)"} />
                                </div>
                                <div class="dist-label">
                                    <Translatable
                                        resourceKey={i18nKey("prizes.equalDistribution")} />
                                </div>
                            </div>
                        </div>
                        <div class="config">
                            <div class="duration">
                                <Legend label={i18nKey("prizes.duration")} />
                                {#each durations as d}
                                    <Radio
                                        onChange={() => (form.durationMs = DURATION_MS[d])}
                                        value={d}
                                        checked={form.durationMs === DURATION_MS[d]}
                                        id={`duration_${d}`}
                                        label={i18nKey(`poll.${d}`)}
                                        group={"prize_duration"} />
                                {/each}
                            </div>
                            <div class="restrictions">
                                <Legend label={i18nKey("prizes.restrictions")} />
                                <Checkbox
                                    id="any_user"
                                    label={i18nKey(`prizes.anyone`)}
                                    bind:checked={anyUser}
                                    onChange={onAnyUserChecked} />
                                <Checkbox
                                    id="diamond_only"
                                    label={i18nKey(`prizes.onlyDiamond`)}
                                    onChange={onDiamondChanged}
                                    bind:checked={diamondOnly} />
                                {#if diamondOnly}
                                    <div class="diamond-choice">
                                        <Radio
                                            id={"standard-diamond"}
                                            onChange={() => (form.diamond = "standard")}
                                            checked={form.diamond === "standard"}
                                            label={i18nKey(`prizes.standardDiamond`)}
                                            group={"diamond"} />
                                        <Radio
                                            id={"lifetime-diamond"}
                                            onChange={() => (form.diamond = "lifetime")}
                                            checked={form.diamond === "lifetime"}
                                            label={i18nKey(`prizes.lifetimeDiamond`)}
                                            group={"diamond"} />
                                    </div>
                                {/if}
                                <!-- Unique person ("verified user") gating is suspended -->
                                <Checkbox
                                    id="streak_only"
                                    label={i18nKey(`prizes.onlyStreak`)}
                                    onChange={onStreakChanged}
                                    bind:checked={streakOnly} />
                                {#if streakOnly}
                                    <Select bind:value={form.minStreak}>
                                        {#each streaks as streak}
                                            <option value={streak}>
                                                <Translatable
                                                    resourceKey={i18nKey("prizes.streakValue", {
                                                        n: streak.toString(),
                                                    })}></Translatable>
                                            </option>
                                        {/each}
                                    </Select>
                                {/if}
                                <Checkbox
                                    id="chit_only"
                                    label={i18nKey(`prizes.onlyChit`)}
                                    onChange={onChitChanged}
                                    bind:checked={chitOnly} />
                                {#if chitOnly}
                                    <Select bind:value={form.minChitEarned}>
                                        {#each chitBands.entries() as [value, name]}
                                            <option {value}>
                                                <Translatable
                                                    resourceKey={i18nKey(
                                                        "prizes.minChitEarnedValue",
                                                        { n: name },
                                                    )}></Translatable>
                                            </option>
                                        {/each}
                                    </Select>
                                {/if}
                            </div>
                        </div>
                        {#if errorMessage !== undefined}
                            <div class="error">
                                <ErrorMessage
                                    ><Translatable resourceKey={errorMessage} /></ErrorMessage>
                            </div>
                        {/if}
                    {/if}
                    {#if sourceWallet !== undefined}
                        <!-- The prize fund leaves the wallet as one transfer: the amount plus the
                             fees the message carries to fund each winner's payout -->
                        <ExternalWalletApproval
                            bind:this={approval}
                            wallet={sourceWallet}
                            {ledger}
                            amount={draftAmount + prizeFees}
                            chatId={context.chatId} />
                    {/if}
                </div>
            </form>
        {/snippet}
        {#snippet footer()}
            <span>
                <ButtonGroup>
                    <Button small={!$mobileWidth} tiny={$mobileWidth} secondary onClick={cancel}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    {#if toppingUp || zero}
                        <Button
                            small={!$mobileWidth}
                            disabled={refreshing}
                            loading={refreshing}
                            tiny={$mobileWidth}
                            onClick={reset}
                            ><Translatable resourceKey={i18nKey("refresh")} /></Button>
                    {:else}
                        <Button
                            small={!$mobileWidth}
                            disabled={!valid || sending}
                            loading={sending}
                            tiny={$mobileWidth}
                            onClick={send}
                            ><Translatable resourceKey={i18nKey("tokenTransfer.send")} /></Button>
                    {/if}
                </ButtonGroup>
            </span>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    :global(.restrictions .diamond-choice .radio) {
        margin-bottom: 0;
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp2;

        .left {
            flex: auto;
            display: flex;
            align-items: center;
            gap: $sp4;

            .main-title {
                flex: auto;
                display: flex;
                align-items: baseline;
                gap: 10px;
                @include font(bold, normal, fs-120);
            }
        }
    }

    .body {
        transition: background-color 100ms ease-in-out;
        @include font(book, normal, fs-100, 28);
    }

    .oc-balance.hidden {
        visibility: hidden;
    }

    .transfer {
        margin-bottom: $sp4;
    }

    .how-to {
        margin-top: $sp4;
    }

    .distributions {
        display: flex;
        gap: $sp6;
        justify-content: space-between;
        align-items: center;
        margin-bottom: $sp3;

        .distribution {
            cursor: pointer;
        }

        .dist-icon {
            margin: $sp3 0;
            padding: $sp3 $sp5;
            border-radius: $sp3;
            transition: background-color 250ms ease-in-out;
            &.selected {
                background-color: var(--icon-hv);
            }
        }

        .dist-label {
            text-align: center;
        }
    }

    .config {
        display: flex;
        gap: $sp5;
        justify-content: space-between;

        .restrictions,
        .duration {
            flex: 1;
        }
    }

    .pickers {
        display: flex;
        align-items: center;
        gap: $sp3;

        .num-picker {
            flex: 0 0 80px;
        }
    }

    .error {
        margin-top: $sp4;
    }

    .diamond-choice {
        margin-left: $sp6;
    }
</style>
