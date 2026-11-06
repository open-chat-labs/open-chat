<script lang="ts">
    import {
        Body,
        Chip,
        Column,
        CommonButton2,
        InputTextButton,
        NumberInput,
        Row,
        Switch,
    } from "component-lib";
    import type { MessageContext, SignerWallet } from "@client";
    import {
        chitBands,
        cryptoBalanceStore,
        enhancedCryptoLookup as cryptoLookup,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        prizeMaximum,
    } from "@client";
    import { PrizeForm } from "@src/logic/prize/prizeForm.svelte";
    import { onMount } from "svelte";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import Lifetime from "svelte-material-icons/DiamondStone.svelte";
    import Flash from "svelte-material-icons/FlashOutline.svelte";
    import Gift from "svelte-material-icons/GiftOutline.svelte";
    import LightningBolt from "svelte-material-icons/LightningBoltCircle.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Setting from "../Setting.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import DurationSelector from "./DurationSelector.svelte";
    import SelectChitEarned from "./SelectChitEarned.svelte";
    import SelectMinStreak from "./SelectMinStreak.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";
    import SourceWalletSelector from "./SourceWalletSelector.svelte";
    import TokenInput from "./TokenInput.svelte";
    import TransferFeesMessage from "./TransferFeesMessage.svelte";
    import { TokenState } from "@src/logic/wallet/walletState.svelte";
    import { keyboard } from "@stores/keyboard.svelte";

    const streaks = [3, 7, 14, 30, 100, 365];

    interface Props {
        context: MessageContext;
        onClose: () => void;
    }

    let { context, onClose }: Props = $props();

    let draftAmount = $state(0n);
    let ledger = $state($lastCryptoSent ?? LEDGER_CANISTER_ICP);

    // the winners, split, duration and restrictions, remembered for the next prize (unique-person
    // gating is suspended, so it's always off)
    const form = new PrizeForm();
    let tokenInputState: "ok" | "zero" | "too_low" | "too_high" = $state("ok");
    // The external wallet the prize fund will come from, or undefined for the user's own OpenChat
    // account. Paying from an external wallet spends that wallet's balance rather than the user's
    // OpenChat one, so none of the limits derived from the latter apply while one is selected.
    let sourceWallet = $state<SignerWallet | undefined>();
    let payFromWallet = $derived(sourceWallet !== undefined);
    let cryptoBalance = $derived($cryptoBalanceStore.get(ledger) ?? 0n);
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let tokenState = $derived(new TokenState(tokenDetails));
    let transferFee = $derived(tokenDetails.transferFee);
    // What the prize costs in fees: the transfer of its fund, which includes the approval the wallet
    // makes before the fund is pulled from it, and the prize's fees (prizeCosts)
    let costs = $derived(form.costs(draftAmount, transferFee));
    let totalFees = $derived(costs.totalFees);
    let minAmount = $derived(costs.minAmount);
    // What the user is able to spend, or undefined when that is the external wallet's business
    // rather than ours
    let maxAmount = $derived(
        payFromWallet
            ? undefined
            : prizeMaximum(cryptoBalance, draftAmount, form.winners ?? 0, transferFee),
    );
    let valid = $derived(form.validWinners && tokenInputState === "ok");
    let selectMinChitEarned = $state(false);
    let selectMinStreak = $state(false);

    onMount(() => {
        const wasViewportResizeEnabled = keyboard.viewportResizeEnabled;
        // If resize is currently not enabled, enable it!
        if (!wasViewportResizeEnabled) keyboard.enableViewportResize();

        return () => {
            // If resize was not enabled enabled when the component was mounted,
            // disable it again.
            if (!wasViewportResizeEnabled) keyboard.disableViewportResize();
        };
    });

    // This only attaches a draft - the prize fund is taken when the user sends the message. An
    // external wallet's approval is not asked for here: it would spend a tap on an allowance the
    // user may abandon without sending. Instead the draft carries the chosen wallet as
    // `fromWallet`, and the send itself asks for the approval, from the tap which consumes it.
    function attach() {
        form.attach(
            context,
            { ledger, symbol: tokenState.symbol, decimals: tokenState.decimals, transferFee },
            draftAmount,
            sourceWallet?.id,
        );
        onClose();
    }

    function toggleDistribution() {
        form.distribution = form.distribution === "equal" ? "random" : "equal";
    }
</script>

