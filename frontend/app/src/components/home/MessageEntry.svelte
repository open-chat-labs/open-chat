<script lang="ts">
    import RichTextEditor from "@shared_components/RichTextEditor.svelte";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import type {
        AttachmentContent,
        BotActionScope,
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        ExternalBot,
        Message,
        MessageAction,
        MessageContext,
        MultiUserChat,
        OpenChat,
        SelectedEmoji,
        User,
    } from "openchat-client";
    import {
        allUsersStore,
        anonUserStore,
        botState,
        chatIdentifiersEqual,
        currentUserIdStore,
        directMessageCommandInstance,
        iconSize,
        localUpdates,
        messageContextsEqual,
        random64,
        screenWidth,
        ScreenWidth,
        selectedChatMembersStore,
        selectedCommunitySummaryStore,
        selectedCommunityUserGroupsStore,
        throttleDeadline,
    } from "openchat-client";
    import { getContext, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Alert from "svelte-material-icons/Alert.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ContentSaveEditOutline from "svelte-material-icons/ContentSaveMoveOutline.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { enterSend } from "../../stores/settings";
    import { snowing } from "../../stores/snow";
    import AlertBoxModal from "../AlertBoxModal.svelte";
    import CommandBuilder from "../bots/CommandInstanceBuilder.svelte";
    import CommandSelector from "../bots/CommandSelector.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Progress from "../Progress.svelte";
    import Translatable from "../Translatable.svelte";
    import AudioAttacher from "./AudioAttacher.svelte";
    import EmojiAutocompleter from "./EmojiAutocompleter.svelte";
    import MentionPicker from "./MentionPicker.svelte";
    import MessageActions from "./MessageActions.svelte";
    import PreviewFooter from "./PreviewFooter.svelte";
    import ThrottleCountdown from "./ThrottleCountdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: ChatSummary;
        blocked: boolean;
        preview: boolean;
        lapsed: boolean;
        messageAction?: MessageAction;
        joining: MultiUserChat | undefined;
        attachment: AttachmentContent | undefined;
        editingEvent: EventWrapper<Message> | undefined;
        replyingTo: EnhancedReplyContext | undefined;
        textContent: string | undefined;
        mode?: "thread" | "message";
        externalContent: boolean;
        messageContext: MessageContext;
        onFileSelected: (content: AttachmentContent) => void;
        onPaste: (e: ClipboardEvent) => void;
        onSetTextContent: (txt?: string) => void;
        onStartTyping: () => void;
        onStopTyping: () => void;
        onCancelEdit: () => void;
        onSendMessage: (args: [string | undefined, User[], boolean]) => void;
        onClearAttachment: () => void;
        onTokenTransfer: (args: { ledger?: string; amount?: bigint }) => void;
        onCreatePrizeMessage?: () => void;
        onCreateP2PSwapMessage: () => void;
        onCreatePoll: () => void;
        onAttachGif: (search: string) => void;
        onMakeMeme: () => void;
    }

    let {
        chat,
        blocked,
        preview,
        lapsed,
        messageAction = $bindable(undefined),
        joining,
        attachment,
        editingEvent,
        replyingTo,
        textContent,
        mode = "message",
        externalContent,
        messageContext,
        onFileSelected,
        onPaste,
        onSetTextContent,
        onStartTyping,
        onStopTyping,
        onCancelEdit,
        onSendMessage,
        onClearAttachment,
        onTokenTransfer,
        onCreatePrizeMessage,
        onCreateP2PSwapMessage,
        onCreatePoll,
        onAttachGif,
        onMakeMeme,
    }: Props = $props();

    const USER_TYPING_EVENT_MIN_INTERVAL_MS = 1000; // 1 second
    const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

    let editor = $state<RichTextEditor>();
    let editorEmpty = $state(true);

    // let inp: HTMLDivElement | undefined = $state();
    let audioMimeType = client.audioRecordingMimeType();
    let recording: boolean = $state(false);
    let percentRecorded: number = $state(0);
    let previousEditingEvent: EventWrapper<Message> | undefined = $state();
    let lastTypingUpdate: number = 0;
    let typingTimer: number | undefined = undefined;
    let audioSupported: boolean = $state("mediaDevices" in navigator);
    let showCommandSelector: boolean = $state(false);
    let messageEntryHeight: number = $state(0);
    let messageActions: MessageActions | undefined = $state();
    let previousChatId = $state(chat.id);
    let containsMarkdown = $state(false);
    let showDirectBotChatWarning = $state(false);
    let commandSent = false;

    // Update this to force a new textbox instance to be created
    let textboxId = $state(Symbol());

    export function insertEmoji(emoji: SelectedEmoji) {
        editor?.insertEmoji(emoji);
    }

    function onInput() {
        const inputContent = editor?.getMarkdown() ?? "";
        onSetTextContent(inputContent.trim().length === 0 ? undefined : inputContent);
        triggerCommandSelector(inputContent);
        triggerTypingTimer();
        containsMarkdown = detectMarkdown(inputContent);
    }

    function triggerCommandSelector(inputContent: string | null): void {
        const commandMatch = inputContent?.match(/^\/.*/);
        if (commandMatch) {
            showCommandSelector = true;
            botState.prefix = commandMatch[0];
        } else {
            showCommandSelector = false;
            botState.cancel();
        }
    }

    function cancelCommandSelector(sent: boolean) {
        commandSent = sent;
        showCommandSelector = false;
        botState.cancel();
        if (sent) {
            onSetTextContent();
        }
    }

    function triggerTypingTimer() {
        requestAnimationFrame(() => {
            const now = Date.now();
            if (now - lastTypingUpdate > USER_TYPING_EVENT_MIN_INTERVAL_MS) {
                lastTypingUpdate = now;
                onStartTyping();
            }
            if (typingTimer !== undefined) {
                window.clearTimeout(typingTimer);
            }

            typingTimer = window.setTimeout(onStopTyping, MARK_TYPING_STOPPED_INTERVAL_MS);
        });
    }

    function sendADirectBotMessage(bot: ExternalBot) {
        const txt = editor?.getMarkdown() ?? "";
        const userMessageId = random64();
        const botMessageId = random64();

        const commandInstance = directMessageCommandInstance(bot, txt);
        if (commandInstance !== undefined) {
            const scope: BotActionScope = {
                kind: "chat_scope",
                chatId: messageContext.chatId,
                threadRootMessageIndex: messageContext.threadRootMessageIndex,
                messageId: botMessageId,
                userMessageId,
            };
            client.sendPlaceholderBotMessage(
                scope,
                undefined,
                { kind: "text_content", text: txt },
                userMessageId,
                $currentUserIdStore,
                containsMarkdown,
            );
            client.executeBotCommand(scope, commandInstance, true);
            localUpdates.draftMessages.delete(messageContext);
            afterSendMessage();
        } else {
            showDirectBotChatWarning = true;
        }
    }

    function keyDown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            if (directBot) {
                if (!showCommandSelector && !messageIsEmpty) {
                    sendADirectBotMessage(directBot);
                } else if (!commandSent && botState.selectedCommand === undefined) {
                    showDirectBotChatWarning = true;
                }
                e.preventDefault();
            } else {
                if (!showCommandSelector && $enterSend) {
                    e.preventDefault();
                    sendMessage();
                }
            }
            commandSent = false;
        }
    }

    function formatUserMentions(text: string): string {
        return text.replace(/@UserId\(([\d\w-]+)\)/g, (match, p1) => {
            const u = $allUsersStore.get(p1);
            if (u?.username !== undefined) {
                const username = u.username;
                return `@${username}`;
            }
            return match;
        });
    }

    function formatUserGroupMentions(text: string): string {
        return text.replace(/@UserGroup\(([\d\w-]+)\)/g, (match, p1) => {
            const u = $selectedCommunityUserGroupsStore.get(Number(p1));
            if (u !== undefined) {
                return `@${u.name}`;
            }
            return match;
        });
    }

    // replace anything of the form @username with @UserId(xyz) or @UserGroup(abc) where
    // xyz is the userId or abc is the user group id
    // if we can't find the user or user group just leave it as is
    function expandMentions(text: string): [string | undefined, User[], boolean] {
        let mentionedMap = new Map<string, User>();
        let expandedText = text.replace(/@(\w+)/g, (match, p1) => {
            const userOrGroup = client.lookupUserForMention(p1, false);
            if (userOrGroup !== undefined) {
                switch (userOrGroup.kind) {
                    case "user_group":
                        return `@UserGroup(${userOrGroup.id})`;
                    case "everyone":
                        return "@everyone";
                    default:
                        mentionedMap.set(userOrGroup.userId, userOrGroup);
                        return `@UserId(${userOrGroup.userId})`;
                }
            } else {
                return match;
            }
        });

        let mentioned = Array.from(mentionedMap, ([_, user]) => user);

        return [expandedText, mentioned, containsMarkdown];
    }

    function parseCommands(txt: string): boolean {
        if (/snow|xmas|christmas|noel/.test(txt)) {
            $snowing = true;
        }
        return false;
    }

    function sendMessage() {
        if (showCommandSelector || messageIsEmpty) return;

        const txt = editor?.getMarkdown() ?? "";

        if (!parseCommands(txt)) {
            onSendMessage(expandMentions(txt));
        }

        afterSendMessage();
    }

    function afterSendMessage() {
        editor?.clear();
        onSetTextContent();

        messageActions?.close();
        onStopTyping();

        // After sending a message we must force a new textbox instance to be created, otherwise on iPhone the
        // predictive text doesn't notice the text has been cleared so the suggestions don't make sense.
        textboxId = Symbol();
        tick().then(() => editor?.focus());
    }

    function detectMarkdown(text: string | null) {
        if (!text) return false;

        // a few regexes to detect various block level markdown elements (possibly incomplete)
        const headerRegex = /^(?:\#{1,6}\s+)/m;
        const tableRegex = /(?:\|(?:[^\r\n\|\\]|\\.)*\|)+/;
        const bulletedListRegex = /^(?:\s*[-\*+]\s+)/m;
        const numberedListRegex = /^(?:\s*\d+\.\s+)/m;
        const blockquoteRegex = /^(?:\s*>)/m;
        const codeBlockRegex = /(?:^```[\s\S]*?^```)/m;
        const regexList = [
            headerRegex,
            tableRegex,
            bulletedListRegex,
            numberedListRegex,
            blockquoteRegex,
            codeBlockRegex,
        ];
        const result = regexList.some((regex) => regex.test(text));
        return result;
    }
    let directChatBotId = $derived(client.directChatWithBot(chat));
    let directBot = $derived(
        directChatBotId ? botState.externalBots.get(directChatBotId) : undefined,
    );
    let messageIsEmpty = $derived(
        (textContent?.trim() ?? "").length === 0 && attachment === undefined,
    );
    let canSendAny = $derived(!$anonUserStore && client.canSendMessage(chat.id, mode));
    let permittedMessages = $derived(client.permittedMessages(chat.id, mode));
    let canEnterText = $derived(
        (permittedMessages.get("text") ?? false) ||
            editingEvent !== undefined ||
            attachment !== undefined,
    );

    let excessiveLinks = $derived(client.extractEnabledLinks(textContent ?? "").length > 5);
    let frozen = $derived(client.isChatOrCommunityFrozen(chat, $selectedCommunitySummaryStore));
    $effect(() => {
        if (editor) {
            if (editingEvent && editingEvent.index !== previousEditingEvent?.index) {
                if (editingEvent.event.content.kind === "text_content") {
                    editor.setContent(
                        formatUserGroupMentions(
                            formatUserMentions(
                                client.stripLinkDisabledMarker(editingEvent.event.content.text),
                            ),
                        ),
                    );
                } else if ("caption" in editingEvent.event.content) {
                    editor.setContent(editingEvent.event.content.caption ?? "");
                }
                previousEditingEvent = editingEvent;
                containsMarkdown = detectMarkdown(editor.getMarkdown());
            } else {
                const text = textContent ?? "";
                // Only set the textbox text when required rather than every time, because doing so sets the focus back to
                // the start of the textbox on some devices.
                if (editor.getMarkdown() !== text) {
                    editor.setContent(text);
                    containsMarkdown = detectMarkdown(text);
                }
            }
        }

        if (editingEvent === undefined) {
            previousEditingEvent = undefined;
        }
    });
    trackedEffect("clear-message-actions", () => {
        // If the chat has changed, close the emoji picker or file selector
        if (!chatIdentifiersEqual(chat.id, previousChatId)) {
            messageAction = undefined;
            previousChatId = chat.id;
        }
    });
    trackedEffect("attachment-focus", () => {
        if (attachment !== undefined || replyingTo !== undefined) {
            editor?.focus();
        }
    });
    trackedEffect("screen-width-focus", () => {
        if ($screenWidth === ScreenWidth.Large) {
            editor?.focus();
        }
    });
    let placeholder = $derived(
        !canEnterText
            ? i18nKey("sendTextDisabled")
            : attachment !== undefined
              ? i18nKey("enterCaption")
              : directChatBotId
                ? i18nKey("bots.direct.placeholder")
                : i18nKey("enterMessage"),
    );
</script>

{#if showDirectBotChatWarning}
    <AlertBoxModal
        onClose={() => (showDirectBotChatWarning = false)}
        title={i18nKey("bots.direct.warningTitle")}
        warning={i18nKey("bots.direct.warning")} />
{/if}

{#if botState.selectedCommand && messageContextsEqual(botState.showingBuilder, messageContext)}
    <CommandBuilder
        {messageContext}
        onCommandSent={() => cancelCommandSelector(true)}
        onCancel={() => cancelCommandSelector(false)}
        command={botState.selectedCommand} />
{/if}

{#if showCommandSelector}
    <CommandSelector
        selectedBotId={directChatBotId}
        {messageContext}
        {mode}
        onCommandSent={() => cancelCommandSelector(true)}
        onNoMatches={() => cancelCommandSelector(false)}
        onCancel={() => cancelCommandSelector(false)} />
{/if}

<div
    class="message-entry"
    class:editing={editingEvent !== undefined}
    bind:clientHeight={messageEntryHeight}>
    {#if frozen}
        <div class="frozen">
            <Translatable resourceKey={i18nKey("chatFrozen")} />
        </div>
    {:else if blocked}
        <div class="blocked">
            <Translatable resourceKey={i18nKey("userIsBlocked")} />
        </div>
    {:else if (preview || lapsed) && chat.kind !== "direct_chat"}
        <PreviewFooter {lapsed} {joining} {chat} />
    {:else if externalContent}
        <div class="disclaimer">
            <Alert size={$iconSize} color={"var(--warn"} />
            <Translatable resourceKey={i18nKey("externalContent.disclaimer")} />
        </div>
    {:else if !canSendAny}
        <div class="disabled">
            <Translatable
                resourceKey={i18nKey(
                    $anonUserStore
                        ? "sendMessageDisabledAnon"
                        : mode === "thread"
                          ? "readOnlyThread"
                          : "readOnlyChat",
                )} />
        </div>
    {:else if $throttleDeadline > 0}
        <ThrottleCountdown deadline={$throttleDeadline} />
    {:else}
        {#if recording}
            <div class="recording">
                <Progress percent={percentRecorded} />
            </div>
        {:else if canEnterText}
            {#key textboxId}
                <div class="container">
                    {#if excessiveLinks}
                        <div class="note">{$_("excessiveLinksNote")}</div>
                    {/if}

                    <div class="textbox">
                        <RichTextEditor
                            bind:this={editor}
                            bind:empty={editorEmpty}
                            placeholder={interpolate($_, placeholder)}
                            members={$selectedChatMembersStore}
                            {onPaste}
                            onKeydown={keyDown}
                            onsubmit={sendMessage}
                            oninput={onInput}>
                            {#snippet mentionPicker(args)}
                                <MentionPicker
                                    supportsUserGroups
                                    offset={messageEntryHeight}
                                    onClose={args.onClose}
                                    onMention={args.onMention}
                                    prefix={args.query} />
                            {/snippet}
                            {#snippet emojiPicker(args)}
                                <EmojiAutocompleter
                                    offset={messageEntryHeight}
                                    onClose={args.onClose}
                                    onSelect={args.onSelect}
                                    query={args.query} />
                            {/snippet}
                        </RichTextEditor>
                    </div>
                </div>
            {/key}
        {:else}
            <div class="textbox light">
                <Translatable resourceKey={placeholder} />
            </div>
        {/if}

        {#if directChatBotId === undefined}
            <div class="icons">
                {#if editingEvent === undefined}
                    {#if permittedMessages.get("audio") && messageIsEmpty && audioMimeType !== undefined && audioSupported}
                        <div class="record">
                            <AudioAttacher
                                mimeType={audioMimeType}
                                bind:percentRecorded
                                bind:recording
                                bind:supported={audioSupported}
                                onAudioCaptured={onFileSelected} />
                        </div>
                    {:else if canEnterText}
                        <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
                        <div class="send" onclick={sendMessage}>
                            <HoverIcon title={$_("sendMessage")}>
                                <Send size={$iconSize} color={"var(--icon-txt)"} />
                            </HoverIcon>
                        </div>
                    {/if}
                    <!-- we might need this if we are editing too -->
                    <MessageActions
                        bind:this={messageActions}
                        bind:messageAction
                        {permittedMessages}
                        {attachment}
                        {mode}
                        editing={editingEvent !== undefined}
                        {onTokenTransfer}
                        {onCreatePrizeMessage}
                        {onCreateP2PSwapMessage}
                        {onAttachGif}
                        {onMakeMeme}
                        {onCreatePoll}
                        {onClearAttachment}
                        {onFileSelected} />
                {:else}
                    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
                    <div class="send" onclick={sendMessage}>
                        <HoverIcon>
                            <ContentSaveEditOutline size={$iconSize} color={"var(--button-txt)"} />
                        </HoverIcon>
                    </div>
                    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
                    <div class="send" onclick={onCancelEdit}>
                        <HoverIcon>
                            <Close size={$iconSize} color={"var(--button-txt)"} />
                        </HoverIcon>
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style lang="scss">
    .message-entry {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--entry-bg);
        padding: $sp3;
        border-top: var(--bw) solid var(--bd);
        min-height: toRem(60);

        &.editing {
            background: var(--button-bg);
        }

        .icons {
            display: flex;
            align-self: flex-end;
        }
    }
    .send {
        flex: 0 0 15px;
    }

    .container {
        margin: 0 $sp3;
        flex: 1;
        position: relative;
    }

    .textbox {
        padding: toRem(12) $sp4 $sp3 $sp4;
        background-color: var(--entry-input-bg);
        border-radius: var(--entry-input-rd);
        outline: none;
        border: 0;
        max-height: calc(var(--vh, 1vh) * 50);
        min-height: toRem(30);
        overflow-x: hidden;
        overflow-y: auto;
        user-select: text;
        // white-space: pre-wrap;
        overflow-wrap: anywhere;
        border: var(--bw) solid var(--entry-input-bd);
        box-shadow: var(--entry-input-sh);

        &.recording {
            display: none;
        }

        &.light {
            color: var(--txt-light);
        }
    }

    .blocked,
    .frozen,
    .disabled {
        height: 42px;
        color: var(--txt);
        @include font(book, normal, fs-100);
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
    }

    .recording {
        padding: 0 $sp3;
        flex: auto;
    }

    .note {
        @include font(book, normal, fs-70);
        margin-bottom: $sp2;
    }

    .disclaimer {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        gap: $sp4;
    }

    .prefix {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 1000;
        @include font(bold, normal, fs-200);
    }
</style>
