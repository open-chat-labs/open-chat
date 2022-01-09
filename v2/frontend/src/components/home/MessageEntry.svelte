<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import FileAttacher from "./FileAttacher.svelte";
    import AudioAttacher from "./AudioAttacher.svelte";
    import { emojiStore } from "../../stores/emoji";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import Progress from "../Progress.svelte";
    import type { ChatController } from "../../fsm/chat.controller";
    import { iconSize } from "../../stores/iconSize";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import Smiley from "./Smiley.svelte";
    import { audioRecordingMimeType } from "../../utils/media";
    import MentionPicker from "./MentionPicker.svelte";
    import { userStore } from "stores/user";
    import EmojiAutocompleter from "./EmojiAutocompleter.svelte";
    import type { User } from "../../domain/user/user";
    import Button from "../Button.svelte";

    export let controller: ChatController;
    export let blocked: boolean;
    export let preview: boolean;
    export let showEmojiPicker = false;

    let joining = false;

    $: textContent = controller.textContent;
    $: editingEvent = controller.editingEvent;
    $: fileToAttach = controller.fileToAttach;
    $: participants = controller.participants;
    $: blockedUsers = controller.blockedUsers;
    $: chat = controller.chat;

    $: console.log("Previewing: ", $chat.kind === "group_chat" && $chat.myRole === "previewer");

    const USER_TYPING_EVENT_MIN_INTERVAL_MS = 1000; // 1 second
    const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

    const reverseUserLookup: Record<string, string> = {};
    const mentionRegex = /@([\d\w_]*)$/;
    const emojiRegex = /:([\w_]*):?$/;
    const dispatch = createEventDispatcher();
    let inp: HTMLDivElement;
    let audioMimeType = audioRecordingMimeType();
    let selectedRange: Range | undefined;
    let dragging: boolean = false;
    let recording: boolean = false;
    let percentRecorded: number = 0;
    let initialisedEdit: boolean = false;
    let lastTypingUpdate: number = 0;
    let typingTimer: number | undefined = undefined;
    let audioSupported: boolean = "mediaDevices" in navigator;
    let inputIsEmpty = true;
    let showMentionPicker = false;
    let showEmojiSearch = false;
    let mentionPrefix: string | undefined;
    let emojiQuery: string | undefined;
    let messageEntry: HTMLDivElement;

    $: messageIsEmpty = true;

    $: {
        if ($editingEvent && !initialisedEdit) {
            if ($editingEvent.event.content.kind === "text_content") {
                inp.textContent = $editingEvent.event.content.text;
                selectedRange = undefined;
                restoreSelection();
                initialisedEdit = true;
            }
        } else if (inp) {
            const text = $textContent ?? "";
            // Only set the textbox text when required rather than every time, because doing so sets the focus back to
            // the start of the textbox on some devices.
            if (inp.textContent !== text) {
                inp.textContent = text;
            }
        }
        if ($editingEvent === undefined) {
            initialisedEdit = false;
        }
    }

    $: {
        if ($fileToAttach !== undefined) {
            inp.focus();
        }
    }

    $: {
        if (controller && $screenWidth === ScreenWidth.Large) {
            inp?.focus();
        }
    }

    $: {
        messageIsEmpty = inputIsEmpty && $fileToAttach === undefined;
    }

    $: {
        if ($emojiStore !== undefined) {
            if (inp) {
                restoreSelection();
                document.execCommand("insertText", false, $emojiStore);
                inputIsEmpty = false;
                saveSelection();
                emojiStore.set(undefined);
            }
        }
    }

    // todo - doubt this will react properly
    $: placeholder =
        $fileToAttach !== undefined
            ? $_("enterCaption")
            : dragging
            ? $_("dropFile")
            : $_("enterMessage");

    function onInput() {
        const content = inp.textContent;
        const trimmedContent = content?.trim();
        inputIsEmpty = (trimmedContent?.length ?? 0) === 0;
        controller.setTextContent(inputIsEmpty ? undefined : content!);
        triggerMentionLookup(content);
        triggerEmojiLookup(content);
        triggerTypingTimer();
    }

    function triggerEmojiLookup(inputContent: string | null): void {
        if (inputContent === null) return;

        const matches = inputContent.match(emojiRegex);
        if (matches !== null) {
            emojiQuery = matches[1].toLowerCase() || undefined;
            showEmojiSearch = true;
        } else {
            showEmojiSearch = false;
            emojiQuery = undefined;
        }
    }

    function triggerMentionLookup(inputContent: string | null): void {
        if (inputContent === null) return;

        const matches = inputContent.match(mentionRegex);
        if (matches !== null) {
            mentionPrefix = matches[1].toLowerCase() || undefined;
            controller.loadDetails().then(() => {
                showMentionPicker = true;
                saveSelection();
            });
        } else {
            showMentionPicker = false;
            mentionPrefix = undefined;
        }
    }

    function triggerTypingTimer() {
        requestAnimationFrame(() => {
            const now = Date.now();
            if (now - lastTypingUpdate > USER_TYPING_EVENT_MIN_INTERVAL_MS) {
                lastTypingUpdate = now;
                controller.startTyping();
            }
            if (typingTimer !== undefined) {
                clearTimeout(typingTimer);
            }

            typingTimer = setTimeout(
                () => controller.stopTyping(),
                MARK_TYPING_STOPPED_INTERVAL_MS
            );
        });
    }

    function keyPress(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            if (!messageIsEmpty) {
                sendMessage();
                controller.stopTyping();
            }
            e.preventDefault();
        }
    }

    // replace anything of the form @username with @UserId(xyz) where xyz is the userId
    // if we don't have the mapping, just leave it as is (we *will* have the mapping)
    function expandMentions(text?: string): [string | undefined, User[]] {
        let mentionedMap = new Map<string, string>();
        let expandedText = text?.replace(/@([\w\d_]*)/g, (match, p1) => {
            const userId = reverseUserLookup[p1];
            if (userId !== undefined) {
                mentionedMap.set(userId, p1);
                return `@UserId(${userId})`;
            }
            return match;
        });

        let mentioned = Array.from(mentionedMap, ([userId, username]) => ({ userId, username }));

        return [expandedText, mentioned];
    }

    function sendMessage() {
        dispatch("sendMessage", expandMentions(inp.textContent?.trim()));
        inp.textContent = "";
        inp.focus();
        inputIsEmpty = true;
        messageIsEmpty = true;
        showEmojiPicker = false;
    }

    function toggleEmojiPicker() {
        showEmojiPicker = !showEmojiPicker;
    }

    function saveSelection() {
        try {
            // seeing errors in the logs to do with this
            selectedRange = window.getSelection()?.getRangeAt(0);
        } catch (_err) {}
    }

    function restoreSelection() {
        inp.focus();
        if (!selectedRange) {
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
        const range = document.createRange();
        range.selectNodeContents(inp);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    function onDrop(e: DragEvent) {
        dragging = false;
        dispatch("drop", e);
    }

    function clearAttachment() {
        controller.clearAttachment();
    }

    function mention(ev: CustomEvent<string>): void {
        const user = $userStore[ev.detail];
        const username = user?.username ?? $_("unknown");
        inp.textContent = inp.textContent?.replace(mentionRegex, `@${username}`) || null;
        controller.setTextContent(inp.textContent || undefined);
        showMentionPicker = false;
        setCaretToEnd();

        if (user !== undefined) {
            reverseUserLookup[username] = user.userId;
        }
    }

    function cancelMention() {
        showMentionPicker = false;
        setCaretToEnd();
    }

    function completeEmoji(ev: CustomEvent<string>) {
        inp.textContent = inp.textContent?.replace(emojiRegex, ev.detail) || null;
        controller.setTextContent(inp.textContent || undefined);
        showEmojiSearch = false;
        setCaretToEnd();
    }

    function joinGroup() {
        joining = true;
        controller
            .joinGroup()
            .then((maybeChat) => {
                if (maybeChat !== undefined) {
                    dispatch("updateChat", maybeChat);
                }
            })
            .finally(() => (joining = false));
    }
</script>

{#if showMentionPicker}
    <MentionPicker
        blockedUsers={$blockedUsers}
        offset={messageEntry.clientHeight}
        on:close={cancelMention}
        on:mention={mention}
        prefix={mentionPrefix}
        participants={$participants} />
{/if}

{#if showEmojiSearch}
    <EmojiAutocompleter
        offset={messageEntry.clientHeight}
        on:close={() => (showEmojiSearch = false)}
        on:select={completeEmoji}
        query={emojiQuery} />
{/if}

<div class="message-entry" bind:this={messageEntry}>
    {#if blocked}
        <div class="blocked">
            {$_("userIsBlocked")}
        </div>
    {:else if preview}
        <div class="preview">
            <Button loading={joining} disabled={joining} small={true} on:click={joinGroup}>
                {$_("joinGroup")}
            </Button>
        </div>
    {:else}
        <div class="emoji" on:click={toggleEmojiPicker}>
            {#if showEmojiPicker}
                <HoverIcon>
                    <Close size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            {:else}
                <HoverIcon>
                    <Smiley />
                </HoverIcon>
            {/if}
        </div>
        <div class="attach">
            <FileAttacher
                open={$fileToAttach !== undefined}
                on:fileSelected
                on:close={clearAttachment} />
        </div>

        {#if recording}
            <Progress percent={percentRecorded} />
        {/if}
        <div
            tabindex={0}
            bind:this={inp}
            on:blur={saveSelection}
            class="textbox"
            class:recording
            class:dragging
            contenteditable={true}
            on:paste
            {placeholder}
            spellcheck={true}
            on:dragover={() => (dragging = true)}
            on:dragenter={() => (dragging = true)}
            on:dragleave={() => (dragging = false)}
            on:drop={onDrop}
            on:input={onInput}
            on:keypress={keyPress} />
        {#if messageIsEmpty && audioMimeType !== undefined && audioSupported}
            <div class="record">
                <AudioAttacher
                    mimeType={audioMimeType}
                    bind:percentRecorded
                    bind:recording
                    bind:supported={audioSupported}
                    on:audioCaptured />
            </div>
        {:else}
            <div class="send" on:click={sendMessage}>
                <HoverIcon>
                    <Send size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
        {/if}
    {/if}
</div>

<style type="text/scss">
    .message-entry {
        position: relative;
        flex: 0 0 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--entry-bg);
        padding: $sp3;
    }
    .emoji,
    .attach,
    .send {
        flex: 0 0 15px;
    }
    .textbox {
        flex: 1;
        margin: 0 $sp3;
        padding: 6px $sp4;
        background-color: var(--entry-input-bg);
        color: var(--entry-input-txt);
        border-radius: 20px;
        outline: none;
        border: 0;
        max-height: 100px;
        min-height: 30px;
        overflow-x: hidden;
        overflow-y: auto;
        user-select: text;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        border: 1px solid transparent;
        @include font(book, normal, fs-100);

        &:empty:before {
            content: attr(placeholder);
            color: var(--placeholder);
            pointer-events: none;
            display: block; /* For Firefox */
        }

        &.dragging {
            border: 1px dashed var(--entry-input-txt);
        }

        &.recording {
            display: none;
        }
    }

    .blocked,
    .preview {
        height: 42px;
        color: var(--entry-input-txt);
        @include font(book, normal, fs-100);
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
    }

    .preview {
        justify-content: flex-end;
    }
</style>
