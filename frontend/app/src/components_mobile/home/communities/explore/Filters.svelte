<script lang="ts">
    import { Container, Subtitle, Switch, Title } from "component-lib";
    import { communityFiltersStore, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey, supportedLanguages } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
</script>

<Container height={{ kind: "fill" }} padding={"lg"} gap={"lg"} direction={"vertical"}>
    <Title fontWeight={"bold"}>
        <Translatable resourceKey={i18nKey("communities.primaryLanguage")} />
    </Title>
    <Container height={{ kind: "fill" }} direction={"vertical"} gap={"md"}>
        {#each supportedLanguages as lang}
            <Container onClick={() => client.toggleCommunityFilterLanguage(lang.code)} gap={"md"}>
                <Switch
                    onChange={() => client.toggleCommunityFilterLanguage(lang.code)}
                    checked={$communityFiltersStore.has(lang.code)} />
                <Subtitle>
                    <Translatable resourceKey={i18nKey(lang.name)} />
                </Subtitle>
            </Container>
        {/each}
    </Container>
</Container>
