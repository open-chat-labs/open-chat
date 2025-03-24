<script lang="ts">
    import ArrowExpand from "svelte-material-icons/ArrowExpand.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";

    let zoom = $state(false);

    interface Props {
        url: string;
        alt: string;
        onZoom: (url: string, alt: string) => void;
    }

    let { url, alt, onZoom }: Props = $props();

    function zoomin() {
        if ($mobileWidth) return;
        onZoom(url, alt);
        zoom = !zoom;
    }
</script>

{#if zoom}
    <div class="zoomed" style={`background-image: url(${url})`}></div>
{/if}

<div class="wrapper" onclick={zoomin}>
    <img class="zoomable" src={url} {alt} />

    {#if !$mobileWidth}
        <div class="expand">
            <ArrowExpand size={"1em"} color={"#000"} />
        </div>
    {/if}
</div>

<style lang="scss">
    .expand {
        position: absolute;
        bottom: toRem(10);
        left: toRem(10);
    }

    .wrapper {
        position: relative;
        cursor: pointer;
    }

    .zoomable {
        width: 100%;
    }
</style>
