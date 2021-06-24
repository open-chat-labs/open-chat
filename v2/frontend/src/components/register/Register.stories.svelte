<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import Register from "./Register.svelte";
    import StoryTheme from "../StoryTheme.svelte";
</script>

<Meta
    title="Register"
    component={Register}
    argTypes={{
        awaitingPhoneNumber: { control: "boolean" },
        awaitingCode: { control: "boolean" },
        verifying: { control: "boolean" },
        codeValid: { control: "boolean" },
        userValid: { control: "boolean" },
    }} />

<Template let:args>
    <StoryTheme>
        <Register
            {...args}
            on:logout={args.onLogout}
            on:registerUser={args.onRegisterUser} />
    </StoryTheme>
</Template>

<Story name="Default" args={{}} />

<Story name="Logging In" args={{ busy: true }} />
