<script lang="ts">
    import { ColourVars } from "component-lib";
    import { OpenChat, publish, type TokenBalanceGate } from "openchat-client";
    import { getContext } from "svelte";
    import { updateGroupState } from "../group.svelte";
    import AboutBalanceGate from "./AboutBalanceGate.svelte";
    import AccessGateList from "./AccessGateList.svelte";

    const client = getContext<OpenChat>("client");

    let ugs = updateGroupState;

    function gateSubtext(gate: TokenBalanceGate): string | undefined {
        const token = client.getTokenDetailsForAccessGate(gate);
        const balance = client.formatTokens(gate.minBalance, token?.decimals ?? 2);
        return `min ${balance} tokens`;
    }

    function removeAll() {
        ugs.tokenBalanceGates.forEach((g) => ugs.deleteGate(g));
    }
</script>

<AccessGateList
    pageTitleKey={"Token balance access gates"}
    onRemoveAll={removeAll}
    onAddGate={() => publish("updateGroupEditTokenBalanceGate", ugs.defaultTokenBalanceGate())}
    titleKey={"Existing token balance gates"}
    descKey={"You may add multiple token balance gates for your group. Tap on any to access the edit / remove actions."}
    gates={ugs.tokenBalanceGates}
    fallbackIcon={"token_balance.svg"}
    gateSubtext={(gate) => gateSubtext(gate as TokenBalanceGate)}
    onEdit={(gate) => publish("updateGroupEditTokenBalanceGate", gate as TokenBalanceGate)}>
    {#snippet gateTypeSummary()}
        <AboutBalanceGate padding={"lg"} background={ColourVars.background1} />
    {/snippet}
</AccessGateList>
