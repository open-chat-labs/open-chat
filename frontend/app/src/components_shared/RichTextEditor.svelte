<script lang="ts">
    import { rtlStore } from "@src/stores/rtl";
    import { Editor, type Content } from "@tiptap/core";
    import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
    import Link from "@tiptap/extension-link";
    import { Placeholder } from "@tiptap/extensions";
    import StarterKit from "@tiptap/starter-kit";
    import { isTouchOnlyDevice } from "component-lib";
    import "highlight.js/styles/base16/helios.css";
    import { common, createLowlight } from "lowlight";
    import {
        type Member,
        type OpenChat,
        type ReadonlyMap,
        type SelectedEmoji,
        type UserOrUserGroup,
    } from "openchat-client";
    import { getContext, onDestroy, onMount, type Snippet } from "svelte";
    import { CustomEmojiExtension } from "./customEmojiExtension";
    import { markdownToDoc, nodeToMarkdown } from "./markdownConversion";
    import { GroupMentionExtension, UserMentionExtension } from "./mentionExtension";

    const lowlight = createLowlight(common);

    const client = getContext<OpenChat>("client");

    type MentionPickerArgs = {
        onMention: (u: UserOrUserGroup) => void;
        onClose: () => void;
        query: string;
    };

    type EmojiPickerArgs = {
        onSelect: (e: SelectedEmoji) => void;
        onClose: () => void;
        query: string;
    };

    interface Props {
        placeholder?: string;
        autofocus?: boolean;
        oninput?: () => void;
        onfocus?: () => void;
        onblur?: () => void;
        onPaste?: (e: ClipboardEvent) => void;
        onKeydown?: (e: KeyboardEvent) => void;
        members?: ReadonlyMap<string, Member>;
        empty?: boolean;
        mentionPicker: Snippet<[MentionPickerArgs]>;
        emojiPicker: Snippet<[EmojiPickerArgs]>;
    }

    let {
        placeholder,
        autofocus = false,
        oninput,
        onfocus,
        onblur,
        onPaste,
        onKeydown,
        members,
        empty = $bindable(true),
        mentionPicker,
        emojiPicker,
    }: Props = $props();

    let editorEl: HTMLDivElement;
    let editor: Editor;

    // Emoji suggestion state
    type Suggestion = { query: string; from: number; x: number; y: number; height: number };
    let emojiSuggestion = $state<Suggestion>();

    // Mention suggestion state
    let mentionSuggestion = $state<Suggestion>();

    function userOrGroupToInsert(user: UserOrUserGroup): Content {
        const label = client.userOrUserGroupName(user);
        switch (user.kind) {
            case "everyone":
                return "@everyone";
            case "bot":
            case "user": {
                return {
                    type: "user_mention",
                    attrs: { userId: user.userId, username: label },
                };
            }
            case "user_group": {
                return {
                    type: "group_mention",
                    attrs: { groupId: user.id, groupname: label },
                };
            }
        }
    }

    function insertMention(user: UserOrUserGroup) {
        if (!mentionSuggestion) return;
        const { from: cursorPos } = editor.state.selection;
        editor
            .chain()
            .deleteRange({ from: mentionSuggestion.from, to: cursorPos })
            .insertContent(userOrGroupToInsert(user))
            .insertContent(" ")
            .run();
        mentionSuggestion = undefined;
    }

    function checkSuggestion() {
        const { from } = editor.state.selection;
        const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, "\n");

        const emojiMatch = /:([\w]{1,20})$/.exec(textBefore);
        if (emojiMatch) {
            const colonPos = from - emojiMatch[0].length;
            const coords = editor.view.coordsAtPos(colonPos);
            const height = editor.view.dom.clientHeight;
            emojiSuggestion = {
                query: emojiMatch[1],
                from: colonPos,
                x: coords.left,
                y: coords.top,
                height,
            };
        } else {
            emojiSuggestion = undefined;
        }

        const mentionMatch = /@([\w]{0,30})$/.exec(textBefore);
        if (mentionMatch && members) {
            const atPos = from - mentionMatch[0].length;
            const coords = editor.view.coordsAtPos(atPos);
            const height = editor.view.dom.clientHeight;
            mentionSuggestion = {
                query: mentionMatch[1],
                from: atPos,
                x: coords.left,
                y: coords.top,
                height,
            };
        } else {
            mentionSuggestion = undefined;
        }
    }

    function emojiToContent(emoji: SelectedEmoji): Content {
        if (emoji.kind === "native") {
            return emoji.unicode;
        }
        return { type: "custom_emoji", attrs: { id: emoji.code } };
    }

    function onEmojiSelect(emoji: SelectedEmoji) {
        if (!emojiSuggestion) return;
        const { from: cursorPos } = editor.state.selection;
        editor
            .chain()
            .deleteRange({ from: emojiSuggestion.from, to: cursorPos })
            .insertContent(emojiToContent(emoji))
            .run();
        emojiSuggestion = undefined;
    }

    export function insertEmoji(emoji: SelectedEmoji): void {
        editor?.chain().focus().insertContent(emojiToContent(emoji)).run();
    }

    function onMentionSelect(user: UserOrUserGroup) {
        insertMention(user);
    }

    export function getMarkdown(): string {
        if (!editor) return "";
        return nodeToMarkdown(editor.getJSON());
    }

    export function clear(): void {
        editor?.commands.clearContent(true);
        empty = editor?.isEmpty ?? true;
    }

    export function focus(): void {
        editor?.commands.focus();
    }

    export function setContent(markdown: string): void {
        editor?.commands.setContent(markdownToDoc(markdown));
        editor?.commands.focus("end");
        empty = editor?.isEmpty ?? true;
    }

    onMount(() => {
        editor = new Editor({
            element: editorEl,
            extensions: [
                StarterKit.configure({ link: false, codeBlock: false, trailingNode: false }),
                Placeholder.configure({ placeholder }),
                Link.extend({
                    inclusive() {
                        return false;
                    },
                    // Never auto-linkify pasted URL text - it breaks hand-written
                    // markdown link syntax when the url portion is pasted
                    addPasteRules() {
                        return [];
                    },
                }).configure({ openOnClick: false }),
                UserMentionExtension,
                GroupMentionExtension,
                CustomEmojiExtension,
                CodeBlockLowlight.configure({ lowlight, enableTabIndentation: true }),
            ],
            editorProps: {
                handleKeyDown: (_view, event) => {
                    if (emojiSuggestion !== undefined) {
                        switch (event.key) {
                            case "Escape":
                                emojiSuggestion = undefined;
                                return true;
                            case "Enter":
                            case "ArrowDown":
                            case "ArrowUp":
                            case "Tab": {
                                event.preventDefault();
                                return true;
                            }
                        }
                    }
                    if (mentionSuggestion !== undefined) {
                        switch (event.key) {
                            case "Escape":
                                mentionSuggestion = undefined;
                                return true;
                            case "Enter":
                            case "ArrowDown":
                            case "ArrowUp":
                            case "Tab": {
                                event.preventDefault();
                                return true;
                            }
                        }
                    }
                    if (event.key === "Enter" && event.shiftKey && !isTouchOnlyDevice) {
                        if (editor.isActive("codeBlock")) {
                            const anchor = editor.state.selection.$anchor;
                            const textBefore = editor.state.doc.textBetween(
                                anchor.start(),
                                anchor.pos,
                            );
                            if (textBefore.endsWith("\n\n")) {
                                // Two empty lines: delete them and exit the code block
                                editor
                                    .chain()
                                    .command(({ tr }) => {
                                        tr.delete(anchor.pos - 2, anchor.pos);
                                        return true;
                                    })
                                    .exitCode()
                                    .run();
                            } else {
                                editor
                                    .chain()
                                    .command(({ tr }) => {
                                        tr.insertText("\n");
                                        return true;
                                    })
                                    .run();
                            }
                            event.preventDefault();
                            return true;
                        }
                        if (editor.isActive("listItem")) {
                            const isEmpty =
                                editor.state.selection.$anchor.parent.textContent.length === 0;
                            if (isEmpty) {
                                editor.chain().liftListItem("listItem").run();
                            } else {
                                editor.chain().splitListItem("listItem").run();
                            }
                        } else if (editor.isActive("heading")) {
                            // Two separate commands so each sees the committed state.
                            // A single chain() can map positions past the doc end when
                            // there is no trailing node.
                            if (editor.commands.splitBlock()) {
                                editor.commands.setNode("paragraph");
                            }
                        } else {
                            const anchor = editor.state.selection.$anchor;
                            const blockText = anchor.parent.textContent;
                            const fenceMatch = blockText.match(/^```(\w*)$/);
                            if (fenceMatch) {
                                editor
                                    .chain()
                                    .command(({ tr }) => {
                                        tr.delete(anchor.start(), anchor.pos);
                                        return true;
                                    })
                                    .setNode(
                                        "codeBlock",
                                        fenceMatch[1] ? { language: fenceMatch[1] } : {},
                                    )
                                    .run();
                            } else {
                                editor.chain().splitBlock().run();
                            }
                        }
                        event.preventDefault();
                        return true;
                    }
                    onKeydown?.(event);
                    return false;
                },
            },
            onUpdate: () => {
                empty = editor.isEmpty;
                oninput?.();
                checkSuggestion();
            },
            onBlur: () => {
                onblur?.();
            },
            onFocus: () => {
                onfocus?.();
            },
            onSelectionUpdate: () => {
                checkSuggestion();
            },
            onPaste: (e: ClipboardEvent) => onPaste?.(e),
        });

        if (autofocus) {
            editor.commands.focus();
        }

        empty = editor.isEmpty;
    });

    onDestroy(() => {
        editor?.destroy();
    });
</script>

<div
    style={placeholder ? `--dynamic-placeholder: "${placeholder}"` : undefined}
    bind:this={editorEl}
    class="editor_wrapper"
    dir={$rtlStore ? "rtl" : "ltr"}>
</div>

{#if emojiSuggestion}
    {@render emojiPicker({
        onSelect: onEmojiSelect,
        onClose: () => (emojiSuggestion = undefined),
        query: emojiSuggestion.query,
    })}
{/if}

{#if mentionSuggestion}
    {@render mentionPicker({
        onMention: onMentionSelect,
        onClose: () => (mentionSuggestion = undefined),
        query: mentionSuggestion.query,
    })}
{/if}

<style lang="scss">
    .editor_wrapper {
        width: 100%;
        min-width: 0;
    }

    :global(.ProseMirror) {
        outline: none;
        width: 100%;
        min-width: 0;
        color: var(--txt, var(--text-primary));
        font-size: 1rem;
        line-height: 1.3;
        max-height: 10rem;
        max-height: calc(var(--vh, 1vh) * 50);
        overflow-x: hidden;
        overflow-y: auto;
        overflow-wrap: anywhere !important;
    }

    :global(.ProseMirror p) {
        margin: 0;
    }

    :global(.ProseMirror h1),
    :global(.ProseMirror h2),
    :global(.ProseMirror h3),
    :global(.ProseMirror h4),
    :global(.ProseMirror h5),
    :global(.ProseMirror h6) {
        line-height: 1.25;
        font-weight: 700;
        margin: 0.25rem 0;
    }

    :global(.ProseMirror h1) {
        font-size: 1.25rem;
    }

    :global(.ProseMirror h2) {
        font-size: 1.125rem;
    }

    :global(.ProseMirror h3),
    :global(.ProseMirror h4),
    :global(.ProseMirror h5),
    :global(.ProseMirror h6) {
        font-size: 1rem;
    }

    :global(.ProseMirror ul),
    :global(.ProseMirror ol) {
        padding-left: 1.25rem;
        margin: 0.25rem 0;
    }

    :global(.ProseMirror li) {
        margin: 0.15rem 0;
    }

    :global(.ProseMirror blockquote) {
        margin: 0.25rem 0;
        padding: 0.25rem 0.5rem;
        border-left: 0.2rem solid var(--bd);
        opacity: 0.85;
    }

    :global(.ProseMirror pre) {
        margin: 0.25rem 0;
        padding: 0.5rem;
        border-radius: 0.5rem;
        background: rgba(0, 0, 0, 0.15);
        font-family:
            ui-monospace,
            SFMono-Regular,
            SF Mono,
            Menlo,
            Consolas,
            monospace;
        font-size: 0.9em;
        line-height: 1.4;
        overflow-x: auto;
    }

    :global(.ProseMirror code) {
        font-family:
            ui-monospace,
            SFMono-Regular,
            SF Mono,
            Menlo,
            Consolas,
            monospace;
        font-size: 0.9em;
        padding: 0.1rem 0.3rem;
        border-radius: 0.25rem;
        background: rgba(0, 0, 0, 0.15);
    }

    :global(.ProseMirror pre code) {
        padding: 0;
        background: transparent;
    }

    :global(.ProseMirror hr) {
        border: none;
        border-top: 1px solid var(--bd);
        margin: 0.5rem 0;
    }

    :global(.ProseMirror .mention) {
        color: var(--primary);
        font-weight: 500;
        cursor: default;
    }

    :global(.ProseMirror p.is-editor-empty:first-child::before) {
        content: var(--dynamic-placeholder, attr(data-placeholder));
        color: var(--txt-light, var(--chat-input-placeholder));
        pointer-events: none;
        float: left;
        height: 0;
    }
</style>
