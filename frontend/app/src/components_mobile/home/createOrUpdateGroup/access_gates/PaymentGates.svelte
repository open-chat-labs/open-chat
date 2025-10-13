<script lang="ts">
    import { ColourVars } from "component-lib";
    import { OpenChat, publish, type PaymentGate } from "openchat-client";
    import { getContext } from "svelte";
    import { updateGroupState } from "../group.svelte";
    import AboutPaymentGate from "./AboutPaymentGate.svelte";
    import AccessGateList from "./AccessGateList.svelte";

    const client = getContext<OpenChat>("client");

    let ugs = updateGroupState;

    function gateSubtext(gate: PaymentGate): string | undefined {
        const token = client.getTokenDetailsForAccessGate(gate);
        const amount = client.formatTokens(gate.amount, token?.decimals ?? 2);
        return `${amount} tokens`;
    }

    function removeAll() {
        ugs.paymentGates.forEach((g) => ugs.deleteGate(g));
    }
</script>

<AccessGateList
    pageTitleKey={"Payment access gates"}
    onRemoveAll={removeAll}
    onAddGate={() => publish("updateGroupEditPaymentGate", ugs.defaultPaymentGate())}
    titleKey={"Existing payment gates"}
    descKey={"You may add multiple payment gates for your group. Tap on any to access the edit / remove actions."}
    gates={ugs.paymentGates}
    fallbackIcon={"payment.svg"}
    gateSubtext={(gate) => gateSubtext(gate as PaymentGate)}
    onEdit={(gate) => publish("updateGroupEditPaymentGate", gate as PaymentGate)}>
    {#snippet gateTypeSummary()}
        <AboutPaymentGate padding={"lg"} background={ColourVars.background1} />
    {/snippet}
</AccessGateList>
