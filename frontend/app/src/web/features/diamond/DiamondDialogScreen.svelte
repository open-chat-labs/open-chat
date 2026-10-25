<!-- Diamond membership (?diamond, the `upgrade` event; 8e, #10131): DiamondDialog, paid in CHAT or ICP at the
     backend's own prices through the shared payment (logic/diamond), from the user's OpenChat wallet. A member whose
     membership ends opens on the plans, to extend it. Opened from another dialog (the profile), its back arrow returns
     to it. -->
<script lang="ts">
    import {
        currentUserIdStore,
        currentUserStore,
        diamondStatusStore,
        enhancedCryptoLookup,
        LEDGER_CANISTER_CHAT,
        LEDGER_CANISTER_ICP,
        type EnhancedTokenDetails,
        type OpenChat,
    } from "@client";
    import DiamondDialog, {
        type DiamondPurchase,
    } from "@openchat/ui/src/features/components/DiamondDialog.svelte";
    import { DiamondPayment } from "@src/logic/diamond/diamondPayment.svelte";
    import { userWalletAddress } from "@src/logic/wallet/receiveAddress";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import { toastStore } from "@src/stores/toast";
    import { diamondPaysInChat, disableDiamondPaymentFeature } from "@src/utils/features";
    import { getContext, onMount } from "svelte";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { canGoBack, goBack } from "../app/linkedDialogs.svelte";
    import {
        diamondAffordable,
        diamondApprovalFees,
        diamondMembershipProps,
        diamondTokenPrices,
        diamondWalletTokens,
        openingPlan,
        planDuration,
    } from "./diamond.adapter";

    let { onClose }: DialogProps<Extract<LinkedDialog, { kind: "diamond" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the backend's fees (loading, or failed: the plans step says so, offering to try again) and the
    // payment
    const payment = new DiamondPayment(client);
    onMount(() => payment.loadFees());
    const pricing = $derived(
        payment.feesState.kind === "loaded" ? undefined : payment.feesState.kind,
    );

    // the tokens Diamond can be paid in, with the user's balances
    const LEDGERS = [LEDGER_CANISTER_CHAT, LEDGER_CANISTER_ICP];
    const tokens = $derived(
        LEDGERS.map((ledger) => $enhancedCryptoLookup.get(ledger)).filter(
            (t): t is EnhancedTokenDetails => t !== undefined,
        ),
    );
    const walletTokens = $derived(diamondWalletTokens(tokens));
    const chatBalance = $derived(walletTokens.find((t) => t.symbol === "CHAT")?.held ?? 0);
    const membership = $derived(diamondMembershipProps($diamondStatusStore));
    // opens on the plans for a timed member: read as it opens, so paying doesn't move the step
    const plan = openingPlan(diamondStatusStore.value);

    // where each token can be topped up: the user's ICP account, and their wallet's ICRC account
    const depositAddresses = $derived({
        ICP: $currentUserStore.cryptoAccount,
        CHAT: userWalletAddress($currentUserIdStore, () => client.OcIdentityPrincipal),
    });

    function refreshBalances(): Promise<unknown> {
        return Promise.all(LEDGERS.map((ledger) => client.refreshAccountBalance(ledger)));
    }

    // pays at the backend's price for the token and plan (never the dialog's amount); a failed
    // payment stays on confirm with the dialog's error (its cause logged: the user may have been
    // charged), a PIN failure is toasted with the PIN's own message (counting down a lockout), and
    // the PIN prompt dismissed, or a payment already under way, is nothing bought
    async function upgrade(purchase: DiamondPurchase): Promise<{ until: string | null } | false> {
        const token = tokens.find((t) => t.symbol === purchase.token);
        if (token === undefined) throw new Error(`Diamond can't be paid in ${purchase.token}`);
        const outcome = await payment.pay({
            ledger: token.ledger,
            token: token.symbol,
            duration: planDuration(purchase.plan),
            autoRenew: purchase.autoRenew,
        });
        if (outcome.kind === "cancelled" || outcome.kind === "already_paying") return false;
        if (outcome.kind === "pin_failed") {
            toastStore.showFailureToast(pinNumberErrorMessageStore);
            return false;
        }
        if (outcome.kind === "failed") {
            if (outcome.cause !== undefined)
                client.logError("Diamond payment failed", outcome.cause);
            throw new Error("payment failed");
        }
        void refreshBalances();
        const status = diamondStatusStore.value;
        return {
            until:
                status.kind === "active" ? new Date(Number(status.expiresAt)).toISOString() : null,
        };
    }
</script>

<DiamondDialog
    tokens={walletTokens}
    balance={chatBalance}
    prices={{}}
    tokenPrices={payment.fees === undefined ? {} : diamondTokenPrices(payment.fees)}
    approvalFees={diamondApprovalFees(tokens)}
    affordable={payment.fees === undefined ? undefined : diamondAffordable(payment.fees, tokens)}
    {pricing}
    onRetryPricing={() => payment.loadFees()}
    defaultToken={diamondPaysInChat ? "CHAT" : "ICP"}
    autoRenewDefault
    {plan}
    {...membership}
    {depositAddresses}
    onUpgrade={disableDiamondPaymentFeature ? undefined : upgrade}
    onRefreshBalance={refreshBalances}
    onBack={canGoBack() ? goBack : undefined}
    {onClose} />
