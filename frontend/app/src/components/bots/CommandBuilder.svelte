<script lang="ts">
    import {
        chatPermissionsList,
        communityPermissionsList,
        defaultStringParam,
        messagePermissionsList,
        type BotValidationErrors,
        type ChatPermissions,
        type CommunityPermissions,
        type MessagePermission,
        type SlashCommandParam,
        type SlashCommandSchema,
    } from "openchat-client";
    import Input from "../Input.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import Translatable from "../Translatable.svelte";
    import Checkbox from "../Checkbox.svelte";
    import CommandParamBuilder from "./CommandParamBuilder.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Link from "../Link.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import SummaryButton from "./SummaryButton.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ValidatingInput from "./ValidatingInput.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";

    interface Props {
        errors: BotValidationErrors;
        errorPath: string;
        command: SlashCommandSchema;
        onAddAnother: () => void;
    }

    let { command = $bindable(), onAddAnother, errors, errorPath }: Props = $props();

    let permissionsTab: "chat" | "community" | "message" | "thread" = $state("chat");
    let syncThreadPermissions = $state(true);
    let selectedParam = $state<SlashCommandParam | undefined>(undefined);
    let selectedParamIndex = $state<number | undefined>(undefined);

    function toggleChatPermission(perm: keyof ChatPermissions) {
        if (command.permissions.chatPermissions.includes(perm)) {
            command.permissions.chatPermissions = command.permissions.chatPermissions.filter(
                (p) => p !== perm,
            );
        } else {
            command.permissions.chatPermissions.push(perm);
        }
    }

    function toggleCommunityPermission(perm: keyof CommunityPermissions) {
        if (command.permissions.communityPermissions.includes(perm)) {
            command.permissions.communityPermissions =
                command.permissions.communityPermissions.filter((p) => p !== perm);
        } else {
            command.permissions.communityPermissions.push(perm);
        }
    }

    function toggleMessagePermission(perm: MessagePermission) {
        if (command.permissions.messagePermissions.includes(perm)) {
            command.permissions.messagePermissions = command.permissions.messagePermissions.filter(
                (p) => p !== perm,
            );
        } else {
            command.permissions.messagePermissions.push(perm);
        }
        toggleSync();
    }

    function toggleThreadPermission(perm: MessagePermission) {
        if (command.permissions.threadPermissions.includes(perm)) {
            command.permissions.threadPermissions = command.permissions.threadPermissions.filter(
                (p) => p !== perm,
            );
        } else {
            command.permissions.threadPermissions.push(perm);
        }
    }

    function toggleSync() {
        if (syncThreadPermissions) {
            command.permissions.threadPermissions = command.permissions.messagePermissions;
        }
    }

    function addParameter() {
        command.params.push(defaultStringParam());
        selectedParam = command.params[command.params.length - 1];
        selectedParamIndex = command.params.length - 1;
    }

    function onDeleteParam(param: SlashCommandParam) {
        command.params = command.params.filter((p) => p !== param);
    }

    function onSelectParam(param: SlashCommandParam, index: number) {
        selectedParam = param;
        selectedParamIndex = index;
    }
</script>

