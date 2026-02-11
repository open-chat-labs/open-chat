<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { msToDays, msToHours, msToMinutes } from "@src/utils/time";
    import { Body, Chip, Container } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { getContext, onMount, untrack, type Snippet } from "svelte";
    import Translatable from "../Translatable.svelte";

    const ONE_MINUTE = 1000 * 60;
    const ONE_HOUR = ONE_MINUTE * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const client = getContext<OpenChat>("client");

    interface Props {
        eventsTTL?: bigint;
        toggle: Snippet<[() => void, boolean]>;
    }

    let { eventsTTL = $bindable(), toggle }: Props = $props();

    let disappearingMessages = $state(eventsTTL !== undefined);

    type Unit = "minutes" | "hours" | "days";

    const units: Unit[] = ["minutes", "hours", "days"];
    const values: number[] = $derived.by(() => {
        switch (selectedUnit) {
            case "minutes":
                return [1, 5, 15, 30, 45];
            case "hours":
                return [1, 2, 6, 12, 18];
            case "days":
                return [1, 7, 30, 90, 365];
        }
    });
    let selectedValue = $state<number>(1);
    let selectedUnit = $state<Unit>("hours");

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
        if (!disappearingMessages) return undefined;

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
            fromMilliseconds(eventsTTL);
        });
    });

    $effect(() => {
        const e = toMilliseconds();
        if (e !== eventsTTL) {
            eventsTTL = e;
        }
    });
</script>

<Container gap={"xl"} direction={"vertical"}>
    {@render toggle(() => (disappearingMessages = !disappearingMessages), disappearingMessages)}

    {#if disappearingMessages}
        <Container gap={"lg"} direction={"vertical"}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Specify timeout for disappearing messages")}
                ></Translatable>
            </Body>
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
        </Container>
    {/if}
</Container>
