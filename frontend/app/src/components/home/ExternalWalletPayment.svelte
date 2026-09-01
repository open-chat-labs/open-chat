<script lang="ts">
    import {
        cryptoLookup,
        SIGNER_WALLETS,
        type OpenChat,
        type SignerWallet,
        type WalletAccount,
    } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        ledger: string;
        // What the payment itself will take
        amount: bigint;
        // What the ledger will charge against the allowance on top of `amount`. Defaults to a
        // single transfer fee, which is what a payment made as one transfer costs; a flow which
        // moves the funds more than once has to say so.
        fees?: bigint;
        disabled?: boolean;
        // The wallet account to pay from, once it has approved us spending `amount` plus the fee.
        // The approval is short lived, so make the payment now rather than holding on to this.
        onApproved: (fromAccount: string) => void;
    }

    let { ledger, amount, fees, disabled = false, onApproved }: Props = $props();

    const client = getContext<OpenChat>("client");

    type State =
        | { kind: "idle" }
        | { kind: "connecting"; wallet: SignerWallet }
        | {
              kind: "choosing";
              wallet: SignerWallet;
              accounts: WalletAccount[];
              choose: (account: WalletAccount | undefined) => void;
          }
        | { kind: "approving"; wallet: SignerWallet };

    let flow = $state<State>({ kind: "idle" });
    let error = $state(false);

    let tokenDetails = $derived($cryptoLookup.get(ledger));
    let busy = $derived(flow.kind !== "idle");

    function connect(wallet: SignerWallet) {
        if (tokenDetails === undefined) return;

        // Nothing may be awaited before this call: the wallet opens in a popup, which the browser
        // only allows while it is still handling the click which asked for it
        error = false;
        flow = { kind: "connecting", wallet };

        client
            .approveExternalWalletSpending(
                wallet,
                ledger,
                amount + (fees ?? tokenDetails.transferFee),
                (accounts) =>
                    new Promise((resolve) => {
                        flow = { kind: "choosing", wallet, accounts, choose: resolve };
                    }),
                () => (flow = { kind: "approving", wallet }),
            )
            .then((fromAccount) => {
                if (fromAccount !== undefined) {
                    onApproved(fromAccount);
                }
            })
            .catch(() => (error = true))
            .finally(() => (flow = { kind: "idle" }));
    }
</script>

<div class="external-wallet">
    <div class="title">
        <Translatable resourceKey={i18nKey("externalWallet.title")} />
    </div>

    {#if flow.kind === "choosing"}
        <div class="prompt">
            <Translatable resourceKey={i18nKey("externalWallet.chooseAccount")} />
        </div>
        <div class="accounts">
            {#each flow.accounts as account (account.address)}
                <Button small onClick={() => flow.kind === "choosing" && flow.choose(account)}>
                    {account.address}
                </Button>
            {/each}
        </div>
    {:else}
        <div class="prompt">
            <Translatable resourceKey={i18nKey("externalWallet.subtitle")} />
        </div>
        <div class="wallets">
            {#each SIGNER_WALLETS as wallet (wallet.id)}
                <Button
                    small
                    secondary
                    disabled={disabled || busy}
                    loading={flow.kind !== "idle" && flow.wallet.id === wallet.id}
                    onClick={() => connect(wallet)}>
                    {wallet.name}
                </Button>
            {/each}
        </div>
    {/if}

    {#if flow.kind === "connecting" || flow.kind === "approving"}
        <div class="prompt">
            <Translatable
                resourceKey={i18nKey(`externalWallet.${flow.kind}`, {
                    wallet: flow.wallet.name,
                })} />
        </div>
    {/if}

    {#if error}
        <ErrorMessage>
            <Translatable resourceKey={i18nKey("externalWallet.failed")} />
        </ErrorMessage>
    {/if}
</div>

<style lang="scss">
    .external-wallet {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        margin-top: $sp4;
    }

    .title {
        @include font(bold, normal, fs-90);
    }

    .prompt {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }

    .wallets,
    .accounts {
        display: flex;
        flex-wrap: wrap;
        gap: $sp3;
    }

    .accounts {
        flex-direction: column;
        word-break: break-all;
    }
</style>
