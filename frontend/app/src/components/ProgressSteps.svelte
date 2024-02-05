<script lang="ts">
    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import Progress from "./Progress.svelte";
    import ProgressStep from "./ProgressStep.svelte";
    import type { InterpolationValues } from "openchat-client";
    import { i18nKey } from "../i18n/i18n";

    export let stepLabels: string[];
    export let labelValues: InterpolationValues | undefined = undefined;
    export let step = 0;
    export let finalLabel: string | undefined;

    type Status = "done" | "doing" | "todo" | "failed";

    let steps: Status[] = Array.from(Array(stepLabels.length)).map((_, index) =>
        index === 0 ? "doing" : "todo",
    );

    let finalStatus: "overall-done" | "overall-failed" | undefined = undefined;

    $: [toShow, _stop] = steps.reduce<[Status[], boolean]>(
        ([all, stop], s) => {
            if (stop) return [all, stop];
            if (s === "todo") return [all, true];
            all.push(s);
            return [all, false];
        },
        [[], false] as [Status[], boolean],
    );

    $: percent = (step / steps.length) * 100;

    export function next(previousSuccess: boolean, outcome?: boolean) {
        step++;

        const [status, _] = steps.reduce<[Status[], boolean]>(
            ([all, skip], status) => {
                if (!skip) {
                    if (status === "doing") {
                        status = previousSuccess ? "done" : "failed";
                        if (outcome !== undefined) {
                            skip = true;
                        }
                    }
                    if (status === "todo") {
                        status = "doing";
                        skip = true;
                    }
                }
                all.push(status);
                return [all, skip];
            },
            [[], false] as [Status[], boolean],
        );
        steps = status;

        if (outcome !== undefined) {
            finalStatus = outcome ? "overall-done" : "overall-failed";
        }
    }
</script>

<div>
    {#each toShow as status, i (stepLabels[i])}
        <div in:fade={{ duration: 500 }} animate:flip={{ duration: 500 }}>
            <ProgressStep label={i18nKey(stepLabels[i], labelValues)} step={i} {status} />
        </div>
    {/each}
    {#if finalStatus !== undefined && finalLabel !== undefined}
        <div>
            <ProgressStep label={i18nKey(finalLabel, labelValues)} status={finalStatus} />
        </div>
    {/if}
</div>

{#if finalStatus === undefined}
    <div class="progress">
        <Progress size={"30px"} {percent} />
    </div>
{/if}
