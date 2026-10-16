<script lang="ts">
    import {
        enhancedCryptoLookup,
        iconSize,
        mobileWidth,
        type NamedAccount,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import { ErrorCode } from "@shared";
    import { getContext, onMount, untrack } from "svelte";
    import QrcodeScan from "svelte-material-icons/QrcodeScan.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Input from "../../Input.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import NetworkSelector from "../NetworkSelector.svelte";
    import TokenInput from "../TokenInput.svelte";
    import AccountSelector from "./AccountSelector.svelte";
    import SaveAccount from "./SaveAccount.svelte";
    import Scanner from "./Scanner.svelte";
    import { TokenState } from "@shared_components/home/wallet/walletState.svelte";
    import { WithdrawForm } from "@shared_components/home/wallet/withdrawForm.svelte";

    interface Props {
        ledger: string;
        onClose: () => void;
    }

    let { ledger, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let error: ResourceKey | undefined = $state();
    let busy = $state(false);
    let validAccountName = $state(false);
    let capturingAccount = $state(false);

    let scanner: Scanner;
    let accounts: NamedAccount[] = $state([]);
    let saveAccountElement: SaveAccount;

    // Built once: the modal is opened for one ledger, and rebuilding it whenever the lookup changes
    // would reset the amount being typed. The balance is read live from the balance store.
    const tokenState = new TokenState(untrack(() => $enhancedCryptoLookup.get(ledger)));
    const form = new WithdrawForm(client, tokenState);
    let symbol = $derived(tokenState.symbol);
    let valid = $derived(capturingAccount ? validAccountName : form.canSend);
    let title = $derived(i18nKey("cryptoAccount.sendToken", { symbol }));
    let errorMessage = $derived(error !== undefined ? error : $pinNumberErrorMessageStore);

    onMount(async () => {
        accounts = await client.loadSavedCryptoAccounts();
    });

    function saveAccount() {
        if (saveAccountElement !== undefined) {
            saveAccountElement
                .saveAccount()
                .then((resp) => {
                    if (resp.kind === "success") {
                        onClose();
                    } else if (resp.kind === "error" && resp.code === ErrorCode.NameTaken) {
                        error = i18nKey("tokenTransfer.accountNameTaken");
                    } else {
                        error = i18nKey("tokenTransfer.failedToSaveAccount");
                    }
                })
                .finally(() => (busy = false));
        }
    }

    function scan() {
        scanner?.scan();
    }

    function unknownAccount(account: string): boolean {
        return accounts.find((a) => a.account === account) === undefined;
    }

    async function send() {
        if (!valid) return;

        busy = true;
        error = undefined;
        const outcome = await form.send();
        busy = false;

        switch (outcome.kind) {
            case "sent":
                tokenState.draftAmount = 0n;
                toastStore.showSuccessToast(i18nKey("cryptoAccount.sendSucceeded", { symbol }));
                // Only an account on the token's own ledger can be saved, not eg. a BTC or Solana
                // address, as on mobile
                if (form.route.kind === "ledger" && unknownAccount(form.targetAccount)) {
                    capturingAccount = true;
                } else {
                    onClose();
                    form.targetAccount = "";
                }
                break;
            case "cancelled":
                break;
            case "failed":
                error = outcome.message;
                break;
            default:
                outcome satisfies never;
        }
    }

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(err: string) {
        error = i18nKey(err);
    }

    function onPrimaryClick() {
        busy = true;
        if (capturingAccount) {
            saveAccount();
        } else {
            send();
        }
    }
</script>

<ModalContent>
    {#snippet header()}
        <span class="header">
            <div class="main-title"><Translatable resourceKey={title} /></div>
            <BalanceWithRefresh
                {ledger}
                value={tokenState.remainingBalance}
                label={i18nKey("cryptoAccount.shortBalanceLabel")}
                bold
                onRefreshed={onBalanceRefreshed}
                onError={onBalanceRefreshError} />
        </span>
    {/snippet}
    {#snippet body()}
        <form class="body">
            {#if capturingAccount}
                <SaveAccount
                    bind:this={saveAccountElement}
                    bind:valid={validAccountName}
                    account={form.targetAccount}
                    {accounts} />
            {:else}
                <Scanner onData={(data) => (form.targetAccount = data)} bind:this={scanner} />

                {#if form.networks.length > 0 && form.selectedNetwork !== undefined}
                    <NetworkSelector networks={form.networks} bind:selectedNetwork={form.selectedNetwork} />
                {/if}

                <div class="token-input">
                    <TokenInput
                        {ledger}
                        transferFees={tokenState.transferFees}
                        minAmount={form.minAmount}
                        maxAmount={BigInt(Math.max(0, Number(tokenState.maxAmount)))}
                        bind:valid={form.validAmount}
                        bind:amount={tokenState.draftAmount} />
                </div>
                <div class="target">
                    <Input
                        bind:value={form.targetAccount}
                        countdown={false}
                        maxlength={100}
                        invalid={form.targetAccount.length > 0 && !form.targetAccountValid}
                        placeholder={i18nKey("cryptoAccount.sendTarget")} />

                    <div class="qr" onclick={scan}>
                        <QrcodeScan size={$iconSize} color={"var(--icon-selected)"} />
                    </div>
                </div>

                {#if form.targetIsUserIdAccount}
                    <ErrorMessage
                        ><Translatable
                            resourceKey={i18nKey("cryptoAccount.sendToUserId")} /></ErrorMessage>
                {/if}

                {#if accounts.length > 0 || form.networkFeeFormatted !== undefined}
                    <div class="lower-container">
                        {#if accounts.length > 0}
                            <div class="accounts">
                                <AccountSelector bind:targetAccount={form.targetAccount} {accounts} />
                            </div>
                        {/if}

                        {#if form.networkFeeFormatted !== undefined}
                            <div class="network-fee">
                                <Translatable
                                    resourceKey={i18nKey("cryptoAccount.networkFee", {
                                        amount: form.networkFeeFormatted,
                                        token: symbol,
                                    })} />
                            </div>
                        {/if}
                    </div>
                {/if}
            {/if}

            {#if errorMessage !== undefined}
                <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
            {/if}
        </form>
    {/snippet}
    {#snippet footer()}
        <span>
            <ButtonGroup>
                <Button secondary tiny={$mobileWidth} onClick={onClose}
                    ><Translatable
                        resourceKey={i18nKey(capturingAccount ? "noThanks" : "cancel")} /></Button>
                <Button
                    disabled={busy || !valid}
                    loading={busy}
                    tiny={$mobileWidth}
                    onClick={onPrimaryClick}
                    ><Translatable
                        resourceKey={i18nKey(
                            capturingAccount ? "tokenTransfer.saveAccount" : "tokenTransfer.send",
                        )} /></Button>
            </ButtonGroup>
        </span>
    {/snippet}
</ModalContent>

<style lang="scss">
    :global(.target .input-wrapper input) {
        padding-right: 40px;
    }

    .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: $sp2;

        .main-title {
            flex: auto;
        }
    }

    .body {
        display: flex;
        flex-direction: column;
    }

    .token-input {
        margin-bottom: $sp3;
    }

    .target {
        position: relative;

        .qr {
            position: absolute !important;
            top: 10px;
            right: $sp3;
            cursor: pointer;
        }
    }

    .lower-container {
        display: flex;
        justify-content: space-between;
    }

    .network-fee {
        @include font(book, normal, fs-60);
        margin-left: auto;
    }
</style>
