<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Loading from "../../Loading.svelte";
    import { rtlStore } from "../../../stores/rtl";
    import { iconSize } from "../../../stores/iconSize";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import ThreadPreviewComponent from "./ThreadPreview.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import { push } from "svelte-spa-router";
    import { getContext } from "svelte";
    import type { ThreadPreview, EventWrapper, Message, ThreadSyncDetails } from "openchat-client";
    import { toastStore } from "../../../stores/toast";
    import { logger } from "../../../utils/logging";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    $: serverChatSummariesStore = client.serverChatSummariesStore;
    $: threadsByChatStore = client.threadsByChatStore;
    $: userStore = client.userStore;

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

<div class="wrapper">
    <SectionHeader shadow flush gap>
        {#if $mobileWidth}
            <div class="back" class:rtl={$rtlStore} on:click={() => push("/")}>
                <HoverIcon>
                    {#if $rtlStore}
                        <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                    {:else}
                        <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                    {/if}
                </HoverIcon>
            </div>
        {/if}

        <div class="icon">🧵</div>
        <div class="details" class:rtl={$rtlStore}>
            <h4 class="title">
                {$_("thread.previewTitle")}
            </h4>
        </div>
    </SectionHeader>

    <div class="threads">
        {#if loading && !initialised}
            <Loading />
        {:else}
            {#each threads as thread, _i (thread.rootMessage.event.messageId)}
                <ThreadPreviewComponent {observer} {thread} />
            {/each}
        {/if}
    </div>
</div>

<style type="text/scss">
    .icon {
        @include font-size(fs-180);
        // text-align: center;
    }

    .details {
        flex: 1;

        .title {
            @include ellipsis();
            margin-bottom: $sp1;
        }
    }

    .threads {
        padding: $sp3 0 $sp3 0;
        flex: auto;
        overflow-x: hidden;
        @include nice-scrollbar();
        @include mobile() {
            padding: 0;
        }
    }

    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        position: relative;
    }
</style>
