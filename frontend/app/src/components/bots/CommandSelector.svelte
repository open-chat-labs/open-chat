<script lang="ts">
    import type {
        ChatPermissions,
        ChatSummary,
        CommunitySummary,
        ExternalBotPermissions,
        MessageContext,
        OpenChat,
        PermissionRole,
        ReadonlyMap,
    } from "openchat-client";
    import { app, botState, isPermitted } from "openchat-client";
    import { hasEveryRequiredPermission, random64, type FlattenedCommand } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import ErrorMessage from "../ErrorMessage.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Logo from "../Logo.svelte";
    import Tooltip from "../tooltip/Tooltip.svelte";
    import Translatable from "../Translatable.svelte";
    import BotAvatar from "./BotAvatar.svelte";

    interface Props {
        selectedBotId?: string; // this will be the botId if we are in a direct chat with a bot
        onCancel: () => void;
        onNoMatches: () => void;
        onCommandSent: () => void;
        mode: "thread" | "message";
        messageContext: MessageContext;
    }

    const client = getContext<OpenChat>("client");

    let { onCancel, onNoMatches, onCommandSent, mode, messageContext, selectedBotId }: Props =
        $props();

    let installedBots = $derived.by(() => {
        switch (messageContext.chatId.kind) {
            case "channel":
                return app.selectedCommunity.bots;
            case "direct_chat":
                return app.directChatBots;
            default:
                return app.selectedChat.bots;
        }
    });

    let commands = $derived.by(() => {
        return botState.commands.filter((c) => {
            return (
                restrictByBotIfNecessary(c) &&
                restrictByChatIfNecessary(c) &&
                hasPermissionForCommand(
                    c,
                    installedBots,
                    app.selectedChatSummary,
                    app.selectedCommunitySummary,
                )
            );
        });
    });

    function restrictByBotIfNecessary(command: FlattenedCommand): boolean {
        return (
            selectedBotId === undefined ||
            (command.kind === "external_bot" && command.botId === selectedBotId) ||
            (command.kind === "internal_bot" && command.directBotDisabled === false)
        );
    }

    function restrictByChatIfNecessary(command: FlattenedCommand): boolean {
        return !(
            messageContext.chatId.kind === "direct_chat" && command.directChatsDisabled === true
        );
    }

    function userHasPermissionForCommand(
        command: FlattenedCommand,
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
    ): boolean {
        const chatRolePermitted =
            chat !== undefined && chat.kind !== "direct_chat"
                ? isPermitted(chat.membership.role, command.defaultRole)
                : true;

        const communityRolePermitted =
            community !== undefined
                ? isPermitted(community.membership.role, command.defaultRole)
                : true;

        const chatPermitted =
            chat !== undefined && chat.kind !== "direct_chat"
                ? [...command.permissions.chatPermissions].every(
                      (p) =>
                          ["readMessages", "readMembership", "readChatDetails"].includes(p) ||
                          isPermitted(
                              chat.membership.role,
                              chat.permissions[p as keyof ChatPermissions] as PermissionRole,
                          ),
                  )
                : true;

        const communityPermitted =
            community !== undefined
                ? [...command.permissions.communityPermissions].every((p) =>
                      isPermitted(
                          community.membership.role,
                          community.permissions[p] as PermissionRole,
                      ),
                  )
                : true;

        switch (mode) {
            case "message":
                return (
                    chatRolePermitted &&
                    communityRolePermitted &&
                    chatPermitted &&
                    communityPermitted &&
                    [...command.permissions.messagePermissions].every((p) =>
                        app.messagePermissionsForSelectedChat.has(p),
                    )
                );
            case "thread":
                return (
                    chatRolePermitted &&
                    communityRolePermitted &&
                    chatPermitted &&
                    communityPermitted &&
                    [...command.permissions.messagePermissions].every((p) =>
                        app.threadPermissionsForSelectedChat.has(p),
                    )
                );
        }
    }

    function hasPermissionForCommand(
        command: FlattenedCommand,
        installedBots: ReadonlyMap<string, ExternalBotPermissions>,
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
    ): boolean {
        const userPermission = userHasPermissionForCommand(command, chat, community);
        if (command.kind === "external_bot") {
            // for an external bot we also need to know that the bot has been granted all the permissions it requires
            const granted = installedBots.get(command.botId);
            const required = command.permissions;
            return (
                userPermission &&
                granted !== undefined &&
                hasEveryRequiredPermission(required, granted)
            );
        } else {
            return userPermission;
        }
    }

    function selectCommand(command: FlattenedCommand) {
        botState.setSelectedCommand(messageContext, commands, command);
        sendCommandIfValid();
    }

    function sendCommandIfValid() {
        if (botState.selectedCommand && botState.instanceValid && app.selectedChatSummary) {
            client
                .executeBotCommand(
                    {
                        kind: "chat_scope",
                        chatId: messageContext.chatId,
                        threadRootMessageIndex: messageContext.threadRootMessageIndex,
                        messageId: random64(),
                    },
                    botState.createBotInstance(botState.selectedCommand),
                )
                .then((result) => {
                    if (result === "failure") {
                        toastStore.showFailureToast(i18nKey("bots.failed"));
                    } else if (result === "too_many_requests") {
                        toastStore.showFailureToast(i18nKey("bots.tooManyRequests"));
                    }
                });
            onCommandSent();
        }
    }

    onMount(() => {
        botState.error = undefined;
        document.addEventListener("keydown", onkeydown);
        return () => {
            document.removeEventListener("keydown", onkeydown);
        };
    });

    $effect(() => {
        if (commands.length === 0) {
            onNoMatches();
        }
    });

    function onkeydown(ev: KeyboardEvent): void {
        switch (ev.key) {
            case "ArrowDown":
                botState.focusPreviousCommand();
                break;
            case "ArrowUp":
                botState.focusNextCommand();
                break;
            case "Enter":
                if (!botState.showingBuilder) {
                    botState.setSelectedCommand(messageContext, commands);
                    sendCommandIfValid();
                    ev.preventDefault();
                }
                break;
            case "Escape":
                onCancel();
                break;
        }
    }
