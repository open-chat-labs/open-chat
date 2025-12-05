<script lang="ts">
    import { flattenGateConfig, gateLabel } from "@src/utils/access";
    import { Avatar, Body, BodySmall, Chip, ColourVars, Container, Title } from "component-lib";
    import type { AccessGateConfig, DataContent, OpenChat } from "openchat-client";
    import { ModerationFlags } from "openchat-client";
    import { getContext } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import { i18nKey, supportedLanguagesByCode } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";
    import WithVerifiedBadge from "../../../icons/WithVerifiedBadge.svelte";
    import IntersectionObserver from "../../IntersectionObserver.svelte";
    import Markdown from "../../Markdown.svelte";
    import CommunityBanner from "./CommunityBanner.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        id: string;
        name: string;
        description: string;
        avatar: DataContent;
        banner: DataContent;
        memberCount: number;
        channelCount: number;
        header?: boolean;
        gateConfig: AccessGateConfig;
        language: string;
        flags: number;
        verified: boolean;
    }

    let {
        id,
        name,
        description,
        avatar,
        banner,
        memberCount,
        channelCount,
        header = false,
        gateConfig,
        language,
        flags,
        verified,
    }: Props = $props();

    let gates = flattenGateConfig(gateConfig);

    let flagsArray = $derived(serialiseFlags(flags));
    function serialiseFlags(flags: number) {
        const f: string[] = [];
        if (client.hasModerationFlag(flags, ModerationFlags.Adult)) {
            f.push("communities.adult");
        }
        if (client.hasModerationFlag(flags, ModerationFlags.Offensive)) {
            f.push("communities.offensive");
        }
        if (client.hasModerationFlag(flags, ModerationFlags.UnderReview)) {
            f.push("communities.underReview");
        }
        return f;
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<Container
    padding={["zero", "zero", "lg", "zero"]}
    borderRadius={"md"}
    background={ColourVars.background1}
    direction={"vertical"}>
    <IntersectionObserver>
        {#snippet children(intersecting)}
            <CommunityBanner {intersecting} square={header} {banner}></CommunityBanner>
        {/snippet}
    </IntersectionObserver>
    <Container
        supplementalClass={"community_details"}
        gap={"md"}
        padding={["zero", "lg"]}
        direction="vertical">
        <Container gap={"sm"}>
            <Avatar borderWidth={"thick"} size={"xxl"} url={client.communityAvatarUrl(id, avatar)}
            ></Avatar>
            <Container height={"fill"} mainAxisAlignment={"end"} direction={"vertical"}>
                <Container gap={"sm"} crossAxisAlignment={"center"}>
                    <WithVerifiedBadge
                        {verified}
                        size={"small"}
                        tooltip={i18nKey("verified.verified", undefined, "community")}>
                        <Title fontWeight={"bold"}>
                            {name}
                        </Title>
                    </WithVerifiedBadge>
                </Container>
                <BodySmall colour={"textSecondary"}>
                    <Container gap={"xs"}>
                        {memberCount.toLocaleString()} members
                        <span>.</span>
                        {supportedLanguagesByCode[language]?.name}
                    </Container>
                </BodySmall>
            </Container>
        </Container>
        <Body fontWeight={"light"}>
            <Markdown inline={false} text={description} />
        </Body>
        <Container gap={"sm"} wrap>
            <Chip mode={"default"}>
                {#snippet icon(color)}
                    <Pound {color} />
                {/snippet}
                {channelCount.toLocaleString()} channels
            </Chip>
            {#each flagsArray as flag}
                <Chip mode={"default"}>
                    <div class="flag"><Translatable resourceKey={i18nKey(flag)} /></div>
                </Chip>
            {/each}
        </Container>
        <Container gap={"sm"} wrap>
            {#each gates as gate}
                <Chip mode={"filter"}>
                    {#snippet icon(color)}
                        <Check {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey(gateLabel[gate.kind])}></Translatable>
                </Chip>
            {/each}
        </Container>
    </Container>
</Container>

<style lang="scss">
    :global(.container.community_details) {
        margin-top: -2rem;
    }
</style>
