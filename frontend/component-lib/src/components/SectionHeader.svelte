<script lang="ts">
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
        title: string;
        subtitle?: string;
        menu?: Snippet;
        action?: Snippet;
        avatar?: Snippet;
    }

    let { onBack, title, subtitle, menu, action, avatar }: Props = $props();
</script>

<Container
    padding={"md"}
    backgroundColour={"var(--background-1)"}
    crossAxisAlignment={"center"}
    gap={"md"}>
    {#if onBack}
        <IconButton onclick={onBack}>
            <ArrowLeft color={"var(--text-primary)"} />
        </IconButton>
    {/if}

    {#if avatar}
        {@render avatar()}
    {/if}
    <Container gap={"xxs"} direction={"vertical"} width={{ kind: "fill" }}>
        <Title ellipsisTruncate fontWeight={"semi-bold"}>
            {title}
        </Title>
        {#if subtitle !== undefined}
            <Caption colour={"secondary"} ellipsisTruncate fontWeight={"normal"}>
                {subtitle}
            </Caption>
        {/if}
    </Container>
    {#if action}
        <IconButton>
            {@render action()}
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
