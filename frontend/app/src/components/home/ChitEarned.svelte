<script lang="ts">
    import { subscribe, type ChitEarned, type OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { Confetti } from "svelte-confetti";
    import { _ } from "svelte-i18n";
    import { Spring, Tween } from "svelte/motion";
    import SpinningToken from "../icons/SpinningToken.svelte";

    const OFF_SCREEN_OPACITY = 0.0;
    const SHOW_DURATION = 3000;
    const SLIDE_IN_DURATION = 400;
    const TWEEN_DURATION = 300;
    const LONG_DURATION = SHOW_DURATION * 3;

    const client = getContext<OpenChat>("client");
    let confetti = $state(false);
    let dimensions = getDimension();
    let ypos = new Spring(dimensions.height + 100, { damping: 0.4, stiffness: 0.2 });
    let opacity = new Tween(OFF_SCREEN_OPACITY, { duration: TWEEN_DURATION });
    let msg = new Tween({ scale: 0, opacity: 1 }, { duration: TWEEN_DURATION });
    let left = $state(dimensions.width / 2);
    let amount = $state(0);
    let labels: string[] = $state([]);
    let active = $state(false);
    let imageUrl = $state("/assets/chit.svg");
    let maxStreak = $state(false);

    function trigger(events: ChitEarned[]) {
        maxStreak = false;
        amount = events.reduce((total, chit) => total + chit.amount, 0);
        labels = events.reduce((labels, c) => {
            if (c.reason.kind === "achievement_unlocked") {
                if (c.reason.type === "streak_365") {
                    maxStreak = true;
                    imageUrl = "/assets/max_streak.svg";
                }
                labels.push($_(`learnToEarn.${c.reason.type}`));
            }
            if (c.reason.kind === "external_achievement_unlocked") {
                labels.push(c.reason.name);
            }
            return labels;
        }, [] as string[]);
        const showDuration = maxStreak ? LONG_DURATION : SHOW_DURATION;
        ypos.target = dimensions.height / 2;
        opacity.target = 1;
        active = true;
        if (maxStreak) {
            setTimeout(() => {
                shakeElements(
                    [
                        "div.message-wrapper",
                        ".chat-summary",
                        ".avatar",
                        "svg",
                        ".date-label",
                        ".icon",
                        ".section-header",
                        ".message-entry",
                        ".section-selector",
                        ".input-wrapper",
                        ".legend",
                        ".chat-list",
                    ],
                    {
                        duration: showDuration,
                        maxIntensity: 50,
                    },
                );
            }, 100);
        }
        window.setTimeout(() => {
            confetti = true;
            msg.target = { scale: 1, opacity: 1 };
            window.setTimeout(() => {
                confetti = false;
                opacity.target = OFF_SCREEN_OPACITY;
                msg.target = { scale: 0, opacity: 1 };
                window.setTimeout(reset, TWEEN_DURATION);
            }, showDuration);
        }, SLIDE_IN_DURATION);

        // update the backend so we don't get notified again
        client.markAchievementsSeen();
    }

    function reset() {
        dimensions = getDimension();
        left = dimensions.width / 2;
        ypos.set(dimensions.height + 100);
        opacity.set(OFF_SCREEN_OPACITY, { duration: 0 });
        msg.set({ scale: 0, opacity: 1 }, { duration: 0 });
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
        trigger([
            {
                amount: 100_000,
                timestamp: BigInt(Date.now()),
                reason: {
                    kind: "achievement_unlocked",
                    type: "streak_365",
                },
            },
        ]);
        return subscribe("chitEarned", trigger);
    });

    function shakeElements(
        selectors: string[],
        {
            duration = 2000,
            maxIntensity = 20,
            explosionForce = 1000,
            returnDuration = 500,
        }: {
            duration?: number;
            maxIntensity?: number;
            explosionForce?: number;
            returnDuration?: number;
        } = {},
    ): void {
        const elements: HTMLElement[] = selectors
            .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
            .filter((el): el is HTMLElement => el instanceof HTMLElement);

        const originalTransforms = new Map<HTMLElement, CSSStyleDeclaration>();

        for (const el of elements) {
            originalTransforms.set(el, el.style ?? {});
        }

        const startTime = performance.now();

        function animate(now: number): void {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const intensity = maxIntensity * progress;

            for (const el of elements) {
                const x = (Math.random() - 0.5) * 2 * intensity;
                const y = (Math.random() - 0.5) * 2 * intensity;
                el.style.transform = `translate(${x}px, ${y}px)`;
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                for (const el of elements) {
                    const angle = Math.random() * 2 * Math.PI;
                    const radius = explosionForce * (0.5 + Math.random() / 2);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const rotation = (Math.random() - 0.5) * 720;
                    const scale = 1 + Math.random() * 5;

                    el.style.transition = "transform 3s ease-out";
                    el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
                    el.style.transformOrigin = "center";
                }

                setTimeout(() => {
                    for (const el of elements) {
                        el.style = JSON.stringify(originalTransforms.get(el) ?? {});
                        el.style.transition = `transform ${returnDuration}ms ease-in-out`;
                    }
                }, 3000);
            }
        }

        requestAnimationFrame(animate);
    }
</script>

<svelte:window on:resize={reset} />

<div class="overlay" class:active>
    <div
        class="wrapper"
        style={`top: ${ypos.current}px; left: ${left}px; opacity: ${opacity.current}`}>
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
            <SpinningToken
                spin
                mirror={false}
                size={maxStreak ? "extra-large" : "large"}
                logo={imageUrl} />
        </div>
        <div
            class="details"
            style={`transform: scale(${msg.current.scale}); opacity: ${msg.current.opacity}`}>
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
