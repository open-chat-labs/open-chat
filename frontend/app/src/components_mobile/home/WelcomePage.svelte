<script lang="ts">
    import { i18nKey, interpolate, supportedLanguagesByCode } from "@src/i18n/i18n";
    import { communitySearchState } from "@src/stores/search.svelte";
    import {
        Body,
        BodySmall,
        Button,
        ColourVars,
        Container,
        Logo,
        SectionHeader,
        StatusCard,
        Subtitle,
    } from "component-lib";
    import {
        diamondStatusStore,
        publish,
        type CommunityIdentifier,
        type CommunityMatch,
        type CommunitySummary,
        type OpenChat,
    } from "openchat-client";
    import page from "page";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import RightChevron from "svelte-material-icons/ChevronRight.svelte";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import Translate from "svelte-material-icons/Translate.svelte";
    import MulticolourText from "../MulticolourText.svelte";
    import SparkleBoxOutline from "../SparkleBoxOutline.svelte";
    import Translatable from "../Translatable.svelte";
    import { updateCommunityState } from "./communities/createOrUpdate/community.svelte";
    import CommunityBanner from "./communities/explore/CommunityBanner.svelte";
    import CommunityMatchComponent from "./communities/explore/CommunityMatch.svelte";

    const client = getContext<OpenChat>("client");

    let ocCommunity = $state<CommunitySummary>();
    let highlightCommunity = $derived(ocCommunity ?? communitySearchState.results[0]);

    onMount(() => {
        searchCommunities();
        client.getOpenChatCommunity().then((c) => (ocCommunity = c));
        return () => {
            communitySearchState.reset();
        };
    });

    function createCommunity() {
        updateCommunityState.createCommunity(client);
    }

    function searchCommunities() {
        communitySearchState.reset();
        client.exploreCommunities(undefined, 0, 3, 0, []).then((results) => {
            if (results.kind === "success") {
                communitySearchState.results = results.matches;
                communitySearchState.total = results.total;
            }
        });
    }
    function goToCommunity(id: CommunityIdentifier) {
        page(`/community/${id.communityId}`);
    }
</script>

