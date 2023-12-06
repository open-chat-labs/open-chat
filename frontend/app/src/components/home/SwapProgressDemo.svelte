<script lang="ts">
    import { onMount } from "svelte";
    import { fly } from "svelte/transition";
    import { flip } from "svelte/animate";
    import Spinner from "../icons/Spinner.svelte";
    import { currentTheme } from "../../theme/themes";
    import Progress from "../Progress.svelte";

    type Step = { label: string; status: "done" | "doing" | "todo" | "failed" };

    let steps: Step[] = [
        { label: "Doing some stuff at the moment", status: "doing" },
        { label: "Making sure everything is order", status: "todo" },
        { label: "Sorting out all the things", status: "todo" },
        { label: "Getting stuff squared away", status: "todo" },
        { label: "And I suppose we are just about finished now", status: "todo" },
    ];

    $: [toShow, _] = steps.reduce<[Step[], boolean]>(
        ([all, stop], s) => {
            if (stop) return [all, stop];
            if (s.status === "todo") return [all, true];
            all.push(s);
            return [all, false];
        },
        [[], false] as [Step[], boolean],
    );

    let percent = 0;
    let count = 0;

    onMount(() => {
        setInterval(() => {
            count += 1;
            percent = (count / steps.length) * 100;
            const [s, _] = steps.reduce<[Step[], boolean]>(
                ([all, skip], s) => {
                    if (!skip) {
                        if (s.status === "doing") {
                            s.status = "done";
                        }
                        if (s.status === "todo") {
                            s.status = "doing";
                            skip = true;
                        }
                    }
                    all.push(s);
                    return [all, skip];
                },
                [[], false] as [Step[], boolean],
            );
            steps = s;
        }, 2000);
    });
</script>

<div class="steps">
    {#each toShow as step, i (step.label)}
        <div
            in:fly={{ duration: 500, y: 100 }}
            animate:flip={{ duration: 500 }}
            class={`step ${step.status}`}>
            {#if step.status === "doing"}
                <div class="spinner">
                    <Spinner
                        size="25px"
                        foregroundColour={$currentTheme.accent}
                        backgroundColour={"rgba(255,255,255,0.5)"}></Spinner>
                    <div class="number">{i + 1}</div>
                </div>
            {:else}
                <div class={`index ${step.status}`}>
                    {i + 1}
                </div>
            {/if}
            <div class={`label ${step.status}`}>
                {step.label}
            </div>
        </div>
    {/each}
</div>

<div class="progress">
    <Progress size={"20px"} {percent} />
</div>

<style lang="scss">
    .steps {
        padding: $sp4 0;
        width: 400px;
    }

    .step {
        display: flex;
        gap: $sp3;
        align-items: center;
        margin-bottom: $sp4;

        &.todo {
            color: var(--txt-light);
            @include font(book, normal, fs-80);
        }

        .index {
            display: flex;
            justify-content: center;
            align-items: center;
            @include font(book, normal, fs-80);
            border: 3px solid red;
            width: 25px;
            height: 25px;
            border-radius: 50%;

            &.todo {
                border-color: var(--txt-light);
            }
            &.done {
                border-color: var(--toast-success-bg);
            }
            &.failed {
                border-color: var(--error);
            }
        }
    }

    .spinner {
        position: relative;
        height: 25px;
        .number {
            @include font(book, normal, fs-80);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
    }
</style>
