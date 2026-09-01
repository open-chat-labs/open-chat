<script lang="ts">
    import { Body, Column, CommonButton, Row, Sheet, Subtitle } from "component-lib";
    import type { OpenChat, SignerWallet } from "@client";
    import { cryptoBalanceStore, enhancedCryptoLookup as cryptoLookup } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
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
            // allows while it is still handling the tap
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

<Sheet onDismiss={onClose}>
    <Column gap={"lg"} padding={"lg"}>
        <Row mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
            <Subtitle width={"hug"} fontWeight={"bold"}>
                <Translatable
                    resourceKey={i18nKey(
                        insufficient ? "p2pSwap.insufficientBalance" : "areYouSure",
                    )} />
            </Subtitle>
            <Row width={"hug"} crossAxisAlignment={"center"} gap={"md"}>
                <SourceWalletSelector bind:wallet={sourceWallet} />
                <!-- The balance is the external wallet's business while one is selected, so only
                     show OpenChat's own -->
                {#if sourceWallet === undefined}
                    <BalanceWithRefresh
                        bind:this={balanceWithRefresh}
                        ledger={ledger1}
                        value={cryptoBalance} />
                {/if}
            </Row>
        </Row>
        <div class="body" class:insufficient>
            {#if insufficient}
                <Body colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey("p2pSwap.insufficientBalanceMessage", {
                            amount: amount1Text,
                            token: symbol1,
                        })} />
                </Body>
                <AccountInfo ledger={ledger1} />
            {:else}
                <Body colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey("p2pSwap.confirmAccept", {
                            amount: amount1Text,
                            token: symbol1,
                            amountOther: amount0Text,
                            tokenOther: symbol0,
                        })} />
                </Body>
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
        <Row gap={"md"} mainAxisAlignment={"end"} crossAxisAlignment={"center"}>
            <CommonButton size={"small_text"} onClick={onClose}
                ><Translatable resourceKey={i18nKey("cancel")} /></CommonButton>
            {#if insufficient}
                <CommonButton
                    mode={"active"}
                    size={"medium"}
                    width={{ size: "4rem" }}
                    disabled={refreshing}
                    loading={refreshing}
                    onClick={reset}><Translatable resourceKey={i18nKey("refresh")} /></CommonButton>
            {:else}
                <CommonButton
                    width={{ size: "4rem" }}
                    mode={"active"}
                    size={"medium"}
                    disabled={!valid || approving}
                    loading={approving}
                    onClick={accept}
                    ><Translatable resourceKey={i18nKey("yes")} /></CommonButton>
            {/if}
        </Row>
    </Column>
</Sheet>
