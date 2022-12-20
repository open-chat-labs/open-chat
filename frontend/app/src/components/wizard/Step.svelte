<script lang="ts">
    import { getContext } from "svelte";
    import type { WizardState } from "./types";
    export let step: number;

    const { currentStep, next, previous } = getContext<WizardState>("wizardState");
</script>

{#if $currentStep === step}
    <slot {next} {previous} />
{/if}
