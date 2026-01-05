<script lang="ts">
    import { Body, BodySmall, Column, CommonButton, Row, Sheet } from "component-lib";
    import { type CommandParam, type ResourceKey, type ValidationErrors } from "openchat-client";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        errorPath: string;
        errors: ValidationErrors;
        param: CommandParam;
        onNext?: () => void;
        onPrevious?: () => void;
        onClose: () => void;
    }

    let { param, errors, errorPath, onNext, onPrevious, onClose }: Props = $props();
</script>

{#snippet field(title: string, value: string, error: ResourceKey[])}
    <Column>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)} />
        </Body>

        <BodySmall colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey(value)} />
        </BodySmall>

        {#if error[0]}
            <BodySmall colour={"error"}>
                {error[0]}
            </BodySmall>
        {/if}
    </Column>
{/snippet}

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        {@render field("bots.builder.paramNameLabel", param.name, errors.get(`${errorPath}_name`))}
        {#if param.description}
            {@render field("bots.builder.paramDescLabel", param.description, [])}
        {/if}
        {@render field("bots.builder.paramTypeLabel", param.kind, [])}
        {@render field("bots.builder.required", param.required.toString(), [])}
        {#if param.placeholder}
            {@render field("bots.builder.paramDescLabel", param.placeholder, [])}
        {/if}
        {#if param.kind === "string"}
            <Row>
                {@render field("bots.builder.minLengthLabel", param.minLength.toString(), [])}
                {@render field("bots.builder.maxLengthLabel", param.maxLength.toString(), [])}
            </Row>
        {:else if param.kind === "integer" || param.kind === "decimal"}
            <Row>
                {@render field("bots.builder.minValueLabel", param.minValue.toString(), [])}
                {@render field("bots.builder.maxValueLabel", param.maxValue.toString(), [])}
            </Row>
        {:else if param.kind === "dateTime"}
            {@render field("bots.builder.dateTimeFutureOnly", param.future_only.toString(), [])}
        {/if}

        {#if (param.kind === "string" || param.kind === "integer" || param.kind === "decimal") && param.choices.length > 0}
            {@render field("bots.builder.choices", "bots.builder.choicesInfo", [])}
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
    <Row padding={["lg", "zero"]} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
        <CommonButton size={"small_text"} disabled={onPrevious === undefined} onClick={onPrevious}>
            {#snippet icon(color, size)}
                <ChevronLeft {color} {size}></ChevronLeft>
            {/snippet}
            <Translatable resourceKey={i18nKey("Previous")}></Translatable>
        </CommonButton>
        <CommonButton reverse size={"small_text"} disabled={onNext === undefined} onClick={onNext}>
            {#snippet icon(color, size)}
                <ChevronRight {color} {size}></ChevronRight>
            {/snippet}
            <Translatable resourceKey={i18nKey("Next")}></Translatable>
        </CommonButton>
    </Row>
</Sheet>
