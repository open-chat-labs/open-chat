<script lang="ts">
    import { onMount } from "svelte";
    import { tweened } from "svelte/motion";

    interface Props {
        enabled: boolean;
    }

    let { enabled }: Props = $props();

    let y1 = tweened(-45, { duration: 1000 });
    let y2 = tweened(55, { duration: 1000 });

    let destroyed = false;

    onMount(() => {
        return () => (destroyed = true);
    });

    function animate(v1: number, v2: number) {
        y1.set(v1);
        y2.set(v2);
        if (destroyed || !enabled) return;

        setTimeout(() => {
            y1 = tweened(-45, { duration: 1000 });
            y2 = tweened(55, { duration: 1000 });
            animate(55, 155);
        }, 3000);
    }
    let fill = $derived(enabled ? "url(#grad1)" : "transparent");
    let stroke = $derived(enabled ? "rgb(247, 28, 255)" : "var(--icon-txt)");
    $effect(() => {
        if (enabled) {
            animate(55, 155);
        }
    });
</script>

<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient
            id="grad1"
            x1="0%"
            x2="0%"
            y1={`${$y1}%`}
            y2={`${$y2}%`}
            gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="rgb(255,213,0)" />
            <stop offset="30%" stop-color="rgb(255,213,0)" />
            <stop offset="50%" stop-color="#fe9d03" />
            <stop offset="70%" stop-color="rgb(255,213,0)" />
            <stop offset="100%" stop-color="rgb(255,213,0)" />
        </linearGradient>
    </defs>
    <polygon
        style={`stroke-width: 10px; fill: ${fill}; stroke-miterlimit: 5; stroke: ${stroke};`}
        points="42.474 4.937 124.321 18.727 146.446 106.726 110.598 100.041 122.041 188.247 42.947 65.828 92.355 74.039"
    ></polygon>
</svg>

<style lang="scss">
    svg {
        transform: scaleX(-1);
        width: toRem(32);
        height: toRem(32);

        @include mobile() {
            width: toRem(24);
            height: toRem(24);
        }
    }
</style>
