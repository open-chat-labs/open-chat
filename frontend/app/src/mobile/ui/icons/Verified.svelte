<script lang="ts">
    import { Tooltip, ColourVars } from "component-lib";
    import type { ResourceKey } from "@client";
    import Translatable from "@src/mobile/shared/Translatable.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import BadgeContainer, { type BadgeSize } from "@src/mobile/features/profile/BadgeContainer.svelte";

    interface Props {
        verified: boolean;
        size?: BadgeSize;
        tooltip?: ResourceKey;
        borderColor?: string;
    }

    let { size = "default", tooltip, borderColor }: Props = $props();

    // Verified user (DecideAI) concept is suspended - never render the badge.
    const verified = false;
</script>

{#snippet renderCheck()}
    <BadgeContainer {size} {borderColor} backgroundColor={ColourVars.secondary}>
        <Check size={size === "large" ? "1rem" : "0.625rem"} />
    </BadgeContainer>
{/snippet}

{#if verified}
    {#if tooltip !== undefined}
        <Tooltip uppercase position="top" align="middle">
            {@render renderCheck()}
            {#snippet popup()}
                <Translatable resourceKey={tooltip} />
            {/snippet}
        </Tooltip>
    {:else}
        {@render renderCheck()}
    {/if}
{/if}
