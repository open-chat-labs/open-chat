<script lang="ts">
    import { Body } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        children?: Snippet;
    }

    let { children }: Props = $props();
</script>

<h4 class="error">
    <Body fontWeight={"bold"}>
        {@render children?.()}
    </Body>
</h4>

<style lang="scss">
    .error {
        width: 100%;
        margin-bottom: $sp3;
        background-color: var(--error);
        padding: var(--sp-md) var(--sp-lg);
        border-radius: var(--rad-md);
    }
</style>
