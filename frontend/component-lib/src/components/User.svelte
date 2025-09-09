<script lang="ts">
    import { Avatar, BodySmall } from "component-lib";
    import type { Snippet } from "svelte";
    import Container from "./Container.svelte";
    import Caption from "./typography/Caption.svelte";
    import Title from "./typography/Title.svelte";

    interface Props {
        title: string;
        subtitle: string;
        avatarUrl: string;
        onClick?: () => void;
        button?: Snippet;
        badges?: Snippet;
        menu?: Snippet;
    }

    let { title, subtitle, onClick, avatarUrl, button, badges }: Props = $props();
</script>

<Container {onClick} crossAxisAlignment={"center"} gap={"md"}>
    <Avatar url={avatarUrl} size={"lg"} />
    <Container {onClick} crossAxisAlignment={"center"} gap={"md"}>
        <Container gap={"xxs"} direction={"vertical"} width={{ kind: "fill" }}>
            <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"start"}>
                <Title ellipsisTruncate fontWeight={"semi-bold"}>
                    {title}
                </Title>
                {#if badges}
                    <Caption width={{ kind: "hug" }} colour={"secondary"}>{"Badges?"}</Caption>
                {/if}
            </Container>
            <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
                <BodySmall colour={"secondary"}>{subtitle}</BodySmall>
            </Container>
        </Container>
        <Container gap={"xxs"} width={{ kind: "hug" }}>
            {@render button?.()}
        </Container>
    </Container>
</Container>
