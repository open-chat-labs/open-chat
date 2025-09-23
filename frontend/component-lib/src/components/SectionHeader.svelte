<script lang="ts">
    import { ColourVars } from "component-lib";
    import type { Snippet } from "svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Container from "./Container.svelte";
    import IconButton from "./buttons/IconButton.svelte";
    import MenuTrigger from "./menu/MenuTrigger.svelte";
    import Caption from "./typography/Caption.svelte";
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
    padding={"lg"}
    backgroundColour={ColourVars.background0}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"spaceBetween"}
    gap={"md"}>
    {#if onBack}
        <IconButton onclick={onBack}>
            <ArrowLeft color={iconColour} />
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
            <Caption colour={"secondary"} ellipsisTruncate fontWeight={"normal"}>
                {@render subtitle()}
            </Caption>
        {/if}
    </Container>
    {#if action}
        <IconButton onclick={onAction}>
            {@render action(iconColour)}
        </IconButton>
    {/if}
    {#if menu}
        <MenuTrigger position={"bottom"} align={"end"}>
            <IconButton>
                <DotsVertical color={"var(--text-primary)"} />
            </IconButton>
            {#snippet menuItems()}
                {@render menu()}
            {/snippet}
        </MenuTrigger>
    {/if}
</Container>
