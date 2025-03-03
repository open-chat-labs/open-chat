<script lang="ts">
    import MarkdownToggle from "./MarkdownToggle.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { translatable } from "../../actions/translatable";
    import { _ } from "svelte-i18n";
    import type { FormEventHandler } from "svelte/elements";
    import { getContext, onMount } from "svelte";
    import { type OpenChat, type ResourceKey } from "openchat-client";
    import type { EventWrapper, Message } from "openchat-client";

    interface Props {
        checkIfMessageIsEmpty?: () => boolean;
        containsMarkdown?: boolean;
        disabled?: boolean;
        dragging?: boolean;
        editingEvent?: EventWrapper<Message> | undefined;
        excessiveLinks?: boolean;
        keyPress?: FormEventHandler<HTMLDivElement>;
        light?: boolean;
        messageIsEmpty?: boolean;
        minLines?: number | undefined;
        placeholder?: ResourceKey | undefined;
        recording?: boolean;
        onDragEnter?: FormEventHandler<HTMLDivElement>;
        onDragLeave?: FormEventHandler<HTMLDivElement>;
        onDragOver?: FormEventHandler<HTMLDivElement>;
        onDrop?: FormEventHandler<HTMLDivElement>;
        onInput: (value: string) => void;
        saveSelection?: FormEventHandler<HTMLDivElement>;
        textContent?: string | undefined;
    }

    let {
        onInput,
        textContent = "",
        excessiveLinks = false,
        placeholder = i18nKey("enterMessage"),
        disabled = false,
        light = false,
        messageIsEmpty = true,
        containsMarkdown = false,
        editingEvent = undefined,
        dragging = false,
        recording = false,
        minLines = undefined,
        checkIfMessageIsEmpty = () => true,
        onDrop = (_) => {},
        keyPress = (_) => {},
        saveSelection = (_) => {},
        onDragOver = () => {
            dragging = true;
        },
        onDragEnter = () => {
            dragging = true;
        },
        onDragLeave = () => {
            dragging = false;
        },
    }: Props = $props();

    let inp: HTMLDivElement;
    const client = getContext<OpenChat>("client");

    // Handles placeholder show/hide
    messageIsEmpty = (textContent?.trim() ?? "").length === 0 && checkIfMessageIsEmpty();
    excessiveLinks = client.extractEnabledLinks(textContent ?? "").length > 5;

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

    let baseInpHeight = $state(0);
    let inpLineHeight = 24;
    onMount(() => {
        setTimeout(() => {
            if (inp) {
                baseInpHeight = inp.offsetHeight;
            }
        }, 0);
    });
</script>

<div class="container">
    {#if excessiveLinks}
        <div class="note">{$_("excessiveLinksNoste")}</div>
    {/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
    <div
        data-gram="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        tabindex={0}
        bind:this={inp}
        class="textbox"
        class:recording
        class:dragging
        class:disabled
        class:light
        class:empty={messageIsEmpty}
        contenteditable
        placeholder={interpolate($_, placeholder)}
        spellcheck
        style={typeof minLines === "number" && minLines > 1
            ? `min-height: ${baseInpHeight + (minLines - 1) * inpLineHeight}px`
            : ""}
        use:translatable={{
            key: placeholder,
            position: "absolute",
            right: 12,
            top: 12,
        }}
        oninput={() => {
            textContent = inp.textContent ?? "";
            containsMarkdown = detectMarkdown(textContent);
            onInput(textContent);
        }}
        onkeypress={keyPress}
        onblur={saveSelection}
        ondragover={onDragOver}
        ondragenter={onDragEnter}
        ondragleave={onDragLeave}
        ondrop={onDrop}>
    </div>

    {#if containsMarkdown}
        <MarkdownToggle {editingEvent} />
    {/if}
</div>

<style lang="scss">
    .container {
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
</style>
