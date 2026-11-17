<!-- The new UI's call, app-wide (AppScreen, web 7b): the app's call events (startVideoCall from a
     chat's call buttons, hangup, askToSpeak) on the one session, what a call that couldn't start
     says, and the confirm before leaving one call for another. The call view itself is the
     conversation's (CallView). -->
<script lang="ts">
    import { subscribe, type ChatIdentifier, type VideoCallType } from "@client";
    import {
        startCallToast,
        type CallSession,
        type StartCallOutcome,
    } from "@src/logic/video/callSession.svelte";
    import { toastStore } from "@src/stores/toast";
    import { _ } from "svelte-i18n";
    import ConfirmDialog from "../conversation/ConfirmDialog.svelte";

    let { session }: { session: CallSession } = $props();

    // the call object draws nothing, so there's no element to hand the session
    const nowhere = document.body;

    function report(outcome: StartCallOutcome | undefined) {
        const toast = startCallToast(outcome);
        if (toast?.kind === "success") toastStore.showSuccessToast(toast.message);
        if (toast?.kind === "failure") toastStore.showFailureToast(toast.message);
    }

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
</script>

{#if session.confirmSwitchTo}
    <ConfirmDialog
        title={$_("videoCall.switchCall")}
        confirmLabel={$_("videoCall.join")}
        onConfirm={switchCall}
        onClose={() => session.cancelSwitch()} />
{/if}
