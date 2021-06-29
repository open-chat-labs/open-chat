<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import SessionExpired from "./SessionExpired.svelte";
    import StoryTheme from "../StoryTheme.svelte";
</script>

<Meta
    title="SessionExpired"
    component={SessionExpired}
    argTypes={{
        login: { action: "login" },
    }} />

<Template let:args>
    <StoryTheme>
        <SessionExpired {...args} on:login={args.login} />
    </StoryTheme>
</Template>

<Story name="Default" args={{}} />
