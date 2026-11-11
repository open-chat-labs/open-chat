<script lang="ts">
    import { msToDays, msToHours, msToMinutes } from "@src/utils/time";
    import { Chip, Column, Container } from "component-lib";
    import type { OpenChat } from "@client";
    import { getContext, onMount, untrack, type Snippet } from "svelte";

    const ONE_MINUTE = 1000 * 60;
    const ONE_HOUR = ONE_MINUTE * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const client = getContext<OpenChat>("client");

    interface Props {
        duration?: bigint;
        title?: Snippet;
        // The longest duration which may be chosen, if there is a limit
        maxMilliseconds?: bigint;
        // The units offered, all of them by default
        units?: Unit[];
    }

    type Unit = "minutes" | "hours" | "days";

    let {
        duration = $bindable(BigInt(ONE_DAY)),
        title,
        maxMilliseconds,
        units = ["minutes", "hours", "days"],
    }: Props = $props();

    const options: Record<Unit, number[]> = {
        minutes: [1, 5, 15, 30, 45],
        hours: [1, 2, 6, 12, 18],
        days: [1, 7, 30, 90, 365],
    };

    let selectedUnit = $state<Unit>(untrack(() => (units.includes("hours") ? "hours" : units[0])));
    const values = $derived(options[selectedUnit].filter((value) => withinMax(selectedUnit, value)));
    let selectedValue = $state<number>(1);

    function fromMilliseconds(milliseconds?: bigint) {
        if (milliseconds === undefined) {
            return;
        }
        const duration = client.durationFromMilliseconds(Number(milliseconds));
        const { days, hours, minutes, total } = duration;
        if (days > 0) {
            selectedValue = msToDays(total);
            selectedUnit = "days";
        } else if (hours > 0) {
            selectedValue = msToHours(total);
            selectedUnit = "hours";
        } else if (minutes > 0) {
            selectedValue = msToMinutes(total);
            selectedUnit = "minutes";
        }
    }

    function withinMax(unit: Unit, value: number): boolean {
        return maxMilliseconds === undefined || toMilliseconds(unit, value) <= maxMilliseconds;
    }

    function toMilliseconds(unit: Unit, value: number) {
        switch (unit) {
            case "minutes":
                return BigInt(ONE_MINUTE * value);
            case "hours":
                return BigInt(ONE_HOUR * value);
            case "days":
                return BigInt(ONE_DAY * value);
        }
    }

    onMount(() => {
        untrack(() => {
            fromMilliseconds(duration);
        });
    });

    $effect(() => {
        const e = toMilliseconds(selectedUnit, selectedValue);
        if (e !== duration) {
            duration = e;
        }
    });
</script>

<Column gap="sm">
    {@render title?.()}
    {#if units.length > 1}
        <Container wrap mainAxisAlignment={"spaceAround"} gap={"xs"}>
            {#each units as unit}
                <Chip
                    fill
                    onClick={() => {
                        selectedUnit = unit;
                        selectedValue = 1;
                    }}
                    mode={unit === selectedUnit ? "rounded" : "unselected"}>
                    {unit}
                </Chip>
            {/each}
        </Container>
    {/if}
    <Container wrap mainAxisAlignment={"spaceAround"} gap={"xs"}>
        {#each values as value}
            <Chip
                fill
                onClick={() => (selectedValue = value)}
                mode={value === selectedValue ? "rounded" : "unselected"}>
                {value}
            </Chip>
        {/each}
    </Container>
</Column>
