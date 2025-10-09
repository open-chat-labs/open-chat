<script lang="ts">
    import type { Padding } from "component-lib";
    import AboutAccessGate from "./AboutAccessGate.svelte";
    interface Props {
        background?: string;
        padding: Padding;
    }

    let { background, padding }: Props = $props();
</script>

<AboutAccessGate
    {padding}
    {background}
    icon={"neuron.svg"}
    alt={"neuron"}
    title={"Neuron holder"}
    subtitle={"Users must stake a neuron with specific criteria (e.g. dissolve delay, stake amount)."} />
