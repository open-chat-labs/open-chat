<script lang="ts">
    import PlayCircleOutline from "svelte-material-icons/PlayCircleOutline.svelte";
    import PauseCircleOutline from "svelte-material-icons/PauseCircleOutline.svelte";
    import Radio from "../../Radio.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { createEventDispatcher } from "svelte";
    import { Ringtone, selectedRingtone } from "../../../stores/video";

    const dispatch = createEventDispatcher();

    export let ringtone: Ringtone;

    $: checked = $selectedRingtone === ringtone.key;

    function togglePlay() {
        dispatch("togglePlay", ringtone);
    }

    function selectRingtone() {
        selectedRingtone.set(ringtone.key);
    }
</script>

<Radio on:change={selectRingtone} {checked} id={ringtone.name} group="video-ringtone">
    <div class="ringtone">
        <div class="name">{ringtone.name}</div>
        <div on:click|preventDefault={togglePlay} class="play">
            {#if ringtone.playing}
                <PauseCircleOutline size={$iconSize} color={"var(--icon-selected)"} />
            {:else}
                <PlayCircleOutline size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </div>
    </div>
</Radio>

<style lang="scss">
    .ringtone {
        display: flex;
        gap: $sp4;
        align-items: center;
        justify-content: space-between;
    }

    .play {
        cursor: pointer;
    }
</style>
