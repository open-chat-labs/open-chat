<script lang="ts">
    import type { OpenChat, SignerWallet } from "@client";
    import {
        cryptoBalanceStore,
        enhancedCryptoLookup as cryptoLookup,
        mobileWidth,
    } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "../Translatable.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ExternalWalletApproval from "./ExternalWalletApproval.svelte";
    import SourceWalletSelector from "./SourceWalletSelector.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger0: string;
        ledger1: string;
        amount0: bigint;
        amount1: bigint;
        onClose: () => void;
        // `fromAccount` is an external wallet which has just approved us taking the swap amount.
        // Without it the swap is funded from the user's own OpenChat account, as it always has been.
        onAccept: (fromAccount?: string) => void;
    }

    let { ledger0, ledger1, amount0, amount1, onClose, onAccept }: Props = $props();

    let refreshing = false;
    let error: string | undefined = undefined;
    //@ts-ignore
    let balanceWithRefresh: BalanceWithRefresh;
    // The external wallet the swap will be funded from, or undefined for the user's own OpenChat
    // account, which is where it has always been funded from
    let sourceWallet = $state<SignerWallet | undefined>();
    let approval: ExternalWalletApproval | undefined = $state();
    let approving = $state(false);

    function reset() {
        balanceWithRefresh.refresh();
    }

    function accept() {
        if (approval !== undefined) {
            // The wallet has to approve us taking the swap amount before we take it. Nothing may
            // be awaited before this call - the wallet opens in a popup, which the browser only
            // allows while it is still handling the click
            approving = true;
            approval
                .approve()
                .then((fromAccount) => {
                    if (fromAccount !== undefined) {
                        onAccept(fromAccount);
                    }
                })
                .finally(() => (approving = false));
        } else {
            onAccept();
        }
    }

    let cryptoBalance = $derived($cryptoBalanceStore.get(ledger1) ?? 0n);
    let tokenDetails0 = $derived($cryptoLookup.get(ledger0)!);
    let tokenDetails1 = $derived($cryptoLookup.get(ledger1)!);
    let symbol0 = $derived(tokenDetails0.symbol);
    let symbol1 = $derived(tokenDetails1.symbol);
    let transferFees = $derived(BigInt(2) * tokenDetails1.transferFee);
    // An OpenChat balance which cannot cover the swap is no obstacle when an external wallet is
    // paying instead
    let insufficient = $derived(
        sourceWallet === undefined && cryptoBalance <= amount1 + transferFees,
    );
    let valid = $derived(error === undefined && !insufficient);
    let amount0Text = $derived(client.formatTokens(amount0, tokenDetails0.decimals));
    let amount1Text = $derived(client.formatTokens(amount1 + transferFees, tokenDetails1.decimals));
</script>

<Overlay dismissible>
    <ModalContent>
        {#snippet header()}
            <span class="header">
                <div>
                    <Translatable
                        resourceKey={i18nKey(
                            insufficient ? "p2pSwap.insufficientBalance" : "areYouSure",
                        )} />
                </div>
                <SourceWalletSelector bind:wallet={sourceWallet} />
                <BalanceWithRefresh
                    bind:this={balanceWithRefresh}
                    ledger={ledger1}
                    value={cryptoBalance}
                    label={i18nKey("p2pSwap.tokenBalance", { token: symbol1 })}
                    bold />
            </span>
        {/snippet}
        {#snippet body()}
            <form>
                <div class="body" class:insufficient>
                    {#if insufficient}
                        <p class="info">
                            <Translatable
                                resourceKey={i18nKey("p2pSwap.insufficientBalanceMessage", {
                                    amount: amount1Text,
                                    token: symbol1,
                                })} />
                        </p>
                        <AccountInfo ledger={ledger1} />
                        <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                    {:else}
                        <Translatable
                            resourceKey={i18nKey("p2pSwap.confirmAccept", {
                                amount: amount1Text,
                                token: symbol1,
                                amountOther: amount0Text,
                                tokenOther: symbol0,
                            })} />
                    {/if}
                    {#if sourceWallet !== undefined}
                        <ExternalWalletApproval
                            bind:this={approval}
                            wallet={sourceWallet}
                            ledger={ledger1}
                            amount={amount1}
                            fees={transferFees} />
                    {/if}
                </div>
            </form>
        {/snippet}
        {#snippet footer()}
            <span>
                <ButtonGroup>
                    <Button small={!$mobileWidth} tiny={$mobileWidth} secondary onClick={onClose}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    {#if insufficient}
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
                            disabled={!valid || approving}
                            loading={approving}
                            tiny={$mobileWidth}
                            onClick={accept}
                            ><Translatable resourceKey={i18nKey("yes")} /></Button>
                    {/if}
                </ButtonGroup>
            </span>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp2;
    }

    .body {
        transition: background-color 100ms ease-in-out;
        @include font(book, normal, fs-100, 28);
    }

    .how-to {
        margin-top: $sp4;
    }

    .info {
        margin-bottom: $sp3;
    }
</style>
