<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import Login from "./Login.svelte";
    import StoryTheme from "./StoryTheme.svelte";
</script>

<Meta
    title="Login"
    component={Login}
    argTypes={{
        loading: { control: "boolean" },
        onLogin: { action: "onLogin" },
    }} />

<Template let:args>
    <StoryTheme>
        <Login {...args} on:login={args.onLogin} />
    </StoryTheme>
</Template>

<Story name="Login" args={{}} />

<Story name="Loading" args={{ loading: true }} />
