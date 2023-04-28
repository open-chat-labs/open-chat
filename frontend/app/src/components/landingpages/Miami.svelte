<script lang="ts">
    import { OPENCHAT_BOT_USER_ID } from "openchat-client";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Launch from "./Launch.svelte";

    const image: number = Math.floor(Math.random() * 3);

    $: heroSrc = $mobileWidth
        ? `../assets/miami/mobile_${image}.png`
        : `../assets/miami/desktop_${image}.png`;
</script>

<div class="miami">
    <div class="layout">
        <div class="info">
            <img src="../assets/ckbtc_nobackground.svg" alt="ckBTC logo" class="ckbtc" />
            <div class="text">
                <div class="sub-one">Claim your</div>
                <div class="sub-two">50,000 Satoshis</div>
            </div>
            <p class="blurb">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse
                lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.
            </p>

            <div class="launch-wrapper">
                <Launch text="Claim" rootPath={`/${OPENCHAT_BOT_USER_ID}`} on:login />
            </div>

            <div class="details">
                <h4>Details</h4>
                <p class="blurb">
                    Before claiming your prize, you must create an Internet Identity on the Internet
                    Computer Protocol (ICP) network. Creating an Internet Identity is an easy one
                    time process that will allow you to securely access any dApp in the Internet
                    Computer ecosystem without the hassle of usernames and passwords.
                </p>

                <h5>What to expect</h5>
                <div class="list">
                    <div class="num">1.</div>
                    <div class="blurb">
                        Create a new Internet Identity: Open the ICP wallet and click on "Create a
                        new Internet Identity." You will be prompted to choose a unique name for
                        your identity.
                    </div>
                    <div class="num">2.</div>
                    <div class="blurb">
                        Set up your identity: Once you have chosen a name for your identity, you
                        will be asked to set up your profile. You can add your photo, contact
                        information, and other details as desired.
                    </div>
                    <div class="num">3.</div>
                    <div class="blurb">
                        Use your Internet Identity: Once your identity has been verified, you can
                        use it to access various services and applications built on the ICP
                        protocol.
                    </div>
                </div>
            </div>
        </div>
        <div class="image">
            <img src={heroSrc} alt="Welcome to Miami" class="hero" />
        </div>
    </div>
</div>

<style type="text/scss">
    :global(.miami .layout .launch) {
        width: 100%;
        background-color: #4e27c7 !important;
    }

    .layout {
        $gutter: toRem(80);

        display: grid;
        grid-template-columns: 4fr 6fr;
        grid-template-areas: "info image";
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
                "image"
                "info";
        }

        .info {
            grid-area: info;

            .text {
                @include font(bold, normal, fs-200, 50);
                padding: $sp5 0;
            }

            .details {
                h4 {
                    @include font(bold, normal, fs-160, 38);
                    margin-bottom: $sp3;
                }

                .list {
                    display: grid;
                    grid-template-columns: auto auto;
                    align-items: start;
                    column-gap: $sp3;

                    .blurb {
                        @include font(book, normal, fs-80, 20);
                    }
                }
            }

            .blurb {
                color: var(--landing-txt-light);
                @include font(book, normal, fs-60, 18);
                margin-bottom: $sp5;
            }

            .launch-wrapper {
                width: 230px;
                border-radius: $sp2;
                text-align: center;
                margin-bottom: $sp6;

                @include mobile() {
                    width: 100%;
                }
            }

            @include mobile() {
                margin-top: 0;
            }
            .ckbtc {
                width: 88px;
                height: 88px;
            }

            @include mobile() {
                margin-top: toRem(-80);
                z-index: 1;
                padding: 0 toRem(24);
            }
        }

        .image {
            grid-area: image;
            .hero {
                width: 100%;
                height: 100%;
                border-radius: $sp4;
                object-fit: cover;
                object-position: 0 100%;

                @include mobile() {
                    border-radius: 0 0 $sp4 $sp4;
                }
            }
        }
    }
</style>
