<!-- The call while it's minimised or another chat is open (web 7c): MiniCall over the middle panel,
     clear of the chat's header and composer, measured as they change (as the toasts are,
     shell/bottomAnchors). It stays up while chats change and keeps the spot it was dropped in for
     the app's lifetime (local state, never the URL). Back to call opens the call's chat and shows
     the call there (logic/video/miniCall). -->
<script lang="ts">
    import { allUsersStore, communitiesStore, selectedChatIdStore, type OpenChat } from "@client";
    import MiniCall from "@openchat/ui/src/features/components/MiniCall.svelte";
    import { callPeople, callSend } from "@src/logic/video/callPeople";
    import type { CallSession } from "@src/logic/video/callSession.svelte";
    import { backToCall, miniCallShows } from "@src/logic/video/miniCall";
    import { activeVideoCall, camera, microphone } from "@src/stores/video";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import { bottomAnchor, boxOf, watchBoxes, windowSize } from "../../shell/bottomAnchors.svelte";
    import {
        answerSpeakRequest,
        callFace,
        callHeading,
        miniCallArea,
        speakRequestCards,
        type MiniCallArea,
    } from "./webCall";

    let { session }: { session: CallSession } = $props();

    const client = getContext<OpenChat>("client");

    const call = $derived(
        miniCallShows($activeVideoCall, $selectedChatIdStore) ? $activeVideoCall : undefined,
    );
    const heading = $derived(
        call === undefined
            ? undefined
            : callHeading(client, call.chatId, $allUsersStore, $communitiesStore),
    );

    const face = $derived(callFace(client, $allUsersStore));
    const view = $derived(
        callPeople(
            session.media.participants,
            session.media.activeSpeaker,
            face,
            session.media.streamOf,
        ),
    );
    const voice = $derived(call?.callType === "audio");
    const send = $derived(
        callSend($activeVideoCall, session.media.participants.local, session.askedToSpeak),
    );
    const requests = $derived(call?.accessRequests ?? []);
    const requestCards = $derived(speakRequestCards(requests, $allUsersStore, face));

    // where it was dropped, for as long as the app runs
    let position = $state<"tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br">("br");

    // the middle panel, and the chat's header and composer in it while there's a chat
    let area = $state<MiniCallArea>();
    const shown = $derived(call !== undefined);
    $effect(() => {
        if (!shown) return;
        const middle = bottomAnchor("middle");
        const composer = bottomAnchor("composer");
        return watchBoxes([middle, composer], undefined, () => {
            const header = middle?.querySelector<HTMLElement>("[data-oc-header]") ?? undefined;
            area = miniCallArea(windowSize(), boxOf(middle), boxOf(header), boxOf(composer));
        });
    });

    function open() {
        if (call === undefined) return;
        const route = backToCall(call, $selectedChatIdStore, activeVideoCall.setView);
        if (route !== undefined) navigate(route);
    }
</script>

{#if call !== undefined && heading !== undefined && area !== undefined}
    <div
        class="mini"
        style:left="{area.left}px"
        style:top="{area.top}px"
        style:width="{area.width}px"
        style:height="{area.height}px">
        <MiniCall
            title={heading.title}
            start={heading.started}
            media={voice ? "voice" : "video"}
            people={view.people}
            selfStream={view.self?.stream ?? null}
            muted={!$microphone}
            camera={$camera}
            joining={call.status === "joining"}
            speak={send === "send" ? undefined : send}
            requests={requestCards}
            {position}
            safeTop={area.safeTop}
            safeBottom={area.safeBottom}
            onSnap={(spot) => (position = spot)}
            onOpen={open}
            onToggleMute={() => activeVideoCall.toggleMicrophone()}
            onToggleCamera={voice ? undefined : (on) => activeVideoCall.setCamera(on)}
            onAskToSpeak={() => session.askToSpeak()}
            onApprove={(id) => answerSpeakRequest(requests, id, true)}
            onReject={(id) => answerSpeakRequest(requests, id, false)}
            onLeave={() => session.hangup()} />
    </div>
{/if}

<style lang="scss">
    .mini {
        position: fixed;
        // over the chat, under the dialogs and their backdrop
        z-index: calc(var(--z-backdrop) - 2);
        pointer-events: none;
    }
</style>
