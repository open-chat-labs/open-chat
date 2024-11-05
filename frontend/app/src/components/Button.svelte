<script lang="ts">
    import type { Snippet } from "svelte";
    import { currentTheme } from "../theme/themes";
    import SignalsButton from "./SignalsButton.svelte";
    import StandardButton from "./StandardButton.svelte";

    interface Props {
        cls?: string;
        loading?: boolean;
        disabled?: boolean;
        secondary?: boolean;
        small?: boolean;
        tiny?: boolean;
        fill?: boolean;
        hollow?: boolean;
        title?: string;
        square?: boolean;
        children?: Snippet;
    }

    let {
        children,
        ...rest
    }: Props = $props();
</script>

{#if $currentTheme.name === "signals"}
    <SignalsButton on:click {...rest}>
        {@render children?.()}
    </SignalsButton>
{:else}
    <StandardButton on:click {...rest}>
        {@render children?.()}
    </StandardButton>
{/if}
