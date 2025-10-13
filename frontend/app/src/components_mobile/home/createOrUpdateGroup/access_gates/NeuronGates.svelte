<script lang="ts">
    import { ColourVars } from "component-lib";
    import { OpenChat, publish, type NeuronGate } from "openchat-client";
    import { getContext } from "svelte";
    import { updateGroupState } from "../group.svelte";
    import AboutNeuronGate from "./AboutNeuronGate.svelte";
    import AccessGateList from "./AccessGateList.svelte";

    const client = getContext<OpenChat>("client");

    let ugs = updateGroupState;

    function gateSubtext(gate: NeuronGate): string | undefined {
        const dissolveDelayDays = client.getMinDissolveDelayDays(gate);
        const minStake = client.getMinStakeInTokens(gate);
        const parts: string[] = [];
        if (dissolveDelayDays !== undefined) {
            parts.push(`${dissolveDelayDays}d dissolve delay`);
        }
        if (minStake !== undefined) {
            parts.push(`${minStake} token stake`);
        }
        return parts.join(" / ");
    }

    function removeAll() {
        ugs.neuronGates.forEach((g) => ugs.deleteGate(g));
    }
</script>

<AccessGateList
    pageTitleKey={"Neuron access gates"}
    onRemoveAll={removeAll}
    onAddGate={() => publish("updateGroupEditNeuronGate", ugs.defaultNeuronGate())}
    titleKey={"Existing neuron holder gates"}
    descKey={"You may add multiple neuron holder gates for your group. Tap on any to access the edit / remove actions."}
    gates={ugs.neuronGates}
    fallbackIcon={"neuron.svg"}
    gateSubtext={(gate) => gateSubtext(gate as NeuronGate)}
    onEdit={(gate) => publish("updateGroupEditNeuronGate", gate as NeuronGate)}>
    {#snippet gateTypeSummary()}
        <AboutNeuronGate padding={"lg"} background={ColourVars.background1} />
    {/snippet}
</AccessGateList>
