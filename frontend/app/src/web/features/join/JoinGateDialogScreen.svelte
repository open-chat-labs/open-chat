<!-- The requirements joining a group, channel or community has (8b #10128): JoinGateDialog over the gates' evaluation
     (logic/access/GateEvaluation), a level at a time: a gated channel in a gated community shows the community's
     requirements, then the channel's, in a dialog each; nothing is approved or sent until the last is met. "Pay and
     join" records the user's choice (logic/join/joinGate: the gates' own amounts) and carries the join on through the
     client (the PIN, the approval, the join); what comes of it is shown as for any join (join.ts). Closing drops the
     join. "Get Diamond" closes it for the Diamond dialog (a dialog replaces, never stacks); joining again after buying
     finds that requirement met. -->
<script lang="ts">
    import {
        currentUserIdStore,
        enhancedCryptoLookup,
        isDiamondStore,
        isLifetimeDiamondStore,
        PAYMENT_GATE_OWNER_PERCENT,
        publish,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import JoinGateDialog from "@openchat/ui/src/features/components/JoinGateDialog.svelte";
    import { interpolate } from "@i18n/i18n";
    import { GateEvaluation } from "@src/logic/access/gateEvaluation.svelte";
    import { continueJoin, dropJoin } from "@src/logic/join/joinFlow.svelte";
    import { recordGateChoice } from "@src/logic/join/joinGate";
    import { userWalletAddress } from "@src/logic/wallet/receiveAddress";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { showJoinStep } from "./join";
    import { joinGateProps, paidLeaves } from "./joinGate.adapter";

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
    const gateProps = $derived(
        evaluation.gate === undefined
            ? undefined
            : joinGateProps(evaluation.gate, evaluation.leaves, $enhancedCryptoLookup, text),
    );
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
    // choice that doesn't meet it rejects, and the dialog says it couldn't join
    async function join(result: {
        paid: { id?: string }[];
        neuronConfirmed: boolean;
    }): Promise<void> {
        const recorded = recordGateChoice(
            evaluation,
            { paid: paidLeaves(result.paid), neuronConfirmed: result.neuronConfirmed },
            (ledger) => $enhancedCryptoLookup.get(ledger)?.transferFee,
        );
        switch (recorded.kind) {
            case "incomplete":
                throw new Error("the requirements aren't met");
            case "next_level":
                level += 1;
                return;
            case "ready": {
                const target = dialog.target;
                const step = await continueJoin(client, target, recorded.gateCheck);
                showJoinStep(step, target, dialogs);
                return;
            }
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
