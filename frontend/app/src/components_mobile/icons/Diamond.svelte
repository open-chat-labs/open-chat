<script lang="ts">
    import { Tooltip } from "component-lib";
    import type { DiamondMembershipStatus, ResourceKey } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Diamond from "svelte-material-icons/Diamond.svelte";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
    import BadgeContainer from "../home/profile/BadgeContainer.svelte";

    interface Props {
        size?: string;
        show?: "blue" | "gold" | undefined;
        status?: DiamondMembershipStatus["kind"] | undefined;
    }

    let { show = undefined, status = undefined }: Props = $props();

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
    let statusName = $derived(getStatusName(status));
    let iconSize = "0.625rem";
</script>

{#if status !== "inactive" || show}
    <Tooltip uppercase position="top" align="middle">
        <BadgeContainer>
            {#if status == "lifetime"}
                <Diamond size={iconSize} />
            {:else}
                <DiamondOutline size={iconSize} />
            {/if}
        </BadgeContainer>
        {#snippet popup()}
            {#if statusName !== undefined}
                <Translatable resourceKey={statusName} />
            {/if}
        {/snippet}
    </Tooltip>
{/if}
