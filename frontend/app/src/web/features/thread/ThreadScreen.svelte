<!-- The right column's open thread (region "thread", 4c: `/:mi?open=true`, `/:mi/:tmi`): the
     library's ThreadPanel, its root's card on top, with the replies listed and written through the
     conversation's own MessageArea (the same list, menus and composer), sent to the thread. The
     root event comes from the chat's events (rightPanelView); when it's gone from them (the event
     window replaced) the column shows nothing until it's back. Closing it (back to the details
     when docked, × as a modal, Esc) takes it off the URL. -->
<script lang="ts">
    import {
        allUsersStore,
        i18nKey,
        selectedChatSummaryStore,
        selectedChatWebhooksStore,
        selectedCommunityUserGroupsStore,
        threadsFollowedByMeStore,
        type OpenChat,
    } from "@client";
    import ThreadPanel from "@openchat/ui/src/features/components/ThreadPanel.svelte";
    import { dialogOpen } from "@openchat/ui/src/lib/behaviours/modal";
    import { followsThread } from "@src/logic/conversation/threadTimeline";
    import { typedMentions } from "@src/logic/conversation/typedMentions";
    import { signInFirstOrCancel } from "@src/logic/auth/guestPass";
    import { toastStore } from "@src/stores/toast";
    import { findUser } from "@src/utils/user";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { closeRightColumn, closeThread } from "../app/rightPanel";
    import type { RightRegion, ScreenProps } from "../app/screens";
    import { currentShellLayout } from "../../shell/viewport.svelte";
    import MessageArea from "../conversation/MessageArea.svelte";
    import { threadSummaryProps } from "./thread.adapter";

    let { region, context: screen }: ScreenProps<Extract<RightRegion, { kind: "thread" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const chat = $derived($selectedChatSummaryStore);
    const root = $derived(region.rootEvent);
    const rootIndex = $derived(root.event.messageIndex);
    // below the docking width the column is a modal: the panel closes with ×, not a back arrow
    const modal = $derived(currentShellLayout().right === "modal");

    const title = $derived(
        chat === undefined
            ? ""
            : chat.kind === "direct_chat"
              ? client.displayName($allUsersStore.get(chat.them.userId))
              : chat.name,
    );

    const summary = $derived(
        threadSummaryProps(root, {
            userName: (userId) =>
                client.displayName(findUser(userId, $allUsersStore, $selectedChatWebhooksStore)),
            contentText: (content) => client.getContentAsText($_, content),
            // the open chat's groups, as the conversation's own rows (conversationContext)
            mentionsAsTyped: typedMentions({
                users: $allUsersStore,
                userGroups: $selectedCommunityUserGroupsStore,
            }),
            date: (timestamp) =>
                client.formatMessageDate(timestamp, $_("today"), $_("yesterday"), true, true),
        }),
    );

    const following = $derived(
        chat !== undefined && followsThread(root.event, $threadsFollowedByMeStore.get(chat.id)),
    );

    // the panel's Follow shows a spinner until this settles, and stays as it was when it rejects;
    // a guest is asked to sign in instead (logic/auth/guestPass)
    async function follow(on: boolean) {
        signInFirstOrCancel(client);
        if (chat === undefined) return;
        if (!(await client.followThread(chat.id, root.event, on))) {
            toastStore.showFailureToast(i18nKey(on ? "followThreadFailed" : "unfollowThreadFailed"));
            throw new Error("not followed");
        }
    }

    // docked, the column goes back to the chat's details, or closes again if the thread opened it
    // (columnChange); as a modal, it closes
    function close() {
        closeThread();
        if (modal) closeRightColumn(screen.rightColumn);
    }

    // the conversation goes to the root; as a modal the column covers it, so the thread closes
    // for the jump to be seen
    function jump() {
        if (chat === undefined) return;
        screen.jumps.ask(chat.id, rootIndex);
        if (modal) close();
    }

    // Esc closes the docked thread, unless something over the page takes it: a menu or a picker
    // (which handle it first) or a dialog (the modal column is one: the shell closes it)
    function keydown(e: KeyboardEvent) {
        if (e.key !== "Escape" || e.defaultPrevented || modal || dialogOpen()) return;
        close();
    }
</script>

<svelte:window onkeydown={keydown} />

{#if chat !== undefined}
    <div class="thread">
        <MessageArea {chat} thread={root} {screen}>
            {#snippet frame(list, composer)}
                <ThreadPanel
                    chatName={title}
                    threadKey={`${rootIndex}`}
                    root={summary.root}
                    faces={summary.faces}
                    replyCount={summary.replyCount}
                    {following}
                    onFollowChange={follow}
                    onJump={jump}
                    asModal={modal}
                    onClose={close}
                    {list}
                    {composer}
                />
            {/snippet}
        </MessageArea>
    </div>
{/if}

<style lang="scss">
    .thread {
        height: 100%;
        // the replies sit closer to the panel's edges than the conversation's
        --message-list-gutter: var(--space-14);
    }
</style>
