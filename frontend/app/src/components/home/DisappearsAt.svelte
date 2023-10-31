<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    const circum = 471.24;
    const client = getContext<OpenChat>("client");

    export let expiresAt: number;
    export let percentageExpired: number;

    $: remaining = 100 - percentageExpired;
</script>

<svg width="0.9em" height="0.9em" class="pie" viewBox="0 0 320 320">
    <clipPath id="hollow">
        <path
            d="M 160 160 m -160 0 a 160 160 0 1 0 320 0 a 160 160 0 1 0 -320 0 Z M 160 160 m -80 0 a 80 80 0 0 1 160 0 a 80 80 0 0 1 -160 0 Z"
            style="fill: rgb(216, 216, 216); stroke: rgb(0, 0, 0);" />
    </clipPath>

    <circle class="background" cx={160} cy={160} r={150} clip-path="url(#hollow)" />

    <circle
        cx={160}
        cy={160}
        r={75}
        class="countdown"
        clip-path="url(#hollow)"
        transform={`rotate(-90)`}
        stroke-dasharray={`${(remaining * circum) / 100} ${circum}`}>
        <title>{`${client.toDatetimeString(new Date(expiresAt))}`}</title>
    </circle>
</svg>

<style lang="scss">
    svg {
        padding: 0.5px;
    }

    .background {
        fill: rgba(255, 255, 255, 0.2);
    }

    .countdown {
        fill: transparent;
        transform-origin: 50% 50%;
        stroke-width: 150px;
        stroke: currentColor;
        cursor: pointer;
    }
</style>
