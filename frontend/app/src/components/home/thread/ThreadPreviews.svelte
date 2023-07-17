<script lang="ts">
    import { _ } from "svelte-i18n";
    import Loading from "../../Loading.svelte";
    import ThreadPreviewComponent from "./ThreadPreview.svelte";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import type { OpenChat, ThreadPreview } from "openchat-client";

    const client = getContext<OpenChat>("client");

    $: selectedChatId = client.selectedChatId;
    $: threadsByChat = client.threadsByChatStore;
    $: serverChatSummariesStore = client.serverChatSummariesStore;

    let threads: ThreadPreview[] = [];
    let observer: IntersectionObserver = new IntersectionObserver(() => {});
    let loading = false;
    let initialised = false;

    $: {
        loading = true;
        client
            .threadPreviews($selectedChatId, $threadsByChat, $serverChatSummariesStore)
            .then((t) => {
                threads = t;
                initialised = true;
            })
            .catch((err) => {
                toastStore.showFailureToast("thread.previewFailure");
                client.logError("Unable to load thread previews: ", err);
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
            padding: 0 toRem(10);
        }
    }
</style>
