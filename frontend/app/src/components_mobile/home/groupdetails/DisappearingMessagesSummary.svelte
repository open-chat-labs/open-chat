<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { msToDays, msToHours, msToMinutes } from "@src/utils/time";
    import { Body, Container } from "component-lib";
    import { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Translatable from "../../Translatable.svelte";
    import Separator from "../Separator.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        eventsTTL?: bigint;
    }

    let { eventsTTL }: Props = $props();
    let disappearsIn = $derived.by(() => {
        if (eventsTTL === undefined) {
            return undefined;
        }
        const duration = client.durationFromMilliseconds(Number(eventsTTL));
        const { days, hours, minutes, total } = duration;
        if (days > 0) {
            return `${msToDays(total)} days`;
        } else if (hours > 0) {
            return `${msToHours(total)} hours`;
        } else if (minutes > 0) {
            return `${msToMinutes(total)} minutes`;
        }
    });
</script>

{#if disappearsIn !== undefined}
    <Separator />
    <Container padding={["zero", "md"]} direction={"vertical"} gap={"md"}>
        <Container crossAxisAlignment={"center"} mainAxisAlignment={"spaceBetween"}>
            <Body colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Disappearing messages")}></Translatable>
            </Body>
            <Body width={"hug"} colour={"secondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey(`${disappearsIn}`)}></Translatable>
            </Body>
        </Container>
        <Body>
            <Translatable
                resourceKey={i18nKey(
                    `After ${disappearsIn}, any message sent in this group will be deleted.`,
                )}></Translatable>
        </Body>
    </Container>
{/if}
