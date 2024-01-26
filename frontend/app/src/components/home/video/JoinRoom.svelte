<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Button from "../../Button.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Participant from "./Participant.svelte";
    import type { ParticipantInfo, TrackItem } from "./types";

    const client = getContext<OpenChat>("client");
    let activeSpeakerVideo: HTMLVideoElement;
    let localVideo: HTMLVideoElement;
    let localVideoStream: MediaStream | undefined;

    let meeting: any;
    let joined = false;

    let others: Record<string, ParticipantInfo> = {};
    let othersVideoStreams: Record<string, MediaStream> = {};
    let othersAudioStreams: Record<string, MediaStream> = {};

    $: user = client.user;

    $: console.log("VID: Others: ", others, othersVideoStreams, othersAudioStreams);

    //@ts-ignore
    onMount(() => (meeting = new Metered.Meeting()));

    async function leave() {
        if (joined) {
            await meeting?.leaveMeeting();
            joined = false;
        }
    }

    function captureParticipants(participants: ParticipantInfo[]) {
        console.debug("VID: online participanst ", participants);
        others = participants.reduce(
            (all, p) => {
                if (p._id !== meeting.participantSessionId) {
                    all[p._id] = p;
                }
                return all;
            },
            {} as Record<string, ParticipantInfo>,
        );
        console.debug("VID: enumerating all participants");
    }

    // The problem here is that the access key has to be secret so this would all need to be done in the backend. Also I'm not sure that we have a good way to inject secrets into
    // backend canisters?
    async function join() {
        const meetingInfo = await meeting.join({
            roomURL: "openchat.metered.live/openchatdevs",
            name: $user.username,
            accessToken:
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Imdsb2JhbFRva2VuIjp0cnVlLCJhcHBOYW1lIjoib3BlbmNoYXQiLCJtZXRlcmVkUGFydGljaXBhbnRJZCI6IjMwOGU2MTI0LTg4MDUtNDNlMy1iZmFiLTFhOGRjNmE3OGZjMCJ9LCJpYXQiOjE3MDYxNzg4MzJ9.BVz0W-uYSELcSKspGzhH5_NhIEau-DKwvslM5jSxYPs",
        });

        captureParticipants(meetingInfo.onlineParticipants);

        console.debug("VID: Joined meeting: ", meetingInfo);

        if (localVideoStream !== undefined) {
            const tracks = localVideoStream.getTracks();
            tracks.forEach((t) => t.stop());
            localVideoStream = undefined;
        }

        joined = true;

        // Deal with local video
        meeting.on("localTrackStarted", function ({ track, type }: TrackItem) {
            if (type === "video" && localVideo) {
                const mediaStream = new MediaStream([track]);
                localVideo.srcObject = mediaStream;
                localVideo.play();
                console.debug("VID: Local video started");
            }
        });

        meeting.on("localTrackUpdated", function ({ track, type }: TrackItem) {
            if (type === "video" && localVideo) {
                let mediaStream = new MediaStream([track]);
                localVideo.srcObject = mediaStream;
                console.debug("VID: Local video updated");
            }
        });

        meeting.on("localTrackStopped", function ({ type }: TrackItem) {
            if (type === "video" && localVideo) {
                localVideo.srcObject = null;
                console.debug("VID: Local video stopped");
            }
        });

        // Deal with other participants
        meeting.on("participantJoined", function (participant: ParticipantInfo) {
            console.debug("VID: participant joined ", participant);

            // ignore if it's me
            if (participant._id === meeting.participantSessionId) return;

            if (others[participant._id] === undefined) {
                others[participant._id] = participant;
                others = others;
                console.debug("VID: participant joined ", participant.name);
            }
        });

        meeting.on("participantLeft", function (participant: ParticipantInfo) {
            delete others[participant._id];
            others = others;
            console.debug("VID: participant left ", participant.name);
        });

        meeting.on("onlineParticipants", captureParticipants);

        meeting.on("remoteTrackStarted", function (item: TrackItem) {
            // ignore if it's me
            if (item.participantSessionId === meeting.participantSessionId) return;

            const stream = new MediaStream([item.track]);
            if (item.type === "video") {
                othersVideoStreams[item.participantSessionId] = stream;
                othersVideoStreams = othersVideoStreams;
                console.debug("VID: captured remote video", item.participantSessionId);
            }
            if (item.type === "audio") {
                othersAudioStreams[item.participantSessionId] = stream;
                othersAudioStreams = othersAudioStreams;
                console.debug("VID: captured remote audio", item.participantSessionId);
            }
        });

        meeting.on("remoteTrackStopped", function (item: TrackItem) {
            console.debug("VID: remoteTrackStopped ", item);
            // ignore if it's me
            if (item.participantSessionId === meeting.participantSessionId) return;

            if (item.type === "video") {
                delete othersVideoStreams[item.participantSessionId];
                othersVideoStreams = othersVideoStreams;
                console.debug("VID: removed remote video", item.participantSessionId);
            }
            if (item.type === "audio") {
                delete othersAudioStreams[item.participantSessionId];
                othersAudioStreams = othersAudioStreams;
                console.debug("VID: removed remote audio", item.participantSessionId);
            }
        });

        try {
            await meeting.startAudio();
            console.debug("VID: started audio");
        } catch (err) {
            console.error("VID: Error occurred starting audio", err);
        }

        try {
            await meeting.startVideo();
            console.debug("VID: started video");
        } catch (err) {
            console.error("VID: Error occurred starting video", err);
        }
    }
</script>

<SectionHeader shadow flush>
    <div class="header">
        <div class="title">Join the video chat</div>
        {#if joined}
            <Button on:click={leave}>Leave</Button>
        {:else}
            <Button on:click={join}>Join</Button>
        {/if}
    </div>
</SectionHeader>

<div class="call">
    <div class="others">
        {#each Object.values(others) as participant}
            <Participant
                audioStream={othersAudioStreams[participant._id]}
                videoStream={othersVideoStreams[participant._id]}
                {participant} />
        {/each}
    </div>

    <div class="active">
        <video muted autoplay playsinline bind:this={activeSpeakerVideo} />
    </div>

    <div class="local">
        <video muted autoplay playsinline bind:this={localVideo} />
    </div>
</div>

<style lang="scss">
    .active {
        video {
            width: 100%;
            height: auto;
        }
    }
    .local {
        video {
            width: 150px;
            height: auto;
        }
    }

    .call {
        padding: $sp4;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    }
</style>
