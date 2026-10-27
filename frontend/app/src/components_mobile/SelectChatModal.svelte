<!-- svelte-ignore a11y_click_events_have_key_events -->
<script lang="ts">
    import type { IconComponent } from "@src/utils/iconComponent";
    import type {
        ChatIdentifier,
        ChatSummary,
        CommunityIdentifier,
        CommunitySummary,
        DiamondMembershipStatus,
        DirectChatSummary,
        MultiUserChat,
        OpenChat,
    } from "@client";
    import {
        allUsersStore,
        communitiesStore,
        favouritesStore,
        groupMembersLine,
        selectedChatIdStore,
        serverDirectChatsStore,
        serverGroupChatsStore,
        type ShareTarget,
    } from "@client";
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
    import { chatsToShareTo } from "@src/logic/share/chatsToShareTo";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import { now } from "../stores/time";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import NothingToSee from "./home/NothingToSee.svelte";
    import Badges from "./home/profile/Badges.svelte";
    import SlidingPageContent from "./home/SlidingPageContent.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onSelect: (chatId: ChatIdentifier) => void;
        onClose: () => void;
        excludeCurrent?: boolean;
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

    let { onClose, onSelect, excludeCurrent = true }: Props = $props();
    let searchTerm = $state("");
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let targets = $state<ShareTo>();

    trackedEffect("select-chat-modal", () => {
        buildListOfTargets($now, $selectedChatIdStore, searchTermLower).then((t) => (targets = t));
    });

    let noTargets = $derived(targets !== undefined ? getNumberOfTargets(targets) === 0 : false);

    function getNumberOfTargets(targets: ShareTo): number {
        return (
            targets.directChats.length +
            targets.groupChats.length +
            targets.communities.flatMap((c) => c.channels).length
        );
    }

    async function buildListOfTargets(
        now: number,
        selectedChatId: ChatIdentifier | undefined,
        searchTerm: string,
    ): Promise<ShareTo> {
        const chats = (targets: ShareTarget[]) =>
            Promise.all(targets.map((t) => normaliseChatSummary(now, t.chat)));
        try {
            // which chats, the search and their order: the same in every tree (chatsToShareTo)
            const found = chatsToShareTo(
                client,
                {
                    directChats: $serverDirectChatsStore.values(),
                    groupChats: $serverGroupChatsStore.values(),
                    communities: $communitiesStore.values(),
                    favourites: $favouritesStore,
                    users: $allUsersStore,
                },
                excludeCurrent ? selectedChatId : undefined,
                searchTerm,
            );
            return {
                directChats: await chats(found.directChats),
                groupChats: await chats(found.groupChats),
                favourites: await chats(found.favourites),
                communities: await Promise.all(
                    found.communities.map(async ({ community, channels }) =>
                        normaliseCommunity(community, await chats(channels)),
                    ),
                ),
            };
        } catch {
            // a description that can't be built leaves the targets empty
            return { directChats: [], groupChats: [], favourites: [], communities: [] };
        }
    }

    function normaliseCommunity(
        { id, name, avatar, description, lastUpdated }: CommunitySummary,
        channels: ShareChat[],
    ): ShareCommunity {
        return {
            kind: "community",
            id,
            name,
            avatarUrl: client.communityAvatarUrl(id.communityId, avatar),
            description,
            lastUpdated,
            channels,
        };
    }

    async function normaliseChatSummary(now: number, chatSummary: ChatSummary): Promise<ShareChat> {
        switch (chatSummary.kind) {
            case "direct_chat": {
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
            }

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
        return group.description.length > 0
            ? group.description
            : interpolate($_, groupMembersLine(group));
    }
</script>

{#snippet generalHeader(Icon: IconComponent, title: string)}
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
            <Body ellipsisTruncate colour={"textSecondary"}>
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
    {:else if targets !== undefined}
        <Column height={"fill"}>
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
