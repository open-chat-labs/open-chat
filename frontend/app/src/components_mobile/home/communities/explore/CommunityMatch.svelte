<script lang="ts">
    import { i18nKey, supportedLanguagesByCode } from "@src/i18n/i18n";
    import { Avatar, BodySmall, Chip, Container, Subtitle } from "component-lib";
    import {
        ModerationFlags,
        type CommunityMatch,
        type CommunitySummary,
        type OpenChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import WithVerifiedBadge from "../../../icons/WithVerifiedBadge.svelte";
    import Translatable from "../../../Translatable.svelte";
    import Markdown from "../../Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunityMatch | CommunitySummary;
        onClick?: () => void;
    }

    let { community, onClick }: Props = $props();

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

<Container {onClick} padding={["sm", "zero"]} direction={"vertical"}>
    <Container overflow={"hidden"} gap={"md"}>
        <Avatar
            radius={"lg"}
            size={"xxl"}
            url={client.communityAvatarUrl(community.id.communityId, community.avatar)}>
        </Avatar>
        <Container direction={"vertical"}>
            <Container gap={"sm"} crossAxisAlignment={"center"}>
                <WithVerifiedBadge
                    verified={community.verified}
                    size={"small"}
                    tooltip={i18nKey("verified.verified", undefined, "community")}>
                    <Subtitle fontWeight={"bold"}>
                        {community.name}
                    </Subtitle>
                </WithVerifiedBadge>
            </Container>
            <BodySmall colour={"textSecondary"}>
                <Markdown twoLine inline={false} text={community.description} />
            </BodySmall>
            <BodySmall colour={"secondary"}>
                {community.memberCount.toLocaleString()} member(s), {supportedLanguagesByCode[
                    community.primaryLanguage
                ]?.name}
            </BodySmall>
            {#if community.kind === "community_match"}
                <Container gap={"sm"} wrap>
                    {#each serialiseFlags(community.flags) as flag}
                        <Chip mode={"default"}>
                            <Translatable resourceKey={i18nKey(flag)} />
                        </Chip>
                    {/each}
                </Container>
            {/if}
        </Container>
    </Container>
</Container>
