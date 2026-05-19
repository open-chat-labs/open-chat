<script module lang="ts">
    import Database from "emoji-picker-element/database";
    const emojiDb = new Database();
</script>

<script lang="ts">
    import { rtlStore } from "@src/stores/rtl";
    import { Editor } from "@tiptap/core";
    import Placeholder from "@tiptap/extension-placeholder";
    import StarterKit from "@tiptap/starter-kit";
    import { isTouchOnlyDevice } from "component-lib";
    import type { NativeEmoji } from "emoji-picker-element/shared";
    import { allUsersStore, type Member, type ReadonlyMap } from "openchat-client";
    import { onDestroy, onMount } from "svelte";
    import { markdownToDoc, nodeToMarkdown } from "./markdownConversion";
    import { MentionExtension } from "./mentionExtension";
    import SuggestionPopup, { type SuggestionItem } from "./SuggestionPopup.svelte";

    interface Props {
        placeholder?: string;
        autofocus?: boolean;
        onsubmit?: () => void;
        oninput?: () => void;
        onfocus?: () => void;
        onblur?: () => void;
        members?: ReadonlyMap<string, Member>;
        myUserId?: string;
        empty?: boolean;
    }

    let {
        placeholder,
        autofocus = false,
        onsubmit,
        oninput,
        onfocus,
        onblur,
        members,
        myUserId,
        empty = $bindable(true),
    }: Props = $props();

    let allMembers = $derived(
        members ? [...members.values()].filter((member) => member.userId !== myUserId) : [],
    );

    let editorEl: HTMLDivElement;
    let editor: Editor;

    // Emoji suggestion state
    type Suggestion = { query: string; from: number; x: number; y: number };
    let emojiSuggestion = $state<Suggestion>();
    let emojiResults = $state<NativeEmoji[]>([]);
    let emojiSelectedIndex = $state(0);

    // Mention suggestion state
    let mentionSuggestion = $state<Suggestion>();
    let mentionResults = $state<Member[]>([]);
    let mentionSelectedIndex = $state(0);

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

    $effect(() => {
        const q = mentionSuggestion?.query ?? "";

        if (mentionSuggestion && allMembers.length > 0) {
            if (q.length === 0) {
                mentionResults = allMembers;
            } else {
                const lower = q.toLowerCase();
                const starts: Member[] = [],
                    contains: Member[] = [];
                for (const m of allMembers) {
                    const name = nameForMember(m);
                    if (name !== undefined) {
                        if (name.startsWith(lower)) starts.push(m);
                        else if (name.includes(lower)) contains.push(m);
                    }
                }
                mentionResults = [...starts, ...contains];
            }

            mentionResults = mentionResults.slice(0, 8);
            mentionSelectedIndex = 0;
        } else {
            mentionResults = [];
        }
    });

    function nameForMember(member: Member): string | undefined {
        const user = $allUsersStore.get(member.userId);
        return user?.displayName ?? user?.username;
    }

    function insertMention(member: Member) {
        if (!mentionSuggestion) return;
        const { from: cursorPos } = editor.state.selection;
        const name = nameForMember(member);
        editor
            .chain()
            .deleteRange({ from: mentionSuggestion.from, to: cursorPos })
            .insertContent({
                type: "mention",
                attrs: { userId: member.userId.toString(), username: name },
            })
            .insertContent(" ")
            .run();
        mentionSuggestion = undefined;
        mentionResults = [];
    }

    function checkSuggestion() {
        const { from } = editor.state.selection;
        const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, "\n");

        const emojiMatch = /:([\w]{1,20})$/.exec(textBefore);
        if (emojiMatch) {
            const colonPos = from - emojiMatch[0].length;
            const coords = editor.view.coordsAtPos(colonPos);
            emojiSuggestion = {
                query: emojiMatch[1],
                from: colonPos,
                x: coords.left,
                y: coords.top,
            };
        } else {
            emojiSuggestion = undefined;
        }

        const mentionMatch = /@([\w]{0,30})$/.exec(textBefore);
        if (mentionMatch && members) {
            const atPos = from - mentionMatch[0].length;
            const coords = editor.view.coordsAtPos(atPos);
            mentionSuggestion = {
                query: mentionMatch[1],
                from: atPos,
                x: coords.left,
                y: coords.top,
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

    let mentionItems = $derived<SuggestionItem[]>(
        mentionResults.map((m) => ({ key: m.userId.toString(), label: `@${nameForMember(m)}` })),
    );

    function onMentionSelect(key: string) {
        const member = mentionResults.find((m) => m.userId.toString() === key);
        if (member) insertMention(member);
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
                StarterKit.configure({ link: { openOnClick: false } }),
                Placeholder.configure({ placeholder }),
                MentionExtension,
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
                    if (mentionSuggestion && mentionResults.length > 0) {
                        switch (event.key) {
                            case "Escape":
                                mentionSuggestion = undefined;
                                mentionResults = [];
                                return true;
                            case "ArrowDown":
                                mentionSelectedIndex =
                                    (mentionSelectedIndex + 1) % mentionResults.length;
                                return true;
                            case "ArrowUp":
                                mentionSelectedIndex =
                                    (mentionSelectedIndex - 1 + mentionResults.length) %
                                    mentionResults.length;
                                return true;
                            case "Enter":
                            case "Tab": {
                                const member = mentionResults[mentionSelectedIndex];
                                if (member) {
                                    event.preventDefault();
                                    insertMention(member);
                                    return true;
                                }
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

{#if mentionSuggestion && mentionItems.length > 0}
    <SuggestionPopup
        items={mentionItems}
        selectedIndex={mentionSelectedIndex}
        x={mentionSuggestion.x}
        y={mentionSuggestion.y}
        onselect={onMentionSelect} />
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
