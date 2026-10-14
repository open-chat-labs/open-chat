<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        Button,
        ColourVars,
        Container,
        Sheet,
        Subtitle,
        type SizeMode,
    } from "component-lib";
    import type { InterpolationValues, SwapFromWalletStep, SwapOutcome } from "@client";
    import { formatTokens, publish } from "@client";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    interface Props {
        // The quote's values, which fill in the step labels
        values: InterpolationValues;
        decimalsOut: number;
        // The step the swap, which the user makes straight from their wallet, has reached, once it
        // is past initialising. Its steps are reported as they start.
        step: SwapFromWalletStep | undefined;
        // How the swap went, once it has
        outcome: Exclude<SwapOutcome, { kind: "cancelled" }> | undefined;
    }

    let { values, decimalsOut, step, outcome }: Props = $props();

    const height: SizeMode = { size: "16rem" };
    const labelPrefix = "tokenSwap.progress.";

    let amountOut = $derived(
        outcome?.kind === "swapped"
            ? formatTokens(outcome.amountOut, decimalsOut)
            : step?.step === "withdraw"
              ? formatTokens(step.amountOut, decimalsOut)
              : "",
    );

    let labelValues = $derived({ ...values, amountOut });

    type Stage =
        | { kind: "init" }
        | { kind: "approve" }
        | { kind: "swap" }
        | { kind: "withdraw" }
        | { kind: "done" };

    const stages: Stage["kind"][] = ["init", "approve", "swap", "withdraw", "done"];

    let currentStage = $derived<Stage["kind"]>(
        outcome?.kind === "swapped" ? "done" : (step?.step ?? "init"),
    );
    let currentStageIndex = $derived(stages.findIndex((s) => s === currentStage));
    let error = $derived(outcome !== undefined && outcome.kind !== "swapped");

    function percentFromIndex(idx: number) {
        return (idx / (stages.length - 1)) * 100;
    }

    function closeModalStack() {
        publish("closeModalStack");
    }
</script>

<Sheet onDismiss={closeModalStack}>
    <Container direction={"vertical"} gap={"xxl"} padding={["lg", "xxl", "huge"]}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Swap in progress")} />
        </Subtitle>

        <Container
            supplementalClass={`permission_slider`}
            mainAxisAlignment={"start"}
            padding={["zero", "sm"]}
        >
            <Container
                width={"hug"}
                {height}
                direction={"vertical"}
                overflow={"visible"}
                padding={["md", "xxl", "md", "zero"]}
            >
                <div class="track">
                    <div
                        class="progress"
                        style={`height: ${percentFromIndex(currentStageIndex)}%`}
                    ></div>
                    {#each stages as _, i}
                        {@const active = i <= currentStageIndex}
                        {@const current = i === currentStageIndex}
                        {@const inerror = current && error}
                        <div style={`top: ${percentFromIndex(i)}%;`} class="marker-target">
                            <div
                                class:active
                                class:current
                                class:inerror
                                class="marker"
                                class:end={i === 0 || i === stages.length - 1}
                            ></div>
                        </div>
                    {/each}
                </div>
            </Container>
            <Container
                width={"hug"}
                {height}
                direction={"vertical"}
                padding={"zero"}
                mainAxisAlignment={"spaceBetween"}
            >
                {#each stages as stage, i}
                    {@const active = i <= currentStageIndex}
                    {@const current = i === currentStageIndex}
                    {@const inerror = current && error}
                    <div class="role_label" style={`top: ${percentFromIndex(i)}%;`}>
                        <Container crossAxisAlignment={"center"} gap={"md"}>
                            <Body
                                align={"center"}
                                colour={inerror
                                    ? "validationError"
                                    : active
                                      ? "textPrimary"
                                      : "textSecondary"}
                                width={"hug"}
                            >
                                <Translatable
                                    resourceKey={i18nKey(`${labelPrefix}${stage}`, labelValues)}
                                />
                            </Body>
                            {#if inerror}
                                <Close color={ColourVars.validationError} />
                            {:else if active}
                                <Check color={ColourVars.primary} />
                            {/if}
                        </Container>
                    </div>
                {/each}
            </Container>
        </Container>

        {#if outcome !== undefined && outcome.kind !== "swapped"}
            <ErrorMessage>
                <Translatable resourceKey={outcome.message} />
            </ErrorMessage>
        {/if}

        <Container mainAxisAlignment={"end"}>
            <Button
                secondary={error}
                onClick={outcome ? closeModalStack : undefined}
                loading={outcome === undefined}
            >
                {#if outcome === undefined}
                    <Translatable resourceKey={i18nKey("In progress")} />
                {:else if outcome.kind === "swapped"}
                    <Translatable resourceKey={i18nKey("Swap complete")} />
                {:else}
                    <Translatable resourceKey={i18nKey("Unable to complete swap")} />
                {/if}
                {#snippet icon(color)}
                    <Robot {color} />
                {/snippet}
            </Button>
        </Container>
    </Container>
</Sheet>

<style lang="scss">
    $speed: 200ms;

    .role_label {
        position: absolute;
        all: unset;
    }

    .track,
    .progress {
        position: relative;
        width: 2px;
        height: 100%;
        background-color: var(--button-disabled);
        border-radius: var(--rad-circle);
    }

    .progress {
        transition: width ease-in $speed;
        background-color: var(--primary);
    }

    .marker-target {
        position: absolute;
        left: 1px; // half track height
        width: 1.5rem;
        height: 1.5rem;
        border-radius: var(--rad-circle);
        transform: translateX(-50%) translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;

        .marker {
            border: 1px solid transparent;
            border-radius: var(--rad-circle);
            background-color: var(--button-disabled);
            transition:
                background-color ease-in $speed,
                width ease-in $speed,
                height ease-in $speed;
            width: 0.8rem;
            height: 0.8rem;

            &.active {
                background-color: var(--primary);
            }

            &.current {
                @include pulse();

                &.inerror {
                    background-color: var(--surface-1);
                    border-color: var(--validation-error);
                }
            }
        }
    }
</style>
