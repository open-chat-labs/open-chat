<script lang="ts">
    import { Body, BodySmall, ColourVars, Container } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        Icon: any;
        title: ResourceKey;
        info: ResourceKey;
    }

    let { Icon, title, info }: Props = $props();
</script>

<Container
    borderRadius={"md"}
    direction={"vertical"}
    gap={"md"}
    backgroundColour={ColourVars.background1}
    padding={"xl"}>
    <Container crossAxisAlignment={"center"} gap={"sm"}>
        <Icon color={"var(--primary)"} />
        <BodySmall colour={"accent"}>
            <Translatable resourceKey={title}></Translatable>
        </BodySmall>
        <ChevronRight color={ColourVars.primary} />
    </Container>
    <Body>
        <Translatable resourceKey={info}></Translatable>
    </Body>
</Container>
