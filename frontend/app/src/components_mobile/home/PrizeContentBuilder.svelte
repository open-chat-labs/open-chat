<script lang="ts" module>
    type PrizeConfig = {
        minChitEarned: number;
        diamond: "none" | "standard" | "lifetime";
        uniquePersonOnly: boolean;
        minStreak: number;
        requiresAuth: boolean;
        distribution: "equal" | "random";
        duration: bigint;
    };
    const defaultPrizeRestrictions: PrizeConfig = {
        minChitEarned: 0,
        diamond: "none",
        uniquePersonOnly: false,
        minStreak: 0,
        requiresAuth: false,
        distribution: "random",
        duration: BigInt(ONE_DAY),
    };
</script>

<script lang="ts">
    import {
        Body,
        Chip,
        Column,
        CommonButton,
        InputTextButton,
        NumberInput,
        Row,
        Switch,
    } from "component-lib";
    import type { MessageContext, PrizeContentInitial } from "openchat-client";
    import {
        bigIntMax,
        chitBands,
        cryptoBalanceStore,
        enhancedCryptoLookup as cryptoLookup,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        LocalStorageStore,
        localUpdates,
        ONE_DAY,
    } from "openchat-client";
    import Account from "svelte-material-icons/AccountOutline.svelte";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import Lifetime from "svelte-material-icons/DiamondStone.svelte";
    import Fingerprint from "svelte-material-icons/Fingerprint.svelte";
    import Flash from "svelte-material-icons/FlashOutline.svelte";
    import Gift from "svelte-material-icons/GiftOutline.svelte";
    import LightningBolt from "svelte-material-icons/LightningBoltCircle.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Setting from "../Setting.svelte";
    import Translatable from "../Translatable.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import DurationSelector from "./DurationSelector.svelte";
    import SelectChitEarned from "./SelectChitEarned.svelte";
    import SelectMinStreak from "./SelectMinStreak.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";
    import TokenInput from "./TokenInput.svelte";
    import TransferFeesMessage from "./TransferFeesMessage.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    const OC_FEE_PERCENTAGE = 5n;
    const streaks = [3, 7, 14, 30, 100, 365];

    interface Props {
        context: MessageContext;
        onClose: () => void;
    }

    let { context, onClose }: Props = $props();

    let draftAmount = $state(0n);
    let ledger = $state($lastCryptoSent ?? LEDGER_CANISTER_ICP);

    const prizeConfig = new LocalStorageStore(
        "openchat_prize_config",
        defaultPrizeRestrictions,
        JSON.stringify,
        (s) => JSON.parse(s),
        (_a, _b) => false,
    );

    let numberOfWinners = $state<number | undefined>(20);
    let numberOfWinnersValid = $derived(
        numberOfWinners !== undefined && numberOfWinners >= 1 && numberOfWinners <= 1000,
    );
    let distribution: "equal" | "random" = $state($prizeConfig.distribution);
    let selectedDuration = $state($prizeConfig.duration);
    let diamondType: "none" | "standard" | "lifetime" = $state($prizeConfig.diamond);
    let uniquePersonOnly = $state($prizeConfig.uniquePersonOnly);
    let minStreak = $state<number>($prizeConfig.minStreak);
    let minChitEarned = $state<number>($prizeConfig.minChitEarned);
    let tokenInputState: "ok" | "zero" | "too_low" | "too_high" = $state("ok");
    let requiresAuth = $state($prizeConfig.requiresAuth);
    let cryptoBalance = $derived($cryptoBalanceStore.get(ledger) ?? 0n);
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let tokenState = $derived(new TokenState(tokenDetails));
    let transferFee = $derived(tokenDetails.transferFee);
    let transferFees = $derived(transferFee * BigInt(numberOfWinners ?? 0));
    let prizeFees = $derived(transferFees + (draftAmount * OC_FEE_PERCENTAGE) / 100n);
    let totalFees = $derived(transferFee + prizeFees);
    let minAmount = $derived(100n * BigInt(numberOfWinners ?? 0) * transferFee);
    let maxAmount = $derived(bigIntMax(cryptoBalance - totalFees, BigInt(0)));
    let valid = $derived(numberOfWinnersValid && tokenInputState === "ok");
    let selectMinChitEarned = $state(false);
    let selectMinStreak = $state(false);

    function onDiamondChanged(t: "standard" | "lifetime") {
        switch (t) {
            case "standard":
                switch (diamondType) {
                    case "lifetime":
                    case "none":
                        diamondType = "standard";
                        break;
                    case "standard":
                        diamondType = "none";
                        break;
                }
                break;
            case "lifetime":
                switch (diamondType) {
                    case "standard":
                    case "none":
                        diamondType = "lifetime";
                        break;
                    case "lifetime":
                        diamondType = "none";
                        break;
                }
                break;
        }
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
        return BigInt(BigInt(Date.now()) + selectedDuration);
    }

    function send() {
        const prizes = generatePrizes();
        const amountE8s = prizes.reduce((total, p) => total + p) + prizeFees;

        const content: PrizeContentInitial = {
            kind: "prize_content_initial",
            caption: undefined,
            endDate: getEndDate(),
            diamondOnly: diamondType === "standard",
            lifetimeDiamondOnly: diamondType === "lifetime",
            uniquePersonOnly,
            streakOnly: minStreak,
            minChitEarned: minChitEarned,
            transfer: {
                kind: "pending",
                ledger,
                token: tokenState.symbol,
                recipient: recipientFromContext(context),
                amountE8s,
                feeE8s: transferFee,
                createdAtNanos: BigInt(Date.now()) * BigInt(1_000_000),
            },
            amount: draftAmount,
            fees: totalFees,
            prizes,
            requiresCaptcha: requiresAuth,
        };

        prizeConfig.set({
            minChitEarned,
            diamond: diamondType,
            uniquePersonOnly,
            minStreak,
            requiresAuth,
            distribution,
            duration: selectedDuration,
        });

        localUpdates.draftMessages.setAttachment(context, content);

        onClose();
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
        const prizes = Array.from({ length: numberOfWinners ?? 0 }).map(() => BigInt(share));
        return compensateRounding(prizes, fund);
    }

    function generateRandomlyDistributedPrizes(fund: bigint, share: number): bigint[] {
        const min = share * 0.1;
        const max = share * 2;

        const intermediate = Array.from({ length: numberOfWinners ?? 0 }).map(() =>
            random(min, max),
        );
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

    function toggleDistribution() {
        switch (distribution) {
            case "equal":
                distribution = "random";
                break;
            case "random":
                distribution = "equal";
                break;
        }
    }

    function setAmount(percentage: number) {
        draftAmount = BigInt(Math.floor(Number(maxAmount) * (percentage / 100)));
    }
</script>

{#if selectMinChitEarned}
    <SelectChitEarned
        min={minChitEarned}
        onClose={() => (selectMinChitEarned = false)}
        onSelect={(min: number) => {
            minChitEarned = min;
            selectMinChitEarned = false;
        }} />
{/if}

{#if selectMinStreak}
    <SelectMinStreak
        {streaks}
        min={minStreak}
        onClose={() => (selectMinStreak = false)}
        onSelect={(min: number) => {
            minStreak = min;
            selectMinStreak = false;
        }} />
{/if}

{#snippet percentage(perc: number)}
    <Chip fill mode={"rounded"} onClick={() => setAmount(perc)}>
        {`${perc}%`}
    </Chip>
{/snippet}

<SlidingPageContent title={i18nKey("Create a prize")}>
    <Column height={"fill"} gap={"xxl"} padding={["lg", "xxl"]}>
        <CryptoSelector filter={(t) => t.balance > 0} {draftAmount} showRefresh bind:ledger />

        <Column gap={"xs"}>
            <TokenInput
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

            <Row mainAxisAlignment={"spaceBetween"} padding={["sm", "zero"]} gap={"sm"}>
                {@render percentage(25)}
                {@render percentage(50)}
                {@render percentage(75)}
                {@render percentage(100)}
            </Row>

            <TransferFeesMessage
                symbol={tokenState.symbol}
                tokenDecimals={tokenState.decimals}
                transferFees={totalFees} />
        </Column>

        <NumberInput error={!numberOfWinnersValid} min={1} max={1000} bind:value={numberOfWinners}>
            {#snippet subtext()}
                <Translatable resourceKey={i18nKey("Please enter a number between 1 and 1000")} />
            {/snippet}
            {#snippet textButtons()}
                <InputTextButton onClick={() => (numberOfWinners = 1000)}>
                    <Translatable resourceKey={i18nKey("tokenTransfer.max")} />
                </InputTextButton>
            {/snippet}
        </NumberInput>

        <DurationSelector bind:duration={selectedDuration}>
            {#snippet title()}
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Prize expiry time")} />
                </Body>
            {/snippet}
        </DurationSelector>

        <Setting
            toggle={toggleDistribution}
            info={"By default, prize amounts per winner are randomised, meaning that winnings between users will be different. If you'd like each of the winners to get equal amounts of the prize, turn this option on."}>
            <Switch
                onChange={toggleDistribution}
                width={"fill"}
                reverse
                checked={distribution === "equal"}>
                <Translatable resourceKey={i18nKey("Distribute evenly")} />
            </Switch>
        </Setting>

        <Column gap={"sm"}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Claim restrictions")} />
            </Body>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Set limitations on who can claim prizes. By default any user can claim a prize. Select which restrictions should apply below. ",
                    )} />
            </Body>
        </Column>

        <Row wrap gap={"sm"}>
            <Chip
                onClick={() => (requiresAuth = !requiresAuth)}
                onRemove={requiresAuth ? () => (requiresAuth = false) : undefined}
                mode={requiresAuth ? "filter" : "default"}>
                {#snippet icon(color)}
                    <Fingerprint {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Requires authentication")} />
            </Chip>
            <Chip
                onClick={() => onDiamondChanged("standard")}
                onRemove={diamondType === "standard" ? () => (diamondType = "none") : undefined}
                mode={diamondType === "standard" ? "filter" : "default"}>
                {#snippet icon(color)}
                    <Diamond {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Diamond membership")} />
            </Chip>
            <Chip
                onClick={() => onDiamondChanged("lifetime")}
                onRemove={diamondType === "lifetime" ? () => (diamondType = "none") : undefined}
                mode={diamondType === "lifetime" ? "filter" : "default"}>
                {#snippet icon(color)}
                    <Lifetime {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Lifetime diamond membership")} />
            </Chip>
            <Chip
                onClick={() => (uniquePersonOnly = !uniquePersonOnly)}
                onRemove={uniquePersonOnly ? () => (uniquePersonOnly = false) : undefined}
                mode={uniquePersonOnly ? "filter" : "default"}>
                {#snippet icon(color)}
                    <Account {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Unique person")} />
            </Chip>
            <Chip
                onClick={() => (selectMinChitEarned = true)}
                onRemove={minChitEarned > 0 ? () => (minChitEarned = 0) : undefined}
                mode={minChitEarned > 0 ? "filter" : "default"}>
                {#snippet icon(color)}
                    <Flash {color} />
                {/snippet}
                {#if minChitEarned > 0}
                    <Translatable
                        resourceKey={i18nKey(`CHIT earned: ${chitBands.get(minChitEarned)}`)} />
                {:else}
                    <Translatable resourceKey={i18nKey(`CHIT earned`)} />
                {/if}
            </Chip>
            <Chip
                onClick={() => (selectMinStreak = true)}
                onRemove={minStreak > 0 ? () => (minStreak = 0) : undefined}
                mode={minStreak > 0 ? "filter" : "default"}>
                {#snippet icon(color)}
                    <LightningBolt {color} />
                {/snippet}
                {#if minStreak > 0}
                    <Translatable resourceKey={i18nKey(`Users with streak: ${minStreak}d`)} />
                {:else}
                    <Translatable resourceKey={i18nKey(`Users with streak`)} />
                {/if}
            </Chip>
        </Row>

        <Row mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
            <CommonButton onClick={onClose} mode={"active"} size={"small_text"}>
                <Translatable resourceKey={i18nKey("back")} />
            </CommonButton>
            <CommonButton disabled={!valid} onClick={send} mode={"active"} size={"medium"}>
                {#snippet icon(color, size)}
                    <Gift {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Attach prize")} />
            </CommonButton>
        </Row>
    </Column>
</SlidingPageContent>
