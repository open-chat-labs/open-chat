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
    import { Poller, publish } from "@client";
    import { swapFromWalletOutcome, type SwapOutcome } from "../../../utils/tokenSwap";
    import { getContext, onMount } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    interface Props {
        swapId: bigint;
        tokenIn: string;
        tokenOut: string;
        ledgerIn: string;
        ledgerOut: string;
        amountIn: string;
        decimalsOut: number;
        dex: string;
        // What swapping returned, once it has
        swapResponse: SwapTokensResponse | undefined;
        // Whether the user is swapping straight from their wallet, as a user who holds their own
        // funds does, in which case its steps are reported as they start rather than polled for
        fromWallet: boolean;
        // The step a swap made from the wallet has reached, once it is past initialising
        swapStep: SwapFromWalletStep | undefined;
    }

    let {
        swapId,
        tokenIn,
        tokenOut,
        ledgerIn,
        ledgerOut,
        amountIn,
        decimalsOut,
        dex,
        swapResponse,
        fromWallet,
        swapStep,
    }: Props = $props();

    const height: SizeMode = { size: "16rem" };
    const client = getContext<OpenChat>("client");
    const POLL_INTERVAL = 1000;
    const labelPrefix = "tokenSwap.progress.";

    let amountOut = $state("");
    let poller: Poller | undefined = undefined;
    let outcome = $state<SwapOutcome>();

    let labelValues = $derived({
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        dex,
    });

    // A swap is made from the wallet or not for as long as this shows it
    // svelte-ignore state_referenced_locally
    let stages = $state<Stage["kind"][]>(
        fromWallet
            ? ["init", "approve", "swap", "done"]
            : ["get", "deposit", "notify", "swap", "withdraw", "done"],
    );

    type Stage =
        | { kind: "init" }
        | { kind: "approve" }
        | { kind: "get" }
        | { kind: "deposit" }
        | { kind: "notify" }
        | { kind: "swap" }
        | { kind: "withdraw" }
        | { kind: "refund" }
        | { kind: "done" };

    // svelte-ignore state_referenced_locally
    let currentStage = $state<Stage["kind"]>(fromWallet ? "init" : "get");
    let currentStageIndex = $derived(stages.findIndex((s) => s === currentStage));
    let error = $state(false);

    onMount(() => {
        if (fromWallet) return;

        poller = new Poller(querySwapProgress, POLL_INTERVAL, POLL_INTERVAL, true);
        return () => poller?.stop();
    });

    $effect(() => {
        if (fromWallet && swapStep !== undefined && outcome === undefined) {
            // A withdrawal is only shown if the DEX doesn't pay out the output itself in good time
            if (swapStep === "withdraw") {
                stages = ["init", "approve", "swap", "withdraw", "done"];
            }
            currentStage = swapStep;
        }
    });

    $effect(() => {
        if (fromWallet && swapResponse !== undefined && outcome === undefined) {
            showSwapFromWalletOutcome(swapResponse);
        }
    });

    function notifyFinished(o: SwapOutcome) {
        outcome = o;
        poller?.stop();
    }

    function showSwapFromWalletOutcome(response: SwapTokensResponse) {
        const o = swapFromWalletOutcome(response);
        if (response.kind === "success") {
            amountOut = client.formatTokens(response.amountOut, decimalsOut);
            currentStage = "done";
        } else {
            error = true;
        }
        notifyFinished(o);
    }

    async function querySwapProgress() {
        // Read before asking, since a swap which isn't found by a query made before swapping
        // returned may yet be recorded
        const refused = swapResponse !== undefined && swapResponse.kind !== "success";
        const response = await client.tokenSwapStatus(swapId);

        if (response.kind === "success") {
            if (
                response.amountSwapped?.kind === "ok" &&
                response.amountSwapped?.value.kind === "ok"
            ) {
                amountOut = client.formatTokens(response.amountSwapped.value.value, decimalsOut);
            }

            if (response.withdrawnFromDex?.kind === "ok") {
                const success =
                    response.amountSwapped?.kind === "ok" &&
                    response.amountSwapped.value.kind === "ok";

                currentStage = "done";
                notifyFinished(success ? "success" : "rateChanged");
            } else if (response.amountSwapped?.kind === "ok") {
                if (response.amountSwapped.value.kind === "ok") {
                    currentStage = "withdraw";
                } else {
                    currentStage = "refund";
                    stages = stages.filter((s) => (s === "withdraw" ? "refund" : s));
                }
            } else if (response.notifyDex?.kind == "ok") {
                currentStage = "swap";
            } else if (response.transfer?.kind == "ok") {
                currentStage = "notify";
            } else if (response.transfer?.kind == "error") {
                error = true;
                notifyFinished("insufficientFunds");
            } else if (response.depositAccount?.kind == "ok") {
                currentStage = "deposit";
            } else if (response.depositAccount?.kind == "error") {
                error = true;
                notifyFinished("error");
            }
        } else if (refused) {
            // Swapping returned an error and the swap was never recorded, so it was refused before
            // it started (eg. the PIN was wrong) and there is no progress to wait for
            error = true;
            notifyFinished("error");
        }
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
