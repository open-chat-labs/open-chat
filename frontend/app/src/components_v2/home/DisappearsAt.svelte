<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    const circum = 471.24;
    const client = getContext<OpenChat>("client");

    interface Props {
        me: boolean;
        expiresAt: number;
        percentageExpired: number;
    }

    let { me, expiresAt, percentageExpired }: Props = $props();

    const markers: [number, number][] = [];
    const LINE_RADIUS = 85;
    const MARKER_RADIUS = 135;
    const CENTER = 160;

    function rads(degrees: number): number {
        return (degrees * Math.PI) / 180;
    }

    for (let x = 1; x <= 12; x++) {
        markers.push([
            CENTER + MARKER_RADIUS * Math.cos(rads(30 * x)),
            CENTER + MARKER_RADIUS * Math.sin(rads(30 * x)),
        ]);
    }

    let remaining = $derived(100 - percentageExpired);
    let degrees = $derived((remaining / 100) * 360);
</script>

<svg width="0.9em" height="0.9em" class="pie" viewBox="0 0 320 320">
    <clipPath id="hollow">
        <path
            d="M 160 160 m -160 0 a 160 160 0 1 0 320 0 a 160 160 0 1 0 -320 0 Z M 160 160 m -120 0 a 120 120 0 0 1 240 0 a 120 120 0 0 1 -240 0 Z"
            style="fill: rgb(216, 216, 216); stroke: rgb(0, 0, 0);" />
    </clipPath>

    <circle class:me class="background" cx={CENTER} cy={CENTER} r={150} clip-path="url(#hollow)" />

    {#each markers as marker}
        <circle class="marker" cx={marker[0]} cy={marker[1]} r="10" />
    {/each}

    <circle
        cx={CENTER}
        cy={CENTER}
        r={75}
        class="countdown"
        class:me
        clip-path="url(#hollow)"
        transform={`rotate(-90)`}
        stroke-dasharray={`${(remaining * circum) / 100} ${circum}`}>
        <title>{`${client.toDatetimeString(new Date(expiresAt))}`}</title>
    </circle>

    <line
        style={`--line-angle: ${degrees}deg`}
        class:me
        class="hand"
        x1={CENTER}
        y1={CENTER}
        x2={CENTER}
        y2={LINE_RADIUS} />
</svg>

<style lang="scss">
    svg {
        padding: 1px;
    }

    .background {
        fill: var(--time-bg);
        &.me {
            fill: var(--time-me-bg);
        }
    }

    .hand {
        transition: transform 500ms ease-in-out;
        transform: rotate(var(--line-angle));
        transform-origin: 50% 50%;
        stroke-width: 24px;
        stroke-linecap: round;
        stroke: var(--time-icon);
        &.me {
            stroke: var(--time-me-icon);
        }
    }

    .countdown {
        fill: transparent;
        transform-origin: 50% 50%;
        stroke-width: 150px;
        stroke: var(--time-icon);
        cursor: pointer;
        transition: stroke-dasharray 500ms ease-in-out;

        &.me {
            stroke: var(--time-me-icon);
        }
    }

    .marker {
        fill: var(--time-icon);
    }
</style>
