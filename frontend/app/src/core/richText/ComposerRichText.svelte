<!-- The rich-text editor (RichTextEditor, the old trees' own) in the new trees' MessageComposer, through
     its `editor` seam: the composer drives it (ComposerEditor) and gets its markdown as the draft.
     The composer's own lists stand in for the editor's pickers: its mention list (the "@word" the
     editor reports; the one picked put in as a mention, sent as `@UserId`), and no ":word" emoji
     list. A custom emoji picked from the composer's picker goes in as one (`insertEmoji`). `Editor` is the loaded component (RichTextEditorLoad), so the editor's chunk stays out of
     the initial one. -->
<script lang="ts">
    import { customEmojis, type UserOrUserGroup } from "@client";
    import type {
        ComposerEditor,
        ComposerEditorArgs,
        ComposerMention,
    } from "@openchat/ui/src/lib/types";
    import { untrack } from "svelte";
    import type RichTextEditor from "./RichTextEditor.svelte";

    interface Props {
        Editor: typeof RichTextEditor;
        args: ComposerEditorArgs;
        // who a mention picked from the composer's list is (pickedMention)
        resolveMention: (mention: ComposerMention) => UserOrUserGroup | undefined;
    }

    let { Editor, args, resolveMention }: Props = $props();

    let editor = $state<RichTextEditor>();
    // the editor has made its document (its methods work); `editor` is bound by then or just after
    let made = $state(false);

    // the composer drives the editor once it's made, until it goes
    $effect(() => {
        const ed = editor;
        if (ed === undefined || !made) return;
        return untrack(() => register(ed));
    });

    function register(ed: RichTextEditor): () => void {
        const driven: ComposerEditor = {
            focus: () => ed.focus(),
            setText: (text) => ed.setContent(text, false),
            insertText: (text, focus) => ed.insertText(text, focus),
            deleteBackward: () => ed.deleteBackward(),
            insertMention: (mention) => {
                const picked = resolveMention(mention);
                if (picked !== undefined) ed.insertMention(picked);
            },
            // a custom emoji picked, as one, as the old pickers put it in (`!emoji(code)` in the
            // markdown)
            insertEmoji: (code) => {
                const custom = customEmojis.get(code);
                if (custom !== undefined) ed.insertEmoji(custom);
            },
        };
        return args.register(driven);
    }

    const attributes = $derived({
        role: "textbox",
        "aria-label": args.placeholder,
        "aria-multiline": "true",
        ...args.aria,
    });
</script>

<div
    class="composer-rich-text"
    style:--composer-text-min-h="{args.minHeight}px"
    style:--composer-text-max-h="{args.maxHeight}px">
    <Editor
        bind:this={editor}
        placeholder={args.placeholder}
        {attributes}
        oninput={() => args.onText(editor?.getMarkdown() ?? "")}
        onKeydown={(e) => args.onKeydown(e)}
        onfocus={() => args.onFocus()}
        onblur={() => args.onBlur()}
        onMentionQuery={(m) =>
            args.onMention(m === undefined ? undefined : { start: m.from, query: m.query })}
        plainTextChunks
        onReady={() => (made = true)} />
</div>

<style lang="scss">
    // the composer's text box as the textarea it stands in for draws it (MessageComposer), its type
    // following the interface size (--text-base)
    .composer-rich-text {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;

        :global(.ProseMirror) {
            box-sizing: content-box;
            min-height: var(--composer-text-min-h);
            max-height: var(--composer-text-max-h);
            padding: 7px 0;
            font: var(--weight-regular) var(--text-base) / 1.63 var(--font-sans);
            color: var(--ink);
            caret-color: var(--accent);
        }

        :global(.ProseMirror p.is-editor-empty:first-child::before) {
            color: var(--ink-3);
        }

        :global(.ProseMirror .mention) {
            color: var(--accent);
        }

        :global(.ProseMirror blockquote),
        :global(.ProseMirror hr) {
            border-color: var(--line-2);
        }

        :global(.ProseMirror pre),
        :global(.ProseMirror code) {
            background: var(--overlay-1);
        }

        :global(.ProseMirror pre code) {
            background: transparent;
        }
    }
</style>
