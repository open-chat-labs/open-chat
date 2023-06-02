<script lang="ts">
    import { _ } from "svelte-i18n";
    import Loading from "../../Loading.svelte";
    import ThreadPreviewComponent from "./ThreadPreview.svelte";
    import { getContext } from "svelte";
    import type { ThreadPreview, EventWrapper, Message, ThreadSyncDetails } from "openchat-client";
    import { toastStore } from "../../../stores/toast";
    import { logger } from "../../../utils/logging";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    $: serverChatSummariesStore = client.serverChatSummariesStore;
    $: threadsByChatStore = client.threadsByChatStore;

    let threads: ThreadPreview[] = [];
    let observer: IntersectionObserver = new IntersectionObserver(() => {});
    let loading = false;
    let initialised = false;

    function eventsFromThreadPreviews(threads: ThreadPreview[]): EventWrapper<Message>[] {
        return threads.flatMap((t) => [t.rootMessage, ...t.latestReplies]);
    }

    function updateUserStore(userIdsFromEvents: Set<string>) {
        client.getMissingUsers(userIdsFromEvents);
    }

    $: {
        // TODO - this might run a bit more frequently than we need it to. Not 100% sure yet.
        // we definitely cannot get away with *just* doing it onMount though.
        loading = true;
        client
            .threadPreviews(
                client.toRecord2(
                    Object.entries($threadsByChatStore),
                    ([chatId, _]) => chatId,
                    ([chatId, threads]) => {
                        const latestEventIndex =
                            $serverChatSummariesStore[chatId]?.latestEventIndex;
                        return [threads, latestEventIndex] as [
                            ThreadSyncDetails[],
                            number | undefined
                        ];
                    }
                )
            )
            .then((t) => {
                threads = t;
                updateUserStore(client.userIdsFromEvents(eventsFromThreadPreviews(t)));
                initialised = true;
            })
            .catch((err) => {
                toastStore.showFailureToast("thread.previewFailure");
                logger.error("Unable to load thread previews: ", err);
            })
            .finally(() => (loading = false));
    }
</script>

<div class="threads">
    {#if loading && !initialised}
        <Loading />
    {:else}
        {#each threads as thread, _i (thread.rootMessage.event.messageId)}
            <ThreadPreviewComponent {observer} {thread} />
        {/each}
    {/if}
</div>

<style lang="scss">
    .threads {
        height: 100%;
        overflow-x: hidden;
        padding: 0 $sp4;
        @include nice-scrollbar();
        @include mobile() {
            padding: 0 $sp4;
        }
    }
</style>
