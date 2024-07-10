<script lang="ts">
    import { deriveColours, blueDiamondHue } from "./diamond";
    import DiamondBase from "./DiamondBase.svelte";

    export let size = "0.9em";
    export let y = -40;

    const colours = deriveColours(blueDiamondHue);
</script>

<DiamondBase {size} dark={colours.dark} medium={colours.medium} light={colours.light} {y} />
