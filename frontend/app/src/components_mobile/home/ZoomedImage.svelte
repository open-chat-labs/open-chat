<script lang="ts">
    import { IconButton } from "component-lib";
    import Close from "svelte-material-icons/Close.svelte";

    interface Props {
        url: string;
        onClose: () => void;
    }

    let { url, onClose }: Props = $props();
</script>

<div class="image-frame">
    <div class="bg" style={`background-image: url(${url})`}></div>
    <img class="fg" src={url} alt="" />
    <div class="close">
        <IconButton onclick={onClose}>
            {#snippet icon(color)}
                <Close {color} />
            {/snippet}
        </IconButton>
    </div>
</div>

<style lang="scss">
    .image-frame {
        @include z-index("overlay");
        position: fixed;
        inset: 0;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: black;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        .bg {
            position: absolute;
            inset: -10%;
            background-size: cover;
            background-position: center;
            filter: blur(10px);
            transform: scale(1.1);
        }
        .bg::after {
            content: "";
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.25);
        }
        .fg {
            position: relative;
            z-index: 1;
            max-width: 100vw;
            max-height: 100vh;
            width: auto;
            height: auto;
            margin: auto;
            display: block;
            object-fit: contain;
        }
        .close {
            position: absolute;
            top: 2rem;
            right: 2rem;
        }
    }
</style>
