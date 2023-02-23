<script lang="ts">
    import Send from "svelte-material-icons/Send.svelte";
    import ContentSaveEditOutline from "svelte-material-icons/ContentSaveMoveOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import AudioAttacher from "./AudioAttacher.svelte";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Progress from "../Progress.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import MentionPicker from "./MentionPicker.svelte";
    import EmojiAutocompleter from "./EmojiAutocompleter.svelte";
    import type {
        PartialUserSummary,
        User,
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        GroupChatSummary,
        Message,
        MessageAction,
        MessageContent,
        Member,
        Questions,
        OpenChat,
    } from "openchat-client";
    import { allQuestions, cryptoCurrencyList, cryptoLookup } from "openchat-client";
    import Button from "../Button.svelte";
    import { enterSend } from "../../stores/settings";
    import MessageActions from "./MessageActions.svelte";
    import { addQueryStringParam } from "../../utils/urls";
    import { toastStore } from "../../stores/toast";

    const client = getContext<OpenChat>("client");

    export let chat: ChatSummary;
    export let blocked: boolean;
    export let preview: boolean;
    export let canSend: boolean;
    export let messageAction: MessageAction = undefined;
    export let joining: GroupChatSummary | undefined;
    export let fileToAttach: MessageContent | undefined;
    export let editingEvent: EventWrapper<Message> | undefined;
    export let replyingTo: EnhancedReplyContext | undefined;
    export let textContent: string | undefined;
    export let members: Member[];
    export let blockedUsers: Set<string>;
    export let mode: "thread" | "message" = "message";

    const USER_TYPING_EVENT_MIN_INTERVAL_MS = 1000; // 1 second
    const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

    const reverseUserLookup: Record<string, string> = {};
    const mentionRegex = /@([\d\w_]*)$/;
    const emojiRegex = /:([\w_]+):?$/;
    const dispatch = createEventDispatcher();
    let inp: HTMLDivElement;
    let audioMimeType = client.audioRecordingMimeType();
    let selectedRange: Range | undefined;
    let dragging: boolean = false;
    let recording: boolean = false;
    let percentRecorded: number = 0;
    let previousEditingEvent: EventWrapper<Message> | undefined;
    let lastTypingUpdate: number = 0;
    let typingTimer: number | undefined = undefined;
    let audioSupported: boolean = "mediaDevices" in navigator;
    let showMentionPicker = false;
    let showEmojiSearch = false;
    let mentionPrefix: string | undefined;
    let emojiQuery: string | undefined;
    let messageEntryHeight: number;
    let messageActions: MessageActions;
    let rangeToReplace: [number, number] | undefined = undefined;
    let isSuperAdmin = client.isSuperAdmin();
    let freezingInProgress = false;
    let tokens = cryptoCurrencyList
        .filter((t) => !cryptoLookup[t].disabled)
        .map((t) => t.toLowerCase())
        .join("|");
    let tokenMatchRegex = new RegExp(`^\/(${tokens}) *(\d*[.,]?\d*)$`);

    // Update this to force a new textbox instance to be created
    let textboxId = Symbol();

    $: userStore = client.userStore;
    $: userId = chat.kind === "direct_chat" ? chat.them : "";
    $: isGroup = chat.kind === "group_chat";
    $: isBot = $userStore[userId]?.kind === "bot";
    $: messageIsEmpty = (textContent?.trim() ?? "").length === 0 && fileToAttach === undefined;
    $: isFrozen = client.isFrozen(chat.chatId);
    $: pollsAllowed = isGroup && !isBot && client.canCreatePolls(chat.chatId);

    $: {
        if (inp) {
            if (editingEvent && editingEvent.index !== previousEditingEvent?.index) {
                if (editingEvent.event.content.kind === "text_content") {
                    inp.textContent = formatMentions(editingEvent.event.content.text);
                    selectedRange = undefined;
                    restoreSelection();
                } else if ("caption" in editingEvent.event.content) {
                    inp.textContent = editingEvent.event.content.caption ?? "";
                    selectedRange = undefined;
                    restoreSelection();
                }
                previousEditingEvent = editingEvent;
            } else {
                const text = textContent ?? "";
                // Only set the textbox text when required rather than every time, because doing so sets the focus back to
                // the start of the textbox on some devices.
                if (inp.textContent !== text) {
                    inp.textContent = text;
                    // TODO - figure this out
                    // setCaretToEnd();
                }
            }
        }

        if (editingEvent === undefined) {
            previousEditingEvent = undefined;
        }
    }

    $: {
        if (fileToAttach !== undefined || replyingTo !== undefined) {
            inp?.focus();
        }
    }

    $: {
        if ($screenWidth === ScreenWidth.Large) {
            inp?.focus();
        }
    }

    $: placeholder =
        fileToAttach !== undefined
            ? $_("enterCaption")
            : dragging
            ? $_("dropFile")
            : $_("enterMessage");

    export function replaceSelection(text: string) {
        restoreSelection();
        let range = window.getSelection()?.getRangeAt(0);
        if (range !== undefined) {
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            const inputContent = inp.textContent ?? "";
            dispatch("setTextContent", inputContent.trim().length === 0 ? undefined : inputContent);
        }
    }

    function onInput() {
        const inputContent = inp.textContent ?? "";
        dispatch("setTextContent", inputContent.trim().length === 0 ? undefined : inputContent);
        triggerMentionLookup(inputContent);
        triggerEmojiLookup(inputContent);
        triggerTypingTimer();
    }

    function uptoCaret(
        inputContent: string | null,
        fn: (slice: string, pos: number) => void
    ): void {
        if (inputContent === null) return;

        const pos = window.getSelection()?.anchorOffset;
        if (pos === undefined) return;

        const slice = inputContent.slice(0, pos);
        fn(slice, pos);
    }

    function triggerEmojiLookup(inputContent: string | null): void {
        uptoCaret(inputContent, (slice: string, pos: number) => {
            const matches = slice.match(emojiRegex);
            if (matches !== null) {
                if (matches.index !== undefined) {
                    rangeToReplace = [matches.index, pos];
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
        uptoCaret(inputContent, (slice: string, pos: number) => {
            const matches = slice.match(mentionRegex);
            if (matches !== null) {
                if (matches.index !== undefined) {
                    rangeToReplace = [matches.index, pos];
                    mentionPrefix = matches[1].toLowerCase() || undefined;
                    showMentionPicker = true;
                }
            } else {
                showMentionPicker = false;
                mentionPrefix = undefined;
            }
        });
    }

    function triggerTypingTimer() {
        requestAnimationFrame(() => {
            const now = Date.now();
            if (now - lastTypingUpdate > USER_TYPING_EVENT_MIN_INTERVAL_MS) {
                lastTypingUpdate = now;
                dispatch("startTyping");
            }
            if (typingTimer !== undefined) {
                clearTimeout(typingTimer);
            }

            typingTimer = setTimeout(() => dispatch("stopTyping"), MARK_TYPING_STOPPED_INTERVAL_MS);
        });
    }

    function keyPress(e: KeyboardEvent) {
        if (e.key === "Enter" && $enterSend && !e.shiftKey) {
            if (!messageIsEmpty) {
                sendMessage();
            }
            e.preventDefault();
        }
    }

    function formatMentions(text: string): string {
        return text.replace(/@UserId\(([\d\w-]+)\)/g, (match, p1) => {
            const u = $userStore[p1] as PartialUserSummary | undefined;
            if (u?.username !== undefined) {
                const username = u.username;
                reverseUserLookup[username] = u.userId;
                return `@${username}`;
            }
            return match;
        });
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
            } else {
                console.log(
                    `Could not find the userId for user: ${p1}, this should not really happen`
                );
            }
            return match;
        });

        let mentioned = Array.from(mentionedMap, ([userId, username]) => ({ userId, username }));

        return [expandedText, mentioned];
    }

    /**
     * Check the message content for special commands
     * * !poll - creates a poll
     * * !icp [amount]
     * * !search [term]
     * * !pinned - opens pinned messages (not yet)
     * * !details - opens group details (not yet)
     */
    function parseCommands(txt: string): boolean {
        if (isGroup && /^\/poll$/.test(txt)) {
            dispatch("createPoll");
            return true;
        }

        const testMsgMatch = txt.match(/^\/test-msg (\d+)/);
        if (testMsgMatch && testMsgMatch[1] !== undefined) {
            dispatch("createTestMessages", Number(testMsgMatch[1]));
            return true;
        }

        const searchMatch = txt.match(/^\/search( *(.*))$/);
        if (searchMatch && searchMatch[2] !== undefined) {
            dispatch("searchChat", searchMatch[2]);
            return true;
        }

        const gifMatch = txt.match(/^\/gif( *(.*))$/);
        if (gifMatch && gifMatch[2] !== undefined) {
            dispatch("attachGif", gifMatch[2]);
            return true;
        }

        if (chat.kind === "group_chat") {
            const faqMatch = txt.match(/^\/faq( *(.*))$/);
            if (faqMatch && faqMatch[2] !== undefined) {
                if (allQuestions.includes(faqMatch[2] as Questions)) {
                    const url = addQueryStringParam(new URLSearchParams(), "faq", faqMatch[2]);
                    dispatch("sendMessage", [
                        `[🤔 FAQ: ${$_(`faq.${faqMatch[2]}_q`)}](#${url})`,
                        [],
                    ]);
                } else {
                    const url = addQueryStringParam(new URLSearchParams(), "faq", "");
                    dispatch("sendMessage", [`[🤔 FAQs](#${url})`, []]);
                }
                return true;
            }
        }

        if (/^\/diamond$/.test(txt)) {
            const url = addQueryStringParam(new URLSearchParams(), "diamond", "");
            dispatch("sendMessage", [`[${$_("upgrade.message")}](#${url})`, []]);
            return true;
        }

        const tokenMatch = txt.match(tokenMatchRegex);
        if (tokenMatch && tokenMatch[2] !== undefined) {
            dispatch("tokenTransfer", {
                token: tokenMatch[1],
                amount: client.validateTokenInput(tokenMatch[2]).e8s,
            });
            return true;
        }
        return false;
    }

    function cancelEdit() {
        dispatch("cancelEditEvent");
    }

    function sendMessage() {
        const txt = inp.innerText?.trim();

        if (!parseCommands(txt)) {
            dispatch("sendMessage", expandMentions(txt));
        }
        inp.textContent = "";
        dispatch("setTextContent", undefined);

        messageActions?.close();
        dispatch("stopTyping");

        // After sending a message we must force a new textbox instance to be created, otherwise on iPhone the
        // predictive text doesn't notice the text has been cleared so the suggestions don't make sense.
        textboxId = Symbol();
        tick().then(() => inp.focus());
    }

    export function saveSelection() {
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

    function setCaretTo(pos: number) {
        const range = document.createRange();
        range.selectNodeContents(inp);
        range.setStart(inp.childNodes[0], pos);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    function onDrop(e: DragEvent) {
        dragging = false;
        dispatch("drop", e);
    }

    function replaceTextWith(replacement: string) {
        if (rangeToReplace === undefined) return;

        const start = rangeToReplace[0];

        const replaced = `${inp.textContent?.slice(
            0,
            rangeToReplace[0]
        )}${replacement} ${inp.textContent?.slice(rangeToReplace[1])}`;
        inp.textContent = replaced;

        dispatch("setTextContent", inp.textContent || undefined);

        tick().then(() => {
            setCaretTo(start + replacement.length);
        });

        rangeToReplace = undefined;
    }

    function mention(ev: CustomEvent<string>): void {
        const user = $userStore[ev.detail];
        const username = user?.username ?? $_("unknown");
        const userLabel = `@${username}`;

        replaceTextWith(userLabel);

        showMentionPicker = false;
        if (user !== undefined) {
            reverseUserLookup[username] = user.userId;
        }
    }

    function cancelMention() {
        showMentionPicker = false;
        setCaretToEnd();
    }

    function completeEmoji(ev: CustomEvent<string>) {
        replaceTextWith(ev.detail);
        showEmojiSearch = false;
    }

    function joinGroup() {
        dispatch("joinGroup", {
            group: chat,
            select: true,
        });
    }

    function cancelPreview() {
        dispatch("cancelPreview", chat.chatId);
    }

    function freezeGroup() {
        freezingInProgress = true;
        client.freezeGroup(chat.chatId, undefined).then((success) => {
            if (!success) {
                toastStore.showFailureToast("failedToFreezeGroup");
            }
            freezingInProgress = false;
        });
    }

    function unfreezeGroup() {
        freezingInProgress = true;
        client.unfreezeGroup(chat.chatId).then((success) => {
            if (!success) {
                toastStore.showFailureToast("failedToUnfreezeGroup");
            }
            freezingInProgress = false;
        });
    }
</script>

{#if showMentionPicker}
    <MentionPicker
        {blockedUsers}
        offset={messageEntryHeight}
        on:close={cancelMention}
        on:mention={mention}
        prefix={mentionPrefix}
        {members} />
{/if}

{#if showEmojiSearch}
    <EmojiAutocompleter
        offset={messageEntryHeight}
        on:close={() => (showEmojiSearch = false)}
        on:select={completeEmoji}
        query={emojiQuery} />
{/if}

<div
    class="message-entry"
    class:editing={editingEvent !== undefined}
    bind:clientHeight={messageEntryHeight}>
    {#if blocked}
        <div class="blocked">
            {$_("userIsBlocked")}
        </div>
    {:else if preview}
        <div class="preview">
            {#if isSuperAdmin}
                {#if isFrozen}
                    <Button
                        loading={freezingInProgress}
                        secondary={true}
                        small={true}
                        on:click={unfreezeGroup}>
                        {$_("unfreezeGroup")}
                    </Button>
                {:else}
                    <Button
                        loading={freezingInProgress}
                        secondary={true}
                        small={true}
                        on:click={freezeGroup}>
                        {$_("freezeGroup")}
                    </Button>
                {/if}
            {/if}
            <Button secondary={true} small={true} on:click={cancelPreview}>
                {$_("leave")}
            </Button>
            <Button
                loading={joining !== undefined}
                disabled={joining !== undefined}
                small={true}
                on:click={joinGroup}>
                {$_("joinGroup")}
            </Button>
        </div>
    {:else if !canSend}
        <div class="disabled">
            {mode === "thread" ? $_("readOnlyThread") : $_("readOnlyChat")}
        </div>
    {:else}
        {#if recording}
            <div class="recording">
                <Progress percent={percentRecorded} />
            </div>
        {/if}
        {#key textboxId}
            <div
                tabindex={0}
                bind:this={inp}
                on:blur={saveSelection}
                class="textbox"
                class:recording
                class:dragging
                contenteditable
                on:paste
                {placeholder}
                spellcheck
                on:dragover={() => (dragging = true)}
                on:dragenter={() => (dragging = true)}
                on:dragleave={() => (dragging = false)}
                on:drop={onDrop}
                on:input={onInput}
                on:keypress={keyPress} />
        {/key}
        {#if editingEvent === undefined}
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
            <!-- we might need this if we are editing too -->
            <MessageActions
                bind:this={messageActions}
                bind:messageAction
                {fileToAttach}
                {mode}
                {pollsAllowed}
                editing={editingEvent !== undefined}
                on:tokenTransfer
                on:attachGif
                on:createPoll
                on:upgrade
                on:clearAttachment
                on:fileSelected />
        {:else}
            <div class="send" on:click={sendMessage}>
                <HoverIcon>
                    <ContentSaveEditOutline size={$iconSize} color={"var(--button-txt)"} />
                </HoverIcon>
            </div>
            <div class="send" on:click={cancelEdit}>
                <HoverIcon>
                    <Close size={$iconSize} color={"var(--button-txt)"} />
                </HoverIcon>
            </div>
        {/if}
    {/if}
</div>

<style type="text/scss">
    .message-entry {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--entry-bg);
        padding: $sp3;
        border-top: 1px solid var(--bd);
        min-height: toRem(60);

        &.editing {
            background-color: var(--button-bg);
        }
    }
    .send {
        flex: 0 0 15px;
    }
    .textbox {
        flex: 1;
        margin: 0 $sp3;
        padding: toRem(12) $sp4 $sp3 $sp4;
        background-color: var(--entry-input-bg);
        border-radius: $sp3;
        outline: none;
        border: 0;
        max-height: 100px;
        min-height: toRem(30);
        overflow-x: hidden;
        overflow-y: auto;
        user-select: text;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        border: 1px solid transparent;
        box-shadow: var(--entry-input-sh);

        &:empty:before {
            content: attr(placeholder);
            color: var(--placeholder);
            pointer-events: none;
            display: block; /* For Firefox */
        }

        &.dragging {
            border: 1px dashed var(--txt);
        }

        &.recording {
            display: none;
        }
    }

    .blocked,
    .disabled,
    .preview {
        height: 42px;
        color: var(--txt);
        @include font(book, normal, fs-100);
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
    }

    .preview {
        justify-content: flex-end;
        gap: $sp3;
        @include mobile() {
            justify-content: center;
        }
    }

    .recording {
        padding: 0 $sp3;
        flex: auto;
    }
</style>
