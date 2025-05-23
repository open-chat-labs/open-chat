<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { debouncedDerived, threadsByChatStore, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Loading from "../../Loading.svelte";
    import { default as ThreadPreviewComponent } from "./ThreadPreview.svelte";

    const client = getContext<OpenChat>("client");

    let observer: IntersectionObserver = new IntersectionObserver(() => {});
    let loading = $state(false);
    let initialised = $state(false);

    let threads = $derived.by(
        debouncedDerived(() => [$threadsByChatStore], loadThreadPreviews, 300, []),
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

<div class="threads">
    {#if loading && !initialised}
        <Loading />
    {:else}
        {#each threads as thread (`${thread.rootMessage.index}_${thread.rootMessage.event.messageId}`)}
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
