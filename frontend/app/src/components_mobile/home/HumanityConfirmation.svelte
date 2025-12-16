<script lang="ts">
    import { Body, BodySmall, ColourVars, Container, Subtitle, Switch } from "component-lib";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";

    interface Props {
        confirmed: boolean;
    }

    let { confirmed = $bindable() }: Props = $props();
</script>

<Container gap={"lg"} direction={"vertical"}>
    <Subtitle fontWeight={"bold"} colour={"primary"}>
        <Translatable resourceKey={i18nKey("IMPORTANT! Before you proceed")}></Translatable>
    </Subtitle>
    <Body fontWeight={"bold"}>
        <Markdown text={interpolate($_, i18nKey("access.doYouHaveUniquePersonCredential"))} />
    </Body>

    <BodySmall>
        <Markdown text={interpolate($_, i18nKey("access.uniquePersonInfo2"))} />
    </BodySmall>

    <BodySmall>
        <Translatable resourceKey={i18nKey("access.uniquePersonInfo3")}></Translatable>
    </BodySmall>

    <Container
        onClick={() => (confirmed = !confirmed)}
        background={ColourVars.background2}
        crossAxisAlignment={"center"}
        borderRadius={"md"}
        gap={"lg"}
        padding={"lg"}>
        <BodySmall>
            <Translatable
                resourceKey={i18nKey("I have verified my unique personhood with DecideAI")}>
            </Translatable>
        </BodySmall>
        <Switch bind:checked={confirmed}></Switch>
    </Container>
</Container>
