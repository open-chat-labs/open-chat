<script>
    import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
    import ExpiredModal from "./ExpiredModal.svelte";
    import StoryTheme from "./StoryTheme.svelte";
    import Overlay from "./Overlay.svelte";
</script>

<Meta title="ExpiredModal" component={ExpiredModal} />

<Template let:args>
    <StoryTheme>
        <Overlay active={true}>
            <ExpiredModal />
        </Overlay>
    </StoryTheme>
</Template>

<Story name="ExpiredModal" />
