<script lang="ts">
    import { Tooltip, ColourVars } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import BadgeContainer, { type BadgeSize } from "../home/profile/BadgeContainer.svelte";

    interface Props {
        verified: boolean;
        size?: BadgeSize;
        tooltip?: ResourceKey;
    }

    let { verified, size = "default", tooltip }: Props = $props();
</script>

{#snippet renderCheck()}
    <BadgeContainer {size} backgroundColor={ColourVars.secondary}>
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
