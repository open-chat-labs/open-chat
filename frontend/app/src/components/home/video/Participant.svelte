<script lang="ts">
    import { onDestroy } from "svelte";
    import type { ParticipantInfo } from "./types";

    export let participant: ParticipantInfo;
    export let audioStream: MediaStream | undefined;
    export let videoStream: MediaStream | undefined;

    let participantVideo: HTMLVideoElement;
    let participantAudio: HTMLAudioElement;

    $: {
        if (participantVideo) {
            if (videoStream !== undefined) {
                participantVideo.srcObject = videoStream;
                participantVideo.play();
                console.debug("VID: starting video for ", participant.name);
            } else {
                console.debug("VID: stopping video for ", participant.name);
                participantVideo.srcObject = null;
            }
        }

        if (participantAudio) {
            if (audioStream !== undefined) {
                participantAudio.srcObject = audioStream;
                participantAudio.play();
                console.debug("VID: starting audio for ", participant.name);
            } else {
                console.debug("VID: stopping audio for ", participant.name);
                participantAudio.srcObject = null;
            }
        }
    }

    onDestroy(() => {
        if (participantVideo) {
            participantVideo.srcObject = null;
        }

        if (participantAudio) {
            participantAudio.srcObject = null;
        }
    });
</script>

<video muted autoplay playsinline bind:this={participantVideo} />
<audio autoplay playsinline bind:this={participantAudio}></audio>
<div>{participant.name}</div>

<style lang="scss">
    video {
        max-width: 400px;
    }
</style>
