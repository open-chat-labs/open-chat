<script lang="ts">
    import { OPENCHAT_BOT_USER_ID } from "openchat-client";
    import Launch from "./Launch.svelte";
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

            <img src="../assets/ckbtc_nobackground.svg" alt="ckBTC logo" class="ckbtc" />
            <img src="../assets/ckbtc_nobackground.svg" alt="ckBTC logo" class="ckbtc fuzzy" />

            <div class="launch-wrapper">
                <Launch text="Let's go!" rootPath={`/${OPENCHAT_BOT_USER_ID}`} on:login />
            </div>
        </div>

        <div class="info">
            <div class="details">
                <section>
                    <h5 class="sub-title">What to expect</h5>
                    <div class="list">
                        <div class="num">1</div>
                        <div class="blurb">Create an OpenChat account.</div>
                        <div class="num">2</div>
                        <div class="blurb">
                            In a matter of seconds your sats will arrive in your OpenChat wallet as
                            ckBTC.
                        </div>
                        <div class="num">3</div>
                        <div class="blurb">Send your sats at the speed of chat 🚀</div>
                    </div>
                </section>
                <section>
                    <h5 class="sub-title">How does it work?</h5>
                    <p>
                        You will receive your 50,000 sats deposited in your OpenChat wallet as
                        ckBTC.
                    </p>
                </section>
                <section>
                    <h5 class="sub-title">What is OpenChat?</h5>
                    <p>
                        OpenChat is the world’s first decentralized chat service running 100%
                        on-chain and governed by a DAO.
                    </p>
                    <p>
                        OpenChat also doubles as a crypto wallet enabling you to send crypto to your
                        friends with a simple chat message. You can also send your sats to any
                        external Bitcoin address anytime!
                    </p>
                </section>
                <section>
                    <h5 class="sub-title">What is ckBTC?</h5>
                    <p>
                        ckBTC is “Bitcoin twin” on the Internet Computer blockchain that is backed
                        1:1 by Bitcoin held 100% on-chain. It offers fast, low fees and fully
                        on-chain transactions for Bitcoin on the ICP blockchain.
                    </p>
                </section>
            </div>
        </div>
    </div>
</div>

<style type="text/scss">
    :global(.miami .layout .launch) {
        width: 100%;
        background-color: #1b1c21 !important;
    }

    .layout {
        $gutter: toRem(80);

        display: grid;
        grid-template-columns: 5fr 5fr;
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
                }
                .sub-two {
                    @include font(bold, normal, fs-240, 68);
                }
                .sub-three {
                    @include font(medium, normal, fs-180, 38);
                }
            }
            .ckbtc {
                width: 130px;
                height: 130px;
                opacity: 0.3;
                position: absolute;
                right: toRem(30);
                top: toRem(120);

                &.fuzzy {
                    width: 80px;
                    height: 80px;
                    opacity: 0.3;
                    left: toRem(-15);
                    bottom: toRem(70);
                    filter: blur(2px);
                    top: unset;
                    right: unset;
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

            .details {
                color: var(--txt-light);
                @include font(book, normal, fs-100, 28);

                section {
                    margin-bottom: $sp5;
                }

                .sub-title {
                    @include font(bold, normal, fs-130, 29);
                    color: var(--txt);
                    margin-bottom: $sp3;
                }

                .list {
                    display: grid;
                    grid-template-columns: auto auto;
                    align-items: start;
                    column-gap: $sp3;

                    .num {
                        color: var(--txt);
                    }
                }
            }

            @include mobile() {
                padding: 0 toRem(24);
            }
        }
    }
</style>
