<script lang="ts">
    import { deriveColours, goldDiamondHue } from "./diamond";
    import DiamondBase from "./DiamondBase.svelte";

    export let size = "0.9em";
    export let y = -40;

    const colours = deriveColours(goldDiamondHue);
</script>

<DiamondBase {size} dark={colours.dark} medium={colours.medium} light={colours.light} {y} />
