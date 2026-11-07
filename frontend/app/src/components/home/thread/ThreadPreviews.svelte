<script lang="ts">
    import { ThreadPreviews } from "@src/logic/threads/threadPreviews.svelte";
    import { toastStore } from "@src/stores/toast";
    import { threadsByChatStore, type OpenChat } from "@client";
    import { getContext, untrack } from "svelte";
    import Loading from "@shared_components/Loading.svelte";
    import { default as ThreadPreviewComponent } from "./ThreadPreview.svelte";

    const client = getContext<OpenChat>("client");

    const observer: IntersectionObserver = new IntersectionObserver(() => {});

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
</script>

<div class="threads">
    {#if previews.previews.kind === "loading"}
        <Loading />
    {:else}
        {#each previews.previews.threads as thread (`${thread.rootMessage.index}_${thread.rootMessage.event.messageId}`)}
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
