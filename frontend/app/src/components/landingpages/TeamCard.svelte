<script lang="ts">
    import { fade } from "svelte/transition";
    interface Props {
        imageUrl: string;
        hoverImageUrl: string;
        name: string;
        blurb: string;
    }

    let { imageUrl, hoverImageUrl, name, blurb }: Props = $props();

    let hovering = $state(false);
</script>

<div class="team-card">
    <div
        class="img"
        onmouseenter={() => (hovering = true)}
        onmouseleave={() => (hovering = false)}
        style={`background-image: url("${imageUrl}")`}>
        {#if hovering}
            <div
                transition:fade|local
                class="overlay"
                style={`background-image: url("${hoverImageUrl}")`}>
            </div>
        {/if}
    </div>
    <div class="name">
        {name}
    </div>
    <div class="blurb">
        {blurb}
    </div>
</div>

<style lang="scss">
    .team-card {
        display: flex;
        flex-direction: column;
        margin-bottom: $sp4;
    }
    .img,
    .overlay {
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
    }
    .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
    .img {
        height: toRem(250);
        // background-color: var(--secondary);
        position: relative;
        margin-bottom: $sp4;
        position: relative;

        @include size-below(xs) {
            height: toRem(350);
        }
    }

    .name {
        @include font(bold, normal, fs-160);
        margin-bottom: $sp4;
    }

    .blurb {
        color: var(--landing-txt-light);
    }
</style>
