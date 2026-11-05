<script lang="ts">
    import { audioContent, iconSize, type AudioContent, type OpenChat } from "@client";
    import { microphoneDenied } from "@src/utils/media";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Microphone from "svelte-material-icons/Microphone.svelte";
    import RadioboxMarked from "svelte-material-icons/RadioboxMarked.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import HoverIcon from "../HoverIcon.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        recording?: boolean;
        percentRecorded?: number;
        mimeType: string;
        supported: boolean;
        onAudioCaptured: (content: AudioContent) => void;
    }

    let {
        recording = $bindable(false),
        percentRecorded = $bindable(0),
        mimeType,
        supported = $bindable(),
        onAudioCaptured,
    }: Props = $props();

    let mediaRecorder: MediaRecorder | undefined;

    onMount(async () => {
        // if they already said no, don't be rude
        if (supported && (await microphoneDenied())) {
            supported = false;
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
                    const maxSizes = client.maxMediaSizes();
                    let totalSize = 0;
                    let truncated = false;
                    percentRecorded = 0;
                    mediaRecorder = new MediaRecorder(stream, { mimeType });

                    mediaRecorder.addEventListener("dataavailable", (e) => {
                        if (e.data.size > 0) recordedChunks.push(e.data);
                        totalSize += e.data.size;
                        percentRecorded = (totalSize / maxSizes.audio) * 100;
                        if (totalSize >= maxSizes.audio) {
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
                            toastStore.showFailureToast(i18nKey("maxAudioSize"));
                        }
                        onAudioCaptured(await audioContent(data, mimeType));
                        stream.getTracks().forEach((track) => track.stop());
                    });

                    mediaRecorder.start(200);
                })
                .catch(() => (supported = false)); //catch the case where the user denies access
        }
    }
</script>

{#if supported}
    <div onclick={toggle}>
        <HoverIcon title={recording ? $_("stopRecording") : $_("recordAudioMessage")}>
            {#if recording}
                <RadioboxMarked size={$iconSize} color={"red"} />
            {:else}
                <Microphone size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </HoverIcon>
    </div>
{/if}
