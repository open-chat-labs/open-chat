<script lang="ts">
    import { ColourVars } from "component-lib";
    import { OpenChat, publish, type NeuronGate } from "openchat-client";
    import { getContext } from "svelte";
    import type { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";
    import AboutNeuronGate from "./AboutNeuronGate.svelte";
    import AccessGateList from "./AccessGateList.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        data: UpdateGroupOrCommunityState;
    }

    let { data }: Props = $props();

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
        data.neuronGates.forEach((g) => data.deleteGate(g));
    }
</script>

<AccessGateList
    {data}
    pageTitleKey={"Neuron access gates"}
    onRemoveAll={removeAll}
    onAddGate={() => publish("updateNeuronGate", { data, gate: data.defaultNeuronGate() })}
    titleKey={"Existing neuron holder gates"}
    descKey={"You may add multiple neuron holder gates for your group. Tap on any to access the edit / remove actions."}
    gates={data.neuronGates}
    fallbackIcon={"neuron.svg"}
    gateSubtext={(gate) => gateSubtext(gate as NeuronGate)}
    onEdit={(gate) => publish("updateNeuronGate", { data, gate: gate as NeuronGate })}>
    {#snippet gateTypeSummary()}
        <AboutNeuronGate padding={"lg"} background={ColourVars.background1} />
    {/snippet}
</AccessGateList>
