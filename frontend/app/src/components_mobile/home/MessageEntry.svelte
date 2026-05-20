<script lang="ts">
    import RichTextEditor from "@shared_components/RichTextEditor.svelte";
    import { keyboard } from "@src/stores/keyboard.svelte";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import {
        popHistoryStateWithAction,
        pushDummyHistoryState,
        type CustomHistoryAction,
    } from "@src/utils/history";
    import { BodySmall, ColourVars, Container, IconButton, Row } from "component-lib";
    import type {
        AttachmentContent,
        BotActionScope,
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        ExternalBot,
        Message,
        MessageContext,
        OpenChat,
        SelectedEmoji,
        User,
    } from "openchat-client";
    import {
        allUsersStore,
        anonUserStore,
        botState,
        currentUserIdStore,
        directMessageCommandInstance,
        localUpdates,
        messageContextsEqual,
        random64,
        screenWidth,
        ScreenWidth,
        selectedChatMembersStore,
        selectedCommunitySummaryStore,
        selectedCommunityUserGroupsStore,
        throttleDeadline,
        type CreatedUser,
    } from "openchat-client";
    import { getContext, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Alert from "svelte-material-icons/Alert.svelte";
    import Camera from "svelte-material-icons/CameraOutline.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Keyboard from "svelte-material-icons/KeyboardOutline.svelte";
    import PlusCircle from "svelte-material-icons/PlusCircleOutline.svelte";
    import StickerEmoji from "svelte-material-icons/StickerEmoji.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { enterSend } from "../../stores/settings";
    import { snowing } from "../../stores/snow";
    import AlertBoxModal from "../AlertBoxModal.svelte";
    import CommandBuilder from "../bots/CommandInstanceBuilder.svelte";
    import CommandSelector from "../bots/CommandSelector.svelte";
    import Send from "../icons/Send.svelte";
    import Progress from "../Progress.svelte";
    import Translatable from "../Translatable.svelte";
    import AudioAttacher from "./AudioAttacher.svelte";
    import CustomMessageTrigger from "./CustomMessageTrigger.svelte";
    import DraftMediaMessage from "./DraftMediaMessage.svelte";
    import EmojiAutocompleter from "./EmojiAutocompleter.svelte";
    import EmojiOrGif from "./EmojiOrGif.svelte";
    import FileAttacher from "./FileAttacher.svelte";
    import MentionPicker from "./MentionPicker.svelte";
    import PreviewFooter from "./PreviewFooter.svelte";
    import ReplyingTo from "./ReplyingTo.svelte";
    import ThrottleCountdown from "./ThrottleCountdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: ChatSummary;
        blocked: boolean;
        preview: boolean;
        lapsed: boolean;
        attachment: AttachmentContent | undefined;
        editingEvent: EventWrapper<Message> | undefined;
        replyingTo: EnhancedReplyContext | undefined;
        textContent: string | undefined;
        mode?: "thread" | "message";
        externalContent: boolean;
        messageContext: MessageContext;
        user: CreatedUser;
        inputTrayVisible: boolean;
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
        onMakeMeme: () => void;
        onCancelReply: () => void;
    }

    let {
        chat,
        blocked,
        preview,
        lapsed,
        attachment,
        editingEvent,
        replyingTo,
        textContent,
        mode = "message",
        externalContent,
        messageContext,
        user,
        inputTrayVisible = $bindable(),
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
        onMakeMeme,
        onCancelReply,
    }: Props = $props();

    const USER_TYPING_EVENT_MIN_INTERVAL_MS = 1000; // 1 second
    const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

    let editor = $state<RichTextEditor>();
    let editorEmpty = $state(true);

    let messageEntryHeight = $state<number>(0);
    let audioMimeType = client.audioRecordingMimeType();
    let recording: boolean = $state(false);
    let percentRecorded: number = $state(0);
    let previousEditingEvent: EventWrapper<Message> | undefined = $state();
    let lastTypingUpdate: number = 0;
    let typingTimer: number | undefined = undefined;
    let audioSupported: boolean = $state("mediaDevices" in navigator);
    let showCommandSelector: boolean = $state(false);
    let containsMarkdown = $state(false);
    let showDirectBotChatWarning = $state(false);
    let commandSent = false;

    // Update this to force a new textbox instance to be created
    let textboxId = $state(Symbol());

    type InputTrayMode =
        | "closed"
        | "keyboard_only"
        | "emoji_gif_selection"
        | "emoji_gif_search"
        | "attachments";

    // Control variable to indicate that focus out happened, which changed the
    // keyboard visibility, and we can take it into account to prevent extended
    // section hiding prematurely.
    let emojiSearchFocusedOut = $state(false);

    // Prevents pop handler from running if not necessary!
    let returnFromPopHandler = $state(false);

    // Track changes in kb visibility to prevent the effect running twice for
    // same value.
    let previousKbVisibleValue = $state(keyboard.visible);

    // Current mode for the input tray, section that opens up below the input
    // and which provides additional message options.
    let inputTrayMode = $state<InputTrayMode>("closed");

    // Cases in which we show extended options, even when keyboard is visible,
    // since the extened options provide bottom padding for the input to rise
    // above the keyboard.
    $effect(() => {
        inputTrayVisible = keyboard.visible || inputTrayMode !== "closed";
    });

    $effect(() => {
        if (previousKbVisibleValue === keyboard.visible) return;

        // This is a new change, make sure to remember the new state...
        previousKbVisibleValue = keyboard.visible;

        if (!keyboard.visible) {
            // In case we we're showing emoji search, or we focused out of emoji
            // search, move to emoji selection.
            if (inputTrayMode === "emoji_gif_search" || emojiSearchFocusedOut) {
                inputTrayMode = "emoji_gif_selection";
            }

            // If we were only showing keyboard before...
            if (inputTrayMode === "keyboard_only") {
                inputTrayMode = "closed";
            }

            emojiSearchFocusedOut = false;
        } else {
            if (inputTrayMode === "closed") {
                inputTrayMode = "keyboard_only";
            }
        }
    });

    // Show emoji!
    function toggleEmojiPicker() {
        inputTrayMode = "emoji_gif_selection";
        pushExpandedHistoryState();
    }

    // Show extened options!
    function toggleAttachments() {
        inputTrayMode = inputTrayMode === "attachments" ? "closed" : "attachments";

        // Only push history state if attachment options are showing, or pop state
        // if the options are not showing.
        inputTrayMode === "attachments" ? pushExpandedHistoryState() : popExpandedHistoryState();
    }

    function showKeyboard() {
        editor?.focus();
    }

    // Should handle cases where usual user interactions are skipped, and
    // input is focused directly, i.e. user clicking directly into input,
    // or replying/editing to/a message.
    function keyboardFocus() {
        inputTrayMode = "keyboard_only";

        // Reset indicator var...
        emojiSearchFocusedOut = false;

        // When keyboard shows, we pop any history state that may have been
        // added due to opening emoji or extended options selectors.
        popExpandedHistoryState();
    }

    function getHistoryStateAction(): CustomHistoryAction {
        return `input-tray-${mode}`;
    }

    // State added to indicate expanded section is open. Devices back gesture
    // can then pop the state from history, and the expanded section will close.
    function pushExpandedHistoryState() {
        pushDummyHistoryState(getHistoryStateAction());
    }

    // Pops expanded history state only if it's set.
    function popExpandedHistoryState() {
        if (popHistoryStateWithAction(getHistoryStateAction())) {
            returnFromPopHandler = true;
        }
    }

    // Runs on BACK gesture/button!
    function popStateHandler(_e: PopStateEvent) {
        if (returnFromPopHandler) {
            // We manually ran pop state, so no need to handle pop any further...
            returnFromPopHandler = false;
            return;
        }

        if (inputTrayMode === "emoji_gif_search") {
            inputTrayMode = "emoji_gif_selection";
            return;
        }

        inputTrayMode = "closed";
    }

    function inputTrayFocusIn(e: FocusEvent) {
        // Only handle focus if the originating element is input!
        const eventOrigin = e.composedPath()[0] as HTMLElement;
        const isInputOrigin = eventOrigin.tagName === "INPUT";

        inputTrayMode = isInputOrigin ? "emoji_gif_search" : inputTrayMode;
    }

    function inputTrayFocusOut(e: FocusEvent) {
        // Do not handle blur event for non input elements
        const eventOrigin = e.composedPath()[0] as HTMLElement;
        if (eventOrigin.tagName !== "INPUT") return;

        inputTrayMode = "emoji_gif_selection";

        // Indicate that we just focused out of an input field within the input
        // tray, i.e. emoji search input, helps us to switch to emoji selection view.
        emojiSearchFocusedOut = true;
    }

    // Switch back to attachments view after attachment is cleared, if the view
    // is on keyboard!
    function onRemoveAttachment() {
        if (inputTrayMode === "keyboard_only") {
            inputTrayMode = "attachments";
        }

        onClearAttachment();
    }

    onMount(() => {
        // This component is also used for threads, so we need to remember the
        // state of this when the component mounts.
        const wasViewportResizeEnabled = keyboard.viewportResizeEnabled;

        // When mesasge entry is on screen, the viewport should not just resize
        // by default, since we want to support the input tray UI where soft
        // keyboard overlaps some of the UI content.
        keyboard.disableViewportResize();
        return () => {
            // Enable kb resizing again if it was enabled.
            if (wasViewportResizeEnabled) keyboard.enableViewportResize();
        };
    });

    function insertEmoji(emoji: SelectedEmoji) {
        editor?.insertEmoji(emoji);
    }

    function backspace() {
        document.execCommand("delete");
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
    let textboxEmpty = $derived((textContent?.trim() ?? "").length === 0);
    let messageIsEmpty = $derived(textboxEmpty && attachment === undefined);
    let canSendAny = $derived(!$anonUserStore && client.canSendMessage(chat.id, mode));
    let permittedMessages = $derived(client.permittedMessages(chat.id, mode));
    let canEnterText = $derived(
        (permittedMessages.get("text") ?? false) ||
            editingEvent !== undefined ||
            attachment !== undefined,
    );
    let canAddImageOrVideo = $derived(
        permittedMessages.get("image") || permittedMessages.get("video"),
    );
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

<svelte:window onpopstate={popStateHandler} />

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

{#if !$anonUserStore}
    <Container
        overflow={"visible"}
        gap={"sm"}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={recording ? "center" : "end"}
        background={ColourVars.background0}
        padding={["zero", "md", inputTrayMode !== "closed" ? "sm" : "zero"]}>
        {#if frozen}
            <div class="frozen">
                <Translatable resourceKey={i18nKey("chatFrozen")} />
            </div>
        {:else if blocked}
            <div class="blocked">
                <Translatable resourceKey={i18nKey("userIsBlocked")} />
            </div>
        {:else if (preview || lapsed) && chat.kind !== "direct_chat"}
            <PreviewFooter {lapsed} {chat} />
        {:else if externalContent}
            <Row crossAxisAlignment={"center"} gap={"md"}>
                <Alert size={"1.5rem"} color={"var(--warning)"} />
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("externalContent.disclaimer")} />
                </BodySmall>
            </Row>
        {:else if !canSendAny}
            <div class="disabled">
                <Translatable
                    resourceKey={i18nKey(mode === "thread" ? "readOnlyThread" : "readOnlyChat")} />
            </div>
        {:else if $throttleDeadline > 0}
            <ThrottleCountdown deadline={$throttleDeadline} />
        {:else}
            {#if recording}
                <Progress size={"3rem"} percent={percentRecorded} />
            {:else if canEnterText}
                {#key textboxId}
                    <div
                        class="message_entry_wrapper"
                        class:has_reply={!!replyingTo}
                        class:has_attachment={!!attachment}
                        class:is_editing={editingEvent !== undefined}>
                        {#if replyingTo}
                            <ReplyingTo readonly {replyingTo} {user} {onCancelReply} />
                        {/if}
                        {#if !editingEvent && attachment !== undefined}
                            <DraftMediaMessage {onRemoveAttachment} content={attachment} />
                        {/if}
                        {#if editingEvent !== undefined}
                            <Row
                                height={{ size: "1rem" }}
                                crossAxisAlignment="center"
                                supplementalClass="editing-title">
                                <BodySmall colour="textSecondary">
                                    <Translatable resourceKey={i18nKey("Editing...")} />
                                </BodySmall>
                                <IconButton size={"sm"} padding={"md"} onclick={onCancelEdit}>
                                    {#snippet icon()}
                                        <Close color={ColourVars.textSecondary} />
                                    {/snippet}
                                </IconButton>
                            </Row>
                        {/if}
                        <Container
                            bind:clientHeight={messageEntryHeight}
                            gap="sm"
                            minHeight="3.5rem"
                            maxHeight="calc(var(--vh, 1vh) * 50)"
                            padding="xs"
                            overflow="visible"
                            crossAxisAlignment="center"
                            mainAxisAlignment="spaceBetween"
                            supplementalClass="message_entry_text_box">
                            {#if inputTrayMode !== "emoji_gif_selection"}
                                <IconButton
                                    onclick={toggleEmojiPicker}
                                    padding={["sm", "zero", "md", "sm"]}
                                    size={"md"}>
                                    {#snippet icon()}
                                        <StickerEmoji color={ColourVars.textPlaceholder} />
                                    {/snippet}
                                </IconButton>
                            {:else}
                                <IconButton
                                    onclick={showKeyboard}
                                    padding={["sm", "zero", "md", "sm"]}
                                    size={"md"}>
                                    {#snippet icon()}
                                        <Keyboard color={ColourVars.textPlaceholder} />
                                    {/snippet}
                                </IconButton>
                            {/if}

                            <div class="textbox">
                                <RichTextEditor
                                    bind:this={editor}
                                    bind:empty={editorEmpty}
                                    placeholder={interpolate($_, placeholder)}
                                    members={$selectedChatMembersStore}
                                    {onPaste}
                                    onfocus={keyboardFocus}
                                    onKeydown={keyDown}
                                    onsubmit={sendMessage}
                                    oninput={onInput}>
                                    {#snippet mentionPicker(args)}
                                        <MentionPicker
                                            supportsUserGroups
                                            offset={messageEntryHeight}
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

                            {#if editingEvent === undefined}
                                <Container
                                    padding={["zero", "sm", "zero", "zero"]}
                                    width={"hug"}
                                    gap={"md"}>
                                    <IconButton
                                        onclick={toggleAttachments}
                                        padding={["sm", "zero", "md", "zero"]}
                                        size={"md"}>
                                        {#snippet icon()}
                                            <div
                                                class:open={inputTrayMode === "attachments" &&
                                                    !keyboard.visible}
                                                class="drawer_trigger">
                                                <PlusCircle color={ColourVars.textPlaceholder} />
                                            </div>
                                        {/snippet}
                                    </IconButton>

                                    {#if messageIsEmpty && canAddImageOrVideo}
                                        <FileAttacher {onFileSelected}>
                                            {#snippet children(onClick)}
                                                <IconButton
                                                    onclick={onClick}
                                                    padding={["sm", "zero", "md", "zero"]}
                                                    size={"md"}>
                                                    {#snippet icon()}
                                                        <Camera
                                                            color={ColourVars.textPlaceholder} />
                                                    {/snippet}
                                                </IconButton>
                                            {/snippet}
                                        </FileAttacher>
                                    {/if}
                                </Container>
                            {/if}
                        </Container>
                    </div>
                {/key}
            {:else}
                <div class="textbox">
                    <Translatable resourceKey={placeholder} />
                </div>
            {/if}

            {#if directChatBotId === undefined}
                <Container crossAxisAlignment={"center"} gap={"xs"} width={"hug"}>
                    {#if editingEvent === undefined}
                        {#if permittedMessages.get("audio") && messageIsEmpty && audioMimeType !== undefined && audioSupported}
                            <AudioAttacher
                                mimeType={audioMimeType}
                                bind:percentRecorded
                                bind:recording
                                bind:supported={audioSupported}
                                onAudioCaptured={onFileSelected} />
                        {:else if canEnterText}
                            <IconButton
                                padding={"md"}
                                mode={"primary"}
                                size={"lg"}
                                onclick={sendMessage}>
                                {#snippet icon(color)}
                                    <Send {color} />
                                {/snippet}
                            </IconButton>
                        {/if}
                    {:else}
                        <IconButton
                            padding={"md"}
                            mode={"primary"}
                            size={"lg"}
                            onclick={sendMessage}>
                            {#snippet icon(color)}
                                <Check {color} />
                            {/snippet}
                        </IconButton>
                    {/if}
                </Container>
            {/if}
        {/if}
    </Container>

    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
        role="dialog"
        class={`input_tray ${inputTrayVisible ? "visible" : ""}`}
        onmousedown={inputTrayFocusIn}
        onfocusout={inputTrayFocusOut}
        style:height={`${
            inputTrayMode !== "closed"
                ? keyboard.height + (inputTrayMode === "emoji_gif_search" ? 200 : 0)
                : 0
        }px`}
        style:visibility={inputTrayMode !== "closed" ? "visible" : "hidden"}>
        {#if inputTrayMode === "emoji_gif_selection" || inputTrayMode === "emoji_gif_search"}
            <EmojiOrGif
                empty={textboxEmpty}
                ctx={messageContext}
                onEmojiSelected={insertEmoji}
                onBackspace={backspace}
                onClose={toggleEmojiPicker} />
        {/if}

        {#if inputTrayMode === "attachments"}
            <CustomMessageTrigger
                {permittedMessages}
                {onTokenTransfer}
                {onCreatePrizeMessage}
                {onCreateP2PSwapMessage}
                {onMakeMeme}
                {onFileSelected}
                {messageContext}
                open={true} />
        {/if}
    </div>
{/if}

<style lang="scss">
    .message_entry_wrapper {
        width: 100%;
        // overflow: auto;
        border-radius: var(--rad-huge);
        background-color: var(--text-tertiary);
        transition: border-radius 200ms ease-out;

        &.has_reply,
        &.has_attachment {
            border-radius: var(--rad-xl) var(--rad-xl) var(--rad-xxl) var(--rad-xxl);
        }

        &.is_editing {
            border-radius: var(--rad-xl);
        }
    }

    .drawer_trigger {
        display: flex;
        justify-content: center;
        align-items: center;
        transition: transform 200ms ease-in-out;
        transform-origin: 50%;
        &.open {
            transform: rotate(135deg);
        }
    }
    .textbox {
        outline: none;
        border: 0;
        overflow-x: hidden;
        padding: var(--sp-md) 0 var(--sp-md) 0;
        // overflow-y: visible;
        user-select: text;
        overflow-wrap: anywhere;
        flex: auto;
        font-size: var(--typo-chatText-sz);
        line-height: var(--typo-chatText-lh);
        color: var(--text-primary);

        &.recording {
            display: none;
        }
    }

    .blocked,
    .frozen,
    .disabled {
        height: 42px;
        color: var(--text-secondary);
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
    }

    .input_tray {
        height: 0;
        width: 100%;
        padding-bottom: 0;
        overflow: hidden;
        background: var(--background-1);
        border-radius: var(--rad-lg) var(--rad-lg) 0 0;
        transition:
            height 0.2s cubic-bezier(0.4, 0, 0.2, 1),
            padding-bottom 0.2s cubic-bezier(0.4, 0, 0.2, 1);

        &.visible {
            padding-bottom: var(--device-nav-height);
        }
    }

    :global {
        .editing-title {
            position: relative;
            z-index: 1;
            top: 0.65rem;
            padding-left: 2.75rem !important;
        }
    }
</style>
