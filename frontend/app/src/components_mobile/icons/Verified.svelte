<script lang="ts">
    import { Tooltip } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import Translatable from "../Translatable.svelte";

    interface Props {
        verified: boolean;
        size: "small" | "default" | "large";
        tooltip?: ResourceKey;
    }

    let { verified, size, tooltip }: Props = $props();
</script>

{#if verified}
    {#if tooltip !== undefined}
        <Tooltip uppercase position="top" align="middle">
            <div class={`verified ${size}`}></div>
            {#snippet popup()}
                <Translatable resourceKey={tooltip} />
            {/snippet}
        </Tooltip>
    {:else}
        <div class={`verified ${size}`}></div>
    {/if}
{/if}

<style lang="scss">
    .verified {
        $size: $avatar-mod;
        width: $size;
        height: $size;
        background-image: url("/assets/verified.svg");
        background-size: cover;
        background-repeat: no-repeat;

        @include mobile() {
            $size: $avatar-mod-small;
            width: $size;
            height: $size;
        }

        &.small {
            width: toRem(16);
            height: toRem(16);
        }

        &.large {
            width: toRem(26);
            height: toRem(26);
        }
    }
</style>
