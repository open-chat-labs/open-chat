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
    import type { MessageContext, OpenChat } from "@client";
    import {
        botCommandFailure,
        botState,
        commandsAvailable,
        directChatBotsStore,
        messagePermissionsForSelectedChatStore,
        selectedChatBotsStore,
        selectedChatSummaryStore,
        selectedCommunityBotsStore,
        threadPermissionsForSelectedChatStore,
    } from "@client";
    import { loadDateParser, random64, type FlattenedCommand } from "@shared";
    import { getContext, onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import { dateAwareSelection } from "@src/utils/commandSelection";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Logo from "@shared_components/Logo.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
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

    // what the reader may run here (`commandsAvailable`, shared with the new web UI)
    let commands = $derived(
        commandsAvailable(botState.commands, {
            chatKind: messageContext.chatId.kind,
            chat: $selectedChatSummaryStore,
            directBotId: selectedBotId,
            permitted:
                mode === "thread"
                    ? $threadPermissionsForSelectedChatStore
                    : $messagePermissionsForSelectedChatStore,
            installedBots,
        }),
    );

    const selection = dateAwareSelection((command: FlattenedCommand | undefined) => {
        botState.setSelectedCommand(messageContext, commands, command);
        sendCommandIfValid();
    });

    function selectCommand(command = commands[botState.focusedCommandIndex]) {
        selection.select(command);
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
                    const failure = botCommandFailure(result);
                    if (failure !== undefined) toastStore.showFailureToast(failure);
                });
            onCommandSent();
        }
    }

    onMount(() => {
        // on its way by the time a command is selected
        loadDateParser();
        botState.error = undefined;
        document.addEventListener("keydown", onkeydown);
        return () => {
            selection.stop();
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
                    selectCommand();
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
    background={ColourVars.surface1}
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
            <Container maxWidth={"3rem"} maxHeight={"3rem"} width={"hug"}>
                {#if command.kind === "external_bot"}
                    <BotAvatar bot={command} />
                {:else}
                    <Logo />
                {/if}
            </Container>
            <Container direction={"vertical"}>
                <Container crossAxisAlignment={"center"} gap={"sm"}>
                    <Body fontWeight={"bold"} width={"hug"}>
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
                        <Body ellipsisTruncate width={"hug"} colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey(command.description)} />
                        </Body>
                    {/if}
                </Container>
            </Container>
            <BodySmall width={"hug"} colour={"textSecondary"}>
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
