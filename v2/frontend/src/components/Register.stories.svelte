<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import Register from "./Register.svelte";
    import StoryTheme from "./StoryTheme.svelte";
</script>

<Meta
    title="Register"
    component={Register}
    argTypes={{
        loading: { control: "boolean" },
        onLogout: { action: "onLogout" },
        onRegisterUser: { action: "onRegisterUser" },
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
