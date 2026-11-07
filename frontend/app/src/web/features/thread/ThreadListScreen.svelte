<!-- The left column's list of threads (region "threads", `?threads` on a chat list's path, 4c): the
     threads followed in the scope's chats, a group per chat, All / Unread (the library's
     ThreadList). Opening one shows it in the right column at its root's own URL, keeping the list
     (`?threads`); Back, or no followed threads left, goes back to the chat list (DATA.md,
     ThreadList). -->
<script lang="ts">
    import {
        allUsersStore,
        chatsInitialisedStore,
        chatSummariesStore,
        messageIndexStore,
        messagesRead,
        numberOfThreadsStore,
        selectedChatIdStore,
        selectedCommunitySummaryStore,
        threadOpenStore,
        threadsByChatStore,
        type OpenChat,
        type ThreadPreview,
    } from "@client";
    import ThreadList from "@openchat/ui/src/features/components/ThreadList.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { ThreadPreviews } from "@src/logic/threads/threadPreviews.svelte";
    import { threadUnreadCount } from "@src/logic/threads/threadRead";
    import { isRouteThread } from "@src/logic/threads/threadUrl";
    import { openThreadInColumn } from "../app/rightPanel";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam } from "@src/utils/urls";
    import { findUser } from "@src/utils/user";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import { threadListGroups } from "./thread.adapter";

    let { region, context }: ScreenProps<Extract<LeftRegion, { kind: "threads" }>> = $props();

    const client = getContext<OpenChat>("client");

    const scope = $derived(region.scope);

    // the followed threads' previews, loaded again as they change (logic/threads/threadPreviews,
    // shared with the old lists); a failed load says so and shows none
    const previews = new ThreadPreviews((threadsByChat) => client.threadPreviews(threadsByChat));
    $effect(() => {
        const threadsByChat = $threadsByChatStore;
        untrack(() => void load(threadsByChat));
    });
    $effect(() => () => previews.dispose());

    async function load(threadsByChat: typeof $threadsByChatStore) {
        const failure = await previews.set(threadsByChat);
        if (failure !== undefined) toastStore.showFailureToast(failure);
    }

    // back to the chat list, replacing this entry (Back doesn't depend on history)
    function back() {
        navigate(removeQueryStringParam("threads"), "auto");
    }

    // with no followed threads left, there's no list to show: back to the chats, as the old
    // desktop list does (ROUTES.md; GAPS.md, Threads)
    $effect(() => {
        if ($chatsInitialisedStore && $numberOfThreadsStore === 0) untrack(back);
    });

    function selected(thread: ThreadPreview): boolean {
        return isRouteThread(
            { open: $threadOpenStore, chatId: $selectedChatIdStore, messageIndex: $messageIndexStore },
            thread.chatId,
            thread.rootMessage.event.messageIndex,
        );
    }

    // opening a thread shows it in the right column (even if it was closed) at its root's own
    // path, keeping the list (4c invariant 5)
    function open(thread: ThreadPreview) {
        openThreadInColumn(
            context.rightColumn,
            scope.kind,
            thread.chatId,
            thread.rootMessage.event.messageIndex,
        );
    }

    const groups = $derived.by(() => {
        if (previews.previews.kind !== "loaded") return [];
        // read so the unread counts follow messages being read
        void $messagesRead;
        const users = $allUsersStore;
        const chats = $chatSummariesStore;
        return threadListGroups(previews.previews.threads, {
            userName: (userId) => client.displayName(findUser(userId, users)),
            contentText: (content) => client.getContentAsText($_, content),
            date: (timestamp) =>
                client.formatMessageDate(timestamp, $_("today"), $_("yesterday"), true, true),
            chat: (chatId) => chats.get(chatId),
            replies: (count) => $_("ui.chatBubble.replies", { values: { count } }),
            unread: (thread) =>
                threadUnreadCount(
                    chats.get(thread.chatId),
                    thread.rootMessage.event.messageIndex,
                    (latest) =>
                        client.unreadThreadMessageCount(
                            thread.chatId,
                            thread.rootMessage.event.messageIndex,
                            latest,
                        ),
                ),
            selected,
            open,
        });
    });

    // where the threads come from: the chats, the favourites, or the community's channels
    const scopeLabel = $derived(
        scope.kind === "favourite"
            ? $_("communities.favourites")
            : scope.kind === "community"
              ? ($selectedCommunitySummaryStore?.name ?? "")
              : "ui.threadList.scopeChats",
    );
</script>

{#if previews.previews.kind === "loading"}
    <!-- TODO(design): ThreadList has no loading state -->
    <div class="state"><Spinner /></div>
{:else}
    <ThreadList
        {groups}
        {scopeLabel}
        headerHeight={scope.kind === "community" ? "62px" : "54px"}
        onBack={back}
    />
{/if}

<style lang="scss">
    .state {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>
