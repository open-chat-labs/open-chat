<script module lang="ts">
    import Database from "emoji-picker-element/database";
    const emojiDb = new Database();
</script>

<script lang="ts">
    import { rtlStore } from "@src/stores/rtl";
    import { Editor, type Content } from "@tiptap/core";
    import Link from "@tiptap/extension-link";
    import Placeholder from "@tiptap/extension-placeholder";
    import StarterKit from "@tiptap/starter-kit";
    import { isTouchOnlyDevice } from "component-lib";
    import type { NativeEmoji } from "emoji-picker-element/shared";
    import { OpenChat, type Member, type ReadonlyMap, type UserOrUserGroup } from "openchat-client";
    import { getContext, onDestroy, onMount, type Snippet } from "svelte";
    import { markdownToDoc, nodeToMarkdown } from "./markdownConversion";
    import { GroupMentionExtension, UserMentionExtension } from "./mentionExtension";
    import SuggestionPopup, { type SuggestionItem } from "./SuggestionPopup.svelte";

    const client = getContext<OpenChat>("client");

    type MentionPickerArgs = {
        onMention: (u: UserOrUserGroup) => void;
        onClose: () => void;
        query: string;
    };

    interface Props {
        placeholder?: string;
        autofocus?: boolean;
        onsubmit?: () => void;
        oninput?: () => void;
        onfocus?: () => void;
        onblur?: () => void;
        members?: ReadonlyMap<string, Member>;
        empty?: boolean;
        mentionPicker: Snippet<[MentionPickerArgs]>;
    }

    let {
        placeholder,
        autofocus = false,
        onsubmit,
        oninput,
        onfocus,
        onblur,
        members,
        empty = $bindable(true),
        mentionPicker,
    }: Props = $props();

    let editorEl: HTMLDivElement;
    let editor: Editor;

    // Emoji suggestion state
    type Suggestion = { query: string; from: number; x: number; y: number; height: number };
    let emojiSuggestion = $state<Suggestion>();
    let emojiResults = $state<NativeEmoji[]>([]);
    let emojiSelectedIndex = $state(0);

    // Mention suggestion state
    let mentionSuggestion = $state<Suggestion>();

    $effect(() => {
        const q = emojiSuggestion?.query;
        if (q && q.length > 0) {
            let cancelled = false;
            emojiDb.getEmojiBySearchQuery(q).then((emojis) => {
                if (!cancelled) {
                    emojiResults = (emojis as NativeEmoji[]).filter((e) => e.unicode).slice(0, 8);
                    emojiSelectedIndex = 0;
                }
            });
            return () => {
                cancelled = true;
            };
        } else {
            emojiResults = [];
        }
    });

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

    function insertEmoji(unicode: string) {
        if (!emojiSuggestion) return;
        const { from: cursorPos } = editor.state.selection;
        editor
            .chain()
            .deleteRange({ from: emojiSuggestion.from, to: cursorPos })
            .insertContent(unicode)
            .run();
        emojiSuggestion = undefined;
        emojiResults = [];
    }

    let emojiItems = $derived<SuggestionItem[]>(
        emojiResults.map((e) => ({
            key: e.unicode,
            label: `:${e.shortcodes?.[0] ?? e.annotation}:`,
            icon: e.unicode,
        })),
    );

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
                StarterKit.configure({ link: false }),
                Placeholder.configure({ placeholder }),
                Link.extend({ inclusive() { return false; } }).configure({ openOnClick: false }),
                UserMentionExtension,
                GroupMentionExtension,
            ],
            editorProps: {
                handleKeyDown: (_view, event) => {
                    if (emojiSuggestion && emojiResults.length > 0) {
                        switch (event.key) {
                            case "Escape":
                                emojiSuggestion = undefined;
                                emojiResults = [];
                                return true;
                            case "ArrowDown":
                                emojiSelectedIndex = (emojiSelectedIndex + 1) % emojiResults.length;
                                return true;
                            case "ArrowUp":
                                emojiSelectedIndex =
                                    (emojiSelectedIndex - 1 + emojiResults.length) %
                                    emojiResults.length;
                                return true;
                            case "Enter":
                            case "Tab": {
                                const emoji = emojiResults[emojiSelectedIndex];
                                if (emoji) {
                                    event.preventDefault();
                                    insertEmoji(emoji.unicode);
                                    return true;
                                }
                            }
                        }
                    }
                    if (mentionSuggestion !== undefined) {
                        switch (event.key) {
                            case "Escape":
                                mentionSuggestion = undefined;
                                return true;
                            case "Enter":
                            case "Tab": {
                                event.preventDefault();
                                return true;
                            }
                        }
                    }
                    if (event.key === "Enter" && !event.shiftKey && !isTouchOnlyDevice) {
                        event.preventDefault();
                        onsubmit?.();
                        return true;
                    }
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

<div bind:this={editorEl} class="editor_wrapper" dir={$rtlStore ? "rtl" : "ltr"}></div>

{#if emojiSuggestion && emojiItems.length > 0}
    <SuggestionPopup
        items={emojiItems}
        selectedIndex={emojiSelectedIndex}
        x={emojiSuggestion.x}
        y={emojiSuggestion.y}
        onselect={insertEmoji} />
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
        color: var(--text-primary);
        font-size: var(--typo-chatText-sz);
        line-height: var(--typo-chatText-lh);
        max-height: 10rem;
        overflow-x: auto;
        overflow-y: auto;
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
        content: attr(data-placeholder);
        color: var(--chat-input-placeholder);
        pointer-events: none;
        float: left;
        height: 0;
    }
</style>
