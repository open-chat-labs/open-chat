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

        <Launch text="Claim" rootPath={`/${OPENCHAT_BOT_USER_ID}`} on:login />
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
            padding: $sp6 0;
            margin-top: $sp7;
            margin-bottom: $sp3;
        }

        .blurb {
            color: var(--txt-light);
            @include font(book, normal, fs-60, 18);
            margin-bottom: $sp5;
        }

        // .sub-one {
        //     @include font(bold, normal, fs-160);
        // }

        // .sub-two {
        //     @include font(bold, normal, fs-260);
        //     font-family: "Bebas Neue", cursive;
        // }

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
