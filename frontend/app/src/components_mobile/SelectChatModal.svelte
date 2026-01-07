<!-- svelte-ignore a11y_click_events_have_key_events -->
<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import {
        Avatar,
        Body,
        BodySmall,
        ColourVars,
        Column,
        Row,
        Search,
        Subtitle,
    } from "component-lib";
    import type {
        ChatIdentifier,
        ChatSummary,
        CommunityIdentifier,
        CommunitySummary,
        DiamondMembershipStatus,
        DirectChatSummary,
        MultiUserChat,
        OpenChat,
    } from "openchat-client";
    import {
        allUsersStore,
        chatIdentifiersEqual,
        communitiesStore,
        favouritesStore,
        selectedChatIdStore,
        serverDirectChatsStore,
        serverGroupChatsStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import { now } from "../stores/time";
    import { buildDisplayName } from "../utils/user";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import NothingToSee from "./home/NothingToSee.svelte";
    import Badges from "./home/profile/Badges.svelte";
    import SlidingPageContent from "./home/SlidingPageContent.svelte";
    import Translatable from "./Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onSelect: (chatId: ChatIdentifier) => void;
        onClose: () => void;
    }

    type ShareTo = {
        directChats: ShareChat[];
        groupChats: ShareChat[];
        favourites: ShareChat[];
        communities: ShareCommunity[];
    };
    type ShareChat = {
        kind: "chat";
        id: ChatIdentifier;
        userId: string | undefined;
        name: string;
        diamondStatus: DiamondMembershipStatus["kind"];
        streak: number;
        avatarUrl: string;
        description: string;
        username: string | undefined;
        lastUpdated: bigint;
        uniquePerson: boolean;
    };
    type ShareCommunity = {
        kind: "community";
        id: CommunityIdentifier;
        name: string;
        avatarUrl: string;
        description: string;
        lastUpdated: bigint;
        channels: ShareChat[];
    };

    let { onClose, onSelect }: Props = $props();
    let searchTerm = $state("");
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let targets = $state<ShareTo>({
        directChats: [],
        groupChats: [],
        favourites: [],
        communities: [],
    });

    trackedEffect("select-chat-modal", () => {
        buildListOfTargets($now, $selectedChatIdStore, searchTermLower).then((t) => (targets = t));
    });
    let noTargets = $derived(getNumberOfTargets(targets) === 0);

    function getNumberOfTargets(targets: ShareTo): number {
        return (
            targets.directChats.length +
            targets.groupChats.length +
            targets.communities.flatMap((c) => c.channels).length
        );
    }

    async function targetsFromChatList(
        now: number,
        chats: ChatSummary[],
        selectedChatId: ChatIdentifier | undefined,
    ): Promise<ShareChat[]> {
        return Promise.all(
            filterChatSelection(chats, selectedChatId).map((c) => normaliseChatSummary(now, c)),
        );
    }

    function matchesSearch(thing: ShareChat | ShareCommunity, searchTerm: string): boolean {
        return (
            (searchTerm === "" ||
                thing.name.toLocaleLowerCase().includes(searchTerm) ||
                (thing.kind === "chat" &&
                    thing.username?.toLocaleLowerCase()?.includes(searchTerm))) ??
            false
        );
    }

    function chatMatchesSearch(chats: ShareChat[], searchTerm: string): ShareChat[] {
        return chats.filter((c) => matchesSearch(c, searchTerm)).sort(compare);
    }

    function communityMatchesSearch(communities: ShareCommunity[], searchTerm: string) {
        return communities
            .reduce((agg, c) => {
                if (matchesSearch(c, searchTerm)) {
                    agg.push(c);
                } else {
                    const filtered = chatMatchesSearch(c.channels, searchTerm);
                    if (filtered.length > 0) {
                        agg.push({
                            ...c,
                            channels: filtered,
                        });
                    }
                }
                return agg;
            }, [] as ShareCommunity[])
            .sort(compare);
    }

    async function buildListOfTargets(
        now: number,
        selectedChatId: ChatIdentifier | undefined,
        searchTerm: string,
    ): Promise<ShareTo> {
        let targets: ShareTo = {
            directChats: [],
            groupChats: [],
            favourites: [],
            communities: [],
        };
        const direct = [...$serverDirectChatsStore.values()].map((d) => ({
            ...d,
            name: buildDisplayName($allUsersStore, d.them.userId, "user"),
        }));

        const group = [...$serverGroupChatsStore.values()];
        const channels = [...$communitiesStore.values()].flatMap((c) => c.channels);
        const all = [...group, ...direct, ...channels];
        const favs = all.filter((c) => $favouritesStore.has(c.id));
        try {
            const directChats = await targetsFromChatList(now, direct, selectedChatId);
            const groupChats = await targetsFromChatList(now, group, selectedChatId);
            const favourites = await targetsFromChatList(now, favs, selectedChatId);
            const communities = await Promise.all(
                [...$communitiesStore.values()].map((c) =>
                    normaliseCommunity(now, selectedChatId, c),
                ),
            );
            return {
                directChats: chatMatchesSearch(directChats, searchTerm),
                groupChats: chatMatchesSearch(groupChats, searchTerm),
                favourites: chatMatchesSearch(favourites, searchTerm),
                communities: communityMatchesSearch(communities, searchTerm),
            };
        } catch (err) {}
        return targets;
    }

    async function normaliseCommunity(
        now: number,
        selectedChatId: ChatIdentifier | undefined,
        { id, name, avatar, description, channels, lastUpdated }: CommunitySummary,
    ): Promise<ShareCommunity> {
        const normalisedChannels = await Promise.all(
            filterChatSelection(channels, selectedChatId).map((c) => normaliseChatSummary(now, c)),
        );
        return {
            kind: "community",
            id,
            name,
            avatarUrl: client.communityAvatarUrl(id.communityId, avatar),
            description,
            lastUpdated,
            channels: normalisedChannels,
        };
    }

    async function normaliseChatSummary(now: number, chatSummary: ChatSummary): Promise<ShareChat> {
        switch (chatSummary.kind) {
            case "direct_chat":
                const description = await buildDirectChatDescription(chatSummary, now);
                const them = $allUsersStore.get(chatSummary.them.userId);
                return {
                    kind: "chat",
                    id: chatSummary.id,
                    userId: chatSummary.them.userId,
                    name: client.displayName(them),
                    diamondStatus: them?.diamondStatus ?? "inactive",
                    streak: client.getStreak(chatSummary.them.userId),
                    avatarUrl: client.userAvatarUrl(them),
                    description,
                    username: them ? "@" + them.username : undefined,
                    lastUpdated: chatSummary.lastUpdated,
                    uniquePerson: them?.isUniquePerson ?? false,
                };

            default:
                return {
                    kind: "chat",
                    id: chatSummary.id,
                    userId: undefined,
                    name: chatSummary.name,
                    diamondStatus: "inactive" as DiamondMembershipStatus["kind"],
                    streak: 0,
                    avatarUrl: client.groupAvatarUrl(chatSummary),
                    description: buildGroupChatDescription(chatSummary),
                    username: undefined,
                    lastUpdated: chatSummary.lastUpdated,
                    uniquePerson: false,
                };
        }
    }

    async function buildDirectChatDescription(
        chat: DirectChatSummary,
        now: number,
    ): Promise<string> {
        return client.getLastOnlineDate(chat.them.userId, now).then((lastOnline) => {
            if (lastOnline !== undefined && lastOnline !== 0) {
                return client.formatLastOnlineDate($_, now, lastOnline)[0];
            } else {
                return $_("offline");
            }
        });
    }

    function buildGroupChatDescription(group: MultiUserChat): string {
        if (group.description.length > 0) {
            return group.description;
        } else {
            const level = $_(`level.${group.level}`).toLowerCase();
            const number = group.memberCount;
            return group.public
                ? $_("publicGroupWithN", { values: { number, level } })
                : $_("privateGroupWithN", { values: { number, level } });
        }
    }

    function filterChatSelection(
        chats: ChatSummary[],
        selectedChatId: ChatIdentifier | undefined,
    ): ChatSummary[] {
        return chats.filter(
            (c) =>
                !chatIdentifiersEqual(selectedChatId, c.id) &&
                client.canSendMessage(c.id, "message", "text"),
        );
    }

    function compare(a: { name: string }, b: { name: string }): number {
        return a.name.localeCompare(b.name);
    }
