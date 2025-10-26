<script lang="ts">
    import {
        Body,
        BodySmall,
        ColourVars,
        Container,
        IconButton,
        Subtitle,
        Tooltip,
    } from "component-lib";
    import type {
        ChatPermissions,
        ChatSummary,
        GrantedBotPermissions,
        MessageContext,
        OpenChat,
        PermissionRole,
        ReadonlyMap,
    } from "openchat-client";
    import {
        botState,
        directChatBotsStore,
        isPermitted,
        messagePermissionsForSelectedChatStore,
        selectedChatBotsStore,
        selectedChatSummaryStore,
        selectedCommunityBotsStore,
        threadPermissionsForSelectedChatStore,
    } from "openchat-client";
    import { hasEveryRequiredPermission, random64, type FlattenedCommand } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Logo from "../Logo.svelte";
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
                return $selectedCommunityBotsStore;
            case "direct_chat":
                return $directChatBotsStore;
            default:
                return $selectedChatBotsStore;
        }
    });

    let commands = $derived.by(() => {
        return botState.commands.filter((c) => {
            return (
                restrictByBotIfNecessary(c) &&
                restrictByChatIfNecessary(c) &&
                hasPermissionForCommand(c, installedBots, $selectedChatSummaryStore)
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
    ): boolean {
        const chatRolePermitted =
            chat !== undefined && chat.kind !== "direct_chat"
                ? isPermitted(chat.membership.role, command.defaultRole)
                : true;

        const chatPermitted =
            chat !== undefined && chat.kind !== "direct_chat"
                ? [...command.permissions.chatPermissions].every(
                      (p) =>
                          ["readMessages", "readMembership", "readChatSummary"].includes(p) ||
                          isPermitted(
                              chat.membership.role,
                              chat.permissions[p as keyof ChatPermissions] as PermissionRole,
                          ),
                  )
                : true;

        switch (mode) {
            case "message":
                return (
                    chatRolePermitted &&
                    chatPermitted &&
                    [...command.permissions.messagePermissions].every((p) =>
                        $messagePermissionsForSelectedChatStore.has(p),
                    )
                );
            case "thread":
                return (
                    chatRolePermitted &&
                    chatPermitted &&
                    [...command.permissions.messagePermissions].every((p) =>
                        $threadPermissionsForSelectedChatStore.has(p),
                    )
                );
        }
    }

    function hasPermissionForCommand(
        command: FlattenedCommand,
        installedBots: ReadonlyMap<string, GrantedBotPermissions>,
        chat: ChatSummary | undefined,
    ): boolean {
        const userPermission = userHasPermissionForCommand(command, chat);
        if (command.kind === "external_bot") {
            // for an external bot we also need to know that the bot has been granted all the permissions it requires
            const granted = installedBots.get(command.botId);
            const required = command.permissions;
            return (
                userPermission &&
                granted !== undefined &&
                hasEveryRequiredPermission(required, granted.command)
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
        if (botState.selectedCommand && botState.instanceValid && $selectedChatSummaryStore) {
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

<Container
    background={ColourVars.background1}
    padding={["sm", "lg"]}
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}>
    <Subtitle>
        <Translatable resourceKey={i18nKey("bots.matchingCommands")} />
    </Subtitle>
    <IconButton onclick={onCancel} size={"sm"}>
        {#snippet icon(color)}
            <Close {color} />
        {/snippet}
    </IconButton>
</Container>
<Container maxHeight={"calc(var(--vh, 1vh) * 50)"} direction={"vertical"}>
    {#each commands as command}
        <Container
            padding={"sm"}
            crossAxisAlignment={"center"}
            mainAxisAlignment={"spaceBetween"}
            gap={"sm"}
            onClick={() => selectCommand(command)}>
            <Container maxWidth={"3rem"} maxHeight={"3rem"} width={{ kind: "hug" }}>
                {#if command.kind === "external_bot"}
                    <BotAvatar bot={command} />
                {:else}
                    <Logo />
                {/if}
            </Container>
            <Container direction={"vertical"}>
                <Container crossAxisAlignment={"center"} gap={"sm"}>
                    <Body fontWeight={"bold"} width={{ kind: "hug" }}>
                        /{command.name}
                    </Body>
                    {#each command?.params ?? [] as param}
                        <Tooltip position={"top"} align={"middle"}>
                            <div class="param" class:required={param.required}>
                                <BodySmall>
                                    <Translatable resourceKey={i18nKey(param.name)} />
                                </BodySmall>
                            </div>
                            {#snippet popup()}
                                <Translatable resourceKey={i18nKey(param.description ?? "")} />
                            {/snippet}
                        </Tooltip>
                    {/each}
                </Container>
                <Container>
                    <div class="interface"></div>
                    {#if command.description}
                        <Body ellipsisTruncate width={{ kind: "hug" }} colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey(command.description)} />
                        </Body>
                    {/if}
                </Container>
            </Container>
            <BodySmall width={{ kind: "hug" }} colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey(command.botName)} />
            </BodySmall>
        </Container>
    {/each}
</Container>

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

    .param {
        border: 1px solid var(--primary);
        padding: var(--sp-xxs) var(--sp-sm);
        border-radius: var(--rad-sm);
        line-height: 18px;

        &.required {
            background: var(--gradient-inverted);
            color: var(--text-on-primary);
            border: none;
        }
    }
</style>
