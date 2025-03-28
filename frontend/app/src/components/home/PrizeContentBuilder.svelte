<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import type {
        ChatSummary,
        OpenChat,
        PrizeContentInitial,
        MessageContext,
    } from "openchat-client";
    import { bigIntMax } from "openchat-client";
    import TokenInput from "./TokenInput.svelte";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Legend from "../Legend.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import Range from "../Range.svelte";
    import Radio from "../Radio.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import EqualDistribution from "../icons/EqualDistribution.svelte";
    import RandomDistribution from "../icons/RandomDistribution.svelte";
    import TextArea from "../TextArea.svelte";
    import NumberInput from "../NumberInput.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import {
        currentUser as user,
        cryptoBalance as cryptoBalanceStore,
        cryptoLookup,
    } from "openchat-client";
    import Checkbox from "../Checkbox.svelte";
    import Select from "../Select.svelte";

    const ONE_HOUR = 1000 * 60 * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const ONE_WEEK = ONE_DAY * 7;
    const OC_FEE_PERCENTAGE = 5n;
    const client = getContext<OpenChat>("client");
    const streaks = ["3", "7", "14", "30", "100"];

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

    let numberOfWinners = $state(20);
    let distribution: "equal" | "random" = $state("random");
    const durations: Duration[] = ["oneHour", "oneDay", "oneWeek"];
    type Duration = "oneHour" | "oneDay" | "oneWeek";
    let selectedDuration: Duration = $state("oneDay");
    let diamondOnly = $state(false);
    let diamondType: "standard" | "lifetime" = $state("standard");
    let uniquePersonOnly = $state(false);
    let streakOnly = $state(false);
    let streakValue = $state("3");
    let refreshing = false;
    let error: string | undefined = $state(undefined);
    let message = $state("");
    let toppingUp = $state(false);
    let tokenChanging = $state(true);
    let balanceWithRefresh: BalanceWithRefresh;
    let tokenInputState: "ok" | "zero" | "too_low" | "too_high" = $state("ok");
    let sending = $state(false);

    let anyUser = $state(true);
    $effect(() => {
        anyUser = !diamondOnly && !uniquePersonOnly && !streakOnly;
    });
    let cryptoBalance = $derived($cryptoBalanceStore[ledger] ?? BigInt(0));
    let tokenDetails = $derived($cryptoLookup[ledger]);
    let symbol = $derived(tokenDetails.symbol);
    let transferFee = $derived(tokenDetails.transferFee);
    let transferFees = $derived(transferFee * BigInt(numberOfWinners ?? 0));
    let prizeFees = $derived(transferFees + (draftAmount * OC_FEE_PERCENTAGE) / 100n);
    let totalFees = $derived(transferFee + prizeFees);
    let multiUserChat = $derived(chat.kind === "group_chat" || chat.kind === "channel");
    let remainingBalance = $state(0n);
    $effect(() => {
        remainingBalance =
            draftAmount > 0n ? cryptoBalance - draftAmount - totalFees : cryptoBalance;
    });
    let minAmount = $derived(100n * BigInt(numberOfWinners ?? 0) * transferFee);
    let maxAmount = $derived(bigIntMax(cryptoBalance - totalFees, BigInt(0)));
    let valid = $derived(error === undefined && tokenInputState === "ok" && !tokenChanging);
    let zero = $derived(cryptoBalance <= transferFee && !tokenChanging);
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
        balanceWithRefresh.refresh();
    }

    function recipientFromContext({ chatId }: MessageContext) {
        switch (chatId.kind) {
            case "channel":
                return chatId.communityId;
            case "group_chat":
                return chatId.groupId;
            default:
                throw new Error("We can't create prizes in direct chats");
        }
    }

    function getEndDate() {
        const now = Date.now();
        switch (selectedDuration) {
            case "oneHour":
                return BigInt(now + ONE_HOUR);
            case "oneDay":
                return BigInt(now + ONE_DAY);
            case "oneWeek":
                return BigInt(now + ONE_WEEK);
        }
    }

    function send() {
        const prizes = generatePrizes();
        const amountE8s = prizes.reduce((total, p) => total + p) + prizeFees;

        console.log(`Prize amount: ${amountE8s}`);
        const content: PrizeContentInitial = {
            kind: "prize_content_initial",
            caption: message === "" ? undefined : message,
            endDate: getEndDate(),
            diamondOnly: diamondOnly && diamondType === "standard",
            lifetimeDiamondOnly: diamondOnly && diamondType === "lifetime",
            uniquePersonOnly,
            streakOnly: streakOnly ? parseInt(streakValue) : 0,
            transfer: {
                kind: "pending",
                ledger,
                token: symbol,
                recipient: recipientFromContext(context),
                amountE8s,
                feeE8s: transferFee,
                createdAtNanos: BigInt(Date.now()) * BigInt(1_000_000),
            },
            prizes,
        };

        sending = true;
        error = undefined;

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

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        onBalanceRefreshFinished();
        error = ev.detail;
    }

    function onBalanceRefreshFinished() {
        toppingUp = false;
        tokenChanging = false;
        if (remainingBalance < 0) {
            remainingBalance = BigInt(0);
            draftAmount = cryptoBalance - transferFee;
            if (draftAmount < 0) {
                draftAmount = BigInt(0);
            }
        }
    }

    function generatePrizes(): bigint[] {
        if (!numberOfWinners) return [];

        const share = Math.round(Number(draftAmount) / numberOfWinners);
        switch (distribution) {
            case "equal":
                return generateEquallyDistributedPrizes(draftAmount, share);
            case "random":
                return generateRandomlyDistributedPrizes(draftAmount, share);
        }
    }

    // make sure that any rounding errors are corrected for
    function compensateRounding(prizes: bigint[], fund: bigint): bigint[] {
        const total = prizes.reduce((agg, p) => agg + p, 0n);
        const diff = fund - total;
        if (diff !== 0n) {
            prizes[0] = prizes[0] + diff;
        }
        return prizes;
    }

    function generateEquallyDistributedPrizes(fund: bigint, share: number): bigint[] {
        const prizes = Array.from({ length: numberOfWinners }).map(() => BigInt(share));
        return compensateRounding(prizes, fund);
    }

    function generateRandomlyDistributedPrizes(fund: bigint, share: number): bigint[] {
        const min = share * 0.1;
        const max = share * 2;

        const intermediate = Array.from({ length: numberOfWinners }).map(() => random(min, max));
        const total = intermediate.reduce((agg, p) => agg + p, 0);

        // we might have more prizes than the total so let's scale
        const scale = total / Number(fund);
        const scaled = intermediate.map((p) => BigInt(Math.round(p / scale)));

        const prizes = compensateRounding(scaled, fund);

        return ensureMinPrizeAtLeastTransferFee(prizes);
    }

    function ensureMinPrizeAtLeastTransferFee(prizes: bigint[]): bigint[] {
        let totalAdded = 0n;
        let max = 0n;
        let maxIndex = 0;
        for (let i = 0; i < prizes.length; i++) {
            const prize = prizes[i];
            if (prize < transferFee) {
                prizes[i] = transferFee;
                totalAdded += transferFee - prize;
            } else if (prize > max) {
                max = prize;
                maxIndex = i;
            }
        }

        if (totalAdded > 0n) {
            prizes[maxIndex] = max - totalAdded;
        }

        return prizes;
    }

    function random(min: number, max: number): number {
        const range = max - min;
        return Math.floor(min + Math.random() * range);
    }

    function onAnyUserChecked() {
        anyUser = true;
        diamondOnly = false;
        uniquePersonOnly = false;
        streakOnly = false;
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
                <BalanceWithRefresh
                    bind:toppingUp
                    bind:this={balanceWithRefresh}
                    {ledger}
                    value={remainingBalance}
                    label={i18nKey("cryptoAccount.shortBalanceLabel")}
                    bold
                    showTopUp
                    on:refreshed={onBalanceRefreshed}
                    on:error={onBalanceRefreshError} />
            </span>
        {/snippet}
        {#snippet body()}
            <form>
                <div class="body" class:zero={zero || toppingUp}>
                    {#if zero || toppingUp}
                        <AccountInfo {ledger} user={$user} />
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
                                bind:state={tokenInputState}
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
                            <div
                                role="button"
                                tabindex="0"
                                onclick={() => (distribution = "random")}
                                class="distribution">
                                <div class:selected={distribution === "random"} class="dist-icon">
                                    <RandomDistribution size={"100%"} color={"var(--icon-txt)"} />
                                </div>
                                <div class="dist-label">
                                    <Translatable
                                        resourceKey={i18nKey("prizes.randomDistribution")} />
                                </div>
                            </div>
                            <div
                                role="button"
                                tabindex="0"
                                onclick={() => (distribution = "equal")}
                                class="distribution">
                                <div class:selected={distribution === "equal"} class="dist-icon">
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
                                        on:change={() => (selectedDuration = d)}
                                        value={d}
                                        checked={selectedDuration === d}
                                        id={`duration_${d}`}
                                        label={i18nKey(`poll.${d}`)}
                                        group={"prize_duration"} />
                                {/each}
                            </div>
                            <div class="restrictions">
                                <Legend label={i18nKey("prizes.whoCanWin")} />
                                <Checkbox
                                    id="any_user"
                                    label={i18nKey(`prizes.anyone`)}
                                    bind:checked={anyUser}
                                    on:change={onAnyUserChecked} />
                                <Checkbox
                                    id="diamond_only"
                                    label={i18nKey(`prizes.onlyDiamond`)}
                                    bind:checked={diamondOnly} />
                                {#if diamondOnly}
                                    <div class="diamond-choice">
                                        <Radio
                                            id={"standard-diamond"}
                                            on:change={() => (diamondType = "standard")}
                                            checked={diamondType === "standard"}
                                            label={i18nKey(`prizes.standardDiamond`)}
                                            group={"diamond"} />
                                        <Radio
                                            id={"lifetime-diamond"}
                                            on:change={() => (diamondType = "lifetime")}
                                            checked={diamondType === "lifetime"}
                                            label={i18nKey(`prizes.lifetimeDiamond`)}
                                            group={"diamond"} />
                                    </div>
                                {/if}
                                <Checkbox
                                    id="unique_person_only"
                                    label={i18nKey(`prizes.onlyUniquePerson`)}
                                    bind:checked={uniquePersonOnly} />
                                <Checkbox
                                    id="streak_only"
                                    label={i18nKey(`prizes.onlyStreak`)}
                                    bind:checked={streakOnly} />
                                {#if streakOnly}
                                    <Select bind:value={streakValue}>
                                        {#each streaks as streak}
                                            <option value={streak}
                                                >{$_("prizes.streakValue", {
                                                    values: { n: streak },
                                                })}</option>
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
                </div>
            </form>
        {/snippet}
        {#snippet footer()}
            <span>
                <ButtonGroup>
                    <Button small={!$mobileWidth} tiny={$mobileWidth} secondary on:click={cancel}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    {#if toppingUp || zero}
                        <Button
                            small={!$mobileWidth}
                            disabled={refreshing}
                            loading={refreshing}
                            tiny={$mobileWidth}
                            on:click={reset}
                            ><Translatable resourceKey={i18nKey("refresh")} /></Button>
                    {:else}
                        <Button
                            small={!$mobileWidth}
                            disabled={!valid || sending}
                            loading={sending}
                            tiny={$mobileWidth}
                            on:click={send}
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
