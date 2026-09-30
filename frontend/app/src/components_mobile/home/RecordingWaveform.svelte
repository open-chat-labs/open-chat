<script lang="ts">
    import { ChatFootnote, ColourVars, Row } from "component-lib";
    import { onMount } from "svelte";
    import MicrophoneOutline from "svelte-material-icons/MicrophoneOutline.svelte";
    import { loadRecordPlugin, loadWaveSurfer } from "../../utils/wavesurfer";

    interface Props {
        stream: MediaStream;
    }

    let { stream }: Props = $props();

    let waveformDiv: HTMLDivElement | undefined;
    let elapsed = $state(0);

    function formatTime(seconds: number) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.round(seconds) % 60;
        return `${minutes}:${String(secs).padStart(2, "0")}`;
    }

    function getColor(varName: string): string {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }

    onMount(() => {
        let unmounted = false;
        let destroyWaveform: (() => void) | undefined;

        Promise.all([loadWaveSurfer(), loadRecordPlugin()]).then(([WaveSurfer, RecordPlugin]) => {
            if (unmounted || !waveformDiv) return;

            const ws = WaveSurfer.create({
                container: waveformDiv,
                height: 42,
                barWidth: 3,
                barRadius: 6,
                barGap: 4,
                waveColor: getColor("--text-primary"),
                progressColor: getColor("--secondary"),
                interact: false,
            });

            const record = ws.registerPlugin(
                RecordPlugin.create({
                    scrollingWaveform: true,
                    scrollingWaveformWindow: 5,
                    renderRecordedAudio: false,
                }),
            );

            const micStream = record.renderMicStream(stream);

            destroyWaveform = () => {
                micStream.onDestroy();
                ws.destroy();
            };
        });

        // the recording is under way whether or not its waveform has been drawn yet
        const start = Date.now();
        const timer = setInterval(() => {
            elapsed = (Date.now() - start) / 1000;
        }, 200);

        return () => {
            unmounted = true;
            clearInterval(timer);
            destroyWaveform?.();
        };
    });
</script>

<Row
    backgroundColor={ColourVars.chatInputBackground}
    borderRadius="huge"
    maxHeight="3.5rem"
    padding="sm"
    gap="sm"
    crossAxisAlignment="center"
    width="fill">
    <MicrophoneOutline color={ColourVars.secondary} size="1.5rem" />
    <div bind:this={waveformDiv} class="recording_waveform"></div>
    <ChatFootnote colour="secondary" width="hug">{formatTime(elapsed)}</ChatFootnote>
</Row>

<style lang="scss">
    .recording_waveform {
        flex: 1;

        :global(::part(scroll)),
        :global(::part(wrapper)) {
            overflow: visible;
        }

        :global(::part(cursor)) {
            display: none;
        }
    }
</style>
