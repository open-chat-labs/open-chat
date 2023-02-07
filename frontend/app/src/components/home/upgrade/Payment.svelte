<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import Footer from "./Footer.svelte";
    import Loading from "../../Loading.svelte";
    import Congratulations from "./Congratulations.svelte";
    import {
        Cryptocurrency,
        cryptoLookup,
        DiamondMembershipDuration,
        E8S_PER_TOKEN,
    } from "openchat-client";
    import AccountInfo from "../AccountInfo.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import type { OpenChat } from "openchat-client";
    import Checkbox from "../../Checkbox.svelte";
    import { toastStore } from "stores/toast";

    export let accountBalance = 0;
    export let error: string | undefined;
    export let confirming = false;
    export let confirmed = false;
    export let refreshingBalance = false;

    const client = getContext<OpenChat>("client");

    const dispatch = createEventDispatcher();
    const options: Option[] = [
        {
            index: 0,
            duration: $_("upgrade.oneMonth"),
            amount: 0.2,
        },
        {
            index: 1,
            duration: $_("upgrade.threeMonths"),
            amount: 0.5,
        },
        {
            index: 2,
            duration: $_("upgrade.oneYear"),
            amount: 1.5,
        },
    ];

    let autoRenew = true;
    let selectedOption: Option | undefined = options[0];

    type Option = {
        index: number;
        duration: string;
        amount: number;
    };

    const symbol = "ICP";
    const token: Cryptocurrency = "icp";

    $: icpBalance = accountBalance / E8S_PER_TOKEN; //balance in the user's account expressed as ICP
    $: toPay = selectedOption?.amount ?? 0;
    $: insufficientFunds = toPay - icpBalance > 0.0001; //we need to account for the fact that js cannot do maths
    $: howToBuyUrl = cryptoLookup[token].howToBuyUrl;

    function cancel() {
        dispatch("cancel");
    }

    function features() {
        dispatch("features");
    }

    function selectedDuration(): DiamondMembershipDuration {
        if (selectedOption?.index === 0) return "one_month";
        if (selectedOption?.index === 1) return "three_months";
        if (selectedOption?.index === 2) return "one_year";
        return "one_month";
    }

    function expectedPrice(): bigint {
        if (selectedOption !== undefined) {
            return BigInt(selectedOption.amount * E8S_PER_TOKEN);
        }
        return BigInt(options[0].amount * E8S_PER_TOKEN);
    }

    function confirm() {
        confirming = true;
        client
            .payForDiamondMembership(token, selectedDuration(), autoRenew, expectedPrice())
            .then((success) => {
                if (success) {
                    confirmed = true;
                } else {
                    toastStore.showFailureToast("upgrade.paymentFailed");
                }
            })
            .finally(() => (confirming = false));
    }
</script>

<div class="body" class:confirming class:is-confirmed={confirmed}>
    {#if confirming}
        <Loading size={"large"} />
    {:else if confirmed}
        <Congratulations />
    {:else}
        <div class="cols">
            <div class="left">
                {#each options as option}
                    <div
                        class="option"
                        class:insufficientFunds={insufficientFunds && !refreshingBalance}
                        class:selected={selectedOption?.index === option.index}
                        on:click={() => (selectedOption = option)}>
                        <p class="duration">{option.duration}</p>
                        <p class="price">{`${option.amount} ICP`}</p>
                    </div>
                {/each}
            </div>
            <div class="right">
                <AccountInfo border={false} centered {token} user={client.user} />
            </div>
        </div>

        <div class="autorenew">
            <Checkbox
                id="auto-renew"
                on:change={() => (autoRenew = !autoRenew)}
                label={$_("upgrade.autorenew")}
                align={"start"}
                checked={autoRenew}>
                <div class="section-title">{$_("upgrade.autorenew")}</div>
                <div class="smallprint">
                    {$_("upgrade.paymentSmallprint")}
                </div>
                {#if insufficientFunds && !refreshingBalance}
                    <ErrorMessage
                        >{$_("upgrade.insufficientFunds", {
                            values: { amount: `${toPay} ICP` },
                        })}</ErrorMessage>
                {/if}

                <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                    {$_("howToBuyToken", { values: { token: symbol.toUpperCase() } })}
                </a>

                {#if error}
                    <ErrorMessage>{error}</ErrorMessage>
                {/if}
            </Checkbox>
        </div>
    {/if}
</div>
<Footer align={$mobileWidth ? "center" : "end"}>
    {#if confirmed}
        <Button small={!$mobileWidth} tiny={$mobileWidth} on:click={cancel}>{$_("close")}</Button>
    {:else}
        <Button
            disabled={confirming}
            tiny={$mobileWidth}
            small={!$mobileWidth}
            secondary={true}
            on:click={cancel}>{$_("cancel")}</Button>
        <Button
            disabled={confirming}
            tiny={$mobileWidth}
            small={!$mobileWidth}
            secondary={true}
            on:click={features}>{$_("upgrade.features")}</Button>
        <Button
            small={!$mobileWidth}
            disabled={confirming || insufficientFunds}
            loading={confirming || refreshingBalance}
            on:click={confirm}
            tiny={$mobileWidth}>{$_("upgrade.confirm")}</Button>
    {/if}
</Footer>

<style type="text/scss">
    .body {
        padding: $sp4 $sp5;
        min-height: 390px;
        transition: height 200ms ease-in-out;

        &.is-confirmed {
            height: 240px;
        }

        &.confirming {
            height: 390px;
        }

        @include mobile() {
            padding: $sp3 $sp4;
        }
    }

    .option {
        border: 1px solid var(--bd);
        padding: $sp3 $sp4;
        border-radius: $sp3;
        margin-bottom: $sp4;
        cursor: pointer;
        transition: background-color 250ms ease-in-out;

        &.selected {
            background-color: var(--primary);
            color: #ffffff;

            &.insufficientFunds {
                background-color: var(--txt-light);
            }
        }

        @include mobile() {
            text-align: center;
            padding: 12px $sp4;
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
        margin-bottom: $sp3;
        @include mobile() {
            margin-bottom: $sp2;
        }
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
