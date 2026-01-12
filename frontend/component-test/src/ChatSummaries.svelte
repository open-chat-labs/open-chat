<script lang="ts">
    import { ChatSummary, Container } from "component-lib";
    import DebugEvent from "./DebugEvent.svelte";

    function onClick(onAction: (action: string) => void) {
        return () => onAction("Chat clicked");
    }
</script>

<DebugEvent>
    {#snippet children(onAction)}
        <Container width={{ kind: "fixed", size: "500px" }}>
            <Container gap={"xxl"} direction={"vertical"}>
                <ChatSummary
                    onClick={onClick(onAction)}
                    time={"10:48"}
                    avatarUrls={["/robot.jpg"]}
                    unreadCount={99}
                    title={"Title of the chat"}
                    latestMessage={{
                        kind: "text",
                        text: "Last message sent / recieved in this conversation",
                    }}>
                </ChatSummary>

                <ChatSummary
                    onClick={onClick(onAction)}
                    time={"10:48"}
                    avatarUrls={["/mushroom.png"]}
                    title={"Title of the chat"}
                    latestMessage={{
                        kind: "video_call",
                        text: "Video call / 12:46",
                        inProgress: false,
                    }}>
                </ChatSummary>

                <ChatSummary
                    onClick={onClick(onAction)}
                    avatarUrls={["/mushroom.png"]}
                    time={"10:48"}
                    title={"Title of the chat"}
                    latestMessage={{
                        kind: "video_call",
                        text: "Video call in progress / 4:46",
                        inProgress: true,
                    }}>
                </ChatSummary>

                <ChatSummary
                    onClick={onClick(onAction)}
                    avatarUrls={["/mushroom.png"]}
                    time={"10:48"}
                    title={"Title of the chat"}
                    latestMessage={{
                        kind: "video",
                        text: "Video message / 2:34",
                    }}>
                </ChatSummary>

                <ChatSummary
                    onClick={onClick(onAction)}
                    avatarUrls={["/disco.png"]}
                    time={"10:48"}
                    title={"Title of the chat"}
                    latestMessage={{
                        kind: "image",
                        text: "This would be the image caption",
                    }}>
                </ChatSummary>

                <ChatSummary
                    onClick={onClick(onAction)}
                    avatarUrls={["/disco.png"]}
                    time={"10:48"}
                    unreadCount={10}
                    title={"Title of the chat"}
                    latestMessage={{
                        kind: "audio",
                        text: "This would be the clip caption / 3:06",
                    }}>
                </ChatSummary>

                <ChatSummary
                    onClick={onClick(onAction)}
                    avatarUrls={["/robot.jpg"]}
                    time={"10:48"}
                    unreadCount={5}
                    title={"This is what it will look like if we have a really long title that's definitely too long to fit on a single row"}
                    latestMessage={{
                        kind: "text",
                        text: "You: And it's also possible that the subtitle is going to be really much too long to fit on a single line",
                    }}>
                </ChatSummary>

                <ChatSummary
                    onClick={onClick(onAction)}
                    avatarUrls={["/robot.jpg", "/mushroom.png", "/disco.png", "/horse.png"]}
                    time={"10:48"}
                    unreadCount={6}
                    title={"Title of the chat"}
                    latestMessage={{
                        kind: "text",
                        text: "Someone: And it's also possible that the subtitle is going to be really much too long to fit on a single line",
                    }}>
                </ChatSummary>

                <ChatSummary
                    onClick={onClick(onAction)}
                    avatarUrls={["/disco.png", "/horse.png", "/mushroom.png"]}
                    time={"10:48"}
                    unreadCount={6}
                    title={"Title of the chat"}
                    latestMessage={{
                        kind: "text",
                        text: "Someone: This is another one that has more than one avatar",
                    }}>
                </ChatSummary>
            </Container>
        </Container>
    {/snippet}
</DebugEvent>
