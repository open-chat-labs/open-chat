<!-- The threads the user follows in a scope (native plan 12 "Channel list": a community's Threads row; plan 10
     "Threads"), pushed at the scope's URL with `?threads`: the native page header ("Threads" over the community's
     name) over the library's ThreadList (All / Unread, a group per channel, each thread's root with its replies and
     unread count). A thread opens at its root's URL, over its conversation, keeping this list under it. The
     previews load as the web's list loads them (logic/threads/threadPreviews), the rows are the web's
     (logic/threads/threadRows). -->
<script lang="ts">
    import {
        allChatsStore,
        allUsersStore,
        chatsInScope,
        communitiesStore,
        favouritesStore,
        followedThreadsByChat,
        messagesRead,
        userGroupSummariesStore,
        type OpenChat,
        type ThreadPreview,
    } from "@client";
    import ThreadList from "@openchat/ui/src/features/components/ThreadList.svelte";
    import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { typedMentions } from "@src/logic/conversation/typedMentions";
    import { ThreadPreviews } from "@src/logic/threads/threadPreviews.svelte";
    import { threadUnreadCount } from "@src/logic/threads/threadRead";
    import { threadListGroups } from "@src/logic/threads/threadRows";
    import { threadOpenPath } from "@src/logic/threads/threadUrl";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { findUser } from "@src/utils/user";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "threads" }>> = $props();

    const client = getContext<OpenChat>("client");

    const scope = $derived(screen.scope);

    // the scope's own chats (a community's channels), whatever the route's scope while another tab
    // shows: their followed threads
    const threadsByChat = $derived(
        followedThreadsByChat(chatsInScope(scope, $allChatsStore, $favouritesStore)),
    );

    // loaded again as they change (logic/threads/threadPreviews, the web's and the old lists'); a
    // failed load says so and shows none
    const previews = new ThreadPreviews((byChat) => client.threadPreviews(byChat));
    $effect(() => {
        const byChat = threadsByChat;
        untrack(() => void load(byChat));
    });
    $effect(() => () => previews.dispose());

    async function load(byChat: typeof threadsByChat) {
        const failure = await previews.set(byChat);
        if (failure !== undefined) toastStore.showFailureToast(failure);
    }

    // a thread opens over its conversation at its root's URL, keeping this list under it
    function open(thread: ThreadPreview) {
        navigate(
            threadOpenPath(
                scope.kind,
                thread.chatId,
                thread.rootMessage.event.messageIndex,
                "?threads",
            ),
        );
    }

    const groups = $derived.by(() => {
        if (previews.previews.kind !== "loaded") return [];
        // read so the unread counts follow messages being read
        void $messagesRead;
        const users = $allUsersStore;
        const chats = $allChatsStore;
        return threadListGroups(previews.previews.threads, {
            gradient: (swatch) => AVATAR_GRADIENTS[swatch],
            userName: (userId) => client.displayName(findUser(userId, users)),
            contentText: (content) => client.getContentAsText($_, content),
            mentionsAsTyped: typedMentions({
                users,
                userGroups: { get: (id) => $userGroupSummariesStore.get(id) },
            }),
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
            // the open thread is the one pushed over this list: none is marked here
            selected: () => false,
            open,
        });
    });

    // where the threads come from: the community, the favourites, or the chats
    const scopeLabel = $derived(
        scope.kind === "community"
            ? ($communitiesStore.get(scope.id)?.name ?? "")
            : scope.kind === "favourite"
              ? $_("communities.favourites")
              : $_("ui.threadList.scopeChats"),
    );
</script>

<div class="threads">
    <NativePageHeader title={$_("ui.threadList.title")} sub={scopeLabel} onBack={context.back} />
    <div class="body">
        {#if previews.previews.kind === "loading"}
            <!-- TODO(design): ThreadList has no loading state (as on the web) -->
            <div class="state"><Spinner /></div>
        {:else}
            <ThreadList {groups} header={false} channelHeads={scope.kind === "community"} />
        {/if}
    </div>
</div>

<style lang="scss">
    .threads {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    // the list scrolls clear of the bottom (notes §1 Spacing: the safe area + 48px on pushed
    // screens)
    .body {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;

        :global(.list) {
            padding-bottom: calc(var(--safe-bottom) + 48px);
        }
    }

    .state {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>
