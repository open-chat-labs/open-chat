<script lang="ts">
    import { Body, BodySmall, Column, Form, Input, InputIconButton, Row } from "component-lib";
    import {
        allUsersStore,
        debouncedDerived,
        OpenChat,
        validateBot,
        ValidationErrors,
        validEndpoint,
        type BotDefinition,
        type CommandDefinition,
        type ExternalBot,
        type ValidationErrorMessages,
    } from "openchat-client";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import Reload from "svelte-material-icons/Reload.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import EditableAvatar from "../EditableAvatar.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Markdown from "../home/Markdown.svelte";
    import SingleUserSelector from "../home/SingleUserSelector.svelte";
    import Legend from "../Legend.svelte";
    import Tabs, { type Tab } from "../Tabs.svelte";
    import Translatable from "../Translatable.svelte";
    import BotCommands from "./BotCommands.svelte";
    import BotPermissionViewer from "./BotPermissionViewer.svelte";
    import CommandViewer from "./CommandViewer.svelte";
    import InstallationLocationSelector from "./InstallationLocationSelector.svelte";
    import ValidatingInput from "./ValidatingInput.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        valid: boolean;
        schemaLoaded: boolean;
        candidate: ExternalBot;
        nameDirty: boolean;
        principal: string;
        mode: "register" | "update";
    }

    let {
        valid = $bindable(),
        schemaLoaded = $bindable(),
        principal = $bindable(),
        candidate = $bindable(),
        nameDirty,
        mode,
    }: Props = $props();
    let selectedCommand = $state<CommandDefinition | undefined>(undefined);
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
            () => [$state.snapshot(candidate), principal],
            async () => {
                const errors = validateBot(principal, candidate, mode);
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

    function botAvatarSelected(detail: { url: string; data: Uint8Array }) {
        candidate.avatarUrl = detail.url;
    }

    function onSubmit(e: Event) {
        e.preventDefault();
    }

    function onSelectCommand(cmd: CommandDefinition, index: number) {
        selectedCommand = cmd;
        selectedCommandIndex = index;
    }

    $effect(() => {
        void candidate.endpoint;
        untrack(endpointChanged);
    });

    function endpointChanged() {
        schemaLoaded = false;
        candidate.definition = {
            kind: "bot_definition",
            description: "",
            commands: [],
            autonomousConfig: undefined,
            defaultSubscriptions: undefined,
            dataEncoding: undefined,
            restrictedLocations: undefined,
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
                        toastStore.showFailureToast(i18nKey("Failed to load bot definition"));
                    }
                })
                .finally(() => (schemaLoading = false));
        }
    }

    function getTabs(definition: BotDefinition): Tab[] {
        const tabs: Tab[] = [];
        if (definition.commands.length > 0) {
            tabs.push({ title: i18nKey("bots.builder.commandsLabel"), snippet: commands });
        }
        if (definition.autonomousConfig !== undefined) {
            tabs.push({
                title: i18nKey("bots.builder.autonomousPermissionsLabel"),
                snippet: autonomousPermissions,
            });
        }
        return tabs;
    }
</script>

