<script lang="ts">
    import { mobileWidth } from "openchat-client";
    import Cellphone from "svelte-material-icons/Cellphone.svelte";
    import Monitor from "svelte-material-icons/Monitor.svelte";

    interface Props {
        caption: string;
        desktopUrl: string;
        mobileUrl: string;
    }

    let { caption, desktopUrl, mobileUrl }: Props = $props();

    let mode: "desktop" | "mobile" = $state($mobileWidth ? "mobile" : "desktop");
</script>

<div class="blog-image">
    <div class="switch">
        <div class="mode" class:selected={mode === "desktop"} onclick={() => (mode = "desktop")}>
            <Monitor />
            <span>Desktop</span>
        </div>
        <div class="mode" class:selected={mode === "mobile"} onclick={() => (mode = "mobile")}>
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
        border-radius: var(--rd);

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
