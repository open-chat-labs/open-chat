<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { Poller } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";

    export let swapId: bigint;
    export let tokenIn: string;
    export let tokenOut: string;
    export let amountIn: string;
    export let decimalsOut: number;
    export let dex: string;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const POLL_INTERVAL = 1000;

    let step = 0;
    let amountOut = "";
    let swapProgressSteps = ["get", "deposit", "notify", "swap", "withdraw"];
    let swapProgressResults: (boolean | undefined)[] = [
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
    ];

    $: values = {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        dex,
    };

    onMount(() => {
        const poller = new Poller(querySwapProgress, POLL_INTERVAL, POLL_INTERVAL, true);

        return () => poller.stop();
    });

    async function querySwapProgress() {
        let response = await client.tokenSwapStatus(swapId);

        if (response.kind === "success") {
            if (response.withdrawnFromDex?.kind === "ok" && step <= 4) {
                const status =
                    response.amountSwapped?.kind === "ok" &&
                    response.amountSwapped.value.kind === "ok"
                        ? "success"
                        : "failure";
                swapProgressResults = [true, true, true, status === "success", true];
                step = 5;
                onComplete(status);
            } else if (response.amountSwapped?.kind === "ok" && step <= 3) {
                if (response.amountSwapped.value.kind === "ok") {
                    amountOut = client.formatTokens(
                        response.amountSwapped.value.value,
                        0,
                        decimalsOut,
                    );
                    swapProgressResults = [true, true, true, true, undefined];
                } else {
                    swapProgressSteps[4] = "refund";
                    swapProgressResults = [true, true, true, false, undefined];
                }
                step = 4;
            } else if (response.notifyDex?.kind == "ok" && step <= 2) {
                swapProgressResults = [true, true, true, undefined, undefined];
                step = 3;
            } else if (response.transfer?.kind == "ok" && step <= 1) {
                swapProgressResults = [true, true, undefined, undefined, undefined];
                step = 2;
            } else if (response.transfer?.kind == "error" && step <= 1) {
                swapProgressResults = [true, false, undefined, undefined, undefined];
                onComplete("error");
            } else if (response.depositAccount?.kind == "ok" && step === 0) {
                swapProgressResults = [true, undefined, undefined, undefined, undefined];
                step = 1;
            } else if (response.depositAccount?.kind == "error" && step === 0) {
                swapProgressResults = [false, undefined, undefined, undefined, undefined];
                onComplete("error");
            }
        }
    }

    function onComplete(status: "success" | "failure" | "error") {
        dispatch("complete", { status, amountOut });
    }
</script>

<ol>
    {#each swapProgressSteps as label, i}
        {#if step >= i}
            <li>
                {$_(`tokenSwap.progress.${label}`, {
                    values,
                })}... {#if swapProgressResults[i] === true}✅️{:else if swapProgressResults[i] === false}❌️{/if}
            </li>
        {/if}
    {/each}
</ol>

<style lang="scss">
    ol {
        margin-left: $sp4;
    }
</style>
