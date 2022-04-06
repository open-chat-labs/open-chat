<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { rtlStore } from "../stores/rtl";
    import type { ChatSummary, DirectChatSummary, GroupChatSummary } from "../domain/chat/chat";
    import Avatar from "./Avatar.svelte";
    import { AvatarSize, UserStatus } from "../domain/user/user";
    import { userStore } from "../stores/user";
    import { avatarUrl as getAvatarUrl, getUserStatus } from "../domain/user/user.utils";
    import Panel from "./Panel.svelte";
    import { iconSize } from "../stores/iconSize";
    import HoverIcon from "./HoverIcon.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "./SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import { now } from "../stores/time";

    export let chatsSummaries: ChatSummary[];

    $: chats = chatsSummaries.map((c) => normaliseChatSummary($now, c));

    const dispatch = createEventDispatcher();

    function normaliseChatSummary(now: number, chatSummary: ChatSummary) {
        if (chatSummary.kind === "direct_chat") {
            return {
                id: chatSummary.chatId,
                name: $userStore[chatSummary.them]?.username,
                avatarUrl: getAvatarUrl($userStore[chatSummary.them]),
                description: buildDirectChatDescription(chatSummary, now),
            };
        }
        return {
            id: chatSummary.chatId,
            name: chatSummary.name,
            avatarUrl: getAvatarUrl(chatSummary, "../assets/group.svg"),
            description: buildGroupChatDescription(chatSummary),
        };
    }

    function buildDirectChatDescription(chat: DirectChatSummary, now: number): string {
        return getUserStatus(now, $userStore, chat.them) === UserStatus.Offline
            ? $_("offline")
            : $_("onlineNow");
    }

    function buildGroupChatDescription(group: GroupChatSummary): string {
        if (group.description.length > 0) {
            return group.description;
        } else {
            const number = group.participantCount;
            return group.public
                ? $_("publicGroupWithN", { values: { number } })
                : $_("privateGroupWithN", { values: { number } });
        }
    }

    function selectChat(chatId: string) {
        dispatch("select", chatId);
    }
</script>

<Panel right>
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
</Panel>

<style type="text/scss">
    h4 {
        flex: 1;
        margin: 0;
        margin-top: 2px;
    }

    .close {
        flex: 0 0 30px;
    }

    .body {
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
        margin-bottom: var(--chatSummary-mb);
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
