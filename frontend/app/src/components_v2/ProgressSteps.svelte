<script module lang="ts">
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

    interface Props {
        steps: Step[];
        result: Result;
        labelValues?: InterpolationValues | undefined;
        percent?: number | undefined;
    }

    let { steps, result, labelValues = undefined, percent = undefined }: Props = $props();
</script>

<div>
    {#each steps as step, i ("step" + i)}
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
