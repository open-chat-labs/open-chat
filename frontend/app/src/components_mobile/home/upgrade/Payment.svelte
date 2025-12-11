<script lang="ts">
    import {
        Body,
        BodySmall,
        Button,
        ColourVars,
        Column,
        CommonButton,
        defaultBackgroundGradient,
        Row,
        StatusCard,
        Switch,
        transition,
        type ColourVarKeys,
    } from "component-lib";
    import {
        E8S_PER_TOKEN,
        enhancedCryptoLookup,
        LEDGER_CANISTER_CHAT,
        LEDGER_CANISTER_ICP,
        type DiamondMembershipDuration,
        type DiamondMembershipFees,
        type OpenChat,
        type ResourceKey,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Warning from "svelte-material-icons/AlertRhombusOutline.svelte";
    import Right from "svelte-material-icons/ChevronRight.svelte";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import Lifetime from "svelte-material-icons/DiamondStone.svelte";
    import QrCode from "svelte-material-icons/QrCode.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import type { RemoteData } from "../../../utils/remoteData";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import { TokenState } from "../wallet/walletState.svelte";
    import Expiry from "./Expiry.svelte";
    import SelectMembershipHeader from "./SelectMembershipHeader.svelte";

    type Step = "choose" | "confirm";

    interface Props {
        lifetime?: boolean;
        showExpiry?: boolean;
        onSuccess?: (proof: string) => void;
    }

    let { lifetime = false, showExpiry = true, onSuccess }: Props = $props();

    let confirming = $state(false);
    let step = $state<Step>("choose");

    type FeeKey = keyof Omit<DiamondMembershipFees, "token">;
    type FeeData = RemoteData<Record<"ICP" | "CHAT", DiamondMembershipFees>, string>;

    const client = getContext<OpenChat>("client");

    const options: Option[] = [
        {
            index: 0,
            duration: i18nKey("upgrade.oneMonth"),
            fee: "oneMonth",
            enabled: !lifetime,
        },
        {
            index: 1,
            duration: i18nKey("upgrade.threeMonths"),
            fee: "threeMonths",
            enabled: !lifetime,
        },
        {
            index: 2,
            duration: i18nKey("upgrade.oneYear"),
            fee: "oneYear",
            enabled: !lifetime,
        },
        {
            index: 3,
            duration: i18nKey("upgrade.lifetime"),
            fee: "lifetime",
            enabled: true,
        },
    ];

    let autoRenew = $state(true);
    let selectedOption: Option | undefined = $state(options[lifetime ? 3 : 0]);

    let ledger: string = $state(
        import.meta.env.OC_NODE_ENV === "production" ? LEDGER_CANISTER_CHAT : LEDGER_CANISTER_ICP,
    );

    type Option = {
        index: number;
        duration: ResourceKey;
        fee: FeeKey;
        enabled: boolean;
    };

    let diamondFees: FeeData = $state({
        kind: "idle",
    });

    const indexToDuration: Record<number, DiamondMembershipDuration> = {
        0: "one_month",
        1: "three_months",
        2: "one_year",
        3: "lifetime",
    };

    function amount(e8s: bigint): number {
        return Number(e8s) / E8S_PER_TOKEN;
    }

    function amountInE8s(symbol: string, fees: FeeData, option: Option | undefined): bigint {
        if (fees.kind !== "success" || option === undefined) {
            return 0n;
        }
        return fees.data[symbol as "ICP" | "CHAT"][option.fee] ?? 0n;
    }

    function confirm() {
        confirming = true;
        client
            .payForDiamondMembership(
                tokenDetails.ledger,
                selectedDuration,
                autoRenew && selectedDuration !== "lifetime",
                toPayE8s,
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    onSuccess?.(resp.proof);
                } else {
                    const errorKey = "upgrade.paymentFailed";
                    toastStore.showFailureToast(i18nKey(errorKey));
                }
            })
            .finally(() => (confirming = false));
    }

    onMount(() => {
        diamondFees = { kind: "loading" };
        client
            .diamondMembershipFees()
            .then((fees) => {
                diamondFees = {
                    kind: "success",
                    data: client.toRecord(fees, (f) => f.token),
                };
            })
            .catch((err) => {
                diamondFees = { kind: "error", error: err };
            });
    });
    let tokenDetails = $derived($enhancedCryptoLookup.get(ledger)!);
    let tokenState = $derived(new TokenState(tokenDetails, "usd"));
    let toPayE8s = $derived(amountInE8s(tokenDetails.symbol, diamondFees, selectedOption));
    let toPay = $derived(amount(toPayE8s));
    let insufficientFundsForSelectedSub = $derived(insufficientFundsForSub(selectedOption.index)); //we need to account for the fact that js cannot do maths
    let insufficientFundsForAnySub = $derived(insufficientFundsForSub(0));
    let insufficientFundsForAllSubs = $derived(insufficientFundsForSub(3));

    let selectedDuration = $derived(indexToDuration[selectedOption?.index ?? 0] ?? "one_month");
    let headerProps = $derived(
        step === "choose" ? undefined : { key: i18nKey(selectedDuration), kind: selectedDuration },
    );

    function insufficientFundsForSub(index: number): boolean {
        const toPayE8s = amountInE8s(tokenDetails.symbol, diamondFees, options[index]);
        return toPayE8s - tokenState.remainingBalance > 0.0001;
    }
