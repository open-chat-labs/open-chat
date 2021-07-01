<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import Register from "./Register.svelte";
    import StoryTheme from "../StoryTheme.svelte";
    import { phoneNumber } from "../../services/userIndex/mappers";
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
                "awaitingUsername",
                "awaitingCompletion",
                "verifying",
            ],
            control: {
                type: "radio",
            },
        },
        error: {
            defaultValue: undefined,
            control: {
                type: "text",
            },
        },
        phoneNumber: {
            defaultValue: { countryCode: 44, number: "7867538921" },
        },
        submitPhoneNumber: { action: "submitPhoneNumber" },
        changePhoneNumber: { action: "changePhoneNumber" },
        submitCode: { action: "submitCode" },
        submitUsername: { action: "submitUsername" },
        complete: { action: "complete" },
    }} />

<Template let:args>
    <StoryTheme>
        <Register
            {...args}
            on:changePhoneNumber={args.changePhoneNumber}
            on:submitPhoneNumber={args.submitPhoneNumber}
            on:submitCode={args.submitCode}
            on:submitUsername={args.submitUsername}
            on:complete={args.complete} />
    </StoryTheme>
</Template>

<Story name="Default" args={{}} />
