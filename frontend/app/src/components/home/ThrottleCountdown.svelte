<script lang="ts">
    import Progress from "../Progress.svelte";
    import DisappearsAt from "./DisappearsAt.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { now500 } from "../../stores/time";
    import { throttleDeadline } from "openchat-client";

    export let deadline: number;

    let seconds = 0;
    let percent = 0;

    $: {
        seconds = Math.floor((deadline - $now500) / 1000);
        percent = Math.floor((seconds / 60) * 100);
        if (deadline <= $now500) {
            throttleDeadline.set(0);
        }
    }
</script>

<div class="throttle">
    <Progress size={"20px"} {percent}>
        <div class="msg">
            <DisappearsAt me={true} percentageExpired={percent} expiresAt={deadline} />
            <Translatable resourceKey={i18nKey("throttleMessage", { time: seconds })} />
        </div>
    </Progress>
</div>

<style lang="scss">
    :global(.throttle .bar) {
        height: 40px;
    }

    .throttle {
        padding: 0;
        width: 100%;

        .msg {
            display: flex;
            gap: $sp3;
            align-items: center;
            justify-content: center;
            width: 100%;
        }
    }
</style>
