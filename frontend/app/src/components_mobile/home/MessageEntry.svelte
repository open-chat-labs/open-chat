<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { BodySmall, ColourVars, Container, IconButton, Row, transition } from "component-lib";
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
        UserOrUserGroup,
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
        selectedCommunitySummaryStore,
        selectedCommunityUserGroupsStore,
        throttleDeadline,
    } from "openchat-client";
    import { getContext, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Alert from "svelte-material-icons/Alert.svelte";
    import Camera from "svelte-material-icons/CameraOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ContentSaveEditOutline from "svelte-material-icons/ContentSaveMoveOutline.svelte";
    import Keyboard from "svelte-material-icons/KeyboardOutline.svelte";
    import PlusCircle from "svelte-material-icons/PlusCircleOutline.svelte";
    import StickerEmoji from "svelte-material-icons/StickerEmoji.svelte";
    import { translatable } from "../../actions/translatable";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { enterSend, useBlockLevelMarkdown } from "../../stores/settings";
    import { snowing } from "../../stores/snow";
    import AlertBoxModal from "../AlertBoxModal.svelte";
    import CommandBuilder from "../bots/CommandInstanceBuilder.svelte";
    import CommandSelector from "../bots/CommandSelector.svelte";
    import Send from "../icons/Send.svelte";
    import Progress from "../Progress.svelte";
    import Translatable from "../Translatable.svelte";
    import AudioAttacher from "./AudioAttacher.svelte";
    import CustomMessageTrigger from "./CustomMessageTrigger.svelte";
    import EmojiAutocompleter from "./EmojiAutocompleter.svelte";
    import EmojiOrGif from "./EmojiOrGif.svelte";
    import FileAttacher from "./FileAttacher.svelte";
    import MarkdownToggle from "./MarkdownToggle.svelte";
    import MentionPicker from "./MentionPicker.svelte";
    import PreviewFooter from "./PreviewFooter.svelte";
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
    }: Props = $props();

    const USER_TYPING_EVENT_MIN_INTERVAL_MS = 1000; // 1 second
    const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

    const mentionRegex = /@(\w*)$/;
    const emojiRegex = /:(\w+):?$/;
    let inp: HTMLDivElement | undefined = $state();
    let audioMimeType = client.audioRecordingMimeType();
    let selectedRange: Range | undefined = $state();
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
    let rangeToReplace: [Node, number, number] | undefined = undefined;
    let containsMarkdown = $state(false);
    let showDirectBotChatWarning = $state(false);
    let commandSent = false;

    let showCustomMessageTrigger = $state(false);

    // Update this to force a new textbox instance to be created
    let textboxId = $state(Symbol());
    let showEmojiPicker = $state(false);

    function toggleEmojiPicker() {
        transition(["fade"], () => {
            showEmojiPicker = !showEmojiPicker;
        });
    }

    function insertEmoji(emoji: SelectedEmoji) {
        if (emoji.kind === "native") {
            replaceSelectionWithNode(document.createTextNode(emoji.unicode));
        } else {
            const el = document.createElement("custom-emoji");
            el.dataset.id = emoji.code;
            replaceSelectionWithNode(el);
        }
    }

    function backspace() {
        document.execCommand("delete");
    }

    export function replaceSelectionWithNode(node: Node) {
        restoreSelection();
        let range = window.getSelection()?.getRangeAt(0);
        if (range !== undefined) {
            range.deleteContents();
            range.insertNode(node);
            range.collapse(false);
            const inputContent = inp?.textContent ?? "";
            triggerCommandSelector(inputContent);
            onSetTextContent(inputContent.trim().length === 0 ? undefined : inputContent);
        }
    }

    export function replaceSelection(text: string) {
        replaceSelectionWithNode(document.createTextNode(text));
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
                $currentUserIdStore,
                $useBlockLevelMarkdown,
            );
            client.executeBotCommand(scope, commandInstance, true);
            localUpdates.draftMessages.delete(messageContext);
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

    function setCaretTo(node: Node, pos: number) {
        const range = document.createRange();
        range.selectNodeContents(node);
        range.setStart(node, pos);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
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
    trackedEffect("attachment-focus", () => {
        if (attachment !== undefined || replyingTo !== undefined) {
            inp?.focus();
        }
    });
    trackedEffect("screen-width-focus", () => {
        if ($screenWidth === ScreenWidth.Large) {
            inp?.focus();
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

{#if showMentionPicker}
    <MentionPicker supportsUserGroups offset={80} onMention={mention} prefix={mentionPrefix} />
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
        offset={80}
        onClose={() => (showEmojiSearch = false)}
        onSelect={completeEmoji}
        query={emojiQuery} />
{/if}

{#if !$anonUserStore}
    <Container
        overflow={"visible"}
        gap={"sm"}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={recording ? "center" : "end"}
        background={editingEvent !== undefined ? ColourVars.gradient : ColourVars.background0}
        padding={["sm", "md", "lg"]}
        minHeight={"5rem"}>
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
                    <Container
                        gap={"sm"}
                        background={ColourVars.textTertiary}
                        borderRadius={"xxl"}
                        minHeight={"3.5rem"}
                        maxHeight={"calc(var(--vh, 1vh) * 50)"}
                        padding={["zero", "xs", "xs", "xs"]}
                        crossAxisAlignment={"end"}
                        mainAxisAlignment={"spaceBetween"}
                        supplementalClass={"message_entry_text_box"}>
                        <IconButton
                            onclick={toggleEmojiPicker}
                            padding={["sm", "zero", "md", "sm"]}
                            size={"md"}>
                            {#snippet icon()}
                                {#if showEmojiPicker}
                                    <Keyboard color={ColourVars.textPlaceholder} />
                                {:else}
                                    <StickerEmoji color={ColourVars.textPlaceholder} />
                                {/if}
                            {/snippet}
                        </IconButton>
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
                            class:empty={textboxEmpty}
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
                            oninput={onInput}
                            onkeypress={keyPress}>
                        </div>

                        <Container
                            padding={["zero", "sm", "zero", "zero"]}
                            width={"hug"}
                            gap={"md"}>
                            <IconButton
                                onclick={() =>
                                    (showCustomMessageTrigger = !showCustomMessageTrigger)}
                                padding={["sm", "zero", "md", "zero"]}
                                size={"md"}>
                                {#snippet icon()}
                                    <div
                                        class:open={showCustomMessageTrigger}
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
                                                <Camera color={ColourVars.textPlaceholder} />
                                            {/snippet}
                                        </IconButton>
                                    {/snippet}
                                </FileAttacher>
                            {/if}
                        </Container>

                        {#if containsMarkdown}
                            <MarkdownToggle {editingEvent} />
                        {/if}
                    </Container>
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
                        <IconButton mode={"dark"} size={"lg"} padding={"md"} onclick={sendMessage}>
                            {#snippet icon(color)}
                                <ContentSaveEditOutline {color} />
                            {/snippet}
                        </IconButton>
                        <IconButton mode={"dark"} size={"lg"} padding={"md"} onclick={onCancelEdit}>
                            {#snippet icon(color)}
                                <Close {color} />
                            {/snippet}
                        </IconButton>
                    {/if}
                </Container>
            {/if}
        {/if}
    </Container>

    {#if showEmojiPicker}
        <EmojiOrGif
            empty={textboxEmpty}
            ctx={messageContext}
            onEmojiSelected={insertEmoji}
            onBackspace={backspace}
            onClose={toggleEmojiPicker} />
    {/if}
{/if}
<CustomMessageTrigger
    {permittedMessages}
    {onTokenTransfer}
    {onCreatePrizeMessage}
    {onCreateP2PSwapMessage}
    {onMakeMeme}
    {onClearAttachment}
    {onFileSelected}
    {messageContext}
    bind:open={showCustomMessageTrigger} />

<style lang="scss">
    :global(.container.message_entry_text_box) {
        border-radius: toRem(32) !important;
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
        overflow-y: auto;
        user-select: text;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        flex: auto;
        font-size: var(--typo-body-sz);
        line-height: var(--typo-body-lh);
        color: var(--text-primary);

        &.empty:before {
            content: attr(placeholder);
            color: var(--text-placeholder);
            pointer-events: none;
            display: block; /* For Firefox */
            position: absolute;
        }

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
</style>
