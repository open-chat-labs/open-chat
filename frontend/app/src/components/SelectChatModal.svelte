<!-- svelte-ignore a11y_click_events_have_key_events -->
<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
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
        AvatarSize,
        communitiesStore,
        favouritesStore,
        groupMembersLine,
        iconSize,
        selectedChatIdStore,
        serverDirectChatsStore,
        serverGroupChatsStore,
        type ShareTarget,
    } from "@client";
    import { chatsToShareTo } from "@src/logic/share/chatsToShareTo";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import { rtlStore } from "../stores/rtl";
    import { now } from "../stores/time";
    import Avatar from "./Avatar.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import HoverIcon from "./HoverIcon.svelte";
    import Search from "./Search.svelte";
    import SectionHeader from "./SectionHeader.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import Badges from "./home/profile/Badges.svelte";

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

<section>
    <SectionHeader border={false} gap>
        <span class="icon">
            <AccountMultiple size={$iconSize} color={"var(--icon-txt)"} />
        </span>
        <h4><Translatable resourceKey={i18nKey("sendTo")} /></h4>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="close" onclick={onClose}>
            <HoverIcon title={$_("close")}>
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    </SectionHeader>
    <div class="search">
        <Search searching={false} bind:searchTerm placeholder={i18nKey("search")} />
    </div>
    {#if noTargets}
        <div class="no-chats"><Translatable resourceKey={i18nKey("noChatsAvailable")} /></div>
    {:else}
        <div class="selectable-chats">
            {#if targets.directChats.length > 0}
                <CollapsibleCard
                    open={searchTerm !== ""}
                    first
                    transition={false}
                    headerText={i18nKey("communities.directChats")}>
                    {#snippet titleSlot()}
                        <div class="card-header">
                            <div class="avatar">
                                <MessageOutline size={$iconSize} color={"var(--icon-txt)"} />
                            </div>
                            <div class="details">
                                <h4 class="title">
                                    <Translatable
                                        resourceKey={i18nKey("communities.directChats")} />
                                </h4>
                            </div>
                        </div>
                    {/snippet}
                    {#each targets.directChats as target}
                        <div
                            role="button"
                            tabindex="0"
                            class="row"
                            class:rtl={$rtlStore}
                            onclick={() => onSelect(target.id)}>
                            <div class="avatar">
                                <Avatar url={target.avatarUrl} size={AvatarSize.Default} />
                            </div>
                            <div class="details">
                                <div class="name">
                                    <span class="display-name">
                                        {target.name}
                                    </span>
                                    <Badges
                                        uniquePerson={target.uniquePerson}
                                        diamondStatus={target.diamondStatus}
                                        streak={target.streak} />
                                    {#if target.username !== undefined}
                                        <span class="username">{target.username}</span>
                                    {/if}
                                </div>
                                <div class="description">{target.description}</div>
                            </div>
                        </div>
                    {/each}
                </CollapsibleCard>
            {/if}
            {#if targets.groupChats.length > 0}
                <CollapsibleCard
                    transition={false}
                    open={searchTerm !== ""}
                    headerText={i18nKey("communities.groupChats")}>
                    {#snippet titleSlot()}
                        <div class="card-header">
                            <div class="avatar">
                                <ForumOutline size={$iconSize} color={"var(--icon-txt)"} />
                            </div>
                            <div class="details">
                                <h4 class="title">
                                    <Translatable resourceKey={i18nKey("communities.groupChats")} />
                                </h4>
                            </div>
                        </div>
                    {/snippet}
                    {#each targets.groupChats as target}
                        <div
                            role="button"
                            tabindex="0"
                            class="row"
                            class:rtl={$rtlStore}
                            onclick={() => onSelect(target.id)}>
                            <div class="avatar">
                                <Avatar url={target.avatarUrl} size={AvatarSize.Default} />
                            </div>
                            <div class="details">
                                <div class="name">{target.name}</div>
                                <div class="description">{target.description}</div>
                            </div>
                        </div>
                    {/each}
                </CollapsibleCard>
            {/if}
            {#if targets.favourites.length > 0}
                <CollapsibleCard
                    transition={false}
                    open={searchTerm !== ""}
                    headerText={i18nKey("communities.favourites")}>
                    {#snippet titleSlot()}
                        <div class="card-header">
                            <div class="avatar">
                                <HeartOutline size={$iconSize} color={"var(--icon-txt)"} />
                            </div>
                            <div class="details">
                                <h4 class="title">
                                    <Translatable resourceKey={i18nKey("communities.favourites")} />
                                </h4>
                            </div>
                        </div>
                    {/snippet}
                    {#each targets.favourites as target}
                        <div
                            role="button"
                            tabindex="0"
                            class="row"
                            class:rtl={$rtlStore}
                            onclick={() => onSelect(target.id)}>
                            <div class="avatar">
                                <Avatar url={target.avatarUrl} size={AvatarSize.Default} />
                            </div>
                            <div class="details">
                                <div class="name">{target.name}</div>
                                <div class="description">{target.description}</div>
                            </div>
                        </div>
                    {/each}
                </CollapsibleCard>
            {/if}
            {#each targets.communities as community}
                {#if community.channels.length > 0}
                    <CollapsibleCard
                        transition={false}
                        open={searchTerm !== ""}
                        headerText={i18nKey(community.name)}>
                        {#snippet titleSlot()}
                            <div class="card-header">
                                <div class="avatar">
                                    <Avatar url={community.avatarUrl} size={AvatarSize.Default} />
                                </div>
                                <div class="details">
                                    <h4 class="title">
                                        {community.name}
                                    </h4>
                                </div>
                            </div>
                        {/snippet}
                        {#each community.channels as target}
                            <div
                                role="button"
                                tabindex="0"
                                class="row"
                                class:rtl={$rtlStore}
                                onclick={() => onSelect(target.id)}>
                                <div class="avatar">
                                    <Avatar url={target.avatarUrl} size={AvatarSize.Default} />
                                </div>
                                <div class="details">
                                    <div class="name">{target.name}</div>
                                    <div class="description">{target.description}</div>
                                </div>
                            </div>
                        {/each}
                    </CollapsibleCard>
                {/if}
            {/each}
        </div>
    {/if}
</section>

<style lang="scss">
    :global(.selectable-chats .body) {
        padding: 0;
    }

    :global(.selectable-chats .header) {
        padding: $sp3;
    }

    h4 {
        flex: 1;
        margin: 0;
        margin-top: 2px;
    }

    section {
        background: var(--panel-right-modal);
        height: calc(var(--vh, 1vh) * 100);
        position: relative;
        width: 500px;
        overflow: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        height: 100%;

        @include mobile() {
            width: 100%;
        }
    }

    .icon {
        display: flex;
        padding: $sp3;
    }

    .no-chats {
        margin: $sp3;
        padding: $sp3 $sp4;
        background-color: var(--chatSummary-bg);
        @include font(bold, normal, fs-100);
        color: var(--error);
    }

    .close {
        flex: 0 0 30px;
    }

    .selectable-chats {
        overflow: auto;
        @include nice-scrollbar();
        @include mobile() {
            width: 100%;
        }
    }

    .card-header {
        position: relative;
        display: flex;
        align-items: center;
        width: calc(100% - 24px);
        gap: toRem(12);

        .avatar {
            flex: 0 0 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 48px;
            border-radius: 50%;
            background-color: var(--chatSummary-bg-selected);

            @include mobile() {
                flex: 0 0 42px;
                height: 42px;
            }
        }
    }

    .row {
        position: relative;
        display: flex;
        gap: toRem(12);
        justify-content: space-between;
        align-items: center;
        background-color: var(--chatSummary-bg);
        cursor: pointer;
        padding: $sp3;

        @media (hover: hover) {
            &:hover {
                background-color: var(--chatSummary-hv);
            }
        }
    }

    .details {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        overflow: hidden;
        .name {
            @include font(book, normal, fs-100);

            display: flex;
            align-items: center;
            gap: $sp2;

            .username {
                color: var(--txt-light);
            }
        }
        .description {
            @include ellipsis();
            @include font(book, normal, fs-80);
            color: var(--txt-light);
        }
    }
</style>
