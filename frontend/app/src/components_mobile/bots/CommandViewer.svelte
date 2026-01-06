<script lang="ts">
    import { Body, BodySmall, Chip, Column, Row } from "component-lib";
    import { type CommandDefinition, type CommandParam } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import SlidingPageContent from "../home/SlidingPageContent.svelte";
    import Translatable from "../Translatable.svelte";
    import BotPermissionViewer from "./BotPermissionViewer.svelte";
    import CommandParameterViewer from "./CommandParameterViewer.svelte";

    interface Props {
        command: CommandDefinition;
        onClose: () => void;
    }

    let { command, onClose }: Props = $props();

    let selectedParam = $state<CommandParam | undefined>(undefined);

    function onSelectParam(param: CommandParam) {
        selectedParam = param;
    }
</script>

{#if selectedParam !== undefined}
    <CommandParameterViewer onClose={() => (selectedParam = undefined)} param={selectedParam}
    ></CommandParameterViewer>
{/if}

{#snippet field(title: string, value: string)}
    <Column>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)} />
        </Body>

        <BodySmall colour={"textSecondary"}>
            {value}
        </BodySmall>
    </Column>
{/snippet}

<SlidingPageContent
    title={i18nKey("Command details")}
    subtitle={i18nKey(`/${command.name}`)}
    onBack={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        {#if command.description}
            {@render field("bots.builder.commandDescLabel", command.description ?? "")}
        {/if}

        {#if command.placeholder}
            {@render field("bots.builder.commandPlaceholderLabel", command.placeholder ?? "")}
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
                    {#each command.params as param}
                        <Chip mode={"filter"} onClick={() => onSelectParam(param)}>
                            <Translatable resourceKey={i18nKey(param.name)}></Translatable>
                        </Chip>
                    {/each}
                </Row>
            </Column>
        {/if}
    </Column>
</SlidingPageContent>
