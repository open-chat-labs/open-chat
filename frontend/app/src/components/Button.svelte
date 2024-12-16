<script module lang="ts">
    export interface ButtonProps {
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
</script>

<script lang="ts">
    import type { Snippet } from "svelte";
    import { currentTheme } from "../theme/themes";
    import SignalsButton from "./SignalsButton.svelte";
    import StandardButton from "./StandardButton.svelte";

    let { children, ...rest }: ButtonProps = $props();
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
