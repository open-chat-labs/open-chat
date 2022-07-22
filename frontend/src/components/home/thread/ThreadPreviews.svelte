<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Loading from "../../Loading.svelte";
    import { rtlStore } from "../../../stores/rtl";
    import { iconSize } from "../../../stores/iconSize";
    import { userStore } from "../../../stores/user";
    import { threadsByChatStore } from "../../../stores/chat";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import ThreadPreviewComponent from "./ThreadPreview.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import { push } from "svelte-spa-router";
    import { getContext } from "svelte";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import type { ThreadPreview, EventWrapper, Message } from "../../../domain/chat/chat";
    import { userIdsFromEvents } from "domain/chat/chat.utils";
    import { missingUserIds } from "domain/user/user.utils";

    const api = getContext<ServiceContainer>(apiKey);

    let threads: ThreadPreview[] = [];
    let observer: IntersectionObserver = new IntersectionObserver(() => {});
    let loading = false;
    let initialised = false;

    function eventsFromThreadPreviews(threads: ThreadPreview[]): EventWrapper<Message>[] {
        return threads.flatMap((t) => [t.rootMessage, ...t.latestReplies]);
    }

    function updateUserStore(userIdsFromEvents: Set<string>) {
        api.getUsers(
            {
                userGroups: [
                    {
                        users: missingUserIds($userStore, new Set<string>(userIdsFromEvents)),
                        updatedSince: BigInt(0),
                    },
                ],
            },
            true
        ).then((resp) => {
            userStore.addMany(resp.users);
        });
    }

    $: {
        // TODO - this might run a bit more frequently than we need it to. Not 100% sure yet.
        // we definitely cannot get away with *just* doing it onMount though.
        loading = true;
        api.threadPreviews($threadsByChatStore)
            .then((t) => {
                threads = t;
                updateUserStore(userIdsFromEvents(eventsFromThreadPreviews(t)));
            })
            .finally(() => {
                loading = false;
                initialised = true;
            });
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
            @include font(book, normal, fs-120);
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
