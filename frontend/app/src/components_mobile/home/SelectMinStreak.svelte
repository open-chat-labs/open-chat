<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, ColourVars, Column, H2, Row, Sheet } from "component-lib";
    import Right from "svelte-material-icons/ChevronRight.svelte";
    import LightningBolt from "svelte-material-icons/LightningBoltCircle.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        streaks: number[];
        min: number;
        onClose: () => void;
        onSelect: (min: number) => void;
    }
    let { min = $bindable(), onClose, onSelect, streaks }: Props = $props();
</script>

{#snippet option(n: number)}
    <Row
        borderColour={n === min ? ColourVars.primary : ColourVars.background2}
        onClick={() => onSelect(n)}
        borderWidth={"thin"}
        borderRadius={"md"}
        padding={["lg", "md", "lg", "lg"]}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}>
        <Row gap={"sm"}>
            <Body colour={"primary"} width={"hug"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey(`${n} days`)} />
            </Body>
            <Body width={"hug"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("or more")} />
            </Body>
        </Row>
        <Right size={"1.5rem"} color={ColourVars.textSecondary} />
    </Row>
{/snippet}

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Column gap={"sm"}>
            <LightningBolt color={ColourVars.primary} size={"4rem"} />
            <H2 fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Streak duration")} />
            </H2>
        </Column>
        <Body colour={"textSecondary"}>
            <Translatable
                resourceKey={i18nKey(
                    "Select the minimum streak length in days that a user should have to qualify as a prize winner.",
                )} />
        </Body>

        <Column gap={"md"}>
            {#each streaks as streak}
                {@render option(streak)}
            {/each}
        </Column>
    </Column>
</Sheet>
