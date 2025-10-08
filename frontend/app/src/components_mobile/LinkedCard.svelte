<script lang="ts">
    import { Body, BodySmall, Chip, ColourVars, Container } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import Info from "svelte-material-icons/InformationOutline.svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        Icon: any;
        title: ResourceKey;
        info: ResourceKey;
        onClick?: () => void;
        error?: Snippet;
    }

    let { Icon, title, info, onClick, error }: Props = $props();
</script>

<Container
    borderRadius={"md"}
    direction={"vertical"}
    gap={"sm"}
    {onClick}
    background={ColourVars.background1}
    padding={"lg"}>
    <Container direction={"vertical"} gap={"md"} padding={"md"}>
        <Container crossAxisAlignment={"center"} gap={"sm"}>
            <Icon color={"var(--primary)"} />
            <BodySmall colour={"primary"}>
                <Translatable resourceKey={title}></Translatable>
            </BodySmall>
            <ChevronRight color={ColourVars.primary} />
        </Container>
        <Body>
            <Translatable resourceKey={info}></Translatable>
        </Body>
    </Container>
    {#if error}
        <Chip fill mode={"filled"}>
            {#snippet icon(color)}
                <Info {color} />
            {/snippet}
            {@render error()}
        </Chip>
    {/if}
</Container>
