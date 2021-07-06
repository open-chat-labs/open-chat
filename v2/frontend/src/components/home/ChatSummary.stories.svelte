<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import ChatSummary from "./ChatSummary.svelte";
    import StoryTheme from "../StoryTheme.svelte";
    import { UserStatus } from "../../domain/user";
</script>

<Meta
    title="ChatSummary"
    component={ChatSummary}
    argTypes={{
        selected: {
            defaultValue: false,
            control: {
                type: "radio",
            },
        },
        chatId: { defaultValue: 0 },
        date: { defaultValue: +new Date() },
        name: { defaultValue: "This is the name of a chat" },
        lastMessage: {
            defaultValue: "and this is the last message that we received - it might be quite long",
        },
        avatarUrl: { defaultValue: "https://i.pravatar.cc/300" },
        userStatus: {
            defaultValue: UserStatus.Online,
        },
        unreadMessages: { defaultValue: 5 },
    }} />

<Template let:args>
    <StoryTheme>
        <ChatSummary {...args} />
    </StoryTheme>
</Template>

<Story name="Default" args={{}} />
