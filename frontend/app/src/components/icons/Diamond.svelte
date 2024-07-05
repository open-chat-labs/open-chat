<script lang="ts">
    import type { DiamondMembershipStatus, ResourceKey } from "openchat-client";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import DiamondBase from "./DiamondBase.svelte";
    import { blueDiamondHue, deriveColours, goldDiamondHue } from "./diamond";

    export let size = "0.9em";
    export let show: "blue" | "gold" | undefined = undefined;
    export let status: DiamondMembershipStatus["kind"] | undefined = undefined;
    export let y = -40;

    $: colour = status === "lifetime" || show === "gold" ? goldDiamondHue : blueDiamondHue;
    $: colours = deriveColours(colour);
    $: statusName = getStatusName(status);

    function getStatusName(
        status: DiamondMembershipStatus["kind"] | undefined,
    ): ResourceKey | undefined {
        if (status === undefined) return undefined;

        switch (status) {
            case "lifetime":
                return i18nKey("upgrade.lifetime");
            case "active":
                return i18nKey("upgrade.diamond");
            default:
                return i18nKey(status);
        }
    }
</script>

{#if status !== "inactive" || show}
    <TooltipWrapper position="top" align="middle">
        <DiamondBase
            slot="target"
            {size}
            dark={colours.dark}
            medium={colours.medium}
            light={colours.light}
            {y} />
        <div let:position let:align slot="tooltip" class="tooltip">
            {#if statusName !== undefined}
                <TooltipPopup {position} {align}>
                    <Translatable resourceKey={statusName} />
                </TooltipPopup>
            {/if}
        </div>
    </TooltipWrapper>
{/if}

<style lang="scss">
    .tooltip {
        text-transform: uppercase;
    }
</style>
