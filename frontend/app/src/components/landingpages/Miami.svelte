<script lang="ts">
    import { OPENCHAT_BOT_USER_ID } from "openchat-client";
    import Launch from "./Launch.svelte";
</script>

<div class="miami">
    <div class="hero-wrapper">
        <img src="../assets/miami/mobile_one.png" alt="Welcome to Miami" class="hero" />

        <div class="logo">
            <img src="../assets/ckbtc_nobackground.svg" alt="ckBTC logo" class="ckbtc" />
        </div>
    </div>

    <div class="miami-content">
        <div class="text">
            <div class="sub-one">Claim your</div>
            <div class="sub-two">50,000 Satoshis</div>
        </div>
        <p class="blurb">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse
            lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.
        </p>

        <div class="launch">
            <Launch text="Claim" rootPath={`/${OPENCHAT_BOT_USER_ID}`} on:login />
        </div>

        <div class="details">
            <h4>Details</h4>
            <p class="blurb">
                Before claiming your prize, you must create an Internet Identity on the Internet
                Computer Protocol (ICP) network. Creating an Internet Identity is an easy one time
                process that will allow you to securely access any dApp in the Internet Computer
                ecosystem without the hassle of usernames and passwords.
            </p>

            <h5>What to expect</h5>
            <div class="list">
                <div class="num">1.</div>
                <div class="blurb">
                    Create a new Internet Identity: Open the ICP wallet and click on "Create a new
                    Internet Identity." You will be prompted to choose a unique name for your
                    identity.
                </div>
                <div class="num">2.</div>
                <div class="blurb">
                    Set up your identity: Once you have chosen a name for your identity, you will be
                    asked to set up your profile. You can add your photo, contact information, and
                    other details as desired.
                </div>
                <div class="num">3.</div>
                <div class="blurb">
                    Use your Internet Identity: Once your identity has been verified, you can use it
                    to access various services and applications built on the ICP protocol.
                </div>
            </div>
        </div>
    </div>
</div>

<style type="text/scss">
    :global(.miami-content .launch) {
        background-color: #4e27c7 !important;
    }

    .miami-content {
        @include lp-content-padding();
    }

    .hero-wrapper {
        position: relative;
        .hero {
            width: 100%;
        }

        .logo {
            position: absolute;
            bottom: -50px;
            left: 18px;
            width: 100px;
            height: 100px;
            background-color: #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;

            .ckbtc {
                width: 88px;
                height: 88px;
            }
        }
    }

    .miami {
        .text {
            @include font(bold, normal, fs-200, 50);
            padding: $sp5 0;
            margin-top: $sp7;
            margin-bottom: $sp3;
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

        .launch {
            margin-bottom: $sp6;
        }

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
