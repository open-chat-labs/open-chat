<script lang="ts">
    import { type OpenChat } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { getContext } from "svelte";
    import { msToDays, msToMinutes, msToMonths, msToWeeks } from "../../../utils/time";

    type DurationData = {
        total: number;
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        weeks: number;
        months: number;
    };

    const client = getContext<OpenChat>("client");

    export let expiry: bigint | undefined;

    $: duration = expiry ? client.durationFromMilliseconds(Number(expiry)) : undefined;

    $: durationString = formatDuration(duration);

    function formatDuration(duration: DurationData | undefined): string | undefined {
        if (duration === undefined) return undefined;

        // TODO - pluralisation & i18n
        if (duration.minutes > 0) {
            return `${msToMinutes(duration.total)} minutes`;
        }

        if (duration.days > 0) {
            return `${msToDays(duration.total)} days`;
        }

        if (duration.weeks > 0) {
            return `${msToWeeks(duration.total)} weeks`;
        }

        if (duration.months > 0) {
            return `${msToMonths(duration.total)} months`;
        }
    }
</script>

{#if durationString !== undefined}
    <Translatable
        resourceKey={i18nKey("access.evaluationIntervalSummary", {
            interval: durationString,
        })} />
{/if}
