<script lang="ts">
    import {
        chatPermissionsList,
        communityPermissionsList,
        defaultStringParam,
        messagePermissionsList,
        type ChatPermissions,
        type CommunityPermissions,
        type MessagePermission,
        type SlashCommandSchema,
    } from "openchat-client";
    import Input from "../Input.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import Translatable from "../Translatable.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Button from "../Button.svelte";
    import CommandParamBuilder from "./CommandParamBuilder.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";

    interface Props {
        command: SlashCommandSchema;
    }

    let { command = $bindable() }: Props = $props();

    let permissionsTab: "chat" | "community" | "message" | "thread" = $state("chat");
    let syncThreadPermissions = $state(true);

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
    }
</script>

<Overlay>
    <ModalContent on:close>
        <div slot="header">
            <Translatable resourceKey={i18nKey(`Command: /${command.name}`)}></Translatable>
        </div>
        <div slot="body">
            <section>
                <Legend
                    required
                    label={i18nKey("Command name")}
                    rules={i18nKey(
                        "Must be unique and contain alphanumeric characters and underscores only",
                    )}></Legend>
                <Input
                    minlength={3}
                    maxlength={25}
                    placeholder={i18nKey("Enter command name")}
                    bind:value={command.name} />
            </section>

            <section>
                <Legend label={i18nKey("Command description")} rules={i18nKey("optional")}></Legend>
                <Input
                    minlength={3}
                    maxlength={200}
                    placeholder={i18nKey("Enter command descritpion")}
                    bind:value={command.description} />
            </section>

            <section>
                <Legend
                    label={i18nKey("Command permissions")}
                    rules={i18nKey("Describe the permissions that this command requires")}></Legend>
                <div class="tabs">
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="tab"
                        onclick={() => (permissionsTab = "chat")}
                        class:selected={permissionsTab === "chat"}>
                        <Translatable resourceKey={i18nKey("Chat")}></Translatable>
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="tab"
                        onclick={() => (permissionsTab = "community")}
                        class:selected={permissionsTab === "community"}>
                        <Translatable resourceKey={i18nKey("Community")}></Translatable>
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="tab"
                        onclick={() => (permissionsTab = "message")}
                        class:selected={permissionsTab === "message"}>
                        <Translatable resourceKey={i18nKey("Message")}></Translatable>
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="tab"
                        onclick={() => (permissionsTab = "thread")}
                        class:selected={permissionsTab === "thread"}>
                        <Translatable resourceKey={i18nKey("Thread")}></Translatable>
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
                        label={i18nKey("Same as message permissions")}
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
                <Legend
                    label={i18nKey("Command parameters")}
                    rules={i18nKey("Describe any parameters that this command accepts")}></Legend>

                {#each command.params as _, i}
                    <CommandParamBuilder bind:param={command.params[i]}></CommandParamBuilder>
                {/each}

                <Button on:click={addParameter}>
                    <Translatable resourceKey={i18nKey("Add a parameter")}></Translatable>
                </Button>
            </section>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    section {
        margin-bottom: $sp4;
    }

    .title {
        display: flex;
        gap: $sp3;
        align-items: center;
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
