<script lang="ts">
    import Reload from "svelte-material-icons/Reload.svelte";
    import {
        validEndpoint,
        OpenChat,
        validateBot,
        ValidationErrors,
        type ExternalBot,
        type SlashCommandSchema,
        type ValidationErrorMessages,
        userStore,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Input from "../Input.svelte";
    import Legend from "../Legend.svelte";
    import EditableAvatar from "../EditableAvatar.svelte";
    import Translatable from "../Translatable.svelte";
    import ValidatingInput from "./ValidatingInput.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { debouncedDerived } from "../../utils/reactivity.svelte";
    import { getContext } from "svelte";
    import { toastStore } from "../../stores/toast";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import CommandViewer from "./CommandViewer.svelte";
    import SingleUserSelector from "../home/SingleUserSelector.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        valid: boolean;
        schemaLoaded: boolean;
        onUpdate: (bot: ExternalBot) => void;
        candidate: ExternalBot;
        nameDirty: boolean;
        mode: "register" | "update";
    }

    let {
        valid = $bindable(),
        schemaLoaded = $bindable(),
        onUpdate,
        candidate,
        nameDirty,
        mode,
    }: Props = $props();
    let selectedCommand = $state<SlashCommandSchema | undefined>(undefined);
    let selectedCommandIndex = $state<number | undefined>(undefined);
    let debug = $state(false);
    let schemaLoading = $state(false);
    let showNext = $derived(
        selectedCommandIndex !== undefined &&
            selectedCommandIndex < candidate.definition.commands.length - 1,
    );
    let showPrev = $derived(selectedCommandIndex !== undefined && selectedCommandIndex > 0);

    let errors = $derived.by(
        debouncedDerived(
            () => [$state.snapshot(candidate)],
            async () => {
                const errors = validateBot(candidate, mode);
                if (errors.get("bot_name").length == 0 && nameDirty) {
                    errors.addErrors("bot_name", await checkUsername(candidate.name));
                }
                return errors;
            },
            300,
            new ValidationErrors(),
        ),
    );

    function traverseCommand(add: number) {
        if (selectedCommandIndex === undefined) return;

        selectedCommandIndex += add;
        selectedCommand = candidate.definition.commands[selectedCommandIndex];
        if (selectedCommand === undefined) {
            selectedCommandIndex = undefined;
        }
    }

    function nextCommand() {
        traverseCommand(1);
    }

    function previousCommand() {
        traverseCommand(-1);
    }

    function checkUsername(value: string): Promise<ValidationErrorMessages> {
        return client
            .checkUsername(value, true)
            .then((resp) => {
                if (resp === "success") {
                    return [];
                }

                if (resp === "username_taken") {
                    return [i18nKey("bots.builder.errors.duplicateName")];
                }

                return [i18nKey("bots.builder.errors.botNameInvalid")];
            })
            .catch((_) => {
                return [i18nKey("bots.builder.errors.nameCheckError")];
            });
    }

    // TODO we will probably need to come back to this to flesh out edit mode (is the bot dirty etc)
    // let editing = $derived(bot !== undefined);

    $effect(() => {
        const isValid = errors.size === 0 && schemaLoaded;
        if (isValid !== valid) {
            valid = isValid;
        }
    });

    $effect(() => {
        onUpdate($state.snapshot(candidate));
    });

    function botAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        candidate.avatarUrl = ev.detail.url;
    }

    function onSubmit(e: Event) {
        e.preventDefault();
    }

    function onSelectCommand(cmd: SlashCommandSchema, index: number) {
        selectedCommand = cmd;
        selectedCommandIndex = index;
    }

    function endpointChanged() {
        schemaLoaded = false;
        candidate.definition = {
            kind: "bot_definition",
            description: "",
            commands: [],
        };
    }

    function loadDefinition() {
        if (!schemaLoading && validEndpoint(candidate.endpoint)) {
            schemaLoading = true;
            schemaLoaded = false;
            client
                .getBotDefinition(candidate.endpoint)
                .then((resp) => {
                    if (resp.kind === "bot_definition") {
                        candidate.definition = resp;
                        schemaLoaded = true;
                    } else {
                        toastStore.showFailureToast(i18nKey(`${JSON.stringify(resp.error)}`));
                    }
                })
                .finally(() => (schemaLoading = false));
        }
    }
</script>

