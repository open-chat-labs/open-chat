<script lang="ts">
    import { refreshBalanceOrToast } from "@src/utils/balanceRefresh";
    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { now500 } from "@src/stores/time";
    import {
        Body,
        BodySmall,
        Button,
        ColourVars,
        Column,
        CommonButton,
        defaultBackgroundGradient,
        Row,
        Sheet,
        StatusCard,
        Switch,
        transition,
        type ColourVarKeys,
        type Padding,
        type SizeMode,
    } from "component-lib";
    import {
        diamondStatusStore,
        E8S_PER_TOKEN,
        enhancedCryptoLookup,
        LEDGER_CANISTER_CHAT,
        LEDGER_CANISTER_ICP,
        type DiamondMembershipDuration,
        type Level,
        type OpenChat,
        type ResourceKey,
        type SignerWallet,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import { _, locale } from "svelte-i18n";
    import Warning from "svelte-material-icons/AlertRhombusOutline.svelte";
    import Right from "svelte-material-icons/ChevronRight.svelte";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import Lifetime from "svelte-material-icons/DiamondStone.svelte";
    import QrCode from "svelte-material-icons/Qrcode.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import { toastStore } from "../../../stores/toast";
    import Setting from "../../Setting.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import ExternalWalletApproval from "../ExternalWalletApproval.svelte";
    import SourceWalletSelector from "../SourceWalletSelector.svelte";
    import { TokenState } from "@src/logic/wallet/walletState.svelte";
    import {
        approvalFeeE8s,
        DiamondPayment,
        insufficientFunds,
        membershipEnd,
        walletCostE8s,
    } from "@src/logic/diamond/diamondPayment.svelte";
    import SelectMembershipHeader from "./SelectMembershipHeader.svelte";

    type Step = "choose" | "confirm";

    interface Props {
        lifetime?: boolean;
        onSuccess?: (proof: string) => void;
        padding?: Padding;
        height?: SizeMode;
        joining?: Level;
        onCancel?: () => void;
    }

    let {
        lifetime = false,
        onSuccess,
        padding = ["xxl", "xl"],
        onCancel,
        height = { size: "100%" },
    }: Props = $props();

    let confirming = $state(false);

    const client = getContext<OpenChat>("client");
    // the backend's fees and the payment (logic/diamond)
    const payment = new DiamondPayment(client);

    const options: Option[] = [
        {
            index: 0,
            duration: i18nKey("upgrade.oneMonth"),
            enabled: !lifetime,
        },
        {
            index: 1,
            duration: i18nKey("upgrade.threeMonths"),
            enabled: !lifetime,
        },
        {
            index: 2,
            duration: i18nKey("upgrade.oneYear"),
            enabled: !lifetime,
        },
        {
            index: 3,
            duration: i18nKey("upgrade.lifetime"),
            enabled: true,
        },
    ];

    let enabledOptions = $derived(options.filter((o) => o.enabled));
    // svelte-ignore state_referenced_locally
    let step = $state<Step>(enabledOptions.length === 1 ? "confirm" : "choose");

    let autoRenew = $state(true);
    let selectedOption: Option | undefined = $state(options[lifetime ? 3 : 0]);
    let topup = $state(false);
    // The external wallet the payment will come from, or undefined for the user's own OpenChat
    // account, which is where payments have always come from
    let sourceWallet = $state<SignerWallet | undefined>();
    let approval: ExternalWalletApproval | undefined = $state();
    let approving = $state(false);

    let ledger: string = $state(
        import.meta.env.OC_NODE_ENV === "production" ? LEDGER_CANISTER_CHAT : LEDGER_CANISTER_ICP,
    );

    type Option = {
        index: number;
        duration: ResourceKey;
        enabled: boolean;
    };

    const indexToDuration: Record<number, DiamondMembershipDuration> = {
        0: "one_month",
        1: "three_months",
        2: "one_year",
        3: "lifetime",
    };

    function amount(e8s: bigint): number {
        return Number(e8s) / E8S_PER_TOKEN;
    }

    // the backend's price for the option in this token, 0 till the fees have loaded
    function amountInE8s(option: Option | undefined): bigint {
        if (option === undefined) return 0n;
        return payment.price(tokenDetails.symbol, indexToDuration[option.index]) ?? 0n;
    }

    function confirm() {
        if (approval != null) {
            // The wallet has to approve us taking the payment before we take it. Nothing may be
            // awaited before this call - the wallet opens in a popup, which the browser only
            // allows while it is still handling the tap
            approving = true;
            approval
                .approve()
                .then((fromAccount) => {
                    if (fromAccount !== undefined) {
                        pay(fromAccount);
                    }
                })
                .finally(() => (approving = false));
        } else {
            pay();
        }
    }

    // `fromAccount` is an external wallet which has just approved us taking the payment. Without it
    // the payment comes from the user's own OpenChat account, as it always has.
    async function pay(fromAccount?: string) {
        confirming = true;
        try {
            const outcome = await payment.pay({
                ledger: tokenDetails.ledger,
                token: tokenDetails.symbol,
                duration: selectedDuration,
                autoRenew,
                fromAccount,
            });
            if (outcome.kind === "success") {
                refreshBalanceOrToast(tokenState, client);
                onSuccess?.(outcome.proof);
            } else if (outcome.kind === "pin_failed") {
                // the PIN's own message, counting down a lockout
                toastStore.showFailureToast(pinNumberErrorMessageStore);
            } else if (outcome.kind === "failed") {
                toastStore.showFailureToast(outcome.message, outcome.cause);
            }
            // the PIN prompt dismissed, or a payment already under way: nothing to say
        } finally {
            confirming = false;
        }
    }

    onMount(() => {
        payment.loadFees();
    });
    let tokenDetails = $derived($enhancedCryptoLookup.get(ledger)!);
    let tokenState = $derived(new TokenState(tokenDetails, "usd"));
    let toPayE8s = $derived(amountInE8s(selectedOption));
    let toPay = $derived(amount(toPayE8s));
    // The price includes the transfer's fee, but the wallet also pays for the approval it makes
    // before the price is pulled from it
    let approvalFee = $derived(approvalFeeE8s(tokenDetails.transferFee));
    let toPayWithFees = $derived(amount(walletCostE8s(toPayE8s, tokenDetails.transferFee)));
    let insufficientFundsForSelectedSub = $derived(insufficientFundsForSub(selectedOption.index));
    let insufficientFundsForAnySub = $derived(insufficientFundsForSub(0));
    let insufficientFundsForAllSubs = $derived(insufficientFundsForSub(3));

    let selectedDuration = $derived(indexToDuration[selectedOption?.index ?? 0] ?? "one_month");
    let headerProps = $derived(
        step === "choose" ? undefined : { key: i18nKey(selectedDuration), kind: selectedDuration },
    );

    // compared in e8s (logic/diamond): a tolerance for floating point error could hide an ICP fee
    function insufficientFundsForSub(index: number): boolean {
        return insufficientFunds(
            amountInE8s(options[index]),
            tokenDetails.transferFee,
            tokenState.remainingBalance,
            sourceWallet !== undefined,
        );
    }

    let expiry = $derived.by(() => {
        if ($diamondStatusStore.kind !== "active") return undefined;
        const expiresIn = client.diamondExpiresIn($now500, $locale);
        const expiresAtMs = Number($diamondStatusStore.expiresAt);
        const expiresAt = client.toDateString(new Date(expiresAtMs));
        return { expiresIn, expiresAt, expiresAtMs };
    });

    function getExtendTo({ index }: Option) {
        if (expiry === undefined) return undefined;
        const duration = indexToDuration[index] ?? "one_month";
        const end = membershipEnd(duration, $now500, expiry.expiresAtMs);
        if (end === undefined) return `Upgrade to lifetime`;
        return `Extend to ${client.toDateString(new Date(end))}`;
    }
</script>

{#snippet membershipTier(option: Option)}
    {@const lifetime = option.index === 3}
    {@const extendTo = getExtendTo(option)}
    {@const insufficient = insufficientFundsForSub(option.index)}
    {@const bg = lifetime
        ? insufficient
            ? ColourVars.surfaceDisabled
            : defaultBackgroundGradient
        : undefined}
    {@const txt: ColourVarKeys = lifetime ? "textOnPrimary" : (insufficient ? "textOnDisabledSurface" : "textPrimary")}
    {@const extendTxt: ColourVarKeys = lifetime ? "textOnPrimary" :(insufficient ? "textOnDisabledSurface" : "textSecondary")}
    {@const icon = lifetime
        ? ColourVars.textOnPrimary
        : insufficient
          ? ColourVars.textOnDisabledSurface
          : ColourVars.textPrimary}
    <Row
        onClick={() => {
            if (option.enabled) {
                selectedOption = option;
                // The confirm step is still reachable without the funds: it is where the user can
                // top up, or choose an external wallet to pay from instead
                transition(["slide_left"], () => {
                    step = "confirm";
                });
            }
        }}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        background={bg}
        borderRadius={"md"}
        borderWidth={lifetime ? "zero" : "thick"}
        borderColour={insufficient ? ColourVars.surfaceDisabled : ColourVars.primary}
        padding={["md", "lg"]}>
        <Column>
            <Body fontWeight={"bold"} colour={txt} width={"hug"}>
                <Translatable resourceKey={option.duration} />
            </Body>
            {#if extendTo}
                <BodySmall fontWeight={"light"} colour={extendTxt} width={"hug"}>
                    {extendTo}
                </BodySmall>
            {/if}
        </Column>
        <Row width={"hug"} gap={"sm"}>
            <Body fontWeight={"bold"} colour={txt} width={"hug"}>
                {`${amount(amountInE8s(option))} ${tokenDetails.symbol}`}
            </Body>
            <Right size={"1.5rem"} color={icon} />
        </Row>
    </Row>
{/snippet}

{#snippet selectMembershipTier()}
    <Column gap={"sm"}>
        <BodySmall colour={"textSecondary"}>
            {#if expiry !== undefined}
                <Translatable
                    resourceKey={i18nKey("upgrade.expiryMessage", {
                        relative: expiry.expiresIn,
                    })} />
            {:else}
                <Translatable resourceKey={i18nKey("Select a membership duration")} />
            {/if}
        </BodySmall>
        {#each enabledOptions as option}
            {@render membershipTier(option)}
        {/each}
    </Column>
{/snippet}

<Column {height} gap={"lg"} {padding}>
    <Column gap={"xl"}>
        <SelectMembershipHeader extend={expiry !== undefined} duration={headerProps} />

        {#if step === "confirm"}
            {#if selectedDuration !== "lifetime"}
                <Setting
                    toggle={() => (autoRenew = !autoRenew)}
                    info={"If you choose not to auto-renew, or payment cannot be taken, your account will revert to free plan. Otherwise, you will be reminded about renewal by @OpenChatBot, please make sure you have sufficient funds in your wallet."}>
                    <Switch width={"fill"} reverse checked={autoRenew}>
                        <Translatable resourceKey={i18nKey("upgrade.autorenew")} />
                    </Switch>
                </Setting>

                <StatusCard
                    background={ColourVars.surface2}
                    mode={"warning"}
                    title={interpolate($_, i18nKey("Posted files and media"))}
                    body={interpolate(
                        $_,
                        i18nKey(
                            "If you decide not to renew your membership, files and media that you have posted may be lost.",
                        ),
                    )}>
                </StatusCard>
            {:else}
                <Body colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Lifetime membership is our top-tier membership level that grants you access to all our features, now and in the future.",
                        )} />
                </Body>
            {/if}

            {#if insufficientFundsForAnySub}
                {@render insufficientWarning()}
            {/if}
            {@render cryptoSelector()}
            <SourceWalletSelector bind:wallet={sourceWallet} {ledger} />

            <Column borderRadius={"lg"} gap={"lg"} padding={"lg"} background={ColourVars.surface2}>
                <Row mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Payment amount")} />
                    </BodySmall>
                    <Body width={"hug"} colour={"primary"} fontWeight={"bold"}>
                        {toPay}
                        {tokenState.symbol}
                    </Body>
                </Row>
                {#if approvalFee > 0n}
                    <Row mainAxisAlignment={"spaceBetween"}>
                        <BodySmall colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("Fee")} />
                        </BodySmall>
                        <Body width={"hug"} colour={"textPrimary"} fontWeight={"bold"}>
                            {amount(approvalFee)}
                            {tokenState.symbol}
                        </Body>
                    </Row>
                {/if}
                <Row mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("OC treasury receives (100%)")} />
                    </BodySmall>
                    <Body width={"hug"} colour={"textPrimary"} fontWeight={"bold"}>
                        {toPay}
                        {tokenState.symbol}
                    </Body>
                </Row>
            </Column>

            <Button
                onClick={confirm}
                disabled={confirming ||
                    approving ||
                    toPayE8s === 0n ||
                    insufficientFundsForSelectedSub}
                loading={confirming || approving}>
                {#snippet icon(color)}
                    {#if selectedDuration === "lifetime"}
                        <Lifetime {color} />
                    {:else}
                        <Diamond {color} />
                    {/if}
                {/snippet}
                <Translatable resourceKey={i18nKey(`Confirm payment`)} />
            </Button>

            {#if step === "confirm"}
                {#if sourceWallet !== undefined}
                    <!-- The price is what the ledger takes from the wallet in total: the user
                         index charges a fee less than it and lets the ledger add that fee back
                         on, so there is no second fee to cover here -->
                    <ExternalWalletApproval
                        bind:this={approval}
                        wallet={sourceWallet}
                        ledger={tokenDetails.ledger}
                        amount={toPayE8s}
                        fees={0n} />
                {:else if insufficientFundsForSelectedSub}
                    {@render refreshBalance()}
                {/if}
                {#if !insufficientFundsForSelectedSub}
                    <CommonButton
                        width={"fill"}
                        size={"small_text"}
                        onClick={() => {
                            if (enabledOptions.length === 1) {
                                onCancel?.();
                            } else {
                                transition(["fade"], () => {
                                    step = "choose";
                                });
                            }
                        }}>
                        <Translatable resourceKey={i18nKey("back")} />
                    </CommonButton>
                {/if}
            {/if}
        {:else}
            {#if insufficientFundsForAnySub}
                {@render insufficientWarning()}
            {/if}

            {#if expiry !== undefined}
                <Body colour={"textSecondary"}>
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("Your current membership is due to expire in "),
                                colour: "textSecondary",
                            },
                            {
                                text: i18nKey(expiry.expiresIn!),
                                colour: "primary",
                            },
                            {
                                text: i18nKey(" on "),
                                colour: "textSecondary",
                            },
                            {
                                text: i18nKey(expiry.expiresAt),
                                colour: "primary",
                            },
                            {
                                text: i18nKey(
                                    ". Any extended membership would start from that date.",
                                ),
                                colour: "textSecondary",
                            },
                        ]} />
                </Body>
            {/if}

            {@render cryptoSelector()}
            {@render selectMembershipTier()}
            {#if insufficientFundsForAllSubs}
                {@render refreshBalance()}
            {/if}
        {/if}
    </Column>
</Column>

{#snippet refreshBalance()}
    <CommonButton
        width={"fill"}
        mode={"active"}
        size={"small_text"}
        onClick={() => refreshBalanceOrToast(tokenState, client)}>
        {#snippet icon(color, size)}
            <Refresh {color} {size} />
        {/snippet}

        <Translatable resourceKey={i18nKey(`Refresh ${tokenState.symbol} balance`)} />
    </CommonButton>
{/snippet}

{#snippet insufficientWarning()}
    <Row crossAxisAlignment={"center"} gap={"md"}>
        <Warning size={"1.5rem"} color={ColourVars.validationWarning} />
        <BodySmall fontWeight={"bold"} colour={"validationWarning"}>
            <Translatable
                resourceKey={i18nKey(
                    `Insufficient funds! Top up your ${
                        tokenState.symbol
                    } account with at least ${`${toPayWithFees} ${tokenState.symbol}`} or choose a different token as payment.`,
                )} />
        </BodySmall>
    </Row>
{/snippet}

{#snippet cryptoSelector()}
    <Column gap={"sm"}>
        <BodySmall colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("Select token to pay with")} />
        </BodySmall>

        <Row gap={"sm"}>
            <CryptoSelector
                bind:ledger
                hideBalance={sourceWallet !== undefined}
                filter={(t) => ["chat", "icp"].includes(t.symbol.toLowerCase())} />

            {#if insufficientFundsForAllSubs}
                <Column
                    onClick={() => (topup = true)}
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"center"}
                    width={{ size: "3.5rem" }}
                    height={"fill"}
                    borderRadius={"lg"}
                    background={ColourVars.surface2}
                    padding={["sm", "md"]}>
                    <QrCode size={"2rem"} color={ColourVars.textSecondary} />
                </Column>
            {/if}
        </Row>
    </Column>
{/snippet}

{#if topup}
    <Sheet
        onDismiss={() => {
            refreshBalanceOrToast(tokenState, client);
            topup = false;
        }}>
        <Column gap={"xs"} padding={"xl"}>
            <AccountInfo
                background={ColourVars.surface2}
                padding={"zero"}
                ledger={tokenState.ledger} />
            {@render refreshBalance()}
        </Column>
    </Sheet>
{/if}
