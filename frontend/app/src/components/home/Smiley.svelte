<script lang="ts">
    import { onMount } from "svelte";

    import { iconSize } from "../../stores/iconSize";
    import { mobileWidth } from "../../stores/screenDimensions";

    interface Props {
        color: string;
    }

    let { color }: Props = $props();

    let open = $state(true);

    function rand(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    function blinkTimes(n: number) {
        if (n > 0) {
            blink().then(() => blinkTimes(n - 1));
        }
    }

    function blink() {
        open = false;
        return new Promise<void>((resolve) => {
            window.setTimeout(() => {
                open = true;
                window.setTimeout(resolve, 300);
            }, 80);
        });
    }

    function startBlinking() {
        return window.setInterval(() => blinkTimes(rand(0, 3)), 5000);
    }

    onMount(() => {
        if ($mobileWidth) return;
        const t = startBlinking();
        return () => window.clearInterval(t);
    });
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={$iconSize} height={$iconSize}>
    {#if open}
        <ellipse class="left open" cx="9" cy="9.3" rx="1.4" ry="2" fill={color} />
        <ellipse class="right open" cx="15" cy="9.3" rx="1.4" ry="2" fill={color} />
    {:else}
        <line x1="6.5" y1="9.3" x2="11.5" y2="9" stroke-width="1" stroke={color} />
        <line x1="13.5" y1="9" x2="17.5" y2="9.3" stroke-width="1" stroke={color} />
    {/if}

    <path
        fill={color}
        d="
        M9.153 11.603
        m-3.204 1.362
        c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0z
        m11.363 1.108
        s-.669 1.959-5.051 1.959
        c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0z
        M11.804 1.011
        C5.609 1.011.978 6.033.978 12.228
        s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228
        c.001-6.195-5.021-11.217-11.216-11.217z
        M12 21.354
        c-5.273 0-9.381-3.886-9.381-9.159
        s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548
        c-.001 5.272-4.109 9.159-9.382 9.159z
        m3.108-9.751
        " /></svg>