{#snippet configtabs()}
    {@const tabs = getTabs(candidate.definition)}
    {#if tabs.length === 1}
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={tabs[0].title} />
        </Body>
        {@render tabs[0].snippet()}
    {:else}
        <Tabs {tabs}></Tabs>
    {/if}
{/snippet}

{#snippet commands()}
    {#if candidate.definition.commands.length > 0}
        <BotCommands commands={candidate.definition.commands} onClick={onSelectCommand} />
    {:else}
        <div class="smallprint">
            <Translatable resourceKey={i18nKey("bots.builder.noCommands")}></Translatable>
        </div>
    {/if}
{/snippet}

{#snippet autonomousPermissions()}
    {#if candidate.definition.autonomousConfig !== undefined}
        <BotPermissionViewer
            nested
            permissions={candidate.definition.autonomousConfig.permissions} />
    {:else}
        <div class="smallprint">
            <Translatable resourceKey={i18nKey("bots.builder.noAutonomousConfig")}></Translatable>
        </div>
    {/if}
{/snippet}

{#if selectedCommand !== undefined && selectedCommandIndex !== undefined}
    <CommandViewer
        onClose={() => (selectedCommand = undefined)}
        errorPath={`command_${selectedCommandIndex}`}
        onNext={showNext ? nextCommand : undefined}
        onPrevious={showPrev ? previousCommand : undefined}
        {errors}
        command={selectedCommand}></CommandViewer>
{/if}

<Form {onSubmit}>
    <Column gap={"xl"}>
        <Row mainAxisAlignment={"center"} crossAxisAlignment={"center"}>
            <EditableAvatar
                highlightBorder
                size={"headline"}
                image={candidate.avatarUrl}
                onImageSelected={botAvatarSelected} />
        </Row>

        {#if candidate.registrationStatus.kind === "private" && mode === "register"}
            <InstallationLocationSelector bind:location={candidate.registrationStatus.location} />
        {/if}

        <Input
            autofocus
            minlength={3}
            maxlength={100}
            placeholder={interpolate(
                $_,
                mode === "update"
                    ? i18nKey("bots.builder.editPrincipalPlaceholder")
                    : i18nKey("bots.builder.principalPlaceholder"),
            )}
            error={errors.has("bot_principal")}
            bind:value={principal}>
            {#snippet subtext()}
                <Row gap={"xs"}>
                    <Translatable resourceKey={i18nKey("bots.builder.principalLabel")} />
                    <span>
                        (<Translatable resourceKey={i18nKey("bots.builder.principalRules")} />)
                    </span>
                </Row>
            {/snippet}
        </Input>

        {#if mode === "update"}
            <SingleUserSelector
                mentionSelf
                onUserSelected={(user) => (candidate.ownerId = user.userId)}
                selectedReceiver={$allUsersStore.get(candidate.ownerId)}
                placeholder={"bots.builder.ownerLabel"}>
                {#snippet subtext()}
                    <Translatable resourceKey={i18nKey("bots.builder.ownerRules")} />
                {/snippet}
            </SingleUserSelector>
        {/if}

        {#if mode === "register"}
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
        {/if}

        <Input
            autofocus
            minlength={3}
            maxlength={200}
            placeholder={interpolate($_, i18nKey("https://my_openchat_bot"))}
            error={errors.has("bot_endpoint")}
            bind:value={candidate.endpoint}>
            {#snippet subtext()}
                <Row gap={"xs"}>
                    <Translatable resourceKey={i18nKey("bots.builder.endpointLabel")} />
                    <span>
                        (<Translatable resourceKey={i18nKey("bots.builder.endpointRules")} />)
                    </span>
                </Row>
            {/snippet}

            {#snippet iconButtons()}
                <InputIconButton disabled={errors.has("bot_endpoint")} onClick={loadDefinition}>
                    {#snippet children(color)}
                        <Reload {color}></Reload>
                    {/snippet}
                </InputIconButton>
            {/snippet}
        </Input>

        {#if schemaLoaded}
            <Column gap={"xl"} padding={["zero", "md"]}>
                <Column>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("bots.builder.descLabel")} />
                    </Body>
                    <BodySmall colour={"textSecondary"}>
                        <Markdown inline={false} text={candidate.definition.description} />
                    </BodySmall>
                </Column>

                {@render configtabs()}
            </Column>

            <div class="error">
                {#if errors.has("duplicate_commands")}
                    <ErrorMessage>
                        <Translatable resourceKey={errors.get("duplicate_commands")[0]}
                        ></Translatable
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
    </Column>
</Form>

<style lang="scss">
    .debug {
        @include font(book, normal, fs-80);
    }
    .photo {
        max-width: toRem(100);
        margin-bottom: $sp3;
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

    .smallprint {
        @include font(light, normal, fs-80);
        color: var(--txt-light);
    }

    .desc {
        @include input();
        max-height: 180px;
        overflow: auto;
        margin-bottom: $sp3;
    }
</style>
