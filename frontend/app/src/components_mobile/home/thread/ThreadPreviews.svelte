<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { Container } from "component-lib";
    import {
        chatListScopeStore,
        debouncedDerived,
        emptyCombinedUnreadCounts,
        numberOfThreadsStore,
        threadsByChatStore,
        unreadCommunityChannelCountsStore,
        unreadDirectAndGroupCountsStore,
        unreadFavouriteCountsStore,
        type OpenChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import ThreadPreviewComponent from "./ThreadPreview.svelte";

    const client = getContext<OpenChat>("client");

    let observer: IntersectionObserver = new IntersectionObserver(() => {});
    let loading = $state(true);
    let initialised = $state(false);
    let spinner = $derived(loading && !initialised);

    let threads = $derived.by(
        debouncedDerived(() => [$threadsByChatStore], loadThreadPreviews, 300, []),
    );

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

    async function loadThreadPreviews() {
        loading = true;
        try {
            return client.threadPreviews($threadsByChatStore);
        } catch (_) {
            toastStore.showFailureToast(i18nKey("thread.previewFailure"));
            return [];
        } finally {
            loading = false;
        }
    }
</script>

<SlidingPageContent title={i18nKey("Threads")} {subtitle}>
    <Container
        mainAxisAlignment={spinner ? "center" : undefined}
        crossAxisAlignment={spinner ? "center" : undefined}
        supplementalClass={"threads"}
        width={"fill"}
        height={"fill"}
        direction={"vertical"}>
        {#if loading && !initialised}
            <FancyLoader size={"3rem"} />
        {:else}
            <VirtualList
                keyFn={(e) => `${e.rootMessage.index}_${e.rootMessage.event.messageId}`}
                items={threads}>
                {#snippet children(thread)}
                    <ThreadPreviewComponent {observer} {thread} />
                {/snippet}
            </VirtualList>
        {/if}
    </Container>
</SlidingPageContent>
