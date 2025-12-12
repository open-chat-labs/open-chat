<script lang="ts">
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
    } from "component-lib";
    import {
        diamondStatusStore,
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
    import { _, locale } from "svelte-i18n";
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
    import AccountInfo from "../AccountInfo.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import { TokenState } from "../wallet/walletState.svelte";
    import SelectMembershipHeader from "./SelectMembershipHeader.svelte";

    type Step = "choose" | "confirm";

    interface Props {
        lifetime?: boolean;
        onSuccess?: (proof: string) => void;
    }

    let { lifetime = false, onSuccess }: Props = $props();

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
    let topup = $state(false);

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
                    tokenState.refreshBalance(client);
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

    let expiry = $derived.by(() => {
        if ($diamondStatusStore.kind !== "active") return undefined;
        const expiresIn = client.diamondExpiresIn($now500, $locale);
        const expiresAtMs = Number($diamondStatusStore.expiresAt);
        const expiresAt = client.toDateString(new Date(expiresAtMs));
        return { expiresIn, expiresAt, expiresAtMs };
    });

    function getExtendTo({ index }: Option) {
        if (expiry === undefined) return undefined;
        const duration = indexToDuration[index] ?? 0;
        if (duration === "lifetime") return `Upgrade to lifetime`;
        const extendByMs = client.diamondDurationToMs(duration);
        return `Extend to ${client.toDateString(new Date(expiry.expiresAtMs + extendByMs))}`;
    }
</script>

{#snippet membershipTier(option: Option)}
    {@const lifetime = option.index === 3}
    {@const extendTo = getExtendTo(option)}
    {@const insufficient = insufficientFundsForSub(option.index)}
    {@const bg = lifetime
        ? insufficient
            ? ColourVars.disabledButton
            : defaultBackgroundGradient
        : undefined}
    {@const txt: ColourVarKeys = lifetime ? "textOnPrimary" : (insufficient ? "disabledButton" : "textPrimary")}
    {@const extendTxt: ColourVarKeys = lifetime ? "textOnPrimary" :(insufficient ? "disabledButton" : "textSecondary")}
    {@const icon = lifetime
        ? ColourVars.textOnPrimary
        : insufficient
          ? ColourVars.disabledButton
          : ColourVars.textPrimary}
    <Row
        onClick={() => {
            if (option.enabled) {
                selectedOption = option;
                if (!insufficient) {
                    transition(["slide_left"], () => {
                        step = "confirm";
                    });
                }
            }
        }}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        background={bg}
        borderRadius={"md"}
        borderWidth={lifetime ? "zero" : "thick"}
        borderColour={insufficient ? ColourVars.disabledButton : ColourVars.primary}
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
            {#if expiry !== undefined}
                <Translatable
                    resourceKey={i18nKey("upgrade.expiryMessage", {
                        relative: expiry.expiresIn,
                    })} />
            {:else}
                <Translatable resourceKey={i18nKey("Select a membership duration")} />
            {/if}
        </BodySmall>
        {#each options as option}
            {@render membershipTier(option)}
        {/each}
    </Column>
{/snippet}

<Column height={{ size: "100%" }} gap={"lg"} padding={["xxl", "xl"]}>
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
                            onClick={() => (topup = true)}
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
</Column>

{#if topup}
    <Sheet
        onDismiss={() => {
            tokenState.refreshBalance(client);
            topup = false;
        }}>
        <AccountInfo ledger={tokenState.ledger} />
    </Sheet>
{/if}
