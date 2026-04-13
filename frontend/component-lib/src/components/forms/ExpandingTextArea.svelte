<script lang="ts">
    import { BodySmall, ColourVars, Container } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        id?: string;
        inp?: HTMLElement;
        value?: string;
        placeholder?: string;
        subtext?: Snippet;
        error?: boolean;
        maxlength?: number;
        countdown?: boolean;
        disabled?: boolean;
        spellcheck?: boolean;
        scrollIntoView?: boolean;
        onblur?: () => void;
        onpaste?: (e: ClipboardEvent) => void;
        oninput?: () => void;
        onkeypress?: (e: KeyboardEvent) => void;
    }

    let {
        id,
        inp = $bindable(),
        value = $bindable(),
        placeholder,
        subtext,
        error,
        maxlength = 10000,
        countdown = false,
        disabled = false,
        spellcheck = false,
        scrollIntoView = true,
        onblur,
        onpaste,
        oninput,
        onkeypress,
    }: Props = $props();

    let remaining = $derived(maxlength - (value?.length ?? 0));
    let warn = $derived(remaining <= 5);
    let editor: HTMLElement | null = $state(null);

    // Sync external value changes into the editor
    $effect(() => {
        if (editor && value !== editor.innerHTML) {
            editor.innerHTML = value ?? "";
        }
    });

    function cleanContent() {
        if (!editor) return;
        let html = editor.innerHTML.trim();
        // Remove common empty garbage that breaks :empty and placeholder
        if (
            html === "<br>" ||
            html === "<div><br></div>" ||
            html === "&nbsp;" ||
            html === "<p><br></p>" ||
            html === "<p></p>"
        ) {
            editor.innerHTML = "";
            value = "";
        }
    }

    function handleBlur() {
        cleanContent();
        onblur?.();
    }

    function handleInput() {
        cleanContent();
        value = editor?.innerHTML ?? ""; // sync to bound value
        oninput?.();
    }

    function handlePaste(e: ClipboardEvent) {
        // TODO strip and keep text only
        onpaste?.(e);
        setTimeout(() => {
            cleanContent();
        }, 10);
    }

    function handleKeyPress(e: KeyboardEvent) {
        onkeypress?.(e);
    }
</script>

<Container direction={"vertical"} gap={"xs"}>
    <Container
        supplementalClass="dl_expanding_textarea"
        gap={"sm"}
        minHeight="3.5rem"
        padding={["lg", "xl"]}
        crossAxisAlignment={"start"}
        background={ColourVars.textTertiary}>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
        <div
            bind:this={editor}
            bind:this={inp}
            contenteditable
            class="expandable-textarea"
            class:disabled
            class:has_countdown={!!countdown}
            data-placeholder={placeholder}
            {id}
            {placeholder}
            {spellcheck}
            onblur={handleBlur}
            onpaste={handlePaste}
            oninput={handleInput}
            onkeypress={handleKeyPress}
            data-gram="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-lpignore="true"
            data-keyboard-ignore={!scrollIntoView}>
        </div>
        {#if countdown}
            <div class:warn class="countdown">{remaining}</div>
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
        // TODO this is custom border radius, we should make it standard as xxxl
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

        // Allow it to grow vertically
        box-sizing: border-box;
        word-wrap: break-word;

        &.has_countdown {
            padding-right: 2.5rem;
        }

        &:empty::before {
            content: attr(data-placeholder);
            color: var(--text-placeholder);
            pointer-events: none;
            height: var(--typo-body-lh);
        }
    }

    .subtext {
        padding-inline-start: var(--sp-xl);
    }

    .countdown {
        position: absolute;
        width: 2rem;
        top: calc(var(--sp-lg) + var(--sp-xxs));
        right: var(--sp-xl);
        color: var(--text-secondary);

        &.warn {
            color: var(--warning);
        }
    }
</style>
