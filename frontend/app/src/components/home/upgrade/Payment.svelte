<script lang="ts">
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import Footer from "./Footer.svelte";
    import Loading from "../../Loading.svelte";
    import Congratulations from "./Congratulations.svelte";
    import {
        type DiamondMembershipDuration,
        type OpenChat,
        E8S_PER_TOKEN,
        type DiamondMembershipFees,
        type ResourceKey,
        cryptoLookup,
        currentUser as user,
    } from "openchat-client";
    import AccountInfo from "../AccountInfo.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Checkbox from "../../Checkbox.svelte";
    import { toastStore } from "../../../stores/toast";
    import Expiry from "./Expiry.svelte";
    import Diamond from "../../icons/Diamond.svelte";
    import type { RemoteData } from "../../../utils/remoteData";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    export let accountBalance = 0;
    export let error: string | undefined;
    export let confirming = false;
    export let confirmed = false;
    export let refreshingBalance = false;
    export let ledger: string;
    export let allowBack = true;
    export let lifetime = false;
    export let showExpiry = true;
    export let padded = true;

    type FeeKey = keyof Omit<DiamondMembershipFees, "token">;
    type FeeData = RemoteData<Record<"ICP" | "CHAT", DiamondMembershipFees>, string>;

    const client = getContext<OpenChat>("client");

    const dispatch = createEventDispatcher();
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

    let autoRenew = true;
    let selectedOption: Option | undefined = options[lifetime ? 3 : 0];

    type Option = {
        index: number;
        duration: ResourceKey;
        fee: FeeKey;
        enabled: boolean;
    };

    let diamondFees: FeeData = {
        kind: "idle",
    };

    $: icpBalance = accountBalance / E8S_PER_TOKEN; //balance in the user's account expressed as ICP
    $: toPayE8s = amountInE8s(tokenDetails.symbol, diamondFees, selectedOption);
    $: toPay = amount(toPayE8s);
    $: insufficientFunds = toPay - icpBalance > 0.0001; //we need to account for the fact that js cannot do maths
    $: tokenDetails = $cryptoLookup[ledger];
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: selectedDuration = indexToDuration[selectedOption?.index ?? 0] ?? "one_month";

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

    function cancel() {
        dispatch("cancel");
    }

    function features() {
        dispatch("features");
    }

    function confirm() {
        confirming = true;
        client
            .payForDiamondMembership(
                tokenDetails.symbol,
                selectedDuration,
                autoRenew && selectedDuration !== "lifetime",
                toPayE8s,
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    confirmed = true;
                    dispatch("success", resp.proof);
                } else {
                    const errorKey = "upgrade.paymentFailed";
                    error = errorKey;
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
</script>

<div class="body" class:padded class:confirming class:is-confirmed={confirmed}>
    {#if confirming}
        <Loading size={"large"} />
    {:else if confirmed}
        <Congratulations />
    {:else}
        {#if showExpiry}
            <Expiry extendBy={selectedDuration} />
        {/if}
        <div class="cols">
            <div class="left">
                {#each options as option}
                    <div
                        role="button"
                        tabindex="0"
                        class="option"
                        class:disabled={!option.enabled}
                        class:insufficientFunds={insufficientFunds && !refreshingBalance}
                        class:selected={selectedOption?.index === option.index}
                        on:click={() => {
                            if (option.enabled) {
                                selectedOption = option;
                            }
                        }}>
                        <div class="option-details">
                            <p class="duration"><Translatable resourceKey={option.duration} /></p>
                            <p class="price">
                                {`${amount(
                                    amountInE8s(tokenDetails.symbol, diamondFees, option),
                                )} ${tokenDetails.symbol}`}
                            </p>
                        </div>
                        {#if option.index === 3}
                            <Diamond size={"1.2em"} show={"gold"} />
                        {/if}
                    </div>
                {/each}
            </div>
            <div class="right">
                <AccountInfo fullWidthOnMobile border={false} centered {ledger} user={$user} />
            </div>
        </div>

        {#if !lifetime}
            <div class="autorenew">
                <Checkbox
                    id="auto-renew"
                    on:change={() => (autoRenew = !autoRenew)}
                    label={i18nKey("upgrade.autorenew")}
                    align={"start"}
                    disabled={selectedDuration === "lifetime"}
                    checked={autoRenew && selectedDuration !== "lifetime"}>
                    <div class="section-title">
                        <Translatable resourceKey={i18nKey("upgrade.autorenew")} />
                    </div>
                    <div class="smallprint">
                        <Translatable resourceKey={i18nKey("upgrade.paymentSmallprint")} />
                    </div>
                </Checkbox>
            </div>
        {/if}

        <div class="autorenew">
            {#if insufficientFunds && !refreshingBalance}
                <ErrorMessage
                    ><Translatable
                        resourceKey={i18nKey("upgrade.insufficientFunds", {
                            token: tokenDetails.symbol,
                            amount: `${toPay} ${tokenDetails.symbol}`,
                        })} /></ErrorMessage>
                <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                    <Translatable
                        resourceKey={i18nKey("howToBuyToken", {
                            token: tokenDetails.symbol,
                        })} />
                </a>
            {/if}

            {#if error}
                <ErrorMessage>
                    <Translatable resourceKey={i18nKey(error)} />
                </ErrorMessage>
            {/if}
        </div>
    {/if}
</div>
<Footer align={$mobileWidth ? "center" : "end"}>
    {#if confirmed}
        <Button small={!$mobileWidth} tiny={$mobileWidth} on:click={cancel}
            ><Translatable resourceKey={i18nKey("close")} /></Button>
    {:else}
        <Button
            disabled={confirming}
            tiny={$mobileWidth}
            small={!$mobileWidth}
            secondary
            on:click={cancel}><Translatable resourceKey={i18nKey("cancel")} /></Button>
        {#if allowBack}
            <Button
                disabled={confirming}
                tiny={$mobileWidth}
                small={!$mobileWidth}
                secondary
                on:click={features}
                ><Translatable resourceKey={i18nKey("upgrade.features")} /></Button>
        {/if}
        <Button
            small={!$mobileWidth}
            disabled={confirming || insufficientFunds}
            loading={confirming || refreshingBalance}
            on:click={confirm}
            tiny={$mobileWidth}><Translatable resourceKey={i18nKey("upgrade.confirm")} /></Button>
    {/if}
</Footer>

<style lang="scss">
    .body {
        min-height: 390px;
        transition: height 200ms ease-in-out;

        &.padded {
            padding: $sp4 $sp5;
            @include mobile() {
                padding: $sp3 $sp4;
            }
        }

        &.is-confirmed {
            height: 240px;
        }

        &.confirming {
            height: 390px;
        }
    }

    .option {
        border: 1px solid var(--bd);
        padding: $sp3 $sp4;
        border-radius: $sp3;
        margin-bottom: $sp4;
        cursor: pointer;
        transition: background-color 250ms ease-in-out;
        display: flex;
        justify-content: space-between;
        align-items: center;

        &.selected {
            background-color: var(--primary);
            color: #ffffff;

            &.insufficientFunds {
                background-color: var(--txt-light);
            }
        }

        &.disabled {
            color: var(--txt-light);
            cursor: default;
        }

        @include mobile() {
            text-align: center;
            padding: 10px $sp4;
            margin-bottom: $sp3;
        }
    }

    .cols {
        display: flex;
        gap: $sp4;

        .left,
        .right {
            flex: 1;
        }
    }

    .duration {
        @include font-size(fs-70);
        text-transform: uppercase;
        margin-bottom: $sp2;
    }

    .price {
        @include font(bold, normal, fs-120);
    }

    .autorenew {
        margin-bottom: $sp4;
    }

    .smallprint {
        @include font(light, normal, fs-60);
        color: var(--txt-light);
        margin-bottom: $sp3;
    }
</style>
