<script lang="ts">
    import { Body, BodySmall, Chip, Column, CommonButton, Row, Sheet } from "component-lib";
    import {
        type CommandDefinition,
        type CommandParam,
        type ResourceKey,
        ValidationErrors,
    } from "openchat-client";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";
    import BotPermissionViewer from "./BotPermissionViewer.svelte";
    import CommandParameterViewer from "./CommandParameterViewer.svelte";

    interface Props {
        errors: ValidationErrors;
        errorPath: string;
        command: CommandDefinition;
        onNext?: () => void;
        onPrevious?: () => void;
        onClose: () => void;
    }

    let { command, errors, errorPath, onNext, onPrevious, onClose }: Props = $props();

    let selectedParam = $state<CommandParam | undefined>(undefined);
    let selectedParamIndex = $state<number | undefined>(undefined);
    let showNext = $derived(
        selectedParamIndex !== undefined && selectedParamIndex < command.params.length - 1,
    );
    let showPrev = $derived(selectedParamIndex !== undefined && selectedParamIndex > 0);

    function onSelectParam(param: CommandParam, index: number) {
        selectedParam = param;
        selectedParamIndex = index;
    }

    function traverseParams(add: number) {
        if (selectedParamIndex === undefined) return;

        selectedParamIndex += add;
        selectedParam = command.params[selectedParamIndex];
        if (selectedParam === undefined) {
            selectedParamIndex = undefined;
        }
    }

    function nextParam() {
        traverseParams(1);
    }

    function previousParam() {
        traverseParams(-1);
    }
</script>

{#if selectedParam !== undefined && selectedParamIndex !== undefined}
    <CommandParameterViewer
        errorPath={`${errorPath}_param_${selectedParamIndex}`}
        {errors}
        onNext={showNext ? nextParam : undefined}
        onPrevious={showPrev ? previousParam : undefined}
        onClose={() => (selectedParam = undefined)}
        param={selectedParam}></CommandParameterViewer>
{/if}

{#snippet field(title: string, value: string, error: ResourceKey[])}
    <Column>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)} />
        </Body>

        <BodySmall colour={"textSecondary"}>
            {value}
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
        {@render field(
            "bots.builder.commandNameLabel",
            `/${command.name}`,
            errors.get(`${errorPath}_name`),
        )}

        {#if command.description}
            {@render field("bots.builder.commandDescLabel", command.description ?? "", [])}
        {/if}

        {#if command.placeholder}
            {@render field("bots.builder.commandPlaceholderLabel", command.placeholder ?? "", [])}
        {/if}

        <Column gap={"sm"}>
            <BotPermissionViewer
                title={i18nKey("bots.builder.commandPermissionsLabel")}
                permissions={command.permissions} />
        </Column>

        {#if command.params.length > 0}
            <Column gap={"sm"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("bots.builder.paramsLabel")} />
                </Body>
                <Row crossAxisAlignment={"center"} wrap gap={"sm"}>
                    {#each command.params as param, i}
                        <Chip mode={"filter"} onClick={() => onSelectParam(param, i)}>
                            <Translatable resourceKey={i18nKey(param.name)}></Translatable>
                        </Chip>
                    {/each}
                </Row>
            </Column>
        {/if}

        {#if errors.has(`${errorPath}_duplicate_params`)}
            <ErrorMessage>{errors.get(`${errorPath}_duplicate_params`)}</ErrorMessage>
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
