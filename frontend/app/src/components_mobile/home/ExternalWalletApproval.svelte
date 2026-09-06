<script lang="ts">
    import { cryptoLookup, type OpenChat, type SignerWallet, type WalletAccount } from "@client";
    import { BodySmall, ColourVars, Column, CommonButton, Row } from "component-lib";
    import { getContext, onDestroy } from "svelte";
    import Warning from "svelte-material-icons/AlertRhombusOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
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
    let failed = $state(false);
    // Set when the flow this belongs to goes away while the wallet still has the user, which is
    // the user calling the payment off part way through
    let abandoned = false;

    let tokenDetails = $derived($cryptoLookup.get(ledger));

    onDestroy(() => {
        abandoned = true;
        // Backing out of the account choice is the only way to end it, and the sheet closing has
        // taken away the buttons which would. Left pending, it strands the approval mid flight and
        // the wallet popup never closes.
        if (flow.kind === "choosing") flow.choose(undefined);
    });

    // Opens the wallet and asks it to approve the payment, resolving to the account to pass as the
    // payment's `fromAccount`, or undefined if the user backs out or the approval fails. Call this
    // synchronously from a tap handler and await nothing first: the wallet opens in a popup,
    // which browsers only allow while the tap which asked for it is still being handled.
    export function approve(): Promise<string | undefined> {
        if (tokenDetails === undefined) return Promise.resolve(undefined);

        failed = false;
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
            // Closing the payment sheet cancels the payment, even though the wallet has by then
            // been asked to approve it. Any approval which did go through is left to expire
            // unspent rather than being taken after the user backed out.
            .then((fromAccount) => (abandoned ? undefined : fromAccount))
            .catch((err) => {
                client.logError(`Failed to approve payment from ${wallet.name}`, err);
                failed = true;
                return undefined;
            })
            .finally(() => (flow = { kind: "idle" }));
    }
</script>

{#if flow.kind !== "idle" || failed}
    <Column gap={"sm"}>
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
            <CommonButton
                width={"fill"}
                size={"small_text"}
                onClick={() => flow.kind === "choosing" && flow.choose(undefined)}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </CommonButton>
        {:else if flow.kind === "connecting" || flow.kind === "approving"}
            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(`externalWallet.${flow.kind}`, {
                        wallet: wallet.name,
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
{/if}
