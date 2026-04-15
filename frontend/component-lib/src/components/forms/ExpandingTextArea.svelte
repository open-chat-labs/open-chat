<script lang="ts">
    import { BodySmall, ColourVars, Container } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        id?: string;
        value?: string;
        placeholder?: string;
        subtext?: Snippet;
        error?: boolean;
        maxlength?: number;
        countdown?: boolean;
        disabled?: boolean;
        spellcheck?: boolean;
        scrollIntoView?: boolean;
        maxHeight?: string;
        onfocus?: () => void;
        onblur?: () => void;
        onpaste?: (e: ClipboardEvent) => void;
        oninput?: () => void;
        onkeypress?: (e: KeyboardEvent) => void;
    }

    let {
        id,
        value = $bindable(),
        placeholder,
        subtext,
        error,
        maxlength = 10000,
        countdown = false,
        disabled = false,
        spellcheck = false,
        scrollIntoView = true,
        maxHeight = "none",
        onfocus,
        onblur,
        onpaste,
        oninput,
        onkeypress,
    }: Props = $props();

    let remaining = $derived(maxlength - (value?.length ?? 0));
    let warn = $derived(remaining <= 5);
    let textarea: HTMLTextAreaElement | null = $state(null);

    // Auto-grow the textarea height
    function autoGrow() {
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }

    // Sync external value changes
    $effect(() => {
        if (textarea && value !== textarea.value) {
            if (countdown) {
                value = (value?.length ?? 0) > maxlength ? value?.substring(0, maxlength) : value;
            }

            textarea.value = value ?? "";
            autoGrow();
        }
    });

    // Clean empty garbage (simplified for plain text)
    function cleanContent() {
        if (!value) return;
        const trimmed = value.trim();
        if (trimmed === "" || trimmed === "\n") {
            value = "";
        }
    }

    function handleInput(e: Event) {
        const ta = e.target as HTMLTextAreaElement;
        value = ta.value;
        cleanContent();
        autoGrow();
        oninput?.();
    }

    function handleBlur() {
        cleanContent();
        onblur?.();
    }

    function handlePaste(e: ClipboardEvent) {
        onpaste?.(e);
        setTimeout(() => {
            cleanContent();
            autoGrow();
        }, 10);
    }

    function handleKeyPress(e: KeyboardEvent) {
        onkeypress?.(e);
    }

    // Initial auto-grow when component mounts with value
    $effect(() => {
        if (textarea && value) autoGrow();
    });
</script>

<Container direction={"vertical"} gap={"xs"} overflow="visible">
    <Container
        supplementalClass="dl_expanding_textarea"
        gap={"sm"}
        minHeight="3.5rem"
        padding={["lg", "xl"]}
        crossAxisAlignment={"start"}
        background={ColourVars.textTertiary}>
        <textarea
            bind:this={textarea}
            bind:value
            class="expandable-textarea"
            class:disabled
            class:has_countdown={!!countdown}
            {id}
            {placeholder}
            {spellcheck}
            {disabled}
            rows="1"
            {maxlength}
            style="max-height: {maxHeight};"
            {onfocus}
            onblur={handleBlur}
            onpaste={handlePaste}
            oninput={handleInput}
            onkeypress={handleKeyPress}
            data-gram="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-lpignore="true"
            data-keyboard-ignore={!scrollIntoView}>
        </textarea>

        {#if countdown}
            <div class:warn class={`countdown w_${remaining.toString().length}_nums`}>
                {remaining}
            </div>
        {/if}
    </Container>

    {#if subtext}
        <div class="subtext">
            <BodySmall colour={error ? "error" : "textSecondary"}>
                {@render subtext()}
            </BodySmall>
        </div>
    {/if}
</Container>

<style lang="scss">
    :global(.dl_expanding_textarea) {
        border-radius: 1.75rem !important;
    }

    .expandable-textarea {
        all: unset;
        width: 100%;
        display: block;
        color: var(--text-primary);
        font-size: var(--typo-body-sz);
        line-height: var(--typo-body-lh);
        overflow: hidden;
        resize: none;
        outline: none;
        padding-top: var(--sp-xxs);
        box-sizing: border-box;
        word-wrap: break-word;

        &.has_countdown {
            padding-right: 2.5rem;
        }

        &::placeholder {
            color: var(--text-placeholder);
        }

        /* Hide scrollbar visually while allowing growth */
        &::-webkit-scrollbar {
            display: none;
        }
    }

    .subtext {
        padding-inline-start: var(--sp-xl);
    }

    .countdown {
        position: absolute;
        top: calc(var(--sp-lg) + var(--sp-xxs));
        right: var(--sp-xl);
        color: var(--text-secondary);

        &.w_2_nums {
            width: 1.25rem;
        }
        &.w_3_nums {
            width: 1.75rem;
        }
        &.w_4_nums {
            width: 2.25rem;
        }

        &.warn {
            color: var(--warning);
        }
    }
</style>
