<script lang="ts">
    import { OPENCHAT_BOT_USER_ID } from "openchat-client";
    import Launch from "../Launch.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import Card from "./Card.svelte";
    import Content from "../Content.svelte";
    import ArrowLink from "../../ArrowLink.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
</script>

<div class="miami">
    <div class="layout">
        <div class="main">
            <Content>
                <div class="content">
                    <div class="container">
                        <div class="oc-logo">
                            <div class="logo" />
                            <span class="txt">OpenChat</span>
                        </div>
                        <div class="hero-wrapper">
                            <img
                                class="hero"
                                src="../assets/miami/hero.svg"
                                alt="Send bitcoin at the speed of chat" />
                            <div class="headlines">
                                <div class="sub-one">Claim your</div>
                                <div class="sub-two">50,000 SATS</div>
                                <div class="sub-three">and send BTC at the speed of chat!</div>
                                {#if !$mobileWidth}
                                    <div class="launch-wrapper">
                                        <Launch
                                            text="Let's go!"
                                            rootPath={`/${OPENCHAT_BOT_USER_ID}`}
                                            on:login />
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            </Content>
            {#if $mobileWidth}
                <div class="launch-wrapper">
                    <Launch text="Let's go!" rootPath={`/${OPENCHAT_BOT_USER_ID}`} on:login />
                </div>
            {/if}
        </div>

        <Content>
            <div class="info">
                <section>
                    <h5 class="sub-title">Claiming your SATS is simple</h5>
                    <p class="follow">Follow these 3 steps</p>
                </section>
                <section class="cards">
                    <Card num={"01"} text={"Create an OpenChat account."} />
                    <Card
                        num={"02"}
                        text={"In a matter of seconds your SATS will arrive in your OpenChat wallet as ckBTC."} />
                    <Card num={"03"} text={"Send your SATS at the speed of chat 🚀"} />
                </section>
                <section class="bitcoin">
                    <div class="img">
                        <img
                            src="../assets/ckbtc_nobackground.svg"
                            alt="ckBTC logo"
                            class="ckbtc one" />
                        <img
                            src="../assets/ckbtc_nobackground.svg"
                            alt="ckBTC logo"
                            class="ckbtc two" />
                        <img
                            src="../assets/ckbtc_nobackground.svg"
                            alt="ckBTC logo"
                            class="ckbtc three" />
                        <img
                            src="../assets/ckbtc_nobackground.svg"
                            alt="ckBTC logo"
                            class="ckbtc four" />
                    </div>
                    <div class="what-is">
                        <div class="sub-title">What is ckBTC and how to use it?</div>
                        <p>
                            ckBTC is a Bitcoin twin created by Internet Computer smart contracts
                            that trustlessly and directly hold Bitcoin. ckBTC can be sent with 1-2
                            second finality and negligible fees.
                        </p>
                        <p>
                            <ArrowLink
                                url={"https://internetcomputer.org/bitcoin-integration"}
                                target={"_blank"}>ckBTC in more depth</ArrowLink>
                        </p>
                    </div>
                </section>

                <section>
                    <div class="sub-title">More questions?</div>
                </section>

                <CollapsibleCard title={"What is OpenChat?"}>
                    <p>
                        OpenChat is a decentralized chat service running 100% on-chain and governed
                        by a DAO.
                    </p>
                    <p>
                        OpenChat also doubles as a crypto wallet enabling you to send crypto with a
                        simple chat message (a transaction).
                    </p>
                </CollapsibleCard>
                <CollapsibleCard title={"What is Internet Identity?"}>
                    <p>
                        Tenderloin prosciutto bacon frankfurter andouille brisket shankle cupim
                        turducken tail pork loin drumstick ribeye pancetta. Ground round burgdoggen
                        alcatra short ribs sausage. Porchetta flank doner prosciutto fatback. Cupim
                        pork belly chicken sausage beef ribs.
                    </p>
                </CollapsibleCard>
                <CollapsibleCard title={"What is the Internet Computer?"}>
                    <p>
                        Bacon ipsum dolor amet strip steak cow meatloaf, swine tail kevin beef chuck
                        ham turducken. Alcatra tongue pork belly sirloin, ribeye tail cupim meatloaf
                        landjaeger short loin short ribs tri-tip brisket burgdoggen. Filet mignon
                        turducken shoulder tail hamburger. Doner beef venison, meatloaf bresaola
                        alcatra jerky.
                    </p>
                </CollapsibleCard>
            </div>
        </Content>
    </div>
</div>

<style type="text/scss">
    $purple: #4e27c7;
    $gradient: linear-gradient(
        32deg,
        rgba(228, 30, 152, 1) 0%,
        rgba(127, 99, 182, 1) 23%,
        rgba(56, 72, 223, 1) 50%,
        rgba(127, 99, 182, 1) 82%,
        rgba(243, 143, 40, 1) 100%
    );

    :global(.miami .layout .launch) {
        width: 100%;
        background-color: #fff !important;
        color: $purple;
    }

    .miami {
        overflow: hidden;
    }

    .layout {
        overflow: hidden;
        margin: 0;

        .content {
            @include lp-content-padding(220, 0);
        }

        .container {
            position: relative;

            .oc-logo {
                display: flex;
                gap: $sp3;
                align-items: center;

                .logo {
                    background-image: url("../assets/spinner.svg");
                    width: 44px;
                    height: 44px;
                }

                .txt {
                    @include font(bold, normal, fs-160, 40);
                }
            }
        }

        .main {
            background: $gradient;
            background-position: center;
            background-repeat: no-repeat;
            background-size: contain;
            position: relative;

            .hero-wrapper {
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-areas: "headlines image";
                gap: $sp6;
                align-items: center;

                @include mobile() {
                    gap: 0;
                    grid-template-columns: 1fr;
                    grid-template-areas:
                        "image"
                        "headlines";
                }

                .hero {
                    grid-area: image;
                    height: 100%;
                    position: relative;

                    @include size-below(lg) {
                        right: -50px;
                    }

                    @include mobile() {
                        left: toRem(35);
                    }
                }

                .headlines {
                    grid-area: headlines;
                    margin-bottom: toRem(30);
                    position: relative;
                    z-index: 1;

                    .sub-one {
                        @include font(medium, normal, fs-160, 38);
                        margin-bottom: $sp4;
                    }
                    .sub-two {
                        @include font(bold, normal, fs-240, 68);
                        margin-bottom: $sp4;
                    }
                    .sub-three {
                        @include font(medium, normal, fs-160, 38);
                        max-width: 350px;
                        margin-bottom: $sp5;

                        @include mobile() {
                            max-width: unset;
                            margin-bottom: $sp4;
                        }
                    }
                }
            }

            padding: $sp4;
            .launch-wrapper {
                width: 230px;
                border-radius: $sp2;
                text-align: center;
                bottom: -36px;

                @include mobile() {
                    position: absolute;
                    width: 100%;
                    width: calc(100% - 32px);
                }
            }
        }

        .info {
            color: var(--txt-light);
            @include font(book, normal, fs-100, 28);
            overflow: hidden;

            @include lp-content-padding(220, 24);

            padding-top: toRem(100) !important;

            section {
                margin-bottom: $sp7;
            }

            p {
                margin-bottom: $sp4;
            }

            .bitcoin {
                display: grid;
                grid-template-columns: 2fr 3fr;
                gap: $sp6;
                align-items: center;

                @include mobile() {
                    grid-template-columns: 1fr;
                }

                .img {
                    background: $gradient;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 300px;
                    border-radius: $sp3;
                    overflow: hidden;

                    .ckbtc {
                        @mixin ckbtclogo($size, $opacity, $top, $left, $bottom, $right, $filter) {
                            width: $size;
                            height: $size;
                            opacity: $opacity;
                            top: $top;
                            left: $left;
                            bottom: $bottom;
                            right: $right;
                            filter: $filter;
                            position: absolute;
                        }
                        &.one {
                            width: 200px;
                            height: 200px;
                        }

                        &.two {
                            @include ckbtclogo(80px, 0.3, unset, -7%, 4%, unset, blur(3px));
                        }

                        &.three {
                            @include ckbtclogo(60px, 0.3, 8%, 8%, unset, unset, blur(3px));
                        }

                        &.four {
                            @include ckbtclogo(80px, 0.3, unset, unset, 8%, 0%, blur(3px));
                        }
                    }
                }
            }

            .follow {
                @include font(bold, normal, fs-130, 28);
                color: #ad93ff;
            }

            .sub-title {
                @include font(bold, normal, fs-160, 40);
                color: var(--txt);
                margin-bottom: $sp3;
            }

            .cards {
                display: flex;
                flex-direction: column;
                gap: $sp5;
                overflow: auto;

                @include mobile() {
                    gap: $sp4;
                }
            }
        }
    }
</style>
