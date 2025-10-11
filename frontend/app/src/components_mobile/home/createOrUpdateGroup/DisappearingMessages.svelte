<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { msToDays, msToHours, msToMinutes } from "@src/utils/time";
    import { Body, CommonButton, Container, Switch } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import { updateGroupState } from "./group.svelte";

    const ONE_MINUTE = 1000 * 60;
    const ONE_HOUR = ONE_MINUTE * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const client = getContext<OpenChat>("client");

    let ugs = updateGroupState;

    let disappearingMessages = $state(ugs.candidateGroup.eventsTTL !== undefined);

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
        let amount: string = "";
        let unit: Unit = "days";
        if (days > 0) {
            selectedValue = msToDays(total);
            selectedUnit = "days";
        } else if (hours > 0) {
            selectedValue = msToHours(total);
            selectedUnit = "hours";
        } else if (minutes > 0) {
            selectedValue = msToMinutes(total);
            unit = "minutes";
        }
        return { amount, unit };
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

    $effect(() => {
        fromMilliseconds(ugs.candidateGroup.eventsTTL);
    });

    $effect(() => {
        ugs.candidateGroup.eventsTTL = toMilliseconds();
    });
</script>

<Setting
    toggle={() => (disappearingMessages = !disappearingMessages)}
    info={"When enabled, messages older than the specified timeout will get automatically deleted from the group."}
    title={"Enable disappearing messages"}>
    <Switch bind:checked={disappearingMessages} />
</Setting>

{#if disappearingMessages}
    <Container gap={"xl"} direction={"vertical"}>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Specify timeout for disappearing messages")}
            ></Translatable>
        </Body>
        <Container wrap mainAxisAlignment={"spaceAround"} gap={"xs"}>
            {#each values as value}
                <CommonButton
                    width={{ kind: "fill" }}
                    onClick={() => (selectedValue = value)}
                    mode={value === selectedValue ? "active" : "default"}
                    size={"small"}>{value}</CommonButton>
            {/each}
        </Container>
        <Container wrap mainAxisAlignment={"spaceAround"} gap={"xs"}>
            {#each units as unit}
                <CommonButton
                    width={{ kind: "fill" }}
                    onClick={() => {
                        selectedUnit = unit;
                        selectedValue = 1;
                    }}
                    mode={unit === selectedUnit ? "active" : "default"}
                    size={"small"}>{unit}</CommonButton>
            {/each}
        </Container>
    </Container>
{/if}
