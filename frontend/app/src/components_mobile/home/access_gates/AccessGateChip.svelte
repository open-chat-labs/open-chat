<script lang="ts">
    import { Chip, Row } from "component-lib";
    import { type LeafGate } from "openchat-client";
    import Check from "svelte-material-icons/Check.svelte";
    import AccessGateText from "./AccessGateText.svelte";

    interface Props {
        gate: LeafGate;
    }

    let { gate }: Props = $props();
</script>

<Chip mode={"filter"}>
    {#snippet icon(color)}
        <Check {color} />
    {/snippet}
    <Row gap={"xs"}>
        <AccessGateText {gate} />
    </Row>
</Chip>
