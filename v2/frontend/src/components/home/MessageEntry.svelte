<script lang="ts">
    import Paperclip from "svelte-material-icons/Paperclip.svelte";
    import EmoticonHappyOutline from "svelte-material-icons/EmoticonHappyOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { onMount } from "svelte";
    import Lazy from "../Lazy.svelte";
    import { emojiStore } from "../../stores/emoji";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";

    export let machine: ActorRefFrom<ChatMachine>;

    const EmojiPicker = () => import("./EmojiPicker.svelte");

    let inp: HTMLDivElement;
    let showEmojiPicker = false;
    let selectedRange: Range | undefined;

    onMount(() => {
        inp.focus();
    });

    function checkEnter(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            sendMessage();
            e.preventDefault();
        }
    }

    function onPaste(e: ClipboardEvent) {
        e.preventDefault();
        const text = e.clipboardData?.getData("text/plain");
        document.execCommand("insertText", false, text);
        console.log(text);
    }

    function sendMessage() {
        if (inp.textContent) {
            machine.send({ type: "SEND_MESSAGE", data: inp.textContent });
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
        if ($machine.changed && $machine.context.replyingTo !== undefined) {
            inp.focus();
        }
    }
</script>

<div class="message-entry">
    {#if showEmojiPicker}
        <Lazy component={EmojiPicker} />
    {/if}

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
        <HoverIcon>
            <Paperclip size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </div>
    <div
        tabindex={0}
        bind:this={inp}
        on:blur={saveSelection}
        class="textbox"
        contenteditable={true}
        on:paste={onPaste}
        placeholder="Type a message"
        spellcheck={true}
        on:keypress={checkEnter} />
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
        @include font(book, normal, fs-100);
    }
</style>
