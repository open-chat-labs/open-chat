<script lang="ts">
    import { getContext } from "svelte";
    import { rtlStore } from "../stores/rtl";
    import type {
        ChatIdentifier,
        ChatSummary,
        CommunityIdentifier,
        CommunitySummary,
        DiamondMembershipStatus,
        DirectChatSummary,
        GlobalState,
        MultiUserChat,
        OpenChat,
    } from "openchat-client";
    import { userStore, selectedChatId, globalStateStore as globalState } from "openchat-client";
    import Avatar from "./Avatar.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import { AvatarSize, chatIdentifiersEqual } from "openchat-client";
    import { iconSize } from "../stores/iconSize";
    import HoverIcon from "./HoverIcon.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "./SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import { now } from "../stores/time";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import Search from "./Search.svelte";
    import { buildDisplayName } from "../utils/user";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";
    import Badges from "./home/profile/Badges.svelte";

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

    $effect(() => {
        if (initialGlobalState === undefined && $globalState !== undefined) {
            initialGlobalState = $globalState;
        }

        if (initialGlobalState !== undefined) {
            buildListOfTargets(initialGlobalState, $now, $selectedChatId, searchTermLower).then(
                (t) => (targets = t),
            );
        }
    });
    let noTargets = $derived(getNumberOfTargets(targets) === 0);

    let initialGlobalState: GlobalState | undefined = $state(undefined);

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
        global: GlobalState,
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
        const direct = global.directChats.values().map((d) => ({
            ...d,
            name: buildDisplayName($userStore, d.them.userId, false),
        }));

        const group = global.groupChats.values();
        const channels = global.communities.values().flatMap((c) => c.channels);
        const all = [...group, ...direct, ...channels];
        const favs = all.filter((c) => global.favourites.has(c.id));
        try {
            const directChats = await targetsFromChatList(now, direct, selectedChatId);
            const groupChats = await targetsFromChatList(now, group, selectedChatId);
            const favourites = await targetsFromChatList(now, favs, selectedChatId);
            const communities = await Promise.all(
                global.communities.values().map((c) => normaliseCommunity(now, selectedChatId, c)),
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
                const them = $userStore.get(chatSummary.them.userId);
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

<section>
    <SectionHeader border={false} gap>
        <HoverIcon>
            <AccountMultiple size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
        <h4><Translatable resourceKey={i18nKey("sendTo")} /></h4>
        <span role="button" tabindex="0" title={$_("close")} class="close" onclick={onClose}>
            <HoverIcon>
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
                    <div slot="titleSlot" class="card-header">
                        <div class="avatar">
                            <MessageOutline size={$iconSize} color={"var(--icon-txt)"} />
                        </div>
                        <div class="details">
                            <h4 class="title">
                                <Translatable resourceKey={i18nKey("communities.directChats")} />
                            </h4>
                        </div>
                    </div>
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
                    <div slot="titleSlot" class="card-header">
                        <div class="avatar">
                            <ForumOutline size={$iconSize} color={"var(--icon-txt)"} />
                        </div>
                        <div class="details">
                            <h4 class="title">
                                <Translatable resourceKey={i18nKey("communities.groupChats")} />
                            </h4>
                        </div>
                    </div>
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
                    <div slot="titleSlot" class="card-header">
                        <div class="avatar">
                            <HeartOutline size={$iconSize} color={"var(--icon-txt)"} />
                        </div>
                        <div class="details">
                            <h4 class="title">
                                <Translatable resourceKey={i18nKey("communities.favourites")} />
                            </h4>
                        </div>
                    </div>
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
                        <div slot="titleSlot" class="card-header">
                            <div class="avatar">
                                <Avatar url={community.avatarUrl} size={AvatarSize.Default} />
                            </div>
                            <div class="details">
                                <h4 class="title">
                                    {community.name}
                                </h4>
                            </div>
                        </div>
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
