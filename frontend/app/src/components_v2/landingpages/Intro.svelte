<script lang="ts">
    import { availableHeight, mobileWidth } from "openchat-client";
    import { currentTheme } from "../../theme/themes";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Launch from "./Launch.svelte";
    import OnChain from "./OnChain.svelte";
    import OnChainAlt from "./OnChainAlt.svelte";

    let chatImg = $derived(`/assets/screenshots/intro/${$currentTheme.mode}_chat.png`);
    let videoImg = $derived(
        $mobileWidth ? chatImg : `/assets/screenshots/intro/${$currentTheme.mode}_video.png`,
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
                <h2 class="title">Fully featured. Fully secure.</h2>
                <p class="blurb">
                    OpenChat is a community-owned chat application built for privacy, security and
                    anonymity. Start chatting today for free.
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
        <section class="mockups">
            <img src={videoImg} alt="Video call screenshot" class="img video-call" />
            {#if !$mobileWidth}
                <img src={chatImg} alt="Chat screenshot" class="img chat" />
            {/if}
        </section>
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
        gap: toRem(50);

        .text-wrapper {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: toRem(20);
            flex: 5;
        }

        .mockups {
            position: relative;
            flex-shrink: 0;
            flex: 3;

            .img {
                box-shadow: 0px 4px 20px 0px #00000066;
                width: 100%;
                border: toRem(5) solid var(--landing-phone-bd);
                border-radius: toRem(18);
                transition: transform 0.2s ease;
                animation: float 5s ease-in-out infinite;

                @include mobile() {
                    border: toRem(3) solid var(--landing-phone-bd);
                }
            }

            .video-call {
                width: 300px;

                @include mobile() {
                    width: 100%;
                }
            }

            .chat {
                position: absolute;
                top: -80px;
                left: 200px;
                width: 280px;
                animation-delay: 1.5s;
            }
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

    @keyframes float {
        0% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-4px);
        }
        100% {
            transform: translateY(0);
        }
    }

    .powered-by {
        position: relative;
        align-self: flex-start;
        margin-bottom: $sp4;
    }
</style>
