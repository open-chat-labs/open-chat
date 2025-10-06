<script lang="ts">
    import { ColourVars, Label } from "component-lib";
    import { type Snippet } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Container from "./Container.svelte";
    import Avatar from "./avatar/Avatar.svelte";

    interface Props {
        children?: Snippet;
        avatarUrl: string;
        onRemove?: () => void;
    }
    let { children, onRemove, avatarUrl }: Props = $props();
</script>

<Container
    supplementalClass={"user_chip"}
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}
    width={{ kind: "hug" }}
    gap={"sm"}
    padding={["zero", "md", "zero", "zero"]}
    borderColour={ColourVars.secondary}
    borderRadius={"circle"}
    borderWidth={"thick"}
    onClick={onRemove}>
    <Avatar size={"sm"} url={avatarUrl}></Avatar>
    <Label colour={"secondaryLight"} width={{ kind: "hug" }}>
        {@render children?.()}
    </Label>
    {#if onRemove}
        <span class="icon">
            <Close color={ColourVars.secondaryLight} />
        </span>
    {/if}
</Container>

<style lang="scss">
    :global(.user_chip .icon svg) {
        width: 1rem;
        height: 1rem;
    }
    .icon {
        display: flex;
    }
</style>
