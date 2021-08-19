<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import Microphone from "svelte-material-icons/Microphone.svelte";
    import RadioboxMarked from "svelte-material-icons/RadioboxMarked.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    import { MAX_AUDIO_SIZE } from "../../utils/media";
    import { toastStore } from "../../stores/toast";

    const dispatch = createEventDispatcher();

    export let recording: boolean = false;
    export let percentRecorded: number = 0;

    let mediaRecorder: MediaRecorder | undefined;
    let supported = "mediaDevices" in navigator;

    onMount(() => {
        if (supported) {
            navigator.permissions.query({ name: "microphone" }).then(function (result) {
                if (result.state === "denied") {
                    // if they already said no, don't be rude
                    supported = false;
                }
            });
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
                    const mimeType = "audio/webm";
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
                            kind: "media_content",
                            mimeType: mimeType,
                            width: 0,
                            height: 0,
                            blobData: Promise.resolve(new Uint8Array(data)),
                            thumbnailData: "",
                        });
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
                <RadioboxMarked size={"1.2em"} color={"red"} />
            {:else}
                <Microphone size={"1.2em"} color={"#aaa"} />
            {/if}
        </HoverIcon>
    </div>
{/if}
