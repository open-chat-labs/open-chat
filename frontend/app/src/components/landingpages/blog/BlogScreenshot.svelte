<script lang="ts">
    import Monitor from "svelte-material-icons/Monitor.svelte";
    import Cellphone from "svelte-material-icons/Cellphone.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";

    export let caption: string;
    export let desktopUrl: string;
    export let mobileUrl: string;

    let mode: "desktop" | "mobile" = $mobileWidth ? "mobile" : "desktop";
</script>

<div class="blog-image">
    <div class="switch">
        <div class="mode" class:selected={mode === "desktop"} on:click={() => (mode = "desktop")}>
            <Monitor />
            <span>Desktop</span>
        </div>
        <div class="mode" class:selected={mode === "mobile"} on:click={() => (mode = "mobile")}>
            <Cellphone />
            <span>Mobile</span>
        </div>
    </div>
    {#if mode === "desktop"}
        <img class="landscape" src={desktopUrl} alt={caption} />
    {:else if mode === "mobile"}
        <img class="portrait" src={mobileUrl} alt={caption} />
    {/if}
    <div class="image-caption">{caption}</div>
</div>

<style lang="scss">
    .blog-image {
        margin: $sp6 0;
    }
    .switch {
        display: flex;
        gap: $sp3;
        align-items: center;
        cursor: pointer;
        margin-bottom: $sp3;
    }

    .mode {
        display: flex;
        gap: $sp3;
        align-items: center;
        padding: 0 $sp3;
        border-radius: $sp2;

        &.selected {
            background-color: var(--primary);
            color: #fff;
        }
    }
    img.landscape {
        width: 100%;
    }

    img.portrait {
        width: 50%;

        @include mobile() {
            width: 100%;
        }
    }

    .image-caption {
        @include font(book, normal, fs-70);
        color: var(--landing-txt-light);
        margin-bottom: $sp4;
    }
</style>
