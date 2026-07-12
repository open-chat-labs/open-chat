<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        backgroundColor: string;
        color?: string;
        title: string;
        height: number;
        children?: Snippet;
    }

    let {
        backgroundColor,
        color = "var(--landing-txt)",
        title,
        height,
        children,
    }: Props = $props();

    let bgStyle = $derived(
        backgroundColor === "transparent"
            ? ""
            : `background: linear-gradient(78.53deg, rgba(0, 0, 0, 0.1) 5.34%, rgba(0, 0, 0, 0) 70.2%), ${backgroundColor};`,
    );
</script>

<div style={`height: ${height}px; color: ${color}; ${bgStyle}`} class="feature">
    <div class="inner">
        <div class="desc">
            <div class="title">
                {title}
            </div>
            <div class="blurb" class:light={backgroundColor === "transparent"}>
                {@render children?.()}
            </div>
        </div>
        <div class="phone"></div>
    </div>
</div>

<style lang="scss">
    .title {
        margin: 0;
        @include font(medium, normal, fs-230, 68);
        margin-bottom: $sp5;

        @include mobile() {
            @include font(medium, normal, fs-180, 44);
        }
    }
    .blurb {
        @include font(light, normal, fs-100, 28);

        &.light {
            color: var(--landing-txt-light);
        }
    }

    .inner {
        max-width: 1440px;
        margin: 0 auto;
        display: flex;
        height: 100%;
        align-items: flex-start;
        justify-content: center;
        padding: 0 toRem(160);
        @include mobile() {
            padding: 0 toRem(24);
        }

        .desc {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            height: 100%;
            flex: 1;
        }

        .phone {
            flex: 1;
        }
    }
</style>
