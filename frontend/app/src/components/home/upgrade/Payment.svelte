<script lang="ts">
    import {
        type DiamondMembershipDuration,
        type OpenChat,
        type ResourceKey,
        type SignerWallet,
        cryptoLookup,
        E8S_PER_TOKEN,
        mobileWidth,
    } from "@client";
    import {
        DiamondPayment,
        insufficientFunds as cannotPay,
        walletCostE8s,
    } from "@src/logic/diamond/diamondPayment.svelte";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Diamond from "../../icons/Diamond.svelte";
    import Loading from "@shared_components/Loading.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import ExternalWalletApproval from "../ExternalWalletApproval.svelte";
    import Congratulations from "./Congratulations.svelte";
    import Expiry from "@shared_components/home/upgrade/Expiry.svelte";
    import Footer from "./Footer.svelte";

    interface Props {
        accountBalance?: number;
        error: string | undefined;
        confirming?: boolean;
        confirmed?: boolean;
        refreshingBalance?: boolean;
        ledger: string;
        // The external wallet the payment will come from, or undefined for the user's own
        // OpenChat account
        sourceWallet?: SignerWallet;
        allowBack?: boolean;
        lifetime?: boolean;
        showExpiry?: boolean;
        padded?: boolean;
        onCancel: () => void;
        onFeatures?: () => void;
        onSuccess?: (proof: string) => void;
    }

    let {
        accountBalance = 0,
        error = $bindable(),
        confirming = $bindable(false),
        confirmed = $bindable(false),
        refreshingBalance = $bindable(false),
        ledger,
        sourceWallet,
        allowBack = true,
        lifetime = false,
        showExpiry = true,
        padded = true,
        onCancel,
        onFeatures,
        onSuccess,
    }: Props = $props();

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

    let autoRenew = $state(true);
    let selectedOption: Option | undefined = $state(options[lifetime ? 3 : 0]);
    let approval: ExternalWalletApproval | undefined = $state();
    let approving = $state(false);

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
            // allows while it is still handling the click
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
                confirmed = true;
                onSuccess?.(outcome.proof);
            } else if (outcome.kind === "failed") {
                // a PIN failure says why; any other failure is shown here too
                if (outcome.message.key === "upgrade.paymentFailed") error = outcome.message.key;
                toastStore.showFailureToast(outcome.message);
            }
            // dismissing the PIN prompt cancels the payment, which isn't a failure
        } finally {
            confirming = false;
        }
    }

    onMount(() => {
        payment.loadFees();
    });
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let toPayE8s = $derived(amountInE8s(selectedOption));
    // What the payment takes from the user's OpenChat wallet, which is all that is checked here:
    // the price, which includes the transfer's fee, and the approval the user makes before the
    // price is pulled from it
    let toPayWithFeesE8s = $derived(walletCostE8s(toPayE8s, tokenDetails.transferFee));
    let toPay = $derived(amount(toPayWithFeesE8s));
    // Compared in e8s, since any tolerance for floating point error would be enough to hide an ICP fee
    let insufficientFunds = $derived(
        cannotPay(
            toPayE8s,
            tokenDetails.transferFee,
            BigInt(accountBalance),
            sourceWallet !== undefined,
        ),
    );
    let selectedDuration = $derived(indexToDuration[selectedOption?.index ?? 0] ?? "one_month");
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
                        onclick={() => {
                            if (option.enabled) {
                                selectedOption = option;
                            }
                        }}>
                        <div class="option-details">
                            <p class="duration"><Translatable resourceKey={option.duration} /></p>
                            <p class="price">
                                {`${amount(amountInE8s(option))} ${tokenDetails.symbol}`}
                            </p>
                        </div>
                        {#if option.index === 3}
                            <Diamond size={"1.2em"} show={"gold"} />
                        {/if}
                    </div>
                {/each}
            </div>
            <div class="right">
                <AccountInfo fullWidthOnMobile border={false} centered {ledger} />
            </div>
        </div>

        {#if !lifetime}
            <div class="autorenew">
                <Checkbox
                    id="auto-renew"
                    onChange={() => (autoRenew = !autoRenew)}
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
            {#if insufficientFunds && sourceWallet === undefined}
                <ErrorMessage
                    ><Translatable
                        resourceKey={i18nKey("upgrade.insufficientFunds", {
                            token: tokenDetails.symbol,
                            amount: `${toPay} ${tokenDetails.symbol}`,
                        })} /></ErrorMessage>
            {/if}

            {#if sourceWallet !== undefined}
                <!-- The price is what the ledger takes from the wallet in total: the user index
                     charges a fee less than it and lets the ledger add that fee back on, so there
                     is no second fee to cover here -->
                <ExternalWalletApproval
                    bind:this={approval}
                    wallet={sourceWallet}
                    ledger={tokenDetails.ledger}
                    amount={toPayE8s}
                    fees={0n} />
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
        <Button small={!$mobileWidth} tiny={$mobileWidth} onClick={onCancel}
            ><Translatable resourceKey={i18nKey("close")} /></Button>
    {:else}
        <Button
            disabled={confirming}
            tiny={$mobileWidth}
            small={!$mobileWidth}
            secondary
            onClick={onCancel}><Translatable resourceKey={i18nKey("cancel")} /></Button>
        {#if allowBack}
            <Button
                disabled={confirming}
                tiny={$mobileWidth}
                small={!$mobileWidth}
                secondary
                onClick={onFeatures}
                ><Translatable resourceKey={i18nKey("upgrade.features")} /></Button>
        {/if}
        <Button
            small={!$mobileWidth}
            disabled={confirming ||
                approving ||
                toPayE8s === 0n ||
                (sourceWallet === undefined && insufficientFunds)}
            loading={confirming || refreshingBalance || approving}
            onClick={confirm}
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
