<script lang="ts">
    import EmoticonHappyOutline from "svelte-material-icons/EmoticonHappyOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { onMount } from "svelte";
    import FileAttacher from "./FileAttacher.svelte";
    import AudioAttacher from "./AudioAttacher.svelte";
    import { emojiStore } from "../../stores/emoji";
    import { createEventDispatcher } from "svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import { _ } from "svelte-i18n";
    import Progress from "../Progress.svelte";

    export let machine: ActorRefFrom<ChatMachine>;

    const dispatch = createEventDispatcher();
    let inp: HTMLDivElement;
    export let showEmojiPicker = false;
    let selectedRange: Range | undefined;
    let dragging: boolean = false;
    let recording: boolean = false;
    let percentRecorded: number = 0;

    onMount(() => {
        inp.focus();
    });

    function checkEnter(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            sendMessage();
            e.preventDefault();
        }
    }

    function sendMessage() {
        if (inp.textContent || $machine.context.fileToAttach) {
            machine.send({ type: "SEND_MESSAGE", data: inp.textContent ?? undefined });
            inp.textContent = "";
            showEmojiPicker = false;
        }
    }

    function toggleEmojiPicker() {
        showEmojiPicker = !showEmojiPicker;
    }

    function saveSelection() {
        selectedRange = window.getSelection()?.getRangeAt(0);
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

    function onDrop(e: DragEvent) {
        dragging = false;
        dispatch("drop", e);
    }

    function clearAttachment() {
        machine.send({ type: "CLEAR_ATTACHMENT" });
    }

    $: {
        if ($emojiStore !== undefined) {
            if ($emojiStore.native && inp) {
                restoreSelection();
                document.execCommand("insertText", false, $emojiStore.native);
                saveSelection();
                emojiStore.set(undefined);
            }
        }
    }

    $: {
        if (
            $machine.changed &&
            ($machine.context.replyingTo !== undefined ||
                $machine.context.fileToAttach !== undefined)
        ) {
            inp.focus();
        }
    }
</script>

<div class="message-entry">
    <div class="emoji" on:click={toggleEmojiPicker}>
        {#if showEmojiPicker}
            <HoverIcon>
                <Close size={"1.2em"} color={"#aaa"} />
            </HoverIcon>
        {:else}
            <HoverIcon>
                <EmoticonHappyOutline size={"1.2em"} color={"#aaa"} />
            </HoverIcon>
        {/if}
    </div>
    <div class="attach">
        <FileAttacher
            open={$machine.context.fileToAttach !== undefined}
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
        placeholder={$machine.context.fileToAttach !== undefined
            ? $_("enterCaption")
            : dragging
            ? $_("dropFile")
            : $_("enterMessage")}
        spellcheck={true}
        on:dragover={() => (dragging = true)}
        on:dragenter={() => (dragging = true)}
        on:dragleave={() => (dragging = false)}
        on:drop={onDrop}
        on:keypress={checkEnter} />
    <div class="record">
        <AudioAttacher bind:percentRecorded bind:recording on:audioCaptured />
    </div>
    <div class="send" on:click={sendMessage}>
        <HoverIcon>
            <Send size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </div>
</div>

<style type="text/scss">
    .message-entry {
        position: relative;
        flex: 0 0 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--entry-bg);
        border-top: 1px solid var(--entry-bd);
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
        padding: $sp3 $sp4;
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
            color: #ccc;
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
</style>