{#if selectedCommand !== undefined && selectedCommandIndex !== undefined}
    <CommandViewer
        on:close={() => (selectedCommand = undefined)}
        errorPath={`command_${selectedCommandIndex}`}
        onNext={showNext ? nextCommand : undefined}
        onPrevious={showPrev ? previousCommand : undefined}
        {errors}
        command={selectedCommand}></CommandViewer>
{/if}

<form onsubmit={onSubmit} class="bot">
    <Legend label={i18nKey("bots.builder.iconLabel")} />
    <div class="photo">
        <EditableAvatar
            overlayIcon
            size={"medium"}
            image={candidate.avatarUrl}
            on:imageSelected={botAvatarSelected} />
    </div>

    {#if mode === "register"}
        <Legend required label={i18nKey("bots.builder.principalLabel")}></Legend>
        <ValidatingInput
            autofocus
            minlength={3}
            maxlength={100}
            invalid={errors.has("bot_principal")}
            placeholder={i18nKey("bots.builder.principalPlaceholder")}
            error={errors.get("bot_principal")}
            bind:value={candidate.principal}>
        </ValidatingInput>
    {/if}

    <Legend
        required
        label={i18nKey("bots.builder.ownerLabel")}
        rules={i18nKey("bots.builder.ownerRules")}></Legend>
    <SingleUserSelector
        invalid={errors.has("bot_owner")}
        error={errors.get("bot_owner")}
        border={false}
        direction={"up"}
        mentionSelf
        on:userSelected={(ev) => (candidate.ownerId = ev.detail.userId)}
        on:userRemoved={(_) => (candidate.ownerId = "")}
        selectedReceiver={$userStore.get(candidate.ownerId)}
        placeholder={"bots.builder.ownerLabel"}
        autofocus={false} />

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

    <Legend
        label={i18nKey("bots.builder.endpointLabel")}
        required
        rules={i18nKey("bots.builder.endpointRules")}></Legend>
    <div class="endpoint" class:endpoint-error={errors.has("bot_endpoint")}>
        <div class="endpoint-input">
            <ValidatingInput
                minlength={3}
                maxlength={200}
                invalid={errors.has("bot_endpoint")}
                error={errors.get("bot_endpoint")}
                oninput={endpointChanged}
                onenter={loadDefinition}
                placeholder={i18nKey("https://my_openchat_bot")}
                bind:value={candidate.endpoint} />
        </div>
        <div class="icon">
            {#if !errors.has("bot_endpoint")}
                <HoverIcon title={"load definition"} onclick={loadDefinition}>
                    <Reload
                        size={$iconSize}
                        color={schemaLoaded ? "var(--icon-txt)" : "var(--accent)"}></Reload>
                </HoverIcon>
            {/if}
        </div>
    </div>

    {#if schemaLoaded}
        <Legend label={i18nKey("bots.builder.descLabel")}></Legend>
        <Input disabled={true} value={candidate.definition.description} />

        <Legend label={i18nKey("bots.builder.commandsLabel")}></Legend>
        <div class="commands">
            {#each candidate.definition.commands as command, i}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    onclick={() => onSelectCommand(command, i)}
                    class="command"
                    class:command-error={errors.has(`command_${i}`)}>
                    <Translatable
                        resourceKey={i18nKey("bots.builder.commandLabel", { name: command.name })}
                    ></Translatable>
                </div>
            {/each}
        </div>

        <div class="error">
            {#if errors.has("duplicate_commands")}
                <ErrorMessage>
                    <Translatable resourceKey={errors.get("duplicate_commands")[0]}></Translatable
                    ></ErrorMessage>
            {/if}
            {#if errors.has("no_commands")}
                <ErrorMessage>
                    <Translatable resourceKey={errors.get("no_commands")[0]}></Translatable
                    ></ErrorMessage>
            {/if}
        </div>
    {/if}

    {#if debug}
        <pre class="debug">
            {JSON.stringify(candidate, null, 4)}
        </pre>
        <pre>{valid}</pre>
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
        margin: 0 0 $sp3 0;
        display: flex;
        gap: $sp3;
        flex-wrap: wrap;

        .command {
            padding: $sp3 $sp4;
            cursor: pointer;
            align-items: center;
            background-color: var(--button-bg);
            color: var(--button-txt);
            transition:
                background ease-in-out 200ms,
                color ease-in-out 200ms;
            border-radius: var(--button-rd);

            @media (hover: hover) {
                &:hover {
                    background: var(--button-hv);
                    color: var(--button-hv-txt);
                }
            }

            &.command-error {
                background-color: var(--error);
                @media (hover: hover) {
                    &:hover {
                        background: var(--error);
                    }
                }
            }
        }
    }

    .error {
        :global(.error) {
            margin-top: $sp3;
        }
    }

    .endpoint {
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp3;

        &.endpoint-error {
            margin-bottom: 22px;
        }

        :global(.input-wrapper) {
            margin-bottom: 0;
        }

        .endpoint-input {
            flex: 3;
        }

        .icon {
            flex: 0 0 40px;
        }
    }
</style>
