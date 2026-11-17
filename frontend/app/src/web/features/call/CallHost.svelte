<!-- The new UI's call, app-wide (the web App, web 7b): the app's call events (startVideoCall from a
     chat's call buttons, hangup, askToSpeak) on the one session, what a call that couldn't start
     says, and the confirm before leaving one call for another. The call view itself is the
     conversation's (CallView). -->
<script lang="ts">
    import {
        allUsersStore,
        communitiesStore,
        subscribe,
        type ChatIdentifier,
        type OpenChat,
        type VideoCallType,
    } from "@client";
    import { videoCallChat } from "@src/logic/video/callChat";
    import { activeVideoCall } from "@src/stores/video";
    import { getContext } from "svelte";
    import CallView from "./CallView.svelte";
    import type { CallSession } from "@src/logic/video/callSession.svelte";
    import { toastStartCall as report } from "@src/utils/callToast";
    import { _ } from "svelte-i18n";
    import ConfirmDialog from "../conversation/ConfirmDialog.svelte";

    let { session }: { session: CallSession } = $props();

    const client = getContext<OpenChat>("client");

    // the call object draws nothing, so there's no element to hand the session
    const nowhere = document.body;


    async function start(request: {
        chatId: ChatIdentifier;
        callType: VideoCallType;
        join: boolean;
        answer?: boolean;
    }) {
        report(await session.startOrJoin(nowhere, request));
    }

    $effect(() => {
        const unsubs = [
            subscribe("startVideoCall", (request) => void start(request)),
            subscribe("hangup", () => session.hangup()),
            subscribe("askToSpeak", () => session.askToSpeak()),
        ];
        return () => unsubs.forEach((u) => u());
    });

    async function switchCall() {
        report(await session.switchCall(nowhere));
    }

    // ── full screen: the call over the whole window, as the design's prototype has it, and the
    // browser's own full screen while it's there (leaving that, by Esc, brings the call back)

    const full = $derived($activeVideoCall?.view === "fullscreen");
    const fullChat = $derived.by(() => {
        if (!full || $activeVideoCall === undefined) return undefined;
        const chat = client.lookupChatSummary($activeVideoCall.chatId);
        return chat === undefined
            ? undefined
            : {
                  title: videoCallChat(client, chat, $allUsersStore, $communitiesStore).name,
                  started:
                      chat.videoCallInProgress === undefined
                          ? undefined
                          : Number(chat.videoCallInProgress.started),
              };
    });
    // bind:this sets null, not undefined, when the overlay goes
    let fullElement = $state<HTMLDivElement | null>(null);

    $effect(() => {
        const element = fullElement;
        if (element === null) return;
        element.requestFullscreen?.().catch(() => undefined);
        const left = () => {
            if (document.fullscreenElement === null && full) activeVideoCall.setView("default");
        };
        document.addEventListener("fullscreenchange", left);
        return () => {
            document.removeEventListener("fullscreenchange", left);
            if (document.fullscreenElement === element) void document.exitFullscreen();
        };
    });
</script>

{#if session.confirmSwitchTo}
    <ConfirmDialog
        title={$_("videoCall.switchCall")}
        confirmLabel={$_("videoCall.join")}
        onConfirm={switchCall}
        onClose={() => session.cancelSwitch()} />
{/if}

{#if fullChat !== undefined}
    <div class="full-call" bind:this={fullElement}>
        <CallView {session} title={fullChat.title} started={fullChat.started} />
    </div>
{/if}

<style lang="scss">
    .full-call {
        position: fixed;
        inset: 0;
        z-index: 85;
        display: flex;
    }
</style>
