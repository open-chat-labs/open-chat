<script lang="ts">
    import { Body, Container, Message, Reactions, ThreadSummary } from "component-lib";
    import DebugEvent from "./DebugEvent.svelte";

    let time = new Date().getTime();
</script>

<DebugEvent>
    {#snippet children(onAction)}
        <Container
            width={{ kind: "fixed", size: "800px" }}
            borderColour={"cyan"}
            borderStyle={"dashed"}
            borderWidth={"thick"}
            borderRadius={"xl"}
            padding={"xl"}
            direction={"vertical"}
            gap={"xl"}>
            <Message edited {time} me>
                {#snippet messageContent(_)}
                    <Body>
                        At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
                        praesentium voluptatum ...
                    </Body>
                {/snippet}
                {#snippet reactions(_, offset)}
                    <Reactions
                        {offset}
                        reactions={[
                            { text: "🚀", usernames: ["user_one", "user_two", "user_three"] },
                            { text: "😭", usernames: ["user_one", "user_two", "user_three"] },
                            { text: "☠️", usernames: ["user_one", "user_two", "user_three"] },
                        ]}></Reactions>
                {/snippet}
            </Message>
            <Message {time} me>
                {#snippet messageContent(_)}
                    <Body>
                        At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
                        praesentium voluptatum ...
                    </Body>
                {/snippet}
                {#snippet threadSummary(me)}
                    <ThreadSummary
                        onClick={() => onAction("Thread summary clicked")}
                        participantAvatarUrls={["/witch.png", "/mushroom.png", "/horse.png"]}
                        text={"11 replies / just now"}
                        {me}
                        hasUnread />
                {/snippet}
            </Message>

            <Message {time} me>
                {#snippet messageContent()}
                    <Body>A small message</Body>
                {/snippet}
                {#snippet threadSummary(me)}
                    <ThreadSummary
                        onClick={() => onAction("Thread summary clicked")}
                        participantAvatarUrls={[
                            "/witch.png",
                            "/mushroom.png",
                            "/horse.png",
                            "/disco.png",
                            "/robot.jpg",
                        ]}
                        text={"11 replies / just now"}
                        {me} />
                {/snippet}
            </Message>

            <Message {time} me>
                {#snippet messageContent()}
                    <Body>This is a medium sized message - let's make sure it scales</Body>
                {/snippet}
            </Message>

            <Message avatarUrl={"/witch.png"} edited {time}>
                {#snippet messageContent()}
                    <Body>
                        In this example the message content is being injected as plain text. But it
                        is just a snippet which means that _anything_ can be injected. In practice
                        we will have some sort of MessageContent component that deals with all of
                        the different types of message content. Just got to be careful to keep the
                        separation right so that the containing components take care of all the
                        layout etc and the content is self-contained.
                    </Body>
                {/snippet}
                {#snippet threadSummary(me)}
                    <ThreadSummary
                        onClick={() => onAction("Thread summary clicked")}
                        participantAvatarUrls={["/witch.png", "/mushroom.png", "/horse.png"]}
                        text={"11 replies / just now"}
                        {me}
                        hasUnread={false} />
                {/snippet}
                {#snippet reactions(_, offset)}
                    <Reactions
                        {offset}
                        reactions={[
                            { text: "🚀", usernames: ["user_one", "user_two", "user_three"] },
                            { text: "😭", usernames: ["user_one", "user_two", "user_three"] },
                            { text: "☠️", usernames: ["user_one", "user_two", "user_three"] },
                        ]}></Reactions>
                {/snippet}
            </Message>
        </Container>
    {/snippet}
</DebugEvent>
