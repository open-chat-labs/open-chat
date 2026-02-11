<script lang="ts">
    import { BodySmall, Container, Subtitle, Switch, Title } from "component-lib";
    import { showUnpublishedBots } from "openchat-client";
    import { i18nKey } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";
</script>

<Container padding={"lg"} gap={"lg"} direction={"vertical"}>
    <Title fontWeight={"bold"}>
        <Translatable resourceKey={i18nKey("Show unpublished bots")} />
    </Title>

    <BodySmall colour={"textSecondary"}>
        <Translatable
            resourceKey={i18nKey(
                "Choose whether or not to see bots which have not yet been published. This can be useful for testing purposes.",
            )} />
    </BodySmall>
    <Container direction={"vertical"} gap={"md"}>
        <Switch onChange={() => showUnpublishedBots.toggle()} checked={$showUnpublishedBots}>
            <Subtitle>
                <Translatable resourceKey={i18nKey("Show unpublished bots")} />
            </Subtitle>
        </Switch>
    </Container>
</Container>
