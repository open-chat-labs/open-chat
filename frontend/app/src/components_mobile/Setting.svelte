<script lang="ts">
    import { Body, BodySmall, Container } from "component-lib";
    import { i18nKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        title: string;
        info: string;
        children: Snippet;
        toggle?: () => void;
    }

    let { title, info, children, toggle }: Props = $props();
</script>

<Container onClick={toggle} gap={"sm"} direction={"vertical"}>
    <Container>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)}></Translatable>
        </Body>
        {@render children()}
    </Container>
    <BodySmall colour={"textSecondary"}>
        <Translatable resourceKey={i18nKey(info)}></Translatable>
    </BodySmall>
</Container>
