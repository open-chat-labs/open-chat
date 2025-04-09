<script lang="ts">
    import { ui } from "openchat-client";

    interface Props {
        originalWidth: number;
        originalHeight: number;
        src: string;
        title: string;
        totalWidth: number;
    }

    let { originalWidth, originalHeight, src, title, totalWidth }: Props = $props();

    let windowWidth = $state(0);
    let scale = $derived(Math.min(windowWidth - ui.toPixel(2), totalWidth) / originalWidth);

    let wrapperStyle = $derived(
        `height: ${originalHeight * scale}px; width: ${originalWidth * scale}px;`,
    );
    let iframeStyle = $derived(`transform: scale(${scale})`);
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
        {src}></iframe>
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
