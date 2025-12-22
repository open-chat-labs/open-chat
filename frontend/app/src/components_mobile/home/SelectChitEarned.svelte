<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, ColourVars, Column, H2, Row, Sheet } from "component-lib";
    import { chitBands } from "openchat-client";
    import Right from "svelte-material-icons/ChevronRight.svelte";
    import Lightning from "svelte-material-icons/FlashOutline.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        min: number;
        onClose: () => void;
        onSelect: (min: number) => void;
    }

    let { min = $bindable(), onClose, onSelect }: Props = $props();
</script>

{#snippet option(label: string, n: number)}
    <Row
        borderColour={n === min ? ColourVars.primary : ColourVars.background2}
        onClick={() => onSelect(n)}
        borderWidth={"thin"}
        borderRadius={"md"}
        padding={["lg", "md", "lg", "lg"]}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}>
        <Row gap={"sm"}>
            <Body width={"hug"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("at least")} />
            </Body>
            <Body width={"hug"} colour={"primary"} fontWeight={"bold"}>
                {`${label} CHIT`}
            </Body>
        </Row>
        <Right size={"1.5rem"} color={ColourVars.textSecondary} />
    </Row>
{/snippet}

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Column gap={"sm"}>
            <Lightning color={ColourVars.primary} size={"4rem"} />
            <H2 fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Minimum CHIT earned")} />
            </H2>
        </Column>
        <Body colour={"textSecondary"}>
            <Translatable
                resourceKey={i18nKey(
                    "Select the minimum amount of CHIT that a user must have earned in total to qualify as a prize winner.",
                )} />
        </Body>

        <Column gap={"md"}>
            {#each chitBands.entries() as [value, key]}
                {@render option(key, value)}
            {/each}
        </Column>
    </Column>
</Sheet>