{#if selectedParam !== undefined && selectedParamIndex !== undefined}
    <CommandParamBuilder
        errorPath={`${errorPath}_param_${selectedParamIndex}`}
        {errors}
        on:close={() => (selectedParam = undefined)}
        bind:param={selectedParam}
        onAddAnother={addParameter}></CommandParamBuilder>
{/if}

<Overlay>
    <ModalContent on:close>
        <div slot="header">
            <Translatable resourceKey={i18nKey("bots.builder.commandLabel", { name: command.name })}
            ></Translatable>
        </div>
        <div slot="body">
            <section>
                <Legend
                    required
                    label={i18nKey("bots.builder.commandNameLabel")}
                    rules={i18nKey("bots.builder.nameRules")}></Legend>
                <ValidatingInput
                    error={errors.get(`${errorPath}_name`)}
                    minlength={3}
                    maxlength={25}
                    invalid={errors.has(`${errorPath}_name`)}
                    placeholder={i18nKey("bots.builder.commandNamePlaceholder")}
                    bind:value={command.name} />
            </section>

            <section>
                <Legend
                    label={i18nKey("bots.builder.commandDescLabel")}
                    rules={i18nKey("bots.builder.optional")}></Legend>
                <Input
                    minlength={3}
                    maxlength={200}
                    placeholder={i18nKey("bots.builder.commandDescPlaceholder")}
                    bind:value={command.description} />
            </section>

            <section>
                <Legend
                    label={i18nKey("bots.builder.commandPermissionsLabel")}
                    rules={i18nKey("bots.builder.commandPermissionsDesc")}></Legend>
                <div class="tabs">
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="tab"
                        onclick={() => (permissionsTab = "chat")}
                        class:selected={permissionsTab === "chat"}>
                        <Translatable resourceKey={i18nKey("bots.builder.permScopeChat")}
                        ></Translatable>
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="tab"
                        onclick={() => (permissionsTab = "community")}
                        class:selected={permissionsTab === "community"}>
                        <Translatable resourceKey={i18nKey("bots.builder.permScopeCommunity")}
                        ></Translatable>
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="tab"
                        onclick={() => (permissionsTab = "message")}
                        class:selected={permissionsTab === "message"}>
                        <Translatable resourceKey={i18nKey("bots.builder.permScopeMessage")}
                        ></Translatable>
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="tab"
                        onclick={() => (permissionsTab = "thread")}
                        class:selected={permissionsTab === "thread"}>
                        <Translatable resourceKey={i18nKey("bots.builder.permScopeThread")}
                        ></Translatable>
                    </div>
                </div>
                {#if permissionsTab === "chat"}
                    {#each chatPermissionsList as perm}
                        <Checkbox
                            id={`chat_permission_${perm}`}
                            label={i18nKey(`permissions.${perm}`)}
                            checked={command.permissions.chatPermissions.includes(perm)}
                            on:change={() => toggleChatPermission(perm)}
                            align={"start"}>
                        </Checkbox>
                    {/each}
                {:else if permissionsTab === "community"}
                    {#each communityPermissionsList as perm}
                        <Checkbox
                            id={`community_permission_${perm}`}
                            label={i18nKey(`permissions.${perm}`)}
                            checked={command.permissions.communityPermissions.includes(perm)}
                            on:change={() => toggleCommunityPermission(perm)}
                            align={"start"}>
                        </Checkbox>
                    {/each}
                {:else if permissionsTab === "message"}
                    {#each messagePermissionsList as perm}
                        <Checkbox
                            id={`message_permission_${perm}`}
                            label={i18nKey(`permissions.messagePermissions.${perm}`)}
                            checked={command.permissions.messagePermissions.includes(perm)}
                            on:change={() => toggleMessagePermission(perm)}
                            align={"start"}>
                        </Checkbox>
                    {/each}
                {:else if permissionsTab === "thread"}
                    <Checkbox
                        id={`sync_thread_perm`}
                        label={i18nKey("bots.builder.permSameAsMessage")}
                        bind:checked={syncThreadPermissions}
                        on:change={toggleSync}
                        align={"start"}></Checkbox>
                    {#if !syncThreadPermissions}
                        {#each messagePermissionsList as perm}
                            <Checkbox
                                id={`thread_permission_${perm}`}
                                disabled={syncThreadPermissions}
                                label={i18nKey(`permissions.messagePermissions.${perm}`)}
                                checked={command.permissions.threadPermissions.includes(perm)}
                                on:change={() => toggleThreadPermission(perm)}
                                align={"start"}>
                            </Checkbox>
                        {/each}
                    {/if}
                {/if}
            </section>

            <section>
                {#each command.params as param, i}
                    <SummaryButton
                        valid={!errors.has(`${errorPath}_param_${i}`)}
                        onSelect={() => onSelectParam(param, i)}
                        onDelete={() => onDeleteParam(param)}
                        resourceKey={i18nKey("bots.builder.paramLabel", { name: param.name })}
                    ></SummaryButton>
                {/each}
            </section>

            {#if errors.has(`${errorPath}_duplicate_params`)}
                <ErrorMessage>{errors.get(`${errorPath}_duplicate_params`)}</ErrorMessage>
            {/if}

            <Link on:click={addParameter} underline={"never"}>
                <Translatable resourceKey={i18nKey("bots.builder.addParam")}></Translatable>
            </Link>
        </div>

        <div let:onClose slot="footer" class="footer">
            <ButtonGroup>
                <Button secondary on:click={onAddAnother} small={!$mobileWidth} tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("bots.builder.addAnother")} />
                </Button>
                <Button on:click={onClose} small={!$mobileWidth} tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    section {
        margin-bottom: $sp4;
    }

    .tabs {
        display: flex;
        align-items: center;
        @include font(medium, normal, fs-90);
        color: var(--txt-light);
        gap: $sp5;
        border-bottom: 1px solid var(--bd);
        cursor: pointer;
        margin-bottom: $sp4;

        @include mobile() {
            gap: $sp4;
        }

        .tab {
            padding-bottom: 10px;
            margin-bottom: -2px;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 3px solid var(--txt);
            }
        }
    }
</style>
