<script lang="ts">
    import type { EventWrapper, Message } from "@client";
    import type { Component } from "svelte";

    interface Props {
        // the desktop or mobile MessageEntry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Entry: Component<any>;
        props: Record<string, unknown>;
        textContent: string | undefined;
    }

    let { Entry, props, textContent: initialTextContent }: Props = $props();
    // Stands in for the chat's draft, which the entry writes to as the user types
    let textContent = $state(initialTextContent);
    let blocked = $state(false);
    let editingEvent = $state<EventWrapper<Message>>();

    export function setBlocked(value: boolean) {
        blocked = value;
    }

    // Switching chats hands the entry the new chat's draft
    export function setTextContent(value: string | undefined) {
        textContent = value;
    }

    export function getTextContent(): string | undefined {
        return textContent;
    }

    export function setEditingEvent(value: EventWrapper<Message> | undefined) {
        editingEvent = value;
    }
</script>

<Entry
    {...props}
    {blocked}
    {textContent}
    {editingEvent}
    onSetTextContent={(txt?: string) => (textContent = txt)} />
