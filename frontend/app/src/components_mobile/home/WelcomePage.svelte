<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import {
        Body,
        Button,
        Container,
        Logo,
        SectionHeader,
        StatusCard,
        Subtitle,
    } from "component-lib";
    import page from "page";
    import { _ } from "svelte-i18n";
    import RightChevron from "svelte-material-icons/ChevronRight.svelte";
    import Translatable from "../Translatable.svelte";

    // function goToCommunity(id: CommunityIdentifier) {
    //     page(`/community/${id.communityId}`);
    // }
</script>

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
            <div>small community card - OC community</div>
            <Button>
                {#snippet icon(color)}
                    <RightChevron {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Visit OpenChat community")} />
            </Button>
        </Container>
        {@render or()}
        <Container direction={"vertical"} padding={["zero", "lg"]} gap={"xl"}>
            <Container direction={"vertical"} gap={"sm"}>
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Communities")} />
                </Subtitle>
                <Body colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "There are many more other communities that you may find interesting, do not miss out on them! Here are some of our top communities to consider.",
                        )} />
                </Body>
            </Container>
            <div>A list of the top 3-5 communities</div>
        </Container>
        <Container direction={"vertical"} padding={["zero", "lg"]} gap={"xl"}>
            <Container direction={"vertical"} gap={"sm"}>
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Bots")} />
                </Subtitle>
                <Body colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "OpenChat platform supports bots, which extend its functionality, and power-up your chats. You can even install bots and chat with them directly!",
                        )} />
                </Body>
            </Container>
            <div>A list of the top 3-5 communities</div>
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
                    <Translatable
                        resourceKey={i18nKey(
                            "Our diamond level users have the option to create their own communities.",
                        )} />
                </Body>
            </Container>
            <Button>
                {#snippet icon(color)}
                    <RightChevron {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Create a community")} />
            </Button>
        </Container>
    </Container>
</Container>

<style lang="scss">
    .line {
        height: 6px;
        width: 100%;
        border-radius: var(--rad-xl);
        background-color: var(--background-2);
    }
</style>
