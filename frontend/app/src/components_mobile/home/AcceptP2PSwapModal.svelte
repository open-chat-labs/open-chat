<script lang="ts">
    import { Body, Column, CommonButton, Row, Sheet, Subtitle } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { cryptoBalanceStore, enhancedCryptoLookup as cryptoLookup } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger0: string;
        ledger1: string;
        amount0: bigint;
        amount1: bigint;
        onClose: () => void;
        onAccept: () => void;
    }

    let { ledger0, ledger1, amount0, amount1, onClose, onAccept }: Props = $props();

    let refreshing = false;
    let error: string | undefined = undefined;
    //@ts-ignore
    let balanceWithRefresh: BalanceWithRefresh;

    function reset() {
        balanceWithRefresh.refresh();
    }

    let cryptoBalance = $derived($cryptoBalanceStore.get(ledger1) ?? 0n);
    let tokenDetails0 = $derived($cryptoLookup.get(ledger0)!);
    let tokenDetails1 = $derived($cryptoLookup.get(ledger1)!);
    let symbol0 = $derived(tokenDetails0.symbol);
    let symbol1 = $derived(tokenDetails1.symbol);
    let transferFees = $derived(BigInt(2) * tokenDetails1.transferFee);
    let insufficient = $derived(cryptoBalance <= amount1 + transferFees);
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
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                ledger={ledger1}
                value={cryptoBalance} />
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
                    disabled={!valid}
                    onClick={onAccept}><Translatable resourceKey={i18nKey("yes")} /></CommonButton>
            {/if}
        </Row>
    </Column>
</Sheet>
