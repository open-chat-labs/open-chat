<script lang="ts">
    import { setContext } from "svelte";
    import { writable } from "svelte/store";
    import type { WizardState } from "./types";
    export let initialStep = 1;

    let currentStep = writable(initialStep);

    const next = () => {
        $currentStep += 1;
    };
    const previous = () => {
        if ($currentStep > 0) {
            $currentStep -= 1;
        }
    };

    setContext<WizardState>("wizardState", {
        currentStep,
        next,
        previous,
    });
</script>

<slot {next} {previous} />
