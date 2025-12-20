<script lang="ts">
    import { Tooltip, ColourVars } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import BadgeContainer from "../home/profile/BadgeContainer.svelte";

    interface Props {
        verified: boolean;
        tooltip?: ResourceKey;
    }

    let { verified, tooltip }: Props = $props();
</script>

{#snippet renderCheck()}
    <BadgeContainer backgroundColor={ColourVars.secondary}>
        <Check size="0.625rem" />
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
