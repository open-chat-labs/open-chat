<script lang="ts">
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

    export function setBlocked(value: boolean) {
        blocked = value;
    }
</script>

<Entry {...props} {blocked} {textContent} onSetTextContent={(txt?: string) => (textContent = txt)} />
