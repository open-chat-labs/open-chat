<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { gateLabel } from "@src/utils/access";
    import { Body, type SizeMode } from "component-lib";
    import type { LeafGate, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: LeafGate;
    }

    let { gate }: Props = $props();

    let token = $derived(client.getTokenDetailsForAccessGate(gate));
    const width: SizeMode = "hug";
</script>

<Body {width}>
    <Translatable resourceKey={i18nKey(gateLabel[gate.kind])}></Translatable>
</Body>
{#if gate.kind === "neuron_gate" && token && gate.minStakeE8s !== undefined}
    <Body {width} fontWeight={"bold"} colour={"secondary"}>
        {token.symbol}, {client.formatTokens(BigInt(gate.minStakeE8s), token.decimals)}
    </Body>
{:else if gate.kind === "token_balance_gate" && token}
    <Body {width} fontWeight={"bold"} colour={"secondary"}>
        {client.formatTokens(gate.minBalance, token.decimals)}
        {token.symbol}
    </Body>
{:else if gate.kind === "payment_gate" && token}
    <Body {width} fontWeight={"bold"} colour={"secondary"}>
        {client.formatTokens(gate.amount, token.decimals)}
        {token.symbol}
    </Body>
{:else if gate.kind === "chit_earned_gate"}
    <Body {width} fontWeight={"bold"} colour={"secondary"}>
        {gate.minEarned}
    </Body>
{/if}
