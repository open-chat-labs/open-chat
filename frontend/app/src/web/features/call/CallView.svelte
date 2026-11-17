<!-- The call going on, as CallPanel over the session's media (logic/video/callMedia): in the middle
     column under the chat's header, or over the whole window in full screen (CallHost), as the
     design's §7. The user's own microphone, camera and screen share go through the active call
     (stores/video), and the chevrons on Mute and Camera pick the microphone, speaker and camera
     (TODO(design): the web design has no device choice; the native output menu's pattern).
     Minimise goes back to the chat's messages, the call still up; Leave hangs up. -->
<script lang="ts">
    import { allUsersStore, type OpenChat } from "@client";
    import CallPanel from "@openchat/ui/src/features/components/CallPanel.svelte";
    import { callPeople } from "@src/logic/video/callPeople";
    import type { CallSession } from "@src/logic/video/callSession.svelte";
    import { activeVideoCall, camera, microphone, sharing } from "@src/stores/video";
    import { getContext } from "svelte";
    import { callFace } from "./webCall";

    let {
        session,
        title,
        started,
    }: { session: CallSession; title: string; started: number | undefined } = $props();

    const client = getContext<OpenChat>("client");

    const view = $derived(
        callPeople(
            session.media.participants,
            session.media.activeSpeaker,
            callFace(client, $allUsersStore),
            session.media.streamOf,
        ),
    );
    const voice = $derived($activeVideoCall?.callType === "audio");
</script>

<CallPanel
    {title}
    people={view.people}
    self={view.self}
    media={voice ? "voice" : "video"}
    full={$activeVideoCall?.view === "fullscreen"}
    muted={!$microphone}
    camera={$camera}
    sharing={$sharing}
    screenStream={view.self?.screenStream ?? null}
    start={started}
    onToggleMute={() => activeVideoCall.toggleMicrophone()}
    onToggleCamera={voice
        ? undefined
        : (on) => {
              activeVideoCall.setCamera(on);
          }}
    onToggleShare={voice ? undefined : (on) => activeVideoCall.setSharing(on)}
    onToggleFull={(full) => activeVideoCall.setView(full ? "fullscreen" : "default")}
    onMinimise={() => activeVideoCall.setView("minimised")}
    onLeave={() => session.hangup()}
    devices={session.media.devices}
    onSelectDevice={(kind, id) => void session.media.selectDevice(kind, id)} />
