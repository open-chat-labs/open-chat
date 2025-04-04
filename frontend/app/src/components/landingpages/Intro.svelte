<script lang="ts">
    import Launch from "./Launch.svelte";
    import { currentTheme } from "../../theme/themes";
    import OnChain from "./OnChain.svelte";
    import { availableHeight, mobileWidth } from "../../stores/screenDimensions";
    import OnChainAlt from "./OnChainAlt.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";

    let imgUrl = $derived(
        $currentTheme.mode === "light"
            ? "/assets/screenshots/intro_light.png"
            : "/assets/screenshots/intro_dark.png",
    );

    let introStyle = $derived($mobileWidth ? "" : `height: ${$availableHeight}px`);
</script>

<div class="wrapper" style={introStyle}>
    <div class="intro">
        <div class="text-wrapper">
            <div class="text">
                <div class="name">
                    <div class="logo-img">
                        <FancyLoader loop={false} />
                    </div>
                    <h1>OpenChat</h1>
                </div>
                <h2 class="title">Where web3 communicates</h2>
                <p class="blurb">
                    OpenChat is a fully featured chat application running end-to-end on the <a
                        href="https://internetcomputer.org/"
                        target="_blank">
                        Internet Computer
                    </a> blockchain.
                </p>
                <div class="launch">
                    <Launch />
                </div>
            </div>
            {#if !$mobileWidth}
                <div>
                    <OnChain />
                </div>
            {/if}
        </div>
        <div class="image-wrapper-wrapper">
            <div class="image-wrapper">
                <img class="img" alt="Open chat list" src={imgUrl} />
                {#if $mobileWidth}
                    <div
                        class:light={$currentTheme.mode === "light"}
                        class:dark={$currentTheme.mode === "dark"}
                        class="overlay">
                    </div>
                {/if}
            </div>
        </div>
    </div>
    {#if $mobileWidth}
        <div class="powered-by">
            <OnChainAlt />
        </div>
    {/if}
</div>

<style lang="scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        justify-content: center;
        align-items: center;
    }
    .logo-img {
        height: 56px;
        width: 56px;

        @include mobile() {
            height: 40px;
            width: 40px;
        }
    }
    .intro {
        display: flex;
        justify-content: center;
        align-items: stretch;
        flex-direction: row;
        gap: toRem(100);

        .text-wrapper {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: toRem(20);
        }

        .text {
            display: flex;
            flex-direction: column;
            gap: toRem(20);
            @include mobile() {
                margin-top: 0;
                margin-bottom: $sp4;
            }
        }

        @include mobile() {
            margin-top: toRem(80);
            margin-bottom: 0;
            display: block;
        }
    }

    .name {
        display: flex;
        align-items: center;
        gap: toRem(8);
        h1 {
            @include font(bold, normal, fs-220);
            margin: 0;

            @include mobile() {
                @include font(bold, normal, fs-160);
            }
        }
    }
    .title {
        @include font(medium, normal, fs-180);
        margin-top: 0;
        margin-bottom: toRem(10);

        @include mobile() {
            @include font(medium, normal, fs-230);
        }
    }

    .blurb {
        color: var(--landing-txt-light);
        margin-bottom: toRem(24);
        @include font(book, normal, fs-120, 28);

        @include mobile() {
            margin-bottom: toRem(16);
        }
    }

    .launch {
        display: flex;
        gap: toRem(24);
        align-items: center;
        @include mobile() {
            margin-bottom: toRem(16);
        }
    }

    .image-wrapper-wrapper {
        min-width: 270px;
        max-width: 390px;
        @include mobile() {
            border-radius: toRem(18);
            height: toRem(420);
            overflow: hidden;
        }
    }

    .image-wrapper {
        padding-right: toRem(30);
        position: relative;

        @include mobile() {
            padding: 0;
        }

        .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;

            &.dark {
                background: linear-gradient(
                    180deg,
                    rgba(27, 28, 33, 0) 0%,
                    #1b1c21 42.19%,
                    #1b1c21 100%
                );
            }

            &.light {
                background: linear-gradient(
                    180deg,
                    rgba(231, 238, 247, 0) 0%,
                    #ffffff 39.74%,
                    #ffffff 100%
                );
            }
        }
    }

    .img {
        box-shadow: 8px 4px 16px 0px #00000066;
        width: 100%;
        border: toRem(5) solid var(--landing-phone-bd);
        border-radius: toRem(18);

        @include mobile() {
            border: toRem(3) solid var(--landing-phone-bd);
        }
    }

    .powered-by {
        position: relative;
        align-self: flex-start;
        top: -$sp6;
    }
</style>
