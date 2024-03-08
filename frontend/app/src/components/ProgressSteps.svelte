<script context="module" lang="ts">
    export type Status = "done" | "doing" | "todo" | "failed";
    export type OverallStatus = "done" | "failed";

    export type Step = {
        status: Status;
        label: string;
    };

    export type Result =
        | {
              status: OverallStatus;
              label: string;
          }
        | undefined;
</script>

<script lang="ts">
    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import Progress from "./Progress.svelte";
    import ProgressStep from "./ProgressStep.svelte";
    import type { InterpolationValues } from "openchat-client";
    import { i18nKey } from "../i18n/i18n";

    export let steps: Step[];
    export let result: Result;
    export let labelValues: InterpolationValues | undefined = undefined;
    export let percent: number | undefined = undefined;
</script>

<div>
    {#each steps as step, i (steps[i].label)}
        <div in:fade={{ duration: 500 }} animate:flip={{ duration: 500 }}>
            <ProgressStep
                label={i18nKey(steps[i].label, labelValues)}
                step={i}
                status={step.status} />
        </div>
    {/each}
    {#if result !== undefined}
        <div>
            <ProgressStep
                label={i18nKey(result.label, labelValues)}
                status={"overall-" + result.status} />
        </div>
    {/if}
</div>

{#if result === undefined && percent !== undefined}
    <div class="progress">
        <Progress size={"30px"} {percent} />
    </div>
{/if}
