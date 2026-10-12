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
    import type { OpenChat, SwapFromWalletStep, SwapTokensResponse } from "@client";
    import { publish } from "@client";
    import { swapFromWalletOutcome, type SwapOutcome } from "../../../utils/tokenSwap";
    import { getContext } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    interface Props {
        tokenIn: string;
        tokenOut: string;
        ledgerIn: string;
        ledgerOut: string;
        amountIn: string;
        decimalsOut: number;
        dex: string;
        // What swapping returned, once it has
        swapResponse: SwapTokensResponse | undefined;
        // The step the swap, which the user makes straight from their wallet, has reached, once it
        // is past initialising. Its steps are reported as they start.
        swapStep: SwapFromWalletStep | undefined;
    }

    let {
        tokenIn,
        tokenOut,
        ledgerIn,
        ledgerOut,
        amountIn,
        decimalsOut,
        dex,
        swapResponse,
        swapStep,
    }: Props = $props();

    const height: SizeMode = { size: "16rem" };
    const client = getContext<OpenChat>("client");
    const labelPrefix = "tokenSwap.progress.";

    let amountOut = $state("");
    let outcome = $state<SwapOutcome>();

    let labelValues = $derived({
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        dex,
    });

    type Stage =
        | { kind: "init" }
        | { kind: "approve" }
        | { kind: "swap" }
        | { kind: "withdraw" }
        | { kind: "done" };

    const stages: Stage["kind"][] = ["init", "approve", "swap", "withdraw", "done"];

    let currentStage = $state<Stage["kind"]>("init");
    let currentStageIndex = $derived(stages.findIndex((s) => s === currentStage));
    let error = $state(false);

    $effect(() => {
        if (swapStep !== undefined && outcome === undefined) {
            if (swapStep.step === "withdraw") {
                amountOut = client.formatTokens(swapStep.amountOut, decimalsOut);
            }
            currentStage = swapStep.step;
        }
    });

    $effect(() => {
        if (swapResponse !== undefined && outcome === undefined) {
            showSwapFromWalletOutcome(swapResponse);
        }
    });

    function showSwapFromWalletOutcome(response: SwapTokensResponse) {
        if (response.kind === "success") {
            amountOut = client.formatTokens(response.amountOut, decimalsOut);
            currentStage = "done";
        } else {
            error = true;
        }
        outcome = swapFromWalletOutcome(response);
    }

    function percentFromIndex(idx: number) {
        return (idx / (stages.length - 1)) * 100;
    }

    function onFinished() {
        client.refreshAccountBalance(ledgerIn);
        client.refreshAccountBalance(ledgerOut);
        closeModalStack();
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
            padding={["zero", "sm"]}>
            <Container
                width={"hug"}
                {height}
                direction={"vertical"}
                overflow={"visible"}
                padding={["md", "xxl", "md", "zero"]}>
                <div class="track">
                    <div class="progress" style={`height: ${percentFromIndex(currentStageIndex)}%`}>
                    </div>
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
                                class:end={i === 0 || i === stages.length - 1}>
                            </div>
                        </div>
                    {/each}
                </div>
            </Container>
            <Container
                width={"hug"}
                {height}
                direction={"vertical"}
                padding={"zero"}
                mainAxisAlignment={"spaceBetween"}>
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
                                width={"hug"}>
                                <Translatable
                                    resourceKey={i18nKey(`${labelPrefix}${stage}`, labelValues)} />
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

        {#if outcome && outcome !== "success"}
            <ErrorMessage>
                {#if outcome === "error"}
                    <Translatable resourceKey={i18nKey("tokenSwap.progress.error")} />
                {:else if outcome === "unknown"}
                    <Translatable resourceKey={i18nKey("tokenSwap.progress.unknown")} />
                {:else if outcome === "insufficientFunds"}
                    <Translatable resourceKey={i18nKey("Insufficient funds")} />
                {:else if outcome === "rateChanged"}
                    <Translatable resourceKey={i18nKey("Rate changed")} />
                {/if}
            </ErrorMessage>
        {/if}

        <Container mainAxisAlignment={"end"}>
            <Button
                secondary={outcome !== undefined && outcome !== "success"}
                onClick={outcome ? onFinished : undefined}
                loading={outcome === undefined}>
                {#if outcome === undefined}
                    <Translatable resourceKey={i18nKey("In progress")} />
                {:else if outcome === "success"}
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
