<script lang="ts">
    import { interpolate } from "@src/i18n/i18n";
    import {
        Avatar,
        Body,
        BodySmall,
        Container,
        Option,
        Search,
        Sheet,
        Subtitle,
    } from "component-lib";
    import {
        allUsersStore,
        botIsInstallable,
        communitiesStore,
        currentUserIdStore,
        currentUserStore,
        emptyChatMetrics,
        i18nKey,
        nullMembership,
        OpenChat,
        ROLE_OWNER,
        serverGroupChatsStore,
        type CommunitySummary,
        type DirectChatSummary,
        type ExternalBot,
        type GroupChatSummary,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Translatable from "../Translatable.svelte";
    import NothingToSee from "../home/NothingToSee.svelte";

    /**
     * There is a problem with this. We might get her by clicking a bot in the Explorer.
     * This is supposed to show a list of the locations into which we can install this bot.
     * Ideally this should exclude any location into which the bot is already installed. However,
     * that information is only available when we have that community / chat *selected*. So we don't know.
     * And we also need to add an entry to install the bot as a direct chat
     */

    const client = getContext<OpenChat>("client");

    type Match = {
        avatarUrl: string;
        name: string;
        id: string;
        isCommunity: boolean;
        collection: DirectChatSummary | GroupChatSummary | CommunitySummary;
    };

    interface Props {
        bot: ExternalBot;
        onSelect: (collection: DirectChatSummary | GroupChatSummary | CommunitySummary) => void;
        onDismiss: () => void;
    }

    let { onSelect, bot, onDismiss }: Props = $props();
    let searchTerm = $state<string>();
    let placeholder = $derived(interpolate($_, i18nKey("Search for a community or group")));
    let results: Match[] = $state([]);

    const fakeDirectChat: DirectChatSummary = {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId: $currentUserIdStore },
        them: { kind: "direct_chat", userId: $currentUserIdStore },
        readByThemUpTo: undefined,
        latestMessage: undefined,
        latestEventIndex: 0,
        latestMessageIndex: undefined,
        lastUpdated: BigInt(Date.now()),
        dateCreated: BigInt(Date.now()),
        metrics: emptyChatMetrics(),
        eventsTTL: undefined,
        eventsTtlLastUpdated: BigInt(0),
        membership: {
            ...nullMembership(),
            role: ROLE_OWNER,
        },
    };

    onMount(() => onPerformSearch(""));

    function onPerformSearch(term?: string) {
        const termLower = term?.toLowerCase();

        const me = {
            avatarUrl: client.userAvatarUrl($allUsersStore.get($currentUserIdStore)),
            name: $currentUserStore.username,
            id: $currentUserIdStore,
            isCommunity: false,
            collection: fakeDirectChat,
        };

        const communities: Match[] = [...$communitiesStore.values()]
            .filter(
                (c) =>
                    c.membership.role === ROLE_OWNER &&
                    (termLower === undefined || c.name.toLowerCase().includes(termLower)),
            )
            .map((c) => ({
                avatarUrl: client.communityAvatarUrl(c.id.communityId, c.avatar),
                name: c.name,
                id: c.id.communityId,
                isCommunity: true,
                collection: c as CommunitySummary,
            }));

        const groups: Match[] = [...$serverGroupChatsStore.values()]
            .filter(
                (g) =>
                    g.membership.role === ROLE_OWNER &&
                    (termLower === undefined || g.name.toLowerCase().includes(termLower)),
            )
            .map((g) => ({
                avatarUrl: client.groupAvatarUrl(g),
                name: g.name,
                id: g.id.groupId,
                isCommunity: false,
                collection: g as GroupChatSummary,
            }));

        communities.sort((a: Match, b: Match) => a.name.localeCompare(b.name));
        groups.sort((a: Match, b: Match) => a.name.localeCompare(b.name));
        results = [me, ...communities, ...groups].filter((l) =>
            botIsInstallable(bot, l.collection.id),
        );
    }
</script>

<Sheet {onDismiss}>
    <Container
        height={{ size: "100%" }}
        supplementalClass={"token_selector"}
        padding={"lg"}
        gap={"xl"}
        direction={"vertical"}>
        <Container padding={["zero", "sm"]} gap={"md"} crossAxisAlignment={"center"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Select installation location")}></Translatable>
            </Subtitle>
        </Container>

        <Search
            onClear={() => (searchTerm = undefined)}
            {placeholder}
            searching={false}
            value={searchTerm}
            onSearch={onPerformSearch} />

        <Container
            padding={["zero", "md"]}
            gap={"lg"}
            supplementalClass={"token_selector"}
            direction={"vertical"}>
            {#if results.length === 0}
                <NothingToSee
                    height={{ size: "6" }}
                    padding={"zero"}
                    title={"No matching locations"}
                    subtitle={searchTerm !== ""
                        ? "Try relaxing your search criteria"
                        : "You may not have permission to install this bot anywhere"} />
            {:else}
                {#each results as match (match.id)}
                    <Option
                        onClick={() => onSelect(match.collection)}
                        padding={["zero", "md", "zero", "zero"]}
                        value={match.collection}
                        selected={false}>
                        <Container gap={"md"}>
                            <Avatar url={match.avatarUrl} size={"md"}></Avatar>
                            <Container direction={"vertical"}>
                                <Body>{match.name}</Body>
                                <BodySmall colour={"textSecondary"}>
                                    {#if match.isCommunity}
                                        Install into community
                                    {:else}
                                        Install into chat
                                    {/if}
                                </BodySmall>
                            </Container>
                        </Container>
                    </Option>
                {/each}
            {/if}
        </Container>
    </Container>
</Sheet>
