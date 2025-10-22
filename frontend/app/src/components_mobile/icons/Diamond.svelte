<script lang="ts">
    import { Tooltip } from "component-lib";
    import type { DiamondMembershipStatus, ResourceKey } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import DiamondBase from "./DiamondBase.svelte";
    import { blueDiamondHue, deriveColours, goldDiamondHue } from "./diamond";

    interface Props {
        size?: string;
        show?: "blue" | "gold" | undefined;
        status?: DiamondMembershipStatus["kind"] | undefined;
        y?: any;
    }

    let { size = "0.9em", show = undefined, status = undefined, y = -40 }: Props = $props();

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
    let colour = $derived(
        status === "lifetime" || show === "gold" ? goldDiamondHue : blueDiamondHue,
    );
    let colours = $derived(deriveColours(colour));
    let statusName = $derived(getStatusName(status));
</script>

{#if status !== "inactive" || show}
    <Tooltip uppercase position="top" align="middle">
        <DiamondBase {size} dark={colours.dark} medium={colours.medium} light={colours.light} {y} />
        {#snippet popup()}
            {#if statusName !== undefined}
                <Translatable resourceKey={statusName} />
            {/if}
        {/snippet}
    </Tooltip>
{/if}
