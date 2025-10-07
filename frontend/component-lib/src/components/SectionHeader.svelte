<script lang="ts">
    import { ColourVars, Label } from "component-lib";
    import type { Snippet } from "svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Container from "./Container.svelte";
    import IconButton from "./buttons/IconButton.svelte";
    import MenuTrigger from "./menu/MenuTrigger.svelte";
    import Title from "./typography/Title.svelte";

    interface Props {
        onBack?: () => void;
        onAction?: () => void;
        title: Snippet;
        subtitle?: Snippet;
        menu?: Snippet;
        action?: Snippet<[string]>;
        avatar?: Snippet;
    }

    let { onBack, onAction, title, subtitle, menu, action, avatar }: Props = $props();

    // Not sure if this will ever *not* be --text-primary
    let iconColour = "var(--text-primary)";
</script>

<Container
    supplementalClass={"section_header"}
    padding={["md", "sm", "sm", "sm"]}
    background={ColourVars.background0}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"spaceBetween"}
    gap={"md"}>
    {#if onBack}
        <IconButton size={"md"} onclick={onBack}>
            {#snippet icon(color)}
                <ArrowLeft {color} />
            {/snippet}
        </IconButton>
    {/if}

    {#if avatar}
        {@render avatar()}
    {/if}
    <Container gap={"xxs"} direction={"vertical"} width={{ kind: "fill" }}>
        <Title ellipsisTruncate fontWeight={"semi-bold"}>
            {@render title()}
        </Title>
        {#if subtitle !== undefined}
            <Label colour={"textSecondary"} ellipsisTruncate fontWeight={"normal"}>
                {@render subtitle()}
            </Label>
        {/if}
    </Container>
    {#if action}
        <IconButton size={"lg"} onclick={onAction}>
            {#snippet icon(color)}
                {@render action(color)}
            {/snippet}
        </IconButton>
    {/if}
    {#if menu}
        <MenuTrigger position={"bottom"} align={"end"}>
            <IconButton size={"lg"}>
                {#snippet icon(color)}
                    <DotsVertical {color} />
                {/snippet}
            </IconButton>
            {#snippet menuItems()}
                {@render menu()}
            {/snippet}
        </MenuTrigger>
    {/if}
</Container>

<style lang="scss">
    :global(.container.section_header) {
        border-bottom: var(--bw-thin) solid var(--background-1);
    }
</style>
