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
        disabled?: boolean;
    }

    let { title, info, children, toggle, disabled = false }: Props = $props();
</script>

<Container onClick={disabled ? undefined : toggle} gap={"sm"} direction={"vertical"}>
    <Container>
        <Body colour={disabled ? "textTertiary" : "textPrimary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)}></Translatable>
        </Body>
        {@render children()}
    </Container>
    <BodySmall colour={disabled ? "textTertiary" : "textSecondary"}>
        <Translatable resourceKey={i18nKey(info)}></Translatable>
    </BodySmall>
</Container>
