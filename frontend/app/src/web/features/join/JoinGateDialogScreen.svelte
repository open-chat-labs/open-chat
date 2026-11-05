<!-- The requirements joining a group, channel or community has (8b #10128): JoinGateDialog over the gates' evaluation
     (logic/access/GateEvaluation), a level at a time: a gated channel in a gated community shows the community's
     requirements, then the channel's, in a dialog each; nothing is approved or sent until the last is met. "Pay and
     join" records the user's choice (logic/join/joinGate: the gates' own amounts) and carries the join on through the
     client (the PIN, the approval, the join). The dialog leaves once joined; while the join doesn't go through (the
     PIN dismissed, the approval or the join failed, a gate the backend found unmet) it stays, with a toast saying
     why, and "Pay and join" records the user's choice again. Closing drops the join. "Get Diamond" closes it for the Diamond dialog (a dialog replaces, never stacks); joining again after buying
     finds that requirement met. -->
<script lang="ts">
    import {
        currentUserIdStore,
        enhancedCryptoLookup,
        isDiamondStore,
        isLifetimeDiamondStore,
        PAYMENT_GATE_OWNER_PERCENT,
        i18nKey,
        publish,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import JoinGateDialog from "@openchat/ui/src/features/components/JoinGateDialog.svelte";
    import { interpolate } from "@i18n/i18n";
    import { GateEvaluation } from "@src/logic/access/gateEvaluation.svelte";
    import { dropJoin, submitGates } from "@src/logic/join/joinFlow.svelte";
    import { toastStore } from "@src/stores/toast";
    import { recordGateChoice } from "@src/logic/join/joinGate";
    import { userWalletAddress } from "@src/logic/wallet/receiveAddress";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { joinFailure, showJoinStep } from "./join";
    import { joinGateProps, paidLeaves, type JoinGateProps } from "./joinGate.adapter";

    let { dialog, onClose, dialogs }: DialogProps<Extract<LocalDialog, { kind: "join_gate" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    // the gates as the dialog was opened with them, walked a level at a time
    const evaluation = new GateEvaluation(
        client,
        untrack(() => dialog.gates),
    );
    // the level showing: each has a dialog of its own
    let level = $state(0);

    const text = (key: ResourceKey) => interpolate($_, key);
    // the last level's, kept while its join is on its way: the evaluation has moved past it then,
    // and the dialog stays to show how the join went
    let held: JoinGateProps | undefined;
    const gateProps = $derived.by(() => {
        if (evaluation.gate === undefined) return held;
        held = joinGateProps(evaluation.gate, evaluation.leaves, $enhancedCryptoLookup, text);
        return held;
    });
    const depositAddress = $derived(
        userWalletAddress($currentUserIdStore, () => client.OcIdentityPrincipal),
    );

    // a level's dialog leaving once its requirements are met hands over to the next level's
    function close(from: number) {
        if (from !== level) return;
        dropJoin(dialog.target);
        onClose();
    }

    // resolves once this level is met (the dialog leaves, for the next level's or for good); a
    // choice that doesn't meet it, or a join that doesn't go through, rejects, and the dialog stays
    // and says it couldn't join. A join that doesn't go through puts the last level back as it was
    // before this choice, so "Pay and join" records the user's choice again, changed or not (the
    // client doesn't approve, or charge the fee for, a payment it approved moments ago again)
    async function join(result: {
        paid: { id?: string }[];
        neuronConfirmed: boolean;
    }): Promise<void> {
        const putBack = evaluation.checkpoint();
        const recorded = recordGateChoice(
            evaluation,
            { paid: paidLeaves(result.paid), neuronConfirmed: result.neuronConfirmed },
            (ledger) => $enhancedCryptoLookup.get(ledger)?.transferFee,
        );
        switch (recorded.kind) {
            case "incomplete":
                if (recorded.balanceShort) {
                    toastStore.showFailureToast(i18nKey("access.paymentLeavesBalanceShort"));
                }
                throw new Error("the requirements aren't met");
            case "next_level":
                level += 1;
                return;
        }
        const step = await submitGates(client, dialog.target, recorded.gateCheck);
        switch (step.kind) {
            case "cancelled":
                putBack();
                throw new Error("the PIN prompt was dismissed");
            case "failed":
            case "gate_check_failed":
                putBack();
                toastStore.showFailureToast(joinFailure(step));
                throw new Error("the join didn't go through");
            default:
                showJoinStep(step, dialog.target, dialogs, dialog.name);
        }
    }

    function refreshBalances(): Promise<unknown> {
        const ledgers = new Set(
            evaluation.leaves.flatMap((l) =>
                l.kind === "payment_gate" || l.kind === "token_balance_gate"
                    ? [l.ledgerCanister]
                    : [],
            ),
        );
        return Promise.all([...ledgers].map((ledger) => client.refreshAccountBalance(ledger)));
    }

    function getDiamond() {
        close(level);
        publish("upgrade");
    }
</script>

{#snippet levelDialog(shown: number)}
    {#if gateProps !== undefined}
        <JoinGateDialog
            community={gateProps.community}
            rule={gateProps.rule}
            gates={gateProps.gates}
            tokens={gateProps.tokens}
            {depositAddress}
            isDiamond={$isDiamondStore}
            isLifetime={$isLifetimeDiamondStore}
            recheckDays={gateProps.recheckDays}
            ownerShare={PAYMENT_GATE_OWNER_PERCENT / 100}
            onGetDiamond={getDiamond}
            onJoin={join}
            onRecheck={refreshBalances}
            onClose={() => close(shown)}
        />
    {/if}
{/snippet}

{#key level}
    {@render levelDialog(level)}
{/key}
