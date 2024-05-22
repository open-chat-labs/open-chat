<script lang="ts">
    import { onMount } from "svelte";
    import Progress from "../Progress.svelte";
    import DisappearsAt from "./DisappearsAt.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    export let countdown: number;

    let expiresAt = 0;

    onMount(() => {
        expiresAt = Date.now() + countdown;
    });

    $: percent = Math.floor((countdown / 60000) * 100);
</script>

<div class="throttle">
    <Progress size={"20px"} {percent}>
        <div class="msg">
            <DisappearsAt me={true} percentageExpired={percent} {expiresAt} />
            <Translatable
                resourceKey={i18nKey("throttleMessage", { time: Math.floor(countdown / 1000) })} />
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
