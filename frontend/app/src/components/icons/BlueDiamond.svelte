<script lang="ts">
    import { deriveColours, blueDiamondHue } from "@shared_components/icons/diamond";
    import DiamondBase from "./DiamondBase.svelte";

    interface Props {
        size?: string;
        y?: number;
    }

    let { size = "0.9em", y = -40 }: Props = $props();

    const colours = deriveColours(blueDiamondHue);
</script>

<DiamondBase {size} dark={colours.dark} medium={colours.medium} light={colours.light} {y} />
