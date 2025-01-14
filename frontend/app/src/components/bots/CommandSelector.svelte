<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { hasEveryRequiredPermission, type FlattenedCommand } from "openchat-shared";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import {
        commands as commandsStore,
        createBotInstance,
        error,
        focusedCommandIndex,
        focusNextCommand,
        focusPreviousCommand,
        instanceValid,
        selectedCommand,
        setSelectedCommand,
        showingBuilder,
    } from "./botState";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { getContext, onMount } from "svelte";
    import Logo from "../Logo.svelte";
    import type {
        ChatSummary,
        CommunitySummary,
        MessageContext,
        OpenChat,
        PermissionRole,
        SlashCommandPermissions,
    } from "openchat-client";
    import {
        currentCommunityBots,
        currentChatBots,
        isPermitted,
        selectedChatStore,
        selectedCommunity,
        selectedMessageContext,
    } from "openchat-client";
    import {
        messagePermissionsForSelectedChat,
        threadPermissionsForSelectedChat,
    } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import BotAvatar from "./BotAvatar.svelte";

    interface Props {
        onCancel: () => void;
        onNoMatches: () => void;
        onCommandSent: () => void;
        mode: "thread" | "message";
        messageContext: MessageContext;
    }

    const client = getContext<OpenChat>("client");

    let { onCancel, onNoMatches, onCommandSent, mode, messageContext }: Props = $props();

    let installedBots = $derived(
        messageContext.chatId.kind === "channel" ? $currentCommunityBots : $currentChatBots,
    );

    let commands = $derived.by(() =>
        $commandsStore.filter((c) => {
            return hasPermissionForCommand(
                c,
                installedBots,
                $selectedChatStore,
                $selectedCommunity,
            );
        }),
    );

    function userHasPermissionForCommand(
        command: FlattenedCommand,
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
    ): boolean {
        const chatPermitted =
            chat !== undefined && chat.kind !== "direct_chat"
                ? [...command.permissions.chatPermissions].every((p) =>
                      isPermitted(chat.membership.role, chat.permissions[p] as PermissionRole),
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
                    chatPermitted &&
                    communityPermitted &&
                    [...command.permissions.messagePermissions].every((p) =>
                        $messagePermissionsForSelectedChat.has(p),
                    )
                );
            case "thread":
                return (
                    chatPermitted &&
                    communityPermitted &&
                    [...command.permissions.messagePermissions].every((p) =>
                        $threadPermissionsForSelectedChat.has(p),
                    )
                );
        }
    }

    function hasPermissionForCommand(
        command: FlattenedCommand,
        installedBots: Map<string, SlashCommandPermissions>,
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
        setSelectedCommand(commands, command);
        sendCommandIfValid();
    }

    function sendCommandIfValid() {
        if ($selectedCommand && $instanceValid && $selectedChatStore && $selectedMessageContext) {
            client
                .executeBotCommand(
                    $selectedChatStore,
                    $selectedMessageContext.threadRootMessageIndex,
                    createBotInstance($selectedCommand, messageContext),
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("bots.failed"));
                    }
                });
            onCommandSent();
        }
    }

    onMount(() => {
        error.set(undefined);
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
                focusPreviousCommand();
                break;
            case "ArrowUp":
                focusNextCommand();
                break;
            case "Enter":
                if (!$showingBuilder) {
                    setSelectedCommand(commands);
                    sendCommandIfValid();
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
            class:selected={$focusedCommandIndex === i}
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
                        <TooltipWrapper position={"top"} align={"middle"}>
                            <div slot="target" class="param" class:required={param.required}>
                                <Translatable resourceKey={i18nKey(param.name)} />
                            </div>
                            <div let:position let:align slot="tooltip">
                                <TooltipPopup {align} {position}>
                                    <Translatable resourceKey={i18nKey(param.description ?? "")} />
                                </TooltipPopup>
                            </div>
                        </TooltipWrapper>
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

{#if $error !== undefined}
    <div class="command-error">
        <ErrorMessage>
            {$error}
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

            .icon {
                flex: 0 0 $size;
                width: $size;
                height: $size;
                aspect-ratio: 1 / 1;
                background-position: center;
                background-repeat: no-repeat;
                background-size: cover;
                border-radius: $sp2;
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
