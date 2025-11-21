<script lang="ts">
    import { Body, Caption, ColourVars, Container } from "component-lib";
    import Copy from "svelte-material-icons/ContentCopy.svelte";

    interface Props {
        title: string;
        body: string;
    }

    let { title, body }: Props = $props();

    function onCopy() {
        navigator.clipboard.writeText(body);
    }
</script>

<Container
    supplementalClass={"copy_card_container"}
    onClick={onCopy}
    borderRadius={"lg"}
    gap={"md"}
    direction={"vertical"}
    padding={"lg"}
    background={ColourVars.background1}>
    <Container crossAxisAlignment={"center"} gap={"sm"}>
        <Container direction={"vertical"}>
            <Body colour={"secondary"} fontWeight={"bold"}>{title}</Body>
            <Caption colour={"textSecondary"}>Tap to copy the value below</Caption>
        </Container>
        <Copy size={"1.25em"} color={ColourVars.secondary} />
    </Container>
    <Body>{body}</Body>
</Container>

<style lang="scss">
    :global(.copy_card_container svg) {
        transition: transform 0.2s ease;
    }

    :global(.copy_card_container:active svg) {
        transform: scale(0.8);
    }
</style>
