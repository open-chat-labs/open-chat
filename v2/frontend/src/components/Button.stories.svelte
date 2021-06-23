<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import Button from "./Button.svelte";
    import StoryTheme from "./StoryTheme.svelte";
</script>

<Meta
    title="Example/Button"
    component={Button}
    argTypes={{
        loading: { control: "boolean" },
        secondary: { control: "boolean" },
        disabled: { control: "boolean" },
        onClick: { action: "onClick" },
    }} />

<Template let:args>
    <StoryTheme>
        <div class="button-wrapper">
            <Button {...args} on:click={args.onClick}>Click Me!</Button>
        </div>
    </StoryTheme>
</Template>

<Story name="Primary" args={{}} />

<Story
    name="Loading"
    args={{
        loading: true,
    }} />

<Story
    name="Secondary"
    args={{
        secondary: true,
    }} />

<Story
    name="Disabled"
    args={{
        disabled: true,
    }} />

<style>
    .button-wrapper {
        padding: 40px;
        background-color: #efefef;
        height: 80vh;
    }
</style>
