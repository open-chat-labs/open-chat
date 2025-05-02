<script lang="ts">
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
        User,
        UserOrUserGroup,
    } from "openchat-client";
    import {
        app,
        botState,
        chatIdentifiersEqual,
        directMessageCommandInstance,
        draftMessagesStore,
        messageContextsEqual,
        random64,
        ScreenWidth,
        throttleDeadline,
        ui,
        userStore,
    } from "openchat-client";
    import { getContext, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Alert from "svelte-material-icons/Alert.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ContentSaveEditOutline from "svelte-material-icons/ContentSaveMoveOutline.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import { translatable } from "../../actions/translatable";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { enterSend, useBlockLevelMarkdown } from "../../stores/settings";
    import { snowing } from "../../stores/snow";
    import AlertBoxModal from "../AlertBoxModal.svelte";
    import CommandBuilder from "../bots/CommandInstanceBuilder.svelte";
    import CommandSelector from "../bots/CommandSelector.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Progress from "../Progress.svelte";
    import Translatable from "../Translatable.svelte";
    import AudioAttacher from "./AudioAttacher.svelte";
    import EmojiAutocompleter from "./EmojiAutocompleter.svelte";
    import MarkdownToggle from "./MarkdownToggle.svelte";
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
        onDrop: (e: DragEvent) => void;
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
        onDrop,
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

    const mentionRegex = /@(\w*)$/;
    const emojiRegex = /:(\w+):?$/;
    let inp: HTMLDivElement | undefined = $state();
    let audioMimeType = client.audioRecordingMimeType();
    let selectedRange: Range | undefined = $state();
    let dragging: boolean = $state(false);
    let recording: boolean = $state(false);
    let percentRecorded: number = $state(0);
    let previousEditingEvent: EventWrapper<Message> | undefined = $state();
    let lastTypingUpdate: number = 0;
    let typingTimer: number | undefined = undefined;
    let audioSupported: boolean = $state("mediaDevices" in navigator);
    let showMentionPicker = $state(false);
    let showCommandSelector: boolean = $state(false);
    let showEmojiSearch = $state(false);
    let mentionPrefix: string | undefined = $state();
    let emojiQuery: string | undefined = $state();
    let messageEntryHeight: number = $state(0);
    let messageActions: MessageActions | undefined = $state();
    let rangeToReplace: [Node, number, number] | undefined = undefined;
    let previousChatId = $state(chat.id);
    let containsMarkdown = $state(false);
    let showDirectBotChatWarning = $state(false);
    let commandSent = false;

    // Update this to force a new textbox instance to be created
    let textboxId = $state(Symbol());

    export function replaceSelection(text: string) {
        restoreSelection();
        let range = window.getSelection()?.getRangeAt(0);
        if (range !== undefined) {
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            const inputContent = inp?.textContent ?? "";
            onSetTextContent(inputContent.trim().length === 0 ? undefined : inputContent);
        }
    }

    function onInput() {
        const inputContent = inp?.textContent ?? "";
        onSetTextContent(inputContent.trim().length === 0 ? undefined : inputContent);
        triggerCommandSelector(inputContent);
        triggerMentionLookup(inputContent);
        triggerEmojiLookup(inputContent);
        triggerTypingTimer();
        containsMarkdown = detectMarkdown(inputContent);
    }

    function uptoCaret(
        inputContent: string | null,
        fn: (slice: string, node: Node, pos: number) => void,
    ): void {
        if (inputContent === null) return;

        const selection = window.getSelection();
        if (selection === null) return;
        const anchorNode = selection.anchorNode;
        if (anchorNode?.textContent == null) return;
        const text = anchorNode.textContent;

        const slice = text.slice(0, selection.anchorOffset);
        fn(slice, anchorNode, selection.anchorOffset);
    }

    function triggerEmojiLookup(inputContent: string | null): void {
        uptoCaret(inputContent, (slice: string, node: Node, pos: number) => {
            const matches = slice.match(emojiRegex);
            if (matches !== null) {
                if (matches.index !== undefined) {
                    rangeToReplace = [node, matches.index, pos];
                    emojiQuery = matches[1].toLowerCase() || undefined;
                    showEmojiSearch = true;
                }
            } else {
                showEmojiSearch = false;
                emojiQuery = undefined;
            }
        });
    }

    function triggerMentionLookup(inputContent: string | null): void {
        if (chat.kind === "direct_chat" || chat.memberCount <= 1) return;
        uptoCaret(inputContent, (slice: string, node: Node, pos: number) => {
            const matches = slice.match(mentionRegex);
            if (matches !== null) {
                if (matches.index !== undefined) {
                    rangeToReplace = [node, matches.index, pos];
                    mentionPrefix = matches[1].toLowerCase() || undefined;
                    showMentionPicker = true;
                }
            } else {
                showMentionPicker = false;
                mentionPrefix = undefined;
            }
        });
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
        const txt = inp?.textContent?.trim() ?? "";
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
                app.currentUserId,
                $useBlockLevelMarkdown,
                false,
            );
            client.executeBotCommand(scope, commandInstance, true);
            draftMessagesStore.delete(messageContext);
            afterSendMessage();
        } else {
            showDirectBotChatWarning = true;
        }
    }

    function keyPress(e: KeyboardEvent) {
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
            const u = userStore.get(p1);
            if (u?.username !== undefined) {
                const username = u.username;
                return `@${username}`;
            }
            return match;
        });
    }

    function formatUserGroupMentions(text: string): string {
        return text.replace(/@UserGroup\(([\d\w-]+)\)/g, (match, p1) => {
            const u = app.selectedCommunity.userGroups.get(Number(p1));
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

        return [expandedText, mentioned, containsMarkdown && $useBlockLevelMarkdown];
    }

    function parseCommands(txt: string): boolean {
        if (/snow|xmas|christmas|noel/.test(txt)) {
            $snowing = true;
        }
        return false;
    }

    function sendMessage() {
        if (showCommandSelector || messageIsEmpty) return;

        const txt = inp?.innerText?.trim() ?? "";

        if (!parseCommands(txt)) {
            onSendMessage(expandMentions(txt));
        }

        afterSendMessage();
    }

    function afterSendMessage() {
        if (inp) {
            inp.textContent = "";
        }
        onSetTextContent();

        messageActions?.close();
        onStopTyping();

        // After sending a message we must force a new textbox instance to be created, otherwise on iPhone the
        // predictive text doesn't notice the text has been cleared so the suggestions don't make sense.
        textboxId = Symbol();
        tick().then(() => inp?.focus());
    }

    export function saveSelection() {
        try {
            // seeing errors in the logs to do with this
            selectedRange = window.getSelection()?.getRangeAt(0);
        } catch (_err) {}
    }

    function restoreSelection() {
        if (!inp) return;

        inp?.focus();
        if (!selectedRange || !selectedRange.intersectsNode(inp)) {
            const range = new Range();
            range.selectNodeContents(inp);
            range.collapse(false);
            selectedRange = range;
        }

        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(selectedRange);
    }

    function setCaretToEnd() {
        if (!inp) return;

        const range = document.createRange();
        range.selectNodeContents(inp);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    function setCaretTo(node: Node, pos: number) {
        const range = document.createRange();
        range.selectNodeContents(node);
        range.setStart(node, pos);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    function drop(e: DragEvent) {
        dragging = false;
        onDrop(e);
    }

    function replaceTextWith(replacement: string) {
        if (rangeToReplace === undefined) return;

        const [node, start, end] = rangeToReplace;

        const replaced = `${node.textContent?.slice(
            0,
            start,
        )}${replacement} ${node.textContent?.slice(end)}`;
        node.textContent = replaced;

        onSetTextContent(inp?.textContent || undefined);

        tick().then(() => {
            setCaretTo(node, start + replacement.length + 1);
        });

        rangeToReplace = undefined;
    }

    function mention(userOrGroup: UserOrUserGroup): void {
        const username = client.userOrUserGroupName(userOrGroup);
        const userLabel = `@${username}`;

        replaceTextWith(userLabel);

        showMentionPicker = false;
    }

    function cancelMention() {
        showMentionPicker = false;
        setCaretToEnd();
    }

    function completeEmoji(emoji: string) {
        replaceTextWith(emoji);
        showEmojiSearch = false;
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
    let canSendAny = $derived(!app.anonUser && client.canSendMessage(chat.id, mode));
    let permittedMessages = $derived(client.permittedMessages(chat.id, mode));
    let canEnterText = $derived(
        (permittedMessages.get("text") ?? false) ||
            editingEvent !== undefined ||
            attachment !== undefined,
    );
    let excessiveLinks = $derived(client.extractEnabledLinks(textContent ?? "").length > 5);
    let frozen = $derived(client.isChatOrCommunityFrozen(chat, app.selectedCommunitySummary));
    trackedEffect("message-entry-inp", () => {
        if (inp) {
            if (editingEvent && editingEvent.index !== previousEditingEvent?.index) {
                if (editingEvent.event.content.kind === "text_content") {
                    inp.textContent = formatUserGroupMentions(
                        formatUserMentions(
                            client.stripLinkDisabledMarker(editingEvent.event.content.text),
                        ),
                    );
                    selectedRange = undefined;
                    restoreSelection();
                } else if ("caption" in editingEvent.event.content) {
                    inp.textContent = editingEvent.event.content.caption ?? "";
                    selectedRange = undefined;
                    restoreSelection();
                }
                previousEditingEvent = editingEvent;
                containsMarkdown = detectMarkdown(inp.textContent);
            } else {
                const text = textContent ?? "";
                // Only set the textbox text when required rather than every time, because doing so sets the focus back to
                // the start of the textbox on some devices.
                if (inp.textContent !== text) {
                    inp.textContent = text;
                    // TODO - figure this out
                    // setCaretToEnd();
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
            inp?.focus();
        }
    });
    trackedEffect("screen-width-focus", () => {
        if (ui.screenWidth === ScreenWidth.Large) {
            inp?.focus();
        }
    });
    let placeholder = $derived(
        !canEnterText
            ? i18nKey("sendTextDisabled")
            : attachment !== undefined
              ? i18nKey("enterCaption")
              : dragging
                ? i18nKey("dropFile")
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

{#if showMentionPicker}
    <MentionPicker
        supportsUserGroups
        offset={messageEntryHeight}
        onClose={cancelMention}
        onMention={mention}
        prefix={mentionPrefix} />
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

{#if showEmojiSearch}
    <EmojiAutocompleter
        offset={messageEntryHeight}
        onClose={() => (showEmojiSearch = false)}
        onSelect={completeEmoji}
        query={emojiQuery} />
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
            <Alert size={ui.iconSize} color={"var(--warn"} />
            <Translatable resourceKey={i18nKey("externalContent.disclaimer")} />
        </div>
    {:else if !canSendAny}
        <div class="disabled">
            <Translatable
                resourceKey={i18nKey(
                    app.anonUser
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
                    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
                    <div
                        data-gram="false"
                        data-gramm_editor="false"
                        data-enable-grammarly="false"
                        tabindex={0}
                        bind:this={inp}
                        onblur={saveSelection}
                        class="textbox"
                        class:recording
                        class:dragging
                        class:empty={messageIsEmpty}
                        contenteditable
                        onpaste={onPaste}
                        placeholder={interpolate($_, placeholder)}
                        use:translatable={{
                            key: placeholder,
                            position: "absolute",
                            right: 12,
                            top: 12,
                        }}
                        spellcheck
                        ondragover={() => (dragging = true)}
                        ondragenter={() => (dragging = true)}
                        ondragleave={() => (dragging = false)}
                        ondrop={drop}
                        oninput={onInput}
                        onkeypress={keyPress}>
                    </div>

                    {#if containsMarkdown}
                        <MarkdownToggle {editingEvent} />
                    {/if}
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
                                <Send size={ui.iconSize} color={"var(--icon-txt)"} />
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
                            <ContentSaveEditOutline
                                size={ui.iconSize}
                                color={"var(--button-txt)"} />
                        </HoverIcon>
                    </div>
                    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
                    <div class="send" onclick={onCancelEdit}>
                        <HoverIcon>
                            <Close size={ui.iconSize} color={"var(--button-txt)"} />
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
            background-color: var(--button-bg);
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
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        border: var(--bw) solid var(--entry-input-bd);
        box-shadow: var(--entry-input-sh);

        &.empty:before {
            content: attr(placeholder);
            color: var(--placeholder);
            pointer-events: none;
            display: block; /* For Firefox */
            position: absolute;
        }

        &.dragging {
            border: var(--bw) dashed var(--txt);
        }

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
