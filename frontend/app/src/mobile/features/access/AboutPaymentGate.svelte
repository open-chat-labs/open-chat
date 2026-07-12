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
    icon={"payment.svg"}
    alt={"payment"}
    title={"Payment"}
    subtitle={"Access is granted after the user pays a one-time or recurring entry fee."} />
