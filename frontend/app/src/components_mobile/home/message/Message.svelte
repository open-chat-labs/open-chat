<script lang="ts">
    import { Avatar, Container } from "component-lib";
    import type { Snippet } from "svelte";
    import MessageBubble from "./MessageBubble.svelte";

    interface Props {
        me?: boolean;
        messageContent?: Snippet<[boolean]>;
        threadSummary?: Snippet<[boolean]>;
        reactions?: Snippet<[boolean, boolean]>;
        time: number;
        edited?: boolean;
        avatarUrl?: string;
    }

    let {
        me = false,
        messageContent,
        threadSummary,
        reactions,
        time,
        edited = false,
        avatarUrl,
    }: Props = $props();
</script>

<Container gap={"sm"} allowOverflow mainAxisAlignment={me ? "end" : "start"}>
    {#if !me && avatarUrl !== undefined}
        <Avatar url={avatarUrl} size={"lg"}></Avatar>
    {/if}
    <Container
        allowOverflow
        crossAxisAlignment={me ? "end" : "start"}
        width={{ kind: "fixed", size: "80%" }}
        gap={"xs"}
        direction={"vertical"}>
        <MessageBubble
            {time}
            {edited}
            hasReactions={reactions !== undefined}
            hasThread={threadSummary !== undefined}
            {me}
            {messageContent}></MessageBubble>
        {@render threadSummary?.(me)}
        {@render reactions?.(me, threadSummary === undefined)}
    </Container>
</Container>
