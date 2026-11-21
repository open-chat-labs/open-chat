<!-- The native tree's call (N14), for the shell's lifetime: the app's call events (startVideoCall
     from a chat's call buttons and the shell's answer, hangup, askToSpeak) on the one session, a
     call started elsewhere ringing here (IncomingCall), what a call that couldn't start says, what
     ended or refused the user (toasts), and the confirm before leaving one call for another. Then the
     call screen while the call isn't minimised (CallScreen; in the Android app and phones'
     browsers, as on iOS the native screen draws the call), and the minimised call (CallMini). Back
     on Android minimises the call screen first, as it closes a sheet; while it's up the system
     bars' icons are light. -->
<script lang="ts">
    import {
        allUsersStore,
        communitiesStore,
        formatClock,
        isAndroidTauriApp,
        isIosTauriApp,
        subscribe,
        type ChatIdentifier,
        type OpenChat,
        type VideoCallType,
    } from "@client";
    import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import { callHeading } from "@src/logic/video/callChat";
    import { callFace, callPeople } from "@src/logic/video/callPeople";
    import {
        activeVideoCall,
        callPip,
        microphone,
        ringForRemoteCall,
        stopRingingForRemoteCall,
    } from "@src/stores/video";
    import { now500 } from "@src/stores/time";
    import { toastCallEndings, toastStartCall as report } from "@src/utils/callToast";
    import { setCallPip } from "@utils/native/call_bridge";
    import { setDarkScreenUp } from "@utils/native/systemBarsStyle";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { useOverlay, type Overlays } from "../../shell/overlays.svelte";
    import {
        callScreenShows,
        miniCallRequests,
        miniCallShows,
        mirrorsSelf,
        pipArmed,
    } from "./call.adapter";
    import CallMini from "./CallMini.svelte";
    import CallPip from "./CallPip.svelte";
    import CallScreen from "./CallScreen.svelte";
    import IncomingCall from "./IncomingCall.svelte";
    import { createNativeTreeCall } from "./treeCall";

    let {
        overlays,
        barShown,
        offlineStrip = 0,
    }: {
        overlays: Overlays;
        barShown: boolean;
        /** The shell's offline strip's height while it's open, in CSS pixels (Shell). */
        offlineStrip?: number;
    } = $props();

    const client = getContext<OpenChat>("client");
    const session = createNativeTreeCall(client);

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
            // a call started elsewhere rings here (in a browser; the apps ring themselves)
            subscribe("remoteVideoCallStarted", (ev) => ringForRemoteCall(ev)),
            subscribe("remoteVideoCallEnded", stopRingingForRemoteCall),
        ];
        return () => unsubs.forEach((u) => u());
    });

    // the host ending a broadcast, or turning down a request to speak
    $effect(() => toastCallEndings(session));

    async function switchCall() {
        report(await session.switchCall(nowhere));
    }

    const call = $derived($activeVideoCall);
    // a chat the client can't find still has its call shown, untitled, so it can always be left
    const heading = $derived(
        call === undefined
            ? undefined
            : (callHeading(client, call.chatId, $allUsersStore, $communitiesStore) ?? {
                  title: "",
                  started: undefined,
              }),
    );
    const screen = $derived(callScreenShows(call, !isIosTauriApp()));
    const mini = $derived(miniCallShows(call));

    function minimise() {
        activeVideoCall.setView("minimised");
    }

    // picture in picture for a joined video call, in the Android app (the shell reports entry and
    // exit, and the call then shows full bleed)
    const pipOn = $derived(pipArmed(call, isAndroidTauriApp()));
    $effect(() => {
        void setCallPip(pipOn);
    });
    const inPip = $derived($callPip && call !== undefined);

    // Android's system back minimises the call before it pops a screen
    useOverlay(overlays, () => screen, minimise);

    $effect(() => {
        setDarkScreenUp(screen);
        return () => setDarkScreenUp(false);
    });

    // ---- the minimised call

    const people = $derived(
        callPeople(
            session.media.participants,
            session.media.activeSpeaker,
            callFace(client, $allUsersStore, AVATAR_GRADIENTS),
            session.media.streamOf,
        ),
    );
    const lead = $derived.by(() => {
        const first = people.people[0];
        if (first !== undefined) return { ...first, mirror: false };
        // alone: the user's own camera, mirrored as on the call screen
        if (people.self !== undefined) {
            return { ...people.self, mirror: mirrorsSelf(people.self.stream) };
        }
        const title = heading?.title ?? "";
        return { initial: title.slice(0, 1).toUpperCase(), grad: "", stream: null, mirror: false };
    });
    const time = $derived(
        heading?.started === undefined
            ? ""
            : formatClock(Math.max(0, $now500 - heading.started) / 1000),
    );

    // where it was dropped, for the app's lifetime
    let spot = $state<"tl" | "tr" | "ml" | "mr" | "bl" | "br">("tr");

    // clear of a screen's header above and the tab bar (or the safe area) below
    function px(css: string): number {
        const probe = document.createElement("div");
        probe.style.cssText = `position: fixed; visibility: hidden; height: ${css}`;
        document.body.append(probe);
        const height = probe.getBoundingClientRect().height;
        probe.remove();
        return height;
    }
    let safeTop = $state(0);
    let safeBottom = $state(0);
    $effect(() => {
        if (!mini) return;
        const bottom = barShown
            ? "calc(var(--tab-bar-h) + 16px)"
            : "calc(var(--safe-bottom) + 16px)";
        // below the offline strip too, while it's open: the headers move down under it
        const strip = offlineStrip;
        const measure = () => {
            safeTop = px("calc(var(--safe-top) + 64px)") + strip;
            safeBottom = px(bottom);
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    });
</script>

<IncomingCall {overlays} />

{#if session.confirmSwitchTo}
    <NativeAlert
        open
        title={$_("videoCall.switchCall")}
        confirmLabel={$_("videoCall.join")}
        onConfirm={switchCall}
        onClose={() => session.cancelSwitch()}
    />
{/if}

{#if inPip && heading !== undefined}
    <CallPip people={people.people} self={people.self} title={heading.title} />
{:else if screen && heading !== undefined}
    <CallScreen
        {session}
        title={heading.title}
        started={heading.started}
        canRoute={isAndroidTauriApp()}
        onMinimise={minimise}
    />
{/if}

{#if mini && !inPip && call !== undefined && heading !== undefined}
    <CallMini
        title={heading.title}
        {time}
        tile={call.callType !== "audio" && !isIosTauriApp()}
        {lead}
        muted={!$microphone}
        requests={miniCallRequests(call)}
        position={spot}
        {safeTop}
        {safeBottom}
        onSnap={(next) => (spot = next)}
        onOpen={() => activeVideoCall.setView("default")}
        onToggleMute={() => activeVideoCall.toggleMicrophone()}
        onLeave={() => session.hangup()}
    />
{/if}
