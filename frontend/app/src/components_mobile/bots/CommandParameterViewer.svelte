<script lang="ts">
    import { Body, BodySmall, Column, Row, Sheet } from "component-lib";
    import { type CommandParam } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        param: CommandParam;
        onClose: () => void;
    }

    let { param, onClose }: Props = $props();
</script>

{#snippet field(title: string, value: string)}
    <Column>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)} />
        </Body>

        <BodySmall colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey(value)} />
        </BodySmall>
    </Column>
{/snippet}

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        {@render field("bots.builder.paramNameLabel", param.name)}
        {#if param.description}
            {@render field("bots.builder.paramDescLabel", param.description)}
        {/if}
        {@render field("bots.builder.paramTypeLabel", param.kind)}
        {@render field("bots.builder.required", param.required.toString())}
        {#if param.placeholder}
            {@render field("bots.builder.paramDescLabel", param.placeholder)}
        {/if}
        {#if param.kind === "string"}
            <Row>
                {@render field("bots.builder.minLengthLabel", param.minLength.toString())}
                {@render field("bots.builder.maxLengthLabel", param.maxLength.toString())}
            </Row>
        {:else if param.kind === "integer" || param.kind === "decimal"}
            <Row>
                {@render field("bots.builder.minValueLabel", param.minValue.toString())}
                {@render field("bots.builder.maxValueLabel", param.maxValue.toString())}
            </Row>
        {:else if param.kind === "dateTime"}
            {@render field("bots.builder.dateTimeFutureOnly", param.future_only.toString())}
        {/if}

        {#if (param.kind === "string" || param.kind === "integer" || param.kind === "decimal") && param.choices.length > 0}
            {@render field("bots.builder.choices", "bots.builder.choicesInfo")}
            <Column>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Possible values")} />
                </Body>

                {#each param.choices as choice}
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey(choice.name)} />
                    </BodySmall>
                {/each}
            </Column>
        {/if}
    </Column>
</Sheet>
