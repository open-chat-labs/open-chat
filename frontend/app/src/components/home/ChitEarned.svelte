<script lang="ts">
    import { spring, tweened } from "svelte/motion";
    import { ChitEarnedEvent, type OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import SpinningToken from "../icons/SpinningToken.svelte";
    import { Confetti } from "svelte-confetti";

    const OFF_SCREEN_OPACITY = 0.0;
    const SHOW_DURATION = 2500;
    const SLIDE_IN_DURATION = 400;
    const TWEEN_DURATION = 300;

    const client = getContext<OpenChat>("client");
    let confetti = false;
    let dimensions = getDimension();
    let ypos = spring(dimensions.height + 100, { damping: 0.4, stiffness: 0.2 });
    let opacity = tweened(OFF_SCREEN_OPACITY, { duration: TWEEN_DURATION });
    let msg = tweened({ scale: 0, opacity: 1 }, { duration: TWEEN_DURATION });
    let left = dimensions.width / 2;
    let amount = 0;

    function trigger(total: number) {
        amount = total;
        ypos.set(dimensions.height / 2);
        opacity.set(1);
        window.setTimeout(() => {
            confetti = true;
            msg.set({ scale: 1, opacity: 1 });
            window.setTimeout(() => {
                confetti = false;
                opacity.set(OFF_SCREEN_OPACITY);
                msg.set({ scale: 0, opacity: 1 });
                window.setTimeout(reset, TWEEN_DURATION);
            }, SHOW_DURATION);
        }, SLIDE_IN_DURATION);
    }

    function reset() {
        dimensions = getDimension();
        left = dimensions.width / 2;
        ypos = spring(dimensions.height + 100, { damping: 0.4, stiffness: 0.2 });
        opacity = tweened(OFF_SCREEN_OPACITY, { duration: TWEEN_DURATION });
        msg = tweened({ scale: 0, opacity: 1 }, { duration: TWEEN_DURATION });
        confetti = false;
    }

    function getDimension() {
        return {
            height: window.innerHeight,
            width: window.innerWidth,
        };
    }

    onMount(() => {
        client.addEventListener("openchat_event", clientEvent);
        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof ChitEarnedEvent) {
            trigger(ev.detail.reduce((total, chit) => total + chit.amount, 0));
        }
    }
</script>

<svelte:window on:resize={reset} />

<div class="wrapper" style={`top: ${$ypos}px; left: ${left}px; opacity: ${$opacity}`}>
    {#if confetti}
        <div class="confetti">
            <Confetti
                amount={100}
                x={[-1.5, 1.5]}
                y={[-1.5, 1.5]}
                size={20}
                colorArray={["url(/assets/chit.svg)"]} />
        </div>
    {/if}
    <div class="coin">
        <SpinningToken spin mirror={false} size={"large"} logo={"/assets/chit.svg"} />
    </div>
    <div class="msg" style={`transform: scale(${$msg.scale}); opacity: ${$msg.opacity}`}>
        {`+${amount} CHIT`}
    </div>
</div>

<style lang="scss">
    .wrapper {
        position: absolute;
        left: 500px;
        @include z-index("coin");
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        gap: $sp4;
        align-items: center;
    }

    .confetti {
        position: absolute;
        @include z-index("coin");
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    .msg {
        border-radius: var(--rd);
        background-color: var(--button-bg);
        color: var(--button-txt);
        width: fit-content;
        padding: $sp2 $sp3;
    }
</style>
