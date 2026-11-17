<!-- The new UI's call, app-wide (the web App, web 7b): the app's call events (startVideoCall from a
     chat's call buttons, hangup, askToSpeak) on the one session, what a call that couldn't start
     says, and the confirm before leaving one call for another. The call view itself is the
     conversation's (CallView). -->
<script lang="ts">
    import { subscribe, type ChatIdentifier, type VideoCallType } from "@client";
    import type { CallSession } from "@src/logic/video/callSession.svelte";
    import { toastStartCall as report } from "@src/utils/callToast";
    import { _ } from "svelte-i18n";
    import ConfirmDialog from "../conversation/ConfirmDialog.svelte";

    let { session }: { session: CallSession } = $props();

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
</script>

{#if session.confirmSwitchTo}
    <ConfirmDialog
        title={$_("videoCall.switchCall")}
        confirmLabel={$_("videoCall.join")}
        onConfirm={switchCall}
        onClose={() => session.cancelSwitch()} />
{/if}
