<script lang="ts">
    import { IconButton } from "component-lib";
    import { quantiseWaveform, type AudioContent, type OpenChat } from "@client";
    import { getContext, onDestroy, onMount } from "svelte";
    import Microphone from "svelte-material-icons/MicrophoneOutline.svelte";
    import RadioboxMarked from "svelte-material-icons/RadioboxMarked.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";

    const client = getContext<OpenChat>("client");

    interface Props {
        activeStream?: MediaStream;
        mimeType: string;
        supported: boolean;
        onAudioCaptured: (content: AudioContent) => void;
    }

    let {
        activeStream = $bindable(undefined),
        mimeType,
        supported = $bindable(),
        onAudioCaptured,
    }: Props = $props();

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
                            "unable to check microphone permissions (probably unsupported)",
                        );
                    });
            }
        }
    });

    onDestroy(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
        activeStream?.getTracks().forEach((track) => track.stop());
        activeStream = undefined;
        mediaRecorder = undefined;
    });

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    }

    function toggle() {
        if (activeStream !== undefined) {
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
                    activeStream = stream;
                    const recordedChunks: Blob[] = [];
                    const maxSizes = client.maxMediaSizes();
                    let totalSize = 0;
                    let truncated = false;
                    mediaRecorder = new MediaRecorder(stream, { mimeType });

                    mediaRecorder.addEventListener("dataavailable", (e) => {
                        if (e.data.size > 0) recordedChunks.push(e.data);
                        totalSize += e.data.size;
                        if (totalSize >= maxSizes.audio) {
                            truncated = true;
                            stopRecording();
                        }
                    });

                    mediaRecorder.addEventListener("stop", async () => {
                        try {
                            const data = await new Blob(recordedChunks).arrayBuffer();
                            if (truncated) {
                                // let the user know if we stopped recording prematurely
                                toastStore.showFailureToast(i18nKey("maxAudioSize"));
                            }
                            const quantised = await quantiseWaveform(data.slice(0));
                            onAudioCaptured({
                                kind: "audio_content",
                                mimeType: mimeType,
                                blobData: new Uint8Array(data),
                                blobUrl: client.dataToBlobUrl(data, mimeType),
                                ...quantised,
                            });
                        } finally {
                            mediaRecorder = undefined;
                            stream.getTracks().forEach((track) => track.stop());
                            activeStream = undefined;
                        }
                    });

                    mediaRecorder.start(200);
                })
                .catch(() => (supported = false)); //catch the case where the user denies access
        }
    }
</script>

{#if supported}
    <IconButton padding={"md"} size={"lg"} mode={"primary"} onclick={toggle}>
        {#snippet icon(color)}
            {#if activeStream !== undefined}
                <RadioboxMarked {color} />
            {:else}
                <Microphone {color} />
            {/if}
        {/snippet}
    </IconButton>
{/if}
