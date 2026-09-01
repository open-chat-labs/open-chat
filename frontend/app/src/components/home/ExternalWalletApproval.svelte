<script lang="ts">
    import { cryptoLookup, type OpenChat, type SignerWallet, type WalletAccount } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        wallet: SignerWallet;
        ledger: string;
        // What the payment itself will take
        amount: bigint;
        // What the ledger will charge against the allowance on top of `amount`. Defaults to a
        // single transfer fee, which is what a payment made as one transfer costs; a flow which
        // moves the funds more than once has to say so.
        fees?: bigint;
    }

    let { wallet, ledger, amount, fees }: Props = $props();

    const client = getContext<OpenChat>("client");

    type Flow =
        | { kind: "idle" }
        | { kind: "connecting" }
        | {
              kind: "choosing";
              accounts: WalletAccount[];
              choose: (account: WalletAccount | undefined) => void;
          }
        | { kind: "approving" };

    let flow = $state<Flow>({ kind: "idle" });
    let error = $state(false);

    let tokenDetails = $derived($cryptoLookup.get(ledger));

    // Opens the wallet and asks it to approve the payment, resolving to the account to pass as the
    // payment's `fromAccount`, or undefined if the user backs out or the approval fails. Call this
    // synchronously from a click handler and await nothing first: the wallet opens in a popup,
    // which browsers only allow while the click which asked for it is still being handled.
    export function approve(): Promise<string | undefined> {
        if (tokenDetails === undefined) return Promise.resolve(undefined);

        error = false;
        flow = { kind: "connecting" };

        return client
            .approveExternalWalletSpending(
                wallet,
                ledger,
                amount + (fees ?? tokenDetails.transferFee),
                (accounts) =>
                    new Promise((resolve) => {
                        flow = { kind: "choosing", accounts, choose: resolve };
                    }),
                () => (flow = { kind: "approving" }),
            )
            .catch(() => {
                error = true;
                return undefined;
            })
            .finally(() => (flow = { kind: "idle" }));
    }
</script>

{#if flow.kind !== "idle" || error}
    <div class="external-wallet">
        {#if flow.kind === "choosing"}
            <div class="prompt">
                <Translatable resourceKey={i18nKey("externalWallet.chooseAccount")} />
            </div>
            <div class="accounts">
                {#each flow.accounts as account (account.address)}
                    <Button
                        small
                        onClick={() => flow.kind === "choosing" && flow.choose(account)}>
                        {account.address}
                    </Button>
                {/each}
            </div>
        {:else if flow.kind === "connecting" || flow.kind === "approving"}
            <div class="prompt">
                <Translatable
                    resourceKey={i18nKey(`externalWallet.${flow.kind}`, {
                        wallet: wallet.name,
                    })} />
            </div>
        {/if}

        {#if error}
            <ErrorMessage>
                <Translatable resourceKey={i18nKey("externalWallet.failed")} />
            </ErrorMessage>
        {/if}
    </div>
{/if}

<style lang="scss">
    .external-wallet {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        margin-top: $sp4;
    }

    .prompt {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }

    .accounts {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        word-break: break-all;
    }
</style>