</script>

<div class="command-header">
    <h4>
        <Translatable resourceKey={i18nKey("bots.matchingCommands")} />
    </h4>
    <HoverIcon onclick={onCancel}>
        <Close size={"1em"} color={"var(--icon-txt)"} />
    </HoverIcon>
</div>
<div class="command-list">
    {#each commands as command, i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="command"
            class:selected={botState.focusedCommandIndex === i}
            onclick={() => selectCommand(command)}>
            {#if command.kind === "external_bot"}
                <BotAvatar bot={command} />
            {:else}
                <Logo />
            {/if}
            <div class="details">
                <div class="interface">
                    <div class="command-name">
                        /{command.name}
                    </div>
                    {#each command?.params ?? [] as param}
                        <Tooltip position={"top"} align={"middle"}>
                            <div class="param" class:required={param.required}>
                                <Translatable resourceKey={i18nKey(param.name)} />
                            </div>
                            {#snippet popupTemplate()}
                                <Translatable resourceKey={i18nKey(param.description ?? "")} />
                            {/snippet}
                        </Tooltip>
                    {/each}
                </div>
                {#if command.description}
                    <div class="desc">
                        <Translatable resourceKey={i18nKey(command.description)} />
                    </div>
                {/if}
            </div>
            <div class="bot-name">
                <Translatable resourceKey={i18nKey(command.botName)} />
            </div>
        </div>
    {/each}
</div>

{#if botState.error !== undefined}
    <div class="command-error">
        <ErrorMessage>
            {botState.error}
        </ErrorMessage>
    </div>
{/if}

<style lang="scss">
    .command-error {
        :global(h4) {
            margin-bottom: 0;
        }
    }

    .command-header {
        background-color: var(--modal-bg);
        padding: $sp3 $sp4;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--bd);
        border-top: 1px solid var(--bd);
    }

    .command-list {
        position: relative;
        max-height: calc(var(--vh, 1vh) * 50);
        overflow: auto;
        background-color: var(--modal-bg);

        .command {
            $size: 48px;
            display: flex;
            align-items: center;
            gap: $sp3;
            border-bottom: 1px solid var(--bd);
            padding: $sp3;
            cursor: pointer;

            :global(.logo) {
                width: $size;
                height: $size;
            }

            &.selected {
                background-color: var(--chatSummary-bg-selected);
            }

            .bot-name {
                @include font(light, normal, fs-80);
                color: var(--txt-light);
            }

            .details {
                flex: auto;
                display: flex;
                flex-direction: column;

                .interface {
                    display: flex;
                    align-items: center;
                    gap: $sp3;

                    .command-name {
                        @include font(bold, normal, fs-100);
                    }

                    .param {
                        @include font(light, normal, fs-80);
                        border: 1px solid var(--button-bg);
                        padding: $sp1 $sp3;
                        border-radius: $sp2;
                        line-height: 18px;

                        &.required {
                            background-color: var(--button-bg);
                            color: var(--button-txt);
                            border: none;
                        }
                    }
                }

                .desc {
                    @include font(light, normal, fs-80);
                }
            }
        }
    }
</style>
