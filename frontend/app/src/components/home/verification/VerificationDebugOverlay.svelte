<script lang="ts">
    import type { PoseEstimate } from "../../../utils/humanVerification/poseDetector";

    interface Props {
        pose: PoseEstimate | undefined;
    }

    let { pose }: Props = $props();
</script>

{#if pose !== undefined}
    <div class="debug">
        <div>faces: {pose.faceCount}</div>
        <div>yaw: {pose.yaw.toFixed(1)}°</div>
        <div>pitch: {pose.pitch.toFixed(1)}°</div>
        <div>width: {(pose.widthFraction * 100).toFixed(0)}%</div>
        <div>centre: {pose.centerX.toFixed(2)}, {pose.centerY.toFixed(2)}</div>
    </div>
{/if}

<style lang="scss">
    .debug {
        position: absolute;
        top: $sp3;
        left: $sp3;
        padding: $sp2 $sp3;
        background-color: rgba(0, 0, 0, 0.6);
        color: #0f0;
        font-family: monospace;
        font-size: 11px;
        border-radius: $sp2;
        pointer-events: none;
        z-index: 2;
    }
</style>
