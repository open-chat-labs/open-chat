<script lang="ts">
    import {
        cryptoLookup,
        SIGNER_WALLETS,
        type OpenChat,
        type SignerWallet,
        type WalletAccount,
    } from "@client";
    import { BodySmall, Button, ColourVars, Column, CommonButton, Row } from "component-lib";
    import { getContext } from "svelte";
    import Warning from "svelte-material-icons/AlertRhombusOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
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

    type Flow =
        | { kind: "idle" }
        | { kind: "connecting"; wallet: SignerWallet }
        | {
              kind: "choosing";
              wallet: SignerWallet;
              accounts: WalletAccount[];
              choose: (account: WalletAccount | undefined) => void;
          }
        | { kind: "approving"; wallet: SignerWallet };

    let flow = $state<Flow>({ kind: "idle" });
    let failed = $state(false);

    let tokenDetails = $derived($cryptoLookup.get(ledger));
    let busy = $derived(flow.kind !== "idle");

    function connect(wallet: SignerWallet) {
        if (tokenDetails === undefined) return;

        // Nothing may be awaited before this call: the wallet opens in a popup, which the browser
        // only allows while it is still handling the tap which asked for it
        failed = false;
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
            .catch(() => (failed = true))
            .finally(() => (flow = { kind: "idle" }));
    }
</script>

<Column gap={"sm"}>
    <BodySmall colour={"textSecondary"}>
        <Translatable resourceKey={i18nKey("externalWallet.title")} />
    </BodySmall>

    {#if flow.kind === "choosing"}
        <BodySmall colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("externalWallet.chooseAccount")} />
        </BodySmall>
        {#each flow.accounts as account (account.address)}
            <CommonButton
                width={"fill"}
                size={"small_text"}
                onClick={() => flow.kind === "choosing" && flow.choose(account)}>
                {account.address}
            </CommonButton>
        {/each}
    {:else}
        <BodySmall colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("externalWallet.subtitle")} />
        </BodySmall>
        {#each SIGNER_WALLETS as wallet (wallet.id)}
            <Button
                width={"fill"}
                secondary
                disabled={disabled || busy}
                loading={flow.kind !== "idle" && flow.wallet.id === wallet.id}
                onClick={() => connect(wallet)}>
                {wallet.name}
            </Button>
        {/each}
    {/if}

    {#if flow.kind === "connecting" || flow.kind === "approving"}
        <BodySmall colour={"textSecondary"}>
            <Translatable
                resourceKey={i18nKey(`externalWallet.${flow.kind}`, {
                    wallet: flow.wallet.name,
                })} />
        </BodySmall>
    {/if}

    {#if failed}
        <Row crossAxisAlignment={"center"} gap={"md"}>
            <Warning size={"1.5rem"} color={ColourVars.validationWarning} />
            <BodySmall fontWeight={"bold"} colour={"validationWarning"}>
                <Translatable resourceKey={i18nKey("externalWallet.failed")} />
            </BodySmall>
        </Row>
    {/if}
</Column>