</script>

{#snippet generalHeader(Icon: any, title: string)}
    <Row padding={["sm", "zero"]} gap={"md"} crossAxisAlignment={"center"}>
        <Icon size={"1.5rem"} color={ColourVars.textPrimary} />
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)} />
        </Subtitle>
    </Row>
{/snippet}

{#snippet nonDirect(target: ShareChat)}
    <Row
        onClick={() => onSelect(target.id)}
        padding={["sm", "md"]}
        gap={"md"}
        crossAxisAlignment={"center"}>
        <Avatar url={target.avatarUrl} size={"lg"} />
        <Column>
            <Body width={"hug"}>{target.name}</Body>
            <Body colour={"textSecondary"}>
                {target.description}
            </Body>
        </Column>
    </Row>
{/snippet}

<SlidingPageContent title={i18nKey("sendTo")} onBack={onClose}>
    <Column gap={"xl"} padding={"lg"}>
        <Search
            onClear={() => (searchTerm = "")}
            searching={false}
            bind:value={searchTerm}
            placeholder={interpolate($_, i18nKey("search"))} />
    </Column>
    {#if noTargets}
        <NothingToSee
            title={interpolate($_, i18nKey("noChatsAvailable"))}
            subtitle={"Looks like you aren't a member of any other chats"} />
    {:else}
        <Column>
            {#if targets.directChats.length > 0}
                <CollapsibleCard
                    open={searchTerm !== ""}
                    first
                    fill
                    transition={false}
                    headerText={i18nKey("communities.directChats")}>
                    {#snippet titleSlot()}
                        {@render generalHeader(MessageOutline, "communities.directChats")}
                    {/snippet}
                    {#each targets.directChats as target}
                        <Row
                            onClick={() => onSelect(target.id)}
                            padding={["sm", "md"]}
                            gap={"md"}
                            crossAxisAlignment={"center"}>
                            <Avatar url={target.avatarUrl} size={"lg"} />
                            <Column>
                                <Row width={"hug"} crossAxisAlignment={"center"} gap={"xs"}>
                                    <Body width={"hug"}>{target.name}</Body>
                                    <Badges
                                        uniquePerson={target.uniquePerson}
                                        diamondStatus={target.diamondStatus}
                                        streak={target.streak} />
                                    {#if target.username !== undefined}
                                        <BodySmall colour={"textSecondary"}>
                                            {target.username}
                                        </BodySmall>
                                    {/if}
                                </Row>
                                <Body colour={"textSecondary"}>
                                    {target.description}
                                </Body>
                            </Column>
                        </Row>
                    {/each}
                </CollapsibleCard>
            {/if}
            {#if targets.groupChats.length > 0}
                <CollapsibleCard
                    transition={false}
                    fill
                    open={searchTerm !== ""}
                    headerText={i18nKey("communities.groupChats")}>
                    {#snippet titleSlot()}
                        {@render generalHeader(ForumOutline, "communities.groupChats")}
                    {/snippet}
                    {#each targets.groupChats as target}
                        {@render nonDirect(target)}
                    {/each}
                </CollapsibleCard>
            {/if}
            {#if targets.favourites.length > 0}
                <CollapsibleCard
                    transition={false}
                    fill
                    open={searchTerm !== ""}
                    headerText={i18nKey("communities.favourites")}>
                    {#snippet titleSlot()}
                        {@render generalHeader(HeartOutline, "communities.favourites")}
                    {/snippet}
                    {#each targets.favourites as target}
                        {@render nonDirect(target)}
                    {/each}
                </CollapsibleCard>
            {/if}
            {#each targets.communities as community}
                {#if community.channels.length > 0}
                    <CollapsibleCard
                        fill
                        transition={false}
                        open={searchTerm !== ""}
                        headerText={i18nKey(community.name)}>
                        {#snippet titleSlot()}
                            <Row
                                padding={["zero", "zero"]}
                                gap={"md"}
                                crossAxisAlignment={"center"}>
                                <Avatar url={community.avatarUrl} size={"lg"} />
                                <Subtitle fontWeight={"bold"}>
                                    {community.name}
                                </Subtitle>
                            </Row>
                        {/snippet}
                        {#each community.channels as target}
                            {@render nonDirect(target)}
                        {/each}
                    </CollapsibleCard>
                {/if}
            {/each}
        </Column>
    {/if}
</SlidingPageContent>
