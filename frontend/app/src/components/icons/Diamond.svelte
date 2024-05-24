<script lang="ts">
    import type { DiamondMembershipStatus, ResourceKey } from "openchat-client";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    export let size = "0.9em";
    export let width = size;
    export let height = size;
    export let show: "blue" | "gold" | undefined = undefined;
    export let status: DiamondMembershipStatus["kind"] | undefined = undefined;
    export let y = -40;

    type Colours = {
        dark: string;
        medium: string;
        light: string;
    };

    $: colour = status === "lifetime" || show === "gold" ? 42 : 210;
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

    function deriveColours(hue: number): Colours {
        return {
            dark: `hsl(${hue}, 100%, 35%)`,
            medium: `hsl(${hue}, 100%, 65%)`,
            light: `hsl(${hue}, 100%, 80%)`,
        };
    }
</script>

{#if status !== "inactive" || show}
    <TooltipWrapper position="top" align="middle">
        <svg slot="target" class="diamond" viewBox={`0 ${y} 500 430`} {width} {height}>
            <g transform="matrix(0.714286, 0, 0, 0.714286, -3.571425, -3.585709)">
                <g>
                    <polygon
                        fill={colours.dark}
                        points="705,185.771 355,605.022 505.434,226.293 &#9;" />
                    <polygon
                        fill={colours.medium}
                        points="705,185.771 505.434,226.293 452.352,5.041 523.162,5.041 &#9;" />
                    <g>
                        <polygon
                            fill={colours.light}
                            points="355,605.02 5.02,185.8 5,185.77 5.04,185.78 204.57,226.29 &#9;&#9;" />
                        <polyline
                            fill="none"
                            points="5.01,185.81 5.02,185.8 5.04,185.78 &#9;&#9;" />
                    </g>
                    <polygon
                        fill={colours.light}
                        points="505.43,226.29 204.57,226.29 257.65,5.04 452.35,5.04 &#9;" />
                    <polygon
                        fill={colours.medium}
                        points="505.434,226.293 355,605.022 204.566,226.293 &#9;" />
                    <polygon
                        fill={"white"}
                        stroke={colours.dark}
                        stroke-width="0.25"
                        stroke-miterlimit="10"
                        points="452.35,5.04 257.65,5.04 &#10;&#9;&#9;204.57,226.29 5.04,185.78 186.85,5.02 &#9;" />
                    <polyline
                        fill="none"
                        stroke={colours.light}
                        stroke-width="0.25"
                        stroke-miterlimit="10"
                        points="186.85,5.02 5,185.77 5.02,185.8 &#10;&#9;&#9;355,605.02 705,185.77 523.16,5.04 452.35,5.04 &#9;" />
                </g>
            </g>
        </svg>
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