{#if selectMinChitEarned}
    <SelectChitEarned
        min={form.minChitEarned}
        onClose={() => (selectMinChitEarned = false)}
        onSelect={(min: number) => {
            form.minChitEarned = min;
            selectMinChitEarned = false;
        }} />
{/if}

{#if selectMinStreak}
    <SelectMinStreak
        {streaks}
        min={form.minStreak}
        onClose={() => (selectMinStreak = false)}
        onSelect={(min: number) => {
            form.minStreak = min;
            selectMinStreak = false;
        }} />
{/if}

{#snippet sectionTitle(key: string, padding: boolean = true)}
    <Row padding={["zero", padding ? "xs" : "zero"]}>
        <Body fontWeight="semi-bold">
            <Translatable resourceKey={i18nKey(key)} />
        </Body>
    </Row>
{/snippet}

<SlidingPageContent title={i18nKey("Create a prize")}>
    <Column height={"fill"} gap={"xxl"} padding={["xxl", "lg", "huge"]}>
        <!-- -->
        <!-- Token select -->
        <Column gap={"md"}>
            {@render sectionTitle("Select the prize token")}
            <!-- An external wallet's balance is its own business, so while one is selected the
                 OpenChat balance is hidden -->
            <CryptoSelector
                {draftAmount}
                fees={totalFees}
                showRefresh
                hideBalance={payFromWallet}
                bind:ledger />
            <SourceWalletSelector bind:wallet={sourceWallet} {ledger} />
        </Column>

        <!-- Withdrawal amount -->
        <Column gap="md">
            {@render sectionTitle("Total prize amount")}
            <TokenInput
                balance={tokenState.cryptoBalance}
                {ledger}
                bind:status={tokenInputState}
                {minAmount}
                {maxAmount}
                bind:amount={draftAmount}>
                {#snippet subtext()}
                    <Translatable
                        resourceKey={i18nKey(
                            `Minimum amount ${tokenState.formatTokens(minAmount)} ${
                                tokenState.symbol
                            }`,
                        )} />
                {/snippet}
            </TokenInput>
            <Row padding={["zero", "sm"]}>
                <TransferFeesMessage
                    symbol={tokenState.symbol}
                    tokenDecimals={tokenState.decimals}
                    transferFees={totalFees} />
            </Row>
        </Column>

        <!-- Number of winners -->
        <Column gap="md">
            {@render sectionTitle("Number of winners")}
            <NumberInput
                error={!form.validWinners}
                min={1}
                max={1000}
                bind:value={form.winners}>
                {#snippet subtext()}
                    <Translatable
                        resourceKey={i18nKey("Please enter a number between 1 and 1000")} />
                {/snippet}
                {#snippet textButtons()}
                    <InputTextButton onClick={() => (form.winners = 1000)}>
                        <Translatable resourceKey={i18nKey("tokenTransfer.max")} />
                    </InputTextButton>
                {/snippet}
            </NumberInput>
        </Column>

        <!-- Prize expiry -->
        <Column gap="md">
            {@render sectionTitle("Prize expiry time")}
            <DurationSelector
                bind:duration={() => BigInt(form.durationMs), (d) => (form.durationMs = Number(d))} />
        </Column>

        <!-- Distribution -->
        <Column padding={["zero", "xs"]}>
            <Setting
                toggle={toggleDistribution}
                info={"By default, prize amounts per winner are randomised, meaning that winnings between users will be different. If you'd like each of the winners to get equal amounts of the prize, turn this option on."}>
                <Switch
                    onChange={toggleDistribution}
                    width={"fill"}
                    reverse
                    checked={form.distribution === "equal"}>
                    <Translatable resourceKey={i18nKey("Distribute evenly")} />
                </Switch>
            </Setting>
        </Column>

        <!-- Distribution -->
        <Column gap={"lg"} padding={["zero", "xs"]}>
            <Column gap={"sm"}>
                {@render sectionTitle("Claim restrictions", false)}
                <Body colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Set limitations on who can claim prizes. By default any user can claim a prize. Select which restrictions should apply below. ",
                        )} />
                </Body>
            </Column>
            <Row wrap gap={"sm"}>
                <Chip
                    onClick={() => form.toggleDiamond("standard")}
                    onRemove={form.diamond === "standard" ? () => (form.diamond = "none") : undefined}
                    mode={form.diamond === "standard" ? "filter" : "default"}>
                    {#snippet icon(color)}
                        <Diamond {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Diamond membership")} />
                </Chip>
                <Chip
                    onClick={() => form.toggleDiamond("lifetime")}
                    onRemove={form.diamond === "lifetime" ? () => (form.diamond = "none") : undefined}
                    mode={form.diamond === "lifetime" ? "filter" : "default"}>
                    {#snippet icon(color)}
                        <Lifetime {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Lifetime diamond membership")} />
                </Chip>
                <!-- Unique person ("verified user") gating is suspended -->
                <Chip
                    onClick={() => (selectMinChitEarned = true)}
                    onRemove={form.minChitEarned > 0 ? () => (form.minChitEarned = 0) : undefined}
                    mode={form.minChitEarned > 0 ? "filter" : "default"}>
                    {#snippet icon(color)}
                        <Flash {color} />
                    {/snippet}
                    {#if form.minChitEarned > 0}
                        <Translatable
                            resourceKey={i18nKey(`CHIT earned: ${chitBands.get(form.minChitEarned)}`)} />
                    {:else}
                        <Translatable resourceKey={i18nKey(`CHIT earned`)} />
                    {/if}
                </Chip>
                <Chip
                    onClick={() => (selectMinStreak = true)}
                    onRemove={form.minStreak > 0 ? () => (form.minStreak = 0) : undefined}
                    mode={form.minStreak > 0 ? "filter" : "default"}>
                    {#snippet icon(color)}
                        <LightningBolt {color} />
                    {/snippet}
                    {#if form.minStreak > 0}
                        <Translatable resourceKey={i18nKey(`Users with streak: ${form.minStreak}d`)} />
                    {:else}
                        <Translatable resourceKey={i18nKey(`Users with streak`)} />
                    {/if}
                </Chip>
            </Row>
        </Column>

        <!-- Buttons -->
        <Row mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
            <CommonButton2 variant="primary" mode="text" onClick={onClose}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </CommonButton2>
            <CommonButton2
                variant="primary"
                mode="regular"
                disabled={!valid}
                onClick={attach}>
                {#snippet icon(color, size)}
                    <Gift {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Attach prize")} />
            </CommonButton2>
        </Row>
    </Column>
</SlidingPageContent>
