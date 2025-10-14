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
    icon={"diamond.svg"}
    alt={"CHIT"}
    title={"CHIT earned"}
    subtitle={"Users must have reached a threshold of total CHIT earned - a mark of experience!"} />
