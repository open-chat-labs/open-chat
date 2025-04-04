<script lang="ts">
    import Progress from "../Progress.svelte";
    import DisappearsAt from "./DisappearsAt.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { now500 } from "../../stores/time";
    import { throttleDeadline } from "openchat-client";
    import { untrack } from "svelte";

    interface Props {
        deadline: number;
    }

    let { deadline }: Props = $props();

    let seconds = $state(0);
    let percent = $state(0);

    $effect(() => {
        calculate(deadline, $now500);
    });

    function calculate(deadline: number, now: number) {
        untrack(() => {
            seconds = Math.floor((deadline - now) / 1000);
            percent = Math.floor((seconds / 60) * 100);
            if (deadline <= $now500) {
                throttleDeadline.set(0);
            }
        });
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
