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
    icon={"token_balance.svg"}
    alt={"token balance"}
    title={"Minimum token balance"}
    subtitle={"Requires users to hold a minimum amount of a specified token."} />
