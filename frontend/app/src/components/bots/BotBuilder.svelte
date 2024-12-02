<script lang="ts">
    import {
        emptyBotInstance,
        validateBot,
        type CandidateExternalBot,
        type ExternalBot,
        type SlashCommandPermissions,
        type SlashCommandSchema,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Input from "../Input.svelte";
    import Legend from "../Legend.svelte";
    import EditableAvatar from "../EditableAvatar.svelte";
    import Translatable from "../Translatable.svelte";
    import Link from "../Link.svelte";
    import CommandBuilder from "./CommandBuilder.svelte";
    import SummaryButton from "./SummaryButton.svelte";
    import ValidatingInput from "./ValidatingInput.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";

    interface Props {
        valid: boolean;
        bot: ExternalBot | undefined;
    }

    let { valid = $bindable(), bot }: Props = $props();

    let candidate = $state<CandidateExternalBot>(emptyBotInstance(bot));
    let selectedCommand = $state<SlashCommandSchema | undefined>(undefined);
    let selectedCommandIndex = $state<number | undefined>(undefined);
    let debug = $state(false);
    let errors = $derived(validateBot(candidate));
    // TODO we will probably need to come back to this to flesh out edit mode (is the bot dirty etc)
    // let editing = $derived(bot !== undefined);

    $effect(() => {
        const isValid = errors.size === 0;
        if (isValid !== valid) {
            valid = isValid;
        }
    });

    function botAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        candidate.icon = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }

    function onSubmit(e: Event) {
        e.preventDefault();
    }

    function addCommand() {
        candidate.commands.push(emptySlashCommand());
        selectedCommand = candidate.commands[candidate.commands.length - 1];
        selectedCommandIndex = candidate.commands.length - 1;
    }

    function onDeleteCommand(cmd: SlashCommandSchema) {
        candidate.commands = candidate.commands.filter((c) => c !== cmd);
    }

    function onSelectCommand(cmd: SlashCommandSchema, index: number) {
        selectedCommand = cmd;
        selectedCommandIndex = index;
    }

    function emptySlashCommand(): SlashCommandSchema {
        return {
            name: "",
            description: "",
            params: [],
            permissions: emptyPermissions(),
        };
    }

    function emptyPermissions(): SlashCommandPermissions {
        return {
            chatPermissions: [],
            communityPermissions: [],
            messagePermissions: [],
            threadPermissions: [],
        };
    }
</script>

{#if selectedCommand !== undefined && selectedCommandIndex !== undefined}
    <CommandBuilder
        onAddAnother={addCommand}
        on:close={() => (selectedCommand = undefined)}
        errorPath={`command_${selectedCommandIndex}`}
        {errors}
        bind:command={selectedCommand}></CommandBuilder>
{/if}

<form onsubmit={onSubmit} class="bot">
    <Legend label={i18nKey("bots.builder.iconLabel")} />
    <div class="photo">
        <EditableAvatar
            overlayIcon
            size={"medium"}
            image={candidate.icon?.blobUrl}
            on:imageSelected={botAvatarSelected} />
    </div>

    <Legend
        required
        label={i18nKey("bots.builder.nameLabel")}
        rules={i18nKey("bots.builder.nameRules")}></Legend>
    <ValidatingInput
        minlength={3}
        maxlength={25}
        invalid={errors.has("bot_name")}
        placeholder={i18nKey("bots.builder.namePlaceholder")}
        error={errors.get("bot_name")}
        bind:value={candidate.name}>
    </ValidatingInput>

    <Legend label={i18nKey("bots.builder.descLabel")} rules={i18nKey("bots.builder.optional")}
    ></Legend>
    <Input
        minlength={3}
        maxlength={200}
        placeholder={i18nKey("bots.builder.descPlaceholder")}
        bind:value={candidate.description} />

    <Legend
        label={i18nKey("bots.builder.endpointLabel")}
        required
        rules={i18nKey("bots.builder.endpointRules")}></Legend>
    <ValidatingInput
        minlength={3}
        maxlength={200}
        invalid={errors.has("bot_endpoint")}
        error={errors.get("bot_endpoint")}
        placeholder={i18nKey("https://my_openchat_bot")}
        bind:value={candidate.endpoint} />

    <div class="commands">
        <div class="commands">
            {#each candidate.commands as command, i}
                <SummaryButton
                    valid={!errors.has(`command_${i}`)}
                    onSelect={() => onSelectCommand(command, i)}
                    onDelete={() => onDeleteCommand(command)}
                    resourceKey={i18nKey("bots.builder.commandLabel", { name: command.name })}
                ></SummaryButton>
            {/each}
        </div>

        {#if errors.has("duplicate_commands")}
            <ErrorMessage>{errors.get("duplicate_commands")}</ErrorMessage>
        {/if}

        <Link on:click={addCommand} underline="never">
            <Translatable resourceKey={i18nKey("bots.builder.addCommand")} />
        </Link>
    </div>

    {#if debug}
        <pre class="debug">
        {JSON.stringify(candidate, null, 4)}
    </pre>
    {/if}
</form>

<style lang="scss">
    .debug {
        @include font(book, normal, fs-80);
    }
    .photo {
        max-width: toRem(100);
        margin-bottom: $sp3;
    }
    .commands {
        margin: $sp4 0 $sp3 0;
    }
</style>