</script>

{#snippet membershipTier(option: Option)}
    {@const insufficient = insufficientFundsForSub(option.index)}
    {@const bg =
        option.index === 3
            ? insufficient
                ? ColourVars.disabledButton
                : defaultBackgroundGradient
            : undefined}
    {@const txt: ColourVarKeys = option.index === 3 ? "textOnPrimary" : (insufficient ? "disabledButton" : "textPrimary")}
    {@const icon =
        option.index === 3
            ? ColourVars.textOnPrimary
            : insufficient
              ? ColourVars.disabledButton
              : ColourVars.textPrimary}
    <Row
        onClick={() => {
            if (option.enabled) {
                selectedOption = option;
                if (!insufficient) {
                    transition(["fade"], () => {
                        step = "confirm";
                    });
                }
            }
        }}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        background={bg}
        borderRadius={"md"}
        borderWidth={"thick"}
        borderColour={insufficient ? ColourVars.disabledButton : ColourVars.primary}
        padding={["md", "lg"]}>
        <Body fontWeight={"bold"} colour={txt} width={"hug"}>
            <Translatable resourceKey={option.duration} />
        </Body>
        <Row width={"hug"} gap={"sm"}>
            <Body fontWeight={"bold"} colour={txt} width={"hug"}>
                {`${amount(amountInE8s(tokenDetails.symbol, diamondFees, option))} ${
                    tokenDetails.symbol
                }`}
            </Body>
            <Right size={"1.5rem"} color={icon} />
        </Row>
    </Row>
{/snippet}

{#snippet selectMembershipTier()}
    <Column gap={"sm"}>
        <BodySmall colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("Select a membership duration")} />
        </BodySmall>
        {#each options as option}
            {@render membershipTier(option)}
        {/each}
    </Column>
{/snippet}

<Column height={{ size: "100%" }} gap={"lg"} padding={["xxl", "xl"]}>
    <Column gap={"xl"}>
        <SelectMembershipHeader duration={headerProps} />

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
                    background={ColourVars.background2}
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

            <Column
                borderRadius={"lg"}
                gap={"lg"}
                padding={"lg"}
                background={ColourVars.background2}>
                <Row mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Payment amount")} />
                    </BodySmall>
                    <Body width={"hug"} colour={"primary"} fontWeight={"bold"}>
                        {toPay}
                        {tokenState.symbol}
                    </Body>
                </Row>
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
                disabled={confirming || insufficientFundsForSelectedSub}
                loading={confirming}>
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
                <CommonButton
                    width={"fill"}
                    size={"small_text"}
                    onClick={() => {
                        transition(["fade"], () => {
                            step = "choose";
                        });
                    }}>
                    <Translatable resourceKey={i18nKey("back")} />
                </CommonButton>
            {/if}
        {:else}
            {#if insufficientFundsForAnySub}
                <Row crossAxisAlignment={"center"} gap={"md"}>
                    <Warning size={"1.5rem"} color={ColourVars.warning} />
                    <BodySmall fontWeight={"bold"} colour={"warning"}>
                        <Translatable
                            resourceKey={i18nKey(
                                `Insufficient funds! Top up your ${
                                    tokenState.symbol
                                } account with at least ${`${toPay} ${tokenState.symbol}`} or choose a different token as payment.`,
                            )} />
                    </BodySmall>
                </Row>
            {/if}

            <Column gap={"sm"}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("Select token to pay with")} />
                </BodySmall>

                <Row gap={"sm"}>
                    <CryptoSelector
                        bind:ledger
                        filter={(t) => ["chat", "icp"].includes(t.symbol.toLowerCase())} />

                    {#if insufficientFundsForAllSubs}
                        <Column
                            mainAxisAlignment={"center"}
                            crossAxisAlignment={"center"}
                            width={{ size: "3.5rem" }}
                            height={"fill"}
                            borderRadius={"lg"}
                            background={ColourVars.background2}
                            padding={["sm", "md"]}>
                            <QrCode size={"2rem"} color={ColourVars.textSecondary} />
                        </Column>
                    {/if}
                </Row>
            </Column>
            {@render selectMembershipTier()}

            {#if insufficientFundsForAllSubs}
                <CommonButton
                    width={"fill"}
                    mode={"active"}
                    size={"small_text"}
                    onClick={() => tokenState.refreshBalance(client)}>
                    {#snippet icon(color, size)}
                        <Refresh {color} {size} />
                    {/snippet}

                    <Translatable resourceKey={i18nKey(`Refresh ${tokenState.symbol} balance`)} />
                </CommonButton>
            {/if}
        {/if}
    </Column>
    {#if showExpiry}
        <Expiry extendBy={selectedDuration} />
    {/if}
</Column>
