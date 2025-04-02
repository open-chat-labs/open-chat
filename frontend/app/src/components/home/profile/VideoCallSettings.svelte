<script lang="ts">
    import { i18nKey } from "../../../i18n/i18n";
    import { videoCameraOn, videoMicOn, videoSpeakerView } from "../../../stores/settings";
    import VideoCallRingtone from "./VideoCallRingtone.svelte";
    import Toggle from "../../Toggle.svelte";
    import Legend from "../../Legend.svelte";
    import { Ringtone } from "../../../stores/video";
    import { onDestroy } from "svelte";

    let ringtones: Ringtone[] = [
        new Ringtone("boring", "Boring"),
        new Ringtone("pleasant", "Pleasant"),
        new Ringtone("boomboom", "Boom boom"),
        new Ringtone("garage", "Two step flava"),
        new Ringtone("siren", "Siren"),
    ];

    function togglePlay(ev: CustomEvent<Ringtone>) {
        ringtones.forEach((r) => {
            if (r === ev.detail) {
                r.toggle();
            } else {
                r.stop();
            }
        });
        ringtones = ringtones;
    }

    onDestroy(() => {
        ringtones.forEach((r) => r.stop());
    });
</script>

<Toggle
    id={"video-camera"}
    small
    onChange={() => videoCameraOn.toggle()}
    label={i18nKey("profile.videoCameraOn")}
    checked={$videoCameraOn} />

<Toggle
    id={"video-mic"}
    small
    onChange={() => videoMicOn.toggle()}
    label={i18nKey("profile.videoMicOn")}
    checked={$videoMicOn} />

<Toggle
    id={"video-speaker-view"}
    small
    onChange={() => videoSpeakerView.toggle()}
    label={i18nKey("profile.videoSpeakerView")}
    checked={$videoSpeakerView} />

<Legend label={i18nKey("profile.ringtone")} />

{#each ringtones as ringtone}
    <VideoCallRingtone on:togglePlay={togglePlay} {ringtone} />
{/each}
