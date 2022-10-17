<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import { rtlStore } from "../stores/rtl";
    import type {
        ChatSummary,
        DirectChatSummary,
        GroupChatSummary,
        OpenChat,
    } from "openchat-client";
    import Avatar from "./Avatar.svelte";
    import { AvatarSize, UserStatus } from "openchat-client";
    import Panel from "./Panel.svelte";
    import { iconSize } from "../stores/iconSize";
    import HoverIcon from "./HoverIcon.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "./SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import { now } from "../stores/time";

    const client = getContext<OpenChat>("client");

    $: userStore = client.userStore;

    export let chatsSummaries: ChatSummary[];

    const dispatch = createEventDispatcher();

    $: chats = chatsSummaries.map((c) => normaliseChatSummary($now, c));

    function normaliseChatSummary(now: number, chatSummary: ChatSummary) {
        if (chatSummary.kind === "direct_chat") {
            return {
                id: chatSummary.chatId,
                name: $userStore[chatSummary.them]?.username,
                avatarUrl: client.userAvatarUrl($userStore[chatSummary.them]),
                description: buildDirectChatDescription(chatSummary, now),
            };
        }
        return {
            id: chatSummary.chatId,
            name: chatSummary.name,
            avatarUrl: client.groupAvatarUrl(chatSummary),
            description: buildGroupChatDescription(chatSummary),
        };
    }

    function buildDirectChatDescription(chat: DirectChatSummary, now: number): string {
        return client.getUserStatus(now, $userStore, chat.them) === UserStatus.Offline
            ? $_("offline")
            : $_("onlineNow");
    }

    function buildGroupChatDescription(group: GroupChatSummary): string {
        if (group.description.length > 0) {
            return group.description;
        } else {
            const number = group.memberCount;
            return group.public
                ? $_("publicGroupWithN", { values: { number } })
                : $_("privateGroupWithN", { values: { number } });
        }
    }

    function selectChat(chatId: string) {
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
    {#if chats.length === 0}
        <div class="no-chats">{$_("noChatsAvailable")}</div>
    {:else}
        <div class="body">
            {#each chats as chat}
                <div class="row" class:rtl={$rtlStore} on:click={() => selectChat(chat.id)}>
                    <div class="avatar">
                        <Avatar url={chat.avatarUrl} size={AvatarSize.Small} />
                    </div>
                    <div class="details">
                        <div class="name">{chat.name}</div>
                        <div class="description">{chat.description}</div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</Panel>

<style type="text/scss">
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

    .body {
        overflow: auto;
        @include nice-scrollbar();
        @include mobile() {
            width: 100%;
        }
        padding: $sp3;
    }

    .row {
        position: relative;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
        padding: $sp3;
        color: var(--chatSummary-txt1);
        background-color: var(--chatSummary-bg);
        border-bottom: var(--chatSummary-bd);
        margin-bottom: 0;
        cursor: pointer;

        &:hover {
            background-color: var(--chatSummary-hv);
        }

        &:last-child {
            border-bottom: 0;
        }
    }

    .avatar {
        flex: 0 0 40px;
    }

    .details {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        overflow: hidden;
        .name {
            @include font(book, normal, fs-100);
            color: var(--chatSummary-txt1);
        }
        .description {
            @include ellipsis();
            @include font(book, normal, fs-80);
            color: var(--chatSummary-txt2);
        }
    }
</style>
