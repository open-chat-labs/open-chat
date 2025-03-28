<script lang="ts">
    import { spring, tweened } from "svelte/motion";
    import { ChitEarnedEvent, type OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import SpinningToken from "../icons/SpinningToken.svelte";
    import { Confetti } from "svelte-confetti";
    import { _ } from "svelte-i18n";

    const OFF_SCREEN_OPACITY = 0.0;
    const SHOW_DURATION = 3000;
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
    let labels: string[] = [];
    let active = false;

    function trigger(ev: ChitEarnedEvent) {
        amount = ev.detail.reduce((total, chit) => total + chit.amount, 0);
        labels = ev.detail.reduce((labels, c) => {
            if (c.reason.kind === "achievement_unlocked") {
                labels.push($_(`learnToEarn.${c.reason.type}`));
            }
            if (c.reason.kind === "external_achievement_unlocked") {
                labels.push(c.reason.name);
            }
            return labels;
        }, [] as string[]);
        ypos.set(dimensions.height / 2);
        opacity.set(1);
        active = true;
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

        // update the backend so we don't get notified again
        client.markAchievementsSeen();
    }

    function reset() {
        dimensions = getDimension();
        left = dimensions.width / 2;
        ypos = spring(dimensions.height + 100, { damping: 0.4, stiffness: 0.2 });
        opacity = tweened(OFF_SCREEN_OPACITY, { duration: TWEEN_DURATION });
        msg = tweened({ scale: 0, opacity: 1 }, { duration: TWEEN_DURATION });
        confetti = false;
        active = false;
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
            trigger(ev);
        }
    }
</script>

<svelte:window on:resize={reset} />

<div class="overlay" class:active>
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
        <div class="details" style={`transform: scale(${$msg.scale}); opacity: ${$msg.opacity}`}>
            <div class="chit">
                {`+${amount} CHIT`}
            </div>
            <div class="msgs">
                {#each labels as label}
                    <div class="msg">{label}</div>
                {/each}
            </div>
        </div>
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
        padding: $sp8;
        backdrop-filter: blur(10px);
        background: var(--modal-bg);
        border: var(--modal-bd);
        border-radius: var(--modal-rd);
        box-shadow: var(--modal-sh);

        @include mobile() {
            width: calc(100% - 80px);
            padding: $sp6;
        }
    }

    .confetti {
        position: absolute;
        @include z-index("coin");
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    .chit {
        border-radius: var(--rd);
        background-color: var(--button-bg);
        color: var(--button-txt);
        width: fit-content;
        padding: $sp2 $sp3;
    }

    .details {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        align-items: center;
    }

    .msgs,
    .msg {
        text-align: center;
        @include mobile() {
            @include font(book, normal, fs-90);
        }
    }

    .overlay {
        @include z-index("chit");
        position: fixed;
        display: flex;
        justify-content: center;
        align-items: center;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;
        pointer-events: none;
        transition: backdrop-filter 300ms ease-in-out;

        &.active {
            backdrop-filter: saturate(0.3);
        }
    }
</style>
