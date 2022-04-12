<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import Microphone from "svelte-material-icons/Microphone.svelte";
    import RadioboxMarked from "svelte-material-icons/RadioboxMarked.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    import { MAX_AUDIO_SIZE } from "../../utils/media";
    import { toastStore } from "../../stores/toast";
    import { dataToBlobUrl } from "../../utils/blob";
    import type { AudioContent } from "../../domain/chat/chat";
    import { iconSize } from "../../stores/iconSize";

    type EventMap = {
        audioCaptured: AudioContent;
    };
    const dispatch = createEventDispatcher<EventMap>();

    export let recording: boolean = false;
    export let percentRecorded: number = 0;
    export let mimeType: string;
    export let supported: boolean;

    let mediaRecorder: MediaRecorder | undefined;

    onMount(() => {
        if (supported) {
            // TODO - there are problems with this whole thing on safari.
            // in particular, there is no access to the permissions api
            if ("permissions" in navigator) {
                navigator.permissions
                    //@ts-ignore
                    .query({ name: "microphone" })
                    .then(function (result) {
                        if (result.state === "denied") {
                            // if they already said no, don't be rude
                            supported = false;
                        }
                    })
                    .catch((_err) => {
                        console.log(
                            "unable to check microphone permissions (probably unsupported)"
                        );
                    });
            }
        }
    });

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    }

    function toggle() {
        if (recording) {
            stopRecording();
        } else {
            record();
        }
    }

    function record() {
        if (supported) {
            navigator.mediaDevices
                .getUserMedia({ audio: true, video: false })
                .then((stream) => {
                    recording = true;
                    const recordedChunks: Blob[] = [];
                    let totalSize = 0;
                    let truncated = false;
                    percentRecorded = 0;
                    mediaRecorder = new MediaRecorder(stream, { mimeType });

                    mediaRecorder.addEventListener("dataavailable", (e) => {
                        if (e.data.size > 0) recordedChunks.push(e.data);
                        totalSize += e.data.size;
                        percentRecorded = (totalSize / MAX_AUDIO_SIZE) * 100;
                        if (totalSize >= MAX_AUDIO_SIZE) {
                            truncated = true;
                            stopRecording();
                        }
                    });

                    mediaRecorder.addEventListener("stop", async () => {
                        const data = await new Blob(recordedChunks).arrayBuffer();
                        mediaRecorder = undefined;
                        recording = false;
                        if (truncated) {
                            // let the user know if we stopped recording prematurely
                            toastStore.showFailureToast("maxAudioSize");
                        }
                        dispatch("audioCaptured", {
                            kind: "audio_content",
                            mimeType: mimeType,
                            blobData: new Uint8Array(data),
                            blobUrl: dataToBlobUrl(data, mimeType),
                        });
                        stream.getTracks().forEach((track) => track.stop());
                    });

                    mediaRecorder.start(200);
                })
                .catch(() => (supported = false)); //catch the case where the user denies access
        }
    }
</script>

{#if supported}
    <div on:click={toggle}>
        <HoverIcon>
            {#if recording}
                <RadioboxMarked size={$iconSize} color={"red"} />
            {:else}
                <Microphone size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </HoverIcon>
    </div>
{/if}
