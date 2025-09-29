<script lang="ts">
    import { BodySmall } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        onClick: () => void;
        children: Snippet;
    }

    let { children, onClick }: Props = $props();
</script>

<button
    onclick={(e) => {
        e.preventDefault();
        onClick();
    }}
    class="input_text_button">
    <BodySmall colour={"textPrimary"}>{@render children()}</BodySmall>
</button>

<style lang="scss">
    .input_text_button {
        all: unset;
        height: 2.5rem;
        padding: 0 var(--sp-xl);
        background-color: var(--background-1);
        border-radius: var(--rad-sm);
        justify-content: center;
        align-items: center;
        cursor: pointer;
    }
</style>
