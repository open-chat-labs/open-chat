<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import UnexpectedError from "./UnexpectedError.svelte";
    import StoryTheme from "../StoryTheme.svelte";
</script>

<Meta
    title="Register"
    component={UnexpectedError}
    argTypes={{
        error: {
            defaultValue: { message: "Oh no - something terrible has happened" },
        },
    }} />

<Template let:args>
    <StoryTheme>
        <UnexpectedError {...args} />
    </StoryTheme>
</Template>

<Story name="Default" args={{}} />
