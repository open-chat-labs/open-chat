<script module lang="ts">
    import bash from "highlight.js/lib/languages/bash";
    import css from "highlight.js/lib/languages/css";
    import rust from "highlight.js/lib/languages/rust";
    import typescript from "highlight.js/lib/languages/typescript";
    import { createLowlight } from "lowlight";

    // Register the same grammars as utils/markdown.ts rather than `common` (37 grammars)
    const lowlight = createLowlight();
    lowlight.register("typescript", typescript);
    lowlight.register("rust", rust);
    lowlight.register("bash", bash);
    lowlight.register("css", css);
</script>

<script lang="ts">
    import { rtlStore } from "@src/stores/rtl";
    import { Editor, type Content, type JSONContent } from "@tiptap/core";
    import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
    import Link from "@tiptap/extension-link";
    import { Placeholder } from "@tiptap/extensions";
    import StarterKit from "@tiptap/starter-kit";
    import { isTouchOnlyDevice } from "component-lib";
    import "highlight.js/styles/base16/helios.css";
    import {
        allUsersStore,
        userGroupSummariesStore,
        type Member,
        type OpenChat,
        type ReadonlyMap,
        type SelectedEmoji,
        type User,
        type UserOrUserGroup,
    } from "@client";
    import { getContext, onDestroy, onMount, type Snippet } from "svelte";
    import { CustomEmojiExtension } from "./customEmojiExtension";
    import { markdownToDoc, nodeToMarkdown } from "./markdownConversion";
    import { GroupMentionExtension, UserMentionExtension } from "./mentionExtension";
    import { transformPastedHTML } from "./pasteTransform";

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

    // The "@word" being typed at the caret, for a host with its own mention list: where its "@" is
    // and what's typed after it
    type MentionQuery = { query: string; from: number };

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
        // The editor's own pickers. A host without them shows its own mention list (from
        // `onMentionQuery`) and offers no ":word" emoji list
        mentionPicker?: Snippet<[MentionPickerArgs]>;
        emojiPicker?: Snippet<[EmojiPickerArgs]>;
        // The "@word" at the caret as it changes (undefined once there's none), for a host's own
        // mention list; it puts the one picked in with `insertMention`
        onMentionQuery?: (query: MentionQuery | undefined) => void;
        // Attributes for the editable element (aria), as they change
        attributes?: Record<string, string>;
        // The editor is made and its methods work
        onReady?: () => void;
        // Text put in more than a character at once (an autofill, an autocorrected or dictated word,
        // a test's fill) goes in as it is, not through the markdown shortcuts (input rules): they
        // expect one character at a time, and a chunk that completes one (`**bold**`) empties the
        // editor. Typed one character at a time, the shortcuts work as ever
        plainTextChunks?: boolean;
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
        onMentionQuery,
        attributes,
        onReady,
        plainTextChunks = false,
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

    export function insertMention(user: UserOrUserGroup): void {
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
        if (emojiMatch && emojiPicker) {
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
        if (mentionMatch && (members || onMentionQuery)) {
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
        reportMention();
    }

    let reportedMention: MentionQuery | undefined;
    function reportMention() {
        if (onMentionQuery === undefined) return;
        const next =
            mentionSuggestion === undefined
                ? undefined
                : { query: mentionSuggestion.query, from: mentionSuggestion.from };
        if (next?.query === reportedMention?.query && next?.from === reportedMention?.from) return;
        reportedMention = next;
        onMentionQuery(next);
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

    // Text put in at the caret; without `focus` the editor isn't focused, so no keyboard opens
    export function insertText(text: string, focus: boolean): void {
        if (!editor) return;
        const chain = editor.chain();
        if (focus) chain.focus();
        chain.insertContent(text).run();
    }

    // As Backspace: the selection, or the whole character (an emoji with its skin tone, a flag) or
    // the mention before the caret, without focusing the editor
    export function deleteBackward(): void {
        if (!editor) return;
        const { selection } = editor.state;
        if (!selection.empty) {
            editor.commands.deleteSelection();
            return;
        }
        const { from } = selection;
        const before = selection.$from.nodeBefore;
        if (before === null) {
            editor.commands.joinBackward();
            return;
        }
        const size = before.isText ? lastCharacterLength(before.text ?? "") : before.nodeSize;
        editor
            .chain()
            .command(({ tr }) => {
                tr.delete(from - size, from);
                return true;
            })
            .run();
    }

    function lastCharacterLength(text: string): number {
        let last = "";
        for (const { segment } of new Intl.Segmenter().segment(text)) last = segment;
        return last.length;
    }

    function onMentionSelect(user: UserOrUserGroup) {
        insertMention(user);
    }

    export function getMarkdown(): string {
        if (!editor) return "";
        return nodeToMarkdown(editor.getJSON());
    }

    // The users mentioned within the message, taken from the `user_mention` nodes in the document
    // (which are inserted when the user picks from the mention picker)
    export function getMentionedUsers(): User[] {
        if (!editor) return [];
        const users = new Map<string, User>();
        collectMentionedUsers(editor.getJSON(), users);
        return [...users.values()];
    }

    function collectMentionedUsers(node: JSONContent, users: Map<string, User>) {
        // The attrs both default to null and pasted/restored content can carry a missing or
        // placeholder username, so hydrate each user from the user store where possible, only
        // falling back to the username stored in the node's attrs
        if (node.type === "user_mention") {
            const { userId, username } = node.attrs ?? {};
            if (typeof userId === "string" && userId.length > 0) {
                const user = $allUsersStore.get(userId);
                users.set(userId, {
                    userId,
                    username:
                        user?.username ??
                        (typeof username === "string" && username.length > 0
                            ? username
                            : "unknown"),
                    displayName: user?.displayName,
                });
            }
        }
        node.content?.forEach((child) => collectMentionedUsers(child, users));
    }

    // clear and setContent emit no update, so `oninput` only reports the user's own input (callers
    // treat it as the user typing)
    export function clear(): void {
        editor?.commands.clearContent(false);
        afterContentSet();
    }

    export function focus(): void {
        editor?.commands.focus();
    }

    // Without `focus` the caret goes to the end but the editor isn't focused (no keyboard opens)
    export function setContent(markdown: string, focus = true): void {
        editor?.commands.setContent(resolveMentionLabels(markdownToDoc(markdown)), {
            emitUpdate: false,
        });
        if (focus) {
            editor?.commands.focus("end");
        } else if (editor) {
            editor.commands.setTextSelection(editor.state.doc.content.size);
        }
        afterContentSet();
    }

    // What onUpdate would have done, bar calling `oninput`
    function afterContentSet() {
        empty = editor?.isEmpty ?? true;
        if (editor) {
            checkSuggestion();
        }
    }

    // markdownToDoc has no access to the user/group stores, so mention nodes it
    // creates carry placeholder labels - swap in the real names for display
    function resolveMentionLabels(node: JSONContent): JSONContent {
        if (node.type === "user_mention" && node.attrs) {
            const username = $allUsersStore.get(node.attrs.userId)?.username;
            if (username !== undefined) {
                node.attrs.username = username;
            }
        } else if (node.type === "group_mention" && node.attrs) {
            const name = $userGroupSummariesStore.get(Number(node.attrs.groupId))?.name;
            if (name !== undefined) {
                node.attrs.groupname = name;
            }
        }
        node.content?.forEach(resolveMentionLabels);
        return node;
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
                attributes,
                transformPastedHTML,
                // ProseMirror's own insert (`deflt`: the DOM's selection, the composition, scrolled into
                // view), handled here so that tiptap's input rules don't see the chunk
                handleTextInput: (view, _from, _to, text, deflt) => {
                    if (!plainTextChunks || [...text].length <= 1) return false;
                    view.dispatch(deflt());
                    return true;
                },
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
                    if (mentionSuggestion !== undefined && mentionPicker) {
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
                    // A key the caller has handled (e.g. Enter to send) isn't handled again by
                    // the editor's keymap, which would otherwise split the block
                    return event.defaultPrevented;
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
        onReady?.();
    });

    // the editable element's attributes follow the prop (aria-activedescendant moves as a host's
    // list is walked)
    $effect(() => {
        const next = attributes;
        if (next === undefined || !editor) return;
        editor.setOptions({ editorProps: { ...editor.options.editorProps, attributes: next } });
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

{#if emojiSuggestion && emojiPicker}
    {@render emojiPicker({
        onSelect: onEmojiSelect,
        onClose: () => (emojiSuggestion = undefined),
        query: emojiSuggestion.query,
    })}
{/if}

{#if mentionSuggestion && mentionPicker}
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
