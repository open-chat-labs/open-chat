<script lang="ts">
    import { type Snippet } from "svelte";

    interface Props {
        children?: Snippet;
        title?: string;
        disabled?: boolean;
        onClick?: () => void;
        error?: boolean;
    }

    let { children, title, disabled = false, onClick, error = false }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={onClick} class="pill" {title} class:disabled>
    {@render children?.()}
</div>

<style lang="scss">
    .pill {
        background: var(--button-bg);
        color: var(--button-txt);
        display: inline-flex;
        padding: $sp2 $sp3;
        align-items: center;
        border-radius: $sp5;
        gap: $sp2;
        @include box-shadow(1);

        &.disabled {
            opacity: 0.8;
            background: transparent;
            color: var(--button-hollow-txt);
            border: var(--bw) solid var(--button-hollow-bd);
        }

        &.error {
            background-color: var(--error);
        }
    }
</style>
