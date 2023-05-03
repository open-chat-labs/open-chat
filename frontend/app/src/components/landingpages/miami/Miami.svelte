<script lang="ts">
    import { OPENCHAT_BOT_USER_ID } from "openchat-client";
    import Launch from "../Launch.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import Card from "./Card.svelte";
</script>

<div class="miami">
    <div class="layout">
        <div class="main">
            <div class="logos">
                <div class="bitcoin" />
                <div class="plus">+</div>
                <div class="dfinity" />
                <div class="text">
                    <div class="faucet">Bitcoin faucet powered by</div>
                    <div class="ic">internet computer</div>
                </div>
            </div>
            <div class="headlines">
                <div class="sub-one">Claim your</div>
                <div class="sub-two">50,000 Sats</div>
                <div class="sub-three">& Send BTC at the speed of chat!</div>
            </div>

            <img src="../assets/ckbtc_nobackground.svg" alt="ckBTC logo" class="ckbtc one" />
            <img src="../assets/ckbtc_nobackground.svg" alt="ckBTC logo" class="ckbtc two" />
            <img src="../assets/ckbtc_nobackground.svg" alt="ckBTC logo" class="ckbtc three" />
            <img src="../assets/ckbtc_nobackground.svg" alt="ckBTC logo" class="ckbtc four" />

            <div class="launch-wrapper">
                <Launch text="Let's go!" rootPath={`/${OPENCHAT_BOT_USER_ID}`} on:login />
            </div>
        </div>

        <div class="info">
            <section>
                <h5 class="sub-title">Claiming your sats is simple</h5>
                <p>Follow these 3 steps</p>
            </section>
            <section class="cards">
                <Card num={1} text={"Create an OpenChat account."} />
                <Card
                    num={2}
                    text={"In a matter of seconds your sats will arrive in your OpenChat wallet as ckBTC."} />
                <Card num={3} text={"Send your sats at the speed of chat 🚀"} />
            </section>
            <section>
                <h5 class="sub-title">More details</h5>
            </section>
            <CollapsibleCard title={"How does it work?"}>
                <p>You will receive your 50,000 sats deposited in your OpenChat wallet as ckBTC.</p>
            </CollapsibleCard>
            <CollapsibleCard title={"What is OpenChat?"}>
                <p>
                    OpenChat is the world’s first decentralized chat service running 100% on-chain
                    and governed by a DAO.
                </p>
                <p>
                    OpenChat also doubles as a crypto wallet enabling you to send crypto to your
                    friends with a simple chat message. You can also send your sats to any external
                    Bitcoin address anytime!
                </p>
            </CollapsibleCard>
            <CollapsibleCard title={"What is ckBTC?"}>
                <p>
                    ckBTC is “Bitcoin twin” on the Internet Computer blockchain that is backed 1:1
                    by Bitcoin held 100% on-chain. It offers fast, low fees and fully on-chain
                    transactions for Bitcoin on the ICP blockchain.
                </p>
            </CollapsibleCard>
        </div>
    </div>
</div>

<style type="text/scss">
    :global(.miami .layout .launch) {
        width: 100%;
        background-color: #1b1c21 !important;
    }

    .miami {
        overflow: hidden;
    }

    .layout {
        $gutter: toRem(80);

        overflow: hidden;
        display: grid;
        grid-template-columns: 8fr 12fr;
        grid-template-areas: "main info";
        gap: $gutter;
        margin-top: $gutter;

        @include size-below-n(1440px) {
            margin-left: $gutter;
            margin-right: $gutter;
        }

        @include size-below(lg) {
            margin-left: toRem(40);
            margin-right: toRem(40);
            gap: toRem(40);
        }

        @include mobile() {
            margin: 0;
            grid-template-columns: 1fr;
            grid-template-areas:
                "main"
                "info";
        }

        .main {
            overflow: hidden;
            background-color: #4e27c7;
            background: rgb(243, 143, 40);
            background: linear-gradient(
                32deg,
                rgba(243, 143, 40, 1) 0%,
                rgba(127, 99, 182, 1) 23%,
                rgba(56, 72, 223, 1) 50%,
                rgba(127, 99, 182, 1) 82%,
                rgba(228, 30, 152, 1) 100%
            );
            grid-area: main;
            position: relative;
            padding: toRem(40) $sp4;
            .headlines {
                margin-top: toRem(80);
                margin-bottom: toRem(40);
                position: relative;
                z-index: 1;

                .sub-one {
                    @include font(medium, normal, fs-100, 22);
                    margin-bottom: $sp4;
                }
                .sub-two {
                    @include font(bold, normal, fs-240, 68);
                    margin-bottom: $sp4;
                }
                .sub-three {
                    @include font(medium, normal, fs-180, 38);
                }
            }
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
            .ckbtc {
                &.one {
                    @include ckbtclogo(130px, 0.3, 25%, unset, unset, 10%, none);
                }

                &.two {
                    @include ckbtclogo(80px, 0.3, unset, -10%, 15%, unset, blur(3px));
                }

                &.three {
                    @include ckbtclogo(60px, 0.3, 25%, unset, unset, 45%, blur(3px));
                }

                &.four {
                    @include ckbtclogo(80px, 0.3, unset, unset, 25%, -10%, blur(3px));
                }
            }
            .logos {
                display: flex;
                align-items: center;
                gap: $sp3;

                .bitcoin {
                    width: 28px;
                    height: 28px;
                    background-image: url("../assets/bitcoin_token.png");
                    background-repeat: no-repeat;
                    background-size: contain;
                }
                .dfinity {
                    width: 51px;
                    height: 24px;
                    background-image: url("../assets/dfinity_logo.svg");
                    background-repeat: no-repeat;
                    background-size: contain;
                }
                .faucet {
                    @include font(medium, normal, fs-50, 14);
                }
                .ic {
                    text-transform: uppercase;
                    @include font(bold, normal, fs-80, 14);
                }
            }
            .launch-wrapper {
                width: 230px;
                border-radius: $sp2;
                text-align: center;
                position: relative;

                @include mobile() {
                    width: 100%;
                }
            }
        }

        .info {
            grid-area: info;

            color: var(--txt-light);
            @include font(book, normal, fs-100, 28);
            overflow: hidden;

            section {
                margin-bottom: $sp5;
                padding: 0 toRem(24);

                &.cards {
                    padding: 0 0 0 toRem(24);
                }
            }

            .sub-title {
                @include font(bold, normal, fs-130, 29);
                color: var(--txt);
                margin-bottom: $sp3;
            }

            .cards {
                display: flex;
                gap: $sp4;
                overflow: auto;
            }

            @include mobile() {
                // padding: 0 toRem(24);
            }
        }
    }
</style>
