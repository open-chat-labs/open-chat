<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import Microphone from "svelte-material-icons/Microphone.svelte";
    import RadioboxMarked from "svelte-material-icons/RadioboxMarked.svelte";
    import { createEventDispatcher } from "svelte";
    import { MAX_AUDIO_SIZE } from "../../utils/media";
    import { dataToBlobUrl } from "../../utils/blob";
    import { toastStore } from "../../stores/toast";

    const dispatch = createEventDispatcher();

    let recording: boolean = false;
    let mediaRecorder: MediaRecorder | undefined;
    let supported = "mediaDevices" in navigator;

    function stopRecording() {
        if (mediaRecorder) {
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
            navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
                recording = true;
                const mimeType = "audio/webm";
                const options = { mimeType };
                const recordedChunks: Blob[] = [];
                mediaRecorder = new MediaRecorder(stream, options);

                mediaRecorder.addEventListener("dataavailable", function (e) {
                    if (e.data.size > 0) recordedChunks.push(e.data);
                });

                mediaRecorder.addEventListener("stop", async () => {
                    const data = await new Blob(recordedChunks).arrayBuffer();
                    mediaRecorder = undefined;
                    recording = false;

                    if (data.byteLength > MAX_AUDIO_SIZE) {
                        toastStore.showFailureToast("maxAudioSize");
                    } else {
                        dispatch("audioCaptured", {
                            kind: "media_content",
                            mimeType: mimeType,
                            width: 0,
                            height: 0,
                            blobData: Promise.resolve(new Uint8Array(data)),
                            thumbnailData: "",
                        });
                    }
                });

                mediaRecorder.start();
            });
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
