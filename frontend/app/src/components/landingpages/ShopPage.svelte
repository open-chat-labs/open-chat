<script lang="ts">
    import { onMount } from "svelte";
    import { currentTheme } from "../../theme/themes";

    let iframe: HTMLIFrameElement;

    function setStyleVariables() {
        const params = {
            kind: "shop_theme",
            "--sprd-cta-text-color": $currentTheme.button.txt,
            "--sprd-main2": $currentTheme.button.bg,
            "--sprd-main2-shifted-3": $currentTheme.button.hv,
        };
        iframe?.contentWindow?.postMessage(params, "*");
    }

    onMount(() => {
        iframe.addEventListener("load", setStyleVariables);

        return () => {
            iframe?.removeEventListener("load", setStyleVariables);
        };
    });
</script>

<iframe
    sandbox="allow-scripts allow-popups"
    bind:this={iframe}
    class="swag"
    title="OpenChat shop"
    frameborder="0"
    src="./shop.html"></iframe>

<style lang="scss">
    .swag {
        @include lp-content-padding();
        width: 100%;
        height: 100%;
        position: fixed;
        left: 0;

        @include mobile() {
            margin-top: 0;
            padding: 0;
        }
    }

    // // These are the theme variables - it does not seem officially supported to override them
    // // so probably safer to go with a light touch.

    // // --sprd-main1: #000000;
    // // --sprd-main2: #1e90ff;
    // // --sprd-main3: #ffffff;
    // // --sprd-sub2: #000000;
    // // --sprd-sub3: #ffffff;
    // // --sprd-main3-dec: 255, 255, 255;
    // // --sprd-cta-text-color: #000000;
    // // --sprd-main1-shifted: #808080;
    // // --sprd-main2-shifted: #8fc8ff;
    // // --sprd-main3-shifted: #cccccc;
    // // --sprd-sub2-shifted: #808080;
    // // --sprd-sub3-shifted: #cccccc;
    // // --sprd-sub2-shifted-2: #bfbfbf;
    // // --sprd-main2-shifted-3: #4ba6ff;

    // // We will just override a couple of bits - any more is a bit risky
    // --sprd-cta-text-color: var(--button-txt);
    // --sprd-main2: var(--button-bg);
    // --sprd-main2-shifted-3: var(--button-hv);
</style>
