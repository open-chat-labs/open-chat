<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import Verified from "./Verified.svelte";

    interface Props {
        verified: boolean;
        size: "small" | "default" | "large";
        tooltip?: ResourceKey;
        children: Snippet;
    }

    let { children, ...rest }: Props = $props();
</script>

<div class="with_verified">
    {@render children()}
    <Verified {...rest}></Verified>
</div>

<style lang="scss">
    .with_verified {
        display: flex;
        align-items: center;
        gap: $sp3;
    }
</style>
