<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import { rtlStore } from "../stores/rtl";
    import type {
        ChatIdentifier,
        ChatSummary,
        CommunityIdentifier,
        CommunitySummary,
        DirectChatSummary,
        MultiUserChat,
        OpenChat,
    } from "openchat-client";
    import Avatar from "./Avatar.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import { AvatarSize, GlobalState, UserStatus, chatIdentifiersEqual } from "openchat-client";
    import Panel from "./Panel.svelte";
    import { iconSize } from "../stores/iconSize";
    import HoverIcon from "./HoverIcon.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "./SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import { now } from "../stores/time";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    type ShareTo = {
        directChats: ShareChat[];
        groupChats: ShareChat[];
        communities: ShareCommunity[];
    };
    type ShareChat = {
        kind: "chat";
        id: ChatIdentifier;
        userId: string | undefined;
        name: string;
        avatarUrl: string;
        description: string;
    };
    type ShareCommunity = {
        kind: "community";
        id: CommunityIdentifier;
        name: string;
        avatarUrl: string;
        description: string;
        channels: ShareChat[];
    };

    let openTargetGroup: string | undefined = undefined;

    $: userStore = client.userStore;
    $: selectedChatId = client.selectedChatId;
    $: globalState = client.globalStateStore;

    $: {
        buildListOfTargets($globalState, $now, $selectedChatId).then((t) => (targets = t));
    }
    $: targets = undefined as ShareTo | undefined;
    $: noTargets = getNumberOfTargets(targets) === 0;

    function getNumberOfTargets(targets: ShareTo | undefined): number {
        if (targets === undefined) return 0;
        return (
            targets.directChats.length +
            targets.groupChats.length +
            targets.communities.flatMap((c) => c.channels).length
        );
    }

    async function targetsFromChatList(
        now: number,
        chats: ChatSummary[],
        selectedChatId: ChatIdentifier | undefined
    ): Promise<ShareChat[]> {
        return Promise.all(
            filterChatSelection(chats, selectedChatId).map((c) => normaliseChatSummary(now, c))
        );
    }

    async function buildListOfTargets(
        global: GlobalState,
        now: number,
        selectedChatId: ChatIdentifier | undefined
    ): Promise<ShareTo | undefined> {
        let targets: ShareTo | undefined = undefined;
        try {
            const directChats = await targetsFromChatList(
                now,
                global.directChats.values(),
                selectedChatId
            );
            const groupChats = await targetsFromChatList(
                now,
                global.groupChats.values(),
                selectedChatId
            );
            const communities = await Promise.all(
                global.communities.values().map((c) => normaliseCommunity(now, selectedChatId, c))
            );
            return {
                directChats,
                groupChats,
                communities,
            };
        } catch (err) {}
        return targets;
    }

    async function normaliseCommunity(
        now: number,
        selectedChatId: ChatIdentifier | undefined,
        { id, name, avatar, description, channels }: CommunitySummary
    ): Promise<ShareCommunity> {
        const normalisedChannels = await Promise.all(
            filterChatSelection(channels, selectedChatId).map((c) => normaliseChatSummary(now, c))
        );
        return {
            kind: "community",
            id,
            name,
            avatarUrl: client.communityAvatarUrl(id.communityId, avatar),
            description,
            channels: normalisedChannels,
        };
    }

    async function normaliseChatSummary(now: number, chatSummary: ChatSummary): Promise<ShareChat> {
        switch (chatSummary.kind) {
            case "direct_chat":
                const description = await buildDirectChatDescription(chatSummary, now);
                const them = $userStore[chatSummary.them.userId];
                return {
                    kind: "chat",
                    id: chatSummary.id,
                    userId: chatSummary.them.userId,
                    name: client.usernameAndIcon(them),
                    avatarUrl: client.userAvatarUrl(them),
                    description,
                };

            default:
                return {
                    kind: "chat",
                    id: chatSummary.id,
                    userId: undefined,
                    name: chatSummary.name,
                    avatarUrl: client.groupAvatarUrl(chatSummary),
                    description: buildGroupChatDescription(chatSummary),
                };
        }
    }

    async function buildDirectChatDescription(
        chat: DirectChatSummary,
        now: number
    ): Promise<string> {
        return (await client.getUserStatus(chat.them.userId, now)) === UserStatus.Online
            ? $_("onlineNow")
            : $_("offline");
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
        selectedChatId: ChatIdentifier | undefined
    ): ChatSummary[] {
        if (selectedChatId === undefined) return chats;
        return chats.filter(
            (c) => !chatIdentifiersEqual(selectedChatId, c.id) && client.canSendMessages(c.id)
        );
    }

    function selectChat(chatId: ChatIdentifier) {
        dispatch("select", chatId);
    }
</script>

<Panel right forceModal>
    <SectionHeader flush gap>
        <HoverIcon>
            <AccountMultiple size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
        <h4>{$_("sendTo")}</h4>
        <span title={$_("close")} class="close" on:click={() => dispatch("close")}>
            <HoverIcon>
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    </SectionHeader>
    {#if targets === undefined}
        ...
    {:else if noTargets}
        <div class="no-chats">{$_("noChatsAvailable")}</div>
    {:else}
        <div class="selectable-chats">
            <CollapsibleCard first headerText={$_("communities.directChats")}>
                <div slot="titleSlot" class="card-header">
                    <div class="avatar">
                        <MessageOutline size={$iconSize} color={"var(--icon-txt)"} />
                    </div>
                    <div class="details">
                        <h4 class="title">
                            {$_("communities.directChats")}
                        </h4>
                    </div>
                </div>
                {#each targets.directChats as target}
                    <div class="row" class:rtl={$rtlStore} on:click={() => selectChat(target.id)}>
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
            <CollapsibleCard headerText={$_("communities.groupChats")}>
                <div slot="titleSlot" class="card-header">
                    <div class="avatar">
                        <ForumOutline size={$iconSize} color={"var(--icon-txt)"} />
                    </div>
                    <div class="details">
                        <h4 class="title">
                            {$_("communities.groupChats")}
                        </h4>
                    </div>
                </div>
                {#each targets.groupChats as target}
                    <div class="row" class:rtl={$rtlStore} on:click={() => selectChat(target.id)}>
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
            {#each targets.communities as community}
                <CollapsibleCard open={false} headerText={community.name}>
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
                            class="row"
                            class:rtl={$rtlStore}
                            on:click={() => selectChat(target.id)}>
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
            {/each}
        </div>
    {/if}
</Panel>

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
        }
        .description {
            @include ellipsis();
            @include font(book, normal, fs-80);
            color: var(--txt-light);
        }
    }
</style>
