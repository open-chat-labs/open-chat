<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { ThreadPreviews } from "@src/logic/threads/threadPreviews.svelte";
    import { toastStore } from "@src/stores/toast";
    import { Container } from "component-lib";
    import {
        chatListScopeStore,
        emptyCombinedUnreadCounts,
        numberOfThreadsStore,
        threadsByChatStore,
        unreadCommunityChannelCountsStore,
        unreadDirectAndGroupCountsStore,
        unreadFavouriteCountsStore,
        type OpenChat,
    } from "@client";
    import { getContext, untrack } from "svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import VirtualList from "@openchat/ui/src/lib/virtual/VirtualList.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import ThreadPreviewComponent from "./ThreadPreview.svelte";

    const client = getContext<OpenChat>("client");

    // loaded again as the followed threads change (logic/threads/threadPreviews); the list stays
    // up while it reloads, so the spinner shows on the first load only
    const previews = new ThreadPreviews((threadsByChat) => client.threadPreviews(threadsByChat));
    $effect(() => {
        const threadsByChat = $threadsByChatStore;
        untrack(async () => {
            const failure = await previews.set(threadsByChat);
            if (failure !== undefined) toastStore.showFailureToast(failure);
        });
    });
    $effect(() => () => previews.dispose());
    let spinner = $derived(previews.previews.kind === "loading");

    let unread = $derived.by(() => {
        switch ($chatListScopeStore.kind) {
            case "chats": {
                return $unreadDirectAndGroupCountsStore.threads;
            }
            case "favourite": {
                return $unreadFavouriteCountsStore.threads;
            }
            case "community": {
                return (
                    $unreadCommunityChannelCountsStore.get($chatListScopeStore.id) ??
                    emptyCombinedUnreadCounts()
                ).threads;
            }
            default:
                return emptyCombinedUnreadCounts().threads;
        }
    });
    let muted = $derived(!unread.mentions && unread.unmuted <= 0);
    let count = $derived(muted ? unread.muted : unread.unmuted);

    let subtitle = $derived(
        count > 0
            ? i18nKey(`Unread messages in ${count} thread(s)`)
            : i18nKey(`Messages in ${$numberOfThreadsStore} thread(s)`),
    );

</script>

<SlidingPageContent title={i18nKey("Threads")} {subtitle}>
    <Container
        mainAxisAlignment={spinner ? "center" : undefined}
        crossAxisAlignment={spinner ? "center" : undefined}
        supplementalClass={"threads"}
        width={"fill"}
        height={"fill"}
        direction={"vertical"}>
        {#if previews.previews.kind === "loading"}
            <FancyLoader size={"3rem"} />
        {:else}
            <VirtualList
                keyFn={(e) => `${e.rootMessage.index}_${e.rootMessage.event.messageId}`}
                items={previews.previews.threads}>
                {#snippet children(thread)}
                    <ThreadPreviewComponent {thread} />
                {/snippet}
            </VirtualList>
        {/if}
    </Container>
</SlidingPageContent>
