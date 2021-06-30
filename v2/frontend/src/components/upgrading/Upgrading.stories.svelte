<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import Upgrading from "./Upgrading.svelte";
    import StoryTheme from "../StoryTheme.svelte";
</script>

<Meta
    title="Upgrading"
    component={Upgrading}
    argTypes={{
        login: { action: "login" },
    }} />

<Template let:args>
    <StoryTheme>
        <Upgrading {...args} on:login={args.login} />
    </StoryTheme>
</Template>

<Story name="Default" args={{}} />
