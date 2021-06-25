<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import Register from "./Register.svelte";
    import StoryTheme from "../StoryTheme.svelte";
</script>

<Meta
    title="Register"
    component={Register}
    argTypes={{
        state: {
            defaultValue: "awaitingPhoneNumber",
            options: [
                "awaitingPhoneNumber",
                "awaitingCode",
                "verifying",
                "codeValid",
                "usernameValid",
                "error",
            ],
            control: {
                type: "radio",
            },
        },
        submitPhoneNumber: { action: "submitPhoneNumber" },
        submitCode: { action: "submitCode" },
        submitUsername: { action: "submitUsername" },
        complete: { action: "complete" },
    }} />

<Template let:args>
    <StoryTheme>
        <Register
            {...args}
            on:submitPhoneNumber={args.submitPhoneNumber}
            on:submitCode={args.submitCode}
            on:submitUsername={args.submitUsername}
            on:complete={args.complete} />
    </StoryTheme>
</Template>

<Story name="Default" args={{}} />
