<script lang="ts">
    import { currentTheme } from "../theme/themes";
    import SignalsButton from "./SignalsButton.svelte";
    import StandardButton from "./StandardButton.svelte";

    export let cls = "";
    export let loading: boolean = false;
    export let disabled: boolean = false;
    export let secondary: boolean = false;
    export let small: boolean = false;
    export let tiny: boolean = false;
    export let fill: boolean = false;
    export let hollow: boolean = false;
    export let title: string | undefined = undefined;
    export let square: boolean = false;
</script>

{#if $currentTheme.name === "signals"}
    <SignalsButton on:click {...$$props}>
        <slot />
    </SignalsButton>
{:else}
    <StandardButton on:click {...$$props}>
        <slot />
    </StandardButton>
{/if}
