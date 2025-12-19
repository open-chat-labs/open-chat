<script lang="ts">
    import { msToDays, msToHours, msToMinutes } from "@src/utils/time";
    import { Chip, Column, Container } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { getContext, onMount, untrack, type Snippet } from "svelte";

    const ONE_MINUTE = 1000 * 60;
    const ONE_HOUR = ONE_MINUTE * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const client = getContext<OpenChat>("client");

    interface Props {
        duration?: bigint;
        title?: Snippet;
    }

    let { duration = $bindable(BigInt(ONE_DAY)), title }: Props = $props();

    type Unit = "minutes" | "hours" | "days";

    const options: Record<Unit, number[]> = {
        minutes: [1, 5, 15, 30, 45],
        hours: [1, 2, 6, 12, 18],
        days: [1, 7, 30, 90, 365],
    };

    const units: Unit[] = ["minutes", "hours", "days"];
    let selectedUnit = $state<Unit>("hours");
    const values = $derived(options[selectedUnit]);
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

    function toMilliseconds() {
        switch (selectedUnit) {
            case "minutes":
                return BigInt(ONE_MINUTE * selectedValue);
            case "hours":
                return BigInt(ONE_HOUR * selectedValue);
            case "days":
                return BigInt(ONE_DAY * selectedValue);
        }
    }

    onMount(() => {
        untrack(() => {
            fromMilliseconds(duration);
        });
    });

    $effect(() => {
        const e = toMilliseconds();
        if (e !== duration) {
            duration = e;
        }
    });
</script>

<Column gap={"md"}>
    {@render title?.()}
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
</Column>
