<script lang="ts">
    import { OPENCHAT_BOT_USER_ID } from "openchat-client";
    import Launch from "./Launch.svelte";
</script>

<div class="miami">
    <div class="text">
        <div class="sub-one">Get your free</div>
        <div class="sub-two">50,000</div>
        <div class="sub-three">satoshis</div>
    </div>
    <Launch rootPath={`/${OPENCHAT_BOT_USER_ID}`} on:login />
</div>

<style type="text/scss">
    .miami {
        text-align: center;
        @include lp-content-padding();

        .text {
            padding: $sp6;
            margin-bottom: $sp7;
        }

        .sub-one {
            @include font(bold, normal, fs-160);
        }

        .sub-two {
            @include font(bold, normal, fs-260);
            font-family: "Bebas Neue", cursive;
        }

        .sub-three {
            @include font(bold, normal, fs-220);
            font-size: 2.6rem;
            margin-top: -20px;
        }

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
