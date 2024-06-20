<script lang="ts">
    import { spring } from "svelte/motion";
    import { ChitEarnedEvent, type OpenChat } from "openchat-client";
    import { getContext, onMount, tick } from "svelte";
    import SpinningToken from "../icons/SpinningToken.svelte";
    import { Confetti } from "svelte-confetti";

    const client = getContext<OpenChat>("client");
    let bobbing = false;
    let hidden = true;
    let confetti = false;

    onMount(() => {
        client.addEventListener("openchat_event", clientEvent);
        tick().then(() => (hidden = false));
        window.setTimeout(() => {
            bobbing = true;
            confetti = true;
            window.setTimeout(() => {
                bobbing = false;
                confetti = false;
                window.setTimeout(() => (hidden = true), 300);
            }, 2500);
        }, 1000);
        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof ChitEarnedEvent) {
            // alert(`you earned some chit mother fucker: ${JSON.stringify(ev.detail)}`);
        }
    }
</script>

{#if confetti}
    <div class="confetti">
        <Confetti colorArray={["url(/assets/chit.svg)"]} />
    </div>
{/if}
<div class:bobbing class:hidden class="coin">
    <SpinningToken spin mirror={false} size={"large"} logo={"/assets/chit.svg"} />
</div>

<style lang="scss">
    .confetti,
    .coin {
        position: absolute;
        @include z-index("coin");
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    .coin {
        transition: transform 400ms ease-in-out;

        &.hidden {
            transform: translate(-50%, -50%) translateY(1000px);
        }

        &.bobbing {
            animation: bob 3s linear infinite;
        }
    }

    @keyframes bob {
        0% {
            transform: translateY(0) translate(-50%, -50%);
        }
        50% {
            transform: translateY(-8px) translate(-50%, -50%);
        }
        100% {
            transform: translateY(0) translate(-50%, -50%);
        }
    }
</style>
