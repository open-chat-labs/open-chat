<script lang="ts">
    import { toPixel } from "../../stores/screenDimensions";

    export let originalWidth: number;
    export let originalHeight: number;
    export let src: string;
    export let title: string;
    export let totalWidth: number;

    let windowWidth = 0;
    $: scale = Math.min(windowWidth - toPixel(2), totalWidth) / originalWidth;

    $: wrapperStyle = `height: ${originalHeight * scale}px; width: ${originalWidth * scale}px;`;
    $: iframeStyle = `transform: scale(${scale})`;
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div class="wrapper" style={wrapperStyle}>
    <iframe
        {title}
        style={iframeStyle}
        width={`${originalWidth}px`}
        height={`${originalHeight}px`}
        seamless
        frameborder="0"
        scrolling="no"
        {src} />
</div>

<style lang="scss">
    .wrapper {
        margin-bottom: $sp5;
        overflow: hidden;
    }
    iframe {
        background-color: rgba(255, 255, 255, 0.3);
        transform-origin: 0 0;
    }
</style>
