<script lang="ts">
    import { ColourVars } from "component-lib";
    import { OpenChat, publish, type PaymentGate } from "openchat-client";
    import { getContext } from "svelte";
    import type { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";
    import AboutPaymentGate from "./AboutPaymentGate.svelte";
    import AccessGateList from "./AccessGateList.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        data: UpdateGroupOrCommunityState;
    }

    let { data }: Props = $props();

    function gateSubtext(gate: PaymentGate): string | undefined {
        const token = client.getTokenDetailsForAccessGate(gate);
        const amount = client.formatTokens(gate.amount, token?.decimals ?? 2);
        return `${amount} tokens`;
    }

    function removeAll() {
        data.paymentGates.forEach((g) => data.deleteGate(g));
    }
</script>

<AccessGateList
    pageTitleKey={"Payment access gates"}
    onRemoveAll={removeAll}
    onAddGate={() => publish("updatePaymentGate", { data, gate: data.defaultPaymentGate() })}
    titleKey={"Existing payment gates"}
    descKey={"You may add multiple payment gates for your group. Tap on any to access the edit / remove actions."}
    gates={data.paymentGates}
    fallbackIcon={"payment.svg"}
    gateSubtext={(gate) => gateSubtext(gate as PaymentGate)}
    onEdit={(gate) => publish("updatePaymentGate", { data, gate: gate as PaymentGate })}>
    {#snippet gateTypeSummary()}
        <AboutPaymentGate padding={"lg"} background={ColourVars.background1} />
    {/snippet}
</AccessGateList>