{#snippet highlightCard(community: CommunitySummary | CommunityMatch)}
    <Container gap={"sm"} supplementalClass={"highlight_community"} direction={"vertical"}>
        <CommunityBanner intersecting banner={community.banner}>
            <Container
                pos={{ bottom: "sm", right: "sm" }}
                width={"hug"}
                crossAxisAlignment={"center"}
                gap={"xs"}
                borderRadius={"md"}
                padding={["xs", "md"]}
                background={ColourVars.background0}>
                <Translate color={ColourVars.primaryLight} />
                <BodySmall colour={"primaryLight"}>
                    {supportedLanguagesByCode[community.primaryLanguage]?.name}
                </BodySmall>
            </Container>
        </CommunityBanner>
        <CommunityMatchComponent {community} />
    </Container>
{/snippet}

{#snippet or()}
    <Container crossAxisAlignment={"center"} padding={["zero", "xl"]} gap={"lg"}>
        <div class="line"></div>
        <Body colour={"textSecondary"} align={"center"} width={"hug"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("or")} />
        </Body>
        <div class="line"></div>
    </Container>
{/snippet}

<Container height={"fill"} direction={"vertical"}>
    <SectionHeader>
        {#snippet avatar()}
            <Logo />
        {/snippet}

        {#snippet title()}
            <Translatable resourceKey={i18nKey("Communities")} />
        {/snippet}
    </SectionHeader>
    <Container direction={"vertical"} padding={["xl", "lg"]} gap={"xxl"}>
        <StatusCard
            mode={"warning"}
            title={interpolate($_, i18nKey("You are not a member of any communities"))}
            body={interpolate(
                $_,
                i18nKey(
                    "You are seeing this screen since you are not a member of any community. Once you join a community, one or more, they will be accessible from this screen. ",
                ),
            )}>
        </StatusCard>
        <Container direction={"vertical"} padding={["zero", "lg"]} gap={"xl"}>
            <Container direction={"vertical"} gap={"sm"}>
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Recommended")} />
                </Subtitle>
                <Body colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Join the OpenChat community to access latest info from the development team, and get some support.",
                        )} />
                </Body>
            </Container>
            {#if highlightCommunity}
                {@render highlightCard(highlightCommunity)}
                <Button onClick={() => goToCommunity(highlightCommunity.id)}>
                    {#snippet icon(color)}
                        <RightChevron {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Visit OpenChat community")} />
                </Button>
            {/if}
        </Container>
        {@render or()}
        <Container direction={"vertical"} padding={["zero", "lg"]} gap={"xl"}>
            <Container direction={"vertical"} gap={"sm"}>
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Communities")} />
                </Subtitle>
                <Body colour={"textSecondary"}>
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey(
                                    "There are many more other communities that you may find interesting, do not miss out on them! Here are some of our ",
                                ),
                                colour: "textSecondary",
                            },
                            {
                                text: i18nKey("top communities "),
                                colour: "primary",
                            },
                            {
                                text: i18nKey("to consider."),
                                colour: "textSecondary",
                            },
                        ]}>
                    </MulticolourText>
                </Body>
            </Container>
            <Container direction={"vertical"} gap={"xs"}>
                {#each communitySearchState.results as community}
                    <CommunityMatchComponent
                        onClick={() => goToCommunity(community.id)}
                        {community} />
                {/each}
            </Container>
        </Container>
        <Container direction={"vertical"} padding={["zero", "lg"]} gap={"xl"}>
            <Container direction={"vertical"} gap={"sm"}>
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Bots")} />
                </Subtitle>
                <Body colour={"textSecondary"}>
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey(
                                    "OpenChat platform supports bots, which extend its functionality, and power-up your chats. You can even install bots and chat with them ",
                                ),
                                colour: "textSecondary",
                            },
                            {
                                text: i18nKey("directly!"),
                                colour: "warning",
                            },
                        ]}>
                    </MulticolourText>
                </Body>
            </Container>
            <Button onClick={() => page("/communities")}>
                {#snippet icon(color)}
                    <RightChevron {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Explore communities & bots")} />
            </Button>
        </Container>
        {@render or()}
        <Container direction={"vertical"} padding={["zero", "lg"]} gap={"xl"}>
            <Container direction={"vertical"} gap={"sm"}>
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Create your community")} />
                </Subtitle>
                <Body colour={"textSecondary"}>
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("Our "),
                                colour: "textSecondary",
                            },
                            {
                                text: i18nKey("diamond level "),
                                colour: "primary",
                            },
                            {
                                text: i18nKey(
                                    "users have the option to create their own communities.",
                                ),
                                colour: "textSecondary",
                            },
                        ]}>
                    </MulticolourText>
                </Body>
            </Container>
            {#if $diamondStatusStore.kind === "inactive"}
                <SparkleBoxOutline>
                    <Container
                        gap={"md"}
                        onClick={() => publish("upgrade")}
                        mainAxisAlignment={"center"}
                        crossAxisAlignment={"center"}>
                        <Subtitle colour={"primary"} width={"hug"} fontWeight={"bold"}>
                            <Translatable resourceKey={i18nKey("Become a diamond member")} />
                        </Subtitle>
                        <Diamond size={"1.5rem"} color={ColourVars.primary} />
                    </Container>
                </SparkleBoxOutline>
            {:else}
                <Button onClick={createCommunity}>
                    {#snippet icon(color)}
                        <RightChevron {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Create a community")} />
                </Button>
            {/if}
        </Container>
    </Container>
</Container>

<style lang="scss">
    :global(.highlight_community .banner) {
        border-radius: var(--rad-md) !important;
    }
    .line {
        height: 6px;
        width: 100%;
        border-radius: var(--rad-xl);
        background-color: var(--background-2);
    }
</style>
