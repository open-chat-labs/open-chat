<script lang="ts">
    import type { Snippet } from "svelte";
    import Container from "../Container.svelte";
    import Avatar from "../avatar/Avatar.svelte";
    import MessageBubble from "./MessageBubble.svelte";

    interface Props {
        me?: boolean;
        messageContent?: Snippet<[boolean]>;
        messageSubtext?: Snippet;
        threadSummary?: Snippet<[boolean]>;
        reactions?: Snippet<[boolean, boolean]>;
        time: number;
        edited?: boolean;
        avatarUrl?: string;
    }

    let {
        me = false,
        messageContent,
        messageSubtext,
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
            {messageSubtext}
            {me}
            {messageContent}></MessageBubble>
        {@render threadSummary?.(me)}
        {@render reactions?.(me, threadSummary === undefined)}
    </Container>
</Container>
