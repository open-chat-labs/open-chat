<script lang="ts">
    import { ColourVars } from "component-lib";
    import { OpenChat, publish, type TokenBalanceGate } from "openchat-client";
    import { getContext } from "svelte";
    import type { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";
    import AboutBalanceGate from "./AboutBalanceGate.svelte";
    import AccessGateList from "./AccessGateList.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        data: UpdateGroupOrCommunityState;
    }

    let { data }: Props = $props();

    function gateSubtext(gate: TokenBalanceGate): string | undefined {
        const token = client.getTokenDetailsForAccessGate(gate);
        const balance = client.formatTokens(gate.minBalance, token?.decimals ?? 2);
        return `min ${balance} tokens`;
    }

    function removeAll() {
        data.tokenBalanceGates.forEach((g) => data.deleteGate(g));
    }
</script>

<AccessGateList
    {data}
    pageTitleKey={"Token balance access gates"}
    onRemoveAll={removeAll}
    onAddGate={() =>
        publish("updateTokenBalanceGate", { data, gate: data.defaultTokenBalanceGate() })}
    titleKey={"Existing token balance gates"}
    descKey={"You may add multiple token balance gates for your group. Tap on any to access the edit / remove actions."}
    gates={data.tokenBalanceGates}
    fallbackIcon={"token_balance.svg"}
    gateSubtext={(gate) => gateSubtext(gate as TokenBalanceGate)}
    onEdit={(gate) => publish("updateTokenBalanceGate", { data, gate: gate as TokenBalanceGate })}>
    {#snippet gateTypeSummary()}
        <AboutBalanceGate padding={"lg"} background={ColourVars.background1} />
    {/snippet}
</AccessGateList>
