<script lang="ts" module>
    export type SwapOutcome = "success" | "rateChanged" | "insufficientFunds" | "error";
</script>

<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        BodySmall,
        Button,
        ColourVars,
        Container,
        Sheet,
        Subtitle,
        type SizeMode,
    } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { Poller, publish } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        swapId: bigint;
        tokenIn: string;
        tokenOut: string;
        ledgerIn: string;
        ledgerOut: string;
        amountIn: string;
        decimalsOut: number;
        dex: string;
    }

    let { swapId, tokenIn, tokenOut, ledgerIn, ledgerOut, amountIn, decimalsOut, dex }: Props =
        $props();

    ledgerOut;

    const height: SizeMode = { kind: "fixed", size: "200px" };
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

    let stages = $state<Stage["kind"][]>(["get", "deposit", "notify", "swap", "withdraw", "done"]);

    type Stage =
        | { kind: "get" }
        | { kind: "deposit" }
        | { kind: "notify" }
        | { kind: "swap" }
        | { kind: "withdraw" }
        | { kind: "refund" }
        | { kind: "done" };

    let currentStage = $state<Stage["kind"]>("get");
    let currentStageIndex = $derived(stages.findIndex((s) => s === currentStage));
    let error = $state(false);

    onMount(() => {
        poller = new Poller(querySwapProgress, POLL_INTERVAL, POLL_INTERVAL, true);
        return () => poller?.stop();
    });

    function notifyFinished(o: "success" | "rateChanged" | "insufficientFunds" | "error") {
        outcome = o;
        poller?.stop();
    }

    async function querySwapProgress() {
        let response = await client.tokenSwapStatus(swapId);

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
        }
    }

    function percentFromIndex(idx: number) {
        return (idx / (stages.length - 1)) * 100;
    }

    function onFinished() {
        client.refreshAccountBalance(ledgerIn);
        client.refreshAccountBalance(ledgerOut);
        publish("closeModalStack");
    }
</script>

<Sheet>
    <Container direction={"vertical"} gap={"xl"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Swap in progress")} />
        </Subtitle>

        <Container
            supplementalClass={`permission_slider`}
            mainAxisAlignment={"start"}
            padding={["zero", "sm"]}>
            <Container
                width={{ kind: "hug" }}
                {height}
                direction={"vertical"}
                allowOverflow
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
                width={{ kind: "hug" }}
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
                            <BodySmall
                                align={"center"}
                                colour={inerror
                                    ? "error"
                                    : active
                                      ? "textPrimary"
                                      : "textSecondary"}
                                fontWeight={"bold"}
                                width={{ kind: "hug" }}>
                                <Translatable
                                    resourceKey={i18nKey(`${labelPrefix}${stage}`, labelValues)} />
                            </BodySmall>
                            {#if inerror}
                                <Close color={ColourVars.error} />
                            {:else if active}
                                <Check color={ColourVars.primary} />
                            {/if}
                        </Container>
                    </div>
                {/each}
            </Container>
        </Container>

        {#if outcome !== "success"}
            <ErrorMessage>
                {#if outcome === "error"}
                    <Translatable resourceKey={i18nKey("Failed to get deposit account")} />
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
                    background-color: var(--background-1);
                    border-color: var(--error);
                }
            }

            /* &.end {
                width: 1rem;
                height: 1rem;
            } */
        }
    }
</style>
