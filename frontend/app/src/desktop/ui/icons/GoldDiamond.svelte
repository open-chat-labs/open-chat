<script lang="ts">
    import { deriveColours, goldDiamondHue } from "./diamond";
    import DiamondBase from "./DiamondBase.svelte";

    interface Props {
        size?: string;
        y?: number;
    }

    let { size = "0.9em", y = -40 }: Props = $props();

    const colours = deriveColours(goldDiamondHue);
</script>

<DiamondBase {size} dark={colours.dark} medium={colours.medium} light={colours.light} {y} />
