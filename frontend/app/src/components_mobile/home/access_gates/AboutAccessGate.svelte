<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, Container, type Padding } from "component-lib";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        icon: string;
        alt: string;
        title: string;
        subtitle: string;
        background?: string;
        padding: Padding;
    }

    let { icon, alt, title, subtitle, background, padding }: Props = $props();
</script>

<Container borderRadius={"lg"} {padding} gap={"xl"} {background} crossAxisAlignment={"center"}>
    <img class={"icon"} src={`/assets/access_gate/${icon}`} {alt} />
    <Container gap={"xs"} direction={"vertical"}>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)}></Translatable>
        </Body>
        <BodySmall colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey(subtitle)}></Translatable>
        </BodySmall>
    </Container>
</Container>

<style lang="scss">
    img.icon {
        width: 3rem;
    }
</style>
