<script lang="ts">
    import { now } from "../../stores/time";
    import { _ } from "svelte-i18n";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import ClockOutline from "svelte-material-icons/ClockOutline.svelte";

    export let timestamp: bigint;
    export let expiry: bigint;

    const circum = 471.24;

    $: percentage = 100;
    $: tooltip = formatTimeAgo($now, expiry);
    $: lifespan = Number(expiry - timestamp);
    $: {
        const expired = expiry <= $now;
        if (expired) {
            percentage = 0;
        } else {
            const remaining = Number(expiry) - $now;
            const fraction = Math.min(remaining / lifespan, 1);
            percentage = fraction * 100;
            console.log(
                "perc: ",
                percentage,
                " lifespan: ",
                lifespan,
                " expiry: ",
                expiry,
                " remaining: ",
                remaining
            );
        }
    }

    const formatter = new Intl.RelativeTimeFormat(undefined, {
        numeric: "auto",
    });

    const divisions = [
        { amount: 60, name: "seconds" },
        { amount: 60, name: "minutes" },
        { amount: 24, name: "hours" },
        { amount: 7, name: "days" },
        { amount: 4.34524, name: "weeks" },
        { amount: 12, name: "months" },
        { amount: Number.POSITIVE_INFINITY, name: "years" },
    ];

    function formatTimeAgo(now: number, expiry: bigint) {
        let duration = (Number(expiry) - now) / 1000;

        for (let i = 0; i <= divisions.length; i++) {
            const division = divisions[i];
            if (Math.abs(duration) < division.amount) {
                //@ts-ignore
                return formatter.format(Math.round(duration), division.name);
            }
            duration /= division.amount;
        }
    }
</script>

<TooltipWrapper alignRight={false} bottomOffset={-4} centreChevron={true}>
    <div slot="target" class="circle">
        <div class="icon">
            <ClockOutline size={"12px"} color={"#ffffff"} />
        </div>
        <svg class="pie" viewBox="0 0 320 320">
            <clipPath id="hollow">
                <path
                    d="M 160 160 m -160 0 a 160 160 0 1 0 320 0 a 160 160 0 1 0 -320 0 Z M 160 160 m -100 0 a 100 100 0 0 1 200 0 a 100 100 0 0 1 -200 0 Z"
                    style="fill: rgb(216, 216, 216); stroke: rgb(0, 0, 0);" />
            </clipPath>

            <circle class="background" cx={160} cy={160} r={150} clip-path="url(#hollow)" />

            {#if percentage > 0}
                <circle
                    class={`slice`}
                    cx={160}
                    cy={160}
                    r={75}
                    stroke={"var(--primary)"}
                    clip-path="url(#hollow)"
                    transform={`rotate(${-90})`}
                    stroke-dasharray={`${(percentage * circum) / 100} ${circum}`} />
            {/if}
        </svg>
    </div>

    <div slot="tooltip">
        <TooltipPopup alignRight={false} textLength={tooltip?.length ?? 0} longestWord={10}>
            {$_("disappearsIn", { values: { time: tooltip } })}
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style type="text/scss">
    $size: 15px;

    .circle {
        position: relative;
        height: $size;
        width: $size;
        margin: auto;
        position: relative;
        background: transparent;

        .background {
            // fill: var(--accent);
            fill: rgba(0, 0, 0, 0.1);
        }
    }

    .icon {
        position: absolute;
        top: 1.5px;
        left: 1.5px;
    }

    .slice {
        fill: transparent;
        transform-origin: 50% 50%;
        stroke-width: 150px;
        cursor: pointer;
        transition: stroke-dasharray 100ms ease-in-out;
    }
</style>
