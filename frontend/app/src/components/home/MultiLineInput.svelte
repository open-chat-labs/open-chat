<script module lang="ts">
    export interface Props {
        disabled?: boolean;
        dragging?: boolean;
        editingEvent?: EventWrapper<Message> | undefined;
        light?: boolean;
        minLines?: number | undefined;
        placeholder?: ResourceKey | undefined;
        recording?: boolean;
        value?: string | undefined;
        onkeypress?: () => void;
        ondragenter?: () => void;
        ondragleave?: () => void;
        ondragover?: () => void;
        ondrop?: () => void;
        oninput?: (value: string) => void;
        onblur?: () => void;
    }
</script>

<script lang="ts">
    import MarkdownToggle from "./MarkdownToggle.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { translatable } from "../../actions/translatable";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { type OpenChat, type ResourceKey } from "openchat-client";
    import type { EventWrapper, Message } from "openchat-client";

    let {
        disabled = false,
        dragging = false,
        editingEvent = undefined,
        light = false,
        minLines = undefined,
        placeholder = i18nKey("enterMessage"),
        recording = false,
        value = $bindable(""),
        ondragenter = undefined,
        onkeypress = undefined,
        ondragleave = undefined,
        ondragover = undefined,
        ondrop = undefined,
        oninput = undefined,
        onblur = undefined,
    }: Props = $props();

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    let inp: HTMLDivElement | undefined = $state();

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

    function handleInput() {
        if (inp) {
            value = inp.textContent ?? "";
            containsMarkdown = detectMarkdown(value);
            messageIsEmpty = checkMessageIsEmpty(value);
            excessiveLinks = checkExcessiveLinks(value);
            
            dispatch("change", value);
            oninput?.(value);
        }
    }

    function checkMessageIsEmpty(message: string) {
        return (message?.trim() ?? "").length === 0;
    }

    function checkExcessiveLinks(message: string) {
        return client.extractEnabledLinks(message ?? "").length > 5;
    }

    let containsMarkdown = $state(detectMarkdown(value));
    let messageIsEmpty = $state(checkMessageIsEmpty(value));
    let excessiveLinks = $state(checkExcessiveLinks(value));
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
        onblur={() => onblur?.()}
        ondragover={() => ondragover?.()}
        ondragenter={() => ondragenter?.()}
        ondragleave={() => ondragleave?.()}
        ondrop={() => ondrop?.()}
        oninput={handleInput}
        onkeypress={() => onkeypress?.()}
        >
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
        @include input();

        max-height: calc(var(--vh, 1vh) * 50);
        min-height: toRem(30);
        overflow-x: hidden;
        user-select: text;
        overflow-y: auto;
        text-overflow: unset;
        white-space: normal;

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
