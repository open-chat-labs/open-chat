<script lang="ts">
    import Progress from "../Progress.svelte";
    import DisappearsAt from "./DisappearsAt.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { now500 } from "../../stores/time";
    import { throttleDeadline } from "@client";
    import { throttleCountdown } from "@src/logic/composer/composer";

    interface Props {
        deadline: number;
    }

    let { deadline }: Props = $props();

    let countdown = $derived(throttleCountdown(deadline, $now500));
    let seconds = $derived(countdown?.seconds ?? 0);
    let percent = $derived(countdown?.percent ?? 0);

    // past the deadline: sending resumes, and this countdown goes
    $effect(() => {
        if (countdown === undefined) throttleDeadline.set(0);
    });
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
